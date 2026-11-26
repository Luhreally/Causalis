// A town entered, run on two trees side by side (asked 2026-11-26: N7's tick cost won back "with identical behaviour"):
// on a save given, the town nearest so many people put to work by an order, entered, and watched an hour at a time for
// so many days, as a page watches it. Each tree's run says what a tick cost (its first three days, "cold", right after
// entering; the three after, "warm"; and each of the first eight days), and what the place came to: its digest (every
// column of its people, its households, buildings, stocks, sites and log: host/place.ts placeDigest) and a hash of its
// log as told. The two must come to the same, byte for byte; it fails where they do not.
//   node tools/place-ab.ts --save file.save --a <tree>/universe [--b <tree>/universe] [--people 5492] [--days 30]
//     [--runs 1] [--mode managed|steward|watch]
// One tree alone (no --b) is run and said. Each run is a process of its own, so neither tree's code warms the other's.
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";
import { gunzipSync } from "node:zlib";

const argv = process.argv.slice(2),
  arg = (name: string) => {
    const at = argv.indexOf(name);
    return at >= 0 ? argv[at + 1] : undefined;
  };

if (argv[0] === "--child") {
  // One run, in a process of its own: its tree's modules, its save.
  const [, root, saveIn, want0, days0, mode] = argv as string[];
  const at = (p: string) => import(pathToFileURL(root + p).href);
  const k = await at("/src/kernel/index.ts"),
    h = await at("/src/host/planet.ts"),
    sim = await at("/src/sim/index.ts"),
    place = await at("/src/host/place.ts");
  const doc = JSON.parse(gunzipSync(readFileSync(saveIn!)).toString("utf8")),
    id = k.rulesetId(h.EARTH.build(k.seedFromText(doc.seed)), h.EARTH.version),
    want = Number(want0),
    days = Number(days0),
    w = k.loadWorld(doc, (s: unknown) => h.EARTH.build(s), id, { allowRulesetChange: true }).world,
    ctx = sim.populationContext(w),
    town = ctx.settlements
      .all()
      .filter((s: { ref: string; population: number }) => ctx.settlements.held(s.ref) && s.population > 0)
      .reduce((a: { population: number }, b: { population: number }) =>
        Math.abs(b.population - want) < Math.abs(a.population - want) ? b : a,
      );
  w.runTo(w.submit("place.work", { town: town.ref, shares: [600, 100, 200, 100] }).t);
  const t0 = performance.now(),
    p = place.enterPlace(w, town.ref),
    enter = performance.now() - t0;
  if (mode === "steward") p.mode = 2;
  if (mode === "watch") p.mode = 1;
  const spans: number[] = [],
    daily: number[] = [];
  let ticks = 0,
    ms = 0,
    dayMs = 0,
    worst = 0;
  for (let hr = 0; hr < days * 24; hr++) {
    w.runTo(w.now + k.HOUR);
    const t1 = performance.now();
    ticks += place.advancePlace(w, p);
    const took = performance.now() - t1;
    ms += took;
    dayMs += took;
    if (hr < 24) worst = Math.max(worst, took);
    if (hr % 24 === 23 && daily.length < 8) {
      daily.push(dayMs / 144);
      dayMs = 0;
    }
    if (hr === 71 || hr === 143) {
      spans.push(ms / Math.max(1, ticks));
      ticks = 0;
      ms = 0;
    }
  }
  console.log(
    JSON.stringify({
      town: town.population,
      kept: p.people.n,
      enter,
      worst,
      cold: spans[0] ?? null,
      warm: spans[1] ?? null,
      daily,
      digest: place.placeDigest(p),
      log: createHash("sha1").update(JSON.stringify(p.log)).digest("hex").slice(0, 16),
      lines: p.log.length,
      // (What befell it, kind by kind, and what its place came to: --tell says them.)
      happened: Object.fromEntries(
        Object.entries(place.HAP as Record<string, number>)
          .map(([name, what]) => [name, p.log.filter((x: { what: number }) => x.what === what).length])
          .filter(([, n]) => (n as number) > 0),
      ),
      end: p.people.n,
      bytes: (() => {
        const st = new place.PlaceStore();
        st.places.push(p);
        return JSON.stringify(st.save()).length;
      })(),
    }),
  );
  process.exit(0);
}

const save = arg("--save"),
  a = arg("--a"),
  b = arg("--b"),
  people = arg("--people") ?? "5492",
  days = arg("--days") ?? "30",
  runs = Number(arg("--runs") ?? 1),
  mode = arg("--mode") ?? "managed";
if (!save || !a) throw new Error("--save file.save --a <tree>/universe [--b <tree>/universe]");
type Run = {
  town: number;
  kept: number;
  enter: number;
  worst: number;
  cold: number | null;
  warm: number | null;
  daily: number[];
  digest: string;
  log: string;
  lines: number;
  happened: Record<string, number>;
  end: number;
  bytes: number;
};
const self = fileURLToPath(import.meta.url),
  run = (root: string): Run => {
    const r = spawnSync(process.execPath, [self, "--child", root, save, people, days, mode], {
      encoding: "utf8",
      maxBuffer: 1 << 24,
    });
    if (r.status !== 0) throw new Error(`${root}: ${r.stderr}`);
    return JSON.parse(r.stdout.trim().split("\n").at(-1)!) as Run;
  },
  said = (x: number | null) => (x === null ? "-" : x.toFixed(3));
const results = new Map<string, Run[]>();
for (let k = 0; k < runs; k++)
  for (const root of b ? [a, b] : [a]) {
    const r = run(root);
    (results.get(root) ?? results.set(root, []).get(root)!).push(r);
    console.log(
      (argv.includes("--tell")
        ? `${root}: ${r.end} people at the end, its place ${(r.bytes / 1024).toFixed(0)} KB saved; befell: ${Object.entries(r.happened)
            .map(([k, n]) => `${k} ${n}`)
            .join(", ")}
`
        : "") +
      `${root}: town of ${r.town}, kept ${r.kept} (${mode}); entered in ${r.enter.toFixed(0)} ms; first day's worst hour ${r.worst.toFixed(0)} ms; cold ${said(r.cold)} ms, warm ${said(r.warm)} ms a tick; days ${r.daily.map((x) => x.toFixed(2)).join(" ")}; after ${days} days digest ${r.digest}, log ${r.log} (${r.lines} lines)`,
    );
  }
if (b) {
  const ra = results.get(a)!,
    rb = results.get(b)!,
    same = [...ra, ...rb].every((r) => r.digest === ra[0]!.digest && r.log === ra[0]!.log),
    mean = (list: Run[], key: "cold" | "warm") =>
      list.reduce((s, r) => s + (r[key] ?? 0), 0) / list.length;
  console.log(
    `a: cold ${mean(ra, "cold").toFixed(3)}, warm ${mean(ra, "warm").toFixed(3)} ms; b: cold ${mean(rb, "cold").toFixed(3)}, warm ${mean(rb, "warm").toFixed(3)} ms (means of ${runs})`,
  );
  console.log(same ? "the same: digests and logs alike" : "NOT the same");
  process.exit(same ? 0 : 1);
}
