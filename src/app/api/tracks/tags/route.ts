import { NextResponse, type NextRequest } from "next/server";

import { prisma } from "@/lib/prisma";
import { applyTagChanges, MAX_TAGS_PER_TRACK, tagKey } from "@/lib/tags";
import { bulkTagSchema, formatZodError } from "@/lib/validation";

export const dynamic = "force-dynamic";

/**
 * POST /api/tracks/tags — 複数の曲にまとめてタグを付ける / 外す
 *
 * body: { trackIds: string[], add?: string[], remove?: string[] }
 *
 * 他のタグはそのまま残す。変化のない曲は更新しない。
 */
export async function POST(request: NextRequest) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "リクエストボディが不正な JSON です" }, { status: 400 });
  }

  const parsed = bulkTagSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "入力内容を確認してください", issues: formatZodError(parsed.error) },
      { status: 422 },
    );
  }
  const { trackIds, add, remove } = parsed.data;

  try {
    const tracks = await prisma.track.findMany({
      where: { id: { in: trackIds } },
      select: { id: true, tags: true },
    });

    // add と remove の両方に入っているタグは「外す」が勝つので、上限判定から除く
    const removeKeys = new Set(remove.map(tagKey));
    const effectiveAdd = add.filter((tag) => !removeKeys.has(tagKey(tag)));

    const changes: Array<{ id: string; tags: string[] }> = [];
    // 上限に達していて付けられなかった曲
    let capped = 0;

    for (const track of tracks) {
      const current = track.tags ?? [];
      const next = applyTagChanges(current, add, remove);
      const nextKeys = new Set(next.map(tagKey));
      if (effectiveAdd.some((tag) => !nextKeys.has(tagKey(tag)))) capped += 1;
      if (JSON.stringify(next) !== JSON.stringify(current)) {
        changes.push({ id: track.id, tags: next });
      }
    }

    if (changes.length > 0) {
      await prisma.$transaction(
        changes.map((change) =>
          prisma.track.update({ where: { id: change.id }, data: { tags: change.tags } }),
        ),
      );
    }

    return NextResponse.json({
      updated: changes.length,
      unchanged: tracks.length - changes.length,
      missing: trackIds.length - tracks.length,
      capped,
      maxTagsPerTrack: MAX_TAGS_PER_TRACK,
      tracks: changes,
    });
  } catch (error) {
    console.error("[POST /api/tracks/tags]", error);
    return NextResponse.json({ error: "タグの更新に失敗しました" }, { status: 500 });
  }
}
