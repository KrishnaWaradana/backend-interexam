/*
  Warnings:

  - You are about to drop the column `d_category` on the `category_subject` table. All the data in the column will be lost.
  - You are about to drop the `insitusi_target` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `subscribers_insitusi` table. If the table is not empty, all the data it contains will be lost.
  - Added the required column `id_category` to the `category_subject` table without a default value. This is not possible if the table is not empty.

*/
-- DropForeignKey
ALTER TABLE "category_subject" DROP CONSTRAINT "category_subject_d_category_fkey";

-- DropForeignKey
ALTER TABLE "subscribers_insitusi" DROP CONSTRAINT "subscribers_insitusi_id_institusi_fkey";

-- DropForeignKey
ALTER TABLE "subscribers_insitusi" DROP CONSTRAINT "subscribers_insitusi_id_subscriber_fkey";

-- AlterTable
ALTER TABLE "category_subject" DROP COLUMN "d_category",
ADD COLUMN     "id_category" INTEGER NOT NULL;

-- DropTable
DROP TABLE "insitusi_target";

-- DropTable
DROP TABLE "subscribers_insitusi";

-- CreateTable
CREATE TABLE "institusi_target" (
    "id_target" SERIAL NOT NULL,
    "nama_target" VARCHAR(100),

    CONSTRAINT "institusi_target_pkey" PRIMARY KEY ("id_target")
);

-- CreateTable
CREATE TABLE "subscribers_institusi" (
    "id_institusi_subscriber" SERIAL NOT NULL,
    "id_institusi" INTEGER NOT NULL,
    "id_subscriber" INTEGER NOT NULL,

    CONSTRAINT "subscribers_institusi_pkey" PRIMARY KEY ("id_institusi_subscriber")
);

-- AddForeignKey
ALTER TABLE "category_subject" ADD CONSTRAINT "category_subject_id_category_fkey" FOREIGN KEY ("id_category") REFERENCES "categories"("id_category") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "subscribers_institusi" ADD CONSTRAINT "subscribers_institusi_id_institusi_fkey" FOREIGN KEY ("id_institusi") REFERENCES "institusi_target"("id_target") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "subscribers_institusi" ADD CONSTRAINT "subscribers_institusi_id_subscriber_fkey" FOREIGN KEY ("id_subscriber") REFERENCES "subscribers"("id_subscriber") ON DELETE RESTRICT ON UPDATE CASCADE;
