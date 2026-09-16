import { prisma } from "./prisma";

/**
 * ライブラリで実際に使われているジャンルの一覧。
 *
 * サーバー専用。ジャンル候補の生成（mergeGenreSuggestions）は
 * クライアントからも使うため @/lib/genres に分けてある。
 */
export async function listLibraryGenres(): Promise<string[]> {
  const rows = await prisma.track.findMany({
    where: { genre: { not: null } },
    distinct: ["genre"],
    select: { genre: true },
    orderBy: { genre: "asc" },
  });

  return rows.map((row) => row.genre).filter((genre): genre is string => !!genre);
}
