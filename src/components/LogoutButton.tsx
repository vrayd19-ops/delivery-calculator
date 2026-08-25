'use client';

import {
  useState,
} from 'react';

import {
  useRouter,
} from 'next/navigation';


export default function LogoutButton() {
  const router =
    useRouter();

  const [
    loading,
    setLoading,
  ] = useState(false);


  async function logout() {
    setLoading(
      true
    );

    try {
      await fetch(
        '/api/auth/logout',
        {
          method:
            'POST',
        }
      );
    } finally {
      router.replace(
        '/login'
      );

      router.refresh();

      setLoading(
        false
      );
    }
  }


  return (
    <button
      type="button"
      className="btn secondary"

      disabled={
        loading
      }

      onClick={
        logout
      }

      style={{
        width:
          'auto',

        padding:
          '8px 12px',
      }}
    >
      {loading
        ? 'Выходим…'
        : 'Выйти'}
    </button>
  );
}