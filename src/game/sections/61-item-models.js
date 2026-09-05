// ═══════════════════════════════════════════════════════════════════════════
// 61. ITEM MODELS — procedural forms for tools, weapons, armour, and compounds
// ═══════════════════════════════════════════════════════════════════════════
// Equipment already had fifty-odd procedural forms as text (a flaked crescent
// edge, overlapping gravity scales) and compounds a hue and a role, but nothing
// drew them. Here a recipe decides a model: the purpose and form give the
// silhouette, the head material its colour and sheen, the binding its wraps,
// quality its ornament, wear its chips. Compounds get glyphs from their bond
// topology, phase, and potentials. One list of primitives feeds both the canvas
// (worn and carried in the world, on portraits) and inline SVG (inventory rows,
// artifact pages, chemistry lists). Render only; nothing here writes the world.
const ITEM_SILHOUETTES = Object.freeze([
  "blade",
  "spear",
  "maul",
  "axe",
  "pick",
  "hammer",
  "scoop",
  "sling",
  "bow",
  "tube",
  "staff",
  "bucket",
  "boat",
  "mantle",
  "helm",
  "shield",
]);
function itemSilhouette(tool) {
  const caps = tool?.capabilities || [],
    form = String(tool?.form || "").toLowerCase(),
    has = (c) => caps.includes(c);
  if (has("helmet")) return "helm";
  if (has("armor") || has("limb_armor")) return "mantle";
  if (has("shield")) return "shield";
  if (has("watercraft") || /raft|boat|hull|canoe|dugout/.test(form)) return "boat";
  if (has("carry_liquid") || /bucket|vessel|jar|skin/.test(form)) return "bucket";
  if (has("bow") || has("crossbow") || /bow/.test(form)) return "bow";
  if (has("powder") || has("firearm") || has("gun") || /burst|tube|barrel/.test(form))
    return "tube";
  if (has("ranged") || has("sling") || /sling|caster|thrower/.test(form)) return "sling";
  if (has("war")) {
    if (/spear|reach|pierce|needle|point/.test(form)) return "spear";
    if (/maul|hammer|knot|crush|mass/.test(form)) return "maul";
    return "blade";
  }
  if (has("mine") || /pick/.test(form)) return "pick";
  if (has("cut") || /cutter|axe|edge/.test(form)) return "axe";
  if (has("gather") || /scoop|collect/.test(form)) return "scoop";
  if (has("build") || /maul|hammer/.test(form)) return "hammer";
  return "staff";
}
function secondSpecies(composition, primary) {
  let best = -1,
    n = 0;
  if (!composition) return -1;
  for (let sp = 0; sp < composition.length; sp++)
    if (sp !== primary && composition[sp] > n) {
      n = composition[sp];
      best = sp;
    }
  return best;
}
function itemModel(a) {
  if (!a) return null;
  const head = a.materialId ?? C.MINERAL,
    trait = materialTrait(head),
    bind = secondSpecies(a.composition, head),
    headDef = W.definitions.species[head],
    bindDef = bind >= 0 ? W.definitions.species[bind] : null,
    seed = hashParts(W.seedHash, "item-model", a.entityId || a.id || 0),
    quality = a.quality || 40,
    wear = a.tool ? clamp(a.tool.wear / Math.max(1, a.tool.durability), 0, 1) : 0;
  return {
    silhouette: a.tool ? itemSilhouette(a.tool) : "staff",
    headHue: headDef?.colorHue ?? 40,
    headSat: clamp(38 + trait.hardness * 30, 30, 72),
    headLight: clamp(30 + trait.hardness * 34 - trait.brittleness * 6, 24, 66),
    bindHue: bindDef?.colorHue ?? 34,
    bindLight: clamp(28 + (1 - (bind >= 0 ? materialTrait(bind).density : 0.5)) * 20, 24, 50),
    quality,
    ornament: quality >= 70 ? 2 : quality >= 50 ? 1 : 0,
    wear,
    broken: !!a.tool && a.tool.wear >= a.tool.durability,
    curve: 0.7 + (seed % 100) / 200,
    wraps: 2 + ((seed >> 7) % 3),
    seed,
    name: a.name || "",
  };
}
// Shapes live in a unit space: the item stands upright, roughly 1.2 tall.
function itemShapes(m) {
  const head = hsl(m.headHue, m.headSat, m.headLight),
    headDark = hsl(m.headHue, m.headSat, Math.max(10, m.headLight - 22)),
    shine = hsl(m.headHue, Math.max(20, m.headSat - 20), Math.min(92, m.headLight + 28), 0.7),
    wood = hsl(m.bindHue, 38, m.bindLight),
    woodDark = hsl(m.bindHue, 40, Math.max(10, m.bindLight - 16)),
    cord = hsl(m.bindHue + 20, 45, Math.min(70, m.bindLight + 22)),
    gold = hsl(46, 85, 65),
    out = [],
    haft = (y0, y1, w = 0.07) =>
      out.push(
        {
          t: "line",
          d: [
            [0, y0],
            [0, y1],
          ],
          stroke: wood,
          w,
        },
        {
          t: "line",
          d: [
            [-w * 0.35, y0],
            [-w * 0.35, y1],
          ],
          stroke: woodDark,
          w: w * 0.25,
        },
      ),
    wraps = (y, n, w = 0.16) => {
      for (let k = 0; k < n; k++)
        out.push({
          t: "line",
          d: [
            [-w / 2, y + k * 0.05],
            [w / 2, y + k * 0.05 + 0.02],
          ],
          stroke: cord,
          w: 0.03,
        });
    },
    gem = (x, y) =>
      out.push({ t: "ellipse", x, y, rx: 0.035, ry: 0.035, fill: gold, stroke: headDark, w: 0.01 }),
    poly = (d, fill, stroke = headDark, w = 0.03) =>
      out.push({ t: "path", d, fill, stroke, w, close: true }),
    c = m.curve;
  switch (m.silhouette) {
    case "blade":
      haft(0.55, -0.05);
      wraps(0.25, m.wraps);
      poly(
        [
          [-0.06, -0.05],
          [0.06, -0.05],
          [0.09 * c, -0.35],
          [0.02, -0.62],
          [-0.05, -0.4],
        ],
        head,
      );
      out.push({
        t: "line",
        d: [
          [-0.01, -0.12],
          [0.03, -0.5],
        ],
        stroke: shine,
        w: 0.02,
      });
      if (m.ornament) gem(0, 0.02);
      break;
    case "spear":
      haft(0.6, -0.32, 0.05);
      wraps(-0.28, 2, 0.12);
      poly(
        [
          [-0.08, -0.32],
          [0.08, -0.32],
          [0, -0.68],
        ],
        head,
      );
      out.push({
        t: "line",
        d: [
          [0, -0.36],
          [0, -0.6],
        ],
        stroke: shine,
        w: 0.015,
      });
      break;
    case "maul":
      haft(0.55, -0.15);
      wraps(0.2, m.wraps);
      poly(
        [
          [-0.2, -0.16],
          [0.2, -0.16],
          [0.18, -0.42],
          [-0.18, -0.42],
        ],
        head,
      );
      out.push({
        t: "line",
        d: [
          [-0.14, -0.22],
          [0.12, -0.22],
        ],
        stroke: shine,
        w: 0.02,
      });
      if (m.ornament > 1) gem(0, -0.29);
      break;
    case "axe":
      haft(0.55, -0.3, 0.06);
      wraps(0.18, m.wraps);
      poly(
        [
          [0, -0.12],
          [0.02, -0.4],
          [0.3 * c, -0.46],
          [0.34 * c, -0.18],
          [0.16, -0.08],
        ],
        head,
      );
      out.push({
        t: "line",
        d: [
          [0.3 * c, -0.42],
          [0.32 * c, -0.22],
        ],
        stroke: shine,
        w: 0.02,
      });
      break;
    case "pick":
      haft(0.55, -0.25, 0.06);
      wraps(0.2, m.wraps);
      poly(
        [
          [-0.05, -0.22],
          [0.05, -0.3],
          [0.3, -0.48],
          [0.34, -0.4],
          [0.12, -0.22],
        ],
        head,
      );
      poly(
        [
          [-0.05, -0.22],
          [-0.24, -0.34],
          [-0.2, -0.42],
          [0.02, -0.3],
        ],
        head,
      );
      break;
    case "hammer":
      haft(0.55, -0.2, 0.06);
      wraps(0.2, m.wraps);
      poly(
        [
          [-0.16, -0.2],
          [0.16, -0.2],
          [0.16, -0.36],
          [-0.16, -0.36],
        ],
        head,
      );
      break;
    case "scoop":
      haft(0.55, -0.15, 0.05);
      out.push({
        t: "ellipse",
        x: 0,
        y: -0.28,
        rx: 0.2,
        ry: 0.13,
        fill: head,
        stroke: headDark,
        w: 0.03,
      });
      out.push({
        t: "ellipse",
        x: 0,
        y: -0.3,
        rx: 0.13,
        ry: 0.06,
        fill: headDark,
        stroke: headDark,
        w: 0.01,
      });
      break;
    case "sling":
      haft(0.5, -0.4, 0.05);
      out.push({
        t: "path",
        d: [
          [0, -0.4],
          [0.18, -0.55],
          [0.1, -0.7],
        ],
        fill: null,
        stroke: cord,
        w: 0.025,
        close: false,
      });
      out.push({
        t: "ellipse",
        x: 0.13,
        y: -0.62,
        rx: 0.07,
        ry: 0.05,
        fill: head,
        stroke: headDark,
        w: 0.02,
      });
      wraps(0.1, 2, 0.12);
      break;
    case "bow":
      out.push({
        t: "path",
        d: [
          [0.05, 0.55],
          [0.3 * c, 0],
          [0.05, -0.55],
        ],
        fill: null,
        stroke: wood,
        w: 0.06,
        close: false,
      });
      out.push({
        t: "line",
        d: [
          [0.05, 0.55],
          [0.05, -0.55],
        ],
        stroke: cord,
        w: 0.015,
      });
      wraps(-0.03, 2, 0.1);
      break;
    case "tube":
      poly(
        [
          [-0.09, 0.4],
          [0.09, 0.4],
          [0.09, -0.45],
          [-0.09, -0.45],
        ],
        head,
      );
      poly(
        [
          [-0.13, -0.45],
          [0.13, -0.45],
          [0.09, -0.58],
          [-0.09, -0.58],
        ],
        headDark,
      );
      haft(0.55, 0.3, 0.09);
      wraps(0.05, m.wraps, 0.2);
      break;
    case "bucket":
      poly(
        [
          [-0.24, -0.1],
          [0.24, -0.1],
          [0.18, 0.42],
          [-0.18, 0.42],
        ],
        head,
        headDark,
        0.03,
      );
      out.push({
        t: "path",
        d: [
          [-0.2, -0.1],
          [0, -0.42],
          [0.2, -0.1],
        ],
        fill: null,
        stroke: woodDark,
        w: 0.035,
        close: false,
      });
      out.push({
        t: "line",
        d: [
          [-0.15, 0.1],
          [0.15, 0.1],
        ],
        stroke: shine,
        w: 0.02,
      });
      break;
    case "boat":
      poly(
        [
          [-0.5, 0.05],
          [0.5, 0.05],
          [0.36, 0.3],
          [-0.36, 0.3],
        ],
        wood,
        woodDark,
        0.03,
      );
      out.push({
        t: "line",
        d: [
          [0.05, 0.05],
          [0.05, -0.6],
        ],
        stroke: woodDark,
        w: 0.04,
      });
      poly(
        [
          [0.05, -0.6],
          [-0.36 * c, -0.15],
          [0.05, -0.12],
        ],
        head,
        headDark,
        0.02,
      );
      break;
    case "mantle":
      poly(
        [
          [-0.34, -0.42],
          [0.34, -0.42],
          [0.42, 0.1],
          [0.3, 0.5],
          [-0.3, 0.5],
          [-0.42, 0.1],
        ],
        head,
        headDark,
        0.04,
      );
      for (let row = 0; row < 4; row++)
        for (let k = -1; k <= 1; k++)
          out.push({
            t: "path",
            d: [
              [k * 0.22 - 0.1, -0.3 + row * 0.2],
              [k * 0.22, -0.16 + row * 0.2],
              [k * 0.22 + 0.1, -0.3 + row * 0.2],
            ],
            fill: null,
            stroke: headDark,
            w: 0.025,
            close: false,
          });
      if (m.ornament) gem(0, -0.3);
      break;
    case "helm":
      out.push({
        t: "path",
        d: [
          [-0.36, 0.1],
          [-0.34, -0.25],
          [-0.18, -0.48],
          [0.18, -0.48],
          [0.34, -0.25],
          [0.36, 0.1],
        ],
        fill: head,
        stroke: headDark,
        w: 0.04,
        close: true,
      });
      out.push({
        t: "line",
        d: [
          [-0.4, 0.1],
          [0.4, 0.1],
        ],
        stroke: headDark,
        w: 0.05,
      });
      if (m.ornament)
        out.push({
          t: "path",
          d: [
            [0, -0.48],
            [0.05, -0.7],
            [-0.05, -0.7],
          ],
          fill: gold,
          stroke: headDark,
          w: 0.01,
          close: true,
        });
      break;
    case "shield":
      poly(
        [
          [-0.36, -0.36],
          [0.36, -0.36],
          [0.4, 0.1],
          [0, 0.55],
          [-0.4, 0.1],
        ],
        head,
        headDark,
        0.045,
      );
      out.push({
        t: "ellipse",
        x: 0,
        y: 0.02,
        rx: 0.09,
        ry: 0.09,
        fill: headDark,
        stroke: shine,
        w: 0.02,
      });
      break;
    default:
      haft(0.6, -0.5, 0.06);
      out.push({
        t: "path",
        d: [
          [0, -0.5],
          [0.14 * c, -0.62],
          [0.06, -0.72],
        ],
        fill: null,
        stroke: wood,
        w: 0.05,
        close: false,
      });
      wraps(0.15, m.wraps);
  }
  if (m.wear > 0.5 && !m.broken)
    for (let k = 0; k < 3; k++) {
      const y = -0.5 + ((m.seed >> (k * 3)) % 60) / 100;
      out.push({
        t: "ellipse",
        x: 0.04,
        y,
        rx: 0.025,
        ry: 0.02,
        fill: "rgba(0,0,0,0.5)",
        stroke: null,
        w: 0,
      });
    }
  if (m.broken)
    out.push({
      t: "line",
      d: [
        [-0.12, -0.35],
        [0.14, -0.05],
      ],
      stroke: "rgba(0,0,0,0.75)",
      w: 0.035,
    });
  return out;
}
// ── Compound glyphs ────────────────────────────────────────────────────────────
function chemModel(sp) {
  const d = W?.definitions?.species?.[sp];
  if (!d) return null;
  const h = hashParts(W.seedHash, "chem-glyph", sp);
  return {
    sp,
    hue: d.colorHue ?? 40,
    topology: d.bondTopology || "chain",
    phase: d.phase || "solid",
    toxic: (d.toxicity || 0) > 0.5,
    catalytic: (d.catalyticPotential || 0) >= 0.4,
    info: (d.informationPotential || 0) >= 0.4,
    energetic: (d.energyCarrierPotential || 0) >= 0.4,
    polar: Math.abs(d.polarity || 0) > 0.5,
    nodes: 3 + (h % 3),
    spin: ((h >> 4) % 360) * (Math.PI / 180),
    role: d.role || "",
    name: d.name || "",
  };
}
function chemShapes(m) {
  const node = hsl(m.hue, 70, 62),
    bond = hsl(m.hue, 40, 78, 0.9),
    dark = hsl(m.hue, 40, 22),
    out = [],
    dot = (x, y, r = 0.09, fill = node) =>
      out.push({ t: "ellipse", x, y, rx: r, ry: r, fill, stroke: dark, w: 0.02 }),
    link = (a, b) => out.push({ t: "line", d: [a, b], stroke: bond, w: 0.035 }),
    rot = (x, y) => [
      x * Math.cos(m.spin) - y * Math.sin(m.spin),
      x * Math.sin(m.spin) + y * Math.cos(m.spin),
    ];
  if (m.phase === "liquid")
    out.push({
      t: "path",
      d: [
        [0, -0.62],
        [0.38, -0.05],
        [0.28, 0.42],
        [-0.28, 0.42],
        [-0.38, -0.05],
      ],
      fill: hsl(m.hue, 55, 40, 0.35),
      stroke: hsl(m.hue, 60, 70, 0.7),
      w: 0.03,
      close: true,
    });
  if (m.phase === "gas")
    for (let k = 0; k < 3; k++)
      out.push({
        t: "ellipse",
        x: -0.3 + k * 0.3,
        y: -0.35 + (k % 2) * 0.15,
        rx: 0.16,
        ry: 0.11,
        fill: hsl(m.hue, 40, 60, 0.18),
        stroke: null,
        w: 0,
      });
  const pts = [];
  if (m.topology === "ring") {
    for (let k = 0; k < m.nodes + 2; k++) {
      const a = (k / (m.nodes + 2)) * Math.PI * 2;
      pts.push(rot(Math.cos(a) * 0.3, Math.sin(a) * 0.3));
    }
    for (let k = 0; k < pts.length; k++) link(pts[k], pts[(k + 1) % pts.length]);
  } else if (m.topology === "branched") {
    const centre = [0, 0];
    for (let k = 0; k < 3; k++) {
      const a = (k / 3) * Math.PI * 2 - Math.PI / 2;
      pts.push(rot(Math.cos(a) * 0.32, Math.sin(a) * 0.32));
      link(centre, pts[k]);
    }
    pts.push(centre);
  } else if (m.topology === "lattice") {
    for (let i = -1; i <= 1; i++) for (let j = -1; j <= 1; j++) pts.push(rot(i * 0.24, j * 0.24));
    for (let i = 0; i < 9; i++) {
      if (i % 3 < 2) link(pts[i], pts[i + 1]);
      if (i < 6) link(pts[i], pts[i + 3]);
    }
  } else {
    for (let k = 0; k < m.nodes; k++)
      pts.push(rot(-0.3 + (0.6 * k) / Math.max(1, m.nodes - 1), k % 2 ? -0.12 : 0.12));
    for (let k = 0; k + 1 < pts.length; k++) link(pts[k], pts[k + 1]);
  }
  pts.forEach(([x, y], k) =>
    dot(
      x,
      y,
      m.topology === "lattice" ? 0.06 : 0.09,
      m.polar && k === 0 ? hsl(m.hue + 40, 80, 70) : node,
    ),
  );
  if (m.toxic)
    for (let k = 0; k < 6; k++) {
      const a = (k / 6) * Math.PI * 2 + 0.3;
      out.push({
        t: "path",
        d: [
          [Math.cos(a) * 0.42, Math.sin(a) * 0.42],
          [Math.cos(a + 0.12) * 0.56, Math.sin(a + 0.12) * 0.56],
          [Math.cos(a + 0.24) * 0.42, Math.sin(a + 0.24) * 0.42],
        ],
        fill: hsl(m.hue, 60, 45),
        stroke: null,
        w: 0,
        close: true,
      });
    }
  if (m.catalytic)
    for (let k = 0; k < 8; k++) {
      const a = (k / 8) * Math.PI * 2;
      link([Math.cos(a) * 0.46, Math.sin(a) * 0.46], [Math.cos(a) * 0.54, Math.sin(a) * 0.54]);
    }
  if (m.info)
    for (let k = 0; k < 5; k++) dot(-0.36 + k * 0.18, 0.5 + (k % 2 ? 0.06 : -0.06), 0.035, bond);
  if (m.energetic)
    out.push({
      t: "path",
      d: [
        [0.34, -0.62],
        [0.42, -0.42],
        [0.58, -0.44],
        [0.46, -0.3],
        [0.5, -0.12],
        [0.36, -0.26],
        [0.22, -0.16],
        [0.3, -0.36],
        [0.18, -0.48],
        [0.34, -0.46],
      ],
      fill: hsl(46, 95, 70),
      stroke: null,
      w: 0,
      close: true,
    });
  return out;
}
// ── Renderers ──────────────────────────────────────────────────────────────────
function drawShapes(g, shapes, x, y, size, angle = 0) {
  g.save();
  g.translate(x, y);
  if (angle) g.rotate(angle);
  g.scale(size, size);
  for (const s of shapes) {
    if (s.t === "ellipse") {
      g.beginPath();
      g.ellipse(s.x, s.y, s.rx, s.ry, 0, 0, Math.PI * 2);
      if (s.fill) {
        g.fillStyle = s.fill;
        g.fill();
      }
      if (s.stroke && s.w) {
        g.strokeStyle = s.stroke;
        g.lineWidth = s.w;
        g.stroke();
      }
      continue;
    }
    g.beginPath();
    g.moveTo(s.d[0][0], s.d[0][1]);
    for (let k = 1; k < s.d.length; k++) g.lineTo(s.d[k][0], s.d[k][1]);
    if (s.close) g.closePath();
    if (s.fill && s.t === "path") {
      g.fillStyle = s.fill;
      g.fill();
    }
    if (s.stroke && s.w) {
      g.strokeStyle = s.stroke;
      g.lineWidth = s.w;
      g.lineCap = "round";
      g.lineJoin = "round";
      g.stroke();
    }
  }
  g.restore();
}
function shapesSvg(shapes, px, box = "-0.65 -0.8 1.3 1.5", cls = "item-glyph") {
  const body = shapes
    .map((s) => {
      if (s.t === "ellipse")
        return `<ellipse cx="${s.x.toFixed(3)}" cy="${s.y.toFixed(3)}" rx="${s.rx}" ry="${s.ry}" fill="${s.fill || "none"}" stroke="${s.stroke || "none"}" stroke-width="${s.w || 0}"/>`;
      const d =
        s.d.map(([x, y], k) => `${k ? "L" : "M"}${x.toFixed(3)} ${y.toFixed(3)}`).join(" ") +
        (s.close ? " Z" : "");
      return `<path d="${d}" fill="${s.t === "path" && s.fill ? s.fill : "none"}" stroke="${s.stroke || "none"}" stroke-width="${s.w || 0}" stroke-linecap="round" stroke-linejoin="round"/>`;
    })
    .join("");
  return `<span class="${cls}" style="width:${px}px;height:${px}px"><svg viewBox="${box}" width="${px}" height="${px}" aria-hidden="true">${body}</svg></span>`;
}
function itemModelSvg(model, px = 32) {
  return model ? shapesSvg(itemShapes(model), px) : "";
}
function chemGlyphSvg(sp, px = 16) {
  const m = chemModel(sp);
  return m ? shapesSvg(chemShapes(m), px, "-0.7 -0.75 1.4 1.4", "chem-glyph") : "";
}
function drawItemModel(g, model, x, y, size, angle = 0) {
  if (model) drawShapes(g, itemShapes(model), x, y, size, angle);
}
// Read-only lookup of a carried, functional item for a purpose (the sim-side
// toolForPurpose may claim a ground tool, so rendering never calls it).
function carriedItem(id, purpose) {
  const ids = W.components.inventory[id]?.artifactIds;
  if (!ids?.length) return null;
  let best = null;
  for (const eid of ids) {
    const a = W.artifacts.find((x) => x.entityId === eid);
    if (a && isFunctionalTool(a, purpose) && (!best || a.quality > best.quality)) best = a;
  }
  return best;
}
// ── Worn and carried in the world ──────────────────────────────────────────────
const drawCreatureGlyphItemsBase = drawCreatureGlyph;
drawCreatureGlyph = function (
  g,
  id,
  s,
  now,
  fac = null,
  scaleOverride = 0,
  portrait = false,
  motion = null,
) {
  const r = drawCreatureGlyphItemsBase(g, id, s, now, fac, scaleOverride, portrait, motion);
  if (W.kind[id] !== KINDS.PERSON || W.kind[id] === KINDS.CORPSE || !W.components.life[id])
    return r;
  if (!portrait && (UI.quality === "low" || r < 5)) return r;
  if (!W.components.inventory[id]?.artifactIds?.length) return r;
  const armour = carriedItem(id, "armor"),
    helm = carriedItem(id, "helmet"),
    weapon = carriedItem(id, "war"),
    lift = portrait ? 0 : r * 0.1;
  if (armour) drawItemModel(g, itemModel(armour), s.x, s.y - r * 0.28 - lift, r * 0.55);
  if (helm) drawItemModel(g, itemModel(helm), s.x, s.y - r * 1.02 - lift, r * 0.42);
  if (weapon) {
    const life = W.components.life[id],
      ready =
        life?.behavior === "fight" ||
        life?.behavior === "defend" ||
        life?.behavior === "march" ||
        life?.threatId;
    drawItemModel(
      g,
      itemModel(weapon),
      s.x + r * 0.62,
      s.y - r * (ready ? 0.55 : 0.2) - lift,
      r * 0.95,
      ready ? -0.5 : 0.35,
    );
  }
  return r;
};
// ── Inventory, inspectors, and Legends ─────────────────────────────────────────
personInventoryPanel = function (id) {
  const inv = W.components.inventory[id];
  if (!inv) return "";
  const mats = [];
  if (inv.materials)
    for (let sp = 0; sp < inv.materials.length; sp++)
      if (inv.materials[sp] > 0) mats.push([sp, inv.materials[sp]]);
  mats.sort((a, b) => b[1] - a[1] || a[0] - b[0]);
  const slotCss =
      "width:46px;height:46px;border-radius:6px;position:relative;display:flex;align-items:center;justify-content:center;box-sizing:border-box",
    matSlots = mats
      .slice(0, 24)
      .map(([sp, n]) => {
        const d = W.definitions.species[sp];
        return `<div title="${esc(d.name)} · ${n} units — ${esc(d.role || "material")}" style="${slotCss};background:${hsl(d.colorHue, 45, 20)};border:1px solid ${hsl(d.colorHue, 55, 42)}">${chemGlyphSvg(sp, 30)}<b style="position:absolute;right:3px;bottom:1px;font-size:10px;color:#ffe9b0">${n > 999 ? "999+" : n}</b></div>`;
      })
      .join(""),
    artifacts = (inv.artifactIds || [])
      .map((eid) => W.artifacts.find((a) => a.entityId === eid))
      .filter(Boolean)
      .sort((left, right) => {
        const lc = equipmentDisplayCategory(left),
          rc = equipmentDisplayCategory(right);
        return (
          lc.localeCompare(rc) ||
          (left.name || "").localeCompare(right.name || "") ||
          left.entityId - right.entityId
        );
      }),
    arts = artifacts
      .map((a) => {
        const capabilities = a.tool?.capabilities || [],
          wear = a.tool ? 1 - a.tool.wear / Math.max(1, a.tool.durability) : 1,
          functional = !a.tool || a.tool.wear < a.tool.durability,
          category = equipmentDisplayCategory(a),
          war = capabilities.includes("war"),
          hue = W.definitions.species[a.materialId]?.colorHue ?? 40,
          form = a.tool?.form || "carried artifact",
          functions = capabilities.length ? capabilities.join(" / ") : "material artifact";
        return `<div data-world-target="${a.entityId}" style="cursor:pointer;display:grid;grid-template-columns:46px minmax(0,1fr);gap:8px;padding:7px;margin:5px 0;border-radius:7px;background:${hsl(hue, 32, 14)};border:1px solid ${war ? "#e0645c" : hsl(hue, 45, 38)}"><div title="${esc(category)}" style="${slotCss};background:${hsl(hue, 40, 18)};border:1px solid ${hsl(hue, 55, 42)}">${itemModelSvg(itemModel(a), 40)}<i style="position:absolute;left:3px;right:3px;bottom:2px;height:3px;background:#0009;border-radius:2px"><i style="display:block;height:3px;border-radius:2px;width:${Math.round(clamp(wear, 0, 1) * 100)}%;background:${functional && wear > 0.5 ? "#8fc07a" : "#e0645c"}"></i></i></div><div style="min-width:0"><div class="row between"><b>${esc(a.name || form)}</b><span class="tag ${functional ? "" : "red"}">${functional ? "ready" : "broken"}</span></div><small class="gold">${esc(category)} · ${esc(titleCase(form))}</small><div class="muted" style="font-size:11px">${esc(functions)} · quality ${a.quality}</div></div></div>`;
      })
      .join("");
  return `<details open><summary>Character inventory · ${artifacts.length} equipment item${artifacts.length === 1 ? "" : "s"}</summary><div><div class="subhead">All tools, weapons and armor</div><div class="muted" style="font-size:11px;margin-bottom:4px">Every intact carried item is automatically available to this character in work or combat.</div>${
    arts || `<span class="muted">bare-handed — no crafted equipment</span>`
  }<div class="subhead">Carried materials · ${fmt(sum(Array.from(inv.materials || [])))} mass</div><div class="row wrap" style="gap:5px">${matSlots || `<span class="muted">nothing carried</span>`}</div></div></details>`;
};
// Chemistry lists keep whatever markup earlier sections gave them; a glyph is
// slipped in front of each name.
const chemistryRowsItemsBase = chemistryRows;
chemistryRows = function (q, limit = 10) {
  return chemistryRowsItemsBase(q, limit)
    .replace(
      /data-guide-chem="([0-9]+)"([^>]*)><span class="chem-identity">/g,
      (all, sp, rest) =>
        `data-guide-chem="${sp}"${rest}><span class="chem-identity">${chemGlyphSvg(Number(sp), 16)}`,
    )
    .replace(
      /<div class="chem-row"><span title="([^"]*)">([^<]*)<[/]span>/g,
      (all, title, name) => {
        const sp = W.definitions.species.findIndex((d) => d.name === name);
        return `<div class="chem-row"><span title="${title}">${sp >= 0 ? chemGlyphSvg(sp, 16) : ""}${name}</span>`;
      },
    );
};
const nonLifeInspectorItemsBase = nonLifeInspector;
nonLifeInspector = function (id) {
  const html = nonLifeInspectorItemsBase(id),
    artifact = W.artifacts.find((a) => a.entityId === id);
  if (!artifact) return html;
  const at = html.indexOf('<div class="kv">');
  const portrait = `<div class="item-portrait">${itemModelSvg(itemModel(artifact), 112)}</div>`;
  return at < 0 ? html + portrait : html.slice(0, at) + portrait + html.slice(at);
};
const renderArtifactPageItemsBase = renderArtifactPage;
renderArtifactPage = function (id) {
  const html = renderArtifactPageItemsBase(id),
    a = W.artifacts.find((x) => x.id === id);
  if (!a) return html;
  const at = html.indexOf('<div class="kv">'),
    portrait = `<div class="item-portrait">${itemModelSvg(itemModel(a), 140)}</div>`;
  return at < 0 ? html + portrait : html.slice(0, at) + portrait + html.slice(at);
};
window.ALIFE_ITEMS_DEBUG = Object.freeze({
  silhouettes: ITEM_SILHOUETTES,
  silhouette: (tool) => itemSilhouette(tool),
  model: (artifactId) =>
    itemModel(W.artifacts.find((a) => a.id === artifactId || a.entityId === artifactId)),
  svg: (artifactId, px = 32) =>
    itemModelSvg(
      itemModel(W.artifacts.find((a) => a.id === artifactId || a.entityId === artifactId)),
      px,
    ),
  shapes: (model) => itemShapes(model),
  chem: (sp) => chemModel(sp),
  chemSvg: (sp, px = 16) => chemGlyphSvg(sp, px),
  carried: (id, purpose) => carriedItem(id, purpose)?.id || 0,
});
