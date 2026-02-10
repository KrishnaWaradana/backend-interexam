-- CreateEnum
CREATE TYPE "AksesPaket" AS ENUM ('gratis', 'berbayar');

-- AlterTable
ALTER TABLE "paket_soal" ADD COLUMN     "akses" "AksesPaket" NOT NULL DEFAULT 'gratis';
