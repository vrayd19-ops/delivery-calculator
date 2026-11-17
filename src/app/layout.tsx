import './globals.css';

import type {
  Metadata,
} from 'next';

import Link from 'next/link';

import {
  Plus,
  ClipboardList,
  PackageCheck,
  FileSignature,
  History,
  Truck,
  BadgeRussianRuble,
  Layers3,
  Users,
} from 'lucide-react';

import {
  getCurrentUser,
} from '@/lib/auth';

import {
  prisma,
} from '@/lib/db';

import LogoutButton from '@/components/LogoutButton';


export const metadata: Metadata = {
  title: {
    default:
      'БРТ — Быстрый Расчёт Транспорта',

    template:
      '%s | БРТ',
  },

  description:
    'Быстрый расчёт стоимости доставки по Москве и Московской области',

  applicationName:
    'БРТ — Быстрый Расчёт Транспорта',

  icons: {
    icon: [
      {
        url:
          '/brt-logo.png',

        type:
          'image/png',
      },
    ],

    shortcut:
      '/brt-logo.png',

    apple:
      '/brt-logo.png',
  },
};


type MenuIconName =
  | 'plus'
  | 'truck'
  | 'cube'
  | 'chart'
  | 'transport'
  | 'rub'
  | 'services'
  | 'users';


function MenuIcon({
  name,
}: {
  name:
    MenuIconName;
}) {
  if (
    name ===
    'plus'
  ) {
    return (
      <svg
        viewBox="0 0 24 24"
        aria-hidden="true"
      >
        <path
          d="M12 5v14M5 12h14"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.9"
          strokeLinecap="round"
        />
      </svg>
    );
  }


  if (
    name ===
    'truck'
  ) {
    return (
      <svg
        viewBox="0 0 24 24"
        aria-hidden="true"
      >
        <path
          d="M3.5 6.5h10v9h-10z"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.6"
          strokeLinejoin="round"
        />

        <path
          d="M13.5 9h3.4l3.1 3.3v3.2h-6.5z"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.6"
          strokeLinejoin="round"
        />

        <circle
          cx="7"
          cy="17.5"
          r="1.8"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.6"
        />

        <circle
          cx="17.3"
          cy="17.5"
          r="1.8"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.6"
        />
      </svg>
    );
  }


  if (
    name ===
    'cube'
  ) {
    return (
      <svg
        viewBox="0 0 24 24"
        aria-hidden="true"
      >
        <path
          d="M12 3.2 20 7.6 12 12 4 7.6 12 3.2Z"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.6"
          strokeLinejoin="round"
        />

        <path
          d="M4 7.6V16.4L12 20.8V12L4 7.6Z"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.6"
          strokeLinejoin="round"
        />

        <path
          d="M20 7.6V16.4L12 20.8V12L20 7.6Z"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.6"
          strokeLinejoin="round"
        />
      </svg>
    );
  }


  if (
    name ===
    'chart'
  ) {
    return (
      <svg
        viewBox="0 0 24 24"
        aria-hidden="true"
      >
        <path
          d="M5 19V11M12 19V5M19 19V8"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
        />
      </svg>
    );
  }


  if (
    name ===
    'transport'
  ) {
    return (
      <svg
        viewBox="0 0 24 24"
        aria-hidden="true"
      >
        <path
          d="M4 7.5h16M5.5 7.5v9h13v-9"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.6"
          strokeLinejoin="round"
        />

        <path
          d="M8 5h8"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.6"
          strokeLinecap="round"
        />

        <circle
          cx="8"
          cy="18.2"
          r="1.4"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
        />

        <circle
          cx="16"
          cy="18.2"
          r="1.4"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
        />
      </svg>
    );
  }


  if (
    name ===
    'rub'
  ) {
    return (
      <svg
        viewBox="0 0 24 24"
        aria-hidden="true"
      >
        <path
          d="M8 4h5.3a4 4 0 0 1 0 8H8M8 4v16M6 14h8M6 17h7"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    );
  }


  if (
    name ===
    'services'
  ) {
    return (
      <svg
        viewBox="0 0 24 24"
        aria-hidden="true"
      >
        <path
          d="M12 3.5 20.5 8 12 12.5 3.5 8 12 3.5Z"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.6"
          strokeLinejoin="round"
        />

        <path
          d="M3.5 12 12 16.5 20.5 12M3.5 16 12 20.5 20.5 16"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.6"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    );
  }


  return (
    <svg
      viewBox="0 0 24 24"
      aria-hidden="true"
    >
      <circle
        cx="12"
        cy="8"
        r="3.2"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.7"
      />

      <path
        d="M5.5 20c.6-4 3.1-6 6.5-6s5.9 2 6.5 6"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
      />
    </svg>
  );
}


function shortAddress(
  value?:
    string |
    null
) {
  if (
    !value
  ) {
    return '—';
  }


  const parts =
    value
      .split(
        ','
      )
      .map(
        (
          item
        ) =>
          item.trim()
      )
      .filter(
        Boolean
      );


  if (
    parts.length ===
    0
  ) {
    return value;
  }


  const useful =
    parts.filter(
      (
        part
      ) =>
        !/^\d/.test(
          part
        ) &&
        !part
          .toLowerCase()
          .includes(
            'россия'
          )
    );


  if (
    useful.length >=
    2
  ) {
    return useful[
      useful.length -
      2
    ];
  }


  return (
    useful[0] ||
    parts[0]
  );
}


function rub(
  kopeks:
    bigint
) {
  return new Intl.NumberFormat(
    'ru-RU',
    {
      maximumFractionDigits:
        0,
    }
  ).format(
    Number(
      kopeks
    ) /
    100
  );
}


export default async function RootLayout({
  children,
}: {
  children:
    React.ReactNode;
}) {
  const user =
    await getCurrentUser();


  if (
    !user
  ) {
    return (
      <html lang="ru">

        <body>

          <div className="auth-layout">

            {children}

          </div>

        </body>

      </html>
    );
  }


  const isAdmin =
    user.role ===
    'ADMIN';


  const recentCalculations =
    await prisma
      .calculation
      .findMany({
        where:
          isAdmin
            ? undefined
            : {
                userId:
                  user.id,
              },

        include: {
          points: {
            orderBy: {
              sortOrder:
                'asc',
            },
          },
        },

        orderBy: {
          createdAt:
            'desc',
        },

        take:
          3,
      });


  return (
    <html lang="ru">

      <body>

        <div className="app-shell">

          <aside className="app-sidebar">

            {/*
             * =========================================
             * СТАРОЕ НАЗВАНИЕ СЛЕВА
             * ОСТАВЛЯЕМ
             * =========================================
             */}
            <Link
              href="/"
              className="brt-logo-image-link"
              aria-label="Быстрый Расчёт Транспорта — главная"
            >

              <div className="brt-sidebar-brand">

                <span className="brt-sidebar-brand-line">
                  Быстрый
                </span>

                <span className="brt-sidebar-brand-line brt-sidebar-brand-accent">
                  Расчёт
                </span>

                <span className="brt-sidebar-brand-line">
                  Транспорта
                </span>

              </div>

            </Link>


            {/*
             * =========================================
             * ОСНОВНОЕ МЕНЮ
             * =========================================
             */}
            <nav className="side-menu">

              <Link
                href="/"
                className="side-menu-item side-menu-main"
              >

                <span className="side-icon">
                  <Plus aria-hidden="true" />
                </span>

                <span>
                  Новый расчёт
                </span>

              </Link>


              <Link
                href="/transport-request"
                className="side-menu-item"
              >

                <span className="side-icon">
                  <ClipboardList aria-hidden="true" />
                </span>

                <span>
                  Заявка на транспорт
                </span>

              </Link>


              <Link
                href="/transport-loading"
                className="side-menu-item side-menu-loading"
              >

                <span className="side-icon">
                  <PackageCheck aria-hidden="true" />
                </span>

                <span>
                  Комплектация транспорта
                </span>

              </Link>


              <Link
                href="/history"
                className="side-menu-item"
              >

                <span className="side-icon">
                  <History aria-hidden="true" />
                </span>

                <span>
                  {isAdmin
                    ? 'Все расчёты'
                    : 'Мои расчёты'}
                </span>

              </Link>


              {/*
               * =========================================
               * АДМИНИСТРАТОР
               * =========================================
               */}
              {isAdmin && (
                <>

                  <div className="side-section-label">
                    Управление
                  </div>


                  <Link
                    href="/admin/transport"
                    className="side-menu-item"
                  >

                    <span className="side-icon">
                  <Truck aria-hidden="true" />
                </span>

                    <span>
                      Транспорт
                    </span>

                  </Link>


                  <Link
                    href="/admin/tariffs"
                    className="side-menu-item"
                  >

                    <span className="side-icon">
                  <BadgeRussianRuble aria-hidden="true" />
                </span>

                    <span>
                      Тарифы
                    </span>

                  </Link>


                  <Link
                    href="/admin/services"
                    className="side-menu-item"
                  >

                    <span className="side-icon">
                  <Layers3 aria-hidden="true" />
                </span>

                    <span>
                      Доп. услуги
                    </span>

                  </Link>


                  <div className="side-section-label">
                    Доступ
                  </div>


                  <Link
                    href="/admin/users"
                    className="side-menu-item"
                  >

                    <span className="side-icon">
                  <Users aria-hidden="true" />
                </span>

                    <span>
                      Пользователи
                    </span>

                  </Link>

                </>
              )}

            </nav>


            <div className="sidebar-spacer" />


            {/*
             * =========================================
             * ПОСЛЕДНИЕ РАСЧЁТЫ
             * =========================================
             */}
            <div className="sidebar-recent">

              <div className="sidebar-recent-heading">

                <span>
                  Последние расчёты
                </span>


                <Link
                  href="/history"
                  title="Посмотреть все расчёты"
                  aria-label="Посмотреть все расчёты"
                >
                  →
                </Link>

              </div>


              {recentCalculations.length ===
              0 ? (
                <div className="sidebar-recent-empty">

                  <div
                    style={{
                      fontWeight:
                        650,

                      marginBottom:
                        4,
                    }}
                  >
                    Расчётов пока нет
                  </div>

                  <div>
                    Первый расчёт
                    появится здесь
                    автоматически.
                  </div>

                </div>
              ) : (
                <div className="sidebar-recent-list">

                  {recentCalculations.map(
                    (
                      calculation
                    ) => {
                      const points =
                        calculation
                          .points;


                      const firstPoint =
                        points[0];


                      const lastPoint =
                        points[
                          points.length -
                          1
                        ];


                      const from =
                        shortAddress(
                          firstPoint
                            ?.displayAddress
                        );


                      const to =
                        shortAddress(
                          lastPoint
                            ?.displayAddress
                        );


                      return (
                        <Link
                          key={
                            calculation.id
                          }
                          href={`/calculation/${calculation.id}`}
                          className="sidebar-recent-item"
                        >

                          <div className="sidebar-recent-route">

                            <span>
                              {from}
                            </span>

                            <span className="sidebar-recent-arrow">
                              →
                            </span>

                            <span>
                              {to}
                            </span>

                          </div>


                          <div className="sidebar-recent-bottom">

                            <span>
                              {
                                calculation
                                  .number
                              }
                            </span>


                            <b>
                              {rub(
                                calculation
                                  .totalKopeks
                              )}{' '}
                              ₽
                            </b>

                          </div>


                          <div className="sidebar-recent-date">

                            {calculation
                              .createdAt
                              .toLocaleString(
                                'ru-RU',
                                {
                                  day:
                                    '2-digit',

                                  month:
                                    '2-digit',

                                  year:
                                    'numeric',

                                  hour:
                                    '2-digit',

                                  minute:
                                    '2-digit',
                                }
                              )}

                          </div>

                        </Link>
                      );
                    }
                  )}

                </div>
              )}

            </div>

          </aside>


          <main className="app-workspace">

            {/*
             * =========================================
             * СТАРАЯ СИНЯЯ ШАПКА
             * ОСТАВЛЯЕМ
             * =========================================
             */}
            <header className="app-header">

              <Link
                href="/"
                className="brt-header-banner"
                aria-label="БРТ Логистика — главная"
              >

                <img
                  src="/brt-header-logo.png"
                  alt="БРТ Логистика"
                  className="brt-header-banner-image"
                />

              </Link>


              <div className="header-right">

                <div className="user-avatar">

                  {user.email
                    .charAt(
                      0
                    )
                    .toUpperCase()}

                </div>


                <div className="user-block">

                  <div className="user-email">
                    {user.email}
                  </div>


                  <div className="user-role">

                    {isAdmin
                      ? 'Администратор'
                      : 'Менеджер'}

                  </div>

                </div>


                <LogoutButton />

              </div>

            </header>


            <div className="app-content">

              {children}

            </div>

          </main>

        </div>

      </body>

    </html>
  );
}