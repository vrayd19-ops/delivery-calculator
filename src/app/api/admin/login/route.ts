import {
  NextResponse,
} from 'next/server';

import bcrypt from 'bcryptjs';

import {
  prisma,
} from '@/lib/db';

import {
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
        body?.email ?? ''
      )
        .trim()
        .toLowerCase();


    const password =
      String(
        body?.password ?? ''
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
          status:
            400,
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
            'Неверный логин или пароль',
        },
        {
          status:
            401,
        }
      );
    }


    const passwordOk =
      await bcrypt.compare(
        password,
        user.passwordHash
      );


    if (!passwordOk) {
      return NextResponse.json(
        {
          error:
            'Неверный логин или пароль',
        },
        {
          status:
            401,
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
    });
  } catch (error) {
    console.error(
      'ADMIN LOGIN ERROR:',
      error
    );


    return NextResponse.json(
      {
        error:
          'Не удалось выполнить вход',
      },
      {
        status:
          500,
      }
    );
  }
}