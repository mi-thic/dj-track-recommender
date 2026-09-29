-- CreateTable
CREATE TABLE "Setlist" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Setlist_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SetlistItem" (
    "id" TEXT NOT NULL,
    "setlistId" TEXT NOT NULL,
    "trackId" TEXT NOT NULL,
    "position" INTEGER NOT NULL,

    CONSTRAINT "SetlistItem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Setlist_updatedAt_idx" ON "Setlist"("updatedAt");

-- CreateIndex
CREATE INDEX "SetlistItem_trackId_idx" ON "SetlistItem"("trackId");

-- CreateIndex
CREATE UNIQUE INDEX "SetlistItem_setlistId_position_key" ON "SetlistItem"("setlistId", "position");

-- AddForeignKey
ALTER TABLE "SetlistItem" ADD CONSTRAINT "SetlistItem_setlistId_fkey" FOREIGN KEY ("setlistId") REFERENCES "Setlist"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SetlistItem" ADD CONSTRAINT "SetlistItem_trackId_fkey" FOREIGN KEY ("trackId") REFERENCES "Track"("id") ON DELETE CASCADE ON UPDATE CASCADE;

