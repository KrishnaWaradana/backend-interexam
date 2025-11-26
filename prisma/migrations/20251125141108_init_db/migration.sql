-- CreateEnum
CREATE TYPE "Role" AS ENUM ('Validator', 'Contributor', 'Admin');

-- CreateEnum
CREATE TYPE "JenisSoal" AS ENUM ('short answer', 'multiple choice', 'multiple answer', 'true false');

-- CreateEnum
CREATE TYPE "LevelKesulitan" AS ENUM ('mudah', 'sedang', 'sulit');

-- CreateEnum
CREATE TYPE "StatusSoal" AS ENUM ('draft', 'need verification', 'disetujui', 'ditolak');

-- CreateEnum
CREATE TYPE "StatusValidasi" AS ENUM ('ditolak', 'disetujui');

-- CreateEnum
CREATE TYPE "JenisPaket" AS ENUM ('latihan', 'try-out');

-- CreateEnum
CREATE TYPE "StatusPaket" AS ENUM ('draft', 'active', 'inactive');

-- CreateEnum
CREATE TYPE "NamaPeriode" AS ENUM ('hari', 'minggu', 'bulan', 'tahun');

-- CreateEnum
CREATE TYPE "StatusSubscribe" AS ENUM ('active', 'inactive');

-- CreateEnum
CREATE TYPE "UserStatusEnum" AS ENUM ('Verified', 'Unverified', 'Suspend');

-- CreateTable
CREATE TABLE "categories" (
    "id_category" SERIAL NOT NULL,
    "nama_category" VARCHAR(45),
    "keterangan" VARCHAR(45),

    CONSTRAINT "categories_pkey" PRIMARY KEY ("id_category")
);

-- CreateTable
CREATE TABLE "subjects" (
    "id_subject" SERIAL NOT NULL,
    "nama_subject" VARCHAR(45),
    "keterangan" VARCHAR(45),

    CONSTRAINT "subjects_pkey" PRIMARY KEY ("id_subject")
);

-- CreateTable
CREATE TABLE "users" (
    "id_user" SERIAL NOT NULL,
    "username" VARCHAR(45),
    "password" VARCHAR(100),
    "role" "Role",
    "nama_user" VARCHAR(45),
    "email_user" VARCHAR(45),
    "phone" VARCHAR(45),
    "foto" VARCHAR(255),

    CONSTRAINT "users_pkey" PRIMARY KEY ("id_user")
);

-- CreateTable
CREATE TABLE "kompetensi_user" (
    "id_user" INTEGER NOT NULL,
    "id_subject" INTEGER NOT NULL,

    CONSTRAINT "kompetensi_user_pkey" PRIMARY KEY ("id_user","id_subject")
);

-- CreateTable
CREATE TABLE "user_status" (
    "id_user_status" SERIAL NOT NULL,
    "id_user" INTEGER NOT NULL,
    "status" "UserStatusEnum",
    "id_admin" INTEGER NOT NULL,
    "tanggal_modified" VARCHAR(45),
    "description" VARCHAR(45),

    CONSTRAINT "user_status_pkey" PRIMARY KEY ("id_user_status")
);

-- CreateTable
CREATE TABLE "topics" (
    "id_topics" SERIAL NOT NULL,
    "nama_topics" VARCHAR(45),
    "keterangan" VARCHAR(45),
    "id_subjects" INTEGER NOT NULL,

    CONSTRAINT "topics_pkey" PRIMARY KEY ("id_topics")
);

-- CreateTable
CREATE TABLE "kategori_topics" (
    "id_topics" INTEGER NOT NULL,
    "id_category" INTEGER NOT NULL,

    CONSTRAINT "kategori_topics_pkey" PRIMARY KEY ("id_topics","id_category")
);

-- CreateTable
CREATE TABLE "sub_topics" (
    "id_subtopics" SERIAL NOT NULL,
    "nama_subtopics" VARCHAR(45),
    "keterangan" VARCHAR(45),
    "id_topics" INTEGER NOT NULL,

    CONSTRAINT "sub_topics_pkey" PRIMARY KEY ("id_subtopics")
);

-- CreateTable
CREATE TABLE "detail_sub_topics" (
    "id_detail_subtopics" SERIAL NOT NULL,
    "nama_detail_subtopics" VARCHAR(45),
    "keterangan" VARCHAR(45),
    "id_subtopics" INTEGER NOT NULL,

    CONSTRAINT "detail_sub_topics_pkey" PRIMARY KEY ("id_detail_subtopics")
);

-- CreateTable
CREATE TABLE "category_subject" (
    "id_category_subject" SERIAL NOT NULL,
    "d_category" INTEGER NOT NULL,
    "id_subject" INTEGER NOT NULL,

    CONSTRAINT "category_subject_pkey" PRIMARY KEY ("id_category_subject")
);

-- CreateTable
CREATE TABLE "soal" (
    "id_soal" SERIAL NOT NULL,
    "tanggal_pembuatan" VARCHAR(45),
    "text_soal" VARCHAR(1000),
    "jenis_soal" "JenisSoal",
    "level_kesulitan" "LevelKesulitan",
    "id_contributor" INTEGER NOT NULL,
    "status" "StatusSoal",
    "id_topics" INTEGER NOT NULL,
    "id_subtopics" INTEGER NOT NULL,
    "id_detail_subtopics" INTEGER NOT NULL,

    CONSTRAINT "soal_pkey" PRIMARY KEY ("id_soal")
);

-- CreateTable
CREATE TABLE "soal_tags" (
    "id_tags" SERIAL NOT NULL,
    "tag" VARCHAR(45),
    "soal_id_soal" INTEGER NOT NULL,

    CONSTRAINT "soal_tags_pkey" PRIMARY KEY ("id_tags")
);

-- CreateTable
CREATE TABLE "validasi_soal" (
    "id_validasi" SERIAL NOT NULL,
    "tanggal_validasi" TIMESTAMP(3),
    "keterangan" VARCHAR(500),
    "status" "StatusValidasi",
    "id_validator" INTEGER NOT NULL,
    "id_soal" INTEGER NOT NULL,

    CONSTRAINT "validasi_soal_pkey" PRIMARY KEY ("id_validasi")
);

-- CreateTable
CREATE TABLE "subscribers" (
    "id_subscriber" SERIAL NOT NULL,
    "username" VARCHAR(45),
    "password" VARCHAR(100),
    "nama_subscriber" VARCHAR(45),
    "email_subscriber" VARCHAR(45),
    "phone" VARCHAR(45),

    CONSTRAINT "subscribers_pkey" PRIMARY KEY ("id_subscriber")
);

-- CreateTable
CREATE TABLE "reports" (
    "id_report" SERIAL NOT NULL,
    "id_subscriber" INTEGER NOT NULL,
    "id_soal" INTEGER NOT NULL,
    "keterangan" VARCHAR(500),
    "tanggal_report" TIMESTAMP(3),
    "status" VARCHAR(45),

    CONSTRAINT "reports_pkey" PRIMARY KEY ("id_report")
);

-- CreateTable
CREATE TABLE "favorites" (
    "id_favorite" SERIAL NOT NULL,
    "id_subscriber" INTEGER NOT NULL,
    "id_soal" INTEGER NOT NULL,
    "tanggal" TIMESTAMP(3),

    CONSTRAINT "favorites_pkey" PRIMARY KEY ("id_favorite")
);

-- CreateTable
CREATE TABLE "paket_soal" (
    "id_paket_soal" SERIAL NOT NULL,
    "jenis" "JenisPaket",
    "tanggal_dibuat" TIMESTAMP(3),
    "status" "StatusPaket",
    "nama_paket" VARCHAR(100),
    "jumlah_soal" INTEGER,
    "durasi" INTEGER,
    "id_category" INTEGER NOT NULL,
    "id_creator" INTEGER NOT NULL,

    CONSTRAINT "paket_soal_pkey" PRIMARY KEY ("id_paket_soal")
);

-- CreateTable
CREATE TABLE "soal_paket_soal" (
    "id_soal_paket_soal" SERIAL NOT NULL,
    "id_soal" INTEGER NOT NULL,
    "id_paket_soal" INTEGER NOT NULL,
    "point" DOUBLE PRECISION DEFAULT 1,
    "durasi" INTEGER DEFAULT 0,

    CONSTRAINT "soal_paket_soal_pkey" PRIMARY KEY ("id_soal_paket_soal")
);

-- CreateTable
CREATE TABLE "paket_langganan" (
    "id_paket_langganan" SERIAL NOT NULL,
    "nama_paket" VARCHAR(45),
    "harga" INTEGER,
    "masa_berlaku" INTEGER DEFAULT 1,
    "nama_periode" "NamaPeriode" DEFAULT 'bulan',
    "status" "StatusPaket",
    "id_category" INTEGER NOT NULL,

    CONSTRAINT "paket_langganan_pkey" PRIMARY KEY ("id_paket_langganan")
);

-- CreateTable
CREATE TABLE "diskon_paket" (
    "id_diskon" SERIAL NOT NULL,
    "diskon" DOUBLE PRECISION DEFAULT 0,
    "tanggal_mulai_diskon" TIMESTAMP(3),
    "tanggal_selesai_diskon" TIMESTAMP(3),
    "id_paket_langganan" INTEGER NOT NULL,

    CONSTRAINT "diskon_paket_pkey" PRIMARY KEY ("id_diskon")
);

-- CreateTable
CREATE TABLE "subscribe_paket" (
    "id_subscribe" SERIAL NOT NULL,
    "id_subscriber" INTEGER NOT NULL,
    "id_paket_langganan" INTEGER NOT NULL,
    "tanggal_subscribe" TIMESTAMP(3),
    "tanggal_mulai" TIMESTAMP(3),
    "tanggal_selesai" TIMESTAMP(3),
    "status" "StatusSubscribe",

    CONSTRAINT "subscribe_paket_pkey" PRIMARY KEY ("id_subscribe")
);

-- CreateTable
CREATE TABLE "paket_attempt" (
    "id_paket_attempt" SERIAL NOT NULL,
    "paket_soal_id_paket_soal" INTEGER NOT NULL,
    "subscribers_id_subscriber" INTEGER NOT NULL,
    "started_at" TIMESTAMP(3),
    "finished_at" TIMESTAMP(3),

    CONSTRAINT "paket_attempt_pkey" PRIMARY KEY ("id_paket_attempt")
);

-- CreateTable
CREATE TABLE "jawaban_soal" (
    "id_jawaban" SERIAL NOT NULL,
    "opsi_jawaban_text" VARCHAR(100),
    "opsi_jawaban_image" VARCHAR(255),
    "status" BOOLEAN DEFAULT false,
    "short_answer" VARCHAR(45),
    "soal_id_soal" INTEGER NOT NULL,
    "pembahasan" VARCHAR(200),

    CONSTRAINT "jawaban_soal_pkey" PRIMARY KEY ("id_jawaban")
);

-- CreateTable
CREATE TABLE "history_pengerjaan_paket" (
    "id_history" SERIAL NOT NULL,
    "id_subscriber" INTEGER NOT NULL,
    "id_soal_paket_soal" INTEGER NOT NULL,
    "id_paket_attempt" INTEGER NOT NULL,
    "id_jawaban" INTEGER NOT NULL,
    "tanggal" TIMESTAMP(3),
    "short_answer" VARCHAR(45),
    "skor_point" DOUBLE PRECISION,

    CONSTRAINT "history_pengerjaan_paket_pkey" PRIMARY KEY ("id_history")
);

-- CreateTable
CREATE TABLE "attachments_soal" (
    "id_attachment" SERIAL NOT NULL,
    "path_attachment" VARCHAR(100),
    "keterangan" VARCHAR(100),
    "id_soal" INTEGER NOT NULL,

    CONSTRAINT "attachments_soal_pkey" PRIMARY KEY ("id_attachment")
);

-- CreateTable
CREATE TABLE "insitusi_target" (
    "id_target" SERIAL NOT NULL,
    "nama_target" VARCHAR(100),

    CONSTRAINT "insitusi_target_pkey" PRIMARY KEY ("id_target")
);

-- CreateTable
CREATE TABLE "subscribers_insitusi" (
    "id_institusi_subscriber" SERIAL NOT NULL,
    "id_institusi" INTEGER NOT NULL,
    "id_subscriber" INTEGER NOT NULL,

    CONSTRAINT "subscribers_insitusi_pkey" PRIMARY KEY ("id_institusi_subscriber")
);

-- CreateIndex
CREATE UNIQUE INDEX "subscribers_email_subscriber_key" ON "subscribers"("email_subscriber");

-- CreateIndex
CREATE UNIQUE INDEX "subscribers_phone_key" ON "subscribers"("phone");

-- AddForeignKey
ALTER TABLE "kompetensi_user" ADD CONSTRAINT "kompetensi_user_id_user_fkey" FOREIGN KEY ("id_user") REFERENCES "users"("id_user") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "kompetensi_user" ADD CONSTRAINT "kompetensi_user_id_subject_fkey" FOREIGN KEY ("id_subject") REFERENCES "subjects"("id_subject") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_status" ADD CONSTRAINT "user_status_id_user_fkey" FOREIGN KEY ("id_user") REFERENCES "users"("id_user") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_status" ADD CONSTRAINT "user_status_id_admin_fkey" FOREIGN KEY ("id_admin") REFERENCES "users"("id_user") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "topics" ADD CONSTRAINT "topics_id_subjects_fkey" FOREIGN KEY ("id_subjects") REFERENCES "subjects"("id_subject") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "kategori_topics" ADD CONSTRAINT "kategori_topics_id_topics_fkey" FOREIGN KEY ("id_topics") REFERENCES "topics"("id_topics") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "kategori_topics" ADD CONSTRAINT "kategori_topics_id_category_fkey" FOREIGN KEY ("id_category") REFERENCES "categories"("id_category") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sub_topics" ADD CONSTRAINT "sub_topics_id_topics_fkey" FOREIGN KEY ("id_topics") REFERENCES "topics"("id_topics") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "detail_sub_topics" ADD CONSTRAINT "detail_sub_topics_id_subtopics_fkey" FOREIGN KEY ("id_subtopics") REFERENCES "sub_topics"("id_subtopics") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "category_subject" ADD CONSTRAINT "category_subject_d_category_fkey" FOREIGN KEY ("d_category") REFERENCES "categories"("id_category") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "category_subject" ADD CONSTRAINT "category_subject_id_subject_fkey" FOREIGN KEY ("id_subject") REFERENCES "subjects"("id_subject") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "soal" ADD CONSTRAINT "soal_id_contributor_fkey" FOREIGN KEY ("id_contributor") REFERENCES "users"("id_user") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "soal" ADD CONSTRAINT "soal_id_topics_fkey" FOREIGN KEY ("id_topics") REFERENCES "topics"("id_topics") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "soal" ADD CONSTRAINT "soal_id_subtopics_fkey" FOREIGN KEY ("id_subtopics") REFERENCES "sub_topics"("id_subtopics") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "soal" ADD CONSTRAINT "soal_id_detail_subtopics_fkey" FOREIGN KEY ("id_detail_subtopics") REFERENCES "detail_sub_topics"("id_detail_subtopics") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "soal_tags" ADD CONSTRAINT "soal_tags_soal_id_soal_fkey" FOREIGN KEY ("soal_id_soal") REFERENCES "soal"("id_soal") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "validasi_soal" ADD CONSTRAINT "validasi_soal_id_validator_fkey" FOREIGN KEY ("id_validator") REFERENCES "users"("id_user") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "validasi_soal" ADD CONSTRAINT "validasi_soal_id_soal_fkey" FOREIGN KEY ("id_soal") REFERENCES "soal"("id_soal") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reports" ADD CONSTRAINT "reports_id_subscriber_fkey" FOREIGN KEY ("id_subscriber") REFERENCES "subscribers"("id_subscriber") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reports" ADD CONSTRAINT "reports_id_soal_fkey" FOREIGN KEY ("id_soal") REFERENCES "soal"("id_soal") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "favorites" ADD CONSTRAINT "favorites_id_subscriber_fkey" FOREIGN KEY ("id_subscriber") REFERENCES "subscribers"("id_subscriber") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "favorites" ADD CONSTRAINT "favorites_id_soal_fkey" FOREIGN KEY ("id_soal") REFERENCES "soal"("id_soal") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "paket_soal" ADD CONSTRAINT "paket_soal_id_category_fkey" FOREIGN KEY ("id_category") REFERENCES "categories"("id_category") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "paket_soal" ADD CONSTRAINT "paket_soal_id_creator_fkey" FOREIGN KEY ("id_creator") REFERENCES "users"("id_user") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "soal_paket_soal" ADD CONSTRAINT "soal_paket_soal_id_soal_fkey" FOREIGN KEY ("id_soal") REFERENCES "soal"("id_soal") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "soal_paket_soal" ADD CONSTRAINT "soal_paket_soal_id_paket_soal_fkey" FOREIGN KEY ("id_paket_soal") REFERENCES "paket_soal"("id_paket_soal") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "paket_langganan" ADD CONSTRAINT "paket_langganan_id_category_fkey" FOREIGN KEY ("id_category") REFERENCES "categories"("id_category") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "diskon_paket" ADD CONSTRAINT "diskon_paket_id_paket_langganan_fkey" FOREIGN KEY ("id_paket_langganan") REFERENCES "paket_langganan"("id_paket_langganan") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "subscribe_paket" ADD CONSTRAINT "subscribe_paket_id_subscriber_fkey" FOREIGN KEY ("id_subscriber") REFERENCES "subscribers"("id_subscriber") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "subscribe_paket" ADD CONSTRAINT "subscribe_paket_id_paket_langganan_fkey" FOREIGN KEY ("id_paket_langganan") REFERENCES "paket_langganan"("id_paket_langganan") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "paket_attempt" ADD CONSTRAINT "paket_attempt_paket_soal_id_paket_soal_fkey" FOREIGN KEY ("paket_soal_id_paket_soal") REFERENCES "paket_soal"("id_paket_soal") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "paket_attempt" ADD CONSTRAINT "paket_attempt_subscribers_id_subscriber_fkey" FOREIGN KEY ("subscribers_id_subscriber") REFERENCES "subscribers"("id_subscriber") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "jawaban_soal" ADD CONSTRAINT "jawaban_soal_soal_id_soal_fkey" FOREIGN KEY ("soal_id_soal") REFERENCES "soal"("id_soal") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "history_pengerjaan_paket" ADD CONSTRAINT "history_pengerjaan_paket_id_subscriber_fkey" FOREIGN KEY ("id_subscriber") REFERENCES "subscribers"("id_subscriber") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "history_pengerjaan_paket" ADD CONSTRAINT "history_pengerjaan_paket_id_soal_paket_soal_fkey" FOREIGN KEY ("id_soal_paket_soal") REFERENCES "soal_paket_soal"("id_soal_paket_soal") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "history_pengerjaan_paket" ADD CONSTRAINT "history_pengerjaan_paket_id_paket_attempt_fkey" FOREIGN KEY ("id_paket_attempt") REFERENCES "paket_attempt"("id_paket_attempt") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "history_pengerjaan_paket" ADD CONSTRAINT "history_pengerjaan_paket_id_jawaban_fkey" FOREIGN KEY ("id_jawaban") REFERENCES "jawaban_soal"("id_jawaban") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attachments_soal" ADD CONSTRAINT "attachments_soal_id_soal_fkey" FOREIGN KEY ("id_soal") REFERENCES "soal"("id_soal") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "subscribers_insitusi" ADD CONSTRAINT "subscribers_insitusi_id_institusi_fkey" FOREIGN KEY ("id_institusi") REFERENCES "insitusi_target"("id_target") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "subscribers_insitusi" ADD CONSTRAINT "subscribers_insitusi_id_subscriber_fkey" FOREIGN KEY ("id_subscriber") REFERENCES "subscribers"("id_subscriber") ON DELETE RESTRICT ON UPDATE CASCADE;
