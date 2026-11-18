"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";
import styles from "./login.module.css";

export default function LoginPage() {
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
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
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
              : "Не удалось войти. Проверьте email и пароль.";

        setError(message);
        return;
      }

      window.location.href = "/";
    } catch {
      setError("Не удалось подключиться к серверу. Попробуйте ещё раз.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className={styles.loginPage}>
      <section className={styles.loginPanel} aria-label="Вход в BRT">
        <div className={styles.panelGlow} aria-hidden="true" />

        <div className={styles.content}>
          <h1>Вход для менеджера</h1>

          <p className={styles.subtitle}>
            Войдите в аккаунт, чтобы пользоваться калькулятором доставки.
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
                autoComplete="current-password"
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
              className={styles.loginButton}
              type="submit"
              disabled={loading}
            >
              {loading ? "Входим..." : "Войти"}
            </button>

            <p className={styles.register}>
              Нет аккаунта?{" "}
              <Link href="/register">Зарегистрироваться</Link>
            </p>
          </form>
        </div>
      </section>
    </main>
  );
}
