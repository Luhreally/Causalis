// node tools/lessons-tally.ts <year> <out.json> [seeds...]: what each land and realm lost, cause by cause, year by year, read off the
// events as history writes them (the same reading on any tree, so a tree without lessons can be read beside one with them), and, where
// the tree has them, what was learned: each lesson's holder, when it was taken up and from whom, how far they lean on it, and what
// each strike cost before and since. A seed "earth:<text>" is Earth's prior, any other the open. Compare two runs with
// tools/lessons-compare.ts. Pure reading; it changes nothing.
import { writeFileSync } from "node:fs";
import { YEAR, codeOf, seedFromText, yearOfMoment } from "../src/kernel/index.ts";
import * as rules from "../src/rules/index.ts";
import { EARTHLIKE, OPEN } from "../src/rules/index.ts";
import * as sim from "../src/sim/index.ts";

const [yearArg, out, ...rest] = process.argv.slice(2),
  last = Number(yearArg ?? 800),
  seeds = rest.length ? rest : ["earth:first light"];

type Loss = [year: number, lost: number, dead: number];
const numOf = (d: unknown, k: string) => {
  const v = (d as Record<string, unknown> | null)?.[k];
  return typeof v === "number" ? v : 0;
};
const homesOf = (d: unknown): number => {
  const h = (d as { homes?: unknown } | null)?.homes;
  if (typeof h === "number") return h;
  if (h && typeof h === "object")
    return Object.values(h as Record<string, number>).reduce((a, b) => a + (+b || 0), 0);
  return 0;
};
const report: unknown[] = [];
for (const s of seeds) {
  const earth = s.startsWith("earth:"),
    text = earth ? s.slice(6) : s,
    world = sim.makePopulationWorld(seedFromText(text), {
      prior: earth ? EARTHLIKE : OPEN,
      start: "spread",
    }),
    losses: Record<string, Record<string, Loss[]>> = {},
    add = (holder: string, cause: string, l: Loss) => {
      ((losses[holder] ??= {})[cause] ??= []).push(l);
    };
  let read = 0;
  const t0 = performance.now(),
    centuries: number[] = [];
  let c0 = performance.now();
  for (let y = 1; y <= last; y++) {
    world.runTo(y * YEAR);
    if (y % 100 === 0) {
      centuries.push(Math.round(performance.now() - c0));
      c0 = performance.now();
    }
    const log = world.events;
    let top = read;
    for (let i = log.count - 1; i >= 0; i--) {
      const e = log.at(i),
        code = codeOf(e.id);
      if (code <= read) break;
      if (code > top) top = code;
      const at = yearOfMoment(e.t),
        place = e.place ?? "";
      if (e.type === "act.quake") add(place, "quake", [at, homesOf(e.data), numOf(e.data, "dead")]);
      else if (e.type === "act.fire")
        add(place, "fire", [at, homesOf(e.data), numOf(e.data, "dead")]);
      else if (e.type === "act.flood") add(place, "flood", [at, 0, numOf(e.data, "dead")]);
      else if (e.type === "health.outbreak") add(place, "sickness", [at, 0, numOf(e.data, "dead")]);
      else if (e.type === "people.famine")
        add(place, "famine", [
          at,
          Math.round(numOf(e.data, "people") * (1 - numOf(e.data, "fed") / 1000)),
          0,
        ]);
      else if (e.type === "war.battle") {
        const [, a, b] = e.subjects,
          won = (e.data as { won?: boolean }).won,
          battle = sim
            .warsOf(world)
            .get(e.subjects[0] as never)
            ?.battles.findLast((x) => x.event === e.id);
        if (battle && a && b) {
          add(won ? b : a, "battles lost", [at, battle.fallen[won ? 1 : 0] ?? 0, 0]);
          add(won ? a : b, "battles won", [at, battle.fallen[won ? 0 : 1] ?? 0, 0]);
        }
      }
    }
    read = top;
  }
  const lessons =
      (sim as { lessonsOf?: (w: unknown) => sim.LessonStore | null }).lessonsOf?.(world) ?? null,
    learned: unknown[] = [];
  if (lessons)
    for (const [holder, h] of lessons.holders)
      for (const [id, u] of h.uses) {
        const r = (
            rules as { LESSON_RESPONSE?: ReadonlyMap<string, { cause: string }> }
          ).LESSON_RESPONSE?.get(id),
          m = r ? h.causes.get(r.cause) : undefined;
        learned.push({
          holder,
          name: holder.startsWith("cell:")
            ? `land ${holder.slice(7)}`
            : sim.realmName(sim.politiesOf(world).get(holder as never)!),
          lesson: id,
          cause: r?.cause,
          taken: u.taken,
          from: u.from,
          use: Math.round(sim.useIn(h, id, last) * 100) / 100,
          lost: m ? Math.round(m.lost) : 0,
          dead: m ? Math.round(m.dead) : 0,
          strikes: m?.strikes ?? 0,
          first: m?.first,
          beforePerStrike: Math.round(u.before * 1e6) / 1e6,
          sincePerStrike: u.strikes ? Math.round((u.since / u.strikes) * 1e6) / 1e6 : null,
          strikesSince: u.strikes,
        });
      }
  const ctx = sim.populationContext(world);
  let people = 0;
  for (const p of ctx.provinces.all()) people += p.total();
  const tally = sim.wildOf(world)?.tally ?? null,
    row = {
      seed: s,
      year: last,
      ms: Math.round(performance.now() - t0),
      centuries,
      people,
      wild: tally,
      taken: lessons?.taken ?? null,
      copied: lessons?.copied ?? null,
      learned,
      losses,
    };
  report.push(row);
  console.log(
    JSON.stringify({
      seed: s,
      ms: row.ms,
      centuries,
      people,
      quakes: tally?.quakes,
      quakeDead: tally?.quakeDead,
      fireDead: tally?.fireDead,
      homesLost: tally?.homesLost,
      taken: row.taken,
      copied: row.copied,
      uses: learned.length,
    }),
  );
}
if (out) writeFileSync(out, JSON.stringify(report));
