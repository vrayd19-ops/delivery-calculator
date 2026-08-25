const fs = require('fs');
const path = require('path');

const SOURCE = path.resolve(
  __dirname,
  '../src/data/ttk-osm.json'
);

const OUTPUT = path.resolve(
  __dirname,
  '../src/data/ttk.json'
);

const data = JSON.parse(
  fs.readFileSync(
    SOURCE,
    'utf8'
  )
);

const relation = data.elements.find(
  (item) =>
    item.type === 'relation' &&
    item.id === 2094286
);

if (!relation) {
  throw new Error(
    'Relation ТТК 2094286 не найдена'
  );
}

const nodeMap = new Map();

for (const element of data.elements) {
  if (
    element.type === 'node' &&
    typeof element.lon === 'number' &&
    typeof element.lat === 'number'
  ) {
    nodeMap.set(
      element.id,
      [
        element.lon,
        element.lat,
      ]
    );
  }
}

const wayMap = new Map();

for (const element of data.elements) {
  if (
    element.type === 'way' &&
    Array.isArray(element.nodes)
  ) {
    wayMap.set(
      element.id,
      element.nodes
    );
  }
}

const memberWayIds =
  relation.members
    .filter(
      (member) =>
        member.type === 'way'
    )
    .map(
      (member) =>
        member.ref
    );

const ways = [];

for (const wayId of memberWayIds) {
  const nodeIds =
    wayMap.get(wayId);

  if (
    !nodeIds ||
    nodeIds.length < 2
  ) {
    continue;
  }

  const coordinates =
    nodeIds
      .map(
        (nodeId) =>
          nodeMap.get(nodeId)
      )
      .filter(Boolean);

  if (
    coordinates.length >= 2
  ) {
    ways.push({
      id: wayId,
      coordinates,
    });
  }
}

if (!ways.length) {
  throw new Error(
    'Не удалось получить участки ТТК'
  );
}

function samePoint(a, b) {
  return (
    a[0] === b[0] &&
    a[1] === b[1]
  );
}

function cloneCoordinates(
  coordinates
) {
  return coordinates.map(
    (point) => [
      point[0],
      point[1],
    ]
  );
}

/*
 * Собираем отдельные цепочки,
 * соединяя ways по общим конечным узлам.
 */
const unused =
  ways.map(
    (way) => ({
      id: way.id,
      coordinates:
        cloneCoordinates(
          way.coordinates
        ),
    })
  );

const chains = [];

while (unused.length) {
  const first =
    unused.shift();

  let chain =
    first.coordinates;

  let changed = true;

  while (changed) {
    changed = false;

    const chainStart =
      chain[0];

    const chainEnd =
      chain[
        chain.length - 1
      ];

    for (
      let i = 0;
      i < unused.length;
      i++
    ) {
      const candidate =
        unused[i]
          .coordinates;

      const candidateStart =
        candidate[0];

      const candidateEnd =
        candidate[
          candidate.length - 1
        ];

      /*
       * chainEnd -> candidateStart
       */
      if (
        samePoint(
          chainEnd,
          candidateStart
        )
      ) {
        chain.push(
          ...candidate.slice(1)
        );

        unused.splice(
          i,
          1
        );

        changed = true;
        break;
      }

      /*
       * chainEnd -> reversed candidate
       */
      if (
        samePoint(
          chainEnd,
          candidateEnd
        )
      ) {
        const reversed =
          [...candidate]
            .reverse();

        chain.push(
          ...reversed.slice(1)
        );

        unused.splice(
          i,
          1
        );

        changed = true;
        break;
      }

      /*
       * candidateEnd -> chainStart
       */
      if (
        samePoint(
          candidateEnd,
          chainStart
        )
      ) {
        chain = [
          ...candidate.slice(
            0,
            -1
          ),
          ...chain,
        ];

        unused.splice(
          i,
          1
        );

        changed = true;
        break;
      }

      /*
       * reversed candidate -> chainStart
       */
      if (
        samePoint(
          candidateStart,
          chainStart
        )
      ) {
        const reversed =
          [...candidate]
            .reverse();

        chain = [
          ...reversed.slice(
            0,
            -1
          ),
          ...chain,
        ];

        unused.splice(
          i,
          1
        );

        changed = true;
        break;
      }
    }
  }

  chains.push(chain);
}

/*
 * Оставляем только замкнутые цепочки.
 */
const closedRings =
  chains.filter(
    (chain) =>
      chain.length >= 4 &&
      samePoint(
        chain[0],
        chain[
          chain.length - 1
        ]
      )
  );

if (!closedRings.length) {
  console.log(
    'Всего цепочек:',
    chains.length
  );

  console.log(
    'Длины цепочек:',
    chains
      .map(
        (chain) =>
          chain.length
      )
      .sort(
        (a, b) =>
          b - a
      )
      .slice(
        0,
        20
      )
  );

  throw new Error(
    'Не удалось собрать замкнутое кольцо ТТК'
  );
}

/*
 * Приблизительная площадь по формуле
 * shoelace. Для выбора самого большого
 * кольца нам этого достаточно.
 */
function ringArea(
  coordinates
) {
  let sum = 0;

  for (
    let i = 0;
    i <
    coordinates.length - 1;
    i++
  ) {
    const [
      x1,
      y1,
    ] =
      coordinates[i];

    const [
      x2,
      y2,
    ] =
      coordinates[
        i + 1
      ];

    sum +=
      x1 * y2 -
      x2 * y1;
  }

  return (
    Math.abs(sum) / 2
  );
}

closedRings.sort(
  (a, b) =>
    ringArea(b) -
    ringArea(a)
);

const outerRing =
  closedRings[0];

const geoJson = {
  type: 'Feature',

  properties: {
    name:
      'Третье транспортное кольцо',

    shortName:
      'ТТК',

    source:
      'OpenStreetMap relation 2094286',
  },

  geometry: {
    type: 'Polygon',

    coordinates: [
      outerRing,
    ],
  },
};

fs.writeFileSync(
  OUTPUT,
  JSON.stringify(
    geoJson,
    null,
    2
  ),
  'utf8'
);

console.log(
  'Готово.'
);

console.log(
  'Way в relation:',
  memberWayIds.length
);

console.log(
  'Собрано цепочек:',
  chains.length
);

console.log(
  'Замкнутых колец:',
  closedRings.length
);

console.log(
  'Точек в выбранном кольце:',
  outerRing.length
);

console.log(
  'Создан файл:',
  OUTPUT
);