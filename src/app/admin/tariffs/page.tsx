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
      number * 100
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


function getVehicleImage(
  imageKey?: string | null
) {
  switch (
    imageKey
  ) {
    case 'gazelle-3m':
      return '/vehicles/gazelle-3m.png';

    case 'gazelle-6m':
      return '/vehicles/gazelle-6m.png';

    case 'manipulator-6m':
      return '/vehicles/manipulator-6m.png';

    case 'manipulator-katyusha':
      return '/vehicles/manipulator-katyusha.png';

    case 'shalanda':
      return '/vehicles/shalanda.png';

    default:
      return '/vehicles/shalanda.png';
  }
}


/*
 * =========================================
 * СОХРАНЕНИЕ ТАРИФА
 * =========================================
 */
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
      orderBy: [
        {
          sortOrder:
            'asc',
        },

        {
          name:
            'asc',
        },
      ],
    });


  return (
    <div className="admin-section-page">

      <div className="admin-section-header">

        <div>

          <h1>
            Тарифы
          </h1>


          <p>
            Настройка стоимости доставки
            отдельно для каждого вида транспорта.
          </p>

        </div>

      </div>


      {vehicles.length ===
      0 ? (
        <div className="card admin-empty-card">
          Сначала добавьте транспорт
          в разделе «Транспорт».
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


              const image =
                getVehicleImage(
                  vehicle.imageKey
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

                  {/*
                   * =================================
                   * ТРАНСПОРТ
                   * =================================
                   */}
                  <div className="tariff-admin-card-header">

                    <div
                      style={{
                        width:
                          132,

                        height:
                          96,

                        flex:
                          '0 0 132px',

                        display:
                          'flex',

                        alignItems:
                          'center',

                        justifyContent:
                          'center',

                        overflow:
                          'hidden',

                        padding:
                          5,

                        background:
                          '#ffffff',

                        border:
                          '1px solid #e5ded8',

                        borderRadius:
                          12,
                      }}
                    >

                      <img
                        src={
                          image
                        }
                        alt={
                          vehicle.name
                        }
                        style={{
                          display:
                            'block',

                          width:
                            '100%',

                          height:
                            '100%',

                          objectFit:
                            'contain',

                          objectPosition:
                            'center',
                        }}
                      />

                    </div>


                    <div
                      style={{
                        minWidth:
                          0,

                        flex:
                          1,
                      }}
                    >

                      <div
                        style={{
                          display:
                            'flex',

                          alignItems:
                            'center',

                          gap:
                            8,

                          flexWrap:
                            'wrap',
                        }}
                      >

                        <h2>
                          {vehicle.name}
                        </h2>


                        <span
                          className={
                            vehicle.isActive
                              ? 'vehicle-status active'
                              : 'vehicle-status inactive'
                          }
                        >
                          {vehicle.isActive
                            ? 'Активен'
                            : 'Отключён'}
                        </span>

                      </div>


                      <div className="tariff-admin-meta">

                        {vehicle.maxPayloadTons
                          ? `Грузоподъёмность ${Number(
                              vehicle.maxPayloadTons
                            )} т`
                          : 'Грузоподъёмность не указана'}

                        {' · '}

                        {vehicle.maxCargoLengthM
                          ? `груз до ${Number(
                              vehicle.maxCargoLengthM
                            )} м`
                          : 'длина груза не указана'}

                      </div>

                    </div>

                  </div>


                  {/*
                   * =================================
                   * ОСНОВНОЙ ТАРИФ
                   * =================================
                   */}
                  <div
                    style={{
                      marginTop:
                        17,
                    }}
                  >

                    <div
                      style={{
                        marginBottom:
                          3,

                        color:
                          '#39332f',

                        fontSize:
                          11,

                        fontWeight:
                          720,
                      }}
                    >
                      Основной тариф
                    </div>


                    <div
                      style={{
                        color:
                          '#938a84',

                        fontSize:
                          9,

                        lineHeight:
                          1.45,
                      }}
                    >
                      Основные значения,
                      используемые при расчёте доставки.
                    </div>

                  </div>


                  <div
                    className="tariff-admin-grid"
                    style={{
                      marginTop:
                        5,
                    }}
                  >

                    <div className="field">

                      <label>
                        Минимальная ставка, ₽
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
                        1 км за МКАД, ₽
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


                  {/*
                   * =================================
                   * ДОПОЛНИТЕЛЬНЫЕ НАЧИСЛЕНИЯ
                   * =================================
                   */}
                  <div
                    style={{
                      marginTop:
                        9,

                      paddingTop:
                        15,

                      borderTop:
                        '1px solid var(--line)',
                    }}
                  >

                    <div
                      style={{
                        marginBottom:
                          3,

                        color:
                          '#39332f',

                        fontSize:
                          11,

                        fontWeight:
                          720,
                      }}
                    >
                      Дополнительные начисления
                    </div>


                    <div
                      style={{
                        color:
                          '#938a84',

                        fontSize:
                          9,

                        lineHeight:
                          1.45,
                      }}
                    >
                      Применяются только
                      при соответствующих условиях маршрута.
                    </div>

                  </div>


                  <div className="tariff-admin-grid">

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
                        Дополнительная точка, ₽
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

                  </div>


                  <div
                    style={{
                      marginTop:
                        6,

                      padding:
                        '10px 12px',

                      color:
                        '#756a63',

                      background:
                        '#faf7f4',

                      border:
                        '1px solid #eee6e0',

                      borderRadius:
                        7,

                      fontSize:
                        9,

                      lineHeight:
                        1.5,
                    }}
                  >
                    Изменение тарифа применяется
                    только к новым расчётам.
                    Уже сохранённые расчёты
                    сохраняют старые тарифные значения.
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