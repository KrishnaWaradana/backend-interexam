-- AlterTable
ALTER TABLE "favorites" ADD COLUMN     "id_folder" INTEGER,
ALTER COLUMN "tanggal" SET DEFAULT CURRENT_TIMESTAMP;

-- CreateTable
CREATE TABLE "folders" (
    "id_folder" SERIAL NOT NULL,
    "nama_folder" VARCHAR(100) NOT NULL,
    "keterangan" VARCHAR(255),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "id_subscriber" INTEGER NOT NULL,

    CONSTRAINT "folders_pkey" PRIMARY KEY ("id_folder")
);

-- AddForeignKey
ALTER TABLE "favorites" ADD CONSTRAINT "favorites_id_folder_fkey" FOREIGN KEY ("id_folder") REFERENCES "folders"("id_folder") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "folders" ADD CONSTRAINT "folders_id_subscriber_fkey" FOREIGN KEY ("id_subscriber") REFERENCES "subscribers"("id_subscriber") ON DELETE RESTRICT ON UPDATE CASCADE;
