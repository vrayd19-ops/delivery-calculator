'use client';

import { useEffect, useState } from 'react';
import styles from './ManagerLaunchAnnouncement.module.css';

const API = '/api/announcements/3d-loading';

export default function ManagerLaunchAnnouncement() {
  const [visible, setVisible] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const controller = new AbortController();
    fetch(API, { cache: 'no-store', credentials: 'same-origin', signal: controller.signal })
      .then(async response => {
        if (!response.ok) return;
        const data: { show?: boolean } = await response.json();
        if (!controller.signal.aborted && data.show === true) setVisible(true);
      })
      .catch(() => {});
    return () => controller.abort();
  }, []);

  useEffect(() => {
    if (!visible) return;
    const oldOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = oldOverflow; };
  }, [visible]);

  async function acknowledge() {
    if (saving) return;
    setSaving(true);
    setError('');
    try {
      const response = await fetch(API, {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
      });
      if (!response.ok) throw new Error('Не удалось сохранить подтверждение. Попробуйте ещё раз.');
      setVisible(false);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Ошибка сохранения');
    } finally {
      setSaving(false);
    }
  }

  if (!visible) return null;

  return (
    <div className={styles.overlay} role="dialog" aria-modal="true" aria-labelledby="brt-launch-title">
      <div className={styles.confetti} aria-hidden="true">
        {Array.from({ length: 40 }, (_, i) => (
          <span key={i} style={{ left: `${(i * 37) % 100}%`, animationDelay: `${(i * 0.17) % 4}s`, animationDuration: `${3 + (i % 5)}s` }} />
        ))}
      </div>
      <main className={styles.panel}>
        <div className={styles.eyebrow}>БРТ · БОЛЬШОЕ ОБНОВЛЕНИЕ</div>
        <div className={styles.emoji} aria-hidden="true">🎉 🚛 🏗️</div>
        <h2 id="brt-launch-title">Встречайте 3D-проверку погрузки!</h2>
        <p className={styles.lead}>Теперь можно увидеть, как груз разместится в кузове, ещё до отправки машины.</p>
        <div className={styles.steps}>
          <div><strong>01 · Выберите груз</strong><span>Укажите вид металлопроката и его параметры в 3D-разделе.</span></div>
          <div><strong>02 · Проверьте пачки</strong><span>Посмотрите вес, размеры и распределение груза по платформе.</span></div>
          <div><strong>03 · Запустите погрузку</strong><span>Проверьте размещение с разных ракурсов и посмотрите работу крана.</span></div>
        </div>
        <p className={styles.note}>3D-модель — предварительная визуальная проверка. Окончательную схему крепления и допустимость перевозки подтверждает логист.</p>
        {error && <p className={styles.error} role="alert">{error}</p>}
        <button type="button" className={styles.button} onClick={acknowledge} disabled={saving} autoFocus>
          {saving ? 'Сохраняем…' : 'Начать работу →'}
        </button>
        <div className={styles.footer}>Обратите внимание: на данный момент выбор видов металлопроката и транспортных средств временно ограничен. Мы постепенно расширяем возможности 3D-визуализатора.</div>
      </main>
    </div>
  );
}
