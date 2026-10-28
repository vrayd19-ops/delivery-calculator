import {
  booleanPointInPolygon,
  length,
  lineString,
  point,
  pointToLineDistance,
  polygonToLine,
} from '@turf/turf';

import bundledMkad from '@/data/mkad.json';

import type {
  Coordinate,
  RouteBreakdown,
} from './types';

type PolyFeature = GeoJSON.Feature<GeoJSON.Polygon>;

type MkadBoundary = ReturnType<typeof polygonToLine>;

const MKAD_FREE_CORRIDOR_KM = 0.35;
const ANALYSIS_STEP_KM = 0.1;

export function getMkadPolygon(custom?: unknown): PolyFeature {
  const candidate = (
    custom && typeof custom === 'object'
      ? custom
      : bundledMkad
  ) as any;

  if (
    candidate.type === 'Feature' &&
    candidate.geometry?.type === 'Polygon'
  ) {
    return candidate;
  }

  throw new Error('Некорректная геометрия МКАД');
}

/**
 * Граница создаётся один раз на весь анализ, а не на каждую точку.
 * Геометрические правила остались прежними.
 */
function pointIsFree(
  coord: Coordinate,
  mkad: PolyFeature,
  boundary: MkadBoundary
): boolean {
  const currentPoint = point(coord);

  if (
    booleanPointInPolygon(currentPoint, mkad, {
      ignoreBoundary: false,
    })
  ) {
    return true;
  }

  const distanceToBoundary = pointToLineDistance(
    currentPoint,
    boundary as any,
    { units: 'kilometers' }
  );

  return distanceToBoundary <= MKAD_FREE_CORRIDOR_KM;
}

export function isInsideMkad(
  coord: Coordinate,
  custom?: unknown
): boolean {
  const mkad = getMkadPolygon(custom);
  const boundary = polygonToLine(mkad);
  return pointIsFree(coord, mkad, boundary);
}

function interpolate(
  start: Coordinate,
  end: Coordinate,
  ratio: number
): Coordinate {
  return [
    start[0] + (end[0] - start[0]) * ratio,
    start[1] + (end[1] - start[1]) * ratio,
  ];
}

export function splitRouteByMkad(
  coordinates: Coordinate[],
  custom?: unknown
): RouteBreakdown {
  if (coordinates.length < 2) {
    throw new Error('Недостаточно точек маршрута');
  }

  const startedAt = performance.now();
  const mkad = getMkadPolygon(custom);
  const boundary = polygonToLine(mkad);

  let insideKm = 0;
  let outsideKm = 0;

  const insideSegments: Coordinate[][] = [];
  const outsideSegments: Coordinate[][] = [];
  const crossings: Coordinate[] = [];

  let currentInside: Coordinate[] = [];
  let currentOutside: Coordinate[] = [];

  const detailed: Coordinate[] = [coordinates[0]];

  for (let i = 0; i < coordinates.length - 1; i++) {
    const start = coordinates[i];
    const end = coordinates[i + 1];

    const originalSegment = lineString([start, end]);
    const segmentKm = length(originalSegment, {
      units: 'kilometers',
    });

    const parts = Math.max(
      1,
      Math.ceil(segmentKm / ANALYSIS_STEP_KM)
    );

    for (let part = 1; part <= parts; part++) {
      detailed.push(interpolate(start, end, part / parts));
    }
  }

  let previousFree: boolean | undefined;

  for (let i = 0; i < detailed.length - 1; i++) {
    const start = detailed[i];
    const end = detailed[i + 1];

    const segment = lineString([start, end]);
    const segmentKm = length(segment, {
      units: 'kilometers',
    });

    const midpoint: Coordinate = [
      (start[0] + end[0]) / 2,
      (start[1] + end[1]) / 2,
    ];

    const free = pointIsFree(midpoint, mkad, boundary);

    if (
      previousFree !== undefined &&
      free !== previousFree
    ) {
      crossings.push(start);
    }

    previousFree = free;

    if (free) {
      insideKm += segmentKm;

      if (currentOutside.length > 1) {
        outsideSegments.push(currentOutside);
      }
      currentOutside = [];

      if (currentInside.length === 0) {
        currentInside.push(start);
      }
      currentInside.push(end);
    } else {
      outsideKm += segmentKm;

      if (currentInside.length > 1) {
        insideSegments.push(currentInside);
      }
      currentInside = [];

      if (currentOutside.length === 0) {
        currentOutside.push(start);
      }
      currentOutside.push(end);
    }
  }

  if (currentInside.length > 1) {
    insideSegments.push(currentInside);
  }

  if (currentOutside.length > 1) {
    outsideSegments.push(currentOutside);
  }

  console.info('MKAD TIMING split-completed', {
    elapsedMs: Math.round(performance.now() - startedAt),
    sourcePoints: coordinates.length,
    detailedPoints: detailed.length,
    crossings: crossings.length,
  });

  return {
    totalKm: insideKm + outsideKm,
    insideKm,
    outsideKm,
    crossings,
    insideSegments,
    outsideSegments,
  };
}
