"use client";

import { useMemo } from "react";
import * as THREE from "three";

type Maz5432Props = {
  position?: [number, number, number];
  rotation?: [number, number, number];
  trailerLength?: number;
  trailerWidth?: number;
  bodyColor?: string;
};

type Side = "left" | "right";

function MazWheel({
  position,
  side,
  dual = false,
}: {
  position: [number, number, number];
  side: Side;
  dual?: boolean;
}) {
  const direction =
    side === "left"
      ? 1
      : -1;

  const radius = 0.49;
  const tireWidth = 0.29;

  function SingleWheel({
    offset = 0,
  }: {
    offset?: number;
  }) {
    return (
      <group
        position={[
          0,
          0,
          direction * offset,
        ]}
      >
        <mesh
          rotation={[
            Math.PI / 2,
            0,
            0,
          ]}
          castShadow
          receiveShadow
        >
          <cylinderGeometry
            args={[
              radius,
              radius,
              tireWidth,
              36,
            ]}
          />

          <meshStandardMaterial
            color="#111315"
            roughness={0.93}
            metalness={0.02}
          />
        </mesh>

        <mesh
          rotation={[
            Math.PI / 2,
            0,
            0,
          ]}
        >
          <torusGeometry
            args={[
              0.39,
              0.055,
              10,
              36,
            ]}
          />

          <meshStandardMaterial
            color="#1c1e20"
            roughness={0.94}
            metalness={0.01}
          />
        </mesh>

        <mesh
          rotation={[
            Math.PI / 2,
            0,
            0,
          ]}
          castShadow
        >
          <cylinderGeometry
            args={[
              0.235,
              0.235,
              tireWidth + 0.032,
              32,
            ]}
          />

          <meshStandardMaterial
            color="#8e9498"
            roughness={0.32}
            metalness={0.78}
          />
        </mesh>

        <mesh
          rotation={[
            Math.PI / 2,
            0,
            0,
          ]}
        >
          <cylinderGeometry
            args={[
              0.105,
              0.105,
              tireWidth + 0.045,
              24,
            ]}
          />

          <meshStandardMaterial
            color="#42484c"
            roughness={0.4}
            metalness={0.72}
          />
        </mesh>

        {Array.from({
          length: 8,
        }).map(
          (
            _,
            index,
          ) => {
            const angle =
              (index / 8) *
              Math.PI *
              2;

            return (
              <mesh
                key={
                  index
                }
                position={[
                  0,
                  Math.cos(
                    angle,
                  ) *
                    0.16,
                  Math.sin(
                    angle,
                  ) *
                    0.16,
                ]}
              >
                <sphereGeometry
                  args={[
                    0.018,
                    8,
                    8,
                  ]}
                />

                <meshStandardMaterial
                  color="#4e5356"
                  roughness={0.38}
                  metalness={0.72}
                />
              </mesh>
            );
          },
        )}
      </group>
    );
  }

  return (
    <group
      position={
        position
      }
    >
      <SingleWheel />

      {dual && (
        <SingleWheel
          offset={
            0.255
          }
        />
      )}
    </group>
  );
}

function CabShell({
  width,
  color,
}: {
  width: number;
  color: string;
}) {
  const geometry =
    useMemo(
      () => {
        const shape =
          new THREE.Shape();

        /*
         * X — длина кабины.
         * Перед автомобиля слева.
         */

        shape.moveTo(
          -1.38,
          0.83,
        );

        shape.lineTo(
          -1.42,
          1.5,
        );

        shape.lineTo(
          -1.4,
          2.34,
        );

        shape.lineTo(
          -1.24,
          2.61,
        );

        shape.lineTo(
          -0.98,
          2.72,
        );

        shape.lineTo(
          0.88,
          2.72,
        );

        shape.lineTo(
          1.13,
          2.55,
        );

        shape.lineTo(
          1.24,
          2.3,
        );

        shape.lineTo(
          1.24,
          0.9,
        );

        shape.lineTo(
          0.94,
          0.83,
        );

        shape.closePath();

        const geometry =
          new THREE.ExtrudeGeometry(
            shape,
            {
              depth:
                width,

              bevelEnabled:
                true,

              bevelThickness:
                0.035,

              bevelSize:
                0.035,

              bevelSegments:
                3,

              steps:
                1,
            },
          );

        geometry.translate(
          0,
          0,
          -width / 2,
        );

        geometry.computeVertexNormals();

        return geometry;
      },
      [
        width,
      ],
    );

  return (
    <mesh
      geometry={
        geometry
      }
      castShadow
      receiveShadow
    >
      <meshStandardMaterial
        color={
          color
        }
        roughness={0.34}
        metalness={0.22}
      />
    </mesh>
  );
}

function RoofFairing({
  width,
  color,
}: {
  width: number;
  color: string;
}) {
  const geometry =
    useMemo(
      () => {
        const shape =
          new THREE.Shape();

        shape.moveTo(
          -0.92,
          2.72,
        );

        shape.lineTo(
          -0.7,
          3.25,
        );

        shape.lineTo(
          -0.32,
          3.43,
        );

        shape.lineTo(
          0.78,
          3.43,
        );

        shape.lineTo(
          1.04,
          3.22,
        );

        shape.lineTo(
          1.05,
          2.82,
        );

        shape.lineTo(
          0.75,
          2.72,
        );

        shape.closePath();

        const geometry =
          new THREE.ExtrudeGeometry(
            shape,
            {
              depth:
                width * 0.84,

              bevelEnabled:
                true,

              bevelThickness:
                0.055,

              bevelSize:
                0.05,

              bevelSegments:
                4,
            },
          );

        geometry.translate(
          0,
          0,
          -(width * 0.84) /
            2,
        );

        geometry.computeVertexNormals();

        return geometry;
      },
      [
        width,
      ],
    );

  return (
    <mesh
      geometry={
        geometry
      }
      castShadow
    >
      <meshStandardMaterial
        color={
          color
        }
        roughness={0.3}
        metalness={0.16}
      />
    </mesh>
  );
}

function SideWindow({
  width,
  side,
}: {
  width: number;
  side: Side;
}) {
  const direction =
    side === "left"
      ? 1
      : -1;

  const geometry =
    useMemo(
      () => {
        const shape =
          new THREE.Shape();

        shape.moveTo(
          -0.77,
          1.78,
        );

        shape.lineTo(
          -0.76,
          2.42,
        );

        shape.lineTo(
          0.22,
          2.43,
        );

        shape.lineTo(
          0.4,
          1.8,
        );

        shape.closePath();

        return new THREE.ShapeGeometry(
          shape,
        );
      },
      [],
    );

  return (
    <mesh
      geometry={
        geometry
      }
      position={[
        0,
        0,
        direction *
          (width / 2 +
            0.043),
      ]}
      rotation={[
        0,
        side ===
        "left"
          ? 0
          : Math.PI,
        0,
      ]}
    >
      <meshPhysicalMaterial
        color="#17262f"
        roughness={0.06}
        transparent
        opacity={0.93}
      />
    </mesh>
  );
}

function Mirror({
  position,
  side,
}: {
  position: [number, number, number];
  side: Side;
}) {
  const direction =
    side === "left"
      ? 1
      : -1;

  return (
    <group
      position={
        position
      }
    >
      <mesh
        position={[
          0,
          0.1,
          direction *
            0.18,
        ]}
        rotation={[
          0,
          0,
          Math.PI / 2,
        ]}
      >
        <cylinderGeometry
          args={[
            0.015,
            0.015,
            0.4,
            10,
          ]}
        />

        <meshStandardMaterial
          color="#24282a"
          roughness={0.58}
          metalness={0.52}
        />
      </mesh>

      <mesh
        position={[
          0,
          -0.13,
          direction *
            0.18,
        ]}
        rotation={[
          0,
          0,
          Math.PI / 2,
        ]}
      >
        <cylinderGeometry
          args={[
            0.015,
            0.015,
            0.4,
            10,
          ]}
        />

        <meshStandardMaterial
          color="#24282a"
          roughness={0.58}
          metalness={0.52}
        />
      </mesh>

      <mesh
        position={[
          0,
          -0.02,
          direction *
            0.42,
        ]}
        castShadow
      >
        <boxGeometry
          args={[
            0.1,
            0.43,
            0.19,
          ]}
        />

        <meshStandardMaterial
          color="#15181a"
          roughness={0.72}
        />
      </mesh>

      <mesh
        position={[
          -0.055,
          -0.02,
          direction *
            0.42,
        ]}
      >
        <boxGeometry
          args={[
            0.008,
            0.35,
            0.145,
          ]}
        />

        <meshStandardMaterial
          color="#637279"
          roughness={0.08}
          metalness={0.38}
        />
      </mesh>
    </group>
  );
}

function FrontArch({
  position,
  side,
  bodyColor,
}: {
  position: [number, number, number];
  side: Side;
  bodyColor: string;
}) {
  const direction =
    side === "left"
      ? 1
      : -1;

  return (
    <group
      position={
        position
      }
    >
      <mesh
        position={[
          0,
          0.03,
          direction *
            0.02,
        ]}
        castShadow
      >
        <torusGeometry
          args={[
            0.57,
            0.07,
            10,
            40,
            Math.PI,
          ]}
        />

        <meshStandardMaterial
          color={
            bodyColor
          }
          roughness={0.36}
          metalness={0.24}
        />
      </mesh>

      <mesh
        position={[
          0,
          -0.22,
          direction *
            0.025,
        ]}
        castShadow
      >
        <boxGeometry
          args={[
            1.18,
            0.18,
            0.12,
          ]}
        />

        <meshStandardMaterial
          color="#202427"
          roughness={0.72}
          metalness={0.15}
        />
      </mesh>
    </group>
  );
}

function FrontLamp({
  z,
}: {
  z: number;
}) {
  return (
    <group
      position={[
        -1.62,
        0.77,
        z,
      ]}
    >
      <mesh
        castShadow
      >
        <boxGeometry
          args={[
            0.09,
            0.29,
            0.46,
          ]}
        />

        <meshStandardMaterial
          color="#15181a"
          roughness={0.7}
          metalness={0.16}
        />
      </mesh>

      <mesh
        position={[
          -0.052,
          0.025,
          0,
        ]}
      >
        <boxGeometry
          args={[
            0.018,
            0.18,
            0.32,
          ]}
        />

        <meshStandardMaterial
          color="#e8edef"
          emissive="#c7d7dc"
          emissiveIntensity={0.24}
          roughness={0.1}
        />
      </mesh>
    </group>
  );
}

export default function Maz5432_3D({
  position = [
    0,
    0,
    0,
  ],

  rotation = [
    0,
    0,
    0,
  ],

  trailerLength = 13.6,
  trailerWidth = 2.45,

  bodyColor = "#e4e5e3",
}: Maz5432Props) {
  const kingpinX =
    -trailerLength /
      2 +
    1.6;

  const cabWidth =
    Math.min(
      trailerWidth,
      2.5,
    );

  /*
   * По референсу тягач короткий,
   * кабина вынесена далеко вперёд,
   * задняя ось близко к седлу.
   */

  const cabCenterX =
    kingpinX -
    2.95;

  const frontAxleX =
    cabCenterX -
    0.25;

  const rearAxleX =
    kingpinX -
    0.68;

  const frameFrontX =
    cabCenterX -
    1.2;

  const frameRearX =
    kingpinX +
    0.62;

  const frameLength =
    frameRearX -
    frameFrontX;

  const frameCenterX =
    (
      frameFrontX +
      frameRearX
    ) /
    2;

  return (
    <group
      position={
        position
      }
      rotation={
        rotation
      }
    >
      {/* =====================================================
          ОСНОВНАЯ РАМА
          ===================================================== */}

      <mesh
        position={[
          frameCenterX,
          0.75,
          0.42,
        ]}
        castShadow
      >
        <boxGeometry
          args={[
            frameLength,
            0.2,
            0.16,
          ]}
        />

        <meshStandardMaterial
          color="#252a2d"
          roughness={0.58}
          metalness={0.6}
        />
      </mesh>

      <mesh
        position={[
          frameCenterX,
          0.75,
          -0.42,
        ]}
        castShadow
      >
        <boxGeometry
          args={[
            frameLength,
            0.2,
            0.16,
          ]}
        />

        <meshStandardMaterial
          color="#252a2d"
          roughness={0.58}
          metalness={0.6}
        />
      </mesh>

      {Array.from({
        length: 6,
      }).map(
        (
          _,
          index,
        ) => {
          const x =
            frameFrontX +
            0.35 +
            index *
              (
                frameLength -
                0.7
              ) /
              5;

          return (
            <mesh
              key={
                index
              }
              position={[
                x,
                0.75,
                0,
              ]}
            >
              <boxGeometry
                args={[
                  0.11,
                  0.17,
                  0.95,
                ]}
              />

              <meshStandardMaterial
                color="#30363a"
                roughness={0.54}
                metalness={0.58}
              />
            </mesh>
          );
        },
      )}

      {/* =====================================================
          КАБИНА
          ===================================================== */}

      <group
        position={[
          cabCenterX,
          0,
          0,
        ]}
      >
        <CabShell
          width={
            cabWidth
          }
          color={
            bodyColor
          }
        />

        {/* ================================================
            ОБТЕКАТЕЛЬ
            ================================================ */}

        <RoofFairing
          width={
            cabWidth
          }
          color="#efefec"
        />

        {/* ================================================
            ЧЁРНЫЙ КОЗЫРЁК
            ================================================ */}

        <mesh
          position={[
            -1.27,
            2.63,
            0,
          ]}
          rotation={[
            0,
            0,
            -0.045,
          ]}
          castShadow
        >
          <boxGeometry
            args={[
              0.3,
              0.1,
              cabWidth *
                0.94,
            ]}
          />

          <meshStandardMaterial
            color="#202326"
            roughness={0.72}
            metalness={0.12}
          />
        </mesh>

        {/* ================================================
            ЛОБОВОЕ
            ================================================ */}

        <mesh
          position={[
            -1.385,
            2.16,
            0,
          ]}
          rotation={[
            0,
            0,
            -0.035,
          ]}
        >
          <boxGeometry
            args={[
              0.035,
              0.75,
              cabWidth *
                0.76,
            ]}
          />

          <meshPhysicalMaterial
            color="#17262e"
            roughness={0.05}
            metalness={0.02}
            transparent
            opacity={0.94}
          />
        </mesh>

        {/* Нижняя резинка лобового */}

        <mesh
          position={[
            -1.407,
            1.78,
            0,
          ]}
          rotation={[
            0,
            0,
            -0.035,
          ]}
        >
          <boxGeometry
            args={[
              0.025,
              0.035,
              cabWidth *
                0.78,
            ]}
          />

          <meshStandardMaterial
            color="#111416"
            roughness={0.78}
          />
        </mesh>

        {/* ================================================
            ДВОРНИКИ
            ================================================ */}

        <mesh
          position={[
            -1.422,
            1.85,
            0.43,
          ]}
          rotation={[
            0.4,
            0,
            0.6,
          ]}
        >
          <boxGeometry
            args={[
              0.018,
              0.018,
              0.58,
            ]}
          />

          <meshStandardMaterial
            color="#111315"
            roughness={0.8}
          />
        </mesh>

        <mesh
          position={[
            -1.422,
            1.85,
            -0.43,
          ]}
          rotation={[
            -0.4,
            0,
            -0.6,
          ]}
        >
          <boxGeometry
            args={[
              0.018,
              0.018,
              0.58,
            ]}
          />

          <meshStandardMaterial
            color="#111315"
            roughness={0.8}
          />
        </mesh>

        {/* ================================================
            ПАНЕЛЬ ПОД ЛОБОВЫМ
            ================================================ */}

        <mesh
          position={[
            -1.42,
            1.59,
            0,
          ]}
          castShadow
        >
          <boxGeometry
            args={[
              0.095,
              0.32,
              cabWidth *
                0.91,
            ]}
          />

          <meshStandardMaterial
            color={
              bodyColor
            }
            roughness={0.34}
            metalness={0.22}
          />
        </mesh>

        {/* ================================================
            БОЛЬШАЯ РЕШЁТКА
            ================================================ */}

        <mesh
          position={[
            -1.47,
            1.28,
            0,
          ]}
          castShadow
        >
          <boxGeometry
            args={[
              0.08,
              0.54,
              cabWidth *
                0.72,
            ]}
          />

          <meshStandardMaterial
            color="#141719"
            roughness={0.58}
            metalness={0.36}
          />
        </mesh>

        {Array.from({
          length: 10,
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
                -1.515,
                1.05 +
                  index *
                    0.05,
                0,
              ]}
            >
              <boxGeometry
                args={[
                  0.018,
                  0.014,
                  cabWidth *
                    0.69,
                ]}
              />

              <meshStandardMaterial
                color="#5a6063"
                roughness={0.4}
                metalness={0.64}
              />
            </mesh>
          ),
        )}

        {/* ================================================
            ЭМБЛЕМА
            ================================================ */}

        <mesh
          position={[
            -1.535,
            1.32,
            0,
          ]}
        >
          <coneGeometry
            args={[
              0.13,
              0.13,
              3,
            ]}
          />

          <meshStandardMaterial
            color="#ddddda"
            roughness={0.32}
            metalness={0.5}
          />
        </mesh>

        {/* ================================================
            ВЕРТИКАЛЬНЫЕ ЧЁРНЫЕ НАКЛАДКИ
            ================================================ */}

        <mesh
          position={[
            -1.46,
            1.24,
            cabWidth *
              0.45,
          ]}
          castShadow
        >
          <boxGeometry
            args={[
              0.09,
              0.76,
              0.15,
            ]}
          />

          <meshStandardMaterial
            color="#202326"
            roughness={0.72}
            metalness={0.12}
          />
        </mesh>

        <mesh
          position={[
            -1.46,
            1.24,
            -cabWidth *
              0.45,
          ]}
          castShadow
        >
          <boxGeometry
            args={[
              0.09,
              0.76,
              0.15,
            ]}
          />

          <meshStandardMaterial
            color="#202326"
            roughness={0.72}
            metalness={0.12}
          />
        </mesh>

        {/* ================================================
            БАМПЕР
            ================================================ */}

        <mesh
          position={[
            -1.54,
            0.63,
            0,
          ]}
          castShadow
        >
          <boxGeometry
            args={[
              0.28,
              0.34,
              cabWidth *
                0.96,
            ]}
          />

          <meshStandardMaterial
            color="#15181a"
            roughness={0.79}
            metalness={0.14}
          />
        </mesh>

        {/* ================================================
            ФАРЫ
            ================================================ */}

        <FrontLamp
          z={
            0.78
          }
        />

        <FrontLamp
          z={
            -0.78
          }
        />

        {/* Оранжевые поворотники */}

        <mesh
          position={[
            -1.675,
            0.78,
            1.05,
          ]}
        >
          <boxGeometry
            args={[
              0.025,
              0.18,
              0.11,
            ]}
          />

          <meshStandardMaterial
            color="#d6861f"
            emissive="#8c510e"
            emissiveIntensity={0.2}
          />
        </mesh>

        <mesh
          position={[
            -1.675,
            0.78,
            -1.05,
          ]}
        >
          <boxGeometry
            args={[
              0.025,
              0.18,
              0.11,
            ]}
          />

          <meshStandardMaterial
            color="#d6861f"
            emissive="#8c510e"
            emissiveIntensity={0.2}
          />
        </mesh>

        {/* ================================================
            НОМЕРНАЯ НИША
            ================================================ */}

        <mesh
          position={[
            -1.69,
            0.55,
            0,
          ]}
        >
          <boxGeometry
            args={[
              0.018,
              0.14,
              0.52,
            ]}
          />

          <meshStandardMaterial
            color="#ececea"
            roughness={0.5}
          />
        </mesh>

        {/* ================================================
            БОКОВЫЕ ОКНА
            ================================================ */}

        <SideWindow
          width={
            cabWidth
          }
          side="left"
        />

        <SideWindow
          width={
            cabWidth
          }
          side="right"
        />

        {/* Заднее маленькое окно слева */}

        <mesh
          position={[
            0.69,
            2.12,
            cabWidth / 2 +
              0.046,
          ]}
        >
          <boxGeometry
            args={[
              0.42,
              0.55,
              0.018,
            ]}
          />

          <meshPhysicalMaterial
            color="#17262f"
            roughness={0.07}
            transparent
            opacity={0.9}
          />
        </mesh>

        {/* Заднее маленькое окно справа */}

        <mesh
          position={[
            0.69,
            2.12,
            -cabWidth / 2 -
              0.046,
          ]}
        >
          <boxGeometry
            args={[
              0.42,
              0.55,
              0.018,
            ]}
          />

          <meshPhysicalMaterial
            color="#17262f"
            roughness={0.07}
            transparent
            opacity={0.9}
          />
        </mesh>

        {/* ================================================
            ДВЕРНЫЕ РУЧКИ
            ================================================ */}

        <mesh
          position={[
            0.28,
            1.58,
            cabWidth / 2 +
              0.055,
          ]}
        >
          <boxGeometry
            args={[
              0.24,
              0.04,
              0.045,
            ]}
          />

          <meshStandardMaterial
            color="#1c2022"
            roughness={0.58}
            metalness={0.36}
          />
        </mesh>

        <mesh
          position={[
            0.28,
            1.58,
            -cabWidth / 2 -
              0.055,
          ]}
        >
          <boxGeometry
            args={[
              0.24,
              0.04,
              0.045,
            ]}
          />

          <meshStandardMaterial
            color="#1c2022"
            roughness={0.58}
            metalness={0.36}
          />
        </mesh>

        {/* ================================================
            ЗЕРКАЛА
            ================================================ */}

        <Mirror
          position={[
            -0.88,
            2.15,
            cabWidth / 2,
          ]}
          side="left"
        />

        <Mirror
          position={[
            -0.88,
            2.15,
            -cabWidth / 2,
          ]}
          side="right"
        />

        {/* ================================================
            СТУПЕНЬКИ
            ================================================ */}

        <mesh
          position={[
            -0.08,
            0.69,
            cabWidth / 2 +
              0.17,
          ]}
          castShadow
        >
          <boxGeometry
            args={[
              0.75,
              0.11,
              0.34,
            ]}
          />

          <meshStandardMaterial
            color="#3f464a"
            roughness={0.62}
            metalness={0.5}
          />
        </mesh>

        <mesh
          position={[
            -0.08,
            0.69,
            -cabWidth / 2 -
              0.17,
          ]}
          castShadow
        >
          <boxGeometry
            args={[
              0.75,
              0.11,
              0.34,
            ]}
          />

          <meshStandardMaterial
            color="#3f464a"
            roughness={0.62}
            metalness={0.5}
          />
        </mesh>

        {/* ================================================
            АРКИ ПЕРЕДНИХ КОЛЁС
            ================================================ */}

        <FrontArch
          position={[
            frontAxleX -
              cabCenterX,
            0.52,
            cabWidth / 2 +
              0.025,
          ]}
          side="left"
          bodyColor={
            bodyColor
          }
        />

        <FrontArch
          position={[
            frontAxleX -
              cabCenterX,
            0.52,
            -cabWidth / 2 -
              0.025,
          ]}
          side="right"
          bodyColor={
            bodyColor
          }
        />
      </group>

      {/* =====================================================
          ПЕРЕДНИЕ КОЛЁСА
          ===================================================== */}

      <MazWheel
        position={[
          frontAxleX,
          0.49,
          cabWidth / 2 -
            0.13,
        ]}
        side="left"
      />

      <MazWheel
        position={[
          frontAxleX,
          0.49,
          -cabWidth / 2 +
            0.13,
        ]}
        side="right"
      />

      {/* =====================================================
          ЗАДНИЕ ДВОЙНЫЕ КОЛЁСА
          ===================================================== */}

      <MazWheel
        position={[
          rearAxleX,
          0.49,
          trailerWidth / 2 -
            0.13,
        ]}
        side="left"
        dual
      />

      <MazWheel
        position={[
          rearAxleX,
          0.49,
          -trailerWidth / 2 +
            0.13,
        ]}
        side="right"
        dual
      />

      {/* =====================================================
          ЗАДНИЕ КРЫЛЬЯ
          ===================================================== */}

      <mesh
        position={[
          rearAxleX,
          0.87,
          trailerWidth / 2 -
            0.05,
        ]}
        castShadow
      >
        <boxGeometry
          args={[
            1.36,
            0.12,
            0.39,
          ]}
        />

        <meshStandardMaterial
          color="#202427"
          roughness={0.74}
          metalness={0.16}
        />
      </mesh>

      <mesh
        position={[
          rearAxleX,
          0.87,
          -trailerWidth / 2 +
            0.05,
        ]}
        castShadow
      >
        <boxGeometry
          args={[
            1.36,
            0.12,
            0.39,
          ]}
        />

        <meshStandardMaterial
          color="#202427"
          roughness={0.74}
          metalness={0.16}
        />
      </mesh>

      {/* =====================================================
          СЕДЛО
          ===================================================== */}

      <group
        position={[
          kingpinX,
          1.04,
          0,
        ]}
      >
        <mesh
          castShadow
        >
          <cylinderGeometry
            args={[
              0.5,
              0.5,
              0.105,
              32,
            ]}
          />

          <meshStandardMaterial
            color="#15191b"
            roughness={0.4}
            metalness={0.74}
          />
        </mesh>

        <mesh
          position={[
            -0.08,
            0.07,
            0,
          ]}
        >
          <boxGeometry
            args={[
              0.76,
              0.08,
              0.84,
            ]}
          />

          <meshStandardMaterial
            color="#202529"
            roughness={0.45}
            metalness={0.66}
          />
        </mesh>
      </group>

      {/* =====================================================
          БАК
          ===================================================== */}

      <mesh
        position={[
          kingpinX -
            1.48,
          0.64,
          trailerWidth *
            0.36,
        ]}
        castShadow
      >
        <boxGeometry
          args={[
            1.12,
            0.5,
            0.45,
          ]}
        />

        <meshStandardMaterial
          color="#7e8589"
          roughness={0.32}
          metalness={0.76}
        />
      </mesh>

      {/* =====================================================
          ВОЗДУШНЫЕ БАЛЛОНЫ
          ===================================================== */}

      <mesh
        position={[
          kingpinX -
            1.14,
          0.57,
          -trailerWidth *
            0.34,
        ]}
        rotation={[
          0,
          0,
          Math.PI / 2,
        ]}
        castShadow
      >
        <cylinderGeometry
          args={[
            0.18,
            0.18,
            0.8,
            20,
          ]}
        />

        <meshStandardMaterial
          color="#31373a"
          roughness={0.48}
          metalness={0.64}
        />
      </mesh>

      {/* =====================================================
          ВЫХЛОП
          ===================================================== */}

      <mesh
        position={[
          cabCenterX +
            1.4,
          1.92,
          -cabWidth *
            0.38,
        ]}
        castShadow
      >
        <cylinderGeometry
          args={[
            0.062,
            0.062,
            2.15,
            16,
          ]}
        />

        <meshStandardMaterial
          color="#737a7e"
          roughness={0.32}
          metalness={0.78}
        />
      </mesh>

      {/* =====================================================
          ЗАПАСКА
          ===================================================== */}

      <mesh
        position={[
          kingpinX -
            1.2,
          0.45,
          0,
        ]}
        rotation={[
          0,
          0,
          Math.PI / 2,
        ]}
        castShadow
      >
        <torusGeometry
          args={[
            0.32,
            0.12,
            12,
            28,
          ]}
        />

        <meshStandardMaterial
          color="#151719"
          roughness={0.9}
          metalness={0.02}
        />
      </mesh>

      {/* =====================================================
          ЗАДНИЕ ФОНАРИ ТЯГАЧА
          ===================================================== */}

      <mesh
        position={[
          frameRearX,
          0.76,
          0.63,
        ]}
      >
        <boxGeometry
          args={[
            0.09,
            0.14,
            0.28,
          ]}
        />

        <meshStandardMaterial
          color="#a51d1d"
          emissive="#761010"
          emissiveIntensity={0.35}
        />
      </mesh>

      <mesh
        position={[
          frameRearX,
          0.76,
          -0.63,
        ]}
      >
        <boxGeometry
          args={[
            0.09,
            0.14,
            0.28,
          ]}
        />

        <meshStandardMaterial
          color="#a51d1d"
          emissive="#761010"
          emissiveIntensity={0.35}
        />
      </mesh>
    </group>
  );
}