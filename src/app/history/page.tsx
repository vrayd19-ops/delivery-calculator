import Link from 'next/link';

import {
  redirect,
} from 'next/navigation';

import {
  Prisma,
} from '@prisma/client';

import {
  prisma,
} from '@/lib/db';

import {
  getCurrentUser,
} from '@/lib/auth';


const rub = (
  kopeks: bigint
) =>
  new Intl.NumberFormat(
    'ru-RU',
    {
      style:
        'currency',

      currency:
        'RUB',

      maximumFractionDigits:
        0,
    }
  ).format(
    Number(
      kopeks
    ) / 100
  );


type SearchParams = {
  q?: string;
  manager?: string;
  dateFrom?: string;
  dateTo?: string;
};


export default async function HistoryPage({
  searchParams,
}: {
  searchParams:
    Promise<SearchParams>;
}) {
  const user =
    await getCurrentUser();


  if (!user) {
    redirect(
      '/login'
    );
  }


  const isAdmin =
    user.role ===
    'ADMIN';


  const params =
    await searchParams;


  const q =
    String(
      params.q ||
      ''
    ).trim();


  const manager =
    String(
      params.manager ||
      ''
    ).trim();


  const dateFrom =
    String(
      params.dateFrom ||
      ''
    ).trim();


  const dateTo =
    String(
      params.dateTo ||
      ''
    ).trim();


  const filters:
    Prisma.CalculationWhereInput[] =
    [];


  /*
   * ========================================
   * MANAGER
   * ========================================
   *
   * Жёстко ограничиваем
   * только его userId.
   *
   * Даже если менеджер вручную
   * подставит ?manager=...
   * в URL, это ничего не изменит.
   */
  if (!isAdmin) {
    filters.push({
      userId:
        user.id,
    });
  }


  /*
   * ========================================
   * ADMIN
   * ========================================
   */
  if (
    isAdmin &&
    manager
  ) {
    filters.push({
      userId:
        manager,
    });
  }


  /*
   * Поиск по:
   *
   * - номеру расчёта;
   * - адресу.
   */
  if (q) {
    filters.push({
      OR: [
        {
          number: {
            contains:
              q,

            mode:
              'insensitive',
          },
        },

        {
          points: {
            some: {
              displayAddress: {
                contains:
                  q,

                mode:
                  'insensitive',
              },
            },
          },
        },

        {
          points: {
            some: {
              normalizedAddress: {
                contains:
                  q,

                mode:
                  'insensitive',
              },
            },
          },
        },
      ],
    });
  }


  /*
   * Дата от.
   */
  if (dateFrom) {
    const from =
      new Date(
        `${dateFrom}T00:00:00`
      );


    if (
      !Number.isNaN(
        from.getTime()
      )
    ) {
      filters.push({
        createdAt: {
          gte:
            from,
        },
      });
    }
  }


  /*
   * Дата до включительно.
   */
  if (dateTo) {
    const to =
      new Date(
        `${dateTo}T00:00:00`
      );


    if (
      !Number.isNaN(
        to.getTime()
      )
    ) {
      to.setDate(
        to.getDate() +
          1
      );


      filters.push({
        createdAt: {
          lt:
            to,
        },
      });
    }
  }


  const where:
    Prisma.CalculationWhereInput =
    filters.length
      ? {
          AND:
            filters,
        }
      : {};


  const [
    calculations,
    managers,
  ] =
    await Promise.all([
      prisma.calculation.findMany({
        where,

        include: {
          user: {
            select: {
              id:
                true,

              email:
                true,
            },
          },

          vehicleType:
            true,

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
          500,
      }),


      /*
       * Список менеджеров
       * загружаем ТОЛЬКО
       * для администратора.
       */
      isAdmin
        ? prisma.user.findMany({
            where: {
              role:
                'MANAGER',
            },

            orderBy: {
              email:
                'asc',
            },

            select: {
              id:
                true,

              email:
                true,
            },
          })
        : Promise.resolve(
            []
          ),
    ]);


  return (
    <>

      <header>

        <h1>
          {isAdmin
            ? 'Все расчёты'
            : 'Мои расчёты'}
        </h1>

        <p className="sub">
          {isAdmin
            ? 'История сохранённых расчётов всех менеджеров.'
            : 'Здесь отображаются только ваши сохранённые расчёты.'}
        </p>

      </header>


      {/*
       * ========================================
       * ФИЛЬТРЫ
       * ========================================
       */}
      <form
        className="card history-filters"
      >

        <div className="field">

          <label>
            Поиск
          </label>

          <input
            type="text"
            name="q"
            defaultValue={
              q
            }
            placeholder="Номер расчёта или адрес"
          />

        </div>


        {/*
         * ВАЖНО:
         *
         * MANAGER этот select
         * вообще не получает.
         */}
        {isAdmin && (
          <div className="field">

            <label>
              Менеджер
            </label>

            <select
              name="manager"
              defaultValue={
                manager
              }
            >

              <option value="">
                Все менеджеры
              </option>


              {managers.map(
                (
                  item
                ) => (
                  <option
                    key={
                      item.id
                    }
                    value={
                      item.id
                    }
                  >
                    {
                      item.email
                    }
                  </option>
                )
              )}

            </select>

          </div>
        )}


        <div className="history-date-row">

          <div className="field">

            <label>
              Дата от
            </label>

            <input
              type="date"
              name="dateFrom"
              defaultValue={
                dateFrom
              }
            />

          </div>


          <div className="field">

            <label>
              Дата до
            </label>

            <input
              type="date"
              name="dateTo"
              defaultValue={
                dateTo
              }
            />

          </div>

        </div>


        <div className="history-filter-actions">

          <button
            type="submit"
            className="btn"
          >
            Найти
          </button>


          <Link
            href="/history"
            className="btn secondary"
          >
            Сбросить
          </Link>

        </div>

      </form>


      {/*
       * ========================================
       * ТАБЛИЦА
       * ========================================
       */}
      <div
        className="card history-table-card"
      >

        {calculations.length ===
        0 ? (
          <div className="history-empty">

            Пока нет расчётов
            по выбранным условиям.

          </div>
        ) : (
          <table>

            <thead>

              <tr>

                <th>
                  Номер расчёта
                </th>

                <th>
                  Дата
                </th>


                {isAdmin && (
                  <th>
                    Менеджер
                  </th>
                )}


                <th>
                  Адрес / маршрут
                </th>

                <th>
                  Транспорт
                </th>

                <th>
                  Итого
                </th>

              </tr>

            </thead>


            <tbody>

              {calculations.map(
                (
                  calculation
                ) => {
                  const from =
                    calculation
                      .points[0]
                      ?.displayAddress ??
                    '—';


                  const to =
                    calculation
                      .points[
                        calculation
                          .points
                          .length -
                          1
                      ]
                      ?.displayAddress ??
                    '—';


                  return (
                    <tr
                      key={
                        calculation.id
                      }
                    >

                      <td>

                        <Link
                          href={`/calculation/${calculation.id}`}
                          className="history-number"
                        >
                          {
                            calculation.number
                          }
                        </Link>

                      </td>


                      <td>

                        {calculation.createdAt.toLocaleString(
                          'ru-RU'
                        )}

                      </td>


                      {isAdmin && (
                        <td>

                          {calculation
                            .user
                            ?.email ??
                            '—'}

                        </td>
                      )}


                      <td>

                        <div className="history-route">

                          <div>
                            {from}
                          </div>

                          <span>
                            ↓
                          </span>

                          <div>
                            {to}
                          </div>

                        </div>

                      </td>


                      <td>

                        {
                          calculation
                            .vehicleType
                            .name
                        }

                      </td>


                      <td>

                        <b className="history-total">
                          {rub(
                            calculation
                              .totalKopeks
                          )}
                        </b>

                      </td>

                    </tr>
                  );
                }
              )}

            </tbody>

          </table>
        )}

      </div>

    </>
  );
}