-- AlterTable
ALTER TABLE "jenjang" ADD COLUMN     "id_user" INTEGER;

-- AlterTable
ALTER TABLE "sub_topics" ADD COLUMN     "id_user" INTEGER;

-- AlterTable
ALTER TABLE "subjects" ADD COLUMN     "id_user" INTEGER;

-- AlterTable
ALTER TABLE "topics" ADD COLUMN     "id_user" INTEGER;

-- AddForeignKey
ALTER TABLE "subjects" ADD CONSTRAINT "subjects_id_user_fkey" FOREIGN KEY ("id_user") REFERENCES "users"("id_user") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "jenjang" ADD CONSTRAINT "jenjang_id_user_fkey" FOREIGN KEY ("id_user") REFERENCES "users"("id_user") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "topics" ADD CONSTRAINT "topics_id_user_fkey" FOREIGN KEY ("id_user") REFERENCES "users"("id_user") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sub_topics" ADD CONSTRAINT "sub_topics_id_user_fkey" FOREIGN KEY ("id_user") REFERENCES "users"("id_user") ON DELETE SET NULL ON UPDATE CASCADE;
