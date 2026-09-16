-- AlterTable
ALTER TABLE "Track" ADD COLUMN     "rekordboxId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "Track_rekordboxId_key" ON "Track"("rekordboxId");
