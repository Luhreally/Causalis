import { test } from "node:test";
import assert from "node:assert/strict";
import { drawSpecimen, specimenParts, type SpecimenPart } from "../../src/ui/specimen.ts";
import type { Habit, MadeHow, MatterForm, Portrait } from "../../src/bridge/index.ts";

// Phase 54 M223: the specimen renderer draws a substance, an element or a made thing as parts
// of flat-shaded faces. These tests pin what it must give, not how it looks.

type Matter = Extract<Portrait, { kind: "matter" }>;
type Element = Extract<Portrait, { kind: "element" }>;
type Thing = Extract<Portrait, { kind: "thing" }>;

const HABITS: Habit[] = [
  "cubic",
  "octahedral",
  "dodecahedral",
  "tetrahedral",
  "hexagonal",
  "rhombic",
  "prismatic",
  "bladed",
  "acicular",
  "platy",
  "botryoidal",
  "dendritic",
  "nugget",
  "nodular",
  "conchoidal",
  "earthy",
  "massive",
  "fibrous",
  "granular",
];
const FORMS: MatterForm[] = [
  "crystal",
  "lump",
  "ingot",
  "powder",
  "liquid",
  "gas",
  "glass",
  "fibre",
  "sheet",
  "flesh",
];
const MADE: MadeHow[] = [
  "knapped",
  "forged",
  "cast",
  "thrown",
  "woven",
  "sewn",
  "machined",
  "carved",
  "grown",
];

const matter = (over: Partial<Matter> = {}): Matter => ({
  kind: "matter",
  form: "lump",
  habit: null,
  color: [0.8, 0.7, 0.5],
  lustre: "vitreous",
  clarity: 0.2,
  hardness: 6,
  key: 12345,
  ...over,
});

const element = (over: Partial<Element> = {}): Element => ({
  kind: "element",
  symbol: "Fe",
  state: "solid",
  sort: "metal",
  color: [0.6, 0.6, 0.62],
  kept: false,
  key: 7,
  ...over,
});

const thing = (form: string, made: MadeHow = "forged", over: Partial<Thing> = {}): Thing => ({
  kind: "thing",
  form,
  made,
  color: [0.7, 0.72, 0.78],
  lustre: "metallic",
  haft: null,
  quality: 60,
  worn: 0,
  key: 99,
  ...over,
});

/** Every corner finite, every face at least three corners, every face index inside its mesh. */
function sound(parts: readonly SpecimenPart[]): void {
  for (const part of parts) {
    for (const p of part.mesh.v) for (const c of p) assert.ok(Number.isFinite(c), `finite ${c}`);
    for (const face of part.mesh.f) {
      assert.ok(face.length >= 3, "a face has at least three corners");
      for (const i of face)
        assert.ok(i >= 0 && i < part.mesh.v.length, `face index ${i} inside its mesh`);
    }
  }
}

/** A recording context: counts fills and strokes, and keeps the state the drawing sets. */
function recorder() {
  const counts = { fills: 0, strokes: 0 };
  const ctx = {
    fillStyle: "",
    strokeStyle: "",
    globalAlpha: 1,
    globalCompositeOperation: "source-over",
    lineWidth: 1,
    lineJoin: "miter",
    beginPath() {},
    moveTo() {},
    lineTo() {},
    closePath() {},
    arc() {},
    ellipse() {},
    rect() {},
    clip() {},
    save() {},
    restore() {},
    setTransform() {},
    clearRect() {},
    fillRect() {},
    drawImage() {},
    fill() {
      counts.fills++;
    },
    stroke() {
      counts.strokes++;
    },
    createRadialGradient() {
      return { addColorStop() {} };
    },
  };
  return { ctx: ctx as unknown as CanvasRenderingContext2D, counts, state: ctx };
}

test("every habit and every matter form gives sound parts", () => {
  for (const habit of HABITS) {
    const parts = specimenParts(matter({ form: "crystal", habit }));
    assert.ok(parts.length >= 1, `habit ${habit} gives parts`);
    sound(parts);
  }
  for (const form of FORMS) {
    const parts = specimenParts(matter({ form, habit: null }));
    assert.ok(parts.length >= 1, `form ${form} gives parts`);
    sound(parts);
  }
});

test("the elements: a metal, a kept metal, a metalloid, sulphur, carbon, phosphorus, a gas and a noble gas", () => {
  const cases: Element[] = [
    element({ sort: "metal", state: "solid", kept: false, symbol: "Fe" }),
    element({ sort: "metal", state: "solid", kept: true, symbol: "Na" }),
    element({ sort: "metalloid", state: "solid", symbol: "Si" }),
    element({ sort: "nonmetal", state: "solid", symbol: "S", color: [0.9, 0.8, 0.2] }),
    element({ sort: "nonmetal", state: "solid", symbol: "C", color: [0.08, 0.08, 0.09] }),
    element({ sort: "nonmetal", state: "solid", symbol: "P", kept: true, color: [0.9, 0.9, 0.8] }),
    element({ sort: "nonmetal", state: "gas", symbol: "N", color: [0.8, 0.9, 1] }),
    element({ sort: "noble", state: "gas", symbol: "Ne", color: [1, 0.4, 0.5] }),
  ];
  for (const c of cases) {
    const parts = specimenParts(c);
    assert.ok(parts.length >= 1, `${c.symbol} gives parts`);
    sound(parts);
  }
});

test("the made things: each named form gives at least two parts (pots and cloth at least one)", () => {
  const twoParts = [
    "axe",
    "adze",
    "hoe",
    "sickle",
    "knife",
    "spearhead",
    "plough share",
    "shears",
    "hammer",
    "chisel",
    "club",
    "spear",
    "sword",
    "bow",
    "horn-bow",
    "musket",
    "rifle",
    "repeater",
    "autoloader",
    "automatic",
    "storage jar",
    "cooking pot",
    "bowl",
    "jug",
    "tunic",
    "bolt of cloth",
    "shaft",
    "piston",
    "bolt",
    "gear",
    "wheel",
  ];
  for (const form of twoParts) {
    const parts = specimenParts(thing(form));
    assert.ok(parts.length >= 2, `${form} gives at least two parts (got ${parts.length})`);
    sound(parts);
  }
  for (const form of ["vessel", "cloth"]) sound(specimenParts(thing(form)));
  for (const made of MADE) {
    const parts = specimenParts(thing("thingamajig", made));
    assert.ok(parts.length >= 1, `an unknown form made ${made} gives parts`);
    sound(parts);
  }
});

test("the same portrait always gives the same parts; different keys give different shapes", () => {
  const p = matter({ form: "crystal", habit: "dendritic", key: 4242 });
  assert.deepEqual(specimenParts(p), specimenParts(p));
  const q = thing("axe", "knapped", { key: 5 });
  assert.deepEqual(specimenParts(q), specimenParts(q));
  for (const habit of ["nugget", "massive", "dendritic"] as const) {
    const a = specimenParts(matter({ form: "crystal", habit, key: 1 }));
    const b = specimenParts(matter({ form: "crystal", habit, key: 2 }));
    assert.notDeepEqual(
      a.map((x) => x.mesh.v),
      b.map((x) => x.mesh.v),
      `${habit}: two keys give two meshes`,
    );
  }
});

test("drawing fills the faces of a crystal, an ingot, a gas, a flint axe and a rifle, and nothing throws", () => {
  const cases: Portrait[] = [
    matter({ form: "crystal", habit: "hexagonal", color: [0.9, 0.9, 0.95], clarity: 0.8 }),
    matter({ form: "ingot", color: [0.8, 0.45, 0.2], lustre: "metallic", clarity: 0 }),
    matter({ form: "gas", color: [0.9, 0.3, 0.4], lustre: "dull", clarity: 0 }),
    thing("axe", "knapped", { color: [0.45, 0.42, 0.4], lustre: "waxy" }),
    thing("rifle", "forged"),
  ];
  for (const p of cases) {
    const { ctx, counts, state } = recorder();
    drawSpecimen(ctx, p, { x: 4, y: 4, w: 120, h: 120 }, 1.3);
    assert.ok(counts.fills >= 4, `${p.kind} fills at least four faces (got ${counts.fills})`);
    assert.equal(
      state.globalCompositeOperation,
      "source-over",
      "the composite is back to source-over",
    );
  }
});

test("a clear crystal fills more faces than the same crystal opaque, its back faces drawn too", () => {
  const box = { x: 4, y: 4, w: 120, h: 120 };
  const opaque = recorder(),
    clear = recorder();
  drawSpecimen(opaque.ctx, matter({ form: "crystal", habit: "hexagonal", clarity: 0 }), box, 0);
  drawSpecimen(clear.ctx, matter({ form: "crystal", habit: "hexagonal", clarity: 0.8 }), box, 0);
  assert.ok(
    clear.counts.fills > opaque.counts.fills,
    `clear ${clear.counts.fills} > opaque ${opaque.counts.fills}`,
  );
});
