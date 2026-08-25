import {
  redirect,
} from 'next/navigation';

import {
  revalidatePath,
} from 'next/cache';

import {
  prisma,
} from '@/lib/db';

import {
  requireAdmin,
} from '@/lib/auth';


function rubFromKopeks(
  value: bigint
) {
  return Number(
    value
  ) / 100;
}


function parseRubles(
  value:
    FormDataEntryValue |
    null
) {
  const text =
    String(
      value ?? ''
    )
      .trim()
      .replace(
        ',',
        '.'
      );


  if (!text) {
    return 0n;
  }


  const number =
    Number(
      text
    );


  if (
    !Number.isFinite(
      number
    ) ||
    number < 0
  ) {
    throw new Error(
      'Некорректная цена'
    );
  }


  return BigInt(
    Math.round(
      number *
        100
    )
  );
}


function parseMultiplier(
  value:
    FormDataEntryValue |
    null
) {
  const text =
    String(
      value ?? '1'
    )
      .trim()
      .replace(
        ',',
        '.'
      );


  const number =
    Number(
      text
    );


  if (
    !Number.isFinite(
      number
    ) ||
    number <= 0
  ) {
    throw new Error(
      'Некорректный коэффициент'
    );
  }


  return number;
}


async function saveTariff(
  vehicleId: string,
  formData: FormData
) {
  'use server';


  await requireAdmin();


  const vehicle =
    await prisma.vehicleType.findUnique({
      where: {
        id:
          vehicleId,
      },
    });


  if (!vehicle) {
    throw new Error(
      'Транспорт не найден'
    );
  }


  const basePriceKopeks =
    parseRubles(
      formData.get(
        'basePriceRub'
      )
    );


  const minPriceKopeks =
    parseRubles(
      formData.get(
        'minPriceRub'
      )
    );


  const outsidePriceKopeks =
    parseRubles(
      formData.get(
        'outsidePriceRub'
      )
    );


  const ttkSurchargeKopeks =
    parseRubles(
      formData.get(
        'ttkSurchargeRub'
      )
    );


  const extraPointPriceKopeks =
    parseRubles(
      formData.get(
        'extraPointPriceRub'
      )
    );


  const overloadKopeks =
    parseRubles(
      formData.get(
        'overloadRub'
      )
    );


  const distanceMultiplier =
    parseMultiplier(
      formData.get(
        'distanceMultiplier'
      )
    );


  await prisma.vehicleType.update({
    where: {
      id:
        vehicleId,
    },

    data: {
      basePriceKopeks,

      minPriceKopeks,

      outsidePriceKopeks,

      ttkSurchargeKopeks,

      extraPointPriceKopeks,

      overloadKopeks,

      distanceMultiplier,
    },
  });


  revalidatePath(
    '/admin/tariffs'
  );


  revalidatePath(
    '/'
  );
}


export default async function TariffsPage() {
  try {
    await requireAdmin();
  } catch {
    redirect(
      '/login'
    );
  }


  const vehicles =
    await prisma.vehicleType.findMany({
      orderBy: {
        sortOrder:
          'asc',
      },
    });


  return (
    <div className="admin-section-page">

      <div className="admin-section-header">

        <div>

          <h1>
            Тарифы
          </h1>

          <p>
            Стоимость доставки
            для каждого вида транспорта.
          </p>

        </div>

      </div>


      {vehicles.length ===
      0 ? (
        <div className="card admin-empty-card">
          Сначала добавьте транспорт.
        </div>
      ) : (
        <div className="tariff-admin-list">

          {vehicles.map(
            (
              vehicle
            ) => {
              const saveAction =
                saveTariff.bind(
                  null,
                  vehicle.id
                );


              return (
                <form
                  key={
                    vehicle.id
                  }
                  action={
                    saveAction
                  }
                  className="card tariff-admin-card"
                >

                  <div className="tariff-admin-card-header">

                    <div className="vehicle-admin-icon">
                      🚚
                    </div>


                    <div>

                      <h2>
                        {vehicle.name}
                      </h2>


                      <div className="tariff-admin-meta">
                        {vehicle.maxPayloadTons
                          ? `${Number(
                              vehicle.maxPayloadTons
                            )} т`
                          : 'Грузоподъёмность не указана'}

                        {' · '}

                        {vehicle.maxCargoLengthM
                          ? `до ${Number(
                              vehicle.maxCargoLengthM
                            )} м`
                          : 'длина не указана'}
                      </div>

                    </div>

                  </div>


                  <div className="tariff-admin-grid">

                    <div className="field">

                      <label>
                        Базовая цена, ₽
                      </label>

                      <input
                        name="basePriceRub"
                        inputMode="decimal"
                        defaultValue={
                          rubFromKopeks(
                            vehicle
                              .basePriceKopeks
                          )
                        }
                      />

                    </div>


                    <div className="field">

                      <label>
                        Минимальная цена, ₽
                      </label>

                      <input
                        name="minPriceRub"
                        inputMode="decimal"
                        defaultValue={
                          rubFromKopeks(
                            vehicle
                              .minPriceKopeks
                          )
                        }
                      />

                    </div>


                    <div className="field">

                      <label>
                        За 1 км за МКАД, ₽
                      </label>

                      <input
                        name="outsidePriceRub"
                        inputMode="decimal"
                        defaultValue={
                          rubFromKopeks(
                            vehicle
                              .outsidePriceKopeks
                          )
                        }
                      />

                    </div>


                    <div className="field">

                      <label>
                        Доплата за ТТК, ₽
                      </label>

                      <input
                        name="ttkSurchargeRub"
                        inputMode="decimal"
                        defaultValue={
                          rubFromKopeks(
                            vehicle
                              .ttkSurchargeKopeks
                          )
                        }
                      />

                    </div>


                    <div className="field">

                      <label>
                        Доп. точка, ₽
                      </label>

                      <input
                        name="extraPointPriceRub"
                        inputMode="decimal"
                        defaultValue={
                          rubFromKopeks(
                            vehicle
                              .extraPointPriceKopeks
                          )
                        }
                      />

                    </div>


                    <div className="field">

                      <label>
                        Доплата за перегруз, ₽
                      </label>

                      <input
                        name="overloadRub"
                        inputMode="decimal"
                        defaultValue={
                          rubFromKopeks(
                            vehicle
                              .overloadKopeks
                          )
                        }
                      />

                    </div>


                    <div className="field">

                      <label>
                        Коэффициент километража
                      </label>

                      <input
                        name="distanceMultiplier"
                        inputMode="decimal"
                        defaultValue={
                          Number(
                            vehicle
                              .distanceMultiplier
                          )
                        }
                      />

                    </div>

                  </div>


                  <div className="tariff-admin-actions">

                    <button
                      type="submit"
                      className="btn"
                    >
                      Сохранить тариф
                    </button>

                  </div>

                </form>
              );
            }
          )}

        </div>
      )}

    </div>
  );
}