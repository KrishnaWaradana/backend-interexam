-- AlterTable
ALTER TABLE "jenjang" ADD COLUMN     "id_user" INTEGER;

-- AddForeignKey
ALTER TABLE "jenjang" ADD CONSTRAINT "jenjang_id_user_fkey" FOREIGN KEY ("id_user") REFERENCES "users"("id_user") ON DELETE SET NULL ON UPDATE CASCADE;
