import { NextResponse } from 'next/server';

import {
  computeCalculation,
} from '@/lib/calculation';

import {
  jsonSafe,
} from '@/lib/serial';


export async function POST(
  req: Request
) {
  try {
    const body =
      await req.json();

    console.log(
      'CALCULATE INPUT:',
      {
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

    console.log(
      'CALCULATE SUCCESS:',
      {
        vehicleName:
          result.vehicle.name,

        maxPayloadTons:
          result.vehicle.maxPayloadTons
            ? result.vehicle.maxPayloadTons.toString()
            : null,

        cargoWeightTons:
          body.cargoWeightTons,

        overweight:
          result.overweight,

        totalKm:
          result.geo.totalKm,

        insideKm:
          result.geo.insideKm,

        outsideKm:
          result.geo.outsideKm,

        billableDistanceKm:
          result.pricing
            .billableDistanceKm,

        extraPointCount:
          result.extraPointCount,

        insideTtk:
          result.insideTtk,

        totalKopeks:
          result.pricing
            .totalKopeks
            .toString(),
      }
    );

    return NextResponse.json(
      jsonSafe({
        overweight:
          result.overweight,

        cargoTooLong:
          result.cargoTooLong,

        cargoLengthM:
          result.cargoLengthM,

        vehicle:
          result.vehicle,

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
    console.error(
      'CALCULATE ERROR:',
      error?.message ||
        error
    );

    return NextResponse.json(
      {
        error:
          error?.message ||
          'Не удалось рассчитать доставку',
      },
      {
        status: 400,
      }
    );
  }
}