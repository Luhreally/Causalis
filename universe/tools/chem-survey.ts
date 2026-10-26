// node tools/chem-survey.ts [count=200] [--from 0] [--json out.json] [--no-check] — the chemistry
// survey (Phase 54 C6): the first peopled open worlds from "alien 0" on, each one's bulk classes,
// stone set and native iron, and whether the spread passes the six acceptance checks.
// node tools/chem-survey.ts --iron before.json after.json — the iron delay between two diversity
// runs (tools/diversity.ts 100 900 --out), before and after the heat gate of M222.
import { readFileSync, writeFileSync } from "node:fs";
import {
  generateHomeWorld,
  nativeIronLands,
  provinceWorld,
  worldChemistry,
} from "../src/gen/index.ts";
import { seedFromText } from "../src/kernel/index.ts";
import {
  OPEN,
  SOLAR,
  stonesKey,
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

/** The first `count` peopled open worlds from "alien from" on, each read from what made it. */
export function surveyChemistry(count: number, from = 0): ChemRow[] {
  const rows: ChemRow[] = [];
  for (let i = from; rows.length < count; i++) {
    const seed = `alien ${i}`,
      g = generateHomeWorld(seedFromText(seed), OPEN);
    // A lifeless world has no people to knap its stones or work its iron, so it is not surveyed.
    if (!g.life.people) continue;
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
  if (args.includes("--iron")) {
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
