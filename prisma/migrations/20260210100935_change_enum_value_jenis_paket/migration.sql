/*
  Warnings:

  - The values [latihan,try-out] on the enum `JenisPaket` will be removed. If these variants are still used in the database, this will fail.

*/
-- AlterEnum
BEGIN;
CREATE TYPE "JenisPaket_new" AS ENUM ('gratis', 'berbayar');
ALTER TABLE "paket_soal" ALTER COLUMN "jenis" TYPE "JenisPaket_new" USING ("jenis"::text::"JenisPaket_new");
ALTER TYPE "JenisPaket" RENAME TO "JenisPaket_old";
ALTER TYPE "JenisPaket_new" RENAME TO "JenisPaket";
DROP TYPE "JenisPaket_old";
COMMIT;

-- AlterTable
ALTER TABLE "paket_soal" ALTER COLUMN "jenis" SET DEFAULT 'gratis';
