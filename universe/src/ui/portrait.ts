// A page's picture (Phase 10 M93b): the thing itself, drawn from the same plans the scenes
// draw it from.
//
// A small renderer of solids — boxes, gabled roofs, pyramids — flat-shaded on a 2D canvas.
// The art track's low-poly, the same in every browser, and nothing read back from the GPU.
// It draws:
// - a lineage from its built body, and its anatomy large, each part of it named;
// - a person as their figure, in their land's clothes, with their hair and their work's tool;
// - a town as a cluster of its own houses;
// - a world's face and a star's light;
// - a realm's flag (a war's two, crossed) and a faith's sign.
import type { Portrait } from "../bridge/index.ts";
import {
  EYES,
  HAIRS,
  SKIN,
  buildBody,
  clothes,
  coatOf,
  figureOf,
  hairOf,
  houseLook,
  posed,
  type BeastPart,
} from "../view/index.ts";

type Rgb = readonly [number, number, number];
type V3 = [number, number, number];
/** A creature's plan, as the view builds bodies from it. */
type CreatureBody = Parameters<typeof buildBody>[0];

/** A solid: its middle, its size, turned about its up axis after tipped about its own x. */
type Solid = {
  x: number;
  y: number;
  z: number;
  sx: number;
  sy: number;
  sz: number;
  yaw: number;
  pitch: number;
  color: Rgb;
  shape?: "box" | "gable" | "pyramid";
};

/** How a picture is looked at: turned about the up axis, and tipped to look down. */
type Look = { turn: number; tilt: number };

const css = (c: Rgb, k = 1, a = 1) =>
  `rgba(${Math.round(Math.min(1, c[0] * k) * 255)},${Math.round(Math.min(1, c[1] * k) * 255)},${Math.round(Math.min(1, c[2] * k) * 255)},${a})`;

/** A solid's corners and faces (corner indices, outward-wound), in its own frame. */
function shapeOf(s: Solid): { corners: V3[]; faces: number[][] } {
  const x = s.sx / 2,
    y = s.sy / 2,
    z = s.sz / 2;
  if (s.shape === "gable")
    // A roof: its eaves at the bottom, its ridge along its length (x) at the top.
    return {
      corners: [
        [-x, -y, -z],
        [x, -y, -z],
        [x, -y, z],
        [-x, -y, z],
        [-x, y, 0],
        [x, y, 0],
      ],
      faces: [
        [0, 1, 2, 3],
        [3, 2, 5, 4],
        [1, 0, 4, 5],
        [0, 3, 4],
        [2, 1, 5],
      ],
    };
  if (s.shape === "pyramid")
    return {
      corners: [
        [-x, -y, -z],
        [x, -y, -z],
        [x, -y, z],
        [-x, -y, z],
        [0, y, 0],
      ],
      faces: [
        [0, 1, 2, 3],
        [3, 2, 4],
        [2, 1, 4],
        [1, 0, 4],
        [0, 3, 4],
      ],
    };
  return {
    corners: [
      [-x, -y, -z],
      [x, -y, -z],
      [x, y, -z],
      [-x, y, -z],
      [-x, -y, z],
      [x, -y, z],
      [x, y, z],
      [-x, y, z],
    ],
    faces: [
      [0, 3, 2, 1],
      [4, 5, 6, 7],
      [0, 4, 7, 3],
      [1, 2, 6, 5],
      [3, 7, 6, 2],
      [0, 1, 5, 4],
    ],
  };
}

/** A corner of a solid in the world: tipped about its x, turned about its up, moved to its place. */
function place(s: Solid, c: V3): V3 {
  const cp = Math.cos(s.pitch),
    sp = Math.sin(s.pitch),
    y1 = c[1] * cp - c[2] * sp,
    z1 = c[1] * sp + c[2] * cp,
    cy = Math.cos(s.yaw),
    sy = Math.sin(s.yaw);
  return [s.x + c[0] * cy + z1 * sy, s.y + y1, s.z - c[0] * sy + z1 * cy];
}

/** A point of the world as the picture looks at it: [across, up, toward the eye]. */
function viewOf(p: V3, look: Look): V3 {
  const ct = Math.cos(look.turn),
    st = Math.sin(look.turn),
    x = p[0] * ct + p[2] * st,
    z = -p[0] * st + p[2] * ct,
    ca = Math.cos(look.tilt),
    sa = Math.sin(look.tilt);
  return [x, p[1] * ca - z * sa, p[1] * sa + z * ca];
}

/**
 * Draw solids looked at so, fitted into the box (x, y, w, h) of the canvas; answers where a
 * point of the world falls on it (for what is named of it).
 */
function drawSolids(
  ctx: CanvasRenderingContext2D,
  solids: readonly Solid[],
  look: Look,
  box: { x: number; y: number; w: number; h: number },
  fit: { minX: number; maxX: number; minY: number; maxY: number } | null = null,
): (p: V3) => [number, number] {
  const faces: { pts: V3[]; depth: number; shade: number; color: Rgb }[] = [];
  let minX = Infinity,
    maxX = -Infinity,
    minY = Infinity,
    maxY = -Infinity;
  const light = norm([-0.45, 0.75, 0.5]);
  for (const s of solids) {
    const shape = shapeOf(s),
      pts = shape.corners.map((c) => viewOf(place(s, c), look));
    for (const p of pts) {
      minX = Math.min(minX, p[0]);
      maxX = Math.max(maxX, p[0]);
      minY = Math.min(minY, p[1]);
      maxY = Math.max(maxY, p[1]);
    }
    for (const f of shape.faces) {
      const q = f.map((i) => pts[i]!),
        n = norm(cross(sub(q[1]!, q[0]!), sub(q[2]!, q[0]!)));
      if (n[2] <= 0.001) continue;
      faces.push({
        pts: q,
        depth: q.reduce((a, p) => a + p[2], 0) / q.length,
        shade: 0.52 + 0.48 * Math.max(0, dot(n, light)),
        color: s.color,
      });
    }
  }
  if (fit) ({ minX, maxX, minY, maxY } = fit);
  const k = Math.min(box.w / Math.max(1e-6, maxX - minX), box.h / Math.max(1e-6, maxY - minY)),
    ox = box.x + (box.w - (maxX - minX) * k) / 2 - minX * k,
    oy = box.y + (box.h + (maxY - minY) * k) / 2 + minY * k;
  const at = (p: V3): [number, number] => [ox + p[0] * k, oy - p[1] * k];
  faces.sort((a, b) => a.depth - b.depth);
  ctx.lineJoin = "round";
  for (const f of faces) {
    ctx.beginPath();
    f.pts.forEach((p, i) => {
      const [x, y] = at(p);
      if (i) ctx.lineTo(x, y);
      else ctx.moveTo(x, y);
    });
    ctx.closePath();
    ctx.fillStyle = css(f.color, f.shade);
    ctx.fill();
    ctx.strokeStyle = css(f.color, f.shade * 0.55, 0.9);
    ctx.lineWidth = 1;
    ctx.stroke();
  }
  return (p: V3) => at(viewOf(p, look));
}

function sub(a: V3, b: V3): V3 {
  return [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
}
function cross(a: V3, b: V3): V3 {
  return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
}
function dot(a: V3, b: V3): number {
  return a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
}
function norm(a: V3): V3 {
  const l = Math.hypot(a[0], a[1], a[2]) || 1;
  return [a[0] / l, a[1] / l, a[2] / l];
}

/** A creature's parts as solids, standing still with its head a little up. */
function creatureSolids(p: Extract<Portrait, { kind: "creature" }>): {
  solids: Solid[];
  parts: BeastPart[];
  body: ReturnType<typeof buildBody>;
} {
  const coat = coatOf(p.name, p.wool),
    body = buildBody(p.body as CreatureBody, 3, coat.pattern, p.name.length),
    parts: BeastPart[] = [],
    n = posed(body, { gait: 0, phase: 0, head: 0.25, crouch: 0 }, parts),
    tones: Rgb[] = [coat.coat, coat.dark, coat.horn];
  const solids = parts.slice(0, n).map((q) => ({
    x: q.x,
    y: q.y,
    z: q.z,
    sx: q.sx,
    sy: q.sy,
    sz: q.sz,
    yaw: q.yaw,
    pitch: q.pitch,
    color: tones[q.tone]!,
  }));
  return { solids, parts: parts.slice(0, n), body };
}

/** What each occupation holds (in the right hand): its tool, as a few solids. */
function toolOf(occupation: number, hand: V3): Solid[] {
  const wood: Rgb = [0.55, 0.36, 0.2],
    metal: Rgb = [0.7, 0.72, 0.78],
    [x, y, z] = hand;
  const stick = (len: number): Solid => ({
    x,
    y: y + len / 2 - 0.05,
    z: z + 0.02,
    sx: 0.03,
    sy: len,
    sz: 0.03,
    yaw: 0,
    pitch: 0,
    color: wood,
  });
  switch (occupation) {
    case 2: // A farmer's hoe.
      return [
        stick(0.62),
        {
          x,
          y: y + 0.55,
          z: z + 0.08,
          sx: 0.12,
          sy: 0.03,
          sz: 0.1,
          yaw: 0,
          pitch: 0,
          color: metal,
        },
      ];
    case 3: // A herder's crook.
      return [
        stick(0.8),
        {
          x,
          y: y + 0.76,
          z: z + 0.06,
          sx: 0.03,
          sy: 0.03,
          sz: 0.12,
          yaw: 0,
          pitch: 0,
          color: wood,
        },
      ];
    case 4: // A crafter's hammer.
      return [
        stick(0.28),
        {
          x,
          y: y + 0.24,
          z: z + 0.02,
          sx: 0.07,
          sy: 0.07,
          sz: 0.14,
          yaw: 0,
          pitch: 0,
          color: metal,
        },
      ];
    case 1: // A gatherer's basket.
      return [
        {
          x,
          y: y - 0.06,
          z: z + 0.05,
          sx: 0.16,
          sy: 0.12,
          sz: 0.14,
          yaw: 0,
          pitch: 0,
          color: [0.78, 0.62, 0.36],
        },
      ];
    case 5: // A trader's pack.
      return [
        {
          x,
          y: y - 0.02,
          z: z + 0.05,
          sx: 0.14,
          sy: 0.14,
          sz: 0.12,
          yaw: 0,
          pitch: 0,
          color: [0.6, 0.42, 0.26],
        },
      ];
    case 6: // A leader's staff.
      return [
        stick(0.85),
        {
          x,
          y: y + 0.82,
          z: z + 0.02,
          sx: 0.07,
          sy: 0.07,
          sz: 0.07,
          yaw: 0,
          pitch: 0,
          color: [0.95, 0.8, 0.25],
        },
      ];
    default:
      return [];
  }
}

/** A person's figure as solids: dressed as their land's era dresses their group, their hair, their tool. */
function personSolids(p: Extract<Portrait, { kind: "person" }>): Solid[] {
  const figure = figureOf(p.body, 3),
    group = p.child ? 3 : p.occupation === 6 ? 2 : p.occupation === 4 || p.occupation === 5 ? 1 : 0,
    wear = clothes(p.era, group),
    hair = HAIRS[hairOf(p.ref, p.age, p.span)]!,
    scale = p.child ? 0.7 : 1;
  const solids: Solid[] = figure.parts.map((q) => ({
    x: q.x * scale,
    y: q.y * scale,
    z: q.z * scale,
    sx: q.sx * scale,
    sy: q.sy * scale,
    sz: q.sz * scale,
    yaw: 0,
    // (An arm held a little forward, to hold what they work with.)
    pitch: q.role === "arm" && q.x > 0 && !p.child ? -0.5 : 0,
    color:
      q.tone === 2
        ? SKIN
        : q.tone === 3
          ? hair
          : q.tone === 4
            ? EYES
            : q.tone
              ? wear.legs
              : wear.body,
  }));
  const arm = figure.parts.find((q) => q.role === "arm" && q.x > 0);
  if (arm && !p.child) {
    const hand: V3 = [
      arm.x * scale,
      (arm.y - arm.sy * 0.45) * scale,
      (arm.z + arm.sy * 0.25) * scale,
    ];
    solids.push(...toolOf(p.occupation, hand));
  }
  return solids;
}

/** A town as a cluster of its own houses about its square (a city's towers at its heart). */
function townSolids(p: Extract<Portrait, { kind: "town" }>): Solid[] {
  const look = houseLook(p.house),
    solids: Solid[] = [
      {
        x: 0,
        y: -0.04,
        z: 0,
        sx: 5.4,
        sy: 0.08,
        sz: 5.4,
        yaw: 0,
        pitch: 0,
        color: [0.46, 0.68, 0.32],
      },
    ],
    n = Math.min(9, p.homes);
  let k = p.key >>> 0;
  const next = () => (k = (Math.imul(k, 1664525) + 1013904223) >>> 0) / 4294967296;
  for (let i = 0; i < n; i++) {
    const a = i * 2.399963 + next() * 0.3,
      r = 0.9 + 0.62 * Math.sqrt(i),
      x = r * Math.cos(a),
      z = r * Math.sin(a),
      yaw = -a + (next() - 0.5) * 0.4,
      len = look.length * 1.1,
      wid = look.width * 1.1,
      h = 0.42 * look.height;
    if (!look.tent)
      solids.push({
        x,
        y: look.raised + h / 2,
        z,
        sx: look.round ? wid : len,
        sy: h,
        sz: wid,
        yaw,
        pitch: 0,
        color: look.wall,
      });
    const rise = Math.max(0.04, look.rise * wid * 0.5);
    solids.push({
      x,
      y: look.raised + (look.tent ? 0 : h) + rise / 2,
      z,
      sx: (look.round ? wid : len) * 1.08,
      sy: look.tent ? rise * 2 : rise,
      sz: wid * 1.1,
      yaw,
      pitch: 0,
      color: look.roof,
      shape: look.round || look.tent ? "pyramid" : "gable",
    });
  }
  if (p.city)
    for (const [x, z, h] of [
      [0, 0, 1.9],
      [0.5, -0.4, 1.3],
    ] as const)
      solids.push({
        x,
        y: h / 2,
        z,
        sx: 0.42,
        sy: h,
        sz: 0.42,
        yaw: 0.3,
        pitch: 0,
        color: [0.82, 0.8, 0.76],
      });
  return solids;
}

/** A hash noise on the sphere, for a world's face (0 … 1). */
function noise3(x: number, y: number, z: number, key: number): number {
  const at = (i: number, j: number, l: number) => {
    let h =
      (Math.imul(i, 374761393) + Math.imul(j, 668265263) + Math.imul(l, 2147483647) + key) | 0;
    h = Math.imul(h ^ (h >>> 13), 1274126177);
    return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
  };
  const fx = Math.floor(x),
    fy = Math.floor(y),
    fz = Math.floor(z),
    u = x - fx,
    v = y - fy,
    w = z - fz,
    s = (t: number) => t * t * (3 - 2 * t),
    lerp = (a: number, b: number, t: number) => a + (b - a) * s(t);
  const c = (i: number, j: number, l: number) => at(fx + i, fy + j, fz + l);
  return lerp(
    lerp(lerp(c(0, 0, 0), c(1, 0, 0), u), lerp(c(0, 1, 0), c(1, 1, 0), u), v),
    lerp(lerp(c(0, 0, 1), c(1, 0, 1), u), lerp(c(0, 1, 1), c(1, 1, 1), u), v),
    w,
  );
}

/** A world's face on a disc, turned `spin` radians, lit from the upper left. */
function drawWorld(
  ctx: CanvasRenderingContext2D,
  p: Extract<Portrait, { kind: "world" }>,
  w: number,
  h: number,
  spin: number,
): void {
  const r = Math.min(w, h) * 0.4,
    cx = w / 2,
    cy = h / 2,
    image = ctx.createImageData(w, h),
    d = image.data,
    giant = p.look === "giant" || p.look === "ice giant";
  for (let py = 0; py < h; py++)
    for (let px = 0; px < w; px++) {
      const x = (px - cx) / r,
        y = (cy - py) / r,
        q = x * x + y * y;
      if (q > 1) continue;
      const z = Math.sqrt(1 - q),
        // Turned about the up axis.
        rx = x * Math.cos(spin) + z * Math.sin(spin),
        rz = -x * Math.sin(spin) + z * Math.cos(spin),
        lat = y,
        light = Math.max(0.12, x * -0.5 + y * 0.45 + z * 0.75);
      let c: Rgb;
      if (giant) {
        const band = Math.sin(lat * 9 + noise3(rx * 2, lat * 6, rz * 2, p.key) * 2.4);
        c =
          p.look === "giant"
            ? band > 0
              ? [0.86, 0.7, 0.5]
              : [0.7, 0.48, 0.3]
            : band > 0
              ? [0.62, 0.86, 0.92]
              : [0.4, 0.66, 0.82];
      } else {
        const n =
            noise3(rx * 2.2 + 7, lat * 2.2, rz * 2.2, p.key) * 0.65 +
            noise3(rx * 5, lat * 5, rz * 5, p.key + 1) * 0.35,
          // (Land where the noise stands above the share of the face its seas cover.)
          land = n > 0.5 + (p.sea - 0.5) * 0.42;
        c =
          Math.abs(lat) > 1 - p.ice
            ? [0.94, 0.97, 1]
            : !land && p.sea > 0
              ? [0.12, 0.34, 0.72]
              : p.green > 0 && n < 0.72
                ? [0.28 + 0.3 * (1 - p.green), 0.56, 0.24]
                : p.look === "moon"
                  ? [0.62 + n * 0.2, 0.6 + n * 0.2, 0.58 + n * 0.2]
                  : [0.62 + n * 0.25, 0.46 + n * 0.2, 0.32 + n * 0.1];
      }
      const i = (py * w + px) * 4;
      d[i] = Math.round(c[0] * light * 255);
      d[i + 1] = Math.round(c[1] * light * 255);
      d[i + 2] = Math.round(c[2] * light * 255);
      d[i + 3] = 255;
    }
  ctx.putImageData(image, 0, 0);
  if (p.air) {
    ctx.beginPath();
    ctx.arc(cx, cy, r * 1.04, 0, 2 * Math.PI);
    ctx.strokeStyle = "rgba(140, 200, 255, 0.55)";
    ctx.lineWidth = Math.max(2, r * 0.06);
    ctx.stroke();
  }
}

/** A star's colour by its warmth (a blackbody, near enough). */
function starColor(k: number): Rgb {
  const t = Math.max(1000, Math.min(40000, k)) / 100;
  const r = t <= 66 ? 255 : 329.7 * Math.pow(t - 60, -0.1332);
  const g = t <= 66 ? 99.47 * Math.log(t) - 161.1 : 288.1 * Math.pow(t - 60, -0.0755);
  const b = t >= 66 ? 255 : t <= 19 ? 0 : 138.5 * Math.log(t - 10) - 305;
  const clamp = (v: number) => Math.max(0, Math.min(255, v)) / 255;
  return [clamp(r), clamp(g), clamp(b)];
}

function drawStar(
  ctx: CanvasRenderingContext2D,
  p: Extract<Portrait, { kind: "star" }>,
  w: number,
  h: number,
  t: number,
): void {
  const c = starColor(p.remnant ? 12000 : p.temperature),
    cx = w / 2,
    cy = h / 2,
    size =
      Math.min(w, h) *
      (p.remnant ? 0.1 : Math.min(0.3, 0.14 + 0.05 * Math.log10(Math.max(0.01, p.luminosity) + 1))),
    pulse = 1 + 0.03 * Math.sin(t * 2);
  const glow = ctx.createRadialGradient(cx, cy, size * 0.3, cx, cy, size * 2.6 * pulse);
  glow.addColorStop(0, css(c, 1, 0.95));
  glow.addColorStop(0.35, css(c, 0.9, 0.45));
  glow.addColorStop(1, css(c, 0.6, 0));
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, w, h);
  const disc = ctx.createRadialGradient(cx - size * 0.3, cy - size * 0.3, size * 0.1, cx, cy, size);
  disc.addColorStop(0, "rgba(255,255,255,1)");
  disc.addColorStop(1, css(c, 1, 1));
  ctx.beginPath();
  ctx.arc(cx, cy, size, 0, 2 * Math.PI);
  ctx.fillStyle = disc;
  ctx.fill();
}

/** A flag: its field divided as its key says, its colour and a light and a dark beside it, a charge at its heart. */
function drawFlag(
  ctx: CanvasRenderingContext2D,
  f: { color: Rgb; key: number },
  x: number,
  y: number,
  w: number,
  h: number,
  t: number,
): void {
  const k = f.key >>> 0,
    main = f.color,
    light: Rgb = [0.5 + main[0] * 0.5, 0.5 + main[1] * 0.5, 0.5 + main[2] * 0.5],
    dark: Rgb = [main[0] * 0.3 + 0.03, main[1] * 0.3 + 0.05, main[2] * 0.3 + 0.12],
    other = (k >>> 4) % 2 ? light : dark,
    pattern = k % 8,
    charge = (k >>> 8) % 5;
  const off = document.createElement("canvas");
  off.width = Math.max(1, Math.round(w));
  off.height = Math.max(1, Math.round(h));
  const g = off.getContext("2d")!,
    W = off.width,
    H = off.height;
  g.fillStyle = css(main);
  g.fillRect(0, 0, W, H);
  g.fillStyle = css(other);
  switch (pattern) {
    case 0:
      g.fillRect(W / 2, 0, W / 2, H);
      break;
    case 1:
      g.fillRect(0, H / 2, W, H / 2);
      break;
    case 2:
      g.fillRect(0, 0, W / 2, H / 2);
      g.fillRect(W / 2, H / 2, W / 2, H / 2);
      break;
    case 3:
      g.fillRect(W * 0.4, 0, W * 0.2, H);
      g.fillRect(0, H * 0.4, W, H * 0.2);
      break;
    case 4:
      g.lineWidth = H * 0.18;
      g.strokeStyle = css(other);
      g.beginPath();
      g.moveTo(0, 0);
      g.lineTo(W, H);
      g.moveTo(W, 0);
      g.lineTo(0, H);
      g.stroke();
      break;
    case 5:
      g.fillRect(0, H / 3, W, H / 3);
      break;
    case 6:
      g.fillRect(W / 3, 0, W / 3, H);
      break;
    default:
      g.beginPath();
      g.moveTo(0, 0);
      g.lineTo(W * 0.45, H / 2);
      g.lineTo(0, H);
      g.closePath();
      g.fill();
  }
  // Its charge, in the colour that stands out from the field.
  const ccx = W / 2,
    ccy = H / 2,
    cr = H * 0.2;
  g.fillStyle = css(other === light ? dark : light);
  g.beginPath();
  if (charge === 0) g.arc(ccx, ccy, cr, 0, 2 * Math.PI);
  else if (charge === 1)
    for (let i = 0; i < 10; i++) {
      const a = -Math.PI / 2 + (i * Math.PI) / 5,
        rr = i % 2 ? cr * 0.45 : cr;
      if (i) g.lineTo(ccx + rr * Math.cos(a), ccy + rr * Math.sin(a));
      else g.moveTo(ccx + rr * Math.cos(a), ccy + rr * Math.sin(a));
    }
  else if (charge === 2) {
    g.moveTo(ccx, ccy - cr);
    g.lineTo(ccx + cr * 0.7, ccy);
    g.lineTo(ccx, ccy + cr);
    g.lineTo(ccx - cr * 0.7, ccy);
  } else if (charge === 3) {
    g.arc(ccx, ccy, cr, 0.6, 2 * Math.PI - 0.6);
    g.arc(ccx + cr * 0.35, ccy, cr * 0.75, 2 * Math.PI - 0.8, 0.8, true);
  }
  g.closePath();
  if (charge < 4) g.fill();
  // Its gloss, the era's.
  const gloss = g.createLinearGradient(0, 0, 0, H);
  gloss.addColorStop(0, "rgba(255,255,255,0.35)");
  gloss.addColorStop(0.48, "rgba(255,255,255,0.08)");
  gloss.addColorStop(0.52, "rgba(0,0,0,0.06)");
  gloss.addColorStop(1, "rgba(0,0,0,0.18)");
  g.fillStyle = gloss;
  g.fillRect(0, 0, W, H);
  // Waving: each column of it lifted on a slow wave.
  for (let c = 0; c < W; c += 2) {
    const lift = Math.sin((c / W) * 5 + t * 2.2) * h * 0.05 * (c / W);
    ctx.drawImage(off, c, 0, 2, H, x + c, y + lift, 2, H);
  }
  ctx.strokeStyle = "rgba(10, 16, 40, 0.8)";
  ctx.lineWidth = 1;
  ctx.strokeRect(x - 0.5, y - 0.5, W + 1, H + 1);
  // Its pole.
  ctx.fillStyle = "#c9d3ea";
  ctx.fillRect(x - 3, y - 2, 2, h * 1.9);
}

const SIGNS: Readonly<Record<string, string>> = {
  rain: "🌧️",
  plenty: "🌾",
  sickness: "☠️",
  healing: "✚",
  teaching: "📜",
  presence: "👣",
  hunger: "🍂",
  fire: "🔥",
};

function drawSign(
  ctx: CanvasRenderingContext2D,
  p: Extract<Portrait, { kind: "sign" }>,
  w: number,
  h: number,
): void {
  const r = Math.min(w, h) * 0.38,
    cx = w / 2,
    cy = h / 2,
    g = ctx.createRadialGradient(cx - r * 0.3, cy - r * 0.35, r * 0.1, cx, cy, r);
  g.addColorStop(0, css(p.color, 1.5));
  g.addColorStop(1, css(p.color, 0.8));
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, 2 * Math.PI);
  ctx.fillStyle = g;
  ctx.fill();
  ctx.lineWidth = 2;
  ctx.strokeStyle = "rgba(230, 238, 255, 0.85)";
  ctx.stroke();
  ctx.font = `${Math.round(r)}px system-ui, "Segoe UI Emoji", "Apple Color Emoji", sans-serif`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(SIGNS[p.tenet] ?? "✦", cx, cy + r * 0.05);
}

/** A canvas sized for the screen's pixels, and its context scaled to CSS pixels. */
function surface(canvas: HTMLCanvasElement, w: number, h: number): CanvasRenderingContext2D {
  const dpr = Math.min(2, globalThis.devicePixelRatio || 1);
  if (canvas.width !== Math.round(w * dpr) || canvas.height !== Math.round(h * dpr)) {
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
  }
  canvas.style.width = `${w}px`;
  canvas.style.height = `${h}px`;
  const ctx = canvas.getContext("2d")!;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, w, h);
  return ctx;
}

/** Whether a portrait moves (turns, waves, glows) and is drawn again as time passes. */
export function moves(p: Portrait): boolean {
  return p.kind !== "sign";
}

/** Draw a page's picture into `canvas` (w × h CSS pixels) as it stands at `t` seconds. */
export function drawPortrait(
  canvas: HTMLCanvasElement,
  p: Portrait,
  w: number,
  h: number,
  t: number,
): void {
  const box = { x: 4, y: 4, w: w - 8, h: h - 8 };
  switch (p.kind) {
    case "creature": {
      const ctx = surface(canvas, w, h);
      drawSolids(ctx, creatureSolids(p).solids, { turn: 0.9 + t * 0.35, tilt: 0.32 }, box);
      return;
    }
    case "person": {
      const ctx = surface(canvas, w, h);
      drawSolids(ctx, personSolids(p), { turn: 0.5 + Math.sin(t * 0.6) * 0.6, tilt: 0.12 }, box);
      return;
    }
    case "town": {
      const ctx = surface(canvas, w, h);
      drawSolids(ctx, townSolids(p), { turn: 0.7 + t * 0.15, tilt: 0.55 }, box);
      return;
    }
    case "world": {
      const dpr = Math.min(2, globalThis.devicePixelRatio || 1),
        W = Math.round(w * dpr),
        H = Math.round(h * dpr);
      canvas.width = W;
      canvas.height = H;
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;
      drawWorld(canvas.getContext("2d")!, p, W, H, t * 0.25);
      return;
    }
    case "star":
      drawStar(surface(canvas, w, h), p, w, h, t);
      return;
    case "flag": {
      const ctx = surface(canvas, w, h),
        n = p.flags.length,
        fw = w * (n > 1 ? 0.42 : 0.7),
        fh = fw * 0.62;
      p.flags.forEach((f, i) =>
        drawFlag(
          ctx,
          f,
          n > 1 ? 6 + i * (w * 0.5) : (w - fw) / 2 + 2,
          h * (n > 1 ? 0.24 + i * 0.12 : 0.22),
          fw,
          fh,
          t + i,
        ),
      );
      if (n > 1) {
        ctx.font = `${Math.round(h * 0.24)}px system-ui, "Segoe UI Emoji", sans-serif`;
        ctx.textAlign = "center";
        ctx.fillText("⚔️", w / 2, h * 0.86);
      }
      return;
    }
    case "sign":
      drawSign(surface(canvas, w, h), p, w, h);
      return;
  }
}

const COVERING: Readonly<Record<string, string>> = {
  fur: "fur",
  wool: "wool",
  feathers: "feathers",
  scales: "scales",
  shell: "a shell",
  plates: "plates",
  slick: "bare, slick skin",
};
const EATS: Readonly<Record<string, string>> = {
  grass: "eats grass 🌾",
  leaves: "eats leaves 🌿",
  seeds: "eats seeds 🌰",
  meat: "eats meat 🥩",
  carrion: "eats carrion 🦴",
  fish: "eats fish 🐟",
  anything: "eats anything",
};
const MOVES: Readonly<Record<string, string>> = {
  walk: "walks",
  run: "runs",
  hop: "hops",
  crawl: "crawls",
  slither: "slithers",
  swim: "swims",
  fly: "flies",
};

/**
 * A lineage's anatomy: its body side on, large, each part of it named — its legs, wings and
 * fins where they are, what covers it, its head's growths, its tail — with its weight and a
 * metre to measure it by, what it eats and how it moves.
 */
export function drawAnatomy(canvas: HTMLCanvasElement, p: Portrait, w: number, h: number): void {
  if (p.kind !== "creature") return;
  const ctx = surface(canvas, w, h),
    { solids, parts, body } = creatureSolids(p),
    plan = p.body,
    look: Look = { turn: Math.PI / 2 - 0.35, tilt: 0.18 },
    art = { x: w * 0.22, y: 34, w: w * 0.56, h: h - 70 },
    at = drawSolids(ctx, solids, look, art);
  // Where each named part lies: the head at the front, the tail behind, the feet lowest,
  // the wings and fins widest, the coat at the middle.
  const middle = (q: BeastPart): V3 => [q.x, q.y, q.z],
    front = parts.reduce((a, b) => (b.z > a.z ? b : a)),
    // (The tail: the hindmost part standing clear of the legs; the legs' mark at a hind foot.)
    above = parts.filter((q) => q.y > body.leg * body.k * 0.9),
    back = (above.length ? above : parts).reduce((a, b) => (b.z < a.z ? b : a)),
    lowest = Math.min(...parts.map((q) => q.y - q.sy / 2)),
    feet = parts.filter((q) => q.y - q.sy / 2 <= lowest + body.k * 0.05),
    low = feet.reduce((a, b) => (b.z < a.z ? b : a)),
    wide = parts.reduce((a, b) => (Math.abs(b.x) + b.sx > Math.abs(a.x) + a.sx ? b : a)),
    core = parts.reduce((a, b) => (b.sx * b.sy * b.sz > a.sx * a.sy * a.sz ? b : a));
  const labels: { text: string; at: V3; side: "left" | "right"; row: number }[] = [];
  const grows = plan.features.filter((f) => !["claws", "spines"].includes(f));
  labels.push({
    text: grows.length ? `head: ${grows.join(", ")}` : "its head",
    at: middle(front),
    side: "right",
    row: 0,
  });
  labels.push({
    text: `covered in ${COVERING[plan.covering] ?? plan.covering}`,
    at: middle(core),
    side: "right",
    row: 1,
  });
  if (plan.legs > 0)
    labels.push({
      text: `${plan.legs} legs${plan.features.includes("claws") ? ", clawed" : ""}`,
      at: [low.x, low.y - low.sy / 2, low.z],
      side: "left",
      row: 2,
    });
  if (plan.wings > 0)
    labels.push({ text: `${plan.wings} wings`, at: middle(wide), side: "left", row: 0 });
  if (plan.fins > 0)
    labels.push({
      text: `${plan.fins} fins`,
      at: middle(wide),
      side: "left",
      row: plan.wings > 0 ? 1 : 0,
    });
  if (plan.tail > 0.05 || plan.moves === "slither")
    labels.push({ text: "a tail", at: middle(back), side: "left", row: 1 });
  if (plan.features.includes("spines"))
    labels.push({ text: "spines", at: middle(core), side: "right", row: 2 });
  ctx.font = "11px Verdana, Tahoma, sans-serif";
  ctx.textBaseline = "middle";
  for (const l of labels) {
    const [x, y] = at(l.at),
      ly = 42 + l.row * 26,
      lx = l.side === "left" ? 6 : w - 6,
      tw = ctx.measureText(l.text).width + 10;
    ctx.strokeStyle = "rgba(111, 231, 255, 0.8)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(l.side === "left" ? lx + tw : lx - tw, ly);
    ctx.lineTo(x, y);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(x, y, 2.5, 0, 2 * Math.PI);
    ctx.fillStyle = "#6fe7ff";
    ctx.fill();
    ctx.fillStyle = "rgba(8, 16, 44, 0.85)";
    ctx.fillRect(l.side === "left" ? lx : lx - tw, ly - 9, tw, 18);
    ctx.strokeRect(l.side === "left" ? lx : lx - tw, ly - 9, tw, 18);
    ctx.fillStyle = "#f2f6ff";
    ctx.textAlign = l.side === "left" ? "left" : "right";
    ctx.fillText(l.text, l.side === "left" ? lx + 5 : lx - 5, ly);
  }
  // Its size, what it eats, how it moves: along the foot.
  const kg =
    plan.size < 1
      ? `${Math.round(plan.size * 1000)} g`
      : `${Math.round(plan.size).toLocaleString("en-US")} kg`;
  ctx.textAlign = "left";
  ctx.fillStyle = "#a9bbe2";
  ctx.fillText(
    `${kg} · ${body.length.toFixed(1)} m long · ${MOVES[plan.moves] ?? plan.moves} · ${EATS[plan.eats] ?? `eats ${plan.eats}`}`,
    6,
    h - 12,
  );
  // A metre, to measure it by.
  const [ax] = at([0, 0, 0]),
    [bx] = at([0, 0, body.k]);
  const metre = Math.abs(bx - ax);
  if (metre > 6 && metre < w * 0.6) {
    const y = h - 30;
    ctx.strokeStyle = "#c6ff4a";
    ctx.beginPath();
    ctx.moveTo(w - 10 - metre, y);
    ctx.lineTo(w - 10, y);
    ctx.moveTo(w - 10 - metre, y - 4);
    ctx.lineTo(w - 10 - metre, y + 4);
    ctx.moveTo(w - 10, y - 4);
    ctx.lineTo(w - 10, y + 4);
    ctx.stroke();
    ctx.fillStyle = "#c6ff4a";
    ctx.textAlign = "right";
    ctx.fillText("1 m", w - 10, y - 10);
  }
}
