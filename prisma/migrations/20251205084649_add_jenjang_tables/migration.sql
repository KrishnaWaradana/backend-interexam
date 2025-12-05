/*
  Warnings:

  - Added the required column `id_jenjang` to the `topics` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "topics" ADD COLUMN     "id_jenjang" INTEGER NOT NULL;

-- CreateTable
CREATE TABLE "jenjang" (
    "id_jenjang" SERIAL NOT NULL,
    "nama_jenjang" VARCHAR(45),
    "keterangan" VARCHAR(45),

    CONSTRAINT "jenjang_pkey" PRIMARY KEY ("id_jenjang")
);

-- AddForeignKey
ALTER TABLE "topics" ADD CONSTRAINT "topics_id_jenjang_fkey" FOREIGN KEY ("id_jenjang") REFERENCES "jenjang"("id_jenjang") ON DELETE RESTRICT ON UPDATE CASCADE;
