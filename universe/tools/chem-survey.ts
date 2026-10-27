// node tools/chem-survey.ts [count=200] [--from 0] [--json out.json] [--no-check] — the chemistry
// survey (Phase 54 C6): the first peopled open worlds from "alien 0" on, each one's bulk classes,
// stone set and native iron, and whether the spread passes the six acceptance checks.
// node tools/chem-survey.ts --iron before.json after.json — the iron delay between two diversity
// runs (tools/diversity.ts 100 900 --out), before and after the heat gate of M222.
// node tools/chem-survey.ts --kinds [count=500] [--from 0] [--ages years] [--per 3] [--only kind]
// — the kinds survey (Phase 56): each open world's kind, the share of each, life and people in each,
// the named seeds all rocky; with --ages, the ages the first few peopled worlds of each kind reach.
import { readFileSync, writeFileSync } from "node:fs";
import {
  generateHomeWorld,
  makeStar,
  nativeIronLands,
  provinceWorld,
  starAgeGyr,
  worldChemistry,
} from "../src/gen/index.ts";
import { Rng, YEAR, seedFromText } from "../src/kernel/index.ts";
import { makePopulationWorld, populationContext } from "../src/sim/index.ts";
import { landEra } from "../src/host/village.ts";
import {
  NOVEL_KINDS,
  OPEN,
  SOLAR,
  WORLD_KINDS,
  madePrior,
  stonesKey,
  worldKind,
  type WorldKind,
  type AirClass,
  type CarbonClass,
  type Hardener,
  type MetalsClass,
  type Redox,
  type SilicaClass,
} from "../src/rules/index.ts";
import type { Survey } from "./diversity.ts";

/** One peopled open world: its bulk classes, its stone set, and the lands its native iron lies on. */
export type ChemRow = {
  seed: string;
  feH: number;
  cO: number;
  mgSi: number;
  o2: number;
  carbon: CarbonClass;
  metals: MetalsClass;
  silica: SilicaClass;
  air: AirClass;
  redox: Redox;
  hardener: Hardener;
  stones: string;
  nativeLands: number;
};

/** The first `count` peopled rocky open worlds from "alien from" on, each read from what made it. */
export function surveyChemistry(count: number, from = 0): ChemRow[] {
  const rows: ChemRow[] = [];
  for (let i = from; rows.length < count; i++) {
    const seed = `alien ${i}`,
      g = generateHomeWorld(seedFromText(seed), OPEN);
    // A lifeless world has no people to knap its stones or work its iron, so it is not surveyed; nor
    // is a world of another kind (Phase 56), whose chemistry is its kind's: the kinds survey's.
    if (!g.life.people || g.planet.kind) continue;
    const chem = worldChemistry(g);
    rows.push({
      seed,
      feH: chem.feH,
      cO: chem.cO,
      mgSi: chem.mgSi,
      o2: chem.o2,
      carbon: chem.carbon,
      metals: chem.metals,
      silica: chem.silica,
      air: chem.air,
      redox: chem.redox,
      hardener: chem.hardener,
      stones: stonesKey(chem),
      nativeLands: nativeIronLands(provinceWorld(g)).size,
    });
  }
  return rows;
}

const HARDENERS: readonly Hardener[] = ["tin", "arsenic", "nickel"];

/** A class measure: its name, the class each world has, and the values it takes. */
type Measure = {
  readonly name: string;
  readonly of: (r: ChemRow) => string;
  readonly values: readonly string[];
};

/** The class measures, in the order the spec's table lays them out. */
const MEASURES: readonly Measure[] = [
  { name: "hardener", of: (r) => r.hardener, values: HARDENERS },
  { name: "air", of: (r) => r.air, values: ["thin", "solar", "rich"] },
  { name: "metals", of: (r) => r.metals, values: ["poor", "solar", "rich"] },
  { name: "silica", of: (r) => r.silica, values: ["high", "solar", "low"] },
  { name: "carbon", of: (r) => r.carbon, values: ["oxide", "carbon-rich"] },
  { name: "redox", of: (r) => r.redox, values: ["reduced", "oxidised"] },
];

// Shares are whole percents, checked by cross-multiplying, so no float rounding sits on a line.
const atLeast = (k: number, of: number, pct: number) => 100 * k >= pct * of;
const atMost = (k: number, of: number, pct: number) => 100 * k <= pct * of;
const pc = (k: number, of: number) => (of ? `${((100 * k) / of).toFixed(1)}%` : "-");

/** The six acceptance checks over a survey, with the measures laid out as the spec's table is. */
export function acceptance(rows: readonly ChemRow[]): {
  ok: boolean;
  lines: string[];
  problems: string[];
} {
  const n = rows.length;
  if (!n) return { ok: false, lines: [], problems: ["no worlds were surveyed"] };
  const have = (f: (r: ChemRow) => string, v: string) => rows.filter((r) => f(r) === v).length,
    hardener = (h: Hardener) => have((r) => r.hardener, h),
    nonSolar = rows.filter(
      (r) =>
        r.carbon !== SOLAR.carbon ||
        r.metals !== SOLAR.metals ||
        r.silica !== SOLAR.silica ||
        r.air !== SOLAR.air,
    ).length,
    thin = have((r) => r.air, "thin"),
    thinIron = rows.filter((r) => r.air === "thin" && r.nativeLands > 0).length,
    carbonRich = have((r) => r.carbon, "carbon-rich"),
    sets = new Map<string, number>(),
    // Each class with its count and its share.
    cells = (m: Measure) =>
      m.values.map((v) => `${v} ${have(m.of, v)} (${pc(have(m.of, v), n)})`).join("  ");
  for (const r of rows) sets.set(r.stones, (sets.get(r.stones) ?? 0) + 1);
  // The most common sets first; ties by name, so the order is total.
  const setList = [...sets].sort((a, b) => b[1] - a[1] || (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0));
  const lines = [
    `non-solar    ${nonSolar} of ${n} (${pc(nonSolar, n)})`,
    `stone sets   ${sets.size}: ${setList.map(([s, k]) => `${s} ${k}`).join(", ")}`,
    ...MEASURES.map((m) => `${m.name.padEnd(13)}${cells(m)}`),
    `native iron  ${thinIron} of ${thin} thin worlds (${pc(thinIron, thin)})`,
  ];
  const problems: string[] = [];
  // 1. Most worlds are unlike the Sun in some class.
  if (!atLeast(nonSolar, n, 85))
    problems.push(`non-solar worlds are ${pc(nonSolar, n)}, under 85%`);
  // 2. The stones differ enough that peoples knap different rock.
  if (sets.size < 6) problems.push(`${sets.size} stone sets, under 6`);
  // 3. Every hardener is in use.
  const short = HARDENERS.filter((h) => !atLeast(hardener(h), n, 5)),
    shortOf = short.map((h) => `${h} ${pc(hardener(h), n)}`).join(", ");
  if (short.length) problems.push(`hardener under 5%: ${shortOf}`);
  // 4. Thin air is common, and its worlds hold native iron often enough.
  const thinProblems: string[] = [];
  if (!atLeast(thin, n, 10)) thinProblems.push(`thin worlds are ${pc(thin, n)}, under 10%`);
  if (!atLeast(thinIron, thin, 10))
    thinProblems.push(`native iron on ${pc(thinIron, thin)} of thin worlds, under 10%`);
  if (thinProblems.length) problems.push(thinProblems.join("; "));
  // 5. Carbon-rich worlds exist, and stay the rare kind (D3).
  if (carbonRich < 1) problems.push("no carbon-rich world");
  if (!atMost(carbonRich, n, 60))
    problems.push(`carbon-rich worlds are ${pc(carbonRich, n)}, over 60%`);
  // 6. No one class of metals, silica, air, redox or hardener holds over 60% (D3). Carbon is left
  // out: its oxide is the rule, and its carbon-rich share is check 5.
  const over = MEASURES.filter((m) => m.name !== "carbon").flatMap((m) =>
    m.values
      .filter((v) => !atMost(have(m.of, v), n, 60))
      .map((v) => `${m.name} ${v} ${pc(have(m.of, v), n)}`),
  );
  if (over.length) problems.push(`over 60%: ${over.join(", ")}`);
  return { ok: problems.length === 0, lines, problems };
}

/** The year a world first finds iron, or 1000 if it never does (the spec's convention). */
const NEVER = 1000,
  BY = 900;

/** An alien seed's air class, read once per seed. */
const AIR = new Map<string, AirClass>();
function airOf(seed: string): AirClass {
  if (!AIR.has(seed))
    AIR.set(seed, worldChemistry(generateHomeWorld(seedFromText(seed), OPEN)).air);
  return AIR.get(seed)!;
}

const firstIron = (s: Survey): number => s.order.find(([what]) => what === "iron")?.[1] ?? NEVER;

/** The median: the middle value, or the mean of the middle two for an even count; NaN for none. */
function median(xs: readonly number[]): number {
  if (!xs.length) return NaN;
  const s = [...xs].sort((a, b) => a - b),
    mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid]! : (s[mid - 1]! + s[mid]!) / 2;
}

const fmt = (x: number) => (Number.isNaN(x) ? "none" : x.toFixed(1));

// —— The kinds (Phase 56) ——————————————————————————————————————————————————————————————

/**
 * The open seeds the tests and gates name, which must all stay rocky so that each reads the world it
 * was written for (rules/kinds.ts, KIND_KEY).
 */
export const NAMED_SEEDS: readonly string[] = [
  ...[0, 2, 3, 4, 5, 7, 9, 10, 12, 16, 19, 29, 41, 55, 65, 70, 99, 106, 182].map(
    (i) => `alien ${i}`,
  ),
  "violet hollow",
  "violet hollow ~star red",
  "violet hollow ~star white",
  "violet hollow ~pull heavy ~star red",
  "amber",
  "amber 9",
  "amber 9 ~age 3 cool",
  "amber 412",
  "amber 414",
  "alpha",
  "beta",
  "moss",
  "tide",
  "x",
  "x 1",
  "x ~star red",
];

/** A world's kind from its seed alone: its star made as its home world makes it, then its own draws. */
export function kindOfSeed(text: string): WorldKind {
  const star = makeStar(new Rng(seedFromText(text)), madePrior(OPEN, text));
  return worldKind({ text, mass: star.mass, ageGyr: starAgeGyr(star) });
}

/** One open world's kind; for a world of another kind, whether life took hold and a people rose. */
export type KindRow = {
  seed: string;
  kind: WorldKind;
  living: boolean | null;
  peopled: boolean | null;
};

/** The kinds of the open worlds "alien from" to "alien from+count−1" (a rocky one is not made). */
export function surveyKinds(count: number, from = 0): KindRow[] {
  const rows: KindRow[] = [];
  for (let i = from; i < from + count; i++) {
    const seed = `alien ${i}`,
      kind = kindOfSeed(seed);
    if (kind === "rocky") {
      rows.push({ seed, kind, living: null, peopled: null });
      continue;
    }
    const g = generateHomeWorld(seedFromText(seed), OPEN);
    if ((g.planet.kind ?? "rocky") !== kind) throw new Error(`${seed}: its kind is not its seed's`);
    rows.push({ seed, kind, living: g.life.species.length > 0, peopled: !!g.life.people });
  }
  return rows;
}

/** The kinds' shares, life and people, the seeds of each, and the named seeds' check. */
export function kindLines(rows: readonly KindRow[]): { ok: boolean; lines: string[] } {
  const n = rows.length,
    lines = [`${n} open worlds from ${rows[0]?.seed ?? "none"}`],
    problems: string[] = [];
  for (const kind of WORLD_KINDS) {
    const of = rows.filter((r) => r.kind === kind),
      living = of.filter((r) => r.living).length,
      peopled = of.filter((r) => r.peopled).length;
    lines.push(
      kind === "rocky"
        ? `${kind.padEnd(8)} ${of.length} (${pc(of.length, n)})`
        : `${kind.padEnd(8)} ${of.length} (${pc(of.length, n)}): life on ${living}, a people on ${peopled}; ${of.map((r) => r.seed.slice(6) + (r.peopled ? "*" : "")).join(" ")}`,
    );
  }
  // Each kind comes about, and none crowds out the worlds like ours.
  for (const kind of NOVEL_KINDS)
    if (!rows.some((r) => r.kind === kind && r.peopled)) problems.push(`no peopled ${kind} world`);
  const rocky = rows.filter((r) => r.kind === "rocky").length;
  if (!atLeast(rocky, n, 70)) problems.push(`rocky worlds are ${pc(rocky, n)}, under 70%`);
  const named = NAMED_SEEDS.filter((s) => kindOfSeed(s) !== "rocky");
  lines.push(
    named.length
      ? `named seeds not rocky: ${named.join(", ")}`
      : `the ${NAMED_SEEDS.length} named seeds all rocky`,
  );
  if (named.length) problems.push(`named seeds not rocky: ${named.join(", ")}`);
  for (const p of problems) lines.push(`FAIL ${p}`);
  return { ok: problems.length === 0, lines };
}

const ERAS = ["forage", "farm", "metal", "industry", "modern"] as const;

/**
 * The ages a world reaches in so many years: each age the year a land first stood in it, read every
 * twenty-five years as the pages read a land's age (host/village.ts, landEra).
 */
export function agesReached(seed: string, years: number): { era: string; year: number }[] {
  const world = makePopulationWorld(seedFromText(seed), { prior: OPEN, start: "spread" }),
    first = new Map<string, number>();
  for (let y = 25; y <= years; y += 25) {
    world.runTo(y * YEAR);
    for (const p of populationContext(world).provinces.all()) {
      if (!p.total()) continue;
      const era = landEra(world, p.cell);
      for (const e of ERAS.slice(0, ERAS.indexOf(era) + 1)) if (!first.has(e)) first.set(e, y);
    }
  }
  return ERAS.flatMap((era) => (first.has(era) ? [{ era, year: first.get(era)! }] : []));
}

/**
 * The iron delay M222 must buy. Per seed, the years to first iron after less before. The median of
 * the thin-air worlds' delays less the median of the solar-air worlds' is the heat gate's share, not
 * the star's. And the share of worlds finding iron by 900 may fall ten points at most. Seeds that
 * find iron in neither run are left out of the medians.
 */
export function ironDelay(
  before: readonly Survey[],
  after: readonly Survey[],
): { ok: boolean; lines: string[] } {
  const late = new Map(after.map((s) => [s.seed, s] as const)),
    paired = before.flatMap((s) => {
      const t = late.get(s.seed);
      return t ? [{ air: airOf(s.seed), was: firstIron(s), now: firstIron(t) }] : [];
    }),
    moved = paired.filter((p) => p.was < NEVER || p.now < NEVER),
    deltas = (air: AirClass) => moved.filter((p) => p.air === air).map((p) => p.now - p.was),
    thinMed = median(deltas("thin")),
    solarMed = median(deltas("solar")),
    delay = thinMed - solarMed,
    delayOk = delay >= 100;
  const foundBy = (run: readonly Survey[]) => run.filter((s) => firstIron(s) <= BY).length,
    nb = before.length,
    na = after.length,
    fb = foundBy(before),
    fa = foundBy(after),
    // Points the share falls is 100·(fb/nb − fa/na); at most 10 is exact in integers.
    fall = (100 * (fb * na - fa * nb)) / (nb * na),
    shareOk = 100 * (fb * na - fa * nb) <= 10 * nb * na;
  // The plan's own figure: the median first iron of thin worlds less that of solar-air worlds.
  const literal = (run: readonly Survey[]) =>
    median(run.filter((s) => airOf(s.seed) === "thin").map(firstIron)) -
    median(run.filter((s) => airOf(s.seed) === "solar").map(firstIron));
  return {
    ok: delayOk && shareOk,
    lines: [
      `worlds paired       ${paired.length}; ${moved.length} find iron in one run or the other`,
      `median delta thin   ${fmt(thinMed)} years (${deltas("thin").length} worlds)`,
      `median delta solar  ${fmt(solarMed)} years (${deltas("solar").length} worlds)`,
      `iron delay          ${fmt(delay)} years, at least 100: ${delayOk ? "pass" : "FAIL"}`,
      `iron share by ${BY}   ${pc(fb, nb)} before, ${pc(fa, na)} after: falls ${fall.toFixed(1)} points, at most 10: ${shareOk ? "pass" : "FAIL"}`,
      `first iron, thin minus solar air: ${fmt(literal(before))} years before, ${fmt(literal(after))} after`,
    ],
  };
}

if (import.meta.main) {
  const args = process.argv.slice(2),
    value = (name: string) => {
      const at = args.indexOf(name);
      return at >= 0 ? args[at + 1] : undefined;
    };
  if (args.includes("--kinds")) {
    const takes = new Set(["--from", "--ages", "--per", "--only"]),
      plain = args.filter((a, i) => !a.startsWith("--") && !takes.has(args[i - 1] ?? "")),
      t0 = performance.now(),
      rows = surveyKinds(Number(plain[0] ?? 500), Number(value("--from") ?? 0)),
      result = kindLines(rows);
    for (const line of result.lines) console.log(line);
    const years = Number(value("--ages") ?? 0),
      per = Number(value("--per") ?? 3),
      only = value("--only");
    if (years > 0)
      for (const kind of NOVEL_KINDS) {
        if (only && kind !== only) continue;
        for (const r of rows.filter((x) => x.kind === kind && x.peopled).slice(0, per)) {
          const ages = agesReached(r.seed, years);
          console.log(
            `${kind} ${r.seed}: ${ages.map((a) => `${a.era} ${a.year}`).join(", ")} (by year ${years})`,
          );
        }
      }
    console.log(`in ${((performance.now() - t0) / 1000).toFixed(0)} s`);
    if (!result.ok) process.exitCode = 1;
  } else if (args.includes("--iron")) {
    const at = args.indexOf("--iron"),
      read = (file: string | undefined): Survey[] => {
        if (!file) throw new Error("usage: --iron before.json after.json");
        return JSON.parse(readFileSync(file, "utf8")) as Survey[];
      },
      result = ironDelay(read(args[at + 1]), read(args[at + 2]));
    for (const line of result.lines) console.log(line);
    if (!result.ok) process.exitCode = 1;
  } else {
    // The values of --from and --json are not read as the count.
    const takes = new Set(["--from", "--json"]),
      plain = args.filter((a, i) => !a.startsWith("--") && !takes.has(args[i - 1] ?? "")),
      count = Number(plain[0] ?? 200),
      from = Number(value("--from") ?? 0),
      t0 = performance.now(),
      rows = surveyChemistry(count, from),
      result = acceptance(rows);
    for (const line of result.lines) console.log(line);
    console.log(
      `\n${rows.length} peopled worlds from alien ${from} on, in ${((performance.now() - t0) / 1000).toFixed(0)} s`,
    );
    if (!args.includes("--no-check")) {
      if (result.ok) console.log("all six checks pass");
      else {
        for (const p of result.problems) console.log(`FAIL ${p}`);
        process.exitCode = 1;
      }
    }
    const file = value("--json");
    if (file) writeFileSync(file, JSON.stringify(rows, null, 1));
  }
}
