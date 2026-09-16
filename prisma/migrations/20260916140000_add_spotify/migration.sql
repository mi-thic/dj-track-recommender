-- AlterTable
ALTER TABLE "Track" ADD COLUMN     "albumArtUrl" TEXT,
ADD COLUMN     "isrc" TEXT,
ADD COLUMN     "spotifyId" TEXT,
ADD COLUMN     "spotifyUrl" TEXT;

-- CreateTable
CREATE TABLE "SpotifyAccount" (
    "id" TEXT NOT NULL DEFAULT 'singleton',
    "spotifyUserId" TEXT NOT NULL,
    "displayName" TEXT,
    "accessToken" TEXT NOT NULL,
    "refreshToken" TEXT NOT NULL,
    "scope" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SpotifyAccount_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Track_spotifyId_key" ON "Track"("spotifyId");
