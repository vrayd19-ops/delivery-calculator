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

type PolyFeature =
  GeoJSON.Feature<GeoJSON.Polygon>;

/*
 * Саму МКАД не тарифицируем.
 *
 * Маршрут может проходить по внешней стороне
 * МКАД немного за геометрической границей
 * полигона, поэтому оставляем бесплатный
 * коридор вокруг МКАД.
 */
const MKAD_FREE_CORRIDOR_KM = 0.35;

/*
 * Максимальная длина одного анализируемого
 * участка маршрута.
 *
 * 0.1 км = примерно 100 метров.
 *
 * Это позволяет точно определить момент,
 * когда автомобиль реально съехал с МКАД.
 */
const ANALYSIS_STEP_KM = 0.1;

export function getMkadPolygon(
  custom?: unknown
): PolyFeature {
  const candidate =
    (
      custom &&
      typeof custom === 'object'
        ? custom
        : bundledMkad
    ) as any;

  if (
    candidate.type === 'Feature' &&
    candidate.geometry?.type === 'Polygon'
  ) {
    return candidate;
  }

  throw new Error(
    'Некорректная геометрия МКАД'
  );
}

function pointIsFree(
  coord: Coordinate,
  mkad: PolyFeature
) {
  const currentPoint =
    point(coord);

  /*
   * Всё внутри МКАД бесплатно.
   */
  if (
    booleanPointInPolygon(
      currentPoint,
      mkad,
      {
        ignoreBoundary: false,
      }
    )
  ) {
    return true;
  }

  /*
   * Проверяем, находится ли точка
   * непосредственно на МКАД.
   */
  const boundary =
    polygonToLine(mkad);

  const distanceToBoundary =
    pointToLineDistance(
      currentPoint,
      boundary as any,
      {
        units: 'kilometers',
      }
    );

  return (
    distanceToBoundary <=
    MKAD_FREE_CORRIDOR_KM
  );
}

export function isInsideMkad(
  coord: Coordinate,
  custom?: unknown
) {
  return pointIsFree(
    coord,
    getMkadPolygon(custom)
  );
}

/*
 * Линейная интерполяция между двумя
 * координатами.
 *
 * Используется только для создания
 * коротких аналитических участков.
 */
function interpolate(
  start: Coordinate,
  end: Coordinate,
  ratio: number
): Coordinate {
  return [
    start[0] +
      (
        end[0] -
        start[0]
      ) *
        ratio,

    start[1] +
      (
        end[1] -
        start[1]
      ) *
        ratio,
  ];
}

export function splitRouteByMkad(
  coordinates: Coordinate[],
  custom?: unknown
): RouteBreakdown {
  if (
    coordinates.length < 2
  ) {
    throw new Error(
      'Недостаточно точек маршрута'
    );
  }

  const mkad =
    getMkadPolygon(custom);

  let insideKm = 0;
  let outsideKm = 0;

  const insideSegments:
    Coordinate[][] = [];

  const outsideSegments:
    Coordinate[][] = [];

  const crossings:
    Coordinate[] = [];

  let currentInside:
    Coordinate[] = [];

  let currentOutside:
    Coordinate[] = [];

  /*
   * Создаём детализированный маршрут.
   *
   * Даже если исходный маршрут содержит
   * только две далёкие точки, между ними
   * появятся дополнительные точки примерно
   * через каждые 100 метров.
   */
  const detailed:
    Coordinate[] = [
      coordinates[0],
    ];

  for (
    let i = 0;
    i <
    coordinates.length - 1;
    i++
  ) {
    const start =
      coordinates[i];

    const end =
      coordinates[i + 1];

    const originalSegment =
      lineString([
        start,
        end,
      ]);

    const segmentKm =
      length(
        originalSegment,
        {
          units:
            'kilometers',
        }
      );

    const parts =
      Math.max(
        1,
        Math.ceil(
          segmentKm /
            ANALYSIS_STEP_KM
        )
      );

    for (
      let part = 1;
      part <= parts;
      part++
    ) {
      detailed.push(
        interpolate(
          start,
          end,
          part / parts
        )
      );
    }
  }

  /*
   * Теперь классифицируем каждый
   * короткий отрезок.
   */
  let previousFree:
    boolean | undefined;

  for (
    let i = 0;
    i <
    detailed.length - 1;
    i++
  ) {
    const start =
      detailed[i];

    const end =
      detailed[i + 1];

    const segment =
      lineString([
        start,
        end,
      ]);

    const segmentKm =
      length(
        segment,
        {
          units:
            'kilometers',
        }
      );

    const midpoint:
      Coordinate = [
        (
          start[0] +
          end[0]
        ) / 2,

        (
          start[1] +
          end[1]
        ) / 2,
      ];

    const free =
      pointIsFree(
        midpoint,
        mkad
      );

    /*
     * Если статус изменился:
     *
     * внутри/МКАД → за МКАД
     *
     * или:
     *
     * за МКАД → МКАД/внутри
     *
     * сохраняем фактическую точку
     * начала или окончания платного
     * километража.
     */
    if (
      previousFree !==
        undefined &&
      free !== previousFree
    ) {
      crossings.push(
        start
      );
    }

    previousFree =
      free;

    if (free) {
      insideKm +=
        segmentKm;

      if (
        currentOutside.length >
        1
      ) {
        outsideSegments.push(
          currentOutside
        );
      }

      currentOutside =
        [];

      if (
        currentInside.length ===
        0
      ) {
        currentInside.push(
          start
        );
      }

      currentInside.push(
        end
      );
    } else {
      outsideKm +=
        segmentKm;

      if (
        currentInside.length >
        1
      ) {
        insideSegments.push(
          currentInside
        );
      }

      currentInside =
        [];

      if (
        currentOutside.length ===
        0
      ) {
        currentOutside.push(
          start
        );
      }

      currentOutside.push(
        end
      );
    }
  }

  if (
    currentInside.length >
    1
  ) {
    insideSegments.push(
      currentInside
    );
  }

  if (
    currentOutside.length >
    1
  ) {
    outsideSegments.push(
      currentOutside
    );
  }

  return {
    totalKm:
      insideKm +
      outsideKm,

    insideKm,

    outsideKm,

    crossings,

    insideSegments,

    outsideSegments,
  };
}