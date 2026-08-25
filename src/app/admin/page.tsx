import Link from 'next/link';
import {
  redirect,
} from 'next/navigation';

import {
  requireAdmin,
} from '@/lib/auth';

import {
  prisma,
} from '@/lib/db';

import {
  jsonSafe,
} from '@/lib/serial';

import AdminPanel from '@/components/AdminPanel';


const rub = (
  kopeks: bigint
) =>
  new Intl.NumberFormat(
    'ru-RU',
    {
      style: 'currency',
      currency: 'RUB',
      maximumFractionDigits: 0,
    }
  ).format(
    Number(kopeks) / 100
  );


export default async function Admin() {
  /*
   * Доступ только для ADMIN.
   */
  try {
    await requireAdmin();
  } catch {
    redirect(
      '/login'
    );
  }


  /*
   * Загружаем:
   *
   * - транспорт;
   * - общие настройки;
   * - доп. услуги;
   * - всех менеджеров
   *   вместе с их расчетами.
   */
  const [
    vehicles,
    settings,
    services,
    managers,
  ] =
    await Promise.all([
      prisma.vehicleType.findMany({
        orderBy: {
          sortOrder:
            'asc',
        },
      }),

      prisma.appSettings.findUnique({
        where: {
          id:
            'global',
        },
      }),

      prisma.additionalService.findMany({
        orderBy: {
          name:
            'asc',
        },
      }),

      prisma.user.findMany({
        where: {
          role:
            'MANAGER',
        },

        include: {
          calculations: {
            select: {
              id:
                true,

              totalKopeks:
                true,

              createdAt:
                true,
            },
          },
        },

        orderBy: {
          createdAt:
            'desc',
        },
      }),
    ]);


  return (
    <>
      {/*
       * Существующая панель:
       * транспорт,
       * тарифы,
       * настройки,
       * услуги.
       */}
      <AdminPanel
        vehicles={
          jsonSafe(
            vehicles
          )
        }

        settings={
          jsonSafe(
            settings
          )
        }

        services={
          jsonSafe(
            services
          )
        }
      />


      {/*
       * Отдельный блок
       * управления менеджерами.
       */}
      <section
        style={{
          marginTop:
            32,
        }}
      >
        <header>
          <h1>
            Менеджеры
          </h1>

          <p className="sub">
            Зарегистрированные
            менеджеры и статистика
            по их расчетам.
          </p>
        </header>


        <div
          className="card"
          style={{
            marginTop:
              20,

            overflowX:
              'auto',
          }}
        >
          {managers.length ===
          0 ? (
            <div
              style={{
                padding:
                  20,
              }}
            >
              Пока нет
              зарегистрированных
              менеджеров.
            </div>
          ) : (
            <table>
              <thead>
                <tr>
                  <th>
                    Менеджер
                  </th>

                  <th>
                    Дата регистрации
                  </th>

                  <th>
                    Расчетов
                  </th>

                  <th>
                    Общая сумма
                  </th>

                  <th>
                    Последний расчет
                  </th>
                </tr>
              </thead>


              <tbody>
                {managers.map(
                  (
                    manager
                  ) => {
                    const calculationCount =
                      manager
                        .calculations
                        .length;

                    const totalKopeks =
                      manager.calculations.reduce(
                        (
                          sum,
                          calculation
                        ) =>
                          sum +
                          calculation
                            .totalKopeks,
                        0n
                      );

                    const latestCalculation =
                      manager.calculations.reduce<
                        Date | null
                      >(
                        (
                          latest,
                          calculation
                        ) => {
                          if (
                            !latest ||
                            calculation
                              .createdAt >
                              latest
                          ) {
                            return calculation
                              .createdAt;
                          }

                          return latest;
                        },
                        null
                      );

                    return (
                      <tr
                        key={
                          manager.id
                        }
                      >
                        <td>
  <Link
    href={`/admin/managers/${manager.id}`}
  >
    <b>
      {manager.email}
    </b>
  </Link>
</td>


                        <td>
                          {manager.createdAt.toLocaleString(
                            'ru-RU'
                          )}
                        </td>


                        <td>
                          {
                            calculationCount
                          }
                        </td>


                        <td>
                          <b>
                            {rub(
                              totalKopeks
                            )}
                          </b>
                        </td>


                        <td>
                          {latestCalculation
                            ? latestCalculation.toLocaleString(
                                'ru-RU'
                              )
                            : '—'}
                        </td>
                      </tr>
                    );
                  }
                )}
              </tbody>
            </table>
          )}
        </div>
      </section>
    </>
  );
}