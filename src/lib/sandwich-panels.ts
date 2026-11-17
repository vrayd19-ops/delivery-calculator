
export type SandwichInsulation = 'MINERAL_WOOL' | 'PIR_PUR' | 'EPS';

export type SandwichPanelType = 'WALL_SMOOTH' | 'WALL_MICRO' | 'ROOF_TRAPEZOID';

export type ValueSource = 'MANUFACTURER' | 'MANAGER' | 'ESTIMATE';

export type SandwichPanel = {
  id: string;
  insulation: SandwichInsulation;
  panelType: SandwichPanelType;
  lengthMm: number;
  mountingWidthMm: number;
  actualWidthMm: number;
  thicknessMm: number;
  quantity: number;
  insulationDensityKgM3: number;
  outerSteelThicknessMm: number;
  innerSteelThicknessMm: number;
  outerRal: string;
  innerRal: string;
  roofRibHeightMm: number;
  roofRibCount: number;
  actualUnitWeightKg?: number;
  panelsPerBundle?: number;
};

export type SandwichBundle = {
  id: string;
  panelId: string;
  quantity: number;
  lengthMm: number;
  widthMm: number;
  heightMm: number;
  weightKg: number;
  usefulAreaM2: number;
  geometricAreaM2: number;
  fullBundle: boolean;
  supportCount: number;
  source: ValueSource;
};

export type SandwichCalculation = {
  bundles: SandwichBundle[];
  totalPanels: number;
  totalWeightKg: number;
  totalUsefulAreaM2: number;
  totalGeometricAreaM2: number;
  warnings: string[];
};

export const SANDWICH_TRAILER = {
  lengthMm: 13500,
  widthMm: 2450,
  deckHeightMm: 1300,
  maxRoadHeightMm: 4000,
  payloadKg: 20000,
  minBundleGapMm: 50,
} as const;

export const INSULATION_DENSITIES: Record<SandwichInsulation, number> = {
  MINERAL_WOOL: 110,
  PIR_PUR: 40,
  EPS: 20,
};

export const STEEL_DENSITY_KG_M3 = 7850;

const FACTORY_BUNDLE_CAPACITY: Record<number, number> = {
  50: 24,
  60: 20,
  80: 14,
  100: 12,
  120: 10,
  150: 8,
  200: 6,
  250: 4,
};

const ROOF_BUNDLE_CAPACITY: Record<number, number> = {
  50: 24,
  60: 20,
  80: 14,
  100: 10,
  150: 7,
};

export function getRecommendedBundleCapacity(
  thicknessMm: number,
  panelType: SandwichPanelType,
): number {
  const reference =
    panelType === 'ROOF_TRAPEZOID'
      ? ROOF_BUNDLE_CAPACITY
      : FACTORY_BUNDLE_CAPACITY;

  if (reference[thicknessMm]) {
    return reference[thicknessMm];
  }

  return Math.max(1, Math.floor(1200 / thicknessMm));
}

export function calculatePanelAreas(panel: SandwichPanel) {
  const lengthM = panel.lengthMm / 1000;

  return {
    usefulAreaM2: lengthM * (panel.mountingWidthMm / 1000),
    geometricAreaM2: lengthM * (panel.actualWidthMm / 1000),
  };
}

export function calculatePanelWeightKg(panel: SandwichPanel): number {
  if (
    panel.actualUnitWeightKg !== undefined &&
    Number.isFinite(panel.actualUnitWeightKg) &&
    panel.actualUnitWeightKg > 0
  ) {
    return panel.actualUnitWeightKg;
  }

  const areaM2 =
    (panel.lengthMm / 1000) * (panel.actualWidthMm / 1000);

  const insulationThicknessMm = Math.max(
    0,
    panel.thicknessMm -
      panel.outerSteelThicknessMm -
      panel.innerSteelThicknessMm,
  );

  const insulationMassKg =
    areaM2 *
    (insulationThicknessMm / 1000) *
    panel.insulationDensityKgM3;

  const steelMassKg =
    areaM2 *
    ((panel.outerSteelThicknessMm + panel.innerSteelThicknessMm) / 1000) *
    STEEL_DENSITY_KG_M3;

  return insulationMassKg + steelMassKg;
}

export function getBundleSupportCount(lengthMm: number): number {
  if (lengthMm <= 4000) return 2;
  if (lengthMm <= 8000) return 3;
  if (lengthMm <= 12000) return 4;
  return 5;
}

export function calculateBundleHeightMm(
  panel: SandwichPanel,
  quantity: number,
): number {
  const supportHeightMm = 100;

  const panelStackHeightMm = panel.thicknessMm * quantity;

  const roofExtraMm =
    panel.panelType === 'ROOF_TRAPEZOID'
      ? panel.roofRibHeightMm
      : 0;

  return supportHeightMm + panelStackHeightMm + roofExtraMm;
}

export function createSandwichBundles(
  panel: SandwichPanel,
): SandwichBundle[] {
  if (
    !Number.isFinite(panel.lengthMm) ||
    !Number.isFinite(panel.actualWidthMm) ||
    !Number.isFinite(panel.thicknessMm) ||
    !Number.isInteger(panel.quantity) ||
    panel.lengthMm <= 0 ||
    panel.actualWidthMm <= 0 ||
    panel.thicknessMm <= 0 ||
    panel.quantity <= 0
  ) {
    return [];
  }

  const recommendedCapacity = getRecommendedBundleCapacity(
    panel.thicknessMm,
    panel.panelType,
  );

  const capacity =
    panel.panelsPerBundle !== undefined &&
    Number.isInteger(panel.panelsPerBundle) &&
    panel.panelsPerBundle > 0
      ? panel.panelsPerBundle
      : recommendedCapacity;

  const bundles: SandwichBundle[] = [];

  const areas = calculatePanelAreas(panel);
  const unitWeightKg = calculatePanelWeightKg(panel);

  let remaining = panel.quantity;
  let index = 1;

  while (remaining > 0) {
    const quantity = Math.min(capacity, remaining);

    bundles.push({
      id: `${panel.id}-bundle-${index}`,
      panelId: panel.id,
      quantity,
      lengthMm: panel.lengthMm,
      widthMm: panel.actualWidthMm,
      heightMm: calculateBundleHeightMm(panel, quantity),
      weightKg: unitWeightKg * quantity,
      usefulAreaM2: areas.usefulAreaM2 * quantity,
      geometricAreaM2: areas.geometricAreaM2 * quantity,
      fullBundle: quantity === capacity,
      supportCount: getBundleSupportCount(panel.lengthMm),
      source:
        panel.panelsPerBundle !== undefined
          ? 'MANAGER'
          : 'ESTIMATE',
    });

    remaining -= quantity;
    index++;
  }

  return bundles;
}

export function calculateSandwichCargo(
  panels: SandwichPanel[],
): SandwichCalculation {
  const bundles = panels.flatMap(createSandwichBundles);

  const totalPanels = bundles.reduce(
    (sum, bundle) => sum + bundle.quantity,
    0,
  );

  const totalWeightKg = bundles.reduce(
    (sum, bundle) => sum + bundle.weightKg,
    0,
  );

  const totalUsefulAreaM2 = bundles.reduce(
    (sum, bundle) => sum + bundle.usefulAreaM2,
    0,
  );

  const totalGeometricAreaM2 = bundles.reduce(
    (sum, bundle) => sum + bundle.geometricAreaM2,
    0,
  );

  const warnings: string[] = [];

  for (const bundle of bundles) {
    if (bundle.lengthMm > SANDWICH_TRAILER.lengthMm) {
      warnings.push(
        `Пачка ${bundle.id}: длина превышает длину платформы. Требуется отдельная проверка свеса и условий перевозки.`,
      );
    }

    if (bundle.widthMm > SANDWICH_TRAILER.widthMm) {
      warnings.push(
        `Пачка ${bundle.id}: ширина превышает ширину платформы.`,
      );
    }

    if (
      SANDWICH_TRAILER.deckHeightMm + bundle.heightMm >
      SANDWICH_TRAILER.maxRoadHeightMm
    ) {
      warnings.push(
        `Пачка ${bundle.id}: превышена допустимая высота от дороги.`,
      );
    }
  }

  if (totalWeightKg > SANDWICH_TRAILER.payloadKg) {
    warnings.push(
      'Общая масса превышает грузоподъёмность одной шаланды. Требуется распределение по нескольким машинам.',
    );
  }

  return {
    bundles,
    totalPanels,
    totalWeightKg,
    totalUsefulAreaM2,
    totalGeometricAreaM2,
    warnings,
  };
}
