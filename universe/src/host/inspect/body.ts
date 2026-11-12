// A lineage's body on its page, read by what each part does and why (B1 of the life plan): its stock — the first
// bodies of its world it descends from, and how many others of the world are of it — its parts by their jobs, and
// each trait with its cause and its figure, in the world's own numbers ("its legs splay wide: pull 1.8 g"). The
// figures are physics (rules/physiology.ts): what a frame bears against the pull, what wings lift, whether its coat
// keeps it warm where it lives, how far a call carries. Estimates are said to be estimates. A reading: nothing here
// is history.
import type { World } from "../../kernel/index.ts";
import type { Block, Item, Stat } from "../../bridge/index.ts";
import { beastLookOf, stockWorldOf, type HomeWorld, type Species } from "../../gen/index.ts";
import {
  flight,
  frameBears,
  gasDensity,
  keepsWarm,
  largestFrame,
  sensesOf,
  wingsFor,
  type BeastLook,
  type BodyFrame,
  type CreatureBody,
} from "../../rules/index.ts";
import { homePlanet } from "../../sim/index.ts";
import { item, stat } from "./words.ts";

const kgWords = (kg: number) =>
  kg >= 1000
    ? `${(kg / 1000).toFixed(kg >= 10_000 ? 0 : 1)} t`
    : kg >= 1
      ? `${Math.round(kg)} kg`
      : `${Math.round(kg * 1000)} g`;

/** What holds its shape: a shell where its covering is one and it is light enough to be held by it, else bones. */
function frameOf(b: CreatureBody, g: number): BodyFrame {
  if (b.covering === "shell" || b.covering === "plates")
    return b.size <= largestFrame("shell", g) ? "shell" : "bones";
  if (b.moves === "slither" && b.covering === "slick" && b.size <= largestFrame("none", g))
    return "none";
  return "bones";
}

const FRAME_WORDS: Readonly<Record<BodyFrame, string>> = {
  bones: "inner bones",
  shell: "an outer jointed shell",
  none: "its own pressure, with no frame",
  needles: "a mesh of needles",
  gas: "a light, hollow frame",
};

/** Its traits, each with why and its figure, in the world's own numbers. */
export function traitsOf(g: HomeWorld, s: Species, look: BeastLook | null): Item[] {
  const b = s.body;
  if (!b) return [];
  const world = stockWorldOf(g),
    pull = world.gravity,
    out: Item[] = [],
    swims = b.moves === "swim",
    frame = frameOf(b, pull),
    bears = frameBears(frame, b.size, pull, swims);
  out.push(
    item(
      `It is held by ${FRAME_WORDS[frame]}: ${swims ? "in its water, " : ""}such a frame bears up to ${kgWords(bears.largest)} under a pull of ${pull.toFixed(2)} g; it weighs ${kgWords(b.size)}${bears.ok ? "" : ", more than that (its frame is pressed to its bound)"}.`,
    ),
  );
  if (b.moves === "fly") {
    // (Its air: a world's air at its ground, a bar of Earth's own mixture, an estimate where none is told.)
    const air = gasDensity(1, 29, 273 + world.warmth),
      f = flight(b.size, wingsFor(b.size), air, pull);
    out.push(
      item(
        f.flies
          ? `It flies: its wings of about ${wingsFor(b.size).toFixed(b.size < 1 ? 3 : 1)} m² bear its ${kgWords(b.size)} at ${f.speed.toFixed(0)} m/s, its muscles giving ${f.gives.toFixed(0)} W of the ${f.needs.toFixed(0)} W flight costs (air ${air.toFixed(2)} kg/m³, pull ${pull.toFixed(2)} g; an estimate).`
          : `It flies, though barely: flight costs ${f.needs.toFixed(0)} W and its muscles give about ${f.gives.toFixed(0)} W (air ${air.toFixed(2)} kg/m³, pull ${pull.toFixed(2)} g; an estimate).`,
      ),
    );
  }
  if (b.warm) {
    const coat =
        b.covering === "feathers"
          ? "feathers"
          : b.covering === "fur" || b.covering === "wool"
            ? "fur"
            : "bare",
      ratio = keepsWarm(b.size, s.warm, coat);
    out.push(
      item(
        `Its ${coat === "bare" ? "bare hide" : coat} keeps its blood warm where it lives (${Math.round(s.warm)} °C): it can make ${ratio.toFixed(1)} times the heat it loses (an estimate).`,
      ),
    );
  }
  const senses = sensesOf({
    star: world.star,
    pressure: 1,
    liquid:
      world.liquid === "water"
        ? "water"
        : world.liquid === "ammonia"
          ? "ammonia"
          : world.liquid === "methane"
            ? "methane"
            : "oil",
  });
  if (look && look.eyeCount > 0)
    out.push(
      item(
        `Its ${look.eyeCount === 1 ? "eye sees" : `${look.eyeCount} eyes see`} in its star's light, brightest at ${Math.round(senses.peakNm)} nm (${senses.band})${look.eyeSize > 1.3 ? `; they are ${look.eyeSize.toFixed(1)} times as large as an Earth beast's of its size, to gather what light there is` : ""}.`,
      ),
    );
  if (swims && senses.electric && look?.extras.includes("fringe"))
    out.push(
      item(
        `Its fringe feels the current of living things: its life's ${world.liquid} carries one.`,
      ),
    );
  for (const w of look?.why ?? []) out.push(item(`${cap(w.what)}: ${w.because} (${w.figure}).`));
  return out;
}

const cap = (t: string) => t[0]!.toUpperCase() + t.slice(1);

/** Its parts by what they do, as its stock and its facts have them. */
function partsOf(b: CreatureBody, look: BeastLook): string[] {
  const legs =
      b.legs > 0
        ? `${b.legs} legs ${look.limbs === "sprawl" ? "sprawled wide from its sides" : look.limbs === "arch" ? "arched high from its sides" : look.limbs === "rake" ? "under it, bent back at the knee" : "straight under it"}, ${look.joints === 3 ? "three-jointed" : "two-jointed"}, to walk on`
        : null,
    extras: Readonly<Record<string, string>> = {
      feelers: "feelers on its head, to feel its way",
      graspers: "a pair of graspers at its front, to hold its food",
      sail: "a sail of skin down its back",
      frill: "a frill behind its head",
      scutes: "a row of scutes along its back, for armour",
      plumes: "plumes on its head",
      fringe: "a fringe along its sides, to feel currents",
      spurs: "spurs at its hips",
    };
  return [
    `a ${look.seg === "bag" ? "round" : look.seg === "disc" ? "flat" : look.seg === "dome" ? "domed" : look.seg === "taper" ? "tapering" : "square"} body of ${b.segments === 1 ? "one part" : `${b.segments} parts`}`,
    ...(legs ? [legs] : []),
    ...(b.wings ? [`${b.wings} wings, to fly`] : []),
    ...(b.fins ? [`${b.fins} fins, to steer`] : []),
    `a ${look.head === "hammer" ? "hammer-wide" : look.head === "wedge" ? "wedge-shaped" : look.head === "box" ? "square" : look.head === "bag" ? "round" : look.head === "disc" ? "flat" : "domed"} head, with ${look.eyeCount ? `${look.eyeCount} ${look.eyes === "stalks" ? "eyes on stalks" : look.eyes === "band" ? "eye in one band" : look.eyes === "cluster" ? "eyes clustered on its crown" : look.eyes === "row" ? "eyes in a row" : "eyes"}` : "no eyes"}`,
    b.features.includes("beak")
      ? "a beak to eat with"
      : look.mouth === "jaw"
        ? "jaws to eat with"
        : look.mouth === "mandibles"
          ? "mandibles to eat with"
          : look.mouth === "proboscis"
            ? "a proboscis to feed by"
            : look.mouth === "tendrils"
              ? "tendrils about its mouth to feed by"
              : "a sucker for a mouth",
    ...(b.tail > 0.05 || b.moves === "swim"
      ? [`a ${look.tail === "taper" ? "tapering" : look.tail} tail`]
      : []),
    ...look.extras.map((e) => extras[e] ?? e),
  ];
}

/** A lineage's body blocks for its page (none for Earth's, or one with no stock). */
export function bodyBlocks(world: World, s: Species): { stats: Stat[]; blocks: Block[] } {
  const g = homePlanet(world).generated,
    look = s.body ? beastLookOf(g, s) : null;
  if (!s.body || !look) return { stats: [], blocks: [] };
  const kin = look.kin;
  return {
    stats: [
      stat(
        "Its stock",
        `of ${look.stockName}, like ${kin === 0 ? "no other beast" : kin === 1 ? "one other beast" : `${kin} other beasts`} of this world`,
      ),
    ],
    blocks: [
      {
        type: "list",
        title: "Its body, part by part",
        items: partsOf(s.body, look).map((t) => item(cap(t))),
      },
      { type: "list", title: "Why it is built so", items: traitsOf(g, s, look) },
    ],
  };
}
