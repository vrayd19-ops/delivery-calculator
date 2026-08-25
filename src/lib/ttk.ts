import {
  booleanPointInPolygon,
  point,
} from '@turf/turf';

import bundledTtk from '@/data/ttk.json';

import type {
  Coordinate,
} from './types';

type TtkPolygon =
  GeoJSON.Feature<GeoJSON.Polygon>;

export function getTtkPolygon(
  custom?: unknown
): TtkPolygon {
  const candidate =
    custom &&
    typeof custom === 'object'
      ? custom
      : bundledTtk;

  if (
    (candidate as any).type === 'Feature' &&
    (candidate as any).geometry?.type === 'Polygon'
  ) {
    return candidate as TtkPolygon;
  }

  throw new Error(
    'Некорректная геометрия ТТК'
  );
}

export function isInsideTtk(
  coordinate: Coordinate,
  custom?: unknown
) {
  return booleanPointInPolygon(
    point(coordinate),
    getTtkPolygon(custom),
    {
      ignoreBoundary: false,
    }
  );
}

export function hasPointInsideTtk(
  coordinates: Coordinate[],
  custom?: unknown
) {
  const polygon =
    getTtkPolygon(custom);

  return coordinates.some(
    (coordinate) =>
      booleanPointInPolygon(
        point(coordinate),
        polygon,
        {
          ignoreBoundary: false,
        }
      )
  );
}