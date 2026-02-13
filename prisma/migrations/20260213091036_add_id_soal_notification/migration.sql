-- AlterTable
ALTER TABLE "system_notifications" ADD COLUMN     "id_soal" INTEGER;

-- AddForeignKey
ALTER TABLE "system_notifications" ADD CONSTRAINT "system_notifications_id_soal_fkey" FOREIGN KEY ("id_soal") REFERENCES "soal"("id_soal") ON DELETE SET NULL ON UPDATE CASCADE;
