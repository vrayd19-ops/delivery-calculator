import {
  cookies,
} from 'next/headers';

import {
  SignJWT,
  jwtVerify,
} from 'jose';

import bcrypt from 'bcryptjs';

import {
  prisma,
} from './db';


const SESSION_COOKIE =
  'delivery_session';

const SESSION_TTL_SECONDS =
  60 * 60 * 24 * 30;


/*
 * Секрет для подписи сессии.
 */
function getSecret() {
  const secret =
    process.env.AUTH_SECRET;

  if (!secret) {
    throw new Error(
      'Не задан AUTH_SECRET'
    );
  }

  return new TextEncoder().encode(
    secret
  );
}


/*
 * Хеширование пароля
 * перед сохранением в БД.
 */
export async function hashPassword(
  password: string
) {
  return bcrypt.hash(
    password,
    12
  );
}


/*
 * Проверка пароля при входе.
 */
export async function verifyPassword(
  password: string,
  passwordHash: string
) {
  return bcrypt.compare(
    password,
    passwordHash
  );
}


/*
 * Создание сессии после
 * регистрации или входа.
 */
export async function createSession(
  user: {
    id: string;
    email: string;
    role: string;
  }
) {
  const token =
    await new SignJWT({
      email:
        user.email,

      role:
        user.role,
    })
      .setProtectedHeader({
        alg:
          'HS256',
      })
      .setSubject(
        user.id
      )
      .setIssuedAt()
      .setExpirationTime(
        `${SESSION_TTL_SECONDS}s`
      )
      .sign(
        getSecret()
      );

  const cookieStore =
    await cookies();

  cookieStore.set(
    SESSION_COOKIE,
    token,
    {
      httpOnly:
        true,

      sameSite:
        'lax',

      secure:
        process.env.NODE_ENV ===
        'production',

      path:
        '/',

      maxAge:
        SESSION_TTL_SECONDS,
    }
  );
}


/*
 * Выход из аккаунта.
 */
export async function deleteSession() {
  const cookieStore =
    await cookies();

  cookieStore.delete(
    SESSION_COOKIE
  );
}


/*
 * Читаем текущую сессию.
 */
export async function getSession() {
  try {
    const cookieStore =
      await cookies();

    const token =
      cookieStore.get(
        SESSION_COOKIE
      )?.value;

    if (!token) {
      return null;
    }

    const verified =
      await jwtVerify(
        token,
        getSecret()
      );

    return {
      userId:
        verified.payload.sub ||
        null,

      email:
        typeof verified.payload
          .email ===
          'string'
          ? verified.payload.email
          : null,

      role:
        typeof verified.payload
          .role ===
          'string'
          ? verified.payload.role
          : null,
    };
  } catch {
    return null;
  }
}


/*
 * Получаем пользователя
 * из базы по текущей сессии.
 */
export async function getCurrentUser() {
  const session =
    await getSession();

  if (
    !session?.userId
  ) {
    return null;
  }

  return prisma.user.findUnique({
    where: {
      id:
        session.userId,
    },
  });
}


/*
 * Страница/API только
 * для авторизованных пользователей.
 */
export async function requireUser() {
  const user =
    await getCurrentUser();

  if (!user) {
    throw new Error(
      'UNAUTHORIZED'
    );
  }

  return user;
}


/*
 * Страница/API только
 * для администратора.
 */
export async function requireAdmin() {
  const user =
    await requireUser();

  if (
    user.role !==
    'ADMIN'
  ) {
    throw new Error(
      'FORBIDDEN'
    );
  }

  return user;
}