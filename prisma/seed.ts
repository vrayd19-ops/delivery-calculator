import 'dotenv/config';

import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error('DATABASE_URL не найден в файле .env');
}

const adapter = new PrismaPg({
  connectionString,
});

const prisma = new PrismaClient({
  adapter,
});

const vehicles = [
  ['Шаланда', 1],
  ['Газель 3 метра', 2],
  ['Газель 6 метров', 3],
  ['Манипулятор', 4],
  ['Манипулятор с катюшей', 5],
] as const;

async function main() {
  for (const [name, sortOrder] of vehicles) {
    await prisma.vehicleType.upsert({
      where: {
        name,
      },
      update: {
        sortOrder,
      },
      create: {
        name,
        sortOrder,
      },
    });
  }

  await prisma.appSettings.upsert({
    where: {
      id: 'global',
    },
    update: {},
    create: {
      id: 'global',
    },
  });

  const email = process.env.ADMIN_EMAIL || 'admin@delivery.local';
  const password = process.env.ADMIN_PASSWORD || 'Delivery2026!';

  const passwordHash = await bcrypt.hash(password, 12);

  await prisma.user.upsert({
    where: {
      email,
    },
    update: {
      passwordHash,
      role: 'ADMIN',
    },
    create: {
      email,
      passwordHash,
      role: 'ADMIN',
    },
  });

  console.log('');
  console.log('База данных успешно заполнена.');
  console.log(`Администратор: ${email}`);
  console.log('');
  console.log('Созданы типы транспорта:');
  console.log('- Шаланда');
  console.log('- Газель 3 метра');
  console.log('- Газель 6 метров');
  console.log('- Манипулятор');
  console.log('- Манипулятор с катюшей');
}

main()
  .catch((error) => {
    console.error('Ошибка заполнения базы данных:');
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });