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

import {
  ServicePriceType,
} from '@prisma/client';


function parsePrice(
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


  return number;
}


function typeLabel(
  type: ServicePriceType
) {
  switch (
    type
  ) {
    case 'FIXED':
      return 'Фиксированная сумма';

    case 'HOURLY':
      return 'За час';

    case 'UNIT':
      return 'За единицу';

    case 'PERCENT':
      return 'Процент';

    default:
      return type;
  }
}


function priceSuffix(
  type: ServicePriceType
) {
  switch (
    type
  ) {
    case 'HOURLY':
      return '₽ / час';

    case 'UNIT':
      return '₽ / ед.';

    case 'PERCENT':
      return '%';

    default:
      return '₽';
  }
}


/*
 * ==========================================
 * ДОБАВЛЕНИЕ УСЛУГИ
 * ==========================================
 */
async function createService(
  formData: FormData
) {
  'use server';


  await requireAdmin();


  const name =
    String(
      formData.get(
        'name'
      ) ?? ''
    ).trim();


  if (!name) {
    throw new Error(
      'Укажите название услуги'
    );
  }


  const priceType =
    String(
      formData.get(
        'priceType'
      ) ??
      'FIXED'
    ) as ServicePriceType;


  const allowedTypes:
    ServicePriceType[] =
    [
      'FIXED',
      'HOURLY',
      'UNIT',
      'PERCENT',
    ];


  if (
    !allowedTypes.includes(
      priceType
    )
  ) {
    throw new Error(
      'Некорректный тип расчёта'
    );
  }


  const priceValue =
    parsePrice(
      formData.get(
        'priceValue'
      )
    );


  const isActive =
    formData.get(
      'isActive'
    ) ===
    'on';


  await prisma.additionalService.create({
    data: {
      name,
      priceType,
      priceValue,
      isActive,
    },
  });


  revalidatePath(
    '/admin/services'
  );


  revalidatePath(
    '/'
  );
}


/*
 * ==========================================
 * РЕДАКТИРОВАНИЕ УСЛУГИ
 * ==========================================
 */
async function updateService(
  id: string,
  formData: FormData
) {
  'use server';


  await requireAdmin();


  const service =
    await prisma.additionalService.findUnique({
      where: {
        id,
      },
    });


  if (!service) {
    throw new Error(
      'Услуга не найдена'
    );
  }


  const name =
    String(
      formData.get(
        'name'
      ) ?? ''
    ).trim();


  if (!name) {
    throw new Error(
      'Укажите название услуги'
    );
  }


  const priceType =
    String(
      formData.get(
        'priceType'
      ) ??
      'FIXED'
    ) as ServicePriceType;


  const allowedTypes:
    ServicePriceType[] =
    [
      'FIXED',
      'HOURLY',
      'UNIT',
      'PERCENT',
    ];


  if (
    !allowedTypes.includes(
      priceType
    )
  ) {
    throw new Error(
      'Некорректный тип расчёта'
    );
  }


  const priceValue =
    parsePrice(
      formData.get(
        'priceValue'
      )
    );


  const isActive =
    formData.get(
      'isActive'
    ) ===
    'on';


  await prisma.additionalService.update({
    where: {
      id,
    },

    data: {
      name,
      priceType,
      priceValue,
      isActive,
    },
  });


  revalidatePath(
    '/admin/services'
  );


  revalidatePath(
    '/'
  );
}


export default async function ServicesPage() {
  try {
    await requireAdmin();
  } catch {
    redirect(
      '/login'
    );
  }


  const services =
    await prisma.additionalService.findMany({
      orderBy: [
        {
          isActive:
            'desc',
        },

        {
          name:
            'asc',
        },
      ],
    });


  return (
    <div className="admin-section-page">

      {/*
       * ======================================
       * HEADER
       * ======================================
       */}
      <div className="admin-section-header">

        <div>

          <h1>
            Дополнительные услуги
          </h1>


          <p>
            Настройка дополнительных начислений,
            которые можно использовать
            при расчёте доставки.
          </p>

        </div>

      </div>


      {/*
       * ======================================
       * ДОБАВИТЬ УСЛУГУ
       * ======================================
       */}
      <form
        action={
          createService
        }
        className="card"
        style={{
          padding:
            22,

          marginBottom:
            18,
        }}
      >

        <div
          style={{
            display:
              'flex',

            alignItems:
              'center',

            gap:
              12,

            marginBottom:
              16,

            paddingBottom:
              14,

            borderBottom:
              '1px solid var(--line)',
          }}
        >

          <div
            style={{
              width:
                46,

              height:
                46,

              flex:
                '0 0 46px',

              display:
                'grid',

              placeItems:
                'center',

              color:
                '#6c5a50',

              background:
                '#f4efeb',

              border:
                '1px solid #e3dad4',

              borderRadius:
                10,

              fontSize:
                21,
            }}
          >
            +
          </div>


          <div>

            <div
              style={{
                fontSize:
                  14,

                fontWeight:
                  730,
              }}
            >
              Новая дополнительная услуга
            </div>


            <div
              style={{
                marginTop:
                  3,

                color:
                  '#928982',

                fontSize:
                  9,
              }}
            >
              Укажите название,
              способ расчёта и стоимость.
            </div>

          </div>

        </div>


        <div className="tariff-admin-grid">

          <div className="field">

            <label>
              Название услуги
            </label>

            <input
              name="name"
              required
              autoComplete="off"
              placeholder="Например, Простой"
            />

          </div>


          <div className="field">

            <label>
              Тип расчёта
            </label>

            <select
              name="priceType"
              defaultValue="FIXED"
            >

              <option value="FIXED">
                Фиксированная сумма
              </option>

              <option value="HOURLY">
                За час
              </option>

              <option value="UNIT">
                За единицу
              </option>

              <option value="PERCENT">
                Процент
              </option>

            </select>

          </div>


          <div className="field">

            <label>
              Цена / значение
            </label>

            <input
              name="priceValue"
              inputMode="decimal"
              required
              placeholder="Например, 2500"
            />

          </div>


          <label
            style={{
              display:
                'flex',

              alignItems:
                'center',

              gap:
                10,

              minHeight:
                40,

              margin:
                '13px 0',

              padding:
                '10px 12px',

              color:
                '#4c4642',

              background:
                '#f8f5f2',

              border:
                '1px solid var(--line)',

              borderRadius:
                7,

              fontSize:
                10,

              cursor:
                'pointer',
            }}
          >

            <input
              type="checkbox"
              name="isActive"
              defaultChecked
            />

            <span>
              Услуга активна
            </span>

          </label>

        </div>


        <div
          style={{
            display:
              'flex',

            justifyContent:
              'flex-end',

            marginTop:
              8,
          }}
        >

          <button
            type="submit"
            className="btn"
          >
            + Добавить услугу
          </button>

        </div>

      </form>


      {/*
       * ======================================
       * СПИСОК УСЛУГ
       * ======================================
       */}
      {services.length ===
      0 ? (
        <div className="card admin-empty-card">
          Дополнительные услуги пока не добавлены.
        </div>
      ) : (
        <div className="tariff-admin-list">

          {services.map(
            (
              service
            ) => {
              const updateAction =
                updateService.bind(
                  null,
                  service.id
                );


              return (
                <form
                  key={
                    service.id
                  }
                  action={
                    updateAction
                  }
                  className="card tariff-admin-card"
                >

                  {/*
                   * ===============================
                   * HEADER УСЛУГИ
                   * ===============================
                   */}
                  <div className="tariff-admin-card-header">

                    <div
                      style={{
                        width:
                          52,

                        height:
                          52,

                        flex:
                          '0 0 52px',

                        display:
                          'grid',

                        placeItems:
                          'center',

                        color:
                          '#705d52',

                        background:
                          '#f5f0ec',

                        border:
                          '1px solid #e3dad4',

                        borderRadius:
                          11,

                        fontSize:
                          20,
                      }}
                    >
                      ◇
                    </div>


                    <div
                      style={{
                        flex:
                          1,

                        minWidth:
                          0,
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
                          {service.name}
                        </h2>


                        <span
                          className={
                            service.isActive
                              ? 'vehicle-status active'
                              : 'vehicle-status inactive'
                          }
                        >
                          {service.isActive
                            ? 'Активна'
                            : 'Отключена'}
                        </span>

                      </div>


                      <div className="tariff-admin-meta">
                        {typeLabel(
                          service.priceType
                        )}
                      </div>

                    </div>


                    <div
                      style={{
                        marginLeft:
                          'auto',

                        textAlign:
                          'right',
                      }}
                    >

                      <div
                        style={{
                          color:
                            '#8d847d',

                          fontSize:
                            8,

                          textTransform:
                            'uppercase',

                          letterSpacing:
                            '0.04em',
                        }}
                      >
                        Стоимость
                      </div>


                      <div
                        style={{
                          marginTop:
                            3,

                          color:
                            '#332e2b',

                          fontSize:
                            18,

                          lineHeight:
                            1,

                          fontWeight:
                            780,
                        }}
                      >
                        {Number(
                          service.priceValue
                        ).toLocaleString(
                          'ru-RU',
                          {
                            maximumFractionDigits:
                              2,
                          }
                        )}
                      </div>


                      <div
                        style={{
                          marginTop:
                            3,

                          color:
                            '#8f8781',

                          fontSize:
                            8,
                        }}
                      >
                        {priceSuffix(
                          service.priceType
                        )}
                      </div>

                    </div>

                  </div>


                  {/*
                   * ===============================
                   * РЕДАКТИРОВАНИЕ
                   * ===============================
                   */}
                  <div
                    style={{
                      marginTop:
                        16,
                    }}
                  >

                    <div
                      style={{
                        marginBottom:
                          2,

                        color:
                          '#39332f',

                        fontSize:
                          11,

                        fontWeight:
                          720,
                      }}
                    >
                      Параметры услуги
                    </div>


                    <div
                      style={{
                        color:
                          '#938a84',

                        fontSize:
                          9,
                      }}
                    >
                      Изменения применяются
                      к новым расчётам.
                    </div>

                  </div>


                  <div className="tariff-admin-grid">

                    <div className="field">

                      <label>
                        Название
                      </label>

                      <input
                        name="name"
                        required
                        defaultValue={
                          service.name
                        }
                      />

                    </div>


                    <div className="field">

                      <label>
                        Тип расчёта
                      </label>

                      <select
                        name="priceType"
                        defaultValue={
                          service.priceType
                        }
                      >

                        <option value="FIXED">
                          Фиксированная сумма
                        </option>

                        <option value="HOURLY">
                          За час
                        </option>

                        <option value="UNIT">
                          За единицу
                        </option>

                        <option value="PERCENT">
                          Процент
                        </option>

                      </select>

                    </div>


                    <div className="field">

                      <label>
                        Цена / значение
                      </label>

                      <input
                        name="priceValue"
                        inputMode="decimal"
                        required
                        defaultValue={
                          Number(
                            service.priceValue
                          )
                        }
                      />

                    </div>


                    <label
                      style={{
                        display:
                          'flex',

                        alignItems:
                          'center',

                        gap:
                          10,

                        minHeight:
                          40,

                        margin:
                          '13px 0',

                        padding:
                          '10px 12px',

                        color:
                          '#4c4642',

                        background:
                          '#f8f5f2',

                        border:
                          '1px solid var(--line)',

                        borderRadius:
                          7,

                        fontSize:
                          10,

                        cursor:
                          'pointer',
                      }}
                    >

                      <input
                        type="checkbox"
                        name="isActive"
                        defaultChecked={
                          service.isActive
                        }
                      />

                      <span>
                        Активна
                      </span>

                    </label>

                  </div>


                  <div
                    style={{
                      marginTop:
                        5,

                      padding:
                        '10px 12px',

                      color:
                        '#766b64',

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

                    {service.priceType ===
                    'FIXED'
                      ? 'Фиксированная сумма добавляется к расчёту один раз.'
                      : service.priceType ===
                          'HOURLY'
                        ? 'Стоимость умножается на количество часов.'
                        : service.priceType ===
                            'UNIT'
                          ? 'Стоимость умножается на количество единиц.'
                          : 'Значение используется как процент.'}

                  </div>


                  <div className="tariff-admin-actions">

                    <button
                      type="submit"
                      className="btn"
                    >
                      Сохранить изменения
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