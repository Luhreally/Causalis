// History gone cold (Phase 63) is the same history on every page: a world that puts its events,
// decisions and wars into blocks as soon as it may answers every query and draws every frame as one
// that never puts any away, and so does that world saved and loaded. Each answer through
// structuredClone, as a worker's post would take it (a row read through its block must not escape as
// one). What a block keeps only as far as it is read: the strengths behind a battle's exchanges, and
// the weight of a cause, which comes of the sums to two or four places that "why" tells.
import { test } from "node:test";
import { keptLife } from "../../src/rules/kinds.ts";
import assert from "node:assert/strict";
import { YEAR, rulesetId, saveWorld, seedFromText, type World } from "../../src/kernel/index.ts";
import { ALIEN } from "../../src/host/planet.ts";
import { loadKept, serializeWhy } from "../../src/host/host.ts";
import { spine, why } from "../../src/causal/index.ts";
import { warsOf } from "../../src/sim/index.ts";

const SEED = seedFromText(keptLife("alien 16")),
  YEARS = 220,
  /** How long to go on asking any one query, in ms (the answers are the same whatever is asked). */
  EACH_MS = 250;

function build(cold: boolean): World {
  const world = ALIEN.build(SEED);
  (world as unknown as { coldRows: number }).coldRows = cold ? 16 : 1e9;
  warsOf(world).coldBattles = cold ? 2 : 1e9;
  return world;
}

function evenly<T>(list: readonly T[], n: number): T[] {
  const step = Math.max(1, Math.floor(list.length / n));
  return list.filter((_, k) => k % step === 0).slice(0, n);
}

/** An answer as it would cross to the page, in a form to compare. */
function answer(ask: () => unknown): string {
  try {
    return String(JSON.stringify(structuredClone(ask())))
      .replace(/"power":\[[\d.e+-]+,[\d.e+-]+\],"frames"/g, '"frames"')
      .replace(/"role":"(\w+)","weight":[\d.e-]+,"node"/g, '"role":"$1","node"');
  } catch (e) {
    return `throws ${(e as Error).message}`;
  }
}

test("every page answers alike of a world's history hot, in blocks, and saved and loaded", () => {
  const hot = build(false),
    cold = build(true);
  hot.runTo(YEARS * YEAR);
  cold.runTo(YEARS * YEAR);
  assert.deepEqual(cold.domainHashes(), hot.domainHashes());
  assert.equal(hot.events.coldCount, 0);
  assert.ok(cold.events.coldCount > 500, `${cold.events.coldCount} events gone cold`);
  assert.ok(cold.decisions.coldCount > 100, `${cold.decisions.coldCount} decisions gone cold`);
  const ruleset = rulesetId(cold, "cold pages"),
    doc = JSON.parse(JSON.stringify(saveWorld(cold, ruleset))) as ReturnType<typeof saveWorld>,
    loaded = loadKept(doc, ALIEN.build, ruleset).world;

  // What to ask about: some of everything that has a page.
  const wars = warsOf(hot).all(),
    battles = wars.flatMap((w) => w.battles.map((b) => b.event as string)),
    goneWars = warsOf(cold).all().length - warsOf(cold).hot().length,
    events = Array.from({ length: hot.events.count }, (_, k) => hot.events.at(k).id as string);
  assert.ok(goneWars > 3, `${goneWars} wars gone cold`);
  const refs = [
      ...evenly(events, 40),
      ...evenly(
        hot.decisions.all().map((d) => d.id as string),
        12,
      ),
      ...evenly(
        wars.map((w) => w.ref as string),
        8,
      ),
      ...evenly(battles, 8),
    ],
    someBattles = evenly(battles, 8),
    candidates: unknown[] = [
      undefined,
      {},
      { n: 50 },
      { most: 40 },
      { refs: evenly(refs, 8) },
      ...refs.map((ref) => ({ ref, depth: 4, event: ref })),
      ...someBattles.flatMap((event) => [
        { event },
        { event, side: 0, who: "" },
        { event, most: 40 },
      ]),
    ];
  const queries: Record<string, (w: World, a: never) => unknown> = {
    why: (w, a: { ref: never; depth?: number }) => serializeWhy(why(w, a.ref), a.depth ?? 2),
    spine: (w, a: { ref: never }) =>
      spine(w, a.ref).map((e) => ({ ref: e.ref, claim: e.claim, basis: e.basis, t: e.t })),
    ...(ALIEN.queries as unknown as Record<string, (w: World, a: never) => unknown>),
  };
  let asked = 0,
    answered = 0;
  const differing: string[] = [];
  for (const [name, handler] of Object.entries(queries)) {
    const start = performance.now();
    for (const a of candidates) {
      if (performance.now() - start > EACH_MS) break;
      const was = answer(() => handler(hot, a as never));
      asked++;
      if (!was.startsWith("throws")) answered++;
      if (answer(() => handler(cold, a as never)) !== was) differing.push(`${name} in blocks`);
      if (answer(() => handler(loaded, a as never)) !== was) differing.push(`${name} loaded`);
    }
  }
  for (const [view, frame] of Object.entries(ALIEN.frames)) {
    const interest = { view } as never,
      was = answer(() => frame(hot, interest));
    if (answer(() => frame(cold, interest)) !== was) differing.push(`frame ${view} in blocks`);
    if (answer(() => frame(loaded, interest)) !== was) differing.push(`frame ${view} loaded`);
  }
  assert.deepEqual([...new Set(differing)], [], `of ${asked} asked, these differ`);
  assert.ok(answered > 300, `only ${answered} of ${asked} answered`);
});
