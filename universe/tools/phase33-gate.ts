// node tools/phase33-gate.ts [--ci] [--soft] [--shots dir] — the Phase 33 gate (a town's feasts
// and market days, as Classic kept its festivals, M174–M175; asked for 2026-10-24: "i cant see the
// cities form and evolve and get that type of detail i got from the og causalisis"), on the built
// app, the Earth seed sixty years on, in its greatest town:
//   1. the feasts it keeps: the harvest home where its land is fed, its faith's holy day (a peace
//      its realm made, its ruler crowned);
//   2. on a feast day the square dressed from the morning — bunting, the tables — and the bar
//      telling the feast by its sign; the work put down by mid-afternoon; at dusk the bonfire
//      lit, the town at the tables and dancing in a ring about the fire, the ring going round (a
//      feast a downpour has the town in out of passed over for the next, the bar telling it);
//   3. the next morning the square cleared;
//   4. a market day: the stalls standing of a morning, traders behind them and buyers before
//      them, the bar telling it; packed away by evening.
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
console.log("the Phase 33 gate");
if (shots) mkdirSync(shots, { recursive: true });

type Square = Record<string, number> & { words: string; feasts: number };
type Person = { name: string; x: number; z: number; activity: number; task: string | null };
type Feast = { day: number; occasion: string; words: string };
type Plan = {
  name: string;
  seed: number;
  market: boolean;
  town?: unknown;
  life?: { feasts?: Feast[] };
};

const root = fileURLToPath(new URL("..", import.meta.url)),
  server = await preview({ root, logLevel: "silent", preview: { port: 4285, strictPort: false } }),
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
    if (await ok()) return true;
    await page.waitForTimeout(250);
  }
  problems.push(`${what} did not come`);
  return false;
};
const shot = async (name: string) => {
  if (shots) await page.screenshot({ path: join(shots, `${name}.png`) });
};
const square = () => k<Square | null>(`globalThis.causalis.feast?.() ?? null`);
const people = () => k<Person[]>(`globalThis.causalis.peopleNow?.() ?? []`);
const mark = () =>
  k<string>(
    `[...document.querySelectorAll(".panel:not([hidden]) .weather-mark")].find((e) => !e.hidden)?.textContent ?? ""`,
  );
const planOf = (ref: string) =>
  k<Plan>(
    `globalThis.causalis.client.query({ type: "village.plan", args: { ref: ${JSON.stringify(ref)} } })`,
  );
const YEAR = 365 * 86400,
  DAY = 86400,
  HOUR = 3600;
/** The ring's fire in this square (view/feast.ts: drawn in nearer where the square is a village's). */
const fireOf = (p: Plan) => (p.town ? { x: -9, z: -2 } : { x: -9 * 0.65, z: -2 * 0.65 });
/** On to moment t (the clock held), kept as the last moment gone to. */
let last = 0;
const advance = async (t: number) => {
  last = t;
  await k(`globalThis.causalis.client.advance(${t})`);
};

await page.goto(`${base}?universe=earth&seed=${encodeURIComponent("first light")}`);
await page.waitForFunction(
  () => ((globalThis as any).causalis?.drawn?.() as number) > 0,
  undefined,
  { timeout: 900000 },
);
await k(`globalThis.causalis.setQuality("balanced")`);
await k(`globalThis.causalis.client.setSpeed(0)`);
const start = 60 * YEAR + 100 * DAY + 11 * HOUR;
await advance(start);
const towns = await k<{ ref: string; name: string; people: number }[]>(
  `globalThis.causalis.client.query({ type: "towns.map" })`,
);
const town = towns[0]!;
await k(`globalThis.causalis.goTo(${JSON.stringify(town.ref)})`);
const entered = await until(
  `${town.name}'s square`,
  async () => ((await square())?.feasts ?? 0) > 0,
  slow(120000),
);
await k(`globalThis.causalis.client.setSpeed(0)`);
check(entered, "the town keeps no feasts");

// 1. The feasts it keeps.
const plan = await planOf(town.ref),
  feasts = plan.life?.feasts ?? [],
  today = Math.floor(start / DAY);
say(
  `${town.name} (${town.people}) keeps: ${feasts.map((f) => `${f.words} (year ${Math.floor(f.day / 365)}, day ${f.day % 365})`).join("; ")}`,
);
check(
  feasts.some((f) => f.occasion === "harvest"),
  "no harvest home kept in the greatest town",
);
const ahead = feasts.filter((f) => f.day > today).sort((a, b) => a.day - b.day);
check(ahead.length > 0, "no feast to come");

// (The eye over the square.)
const overSquare = async (x: number, z: number, distance: number, pitch: number) => {
  await k(
    `globalThis.causalis.rig.flyTo({ target: { x: ${x * 0.1}, y: 0, z: ${z * 0.1} }, distance: ${distance}, pitch: ${pitch}, yaw: 200 })`,
  );
  await page.waitForTimeout(slow(2500));
};
/** Whether `ok` comes within `ms` (not a problem if not: the caller judges). */
const soon = async (ok: () => Promise<boolean>, ms: number) => {
  const end = Date.now() + ms;
  while (Date.now() < end) {
    if (await ok()) return true;
    await page.waitForTimeout(250);
  }
  return false;
};
/** Whether a downpour has the town in out of it now (those at their ease gone in: Phase 30). */
const wet = async () => {
  await page.waitForTimeout(slow(1500));
  return (
    ((await k<{ sheltered: number } | null>(`globalThis.causalis.weather?.() ?? null`))
      ?.sheltered ?? 0) > 0
  );
};

// 2. A feast day: the square dressed by the morning, the bar telling it; the work put down by
// mid-afternoon; at dusk the fire lit, the town at the tables and in the ring, the ring going round.
// (A feast a downpour has the town in out of is passed over for the next, as a wet market day is,
// the bar saying so.)
let feast: (typeof ahead)[number] | null = null;
const rained: string[] = [];
for (const f of ahead.slice(0, 4)) {
  const fails: string[] = [],
    need = (ok: boolean, what: string) => {
      if (!ok) fails.push(what);
    };
  await advance(f.day * DAY + 10 * HOUR);
  const dressed = await soon(async () => (await square())?.feast === 1, slow(30000));
  await overSquare(2, 4, 6, -32);
  const morning = (await square()) ?? ({} as Square),
    told = await mark(),
    wetMorning = await wet();
  need(dressed, "the square dressed for the feast did not come");
  need((morning.flags ?? 0) >= 20 && morning.tables === 2, "the square not dressed");
  need(morning.lit === 0, "the bonfire lit in the morning");
  need(/🎉/.test(told), `the bar does not tell the feast (“${told}”)`);
  await shot("1-feast-morning");

  // The work put down by mid-afternoon.
  await advance(f.day * DAY + 16 * HOUR);
  await page.waitForTimeout(slow(1500));
  const afternoon = await people(),
    working = afternoon.filter((p) => p.activity === 3).length,
    wetAfternoon = await wet();
  need(working === 0, `${working} still at work on the feast's afternoon`);

  // At dusk the fire lit, the town at the tables and in the ring.
  await advance(f.day * DAY + 20.5 * HOUR);
  const wetEvening = await wet();
  if (wetMorning || wetAfternoon || wetEvening) {
    // (In out of the downpour, the bar telling it: the feast waits on the rain.)
    const words = (await square())?.words ?? "";
    say(
      `${f.words}, day ${f.day % 365}: rained off (${[wetMorning && "morning", wetAfternoon && "afternoon", wetEvening && "evening"].filter(Boolean).join(", ")}); the bar “${words}”`,
    );
    if (wetEvening)
      check(
        /in out of the downpour/.test(words),
        `the bar does not tell the town in out of the downpour (“${words}”)`,
      );
    rained.push(`day ${f.day % 365}`);
    continue;
  }
  say(
    `${f.words}, the morning: ${morning.flags} flags strung, ${morning.tables} tables, fire ${morning.lit ? "lit" : "laid"}; the bar “${told}” — “${morning.words}”`,
  );
  need(/the town feasts in its square/.test(morning.words), "the feast's words not told");
  say(`the afternoon: ${working} of ${afternoon.length} seen at work`);
  const lit = await soon(async () => {
    const s = await square(),
      p = await people();
    return s?.lit === 1 && p.filter((q) => q.activity === 9).length >= 6;
  }, slow(30000));
  const fire = fireOf(plan);
  await overSquare(fire.x + 6, fire.z + 4, 4.5, -26);
  const evening = await people(),
    dancing = evening.filter((p) => p.task === "dance"),
    eating = evening.filter((p) => p.task === "feast");
  const ringR = (p: Person) => Math.hypot(p.x - fire.x, p.z - fire.z);
  say(
    `the evening: ${dancing.length} dancing (${dancing.map((p) => ringR(p).toFixed(1)).join(", ")} m from the fire), ${eating.length} at the tables, of ${evening.length} out`,
  );
  need(lit, "the feast's evening did not come");
  need(dancing.length >= 2 && eating.length >= 2, "the town not at the tables and in the ring");
  need(
    dancing.filter((p) => ringR(p) < 9).length >= dancing.length / 2,
    "the dancers not about the fire",
  );
  await shot("2-feast-night");
  // (The ring goes round by the screen's clock, the world's clock held.)
  const before = new Map(dancing.map((p) => [p.name, p]));
  await page.waitForTimeout(slow(2500));
  const moved = (await people()).filter((p) => {
    const b = before.get(p.name);
    return p.task === "dance" && b && Math.hypot(p.x - b.x, p.z - b.z) > 0.4;
  }).length;
  say(`the ring going round: ${moved} of ${dancing.length} dancers moved on`);
  need(moved >= Math.min(2, dancing.length), "the ring does not go round");
  for (const x of fails) check(false, x);
  feast = f;
  break;
}
check(!!feast, `no feast of the next ${Math.min(4, ahead.length)} kept dry (${rained.join(", ")})`);

if (feast) {
  // 3. The next morning, the square cleared.
  await advance((feast.day + 1) * DAY + 10 * HOUR);
  const cleared = await until(
    "the square cleared the next morning",
    async () => (await square())?.feast === 0,
    slow(30000),
  );
  check(cleared, "the square still dressed the next day");
}

// 4. A market day, in the greatest town that keeps a market.
{
  let market: { ref: string; name: string; plan: Plan } | null = null;
  for (const t of towns.slice(0, 12)) {
    const p = t.ref === town.ref ? plan : await planOf(t.ref);
    if (p.market) {
      market = { ref: t.ref, name: t.name, plan: p };
      break;
    }
  }
  check(!!market, "none of the greatest towns keeps a market");
  if (market) {
    const feastDays = new Set((market.plan.life?.feasts ?? []).map((f) => f.day)),
      marketDayFrom = (from: number) => {
        let d = from;
        while ((d + (market.plan.seed % 7)) % 7 !== 3 || feastDays.has(d)) d++;
        return d;
      };
    // (A dry market morning: in a downpour those come to buy go home out of it.)
    let day = marketDayFrom(Math.floor(last / DAY) + 1),
      standing = false,
      wet = "";
    for (let tries = 0; tries < 6; tries++) {
      await advance(day * DAY + 9.5 * HOUR);
      if (!tries && market.ref !== town.ref) {
        await k(`globalThis.causalis.goTo(${JSON.stringify(market.ref)})`);
        await k(`globalThis.causalis.client.setSpeed(0)`);
      }
      standing = await until(
        `${market.name}'s market`,
        async () => (await square())?.market === 1,
        slow(tries ? 30000 : 120000),
      );
      const rain = await k<number>(`globalThis.causalis.weather?.()?.rain ?? 0`);
      if (!standing || rain < 0.3) break;
      wet += `${wet ? ", " : ""}day ${day % 365} (rain ${rain.toFixed(2)})`;
      day = marketDayFrom(day + 1);
    }
    if (wet) say(`market days in the rain, passed over: ${wet}`);
    await overSquare(0, 0, 4.5, -38);
    await page.waitForTimeout(slow(1500));
    const s = (await square()) ?? ({} as Square),
      folk = await people(),
      buying = folk.filter((p) => p.task === "haggle" && p.activity === 7).length,
      selling = folk.filter((p) => p.task === "haggle" && p.activity === 3).length,
      told = await mark();
    say(
      `${market.name}'s market day: ${s.stalls} stalls; ${selling} keeping them, ${buying} buying; the bar “${told}” — “${s.words}”`,
    );
    check(standing && (s.stalls ?? 0) >= 6, "the market's stalls not standing");
    check(buying >= 1, "no one buying at the stalls");
    check(/🛒/.test(told) && /Market day/.test(s.words), "the bar does not tell the market day");
    await shot("3-market");
    await advance(day * DAY + 19 * HOUR);
    const packed = await until(
      "the market packed away by evening",
      async () => (await square())?.market === 0,
      slow(30000),
    );
    check(packed, "the market still stands in the evening");
  }
}

check(errors.length === 0, `errors: ${errors.slice(0, 3).join(" | ")}`);
await browser.close();
await new Promise<void>((done) => server.httpServer.close(() => done()));
console.log(
  problems.length
    ? `\nthe Phase 33 gate fails:\n${problems.map((p) => `  ✗ ${p}`).join("\n")}`
    : "\nthe Phase 33 gate passes",
);
process.exit(problems.length ? 1 : 0);
