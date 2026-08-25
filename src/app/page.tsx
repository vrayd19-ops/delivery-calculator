import {
  redirect,
} from 'next/navigation';

import Calculator from '@/components/Calculator';

import {
  getCurrentUser,
} from '@/lib/auth';

export default async function Page() {
  const user =
    await getCurrentUser();

  /*
   * Если пользователь не вошёл —
   * отправляем на страницу входа.
   */
  if (!user) {
    redirect(
      '/login'
    );
  }

  /*
   * Авторизованный менеджер
   * получает доступ к калькулятору.
   */
  return (
    <Calculator />
  );
}