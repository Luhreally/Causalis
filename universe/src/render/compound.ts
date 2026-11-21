// A home drawn as one instance (view/compound.ts): each shape's mesh laid out from its pieces, and the materials that place
// a shape's pieces by its instance. Each corner carries, in its position's fourth number, whose colour its piece is drawn in,
// whether it is the roof's (laid by the instance's roof: its own breadth, height and depth, on the walls' top), and how many
// centimetres it stands up past its share of the home's height (a part as thick wherever it stands). A plain part's corners
// carry 1 there, as every mesh's do: the materials draw those as they always have.
import * as pc from "playcanvas";
import {
  COMPOUNDS,
  LAMP_COMPOUNDS,
  type CompoundMesh,
  type CompoundPiece,
  type LampMesh,
} from "../view/index.ts";
import { GABLE_FACES } from "./batch.ts";
import { toneOf, type Rgb } from "./stage.ts";

type Corner = readonly [number, number, number];

/** A box a unit each way about its middle: its faces, each its corners about its outward side, and which side it is. */
const BOX_FACES: readonly { side: "top" | "bottom" | "side"; corners: readonly Corner[] }[] = [
  {
    side: "side",
    corners: [
      [0.5, -0.5, 0.5],
      [0.5, -0.5, -0.5],
      [0.5, 0.5, -0.5],
      [0.5, 0.5, 0.5],
    ],
  },
  {
    side: "side",
    corners: [
      [-0.5, -0.5, -0.5],
      [-0.5, -0.5, 0.5],
      [-0.5, 0.5, 0.5],
      [-0.5, 0.5, -0.5],
    ],
  },
  {
    side: "side",
    corners: [
      [-0.5, -0.5, 0.5],
      [0.5, -0.5, 0.5],
      [0.5, 0.5, 0.5],
      [-0.5, 0.5, 0.5],
    ],
  },
  {
    side: "side",
    corners: [
      [0.5, -0.5, -0.5],
      [-0.5, -0.5, -0.5],
      [-0.5, 0.5, -0.5],
      [0.5, 0.5, -0.5],
    ],
  },
  {
    side: "top",
    corners: [
      [-0.5, 0.5, 0.5],
      [0.5, 0.5, 0.5],
      [0.5, 0.5, -0.5],
      [-0.5, 0.5, -0.5],
    ],
  },
  {
    side: "bottom",
    corners: [
      [-0.5, -0.5, -0.5],
      [0.5, -0.5, -0.5],
      [0.5, -0.5, 0.5],
      [-0.5, -0.5, 0.5],
    ],
  },
];

/** What a corner's fourth number says (always 2 and more: a plain mesh's corners carry 1). */
export function cornerCode(tone: number, roof: boolean, upCm: number): number {
  return 2 + tone + (roof ? 4 : 0) + 8 * (Math.round(upCm) + 32768);
}

/** A shape's mesh, its pieces laid out in the instance's unit box as view/compound.ts has them. */
export function compoundMesh(device: pc.GraphicsDevice, pieces: readonly CompoundPiece[]): pc.Mesh {
  const positions: number[] = [],
    normals: number[] = [],
    indices: number[] = [];
  for (const p of pieces) {
    const faces =
      p.mesh === "gable"
        ? GABLE_FACES.map((corners) => ({ side: "side" as const, corners }))
        : BOX_FACES.filter((f) => f.side === "side" || !p.skip?.includes(f.side));
    for (const f of faces) {
      const [a, b, c] = f.corners as [Corner, Corner, Corner],
        u = [b[0] - a[0], b[1] - a[1], b[2] - a[2]],
        v = [c[0] - a[0], c[1] - a[1], c[2] - a[2]],
        n = [
          u[1]! * v[2]! - u[2]! * v[1]!,
          u[2]! * v[0]! - u[0]! * v[2]!,
          u[0]! * v[1]! - u[1]! * v[0]!,
        ],
        // (Its normal as the piece is stretched: a roof's slope is laid by the instance, as a gable part is.)
        sx = p.roof ? 1 : p.s[0] || 1,
        sy = p.roof ? 1 : p.s[1] || 1,
        sz = p.roof ? 1 : p.s[2] || 1,
        nx = n[0]! / sx,
        ny = n[1]! / sy,
        nz = n[2]! / sz,
        len = Math.hypot(nx, ny, nz) || 1,
        base = positions.length / 4;
      for (const q of f.corners) {
        if (p.roof) positions.push(q[0], q[1], q[2], cornerCode(p.tone, true, 0));
        else
          positions.push(
            p.c[0] + p.s[0] * q[0],
            p.c[1] + p.s[1] * q[1],
            p.c[2] + p.s[2] * q[2],
            cornerCode(p.tone, false, (p.dy + p.hy * q[1]) * 100),
          );
        normals.push(nx / len, ny / len, nz / len);
      }
      for (let k = 1; k + 1 < f.corners.length; k++) indices.push(base, base + k, base + k + 1);
    }
  }
  const mesh = new pc.Mesh(device);
  mesh.setPositions(positions, 4);
  mesh.setNormals(normals);
  mesh.setIndices(indices);
  mesh.update();
  return mesh;
}

/** Every shape's mesh, made once for a town's layer. */
export function compoundMeshes(
  device: pc.GraphicsDevice,
): Record<CompoundMesh | LampMesh, pc.Mesh> {
  const out = {} as Record<CompoundMesh | LampMesh, pc.Mesh>;
  for (const [k, pieces] of Object.entries({ ...COMPOUNDS, ...LAMP_COMPOUNDS }))
    out[k as CompoundMesh | LampMesh] = compoundMesh(device, pieces);
  return out;
}

/** A roof's colour as one number in an instance (red, green, blue to 255 each). */
export function roofCode(c: Rgb): number {
  const b = (v: number) => Math.max(0, Math.min(255, Math.round(v * 255)));
  return b(c[0]) * 65536 + b(c[1]) * 256 + b(c[2]);
}

/**
 * How a corner is placed: a plain mesh's by its instance's matrix as ever; a shape's by its instance's breadth and depth
 * (turned), its height, and its middle; its roof's by the roof's own size, on the walls' top. `TONED`: its colour with it.
 */
function placeVS(toned: boolean): string {
  return `
attribute vec4 instance_line1;
attribute vec4 instance_line2;
attribute vec4 instance_line3;
attribute vec4 instance_line4;
uniform float uMetre;
${toned ? "uniform vec3 uFrameTone;\nuniform vec3 uTarTone;\nvarying vec3 vTone;\nvarying float vRoof;" : ""}
mat4 getModelMatrix() {
${toned ? "\tvTone = vec3(instance_line1.w, instance_line2.w, instance_line3.w);\n\tvRoof = 0.0;" : ""}
	float code = vertex_position.w;
	if (code < 1.5) return matrix_model * mat4(vec4(instance_line1.xyz, 0.0), vec4(instance_line2.xyz, 0.0), vec4(instance_line3.xyz, 0.0), ${toned ? "instance_line4" : "vec4(instance_line4.xyz, 1.0)"});
	float c = code - 2.0;
	float tone = mod(c, 4.0);
	float roof = mod(floor(c / 4.0), 2.0);
	float up = (floor(c / 8.0) - 32768.0) * 0.01 * uMetre;
	vec3 ax = vec3(instance_line1.x, 0.0, instance_line1.z);
	vec3 az = vec3(instance_line3.x, 0.0, instance_line3.z);
	float h = instance_line2.y;
	vec3 at = instance_line4.xyz;
	if (roof > 0.5) {
		float rh = instance_line2.x;
${
  toned
    ? `\t\tfloat p = instance_line4.w;
		vTone = pow(vec3(floor(p / 65536.0), mod(floor(p / 256.0), 256.0), mod(p, 256.0)) / 255.0, vec3(2.2));
		vRoof = 1.0;`
    : ""
}
		return matrix_model * mat4(vec4(normalize(ax) * instance_line1.y, 0.0), vec4(0.0, rh, 0.0, 0.0), vec4(normalize(az) * instance_line3.y, 0.0), vec4(at + vec3(0.0, 0.5 * (h + rh), 0.0), 1.0));
	}
${toned ? "\tif (tone > 2.5) vTone = uTarTone;\n\telse if (tone > 1.5) vTone = uFrameTone;" : ""}
	return matrix_model * mat4(vec4(ax, 0.0), vec4(0.0, h, 0.0, 0.0), vec4(az, 0.0), vec4(at + vec3(0.0, up, 0.0), 1.0));
}
`;
}

const TONED_PS = `
uniform vec3 material_diffuse;
uniform float uToneSnow;
uniform float uRoofSnow;
varying vec3 vTone;
varying float vRoof;
void getAlbedo() {
	dAlbedo = mix(material_diffuse.rgb * vTone, vec3(0.852, 0.893, 0.957), vRoof > 0.5 ? uRoofSnow : uToneSnow);
}
`;

/**
 * A toned material (stage.ts tonedMaterial: each instance its own colour) that draws the shapes too: a shape's frames and tar
 * in theirs, its roof in its roof's, the snow on its roof by `uRoofSnow` (a roof's batch whitens by uToneSnow, as ever).
 * `metre`: the town's units to a metre.
 */
export function shapeMaterial(
  metre: number,
  frame: Rgb,
  tar: Rgb,
  gloss = 0.25,
): pc.StandardMaterial {
  const m = new pc.StandardMaterial();
  m.diffuse = new pc.Color(1, 1, 1);
  m.gloss = gloss;
  const chunks = m.getShaderChunks(pc.SHADERLANGUAGE_GLSL);
  chunks.set("transformInstancingVS", placeVS(true));
  chunks.set("diffusePS", TONED_PS);
  m.shaderChunksVersion = pc.CHUNKAPI_2_8;
  m.setAttribute("instance_line1", pc.SEMANTIC_ATTR11);
  m.setAttribute("instance_line2", pc.SEMANTIC_ATTR12);
  m.setAttribute("instance_line3", pc.SEMANTIC_ATTR14);
  m.setAttribute("instance_line4", pc.SEMANTIC_ATTR15);
  m.setParameter("uToneSnow", 0);
  m.setParameter("uRoofSnow", 0);
  m.setParameter("uMetre", metre);
  m.setParameter("uFrameTone", [toneOf(frame[0]), toneOf(frame[1]), toneOf(frame[2])]);
  m.setParameter("uTarTone", [toneOf(tar[0]), toneOf(tar[1]), toneOf(tar[2])]);
  m.update();
  return m;
}

/**
 * The windows' glass made to draw a home's bands as one too (its own instancing, a plain part's as ever): set on the glass
 * the town is given, once, so it stays the one material lit from dusk to dawn.
 */
export function shapeLamps(m: pc.StandardMaterial, metre: number): void {
  const chunks = m.getShaderChunks(pc.SHADERLANGUAGE_GLSL);
  if (chunks.get("transformInstancingVS")?.includes("uMetre")) return;
  chunks.set("transformInstancingVS", placeVS(false));
  m.shaderChunksVersion = pc.CHUNKAPI_2_8;
  m.setAttribute("instance_line1", pc.SEMANTIC_ATTR11);
  m.setAttribute("instance_line2", pc.SEMANTIC_ATTR12);
  m.setAttribute("instance_line3", pc.SEMANTIC_ATTR14);
  m.setAttribute("instance_line4", pc.SEMANTIC_ATTR15);
  m.setParameter("uMetre", metre);
  m.update();
}
