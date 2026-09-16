import { NextResponse, type NextRequest } from "next/server";

import { Prisma } from "@/generated/prisma";
import { prisma } from "@/lib/prisma";
import { toTrackDTO } from "@/lib/types";
import { formatZodError, trackCreateSchema } from "@/lib/validation";

export const dynamic = "force-dynamic";

/** GET /api/tracks — 楽曲一覧（?q= でタイトル/アーティスト検索、?genre= で絞り込み） */
export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const q = searchParams.get("q")?.trim();
  const genre = searchParams.get("genre")?.trim();

  const where: Prisma.TrackWhereInput = {};
  if (q) {
    where.OR = [
      { title: { contains: q, mode: "insensitive" } },
      { artist: { contains: q, mode: "insensitive" } },
      { label: { contains: q, mode: "insensitive" } },
    ];
  }
  if (genre) where.genre = genre;

  const tracks = await prisma.track.findMany({
    where,
    orderBy: [{ artist: "asc" }, { title: "asc" }],
  });

  return NextResponse.json({
    count: tracks.length,
    tracks: tracks.map(toTrackDTO),
  });
}

/** POST /api/tracks — 楽曲登録 */
export async function POST(request: NextRequest) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "リクエストボディが不正な JSON です" }, { status: 400 });
  }

  const parsed = trackCreateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "入力内容を確認してください", issues: formatZodError(parsed.error) },
      { status: 422 },
    );
  }

  try {
    const track = await prisma.track.create({ data: parsed.data });
    return NextResponse.json({ track: toTrackDTO(track) }, { status: 201 });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return NextResponse.json(
        { error: "同じタイトルとアーティストの楽曲が既に登録されています" },
        { status: 409 },
      );
    }
    console.error("[POST /api/tracks]", error);
    return NextResponse.json({ error: "楽曲の登録に失敗しました" }, { status: 500 });
  }
}
