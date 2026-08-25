import Decimal from 'decimal.js';

export type RoundingMode =
  | 'NONE'
  | 'NEAREST'
  | 'CEIL';

const SURCHARGE_PERCENT = 22;

export function roundDistance(
  value: number,
  mode: RoundingMode
) {
  if (mode === 'NONE') {
    return value;
  }

  if (mode === 'NEAREST') {
    return Math.round(value);
  }

  return Math.ceil(value);
}

export function calculatePrice(input: {
  outsideKm: number;

  basePriceKopeks: bigint;
  outsideRateKopeks: bigint;

  multiplier: number;
  globalFactor?: number;

  ttkSurchargeKopeks?: bigint;
  extraPointsKopeks?: bigint;
  servicesKopeks?: bigint;

  minPriceKopeks?: bigint;

  roundingMode: RoundingMode;
}) {
  const roundedOutsideKm =
    roundDistance(
      input.outsideKm,
      input.roundingMode
    );

  const billableDistance =
    new Decimal(
      roundedOutsideKm
    )
      .mul(input.multiplier)
      .mul(
        input.globalFactor ?? 1
      );

  const billableDistanceKm =
    Number(
      billableDistance.toString()
    );

  const outsideChargeKopeks =
    BigInt(
      billableDistance
        .mul(
          input.outsideRateKopeks.toString()
        )
        .toDecimalPlaces(
          0,
          Decimal.ROUND_HALF_UP
        )
        .toString()
    );

  const minimumChargeKopeks =
    input.basePriceKopeks >
    (input.minPriceKopeks ?? 0n)
      ? input.basePriceKopeks
      : (input.minPriceKopeks ?? 0n);

  const ttkSurchargeKopeks =
    input.ttkSurchargeKopeks ?? 0n;

  const extraPointsKopeks =
    input.extraPointsKopeks ?? 0n;

  const servicesKopeks =
    input.servicesKopeks ?? 0n;

  /*
   * Новая формула:
   *
   * минималка
   * + километры за МКАД
   * + ТТК
   * + дополнительные точки
   * + дополнительные услуги
   * = сумма до 22%
   */
  const deliverySubtotalKopeks =
    minimumChargeKopeks +
    outsideChargeKopeks +
    ttkSurchargeKopeks +
    extraPointsKopeks +
    servicesKopeks;

  const surcharge22Kopeks =
    BigInt(
      new Decimal(
        deliverySubtotalKopeks.toString()
      )
        .mul(SURCHARGE_PERCENT)
        .div(100)
        .toDecimalPlaces(
          0,
          Decimal.ROUND_HALF_UP
        )
        .toString()
    );

  const totalKopeks =
    deliverySubtotalKopeks +
    surcharge22Kopeks;

  return {
    roundedOutsideKm,
    billableDistanceKm,

    minimumChargeKopeks,
    outsideChargeKopeks,

    ttkSurchargeKopeks,
    extraPointsKopeks,
    servicesKopeks,

    deliverySubtotalKopeks,

    surchargePercent:
      SURCHARGE_PERCENT,

    surcharge22Kopeks,

    totalKopeks,
  };
}