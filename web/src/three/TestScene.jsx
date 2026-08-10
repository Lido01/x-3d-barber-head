import { Canvas } from "@react-three/fiber";

function Cube() {
  return (
    <mesh rotation={[0.4, 0.4, 0]}>
      <boxGeometry />
      <meshStandardMaterial />
    </mesh>
  );
}

export default function TestScene() {
  return (
    <div className="h-125 w-full">
      <Canvas camera={{ position: [0, 0, 5] }}>
        <ambientLight intensity={1} />

        <Cube />
      </Canvas>
    </div>
  );
}