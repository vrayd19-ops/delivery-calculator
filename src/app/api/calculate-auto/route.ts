import {
  NextResponse,
} from 'next/server';

import {
  prisma,
} from '@/lib/db';

import {
  computeCalculation,
} from '@/lib/calculation';

import {
  jsonSafe,
} from '@/lib/serial';

import {
  requireUser,
} from '@/lib/auth';


async function createCalculationNumber() {
  const year =
    new Date().getFullYear();

  const count =
    await prisma.calculation.count({
      where: {
        createdAt: {
          gte: new Date(
            `${year}-01-01T00:00:00Z`
          ),
        },
      },
    });

  return `DLV-${year}-${String(
    count + 1
  ).padStart(6, '0')}`;
}


export async function POST(
  req: Request
) {
  try {
    /*
     * Каждый расчет теперь
     * доступен только вошедшему
     * пользователю.
     */
    const user =
      await requireUser();

    const body =
      await req.json();

    const cargoWeightTons =
      Number(
        body.cargoWeightTons
      );

    const cargoLengthM =
      body.cargoLengthM !==
        undefined &&
      body.cargoLengthM !==
        null &&
      body.cargoLengthM !== ''
        ? Number(
            body.cargoLengthM
          )
        : null;

    const cargoType =
      String(
        body.cargoType || ''
      )
        .trim()
        .toLowerCase();

    const needsConics =
      Boolean(
        body.needsConics
      );


    /*
     * Проверяем маршрут.
     */
    if (
      !Array.isArray(
        body.points
      ) ||
      body.points.length < 2 ||
      body.points.some(
        (
          point: any
        ) => !point
      )
    ) {
      return NextResponse.json(
        {
          error:
            'Укажите адрес погрузки и адрес доставки',
        },
        {
          status: 400,
        }
      );
    }


    /*
     * Проверяем вес.
     */
    if (
      !Number.isFinite(
        cargoWeightTons
      ) ||
      cargoWeightTons <= 0
    ) {
      return NextResponse.json(
        {
          error:
            'Укажите корректный вес груза',
        },
        {
          status: 400,
        }
      );
    }


    /*
     * Проверяем длину.
     */
    if (
      cargoLengthM !==
        null &&
      (
        !Number.isFinite(
          cargoLengthM
        ) ||
        cargoLengthM <= 0
      )
    ) {
      return NextResponse.json(
        {
          error:
            'Укажите корректную длину груза',
        },
        {
          status: 400,
        }
      );
    }


    /*
     * Тип груза обязателен.
     */
    if (
      !cargoType
    ) {
      return NextResponse.json(
        {
          error:
            'Укажите, что именно везём',
        },
        {
          status: 400,
        }
      );
    }


    /*
     * Получаем все активные машины.
     */
    const vehicles =
      await prisma.vehicleType.findMany({
        where: {
          isActive:
            true,
        },

        orderBy: {
          sortOrder:
            'asc',
        },
      });


    /*
     * Фильтруем подходящий транспорт.
     */
    const suitableVehicles =
      vehicles.filter(
        (
          vehicle
        ) => {
          const payloadOk =
            !vehicle.maxPayloadTons ||
            cargoWeightTons <=
              Number(
                vehicle.maxPayloadTons
              );

          const lengthOk =
            cargoLengthM ===
              null ||
            !vehicle.maxCargoLengthM ||
            cargoLengthM <=
              Number(
                vehicle.maxCargoLengthM
              );

          /*
           * Манипулятор с катюшей
           * только для арматуры.
           */
          const cargoTypeOk =
            vehicle.name !==
              'Манипулятор с катюшей' ||
            cargoType ===
              'арматура';

          return (
            payloadOk &&
            lengthOk &&
            cargoTypeOk
          );
        }
      );


    if (
      suitableVehicles.length ===
      0
    ) {
      return NextResponse.json(
        {
          error:
            'Нет подходящего транспорта для указанного веса, длины и типа груза',
        },
        {
          status: 400,
        }
      );
    }


    /*
     * Считаем стоимость
     * на каждой подходящей машине.
     */
    const calculations: any[] =
      [];

    for (
      const vehicle of
      suitableVehicles
    ) {
      try {
        const result =
          await computeCalculation({
            vehicleTypeId:
              vehicle.id,

            points:
              body.points,

            cargoWeightTons,

            cargoLengthM:
              cargoLengthM ??
              undefined,

            needsConics,

            comment:
              body.comment,

            services:
              body.services ??
              [],
          });

        if (
          result.overweight ||
          result.cargoTooLong
        ) {
          continue;
        }

        calculations.push(
          result
        );
      } catch (
        error
      ) {
        console.error(
          'AUTO VEHICLE ERROR:',
          vehicle.name,
          error
        );
      }
    }


    if (
      calculations.length ===
      0
    ) {
      return NextResponse.json(
        {
          error:
            'Не удалось рассчитать доставку подходящим транспортом',
        },
        {
          status: 400,
        }
      );
    }


    /*
     * Выбираем самый дешевый вариант.
     */
    calculations.sort(
      (
        first,
        second
      ) => {
        const firstTotal =
          BigInt(
            first.pricing
              .totalKopeks
          );

        const secondTotal =
          BigInt(
            second.pricing
              .totalKopeks
          );

        if (
          firstTotal <
          secondTotal
        ) {
          return -1;
        }

        if (
          firstTotal >
          secondTotal
        ) {
          return 1;
        }

        return 0;
      }
    );


    const result =
      calculations[0];


    /*
     * =====================================
     * АВТОМАТИЧЕСКОЕ СОХРАНЕНИЕ
     * =====================================
     *
     * Каждый успешный расчет
     * сохраняется сразу.
     */
    const number =
      await createCalculationNumber();


    const savedCalculation =
      await prisma.calculation.create({
        data: {
          userId:
            user.id,

          number,

          vehicleTypeId:
            result.vehicle.id,

          cargoWeightTons,

          cargoLengthM:
            cargoLengthM ??
            null,

          comment:
            body.comment ||
            null,

          totalDistanceKm:
            result.geo.totalKm,

          insideDistanceKm:
            result.geo.insideKm,

          outsideDistanceKm:
            result.geo.outsideKm,

          billableDistanceKm:
            result.pricing
              .billableDistanceKm,

          /*
           * Snapshot тарифов.
           */
          basePriceKopeksSnapshot:
            result.vehicle
              .basePriceKopeks,

          outsideRateKopeksSnapshot:
            result.vehicle
              .outsidePriceKopeks,

          distanceMultiplierSnapshot:
            result.vehicle
              .distanceMultiplier,

          ttkSurchargeKopeksSnapshot:
            result.vehicle
              .ttkSurchargeKopeks,

          extraPointPriceKopeksSnapshot:
            result.vehicle
              .extraPointPriceKopeks,

          /*
           * Фактически примененные суммы.
           */
          ttkSurchargeKopeks:
            result.ttkSurchargeKopeks,

          extraPointsKopeks:
            result.extraPointsKopeks,

          subtotalBefore22Kopeks:
            result.pricing
              .deliverySubtotalKopeks,

          surcharge22Kopeks:
            result.pricing
              .surcharge22Kopeks,

          /*
           * Здесь сохраняются только
           * обычные дополнительные услуги.
           * Коники отдельно лежат
           * в tariffSnapshot.
           */
          servicesKopeks:
            result.servicesKopeks,

          adjustmentKopeks:
            0n,

          adjustmentReason:
            null,

          totalKopeks:
            result.pricing
              .totalKopeks,

          tariffSnapshot: {
            cargoType,

            needsConics:
              result.needsConics,

            conicsKopeks:
              result.conicsKopeks
                .toString(),

            vehicleName:
              result.vehicle.name,

            basePriceKopeks:
              result.vehicle
                .basePriceKopeks
                .toString(),

            minPriceKopeks:
              result.vehicle
                .minPriceKopeks
                .toString(),

            outsidePriceKopeks:
              result.vehicle
                .outsidePriceKopeks
                .toString(),

            distanceMultiplier:
              result.vehicle
                .distanceMultiplier
                .toString(),

            ttkSurchargeKopeks:
              result.vehicle
                .ttkSurchargeKopeks
                .toString(),

            extraPointPriceKopeks:
              result.vehicle
                .extraPointPriceKopeks
                .toString(),

            maxPayloadTons:
              result.vehicle
                .maxPayloadTons
                ?.toString() ??
              null,

            maxCargoLengthM:
              result.vehicle
                .maxCargoLengthM
                ?.toString() ??
              null,

            cargoLengthM:
              cargoLengthM,

            extraPointCount:
              result.extraPointCount,

            insideTtk:
              result.insideTtk,

            surchargePercent:
              result.pricing
                .surchargePercent,
          },

          routeGeoJson: {
            type:
              'LineString',

            coordinates:
              result.route
                .coordinates,
          },

          routeStatus:
            result.route.status,

          points: {
            create:
              body.points.map(
                (
                  point: any,
                  index: number
                ) => ({
                  kind:
                    index ===
                    body.points.length -
                      1
                      ? 'DELIVERY'
                      : 'PICKUP',

                  sortOrder:
                    index,

                  displayAddress:
                    point.displayAddress,

                  normalizedAddress:
                    point.normalizedAddress,

                  latitude:
                    point.latitude,

                  longitude:
                    point.longitude,
                })
              ),
          },

          services: {
            create:
              result.serviceRows.map(
                (
                  service: any
                ) => ({
                  additionalServiceId:
                    service.id,

                  nameSnapshot:
                    service.name,

                  priceTypeSnapshot:
                    service.priceType,

                  priceValueSnapshot:
                    service.priceValue,

                  quantity:
                    service.quantity,

                  amountKopeks:
                    BigInt(
                      service.amountKopeks
                    ),
                })
              ),
          },
        },
      });


    console.log(
      'AUTO CALCULATION SAVED:',
      {
        number:
          savedCalculation.number,

        userEmail:
          user.email,

        vehicleName:
          result.vehicle.name,

        totalKopeks:
          result.pricing
            .totalKopeks
            .toString(),
      }
    );


    /*
     * Возвращаем и расчет,
     * и номер автоматически
     * сохраненной записи.
     */
    return NextResponse.json(
      jsonSafe({
        autoSelected:
          true,

        autoSaved:
          true,

        calculationId:
          savedCalculation.id,

        calculationNumber:
          savedCalculation.number,

        cargoType,

        needsConics:
          result.needsConics,

        conicsKopeks:
          result.conicsKopeks,

        vehicle:
          result.vehicle,

        overweight:
          result.overweight,

        cargoTooLong:
          result.cargoTooLong,

        cargoLengthM:
          result.cargoLengthM,

        totalDistanceKm:
          result.geo.totalKm,

        insideDistanceKm:
          result.geo.insideKm,

        outsideDistanceKm:
          result.geo.outsideKm,

        roundedOutsideKm:
          result.pricing
            .roundedOutsideKm,

        billableDistanceKm:
          result.pricing
            .billableDistanceKm,

        minimumChargeKopeks:
          result.pricing
            .minimumChargeKopeks,

        outsideChargeKopeks:
          result.pricing
            .outsideChargeKopeks,

        extraPointCount:
          result.extraPointCount,

        extraPointsKopeks:
          result.extraPointsKopeks,

        insideTtk:
          result.insideTtk,

        ttkSurchargeKopeks:
          result.ttkSurchargeKopeks,

        servicesKopeks:
          result.servicesKopeks,

        deliverySubtotalKopeks:
          result.pricing
            .deliverySubtotalKopeks,

        surchargePercent:
          result.pricing
            .surchargePercent,

        surcharge22Kopeks:
          result.pricing
            .surcharge22Kopeks,

        totalKopeks:
          result.pricing
            .totalKopeks,

        route: {
          coordinates:
            result.route
              .coordinates,

          insideSegments:
            result.geo
              .insideSegments,

          outsideSegments:
            result.geo
              .outsideSegments,

          crossings:
            result.geo
              .crossings,

          pricingCoordinates:
            result.pricingRoute
              .coordinates,
        },

        serviceRows:
          result.serviceRows,
      })
    );
  } catch (
    error: any
  ) {
    if (
      error?.message ===
      'UNAUTHORIZED'
    ) {
      return NextResponse.json(
        {
          error:
            'Необходимо войти в аккаунт',
        },
        {
          status: 401,
        }
      );
    }

    console.error(
      'AUTO CALCULATE ERROR:',
      error?.message ||
        error
    );

    return NextResponse.json(
      {
        error:
          error?.message ||
          'Не удалось подобрать транспорт',
      },
      {
        status: 400,
      }
    );
  }
}