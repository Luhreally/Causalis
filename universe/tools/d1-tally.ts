// node tools/d1-tally.ts [--from file.save] [--universe earth|alien] [--seed text] [--to year] [--step n] [--lines n]: a whole run read for its worst (D1): wars
// per century, how many realms are in the average war and the largest, how long wars last, the share of realms at war in a year, how large realms get,
// how many leagues a world has and how long they hold, how many marriages come to a claim and a claim to a seat, how many called came, what a year costs.
import { readFileSync } from "node:fs";
import { gunzipSync } from "node:zlib";
import {
  YEAR,
  loadWorld,
  rulesetId,
  saveWorld,
  seedFromText,
  type World,
} from "../src/kernel/index.ts";
import { ALIEN, EARTH } from "../src/host/planet.ts";
import { claimOf } from "../src/host/inspect/words.ts";
import {
  TIE_EVENTS,
  politiesOf,
  populationContext,
  tiesOf,
  warsOf,
  type War,
} from "../src/sim/index.ts";

const argv = process.argv.slice(2),
  arg = (name: string) => {
    const at = argv.indexOf(name);
    return at >= 0 ? argv[at + 1] : undefined;
  },
  file = arg("--from"),
  universe = arg("--universe") ?? (file?.includes("earth--") ? "earth" : "alien"),
  u = universe === "earth" ? EARTH : ALIEN,
  seed = arg("--seed") ?? "first light",
  to = Number(arg("--to") ?? 800),
  lines = Number(arg("--lines") ?? 0);
let world: World;
if (file) {
  const doc = JSON.parse(gunzipSync(readFileSync(file)).toString("utf8")) as Parameters<
    typeof loadWorld
  >[0];
  world = loadWorld(doc, (s) => u.build(s), rulesetId(u.build(seedFromText(doc.seed)), u.version), {
    allowRulesetChange: true,
  }).world;
} else world = u.build(seedFromText(seed));
const startYear = Math.floor(world.now / YEAR),
  startedRun = performance.now();
let atWarSum = 0,
  atWarMost = 0,
  largest = 0,
  largestShare = 0,
  yearsRead = 0,
  worstYear = 0,
  worstYearAt = 0,
  realmsSum = 0,
  mostRealms = 0;
for (let y = startYear + 1; y <= to; y++) {
  const y0 = performance.now();
  world.runTo(y * YEAR);
  const ms = performance.now() - y0;
  if (ms > worstYear) {
    worstYear = ms;
    worstYearAt = y;
  }
  const realms = politiesOf(world).living(),
    wars = warsOf(world),
    at = new Set<string>();
  for (const w of wars.hot())
    if (w.ended === null) {
      at.add(w.attacker);
      at.add(w.defender);
    }
  const share = realms.length ? at.size / realms.length : 0;
  atWarSum += share;
  atWarMost = Math.max(atWarMost, share);
  yearsRead++;
  realmsSum += realms.length;
  mostRealms = Math.max(mostRealms, realms.length);
  const total = realms.reduce((s, p) => s + p.members.length, 0);
  for (const p of realms) {
    largest = Math.max(largest, p.members.length);
    if (total) largestShare = Math.max(largestShare, p.members.length / total);
  }
}
const runMs = performance.now() - startedRun,
  store = tiesOf(world),
  wars = warsOf(world).all(),
  mine = wars.filter((w) => w.declared > startYear && !w.civil),
  callOf = (w: War) =>
    (world.events.get(w.event)?.data as { call?: string; aim?: string } | null)?.call,
  sides = new Map<string, number>();
for (const w of mine) {
  const call = callOf(w);
  if (call) sides.set(call, (sides.get(call) ?? 0) + 1);
}
const first = mine.filter((w) => !callOf(w)),
  sizes = first.map((w) => 2 + (sides.get(w.ref) ?? 0)),
  lengths = mine.filter((w) => w.ended !== null).map((w) => w.ended! - w.declared),
  mean = (xs: readonly number[]) =>
    xs.length ? Math.round((xs.reduce((a, b) => a + b, 0) / xs.length) * 100) / 100 : 0;
const all = world.events.all(),
  count = new Map<string, number>(),
  note = (k: string) => count.set(k, (count.get(k) ?? 0) + 1);
for (const e of all) {
  if (e.t <= startYear * YEAR || !e.type.startsWith("ties.")) continue;
  note(e.type);
  const d = e.data as {
    came?: boolean;
    why?: string;
    bond?: string;
    end?: string;
    form?: string;
    errand?: string;
  } | null;
  if (e.type === TIE_EVENTS.answered.type) {
    note(`call:${d?.bond}:${d?.came ? "came" : "not"}`);
    note(`why:${d?.why}`);
  }
  if (e.type === TIE_EVENTS.claim.type) note(`claim:${d?.form}:${d?.end}`);
  if (e.type === TIE_EVENTS.match.type) note(`match:${d?.form}`);
  if (e.type === TIE_EVENTS.envoy.type) note(`envoy:${d?.errand}`);
}
const span = Math.max(1, to - startYear),
  save = JSON.stringify(saveWorld(world, rulesetId(world, u.version), { universe: u.name })).length,
  ties = JSON.stringify(store.save()).length,
  ctx = populationContext(world);
void ctx;
console.log(
  JSON.stringify(
    {
      world: file ?? `${universe} ${seed}`,
      from: startYear,
      to,
      msPerYear: Math.round((runMs / span) * 100) / 100,
      worstYearMs: Math.round(worstYear),
      worstYearAt,
      realmsMean: Math.round(realmsSum / Math.max(1, yearsRead)),
      realmsMost: mostRealms,
      realmsNow: politiesOf(world).living().length,
      warsPerCentury: Math.round((first.length / span) * 1000) / 10,
      calledWarsPerCentury: Math.round(((mine.length - first.length) / span) * 1000) / 10,
      realmsInAWar: mean(sizes),
      realmsInLargest: Math.max(0, ...sizes),
      warYears: mean(lengths),
      warYearsMost: Math.max(0, ...lengths),
      shareAtWar: Math.round((atWarSum / Math.max(1, yearsRead)) * 1000) / 1000,
      shareAtWarMost: Math.round(atWarMost * 1000) / 1000,
      largestRealmLands: largest,
      largestRealmShare: Math.round(largestShare * 1000) / 1000,
      leagues: store.leagues().map((l) => ({
        since: l.since,
        until: l.until,
        members: l.members.length,
        why: l.why,
        share: Math.round(l.share * 1000) / 1000,
      })),
      ties: Object.fromEntries([...count].sort()),
      embassiesNow: store.embassies().length,
      tieBytes: ties,
      saveBytes: save,
    },
    null,
    1,
  ),
);
if (lines) {
  const pick = all.filter(
    (e) =>
      e.t > startYear * YEAR &&
      (e.type.startsWith("ties.") ||
        (e.type === "war.declared" &&
          ["ally", "claim"].includes((e.data as { aim?: string } | null)?.aim ?? ""))),
  );
  const by = new Map<string, typeof pick>();
  for (const e of pick) by.set(e.type, [...(by.get(e.type) ?? []), e]);
  for (const list of by.values()) {
    const step = Math.max(1, Math.floor(list.length / lines));
    for (let i = 0, n = 0; i < list.length && n < lines; i += step, n++)
      console.log(`LINE ${claimOf(world, list[i]!.id)}`);
  }
}
