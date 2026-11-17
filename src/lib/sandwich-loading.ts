
import {
  SANDWICH_TRAILER,
  type SandwichBundle,
} from './sandwich-panels';

export type SandwichPlacement = {
  bundle: SandwichBundle;
  xMm: number;
  zMm: number;
  bottomMm: number;
  tier: 1 | 2;
};

export type SandwichTruckPlan = {
  number: number;
  placements: SandwichPlacement[];
  totalWeightKg: number;
  centerOfGravity: {
    xMm: number;
    zMm: number;
    heightAboveDeckMm: number;
  } | null;
  usedDeckAreaM2: number;
  deckCoveragePercent: number;
  payloadUsagePercent: number;
};

export type SandwichRejectedBundle = {
  bundle: SandwichBundle;
  reason: string;
};

export type SandwichLoadingPlan = {
  trucks: SandwichTruckPlan[];
  rejected: SandwichRejectedBundle[];
  warnings: string[];
  totalPlacedBundles: number;
  totalPlacedWeightKg: number;
};

type Position = {
  xMm: number;
  zMm: number;
  bottomMm: number;
  tier: 1 | 2;
};

type Candidate = {
  placement: SandwichPlacement;
  score: number;
};

const EPS = 0.001;

const {
  lengthMm: DECK_LENGTH,
  widthMm: DECK_WIDTH,
  deckHeightMm: DECK_HEIGHT,
  maxRoadHeightMm: MAX_ROAD_HEIGHT,
  payloadKg: MAX_PAYLOAD,
  minBundleGapMm: GAP,
} = SANDWICH_TRAILER;

function overlaps(
  aStart: number,
  aEnd: number,
  bStart: number,
  bEnd: number,
): boolean {
  return aStart < bEnd - EPS && aEnd > bStart + EPS;
}

function verticalOverlap(
  a: SandwichPlacement,
  b: SandwichPlacement,
): boolean {
  return overlaps(
    a.bottomMm,
    a.bottomMm + a.bundle.heightMm,
    b.bottomMm,
    b.bottomMm + b.bundle.heightMm,
  );
}

function axisDistance(
  aStart: number,
  aEnd: number,
  bStart: number,
  bEnd: number,
): number {
  return Math.max(
    0,
    bStart - aEnd,
    aStart - bEnd,
  );
}

function hasValidHorizontalGap(
  a: SandwichPlacement,
  b: SandwichPlacement,
): boolean {
  const xDistance = axisDistance(
    a.xMm,
    a.xMm + a.bundle.widthMm,
    b.xMm,
    b.xMm + b.bundle.widthMm,
  );

  const zDistance = axisDistance(
    a.zMm,
    a.zMm + a.bundle.lengthMm,
    b.zMm,
    b.zMm + b.bundle.lengthMm,
  );

  return (
    xDistance + EPS >= GAP ||
    zDistance + EPS >= GAP
  );
}

function isFullySupported(
  upper: SandwichPlacement,
  lower: SandwichPlacement,
): boolean {
  return (
    lower.tier === 1 &&
    Math.abs(
      upper.bottomMm -
        (lower.bottomMm + lower.bundle.heightMm),
    ) <= EPS &&
    upper.xMm >= lower.xMm - EPS &&
    upper.zMm >= lower.zMm - EPS &&
    upper.xMm + upper.bundle.widthMm <=
      lower.xMm + lower.bundle.widthMm + EPS &&
    upper.zMm + upper.bundle.lengthMm <=
      lower.zMm + lower.bundle.lengthMm + EPS
  );
}

function getPositions(
  bundle: SandwichBundle,
  placements: SandwichPlacement[],
): Position[] {
  const xPositions = new Set<number>([
    0,
    DECK_WIDTH - bundle.widthMm,
  ]);

  const zPositions = new Set<number>([
    0,
    DECK_LENGTH - bundle.lengthMm,
  ]);

  for (const placed of placements) {
    xPositions.add(
      placed.xMm + placed.bundle.widthMm + GAP,
    );

    xPositions.add(
      placed.xMm - bundle.widthMm - GAP,
    );

    zPositions.add(
      placed.zMm + placed.bundle.lengthMm + GAP,
    );

    zPositions.add(
      placed.zMm - bundle.lengthMm - GAP,
    );

    xPositions.add(placed.xMm);
    zPositions.add(placed.zMm);
  }

  const positions: Position[] = [];

  for (const xMm of xPositions) {
    for (const zMm of zPositions) {
      positions.push({
        xMm,
        zMm,
        bottomMm: 0,
        tier: 1,
      });
    }
  }

  for (const lower of placements) {
    if (lower.tier !== 1) continue;

    const bottomMm =
      lower.bottomMm + lower.bundle.heightMm;

    // Пока используем совпадающие начала пачек.
    // Это консервативнее произвольного смещения.
    positions.push({
      xMm: lower.xMm,
      zMm: lower.zMm,
      bottomMm,
      tier: 2,
    });
  }

  return positions;
}

function canPlace(
  bundle: SandwichBundle,
  position: Position,
  placements: SandwichPlacement[],
): boolean {
  const candidate: SandwichPlacement = {
    bundle,
    ...position,
  };

  if (
    !Number.isFinite(candidate.xMm) ||
    !Number.isFinite(candidate.zMm) ||
    !Number.isFinite(candidate.bottomMm) ||
    candidate.xMm < -EPS ||
    candidate.zMm < -EPS ||
    candidate.bottomMm < -EPS ||
    candidate.xMm + bundle.widthMm >
      DECK_WIDTH + EPS ||
    candidate.zMm + bundle.lengthMm >
      DECK_LENGTH + EPS
  ) {
    return false;
  }

  if (
    DECK_HEIGHT +
      candidate.bottomMm +
      bundle.heightMm >
    MAX_ROAD_HEIGHT + EPS
  ) {
    return false;
  }

  if (
    candidate.tier === 1 &&
    Math.abs(candidate.bottomMm) > EPS
  ) {
    return false;
  }

  if (candidate.tier === 2) {
    const supported = placements.some(
      (lower) => isFullySupported(candidate, lower),
    );

    if (!supported) return false;
  }

  for (const placed of placements) {
    if (!verticalOverlap(candidate, placed)) {
      continue;
    }

    if (!hasValidHorizontalGap(candidate, placed)) {
      return false;
    }
  }

  return true;
}

function calculateCenterOfGravity(
  placements: SandwichPlacement[],
): SandwichTruckPlan['centerOfGravity'] {
  const totalWeight = placements.reduce(
    (sum, placement) =>
      sum + placement.bundle.weightKg,
    0,
  );

  if (totalWeight <= 0) return null;

  let weightedX = 0;
  let weightedZ = 0;
  let weightedHeight = 0;

  for (const placement of placements) {
    const weight = placement.bundle.weightKg;

    weightedX +=
      (placement.xMm + placement.bundle.widthMm / 2) *
      weight;

    weightedZ +=
      (placement.zMm + placement.bundle.lengthMm / 2) *
      weight;

    weightedHeight +=
      (
        placement.bottomMm +
        placement.bundle.heightMm / 2
      ) * weight;
  }

  return {
    xMm: weightedX / totalWeight,
    zMm: weightedZ / totalWeight,
    heightAboveDeckMm:
      weightedHeight / totalWeight,
  };
}

function calculatePlacementScore(
  bundle: SandwichBundle,
  position: Position,
  existing: SandwichPlacement[],
): number {
  const candidate: SandwichPlacement = {
    bundle,
    ...position,
  };

  const combined = [...existing, candidate];
  const center = calculateCenterOfGravity(combined);

  const lateralOffset = center
    ? Math.abs(center.xMm - DECK_WIDTH / 2)
    : 0;

  const longitudinalOffset = center
    ? Math.abs(center.zMm - DECK_LENGTH / 2)
    : 0;

  const occupiedLength = Math.max(
    ...combined.map(
      (placement) =>
        placement.zMm + placement.bundle.lengthMm,
    ),
  ) - Math.min(
    ...combined.map(
      (placement) => placement.zMm,
    ),
  );

  // Предпочитаем первый ярус.
  // Затем учитываем компактность и центр тяжести.
  return (
    (position.tier === 2 ? 100000 : 0) +
    lateralOffset * 2 +
    longitudinalOffset * 0.4 +
    occupiedLength * 0.15
  );
}

function findBestPlacement(
  bundle: SandwichBundle,
  placements: SandwichPlacement[],
): Candidate | null {
  let best: Candidate | null = null;

  for (const position of getPositions(
    bundle,
    placements,
  )) {
    if (!canPlace(bundle, position, placements)) {
      continue;
    }

    const score = calculatePlacementScore(
      bundle,
      position,
      placements,
    );

    if (!best || score < best.score) {
      best = {
        placement: {
          bundle,
          ...position,
        },
        score,
      };
    }
  }

  return best;
}

function getBundleError(
  bundle: SandwichBundle,
): string | null {
  if (
    !Number.isFinite(bundle.lengthMm) ||
    !Number.isFinite(bundle.widthMm) ||
    !Number.isFinite(bundle.heightMm) ||
    !Number.isFinite(bundle.weightKg) ||
    bundle.lengthMm <= 0 ||
    bundle.widthMm <= 0 ||
    bundle.heightMm <= 0 ||
    bundle.weightKg <= 0
  ) {
    return 'Некорректные размеры или масса пачки.';
  }

  if (bundle.widthMm > DECK_WIDTH) {
    return 'Ширина пачки превышает ширину платформы.';
  }

  if (bundle.lengthMm > DECK_LENGTH) {
    return 'Длина пачки превышает платформу. Нужна отдельная схема продольного свеса.';
  }

  if (
    DECK_HEIGHT + bundle.heightMm >
    MAX_ROAD_HEIGHT
  ) {
    return 'Высота пачки превышает допустимый габарит от дороги.';
  }

  if (bundle.weightKg > MAX_PAYLOAD) {
    return 'Масса одной пачки превышает грузоподъёмность шаланды.';
  }

  return null;
}

function calculateTruckStats(
  number: number,
  placements: SandwichPlacement[],
): SandwichTruckPlan {
  const totalWeightKg = placements.reduce(
    (sum, placement) =>
      sum + placement.bundle.weightKg,
    0,
  );

  const usedDeckAreaM2 = placements
    .filter((placement) => placement.tier === 1)
    .reduce(
      (sum, placement) =>
        sum +
        (
          placement.bundle.lengthMm *
          placement.bundle.widthMm
        ) / 1_000_000,
      0,
    );

  const deckAreaM2 =
    (DECK_LENGTH * DECK_WIDTH) / 1_000_000;

  return {
    number,
    placements,
    totalWeightKg,
    centerOfGravity:
      calculateCenterOfGravity(placements),
    usedDeckAreaM2,
    deckCoveragePercent:
      (usedDeckAreaM2 / deckAreaM2) * 100,
    payloadUsagePercent:
      (totalWeightKg / MAX_PAYLOAD) * 100,
  };
}

export function planSandwichLoading(
  bundles: SandwichBundle[],
): SandwichLoadingPlan {
  const rejected: SandwichRejectedBundle[] = [];
  const warnings: string[] = [];

  const validBundles: SandwichBundle[] = [];

  for (const bundle of bundles) {
    const reason = getBundleError(bundle);

    if (reason) {
      rejected.push({ bundle, reason });
    } else {
      validBundles.push(bundle);
    }
  }

  // Сначала длинные и крупные пачки.
  // При одинаковой длине — более тяжёлые.
  const sorted = [...validBundles].sort(
    (a, b) =>
      b.lengthMm - a.lengthMm ||
      b.widthMm - a.widthMm ||
      b.weightKg - a.weightKg ||
      b.heightMm - a.heightMm,
  );

  const workingTrucks: SandwichPlacement[][] = [];

  for (const bundle of sorted) {
    let bestTruckIndex = -1;
    let bestCandidate: Candidate | null = null;
    let bestTruckScore = Infinity;

    for (
      let index = 0;
      index < workingTrucks.length;
      index++
    ) {
      const placements = workingTrucks[index];

      const currentWeight = placements.reduce(
        (sum, placement) =>
          sum + placement.bundle.weightKg,
        0,
      );

      if (
        currentWeight + bundle.weightKg >
        MAX_PAYLOAD + EPS
      ) {
        continue;
      }

      const candidate = findBestPlacement(
        bundle,
        placements,
      );

      if (!candidate) continue;

      // Выбираем подходящую существующую машину,
      // учитывая балансировку и использование массы.
      const remainingPayload =
        MAX_PAYLOAD -
        currentWeight -
        bundle.weightKg;

      const truckScore =
        candidate.score +
        remainingPayload * 0.02;

      if (truckScore < bestTruckScore) {
        bestTruckScore = truckScore;
        bestTruckIndex = index;
        bestCandidate = candidate;
      }
    }

    if (
      bestTruckIndex >= 0 &&
      bestCandidate !== null
    ) {
      workingTrucks[bestTruckIndex].push(
        bestCandidate.placement,
      );
      continue;
    }

    const candidate = findBestPlacement(
      bundle,
      [],
    );

    if (!candidate) {
      rejected.push({
        bundle,
        reason:
          'Не удалось найти допустимое геометрическое размещение.',
      });
      continue;
    }

    workingTrucks.push([candidate.placement]);
  }

  const trucks = workingTrucks.map(
    (placements, index) =>
      calculateTruckStats(index + 1, placements),
  );

  if (trucks.length > 1) {
    warnings.push(
      `Предварительно требуется ${trucks.length} шаланд.`,
    );
  }

  if (
    trucks.some((truck) =>
      truck.placements.some(
        (placement) => placement.tier === 2,
      ),
    )
  ) {
    warnings.push(
      'Использован второй ярус. Необходимо подтвердить допустимость штабелирования, прочность панелей, расположение опор и требования производителя.',
    );
  }

  if (rejected.length > 0) {
    warnings.push(
      `Не размещено пачек: ${rejected.length}. Проверьте причины отклонения.`,
    );
  }

  warnings.push(
    'Это предварительная геометрическая схема. Требуются отдельные проверки крепления, осевых нагрузок, опор, устойчивости и условий перевозки.',
  );

  return {
    trucks,
    rejected,
    warnings,
    totalPlacedBundles: trucks.reduce(
      (sum, truck) =>
        sum + truck.placements.length,
      0,
    ),
    totalPlacedWeightKg: trucks.reduce(
      (sum, truck) =>
        sum + truck.totalWeightKg,
      0,
    ),
  };
}
