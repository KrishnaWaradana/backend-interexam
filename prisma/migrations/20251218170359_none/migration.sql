-- AlterTable
ALTER TABLE "attachments_soal" ALTER COLUMN "path_attachment" SET DATA TYPE VARCHAR(255);

-- AlterTable
ALTER TABLE "soal" ADD COLUMN     "catatan_revisi" TEXT;
