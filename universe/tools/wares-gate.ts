// node tools/wares-gate.ts [--ci] [--soft] [--shots dir] [--year n]: gate 113, what is sold under each good, and companies late in a world
// (asked 2026-11-12: "be specific what they sell like guns or cars etc ... or what type of food or plants they export ... stocks and stuff
// later on"). The first light's world run in node into its age of works and lending, taken up in the app at 430 by 932, by real touch:
//   1. the reading, node side: every land's every good it has splits into at most five named things whose shares make the whole, none
//      broken, nothing named that no land could make; a land's trade said as the things themselves; companies and an exchange with an index;
//      what each costs to read;
//   2. the board of the seat of the realm with the most companies listed, by its 🏷️ by touch: its broad rows as they were;
//   3. a row pressed by touch: its good's page opens on what is sold under it, its named things with their shares, and where each is from;
//   4. its land's economy: what it sends away and brings in, said as things, not as the broad goods;
//   5. the exchange from the board, by touch: its companies listed, each named for its town, and its index drawn;
//   6. pictures (asked 2026-11-12: "generaritv emergent visuals for like the stuff their selling"): each named thing on the good's page,
//      each line of trade and each company drawn from what it is, inked, two things not the same picture, a motor car not an arm, and a
//      grain of this world not a far world's; what a board with its pictures costs to open on the phone;
//   7. hashes the same after all of it, and no page errors.
import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { gzipSync } from "node:zlib";
import { preview } from "vite";
import { chromium, type Page } from "playwright";
import { YEAR, rulesetId, saveWorld, seedFromText, type World } from "../src/kernel/index.ts";
import { ALIEN, EARTH } from "../src/host/planet.ts";
import { GOODS, G } from "../src/rules/index.ts";
import {
  homePlanet,
  marketGoodRef,
  marketsOf,
  politiesOf,
  populationContext,
} from "../src/sim/index.ts";
import { WARES_SHOWN, tradeItems, tradeWords, waresOf } from "../src/host/inspect/wares.ts";
import { wareLook } from "../src/host/inspect/ware-looks.ts";
import { companiesOf, exchangeOf } from "../src/host/inspect/exchange.ts";
import { pageOf } from "../src/host/inspect/index.ts";

const argv = process.argv.slice(2),
  soft = argv.includes("--soft"),
  ci = argv.includes("--ci"),
  arg = (name: string) => {
    const at = argv.indexOf(name);
    return at >= 0 ? argv[at + 1] : undefined;
  },
  shots = arg("--shots"),
  firstYear = Number(arg("--year") ?? 650);
if (shots) mkdirSync(shots, { recursive: true });
const slow = (ms: number) => (ci || soft ? ms * 4 : ms);
const GPU = ["--enable-gpu", "--ignore-gpu-blocklist", "--use-angle=d3d11"];
const problems: string[] = [],
  check = (ok: boolean, what: string) => {
    if (!ok) problems.push(what);
  },
  say = (s: string) => console.log(`  ${s}`);
console.log("gate 113, what is sold under each good");

const plain = (l: readonly (string | { text: string })[]) =>
  l.map((s) => (typeof s === "string" ? s : s.text)).join("");
const broken = /undefined|NaN|\[object|\b(dwell|lot|bldg|cell|pol|mkt|dsgn|exchange):[0-9a-z]/;

// 1. The world, run in node until a realm keeps an exchange with companies enough to list.
const t0 = Date.now(),
  world = EARTH.build(seedFromText("first light"));
let best: NonNullable<ReturnType<typeof exchangeOf>> | null = null;
for (let y = firstYear; y <= 1300; y += 50) {
  world.runTo(y * YEAR);
  best =
    politiesOf(world)
      .living()
      .map((r) => exchangeOf(world, r.ref))
      .filter((e): e is NonNullable<typeof e> => !!e)
      .sort((a, b) => b.companies.length - a.companies.length || (a.realm < b.realm ? -1 : 1))[0] ??
    null;
  if (best && best.companies.length >= 4 && best.index.length >= 3) break;
}
const year = Math.floor(world.now / YEAR);
say(`first light run to ${year} in ${Math.round((Date.now() - t0) / 1000)} s`);
check(!!best, `no exchange by ${year}`);

/** Every land's every good, read: what a whole world says, not the two a gate opens. */
function tally(w: World): void {
  const ctx = populationContext(w),
    lands = ctx.provinces.all().filter((p) => p.total() > 0 && marketsOf(w).get(p.cell));
  let goods = 0,
    things = 0,
    generic = 0,
    companies = 0;
  const names = new Set<string>(),
    lines = new Map<string, number>();
  const t = performance.now();
  for (const p of lands) {
    for (let g = 0; g < GOODS.length; g++) {
      const ws = waresOf(w, p.cell, g);
      if (!ws.length) continue;
      goods++;
      const sum = ws.reduce((n, x) => n + x.share, 0);
      check(Math.abs(sum - 1) < 1e-6, `land ${p.cell} ${GOODS[g]!.id}: shares sum to ${sum}`);
      check(ws.length <= WARES_SHOWN + 1, `land ${p.cell} ${GOODS[g]!.id}: ${ws.length} things`);
      for (const x of ws) {
        things++;
        names.add(x.name);
        // (A metal is its own name: copper is copper. Any other good said only as itself is a thing not named.)
        if (x.name === GOODS[g]!.name && g !== G.copper && g !== G.tin && g !== G.iron) generic++;
        check(
          !broken.test(`${x.name} ${plain(x.from)}`),
          `a broken thing: ${x.name} ${plain(x.from)}`,
        );
      }
      // (Nothing no land of this world could make: no phones before machines in the pocket, no motor cars before engines.)
      if (g === G.machines)
        for (const x of ws)
          check(
            !/^phones$|^motor cars/.test(x.name) || year > 1000,
            `land ${p.cell}: ${x.name} at ${year}`,
          );
    }
    const out = tradeWords(w, p.cell, "out");
    if (out) {
      const text = plain(out.line);
      check(!broken.test(text), `a broken trade line: ${text}`);
      lines.set(text, (lines.get(text) ?? 0) + 1);
    }
    companies += companiesOf(w, p.cell).length;
  }
  const ms = performance.now() - t,
    top = [...lines].sort((a, b) => b[1] - a[1])[0];
  say(
    `${lands.length} lands, ${goods} goods held, ${things} things named (${names.size} different, ${generic} by the good's own name); ${companies} companies; read whole in ${Math.round(ms)} ms`,
  );
  say(`commonest export line: ${top ? `${top[1]} lands, "${top[0]}"` : "none"}`);
  check(names.size >= 30, `only ${names.size} different things over the world`);
  check(generic <= things * 0.1, `${generic} of ${things} things named only by their good`);
  check(
    !top || lands.length < 40 || top[1] <= lands.length * 0.15,
    `every land sends the same: ${top?.[1]} of ${lands.length}`,
  );
  check(companies > 0, "no companies");
}
tally(world);

// The town: the seat of the realm with the most companies listed, its market town.
const realm = best ? politiesOf(world).get(best.realm as never) : undefined,
  seatCell = realm?.seat ?? -1,
  town = best ? populationContext(world).settlements.get(best.town.ref as never) : undefined;
check(!!town, "no exchange town");
say(
  `${best?.name}: ${best?.companies.length} companies; index ${best?.index.map((x) => Math.round(x.value)).join(", ")}`,
);
// (What each page costs to read, first and again.)
for (const [what, ref] of [
  ["machines' page", marketGoodRef(seatCell, G.machines)],
  ["land's economy", `cell:0:${seatCell}#economy`],
  ["exchange", `exchange:${best?.realm}`],
] as const) {
  const a = performance.now();
  pageOf(world, ref);
  const b = performance.now();
  pageOf(world, ref);
  say(`${what}: ${(b - a).toFixed(1)} ms first, ${(performance.now() - b).toFixed(1)} ms again`);
}

const save = gzipSync(
  JSON.stringify(saveWorld(world, rulesetId(world, EARTH.version), { universe: "earth" })),
);
const root = fileURLToPath(new URL("..", import.meta.url)),
  server = await preview({ root, logLevel: "silent", preview: { port: 4330, strictPort: false } }),
  base = server.resolvedUrls!.local[0]!,
  browser = await chromium.launch({
    args: soft ? ["--use-angle=swiftshader", "--enable-unsafe-swiftshader"] : ci ? [] : GPU,
  });
const context = await browser.newContext({
    viewport: { width: 430, height: 932 },
    deviceScaleFactor: ci || soft ? 1 : 2,
    hasTouch: true,
    isMobile: true,
  }),
  page: Page = await context.newPage(),
  errors: string[] = [];
page.setDefaultTimeout(slow(60000));
page.on("pageerror", (e) => errors.push(`${e.message}\n${e.stack ?? ""}`));
page.on("console", (m) => {
  if (m.type() === "error") errors.push(m.text());
});
const k = <T>(code: string): Promise<T> => page.evaluate(code) as Promise<T>;
const until = async (what: string, ok: () => Promise<boolean>, ms = slow(25000)) => {
  const end = Date.now() + ms;
  while (Date.now() < end) {
    if (await ok().catch(() => false)) return true;
    await page.waitForTimeout(80);
  }
  problems.push(`${what} did not come`);
  return false;
};
const ask = <T>(type: string, args: unknown = {}) =>
  k<T>(
    `globalThis.causalis.client.query({ type: ${JSON.stringify(type)}, args: ${JSON.stringify(args)} })`,
  );
const shot = async (name: string) => {
  if (shots) await page.screenshot({ path: join(shots, `${name}.png`) });
};
const pageText = () => k<string>(`document.querySelector(".page-window")?.innerText ?? ""`);
const pageIs = () => k<string>(`String(globalThis.causalis.pageOpen() ?? "")`);
const pageSeen = () =>
  k<boolean>(
    `(() => { const r = document.querySelector(".page-window")?.getBoundingClientRect(); return !!r && r.height > 40 && r.width > 40; })()`,
  );

/** The small pictures under a selector, once drawn (ui/thumbs.ts draws one as it comes on screen): each one's inked pixels, and a sum to tell them apart. */
const pictures = (selector: string) =>
  k<
    { drawn: boolean; inked: number; sum: number }[]
  >(`[...document.querySelectorAll(${JSON.stringify(selector)})].map((c) => {
    const r = c.getBoundingClientRect();
    if (!(r.width > 0) || c.dataset.drawn !== "1") return { drawn: false, inked: 0, sum: 0 };
    const d = c.getContext("2d").getImageData(0, 0, c.width, c.height).data;
    let inked = 0, sum = 0;
    for (let i = 0; i < d.length; i += 4) if (d[i + 3] > 40) { inked++; sum = (sum * 31 + d[i] * 7 + d[i + 1] * 3 + d[i + 2] + i) % 1000000007; }
    return { drawn: true, inked, sum };
  })`);
/** Wait for the pictures under a selector that are to be seen (a finger at the middle of one would touch it) to be drawn, then read them. */
async function drawnPictures(selector: string, what: string) {
  await until(`${what}'s pictures drawn`, async () => {
    const on = await k<number>(
      `[...document.querySelectorAll(${JSON.stringify(selector)})].filter((c) => { const r = c.getBoundingClientRect(); return r.width > 0 && document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2) === c && c.dataset.drawn !== "1"; }).length`,
    );
    return on === 0;
  });
  return (await pictures(selector)).filter((p) => p.drawn);
}

/** Press what is at a thing's real place on the phone: scrolled to, at a thumb's size, on the screen, and the thing a finger there would touch. */
async function pressEl(find: string, what: string): Promise<boolean> {
  const where = () =>
    k<{ x: number; y: number; w: number; h: number; top: boolean; over: string } | null>(`(() => {
    const e = (${find})();
    if (!e) return null;
    e.scrollIntoView({ block: "center" });
    const r = e.getBoundingClientRect();
    if (!(r.width > 0 && r.height > 0)) return null;
    const x = r.x + r.width / 2, y = r.y + r.height / 2, at = document.elementFromPoint(x, y);
    return { x, y, w: r.width, h: r.height, top: !!at && (at === e || e.contains(at)), over: at ? String(at.className || at.tagName) : "" };
  })()`);
  let at = await where();
  if (!at) {
    problems.push(`nothing to press: ${what}`);
    return false;
  }
  for (let i = 0; i < 40; i++) {
    await page.waitForTimeout(slow(100));
    const now = await where();
    if (!now) break;
    if (now.x === at.x && now.y === at.y) break;
    at = now;
  }
  check(at.h >= 44 && at.w >= 44, `${what} is ${Math.round(at.w)} by ${Math.round(at.h)} px`);
  check(
    at.x - at.w / 2 >= -1 && at.x + at.w / 2 <= 431 && at.y > 0 && at.y < 932,
    `${what} lies off the screen`,
  );
  check(at.top, `${what} lies under ${at.over}`);
  await page.touchscreen.tap(at.x, at.y);
  await page.waitForTimeout(slow(300));
  return true;
}
const bySelector = (selector: string) =>
  `() => { for (const e of document.querySelectorAll(${JSON.stringify(selector)})) { const r = e.getBoundingClientRect(); if (r.width > 0 && r.height > 0) return e; } return null; }`;
const rowNamed = (words: string) =>
  `() => { for (const e of document.querySelectorAll(".page-window .board-row")) { const r = e.getBoundingClientRect(); const n = e.querySelector(".board-name"); if (r.width > 0 && r.height > 0 && n && new RegExp(${JSON.stringify(words)}, "i").test(n.textContent)) return e; } return null; }`;

async function loadSave(bytes: Buffer) {
  const name = "earth:gate113",
    q = `universe=earth&seed=${encodeURIComponent("first light")}`;
  await page.goto(`${base}?${q}&hold=1`);
  await page.waitForFunction(
    () => !!(globalThis as { causalis?: { client?: unknown } }).causalis?.client,
    undefined,
    {
      timeout: slow(120000),
    },
  );
  await page.waitForFunction(
    () => ((globalThis as { causalis?: { drawn?: () => number } }).causalis?.drawn?.() ?? 0) > 0,
    undefined,
    { timeout: slow(180000) },
  );
  await page.evaluate(
    async ([data, keep]) => {
      const b = Uint8Array.from(atob(data as string), (c) => c.charCodeAt(0));
      const c = (
        globalThis as unknown as {
          causalis: {
            client: {
              importSave(b: Uint8Array): Promise<unknown>;
              save(n: string): Promise<unknown>;
            };
          };
        }
      ).causalis.client;
      await c.importSave(b);
      await c.save(keep as string);
    },
    [bytes.toString("base64"), name],
  );
  await page.goto(`${base}?${q}&load=${encodeURIComponent(name)}&hold=1`);
  await page.waitForFunction(
    () => ((globalThis as { causalis?: { drawn?: () => number } }).causalis?.drawn?.() ?? 0) > 0,
    undefined,
    { timeout: slow(180000) },
  );
  await page.waitForTimeout(slow(600));
}

if (town && best) {
  await loadSave(save);
  await k(`globalThis.causalis.goTo(${JSON.stringify(town.ref)})`);
  await until(
    "the town",
    () =>
      k<boolean>(
        `globalThis.causalis.scale() === "village" && globalThis.causalis.planNow()?.ref === ${JSON.stringify(town.ref)}`,
      ),
    slow(60000),
  );
  await page.waitForTimeout(slow(800));
  const before = JSON.stringify(await ask<unknown>("hashes"));
  await k("globalThis.causalis.closePage?.()");

  // 2. The board by its 🏷️, by touch: its broad rows. (Timed from the press to its pictures on screen drawn.)
  const pressed = Date.now();
  await pressEl(bySelector(".town-board"), "the board's button");
  await until("the board", async () => (await pageIs()).startsWith("board:"));
  const boardPics = await drawnPictures(".page-window canvas.thumb", "the board");
  const opened = Date.now() - pressed - slow(300);
  await page.waitForTimeout(slow(500));
  await shot("board");
  say(
    `the board open with its pictures in ${opened} ms after the press (${boardPics.length} pictures drawn so far)`,
  );
  const rows = await k<string[]>(
    `[...document.querySelector(".page-window .price-board")?.querySelectorAll(".board-row .board-name") ?? []].map((e) => e.innerText.split("\\n")[0])`,
  );
  say(`${town.name}'s board: ${rows.join(", ")}`);
  check(rows.length >= 6, `the board has ${rows.length} rows`);
  check(
    rows.every(
      (r) => GOODS.some((g) => r.toLowerCase().startsWith(g.name)) || /arsenic|tin/i.test(r),
    ),
    `the board's rows are no longer the broad goods: ${rows.join(", ")}`,
  );
  const boardText = await pageText();
  check(
    /sends away/i.test(boardText),
    `the board does not say what its land sends away: ${boardText.slice(0, 300)}`,
  );
  // (Its land's sends, each with a picture of what went, drawn.)
  await k(
    `document.querySelector(".page-window .entry canvas.thumb")?.scrollIntoView({ block: "center" })`,
  );
  const sent = await drawnPictures(".page-window .entry canvas.thumb", "the board's trade");
  check(
    sent.length > 0 && sent.every((p) => p.inked > 30),
    `the board's trade lines are not drawn: ${JSON.stringify(sent)}`,
  );

  // 3. A row by touch: its good's page opens on what is sold under it.
  const line =
    rows.find((r) => /^Machines/.test(r)) ?? rows.find((r) => /^Tools/.test(r)) ?? rows[0]!;
  await pressEl(rowNamed(`^${line}`), `the line for ${line}`);
  await until(`${line}'s page`, async () => (await pageIs()).startsWith("mkt:"));
  await page.waitForTimeout(slow(500));
  await shot("good");
  const parts = await k<{ name: string; share: string; left: number; right: number }[]>(
    `[...document.querySelector(".page-window .page-body")?.querySelectorAll(".makeup-row") ?? []].map((e) => { const r = e.getBoundingClientRect(); return { name: e.innerText.replace(/\\s+/g, " "), share: e.querySelector(".makeup-share")?.innerText ?? "", left: r.left, right: r.right }; })`,
  );
  const goodText = await pageText();
  say(`${line}: ${parts.map((p) => p.name).join(" | ")}`);
  // (Each named thing with its picture, drawn from what it is; no two things the same picture.)
  const pics = await drawnPictures(".page-window .makeup-thumb", `${line}'s things`),
    named0 = parts.filter((p) => !/^and others/i.test(p.name));
  say(`${line}: ${pics.length} pictures, inked ${pics.map((p) => p.inked).join(", ")}`);
  check(
    pics.length >= named0.length && pics.every((p) => p.inked > 30),
    `${line}'s things are not all drawn: ${pics.length} of ${named0.length}`,
  );
  check(
    pics.length < 2 || new Set(pics.map((p) => p.sum)).size === pics.length,
    `two of ${line}'s things are the same picture`,
  );
  check(/What is sold as/i.test(goodText), `${line}'s page does not say what is sold under it`);
  check(parts.length >= 2, `${line}'s page names ${parts.length} things`);
  check(parts.length <= WARES_SHOWN + 1, `${line}'s page names ${parts.length} things, too many`);
  check(
    parts.every((p) => /\d%/.test(p.share)),
    `a thing without its share: ${parts.map((p) => p.share).join(",")}`,
  );
  check(
    parts.every((p) => p.left >= 0 && p.right <= 430),
    "a thing runs off the phone",
  );
  check(!broken.test(goodText), `a broken word on ${line}'s page: ${goodText.slice(0, 300)}`);
  const named = waresOf(world, seatCell, line.startsWith("Machines") ? G.machines : G.tools).filter(
    (w) => w.key !== "others",
  );
  check(
    named.length > 0 && named.every((w) => goodText.toLowerCase().includes(w.name.toLowerCase())),
    `${line}'s page does not show the things read: ${named.map((w) => w.name).join(", ")}`,
  );

  // 3b. A thing's picture pressed by touch: drawn large over the page, with the detail a thumbnail leaves out, and shut by its ✕.
  if (pics.length) {
    await pressEl(
      `() => document.querySelector(".page-window .makeup-thumb")`,
      "a thing's picture",
    );
    await until("the picture drawn large", () =>
      k<boolean>(`!!document.querySelector(".thumb-zoom canvas")`),
    );
    await page.waitForTimeout(slow(400));
    await shot("zoom");
    const big = await k<{ w: number; inked: number; label: string; page: string }>(`(() => {
      const c = document.querySelector(".thumb-zoom canvas"), r = c.getBoundingClientRect(), d = c.getContext("2d").getImageData(0, 0, c.width, c.height).data;
      let inked = 0;
      for (let i = 0; i < d.length; i += 4) if (d[i + 3] > 40) inked++;
      return { w: r.width, inked, label: document.querySelector(".thumb-zoom-words")?.textContent ?? "", page: String(globalThis.causalis.pageOpen() ?? "") };
    })()`);
    say(
      `a thing's picture large: ${Math.round(big.w)} px across, ${big.inked} px inked, "${big.label.slice(0, 60)}"`,
    );
    check(big.w >= 300, `the large picture is ${Math.round(big.w)} px across`);
    check(
      big.inked > 20 * Math.max(...pics.map((p) => p.inked)),
      `the large picture inks ${big.inked} px, no more than a thumbnail`,
    );
    check(big.label.length > 3, "the large picture says nothing of what it is");
    check(big.page.startsWith("mkt:"), `pressing the picture left its page for ${big.page}`);
    await pressEl(`() => document.querySelector(".thumb-zoom-close")`, "the large picture's ✕");
    check(
      !(await k<boolean>(`!!document.querySelector(".thumb-zoom")`)),
      "the large picture does not shut by its ✕",
    );
  }

  // 4. Its land's economy: what it sends and brings, as things.
  await k(`globalThis.causalis.open(${JSON.stringify(`cell:0:${seatCell}#economy`)})`);
  await page.waitForTimeout(slow(700));
  await shot("economy");
  const econ = await pageText();
  const sends = /Sends away\s*([^\n]+)/i.exec(econ)?.[1] ?? "",
    brings = /Brings in\s*([^\n]+)/i.exec(econ)?.[1] ?? "";
  say(`sends away: ${sends}`);
  say(`brings in: ${brings}`);
  check(!!(sends || brings), `the land's economy says nothing of its trade: ${econ.slice(0, 300)}`);
  // (As read in node, and in things, not only in the broad goods' names.)
  const flat = (s: string) => s.replace(/\s+/g, " ").trim(),
    expected = [tradeItems(world, seatCell, "out"), tradeItems(world, seatCell, "in")]
      .flatMap((x) => x?.items ?? [])
      .map((x) => flat(plain(x.line)));
  check(
    expected.length > 0 && expected.every((x) => flat(econ).includes(x)),
    `the land's trade is not as read: ${expected.join(" | ")}`,
  );
  check(
    expected.some((x) => !GOODS.some((g) => x.replace(/ (to|from) .*$/, "") === g.name)),
    `the trade is said only as broad goods: ${expected.join(" | ")}`,
  );
  await k(
    `document.querySelector(".page-window .entry canvas.thumb")?.scrollIntoView({ block: "center" })`,
  );
  const tradePics = await drawnPictures(".page-window .entry canvas.thumb", "the land's trade");
  check(
    tradePics.length > 0 && tradePics.every((p) => p.inked > 30),
    "the land's trade lines are not drawn",
  );
  if (companiesOf(world, seatCell).length)
    check(/companies/i.test(econ), "the land's economy lists no companies");

  // 5. The exchange from the board, by touch.
  await k(`globalThis.causalis.open(${JSON.stringify(`board:${town.ref}`)})`);
  await page.waitForTimeout(slow(600));
  // (Timed from the tap to its board's marks on screen drawn: a board with its pictures, on the phone.)
  await pressEl(rowNamed("Exchange"), "the exchange's line");
  const tapped = Date.now() - slow(300);
  await until("the exchange", async () => (await pageIs()).startsWith("exchange:"));
  const onScreen = await drawnPictures(".page-window .board-thumb", "the exchange's board");
  say(
    `the exchange's board open with its ${onScreen.length} marks on screen drawn ${Date.now() - tapped} ms after the tap`,
  );
  await page.waitForTimeout(slow(600));
  check(await pageSeen(), "the exchange is not to be seen");
  await shot("exchange");
  const listed = await k<string[]>(
    `[...document.querySelector(".page-window .price-board")?.querySelectorAll(".board-row .board-name") ?? []].map((e) => e.innerText.split("\\n")[0])`,
  );
  const chart = await k<boolean>(
    `!!document.querySelector(".page-window figure.chart svg, .page-window figure.chart canvas")`,
  );
  const exText = await pageText();
  say(`the exchange lists: ${listed.slice(0, 6).join(", ")}${listed.length > 6 ? ", ..." : ""}`);
  check(listed.length >= 2, `the exchange lists ${listed.length} companies`);
  // (Shared out: no more than three of one making on its board, or one land's tool works would be all of it.)
  {
    const by = new Map<string, number>();
    for (const n of listed) {
      const c = best!.companies.find((x) => x.name === n),
        making = c?.town ? n.slice(c.town.name.length) : n;
      by.set(making, (by.get(making) ?? 0) + 1);
    }
    check(
      [...by.values()].every((n) => n <= 3),
      `one making fills the exchange: ${[...by].map(([m, n]) => `${m} ${n}`).join(", ")}`,
    );
  }
  check(
    listed.every((n) => best!.companies.some((c) => c.name === n)),
    `a listed company is not one read: ${listed.join(", ")}`,
  );
  check(chart, "the exchange draws no index");
  check(
    /index/i.test(exText) && /coin a share/.test(exText),
    `the exchange does not say its index or prices: ${exText.slice(0, 300)}`,
  );
  check(!broken.test(exText), `a broken word on the exchange: ${exText.slice(0, 300)}`);
  // (Each company's mark: its realm's shield and what it makes; two makings, two marks.)
  const marks = await drawnPictures(".page-window .board-thumb", "the exchange's companies");
  say(`the exchange: ${marks.length} marks drawn, inked ${marks.map((p) => p.inked).join(", ")}`);
  check(
    marks.length >= 2 && marks.every((p) => p.inked > 60),
    `the companies' marks are not drawn: ${marks.length}`,
  );
  check(new Set(marks.map((p) => p.sum)).size >= 2, "every company has the same mark");
  // (A company pressed: what its land makes of its good.)
  await pressEl(bySelector(".page-window .board-row"), "a company");
  await until("its good", async () => (await pageIs()).startsWith("mkt:"));
  await page.waitForTimeout(slow(400));
  await shot("company");
  check(/what is sold as/i.test(await pageText()), "a company does not lead to what is made");
  await k("globalThis.causalis.closePage?.()");

  // 6. Two things, two pictures, as the app draws them: a motor car of this land's works against an arm of its realm's host; this
  // world's grain against a far world's (alien 7's, built, its life's own colour).
  {
    const picture = (p: unknown) =>
      k<{ inked: number; sum: number }>(`globalThis.causalis.picture(${JSON.stringify(p)}, 28)`);
    const car = wareLook(world, seatCell, G.machines, { key: "machine:cars", ref: null }),
      arm = politiesOf(world)
        .living()
        .flatMap((r) => [...r.members])
        .flatMap((c) =>
          [G.tools, G.machines].flatMap((g) =>
            waresOf(world, c, g)
              .filter((w) => w.key.startsWith("arms:"))
              .map((w) => ({ c, g, w })),
          ),
        )[0],
      armLook = arm ? wareLook(world, arm.c, arm.g, arm.w) : null,
      far = ALIEN.build(seedFromText("alien 7")),
      grassOf = (w: World) =>
        homePlanet(w).generated.life.species.find((s) => s.niche === "seed grass")!,
      mine = grassOf(world),
      theirs = grassOf(far),
      grainHere = wareLook(world, seatCell, G.grain, { key: `grass:${mine.index}`, ref: mine.ref }),
      grainThere = wareLook(far, 0, G.grain, { key: `grass:${theirs.index}`, ref: theirs.ref });
    const [a, b, c, d] = await Promise.all([car, armLook, grainHere, grainThere].map(picture));
    say(
      `a motor car ${a!.inked} px, ${arm?.w.name ?? "no arm"} ${b!.inked} px; ${mine.name} ${c!.inked} px, alien 7's ${theirs.name} ${d!.inked} px`,
    );
    check(
      a!.inked > 30 && b!.inked > 30 && a!.sum !== b!.sum,
      "a motor car and an arm drawn the same, or not at all",
    );
    check(
      c!.inked > 30 && d!.inked > 30 && c!.sum !== d!.sum,
      "two worlds' grain drawn the same, or not at all",
    );
    const times = await k<{ drawn: number; ms: number }>("globalThis.causalis.pictureTimes()");
    say(
      `pictures drawn on pages: ${times.drawn}, ${times.ms.toFixed(1)} ms in all (${(times.ms / Math.max(1, times.drawn)).toFixed(2)} ms each)`,
    );
  }

  const after = JSON.stringify(await ask<unknown>("hashes"));
  check(before === after, "reading moved history");
  say(`hashes ${before === after ? "the same" : "MOVED"}`);
}

for (const e of errors) problems.push(`page error: ${e.slice(0, 400)}`);
await browser.close();
await server.close();
if (problems.length) {
  console.log(`gate 113: ${problems.length} problems`);
  for (const p of problems) console.log(`  x ${p}`);
  process.exit(1);
}
console.log("gate 113: passed");
process.exit(0);
