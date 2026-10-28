import {
  booleanPointInPolygon,
  length,
  lineString,
  point,
  pointToLineDistance,
} from '@turf/turf';

import bundledMkad from '@/data/mkad.json';

import type { Coordinate, RouteBreakdown } from './types';

type PolyFeature = GeoJSON.Feature<GeoJSON.Polygon>;
type Segment = [Coordinate, Coordinate];

type BoundaryIndex = {
  cells: Map<string, number[]>;
  segments: Segment[];
  minLon: number;
  maxLon: number;
  minLat: number;
  maxLat: number;
};

const MKAD_FREE_CORRIDOR_KM = 0.35;
const ANALYSIS_STEP_KM = 0.1;

// Ячейка примерно 1,1 км по широте в районе Москвы.
const CELL_DEGREES = 0.01;
// Консервативная область поиска: больше 350 м даже на широте 60°.
const SEARCH_LAT_DEGREES = 0.004;
const SEARCH_LON_DEGREES = 0.009;

const indexCache = new WeakMap<PolyFeature, BoundaryIndex>();

export function getMkadPolygon(custom?: unknown): PolyFeature {
  const candidate = (
    custom && typeof custom === 'object' ? custom : bundledMkad
  ) as any;

  if (
    candidate.type === 'Feature' &&
    candidate.geometry?.type === 'Polygon'
  ) {
    return candidate as PolyFeature;
  }

  throw new Error('Некорректная геометрия МКАД');
}

function cellNumber(value: number): number {
  return Math.floor(value / CELL_DEGREES);
}

function cellKey(x: number, y: number): string {
  return `${x}:${y}`;
}

function getBoundaryIndex(mkad: PolyFeature): BoundaryIndex {
  const cached = indexCache.get(mkad);
  if (cached) return cached;

  const cells = new Map<string, number[]>();
  const segments: Segment[] = [];
  let minLon = Infinity;
  let maxLon = -Infinity;
  let minLat = Infinity;
  let maxLat = -Infinity;

  for (const ring of mkad.geometry.coordinates) {
    for (let i = 0; i < ring.length - 1; i++) {
      const a = ring[i] as Coordinate;
      const b = ring[i + 1] as Coordinate;
      const id = segments.length;
      segments.push([a, b]);

      const left = Math.min(a[0], b[0]);
      const right = Math.max(a[0], b[0]);
      const bottom = Math.min(a[1], b[1]);
      const top = Math.max(a[1], b[1]);

      minLon = Math.min(minLon, left);
      maxLon = Math.max(maxLon, right);
      minLat = Math.min(minLat, bottom);
      maxLat = Math.max(maxLat, top);

      for (let x = cellNumber(left); x <= cellNumber(right); x++) {
        for (let y = cellNumber(bottom); y <= cellNumber(top); y++) {
          const key = cellKey(x, y);
          const bucket = cells.get(key);
          if (bucket) bucket.push(id);
          else cells.set(key, [id]);
        }
      }
    }
  }

  if (!segments.length) throw new Error('Пустая граница МКАД');

  const result: BoundaryIndex = {
    cells, segments, minLon, maxLon, minLat, maxLat,
  };
  indexCache.set(mkad, result);
  return result;
}

function pointIsFree(
  coord: Coordinate,
  mkad: PolyFeature,
  index: BoundaryIndex
): boolean {
  const [lon, lat] = coord;

  // Далеко от МКАД: не создаём Turf-объекты и не проверяем полигон.
  if (
    lon < index.minLon - SEARCH_LON_DEGREES ||
    lon > index.maxLon + SEARCH_LON_DEGREES ||
    lat < index.minLat - SEARCH_LAT_DEGREES ||
    lat > index.maxLat + SEARCH_LAT_DEGREES
  ) {
    return false;
  }

  const currentPoint = point(coord);
  if (booleanPointInPolygon(currentPoint, mkad, { ignoreBoundary: false })) {
    return true;
  }

  // Только сегменты границы, попадающие в соседние ячейки.
  const candidateIds = new Set<number>();
  const x0 = cellNumber(lon - SEARCH_LON_DEGREES);
  const x1 = cellNumber(lon + SEARCH_LON_DEGREES);
  const y0 = cellNumber(lat - SEARCH_LAT_DEGREES);
  const y1 = cellNumber(lat + SEARCH_LAT_DEGREES);

  for (let x = x0; x <= x1; x++) {
    for (let y = y0; y <= y1; y++) {
      const bucket = index.cells.get(cellKey(x, y));
      if (bucket) for (const id of bucket) candidateIds.add(id);
    }
  }

  if (!candidateIds.size) return false;

  // Для ближайших сегментов используем прежнюю Turf-формулу расстояния.
  // Быстрый выход при попадании в бесплатный коридор.
  for (const id of candidateIds) {
    if (
      pointToLineDistance(
        currentPoint,
        lineString(index.segments[id]),
        { units: 'kilometers' }
      ) <= MKAD_FREE_CORRIDOR_KM
    ) {
      return true;
    }
  }

  return false;
}

export function isInsideMkad(coord: Coordinate, custom?: unknown): boolean {
  const mkad = getMkadPolygon(custom);
  return pointIsFree(coord, mkad, getBoundaryIndex(mkad));
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
  const index = getBoundaryIndex(mkad);

  let insideKm = 0;
  let outsideKm = 0;
  const insideSegments: Coordinate[][] = [];
  const outsideSegments: Coordinate[][] = [];
  const crossings: Coordinate[] = [];
  let currentInside: Coordinate[] = [];
  let currentOutside: Coordinate[] = [];
  const detailed: Coordinate[] = [coordinates[0]];

  // Сохраняем прежний алгоритм детализации и вычисления длин.
  for (let i = 0; i < coordinates.length - 1; i++) {
    const start = coordinates[i];
    const end = coordinates[i + 1];
    const segmentKm = length(lineString([start, end]), {
      units: 'kilometers',
    });
    const parts = Math.max(1, Math.ceil(segmentKm / ANALYSIS_STEP_KM));
    for (let part = 1; part <= parts; part++) {
      detailed.push(interpolate(start, end, part / parts));
    }
  }

  let previousFree: boolean | undefined;

  for (let i = 0; i < detailed.length - 1; i++) {
    const start = detailed[i];
    const end = detailed[i + 1];
    const segmentKm = length(lineString([start, end]), {
      units: 'kilometers',
    });
    const midpoint: Coordinate = [
      (start[0] + end[0]) / 2,
      (start[1] + end[1]) / 2,
    ];
    const free = pointIsFree(midpoint, mkad, index);

    if (previousFree !== undefined && free !== previousFree) {
      crossings.push(start);
    }
    previousFree = free;

    if (free) {
      insideKm += segmentKm;
      if (currentOutside.length > 1) outsideSegments.push(currentOutside);
      currentOutside = [];
      if (currentInside.length === 0) currentInside.push(start);
      currentInside.push(end);
    } else {
      outsideKm += segmentKm;
      if (currentInside.length > 1) insideSegments.push(currentInside);
      currentInside = [];
      if (currentOutside.length === 0) currentOutside.push(start);
      currentOutside.push(end);
    }
  }

  if (currentInside.length > 1) insideSegments.push(currentInside);
  if (currentOutside.length > 1) outsideSegments.push(currentOutside);

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
