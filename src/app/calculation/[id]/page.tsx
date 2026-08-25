import {
  notFound,
} from 'next/navigation';

import {
  prisma,
} from '@/lib/db';

import PrintButton from '@/components/PrintButton';

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

export default async function Detail({
  params,
}: {
  params: Promise<{
    id: string;
  }>;
}) {
  const {
    id,
  } = await params;

  const calculation =
    await prisma.calculation.findUnique({
      where: {
        id,
      },

      include: {
        vehicleType: true,

        points: {
          orderBy: {
            sortOrder: 'asc',
          },
        },

        services: true,
      },
    });

  if (!calculation) {
    notFound();
  }

  const extraPointCount =
    Math.max(
      0,
      calculation.points.length -
        2
    );

  const outsideChargeKopeks =
    BigInt(
      Math.round(
        Number(
          calculation.billableDistanceKm
        ) *
          Number(
            calculation.outsideRateKopeksSnapshot
          )
      )
    );

  return (
    <div className="card">
      <div className="tiny">
        {calculation.number}
        {' · '}
        {calculation.createdAt.toLocaleString(
          'ru-RU'
        )}
      </div>

      <h1>
        Расчет стоимости доставки
      </h1>

      <h2>
        {
          calculation
            .vehicleType
            .name
        }
      </h2>

      <div className="breakdown">
        {calculation.points.map(
          (
            point,
            index
          ) => {
            const isLast =
              index ===
              calculation.points
                .length -
                1;

            const label =
              index === 0
                ? 'Погрузка'
                : isLast
                  ? 'Доставка'
                  : `Доп. точка ${index}`;

            return (
              <div
                key={
                  point.id
                }
              >
                <span>
                  {label}
                </span>

                <b>
                  {
                    point.displayAddress
                  }
                </b>
              </div>
            );
          }
        )}

        <div>
          <span>
            Вес груза
          </span>

          <b>
            {Number(
              calculation.cargoWeightTons
            )}{' '}
            т
          </b>
        </div>

        <div>
          <span>
            Длина груза
          </span>

          <b>
            {calculation.cargoLengthM
              ? `${Number(
                  calculation.cargoLengthM
                )} м`
              : '—'}
          </b>
        </div>

        <div>
          <span>
            Общее расстояние
          </span>

          <b>
            {Number(
              calculation.totalDistanceKm
            ).toFixed(1)}{' '}
            км
          </b>
        </div>

        <div>
          <span>
            Внутри МКАД
          </span>

          <b>
            {Number(
              calculation.insideDistanceKm
            ).toFixed(1)}{' '}
            км
          </b>
        </div>

        <div>
          <span>
            За МКАД
          </span>

          <b>
            {Number(
              calculation.outsideDistanceKm
            ).toFixed(1)}{' '}
            км
          </b>
        </div>

        <div>
          <span>
            Для тарификации
          </span>

          <b>
            {Number(
              calculation.billableDistanceKm
            )}{' '}
            км
          </b>
        </div>

        <div>
          <span>
            Минимальная ставка
          </span>

          <b>
            {rub(
              calculation.basePriceKopeksSnapshot
            )}
          </b>
        </div>

        <div>
          <span>
            За МКАД
          </span>

          <b>
            {Number(
              calculation.billableDistanceKm
            )}{' '}
            км ×{' '}
            {rub(
              calculation.outsideRateKopeksSnapshot
            )}
            /км
            {' = '}
            {rub(
              outsideChargeKopeks
            )}
          </b>
        </div>

        {calculation.ttkSurchargeKopeks >
          0n && (
          <div>
            <span>
              Доплата за ТТК
            </span>

            <b>
              {rub(
                calculation.ttkSurchargeKopeks
              )}
            </b>
          </div>
        )}

        {extraPointCount >
          0 && (
          <div>
            <span>
              Дополнительные точки
            </span>

            <b>
              {
                extraPointCount
              }
              {' × '}
              {rub(
                calculation.extraPointPriceKopeksSnapshot
              )}
              {' = '}
              {rub(
                calculation.extraPointsKopeks
              )}
            </b>
          </div>
        )}

        {calculation.servicesKopeks >
          0n && (
          <div>
            <span>
              Дополнительные услуги
            </span>

            <b>
              {rub(
                calculation.servicesKopeks
              )}
            </b>
          </div>
        )}

        <div>
          <span>
            Сумма до 22%
          </span>

          <b>
            {rub(
              calculation.subtotalBefore22Kopeks
            )}
          </b>
        </div>

        <div>
          <span>
            22%
          </span>

          <b>
            {rub(
              calculation.surcharge22Kopeks
            )}
          </b>
        </div>
      </div>

      <div
        style={{
          marginTop: 24,
          paddingTop: 18,
          borderTop:
            '1px solid #ddd',
        }}
      >
        <div
          className="tiny"
          style={{
            marginBottom: 4,
          }}
        >
          ИТОГОВАЯ СТОИМОСТЬ
        </div>

        <div className="total">
          {rub(
            calculation.totalKopeks
          )}
        </div>
      </div>

      <PrintButton />
    </div>
  );
}