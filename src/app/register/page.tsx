"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";
import styles from "./register.module.css";

export default function RegisterPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (loading) return;

    setError("");
    setLoading(true);

    try {
      const response = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          email: email.trim(),
          password,
        }),
      });

      let payload: Record<string, unknown> = {};
      try {
        payload = await response.json();
      } catch {
        payload = {};
      }

      if (!response.ok) {
        const message =
          typeof payload.error === "string"
            ? payload.error
            : typeof payload.message === "string"
              ? payload.message
              : "Не удалось зарегистрироваться.";

        setError(message);
        return;
      }

      window.location.assign("/");
    } catch {
      setError("Не удалось подключиться к серверу. Попробуйте ещё раз.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className={styles.page}>
      <section className={styles.panel}>
        <div className={styles.inner}>
          <h1 className={styles.title}>Регистрация менеджера</h1>

          <p className={styles.subtitle}>
            Создайте аккаунт, чтобы рассчитывать и сохранять доставки.
          </p>

          <form className={styles.form} onSubmit={handleSubmit}>
            <label className={styles.field}>
              <span>Email</span>
              <input
                type="email"
                name="email"
                autoComplete="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                required
              />
            </label>

            <label className={styles.field}>
              <span>Пароль</span>
              <input
                type="password"
                name="password"
                autoComplete="new-password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                required
              />
            </label>

            {error ? (
              <div className={styles.error} role="alert">
                {error}
              </div>
            ) : null}

            <button
              className={styles.button}
              type="submit"
              disabled={loading}
            >
              {loading ? "Регистрируем..." : "Зарегистрироваться"}
            </button>

            <p className={styles.login}>
              Уже есть аккаунт? <Link href="/login">Войти</Link>
            </p>
          </form>
        </div>
      </section>
    </main>
  );
}
