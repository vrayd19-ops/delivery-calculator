"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import styles from "./ManagerLaunchAnnouncement.module.css";

type Props = {
  userEmail: string;
};

export default function ManagerLaunchAnnouncement({
  userEmail,
}: Props) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const storageKey =
      `brt-3d-launch-announcement:${userEmail.toLowerCase()}`;

    const alreadySeen =
      window.localStorage.getItem(storageKey);

    if (!alreadySeen) {
      setOpen(true);
    }
  }, [userEmail]);

  function closeAnnouncement() {
    const storageKey =
      `brt-3d-launch-announcement:${userEmail.toLowerCase()}`;

    window.localStorage.setItem(
      storageKey,
      "seen",
    );

    setOpen(false);
  }

  if (!open) {
    return null;
  }

  return (
    <div
      className={styles.backdrop}
      role="dialog"
      aria-modal="true"
      aria-labelledby="brt-3d-launch-title"
    >
      <div className={styles.modal}>
        <button
          type="button"
          className={styles.close}
          onClick={closeAnnouncement}
          aria-label="Закрыть"
        >
          ×
        </button>

        <div className={styles.badge}>
          НОВОЕ ОБНОВЛЕНИЕ
        </div>

        <h2
          id="brt-3d-launch-title"
          className={styles.title}
        >
          В БРТ появился 3D-визуализатор погрузки
        </h2>

        <p className={styles.text}>
          Теперь перед отправкой транспорта можно
          наглядно проверить размещение груза,
          подобрать подходящий транспорт и посмотреть
          схему погрузки в 3D.
        </p>

        <div className={styles.features}>
          <div>✓ Подбор транспорта под груз</div>
          <div>✓ Наглядная 3D-комплектация</div>
          <div>✓ Проверка размещения груза</div>
        </div>

        <div className={styles.actions}>
          <Link
            href="/transport-loading"
            className={styles.primary}
            onClick={closeAnnouncement}
          >
            Открыть 3D-визуализатор
          </Link>

          <button
            type="button"
            className={styles.secondary}
            onClick={closeAnnouncement}
          >
            Посмотреть позже
          </button>
        </div>
      </div>
    </div>
  );
}
