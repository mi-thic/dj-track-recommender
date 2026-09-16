import type { Track } from "@/generated/prisma";

/** クライアントに渡す用の Track（Date を ISO 文字列に落とす） */
export interface TrackDTO {
  id: string;
  title: string;
  artist: string;
  bpm: number;
  camelot: string;
  musicalKey: string | null;
  genre: string | null;
  energy: number;
  durationSec: number | null;
  releaseYear: number | null;
  label: string | null;
  notes: string | null;
  spotifyId: string | null;
  spotifyUrl: string | null;
  albumArtUrl: string | null;
  createdAt: string;
  updatedAt: string;
}

export function toTrackDTO(track: Track): TrackDTO {
  return {
    id: track.id,
    title: track.title,
    artist: track.artist,
    bpm: track.bpm,
    camelot: track.camelot,
    musicalKey: track.musicalKey,
    genre: track.genre,
    energy: track.energy,
    durationSec: track.durationSec,
    releaseYear: track.releaseYear,
    label: track.label,
    notes: track.notes,
    spotifyId: track.spotifyId,
    spotifyUrl: track.spotifyUrl,
    albumArtUrl: track.albumArtUrl,
    createdAt: track.createdAt.toISOString(),
    updatedAt: track.updatedAt.toISOString(),
  };
}
