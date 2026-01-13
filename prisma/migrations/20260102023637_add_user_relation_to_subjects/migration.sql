-- AlterTable
ALTER TABLE "subjects" ADD COLUMN     "id_user" INTEGER;

-- AddForeignKey
ALTER TABLE "subjects" ADD CONSTRAINT "subjects_id_user_fkey" FOREIGN KEY ("id_user") REFERENCES "users"("id_user") ON DELETE SET NULL ON UPDATE CASCADE;
