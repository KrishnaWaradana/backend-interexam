/*
  Warnings:

  - You are about to drop the column `tanggal_modified` on the `user_status` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "user_status" DROP COLUMN "tanggal_modified",
ADD COLUMN     "created_at" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP;

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "status" "UserStatusEnum" DEFAULT 'Unverified';
