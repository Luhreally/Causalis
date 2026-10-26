// node tools/war-report.ts run <seed> <years> <out.json> [--root <universe dir>]
// node tools/war-report.ts compare <parent dir> <child dir> [--null <dir>] [--from 2] [--time <dir>]
//
// The battle record measured over a family of seeds (Phase 55 M224: T5 records the parent family,
// T8 measures its levy and losses against it). `run` lives a peopled world (the arms report's: the
// Earthlike prior, the spread start) for `years`, and writes, at each century's end, the world's
// people, its realms' people (their lands on the home world) and the ms so far; and at the end each
// battle side as [year, its own age, its foe's age, fielded, fallen, wounded, maimed, field] (-1
// where a battle does not keep it). A side's age is read from what it bore: none; powder (musket,
// rifle), magazine (repeater, autoloader), machine (automatic); body (claws, mandibles, tusks,
// grapple, shell-darts); else by its arm's stuff, bronze (copper, bronze), iron (iron, steel) or
// stone. It also checks each side's tallies by land and town against its totals (A1). --root runs
// another tree's rules: kernel, rules, gen and sim are imported from there, and they import no
// package, so a worktree without node_modules runs. Reads only: store getters, never of() or
// observer(), so the report never changes the history it reads.
//
// `compare` pools the seeds present in both families (and in the null, with --null), each seed cut
// to its shortest run's years (centuries and battles alike: a deterministic history's first 700
// years are a 700-year run), and prints the parent P, the null N and the child C and their ratios:
// by century from --from (default 2), the battles, the war dead per decade, the people and the
// realms' people; by own age, the fallen against the fielded; the wounded:fallen medians over
// sides with ten fallen or more, before guns and with guns (by the foe's age); the maimed:wounded
// median over sides with twenty wounded or more; the most fallen against the field. Then a PASS,
// FAIL or SKIP line for each acceptance item (docs: phase 55 spec §8.4), and exit code 1 on any
// FAIL. "Within tol" is within max(tol, 1.5 × |N/P − 1|). A wounded side whose wounded fill its
// field (wounded = field − fallen) is capped: A7's bounds hold for the uncapped, with 0.05 of slack
// for rounding (ten fallen or more). A self-compare (the same dir twice) counts only the absolute
// items, A1 and A6–A8; the others are printed and not counted. Run times move with what else the
// machine is doing: --time names the parent's tree run again beside the child's (the same seeds,
// at the same moment, under the same load), and A9 then holds the child's ms within 3% of those,
// unwidened by the null's (timed apart); it also tells whether those runs' battles match P's.
import { mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import type { LandFell } from "../src/rules/index.ts";

/** The ages of arms a side is read in, in the order the report lists them. */
const AGES = ["none", "body", "stone", "bronze", "iron", "powder", "magazine", "machine"] as const;
type Age = (typeof AGES)[number];
/** The ages of powder and shot: a side struck by them was struck "with guns". */
const GUNS: ReadonlySet<Age> = new Set<Age>(["powder", "magazine", "machine"]);
/** The arms a body bears of itself. */
const BODY_ARMS: ReadonlySet<string> = new Set([
  "claws",
  "mandibles",
  "tusks",
  "grapple",
  "shell-darts",
]);
/** The ages A5 reads, bronze to the machine gun. */
const FALLING: readonly Age[] = ["bronze", "iron", "powder", "magazine", "machine"];
/** The most of those in the field that fall (sim/war/fell.ts RISEN_KEPT), where a tree has no fieldOf. */
const RISEN_KEPT = 0.9;

/** A battle side: its year, its own age and its foe's, fielded, fallen, wounded, maimed, its field. */
type Side = readonly [
  year: number,
  own: Age,
  foe: Age,
  fielded: number,
  fallen: number,
  wounded: number,
  maimed: number,
  field: number,
];
/** A century's end: the world's people, its realms' people on the home world, the ms so far. */
type Sample = {
  readonly year: number;
  readonly people: number;
  readonly realmPeople: number;
  readonly ms: number;
};
type Run = {
  readonly seed: string;
  readonly years: number;
  readonly root: string;
  readonly ms: number;
  readonly centuries: readonly Sample[];
  readonly sides: readonly Side[];
  /** The sides whose tallies by land and town were checked against their totals, and those that failed (A1). */
  readonly fell?: { readonly sides: number; readonly bad: number };
};

/** A side's age, from what it bore (null or absent: none). */
function ageOf(bore: readonly [string, string] | null | undefined): Age {
  if (!bore) return "none";
  const [arm, material] = bore;
  if (arm === "musket" || arm === "rifle") return "powder";
  if (arm === "repeater" || arm === "autoloader") return "magazine";
  if (arm === "automatic") return "machine";
  if (BODY_ARMS.has(arm)) return "body";
  if (material === "copper" || material === "bronze") return "bronze";
  if (material === "iron" || material === "steel") return "iron";
  return "stone";
}

/**
 * Whether a side's tallies by land and town hold (A1): its lands sum exactly to its field, fallen
 * and wounded; no land or town gives more dead than it sent, or more hurt than came back; a land's
 * towns are whole triples and never more than the land.
 */
function fellHolds(
  lands: readonly LandFell[],
  field: number,
  fallen: number,
  wounded: number,
): boolean {
  let sent = 0,
    dead = 0,
    hurt = 0;
  const fits = (s: number, d: number, h: number) =>
    s >= 0 && d >= 0 && h >= 0 && d <= s && h <= s - d;
  for (const [, s, d, h, towns] of lands) {
    if (!fits(s, d, h)) return false;
    sent += s;
    dead += d;
    hurt += h;
    if (!towns) continue;
    if (towns.length % 3) return false;
    let ts = 0,
      td = 0,
      th = 0;
    for (let k = 0; k < towns.length; k += 3) {
      const [a, b, c] = [towns[k]!, towns[k + 1]!, towns[k + 2]!];
      if (!fits(a, b, c)) return false;
      ts += a;
      td += b;
      th += c;
    }
    if (ts > s || td > d || th > h) return false;
  }
  return sent === field && dead === fallen && hurt === wounded;
}

async function run(seed: string, years: number, out: string, root: string): Promise<void> {
  const load = async <T>(m: string): Promise<T> =>
    (await import(pathToFileURL(resolve(root, "src", m, "index.ts")).href)) as T;
  const kernel = await load<typeof import("../src/kernel/index.ts")>("kernel"),
    rules = await load<typeof import("../src/rules/index.ts")>("rules"),
    gen = await load<typeof import("../src/gen/index.ts")>("gen"),
    sim = await load<typeof import("../src/sim/index.ts")>("sim"),
    // (A tree before Phase 55 has no fieldOf: the same rule, written here.)
    own = (sim as unknown as Record<string, unknown>).fieldOf,
    fieldOf =
      typeof own === "function"
        ? (own as (fielded: number, fallen: number) => number)
        : (fielded: number, fallen: number) => Math.max(fielded, Math.ceil(fallen / RISEN_KEPT));
  const t0 = performance.now(),
    world = sim.makePopulationWorld(kernel.seedFromText(seed), {
      prior: rules.EARTHLIKE,
      start: "spread",
    }),
    ctx = sim.populationContext(world),
    realms = sim.politiesOf(world),
    centuries: Sample[] = [];
  for (let year = 100; year <= years; year += 100) {
    world.runTo(year * kernel.YEAR);
    let people = 0,
      realmPeople = 0;
    for (const p of ctx.provinces.all()) people += p.total();
    for (const r of realms.living())
      for (const c of r.members)
        if (gen.offworldSite(ctx.generated, c) === null)
          realmPeople += ctx.provinces.get(c)?.total() ?? 0;
    centuries.push({ year, people, realmPeople, ms: Math.round(performance.now() - t0) });
    console.log(
      `"${seed}" year ${year}: ${people} people, ${realmPeople} in realms, ${((performance.now() - t0) / 1000).toFixed(0)} s`,
    );
  }
  if (years % 100) world.runTo(years * kernel.YEAR);
  const ms = Math.round(performance.now() - t0),
    sides: Side[] = [];
  let checked = 0,
    bad = 0;
  for (const w of sim.warsOf(world).all())
    for (const b of w.battles)
      for (const i of [0, 1] as const) {
        const fielded = b.fielded?.[i] ?? -1,
          fallen = b.fallen[i],
          field = fielded >= 0 ? fieldOf(fielded, fallen) : -1,
          wounded = b.wounded?.[i] ?? -1;
        sides.push([
          b.year,
          ageOf(b.bore?.[i]),
          ageOf(b.bore?.[1 - i]),
          fielded,
          fallen,
          wounded,
          b.maimed?.[i] ?? -1,
          field,
        ]);
        if (b.fell) {
          checked++;
          if (!fellHolds(b.fell[i], field, fallen, Math.max(0, wounded))) bad++;
        }
      }
  sides.sort((x, y) => x[0] - y[0]);
  mkdirSync(dirname(resolve(out)), { recursive: true });
  writeFileSync(
    out,
    JSON.stringify({
      seed,
      years,
      root,
      ms,
      centuries,
      sides,
      fell: { sides: checked, bad },
    } satisfies Run),
  );
  console.log(
    `"${seed}" ${years} y in ${(ms / 1000).toFixed(0)} s: ${sides.length / 2} battles, ${checked} sides' tallies checked, ${bad} bad; written to ${out}`,
  );
}

const median = (xs: readonly number[]): number => {
  if (!xs.length) return NaN;
  const s = [...xs].sort((a, b) => a - b),
    mid = s.length >> 1;
  return s.length % 2 ? s[mid]! : (s[mid - 1]! + s[mid]!) / 2;
};
/** C against P: 1 where both are 0; NaN where only P is. */
const ratio = (c: number, p: number): number => (p > 0 ? c / p : c === 0 ? 1 : NaN);
const fix = (x: number, d: number): string => (Number.isFinite(x) ? x.toFixed(d) : "—");
const pad = (s: string, n: number): string => s.padStart(n);

function readFamily(dir: string): Map<string, Run> {
  const runs = new Map<string, Run>();
  for (const f of readdirSync(dir)
    .filter((x) => x.endsWith(".json"))
    .sort()) {
    const r = JSON.parse(readFileSync(join(dir, f), "utf8")) as Run;
    if (typeof r.seed === "string" && Array.isArray(r.sides)) runs.set(r.seed, r);
  }
  return runs;
}

/** What a family's runs come to, pooled over the seeds, each cut to its years. */
type Stats = {
  readonly battles: Map<number, number>;
  readonly dead: Map<number, number>;
  readonly people: Map<number, number>;
  readonly realmPeople: Map<number, number>;
  readonly ages: Map<Age, { fallen: number; fielded: number; n: number }>;
  /** Wounded:fallen of the sides with ten fallen or more, before guns and with guns (by the foe's age). */
  readonly before: number[];
  readonly guns: number[];
  /** The same, of the uncapped sides alone (whose wounded do not fill their field). */
  readonly beforeFree: number[];
  readonly gunsFree: number[];
  /** Sides with ten fallen or more whose wounded do not fill their field; of them, outside the bounds. */
  uncapped: number;
  outside: number;
  capped: number;
  readonly maimed: number[];
  most: number;
  ms: number;
  fell: { sides: number; bad: number } | null;
};

/** A run's ms at a year: its whole run's at its last year, else at the last century's end before. */
function msAt(r: Run, year: number): number {
  if (year >= r.years) return r.ms;
  return r.centuries.filter((c) => c.year <= year).at(-1)?.ms ?? NaN;
}

function statsOf(
  runs: ReadonlyMap<string, Run>,
  cuts: ReadonlyMap<string, number>,
  from: number,
): Stats {
  const s: Stats = {
    battles: new Map(),
    dead: new Map(),
    people: new Map(),
    realmPeople: new Map(),
    ages: new Map(),
    before: [],
    guns: [],
    beforeFree: [],
    gunsFree: [],
    uncapped: 0,
    outside: 0,
    capped: 0,
    maimed: [],
    most: 0,
    ms: 0,
    fell: null,
  };
  const add = (m: Map<number, number>, k: number, v: number) => m.set(k, (m.get(k) ?? 0) + v);
  for (const [seed, cut] of cuts) {
    const r = runs.get(seed)!;
    for (const [year, ownAge, foeAge, fielded, fallen, wounded, maimed, field] of r.sides) {
      if (year >= cut) continue;
      const c = Math.floor(year / 100) + 1;
      add(s.battles, c, 0.5);
      add(s.dead, c, fallen);
      if (field > 0) s.most = Math.max(s.most, fallen / field);
      if (c < from) continue;
      const age = s.ages.get(ownAge) ?? { fallen: 0, fielded: 0, n: 0 };
      if (fielded >= 0) {
        age.fallen += fallen;
        age.fielded += fielded;
        age.n++;
      }
      s.ages.set(ownAge, age);
      if (fallen >= 10 && wounded >= 0) {
        const wf = wounded / fallen;
        (GUNS.has(foeAge) ? s.guns : s.before).push(wf);
        if (field >= 0 && wounded >= field - fallen) s.capped++;
        else {
          (GUNS.has(foeAge) ? s.gunsFree : s.beforeFree).push(wf);
          s.uncapped++;
          if (wf < 1.2 - 0.05 || wf > 4.5 + 0.05) s.outside++;
        }
      }
      if (wounded >= 20 && maimed >= 0) s.maimed.push(maimed / wounded);
    }
    for (const x of r.centuries) {
      if (x.year > cut) continue;
      add(s.people, x.year / 100, x.people);
      add(s.realmPeople, x.year / 100, x.realmPeople);
    }
    s.ms += msAt(r, cut);
    if (r.fell)
      s.fell = { sides: (s.fell?.sides ?? 0) + r.fell.sides, bad: (s.fell?.bad ?? 0) + r.fell.bad };
  }
  return s;
}

type Status = "PASS" | "FAIL" | "SKIP";

function compare(
  parentDir: string,
  childDir: string,
  nullDir: string | null,
  from: number,
  timeDir: string | null = null,
): void {
  const P = readFamily(parentDir),
    C = readFamily(childDir),
    N = nullDir ? readFamily(nullDir) : null,
    // (The parent's tree run again beside the child's, for A9's times.)
    T = timeDir ? readFamily(timeDir) : null,
    self = resolve(parentDir) === resolve(childDir),
    seeds = [...P.keys()].filter((s) => C.has(s) && (!N || N.has(s)) && (!T || T.has(s))).sort(),
    cuts = new Map<string, number>(
      seeds.map((s) => [
        s,
        Math.min(
          P.get(s)!.years,
          C.get(s)!.years,
          N?.get(s)?.years ?? Infinity,
          T?.get(s)?.years ?? Infinity,
        ),
      ]),
    );
  if (!seeds.length) {
    console.error(
      `no seed is in both ${parentDir} and ${childDir}${nullDir ? ` and ${nullDir}` : ""}`,
    );
    process.exitCode = 1;
    return;
  }
  const p = statsOf(P, cuts, from),
    c = statsOf(C, cuts, from),
    n = N ? statsOf(N, cuts, from) : null,
    tm = T ? statsOf(T, cuts, from) : null;
  console.log(
    `war-report compare: P ${parentDir}, C ${childDir}${nullDir ? `, N ${nullDir}` : ""}${timeDir ? `, P re-timed ${timeDir}` : ""}${self ? " (a self-compare: only A1 and A6–A8 count)" : ""}`,
  );
  console.log(
    `seeds ${seeds.map((s) => `"${s}" to ${cuts.get(s)} y`).join(", ")}; centuries from ${from}`,
  );
  const last = Math.max(...[...cuts.values()].map((y) => Math.ceil(y / 100))),
    centuries: number[] = [];
  for (let k = from; k <= last; k++) centuries.push(k);
  // (`sampled`: a table of the centuries' ends, which lists only the centuries the runs reached.)
  const table = (
    title: string,
    get: (s: Stats) => Map<number, number>,
    scale: number,
    d: number,
    sampled = false,
  ) => {
    console.log(
      `\n${title}\n${pad("c", 4)}${pad("P", 12)}${pad("N", 12)}${pad("C", 12)}${pad("C/P", 8)}${pad("N/P", 8)}`,
    );
    let tp = 0,
      tn = 0,
      tc = 0;
    for (const k of centuries) {
      if (sampled && !get(p).has(k)) continue;
      const vp = (get(p).get(k) ?? 0) / scale,
        vc = (get(c).get(k) ?? 0) / scale,
        vn = n ? (get(n).get(k) ?? 0) / scale : NaN;
      tp += vp;
      tc += vc;
      tn += vn;
      console.log(
        `${pad(String(k), 4)}${pad(fix(vp, d), 12)}${pad(fix(vn, d), 12)}${pad(fix(vc, d), 12)}${pad(fix(ratio(vc, vp), 3), 8)}${pad(fix(ratio(vn, vp), 3), 8)}`,
      );
    }
    return { tp, tn, tc };
  };
  const battles = table("battles by century", (s) => s.battles, 1, 0);
  console.log(
    `${pad("all", 4)}${pad(fix(battles.tp, 0), 12)}${pad(fix(battles.tn, 0), 12)}${pad(fix(battles.tc, 0), 12)}${pad(fix(ratio(battles.tc, battles.tp), 3), 8)}${pad(fix(ratio(battles.tn, battles.tp), 3), 8)}`,
  );
  table("war dead per decade, by century", (s) => s.dead, 10, 0);
  table("people at the century's end", (s) => s.people, 1, 0, true);
  table(
    "the realms' people at the century's end (home-world lands)",
    (s) => s.realmPeople,
    1,
    0,
    true,
  );

  console.log(`\nfallen / fielded by own age (%, sides)`);
  const share = (s: Stats, a: Age) => {
    const x = s.ages.get(a);
    return x && x.fielded > 0 ? (100 * x.fallen) / x.fielded : NaN;
  };
  for (const a of AGES) {
    const sides = (s: Stats | null) => s?.ages.get(a)?.n ?? 0;
    if (!sides(p) && !sides(c) && !sides(n)) continue;
    console.log(
      `${a.padEnd(9)} P ${pad(fix(share(p, a), 2), 6)} (${sides(p)})   N ${pad(n ? fix(share(n, a), 2) : "—", 6)} (${sides(n)})   C ${pad(fix(share(c, a), 2), 6)} (${sides(c)})`,
    );
  }
  console.log(`\nwounded:fallen medians, sides with 10 fallen or more, by the foe's age`);
  for (const [name, get] of [
    ["before guns", (s: Stats) => s.before],
    ["with guns", (s: Stats) => s.guns],
    ["before, uncapped", (s: Stats) => s.beforeFree],
    ["with, uncapped", (s: Stats) => s.gunsFree],
  ] as const)
    console.log(
      `${name.padEnd(17)} P ${fix(median(get(p)), 2)} (${get(p).length})   N ${n ? fix(median(get(n)), 2) : "—"} (${n ? get(n).length : 0})   C ${fix(median(get(c)), 2)} (${get(c).length})`,
    );
  for (const [name, s] of [
    ["P", p],
    ["N", n],
    ["C", c],
  ] as const)
    if (s)
      console.log(
        `${name}: ${s.uncapped} uncapped sides, ${s.outside} outside [1.15, 4.55]; ${s.capped} capped (wounded = field − fallen)`,
      );
  console.log(
    `maimed:wounded median, sides with 20 wounded or more: P ${fix(100 * median(p.maimed), 1)}% (${p.maimed.length})   N ${n ? `${fix(100 * median(n.maimed), 1)}% (${n.maimed.length})` : "—"}   C ${fix(100 * median(c.maimed), 1)}% (${c.maimed.length})`,
  );
  console.log(
    `most fallen / field: P ${fix(p.most, 3)}   N ${n ? fix(n.most, 3) : "—"}   C ${fix(c.most, 3)}`,
  );
  console.log(
    `run ms (to the cut): P ${fix(p.ms, 0)}   N ${n ? fix(n.ms, 0) : "—"}   C ${fix(c.ms, 0)}   C/P ${fix(ratio(c.ms, p.ms), 3)}`,
  );
  if (T && tm) {
    // (The same tree, the same seeds: its battles must be P's, side for side, cut alike.)
    const same = seeds.every((s) => {
      const cut = cuts.get(s)!,
        upTo = (r: Run) => JSON.stringify(r.sides.filter((x) => x[0] < cut));
      return upTo(T.get(s)!) === upTo(P.get(s)!);
    });
    console.log(
      `P re-timed beside C: ${fix(tm.ms, 0)} ms   C/P ${fix(ratio(c.ms, tm.ms), 3)}; its battles ${same ? "match" : "DO NOT match"} P's`,
    );
  }

  // The acceptance items (spec §8.4). "Within tol": within max(tol, 1.5 × |N/P − 1|).
  const within = (cv: number, pv: number, nv: number, tol: number) => {
    const allowed = Math.max(
      tol,
      n && Number.isFinite(ratio(nv, pv)) ? 1.5 * Math.abs(ratio(nv, pv) - 1) : 0,
    );
    return { ok: Math.abs(ratio(cv, pv) - 1) <= allowed, allowed };
  };
  const verdicts: { id: string; status: Status; text: string; counted: boolean }[] = [];
  const say = (id: string, status: Status, text: string, absolute: boolean) =>
    verdicts.push({ id, status, text, counted: !self || absolute });

  say(
    "A1",
    !c.fell || !c.fell.sides ? "SKIP" : c.fell.bad ? "FAIL" : "PASS",
    c.fell
      ? `${c.fell.sides} sides' tallies by land and town checked, ${c.fell.bad} not summing exactly`
      : "the runs kept no tallies by land",
    true,
  );
  {
    const bad: string[] = [];
    let measured = 0;
    for (const k of centuries)
      for (const [name, get] of [
        ["realms' people", (s: Stats) => s.realmPeople],
        ["people", (s: Stats) => s.people],
      ] as const) {
        const vp = get(p).get(k),
          vc = get(c).get(k);
        if (vp === undefined || vc === undefined) continue;
        measured++;
        const w = within(vc, vp, n ? (get(n).get(k) ?? NaN) : NaN, 0.02);
        if (!w.ok) bad.push(`${name} c${k} ${fix(ratio(vc, vp), 3)} (±${fix(w.allowed, 3)})`);
      }
    say(
      "A2",
      !measured ? "SKIP" : bad.length ? "FAIL" : "PASS",
      bad.length
        ? bad.join("; ")
        : `people and the realms' people within tol at each century's end`,
      false,
    );
  }
  {
    const w = within(battles.tc, battles.tp, battles.tn, 0.05);
    say(
      "A3",
      battles.tp > 0 ? (w.ok ? "PASS" : "FAIL") : "SKIP",
      `battles C/P ${fix(ratio(battles.tc, battles.tp), 3)} (±${fix(w.allowed, 3)})`,
      false,
    );
  }
  {
    const rs = centuries.map((k) => ratio(c.dead.get(k) ?? 0, p.dead.get(k) ?? 0)),
      bad = rs.filter((x) => !(x >= 0.65 && x <= 1.35));
    say(
      "A4",
      centuries.length ? (bad.length ? "FAIL" : "PASS") : "SKIP",
      `war dead C/P by century ${rs.map((x) => fix(x, 2)).join(" ")} (in [0.65, 1.35])`,
      false,
    );
  }
  {
    const seen = FALLING.filter((a) => (c.ages.get(a)?.n ?? 0) >= 50),
      bad: string[] = [],
      v = (a: Age) => share(c, a);
    for (let k = 1; k < seen.length; k++) {
      const a = seen[k - 1]!,
        b = seen[k]!;
      if (a === "bronze" && b === "iron") {
        if (!(v(b) < v(a))) bad.push(`iron ${fix(v(b), 2)} not below bronze ${fix(v(a), 2)}`);
      } else if (!(v(b) <= v(a) + 0.3))
        bad.push(`${b} ${fix(v(b), 2)} above ${a} ${fix(v(a), 2)} + 0.3`);
    }
    if (seen.includes("bronze") && seen.includes("machine") && !(v("machine") <= 0.6 * v("bronze")))
      bad.push(`machine ${fix(v("machine"), 2)} above 0.6 × bronze ${fix(v("bronze"), 2)}`);
    say(
      "A5",
      seen.length < 2 ? "SKIP" : bad.length ? "FAIL" : "PASS",
      bad.length
        ? bad.join("; ")
        : `${seen.map((a) => `${a} ${fix(v(a), 2)}`).join(" → ")} (ages of 50 sides or more)`,
      false,
    );
  }
  say("A6", c.most <= 0.9 ? "PASS" : "FAIL", `most fallen / field ${fix(c.most, 3)} (≤ 0.9)`, true);
  {
    const b = median(c.before),
      g = median(c.guns),
      bad: string[] = [],
      na: string[] = [];
    if (!c.before.length) na.push("before guns n/a");
    else if (!(b >= 2.5 && b <= 3.5)) bad.push(`before guns ${fix(b, 2)} not in [2.5, 3.5]`);
    if (!c.guns.length) na.push("with guns n/a");
    else if (!(g >= 1.5 && g <= 3)) bad.push(`with guns ${fix(g, 2)} not in [1.5, 3]`);
    if (c.outside) bad.push(`${c.outside} uncapped sides outside [1.2, 4.5]`);
    say(
      "A7",
      !c.before.length && !c.guns.length ? "SKIP" : bad.length ? "FAIL" : "PASS",
      [
        `medians ${fix(b, 2)} before guns, ${fix(g, 2)} with guns; ${c.outside} of ${c.uncapped} uncapped outside`,
        ...bad,
        ...na,
      ].join("; "),
      true,
    );
  }
  {
    const m = median(c.maimed);
    say(
      "A8",
      !c.maimed.length ? "SKIP" : m >= 0.04 && m <= 0.15 ? "PASS" : "FAIL",
      `maimed:wounded median ${fix(100 * m, 1)}% (4–15%)`,
      true,
    );
  }
  {
    // (Against P's tree timed beside C, when given: then the null, timed apart, widens nothing.)
    const base = tm ?? p,
      w = tm
        ? { ok: Math.abs(ratio(c.ms, tm.ms) - 1) <= 0.03, allowed: 0.03 }
        : within(c.ms, p.ms, n?.ms ?? NaN, 0.03);
    say(
      "A9",
      Number.isFinite(base.ms) && base.ms > 0 ? (w.ok ? "PASS" : "FAIL") : "SKIP",
      `run ms C/P${tm ? " (P re-timed beside C)" : ""} ${fix(ratio(c.ms, base.ms), 3)} (±${fix(w.allowed, 3)})`,
      false,
    );
  }
  say(
    "A10",
    "SKIP",
    "not measured here: npm run gate:2 passes, and gate:3 no worse than P's (save ≤ 18 MB gz)",
    false,
  );

  console.log("");
  for (const v of verdicts)
    console.log(`${v.id} ${v.status}${v.counted ? "" : " (not counted)"}: ${v.text}`);
  if (verdicts.some((v) => v.counted && v.status === "FAIL")) process.exitCode = 1;
}

function usage(): void {
  console.error(
    [
      "usage: node tools/war-report.ts run <seed> <years> <out.json> [--root <universe dir>]",
      "       node tools/war-report.ts compare <parent dir> <child dir> [--null <dir>] [--from 2] [--time <dir>]",
    ].join("\n"),
  );
  process.exitCode = 1;
}

const argv = process.argv.slice(2),
  [mode, ...rest] = argv,
  flag = (name: string): string | undefined => {
    const i = rest.indexOf(name);
    return i >= 0 ? rest[i + 1] : undefined;
  },
  positional = rest.filter(
    (a, i) => !a.startsWith("--") && !(i > 0 && rest[i - 1]!.startsWith("--")),
  );
if (mode === "run" && positional.length === 3) {
  const [seed, yearsArg, out] = positional as [string, string, string],
    years = Number(yearsArg),
    root = resolve(flag("--root") ?? fileURLToPath(new URL("..", import.meta.url)));
  if (!Number.isInteger(years) || years < 1) usage();
  else await run(seed, years, out, root);
} else if (mode === "compare" && positional.length === 2) {
  const from = Number(flag("--from") ?? "2");
  if (!Number.isInteger(from) || from < 1) usage();
  else
    compare(positional[0]!, positional[1]!, flag("--null") ?? null, from, flag("--time") ?? null);
} else usage();
