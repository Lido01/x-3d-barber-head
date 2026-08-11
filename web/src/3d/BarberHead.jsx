import { useFrame } from "@react-three/fiber";
import { useRef } from "react";

export default function BarberHead({
  haircut = "Low Fade",
}) {
  const group = useRef();

  useFrame((state) => {
    if (!group.current) return;

    const targetX = state.pointer.y * 0.08;
    const targetY = state.pointer.x * 0.18;

    group.current.rotation.x +=
      (targetX - group.current.rotation.x) * 0.035;

    group.current.rotation.y +=
      (targetY - group.current.rotation.y) * 0.035;
  });

  const hairScale = {
    "Low Fade": 1.02,
    "Mid Fade": 1.06,
    "High Fade": 1.1,
    "Skin Fade": 1.04,
  };

  return (
    <group ref={group} position={[0, -0.8, 0]}>

      {/* NECK */}
      <mesh position={[0, -1.5, 0]}>
        <cylinderGeometry args={[0.58, 0.7, 1.25, 48]} />
        <meshStandardMaterial
          color="#8e604a"
          roughness={0.78}
        />
      </mesh>

      {/* HEAD */}
      <mesh scale={[1.12, 1.28, 1.03]}>
        <sphereGeometry args={[1, 64, 64]} />

        <meshStandardMaterial
          color="#a66f56"
          roughness={0.72}
          metalness={0.02}
        />
      </mesh>

      {/* EARS */}
      <mesh position={[-1.02, 0, 0]}>
        <sphereGeometry args={[0.22, 32, 32]} />

        <meshStandardMaterial
          color="#9b6650"
          roughness={0.75}
        />
      </mesh>

      <mesh position={[1.02, 0, 0]}>
        <sphereGeometry args={[0.22, 32, 32]} />

        <meshStandardMaterial
          color="#9b6650"
          roughness={0.75}
        />
      </mesh>

      {/* HAIR */}
      <mesh
        position={[0, 0.82, -0.02]}
        scale={[
          1.05 * hairScale[haircut],
          0.55,
          1.03 * hairScale[haircut],
        ]}
      >
        <sphereGeometry args={[1, 64, 32]} />

        <meshStandardMaterial
          color="#171310"
          roughness={0.48}
        />
      </mesh>

      {/* HAIR TOP TEXTURE */}
      <mesh position={[0, 1.08, 0.15]}>
        <sphereGeometry args={[0.72, 48, 24]} />

        <meshStandardMaterial
          color="#100d0b"
          roughness={0.42}
        />
      </mesh>

      {/* EYEBROWS */}
      <mesh position={[-0.38, 0.25, 0.93]} rotation={[0, 0, -0.08]}>
        <boxGeometry args={[0.38, 0.055, 0.07]} />

        <meshStandardMaterial color="#211713" />
      </mesh>

      <mesh position={[0.38, 0.25, 0.93]} rotation={[0, 0, 0.08]}>
        <boxGeometry args={[0.38, 0.055, 0.07]} />

        <meshStandardMaterial color="#211713" />
      </mesh>

      {/* LEFT EYE */}
      <mesh position={[-0.38, 0.04, 0.94]}>
        <sphereGeometry args={[0.095, 32, 32]} />
        <meshStandardMaterial color="#17110e" />
      </mesh>

      {/* RIGHT EYE */}
      <mesh position={[0.38, 0.04, 0.94]}>
        <sphereGeometry args={[0.095, 32, 32]} />
        <meshStandardMaterial color="#17110e" />
      </mesh>

      {/* NOSE */}
      <mesh position={[0, -0.12, 1]}>
        <coneGeometry args={[0.15, 0.42, 32]} />

        <meshStandardMaterial
          color="#925e49"
          roughness={0.75}
        />
      </mesh>

      {/* BEARD */}
      <mesh
        position={[0, -0.7, 0.73]}
        scale={[0.62, 0.46, 0.18]}
      >
        <sphereGeometry args={[1, 48, 24]} />

        <meshStandardMaterial
          color="#211915"
          roughness={0.65}
        />
      </mesh>

      {/* MOUTH */}
      <mesh position={[0, -0.48, 0.91]}>
        <boxGeometry args={[0.3, 0.035, 0.025]} />

        <meshStandardMaterial color="#351b19" />
      </mesh>

    </group>
  );
}