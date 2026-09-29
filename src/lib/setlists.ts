/**
 * セットリストの永続化。サーバー専用。
 *
 * 曲順は SetlistItem.position で持つ。並べ替えや途中の削除は差分更新せず、
 * 保存のたびにトランザクション内で全件入れ替える（1 セット数十曲規模なので十分速い）。
 */

import type { Prisma } from "@/generated/prisma";

import { prisma } from "./prisma";
import { toTrackDTO, type SetlistDTO, type SetlistSummaryDTO } from "./types";
import type { SetlistUpdateInput, SetlistWriteInput } from "./validation";

export class SetlistError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly detail?: unknown,
  ) {
    super(message);
  }
}

const withTracks = {
  items: { orderBy: { position: "asc" }, include: { track: true } },
} satisfies Prisma.SetlistInclude;

type SetlistWithTracks = Prisma.SetlistGetPayload<{ include: typeof withTracks }>;

function sumDuration(durations: Array<number | null>): number {
  return durations.reduce<number>((sum, sec) => sum + (sec ?? 0), 0);
}

export function toSetlistDTO(setlist: SetlistWithTracks): SetlistDTO {
  const tracks = setlist.items.map((item) => toTrackDTO(item.track));
  return {
    id: setlist.id,
    name: setlist.name,
    notes: setlist.notes,
    trackCount: tracks.length,
    totalDurationSec: sumDuration(tracks.map((track) => track.durationSec)),
    createdAt: setlist.createdAt.toISOString(),
    updatedAt: setlist.updatedAt.toISOString(),
    tracks,
  };
}

export async function listSetlists(): Promise<SetlistSummaryDTO[]> {
  const rows = await prisma.setlist.findMany({
    orderBy: { updatedAt: "desc" },
    include: { items: { select: { track: { select: { durationSec: true } } } } },
  });

  return rows.map((row) => ({
    id: row.id,
    name: row.name,
    notes: row.notes,
    trackCount: row.items.length,
    totalDurationSec: sumDuration(row.items.map((item) => item.track.durationSec)),
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  }));
}

export async function getSetlist(id: string): Promise<SetlistDTO | null> {
  const setlist = await prisma.setlist.findUnique({ where: { id }, include: withTracks });
  return setlist ? toSetlistDTO(setlist) : null;
}

/** 存在しない曲 ID が混ざっていたら 422 */
async function assertTracksExist(tx: Prisma.TransactionClient, trackIds: string[]) {
  if (trackIds.length === 0) return;
  const unique = [...new Set(trackIds)];
  const found = await tx.track.findMany({ where: { id: { in: unique } }, select: { id: true } });
  if (found.length === unique.length) return;

  const foundIds = new Set(found.map((track) => track.id));
  throw new SetlistError(
    "ライブラリに存在しない曲が含まれています。削除された曲が無いか確認してください。",
    422,
    { missingTrackIds: unique.filter((id) => !foundIds.has(id)) },
  );
}

async function replaceItems(
  tx: Prisma.TransactionClient,
  setlistId: string,
  trackIds: string[],
) {
  await tx.setlistItem.deleteMany({ where: { setlistId } });
  if (trackIds.length === 0) return;
  await tx.setlistItem.createMany({
    data: trackIds.map((trackId, position) => ({ setlistId, trackId, position })),
  });
}

export async function createSetlist(input: SetlistWriteInput): Promise<SetlistDTO> {
  return prisma.$transaction(async (tx) => {
    await assertTracksExist(tx, input.trackIds);
    const created = await tx.setlist.create({
      data: { name: input.name, notes: input.notes ?? null },
    });
    await replaceItems(tx, created.id, input.trackIds);
    const full = await tx.setlist.findUniqueOrThrow({
      where: { id: created.id },
      include: withTracks,
    });
    return toSetlistDTO(full);
  });
}

export async function updateSetlist(
  id: string,
  input: SetlistUpdateInput,
): Promise<SetlistDTO | null> {
  return prisma.$transaction(async (tx) => {
    const existing = await tx.setlist.findUnique({ where: { id }, select: { id: true } });
    if (!existing) return null;

    if (input.trackIds) {
      await assertTracksExist(tx, input.trackIds);
      await replaceItems(tx, id, input.trackIds);
    }

    // 曲だけ変えた場合も一覧の並び（更新順）に反映させるため updatedAt を明示的に進める
    await tx.setlist.update({
      where: { id },
      data: {
        ...(input.name !== undefined ? { name: input.name } : {}),
        ...(input.notes !== undefined ? { notes: input.notes } : {}),
        updatedAt: new Date(),
      },
    });

    const full = await tx.setlist.findUniqueOrThrow({ where: { id }, include: withTracks });
    return toSetlistDTO(full);
  });
}

export async function duplicateSetlist(id: string): Promise<SetlistDTO | null> {
  const source = await prisma.setlist.findUnique({ where: { id }, include: withTracks });
  if (!source) return null;

  return createSetlist({
    name: `${source.name} のコピー`.slice(0, 100),
    notes: source.notes,
    trackIds: source.items.map((item) => item.trackId),
  });
}

export async function deleteSetlist(id: string): Promise<boolean> {
  const result = await prisma.setlist.deleteMany({ where: { id } });
  return result.count > 0;
}
