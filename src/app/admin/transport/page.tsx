import Link from 'next/link';

import {
  redirect,
} from 'next/navigation';

import {
  prisma,
} from '@/lib/db';

import {
  requireAdmin,
} from '@/lib/auth';


/*
 * ==========================================
 * КАРТИНКА ПО imageKey
 * ==========================================
 */

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
 * ==========================================
 * СТРАНИЦА ТРАНСПОРТА
 * ==========================================
 */

export default async function TransportPage() {
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
            Транспорт
          </h1>


          <p>
            Управление автомобилями,
            грузоподъёмностью и размерами.
          </p>

        </div>


        <Link
          href="/admin/transport/new"
          className="btn"
        >
          + Добавить транспорт
        </Link>

      </div>


      {vehicles.length ===
      0 ? (
        <div className="card admin-empty-card">
          Транспорт пока не добавлен.
        </div>
      ) : (
        <div className="vehicle-admin-grid">

          {vehicles.map(
            (
              vehicle
            ) => {
              const image =
                getVehicleImage(
                  vehicle.imageKey
                );


              return (
                <article
                  key={
                    vehicle.id
                  }
                  className="card vehicle-admin-card"
                  style={{
                    display:
                      'flex',

                    flexDirection:
                      'column',
                  }}
                >

                  {/*
                   * =================================
                   * ВЕРХ КАРТОЧКИ
                   * =================================
                   */}
                  <div
                    className="vehicle-admin-top"
                    style={{
                      alignItems:
                        'center',
                    }}
                  >

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
                      className="vehicle-admin-title"
                      style={{
                        minWidth:
                          0,
                      }}
                    >

                      <h2
                        style={{
                          marginBottom:
                            7,

                          fontSize:
                            15,

                          lineHeight:
                            1.25,
                        }}
                      >
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

                  </div>


                  {/*
                   * =================================
                   * ХАРАКТЕРИСТИКИ
                   * =================================
                   */}
                  <div
                    className="vehicle-admin-info"
                    style={{
                      marginTop:
                        17,
                    }}
                  >

                    <div>

                      <span>
                        Грузоподъёмность
                      </span>

                      <b>
                        {vehicle.maxPayloadTons
                          ? `${Number(
                              vehicle.maxPayloadTons
                            )} т`
                          : '—'}
                      </b>

                    </div>


                    <div>

                      <span>
                        Длина кузова
                      </span>

                      <b>
                        {vehicle.bodyLengthM
                          ? `${Number(
                              vehicle.bodyLengthM
                            )} м`
                          : '—'}
                      </b>

                    </div>


                    <div>

                      <span>
                        Ширина кузова
                      </span>

                      <b>
                        {vehicle.bodyWidthM
                          ? `${Number(
                              vehicle.bodyWidthM
                            )} м`
                          : '—'}
                      </b>

                    </div>


                    <div>

                      <span>
                        Макс. длина груза
                      </span>

                      <b>
                        {vehicle.maxCargoLengthM
                          ? `${Number(
                              vehicle.maxCargoLengthM
                            )} м`
                          : '—'}
                      </b>

                    </div>

                  </div>


                  {/*
                   * =================================
                   * КОММЕНТАРИЙ
                   * =================================
                   */}
                  {vehicle.comment && (
                    <div className="vehicle-admin-comment">
                      {vehicle.comment}
                    </div>
                  )}


                  {/*
                   * =================================
                   * НИЗ КАРТОЧКИ
                   * =================================
                   */}
                  <div
                    className="vehicle-admin-actions"
                    style={{
                      marginTop:
                        'auto',

                      paddingTop:
                        15,
                    }}
                  >

                    <Link
                      href={`/admin/transport/${vehicle.id}`}
                      className="btn secondary"
                    >
                      Редактировать
                    </Link>

                  </div>

                </article>
              );
            }
          )}

        </div>
      )}

    </div>
  );
}