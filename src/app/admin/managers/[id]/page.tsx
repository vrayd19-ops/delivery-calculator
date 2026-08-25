import Link from 'next/link';

import {
  notFound,
  redirect,
} from 'next/navigation';

import {
  requireAdmin,
} from '@/lib/auth';

import {
  prisma,
} from '@/lib/db';


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


export default async function ManagerPage({
  params,
}: {
  params:
    Promise<{
      id: string;
    }>;
}) {
  /*
   * Только администратор
   * может смотреть менеджеров.
   */
  try {
    await requireAdmin();
  } catch {
    redirect(
      '/login'
    );
  }

  const {
    id,
  } =
    await params;

  /*
   * Загружаем менеджера
   * и его расчёты.
   */
  const manager =
    await prisma.user.findUnique({
      where: {
        id,
      },

      include: {
        calculations: {
          include: {
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
            200,
        },
      },
    });

  if (
    !manager ||
    manager.role !==
      'MANAGER'
  ) {
    notFound();
  }

  const totalKopeks =
    manager.calculations.reduce(
      (
        sum,
        calculation
      ) =>
        sum +
        calculation.totalKopeks,
      0n
    );

  return (
    <>
      <div
        style={{
          marginBottom:
            18,
        }}
      >
        <Link href="/admin">
          ← Назад в админку
        </Link>
      </div>

      <header>
        <h1>
          Расчёты менеджера
        </h1>

        <p className="sub">
          {manager.email}
        </p>
      </header>

      <div
        className="card"
        style={{
          marginTop:
            20,
        }}
      >
        <div className="breakdown">

          <div>
            <span>
              Email
            </span>

            <b>
              {manager.email}
            </b>
          </div>

          <div>
            <span>
              Дата регистрации
            </span>

            <b>
              {manager.createdAt.toLocaleString(
                'ru-RU'
              )}
            </b>
          </div>

          <div>
            <span>
              Количество расчётов
            </span>

            <b>
              {
                manager
                  .calculations
                  .length
              }
            </b>
          </div>

          <div>
            <span>
              Общая сумма расчётов
            </span>

            <b>
              {rub(
                totalKopeks
              )}
            </b>
          </div>

        </div>
      </div>

      <div
        className="card"
        style={{
          marginTop:
            20,

          overflowX:
            'auto',
        }}
      >
        {manager
          .calculations
          .length ===
        0 ? (
          <div
            style={{
              padding:
                20,
            }}
          >
            У менеджера пока
            нет сохранённых расчётов.
          </div>
        ) : (
          <table>
            <thead>
              <tr>
                <th>
                  Номер
                </th>

                <th>
                  Дата
                </th>

                <th>
                  Транспорт
                </th>

                <th>
                  Вес
                </th>

                <th>
                  Длина
                </th>

                <th>
                  Маршрут
                </th>

                <th>
                  Для тарификации
                </th>

                <th>
                  До 22%
                </th>

                <th>
                  22%
                </th>

                <th>
                  Итого
                </th>
              </tr>
            </thead>

            <tbody>
              {manager.calculations.map(
                (
                  calculation
                ) => (
                  <tr
                    key={
                      calculation.id
                    }
                  >
                    <td>
                      <Link
                        href={`/calculation/${calculation.id}`}
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

                    <td>
                      {
                        calculation
                          .vehicleType
                          .name
                      }
                    </td>

                    <td>
                      {Number(
                        calculation
                          .cargoWeightTons
                      )}{' '}
                      т
                    </td>

                    <td>
                      {calculation
                        .cargoLengthM
                        ? `${Number(
                            calculation
                              .cargoLengthM
                          )} м`
                        : '—'}
                    </td>

                    <td>
                      {calculation.points
                        .map(
                          (
                            point
                          ) =>
                            point
                              .displayAddress
                        )
                        .join(
                          ' → '
                        )}
                    </td>

                    <td>
                      {Number(
                        calculation
                          .billableDistanceKm
                      )}{' '}
                      км
                    </td>

                    <td>
                      {rub(
                        calculation
                          .subtotalBefore22Kopeks
                      )}
                    </td>

                    <td>
                      {rub(
                        calculation
                          .surcharge22Kopeks
                      )}
                    </td>

                    <td>
                      <b>
                        {rub(
                          calculation
                            .totalKopeks
                        )}
                      </b>
                    </td>
                  </tr>
                )
              )}
            </tbody>
          </table>
        )}
      </div>
    </>
  );
}