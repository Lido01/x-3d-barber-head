import { useGLTF } from "@react-three/drei";

export default function CustomerModel() {
  const { scene } = useGLTF("/models/head_sculp.glb");

  return (
    <primitive
      object={scene}
      scale={2}
      position={[0, -1, 0]}
    />
  );
}