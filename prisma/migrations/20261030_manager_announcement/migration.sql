CREATE TABLE IF NOT EXISTS "ManagerAnnouncementView" (
  "userId" TEXT NOT NULL,
  "announcementKey" TEXT NOT NULL,
  "viewedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ManagerAnnouncementView_pkey" PRIMARY KEY ("userId", "announcementKey"),
  CONSTRAINT "ManagerAnnouncementView_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX IF NOT EXISTS "ManagerAnnouncementView_announcementKey_idx" ON "ManagerAnnouncementView"("announcementKey");
