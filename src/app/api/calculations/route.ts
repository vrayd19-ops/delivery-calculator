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


/*
 * История расчётов.
 *
 * ADMIN видит всё.
 * MANAGER видит только свои расчёты.
 */
export async function GET() {
  try {
    const user =
      await requireUser();

    const rows =
      await prisma.calculation.findMany({
        where:
          user.role ===
          'ADMIN'
            ? undefined
            : {
                userId:
                  user.id,
              },

        include: {
          user: {
            select: {
              id: true,
              email: true,
              role: true,
            },
          },

          vehicleType:
            true,

          points: {
            orderBy: {
              sortOrder:
                'asc',
            },
          },

          services:
            true,
        },

        orderBy: {
          createdAt:
            'desc',
        },

        take:
          100,
      });

    return NextResponse.json(
      jsonSafe(
        rows
      )
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
      'CALCULATIONS GET ERROR:',
      error?.message ||
        error
    );

    return NextResponse.json(
      {
        error:
          error?.message ||
          'Не удалось загрузить историю расчетов',
      },
      {
        status: 500,
      }
    );
  }
}


/*
 * Сохранение расчёта.
 *
 * Каждый новый расчёт
 * автоматически привязывается
 * к текущему пользователю.
 */
export async function POST(
  req: Request
) {
  try {
    const user =
      await requireUser();

    const body =
      await req.json();

    console.log(
      'SAVE CALCULATION INPUT:',
      {
        userId:
          user.id,

        userEmail:
          user.email,

        vehicleTypeId:
          body.vehicleTypeId,

        pointsCount:
          body.points?.length,

        cargoWeightTons:
          body.cargoWeightTons,

        cargoLengthM:
          body.cargoLengthM,
      }
    );

    const result =
      await computeCalculation(
        body
      );

    const number =
      await createCalculationNumber();

    const created =
      await prisma.calculation.create({
        data: {
          /*
           * Владелец расчёта.
           */
          userId:
            user.id,

          number,

          vehicleTypeId:
            result.vehicle.id,

          cargoWeightTons:
            body.cargoWeightTons,

          cargoLengthM:
            body.cargoLengthM ??
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
           * Snapshot основных тарифов.
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

          /*
           * Snapshot дополнительных тарифов.
           */
          ttkSurchargeKopeksSnapshot:
            result.vehicle
              .ttkSurchargeKopeks,

          extraPointPriceKopeksSnapshot:
            result.vehicle
              .extraPointPriceKopeks,

          /*
           * Фактически применённые суммы.
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

          servicesKopeks:
            result.servicesKopeks,

          /*
           * Ручная корректировка
           * сейчас не используется.
           */
          adjustmentKopeks:
            0n,

          adjustmentReason:
            null,

          totalKopeks:
            result.pricing
              .totalKopeks,

          /*
           * Снимок тарифа
           * на момент расчёта.
           */
          tariffSnapshot: {
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
              body.cargoLengthM ??
              null,

            extraPointCount:
              result.extraPointCount,

            insideTtk:
              result.insideTtk,

            needsConics:
              result.needsConics,

            conicsKopeks:
              result.conicsKopeks
                .toString(),

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

          /*
           * Все точки маршрута.
           */
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

        include: {
          user: {
            select: {
              id: true,
              email: true,
              role: true,
            },
          },

          vehicleType:
            true,

          points: {
            orderBy: {
              sortOrder:
                'asc',
            },
          },

          services:
            true,
        },
      });

    console.log(
      'CALCULATION SAVED:',
      {
        number:
          created.number,

        userEmail:
          user.email,

        totalKopeks:
          created.totalKopeks
            .toString(),
      }
    );

    return NextResponse.json(
      jsonSafe(
        created
      )
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
      'CALCULATION SAVE ERROR:',
      error?.message ||
        error
    );

    return NextResponse.json(
      {
        error:
          error?.message ||
          'Не удалось сохранить расчет',
      },
      {
        status: 400,
      }
    );
  }
}