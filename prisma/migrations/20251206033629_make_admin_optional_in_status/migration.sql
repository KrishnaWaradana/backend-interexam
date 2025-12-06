-- DropForeignKey
ALTER TABLE "user_status" DROP CONSTRAINT "user_status_id_admin_fkey";

-- AlterTable
ALTER TABLE "user_status" ALTER COLUMN "id_admin" DROP NOT NULL;

-- AddForeignKey
ALTER TABLE "user_status" ADD CONSTRAINT "user_status_id_admin_fkey" FOREIGN KEY ("id_admin") REFERENCES "users"("id_user") ON DELETE SET NULL ON UPDATE CASCADE;
