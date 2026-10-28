// node tools/name-survey.ts [count=12] [--from 0] [--year 150] [--sample 100] — the names survey
// (Phase 58): the first peopled open worlds from "alien 0" on, each run to a year, and every living
// tongue's words for its world's things: how many each has, how many fall on one word for two things
// (collisions), how many were taken from another people with the thing, how long they run, and how
// often the two most spoken peoples call a thing alike; then a sample of the words, to be read.
import { YEAR, seedFromText } from "../src/kernel/index.ts";
import { generateHomeWorld } from "../src/gen/index.ts";
import { OPEN } from "../src/rules/index.ts";
import { languagesOf } from "../src/sim/index.ts";
import { ALIEN } from "../src/host/planet.ts";
import { lexiconOf } from "../src/host/names.ts";

/** One world's tongues and their words. */
export type NamesRow = {
  readonly seed: string;
  readonly tongues: number;
  readonly families: number;
  /** Words in all its living tongues (an element named by its substance's word not counted twice). */
  readonly words: number;
  /** Two things of one tongue on one word. */
  readonly collisions: number;
  /** Words taken from another people with the thing. */
  readonly taken: number;
  readonly lengths: readonly number[];
  /** Of the things both of its two most spoken tongues name, how many they call alike. */
  readonly alike: number;
  readonly both: number;
  /** A few of its words: the word, what it says, what it is, whose. */
  readonly sample: readonly (readonly [string, string, string, string])[];
};

/** The names of the first `count` peopled open worlds from `from`, each run to `year`. */
export function surveyNames(count: number, from = 0, year = 150, per = 10): NamesRow[] {
  const rows: NamesRow[] = [];
  for (let i = from; rows.length < count && i < from + count * 6; i++) {
    const seed = `alien ${i}`;
    if (!generateHomeWorld(seedFromText(seed), OPEN).life.people) continue;
    const world = ALIEN.build(seedFromText(seed));
    world.runTo(year * YEAR);
    const store = languagesOf(world),
      speakers = store.speakers(),
      living = store
        .all()
        .filter((l) => l.died === null && speakers.get(l.index)?.length)
        .sort(
          (a, b) =>
            (speakers.get(b.index)?.length ?? 0) - (speakers.get(a.index)?.length ?? 0) ||
            a.index - b.index,
        );
    let words = 0,
      collisions = 0,
      taken = 0;
    const lengths: number[] = [],
      sample: (readonly [string, string, string, string])[] = [];
    for (const l of living) {
      const by = lexiconOf(world, l).by,
        seen = new Map<string, string>();
      for (const c of by.values()) {
        if (c.id.startsWith("elem:") && by.get(c.id.slice(5))?.word === c.word) continue;
        words++;
        lengths.push(c.word.length);
        if (c.taken) taken++;
        const was = seen.get(c.word);
        if (was !== undefined && was !== c.id) collisions++;
        seen.set(c.word, c.id);
      }
    }
    // (A few words of each of its first tongues, a thing apart each time.)
    for (const l of living.slice(0, 3)) {
      const all = [...lexiconOf(world, l).by.values()];
      for (let k = 0; k < per / 2 && all.length; k++) {
        const c = all[(k * 37 + l.index * 11) % all.length]!;
        sample.push([c.word, c.gloss, c.id, l.name]);
      }
    }
    let alike = 0,
      both = 0;
    if (living.length >= 2) {
      const a = lexiconOf(world, living[0]!).by,
        b = lexiconOf(world, living[1]!).by;
      for (const [id, c] of a) {
        const d = b.get(id);
        if (!d) continue;
        both++;
        if (d.word === c.word) alike++;
      }
    }
    rows.push({
      seed,
      tongues: living.length,
      families: new Set(living.map((l) => l.family)).size,
      words,
      collisions,
      taken,
      lengths,
      alike,
      both,
      sample,
    });
  }
  return rows;
}

/** The survey in lines: each world's, then all of them together. */
export function nameLines(rows: readonly NamesRow[]): string[] {
  const out: string[] = [],
    pct = (a: number, b: number) => (b ? `${((100 * a) / b).toFixed(1)}%` : "—"),
    at = (xs: readonly number[], q: number) =>
      [...xs].sort((a, b) => a - b)[Math.min(xs.length - 1, Math.floor(q * xs.length))] ?? 0;
  for (const r of rows) {
    const mean = r.lengths.reduce((s, x) => s + x, 0) / Math.max(1, r.lengths.length);
    out.push(
      `${r.seed}: ${r.tongues} tongues of ${r.families} families; ${r.words} words, ${(r.words / Math.max(1, r.tongues)).toFixed(0)} a tongue; collisions ${r.collisions} (${pct(r.collisions, r.words)}); taken ${r.taken} (${pct(r.taken, r.words)}); length ${mean.toFixed(1)} on average, ${at(r.lengths, 0.9)} at the ninetieth, ${Math.max(0, ...r.lengths)} at most; the two most spoken alike on ${r.alike} of ${r.both}`,
    );
  }
  const all = rows.flatMap((r) => r.lengths),
    sum = (f: (r: NamesRow) => number) => rows.reduce((s, r) => s + f(r), 0);
  out.push(
    `all ${rows.length} worlds: ${sum((r) => r.tongues)} tongues, ${sum((r) => r.words)} words; collisions ${sum((r) => r.collisions)} (${pct(
      sum((r) => r.collisions),
      sum((r) => r.words),
    )}); taken ${sum((r) => r.taken)} (${pct(
      sum((r) => r.taken),
      sum((r) => r.words),
    )}); length ${(all.reduce((s, x) => s + x, 0) / Math.max(1, all.length)).toFixed(1)} on average, ${at(all, 0.5)} at the middle, ${at(all, 0.9)} at the ninetieth, ${Math.max(0, ...all)} at most; two peoples alike on ${pct(
      sum((r) => r.alike),
      sum((r) => r.both),
    )} of the things both name`,
  );
  return out;
}

if (import.meta.main) {
  const arg = (name: string, or: number) =>
      process.argv.includes(name) ? Number(process.argv[process.argv.indexOf(name) + 1]) : or,
    count = Number(process.argv[2] && !process.argv[2].startsWith("--") ? process.argv[2] : 12),
    started = performance.now(),
    rows = surveyNames(
      count,
      arg("--from", 0),
      arg("--year", 150),
      arg("--sample", 100) / Math.max(1, count),
    );
  console.log(
    `the names survey: ${rows.length} peopled open worlds (${((performance.now() - started) / 1000).toFixed(0)} s)`,
  );
  for (const line of nameLines(rows)) console.log(`  ${line}`);
  console.log("  a sample of their words:");
  for (const r of rows)
    for (const [word, gloss, id, tongue] of r.sample)
      console.log(`    ${word.padEnd(18)} “${gloss}” — ${id}, in ${tongue} (${r.seed})`);
}
