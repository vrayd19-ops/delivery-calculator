"use client";

import {
  useEffect,
  useRef,
} from "react";

declare global {
  interface Window {
    ymaps?: any;
    __yandexMapsPromise?: Promise<any>;
  }
}

type Coordinate = [
  number,
  number
];

type MapPoint = {
  displayAddress: string;
  latitude: number;
  longitude: number;
};

type RouteData = {
  coordinates?: Coordinate[];
  pricingCoordinates?: Coordinate[];
  insideSegments?: Coordinate[][];
  outsideSegments?: Coordinate[][];
  crossings?: Coordinate[];
};

function loadYandexMaps(
  apiKey: string
) {
  if (window.ymaps) {
    return Promise.resolve(
      window.ymaps
    );
  }

  if (
    window.__yandexMapsPromise
  ) {
    return window.__yandexMapsPromise;
  }

  window.__yandexMapsPromise =
    new Promise(
      (
        resolve,
        reject
      ) => {
        const existing =
          document.querySelector<HTMLScriptElement>(
            'script[data-yandex-maps="true"]'
          );

        if (existing) {
          const finish =
            () => {
              if (
                window.ymaps
              ) {
                resolve(
                  window.ymaps
                );
              } else {
                reject(
                  new Error(
                    "Яндекс API загрузился, но объект ymaps не найден"
                  )
                );
              }
            };

          if (
            window.ymaps
          ) {
            finish();
            return;
          }

          existing.addEventListener(
            "load",
            finish,
            {
              once: true,
            }
          );

          existing.addEventListener(
            "error",
            () => {
              reject(
                new Error(
                  "Ошибка загрузки Яндекс API"
                )
              );
            },
            {
              once: true,
            }
          );

          return;
        }

        const script =
          document.createElement(
            "script"
          );

        script.src =
          `https://api-maps.yandex.ru/2.1/?apikey=${encodeURIComponent(
            apiKey
          )}&lang=ru_RU`;

        script.async =
          true;

        script.defer =
          true;

        script.dataset.yandexMaps =
          "true";

        script.onload =
          () => {
            if (
              window.ymaps
            ) {
              resolve(
                window.ymaps
              );
            } else {
              reject(
                new Error(
                  "Яндекс API загрузился, но объект ymaps не найден"
                )
              );
            }
          };

        script.onerror =
          () => {
            reject(
              new Error(
                "Ошибка загрузки Яндекс API"
              )
            );
          };

        document.head.appendChild(
          script
        );
      }
    );

  return window.__yandexMapsPromise;
}


/*
 * Находим точку маршрута,
 * которая находится ближе всего
 * к координатам погрузки.
 */
function findNearestIndex(
  coordinates: Coordinate[],
  target: Coordinate
) {
  let bestIndex = 0;
  let bestDistance =
    Infinity;

  coordinates.forEach(
    (
      coordinate,
      index
    ) => {
      const dx =
        coordinate[0] -
        target[0];

      const dy =
        coordinate[1] -
        target[1];

      const distance =
        dx * dx +
        dy * dy;

      if (
        distance <
        bestDistance
      ) {
        bestDistance =
          distance;

        bestIndex =
          index;
      }
    }
  );

  return bestIndex;
}


export default function YandexMap({
  route,
  points = [],
}: {
  route?: RouteData;
  points?: MapPoint[];
}) {
  const mapRef =
    useRef<HTMLDivElement | null>(
      null
    );

  const mapInstance =
    useRef<any>(
      null
    );

  const routeObjects =
    useRef<any[]>(
      []
    );

  const pointsObjects =
    useRef<any[]>(
      []
    );


  /*
   * Инициализация карты.
   */
  useEffect(() => {
    let cancelled =
      false;

    async function initMap() {
      const apiKey =
        process.env
          .NEXT_PUBLIC_YANDEX_MAPS_API_KEY;

      if (!apiKey) {
        console.error(
          "Не задан NEXT_PUBLIC_YANDEX_MAPS_API_KEY"
        );

        return;
      }

      try {
        const ymaps =
          await loadYandexMaps(
            apiKey
          );

        await new Promise<void>(
          (
            resolve
          ) => {
            ymaps.ready(
              resolve
            );
          }
        );

        if (
          cancelled ||
          !mapRef.current
        ) {
          return;
        }

        if (
          !mapInstance.current
        ) {
          mapInstance.current =
            new ymaps.Map(
              mapRef.current,
              {
                center: [
                  55.7558,
                  37.6173,
                ],

                zoom:
                  10,

                controls: [
                  "zoomControl",
                ],
              }
            );
        }
      } catch (
        error
      ) {
        console.error(
          "YANDEX MAP ERROR:",
          error
        );
      }
    }

    initMap();

    return () => {
      cancelled =
        true;
    };
  }, []);


  /*
   * Пользовательские точки:
   *
   * погрузка,
   * дополнительные точки,
   * доставка.
   */
  useEffect(() => {
    if (
      !mapInstance.current ||
      !window.ymaps
    ) {
      return;
    }

    const ymaps =
      window.ymaps;

    const map =
      mapInstance.current;

    for (
      const object of
      pointsObjects.current
    ) {
      map.geoObjects.remove(
        object
      );
    }

    pointsObjects.current =
      [];

    points.forEach(
      (
        currentPoint,
        index
      ) => {
        const isLast =
          index ===
          points.length -
            1;

        const title =
          index === 0
            ? "Погрузка"
            : isLast
              ? "Доставка"
              : `Доп. точка ${index}`;

        const placemark =
          new ymaps.Placemark(
            [
              currentPoint.latitude,
              currentPoint.longitude,
            ],
            {
              iconCaption:
                title,

              balloonContent:
                `
                <strong>${title}</strong><br/>
                ${currentPoint.displayAddress}
                `,
            },
            {
              preset:
                index ===
                0
                  ? "islands#greenDotIconWithCaption"
                  : isLast
                    ? "islands#redDotIconWithCaption"
                    : "islands#blueDotIconWithCaption",
            }
          );

        map.geoObjects.add(
          placemark
        );

        pointsObjects.current.push(
          placemark
        );
      }
    );

    if (
      !route &&
      points.length >
        0
    ) {
      if (
        points.length ===
        1
      ) {
        map.setCenter(
          [
            points[0]
              .latitude,

            points[0]
              .longitude,
          ],
          13
        );
      } else {
        const bounds =
          ymaps.util.bounds.fromPoints(
            points.map(
              (
                currentPoint
              ) => [
                currentPoint.latitude,
                currentPoint.longitude,
              ]
            )
          );

        map.setBounds(
          bounds,
          {
            checkZoomRange:
              true,

            zoomMargin:
              60,
          }
        );
      }
    }
  }, [
    points,
    route,
  ]);


  /*
   * Маршрут.
   */
  useEffect(() => {
    if (
      !route ||
      !mapInstance.current ||
      !window.ymaps
    ) {
      return;
    }

    const ymaps =
      window.ymaps;

    const map =
      mapInstance.current;


    /*
     * Удаляем старые линии
     * и маркеры маршрута.
     */
    for (
      const object of
      routeObjects.current
    ) {
      map.geoObjects.remove(
        object
      );
    }

    routeObjects.current =
      [];


    const addPolyline = (
      coordinates:
        Coordinate[],

      width:
        number
    ) => {
      if (
        coordinates.length <
        2
      ) {
        return;
      }

      const converted =
        coordinates.map(
          (
            [
              lon,
              lat,
            ]
          ) => [
            lat,
            lon,
          ]
        );

      const polyline =
        new ymaps.Polyline(
          converted,
          {},
          {
            strokeWidth:
              width,
          }
        );

      map.geoObjects.add(
        polyline
      );

      routeObjects.current.push(
        polyline
      );
    };


    /*
     * Основной маршрут внутри МКАД.
     */
    for (
      const segment of
      route.insideSegments ??
      []
    ) {
      addPolyline(
        segment,
        4
      );
    }


    /*
     * Основной маршрут за МКАД.
     */
    for (
      const segment of
      route.outsideSegments ??
      []
    ) {
      addPolyline(
        segment,
        7
      );
    }


    /*
     * Если тарифный маршрут начинается
     * раньше обычного маршрута,
     * значит обе пользовательские
     * точки находятся за МКАД.
     *
     * Показываем ТОЛЬКО:
     *
     * МКАД → погрузка
     */
    if (
      route.pricingCoordinates &&
      route.pricingCoordinates.length >
        1 &&
      points.length >
        0
    ) {
      const pickup:
        Coordinate = [
        points[0]
          .longitude,

        points[0]
          .latitude,
      ];

      const pickupIndex =
        findNearestIndex(
          route.pricingCoordinates,
          pickup
        );

      /*
       * Если до погрузки действительно
       * существует отдельный участок.
       */
      if (
        pickupIndex >
        0
      ) {
        const mkadToPickup =
          route.pricingCoordinates.slice(
            0,
            pickupIndex +
              1
          );

        const converted =
          mkadToPickup.map(
            (
              [
                lon,
                lat,
              ]
            ) => [
              lat,
              lon,
            ]
          );

        const pricingPolyline =
          new ymaps.Polyline(
            converted,
            {
              hintContent:
                "МКАД → погрузка — платный километраж",
            },
            {
              strokeWidth:
                6,

              strokeStyle:
                "dash",
            }
          );

        map.geoObjects.add(
          pricingPolyline
        );

        routeObjects.current.push(
          pricingPolyline
        );


        /*
         * Первая координата тарифного
         * маршрута — точка старта
         * на МКАД.
         */
        const [
          startLon,
          startLat,
        ] =
          route.pricingCoordinates[
            0
          ];

        const startPlacemark =
          new ymaps.Placemark(
            [
              startLat,
              startLon,
            ],
            {
              iconCaption:
                "Старт тарификации",

              balloonContent:
                `
                <strong>МКАД — начало тарификации</strong><br/>
                От этой точки считается расстояние до погрузки,
                а затем до выгрузки.
                `,
            },
            {
              preset:
                "islands#yellowDotIconWithCaption",
            }
          );

        map.geoObjects.add(
          startPlacemark
        );

        routeObjects.current.push(
          startPlacemark
        );
      }
    }


    /*
     * Обычные точки пересечения МКАД.
     */
    for (
      const [
        lon,
        lat,
      ] of
      route.crossings ??
      []
    ) {
      const placemark =
        new ymaps.Placemark(
          [
            lat,
            lon,
          ],
          {
            iconCaption:
              "МКАД",

            balloonContent:
              "МКАД — граница тарификации",
          },
          {
            preset:
              "islands#yellowDotIconWithCaption",
          }
        );

      map.geoObjects.add(
        placemark
      );

      routeObjects.current.push(
        placemark
      );
    }


    /*
     * Если есть расширенный тарифный
     * маршрут — масштабируем карту
     * по нему.
     */
    const boundsSource =
      route.pricingCoordinates &&
      route.pricingCoordinates.length >
        1
        ? route.pricingCoordinates
        : route.coordinates;

    if (
      boundsSource &&
      boundsSource.length >
        1
    ) {
      const bounds =
        ymaps.util.bounds.fromPoints(
          boundsSource.map(
            (
              [
                lon,
                lat,
              ]
            ) => [
              lat,
              lon,
            ]
          )
        );

      map.setBounds(
        bounds,
        {
          checkZoomRange:
            true,

          zoomMargin:
            50,
        }
      );
    }
  }, [
    route,
    points,
  ]);


  return (
    <div
      ref={
        mapRef
      }
      style={{
        width:
          "100%",

        height:
          "500px",

        borderRadius:
          "12px",

        overflow:
          "hidden",
      }}
    />
  );
}