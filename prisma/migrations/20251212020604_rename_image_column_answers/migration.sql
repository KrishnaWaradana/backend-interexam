/*
  Warnings:

  - You are about to drop the column `opsi_jawaban_image` on the `jawaban_soal` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "jawaban_soal" DROP COLUMN "opsi_jawaban_image",
ADD COLUMN     "path_gambar_jawaban" VARCHAR(255);
