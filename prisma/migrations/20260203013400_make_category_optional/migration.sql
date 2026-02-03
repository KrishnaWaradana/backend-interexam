-- DropForeignKey
ALTER TABLE "paket_langganan" DROP CONSTRAINT "paket_langganan_id_category_fkey";

-- AlterTable
ALTER TABLE "paket_langganan" ALTER COLUMN "id_category" DROP NOT NULL;

-- AddForeignKey
ALTER TABLE "paket_langganan" ADD CONSTRAINT "paket_langganan_id_category_fkey" FOREIGN KEY ("id_category") REFERENCES "categories"("id_category") ON DELETE SET NULL ON UPDATE CASCADE;
