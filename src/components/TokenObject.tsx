/**
 * The 3D token.
 *
 * A struck coin: a bevelled disc in the token's metal with that token's
 * own mark extruded in relief on its face. Selecting a different token
 * flips the coin edge-over-edge and re-strikes it.
 *
 * The relief is built by running the mark's path through three's
 * `SVGLoader` and extruding the shapes it returns, so the coin and the
 * 20px icon in the holdings row come from the same drawing. The
 * alternative — hand-building eight `THREE.Shape`s — would have been
 * eight more drawings to keep in step with the first eight.
 *
 * Everything animates on the render loop rather than through `Animated`:
 * RN's animation system drives RN styles, and nothing inside the canvas
 * is one.
 */

import { useMemo, useRef } from "react";
import { StyleSheet, View } from "react-native";
import { Canvas, useFrame } from "@react-three/fiber";
import type { Group, Mesh, MeshStandardMaterial } from "three";
import { Color, ExtrudeGeometry, type Shape } from "three";
import { SVGLoader } from "three/examples/jsm/loaders/SVGLoader.js";

import { useVesper } from "../hooks/useVesper";
import { color as palette, spring } from "../theme";
import { TOKEN_GLYPH_PATH } from "./tokenGlyphs";

/** Each token's metal. */
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
 * The extruded relief for a token, or null when we have no glyph.
 *
 * Cached by symbol. Parsing SVG and triangulating shapes is not
 * expensive, but doing it on every frame of a flip would be.
 */
const geometryCache = new Map<string, ExtrudeGeometry | null>();

function glyphGeometry(symbol: string): ExtrudeGeometry | null {
  const cached = geometryCache.get(symbol);
  if (cached !== undefined) return cached;

  const path = TOKEN_GLYPH_PATH[symbol];
  if (!path) {
    geometryCache.set(symbol, null);
    return null;
  }

  try {
    const parsed = new SVGLoader().parse(`<svg><path d="${path}"/></svg>`);
    const shapes: Shape[] = [];
    for (const subPath of parsed.paths) {
      shapes.push(...SVGLoader.createShapes(subPath));
    }
    if (shapes.length === 0) {
      geometryCache.set(symbol, null);
      return null;
    }

    const geometry = new ExtrudeGeometry(shapes, {
      depth: 1.4,
      bevelEnabled: true,
      bevelThickness: 0.4,
      bevelSize: 0.3,
      bevelSegments: 2,
    });

    // SVG's y grows downward and three's grows up, so the glyph arrives
    // upside down. Flip it, then centre on its own bounds rather than
    // trusting the 24 grid — several of these marks are not symmetric.
    geometry.scale(1, -1, 1);
    geometry.center();
    geometry.computeBoundingBox();

    // Normalise to about 1.5 units across, whatever its natural size.
    const box = geometry.boundingBox;
    if (box) {
      const span = Math.max(box.max.x - box.min.x, box.max.y - box.min.y) || 1;
      const scale = 1.5 / span;
      geometry.scale(scale, scale, scale);
    }

    geometryCache.set(symbol, geometry);
    return geometry;
  } catch {
    // A glyph that will not triangulate is not worth taking the screen
    // down for; the coin renders blank instead.
    geometryCache.set(symbol, null);
    return null;
  }
}

/** A critically-damped-ish spring, integrated per frame. */
function useSpringRef(initial: number, tension: number, friction: number) {
  const current = useRef(initial);
  const velocity = useRef(0);

  const step = (target: number, delta: number) => {
    // Clamp the step: a backgrounded tab resumes with a huge delta, and
    // an unclamped integration explodes rather than settling.
    const dt = Math.min(delta, 1 / 30);
    const acceleration = -tension * (current.current - target) - friction * velocity.current;
    velocity.current += acceleration * dt;
    current.current += velocity.current * dt;
    return current.current;
  };

  return { step };
}

function Coin({
  symbol,
  tone,
  flipIndex,
  reduceMotion,
}: {
  symbol: string;
  tone: string;
  flipIndex: number;
  reduceMotion: boolean;
}) {
  const group = useRef<Group>(null);
  const disc = useRef<Mesh>(null);
  const ringA = useRef<Mesh>(null);
  const ringB = useRef<Mesh>(null);

  const flip = useSpringRef(0, spring.flip.tension, spring.flip.friction);
  const tiltX = useSpringRef(0, spring.track.tension, spring.track.friction);
  const tiltY = useSpringRef(0, spring.track.tension, spring.track.friction);

  const target = useMemo(() => new Color(tone), [tone]);
  const relief = useMemo(() => glyphGeometry(symbol), [symbol]);

  /**
   * The relief is struck in a lighter grade of the same metal.
   *
   * It was near-black, which is legible and is not a coin: a black mark
   * on a gold face reads as a sticker, or as a hole. A real strike is
   * the same metal catching the light at a different angle, so the mark
   * is the tone mixed most of the way to white.
   *
   * It is barely metallic, which is the opposite of what it looks like
   * it should be. There is no environment map in this scene — only two
   * point lights and a sun — and a fully metallic surface has nothing
   * to reflect but the void, so it renders black however bright its
   * colour. The face gets away with `metalness: 0.9` because it carries
   * an emissive; the mark carries its own, and takes its brightness
   * from the light instead of from a reflection that is not there.
   */
  const reliefTone = useMemo(() => new Color(tone).lerp(new Color("#FFFFFF"), 0.62), [tone]);

  useFrame((state, delta) => {
    if (!group.current || !disc.current) return;

    const flipTarget = flipIndex * Math.PI;

    if (reduceMotion) {
      group.current.rotation.set(0, flipTarget, 0);
    } else {
      // A slow drift rather than a spin. The face carries a mark now,
      // and a mark you cannot read is worse than no mark.
      group.current.rotation.y =
        flip.step(flipTarget, delta) +
        Math.sin(state.clock.elapsedTime * 0.35) * 0.24 +
        tiltY.step(state.pointer.x * -0.45, delta);

      group.current.rotation.x =
        Math.sin(state.clock.elapsedTime * 0.25) * 0.09 +
        tiltX.step(state.pointer.y * 0.3, delta);

      if (ringA.current) ringA.current.rotation.z += delta * 0.5;
      if (ringB.current) ringB.current.rotation.z -= delta * 0.3;
    }

    // Cross-fade the metal rather than cutting, so a selection reads as
    // one object changing state instead of two objects swapping.
    const material = disc.current.material as MeshStandardMaterial;
    material.color.lerp(target, reduceMotion ? 1 : Math.min(1, delta * 4));
    material.emissive.lerp(target, reduceMotion ? 1 : Math.min(1, delta * 4));
  });

  return (
    <group ref={group}>
      <mesh ref={disc} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[1.5, 1.5, 0.3, 64]} />
        <meshStandardMaterial metalness={0.9} roughness={0.3} emissiveIntensity={0.22} />
      </mesh>

      {/* Struck proud of the face: the disc's half-thickness is 0.15, so
          anything nearer than that is buried inside it. */}
      {relief && (
        <>
          <mesh geometry={relief} position={[0, 0, 0.18]} scale={[1, 1, 0.055]}>
            <meshStandardMaterial
              color={reliefTone}
              metalness={0.2}
              roughness={0.38}
              emissive={reliefTone}
              emissiveIntensity={0.3}
            />
          </mesh>
          {/* Struck on the reverse too, so the flip lands on a face
              rather than a blank back. */}
          <mesh
            geometry={relief}
            position={[0, 0, -0.18]}
            rotation={[0, Math.PI, 0]}
            scale={[1, 1, 0.055]}
          >
            <meshStandardMaterial
              color={reliefTone}
              metalness={0.2}
              roughness={0.38}
              emissive={reliefTone}
              emissiveIntensity={0.3}
            />
          </mesh>
        </>
      )}

      <mesh ref={ringA} rotation={[Math.PI / 2.6, 0, 0]}>
        <torusGeometry args={[2.1, 0.012, 8, 96]} />
        <meshBasicMaterial color={palette.accent} transparent opacity={0.3} />
      </mesh>
      <mesh ref={ringB} rotation={[Math.PI / 1.8, Math.PI / 5, 0]}>
        <torusGeometry args={[2.5, 0.009, 8, 96]} />
        <meshBasicMaterial color={palette.accent} transparent opacity={0.16} />
      </mesh>
    </group>
  );
}

interface TokenObjectProps {
  /** Ticker, which picks the metal and the relief. */
  symbol: string;
  /** Changes whenever the selection changes, to trigger the flip. */
  flipIndex: number;
  height?: number;
  /** How far back the camera sits; the outer ring has a radius of 2.5. */
  distance?: number;
}

export function TokenObject({
  symbol,
  flipIndex,
  height = 220,
  distance = 7.2,
}: TokenObjectProps) {
  const { reduceMotion } = useVesper();

  return (
    <View style={[styles.root, { height }]} pointerEvents="box-none">
      <Canvas
        camera={{ position: [0, 0, distance], fov: 48 }}
        gl={{ antialias: true, alpha: true }}
        dpr={[1, 2]}
        frameloop={reduceMotion ? "demand" : "always"}
      >
        <ambientLight intensity={0.85} />
        <directionalLight position={[-3, 4, 5]} intensity={3.6} />
        <pointLight position={[3.5, -1.5, 2.5]} intensity={34} color={palette.accent} />
        <pointLight position={[-2.5, -2, -2]} intensity={14} color="#4B6CF0" />

        <Coin
          symbol={symbol}
          tone={tokenColor(symbol)}
          flipIndex={flipIndex}
          reduceMotion={reduceMotion}
        />
      </Canvas>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    width: "100%",
  },
});
