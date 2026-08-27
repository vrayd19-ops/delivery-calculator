import { redirect } from 'next/navigation';

import { getCurrentUser } from '@/lib/auth';
import { prisma } from '@/lib/db';

import TransportRequestForm from '@/components/transport-request/TransportRequestForm';

import styles from '@/components/transport-request/TransportRequest.module.css';

export const dynamic = 'force-dynamic';

export default async function TransportRequestPage() {
  const user = await getCurrentUser();

  if (!user) {
    redirect('/login');
  }

  const vehicles = await prisma.vehicleType.findMany({
    where: {
      isActive: true,
    },
    orderBy: [
      {
        sortOrder: 'asc',
      },
      {
        name: 'asc',
      },
    ],
    select: {
      id: true,
      name: true,
    },
  });

  return (
    <div className={styles.page}>
      <div className={styles.pageHeader}>
        <div>
          <div className={styles.eyebrow}>
            Логистика
          </div>

          <h1 className={styles.pageTitle}>
            Заявка на транспорт
          </h1>

          <p className={styles.pageDescription}>
            Заполните данные по погрузке и выгрузке. После отправки
            заявка автоматически поступит ответственному менеджеру.
          </p>
        </div>
      </div>

      <TransportRequestForm
        vehicles={vehicles}
        defaultManagerEmail={user.email}
      />
    </div>
  );
}