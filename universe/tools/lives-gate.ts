// node tools/lives-gate.ts [--ci] [--soft] [--shots dir]: gate 68, Lives L1 and L2 at a phone's size.
//
//   1. a world opened at year 450, its clock held;
//   2. a realm whose ruler can be taken, chosen from what the world holds;
//   3. its land's page and its town's say who rules them;
//   4. its Leaders tab: a card for each figure, each thing to press big enough, nothing wider than the screen;
//   5. the deed on a card opens the event that says why;
//   6. the ruler's page says its home is the view's, not history's, and has their family and body;
//   7. Go to their home: the town, the eye over a marked home, a pin and a chip, the figure among those drawn;
//   8. all of that changed nothing in the world;
//   9. the pin opens their page, and the chip comes back when it is closed;
//  10. Possess: the god's hand in the ruler, standing near that home;
//  11. Let go: the hand lifted, the chip back (history has moved now, as it should);
//  12. the wealth lens: its four choices, colours apart between the richest and the poorest realm;
//  13. each measure says its own words;
//  14. the ranking: what it counts and why, its table, a realm tapped from it;
//  15. two realms side by side;
//  16. the land view keeps the lens;
//  17. no error in the page.
import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { preview } from "vite";
import { chromium } from "playwright";
import type { Leader, LeaderList, WealthBook } from "../src/bridge/index.ts";

const argv = process.argv.slice(2),
  soft = argv.includes("--soft"),
  ci = argv.includes("--ci"),
  shotsAt = argv.indexOf("--shots"),
  shots = shotsAt >= 0 ? argv[shotsAt + 1] : undefined;
if (shots) mkdirSync(shots, { recursive: true });
const slow = (ms: number) => (ci || soft ? ms * 4 : ms);

const GPU = [
  "--enable-gpu",
  "--ignore-gpu-blocklist",
  "--use-angle=d3d11",
  "--force_high_performance_gpu",
];
const problems: string[] = [],
  check = (ok: boolean, what: string) => {
    if (!ok) problems.push(what);
  },
  say = (s: string) => console.log(`  ${s}`);

const root = fileURLToPath(new URL("..", import.meta.url)),
  started = performance.now(),
  server = await preview({
    root,
    logLevel: "silent",
    preview: { port: 4268, strictPort: false },
  }),
  base = server.resolvedUrls!.local[0]!,
  browser = await chromium.launch({
    args: soft ? ["--use-angle=swiftshader", "--enable-unsafe-swiftshader"] : ci ? [] : GPU,
  });
const context = await browser.newContext({
    viewport: { width: 430, height: 932 },
    deviceScaleFactor: ci || soft ? 1 : 3,
    hasTouch: true,
    isMobile: true,
  }),
  page = await context.newPage(),
  errors: string[] = [];
page.setDefaultTimeout(slow(60000));
page.on("pageerror", (e) => errors.push(`${e.message}\n${e.stack ?? ""}`));
page.on("console", (m) => {
  if (m.type() === "error") errors.push(m.text());
});
const k = <T>(code: string): Promise<T> => page.evaluate(code) as Promise<T>;
const ask = <T>(type: string, args: unknown = {}) =>
  k<T>(
    `globalThis.causalis.client.query({ type: ${JSON.stringify(type)}, args: ${JSON.stringify(args)} })`,
  );
const shot = async (name: string) => {
  if (shots) await page.screenshot({ path: join(shots, `${name}.png`) });
};
const until = async (what: string, ok: () => Promise<boolean>, ms = slow(60000)) => {
  const end = Date.now() + ms;
  while (Date.now() < end) {
    if (await ok().catch(() => false)) return true;
    await page.waitForTimeout(60);
  }
  problems.push(`${what} did not come`);
  return false;
};
const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);
const scale = () => k<string>("globalThis.causalis.scale()");
const pageOpen = () => k<string | null>("globalThis.causalis.pageOpen()");
const text = (sel: string) =>
  k<string>(`document.querySelector(${JSON.stringify(sel)})?.textContent ?? ""`);
const centre = (sel: string) =>
  k<{ x: number; y: number } | null>(`(() => {
    const e = document.querySelector(${JSON.stringify(sel)});
    if (!e) return null;
    const r = e.getBoundingClientRect();
    return r.width > 0 && r.height > 0 ? { x: r.left + r.width / 2, y: r.top + r.height / 2 } : null;
  })()`);
/** Scrolled into the middle of what holds it, then touched where it stands. */
const tap = async (sel: string) => {
  await k(
    `document.querySelector(${JSON.stringify(sel)})?.scrollIntoView({ block: "center", inline: "center" })`,
  );
  let at: { x: number; y: number } | null = null;
  await until(`${sel} on the screen`, async () => !!(at = await centre(sel)));
  if (at) {
    const { x, y } = at as { x: number; y: number };
    await page.touchscreen.tap(x, y);
  }
};
/** At least a finger's size each way. */
const big = (sel: string) =>
  k<boolean>(`(() => {
    const e = document.querySelector(${JSON.stringify(sel)});
    if (!e) return false;
    const r = e.getBoundingClientRect();
    return r.width >= 44 && r.height >= 44;
  })()`);
const fits = () => k<boolean>("document.documentElement.scrollWidth <= 430");
const seen = (sel: string) => centre(sel).then((c) => !!c);
const open = (ref: string) => k(`globalThis.causalis.open(${JSON.stringify(ref)})`);
const words = () => text(".page-window");

// 1. A world opened, its clock held.
await page.goto(`${base}?universe=earth&seed=first%20light&year=450&hold=1`);
await page.waitForFunction(
  () => ((globalThis as { causalis?: { drawn?: () => number } }).causalis?.drawn?.() ?? 0) > 0,
  undefined,
  { timeout: 1_800_000 },
);
await k("globalThis.causalis.client.setSpeed(0)");
// (By day: at the world's first midnight everyone is asleep and the town is dark.)
await k(`globalThis.causalis.client.advance(globalThis.causalis.client.status.t + 11 * 3600)`);
say(`the world drawn, year 450, in ${((performance.now() - started) / 1000).toFixed(0)} s`);
const before = await ask<unknown>("hashes");

// 2. A realm whose ruler can be taken: one with a lending house among its figures if there is one.
const book = await ask<WealthBook>("wealth.book");
check(book.realms.length >= 2, `${book.realms.length} realms in the wealth book`);
let list: LeaderList | null = null;
for (const r of book.realms) {
  const each = await ask<LeaderList>("leaders.of", { realm: r.ref }),
    first = each.leaders[0];
  if (!first?.as || first.cannot || !first.town) continue;
  if (!list) list = each;
  if (each.leaders.some((l) => l.kind === "lender")) {
    list = each;
    break;
  }
}
if (!list) throw new Error("no realm's ruler could be taken");
const realm = list.realm,
  ruler = list.leaders[0] as Leader,
  town = ruler.town!;
say(`${list.realmName}: ${ruler.name}, of ${ruler.townName}; ${list.leaders.length} figures`);

// 3. The land's page and the town's say who rules them.
// (Which realm each land is of: the book's; where it stands on the globe: the map's.)
const mapped = await ask<{ cell: number; centre: number }[]>("people.map"),
  centreOf = new Map(mapped.map((l) => [l.cell, l.centre])),
  landsOf = (of: string) => {
    const index = book.realms.findIndex((r) => r.ref === of);
    return book.lands
      .filter((l) => l.realm === index)
      .map((l) => ({ cell: l.cell, centre: centreOf.get(l.cell) ?? 0 }));
  },
  member = landsOf(realm)[0];
check(!!member, "no land of the realm on the map");
if (member) {
  await open(`cell:0:${member.cell}`);
  await until(
    "the land's page saying who rules it",
    async () => (await words()).includes("Ruled by") && (await words()).includes(ruler.name),
  );
}
await open(town);
await until(
  "the town's page saying who rules it",
  async () => (await words()).includes("Ruled by") && (await words()).includes(ruler.name),
);
await shot("land");

// 4. The Leaders tab.
const toLeaders = async () => {
  await open(`${realm}#leaders`);
  await until("the Leaders tab", () => seen(".page-window .leader-card"));
};
await toLeaders();
check(
  (await k<number>(`document.querySelectorAll(".page-window .leader-card").length`)) ===
    list.leaders.length,
  "a card for each figure",
);
check(
  (await text(".page-window .leader-name")).includes(ruler.name),
  "the first card is not the ruler's",
);
check(!!(await text(".page-window .leader-title")), "a card with no title");
check(!!(await text(".page-window .leader-did")), "a card saying nothing they did");
check(await big(".page-window .leader-go"), "Go to their home is too small to press");
check(await big(".page-window .leader-name"), "a figure's name is too small to press");
check(await fits(), "the Leaders tab is wider than the screen");
await shot("leaders");

// 5. The why.
if (ruler.why) {
  await tap(".page-window .leader-did");
  await until("the event that says why", async () => (await pageOpen()) === ruler.why);
  await toLeaders();
}

// 6. The ruler's page.
await tap(".page-window .leader-name");
await until("the ruler's page", async () => (await pageOpen()) === `rule:${realm}`);
await until("the ruler's page's words", async () =>
  (await words()).includes("not where its ruler sleeps"),
);
for (const tab of ["Family", "Body"])
  check((await words()).includes(tab), `the ruler's page has no ${tab} tab`);
await shot("ruler");
await toLeaders();

// 7. Home.
await tap(".page-window .leader-go");
await until(
  "their home",
  () =>
    k<boolean>(`(() => {
      const c = globalThis.causalis;
      return c.scale() === "village" && c.planNow()?.ref === ${JSON.stringify(town)} && !!c.leaders.state()?.chip;
    })()`),
  slow(120000),
);
await k(
  `(async () => { for (let i = 0; i < 100 && globalThis.causalis.rig.flying; i++) await new Promise((r) => setTimeout(r, 100)); })()`,
);
await page.waitForTimeout(slow(600));
type LeaderState = {
  ref: string;
  name: string;
  town: string;
  laid: string | null;
  chip: boolean;
  pin: { x: number; y: number } | null;
  home: { x: number; z: number } | null;
};
const s = (await k<LeaderState | null>("globalThis.causalis.leaders.state()"))!;
if (!s) throw new Error(`no home shown: ${problems.join("; ")}`);
check(!!s.home, "no home was marked");
check(
  !!s.pin && s.pin.x >= 0 && s.pin.x <= 430 && s.pin.y >= 0 && s.pin.y <= 932,
  `the pin is off the screen: ${JSON.stringify(s.pin)}`,
);
check(await seen(".home-pin"), "the pin cannot be seen");
check(await big(".home-pin"), "the pin is too small to press");
const chipBox = await k<{ left: number; right: number; top: number; bottom: number } | null>(
  `(() => {
    const e = document.querySelector(".leader-chip");
    if (!e) return null;
    const r = e.getBoundingClientRect();
    return r.width > 0 ? { left: r.left, right: r.right, top: r.top, bottom: r.bottom } : null;
  })()`,
);
check(
  !!chipBox &&
    chipBox.left >= 0 &&
    chipBox.right <= 430 &&
    chipBox.top >= 0 &&
    chipBox.bottom <= 932,
  `the chip does not fit the screen: ${JSON.stringify(chipBox)}`,
);
for (const b of [".leader-possess", ".leader-page", ".leader-close"])
  check(await big(b), `${b} is too small to press`);
check(await fits(), "the town's screen is wider than the phone");
const figure = await k<{ index: number; home: number; figureHome: number | null }>(`(() => {
  const p = globalThis.causalis.planNow(), ref = ${JSON.stringify(ruler.ref)},
    index = p.people.findIndex((q) => q.figure === ref);
  return {
    index,
    home: index >= 0 ? p.people[index].home : -1,
    figureHome: p.figures?.find((f) => f.ref === ref)?.home ?? null,
  };
})()`);
check(figure.index >= 0, "the ruler is not among those drawn");
check(figure.home === figure.figureHome, `the ruler's home: ${JSON.stringify(figure)}`);
await shot("home");

// 8. Nothing changed.
check(same(await ask("hashes"), before), "reading the leaders changed the world");

// 9. The pin.
await tap(".home-pin");
await until("the page from the pin", async () => (await pageOpen()) === ruler.ref);
await k("globalThis.causalis.closePage()");
await until("the chip again", () => seen(".leader-chip"));

// 10. Possess.
await tap(".leader-possess");
await until(
  "the body taken",
  () => k<boolean>("!!globalThis.causalis.possess.state()"),
  slow(120000),
);
const body = await k<{
  name: string;
  at: { x: number; z: number } | null;
  possessing: boolean;
  told: boolean;
} | null>(`(() => {
  const p = globalThis.causalis.possess, h = p.state();
  if (!h) return null;
  const me = p.drawn(h.agent);
  return {
    name: h.name,
    at: me && { x: me.x, z: me.z },
    possessing: document.body.classList.contains("possessing"),
    told: document.body.innerText.includes("leader of"),
  };
})()`);
check(body?.name === ruler.name, `the body taken is ${body?.name}, not ${ruler.name}`);
check(!!body?.possessing, "the page does not say it is possessing");
check(!!body?.told, "the strip does not say this is a leader");
check(await seen(".possess-letgo"), "no way to let go");
if (body?.at && s.home) {
  const far = Math.hypot(body.at.x - s.home.x, body.at.z - s.home.z);
  say(`the body stands ${far.toFixed(0)} m from the home marked`);
  check(far <= 40, `the body stands ${far.toFixed(0)} m from their home`);
}
check((await ask<{ village: string } | null>("hand"))?.village === town, "the hand is not on it");
// (Once the eye has come down behind them, and then a few steps on from where they stood.)
await page.waitForTimeout(slow(2500));
say(
  `the eye: ${await k<string>(`(() => {
    const p = globalThis.causalis.possess, h = p.state(), me = p.drawn(h.agent);
    return JSON.stringify({ eye: h.eye, me, from: h.from, height: me?.height });
  })()`)}`,
);
await shot("possessed");

// 11. Let go.
await tap(".possess-letgo");
await until(
  "the body let go",
  () =>
    k<boolean>(
      "!globalThis.causalis.possess.state() && !!globalThis.causalis.leaders.state()?.chip",
    ),
  slow(120000),
);
await until("the hand lifted", async () => (await ask("hand")) === null, slow(60000));
await shot("after");
await k("globalThis.causalis.leaders.clear()");

// 12. The lens.
await k(`globalThis.causalis.goTo(${JSON.stringify(realm)})`);
await until("the globe", async () => (await scale()) === "globe", slow(120000));
await k("globalThis.causalis.closePage()");
await tap(".mapmodes .mode[aria-label='Wealth']");
await until(
  "the wealth lens",
  async () =>
    (await text(".legend-title")) === "Wealth" &&
    (await text(".legend-note")).startsWith("A head:"),
);
const picks = await k<number>(`document.querySelectorAll(".legend-picks [data-choice]").length`);
check(picks === 4, `${picks} measures to choose from`);
for (const m of ["head", "all", "made", "land"])
  check(await big(`.legend-picks [data-choice='${m}']`), `the choice ${m} is too small to press`);
check(await big(".legend-action"), "the way to the ranking is too small to press");
check(
  (await k<{ shades: number }>("globalThis.causalis.wealthNow()")).shades > 0,
  "the lens paints nothing",
);
check(await fits(), "the lens is wider than the screen");
const ranked = book.realms.filter((r) => !r.few),
  rich = landsOf(ranked[0]?.ref ?? "")[0],
  poor = landsOf(ranked.at(-1)?.ref ?? "")[0];
if (rich && poor && rich.cell !== poor.cell) {
  const [a, b] = await k<[number[] | null, number[] | null]>(`(() => {
    const c = globalThis.causalis;
    return [c.lensColorAt(${rich.centre}), c.lensColorAt(${poor.centre})];
  })()`);
  say(`the richest realm's land ${JSON.stringify(a)}, the poorest's ${JSON.stringify(b)}`);
  check(
    !!a && !!b && a.some((x, i) => Math.abs(x - b[i]!) > 40),
    `the richest and the poorest look alike: ${JSON.stringify([a, b])}`,
  );
}
const none = book.lands.find((l) => l.realm < 0 && centreOf.has(l.cell));
if (none) {
  const c = await k<number[] | null>(`globalThis.causalis.lensColorAt(${centreOf.get(none.cell)})`);
  check(!!c && Math.max(...c) - Math.min(...c) < 40, `a land of no realm: ${JSON.stringify(c)}`);
}
await shot("lens-head");

// 13. The measures.
const measure = async (m: string, starts: string) => {
  await tap(`.legend-picks [data-choice='${m}']`);
  await until(`the measure ${m}`, async () => (await text(".legend-note")).startsWith(starts));
};
await measure("all", "In all:");
await shot("lens-all");
await measure("made", "Made last year");
await measure("land", "Each land");
await measure("head", "A head:");

// 14. The ranking.
await tap(".legend-action");
await until(
  "the ranking",
  async () =>
    ((await pageOpen()) ?? "").startsWith("world:ledger") &&
    (await words()).includes("The ten richest, a head") &&
    (await words()).includes("Tools never wear out"),
);
check(await fits(), "the ranking is wider than the screen");
await shot("ranking");
const firstRealm = book.realms[0]!.ref;
await tap(".page-window .table tbody tr.entry");
await until("a realm from the ranking", async () => (await pageOpen()) === firstRealm);
await until("its wealth", async () => (await words()).includes("Wealth"));
await shot("realm-wealth");

// 15. Side by side.
await open("world:ledger#wealth");
await until("the way to set two side by side", () => seen(".wealth-compare button"));
check(await big(".wealth-compare button"), "the side by side button is too small to press");
check(await big(".wealth-compare select"), "the side by side choice is too small to press");
await tap(".wealth-compare button");
await until("two realms side by side", async () =>
  ((await pageOpen()) ?? "").startsWith("compare:"),
);
await until(
  "their wealth side by side",
  async () =>
    (await words()).includes("Wealth a head") &&
    (await words()).includes("Wealth in all") &&
    (await words()).includes("Made last year, a head"),
);
check(await fits(), "the comparison is wider than the screen");
await shot("compare");

// 16. The land view keeps the lens.
await k("globalThis.causalis.closePage()");
if (member) {
  await k(`globalThis.causalis.descend(${member.cell})`);
  await until("the land", async () => (await scale()) === "region", slow(120000));
  await until("the land's panel naming the lens", () =>
    k<boolean>(`document.body.innerText.includes("Wealth")`),
  );
  await shot("land-lens");
}

// 17. No error in the page.
check(errors.length === 0, `errors in the page: ${errors.slice(0, 3).join(" | ")}`);

console.log(
  `Lives gate (68): ${((performance.now() - started) / 1000).toFixed(0)} s, ${problems.length} problems`,
);
for (const p of problems) console.log(`  - ${p}`);
await browser.close();
await server.close();
process.exit(problems.length ? 1 : 0);
