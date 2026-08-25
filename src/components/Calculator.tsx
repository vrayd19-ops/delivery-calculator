'use client';

import {
  useState,
} from 'react';

import AddressInput from './AddressInput';
import YandexMap from './YandexMap';

import type {
  AddressPoint,
} from '@/lib/types';


const rub = (
  kopeks: any
) =>
  new Intl.NumberFormat(
    'ru-RU',
    {
      style:
        'currency',

      currency:
        'RUB',

      maximumFractionDigits:
        0,
    }
  ).format(
    Number(
      kopeks ||
        0
    ) / 100
  );


function cargoTypeLabel(
  cargoType: string
) {
  switch (
    cargoType
  ) {
    case 'арматура':
      return 'Арматура';

    case 'труба':
      return 'Труба';

    case 'балка':
      return 'Балка';

    case 'лист':
      return 'Лист';

    case 'профнастил':
      return 'Профнастил';

    case 'сэндвич панель':
      return 'Сэндвич-панель';

    case 'уголки':
      return 'Уголки';

    case 'швеллер':
      return 'Швеллер';

    default:
      return 'Другое';
  }
}


export default function Calculator() {
  /*
   * ВАЖНО:
   *
   * при первом открытии здесь
   * ТОЛЬКО две точки:
   *
   * 0 — погрузка
   * 1 — доставка
   *
   * Дополнительных точек
   * изначально нет.
   */
  const [
    points,
    setPoints,
  ] = useState<
    (
      AddressPoint |
      undefined
    )[]
  >([
    undefined,
    undefined,
  ]);


  const [
    cargoType,
    setCargoType,
  ] = useState(
    ''
  );


  const [
    needsConics,
    setNeedsConics,
  ] = useState(
    false
  );


  const [
    weight,
    setWeight,
  ] = useState(
    ''
  );


  const [
    cargoLength,
    setCargoLength,
  ] = useState(
    ''
  );


  const [
    comment,
    setComment,
  ] = useState(
    ''
  );


  const [
    result,
    setResult,
  ] = useState<any>(
    undefined
  );


  const [
    loading,
    setLoading,
  ] = useState(
    false
  );


  const [
    error,
    setError,
  ] = useState(
    ''
  );


  function clearResult() {
    setResult(
      undefined
    );

    setError(
      ''
    );
  }


  /*
   * Изменение адреса.
   */
  function setPoint(
    index: number,
    point:
      AddressPoint |
      undefined
  ) {
    setPoints(
      (
        previous
      ) =>
        previous.map(
          (
            current,
            currentIndex
          ) =>
            currentIndex ===
            index
              ? point
              : current
        )
    );


    clearResult();
  }


  /*
   * Добавляем доп. точку
   * непосредственно перед
   * адресом доставки.
   */
  function addExtraPoint() {
    setPoints(
      (
        previous
      ) => [
        ...previous.slice(
          0,
          -1
        ),

        undefined,

        previous[
          previous.length -
            1
        ],
      ]
    );


    clearResult();
  }


  /*
   * Удаление дополнительной точки.
   *
   * Погрузку и доставку
   * удалить невозможно.
   */
  function removeExtraPoint(
    index: number
  ) {
    if (
      index <= 0 ||
      index >=
        points.length -
          1
    ) {
      return;
    }


    setPoints(
      (
        previous
      ) =>
        previous.filter(
          (
            _,
            currentIndex
          ) =>
            currentIndex !==
            index
        )
    );


    clearResult();
  }


  /*
   * Поддерживаем:
   *
   * 8,5
   * 8.5
   */
  function parseNumber(
    value: string
  ) {
    return Number(
      value
        .trim()
        .replace(
          ',',
          '.'
        )
    );
  }


  /*
   * Проверка введённых данных.
   */
  function validate() {
    if (
      points.some(
        (
          point
        ) =>
          !point
      )
    ) {
      setError(
        'Укажите все точки маршрута.'
      );

      return false;
    }


    if (
      !cargoType
    ) {
      setError(
        'Выберите, что именно везём.'
      );

      return false;
    }


    const parsedWeight =
      parseNumber(
        weight
      );


    if (
      !Number.isFinite(
        parsedWeight
      ) ||
      parsedWeight <=
        0
    ) {
      setError(
        'Укажите корректный вес груза.'
      );

      return false;
    }


    const parsedLength =
      parseNumber(
        cargoLength
      );


    if (
      !Number.isFinite(
        parsedLength
      ) ||
      parsedLength <=
        0
    ) {
      setError(
        'Укажите корректную длину груза.'
      );

      return false;
    }


    return true;
  }


  /*
   * ==========================================
   * РАСЧЁТ
   * ==========================================
   */
  async function calc() {
    if (
      !validate()
    ) {
      return;
    }


    const parsedWeight =
      parseNumber(
        weight
      );


    const parsedLength =
      parseNumber(
        cargoLength
      );


    setLoading(
      true
    );

    setError(
      ''
    );


    try {
      const response =
        await fetch(
          '/api/calculate-auto',
          {
            method:
              'POST',

            headers: {
              'content-type':
                'application/json',
            },

            body:
              JSON.stringify({
                points,

                cargoType,

                cargoWeightTons:
                  parsedWeight,

                cargoLengthM:
                  parsedLength,

                needsConics,

                comment,

                services:
                  [],
              }),
          }
        );


      /*
       * Читаем сначала как текст,
       * чтобы корректно обработать
       * даже не-JSON ошибку сервера.
       */
      const text =
        await response.text();


      let data: any =
        {};


      if (
        text
      ) {
        try {
          data =
            JSON.parse(
              text
            );
        } catch {
          throw new Error(
            `Сервер вернул некорректный ответ: ${text.slice(
              0,
              200
            )}`
          );
        }
      }


      if (
        response.status ===
        401
      ) {
        window.location.href =
          '/login';

        return;
      }


      if (
        !response.ok
      ) {
        throw new Error(
          data?.error ||
          `Ошибка расчёта (${response.status})`
        );
      }


      setResult(
        data
      );
    } catch (
      error: any
    ) {
      console.error(
        'CALCULATOR ERROR:',
        error
      );


      setError(
        error?.message ||
        'Не удалось выполнить расчёт доставки.'
      );
    } finally {
      setLoading(
        false
      );
    }
  }


  return (
    <div className="calculator-dashboard">

      {/*
       * ==========================================
       * ЛЕВАЯ ЧАСТЬ
       * ==========================================
       */}
      <section className="calculator-left">

        <div className="card calculator-form-card">

          <div className="form-card-title">
            Параметры доставки
          </div>


          {/*
           * ПОГРУЗКА
           */}
          <AddressInput
            label="Откуда"
            value={
              points[0]
            }
            onChange={(
              point
            ) =>
              setPoint(
                0,
                point
              )
            }
          />


          {/*
           * ДОПОЛНИТЕЛЬНЫЕ ТОЧКИ
           *
           * При points.length === 2
           * этот блок пустой.
           */}
          {points
            .slice(
              1,
              -1
            )
            .map(
              (
                point,
                index
              ) => {
                const realIndex =
                  index +
                  1;


                return (
                  <div
                    className="extra-point-wrap"
                    key={
                      `extra-${realIndex}`
                    }
                  >

                    <AddressInput
                      label={`Доп. точка ${
                        index +
                        1
                      }`}
                      value={
                        point
                      }
                      onChange={(
                        value
                      ) =>
                        setPoint(
                          realIndex,
                          value
                        )
                      }
                    />


                    <button
                      type="button"
                      className="remove-point-button"
                      title="Удалить точку"
                      aria-label={`Удалить дополнительную точку ${
                        index +
                        1
                      }`}
                      onClick={
                        () =>
                          removeExtraPoint(
                            realIndex
                          )
                      }
                    >
                      ×
                    </button>

                  </div>
                );
              }
            )}


          {/*
           * ДОСТАВКА
           */}
          <AddressInput
            label="Куда"
            value={
              points[
                points.length -
                  1
              ]
            }
            onChange={(
              point
            ) =>
              setPoint(
                points.length -
                  1,
                point
              )
            }
          />


          {/*
           * ДОБАВЛЕНИЕ ТОЧКИ
           */}
          <button
            className="btn secondary add-point-button"
            type="button"
            onClick={
              addExtraPoint
            }
          >
            <span>
              +
            </span>

            Добавить точку
          </button>


          {/*
           * ==========================================
           * ЧТО ВЕЗЁМ
           * ==========================================
           */}
          <div className="field">

            <label>
              Что везём
            </label>

            <select
              value={
                cargoType
              }
              onChange={(
                event
              ) => {
                setCargoType(
                  event
                    .target
                    .value
                );

                clearResult();
              }}
            >

              <option value="">
                Выберите тип груза
              </option>


              <option value="арматура">
                Арматура
              </option>


              <option value="труба">
                Труба
              </option>


              <option value="балка">
                Балка
              </option>


              <option value="лист">
                Лист
              </option>


              <option value="профнастил">
                Профнастил
              </option>


              <option value="сэндвич панель">
                Сэндвич-панель
              </option>


              <option value="уголки">
                Уголки
              </option>


              <option value="швеллер">
                Швеллер
              </option>


              <option value="другое">
                Другое
              </option>

            </select>

          </div>


          {/*
           * ==========================================
           * ВЕС / ДЛИНА
           * ==========================================
           */}
          <div className="row">

            <div className="field">

              <label>
                Вес груза, т
              </label>

              <input
                inputMode="decimal"
                value={
                  weight
                }
                onChange={(
                  event
                ) => {
                  setWeight(
                    event
                      .target
                      .value
                  );

                  clearResult();
                }}
                placeholder="8,5"
              />

            </div>


            <div className="field">

              <label>
                Длина, м
              </label>

              <input
                inputMode="decimal"
                value={
                  cargoLength
                }
                onChange={(
                  event
                ) => {
                  setCargoLength(
                    event
                      .target
                      .value
                  );

                  clearResult();
                }}
                placeholder="11,7"
              />

            </div>

          </div>


          {/*
           * ==========================================
           * КОНИКИ
           * ==========================================
           */}
          <div className="field">

            <label>
              Коники
            </label>

            <select
              value={
                needsConics
                  ? 'yes'
                  : 'no'
              }
              onChange={(
                event
              ) => {
                setNeedsConics(
                  event
                    .target
                    .value ===
                    'yes'
                );

                clearResult();
              }}
            >

              <option value="no">
                Не нужны
              </option>

              <option value="yes">
                Нужны
              </option>

            </select>


            {needsConics && (
              <div className="inline-note">
                Перевозка негабаритного груза:
                {' '}
                + 2 000 ₽ до начисления 22%.
              </div>
            )}

          </div>


          {/*
           * ==========================================
           * КОММЕНТАРИЙ
           * ==========================================
           */}
          <div className="field">

            <label>
              Комментарий
            </label>

            <textarea
              value={
                comment
              }
              onChange={(
                event
              ) =>
                setComment(
                  event
                    .target
                    .value
                )
              }
              placeholder="Необязательно"
              rows={
                3
              }
            />

          </div>


          {/*
           * ==========================================
           * КРАТКИЙ РЕЗУЛЬТАТ В ФОРМЕ
           * ==========================================
           */}
          {result && (
            <div className="form-summary">

              <div className="form-summary-row">

                <span>
                  Транспорт
                </span>

                <b>
                  {
                    result
                      .vehicle
                      .name
                  }
                </b>

              </div>


              <div className="form-summary-row">

                <span>
                  Расстояние
                </span>

                <b>
                  {Number(
                    result
                      .totalDistanceKm
                  ).toFixed(
                    0
                  )}{' '}
                  км
                </b>

              </div>


              <div className="form-summary-row">

                <span>
                  За МКАД
                </span>

                <b>
                  {
                    result
                      .billableDistanceKm
                  }{' '}
                  км
                </b>

              </div>

            </div>
          )}


          {/*
           * ОШИБКА
           */}
          {error && (
            <div className="warn">
              {error}
            </div>
          )}


          {/*
           * ==========================================
           * РАССЧИТАТЬ
           * ==========================================
           */}
          <button
            className="btn full form-submit"
            type="button"
            disabled={
              loading
            }
            onClick={
              calc
            }
          >
            {loading
              ? 'Строим маршрут и рассчитываем…'
              : 'Рассчитать доставку →'}
          </button>


          <div className="form-api-note">
            Маршрут строится
            по бесплатным дорогам
          </div>

        </div>

      </section>


      {/*
       * ==========================================
       * ПРАВАЯ ЧАСТЬ
       * ==========================================
       */}
      <section className="calculator-right">

        {/*
         * КАРТА
         */}
        <div className="map-card">

          <YandexMap
            route={
              result?.route
            }
            points={
              points.filter(
                Boolean
              ) as AddressPoint[]
            }
          />

        </div>


        {/*
         * ==========================================
         * СТОИМОСТЬ ПОЯВЛЯЕТСЯ
         * ТОЛЬКО ПОСЛЕ РАСЧЁТА
         * ==========================================
         */}
        {result && (
          <div className="card result">

            <div className="result-top">

              <div>

                <div className="result-title">
                  Стоимость доставки
                </div>


                <div className="total">
                  {rub(
                    result
                      .totalKopeks
                  )}
                </div>


                <div className="result-ready">

                  <span className="result-ready-dot">
                    ✓
                  </span>

                  Расчёт готов

                </div>

              </div>

            </div>


            <div className="result-table">

              <div className="breakdown">

                <div>

                  <span>
                    Транспорт
                  </span>

                  <b>
                    {
                      result
                        .vehicle
                        .name
                    }
                  </b>

                </div>


                <div>

                  <span>
                    Что везём
                  </span>

                  <b>
                    {cargoTypeLabel(
                      cargoType
                    )}
                  </b>

                </div>


                <div>

                  <span>
                    Вес и длина
                  </span>

                  <b>
                    {weight} т
                    {' · '}
                    {cargoLength} м
                  </b>

                </div>


                <div>

                  <span>
                    Общее расстояние
                  </span>

                  <b>
                    {Number(
                      result
                        .totalDistanceKm
                    ).toFixed(
                      1
                    )}{' '}
                    км
                  </b>

                </div>


                <div>

                  <span>
                    Внутри МКАД
                  </span>

                  <b>
                    {Number(
                      result
                        .insideDistanceKm
                    ).toFixed(
                      1
                    )}{' '}
                    км
                  </b>

                </div>


                <div>

                  <span>
                    За МКАД
                  </span>

                  <b>
                    {Number(
                      result
                        .outsideDistanceKm
                    ).toFixed(
                      1
                    )}{' '}
                    км
                  </b>

                </div>


                <div>

                  <span>
                    Для тарификации
                  </span>

                  <b>
                    {
                      result
                        .billableDistanceKm
                    }{' '}
                    км
                  </b>

                </div>


                <div>

                  <span>
                    Минимальная ставка
                  </span>

                  <b>
                    {rub(
                      result
                        .minimumChargeKopeks
                    )}
                  </b>

                </div>


                <div>

                  <span>
                    Километраж за МКАД
                  </span>

                  <b>
                    {
                      result
                        .billableDistanceKm
                    }{' '}
                    км ×{' '}

                    {rub(
                      result
                        .vehicle
                        .outsidePriceKopeks
                    )}

                    {' = '}

                    {rub(
                      result
                        .outsideChargeKopeks
                    )}
                  </b>

                </div>


                {result
                  .insideTtk && (
                  <div>

                    <span>
                      Доплата за ТТК
                    </span>

                    <b>
                      {rub(
                        result
                          .ttkSurchargeKopeks
                      )}
                    </b>

                  </div>
                )}


                {result
                  .extraPointCount >
                  0 && (
                  <div>

                    <span>
                      Дополнительные точки
                    </span>

                    <b>
                      {
                        result
                          .extraPointCount
                      }

                      {' · '}

                      {rub(
                        result
                          .extraPointsKopeks
                      )}
                    </b>

                  </div>
                )}


                {result
                  .needsConics && (
                  <div>

                    <span>
                      Коники
                    </span>

                    <b>
                      {rub(
                        result
                          .conicsKopeks
                      )}
                    </b>

                  </div>
                )}


                <div>

                  <span>
                    Сумма до 22%
                  </span>

                  <b>
                    {rub(
                      result
                        .deliverySubtotalKopeks
                    )}
                  </b>

                </div>


                <div>

                  <span>
                    22%
                  </span>

                  <b>
                    {rub(
                      result
                        .surcharge22Kopeks
                    )}
                  </b>

                </div>

              </div>


              <div className="result-total-line">

                <span>
                  Итого
                </span>

                <strong>
                  {rub(
                    result
                      .totalKopeks
                  )}
                </strong>

              </div>

            </div>


            <div className="result-footer">

              <div className="valya-message">
                Не паникуй, Валя
                постарается найти дешевле
              </div>


              {result
                .calculationNumber && (
                <div className="auto-save-message">

                  Расчёт{' '}

                  <b>
                    {
                      result
                        .calculationNumber
                    }
                  </b>{' '}

                  автоматически сохранён

                </div>
              )}

            </div>

          </div>
        )}

      </section>

    </div>
  );
}