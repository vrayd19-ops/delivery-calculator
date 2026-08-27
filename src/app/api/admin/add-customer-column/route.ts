import {
  NextResponse,
} from 'next/server';

import {
  getCurrentUser,
} from '@/lib/auth';

import {
  prisma,
} from '@/lib/db';


export const runtime =
  'nodejs';

export const dynamic =
  'force-dynamic';


export async function GET() {
  const user =
    await getCurrentUser();

  if (
    !user ||
    user.role !==
      'ADMIN'
  ) {
    return NextResponse.json(
      {
        success:
          false,

        message:
          'Нет доступа.',
      },
      {
        status:
          403,
      }
    );
  }


  try {
    await prisma.$executeRawUnsafe(`
      ALTER TABLE "TransportRequest"
      ADD COLUMN IF NOT EXISTS "customer" TEXT NOT NULL DEFAULT '';
    `);


    await prisma.$executeRawUnsafe(`
      CREATE INDEX IF NOT EXISTS "TransportRequest_customer_idx"
      ON "TransportRequest"("customer");
    `);


    return NextResponse.json({
      success:
        true,

      message:
        'Поле Заказчик успешно добавлено в базу данных.',
    });
  } catch (
    error
  ) {
    console.error(
      'ADD CUSTOMER COLUMN ERROR:',
      error
    );


    return NextResponse.json(
      {
        success:
          false,

        message:
          'Не удалось добавить поле в базу данных.',
      },
      {
        status:
          500,
      }
    );
  }
}