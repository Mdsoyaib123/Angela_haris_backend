/*
  Warnings:

  - You are about to drop the column `parentEmail` on the `User` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "User" DROP COLUMN "parentEmail",
ADD COLUMN     "athlateEmail" TEXT;
