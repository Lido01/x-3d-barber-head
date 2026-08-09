import { Canvas } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";

function Cube() {
  return (
    <mesh rotation={[0.4, 0.4, 0]}>
      <boxGeometry args={[2, 2, 2]} />

      <meshStandardMaterial
        color="#d6a85f"
      />
    </mesh>
  );
}

export default function BarberScene() {
  return (
    <div className="h-[500px] w-full">
      <Canvas
        camera={{
          position: [0, 0, 5],
          fov: 45,
        }}
      >
        <ambientLight intensity={1} />

        <Cube />

        <OrbitControls />
      </Canvas>
    </div>
  );
}