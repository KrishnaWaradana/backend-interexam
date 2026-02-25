-- AlterTable
ALTER TABLE "paket_attempt" ADD COLUMN     "id_event" INTEGER;

-- AddForeignKey
ALTER TABLE "paket_attempt" ADD CONSTRAINT "paket_attempt_id_event_fkey" FOREIGN KEY ("id_event") REFERENCES "events"("id_event") ON DELETE SET NULL ON UPDATE CASCADE;
