import type {
  AddressPoint,
  Coordinate,
  RouteResult,
} from './types';

function requireKey(name: string) {
  const value = process.env[name];

  if (!value) {
    throw new Error(`Не настроена переменная ${name}`);
  }

  return value;
}

export async function suggestAddress(text: string) {
  const key = requireKey('YANDEX_GEOSUGGEST_API_KEY');

  const url = new URL(
    'https://suggest-maps.yandex.ru/v1/suggest'
  );

  url.searchParams.set('apikey', key);
  url.searchParams.set('text', text);
  url.searchParams.set('lang', 'ru_RU');
  url.searchParams.set('print_address', '1');

  const response = await fetch(url.toString(), {
    method: 'GET',
    cache: 'no-store',
  });

  if (!response.ok) {
    throw new Error(
      `Geosuggest: Яндекс вернул ${response.status}`
    );
  }

  const data = await response.json();

  return (data.results ?? []).map((item: any) => ({
    title:
      item.title?.text ??
      item.text ??
      '',

    subtitle:
      item.subtitle?.text ??
      '',

    address:
      item.address?.formatted_address ??
      item.text ??
      '',

    uri:
      item.uri ?? null,
  }));
}

export async function geocodeAddress(
  input: {
    text?: string;
    uri?: string;
  }
): Promise<AddressPoint[]> {
  const key = requireKey('YANDEX_GEOCODER_API_KEY');

  const url = new URL(
    'https://geocode-maps.yandex.ru/v1/'
  );

  url.searchParams.set('apikey', key);
  url.searchParams.set('lang', 'ru_RU');
  url.searchParams.set('format', 'json');
  url.searchParams.set('results', '5');

 if (input.uri) {
  /*
   * Если адрес был выбран из Геосаджеста,
   * используем точный URI выбранного объекта.
   *
   * Это не дает Геокодеру выбрать другой
   * одноименный адрес.
   */
  url.searchParams.set(
    'uri',
    input.uri
  );

  /*
   * geocode является обязательным
   * параметром API, поэтому передаем
   * текст выбранного адреса дополнительно.
   */
  url.searchParams.set(
    'geocode',
    input.text || ''
  );

  /*
   * Нам нужен именно выбранный объект.
   */
  url.searchParams.set(
    'results',
    '1'
  );
} else {
  url.searchParams.set(
    'geocode',
    input.text || ''
  );
}

  url.searchParams.set(
    'bbox',
    '36.7,54.7~39.3,56.6'
  );

  const response = await fetch(url.toString(), {
    method: 'GET',
    cache: 'no-store',
  });

  if (!response.ok) {
    throw new Error(
      `Geocoder: Яндекс вернул ${response.status}`
    );
  }

  const data = await response.json();

  const members =
    data.response?.GeoObjectCollection?.featureMember ?? [];

  return members.map((member: any) => {
    const geoObject = member.GeoObject;

    const [longitude, latitude] =
      String(geoObject.Point.pos)
        .split(' ')
        .map(Number);

    const meta =
      geoObject.metaDataProperty?.GeocoderMetaData;

    return {
      displayAddress:
        meta?.text ??
        geoObject.name,

      normalizedAddress:
        meta?.Address?.formatted ??
        meta?.text ??
        geoObject.name,

      longitude,
      latitude,

      uri:
        geoObject.uri,
    };
  });
}

export async function buildDrivingRoute(
  points: Coordinate[],
  _truck?: {
    weight?: number;
    width?: number;
    length?: number;
    payload?: number;
  }
): Promise<RouteResult> {
  if (points.length < 2) {
    throw new Error(
      'Для построения маршрута нужно минимум две точки'
    );
  }

  const baseUrl =
    process.env.OSRM_BASE_URL ||
    'http://localhost:5000';

  /*
   * Coordinate внутри приложения:
   * [longitude, latitude]
   *
   * OSRM использует тот же порядок:
   * longitude,latitude
   */
  const coordinatesString = points
    .map(
      ([longitude, latitude]) =>
        `${longitude},${latitude}`
    )
    .join(';');

  const url = new URL(
    `/route/v1/driving/${coordinatesString}`,
    baseUrl
  );

  url.searchParams.set(
    'overview',
    'full'
  );

  url.searchParams.set(
    'geometries',
    'geojson'
  );

  url.searchParams.set(
    'steps',
    'false'
  );
  url.searchParams.set(
  'exclude',
  'toll'
);

  const response = await fetch(url.toString(), {
    method: 'GET',
    cache: 'no-store',
  });

  if (!response.ok) {
    throw new Error(
      `OSRM: сервер маршрутизации вернул ${response.status}`
    );
  }

  const data = await response.json();

  if (
    data.code !== 'Ok' ||
    !data.routes?.length
  ) {
    throw new Error(
      data.message ||
      'OSRM не смог построить маршрут'
    );
  }

  const bestRoute = data.routes[0];

  const coordinates =
    bestRoute.geometry?.coordinates as Coordinate[];

  if (
    !Array.isArray(coordinates) ||
    coordinates.length < 2
  ) {
    throw new Error(
      'OSRM не вернул геометрию маршрута'
    );
  }

  return {
    coordinates,
    totalMeters:
      Number(bestRoute.distance || 0),
    status: 'OK',
  };
}