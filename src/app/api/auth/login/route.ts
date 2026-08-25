import {
  NextResponse,
} from 'next/server';

import {
  prisma,
} from '@/lib/db';

import {
  verifyPassword,
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
        body.email || ''
      )
        .trim()
        .toLowerCase();

    const password =
      String(
        body.password || ''
      );

    if (
      !email ||
      !password
    ) {
      return NextResponse.json(
        {
          error:
            'Укажите email и пароль',
        },
        {
          status: 400,
        }
      );
    }

    const user =
      await prisma.user.findUnique({
        where: {
          email,
        },
      });

    if (!user) {
      return NextResponse.json(
        {
          error:
            'Неверный email или пароль',
        },
        {
          status: 401,
        }
      );
    }

    const passwordOk =
      await verifyPassword(
        password,
        user.passwordHash
      );

    if (!passwordOk) {
      return NextResponse.json(
        {
          error:
            'Неверный email или пароль',
        },
        {
          status: 401,
        }
      );
    }

    await createSession({
      id:
        user.id,

      email:
        user.email,

      role:
        user.role,
    });

    return NextResponse.json({
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
    });
  } catch (
    error: any
  ) {
    console.error(
      'LOGIN ERROR:',
      error
    );

    return NextResponse.json(
      {
        error:
          error?.message ||
          'Не удалось выполнить вход',
      },
      {
        status: 500,
      }
    );
  }
}
