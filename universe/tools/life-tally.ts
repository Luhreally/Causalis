// node tools/life-tally.ts [from=0] [to=300] [frequency=64] [--plain] [--earth]: a reading of the bodies the generator gives
// the open ("alien") worlds, as the rules stand, made at the full grid and not run (B0 of the life plan,
// docs/architecture/asks-2026-11-12-plan.md Part B). What it tells:
//   - worlds with life, life's liquid, the peoples' body types, the roles beasts fill;
//   - silhouettes: a beast's limbs and how it moves, as its facts say (15 over 300 worlds as the rules stood);
//   - drawn outlines: each beast built and posed standing as the view draws it (view/creature.ts), its parts read
//     as a signature (each part's shape, its longest axis, where it lies in the body's bounds; the body's bounds'
//     proportions binned), and counted distinct; how much of a world's outlines another world shares, and the
//     commonest five's share. `--plain` draws every beast with no look (as before B1), to set before and after side
//     by side on the same worlds; `--earth` reads first light's beasts alone (their outlines must not move).
// It reads only: no world is run and nothing is kept.
import { seedFromText } from "../src/kernel/index.ts";
import {
  beastLookOf,
  generateHomeWorld,
  worldKindOf,
  worldLife,
  type HomeWorld,
  type Species,
} from "../src/gen/index.ts";
import { EARTHLIKE, OPEN } from "../src/rules/index.ts";
import { buildBody, posed, type BeastPart } from "../src/view/index.ts";

const argv = process.argv.slice(2),
  nums = argv.filter((a) => /^\d+$/.test(a)).map(Number),
  plain = argv.includes("--plain"),
  earth = argv.includes("--earth"),
  from = nums[0] ?? 0,
  to = nums[1] ?? 300,
  frequency = nums[2] ?? 64;

const tally = (into: Map<string, number>, key: string, by = 1) =>
  into.set(key, (into.get(key) ?? 0) + by);
const sorted = (t: Map<string, number>) =>
  [...t]
    .sort((a, b) => b[1] - a[1] || (a[0] < b[0] ? -1 : 1))
    .map(([k, v]) => `${k} ${v}`)
    .join(", ");
const mean = (a: readonly number[]) => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : 0);
const topShare = (t: Map<string, number>, n: number) => {
  const v = [...t.values()].sort((a, b) => b - a),
    all = v.reduce((x, y) => x + y, 0);
  return all ? Math.round((100 * v.slice(0, n).reduce((x, y) => x + y, 0)) / all) : 0;
};

const PARTS: BeastPart[] = [];
const bin = (x: number, lo: number, hi: number) => (x < lo ? 0 : x > hi ? 2 : 1);

/**
 * A beast's drawn outline as a signature: built at the village's detail and posed standing, each part read as its
 * shape, its longest axis (x across, y up, z along, after its tip), and the third of the body's bounds it lies in,
 * up and along; the bounds' length and width against height in halving bins. Sizes are not in it: a large and a
 * small beast of one outline share it.
 */
export function outlineOf(s: Species, g: HomeWorld | null): string {
  const look = g && !plain ? beastLookOf(g, s) : null,
    body = buildBody({ ...s.body!, ...(look ? { look } : {}) } as never, 2, null, 0),
    n = posed(body, { gait: 0, phase: 0, head: 0.25, crouch: 0 }, PARTS);
  let x0 = Infinity,
    x1 = -Infinity,
    y0 = Infinity,
    y1 = -Infinity,
    z0 = Infinity,
    z1 = -Infinity;
  const axes: { x: number; y: number; z: number; axis: string; shape: number }[] = [];
  for (let i = 0; i < n; i++) {
    const p = PARTS[i]!,
      // (Its extent after its tip about x and its turn about y, roughly: the tip swaps up and along.)
      c = Math.abs(Math.cos(p.pitch)),
      sn = Math.abs(Math.sin(p.pitch)),
      ey = p.sy * c + p.sz * sn,
      ez = p.sz * c + p.sy * sn,
      cy = Math.abs(Math.cos(p.yaw)),
      sy = Math.abs(Math.sin(p.yaw)),
      ex = p.sx * cy + ez * sy,
      ezz = ez * cy + p.sx * sy;
    x0 = Math.min(x0, p.x - ex / 2);
    x1 = Math.max(x1, p.x + ex / 2);
    y0 = Math.min(y0, p.y - ey / 2);
    y1 = Math.max(y1, p.y + ey / 2);
    z0 = Math.min(z0, p.z - ezz / 2);
    z1 = Math.max(z1, p.z + ezz / 2);
    axes.push({
      x: p.x,
      y: p.y,
      z: p.z,
      axis: ex >= ey && ex >= ezz ? "x" : ey >= ezz ? "y" : "z",
      shape: (p as { shape?: number }).shape ?? 0,
    });
  }
  const H = Math.max(1e-6, y1 - y0),
    L = Math.max(1e-6, z1 - z0),
    W = Math.max(1e-6, x1 - x0),
    tokens = axes
      .map((a) => {
        const up = Math.min(2, Math.floor((3 * (a.y - y0)) / H)),
          along = Math.min(2, Math.floor((3 * (a.z - z0)) / L));
        return `${a.shape}${a.axis}${up}${along}`;
      })
      .sort();
  // (The same token many times is told by its count in fours, so a pair more of the same legs is one outline.)
  const counts = new Map<string, number>();
  for (const t of tokens) tally(counts, t);
  const multiset = [...counts].map(([t, c]) => `${t}*${Math.ceil(c / 4)}`).join(" ");
  return `${Math.round(Math.log2(L / H))},${Math.round(Math.log2(W / H))}|${bin(n, 12, 28)}|${multiset}`;
}

const clades = new Map<string, number>(),
  kinds = new Map<string, number>(),
  families = new Map<string, number>(),
  shapes = new Map<string, number>(),
  outlines = new Map<string, number>(),
  niches = new Map<string, number>(),
  coverings = new Map<string, number>(),
  growths = new Map<string, number>(),
  symmetry = new Map<string, number>(),
  stocks: number[] = [],
  perWorldShapes: number[] = [],
  perWorldOutlines: number[] = [],
  livingPerWorld: number[] = [],
  nichesPerWorld: number[] = [],
  /** Each world's outlines, to tell what one shares with the others. */
  worldOutlines: Set<string>[] = [];
let worlds = 0,
  lifeless = 0,
  peopled = 0,
  beasts = 0,
  ms = 0;

for (let i = from; i < to; i++) {
  const seed = earth ? "first light" : `alien ${i}`,
    t0 = performance.now(),
    g = generateHomeWorld(seedFromText(seed), earth ? EARTHLIKE : OPEN, frequency);
  ms += performance.now() - t0;
  worlds++;
  tally(kinds, worldKindOf(g));
  if (!g.life.species.length) {
    lifeless++;
    if (earth) break;
    continue;
  }
  try {
    tally(families, worldLife(g).family);
  } catch {
    tally(families, "?");
  }
  const people = g.life.people;
  if (people) {
    peopled++;
    tally(clades, people.body.clade);
  } else tally(clades, "(no people)");
  const here = new Set<string>(),
    drawn = new Set<string>(),
    roles = new Set<string>(),
    stocksHere = new Set<number>();
  let living = 0;
  for (const s of g.life.species) {
    if (s.died !== null || !s.body) continue;
    const b = s.body,
      shape = `${b.symmetry === "radial" ? "radial " : ""}${b.legs} legs/${b.fins} fins/${b.wings} wings ${b.moves}`,
      outline = outlineOf(s, g);
    if (!plain) {
      const look = beastLookOf(g, s);
      if (look) stocksHere.add(look.stock);
    }
    living++;
    beasts++;
    here.add(shape);
    drawn.add(outline);
    roles.add(s.niche);
    tally(shapes, shape);
    tally(outlines, outline);
    tally(niches, s.niche);
    tally(coverings, b.covering);
    tally(symmetry, b.symmetry);
    for (const f of b.features) tally(growths, f);
  }
  perWorldShapes.push(here.size);
  perWorldOutlines.push(drawn.size);
  livingPerWorld.push(living);
  nichesPerWorld.push(roles.size);
  worldOutlines.push(drawn);
  if (!plain) stocks.push(stocksHere.size);
  if (earth) break;
}

// What a world's outlines share with the rest: the share of its own found on any other world, and, for two worlds
// side by side, the share of the smaller's found in the larger's (averaged over pairs).
const seenIn = new Map<string, number>();
for (const set of worldOutlines) for (const o of set) tally(seenIn, o);
const shared = worldOutlines.map((set) =>
  set.size ? [...set].filter((o) => seenIn.get(o)! > 1).length / set.size : 0,
);
let pairs = 0,
  pairShare = 0;
for (let a = 0; a < worldOutlines.length; a++)
  for (let b = a + 1; b < worldOutlines.length; b++) {
    const A = worldOutlines[a]!,
      B = worldOutlines[b]!,
      [small, big] = A.size <= B.size ? [A, B] : [B, A];
    if (!small.size) continue;
    let both = 0;
    for (const o of small) if (big.has(o)) both++;
    pairs++;
    pairShare += both / small.size;
  }

console.log(
  `${worlds} worlds (${earth ? "first light" : `alien ${from}..${to - 1}`}) at grid ${frequency}, ${(ms / worlds / 1000).toFixed(2)} s each to make${plain ? ", drawn plain (no look)" : ""}`,
);
console.log(`kinds: ${sorted(kinds)}`);
console.log(`lifeless: ${lifeless}; with a people: ${peopled}`);
console.log(`life's liquid: ${sorted(families)}`);
console.log(`peoples by body type: ${sorted(clades)}`);
console.log(`living beasts: ${beasts}, ${mean(livingPerWorld).toFixed(1)} a world`);
console.log(`roles: ${sorted(niches)}; ${mean(nichesPerWorld).toFixed(1)} a world`);
console.log(
  `silhouettes (limbs + how it moves): ${shapes.size} in all; top 5 hold ${topShare(shapes, 5)}% of beasts; ${mean(perWorldShapes).toFixed(1)} a world`,
);
console.log(
  `drawn outlines: ${outlines.size} in all; top 5 hold ${topShare(outlines, 5)}% of beasts; ${mean(perWorldOutlines).toFixed(1)} a world`,
);
console.log(
  `  a world's outlines found on another world: ${Math.round(100 * mean(shared))}% (mean); two worlds side by side share ${pairs ? Math.round((100 * pairShare) / pairs) : 0}% of the smaller's`,
);
if (stocks.length)
  console.log(
    `stocks a world: ${mean(stocks).toFixed(1)} (${Math.min(...stocks)}–${Math.max(...stocks)})`,
  );
console.log(`coverings: ${sorted(coverings)}`);
console.log(`symmetry: ${sorted(symmetry)}`);
console.log(`growths: ${sorted(growths)}`);
if (earth)
  console.log(
    `first light's outlines: ${[...outlines.keys()].sort().join(" ; ").length} chars, ${outlines.size} distinct`,
  );
