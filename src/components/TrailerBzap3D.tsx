"use client";

import {
  useRef,
  useState,
} from "react";

import {
  useFrame,
} from "@react-three/fiber";

import * as THREE from "three";

type GateKey =
  | "rear"
  | "left-1"
  | "left-2"
  | "left-3"
  | "left-4"
  | "right-1"
  | "right-2"
  | "right-3"
  | "right-4";

type TrailerBzap3DProps = {
  length?: number;
  width?: number;
  deckHeight?: number;
  sideHeight?: number;
};

type AnimatedGateProps = {
  id: GateKey;

  open: boolean;

  onToggle: (
    id: GateKey,
  ) => void;

  hingePosition: [
    number,
    number,
    number,
  ];

  panelPosition: [
    number,
    number,
    number,
  ];

  size: [
    number,
    number,
    number,
  ];

  rotationAxis:
    | "x"
    | "z";

  openAngle: number;
};

function AnimatedGate({
  id,
  open,
  onToggle,
  hingePosition,
  panelPosition,
  size,
  rotationAxis,
  openAngle,
}: AnimatedGateProps) {
  const groupRef =
    useRef<THREE.Group>(
      null,
    );

  const [
    hovered,
    setHovered,
  ] = useState(
    false,
  );

  useFrame(
    (
      _state,
      delta,
    ) => {
      if (
        !groupRef.current
      ) {
        return;
      }

      const target =
        open
          ? openAngle
          : 0;

      if (
        rotationAxis ===
        "x"
      ) {
        groupRef.current.rotation.x =
          THREE.MathUtils.damp(
            groupRef.current.rotation.x,
            target,
            5.5,
            delta,
          );
      }

      if (
        rotationAxis ===
        "z"
      ) {
        groupRef.current.rotation.z =
          THREE.MathUtils.damp(
            groupRef.current.rotation.z,
            target,
            5.5,
            delta,
          );
      }
    },
  );

  return (
    <group
      ref={
        groupRef
      }
      position={
        hingePosition
      }
      onClick={(
        event,
      ) => {
        event.stopPropagation();

        onToggle(
          id,
        );
      }}
      onPointerOver={(
        event,
      ) => {
        event.stopPropagation();

        setHovered(
          true,
        );

        document.body.style.cursor =
          "pointer";
      }}
      onPointerOut={() => {
        setHovered(
          false,
        );

        document.body.style.cursor =
          "default";
      }}
    >
      <mesh
        position={
          panelPosition
        }
        castShadow
        receiveShadow
      >
        <boxGeometry
          args={
            size
          }
        />

        <meshStandardMaterial
          color={
            hovered
              ? "#d0a679"
              : "#aeb4b7"
          }
          roughness={0.42}
          metalness={0.58}
        />
      </mesh>

      <mesh
        position={[
          panelPosition[0],
          panelPosition[1],
          panelPosition[2],
        ]}
      >
        <boxGeometry
          args={[
            size[0] +
              0.012,
            size[1] +
              0.012,
            size[2] +
              0.012,
          ]}
        />

        <meshBasicMaterial
          color="#f1b77a"
          transparent
          opacity={
            hovered
              ? 0.1
              : 0
          }
          depthWrite={
            false
          }
        />
      </mesh>
    </group>
  );
}

function TrailerWheel({
  position,
}: {
  position: [
    number,
    number,
    number,
  ];
}) {
  return (
    <group
      position={
        position
      }
    >
      <mesh
        rotation={[
          Math.PI /
            2,
          0,
          0,
        ]}
        castShadow
        receiveShadow
      >
        <cylinderGeometry
          args={[
            0.47,
            0.47,
            0.31,
            28,
          ]}
        />

        <meshStandardMaterial
          color="#151719"
          roughness={0.84}
          metalness={0.05}
        />
      </mesh>

      <mesh
        rotation={[
          Math.PI /
            2,
          0,
          0,
        ]}
      >
        <cylinderGeometry
          args={[
            0.2,
            0.2,
            0.33,
            24,
          ]}
        />

        <meshStandardMaterial
          color="#a2a7aa"
          roughness={0.28}
          metalness={0.84}
        />
      </mesh>

      <mesh
        rotation={[
          Math.PI /
            2,
          0,
          0,
        ]}
      >
        <torusGeometry
          args={[
            0.33,
            0.025,
            8,
            28,
          ]}
        />

        <meshStandardMaterial
          color="#5c6266"
          roughness={0.45}
          metalness={0.68}
        />
      </mesh>
    </group>
  );
}

export default function TrailerBzap3D({
  length = 12.72,
  width = 2.53,
  deckHeight = 1.22,
  sideHeight = 0.6,
}: TrailerBzap3DProps) {
  const [
    openGates,
    setOpenGates,
  ] = useState<
    Record<
      GateKey,
      boolean
    >
  >({
    rear: false,

    "left-1": false,
    "left-2": false,
    "left-3": false,
    "left-4": false,

    "right-1": false,
    "right-2": false,
    "right-3": false,
    "right-4": false,
  });

  const toggleGate = (
    id: GateKey,
  ) => {
    setOpenGates(
      (
        previous,
      ) => ({
        ...previous,

        [id]:
          !previous[
            id
          ],
      }),
    );
  };

  const usableSideLength =
    length -
    0.42;

  const segmentGap =
    0.045;

  const segmentLength =
    (
      usableSideLength -
      segmentGap *
        3
    ) /
    4;

  const firstCenterX =
    -usableSideLength /
      2 +
    segmentLength /
      2;

  const sideCenters =
    Array.from({
      length: 4,
    }).map(
      (
        _,
        index,
      ) =>
        firstCenterX +
        index *
          (
            segmentLength +
            segmentGap
          ),
    );

  const axlePositions = [
    length /
      2 -
      2.75,

    length /
      2 -
      1.95,

    length /
      2 -
      1.15,
  ];

  const gateBottomY =
    deckHeight +
    0.06;

  const gateCenterY =
    gateBottomY +
    sideHeight /
      2;

  const stakeXs = [
    -usableSideLength /
      2,

    -usableSideLength /
        2 +
      usableSideLength /
        4,

    0,

    usableSideLength /
        2 -
      usableSideLength /
        4,

    usableSideLength /
      2,
  ];

  return (
    <group>
      {/* РАМА */}

      <mesh
        position={[
          0,
          deckHeight -
            0.38,
          0.44,
        ]}
        castShadow
      >
        <boxGeometry
          args={[
            length -
              0.25,
            0.3,
            0.17,
          ]}
        />

        <meshStandardMaterial
          color="#33393e"
          roughness={0.54}
          metalness={0.58}
        />
      </mesh>

      <mesh
        position={[
          0,
          deckHeight -
            0.38,
          -0.44,
        ]}
        castShadow
      >
        <boxGeometry
          args={[
            length -
              0.25,
            0.3,
            0.17,
          ]}
        />

        <meshStandardMaterial
          color="#33393e"
          roughness={0.54}
          metalness={0.58}
        />
      </mesh>

      {/* ПОПЕРЕЧИНЫ */}

      {Array.from({
        length: 11,
      }).map(
        (
          _,
          index,
        ) => {
          const x =
            -length /
              2 +
            0.55 +
            index *
              (
                (
                  length -
                  1.1
                ) /
                10
              );

          return (
            <mesh
              key={
                index
              }
              position={[
                x,
                deckHeight -
                  0.34,
                0,
              ]}
              castShadow
            >
              <boxGeometry
                args={[
                  0.1,
                  0.2,
                  width *
                    0.78,
                ]}
              />

              <meshStandardMaterial
                color="#3b4246"
                roughness={0.52}
                metalness={0.6}
              />
            </mesh>
          );
        },
      )}

      {/* ПЛАТФОРМА */}

      <mesh
        position={[
          0,
          deckHeight -
            0.13,
          0,
        ]}
        castShadow
        receiveShadow
      >
        <boxGeometry
          args={[
            length,
            0.23,
            width,
          ]}
        />

        <meshStandardMaterial
          color="#5a6064"
          roughness={0.46}
          metalness={0.55}
        />
      </mesh>

      {/* ПОЛ */}

      <mesh
        position={[
          0,
          deckHeight +
            0.025,
          0,
        ]}
        castShadow
        receiveShadow
      >
        <boxGeometry
          args={[
            length -
              0.08,
            0.065,
            width -
              0.08,
          ]}
        />

        <meshStandardMaterial
          color="#795b40"
          roughness={0.8}
          metalness={0.02}
        />
      </mesh>

      {/* ПЕРЕДНИЙ БОРТ */}

      <mesh
        position={[
          -length /
            2 +
            0.05,
          gateCenterY,
          0,
        ]}
        castShadow
        receiveShadow
      >
        <boxGeometry
          args={[
            0.09,
            sideHeight,
            width -
              0.1,
          ]}
        />

        <meshStandardMaterial
          color="#aeb4b7"
          roughness={0.42}
          metalness={0.58}
        />
      </mesh>

      {/* ЗАДНИЙ БОРТ — ОТКРЫВАЕТСЯ НАРУЖУ */}

      <AnimatedGate
        id="rear"
        open={
          openGates.rear
        }
        onToggle={
          toggleGate
        }
        hingePosition={[
          length /
            2 -
            0.05,
          gateBottomY,
          0,
        ]}
        panelPosition={[
          0,
          sideHeight /
            2,
          0,
        ]}
        size={[
          0.09,
          sideHeight,
          width -
            0.1,
        ]}
        rotationAxis="z"
        openAngle={
          -Math.PI /
          2
        }
      />

      {/* ЛЕВЫЕ БОРТА */}

      {sideCenters.map(
        (
          x,
          index,
        ) => {
          const id =
            `left-${
              index +
              1
            }` as GateKey;

          return (
            <AnimatedGate
              key={
                id
              }
              id={
                id
              }
              open={
                openGates[
                  id
                ]
              }
              onToggle={
                toggleGate
              }
              hingePosition={[
                x,
                gateBottomY,
                width /
                  2 -
                  0.045,
              ]}
              panelPosition={[
                0,
                sideHeight /
                  2,
                0,
              ]}
              size={[
                segmentLength,
                sideHeight,
                0.075,
              ]}
              rotationAxis="x"
              openAngle={
                Math.PI /
                2
              }
            />
          );
        },
      )}

      {/* ПРАВЫЕ БОРТА */}

      {sideCenters.map(
        (
          x,
          index,
        ) => {
          const id =
            `right-${
              index +
              1
            }` as GateKey;

          return (
            <AnimatedGate
              key={
                id
              }
              id={
                id
              }
              open={
                openGates[
                  id
                ]
              }
              onToggle={
                toggleGate
              }
              hingePosition={[
                x,
                gateBottomY,
                -width /
                  2 +
                  0.045,
              ]}
              panelPosition={[
                0,
                sideHeight /
                  2,
                0,
              ]}
              size={[
                segmentLength,
                sideHeight,
                0.075,
              ]}
              rotationAxis="x"
              openAngle={
                -Math.PI /
                2
              }
            />
          );
        },
      )}

      {/* СТОЙКИ */}

      {stakeXs.map(
        (
          x,
          index,
        ) => (
          <group
            key={
              index
            }
          >
            <mesh
              position={[
                x,
                gateCenterY,
                width /
                  2 -
                  0.018,
              ]}
              castShadow
            >
              <boxGeometry
                args={[
                  0.1,
                  sideHeight +
                    0.14,
                  0.1,
                ]}
              />

              <meshStandardMaterial
                color="#626a6f"
                roughness={0.4}
                metalness={0.68}
              />
            </mesh>

            <mesh
              position={[
                x,
                gateCenterY,
                -width /
                  2 +
                  0.018,
              ]}
              castShadow
            >
              <boxGeometry
                args={[
                  0.1,
                  sideHeight +
                    0.14,
                  0.1,
                ]}
              />

              <meshStandardMaterial
                color="#626a6f"
                roughness={0.4}
                metalness={0.68}
              />
            </mesh>
          </group>
        ),
      )}

      {/* ОСИ */}

      {axlePositions.map(
        (
          x,
          index,
        ) => (
          <group
            key={
              index
            }
          >
            <TrailerWheel
              position={[
                x,
                0.47,
                width /
                  2 -
                  0.14,
              ]}
            />

            <TrailerWheel
              position={[
                x,
                0.47,
                -width /
                  2 +
                  0.14,
              ]}
            />
          </group>
        ),
      )}

      {/* ОПОРНЫЕ ЛАПЫ */}

      <mesh
        position={[
          -length /
            2 +
            4.05,
          0.64,
          0.58,
        ]}
        castShadow
      >
        <boxGeometry
          args={[
            0.18,
            0.88,
            0.18,
          ]}
        />

        <meshStandardMaterial
          color="#555d61"
          roughness={0.44}
          metalness={0.68}
        />
      </mesh>

      <mesh
        position={[
          -length /
            2 +
            4.05,
          0.64,
          -0.58,
        ]}
        castShadow
      >
        <boxGeometry
          args={[
            0.18,
            0.88,
            0.18,
          ]}
        />

        <meshStandardMaterial
          color="#555d61"
          roughness={0.44}
          metalness={0.68}
        />
      </mesh>

      {/* ЯЩИК */}

      <mesh
        position={[
          0.35,
          0.69,
          0.78,
        ]}
        castShadow
      >
        <boxGeometry
          args={[
            1.7,
            0.46,
            0.47,
          ]}
        />

        <meshStandardMaterial
          color="#a1a6a9"
          roughness={0.43}
          metalness={0.58}
        />
      </mesh>

      {/* ЗАДНИЙ БАМПЕР */}

      <mesh
        position={[
          length /
            2 +
            0.13,
          0.62,
          0,
        ]}
        castShadow
      >
        <boxGeometry
          args={[
            0.18,
            0.28,
            width *
              0.86,
          ]}
        />

        <meshStandardMaterial
          color="#353b3f"
          roughness={0.58}
          metalness={0.52}
        />
      </mesh>

      {/* ФОНАРИ */}

      <mesh
        position={[
          length /
            2 +
            0.235,
          0.76,
          width *
            0.32,
        ]}
      >
        <boxGeometry
          args={[
            0.035,
            0.14,
            0.34,
          ]}
        />

        <meshStandardMaterial
          color="#b51919"
          emissive="#8f1111"
          emissiveIntensity={0.55}
        />
      </mesh>

      <mesh
        position={[
          length /
            2 +
            0.235,
          0.76,
          -width *
            0.32,
        ]}
      >
        <boxGeometry
          args={[
            0.035,
            0.14,
            0.34,
          ]}
        />

        <meshStandardMaterial
          color="#b51919"
          emissive="#8f1111"
          emissiveIntensity={0.55}
        />
      </mesh>
    </group>
  );
}