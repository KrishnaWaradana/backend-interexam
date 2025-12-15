-- DropForeignKey
ALTER TABLE "soal" DROP CONSTRAINT "soal_id_detail_subtopics_fkey";

-- DropForeignKey
ALTER TABLE "soal" DROP CONSTRAINT "soal_id_subtopics_fkey";

-- AlterTable
ALTER TABLE "soal" ALTER COLUMN "id_subtopics" DROP NOT NULL,
ALTER COLUMN "id_detail_subtopics" DROP NOT NULL;

-- AddForeignKey
ALTER TABLE "soal" ADD CONSTRAINT "soal_id_subtopics_fkey" FOREIGN KEY ("id_subtopics") REFERENCES "sub_topics"("id_subtopics") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "soal" ADD CONSTRAINT "soal_id_detail_subtopics_fkey" FOREIGN KEY ("id_detail_subtopics") REFERENCES "detail_sub_topics"("id_detail_subtopics") ON DELETE SET NULL ON UPDATE CASCADE;
