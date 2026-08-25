import Link from 'next/link';

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


function parseOptionalNumber(
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
    return null;
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
      'Некорректное числовое значение'
    );
  }


  return number;
}


async function createVehicle(
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
      'Укажите название транспорта'
    );
  }


  const existing =
    await prisma.vehicleType.findUnique({
      where: {
        name,
      },
    });


  if (existing) {
    throw new Error(
      `Транспорт «${name}» уже существует`
    );
  }


  const imageKey =
    String(
      formData.get(
        'imageKey'
      ) ??
      'shalanda'
    ).trim();


  const allowedImages =
    [
      'gazelle-3m',
      'gazelle-6m',
      'shalanda',
      'manipulator-6m',
      'manipulator-katyusha',
    ];


  if (
    !allowedImages.includes(
      imageKey
    )
  ) {
    throw new Error(
      'Некорректное изображение транспорта'
    );
  }


  const maxPayloadTons =
    parseOptionalNumber(
      formData.get(
        'maxPayloadTons'
      )
    );


  const bodyLengthM =
    parseOptionalNumber(
      formData.get(
        'bodyLengthM'
      )
    );


  const bodyWidthM =
    parseOptionalNumber(
      formData.get(
        'bodyWidthM'
      )
    );


  const maxCargoLengthM =
    parseOptionalNumber(
      formData.get(
        'maxCargoLengthM'
      )
    );


  const sortOrderRaw =
    Number(
      String(
        formData.get(
          'sortOrder'
        ) ?? '0'
      )
    );


  const sortOrder =
    Number.isInteger(
      sortOrderRaw
    )
      ? sortOrderRaw
      : 0;


  const comment =
    String(
      formData.get(
        'comment'
      ) ?? ''
    ).trim();


  const isActive =
    formData.get(
      'isActive'
    ) ===
    'on';


  await prisma.vehicleType.create({
    data: {
      name,

      imageKey,

      maxPayloadTons,

      bodyLengthM,

      bodyWidthM,

      maxCargoLengthM,

      sortOrder,

      comment:
        comment ||
        null,

      isActive,
    },
  });


  revalidatePath(
    '/admin/transport'
  );


  revalidatePath(
    '/'
  );


  redirect(
    '/admin/transport'
  );
}


export default async function NewTransportPage() {
  try {
    await requireAdmin();
  } catch {
    redirect(
      '/login'
    );
  }


  const imageOptions =
    [
      {
        key:
          'gazelle-3m',

        label:
          'Газель 3 метра',

        src:
          '/vehicles/gazelle-3m.png',
      },

      {
        key:
          'gazelle-6m',

        label:
          'Газель 6 метров',

        src:
          '/vehicles/gazelle-6m.png',
      },

      {
        key:
          'shalanda',

        label:
          'Шаланда',

        src:
          '/vehicles/shalanda.png',
      },

      {
        key:
          'manipulator-6m',

        label:
          'Манипулятор',

        src:
          '/vehicles/manipulator-6m.png',
      },

      {
        key:
          'manipulator-katyusha',

        label:
          'Манипулятор с катюшей',

        src:
          '/vehicles/manipulator-katyusha.png',
      },
    ];


  return (
    <div
      style={{
        maxWidth:
          860,
      }}
    >

      <div
        style={{
          display:
            'flex',

          alignItems:
            'flex-start',

          justifyContent:
            'space-between',

          gap:
            20,

          marginBottom:
            20,
        }}
      >

        <div>

          <h1
            style={{
              margin:
                0,
            }}
          >
            Добавить транспорт
          </h1>


          <p className="sub">
            Создайте новый вид транспорта
            и выберите его изображение.
          </p>

        </div>


        <Link
          href="/admin/transport"
          className="btn secondary"
        >
          ← Назад
        </Link>

      </div>


      <form
        action={
          createVehicle
        }
        className="card"
        style={{
          padding:
            24,
        }}
      >

        <div
          style={{
            marginBottom:
              18,

            paddingBottom:
              16,

            borderBottom:
              '1px solid var(--line)',
          }}
        >

          <div
            style={{
              fontSize:
                14,

              fontWeight:
                720,
            }}
          >
            Основные параметры
          </div>


          <div
            style={{
              marginTop:
                4,

              color:
                '#918982',

              fontSize:
                10,
            }}
          >
            Название, изображение,
            грузоподъёмность и размеры.
          </div>

        </div>


        <div className="field">

          <label>
            Название транспорта *
          </label>

          <input
            name="name"
            required
            placeholder="Например, Газель 4 метра"
          />

        </div>


        <div className="field">

          <label>
            Изображение транспорта
          </label>


          <div
            style={{
              display:
                'grid',

              gridTemplateColumns:
                'repeat(auto-fit, minmax(150px, 1fr))',

              gap:
                10,

              marginTop:
                8,
            }}
          >

            {imageOptions.map(
              (
                option,
                index
              ) => (
                <label
                  key={
                    option.key
                  }
                  style={{
                    display:
                      'block',

                    padding:
                      10,

                    background:
                      '#fff',

                    border:
                      '1px solid var(--line)',

                    borderRadius:
                      10,

                    cursor:
                      'pointer',
                  }}
                >

                  <input
                    type="radio"
                    name="imageKey"
                    value={
                      option.key
                    }
                    defaultChecked={
                      index === 0
                    }
                    style={{
                      marginBottom:
                        8,
                    }}
                  />


                  <div
                    style={{
                      height:
                        92,

                      display:
                        'flex',

                      alignItems:
                        'center',

                      justifyContent:
                        'center',

                      overflow:
                        'hidden',

                      background:
                        '#faf8f6',

                      borderRadius:
                        8,
                    }}
                  >

                    <img
                      src={
                        option.src
                      }
                      alt={
                        option.label
                      }
                      style={{
                        width:
                          '100%',

                        height:
                          '100%',

                        objectFit:
                          'contain',
                      }}
                    />

                  </div>


                  <div
                    style={{
                      marginTop:
                        8,

                      fontSize:
                        10,

                      fontWeight:
                        650,

                      textAlign:
                        'center',
                    }}
                  >
                    {option.label}
                  </div>

                </label>
              )
            )}

          </div>

        </div>


        <div className="field">

          <label>
            Грузоподъёмность, т
          </label>

          <input
            name="maxPayloadTons"
            inputMode="decimal"
            placeholder="Например, 5"
          />

        </div>


        <div className="row">

          <div className="field">

            <label>
              Длина кузова, м
            </label>

            <input
              name="bodyLengthM"
              inputMode="decimal"
              placeholder="Например, 6"
            />

          </div>


          <div className="field">

            <label>
              Ширина кузова, м
            </label>

            <input
              name="bodyWidthM"
              inputMode="decimal"
              placeholder="Например, 2,4"
            />

          </div>

        </div>


        <div className="field">

          <label>
            Максимальная длина груза, м
          </label>

          <input
            name="maxCargoLengthM"
            inputMode="decimal"
            placeholder="Например, 12"
          />

        </div>


        <div className="field">

          <label>
            Порядок отображения
          </label>

          <input
            name="sortOrder"
            type="number"
            step="1"
            defaultValue="0"
          />

        </div>


        <div className="field">

          <label>
            Комментарий
          </label>

          <textarea
            name="comment"
            rows={
              3
            }
            placeholder="Необязательно"
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

            margin:
              '18px 0',

            padding:
              12,

            background:
              '#f8f5f2',

            border:
              '1px solid var(--line)',

            borderRadius:
              8,
          }}
        >

          <input
            type="checkbox"
            name="isActive"
            defaultChecked
          />


          <div>

            <div
              style={{
                fontSize:
                  11,

                fontWeight:
                  680,
              }}
            >
              Транспорт активен
            </div>


            <div
              style={{
                marginTop:
                  2,

                color:
                  '#918982',

                fontSize:
                  9,
              }}
            >
              Активный транспорт участвует
              в автоматическом подборе.
            </div>

          </div>

        </label>


        <div
          style={{
            display:
              'flex',

            gap:
              10,

            marginTop:
              22,
          }}
        >

          <button
            type="submit"
            className="btn"
          >
            Добавить транспорт
          </button>


          <Link
            href="/admin/transport"
            className="btn secondary"
          >
            Отмена
          </Link>

        </div>

      </form>

    </div>
  );
}