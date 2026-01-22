-- AlterTable
ALTER TABLE "jawaban_soal" ALTER COLUMN "pembahasan" SET DATA TYPE TEXT;

-- AlterTable
ALTER TABLE "soal" ALTER COLUMN "text_soal" SET DATA TYPE TEXT;

-- AlterTable
ALTER TABLE "subscribers" ADD COLUMN     "foto" VARCHAR(255);
