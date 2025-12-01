/*
  Warnings:

  - A unique constraint covering the columns `[googleId]` on the table `subscribers` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[email_user]` on the table `users` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[googleId]` on the table `users` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "subscribers" ADD COLUMN     "googleId" VARCHAR(255);

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "googleId" VARCHAR(255);

-- CreateIndex
CREATE UNIQUE INDEX "subscribers_googleId_key" ON "subscribers"("googleId");

-- CreateIndex
CREATE UNIQUE INDEX "users_email_user_key" ON "users"("email_user");

-- CreateIndex
CREATE UNIQUE INDEX "users_googleId_key" ON "users"("googleId");
