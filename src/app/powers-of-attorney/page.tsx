import { redirect } from 'next/navigation';

import { getCurrentUser } from '@/lib/auth';

import PowersOfAttorneyForm from '@/components/powers-of-attorney/PowersOfAttorneyForm';

import styles from '@/components/transport-request/TransportRequest.module.css';

export const dynamic = 'force-dynamic';

export default async function PowersOfAttorneyPage() {
  const user = await getCurrentUser();

  if (!user) {
    redirect('/login');
  }

  return (
    <div className={styles.page}>
      <div className={styles.pageHeader}>
        <div>
          <div className={styles.eyebrow}>
            Документы
          </div>

          <h1 className={styles.pageTitle}>
            Доверенности
          </h1>

          <p className={styles.pageDescription}>
            Загрузите счёт поставщика и паспортные данные водителя.
            Система автоматически распознает документы и подготовит
            доверенность. Для ООО «Металлсервис-Москва» дополнительно
            будет сформировано сопроводительное письмо.
          </p>
        </div>
      </div>

      <PowersOfAttorneyForm />
    </div>
  );
}