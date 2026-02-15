-- AlterTable
ALTER TABLE "system_notifications" ADD COLUMN     "id_event" INTEGER;

-- AddForeignKey
ALTER TABLE "system_notifications" ADD CONSTRAINT "system_notifications_id_event_fkey" FOREIGN KEY ("id_event") REFERENCES "events"("id_event") ON DELETE SET NULL ON UPDATE CASCADE;
