'use client';

import {
  useEffect,
  useState,
} from 'react';

import type {
  AddressPoint,
} from '@/lib/types';

export default function AddressInput({
  label,
  value,
  onChange,
}: {
  label: string;
  value?: AddressPoint;
  onChange: (
    value: AddressPoint | undefined
  ) => void;
}) {
  const [
    query,
    setQuery,
  ] = useState(
    value?.displayAddress || ''
  );

  const [
    items,
    setItems,
  ] = useState<any[]>([]);

  useEffect(() => {
    setQuery(
      value?.displayAddress || ''
    );
  }, [
    value?.displayAddress,
  ]);

  useEffect(() => {
    const timer =
      setTimeout(
        async () => {
          const trimmed =
            query.trim();

          if (
            trimmed.length < 3 ||
            trimmed ===
              value?.displayAddress
          ) {
            setItems([]);
            return;
          }

          try {
            const response =
              await fetch(
                '/api/suggest?q=' +
                  encodeURIComponent(
                    trimmed
                  )
              );

            if (!response.ok) {
              setItems([]);
              return;
            }

            const data =
              await response.json();

            setItems(
              Array.isArray(data)
                ? data
                : []
            );
          } catch {
            setItems([]);
          }
        },
        350
      );

    return () =>
      clearTimeout(timer);
  }, [
    query,
    value?.displayAddress,
  ]);

  async function pick(
    item: any
  ) {
    const response =
      await fetch(
        '/api/geocode',
        {
          method: 'POST',

          headers: {
            'content-type':
              'application/json',
          },

          body:
            JSON.stringify({
              uri:
                item.uri,

              text:
                item.address ||
                item.title,
            }),
        }
      );

    const data =
      await response.json();

    if (
      response.ok &&
      data?.[0]
    ) {
      onChange(
        data[0]
      );

      setQuery(
        data[0].displayAddress
      );

      setItems([]);
    }
  }

  function handleInputChange(
    text: string
  ) {
    setQuery(text);

    /*
     * Если пользователь вручную
     * изменил уже выбранный адрес,
     * старые координаты больше
     * нельзя использовать.
     */
    if (
      value &&
      text !==
        value.displayAddress
    ) {
      onChange(
        undefined
      );
    }
  }

  return (
    <div className="field relative">
      <label>
        {label}
      </label>

      <input
        value={query}
        onChange={(
          event
        ) =>
          handleInputChange(
            event.target.value
          )
        }
        placeholder="Начните вводить адрес…"
      />

      {items.length > 0 && (
        <div className="suggestions">
          {items
            .slice(
              0,
              6
            )
            .map(
              (
                item,
                index
              ) => (
                <button
                  type="button"
                  key={
                    index
                  }
                  onClick={() =>
                    pick(
                      item
                    )
                  }
                >
                  <b>
                    {
                      item.title
                    }
                  </b>

                  <div className="tiny">
                    {
                      item.address ||
                      item.subtitle
                    }
                  </div>
                </button>
              )
            )}
        </div>
      )}
    </div>
  );
}