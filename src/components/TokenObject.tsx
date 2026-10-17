/**
 * The one 3D object in the product.
 *
 * A faceted metal prism with two rings around it, one per selected token.
 * Selecting a different token flips it on its axis and cross-fades the
 * metal to that token's colour.
 *
 * Deliberately not a coin with a ticker stamped on it. A literal coin
 * needs type on its face, type in three.js needs a font file, and the
 * obvious font loads from a CDN — a network dependency inside an app whose
 * whole argument is that it tells you where its data comes from. The
 * symbol is set in the 2D layer underneath instead, where it is crisper
 * anyway.
 *
 * Everything here animates on the render loop rather than through
 * `Animated`: RN's animation system drives RN styles, and nothing inside
 * the canvas is one.
 */

import { useMemo, useRef } from "react";
import { StyleSheet, View } from "react-native";
import { Canvas, useFrame, type ThreeElements } from "@react-three/fiber";
import type { Group, Mesh, MeshStandardMaterial } from "three";
import { Color } from "three";

import { useVesper } from "../hooks/useVesper";
import { color as palette, spring } from "../theme";

/** Each token's metal. Recognisable without being the brand logo. */
const TOKEN_COLOR: Record<string, string> = {
  BTC: "#F7A14E",
  ETH: "#8E9BF5",
  SOL: "#3FE0A8",
  LINK: "#5B9BF8",
  ADA: "#4C8DF6",
  DOT: "#F06AB5",
  AVAX: "#F06A6A",
  MATIC: "#A373F0",
};

export const tokenColor = (symbol: string): string => TOKEN_COLOR[symbol] ?? palette.accent;

/**
 * A critically-damped-ish spring, integrated per frame.
 *
 * Mirrors `theme.spring.flip` so the 3D motion and the 2D motion are
 * describable with the same two numbers, rather than one being a duration
 * and the other a feel.
 */
function useSpringRef(initial: number, tension: number, friction: number) {
  const current = useRef(initial);
  const velocity = useRef(0);

  const step = (target: number, delta: number) => {
    // Clamp the step: a backgrounded tab resumes with a huge delta, and an
    // unclamped integration explodes rather than settling.
    const dt = Math.min(delta, 1 / 30);
    const acceleration = -tension * (current.current - target) - friction * velocity.current;
    velocity.current += acceleration * dt;
    current.current += velocity.current * dt;
    return current.current;
  };

  return { step, set: (value: number) => (current.current = value) };
}

interface PrismProps {
  tone: string;
  /** Increments on every selection, driving a half-turn each time. */
  flipIndex: number;
  reduceMotion: boolean;
}

function Prism({ tone, flipIndex, reduceMotion }: PrismProps) {
  const group = useRef<Group>(null);
  const mesh = useRef<Mesh>(null);
  const ringA = useRef<Mesh>(null);
  const ringB = useRef<Mesh>(null);

  const flip = useSpringRef(0, spring.flip.tension, spring.flip.friction);
  const tiltX = useSpringRef(0, spring.track.tension, spring.track.friction);
  const tiltY = useSpringRef(0, spring.track.tension, spring.track.friction);

  const target = useMemo(() => new Color(tone), [tone]);

  useFrame((state, delta) => {
    if (!group.current || !mesh.current) return;

    const flipTarget = flipIndex * Math.PI;

    if (reduceMotion) {
      group.current.rotation.set(0, flipTarget, 0);
    } else {
      // Two rotations doing different jobs. The idle spin is in-plane, on
      // the axis pointing at the camera, so the face stays toward the
      // viewer and the prism always reads as a solid hexagon. Folding the
      // idle spin into the flip axis instead left it edge-on, and a
      // sliver, for half of every revolution.
      group.current.rotation.z = state.clock.elapsedTime * 0.22;

      // The flip is edge-over-edge, and only ever on selection.
      group.current.rotation.y =
        flip.step(flipTarget, delta) + tiltY.step(state.pointer.x * -0.4, delta);

      // `pointer` is already normalised to −1..1 across the canvas.
      group.current.rotation.x = tiltX.step(state.pointer.y * 0.34, delta);

      if (ringA.current) ringA.current.rotation.z += delta * 0.5;
      if (ringB.current) ringB.current.rotation.z -= delta * 0.3;
    }

    // Cross-fade the metal rather than cutting, so a selection reads as one
    // object changing state instead of two objects swapping.
    const material = mesh.current.material as MeshStandardMaterial;
    material.color.lerp(target, reduceMotion ? 1 : Math.min(1, delta * 4));
    material.emissive.lerp(target, reduceMotion ? 1 : Math.min(1, delta * 4));
  });

  const ringMaterial: ThreeElements["meshBasicMaterial"] = {
    color: palette.accent,
    transparent: true,
    opacity: 0.3,
  };

  return (
    <group ref={group}>
      <mesh ref={mesh} rotation={[Math.PI / 2, 0, 0]}>
        {/* Six-sided prism: faceted enough to catch the key light as it
            turns, regular enough not to read as a gemstone. */}
        <cylinderGeometry args={[1.25, 1.25, 0.34, 6]} />
        <meshStandardMaterial
          metalness={0.92}
          roughness={0.26}
          emissiveIntensity={0.3}
        />
      </mesh>

      <mesh ref={ringA} rotation={[Math.PI / 2.6, 0, 0]}>
        <torusGeometry args={[1.85, 0.012, 8, 96]} />
        <meshBasicMaterial {...ringMaterial} />
      </mesh>

      <mesh ref={ringB} rotation={[Math.PI / 1.8, Math.PI / 5, 0]}>
        <torusGeometry args={[2.25, 0.009, 8, 96]} />
        <meshBasicMaterial {...ringMaterial} opacity={0.14} />
      </mesh>
    </group>
  );
}

interface TokenObjectProps {
  /** Ticker, which picks the metal colour. */
  symbol: string;
  /** Changes whenever the selection changes, to trigger the flip. */
  flipIndex: number;
  height?: number;
  /**
   * How far back the camera sits. The outer ring has a radius of 2.25, so
   * a short canvas clips it unless the camera pulls back — which is what
   * the intro, at 260px tall and showing the object at full size, needs.
   */
  distance?: number;
}

export function TokenObject({
  symbol,
  flipIndex,
  height = 220,
  distance = 5.6,
}: TokenObjectProps) {
  const { reduceMotion } = useVesper();
  const tone = tokenColor(symbol);

  return (
    <View style={[styles.root, { height }]} pointerEvents="box-none">
      <Canvas
        camera={{ position: [0, 0, distance], fov: 48 }}
        // Clear to the card surface rather than transparent: an alpha
        // canvas composited over a glow costs a full-screen blend on every
        // frame for a difference nobody can see.
        gl={{ antialias: true, alpha: true }}
        dpr={[1, 2]}
        frameloop={reduceMotion ? "demand" : "always"}
      >
        <ambientLight intensity={0.8} />
        <directionalLight position={[-3, 4, 4]} intensity={3.4} />
        <pointLight position={[3.5, -1.5, 2.5]} intensity={34} color={palette.accent} />
        <pointLight position={[-2.5, -2, -2]} intensity={14} color="#4B6CF0" />

        <Prism tone={tone} flipIndex={flipIndex} reduceMotion={reduceMotion} />
      </Canvas>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    width: "100%",
  },
});
