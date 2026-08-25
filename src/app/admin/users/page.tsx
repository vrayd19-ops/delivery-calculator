import Link from 'next/link';

import {
  redirect,
} from 'next/navigation';

import {
  revalidatePath,
} from 'next/cache';

import bcrypt from 'bcryptjs';

import {
  prisma,
} from '@/lib/db';

import {
  requireAdmin,
} from '@/lib/auth';


async function createUser(
  formData: FormData
) {
  'use server';


  await requireAdmin();


  const email =
    String(
      formData.get(
        'email'
      ) ?? ''
    )
      .trim()
      .toLowerCase();


  const password =
    String(
      formData.get(
        'password'
      ) ?? ''
    );


  const role =
    String(
      formData.get(
        'role'
      ) ?? 'MANAGER'
    );


  if (!email) {
    throw new Error(
      'Укажите email'
    );
  }


  if (
    password.length <
    6
  ) {
    throw new Error(
      'Пароль должен содержать минимум 6 символов'
    );
  }


  if (
    role !==
      'ADMIN' &&
    role !==
      'MANAGER'
  ) {
    throw new Error(
      'Некорректная роль'
    );
  }


  const existing =
    await prisma.user.findUnique({
      where: {
        email,
      },
    });


  if (existing) {
    throw new Error(
      `Пользователь ${email} уже существует`
    );
  }


  const passwordHash =
    await bcrypt.hash(
      password,
      12
    );


  await prisma.user.create({
    data: {
      email,
      passwordHash,
      role,
    },
  });


  revalidatePath(
    '/admin/users'
  );
}


async function updateUser(
  id: string,
  formData: FormData
) {
  'use server';


  const currentAdmin =
    await requireAdmin();


  const user =
    await prisma.user.findUnique({
      where: {
        id,
      },
    });


  if (!user) {
    throw new Error(
      'Пользователь не найден'
    );
  }


  const email =
    String(
      formData.get(
        'email'
      ) ?? ''
    )
      .trim()
      .toLowerCase();


  const role =
    String(
      formData.get(
        'role'
      ) ?? 'MANAGER'
    );


  const newPassword =
    String(
      formData.get(
        'newPassword'
      ) ?? ''
    );


  if (!email) {
    throw new Error(
      'Укажите email'
    );
  }


  if (
    role !==
      'ADMIN' &&
    role !==
      'MANAGER'
  ) {
    throw new Error(
      'Некорректная роль'
    );
  }


  /*
   * Текущий администратор
   * не может случайно
   * лишить себя прав ADMIN.
   */
  if (
    currentAdmin.id ===
      id &&
    role !==
      'ADMIN'
  ) {
    throw new Error(
      'Нельзя убрать роль администратора у своей учётной записи'
    );
  }


  const sameEmail =
    await prisma.user.findFirst({
      where: {
        email,

        NOT: {
          id,
        },
      },
    });


  if (sameEmail) {
    throw new Error(
      `Email ${email} уже используется`
    );
  }


  let passwordHash:
    string |
    undefined =
    undefined;


  if (newPassword) {
    if (
      newPassword.length <
      6
    ) {
      throw new Error(
        'Новый пароль должен содержать минимум 6 символов'
      );
    }


    passwordHash =
      await bcrypt.hash(
        newPassword,
        12
      );
  }


  await prisma.user.update({
    where: {
      id,
    },

    data: {
      email,
      role,

      ...(passwordHash
        ? {
            passwordHash,
          }
        : {}),
    },
  });


  revalidatePath(
    '/admin/users'
  );


  revalidatePath(
    '/history'
  );
}


export default async function UsersPage() {
  const currentAdmin =
    await requireAdmin().catch(
      () => null
    );


  if (!currentAdmin) {
    redirect(
      '/login'
    );
  }


  const users =
    await prisma.user.findMany({
      orderBy: [
        {
          role:
            'asc',
        },

        {
          email:
            'asc',
        },
      ],

      include: {
        _count: {
          select: {
            calculations:
              true,
          },
        },
      },
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
            Пользователи
          </h1>


          <p>
            Управление администраторами
            и менеджерами системы.
          </p>

        </div>

      </div>


      {/*
       * ======================================
       * НОВЫЙ ПОЛЬЗОВАТЕЛЬ
       * ======================================
       */}
      <form
        action={
          createUser
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
                '#ffffff',

              background:
                'linear-gradient(145deg, #79675d, #5d4c43)',

              borderRadius:
                50,

              fontSize:
                18,

              fontWeight:
                700,
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
              Добавить пользователя
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
              Создайте учётную запись
              менеджера или администратора.
            </div>

          </div>

        </div>


        <div className="tariff-admin-grid">

          <div className="field">

            <label>
              Email
            </label>

            <input
              name="email"
              type="email"
              required
              autoComplete="off"
              placeholder="manager@company.ru"
            />

          </div>


          <div className="field">

            <label>
              Пароль
            </label>

            <input
              name="password"
              type="password"
              required
              minLength={
                6
              }
              autoComplete="new-password"
              placeholder="Минимум 6 символов"
            />

          </div>


          <div className="field">

            <label>
              Роль
            </label>

            <select
              name="role"
              defaultValue="MANAGER"
            >

              <option value="MANAGER">
                Менеджер
              </option>

              <option value="ADMIN">
                Администратор
              </option>

            </select>

          </div>

        </div>


        <div
          style={{
            marginTop:
              6,

            padding:
              '10px 12px',

            color:
              '#756b64',

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
          Менеджер видит только собственные
          расчёты. Администратор имеет доступ
          к управлению транспортом, тарифами,
          услугами и пользователями.
        </div>


        <div
          style={{
            display:
              'flex',

            justifyContent:
              'flex-end',

            marginTop:
              14,
          }}
        >

          <button
            type="submit"
            className="btn"
          >
            + Добавить пользователя
          </button>

        </div>

      </form>


      {/*
       * ======================================
       * СПИСОК ПОЛЬЗОВАТЕЛЕЙ
       * ======================================
       */}
      <div className="tariff-admin-list">

        {users.map(
          (
            user
          ) => {
            const updateAction =
              updateUser.bind(
                null,
                user.id
              );


            const isSelf =
              currentAdmin.id ===
              user.id;


            const isAdmin =
              user.role ===
              'ADMIN';


            const initial =
              user.email
                .charAt(
                  0
                )
                .toUpperCase();


            return (
              <form
                key={
                  user.id
                }
                action={
                  updateAction
                }
                className="card tariff-admin-card"
              >

                {/*
                 * ===============================
                 * HEADER
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
                        '#ffffff',

                      background:
                        isAdmin
                          ? 'linear-gradient(145deg, #79675d, #5d4c43)'
                          : 'linear-gradient(145deg, #9b918a, #746c66)',

                      borderRadius:
                        '50%',

                      fontSize:
                        16,

                      fontWeight:
                        760,
                    }}
                  >
                    {initial}
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
                        {user.email}
                      </h2>


                      <span
                        style={{
                          display:
                            'inline-flex',

                          padding:
                            '3px 7px',

                          color:
                            isAdmin
                              ? '#6b564b'
                              : '#596b61',

                          background:
                            isAdmin
                              ? '#f0e8e3'
                              : '#edf5ef',

                          borderRadius:
                            999,

                          fontSize:
                            8,

                          fontWeight:
                            720,
                        }}
                      >
                        {isAdmin
                          ? 'Администратор'
                          : 'Менеджер'}
                      </span>


                      {isSelf && (
                        <span
                          style={{
                            display:
                              'inline-flex',

                            padding:
                              '3px 7px',

                            color:
                              '#756a63',

                            background:
                              '#f4f1ee',

                            borderRadius:
                              999,

                            fontSize:
                              8,

                            fontWeight:
                              680,
                          }}
                        >
                          Вы
                        </span>
                      )}

                    </div>


                    <div className="tariff-admin-meta">

                      Создан:{' '}

                      {user.createdAt.toLocaleDateString(
                        'ru-RU'
                      )}

                    </div>

                  </div>


                  <div
                    style={{
                      minWidth:
                        90,

                      marginLeft:
                        'auto',

                      textAlign:
                        'right',
                    }}
                  >

                    <div
                      style={{
                        color:
                          '#918983',

                        fontSize:
                          8,

                        textTransform:
                          'uppercase',

                        letterSpacing:
                          '0.04em',
                      }}
                    >
                      Расчётов
                    </div>


                    <div
                      style={{
                        marginTop:
                          3,

                        color:
                          '#332e2b',

                        fontSize:
                          21,

                        lineHeight:
                          1,

                        fontWeight:
                          790,
                      }}
                    >
                      {
                        user
                          ._count
                          .calculations
                      }
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
                      color:
                        '#39332f',

                      fontSize:
                        11,

                      fontWeight:
                        720,
                    }}
                  >
                    Данные пользователя
                  </div>


                  <div
                    style={{
                      marginTop:
                        3,

                      color:
                        '#938a84',

                      fontSize:
                        9,
                    }}
                  >
                    Пароль изменится только
                    если заполнить поле
                    «Новый пароль».
                  </div>

                </div>


                <div className="tariff-admin-grid">

                  <div className="field">

                    <label>
                      Email
                    </label>

                    <input
                      name="email"
                      type="email"
                      required
                      defaultValue={
                        user.email
                      }
                    />

                  </div>


                  <div className="field">

                    <label>
                      Роль
                    </label>

                    <select
                      name="role"
                      defaultValue={
                        user.role
                      }
                    >

                      <option value="MANAGER">
                        Менеджер
                      </option>

                      <option value="ADMIN">
                        Администратор
                      </option>

                    </select>

                  </div>


                  <div className="field">

                    <label>
                      Новый пароль
                    </label>

                    <input
                      name="newPassword"
                      type="password"
                      minLength={
                        6
                      }
                      autoComplete="new-password"
                      placeholder="Не менять"
                    />

                  </div>

                </div>


                {isSelf && (
                  <div
                    style={{
                      marginTop:
                        5,

                      padding:
                        '10px 12px',

                      color:
                        '#765f38',

                      background:
                        '#fff9eb',

                      border:
                        '1px solid #eee0b7',

                      borderRadius:
                        7,

                      fontSize:
                        9,

                      lineHeight:
                        1.5,
                    }}
                  >
                    Это ваша текущая учётная запись.
                    Система не позволит убрать у неё
                    роль администратора.
                  </div>
                )}


                <div className="tariff-admin-actions">

                  <Link
                    href={`/history?manager=${user.id}`}
                    className="btn secondary"
                  >
                    Расчёты пользователя
                  </Link>


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

    </div>
  );
}