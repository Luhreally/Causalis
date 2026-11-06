// node tools/l5-rates.ts <save> <universe> [years=100] [off]: a fork of a far save run on: what its courts did, what its
// seats and strife did, and what the courts' own year cost. With `off` the courts' system is switched off: history as it
// was before them, the same save and the same keys.
import { readFileSync } from "node:fs";
import { gunzipSync } from "node:zlib";
import { YEAR, loadWorld, rulesetId, saveWorld, seedFromText } from "../src/kernel/index.ts";
import { ALIEN, EARTH } from "../src/host/planet.ts";
import { courtOf, dangerOf, orderOf, politiesOf, populationContext } from "../src/sim/index.ts";
import { gzipSync } from "node:zlib";

const [file, universe, yearsArg, off] = process.argv.slice(2),
  years = Number(yearsArg ?? 100),
  u = universe === "earth" ? EARTH : ALIEN,
  doc = JSON.parse(gunzipSync(readFileSync(file!)).toString("utf8")) as Parameters<
    typeof loadWorld
  >[0],
  world = loadWorld(doc, (s) => u.build(s), rulesetId(u.build(seedFromText(doc.seed)), u.version), {
    allowRulesetChange: true,
  }).world,
  start = world.now,
  systems = (
    world.scheduler as unknown as {
      systems: { key: string; off: boolean; run: (t: number) => void }[];
    }
  ).systems,
  court = systems.find((s) => s.key === "189.strife.court");
if (!court) throw new Error("no court system");
if (off === "off") court.off = true;
let courtMs = 0;
const was = court.run;
court.run = (t) => {
  const at = performance.now();
  was(t);
  courtMs += performance.now() - at;
};
// (Counted as they are emitted: the log forgets the ordinary, and what it forgets is not what happened.)
const counts: Record<string, number> = {},
  emit = world.events.emit.bind(world.events);
let civilEmitted = 0;
world.events.emit = ((spec: { type: string; data?: { civil?: string } | null }) => {
  counts[spec.type] = (counts[spec.type] ?? 0) + 1;
  if (spec.type === "war.declared" && spec.data?.civil) civilEmitted++;
  return emit(spec as never);
}) as typeof world.events.emit;
const realmsAt = politiesOf(world).living().length,
  started = performance.now();
world.runTo(start + years * YEAR);
const allMs = performance.now() - started;
const realms = politiesOf(world),
  living = realms.living(),
  ended = realms.all().filter((p) => p.ended !== null && p.ended * YEAR >= start),
  lives = ended.map((p) => p.ended! - p.founded),
  store = courtOf(world),
  bytes = gzipSync(JSON.stringify(store?.save() ?? {})).length,
  doc2 = saveWorld(world, rulesetId(world, u.version), { universe: u.name }),
  total = gzipSync(JSON.stringify(doc2)).length,
  courts = store ? [...store.all()] : [],
  keep = [
    "polity.succession",
    "polity.split",
    "strife.coup",
    "strife.foiled",
    "strife.throne",
    "strife.revolution",
    "court.plot",
    "court.seized",
    "court.found",
    "court.claim",
    "court.regency",
    "court.heirdied",
  ],
  civil = civilEmitted;
const ctxNow = populationContext(world),
  scores = courts
    .flatMap((c) => {
      const f = c.figures.find((x) => x.id === c.rival),
        r = politiesOf(world).get(c.realm),
        o = orderOf(world)?.of(c.realm);
      return f && r && o ? [dangerOf(ctxNow, r, c, f, o).score] : [];
    })
    .sort((a, b) => a - b),
  q = (x: number) => +(scores[Math.floor(x * (scores.length - 1))] ?? 0).toFixed(2);
const ages: number[] = [],
  hows: Record<string, number> = {};
for (const e of world.events.all())
  if (e.t >= start && e.type === "polity.succession") {
    const d = e.data as { age?: number; how?: string };
    if (typeof d.age === "number") ages.push(d.age);
    hows[d.how ?? "crown"] = (hows[d.how ?? "crown"] ?? 0) + 1;
  }
console.log(
  JSON.stringify({
    life: {
      bands: ctxNow.life.bands,
      mortality: ctxNow.life.mortality,
      adulthood: ctxNow.life.adulthood,
    },
    meanAge: Math.round(ages.reduce((a, b) => a + b, 0) / Math.max(1, ages.length)),
    hows,
    q: [q(0.1), q(0.5), q(0.9), q(1)],
    seed: doc.seed,
    from: Math.round(start / YEAR),
    years,
    off: off === "off",
    realmsAt,
    realmsEnd: living.length,
    endedIn: ended.length,
    meanLifeOfEnded: lives.length ? Math.round(lives.reduce((a, b) => a + b, 0) / lives.length) : 0,
    msYear: Math.round(allMs / years),
    courtMsYear: +(courtMs / years).toFixed(2),
    share: +((100 * courtMs) / allMs).toFixed(2),
    courtBytes: bytes,
    totalBytes: total,
    courts: courts.length,
    figures: courts.reduce((s, c) => s + c.figures.length, 0),
    heirs: courts.filter((c) => c.heir !== null).length,
    rivals: courts.filter((c) => c.rival !== null).length,
    civil,
    counts: Object.fromEntries(keep.map((k) => [k, counts[k] ?? 0])),
  }),
);
