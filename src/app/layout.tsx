import './globals.css';

import type {
  Metadata,
} from 'next';

import Link from 'next/link';

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
      'БРТ — Быстрый Расчёт Логистики',

    template:
      '%s | БРТ',
  },

  description:
    'Быстрый расчёт стоимости доставки по Москве и Московской области',

  applicationName:
    'БРТ — Быстрый Расчёт Логистики',

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


function shortAddress(
  value?: string | null
) {
  if (!value) {
    return '—';
  }

  const parts =
    value
      .split(',')
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
  kopeks: bigint
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
    ) / 100
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

  if (!user) {
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
    await prisma.calculation.findMany({
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
             * =====================================
             * ЛОГОТИП
             * =====================================
             */}
            <Link
              href="/"
              className="brt-logo-image-link"
              aria-label="БРТ — главная"
            >

              <img
                src="/brt-logo.png"
                alt="БРТ"
                className="brt-logo-image"
              />

            </Link>


            {/*
             * =====================================
             * ОСНОВНОЕ МЕНЮ
             * =====================================
             */}
            <nav className="side-menu">

              <Link
                href="/"
                className="side-menu-item side-menu-main"
              >

                <span className="side-icon side-icon-dark">
                  +
                </span>

                <span>
                  Новый расчёт
                </span>

              </Link>


              {/*
               * =================================
               * ЗАЯВКА НА ТРАНСПОРТ
               * =================================
               */}
              <Link
                href="/transport-request"
                className="side-menu-item"
              >

                <span className="side-icon">
                  ↗
                </span>

                <span>
                  Заявка на транспорт
                </span>

              </Link>


              <Link
                href="/history"
                className="side-menu-item"
              >

                <span className="side-icon">
                  ▤
                </span>

                <span>
                  {isAdmin
                    ? 'Все расчёты'
                    : 'Мои расчёты'}
                </span>

              </Link>


              {/*
               * =================================
               * ТОЛЬКО ДЛЯ АДМИНИСТРАТОРА
               * =================================
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
                      🚚
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
                      ₽
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
                      ◇
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
                      👤
                    </span>

                    <span>
                      Пользователи
                    </span>

                  </Link>

                </>
              )}

            </nav>


            {/*
             * =====================================
             * ПОСЛЕДНИЕ РАСЧЁТЫ
             * =====================================
             */}
            <div
              className="sidebar-recent"
              style={
                isAdmin
                  ? undefined
                  : {
                      marginTop:
                        24,
                    }
              }
            >

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

                            {calculation.createdAt.toLocaleString(
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


            {!isAdmin && (
              <div
                style={{
                  marginTop:
                    14,

                  padding:
                    '11px 12px',

                  color:
                    '#99918b',

                  fontSize:
                    9,

                  lineHeight:
                    1.5,

                  textAlign:
                    'center',
                }}
              >
                Расчёты сохраняются
                автоматически
              </div>
            )}

          </aside>


          <main className="app-workspace">

            <header className="app-header">

              <div className="brt-header-title">

                <span className="brt-header-main">
                  Быстрый
                </span>

                <span className="brt-header-accent">
                  Расчёт
                </span>

                <span className="brt-header-main">
                  Логистики
                </span>

              </div>


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