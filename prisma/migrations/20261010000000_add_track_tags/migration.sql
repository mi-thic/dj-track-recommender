-- AlterTable
ALTER TABLE "Track" ADD COLUMN     "tags" TEXT[] DEFAULT ARRAY[]::TEXT[];
