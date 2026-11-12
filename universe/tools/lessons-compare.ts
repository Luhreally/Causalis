// node tools/lessons-compare.ts <base.json> <lessons.json>: two runs of tools/lessons-tally.ts side by side, a tree without lessons and
// one with. For each seed: what each cause cost in all; for each lesson a land took up, what that cause cost the same land after the year
// it was taken up, in both (each strike's cost, and how many came); and the most quake-struck land and the realm that lost most battles,
// decade by decade. A land is the same land in both; a realm is not (history moves), so a realm is read in its own run only.
import { readFileSync } from "node:fs";

type Loss = [number, number, number];
type Learned = {
  holder: string;
  name: string;
  lesson: string;
  cause: string;
  taken: number;
  from: string | null;
  use: number;
  lost: number;
  dead: number;
  strikes: number;
  beforePerStrike: number;
  sincePerStrike: number | null;
  strikesSince: number;
};
type Run = {
  seed: string;
  year: number;
  ms: number;
  centuries: number[];
  people: number;
  learned: Learned[];
  losses: Record<string, Record<string, Loss[]>>;
};
const [a, b] = process.argv.slice(2).map((f) => JSON.parse(readFileSync(f!, "utf8")) as Run[]);
const sum = (l: Loss[] | undefined, from = -Infinity) =>
  (l ?? []).reduce(
    (s, x) => (x[0] >= from ? { n: s.n + 1, lost: s.lost + x[1], dead: s.dead + x[2] } : s),
    { n: 0, lost: 0, dead: 0 },
  );
for (const runB of b!) {
  const runA = a!.find((r) => r.seed === runB.seed);
  if (!runA) continue;
  console.log(`\n== ${runB.seed}, to year ${runB.year}`);
  console.log(
    `  time: ${runA.ms} ms base, ${runB.ms} ms lessons (${Math.round((runB.ms / runA.ms - 1) * 100)}%); people at the end ${runA.people} base, ${runB.people} lessons`,
  );
  const causes = new Set<string>();
  for (const r of [runA, runB])
    for (const h of Object.values(r.losses)) for (const c of Object.keys(h)) causes.add(c);
  for (const c of [...causes].sort()) {
    const tot = (r: Run) =>
      Object.values(r.losses).reduce(
        (s, h) => {
          const x = sum(h[c]);
          return { n: s.n + x.n, lost: s.lost + x.lost, dead: s.dead + x.dead };
        },
        { n: 0, lost: 0, dead: 0 },
      );
    const x = tot(runA),
      y = tot(runB);
    console.log(
      `  ${c.padEnd(14)} base ${x.n} strikes, ${x.lost} lost, ${x.dead} dead; lessons ${y.n} strikes, ${y.lost} lost, ${y.dead} dead`,
    );
  }
  // Lands that learned: the same land, after the year it took the lesson up.
  const byLesson = new Map<
    string,
    { lands: number; a: ReturnType<typeof sum>; b: ReturnType<typeof sum> }
  >();
  for (const l of runB.learned) {
    if (!l.holder.startsWith("cell:")) continue;
    const after = l.taken + 1,
      x = sum(runA.losses[l.holder]?.[l.cause], after),
      y = sum(runB.losses[l.holder]?.[l.cause], after),
      g = byLesson.get(l.lesson) ?? {
        lands: 0,
        a: { n: 0, lost: 0, dead: 0 },
        b: { n: 0, lost: 0, dead: 0 },
      };
    g.lands++;
    for (const k of ["n", "lost", "dead"] as const) {
      g.a[k] += x[k];
      g.b[k] += y[k];
    }
    byLesson.set(l.lesson, g);
  }
  for (const [lesson, g] of byLesson) {
    const per = (s: ReturnType<typeof sum>) =>
      s.n ? Math.round(((s.lost + s.dead) / s.n) * 10) / 10 : 0;
    console.log(
      `  ${lesson}: ${g.lands} lands; after taking it up: base ${g.a.n} strikes, ${g.a.lost} lost, ${g.a.dead} dead (${per(g.a)} a strike); lessons ${g.b.n} strikes, ${g.b.lost} lost, ${g.b.dead} dead (${per(g.b)} a strike)`,
    );
  }
  // Within the run: before against since, as the people reckon it.
  const judged = runB.learned.filter((l) => l.strikesSince >= 2 && l.beforePerStrike > 0);
  if (judged.length) {
    const lower = judged.filter((l) => (l.sincePerStrike ?? 0) < l.beforePerStrike).length;
    console.log(
      `  judged by their own reckoning: ${lower} of ${judged.length} lessons cost less a strike since`,
    );
  }
  // The most quake-struck land, and the realm that lost the most battles, decade by decade.
  const quaked = Object.entries(runB.losses)
    .filter(([h]) => h.startsWith("cell:"))
    .map(([h, c]) => [h, c.quake?.length ?? 0] as const)
    .sort((x, y) => y[1] - x[1])[0];
  const beaten = Object.entries(runB.losses)
    .filter(([h]) => h.startsWith("pol:"))
    .map(([h, c]) => [h, c["battles lost"]?.length ?? 0] as const)
    .sort((x, y) => y[1] - x[1])[0];
  const decades = (l: Loss[] | undefined) => {
    const m = new Map<number, number>();
    for (const x of l ?? [])
      m.set(Math.floor(x[0] / 50) * 50, (m.get(Math.floor(x[0] / 50) * 50) ?? 0) + x[1] + x[2]);
    return [...m.entries()]
      .sort((p, q) => p[0] - q[0])
      .map(([d, v]) => `${d}:${v}`)
      .join(" ");
  };
  if (quaked) {
    const ls = runB.learned.filter((l) => l.holder === quaked[0]);
    console.log(
      `  most quake-struck: ${quaked[0]} (${quaked[1]} quakes), learned ${ls.map((l) => `${l.lesson} in ${l.taken}${l.from ? ` from ${l.from}` : ""}, use ${l.use}, ${l.beforePerStrike} before, ${l.sincePerStrike} since a strike`).join("; ") || "nothing"}`,
    );
    console.log(
      `    homes+lives lost to quakes by fifty years, base:    ${decades(runA.losses[quaked[0]]?.quake)}`,
    );
    console.log(
      `    homes+lives lost to quakes by fifty years, lessons: ${decades(runB.losses[quaked[0]]?.quake)}`,
    );
  }
  if (beaten) {
    const ls = runB.learned.filter((l) => l.holder === beaten[0]);
    console.log(
      `  most beaten realm: ${ls[0]?.name ?? beaten[0]} (${beaten[1]} battles lost), learned ${ls.map((l) => `${l.lesson} in ${l.taken}, use ${l.use}, ${l.beforePerStrike} before, ${l.sincePerStrike} since a battle`).join("; ") || "nothing"}`,
    );
    console.log(
      `    men lost in battles lost, by fifty years: ${decades(runB.losses[beaten[0]]?.["battles lost"])}`,
    );
    console.log(
      `    men it lost in battles it won:           ${decades(runB.losses[beaten[0]]?.["battles won"])}`,
    );
  }
}
