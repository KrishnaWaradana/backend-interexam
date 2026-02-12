-- CreateEnum
CREATE TYPE "StatusEvent" AS ENUM ('active', 'inactive', 'draft');

-- CreateEnum
CREATE TYPE "JenisEvent" AS ENUM ('Gratis', 'Berbayar');

-- CreateTable
CREATE TABLE "events" (
    "id_event" SERIAL NOT NULL,
    "nama_event" VARCHAR(100) NOT NULL,
    "deskripsi" TEXT,
    "tanggal_mulai" TIMESTAMP(3) NOT NULL,
    "tanggal_selesai" TIMESTAMP(3) NOT NULL,
    "durasi_pengerjaan" INTEGER NOT NULL DEFAULT 0,
    "banner" VARCHAR(255),
    "status" "StatusEvent" NOT NULL DEFAULT 'draft',
    "jenis" "JenisEvent" NOT NULL DEFAULT 'Gratis',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "id_category" INTEGER NOT NULL,

    CONSTRAINT "events_pkey" PRIMARY KEY ("id_event")
);

-- CreateTable
CREATE TABLE "event_paket_soal" (
    "id_event_paket" SERIAL NOT NULL,
    "id_event" INTEGER NOT NULL,
    "id_paket_soal" INTEGER NOT NULL,

    CONSTRAINT "event_paket_soal_pkey" PRIMARY KEY ("id_event_paket")
);

-- CreateTable
CREATE TABLE "event_subscribers" (
    "id_event_subscriber" SERIAL NOT NULL,
    "id_event" INTEGER NOT NULL,
    "id_subscriber" INTEGER NOT NULL,
    "tanggal_daftar" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "event_subscribers_pkey" PRIMARY KEY ("id_event_subscriber")
);

-- CreateIndex
CREATE UNIQUE INDEX "event_paket_soal_id_event_id_paket_soal_key" ON "event_paket_soal"("id_event", "id_paket_soal");

-- CreateIndex
CREATE UNIQUE INDEX "event_subscribers_id_event_id_subscriber_key" ON "event_subscribers"("id_event", "id_subscriber");

-- AddForeignKey
ALTER TABLE "events" ADD CONSTRAINT "events_id_category_fkey" FOREIGN KEY ("id_category") REFERENCES "categories"("id_category") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "event_paket_soal" ADD CONSTRAINT "event_paket_soal_id_event_fkey" FOREIGN KEY ("id_event") REFERENCES "events"("id_event") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "event_paket_soal" ADD CONSTRAINT "event_paket_soal_id_paket_soal_fkey" FOREIGN KEY ("id_paket_soal") REFERENCES "paket_soal"("id_paket_soal") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "event_subscribers" ADD CONSTRAINT "event_subscribers_id_event_fkey" FOREIGN KEY ("id_event") REFERENCES "events"("id_event") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "event_subscribers" ADD CONSTRAINT "event_subscribers_id_subscriber_fkey" FOREIGN KEY ("id_subscriber") REFERENCES "subscribers"("id_subscriber") ON DELETE RESTRICT ON UPDATE CASCADE;
