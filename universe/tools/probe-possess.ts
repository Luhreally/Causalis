// node tools/probe-possess.ts [years=300] [seconds=60] [seed] — what one of a town's people possessed
// costs on a real world (Phase 60), at each year given: the greatest town under the hand, its plan
// as the page draws it at High, one of its craftsmen taken where he is drawn (the taking's own
// reckoning on the page's side, and the command), walked to his work and set to it for so many
// seconds as the page sends them (a second of twenty bids a command, those coming near joined),
// the small world asked as the page asks it (step by step, and whole), let go — and the save before
// and after (what a minute of possession adds to it).
import { gzipSync } from "node:zlib";
import { YEAR, saveWorld, seedFromText } from "../src/kernel/index.ts";
import { EARTH } from "../src/host/index.ts";
import { POSSESS_QUERIES } from "../src/host/possess.ts";
import type { PossessLive, PossessNow, VillagePlan } from "../src/bridge/index.ts";
import { HAND_ACT, POSSESS_HZ, bidLetters, type HandBid } from "../src/rules/index.ts";
import { handOf, populationContext, possessionAhead } from "../src/sim/index.ts";
import { joinsAt, takeOf, workOf } from "../src/view/index.ts";

const years = (process.argv[2] ?? "300").split(",").map(Number),
  seconds = Number(process.argv[3] ?? 60),
  seed = process.argv[4] ?? "first light";
const WORKS: Readonly<Record<string, string>> = {
  smith: "forge",
  potter: "wheel",
  weaver: "loom",
  farmer: "row",
};
const ms = (t: number) => `${(performance.now() - t).toFixed(1)} ms`;
const size = (w: Parameters<typeof saveWorld>[0]) => {
  const text = JSON.stringify(saveWorld(w, "probe"));
  return `${(text.length / 1e6).toFixed(2)} MB (${(gzipSync(text).length / 1e6).toFixed(2)} MB packed)`;
};

const world = EARTH.build(seedFromText(seed)),
  plans = EARTH.queries["village.plan"]!,
  ask = <T>(type: string, args?: unknown) => POSSESS_QUERIES[type]!(world, args) as T;
for (const year of years) {
  let t = performance.now();
  world.runTo(year * YEAR);
  console.log(`${seed}, year ${year}: run ${((performance.now() - t) / 1000).toFixed(1)} s`);
  const great = [...populationContext(world).settlements.all()].sort(
    (a, b) => b.population - a.population,
  )[0]!;
  t = performance.now();
  world.runTo(world.submit("hand.lay", { village: great.ref }).t);
  console.log(
    `  the hand on ${great.name} (${great.population}): laid in ${ms(t)}, ${handOf(world).resting!.agents.length} of its people`,
  );
  // (A working morning.)
  world.runTo(Math.ceil(world.now / 86_400) * 86_400 + 10.5 * 3_600);
  t = performance.now();
  const plan = plans(world, { ref: great.ref, families: 10, folk: 220 }) as VillagePlan,
    at = world.now + 1;
  console.log(`  its plan drawn at High: ${plan.people.length} people, ${ms(t)}`);
  const all = plan.people.flatMap((p, i) =>
      p.ref.startsWith("agent:") && !p.child ? [{ i, ...workOf(plan, i, at) }] : [],
    ),
    order = ["smith", "potter", "weaver", "farmer"],
    chosen =
      all
        .filter((c) => c.far >= 6 && c.far <= 60 && order.includes(c.trade))
        .sort((a, b) => order.indexOf(a.trade) - order.indexOf(b.trade) || a.far - b.far)[0] ??
      all.find((c) => c.far >= 0) ??
      all[0]!;
  t = performance.now();
  const args = takeOf(plan, chosen.i, at)!;
  const takeMs = ms(t);
  const before = size(world);
  t = performance.now();
  world.runTo(world.submit("possess.take", args).t);
  const now = ask<PossessNow>("possess.now");
  console.log(
    `  ${now.name} taken (${now.trade || "no trade"}${now.form ? `, ${now.form}` : ""}; his work ${chosen.far} m off): reckoned on the page in ${takeMs}, ${args.near.length} near, ${args.solids.length / 7} solids, ${args.places.length} places; the command ${ms(t)}`,
  );
  // Walked to his work and set to it, a second at a time, as the page sends it.
  const place = args.places
      .filter((p) => p.kind === WORKS[now.trade])
      .sort(
        (a, b) =>
          Math.hypot(a.x - args.at.x, a.z - args.at.z) -
          Math.hypot(b.x - args.at.x, b.z - args.at.z),
      )[0] ?? { x: args.at.x + 10, z: args.at.z },
    ways = new Map<number, number>(args.near.map((n) => [n.id, n.ways[n.ways.length - 5]!]));
  const inputs: number[] = [],
    stepAsk: number[] = [],
    wholeAsk: number[] = [];
  let live = ask<PossessLive>("possess.live", {}),
    joined = 0;
  for (let s = 0; s < seconds && live && !live.ended; s++) {
    const me = live.bodies[0]!,
      d = Math.hypot(place.x - me.x, place.z - me.z),
      bids: HandBid[] = [];
    for (let k = 0; k < POSSESS_HZ; k++)
      bids.push(
        d > 1.5
          ? {
              mx: Math.round((31 * (place.x - me.x)) / d),
              mz: Math.round((31 * (place.z - me.z)) / d),
              run: d > 5,
              act: 0,
            }
          : { mx: 0, mz: 0, run: false, act: k === 0 && s % 2 === 0 ? HAND_ACT.work : 0 },
      );
    const joins = joinsAt(plan, now.from, live.kept, me, ways);
    for (const j of joins) ways.set(j.id, j.ways[j.ways.length - 5]!);
    joined += joins.length;
    const letters = bids.map(bidLetters).join(""),
      extra = joins.length ? { joins } : {};
    // (The page asks after each step's bid: the host steps on only the new one.)
    t = performance.now();
    for (let k = 1; k <= POSSESS_HZ; k++)
      ask("possess.live", { steps: letters.slice(0, 3 * k), ...extra });
    stepAsk.push((performance.now() - t) / POSSESS_HZ);
    // (And a second's whole, afresh: what an ask costs that cannot go on from the last.)
    t = performance.now();
    possessionAhead(world, populationContext(world).life, letters, joins);
    wholeAsk.push(performance.now() - t);
    t = performance.now();
    world.runTo(world.submit("possess.input", { step: live.kept, steps: letters, ...extra }).t);
    inputs.push(performance.now() - t);
    live = ask<PossessLive>("possess.live", {});
  }
  const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / Math.max(1, xs.length),
    most = (xs: number[]) => Math.max(0, ...xs);
  console.log(
    `  ${inputs.length} seconds walked and worked: ${live?.bodies.length ?? 0} bodies about him at the end (${joined} joined); made ${live?.deeds.made ?? 0}; ` +
      `a second's command ${mean(inputs).toFixed(1)} ms (most ${most(inputs).toFixed(1)}), the small world asked a step at a time ${mean(stepAsk).toFixed(2)} ms a step (most ${most(stepAsk).toFixed(2)}), asked whole ${mean(wholeAsk).toFixed(1)} ms`,
  );
  t = performance.now();
  world.runTo(world.submit("possess.release", { step: live?.kept ?? 0, steps: "" }).t);
  console.log(`  let go in ${ms(t)}; the save ${before} before, ${size(world)} after`);
  // (The hand lifted before the years run on: a great town under it is reckoned one by one.)
  world.runTo(world.submit("hand.lift", {}).t);
}
