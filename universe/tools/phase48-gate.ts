// node tools/phase48-gate.ts [--ci] [--soft] [--shots dir] — the Phase 48 gate (the road's trade,
// M210; asked for 2026-10-25: "...work on bringing back og causlisis like town/country game play
// and sim like the depth the og game had ... and just actions of stuff yk"), on the built app, the
// Earth seed three centuries on, in its greatest town whose land trades and that has traders:
//   1. a trader setting out: at the store loading the goods, then down the road with a pack;
//   2. gone by the afternoon: away, not drawn — "On the road to <the land>";
//   3. the town's card: its trade, what goes out and where, what comes in and from where, and its
//      traders on the road;
//   4. back of an afternoon a day or two on, with what that land sends, unloaded at its store.
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
console.log("the Phase 48 gate");
if (shots) mkdirSync(shots, { recursive: true });

type Good = { what: string; land: string; count: number };
type Trader = {
  index: number;
  x: number;
  z: number;
  why: string | null;
  carry: string | null;
  hidden: boolean;
};
type Trip = {
  index: number;
  out: number;
  back: number;
  land: string;
  take: string | null;
  bring: string | null;
};
type Trade = { trade: { out: Good[]; in: Good[] } | null; traders: Trader[]; trips: Trip[] };
type Plan = {
  ref: string;
  name: string;
  population: number;
  people: { occupation: number; child: boolean }[];
  trade?: { out: Good[]; in: Good[] };
};
const TRADER = 5;

const root = fileURLToPath(new URL("..", import.meta.url)),
  // (CAUSALIS_DIST: a build elsewhere, so that one can be looked at while dist/ is under test.)
  server = await preview({
    root,
    logLevel: "silent",
    preview: { port: 4303, strictPort: false },
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
const trade = () => k<Trade | null>(`globalThis.causalis.trade?.() ?? null`);
const now = () => k<number>(`globalThis.causalis.client.status?.t ?? 0`);
const DAY = 86400,
  HOUR = 3600;
/** On to moment t (the clock held): the host's word of it come, and a few frames drawn there. */
const advance = async (t: number) => {
  await k(`globalThis.causalis.client.advance(${Math.round(t)})`);
  await page
    .waitForFunction((at) => ((globalThis as any).causalis.client.status?.t ?? 0) >= at - 1, t, {
      timeout: slow(20000),
    })
    .catch(() => undefined);
  await page.waitForTimeout(slow(700));
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

await page.goto(`${base}?universe=earth&seed=${encodeURIComponent("first light")}&year=300&hold=1`);
await page.waitForFunction(
  () => ((globalThis as any).causalis?.drawn?.() as number) > 0,
  undefined,
  { timeout: 900000 },
);
await k(`globalThis.causalis.setQuality("high")`);
await k(`globalThis.causalis.client.setSpeed(0)`);

// The greatest town whose land trades, with two traders or more, a good share of whose trips
// bring goods back. (A trader's land is picked by all its trade with each: a town that sends a
// land thousands and has two a year from another sees its traders come back with goods once in
// years; the first town with a third of its trips bringing goods home is taken, else the one with
// the most.)
const towns = await k<{ ref: string; name: string; people: number }[]>(
  `globalThis.causalis.client.query({ type: "towns.map" })`,
);
const bringing = (trade: { out: Good[]; in: Good[] }) => {
  const all = [...trade.out, ...trade.in].reduce((a, g) => a + g.count, 0),
    from = new Set(trade.in.map((g) => g.land)),
    back = [...trade.out, ...trade.in]
      .filter((g) => from.has(g.land))
      .reduce((a, g) => a + g.count, 0);
  return all > 0 ? back / all : 0;
};
let town: Plan | null = null,
  share = 0;
for (const c of [...towns].sort((a, b) => b.people - a.people).slice(0, 80)) {
  const plan = await planOf(c.ref),
    traders = plan.people.filter((p) => p.occupation === TRADER && !p.child).length;
  if (!plan.trade || !plan.trade.out.length || !plan.trade.in.length || traders < 2) continue;
  const s = bringing(plan.trade);
  if (s > share) {
    town = plan;
    share = s;
  }
  if (s >= 1 / 3) break;
}
check(!!town, "no town of the Earth seed trades, with traders, by year 300");
if (!town) {
  await browser.close();
  await server.close();
  console.log("FAILED:");
  for (const p of problems) console.log(`  - ${p}`);
  process.exit(1);
}
const words = (g: Good) => `${g.what} ${g.land} ${Math.round(g.count)}`;
say(
  `the town: ${town.name} (${town.population}); out ${town.trade!.out.map(words).join(", ")}; in ${town.trade!.in.map(words).join(", ")}; ${Math.round(share * 100)}% of trips bring goods back`,
);
await k(`globalThis.causalis.goTo(${JSON.stringify(town.ref)})`);
await until(`${town.name} drawn`, async () => (await trade()) !== null, slow(120000));
await k(`globalThis.causalis.client.setSpeed(0)`);

// 1. A trader setting out: day by day (the clock goes only forward), early of a morning.
// (One taking the town's goods to a land that buys them, so as to see them loaded; another, later,
// coming back from a land that sends it goods, so as to see those unloaded.)
const d0 = Math.floor((await now()) / DAY) + 1,
  landOf = (why: string | null) =>
    (/^Loading .+ for (.+)$/.exec(why ?? "") ?? /down the road to (.+)$/.exec(why ?? ""))?.[1] ??
    null,
  takes = new Set(town.trade!.out.map((g) => g.land)),
  sends = new Set(town.trade!.in.map((g) => g.land));
let who = -1,
  out = -1,
  land = "",
  hour = 7.62;
// The trips the town's traders set out on in the months ahead (by the rule its day is drawn by):
// the first ones taking the town's goods to a land that buys them, each looked for on its morning.
// (A town's traders go where its trade is greatest, so such a trip can be a month or more off.)
// They set out at 7.4 and load for 24 minutes once at the store: looked for while loading, a
// little later for those whose store is further off or who rose late — never once gone, since
// the clock goes only forward and their loading would be missed.
const ahead = (await k<Trade | null>(`globalThis.causalis.trade?.(120) ?? null`))?.trips ?? [],
  loads = ahead.filter((t) => t.take !== null && takes.has(t.land) && t.out >= d0);
say(
  `trips ahead: ${ahead.length} in 120 days, ${loads.length} taking the town's goods${loads[0] ? `, the first in ${loads[0].out - d0 + 1} days to ${loads[0].land}` : ""}`,
);
for (const t of loads.slice(0, 3)) {
  if (who >= 0) break;
  for (const h of [7.62, 7.78, 7.95]) {
    await advance(t.out * DAY + h * HOUR);
    const one = (await trade())!.traders.find(
      (x) =>
        x.index === t.index &&
        /^Loading /.test(x.why ?? "") &&
        !x.hidden &&
        takes.has(landOf(x.why) ?? ""),
    );
    if (!one) continue;
    who = one.index;
    out = t.out;
    land = landOf(one.why)!;
    hour = h;
    break;
  }
}
check(who >= 0, "no trader set out with the town's goods in the months ahead");
const me = async () => (await trade())!.traders.find((x) => x.index === who)!;
if (who >= 0) {
  let loading: Trader | null = null,
    going: Trader | null = null;
  for (let h = hour; h < 11 && !going; h += 0.05) {
    if (h > hour) await advance(out * DAY + h * HOUR);
    const x = await me(),
      named =
        /^Loading .+ for (.+)$/.exec(x.why ?? "") ?? /down the road to (.+)$/.exec(x.why ?? "");
    if (named) land = named[1]!;
    if (/^Loading /.test(x.why ?? "") && !loading) {
      loading = x;
      await face(x.x, x.z, 4);
      await shot("1-loading");
    }
    if (/down the road to /.test(x.why ?? "") && !x.hidden && x.carry === "pack") going = x;
  }
  say(
    `setting out: “${loading?.why ?? "no loading seen"}”, then “${going?.why ?? "not seen going"}” (${going?.carry ?? "nothing"} carried)`,
  );
  check(!!loading && loading.carry === "pack", "the trader not seen loading at the store");
  check(!!going, "the trader not seen going down the road with a pack");
  if (going) {
    await face(going.x, going.z, 5);
    await shot("2-going");
  }
  // 2. Gone by the afternoon.
  await advance(out * DAY + 15.5 * HOUR);
  const gone = await me();
  say(`the afternoon: “${gone.why}”, ${gone.hidden ? "not drawn" : "still drawn"}`);
  check(
    gone.hidden && /^On the road to /.test(gone.why ?? ""),
    "the trader not away down the road",
  );
  // 3. The town's card: its trade.
  await page.click(".panel:not([hidden]) .town-stores");
  await page.waitForTimeout(slow(600));
  const card =
    (await k<{ card: string } | null>(`globalThis.causalis.stores?.() ?? null`))?.card ?? "";
  const tradeAt = card.indexOf("Its trade");
  say(`its card: “${tradeAt >= 0 ? card.slice(tradeAt, tradeAt + 200) : card.slice(0, 120)}…”`);
  check(tradeAt >= 0, "the town's card does not tell its trade");
  check(
    /↗ .+ to .+ a year/.test(card) && /↙ .+ from .+ a year/.test(card),
    "the card's trade lines",
  );
  check(/on the road with goods/.test(card), "the card does not tell its traders on the road");
  await shot("3-card");
  await page.click(".panel:not([hidden]) > .inspector:not([hidden]):not(.page-window) > .close");
  // 4. The next day: away all day, trading there (or on the road back).
  await advance((out + 1) * DAY + 12 * HOUR);
  const away = await me();
  say(`the next noon: “${away.why}”, ${away.hidden ? "not drawn" : "drawn"}`);
  check(
    away.hidden &&
      (away.why === `Away down the road, trading in ${land}` ||
        away.why === `On the road back from ${land}`),
    "the trader not away in the land they went to",
  );
  // 5. One back of an afternoon from a land that sends the town goods, with them; unloaded at its
  // store. (Day by day at noon: one on the road back from such a land, then followed in.)
  const backFrom = (why: string | null) => /^On the road back from (.+)$/.exec(why ?? "")?.[1];
  let back: Trader | null = null,
    unloading: Trader | null = null;
  for (let d = out + 1; d < out + 30 && !unloading; d++) {
    if (d > out + 1) await advance(d * DAY + 12 * HOUR);
    const coming = (await trade())!.traders.find((x) => sends.has(backFrom(x.why) ?? ""));
    if (!coming) continue;
    const from = backFrom(coming.why)!;
    for (let h = 13.4; h < 17.5 && !unloading; h += 0.05) {
      await advance(d * DAY + h * HOUR);
      const x = (await trade())!.traders.find((y) => y.index === coming.index)!;
      if (/^Back from /.test(x.why ?? "") && !x.hidden && !back) {
        back = x;
        check(x.why!.startsWith(`Back from ${from} with `), `back from ${from}: “${x.why}”`);
        await face(x.x, x.z, 5);
        await shot("4-back");
      }
      if (/^Unloading .+ at /.test(x.why ?? "")) unloading = x;
    }
  }
  say(
    `back: “${back?.why ?? "not seen back"}” (${back?.carry ?? "nothing"} carried), then “${unloading?.why ?? "no unloading seen"}”`,
  );
  check(
    !!back && back.carry === "pack",
    "no trader seen back with goods from a land that sends them",
  );
  check(!!unloading, "what they brought not unloaded at the store");
  if (unloading) {
    await face(unloading.x, unloading.z, 4);
    await shot("5-unloading");
  }
}

await browser.close();
await server.close();
if (errors.length) problems.push(...errors.map((e) => `page error: ${e}`));
if (problems.length) {
  console.log("FAILED:");
  for (const p of problems) console.log(`  - ${p}`);
  process.exit(1);
}
console.log("the Phase 48 gate passes");
