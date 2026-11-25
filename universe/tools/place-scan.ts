// place-scan.ts [--seed "first light"] [--load save.gz] --to <year> [--from <year>] [--saves dir --every 100] [--out file]
// Town mode's scan: runs a world year by year and writes down, a line each, what threatens its towns by the world's own
// rules (natural fires, quakes, fire from the sky, strikes from the air, sieges, outbreaks, lean years, battles' tallies),
// so that a place can be opened over a real one. Reads only; a save every so many years to start a look from.
import { readFileSync, writeFileSync, appendFileSync, mkdirSync } from "node:fs";
import { gunzipSync, gzipSync } from "node:zlib";
import {
  YEAR,
  loadWorld,
  rulesetId,
  saveWorld,
  seedFromText,
  type World,
} from "../src/kernel/index.ts";
import { heartOf, populationContext, siegesOf, townsOf } from "../src/sim/index.ts";
import { EARTH } from "../src/host/planet.ts";
import { battlesOfYear, townTally } from "../src/host/burials.ts";

const arg = (name: string, or = ""): string => {
  const at = process.argv.indexOf(`--${name}`);
  return at >= 0 ? (process.argv[at + 1] ?? or) : or;
};
const seed = arg("seed", "first light"),
  load = arg("load"),
  to = Number(arg("to", "600")),
  saves = arg("saves"),
  every = Number(arg("every", "100")),
  out = arg("out", "scan.jsonl");
let w: World;
if (load) {
  const doc = JSON.parse(gunzipSync(readFileSync(load)).toString("utf8"));
  w = loadWorld(
    doc,
    (s) => EARTH.build(s),
    rulesetId(EARTH.build(seedFromText(doc.seed)), EARTH.version),
    { allowRulesetChange: true },
  ).world;
} else w = EARTH.build(seedFromText(seed));
const from = Number(arg("from", String(Math.floor(w.now / YEAR))));
if (saves) mkdirSync(saves, { recursive: true });
const put = (o: unknown) => appendFileSync(out, JSON.stringify(o) + "\n");
const counts: Record<string, number> = {};
const t0 = Date.now();
if (w.now < from * YEAR) w.runTo(from * YEAR);
for (let y = from; y < to; y++) {
  const start = w.now;
  w.runTo((y + 1) * YEAR);
  const ctx = populationContext(w),
    cellOfLand = new Map<string, number>(),
    town = (ref: string) => {
      const s = ctx.settlements.get(ref as never);
      return s
        ? {
            ref,
            name: s.name,
            pop: Math.round(s.population),
            cell: s.cell,
            fabric: !!townsOf(w).get(s.ref),
          }
        : { ref };
    };
  for (const s of ctx.settlements.all()) {
    const p = ctx.provinces.get(s.cell);
    if (p) cellOfLand.set(p.ref, s.cell);
  }
  const heart = (cell: number) => {
    const h = heartOf(ctx, cell);
    return h ? town(h.ref) : null;
  };
  const ev = w.events;
  for (let i = ev.count - 1; i >= 0 && ev.at(i).t > start; i--) {
    const e = ev.at(i),
      d = (e.data ?? {}) as Record<string, unknown>,
      yr = +(e.t / YEAR).toFixed(4);
    let kind = "";
    if (e.type === "act.fire" && d.natural) {
      kind = "fire";
      put({
        kind,
        y: yr,
        town: town(e.subjects[0]!),
        homes: d.homes,
        dead: d.dead,
        lot: d.lot,
        id: e.id,
      });
    } else if ((e.type === "act.quake" || e.type === "act.meteor") && d.natural) {
      kind = e.type.slice(4);
      const cell = cellOfLand.get(e.place as string);
      put({
        kind,
        y: yr,
        land: e.place,
        cell,
        heart: cell === undefined ? null : heart(cell),
        dead: d.dead,
        homes: d.homes,
        id: e.id,
      });
    } else if (e.type === "war.strike") {
      kind = "raid";
      put({
        kind,
        y: yr,
        town: town(e.subjects[0]!),
        dead: d.dead,
        homes: d.homes,
        great: d.great,
        rocket: d.rocket,
        id: e.id,
      });
    } else if (e.type === "war.siege") {
      kind = "siege";
      const cell = cellOfLand.get(e.place as string);
      put({
        kind,
        y: yr,
        land: e.place,
        heart: cell === undefined ? null : heart(cell),
        data: d,
        id: e.id,
      });
    } else if (e.type === "health.outbreak") {
      kind = "outbreak";
      const cell = cellOfLand.get(e.place as string);
      if (Number(d.dead) >= 20)
        put({
          kind,
          y: yr,
          land: e.place,
          heart: cell === undefined ? null : heart(cell),
          sickness: d.sickness,
          people: d.people,
          dead: d.dead,
          id: e.id,
        });
    }
    if (kind) counts[kind] = (counts[kind] ?? 0) + 1;
  }
  // Sieges standing at the year's turn.
  const sieges = siegesOf(w);
  if (sieges && !sieges.dormant())
    for (const war of sieges.wars()) {
      const s = sieges.of(war)!;
      put({
        kind: "sieged",
        y: y + 1,
        land: s.land,
        seat: s.seat,
        since: s.since,
        months: s.months,
        heart: heart(s.land),
      });
      counts.sieged = (counts.sieged ?? 0) + 1;
    }
  // Lean years: lands whose food fed fewer than 800 in a thousand.
  let lean = 0,
    lands = 0;
  const seen = new Set<number>();
  for (const s of ctx.settlements.all()) {
    if (seen.has(s.cell) || !ctx.settlements.held(s.ref)) continue;
    seen.add(s.cell);
    const fed = ctx.history.yearsOf(s.cell).at(-1)?.fed ?? 1000;
    lands++;
    if (fed < 800) {
      lean++;
      if (y % 10 === 9) put({ kind: "lean", y: y + 1, cell: s.cell, fed, heart: heart(s.cell) });
    }
  }
  // Battles: towns with fallen.
  for (const { b } of battlesOfYear(w, y)) {
    for (const side of [0, 1] as const)
      for (const l of b.fell?.[side] ?? []) {
        const cell = l[0] as number;
        for (const s of ctx.settlements.seenIn(cell)) {
          const t = townTally(w, b, side, s.ref);
          if (t && t[1] >= 3 && townsOf(w).get(s.ref)) {
            put({
              kind: "battle",
              y,
              event: b.event,
              town: town(s.ref),
              sent: t[0],
              fell: t[1],
              wounded: t[2],
            });
            counts.battle = (counts.battle ?? 0) + 1;
          }
        }
      }
  }
  if ((y + 1) % 25 === 0)
    console.log(
      `year ${y + 1}: ${JSON.stringify(counts)} lean ${lean}/${lands} (${((Date.now() - t0) / 1000).toFixed(0)} s)`,
    );
  if (saves && (y + 1) % every === 0)
    writeFileSync(
      `${saves}/${seed.replace(/\W+/g, "-")}-${y + 1}.save`,
      gzipSync(JSON.stringify(saveWorld(w, rulesetId(w, EARTH.version), { universe: EARTH.name }))),
    );
}
