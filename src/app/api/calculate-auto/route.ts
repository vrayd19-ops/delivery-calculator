
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { computeCalculation } from '@/lib/calculation';
import { jsonSafe } from '@/lib/serial';
import { requireUser } from '@/lib/auth';

async function createCalculationNumber() {
  const year = new Date().getFullYear();

  const count = await prisma.calculation.count({
    where: {
      createdAt: {
        gte: new Date(`${year}-01-01T00:00:00Z`),
      },
    },
  });

  return `DLV-${year}-${String(count + 1).padStart(6, '0')}`;
}

export async function POST(req: Request) {
  const startedAt = performance.now();
  const elapsed = () => Math.round(performance.now() - startedAt);

  try {
    const user = await requireUser();
    const body = await req.json();

    const cargoWeightTons = Number(body.cargoWeightTons);

    const cargoLengthM =
      body.cargoLengthM !== undefined &&
      body.cargoLengthM !== null &&
      body.cargoLengthM !== ''
        ? Number(body.cargoLengthM)
        : null;

    const cargoType = String(body.cargoType || '')
      .trim()
      .toLowerCase();

    const needsConics = Boolean(body.needsConics);

    if (
      !Array.isArray(body.points) ||
      body.points.length < 2 ||
      body.points.some((point: any) => !point)
    ) {
      return NextResponse.json(
        { error: 'Укажите адрес погрузки и адрес доставки' },
        { status: 400 }
      );
    }

    if (
      !Number.isFinite(cargoWeightTons) ||
      cargoWeightTons <= 0
    ) {
      return NextResponse.json(
        { error: 'Укажите корректный вес груза' },
        { status: 400 }
      );
    }

    if (
      cargoLengthM !== null &&
      (!Number.isFinite(cargoLengthM) || cargoLengthM <= 0)
    ) {
      return NextResponse.json(
        { error: 'Укажите корректную длину груза' },
        { status: 400 }
      );
    }

    if (!cargoType) {
      return NextResponse.json(
        { error: 'Укажите, что именно везём' },
        { status: 400 }
      );
    }

    const vehicles = await prisma.vehicleType.findMany({
      where: { isActive: true },
      orderBy: { sortOrder: 'asc' },
    });

    console.info('AUTO TIMING vehicles-loaded', {
      elapsedMs: elapsed(),
      count: vehicles.length,
    });

    const suitableVehicles = vehicles.filter((vehicle) => {
      const payloadOk =
        !vehicle.maxPayloadTons ||
        cargoWeightTons <= Number(vehicle.maxPayloadTons);

      const lengthOk =
        cargoLengthM === null ||
        !vehicle.maxCargoLengthM ||
        cargoLengthM <= Number(vehicle.maxCargoLengthM);

      const cargoTypeOk =
        vehicle.name !== 'Манипулятор с катюшей' ||
        cargoType === 'арматура';

      return payloadOk && lengthOk && cargoTypeOk;
    });

    if (suitableVehicles.length === 0) {
      return NextResponse.json(
        {
          error:
            'Нет подходящего транспорта для указанного веса, длины и типа груза',
        },
        { status: 400 }
      );
    }

    const calculations: Awaited<
      ReturnType<typeof computeCalculation>
    >[] = [];

    const routeCache: NonNullable<
      Parameters<typeof computeCalculation>[0]['routeCache']
    > = new Map();

    const geoCache: NonNullable<
      Parameters<typeof computeCalculation>[0]['geoCache']
    > = new Map();

    const mkadStartCache: NonNullable<
      Parameters<typeof computeCalculation>[0]['mkadStartCache']
    > = new Map();

    console.info('AUTO TIMING start-vehicle-calculations', {
      elapsedMs: elapsed(),
      count: suitableVehicles.length,
    });

    // Ограничиваем параллельную обработку тремя автомобилями.
    // Это уменьшает нагрузку на сервер Northflank.
    const workerCount = Math.min(3, suitableVehicles.length);
    let nextVehicleIndex = 0;

    await Promise.all(
      Array.from({ length: workerCount }, async () => {
        while (nextVehicleIndex < suitableVehicles.length) {
          const vehicle = suitableVehicles[nextVehicleIndex++];
          const vehicleStartedAt = performance.now();

          try {
            const result = await computeCalculation({
              vehicleTypeId: vehicle.id,
              routeCache,
              geoCache,
              mkadStartCache,
              points: body.points,
              cargoWeightTons,
              cargoLengthM: cargoLengthM ?? undefined,
              needsConics,
              comment: body.comment,
              services: body.services ?? [],
            });

            console.info('AUTO TIMING vehicle-computed', {
              vehicleId: vehicle.id,
              durationMs: Math.round(
                performance.now() - vehicleStartedAt
              ),
              elapsedMs: elapsed(),
            });

            if (result.overweight || result.cargoTooLong) {
              continue;
            }

            calculations.push(result);
          } catch (error) {
            console.error('AUTO TIMING vehicle-failed', {
              vehicleId: vehicle.id,
              durationMs: Math.round(
                performance.now() - vehicleStartedAt
              ),
              elapsedMs: elapsed(),
            });

            console.error(
              'AUTO VEHICLE ERROR:',
              vehicle.name,
              error
            );
          }
        }
      })
    );

    if (calculations.length === 0) {
      return NextResponse.json(
        {
          error:
            'Не удалось рассчитать доставку подходящим транспортом',
        },
        { status: 400 }
      );
    }

    console.info('AUTO TIMING all-vehicles-computed', {
      elapsedMs: elapsed(),
      successfulCount: calculations.length,
    });

    console.info('AUTO ROUTE CACHE SUMMARY', {
      uniqueRoutes: routeCache.size,
      vehicles: suitableVehicles.length,
    });

    calculations.sort((first, second) => {
      const firstTotal = BigInt(first.pricing.totalKopeks);
      const secondTotal = BigInt(second.pricing.totalKopeks);

      if (firstTotal < secondTotal) return -1;
      if (firstTotal > secondTotal) return 1;
      return 0;
    });

    const result = calculations[0];

    const number = await createCalculationNumber();

    console.info('AUTO TIMING before-save', {
      elapsedMs: elapsed(),
    });

    const savedCalculation = await prisma.calculation.create({
      data: {
        userId: user.id,
        number,
        vehicleTypeId: result.vehicle.id,
        cargoWeightTons,
        cargoLengthM: cargoLengthM ?? null,
        comment: body.comment || null,

        totalDistanceKm: result.geo.totalKm,
        insideDistanceKm: result.geo.insideKm,
        outsideDistanceKm: result.geo.outsideKm,
        billableDistanceKm:
          result.pricing.billableDistanceKm,

        basePriceKopeksSnapshot:
          result.vehicle.basePriceKopeks,
        outsideRateKopeksSnapshot:
          result.vehicle.outsidePriceKopeks,
        distanceMultiplierSnapshot:
          result.vehicle.distanceMultiplier,
        ttkSurchargeKopeksSnapshot:
          result.vehicle.ttkSurchargeKopeks,
        extraPointPriceKopeksSnapshot:
          result.vehicle.extraPointPriceKopeks,

        ttkSurchargeKopeks:
          result.ttkSurchargeKopeks,
        extraPointsKopeks:
          result.extraPointsKopeks,

        subtotalBefore22Kopeks:
          result.pricing.deliverySubtotalKopeks,
        surcharge22Kopeks:
          result.pricing.surcharge22Kopeks,

        servicesKopeks: result.servicesKopeks,
        adjustmentKopeks: 0n,
        adjustmentReason: null,
        totalKopeks: result.pricing.totalKopeks,

        tariffSnapshot: {
          cargoType,
          needsConics: result.needsConics,
          conicsKopeks: result.conicsKopeks.toString(),
          vehicleName: result.vehicle.name,

          basePriceKopeks:
            result.vehicle.basePriceKopeks.toString(),
          minPriceKopeks:
            result.vehicle.minPriceKopeks.toString(),
          outsidePriceKopeks:
            result.vehicle.outsidePriceKopeks.toString(),
          distanceMultiplier:
            result.vehicle.distanceMultiplier.toString(),
          ttkSurchargeKopeks:
            result.vehicle.ttkSurchargeKopeks.toString(),
          extraPointPriceKopeks:
            result.vehicle.extraPointPriceKopeks.toString(),

          maxPayloadTons:
            result.vehicle.maxPayloadTons?.toString() ?? null,
          maxCargoLengthM:
            result.vehicle.maxCargoLengthM?.toString() ?? null,

          cargoLengthM,
          extraPointCount: result.extraPointCount,
          insideTtk: result.insideTtk,
          surchargePercent:
            result.pricing.surchargePercent,
        },

        routeGeoJson: {
          type: 'LineString',
          coordinates: result.route.coordinates,
        },

        routeStatus: result.route.status,

        points: {
          create: body.points.map(
            (point: any, index: number) => ({
              kind:
                index === body.points.length - 1
                  ? 'DELIVERY'
                  : 'PICKUP',
              sortOrder: index,
              displayAddress: point.displayAddress,
              normalizedAddress: point.normalizedAddress,
              latitude: point.latitude,
              longitude: point.longitude,
            })
          ),
        },

        services: {
          create: result.serviceRows.map((service) => ({
            additionalServiceId: service.id,
            nameSnapshot: service.name,
            priceTypeSnapshot: service.priceType,
            priceValueSnapshot: service.priceValue,
            quantity: service.quantity,
            amountKopeks: BigInt(service.amountKopeks),
          })),
        },
      },
    });

    console.info('AUTO TIMING completed', {
      elapsedMs: elapsed(),
    });

    console.log('AUTO CALCULATION SAVED:', {
      number: savedCalculation.number,
      userEmail: user.email,
      vehicleName: result.vehicle.name,
      totalKopeks: result.pricing.totalKopeks.toString(),
    });

    return NextResponse.json(
      jsonSafe({
        autoSelected: true,
        autoSaved: true,
        calculationId: savedCalculation.id,
        calculationNumber: savedCalculation.number,
        cargoType,
        needsConics: result.needsConics,
        conicsKopeks: result.conicsKopeks,
        vehicle: result.vehicle,
        overweight: result.overweight,
        cargoTooLong: result.cargoTooLong,
        cargoLengthM: result.cargoLengthM,

        totalDistanceKm: result.geo.totalKm,
        insideDistanceKm: result.geo.insideKm,
        outsideDistanceKm: result.geo.outsideKm,
        roundedOutsideKm:
          result.pricing.roundedOutsideKm,
        billableDistanceKm:
          result.pricing.billableDistanceKm,
        minimumChargeKopeks:
          result.pricing.minimumChargeKopeks,
        outsideChargeKopeks:
          result.pricing.outsideChargeKopeks,

        extraPointCount: result.extraPointCount,
        extraPointsKopeks: result.extraPointsKopeks,
        insideTtk: result.insideTtk,
        ttkSurchargeKopeks:
          result.ttkSurchargeKopeks,
        servicesKopeks: result.servicesKopeks,

        deliverySubtotalKopeks:
          result.pricing.deliverySubtotalKopeks,
        surchargePercent:
          result.pricing.surchargePercent,
        surcharge22Kopeks:
          result.pricing.surcharge22Kopeks,
        totalKopeks: result.pricing.totalKopeks,

        route: {
          coordinates: result.route.coordinates,
          insideSegments: result.geo.insideSegments,
          outsideSegments: result.geo.outsideSegments,
          crossings: result.geo.crossings,
          pricingCoordinates:
            result.pricingRoute.coordinates,
        },

        serviceRows: result.serviceRows,
      })
    );
  } catch (error: any) {
    if (error?.message === 'UNAUTHORIZED') {
      return NextResponse.json(
        { error: 'Необходимо войти в аккаунт' },
        { status: 401 }
      );
    }

    console.error('AUTO TIMING request-failed', {
      elapsedMs: elapsed(),
    });

    console.error(
      'AUTO CALCULATE ERROR:',
      error?.message || error
    );

    return NextResponse.json(
      {
        error:
          error?.message ||
          'Не удалось подобрать транспорт',
      },
      { status: 400 }
    );
  }
}
