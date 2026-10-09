import 'dotenv/config';

import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error(
    'DATABASE_URL не найден в переменных окружения.'
  );
}

const adapter = new PrismaPg({
  connectionString,
});

const prisma = new PrismaClient({
  adapter,
});

type VehicleSeed = {
  id: string;
  name: string;
  basePriceKopeks: bigint;
  outsidePriceKopeks: bigint;
  minPriceKopeks: bigint;
  maxPayloadTons: string;
  bodyLengthM: string;
  bodyWidthM: string;
  maxCargoLengthM: string;
  overloadKopeks: bigint;
  distanceMultiplier: string;
  isActive: boolean;
  comment: string | null;
  sortOrder: number;
  extraPointPriceKopeks: bigint;
  ttkSurchargeKopeks: bigint;
  imageKey: string;
};

const vehicles: VehicleSeed[] = [
  {
    id: 'cmssigjb70000egvoojb0eox7',
    name: 'Шаланда',
    basePriceKopeks: 2500000n,
    outsidePriceKopeks: 9000n,
    minPriceKopeks: 2500000n,
    maxPayloadTons: '20.00',
    bodyLengthM: '13.60',
    bodyWidthM: '2.45',
    maxCargoLengthM: '13.00',
    overloadKopeks: 0n,
    distanceMultiplier: '1.00',
    isActive: true,
    comment: 'длина 13.6 если что',
    sortOrder: 1,
    extraPointPriceKopeks: 500000n,
    ttkSurchargeKopeks: 500000n,
    imageKey: 'shalanda',
  },
  {
    id: 'shalanda-40t',
    name: 'Шаланда 40 тонн',
    basePriceKopeks: 3600000n,
    outsidePriceKopeks: 10000n,
    minPriceKopeks: 3600000n,
    maxPayloadTons: '43.00',
    bodyLengthM: '13.60',
    bodyWidthM: '2.50',
    maxCargoLengthM: '13.00',
    overloadKopeks: 0n,
    distanceMultiplier: '1.00',
    isActive: true,
    comment: null,
    sortOrder: 2,
    extraPointPriceKopeks: 500000n,
    ttkSurchargeKopeks: 500000n,
    imageKey: 'shalanda',
  },
  {
    id: 'cmssigjc30001egvo73n1mbk3',
    name: 'Газель 3 метра',
    basePriceKopeks: 700000n,
    outsidePriceKopeks: 5000n,
    minPriceKopeks: 750000n,
    maxPayloadTons: '1.50',
    bodyLengthM: '3.00',
    bodyWidthM: '2.00',
    maxCargoLengthM: '3.00',
    overloadKopeks: 0n,
    distanceMultiplier: '1.00',
    isActive: true,
    comment: null,
    sortOrder: 3,
    extraPointPriceKopeks: 300000n,
    ttkSurchargeKopeks: 200000n,
    imageKey: 'gazelle-3m',
  },
  {
    id: 'cmssigjc70002egvo26eyto1a',
    name: 'Газель 6 метров',
    basePriceKopeks: 1250000n,
    outsidePriceKopeks: 8000n,
    minPriceKopeks: 1250000n,
    maxPayloadTons: '5.00',
    bodyLengthM: '6.00',
    bodyWidthM: '2.30',
    maxCargoLengthM: '6.00',
    overloadKopeks: 0n,
    distanceMultiplier: '1.00',
    isActive: true,
    comment: null,
    sortOrder: 4,
    extraPointPriceKopeks: 400000n,
    ttkSurchargeKopeks: 300000n,
    imageKey: 'gazelle-6m',
  },
  {
    id: 'cmssigjcc0003egvoailg9qkf',
    name: 'Манипулятор',
    basePriceKopeks: 1900000n,
    outsidePriceKopeks: 9000n,
    minPriceKopeks: 1900000n,
    maxPayloadTons: '7.00',
    bodyLengthM: '7.00',
    bodyWidthM: '2.40',
    maxCargoLengthM: '7.00',
    overloadKopeks: 0n,
    distanceMultiplier: '1.00',
    isActive: true,
    comment: null,
    sortOrder: 5,
    extraPointPriceKopeks: 400000n,
    ttkSurchargeKopeks: 300000n,
    imageKey: 'manipulator-6m',
  },
  {
    id: 'cmssigjcg0004egvo198jh2gp',
    name: 'Манипулятор с катюшей',
    basePriceKopeks: 2200000n,
    outsidePriceKopeks: 9500n,
    minPriceKopeks: 2200000n,
    maxPayloadTons: '10.00',
    bodyLengthM: '8.00',
    bodyWidthM: '2.45',
    maxCargoLengthM: '12.00',
    overloadKopeks: 0n,
    distanceMultiplier: '1.00',
    isActive: true,
    comment: null,
    sortOrder: 6,
    extraPointPriceKopeks: 500000n,
    ttkSurchargeKopeks: 500000n,
    imageKey: 'manipulator-katyusha',
  },
];

async function seedVehicle(
  vehicle: VehicleSeed
) {
  const existingById =
    await prisma.vehicleType.findUnique({
      where: {
        id: vehicle.id,
      },
    });

  if (existingById) {
    console.log(
      `Уже существует: ${existingById.name}`
    );

    return;
  }

  const existingByName =
    await prisma.vehicleType.findUnique({
      where: {
        name: vehicle.name,
      },
    });

  if (existingByName) {
    console.log(
      `Уже существует: ${existingByName.name}`
    );

    return;
  }

  await prisma.vehicleType.create({
    data: vehicle,
  });

  console.log(
    `Создан транспорт: ${vehicle.name}`
  );
}

async function seedVehicles() {
  for (const vehicle of vehicles) {
    await seedVehicle(vehicle);
  }
}

async function seedAppSettings() {
  const existingSettings =
    await prisma.appSettings.findUnique({
      where: {
        id: 'global',
      },
    });

  if (existingSettings) {
    console.log(
      'Настройки приложения уже существуют.'
    );

    return;
  }

  await prisma.appSettings.create({
    data: {
      id: 'global',
      companyName: 'Расчёт доставки',
      currency: 'RUB',
      globalDistanceFactor: '1.00',
    },
  });

  console.log(
    'Созданы настройки приложения.'
  );
}

async function seedAdmin() {
  const email =
    process.env.ADMIN_EMAIL?.trim() ||
    'admin@delivery.local';

  const existingUser =
    await prisma.user.findUnique({
      where: {
        email,
      },
    });

  if (existingUser) {
    console.log(
      `Администратор уже существует: ${email}`
    );

    return;
  }

  const password =
    process.env.ADMIN_PASSWORD ||
    'Delivery2026!';

  const passwordHash =
    await bcrypt.hash(
      password,
      12
    );

  await prisma.user.create({
    data: {
      email,
      passwordHash,
      role: 'ADMIN',
    },
  });

  console.log(
    `Создан администратор: ${email}`
  );
}

async function main() {
  console.log('');
  console.log(
    'Проверка обязательных данных...'
  );
  console.log('');

  await seedVehicles();

  console.log('');

  await seedAppSettings();
  await seedAdmin();

  console.log('');
  console.log(
    'Проверка базы данных завершена успешно.'
  );
  console.log(
    `Обязательных типов транспорта: ${vehicles.length}`
  );
  console.log('');
}

main()
  .catch((error) => {
    console.error('');
    console.error(
      'Ошибка заполнения базы данных:'
    );
    console.error(error);
    console.error('');

    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });