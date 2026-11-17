import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { prisma } from '@/lib/db';

export const dynamic = 'force-dynamic';

const ANNOUNCEMENT_KEY = '3d-loading-launch-2026-10';

async function getManager() {
  const user = await getCurrentUser();
  if (!user) return { user: null, status: 401 } as const;
  if (user.role !== 'MANAGER') return { user: null, status: 403 } as const;
  return { user, status: 200 } as const;
}

export async function GET() {
  try {
    const { user, status } = await getManager();
    if (!user) return NextResponse.json({ show: false }, { status });
    const records = await prisma.$queryRaw<Array<{ viewedAt: Date }>>`
      SELECT "viewedAt" FROM "ManagerAnnouncementView"
      WHERE "userId" = ${user.id} AND "announcementKey" = ${ANNOUNCEMENT_KEY}
      LIMIT 1
    `;
    return NextResponse.json({ show: records.length === 0, key: ANNOUNCEMENT_KEY }, {
      headers: { 'Cache-Control': 'no-store' },
    });
  } catch (error) {
    console.error('ANNOUNCEMENT GET ERROR:', error);
    return NextResponse.json({ error: 'Не удалось проверить объявление' }, { status: 500 });
  }
}

export async function POST() {
  try {
    const { user, status } = await getManager();
    if (!user) return NextResponse.json({ error: 'Нет доступа' }, { status });
    await prisma.$executeRaw`
      INSERT INTO "ManagerAnnouncementView" ("userId", "announcementKey", "viewedAt")
      VALUES (${user.id}, ${ANNOUNCEMENT_KEY}, CURRENT_TIMESTAMP)
      ON CONFLICT ("userId", "announcementKey") DO NOTHING
    `;
    return NextResponse.json({ ok: true }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    console.error('ANNOUNCEMENT POST ERROR:', error);
    return NextResponse.json({ error: 'Не удалось сохранить просмотр' }, { status: 500 });
  }
}
