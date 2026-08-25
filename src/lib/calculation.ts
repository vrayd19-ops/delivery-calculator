import { prisma } from './db';

import {
  buildDrivingRoute,
} from './yandex';

import {
  splitRouteByMkad,
  isInsideMkad,
  getMkadPolygon,
} from './mkad';

import {
  hasPointInsideTtk,
} from './ttk';

import {
  calculatePrice,
} from './pricing';

import {
  nearestPointOnLine,
  polygonToLine,
  point,
} from '@turf/turf';

import Decimal from 'decimal.js';

import type {
  AddressPoint,
  Coordinate,
} from './types';


export async function computeCalculation(
  input: {
    vehicleTypeId: string;

    points: AddressPoint[];

    cargoWeightTons: number;

    cargoLengthM?: number;

    needsConics?: boolean;

    services?: {
      id: string;
      quantity: number;
    }[];

    comment?: string;
  }
) {
  /*
   * Минимум:
   * погрузка + доставка.
   */
  if (
    !input.points ||
    input.points.length < 2
  ) {
    throw new Error(
      'Укажите минимум погрузку и доставку'
    );
  }


  /*
   * Получаем транспорт
   * и настройки.
   */
  const [
    vehicle,
    settings,
  ] = await Promise.all([
    prisma.vehicleType.findUnique({
      where: {
        id:
          input.vehicleTypeId,
      },
    }),

    prisma.appSettings.findUnique({
      where: {
        id:
          'global',
      },
    }),
  ]);


  if (
    !vehicle ||
    !vehicle.isActive
  ) {
    throw new Error(
      'Выбранный транспорт недоступен'
    );
  }


  /*
   * Проверка веса.
   */
  const overweight =
    vehicle.maxPayloadTons
      ? new Decimal(
          input.cargoWeightTons
        ).gt(
          vehicle.maxPayloadTons
        )
      : false;


  /*
   * Проверка длины.
   */
  const cargoTooLong =
    input.cargoLengthM &&
    vehicle.maxCargoLengthM
      ? new Decimal(
          input.cargoLengthM
        ).gt(
          vehicle.maxCargoLengthM
        )
      : false;


  /*
   * Координаты пользовательских
   * точек маршрута.
   *
   * [longitude, latitude]
   */
  const coordinates:
    Coordinate[] =
    input.points.map(
      (
        addressPoint
      ) => [
        addressPoint.longitude,
        addressPoint.latitude,
      ]
    );


  /*
   * Параметры транспорта
   * для маршрутизатора.
   */
  const truckOptions = {
    payload:
      input.cargoWeightTons,

    width:
      vehicle.bodyWidthM
        ? Number(
            vehicle.bodyWidthM
          )
        : undefined,

    length:
      vehicle.bodyLengthM
        ? Number(
            vehicle.bodyLengthM
          )
        : undefined,
  };


  /*
   * =====================================
   * ОСНОВНОЙ МАРШРУТ
   * =====================================
   *
   * Погрузка
   * → дополнительные точки
   * → выгрузка.
   */
  const route =
    await buildDrivingRoute(
      coordinates,
      truckOptions
    );


  /*
   * Разделяем основной маршрут
   * относительно МКАД.
   */
  const geo =
    splitRouteByMkad(
      route.coordinates,
      settings?.mkadGeoJson
    );


  /*
   * Определяем положение
   * первой точки.
   */
  const startOutside =
    !isInsideMkad(
      coordinates[0],
      settings?.mkadGeoJson
    );


  /*
   * Определяем положение
   * последней точки.
   */
  const endOutside =
    !isInsideMkad(
      coordinates[
        coordinates.length - 1
      ],
      settings?.mkadGeoJson
    );


  /*
   * По умолчанию тарифное
   * расстояние = внешняя часть
   * основного маршрута.
   */
  let pricedOutsideKm =
    geo.outsideKm;


  /*
   * Отдельный маршрут,
   * который показываем как
   * маршрут тарификации.
   *
   * Для обычных случаев
   * совпадает с основным.
   */
  let pricingRoute =
    route;


  /*
   * =====================================
   * ПРАВИЛА ТАРИФИКАЦИИ
   * =====================================
   */


  /*
   * Обе точки внутри МКАД.
   */
  if (
    !startOutside &&
    !endOutside
  ) {
    pricedOutsideKm =
      0;
  }


  /*
   * Погрузка за МКАД,
   * доставка внутри.
   *
   * За МКАД считаем
   * туда и обратно.
   */
  if (
    startOutside &&
    !endOutside
  ) {
    pricedOutsideKm =
      geo.outsideKm * 2;
  }


  /*
   * Погрузка внутри,
   * доставка за МКАД.
   *
   * За МКАД считаем
   * туда и обратно.
   */
  if (
    !startOutside &&
    endOutside
  ) {
    pricedOutsideKm =
      geo.outsideKm * 2;
  }


  /*
   * =====================================
   * ОБЕ ТОЧКИ ЗА МКАД
   * =====================================
   *
   * Например:
   *
   * Лапино → Дедовск.
   *
   * Для отображения строим:
   *
   * ближайшая точка МКАД
   * → Лапино
   * → Дедовск.
   *
   * При этом стоимость
   * продолжаем считать по
   * действующему правилу:
   *
   * фактические километры
   * за МКАД × 2.
   *
   * Это важно, чтобы не вернуть
   * старую ошибку, когда вместо
   * 48 км получалось 71 км.
   */
  if (
    startOutside &&
    endOutside
  ) {
    /*
     * Стоимость:
     * внешний километраж ×2.
     */
    pricedOutsideKm =
      geo.outsideKm * 2;


    /*
     * Получаем настоящий
     * полигон МКАД.
     */
    const mkadPolygon =
      getMkadPolygon(
        settings?.mkadGeoJson
      );


    /*
     * Превращаем полигон
     * в линию границы.
     */
    const mkadBoundary =
      polygonToLine(
        mkadPolygon as any
      );


    /*
     * Основная точка погрузки.
     */
    const pickupCoordinate =
      coordinates[0];


    /*
     * Находим геометрически
     * ближайшую точку МКАД
     * к месту погрузки.
     */
    const nearestMkadPoint =
      nearestPointOnLine(
        mkadBoundary as any,

        point(
          pickupCoordinate
        ),

        {
          units:
            'kilometers',
        }
      );


    const [
      mkadLongitude,
      mkadLatitude,
    ] =
      nearestMkadPoint
        .geometry
        .coordinates;


    const mkadStart:
      Coordinate = [
        Number(
          mkadLongitude
        ),

        Number(
          mkadLatitude
        ),
      ];


    console.log(
      'BOTH OUTSIDE PRICING ROUTE:',
      {
        mkadStart,

        pickup:
          coordinates[0],

        delivery:
          coordinates[
            coordinates.length - 1
          ],
      }
    );


    /*
     * Маршрут для тарификации
     * и отображения:
     *
     * МКАД
     * → погрузка
     * → дополнительные точки
     * → доставка.
     *
     * buildDrivingRoute использует
     * наш OSRM с бесплатными дорогами.
     */
    const pricingCoordinates:
      Coordinate[] = [
        mkadStart,
        ...coordinates,
      ];


    pricingRoute =
      await buildDrivingRoute(
        pricingCoordinates,
        truckOptions
      );
  }


  /*
   * =====================================
   * ДОПОЛНИТЕЛЬНЫЕ ТОЧКИ
   * =====================================
   */
  const extraPointCount =
    Math.max(
      0,
      input.points.length - 2
    );


  const extraPointsKopeks =
    vehicle.extraPointPriceKopeks *
    BigInt(
      extraPointCount
    );


  /*
   * =====================================
   * ТТК
   * =====================================
   */
  const insideTtk =
    hasPointInsideTtk(
      coordinates,
      settings?.ttkGeoJson
    );


  const ttkSurchargeKopeks =
    insideTtk
      ? vehicle.ttkSurchargeKopeks
      : 0n;


  /*
   * =====================================
   * КОНИКИ
   * =====================================
   */
  const needsConics =
    Boolean(
      input.needsConics
    );


  const conicsKopeks =
    needsConics
      ? 200000n
      : 0n;


  /*
   * =====================================
   * ДОПОЛНИТЕЛЬНЫЕ УСЛУГИ
   * =====================================
   */
  const selectedServices =
    input.services?.length
      ? await prisma.additionalService.findMany({
          where: {
            id: {
              in:
                input.services.map(
                  (
                    service
                  ) =>
                    service.id
                ),
            },

            isActive:
              true,
          },
        })
      : [];


  let servicesKopeks =
    0n;


  const serviceRows =
    selectedServices.map(
      (
        service
      ) => {
        const quantity =
          input.services?.find(
            (
              item
            ) =>
              item.id ===
              service.id
          )?.quantity ??
          1;


        let amountRub =
          new Decimal(
            service
              .priceValue
              .toString()
          );


        /*
         * Цена за час
         * или единицу.
         */
        if (
          service.priceType ===
            'HOURLY' ||
          service.priceType ===
            'UNIT'
        ) {
          amountRub =
            amountRub.mul(
              quantity
            );
        }


        /*
         * Процентная услуга.
         */
        if (
          service.priceType ===
          'PERCENT'
        ) {
          amountRub =
            new Decimal(
              vehicle
                .basePriceKopeks
                .toString()
            )
              .div(
                100
              )
              .mul(
                amountRub
              )
              .div(
                100
              );
        }


        const amountKopeks =
          BigInt(
            amountRub
              .mul(
                100
              )
              .toDecimalPlaces(
                0,
                Decimal
                  .ROUND_HALF_UP
              )
              .toString()
          );


        servicesKopeks +=
          amountKopeks;


        return {
          id:
            service.id,

          name:
            service.name,

          priceType:
            service.priceType,

          priceValue:
            Number(
              service.priceValue
            ),

          quantity,

          amountKopeks:
            amountKopeks.toString(),
        };
      }
    );


  /*
   * Доп. услуги + коники.
   *
   * Всё попадает в сумму
   * ДО начисления 22%.
   */
  const servicesWithConicsKopeks =
    servicesKopeks +
    conicsKopeks;


  /*
   * =====================================
   * ФИНАЛЬНАЯ ЦЕНА
   * =====================================
   */
  const pricing =
    calculatePrice({
      outsideKm:
        pricedOutsideKm,

      basePriceKopeks:
        vehicle.basePriceKopeks,

      outsideRateKopeks:
        vehicle.outsidePriceKopeks,

      multiplier:
        Number(
          vehicle.distanceMultiplier
        ),

      globalFactor:
        Number(
          settings
            ?.globalDistanceFactor ??
            1
        ),

      ttkSurchargeKopeks,

      extraPointsKopeks,

      servicesKopeks:
        servicesWithConicsKopeks,

      minPriceKopeks:
        vehicle.minPriceKopeks,

      roundingMode:
        (
          settings?.roundingMode ??
          'CEIL'
        ) as any,
    });


  /*
   * =====================================
   * РЕЗУЛЬТАТ
   * =====================================
   */
  return {
    vehicle,
    settings,

    overweight,
    cargoTooLong,

    cargoLengthM:
      input.cargoLengthM ??
      null,

    needsConics,

    conicsKopeks,

    /*
     * Обычный маршрут:
     *
     * погрузка
     * → доставка.
     */
    route,

    /*
     * Тарифный маршрут.
     *
     * При двух точках за МКАД:
     *
     * МКАД
     * → погрузка
     * → доставка.
     */
    pricingRoute,

    geo,

    pricedOutsideKm,

    extraPointCount,
    extraPointsKopeks,

    insideTtk,
    ttkSurchargeKopeks,

    pricing,

    serviceRows,

    servicesKopeks,

    adjustmentKopeks:
      0n,
  };
}