/**
 * サンプルデータ投入。
 *
 *   npm run db:seed
 *
 * 曲名・アーティスト名は架空のものです。
 * BPM とキーは推薦ロジックの挙動が分かるよう意図的に散らしてあります。
 */
import { PrismaClient } from "../src/generated/prisma";
import { toMusicalKey } from "../src/lib/camelot";

const prisma = new PrismaClient();

interface SeedTrack {
  title: string;
  artist: string;
  bpm: number;
  camelot: string;
  genre: string;
  energy: number;
  durationSec: number;
  releaseYear?: number;
  label?: string;
  notes?: string;
}

const TRACKS: SeedTrack[] = [
  // --- ウォームアップ帯 (118-122) ---
  { title: "Slow Tide", artist: "Mira Volt", bpm: 118, camelot: "8A", genre: "Deep House", energy: 2, durationSec: 372, releaseYear: 2021, label: "Blue Hour" },
  { title: "Harbour Lights", artist: "Sano Deep", bpm: 120, camelot: "9A", genre: "Deep House", energy: 3, durationSec: 398, releaseYear: 2022, label: "Blue Hour", notes: "イントロ 32 小節。フィルターを開きながら混ぜると気持ちいい。" },
  { title: "Velvet Room", artist: "Mira Volt", bpm: 121, camelot: "8B", genre: "Deep House", energy: 3, durationSec: 355, releaseYear: 2021 },
  { title: "Paper Moon", artist: "Lowline", bpm: 122, camelot: "7A", genre: "Disco", energy: 4, durationSec: 341, releaseYear: 2020, label: "Sunset Cuts" },

  // --- ハウス / テックハウス帯 (124-128) ---
  { title: "Midnight Circuit", artist: "Kade Rivers", bpm: 124, camelot: "8A", genre: "Tech House", energy: 5, durationSec: 372, releaseYear: 2023, label: "Night Shift Records", notes: "ブレイクが長いので早めに混ぜる。" },
  { title: "Static Bloom", artist: "Nova Kai", bpm: 125, camelot: "9A", genre: "Tech House", energy: 6, durationSec: 361, releaseYear: 2023 },
  { title: "Basement Rules", artist: "Dex Harlow", bpm: 126, camelot: "8B", genre: "Tech House", energy: 6, durationSec: 344, releaseYear: 2024, label: "Night Shift Records" },
  { title: "Off the Grid", artist: "Kade Rivers", bpm: 126, camelot: "7A", genre: "Tech House", energy: 6, durationSec: 388, releaseYear: 2022 },
  { title: "Neon Corridor", artist: "Nova Kai", bpm: 127, camelot: "10A", genre: "House", energy: 7, durationSec: 402, releaseYear: 2024 },
  { title: "Loose Wire", artist: "Halcyon Bros", bpm: 127.5, camelot: "9B", genre: "House", energy: 6, durationSec: 335, releaseYear: 2023, label: "Loop Theory" },
  { title: "Glass Avenue", artist: "Selah Fields", bpm: 128, camelot: "5A", genre: "Progressive House", energy: 7, durationSec: 431, releaseYear: 2023, label: "Meridian" },
  { title: "Afterglow Drive", artist: "Selah Fields", bpm: 128, camelot: "6A", genre: "Progressive House", energy: 7, durationSec: 448, releaseYear: 2024, notes: "ラスト 1 分がアウトロ。次曲の頭を重ねやすい。" },
  { title: "Low Orbit", artist: "Halcyon Bros", bpm: 128, camelot: "4A", genre: "Progressive House", energy: 8, durationSec: 410, releaseYear: 2022, label: "Meridian" },

  // --- メロディックテクノ帯 (122-126) ---
  { title: "Ember Fields", artist: "Ayla Rune", bpm: 122, camelot: "11A", genre: "Melodic Techno", energy: 5, durationSec: 456, releaseYear: 2023, label: "Northlight" },
  { title: "Cold Signal", artist: "Ayla Rune", bpm: 124, camelot: "12A", genre: "Melodic Techno", energy: 6, durationSec: 420, releaseYear: 2024 },
  { title: "Shifting Sands", artist: "Orbis Nine", bpm: 125, camelot: "11B", genre: "Melodic Techno", energy: 7, durationSec: 465, releaseYear: 2023, label: "Northlight" },

  // --- テクノ帯 (130-138) ---
  { title: "Iron Lung", artist: "Dex Harlow", bpm: 132, camelot: "5A", genre: "Techno", energy: 8, durationSec: 378, releaseYear: 2024, label: "Concrete Bloom" },
  { title: "Red Shift", artist: "Vess", bpm: 134, camelot: "6A", genre: "Techno", energy: 9, durationSec: 392, releaseYear: 2024 },
  { title: "Hard Reset", artist: "Vess", bpm: 136, camelot: "5B", genre: "Techno", energy: 9, durationSec: 366, releaseYear: 2023, label: "Concrete Bloom", notes: "ピークタイム用。落とす場所を選ぶ。" },
  { title: "Tunnel Vision", artist: "Orbis Nine", bpm: 138, camelot: "4A", genre: "Techno", energy: 10, durationSec: 351, releaseYear: 2025 },

  // --- トランス / ピーク (138-142) ---
  { title: "Skyline Fracture", artist: "Auri", bpm: 138, camelot: "11B", genre: "Trance", energy: 9, durationSec: 424, releaseYear: 2024, label: "Altitude" },
  { title: "Zero Hour", artist: "Auri", bpm: 140, camelot: "12B", genre: "Trance", energy: 10, durationSec: 448, releaseYear: 2025 },

  // --- ハーフタイム系（ダブル/ハーフの推薦が効くよう配置） ---
  { title: "Undertow", artist: "Bask", bpm: 64, camelot: "8A", genre: "Downtempo", energy: 2, durationSec: 312, releaseYear: 2022, label: "Slow Motion", notes: "128 BPM のセットにダブルタイムで混ぜられる。" },
  { title: "Ghost Rooms", artist: "Bask", bpm: 70, camelot: "9A", genre: "Downtempo", energy: 2, durationSec: 298, releaseYear: 2021 },
  { title: "Split Second", artist: "Tanner Vale", bpm: 174, camelot: "8A", genre: "Drum & Bass", energy: 9, durationSec: 332, releaseYear: 2024, label: "Fold" },
  { title: "Paper Cuts", artist: "Tanner Vale", bpm: 172, camelot: "7A", genre: "Drum & Bass", energy: 8, durationSec: 318, releaseYear: 2023 },

  // --- クールダウン ---
  { title: "Last Train Home", artist: "Lowline", bpm: 119, camelot: "10A", genre: "Disco", energy: 3, durationSec: 366, releaseYear: 2020, label: "Sunset Cuts" },
  { title: "Morning Static", artist: "Sano Deep", bpm: 116, camelot: "10B", genre: "Deep House", energy: 2, durationSec: 384, releaseYear: 2022 },
];

async function main() {
  const existing = await prisma.track.count();
  if (existing > 0) {
    console.log(`[seed] 既に ${existing} 曲登録済みのためスキップしました。`);
    return;
  }

  for (const track of TRACKS) {
    await prisma.track.upsert({
      where: { title_artist: { title: track.title, artist: track.artist } },
      update: {},
      create: {
        ...track,
        musicalKey: toMusicalKey(track.camelot),
        label: track.label ?? null,
        notes: track.notes ?? null,
        releaseYear: track.releaseYear ?? null,
      },
    });
  }

  console.log(`[seed] ${TRACKS.length} 曲を投入しました。`);
}

main()
  .catch((error) => {
    console.error("[seed] 失敗しました:", error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
