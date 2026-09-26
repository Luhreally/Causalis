// node tools/diversity.ts [seeds] [years] [--out file.json] [--lanes n] — the diversity report
// (docs/architecture §I.4, M44): a hundred open-prior worlds ("alien 0" … "alien 99",
// as the app's alien universe makes them), each run for some centuries, and what came
// of each: the people who rose (body, medium, bearing, span), how many they grew to,
// the order they found things in, the houses they built, how their realms armed, and
// whether — and by what power — they reached industry. Then the spread across all of
// them: how many clades and media, how many distinct invention orders, house forms and
// arms, and which paths led to industry. Each world runs in its own process.
import { fork } from "node:child_process";
import { availableParallelism, freemem } from "node:os";
import { writeFileSync } from "node:fs";
import { gzipSync } from "node:zlib";
import { YEAR, rulesetId, saveWorld, seedFromText } from "../src/kernel/index.ts";
import { ALIEN } from "../src/host/planet.ts";
import { PRINCIPLES } from "../src/rules/index.ts";
import {
  designsOf,
  homePlanet,
  languagesOf,
  politiesOf,
  populationContext,
  warsOf,
} from "../src/sim/index.ts";

/** What came of one world. */
export type Survey = {
  readonly seed: string;
  readonly clade: string | null;
  readonly medium: string | null;
  readonly symmetry: string | null;
  readonly manipulators: string | null;
  readonly bearing: string | null;
  readonly span: number;
  readonly years: number;
  /** How many the chronicle opened on, the most the world held, and how many at the end (0: they died out). */
  readonly first: number;
  readonly peak: number;
  readonly people: number;
  readonly lands: number;
  readonly villages: number;
  readonly realms: number;
  readonly wars: number;
  readonly tongues: number;
  /** What they found, in the order they first found it anywhere, with the year. */
  readonly order: readonly (readonly [string, number])[];
  /** Their houses' forms, walls and roofs, and their works' halls: how many lands build each. */
  readonly houses: Readonly<Record<string, number>>;
  readonly works: Readonly<Record<string, number>>;
  /** How their realms arm: arms, guards and mounts, by how many realms carry each. */
  readonly hosts: Readonly<Record<string, number>>;
  /** The first power they came to (its principle and year), if any; and whether without fuel. */
  readonly industry: {
    readonly by: string;
    readonly year: number;
    readonly fuelless: boolean;
  } | null;
  /** What came of them, in a word. */
  readonly outcome: Outcome;
  readonly ms: number;
  /** The slowest year and the 99th percentile of years, ms; the save, compressed, bytes. */
  readonly slowest: number;
  readonly p99: number;
  readonly save: number;
  /** The process's memory at the end, MB. */
  readonly mb: number;
};

export type Outcome = "lifeless" | "died out" | "foragers" | "farmers" | "realms" | "industry";

/** The first-knowledge events that are not principles found. */
const FIRSTS: Readonly<Record<string, string>> = {
  "knowledge.cultivation": "sowing",
  "knowledge.herding": "herding",
  "knowledge.metalworking": "metalworking",
};
const POWER = new Map(
  PRINCIPLES.filter((p) => (p.effects.power ?? 0) > 0).map((p) => [
    p.id,
    (p.effects.renewable ?? 0) > 0,
  ]),
);

const tally = (into: Record<string, number>, key: string) => (into[key] = (into[key] ?? 0) + 1);

/** How many people a world holds now. */
function peopleOf(world: ReturnType<typeof ALIEN.build>): number {
  let n = 0;
  for (const p of populationContext(world).provinces.all()) n += p.total();
  return n;
}

/**
 * Run one open-prior world for some years and say what came of it (or only until its
 * people first come to power, with `untilPower`).
 */
export function survey(seed: string, years: number, untilPower = false): Survey {
  const t0 = performance.now(),
    world = ALIEN.build(seedFromText(seed)),
    body = homePlanet(world).generated.life.people?.body ?? null,
    order: [string, number][] = [],
    seen = new Set<string>(),
    first = peopleOf(world),
    times: number[] = [];
  let peak = first,
    people = first,
    industry: Survey["industry"] = null,
    y = 0;
  while (y < years && !(untilPower && industry)) {
    y++;
    const before = performance.now();
    world.runTo(y * YEAR);
    times.push(performance.now() - before);
    const events = world.events.all(),
      start = (y - 1) * YEAR;
    const found: string[] = [];
    for (let i = events.length - 1; i >= 0 && events[i]!.t >= start; i--) {
      const e = events[i]!,
        what =
          e.type === "lore.found" ? (e.data as { principle: string }).principle : FIRSTS[e.type];
      if (what && !seen.has(what)) found.push(what);
    }
    // In the order found within the year (events are scanned backwards).
    for (const what of found.reverse())
      if (!seen.has(what)) {
        seen.add(what);
        order.push([what, y]);
        if (!industry && POWER.has(what))
          industry = { by: what, year: y, fuelless: POWER.get(what)! };
      }
    if (y % 10 === 0 || y === years) {
      people = peopleOf(world);
      peak = Math.max(peak, people);
      if (!people) break;
    }
  }
  people = peopleOf(world);
  const sorted = [...times].sort((a, b) => a - b),
    save = gzipSync(JSON.stringify(saveWorld(world, rulesetId(world, "diversity")))).length;
  const ctx = populationContext(world),
    designs = designsOf(world),
    houses: Record<string, number> = {},
    works: Record<string, number> = {},
    hosts: Record<string, number> = {};
  let lands = 0;
  for (const p of ctx.provinces.all()) {
    if (!p.total()) continue;
    lands++;
    for (const part of designs.of(p.ref)?.parts ?? []) tally(houses, `${part.role}:${part.id}`);
    for (const part of designs.worksOf(p.ref)?.parts ?? []) tally(works, `${part.role}:${part.id}`);
  }
  const realms = politiesOf(world).living();
  for (const r of realms)
    for (const part of designs.of(r.ref)?.parts ?? []) tally(hosts, `${part.role}:${part.id}`);
  const langs = languagesOf(world),
    speakers = langs.speakers();
  return {
    seed,
    clade: body?.clade ?? null,
    medium: body?.medium ?? null,
    symmetry: body?.symmetry ?? null,
    manipulators: body?.manipulators ?? null,
    bearing: body?.bearing ?? null,
    span: body?.span ?? 0,
    years: y,
    first,
    peak,
    people,
    lands,
    villages: [...ctx.settlements.all()].length,
    realms: realms.length,
    wars: warsOf(world).all().length,
    tongues: langs.all().filter((l) => l.died === null && speakers.get(l.index)?.length).length,
    order,
    houses,
    works,
    hosts,
    industry,
    outcome: !body
      ? "lifeless"
      : !people
        ? "died out"
        : industry
          ? "industry"
          : realms.length
            ? "realms"
            : seen.has("sowing")
              ? "farmers"
              : "foragers",
    ms: Math.round(performance.now() - t0),
    slowest: Math.round(sorted.at(-1) ?? 0),
    p99: Math.round(sorted[Math.floor(sorted.length * 0.99)] ?? 0),
    save,
    mb: Math.round(process.memoryUsage().rss / 1e6),
  };
}

/** The spread across many worlds: how unlike one another they came out. */
export function spread(surveys: readonly Survey[], firstFinds = 8) {
  const distinct = (f: (s: Survey) => string) => new Set(surveys.map(f)).size;
  const main = (r: Readonly<Record<string, number>>, role: string) =>
    Object.entries(r)
      .filter(([k]) => k.startsWith(`${role}:`))
      .sort((a, b) => b[1] - a[1] || (a[0] < b[0] ? -1 : 1))[0]?.[0]
      .slice(role.length + 1) ?? "none";
  const count = (f: (s: Survey) => string) => {
    const out: Record<string, number> = {};
    for (const s of surveys) tally(out, f(s));
    return out;
  };
  return {
    worlds: surveys.length,
    outcomes: count((s) => s.outcome),
    clades: count((s) => s.clade ?? "none"),
    media: count((s) => s.medium ?? "none"),
    lived: surveys.filter((s) => s.people > 0).length,
    orders: distinct((s) =>
      s.order
        .slice(0, firstFinds)
        .map(([w]) => w)
        .join(">"),
    ),
    forms: count((s) => main(s.houses, "form")),
    walls: count((s) => main(s.houses, "walls")),
    arms: count((s) => main(s.hosts, "arm")),
    industry: count((s) => (s.industry ? s.industry.by : "none")),
    /** Worlds whose people are neither two-sided nor of the land, and came to power. */
    otherPaths: surveys
      .filter((s) => s.industry && (s.symmetry !== "bilateral" || s.medium !== "land"))
      .map(
        (s) => `${s.seed} (${s.clade}, ${s.medium}: ${s.industry!.by} in year ${s.industry!.year})`,
      ),
  };
}

/** Survey many worlds, each in its own process. */
export function surveyAll(
  seeds: readonly string[],
  years: number,
  most?: number,
  untilPower = false,
): Promise<Survey[]> {
  const out = new Map<string, Survey>(),
    queue = [...seeds],
    // As many at once as the machine has cores and memory for: a large world nine
    // centuries on holds several gigabytes (twelve lanes at 1.5 GB each ran a 32 GB
    // machine out of memory), so allow three and a half each unless told otherwise.
    lanes = Math.max(
      1,
      Math.min(seeds.length, availableParallelism() - 2, most ?? Math.floor(freemem() / 3.5e9)),
    );
  // A world is begun only while five gigabytes are free: the largest grow to six or seven
  // by their ninth century, and the others already running keep growing.
  const room = (): Promise<void> =>
    freemem() > 5e9
      ? Promise.resolve()
      : new Promise((r) => setTimeout(() => room().then(r), 5000));
  const lane = (): Promise<void> =>
    room().then(
      () =>
        new Promise((done, fail) => {
          const next = queue.shift();
          if (next === undefined) return done();
          const child = fork(
            import.meta.filename,
            ["--one", next, String(years), ...(untilPower ? ["--until-power"] : [])],
            {
              stdio: ["ignore", "pipe", "inherit", "ipc"],
            },
          );
          let text = "";
          child.stdout!.on("data", (d) => (text += d));
          child.on("exit", (code) => {
            if (code !== 0) return fail(new Error(`${next} failed (${code})`));
            out.set(next, JSON.parse(text) as Survey);
            lane().then(done, fail);
          });
        }),
    );
  return Promise.all(Array.from({ length: lanes }, lane)).then(() => seeds.map((s) => out.get(s)!));
}

if (import.meta.main) {
  const args = process.argv.slice(2);
  if (args[0] === "--one") {
    process.stdout.write(
      JSON.stringify(survey(args[1]!, Number(args[2]), args.includes("--until-power"))),
    );
  } else {
    const at = args.indexOf("--out"),
      file = at >= 0 ? args[at + 1] : undefined,
      lanesAt = args.indexOf("--lanes"),
      most = lanesAt >= 0 ? Number(args[lanesAt + 1]) : undefined,
      plain = args.filter(
        (_, i) =>
          (at < 0 || (i !== at && i !== at + 1)) &&
          (lanesAt < 0 || (i !== lanesAt && i !== lanesAt + 1)),
      ),
      seeds = Number(plain[0] ?? 100),
      years = Number(plain[1] ?? 600),
      t0 = performance.now();
    const surveys = await surveyAll(
      Array.from({ length: seeds }, (_, i) => `alien ${i}`),
      years,
      most,
    );
    for (const s of surveys)
      console.log(
        `${s.seed.padEnd(9)} ${(s.clade ?? "-").padEnd(8)} ${(s.medium ?? "-").padEnd(5)} ` +
          `${String(Math.round(s.peak)).padStart(9)} peak ${String(Math.round(s.people)).padStart(9)} now  ` +
          `${String(s.realms).padStart(3)} realms ${String(s.tongues).padStart(3)} tongues  ` +
          `form ${
            Object.keys(s.houses)
              .find((k) => k.startsWith("form:"))
              ?.slice(5) ?? "-"
          }  ` +
          `${s.industry ? `power by ${s.industry.by} in ${s.industry.year}` : "no power"}  ` +
          `first: ${s.order
            .slice(0, 5)
            .map(([w, y]) => `${w}@${y}`)
            .join(" ")}  [${s.outcome}, ${(s.ms / 1000).toFixed(0)} s, ${s.mb} MB]`,
      );
    console.log("");
    console.log(JSON.stringify(spread(surveys), null, 1));
    console.log(
      `\n${seeds} worlds, ${years} years each, in ${((performance.now() - t0) / 1000).toFixed(0)} s`,
    );
    if (file) writeFileSync(file, JSON.stringify(surveys, null, 1));
  }
}
