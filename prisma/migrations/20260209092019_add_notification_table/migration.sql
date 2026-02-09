-- CreateTable
CREATE TABLE "system_notifications" (
    "id_notification" SERIAL NOT NULL,
    "title" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "is_read" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "id_recipient" INTEGER NOT NULL,
    "id_sender" INTEGER,

    CONSTRAINT "system_notifications_pkey" PRIMARY KEY ("id_notification")
);

-- AddForeignKey
ALTER TABLE "system_notifications" ADD CONSTRAINT "system_notifications_id_recipient_fkey" FOREIGN KEY ("id_recipient") REFERENCES "users"("id_user") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "system_notifications" ADD CONSTRAINT "system_notifications_id_sender_fkey" FOREIGN KEY ("id_sender") REFERENCES "users"("id_user") ON DELETE SET NULL ON UPDATE CASCADE;
