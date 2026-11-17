"use client";

import {
  Suspense,
  useLayoutEffect,
  useMemo,
  useRef,
} from "react";

import {
  Canvas,
} from "@react-three/fiber";

import {
  Environment,
  Grid,
  OrbitControls,
  PerspectiveCamera,
} from "@react-three/drei";

import * as THREE from "three";

import Maz5432_3D from "@/components/Maz5432_3D";
import TrailerBzap3D from "@/components/TrailerBzap3D";

type PipeShape =
  | "round"
  | "square";

type Transport3DViewerProps = {
  vehicleLength?: number;
  vehicleWidth?: number;
  vehicleHeight?: number;

  cargoType?: string;
  cargoLength?: number;
  cargoWidth?: number;
  cargoHeight?: number;
  cargoWeight?: number;
  cargoCount?: number;

  rebarDiameter?: number;

  pipeShape?: PipeShape;
  pipeDiameter?: number;
  squarePipeSize?: number;
};

const REBAR_WEIGHT_PER_METER: Record<
  number,
  number
> = {
  6: 0.222,
  8: 0.395,
  10: 0.617,
  12: 0.888,
  14: 1.21,
  16: 1.58,
  18: 2,
  20: 2.47,
  22: 2.98,
  25: 3.85,
  28: 4.83,
  32: 6.31,
  36: 7.99,
  40: 9.87,
  45: 12.48,
  50: 15.41,
  55: 18.65,
  60: 22.19,
  70: 30.21,
  80: 39.46,
};

function clamp(
  value: number,
  min: number,
  max: number,
) {
  return Math.min(
    max,
    Math.max(
      min,
      value,
    ),
  );
}

/* =========================================================
   АРМАТУРА
   ========================================================= */

function createBundleRodPositions(
  rodCount: number,
  diameter: number,
) {
  const packingFactor =
    0.84;

  const aspectRatio =
    2.6;

  const radius =
    diameter /
    2;

  const ellipseA =
    Math.sqrt(
      (
        rodCount *
        radius *
        radius *
        aspectRatio
      ) /
        packingFactor,
    );

  const ellipseB =
    ellipseA /
    aspectRatio;

  const rowStep =
    diameter *
    0.866;

  const candidates: Array<
    [
      number,
      number,
    ]
  > = [];

  const maxRows =
    Math.ceil(
      (
        ellipseB *
        2
      ) /
        rowStep,
    ) +
    8;

  const maxColumns =
    Math.ceil(
      (
        ellipseA *
        2
      ) /
        diameter,
    ) +
    8;

  for (
    let row =
      -maxRows;
    row <=
    maxRows;
    row += 1
  ) {
    const y =
      row *
      rowStep;

    const offset =
      Math.abs(
        row,
      ) %
        2 ===
      0
        ? 0
        : diameter /
          2;

    for (
      let column =
        -maxColumns;
      column <=
      maxColumns;
      column += 1
    ) {
      const z =
        column *
          diameter +
        offset;

      const normalized =
        (
          z *
          z
        ) /
          (
            ellipseA *
            ellipseA
          ) +
        (
          y *
          y
        ) /
          (
            ellipseB *
            ellipseB
          );

      if (
        normalized <=
        1
      ) {
        candidates.push([
          y,
          z,
        ]);
      }
    }
  }

  candidates.sort(
    (
      a,
      b,
    ) =>
      (
        a[0] *
          a[0] +
        a[1] *
          a[1]
      ) -
      (
        b[0] *
          b[0] +
        b[1] *
          b[1]
      ),
  );

  let selected =
    candidates.slice(
      0,
      rodCount,
    );

  if (
    selected.length <
    rodCount
  ) {
    const columns =
      Math.ceil(
        Math.sqrt(
          rodCount *
            aspectRatio,
        ),
      );

    const fallback: Array<
      [
        number,
        number,
      ]
    > = [];

    for (
      let index =
        0;
      index <
      rodCount;
      index += 1
    ) {
      const row =
        Math.floor(
          index /
            columns,
        );

      const column =
        index %
        columns;

      fallback.push([
        row *
          rowStep,
        (
          column -
          columns /
            2
        ) *
          diameter,
      ]);
    }

    selected =
      fallback;
  }

  const minY =
    Math.min(
      ...selected.map(
        (
          item,
        ) =>
          item[0],
      ),
    );

  const maxY =
    Math.max(
      ...selected.map(
        (
          item,
        ) =>
          item[0],
      ),
    );

  const minZ =
    Math.min(
      ...selected.map(
        (
          item,
        ) =>
          item[1],
      ),
    );

  const maxZ =
    Math.max(
      ...selected.map(
        (
          item,
        ) =>
          item[1],
      ),
    );

  const centerY =
    (
      minY +
      maxY
    ) /
    2;

  const centerZ =
    (
      minZ +
      maxZ
    ) /
    2;

  return {
    positions:
      selected.map(
        (
          item,
        ) => [
          item[0] -
            centerY,
          item[1] -
            centerZ,
        ] as [
          number,
          number,
        ],
      ),

    width:
      maxZ -
      minZ +
      diameter,

    height:
      maxY -
      minY +
      diameter,
  };
}

function RebarBundle({
  position,
  length,
  rodCount,
  diameterMm,
}: {
  position: [
    number,
    number,
    number,
  ];

  length: number;
  rodCount: number;
  diameterMm: number;
}) {
  const meshRef =
    useRef<THREE.InstancedMesh>(
      null,
    );

  const diameter =
    Math.max(
      diameterMm /
        1000,
      0.008,
    );

  const layout =
    useMemo(
      () =>
        createBundleRodPositions(
          rodCount,
          diameter,
        ),
      [
        rodCount,
        diameter,
      ],
    );

  useLayoutEffect(
    () => {
      if (
        !meshRef.current
      ) {
        return;
      }

      const dummy =
        new THREE.Object3D();

      dummy.rotation.z =
        Math.PI /
        2;

      layout.positions.forEach(
        (
          point,
          index,
        ) => {
          dummy.position.set(
            0,
            point[0],
            point[1],
          );

          dummy.updateMatrix();

          meshRef.current?.setMatrixAt(
            index,
            dummy.matrix,
          );
        },
      );

      meshRef.current.instanceMatrix.needsUpdate =
        true;
    },
    [
      layout.positions,
    ],
  );

  return (
    <group
      position={
        position
      }
    >
      <instancedMesh
        ref={
          meshRef
        }
        args={[
          undefined,
          undefined,
          rodCount,
        ]}
        castShadow
        receiveShadow
      >
        <cylinderGeometry
          args={[
            diameter /
              2,
            diameter /
              2,
            length,
            8,
          ]}
        />

        <meshStandardMaterial
          color="#5b656d"
          roughness={0.55}
          metalness={0.67}
        />
      </instancedMesh>

      {[
        -0.34,
        -0.11,
        0.11,
        0.34,
      ].map(
        (
          factor,
          index,
        ) => (
          <mesh
            key={
              index
            }
            position={[
              length *
                factor,
              0,
              0,
            ]}
            rotation={[
              0,
              Math.PI /
                2,
              0,
            ]}
            scale={[
              Math.max(
                layout.width /
                  2 +
                  0.012,
                0.03,
              ),
              Math.max(
                layout.height /
                  2 +
                  0.012,
                0.03,
              ),
              1,
            ]}
          >
            <torusGeometry
              args={[
                1,
                0.018,
                5,
                28,
              ]}
            />

            <meshStandardMaterial
              color="#363b3e"
              roughness={0.56}
              metalness={0.72}
            />
          </mesh>
        ),
      )}
    </group>
  );
}

function RebarCargo({
  platformLength,
  platformWidth,
  cargoLength,
  cargoWeight,
  diameterMm,
}: {
  platformLength: number;
  platformWidth: number;
  cargoLength: number;
  cargoWeight: number;
  diameterMm: number;
}) {
  const length =
    clamp(
      cargoLength,
      0.5,
      platformLength -
        0.2,
    );

  const kgPerMeter =
    REBAR_WEIGHT_PER_METER[
      diameterMm
    ] ??
    0.888;

  const oneRodKg =
    length *
    kgPerMeter;

  const weights =
    useMemo(
      () => {
        const result: number[] =
          [];

        let remaining =
          Math.max(
            cargoWeight,
            0,
          );

        while (
          remaining >
          0.001
        ) {
          const current =
            Math.min(
              6,
              remaining,
            );

          result.push(
            current,
          );

          remaining -=
            current;
        }

        return result.length >
          0
          ? result
          : [
              0.1,
            ];
      },
      [
        cargoWeight,
      ],
    );

  const bundles =
    useMemo(
      () =>
        weights.map(
          (
            weight,
          ) => {
            const rodCount =
              Math.max(
                1,
                Math.round(
                  (
                    weight *
                    1000
                  ) /
                    oneRodKg,
                ),
              );

            const diameter =
              Math.max(
                diameterMm /
                  1000,
                0.008,
              );

            const geometry =
              createBundleRodPositions(
                rodCount,
                diameter,
              );

            return {
              rodCount,
              width:
                geometry.width,
              height:
                geometry.height,
            };
          },
        ),
      [
        weights,
        oneRodKg,
        diameterMm,
      ],
    );

  const gap =
    0.08;

  const totalWidth =
    bundles.reduce(
      (
        sum,
        item,
      ) =>
        sum +
        item.width,
      0,
    ) +
    gap *
      Math.max(
        bundles.length -
          1,
        0,
      );

  const fitsOneLayer =
    totalWidth <=
    platformWidth -
      0.12;

  if (
    fitsOneLayer
  ) {
    let currentZ =
      -totalWidth /
      2;

    return (
      <group>
        {bundles.map(
          (
            bundle,
            index,
          ) => {
            const z =
              currentZ +
              bundle.width /
                2;

            currentZ +=
              bundle.width +
              gap;

            return (
              <RebarBundle
                key={
                  index
                }
                position={[
                  index %
                    2 ===
                  0
                    ? -0.04
                    : 0.05,

                  1.31 +
                    bundle.height /
                      2,

                  z,
                ]}
                length={
                  length
                }
                rodCount={
                  bundle.rodCount
                }
                diameterMm={
                  diameterMm
                }
              />
            );
          },
        )}
      </group>
    );
  }

  const lower: typeof bundles =
    [];

  const upper: typeof bundles =
    [];

  let lowerWidth =
    0;

  bundles.forEach(
    (
      bundle,
    ) => {
      const candidate =
        lowerWidth +
        (
          lower.length >
          0
            ? gap
            : 0
        ) +
        bundle.width;

      if (
        candidate <=
        platformWidth -
          0.12
      ) {
        lower.push(
          bundle,
        );

        lowerWidth =
          candidate;
      } else {
        upper.push(
          bundle,
        );
      }
    },
  );

  const lowerHeight =
    lower.length >
    0
      ? Math.max(
          ...lower.map(
            (
              bundle,
            ) =>
              bundle.height,
          ),
        )
      : 0;

  function renderLayer(
    layer:
      typeof bundles,
    layerIndex:
      number,
  ) {
    const layerWidth =
      layer.reduce(
        (
          sum,
          item,
        ) =>
          sum +
          item.width,
        0,
      ) +
      gap *
        Math.max(
          layer.length -
            1,
          0,
        );

    let current =
      -layerWidth /
      2;

    return layer.map(
      (
        bundle,
        index,
      ) => {
        const z =
          current +
          bundle.width /
            2;

        current +=
          bundle.width +
          gap;

        const baseY =
          layerIndex ===
          0
            ? 1.31
            : 1.31 +
              lowerHeight +
              0.03;

        return (
          <RebarBundle
            key={`${layerIndex}-${index}`}
            position={[
              index %
                2 ===
              0
                ? -0.04
                : 0.05,

              baseY +
                bundle.height /
                  2,

              z,
            ]}
            length={
              length
            }
            rodCount={
              bundle.rodCount
            }
            diameterMm={
              diameterMm
            }
          />
        );
      },
    );
  }

  return (
    <group>
      {renderLayer(
        lower,
        0,
      )}

      {renderLayer(
        upper,
        1,
      )}
    </group>
  );
}

/* =========================================================
   ТРУБЫ
   ========================================================= */

function PipeCargo({
  platformLength,
  platformWidth,
  cargoLength,
  cargoCount,
  pipeShape,
  pipeDiameter,
  squarePipeSize,
}: {
  platformLength: number;
  platformWidth: number;
  cargoLength: number;
  cargoCount: number;
  pipeShape: PipeShape;
  pipeDiameter: number;
  squarePipeSize: number;
}) {
  const length =
    clamp(
      cargoLength,
      0.5,
      platformLength -
        0.2,
    );

  const count =
    clamp(
      Math.round(
        cargoCount,
      ),
      1,
      100,
    );

  const size =
    pipeShape ===
    "round"
      ? clamp(
          pipeDiameter /
            1000,
          0.02,
          0.6,
        )
      : clamp(
          squarePipeSize /
            1000,
          0.02,
          0.5,
        );

  const gap =
    Math.max(
      0.018,
      size *
        0.08,
    );

  const maxAcross =
    Math.max(
      1,
      Math.floor(
        (
          platformWidth -
          0.15 +
          gap
        ) /
          (
            size +
            gap
          ),
      ),
    );

  return (
    <group>
      {Array.from({
        length:
          count,
      }).map(
        (
          _,
          index,
        ) => {
          const row =
            Math.floor(
              index /
                maxAcross,
            );

          const column =
            index %
            maxAcross;

          const rowCount =
            Math.min(
              maxAcross,
              count -
                row *
                  maxAcross,
            );

          const rowWidth =
            rowCount *
              size +
            Math.max(
              rowCount -
                1,
              0,
            ) *
              gap;

          const z =
            -rowWidth /
              2 +
            size /
              2 +
            column *
              (
                size +
                gap
              );

          const y =
            1.31 +
            size /
              2 +
            row *
              (
                size +
                gap
              );

          if (
            pipeShape ===
            "square"
          ) {
            return (
              <mesh
                key={
                  index
                }
                position={[
                  0,
                  y,
                  z,
                ]}
                castShadow
                receiveShadow
              >
                <boxGeometry
                  args={[
                    length,
                    size,
                    size,
                  ]}
                />

                <meshStandardMaterial
                  color="#68747b"
                  roughness={0.43}
                  metalness={0.69}
                />
              </mesh>
            );
          }

          return (
            <mesh
              key={
                index
              }
              position={[
                0,
                y,
                z,
              ]}
              rotation={[
                0,
                0,
                Math.PI /
                  2,
              ]}
              castShadow
              receiveShadow
            >
              <cylinderGeometry
                args={[
                  size /
                    2,
                  size /
                    2,
                  length,
                  24,
                ]}
              />

              <meshStandardMaterial
                color="#66727a"
                roughness={0.42}
                metalness={0.72}
              />
            </mesh>
          );
        },
      )}
    </group>
  );
}

/* =========================================================
   ПРОЧИЙ ГРУЗ
   ========================================================= */

function GenericCargo({
  platformLength,
  platformWidth,
  cargoLength,
  cargoWidth,
  cargoHeight,
  cargoCount,
  cargoType,
}: {
  platformLength: number;
  platformWidth: number;

  cargoLength: number;
  cargoWidth: number;
  cargoHeight: number;

  cargoCount: number;

  cargoType: string;
}) {
  const length =
    clamp(
      cargoLength,
      0.3,
      platformLength -
        0.2,
    );

  const width =
    clamp(
      cargoWidth,
      0.2,
      platformWidth -
        0.15,
    );

  const count =
    clamp(
      Math.round(
        cargoCount,
      ),
      1,
      8,
    );

  const flat =
    cargoType ===
      "Лист" ||
    cargoType ===
      "Сэндвич-панель";

  const height =
    flat
      ? 0.09
      : clamp(
          cargoHeight,
          0.1,
          2.5,
        );

  return (
    <group>
      {Array.from({
        length:
          count,
      }).map(
        (
          _,
          index,
        ) => (
          <mesh
            key={
              index
            }
            position={[
              0,

              1.31 +
                height /
                  2 +
                index *
                  (
                    height +
                    0.03
                  ),

              0,
            ]}
            castShadow
            receiveShadow
          >
            <boxGeometry
              args={[
                length,
                height,
                width,
              ]}
            />

            <meshStandardMaterial
              color={
                flat
                  ? "#859198"
                  : "#707b82"
              }
              roughness={0.48}
              metalness={0.62}
            />
          </mesh>
        ),
      )}
    </group>
  );
}

/* =========================================================
   ВЫБОР ТИПА ГРУЗА
   ========================================================= */

function CargoModel({
  platformLength,
  platformWidth,

  cargoType,
  cargoLength,
  cargoWidth,
  cargoHeight,
  cargoWeight,
  cargoCount,

  rebarDiameter,

  pipeShape,
  pipeDiameter,
  squarePipeSize,
}: {
  platformLength: number;
  platformWidth: number;

  cargoType: string;
  cargoLength: number;
  cargoWidth: number;
  cargoHeight: number;
  cargoWeight: number;
  cargoCount: number;

  rebarDiameter: number;

  pipeShape: PipeShape;
  pipeDiameter: number;
  squarePipeSize: number;
}) {
  if (
    cargoType ===
    "Арматура"
  ) {
    return (
      <RebarCargo
        platformLength={
          platformLength
        }
        platformWidth={
          platformWidth
        }
        cargoLength={
          cargoLength
        }
        cargoWeight={
          cargoWeight
        }
        diameterMm={
          rebarDiameter
        }
      />
    );
  }

  if (
    cargoType ===
    "Труба"
  ) {
    return (
      <PipeCargo
        platformLength={
          platformLength
        }
        platformWidth={
          platformWidth
        }
        cargoLength={
          cargoLength
        }
        cargoCount={
          cargoCount
        }
        pipeShape={
          pipeShape
        }
        pipeDiameter={
          pipeDiameter
        }
        squarePipeSize={
          squarePipeSize
        }
      />
    );
  }

  return (
    <GenericCargo
      platformLength={
        platformLength
      }
      platformWidth={
        platformWidth
      }
      cargoLength={
        cargoLength
      }
      cargoWidth={
        cargoWidth
      }
      cargoHeight={
        cargoHeight
      }
      cargoCount={
        cargoCount
      }
      cargoType={
        cargoType
      }
    />
  );
}

/* =========================================================
   СЦЕНА
   ========================================================= */

function Scene({
  platformLength,
  platformWidth,
  vehicleHeight,

  cargoType,
  cargoLength,
  cargoWidth,
  cargoHeight,
  cargoWeight,
  cargoCount,

  rebarDiameter,

  pipeShape,
  pipeDiameter,
  squarePipeSize,
}: {
  platformLength: number;
  platformWidth: number;
  vehicleHeight: number;

  cargoType: string;
  cargoLength: number;
  cargoWidth: number;
  cargoHeight: number;
  cargoWeight: number;
  cargoCount: number;

  rebarDiameter: number;

  pipeShape: PipeShape;
  pipeDiameter: number;
  squarePipeSize: number;
}) {
  const fullLength =
    platformLength +
    4.8;

  const distance =
    Math.max(
      fullLength *
        0.8,
      11,
    );

  return (
    <>
      <PerspectiveCamera
        makeDefault
        position={[
          distance *
            0.72,

          Math.max(
            5.8,
            vehicleHeight *
              1.75,
          ),

          distance *
            0.88,
        ]}
        fov={38}
        near={0.1}
        far={250}
      />

      <ambientLight
        intensity={0.78}
      />

      <hemisphereLight
        intensity={0.55}
        groundColor="#0a1117"
      />

      <directionalLight
        position={[
          9,
          12,
          8,
        ]}
        intensity={2.35}
        castShadow
        shadow-mapSize-width={
          2048
        }
        shadow-mapSize-height={
          2048
        }
      />

      <directionalLight
        position={[
          -7,
          5,
          -6,
        ]}
        intensity={0.72}
      />

      {/* МАЗ-5432 */}

      <Maz5432_3D
        trailerLength={
          platformLength
        }
        trailerWidth={
          platformWidth
        }
        bodyColor="#e7e8e8"
      />

      {/* Полуприцеп */}

      <TrailerBzap3D
        length={
          platformLength
        }
        width={
          platformWidth
        }
        deckHeight={
          1.22
        }
        sideHeight={
          0.6
        }
      />

      {/* Груз */}

      <CargoModel
        platformLength={
          platformLength
        }
        platformWidth={
          platformWidth
        }
        cargoType={
          cargoType
        }
        cargoLength={
          cargoLength
        }
        cargoWidth={
          cargoWidth
        }
        cargoHeight={
          cargoHeight
        }
        cargoWeight={
          cargoWeight
        }
        cargoCount={
          cargoCount
        }
        rebarDiameter={
          rebarDiameter
        }
        pipeShape={
          pipeShape
        }
        pipeDiameter={
          pipeDiameter
        }
        squarePipeSize={
          squarePipeSize
        }
      />

      <Grid
        position={[
          0,
          -0.01,
          0,
        ]}
        args={[
          90,
          90,
        ]}
        cellSize={1}
        cellThickness={0.42}
        cellColor="#23455e"
        sectionSize={5}
        sectionThickness={0.9}
        sectionColor="#356b91"
        fadeDistance={65}
        fadeStrength={1.55}
        infiniteGrid
      />

      <Environment
        preset="city"
      />

      <OrbitControls
        makeDefault

        target={[
          -1.8,
          1.35,
          0,
        ]}

        enablePan
        enableZoom
        enableRotate

        minDistance={4}
        maxDistance={50}

        minPolarAngle={
          0.03
        }

        maxPolarAngle={
          Math.PI /
          2.01
        }

        dampingFactor={
          0.055
        }

        enableDamping
      />
    </>
  );
}

/* =========================================================
   VIEWER
   ========================================================= */

export default function Transport3DViewer({
  vehicleLength = 13.6,
  vehicleWidth = 2.45,
  vehicleHeight = 3.2,

  cargoType = "Арматура",
  cargoLength = 11.7,
  cargoWidth = 1,
  cargoHeight = 1,
  cargoWeight = 20,
  cargoCount = 1,

  rebarDiameter = 12,

  pipeShape = "round",
  pipeDiameter = 108,
  squarePipeSize = 80,
}: Transport3DViewerProps) {
  const safePlatformLength =
    Number.isFinite(
      vehicleLength,
    )
      ? Math.max(
          vehicleLength,
          3,
        )
      : 13.6;

  const safePlatformWidth =
    Number.isFinite(
      vehicleWidth,
    )
      ? Math.max(
          vehicleWidth,
          1.5,
        )
      : 2.45;

  const safeVehicleHeight =
    Number.isFinite(
      vehicleHeight,
    )
      ? Math.max(
          vehicleHeight,
          2,
        )
      : 3.2;

  const safeCargoLength =
    Number.isFinite(
      cargoLength,
    )
      ? Math.max(
          cargoLength,
          0.3,
        )
      : 11.7;

  const safeCargoWidth =
    Number.isFinite(
      cargoWidth,
    )
      ? Math.max(
          cargoWidth,
          0.1,
        )
      : 1;

  const safeCargoHeight =
    Number.isFinite(
      cargoHeight,
    )
      ? Math.max(
          cargoHeight,
          0.05,
        )
      : 1;

  const safeCargoWeight =
    Number.isFinite(
      cargoWeight,
    )
      ? Math.max(
          cargoWeight,
          0.01,
        )
      : 20;

  const safeCargoCount =
    Number.isFinite(
      cargoCount,
    )
      ? Math.max(
          1,
          Math.round(
            cargoCount,
          ),
        )
      : 1;

  const safeRebarDiameter =
    Number.isFinite(
      rebarDiameter,
    )
      ? Math.max(
          rebarDiameter,
          6,
        )
      : 12;

  const safePipeDiameter =
    Number.isFinite(
      pipeDiameter,
    )
      ? Math.max(
          pipeDiameter,
          10,
        )
      : 108;

  const safeSquarePipeSize =
    Number.isFinite(
      squarePipeSize,
    )
      ? Math.max(
          squarePipeSize,
          10,
        )
      : 80;

  return (
    <div
      style={{
        width:
          "100%",

        height:
          "clamp(560px, 63vh, 690px)",

        position:
          "relative",

        overflow:
          "hidden",
      }}
    >
      <Canvas
        shadows

        dpr={[
          1,
          1.5,
        ]}

        style={{
          width:
            "100%",

          height:
            "100%",

          display:
            "block",
        }}

        gl={{
          antialias:
            true,

          alpha:
            false,

          powerPreference:
            "high-performance",
        }}
      >
        <color
          attach="background"
          args={[
            "#051522",
          ]}
        />

        <fog
          attach="fog"
          args={[
            "#051522",
            34,
            72,
          ]}
        />

        <Suspense
          fallback={
            null
          }
        >
          <Scene
            platformLength={
              safePlatformLength
            }
            platformWidth={
              safePlatformWidth
            }
            vehicleHeight={
              safeVehicleHeight
            }
            cargoType={
              cargoType
            }
            cargoLength={
              safeCargoLength
            }
            cargoWidth={
              safeCargoWidth
            }
            cargoHeight={
              safeCargoHeight
            }
            cargoWeight={
              safeCargoWeight
            }
            cargoCount={
              safeCargoCount
            }
            rebarDiameter={
              safeRebarDiameter
            }
            pipeShape={
              pipeShape
            }
            pipeDiameter={
              safePipeDiameter
            }
            squarePipeSize={
              safeSquarePipeSize
            }
          />
        </Suspense>
      </Canvas>
    </div>
  );
}