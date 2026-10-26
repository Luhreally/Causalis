// node tools/phase47-gate.ts [--ci] [--soft] [--shots dir] — the Phase 47 gate (the hunt, M209;
// asked for 2026-10-25: "...work on bringing back og causlisis like town/country game play and sim
// like the depth the og game had ... and just actions of stuff yk"), on the built app, the Earth
// seed three centuries on, in its greatest town with game in its wild and hunters to go after it:
//   1. a hunting day: its hunters out, abreast, creeping in on the herd (stalking);
//   2. the stalk's end: the herd's heads up, the hunters close;
//   3. the rush: the herd running, the hunters thrusting their spears;
//   4. the kill: one brought down and lying where it fell, one fewer in the herd, the hunters
//      about it dressing it;
//   5. home: the kill carried across one's shoulders;
//   6. another day's hunt that brings none down: the herd got away.
// (npm run build first; --soft draws in software, as CI's browser does; --shots keeps a
// picture of each step.)
import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { preview } from "vite";
import { chromium } from "playwright";

const ci = process.argv.includes("--ci"),
  soft = process.argv.includes("--soft"),
  shots = process.argv.includes("--shots")
    ? process.argv[process.argv.indexOf("--shots") + 1]
    : undefined;
const GPU = [
  "--use-angle=d3d11",
  "--ignore-gpu-blocklist",
  "--enable-gpu",
  "--force_high_performance_gpu",
];
const problems: string[] = [];
const say = (line: string) => console.log(`  ${line}`);
const check = (ok: boolean, problem: string) => {
  if (!ok) problems.push(problem);
};
/** How long to wait on what the frames bring: longer where they come slowly. */
const slow = (ms: number) => (ci || soft ? ms * 4 : ms);
console.log("the Phase 47 gate");
if (shots) mkdirSync(shots, { recursive: true });

type Pt = { x: number; z: number };
type Hunt = {
  hunt: { target: Pt; kill: Pt | null } | null;
  game: { x: number; z: number; alert: number; running: boolean; down: Pt | null } | null;
  drawn: { alive: number; dead: number; x: number; z: number; running: boolean } | null;
  hunters: {
    x: number;
    z: number;
    why: string | null;
    task: string | null;
    carry: string | null;
  }[];
};
type Plan = {
  ref: string;
  name: string;
  population: number;
  fields: unknown[];
  people: { occupation: number; child: boolean }[];
  fauna?: { wild: { name: string; niche: string; stock: number }[] } | null;
};

const root = fileURLToPath(new URL("..", import.meta.url)),
  // (CAUSALIS_DIST: a build elsewhere, so that one can be looked at while dist/ is under test.)
  server = await preview({
    root,
    logLevel: "silent",
    preview: { port: 4302, strictPort: false },
    ...(process.env.CAUSALIS_DIST ? { build: { outDir: process.env.CAUSALIS_DIST } } : {}),
  }),
  base = server.resolvedUrls!.local[0]!,
  browser = await chromium.launch({
    args: soft ? ["--use-angle=swiftshader", "--enable-unsafe-swiftshader"] : ci ? [] : GPU,
  });
const errors: string[] = [];
const page = await browser.newPage({ viewport: { width: 1366, height: 800 } });
page.on("pageerror", (e) => errors.push(e.message));
page.on("console", (m) => {
  if (m.type() === "error") errors.push(m.text());
});
const k = <T>(code: string): Promise<T> => page.evaluate(code) as Promise<T>;
const until = async (what: string, ok: () => Promise<boolean>, ms = 60000) => {
  const end = Date.now() + ms;
  while (Date.now() < end) {
    if (await ok().catch(() => false)) return true;
    await page.waitForTimeout(250);
  }
  problems.push(`${what} did not come`);
  return false;
};
const shot = async (name: string) => {
  if (shots) await page.screenshot({ path: join(shots, `${name}.png`) });
};
const hunt = () => k<Hunt | null>(`globalThis.causalis.hunt?.() ?? null`);
const now = () => k<number>(`globalThis.causalis.client.status?.t ?? 0`);
const DAY = 86400,
  HOUR = 3600,
  YEAR = 365 * DAY;
/** On to moment t (the clock held): the host's word of it come, and a few frames drawn there. */
const advance = async (t: number) => {
  await k(`globalThis.causalis.client.advance(${Math.round(t)})`);
  await page
    .waitForFunction((at) => ((globalThis as any).causalis.client.status?.t ?? 0) >= at - 1, t, {
      timeout: slow(20000),
    })
    .catch(() => undefined);
  await page.waitForTimeout(slow(900));
};
/** The eye over a point of the town (metres), so far off (the rig's units: ten metres each). */
const face = async (x: number, z: number, distance = 8) => {
  await k(`globalThis.causalis.faceTown(${x}, ${z}, ${distance})`);
  await page.waitForTimeout(slow(1200));
};
const planOf = (ref: string) =>
  k<Plan>(
    `globalThis.causalis.client.query({ type: "village.plan", args: { ref: ${JSON.stringify(ref)} } })`,
  );
const mean = (ps: Pt[]) => {
  const n = Math.max(1, ps.length);
  return { x: ps.reduce((a, p) => a + p.x, 0) / n, z: ps.reduce((a, p) => a + p.z, 0) / n };
};
const off = (p: Pt, q: Pt) => Math.hypot(p.x - q.x, p.z - q.z);

await page.goto(`${base}?universe=earth&seed=${encodeURIComponent("first light")}&year=300&hold=1`);
await page.waitForFunction(
  () => ((globalThis as any).causalis?.drawn?.() as number) > 0,
  undefined,
  { timeout: 900000 },
);
await k(`globalThis.causalis.setQuality("high")`);
await k(`globalThis.causalis.client.setSpeed(0)`);

// The greatest town with game in its wild and two hunters grown to go after it.
const towns = await k<{ ref: string; name: string; people: number }[]>(
  `globalThis.causalis.client.query({ type: "towns.map" })`,
);
let town: Plan | null = null;
for (const c of [...towns].sort((a, b) => b.people - a.people).slice(0, 80)) {
  const plan = await planOf(c.ref),
    game = plan.fauna?.wild.some(
      (s) => ["grazer", "browser", "great beast"].includes(s.niche) && s.stock > 0.05,
    ),
    hunters = plan.people.filter((p) => p.occupation === 1 && !p.child).length;
  if (game && hunters >= 2) {
    town = plan;
    break;
  }
}
check(!!town, "no town of the Earth seed has game and hunters by year 300");
if (!town) {
  await browser.close();
  await server.close();
  console.log("FAILED:");
  for (const p of problems) console.log(`  - ${p}`);
  process.exit(1);
}
const game = town.fauna!.wild.find((s) => ["grazer", "browser", "great beast"].includes(s.niche))!;
say(`the town: ${town.name} (${town.population}), its game ${game.name}`);
await k(`globalThis.causalis.goTo(${JSON.stringify(town.ref)})`);
await until(`${town.name} drawn`, async () => (await hunt()) !== null, slow(120000));
await k(`globalThis.causalis.client.setSpeed(0)`);

// A hunting day that brings one down, and one that does not: day by day (the clock goes only
// forward), each played through as it comes.
const t0 = await now(),
  d0 = Math.floor(t0 / DAY) + 1;
let killDay = -1,
  missDay = -1;
for (let d = d0; d < d0 + 30 && (killDay < 0 || missDay < 0); d++) {
  await advance(d * DAY + 7 * HOUR);
  const today = (await hunt())?.hunt;
  if (!today || (today.kill ? killDay >= 0 : missDay >= 0)) continue;
  if (today.kill) killDay = d;
  else missDay = d;
  if (d === killDay) {
    // 1. The stalk.
    await advance(d * DAY + 8.8 * HOUR);
    let h = (await hunt())!;
    const target = h.hunt!.target,
      stalking = h.hunters.filter((x) => x.task === "stalk"),
      herd = h.drawn?.alive ?? 0;
    say(
      `the stalk: ${stalking.length} stalking, ${off(mean(stalking), target).toFixed(0)} m off the herd (${herd} of it drawn, alarm ${h.game?.alert.toFixed(2)})`,
    );
    check(stalking.length >= 2, "no hunters stalking the herd");
    check(
      off(mean(stalking), target) > 40 && off(mean(stalking), target) < 140,
      "the hunters not creeping in on the herd",
    );
    check(herd >= 2, "no herd of game drawn");
    check((h.game?.alert ?? 1) < 0.2, "the herd alarmed before the hunters come in");
    await face(mean(stalking).x, mean(stalking).z, 9);
    await shot("1-stalk");
    // 2. The stalk's end: heads up.
    await advance(d * DAY + 9.56 * HOUR);
    h = (await hunt())!;
    const close = h.hunters.filter((x) => x.task === "stalk");
    say(
      `the stalk's end: alarm ${h.game?.alert.toFixed(2)}, the hunters ${off(mean(close), target).toFixed(0)} m off`,
    );
    check((h.game?.alert ?? 0) > 0.5, "the herd's heads not up as the hunters close");
    check(off(mean(close), target) < 45, "the hunters not close at the stalk's end");
    // 3. The rush.
    await advance(d * DAY + 9.605 * HOUR);
    h = (await hunt())!;
    const striking = h.hunters.filter((x) => x.task === "strike");
    say(
      `the rush: the herd running ${h.game?.running} (drawn running ${h.drawn?.running}), ${striking.length} rushing it`,
    );
    check(!!h.game?.running && !!h.drawn?.running, "the herd not running at the rush");
    check(striking.length >= 2, "no hunters rushing the herd");
    await face(target.x, target.z, 10);
    await shot("2-rush");
    // 4. The kill.
    await advance(d * DAY + 10 * HOUR);
    h = (await hunt())!;
    const kill = h.hunt!.kill!,
      about = h.hunters.filter((x) => off(x, kill) < 7),
      dressing = about.filter((x) => x.why === "Dressing the kill");
    say(
      `the kill: ${h.drawn?.dead} lying where it fell, ${h.drawn?.alive} of the herd left (${herd} before); ${about.length} about it, ${dressing.length} dressing it`,
    );
    check(h.drawn?.dead === 1, "the one brought down not lying where it fell");
    check((h.drawn?.alive ?? 0) === herd - 1, "the herd not one fewer");
    check(about.length >= 2 && dressing.length >= 1, "the hunters not about the kill");
    await face(kill.x, kill.z, 5);
    await shot("3-kill");
    // 5. Home with it.
    let carrier: Hunt["hunters"][number] | null = null;
    for (let m = 10.45; m < 12 && !carrier; m += 0.1) {
      await advance(d * DAY + m * HOUR);
      carrier = (await hunt())!.hunters.find((x) => x.carry === "kill") ?? null;
    }
    say(`home: ${carrier ? `“${carrier.why}”` : "no kill carried"}`);
    check(
      !!carrier && /^Carrying the kill to/.test(carrier.why ?? ""),
      "the kill not carried home",
    );
    check(((await hunt())!.drawn?.dead ?? 1) === 0, "the kill still lying where it fell, carried");
    if (carrier) await face(carrier.x, carrier.z, 4);
    await shot("4-carried");
  } else {
    // 6. The herd got away.
    await advance(d * DAY + 10 * HOUR);
    const h = (await hunt())!,
      away = h.hunters.filter((x) => x.why === "The herd got away");
    say(`a hunt without a kill: ${away.length} watching the herd go, ${h.drawn?.dead ?? 0} down`);
    check(away.length >= 2, "the hunters not told the herd got away");
    check((h.drawn?.dead ?? 0) === 0, "one lying down on a day none was brought down");
  }
}

say(
  `hunting days: one bringing one down on day ${killDay - d0}, one without on day ${missDay - d0}`,
);
check(killDay >= 0, "no hunt brought one down in a month");
check(missDay >= 0, "every hunt in a month brought one down");

await browser.close();
await server.close();
if (errors.length) problems.push(...errors.map((e) => `page error: ${e}`));
if (problems.length) {
  console.log("FAILED:");
  for (const p of problems) console.log(`  - ${p}`);
  process.exit(1);
}
console.log("the Phase 47 gate passes");
