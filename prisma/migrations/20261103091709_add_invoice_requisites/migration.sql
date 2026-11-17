/*
  Warnings:

  - You are about to drop the `ManagerAnnouncementView` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "ManagerAnnouncementView" DROP CONSTRAINT "ManagerAnnouncementView_userId_fkey";

-- DropTable
DROP TABLE "ManagerAnnouncementView";
