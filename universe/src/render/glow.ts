// Glows (art track A1, A4): the soft light of the era's games — a planet's rim of air, a
// star's corona — as a camera-facing disc painted with a radial gradient and added to
// what lies behind it. One texture per glow, made once on a canvas.
import * as pc from "playcanvas";
import type { Stage } from "./stage.ts";

/** A gradient's stops, from the middle (0) to the edge (1), as CSS colours. */
export type GlowStops = readonly (readonly [number, string])[];

/** An unlit, additive material painted with a radial gradient. */
export function glowMaterial(stage: Stage, stops: GlowStops): pc.StandardMaterial {
  const size = 256,
    canvas = document.createElement("canvas");
  canvas.width = canvas.height = size;
  const g = canvas.getContext("2d")!,
    r = size / 2,
    grad = g.createRadialGradient(r, r, 0, r, r, r);
  for (const [at, color] of stops) grad.addColorStop(at, color);
  g.fillStyle = grad;
  g.fillRect(0, 0, size, size);
  const texture = new pc.Texture(stage.device, {
    width: size,
    height: size,
    format: pc.PIXELFORMAT_RGBA8,
    mipmaps: true,
  });
  texture.setSource(canvas);
  const m = new pc.StandardMaterial();
  m.useLighting = false;
  m.diffuse = new pc.Color(0, 0, 0);
  m.emissive = new pc.Color(1, 1, 1);
  m.emissiveMap = texture;
  m.opacityMap = texture;
  m.opacityMapChannel = "a";
  m.blendType = pc.BLEND_ADDITIVEALPHA;
  m.depthWrite = false;
  m.cull = pc.CULLFACE_NONE;
  m.update();
  return m;
}

/**
 * A glow of `radius` about a point of `parent`, turned to the camera every frame (while it
 * is enabled). Returns its entity, to place, scale or hide.
 */
export function billboard(
  stage: Stage,
  material: pc.Material,
  radius: number,
  parent: pc.Entity,
): pc.Entity {
  const e = new pc.Entity("glow"),
    mi = new pc.MeshInstance(
      pc.Mesh.fromGeometry(
        stage.device,
        new pc.PlaneGeometry({ halfExtents: new pc.Vec2(radius, radius) }),
      ),
      material,
    );
  e.addComponent("render", { meshInstances: [mi] });
  parent.addChild(e);
  stage.onUpdate(() => {
    if (!e.enabled) return;
    // (Drawn only where the setting allows glows.)
    mi.visible = stage.quality.glows;
    // The disc's face (its +y) turned to the camera.
    e.lookAt(stage.camera.getPosition());
    e.rotateLocal(-90, 0, 0);
  });
  return e;
}
