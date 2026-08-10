import { Canvas } from "@react-three/fiber";
import {
  ContactShadows,
  Environment,
  Float,
  OrbitControls,
} from "@react-three/drei";

import BarberHead from "./BarberHead";

export default function BarberScene({
  haircut,
}) {
  return (
    <div className="relative h-[520px] w-full sm:h-[600px]">

      {/* GLOW */}
      <div className="absolute left-1/2 top-1/2 h-72 w-72 -translate-x-1/2 -translate-y-1/2 rounded-full bg-[#d6a85f]/10 blur-[100px]" />

      <Canvas
        dpr={[1, 1.5]}
        camera={{
          position: [0, 0, 5],
          fov: 34,
        }}
      >

        <color attach="background" args={["#090909"]} />

        <ambientLight intensity={0.65} />

        {/* KEY */}
        <spotLight
          position={[3, 5, 4]}
          angle={0.4}
          penumbra={1}
          intensity={4}
        />

        {/* RIM */}
        <pointLight
          position={[-3, 2, -3]}
          intensity={12}
          distance={8}
        />

        <Environment preset="studio" />

        <Float
          speed={1.2}
          rotationIntensity={0.12}
          floatIntensity={0.18}
        >
          <BarberHead haircut={haircut} />
        </Float>

        <ContactShadows
          position={[0, -2.1, 0]}
          opacity={0.45}
          scale={5}
          blur={2.5}
          far={4}
        />

        <OrbitControls
          enableZoom={false}
          enablePan={false}
          minPolarAngle={Math.PI / 2.4}
          maxPolarAngle={Math.PI / 1.7}
        />

      </Canvas>

      {/* 3D LABEL */}
      <div className="pointer-events-none absolute bottom-6 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full border border-white/10 bg-black/50 px-4 py-2 text-[10px] uppercase tracking-[0.25em] text-white/40 backdrop-blur-md">
        Move your cursor to explore
      </div>
    </div>
  );
}