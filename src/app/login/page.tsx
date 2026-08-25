'use client';

import {
  useState,
} from 'react';

import {
  useRouter,
} from 'next/navigation';


export default function LoginPage() {
  const router =
    useRouter();

  const [
    email,
    setEmail,
  ] = useState('');

  const [
    password,
    setPassword,
  ] = useState('');

  const [
    loading,
    setLoading,
  ] = useState(false);

  const [
    error,
    setError,
  ] = useState('');


  async function submit() {
    if (
      !email.trim() ||
      !password
    ) {
      setError(
        'Укажите email и пароль'
      );

      return;
    }

    setLoading(
      true
    );

    setError('');

    try {
      const response =
        await fetch(
          '/api/auth/login',
          {
            method:
              'POST',

            headers: {
              'content-type':
                'application/json',
            },

            body:
              JSON.stringify({
                email:
                  email
                    .trim()
                    .toLowerCase(),

                password,
              }),
          }
        );

      const data =
        await response.json();

      if (
        !response.ok
      ) {
        setLoading(
          false
        );

        setError(
          data.error ||
          'Не удалось войти'
        );

        return;
      }

      /*
       * После успешного входа
       * отправляем менеджера
       * на калькулятор.
       */
      router.replace(
        '/'
      );

      router.refresh();
    } catch (
      error: any
    ) {
      setLoading(
        false
      );

      setError(
        error?.message ||
        'Ошибка входа'
      );
    }
  }


  return (
    <div
      style={{
        maxWidth:
          460,

        margin:
          '60px auto',
      }}
    >
      <div className="card">

        <h1>
          Вход для менеджера
        </h1>

        <p className="sub">
          Войдите в аккаунт,
          чтобы пользоваться
          калькулятором доставки.
        </p>


        <div className="field">
          <label>
            Email
          </label>

          <input
            type="email"

            value={
              email
            }

            onChange={(
              event
            ) =>
              setEmail(
                event
                  .target
                  .value
              )
            }

            placeholder="manager@company.ru"

            onKeyDown={(
              event
            ) => {
              if (
                event.key ===
                'Enter'
              ) {
                submit();
              }
            }}
          />
        </div>


        <div className="field">
          <label>
            Пароль
          </label>

          <input
            type="password"

            value={
              password
            }

            onChange={(
              event
            ) =>
              setPassword(
                event
                  .target
                  .value
              )
            }

            placeholder="Введите пароль"

            onKeyDown={(
              event
            ) => {
              if (
                event.key ===
                'Enter'
              ) {
                submit();
              }
            }}
          />
        </div>


        {error && (
          <div className="warn">
            {error}
          </div>
        )}


        <button
          className="btn"

          disabled={
            loading
          }

          onClick={
            submit
          }
        >
          {loading
            ? 'Входим…'
            : 'Войти'}
        </button>


        <div
          style={{
            marginTop:
              18,
          }}
        >
          Нет аккаунта?{' '}

          <a href="/register">
            Зарегистрироваться
          </a>
        </div>

      </div>
    </div>
  );
}