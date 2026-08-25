import {
  describe,
  it,
  expect,
} from 'vitest';

import {
  calculatePrice,
  roundDistance,
} from '@/lib/pricing';

describe('pricing', () => {
  it('rounds up', () => {
    expect(
      roundDistance(
        12.01,
        'CEIL'
      )
    ).toBe(13);
  });

  it('base + outside + 22%', () => {
    const result =
      calculatePrice({
        outsideKm: 10,

        basePriceKopeks:
          1500000n,

        outsideRateKopeks:
          30000n,

        multiplier: 1,

        roundingMode:
          'CEIL',
      });

    expect(
      result.minimumChargeKopeks
    ).toBe(1500000n);

    expect(
      result.outsideChargeKopeks
    ).toBe(300000n);

    expect(
      result.deliverySubtotalKopeks
    ).toBe(1800000n);

    expect(
      result.surcharge22Kopeks
    ).toBe(396000n);

    expect(
      result.totalKopeks
    ).toBe(2196000n);
  });

  it('supports x2', () => {
    const result =
      calculatePrice({
        outsideKm: 10,

        basePriceKopeks:
          0n,

        outsideRateKopeks:
          10000n,

        multiplier: 2,

        roundingMode:
          'CEIL',
      });

    expect(
      result.billableDistanceKm
    ).toBe(20);

    expect(
      result.outsideChargeKopeks
    ).toBe(200000n);
  });

  it(
    'adds TTK and extra point before 22%',
    () => {
      const result =
        calculatePrice({
          outsideKm: 5,

          basePriceKopeks:
            700000n,

          minPriceKopeks:
            700000n,

          outsideRateKopeks:
            10000n,

          ttkSurchargeKopeks:
            200000n,

          extraPointsKopeks:
            300000n,

          multiplier: 1,

          roundingMode:
            'CEIL',
        });

      expect(
        result.minimumChargeKopeks
      ).toBe(700000n);

      expect(
        result.outsideChargeKopeks
      ).toBe(50000n);

      expect(
        result.ttkSurchargeKopeks
      ).toBe(200000n);

      expect(
        result.extraPointsKopeks
      ).toBe(300000n);

      expect(
        result.deliverySubtotalKopeks
      ).toBe(1250000n);

      expect(
        result.surcharge22Kopeks
      ).toBe(275000n);

      expect(
        result.totalKopeks
      ).toBe(1525000n);
    }
  );
});