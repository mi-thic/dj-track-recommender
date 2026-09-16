-- CreateTable
CREATE TABLE "Track" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "artist" TEXT NOT NULL,
    "bpm" DOUBLE PRECISION NOT NULL,
    "camelot" TEXT NOT NULL,
    "musicalKey" TEXT,
    "genre" TEXT,
    "energy" INTEGER NOT NULL DEFAULT 5,
    "durationSec" INTEGER,
    "releaseYear" INTEGER,
    "label" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Track_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Track_bpm_idx" ON "Track"("bpm");

-- CreateIndex
CREATE INDEX "Track_camelot_idx" ON "Track"("camelot");

-- CreateIndex
CREATE INDEX "Track_energy_idx" ON "Track"("energy");

-- CreateIndex
CREATE UNIQUE INDEX "Track_title_artist_key" ON "Track"("title", "artist");
