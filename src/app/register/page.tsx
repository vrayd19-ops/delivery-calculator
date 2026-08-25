'use client';

import {
  useState,
} from 'react';

import {
  useRouter,
} from 'next/navigation';

export default function RegisterPage() {
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
    setLoading(true);
    setError('');

    try {
      const response =
        await fetch(
          '/api/auth/register',
          {
            method:
              'POST',

            headers: {
              'content-type':
                'application/json',
            },

            body:
              JSON.stringify({
                email,
                password,
              }),
          }
        );

      const data =
        await response.json();

      setLoading(false);

      if (!response.ok) {
        setError(
          data.error ||
          'Не удалось зарегистрироваться'
        );

        return;
      }

      router.push('/');
      router.refresh();
    } catch (
      error: any
    ) {
      setLoading(false);

      setError(
        error?.message ||
        'Ошибка регистрации'
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
          Регистрация менеджера
        </h1>

        <p className="sub">
          Создайте аккаунт,
          чтобы рассчитывать
          и сохранять доставки.
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
            placeholder="Минимум 6 символов"
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
            ? 'Создаём аккаунт…'
            : 'Зарегистрироваться'}
        </button>

        <div
          style={{
            marginTop:
              16,
          }}
        >
          Уже есть аккаунт?{' '}

          <a href="/login">
            Войти
          </a>
        </div>
      </div>
    </div>
  );
}