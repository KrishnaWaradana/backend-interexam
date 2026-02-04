-- CreateTable
CREATE TABLE "transaksi" (
    "id_transaksi" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "snap_token" TEXT,
    "payment_type" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "id_subscriber" INTEGER NOT NULL,
    "id_paket_langganan" INTEGER NOT NULL,

    CONSTRAINT "transaksi_pkey" PRIMARY KEY ("id_transaksi")
);

-- AddForeignKey
ALTER TABLE "transaksi" ADD CONSTRAINT "transaksi_id_subscriber_fkey" FOREIGN KEY ("id_subscriber") REFERENCES "subscribers"("id_subscriber") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transaksi" ADD CONSTRAINT "transaksi_id_paket_langganan_fkey" FOREIGN KEY ("id_paket_langganan") REFERENCES "paket_langganan"("id_paket_langganan") ON DELETE RESTRICT ON UPDATE CASCADE;
