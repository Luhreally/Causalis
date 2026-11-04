// node tools/catalogue.ts <dir> [--out public/catalogue.json] [--table] [--matrix] [--wall <seconds>] [--jobs <n>]
// (The file written is one line: "npm run format" at the repository's root lays it out for its check.)
// The seed catalogue compiled (Phase 65): the raw readings tools/catalogue-run.ts took of each world run in
// full are read through the ages (rules/ages.ts), giving the year each world reached each age and when it
// fell back. No history runs here, so when only how the ages are read changes, the catalogue can be read
// again in seconds. When history changes, tools/catalogue-run.ts is to be run again: until it is, the title
// passes the old file over if its rules' version moved or the bake job found a far year no longer as
// recorded (each world carries marks for that), and a test says so. Prints how a reading ("Can it?")
// stands against the runs ("Does it?"): it fails if a reading ever shut an age a run reached.
import { readFileSync, readdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { seedFromText } from "../src/kernel/index.ts";
import { generateHomeWorld, provinceWorld, worldKindOf } from "../src/gen/index.ts";
import { AGE_LADDER, EARTHLIKE, OPEN, readWorld } from "../src/rules/index.ts";
import { ALIEN, EARTH } from "../src/host/planet.ts";
import {
  RAW_PRINCIPLES,
  ageWorldOf,
  factsOfRaw,
  historyCheck,
  readingMark,
  type RawReading,
} from "../src/host/reading.ts";

const argv = process.argv.slice(2),
  flag = (name: string, otherwise: string) => {
    const at = argv.indexOf(name);
    if (at < 0) return otherwise;
    const [v] = argv.splice(at, 2).slice(1);
    return v!;
  },
  has = (name: string) => {
    const at = argv.indexOf(name);
    if (at >= 0) argv.splice(at, 1);
    return at >= 0;
  },
  out = flag("--out", ""),
  wall = Number(flag("--wall", "0")),
  jobs = Number(flag("--jobs", "0")),
  table = has("--table"),
  matrix = has("--matrix"),
  [dir] = argv;

/** A decline counts as a fall only if the world stays below that age this long (two readings or more). */
const FALL_YEARS = 20;
/** The year a run ends at. */
const LAST_YEAR = 3000;
/** The years each world's record is marked at, to hold a later history to it. */
const MARK_YEARS = [500, 1500, 3000];

type Entry = {
  universe: string;
  seed: string;
  kind: string;
  medium: string;
  lands: number;
  /** The year it first reached each age it reached, by the age's id, and what it called it. */
  ages: Record<string, { year: number; name: string }>;
  /** Each real fall: the year, the age it fell from, the age it fell to, when it came back if it did. */
  falls: { year: number; from: string; to: string; back?: number }[];
  /** Where it stood at its last year. */
  end: { year: number; id: string; name: string };
  /** The check on its history at year 20. */
  check: string;
  /** The checks on what its record holds at years far on. */
  marks: Record<string, string>;
  s: number;
  /** Dips too short to count as falls, for the table. */
  dips: number;
};

const files = readdirSync(dir!).filter((f) => f.endsWith(".done.ndjson")),
  rulesets: Record<string, string> = {},
  versions: Record<string, string> = {},
  entries: Entry[] = [];

const order = (id: string) => AGE_LADDER.findIndex((a) => a.id === id);

for (const file of files) {
  const lines = readFileSync(join(dir!, file), "utf8").trim().split("\n"),
    meta = JSON.parse(lines[0]!) as {
      universe: string;
      seed: string;
      ruleset: string;
      version: string;
    },
    prior = meta.universe === "alien" ? OPEN : EARTHLIKE,
    g = provinceWorld(generateHomeWorld(seedFromText(meta.seed), prior)),
    w = ageWorldOf(g);
  rulesets[meta.universe] = meta.ruleset;
  versions[meta.universe] = meta.version;
  const raws: RawReading[] = [];
  let endLine: { s: number; lore: number[][]; firsts: [string, number][] } | null = null,
    check = "";
  for (const line of lines.slice(1)) {
    const r = JSON.parse(line);
    if (r.end !== undefined) endLine = r;
    else if (r.hashAt !== undefined) check = historyCheck(r.hashes);
    else raws.push(r);
  }
  // When each land came to know each thing.
  const when = new Map<number, Map<string, number>>();
  for (const row of endLine?.lore ?? []) {
    const m = new Map<string, number>();
    for (let i = 1; i < row.length; i += 2) m.set(RAW_PRINCIPLES[row[i]!]!, row[i + 1]!);
    when.set(row[0]!, m);
  }
  const ages: Entry["ages"] = {},
    falls: Entry["falls"] = [];
  let peak = 0,
    dipAt = -1,
    fall: Entry["falls"][number] | null = null,
    dips = 0,
    last: { year: number; id: string; name: string } = { year: 0, id: "bands", name: "Bands" };
  for (const raw of raws) {
    const knew = (cell: number, id: string) => (when.get(cell)?.get(id) ?? Infinity) <= raw.y,
      { lands, facts } = factsOfRaw(raw, g, knew),
      reading = readWorld(lands, facts, w),
      at = order(reading.age.id);
    last = { year: raw.y, id: reading.age.id, name: reading.name };
    // Every rung up to where it stands is passed, even if it leapt them within a decade.
    for (let i = 0; i <= at; i++) {
      const id = AGE_LADDER[i]!.id;
      ages[id] ??= { year: raw.y, name: i === at ? reading.name : AGE_LADDER[i]!.name };
    }
    if (at >= peak) {
      if (fall) fall.back = raw.y;
      fall = null;
      dipAt = -1;
      peak = at;
    } else {
      if (dipAt < 0) {
        dipAt = raw.y;
        dips++;
      }
      if (!fall && raw.y - dipAt >= FALL_YEARS) {
        fall = { year: dipAt, from: AGE_LADDER[peak]!.id, to: reading.age.id };
        falls.push(fall);
      }
    }
  }
  let lands = 0;
  for (let i = 0; i < raws[0]!.l.length; i += 11) if (!(raws[0]!.l[i + 8]! & 8)) lands++;
  entries.push({
    universe: meta.universe,
    seed: meta.seed,
    kind: worldKindOf(g),
    medium: w.medium,
    lands,
    ages,
    falls,
    end: last,
    check,
    marks: Object.fromEntries(
      raws.filter((r) => MARK_YEARS.includes(r.y)).map((r) => [r.y, readingMark(r)]),
    ),
    s: endLine?.s ?? 0,
    dips,
  });
}

entries.sort((a, b) =>
  a.universe === b.universe ? a.seed.localeCompare(b.seed) : a.universe.localeCompare(b.universe),
);

if (table) {
  const ids = AGE_LADDER.map((a) => a.id).slice(1);
  console.log(
    [
      "seed".padEnd(16),
      "kind".padEnd(8),
      "lands",
      ...ids.map((i) => i.slice(0, 6).padStart(6)),
    ].join(" "),
  );
  for (const e of entries) {
    console.log(
      [
        e.seed.padEnd(16),
        `${e.kind.slice(0, 4)}/${e.medium.slice(0, 3)}`.padEnd(8),
        `${e.lands}`.padStart(5),
        ...ids.map((i) => `${e.ages[i]?.year ?? "-"}`.padStart(6)),
        `  end ${e.end.name}`,
        e.falls.length
          ? ` falls ${e.falls.map((f) => `${f.year}:${f.from}>${f.to}`).join(",")}`
          : "",
        e.dips ? ` dips ${e.dips}` : "",
      ].join(" "),
    );
    const names = Object.entries(e.ages)
      .filter(([, a]) => !AGE_LADDER.some((d) => d.name === a.name))
      .map(([id, a]) => `${id}=${a.name}`);
    if (names.length) console.log(`    ${names.join(", ")}`);
  }
}

// Can it? against Does it?: what each world's reading allowed, against what it did in its run.
const ids = AGE_LADDER.map((a) => a.id).slice(1),
  countsOfAges = () =>
    Object.fromEntries(
      ids.map((id) => [
        id,
        { allowed: 0, reached: 0, clear: 0, clearReached: 0, shutReached: 0, shut: 0 },
      ]),
    ),
  agreement = countsOfAges(),
  // (Each universe's own: what a reading is worth differs by what its worlds are, and the title asks of one.)
  agreementOf: Record<string, ReturnType<typeof countsOfAges>> = {},
  wrong: string[] = [];
let readMs = 0;
for (const e of entries) {
  const u = e.universe === "alien" ? ALIEN : EARTH,
    t0 = performance.now(),
    r = u.reading!(seedFromText(e.seed));
  readMs += performance.now() - t0;
  for (const id of ids) {
    const said = r.ages.find((a) => a.id === id),
      reached = !!e.ages[id];
    for (const c of [agreement[id]!, (agreementOf[e.universe] ??= countsOfAges())[id]!]) {
      if (said?.allowed) {
        c.allowed++;
        if (reached) c.reached++;
        if (!said.hard) {
          c.clear++;
          if (reached) c.clearReached++;
        }
      } else {
        c.shut++;
        if (reached) c.shutReached++;
      }
    }
    if (!said?.allowed && reached)
      wrong.push(`${e.seed}: ${id} reached in ${e.ages[id]!.year}, but read as shut: ${said?.why}`);
  }
  if (matrix) {
    const shut = r.ages.find((a) => !a.allowed),
      hard = r.ages.find((a) => a.hard);
    console.log(
      `${e.seed.padEnd(16)} lands ${`${r.lands}`.padStart(3)} allows ${(r.furthest ?? "-").padEnd(12)} reached ${e.end.id.padEnd(12)} ${shut ? `shut: ${shut.why}` : ""} ${hard ? `hard from ${hard.id}` : ""}`,
    );
  }
}
if (matrix) {
  console.log(`age            allowed reached | clear reached | shut shut+reached`);
  let all = 0,
    hits = 0,
    clear = 0,
    clearHits = 0,
    shut = 0;
  for (const id of ids) {
    const c = agreement[id]!;
    all += c.allowed;
    hits += c.reached;
    clear += c.clear;
    clearHits += c.clearReached;
    shut += c.shut;
    console.log(
      `${id.padEnd(14)} ${`${c.allowed}`.padStart(7)} ${`${c.reached}`.padStart(7)} | ${`${c.clear}`.padStart(5)} ${`${c.clearReached}`.padStart(7)} | ${`${c.shut}`.padStart(4)} ${`${c.shutReached}`.padStart(12)}`,
    );
  }
  for (const [universe, of] of Object.entries(agreementOf))
    console.log(
      `${universe}: ${ids
        .slice(4)
        .map(
          (id) =>
            `${id} ${of[id]!.reached}/${of[id]!.allowed} (${of[id]!.clearReached}/${of[id]!.clear})`,
        )
        .join(", ")}`,
    );
  console.log(
    `Allowed that came true by year ${LAST_YEAR}: ${hits}/${all} (${Math.round((100 * hits) / Math.max(1, all))}%); with nothing in the way: ${clearHits}/${clear} (${Math.round((100 * clearHits) / Math.max(1, clear))}%). Shut: ${shut}, of which reached: ${wrong.length}. Read in ${Math.round(readMs / Math.max(1, entries.length))} ms a seed.`,
  );
}
for (const line of wrong) console.log(`WRONG: ${line}`);

if (out) {
  const cpuSeconds = entries.reduce((sum, e) => sum + e.s, 0);
  writeFileSync(
    out,
    `${JSON.stringify({
      rulesets,
      versions,
      lastYear: LAST_YEAR,
      cost: { cpuSeconds, wallSeconds: wall, jobs },
      agreement,
      agreementOf,
      seeds: entries.map(({ dips: _dips, ...e }) => e),
    })}\n`,
  );
  console.log(`${out}: ${entries.length} worlds, ${cpuSeconds} s of work`);
}
if (wrong.length) process.exitCode = 1;
