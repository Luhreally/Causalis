import { test } from "node:test";
import assert from "node:assert/strict";
import { drawSpecimen, hasShape, specimenParts, type SpecimenPart } from "../../src/ui/specimen.ts";
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
    setLineDash() {},
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

// Asked 2026-11-12 ("it doesnt show the shoes and clothes sepratlety or combines axes and sickle ... i want more generative detail ...
// when i look for it"): every thing a market names has a shape of its own, and a picture drawn large has a fine level a thumbnail never has.
const NAMED_FORMS = [
  "axe",
  "saw",
  "sickle",
  "plough share",
  "knife",
  "chisel",
  "hammer",
  "awl",
  "scraper",
  "blade",
  "tunic",
  "shirt",
  "gown",
  "dress",
  "trousers",
  "cloak",
  "coat",
  "cuirass",
  "hat",
  "cap",
  "boot",
  "shoe",
  "sandal",
];

test("every tool and garment a market names has its own shape, sound, and none drawn as another", () => {
  const seen = new Map<string, string>();
  for (const form of NAMED_FORMS) {
    assert.ok(hasShape(form), `${form} has a shape of its own`);
    const made = /boot|shoe|sandal|coat/.test(form)
        ? "sewn"
        : /tunic|shirt|gown|dress|trousers|cloak|hat|cap/.test(form)
          ? "woven"
          : "forged",
      parts = specimenParts(thing(form, made));
    sound(parts);
    const sig = JSON.stringify(parts.map((p) => p.mesh.v));
    assert.ok(!seen.has(sig) || seen.get(sig) === form, `${form} is drawn as ${seen.get(sig)}`);
    seen.set(sig, form);
  }
});

test("a thumbnail's parts carry no marks; drawn large, a tool, a garment and a machine show their making in marks", () => {
  for (const [form, made] of [
    ["axe", "forged"],
    ["saw", "forged"],
    ["sickle", "cast"],
    ["tunic", "woven"],
    ["boot", "sewn"],
    ["steam engine", "machined"],
    ["scraper", "knapped"],
    ["storage jar", "thrown"],
  ] as const) {
    const p = thing(form, made);
    assert.ok(
      specimenParts(p).every((q) => !q.marks?.length),
      `${form}: no marks in a thumbnail`,
    );
    const fine = specimenParts(p, true),
      marks = fine.reduce((n, q) => n + (q.marks?.length ?? 0), 0);
    assert.ok(marks >= 3, `${form} made ${made}: ${marks} marks drawn large`);
    for (const q of fine)
      for (const m of q.marks ?? [])
        if (m.face !== undefined)
          assert.ok(
            m.face >= 0 && m.face < q.mesh.f.length,
            `${form}: a mark on a face of its part`,
          );
    const coarse = recorder(),
      large = recorder();
    drawSpecimen(coarse.ctx, p, { x: 0, y: 0, w: 300, h: 300 }, 0, "coarse");
    drawSpecimen(large.ctx, p, { x: 0, y: 0, w: 300, h: 300 }, 0, "fine");
    assert.ok(
      large.counts.strokes > coarse.counts.strokes,
      `${form}: ${large.counts.strokes} strokes fine against ${coarse.counts.strokes} coarse`,
    );
  }
  // (A saw has its every tooth drawn large, and fewer, broader ones small.)
  assert.ok(
    specimenParts(thing("saw", "forged"), true)[1]!.mesh.f.length >
      specimenParts(thing("saw", "forged"))[1]!.mesh.f.length,
  );
});
