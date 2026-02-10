/*
  Warnings:

  - You are about to drop the column `akses` on the `paket_soal` table. All the data in the column will be lost.

*/
-- DropForeignKey
ALTER TABLE "paket_soal" DROP CONSTRAINT "paket_soal_id_category_fkey";

-- AlterTable
ALTER TABLE "paket_soal" DROP COLUMN "akses",
ALTER COLUMN "id_category" DROP NOT NULL;

-- DropEnum
DROP TYPE "AksesPaket";

-- AddForeignKey
ALTER TABLE "paket_soal" ADD CONSTRAINT "paket_soal_id_category_fkey" FOREIGN KEY ("id_category") REFERENCES "categories"("id_category") ON DELETE SET NULL ON UPDATE CASCADE;
