import { Canvas } from "@react-three/fiber";
import {
  Environment,
  OrbitControls,
} from "@react-three/drei";

import CustomerModel from "./CustomerScene";

export default function BarberScene() {
  return (
    <div className="h-[600px] w-full">
      <Canvas
        camera={{
          position: [0, 0.5, 5],
          fov: 35,
        }}
      >
        <ambientLight intensity={0.6} />

        <directionalLight
          position={[3, 5, 3]}
          intensity={2}
        />

        <Environment preset="studio" />

        <CustomerModel />

        <OrbitControls
          enableZoom={false}
        />
      </Canvas>
    </div>
  );
}