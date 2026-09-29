import { NextResponse, type NextRequest } from "next/server";

import { generateAutoSet } from "@/lib/autoset";
import { prisma } from "@/lib/prisma";
import { toTrackDTO } from "@/lib/types";
import { autosetSchema, formatZodError } from "@/lib/validation";

export const dynamic = "force-dynamic";

/**
 * POST /api/autoset — セットを自動で組む（保存はしない）
 *
 * body: { trackIds, length, shape, maxPitchPercent?, allowHalfDouble?, keyCompatibleOnly?, keepTempo?, genre? }
 *   trackIds  固定する曲。1 曲なら「その曲から組む」、複数なら「続きを組む」
 *   length    固定した曲を含めた合計曲数（2〜40）
 *   shape     arc（山型）/ build（右肩上がり）/ steady（一定）/ cooldown（クールダウン）
 *   keepTempo セットのテンポを 1 曲目の ±6% 付近に保つ（既定 true）
 */
export async function POST(request: NextRequest) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "リクエストボディが不正な JSON です" }, { status: 400 });
  }

  const parsed = autosetSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "入力内容を確認してください", issues: formatZodError(parsed.error) },
      { status: 422 },
    );
  }
  const input = parsed.data;

  try {
    const all = (await prisma.track.findMany()).map(toTrackDTO);
    const byId = new Map(all.map((track) => [track.id, track]));

    const missing = input.trackIds.filter((id) => !byId.has(id));
    if (missing.length > 0) {
      return NextResponse.json(
        { error: "ライブラリに存在しない曲が含まれています", detail: { missingTrackIds: missing } },
        { status: 422 },
      );
    }

    const prefix = input.trackIds.map((id) => byId.get(id)!);
    const result = generateAutoSet(prefix, all, {
      length: input.length,
      shape: input.shape,
      maxPitchPercent: input.maxPitchPercent,
      allowHalfDouble: input.allowHalfDouble,
      keyCompatibleOnly: input.keyCompatibleOnly,
      keepTempo: input.keepTempo,
      genre: input.genre ?? null,
    });

    return NextResponse.json({ result });
  } catch (error) {
    console.error("[POST /api/autoset]", error);
    return NextResponse.json({ error: "セットの自動生成に失敗しました" }, { status: 500 });
  }
}
