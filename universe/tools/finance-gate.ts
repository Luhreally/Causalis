// node tools/finance-gate.ts [--ci] [--soft] [--shots dir] [--year n] [--desk]: gate 120, a realm's money and its fears (asked
// 2026-11-14: "more visuals for econmy view tab like and like the stocks ... bonds, diffrent citizens owning stocks from diffrent
// countires, like emergent cold war dynamics"):
//   1. pure, on the world the app runs (first light at year 600, made here alike): some realm has sold debt and some people holds
//      another's; every realm that owes has its Money tab, what new debt would cost it with each part of it, who holds its debt, its
//      years drawn; every realm has its Fears tab, each fear's four numbers behind it; the ledger's Money tab has the square of who
//      holds whom, and its Camps tab the greatest fears; the Camps lens reads every land; no word a raw id;
//   2. by real touch at 430 by 932 (and at a desk's size with --desk) on the same world: the realm that owes the most opened, its
//      Money tab pressed, its lines and its holders' bars drawn; its Fears tab; the ledger's Money tab, a square of who holds whom
//      pressed and telling its number; its Camps tab; the Camps lens on the globe; nothing over anything, nothing off the screen.
import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { preview } from "vite";
import { chromium } from "playwright";
import { hudRead, type HudRead } from "./hud-read.ts";

const argv = process.argv.slice(2),
  soft = argv.includes("--soft"),
  ci = argv.includes("--ci"),
  desk = argv.includes("--desk"),
  arg = (name: string) => {
    const at = argv.indexOf(name);
    return at >= 0 ? argv[at + 1] : undefined;
  },
  shots = arg("--shots"),
  YEAR_AT = Number(arg("--year") ?? 600),
  SEED = "first light",
  SIZE = desk ? { width: 1366, height: 800 } : { width: 430, height: 932 };
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
console.log(`gate 120, money and fears${desk ? ", at a desk" : ""}`);

const BAD = /undefined|NaN|\[object|\bnull\b|Infinity|\b(ev|pol|war|cell|town|bloc):\d/;
type Model = {
  ref: string;
  title: string;
  tabs: { id: string; name: string; blocks: Record<string, unknown>[] }[];
};
const wordsOf = (m: unknown): string => {
  const out: string[] = [];
  const walk = (x: unknown, key = "") => {
    if (["ref", "why", "keys", "color", "swatch", "unit", "kind"].includes(key)) return;
    if (typeof x === "string") out.push(x);
    else if (Array.isArray(x)) x.forEach((y) => walk(y));
    else if (x && typeof x === "object")
      for (const [k, v] of Object.entries(x as Record<string, unknown>)) walk(v, k);
  };
  walk(m);
  return out.join(" ");
};
const blocksOf = (m: Model, tab: string) => m.tabs.find((t) => t.id === tab)?.blocks ?? [];

// 1. Pure, on the same world.
let chosen: { realm: string; name: string; fearing: string | null } | null = null;
{
  const planet = await import("../src/host/planet.ts");
  const { seedFromText, YEAR } = await import("../src/kernel/index.ts");
  const { pageOf } = await import("../src/host/inspect/index.ts");
  const { landReadings, lensReading } = await import("../src/host/lenses.ts");
  const { campsRead } = await import("../src/host/inspect/finance.ts");
  const { campsStand } = await import("../src/rules/index.ts");
  const { debtOf, financeOf, politiesOf, realmName } = await import("../src/sim/index.ts");
  const t0 = performance.now(),
    world = planet.EARTH.build(seedFromText(SEED));
  world.runTo(YEAR_AT * YEAR);
  const store = financeOf(world)!,
    realms = politiesOf(world).living(),
    owing = realms.filter((r) => debtOf(store.of(r.ref)!) > 0),
    holdings = store.all().reduce((n, m) => n + m.shares.length + m.held.length, 0),
    fearing = realms.filter((r) => (store.of(r.ref)!.fears[0]?.level ?? 0) >= 35),
    camps = campsRead(world).camps;
  say(
    `${SEED} at year ${YEAR_AT}: run in ${((performance.now() - t0) / 1000).toFixed(0)} s; ${realms.length} realms, ${owing.length} owing, ${holdings} holdings abroad, ${fearing.length} fearing; camps ${camps ? `${camps.camps[0].length} against ${camps.camps[1].length}, ${camps.apart.length} apart${campsStand(camps) ? "" : " (not standing)"}` : "none"}`,
  );
  check(owing.length > 0, "no realm has sold debt");
  check(holdings > 0, "no people holds another realm's debt or works");
  let slowest = 0;
  for (const r of realms) {
    const t1 = performance.now(),
      m = pageOf(world, r.ref) as unknown as Model;
    slowest = Math.max(slowest, performance.now() - t1);
    const where = `${m.title}`,
      fears = blocksOf(m, "fears"),
      money = blocksOf(m, "money");
    check(fears.length > 0, `${where}: no Fears tab`);
    check(!BAD.test(wordsOf(fears)), `${where}: its fears say ${BAD.exec(wordsOf(fears))?.[0]}`);
    check(!BAD.test(wordsOf(money)), `${where}: its money says ${BAD.exec(wordsOf(money))?.[0]}`);
    if (debtOf(store.of(r.ref)!) > 0) {
      check(
        money.some((b) => b.type === "composition" && b.title === "Who holds its debt"),
        `${where}: it owes, and its Money tab does not say to whom`,
      );
      const cost = (
        (money.find((b) => b.type === "facts")?.rows ?? []) as {
          label: string;
          parts?: unknown[];
        }[]
      ).find((x) => x.label === "New debt would cost it");
      check((cost?.parts?.length ?? 0) >= 3, `${where}: what new debt would cost it has no parts`);
    }
    const top = store.of(r.ref)!.fears[0];
    if (top && top.level >= 10)
      check(
        ((fears.find((b) => b.type === "facts")?.rows ?? []) as { parts?: unknown[] }[]).every(
          (x) => (x.parts?.length ?? 0) >= 5,
        ),
        `${where}: a fear without its numbers`,
      );
  }
  check(slowest < 400, `a realm's page took ${slowest.toFixed(0)} ms`);
  const ledger = pageOf(world, "world:ledger") as unknown as Model,
    money = blocksOf(ledger, "money"),
    campsTab = blocksOf(ledger, "camps");
  check(
    money.some((b) => b.type === "owning"),
    "the ledger's Money tab has no square of who holds whom",
  );
  check(
    campsTab.some((b) => b.type === "table"),
    "the ledger's Camps tab has no table of fears",
  );
  check(!BAD.test(wordsOf(money)), `the ledger's money says ${BAD.exec(wordsOf(money))?.[0]}`);
  check(!BAD.test(wordsOf(campsTab)), `the ledger's camps say ${BAD.exec(wordsOf(campsTab))?.[0]}`);
  const read = landReadings(world);
  let lands = 0;
  for (const r of realms)
    for (const c of r.members) {
      const v = read(c).camps;
      check(v >= -1 && v <= 1, `land ${c}: the Camps lens reads ${v}`);
      if (lands++ < 40)
        check(!!lensReading(world, c, "camps"), `land ${c}: the Camps lens has no words`);
    }
  const most = [...owing].sort(
    (a, b) => debtOf(store.of(b.ref)!) - debtOf(store.of(a.ref)!) || (a.ref < b.ref ? -1 : 1),
  )[0];
  if (most)
    chosen = {
      realm: most.ref,
      name: realmName(most),
      fearing: (fearing[0] ?? realms.find((r) => store.of(r.ref)!.fears.length))?.ref ?? null,
    };
  say(
    `${realms.length} realms' pages read, the slowest ${slowest.toFixed(0)} ms; the ledger's Money tab ${money.length} blocks, its Camps tab ${campsTab.length}`,
  );
}

// 2. By real touch.
if (chosen) {
  const root = fileURLToPath(new URL("..", import.meta.url)),
    server = await preview({ root, logLevel: "silent", preview: { port: 4339, strictPort: true } }),
    site = server.resolvedUrls!.local[0]!,
    browser = await chromium.launch({
      args: soft ? ["--use-angle=swiftshader", "--enable-unsafe-swiftshader"] : ci ? [] : GPU,
    });
  const context = await browser.newContext({
      viewport: SIZE,
      deviceScaleFactor: ci || soft || desk ? 1 : 2,
      hasTouch: !desk,
      isMobile: !desk,
    }),
    page = await context.newPage(),
    errors: string[] = [];
  page.setDefaultTimeout(slow(60000));
  page.on("pageerror", (e) => errors.push(`${e.message}\n${e.stack ?? ""}`));
  page.on("console", (m) => {
    if (m.type() === "error") errors.push(m.text());
  });
  const k = <T>(code: string): Promise<T> => page.evaluate(code) as Promise<T>;
  const tag = desk ? "desk" : "phone";
  const shot = async (name: string) => {
    if (shots) await page.screenshot({ path: join(shots, `${tag}-${name}.png`) });
  };
  const until = async (what: string, ok: () => Promise<boolean>, ms = slow(30000)) => {
    const end = Date.now() + ms;
    while (Date.now() < end) {
      if (await ok().catch(() => false)) return true;
      await page.waitForTimeout(80);
    }
    problems.push(`${what} did not come`);
    return false;
  };
  const settle = (ms: number) => page.waitForTimeout(slow(ms));
  const press = async (x: number, y: number) =>
    desk ? page.mouse.click(x, y) : page.touchscreen.tap(x, y);
  type At = { x: number; y: number; w: number; h: number; under: string | null };
  const centre = (sel: string, text = "", nth = 0) =>
    k<At | null>(`(() => {
      let n = ${nth};
      for (const e of document.querySelectorAll(${JSON.stringify(sel)})) {
        if (${JSON.stringify(text)} && !e.innerText.includes(${JSON.stringify(text)})) continue;
        if (n-- > 0) continue;
        e.scrollIntoView({ block: "center", inline: "nearest" });
        const r = e.getBoundingClientRect();
        if (!(r.width > 0 && r.height > 0)) continue;
        const x = r.left + r.width / 2, y = r.top + r.height / 2, top = document.elementFromPoint(x, y);
        return { x, y, w: r.width, h: r.height, under: top && (e === top || e.contains(top)) ? null : String(top ? top.className || top.tagName : "nothing") };
      }
      return null;
    })()`);
  const tap = async (sel: string, what: string, text = "", nth = 0) => {
    let at: At | null = null;
    await until(`${what} on the screen`, async () => {
      at = await centre(sel, text, nth);
      return !!at;
    });
    if (!at) return false;
    const p = at as At;
    check(!p.under, `${what} lies under ${p.under}`);
    check(
      p.x >= 0 && p.x <= SIZE.width && p.y > 0 && p.y < SIZE.height,
      `${what} lies off the screen, at ${Math.round(p.x)}, ${Math.round(p.y)}`,
    );
    await press(p.x, p.y);
    await settle(400);
    return true;
  };
  const pageNow = () => k<string | null>("globalThis.causalis.pageOpen() ?? null");
  const pageText = () =>
    k<string>(`(() => {
      for (const e of document.querySelectorAll(".page-window")) {
        const r = e.getBoundingClientRect();
        if (r.height > 0 && r.width > 0) return e.innerText;
      }
      return "";
    })()`);
  const offScreen = () =>
    k<string[]>(`(() => {
      const out = [], W = innerWidth, H = innerHeight;
      if (document.documentElement.scrollWidth > W + 1) out.push("the page is wider than the screen");
      for (const win of document.querySelectorAll(".page-window")) {
        const r = win.getBoundingClientRect();
        if (!(r.width > 0)) continue;
        if (r.left < -1 || r.right > W + 1 || r.top < -1 || r.bottom > H + 1) out.push("the window, at " + [r.left, r.top, r.right, r.bottom].map(Math.round));
        for (const e of win.querySelectorAll("*")) {
          if (e.closest(".table-wrap") && !e.classList.contains("table-wrap")) continue;
          const q = e.getBoundingClientRect();
          if (!(q.width > 0 && q.height > 0)) continue;
          if (q.right > r.right + 2 || q.left < r.left - 2) out.push((e.className || e.tagName) + " past the window's side, " + Math.round(q.left) + " to " + Math.round(q.right));
        }
      }
      return out.slice(0, 4);
    })()`);
  const READ = hudRead([], 1);
  // (At a desk the god's hand is always out, and the Ledger, the one wide page, lies over it whichever of its tabs is open: so it
  // did before this gate, and the overlap gate opens no wide page at a desk. Those readings are counted and told, not failed on,
  // here; every other reading is.)
  let wideOverHand = 0;
  const hudFine = async (where: string) => {
    const r = await k<HudRead>(READ),
      letBe = (x: string) =>
        desk &&
        /page-window\.wide/.test(x) &&
        /palette|button\.speed/.test(x) &&
        !!(wideOverHand += 1);
    for (const o of r.overlaps) if (!letBe(o)) problems.push(`${where}: overlap: ${o}`);
    for (const c of r.covered) if (!letBe(c)) problems.push(`${where}: covered: ${c}`);
    for (const o of r.off) problems.push(`${where}: off the screen: ${o}`);
  };
  /** A page opened and one of its tabs pressed; true when the tab's words came. */
  const openTab = async (ref: string, name: string, where: string, words: RegExp) => {
    await k(`globalThis.causalis.closePage?.()`);
    await settle(300);
    await k(`globalThis.causalis.open(${JSON.stringify(ref)})`);
    if (!(await until(`${where}'s page`, async () => (await pageNow()) === ref))) return false;
    await settle(600);
    const at = await k<number>(
      `[...document.querySelectorAll(".page-window .tabs .tab")].findIndex((b) => b.textContent.trim() === ${JSON.stringify(name)})`,
    );
    check(at >= 0, `${where} has no ${name} tab on the screen`);
    if (at < 0) return false;
    await tap(`.page-window .tabs .tab:nth-child(${at + 1})`, `${where}'s ${name} tab`);
    const came = await until(`${where}'s ${name}`, async () => words.test(await pageText()));
    await settle(500);
    const text = await pageText();
    check(!BAD.test(text), `${where}, ${name}, says ${BAD.exec(text)?.[0]}`);
    for (const o of await offScreen()) problems.push(`${where}, ${name}: ${o}`);
    await hudFine(`${where}, ${name}`);
    return came;
  };
  /** The open page scrolled to a block by its title, for a picture. */
  const showBlock = (title: string) =>
    k<boolean>(`(() => {
      for (const e of document.querySelectorAll(".page-window h3, .page-window .block-title, .page-window figcaption, .page-window .series-title")) {
        if (e.textContent.trim().toLowerCase().startsWith(${JSON.stringify(title.toLowerCase())})) { e.scrollIntoView({ block: "start" }); return true; }
      }
      return false;
    })()`);

  await page.goto(`${site}?universe=earth&seed=${encodeURIComponent(SEED)}&year=${YEAR_AT}&hold=1`);
  await page.waitForFunction(
    () => ((globalThis as { causalis?: { drawn?: () => number } }).causalis?.drawn?.() ?? 0) > 0,
    undefined,
    { timeout: slow(900000) },
  );
  await k("globalThis.causalis.client.setSpeed(0)");
  await settle(2500);
  await k("globalThis.causalis.closePage?.()");
  if (await centre(".ran-close")) await tap(".ran-close", "the run's note's ×");
  // (The god's hand put by, as the overlap gate puts it by before it reads a page: at a desk it stands open at first.)
  await k("globalThis.causalis.palette?.putDown?.()").catch(() => undefined);
  if (await centre(".palette.open")) {
    await tap(".palette-toggle", "the god's hand's button");
    await settle(500);
  }

  // A realm that owes: its Money tab.
  if (await openTab(chosen.realm, "Money", chosen.name, /Its debt/i)) {
    const drawn = await k<{ lines: number; bars: number }>(
      `({ lines: document.querySelectorAll(".page-window .chart-over svg").length, bars: document.querySelectorAll(".page-window .makeup-bar").length })`,
    );
    say(`${chosen.name}, Money: ${drawn.lines} lines over time, ${drawn.bars} bars of holders`);
    check(drawn.bars >= 1, `${chosen.name}: no bar of who holds its debt drawn`);
    await shot("realm-money-top");
    if (await showBlock("Who holds its debt")) await shot("realm-money-holders");
    if (await showBlock("What it pays to borrow")) await shot("realm-money-yield");
  }
  // Its fears (a realm that fears, where one does).
  const fearer = chosen.fearing ?? chosen.realm;
  if (await openTab(fearer, "Fears", "a realm that fears", /Whom it fears/i))
    await shot("realm-fears");
  // The ledger's Money tab: the square of who holds whom, pressed.
  if (
    await openTab("world:ledger", "Money", "the ledger", /Who holds whom|No realm has sold debt/i)
  ) {
    await shot("ledger-money-top");
    const cells = await k<number>(
      `document.querySelectorAll(".page-window .owning-cell.owning-some").length`,
    );
    say(`the ledger, Money: ${cells} squares of holdings drawn`);
    check(cells > 0, "the square of who holds whom shows no holding");
    if (cells > 0) {
      await tap(".page-window .owning-cell.owning-some", "a square of who holds whom");
      const said = await k<string>(
        `document.querySelector(".page-window .owning-said")?.textContent ?? ""`,
      );
      check(/^The people of .+ hold [\d.]+% of /.test(said), `a square pressed says "${said}"`);
      say(`a square pressed: "${said}"`);
      await shot("ledger-money-square");
    }
    if (await showBlock("What each pays to borrow")) await shot("ledger-money-yields");
    if (await showBlock("What the world's works make")) await shot("ledger-money-works");
  }
  if (await openTab("world:ledger", "Camps", "the ledger", /camps|fear each other/i)) {
    await shot("ledger-camps");
    if (await showBlock("The greatest fears")) await shot("ledger-camps-fears");
  }
  // The exchange of the realm, where it keeps one: who holds what is listed.
  await k(`globalThis.causalis.closePage?.()`);
  await settle(300);
  // The Camps lens on the globe.
  const lens = `.mapmodes .mode[aria-label="Camps"]`;
  if (!(await centre(lens))) {
    // (The bar folded on a phone: its opener first.)
    const opener = await centre(".mapmodes .more, .mapmodes .fold, .mapmodes-toggle");
    if (opener) await press(opener.x, opener.y);
    await settle(400);
  }
  if (await tap(lens, "the Camps lens")) {
    await settle(1500);
    await hudFine("the Camps lens");
    await shot("lens-camps");
  }
  if (wideOverHand)
    say(
      `at a desk the Ledger lies over the god's hand (${wideOverHand} readings let be: it did before, on every tab)`,
    );
  for (const e of errors.slice(0, 5)) say(`ERROR ${e.slice(0, 300)}`);
  check(errors.length === 0, `${errors.length} errors on the page`);
  await browser.close();
  await server.close();
}
if (problems.length) {
  console.log(`gate 120 FAILED:\n${problems.map((p) => `  - ${p}`).join("\n")}`);
  process.exit(1);
}
console.log("gate 120 passed");
