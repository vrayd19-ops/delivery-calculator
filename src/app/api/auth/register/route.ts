import {
  NextResponse,
} from 'next/server';

import {
  prisma,
} from '@/lib/db';

import {
  hashPassword,
  createSession,
} from '@/lib/auth';


export async function POST(
  req: Request
) {
  try {
    const body =
      await req.json();


    const email =
      String(
        body?.email ??
        ''
      )
        .trim()
        .toLowerCase();


    const password =
      String(
        body?.password ??
        ''
      );


    /*
     * =====================================
     * ПРОВЕРКА EMAIL
     * =====================================
     */
    if (!email) {
      return NextResponse.json(
        {
          error:
            'Укажите email',
        },
        {
          status:
            400,
        }
      );
    }


    const emailLooksValid =
      /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(
        email
      );


    if (!emailLooksValid) {
      return NextResponse.json(
        {
          error:
            'Укажите корректный email',
        },
        {
          status:
            400,
        }
      );
    }


    /*
     * =====================================
     * ПРОВЕРКА ПАРОЛЯ
     * =====================================
     */
    if (!password) {
      return NextResponse.json(
        {
          error:
            'Укажите пароль',
        },
        {
          status:
            400,
        }
      );
    }


    if (
      password.length <
      6
    ) {
      return NextResponse.json(
        {
          error:
            'Пароль должен содержать минимум 6 символов',
        },
        {
          status:
            400,
        }
      );
    }


    /*
     * =====================================
     * ПРОВЕРЯЕМ, НЕТ ЛИ УЖЕ
     * ТАКОГО ПОЛЬЗОВАТЕЛЯ
     * =====================================
     */
    const existingUser =
      await prisma.user.findUnique({
        where: {
          email,
        },
      });


    if (existingUser) {
      return NextResponse.json(
        {
          error:
            'Пользователь с таким email уже зарегистрирован',
        },
        {
          status:
            409,
        }
      );
    }


    /*
     * =====================================
     * ХЭШИРУЕМ ПАРОЛЬ
     * =====================================
     */
    const passwordHash =
      await hashPassword(
        password
      );


    /*
     * =====================================
     * СОЗДАЁМ ПОЛЬЗОВАТЕЛЯ
     *
     * ВАЖНО:
     * через публичную регистрацию
     * всегда создаём только MANAGER.
     *
     * ADMIN можно назначить
     * только через админ-панель.
     * =====================================
     */
    const user =
      await prisma.user.create({
        data: {
          email,

          passwordHash,

          role:
            'MANAGER',
        },
      });


    /*
     * =====================================
     * СРАЗУ АВТОРИЗУЕМ
     * НОВОГО ПОЛЬЗОВАТЕЛЯ
     * =====================================
     */
    await createSession({
      id:
        user.id,

      email:
        user.email,

      role:
        user.role,
    });


    return NextResponse.json(
      {
        ok:
          true,

        user: {
          id:
            user.id,

          email:
            user.email,

          role:
            user.role,
        },
      },
      {
        status:
          201,
      }
    );
  } catch (
    error: any
  ) {
    console.error(
      'REGISTER ERROR:',
      error
    );


    return NextResponse.json(
      {
        error:
          error?.message ||
          'Не удалось зарегистрироваться',
      },
      {
        status:
          500,
      }
    );
  }
}