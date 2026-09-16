import { NextResponse, type NextRequest } from "next/server";

import { Prisma } from "@/generated/prisma";
import { prisma } from "@/lib/prisma";
import { toTrackDTO } from "@/lib/types";
import { formatZodError, trackUpdateSchema } from "@/lib/validation";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ id: string }> };

/** GET /api/tracks/:id */
export async function GET(_request: NextRequest, context: RouteContext) {
  const { id } = await context.params;
  const track = await prisma.track.findUnique({ where: { id } });
  if (!track) {
    return NextResponse.json({ error: "楽曲が見つかりません" }, { status: 404 });
  }
  return NextResponse.json({ track: toTrackDTO(track) });
}

/** PATCH /api/tracks/:id */
export async function PATCH(request: NextRequest, context: RouteContext) {
  const { id } = await context.params;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "リクエストボディが不正な JSON です" }, { status: 400 });
  }

  const parsed = trackUpdateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "入力内容を確認してください", issues: formatZodError(parsed.error) },
      { status: 422 },
    );
  }

  try {
    const track = await prisma.track.update({ where: { id }, data: parsed.data });
    return NextResponse.json({ track: toTrackDTO(track) });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === "P2025") {
        return NextResponse.json({ error: "楽曲が見つかりません" }, { status: 404 });
      }
      if (error.code === "P2002") {
        return NextResponse.json(
          { error: "同じタイトルとアーティストの楽曲が既に登録されています" },
          { status: 409 },
        );
      }
    }
    console.error("[PATCH /api/tracks/:id]", error);
    return NextResponse.json({ error: "楽曲の更新に失敗しました" }, { status: 500 });
  }
}

/** DELETE /api/tracks/:id */
export async function DELETE(_request: NextRequest, context: RouteContext) {
  const { id } = await context.params;
  try {
    await prisma.track.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2025") {
      return NextResponse.json({ error: "楽曲が見つかりません" }, { status: 404 });
    }
    console.error("[DELETE /api/tracks/:id]", error);
    return NextResponse.json({ error: "楽曲の削除に失敗しました" }, { status: 500 });
  }
}
