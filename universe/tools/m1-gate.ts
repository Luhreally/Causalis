// node tools/m1-gate.ts [--ci] [--soft] [--shots dir] [--save file.save] [--universe earth|alien] [--seed text] [--alien file.save]: gate 92, a town's price board and what it is known for (Markets, first slice), at a phone's size, by real touch.
// On far saves, else (as on CI) a young world run a few decades:
//   1. the reading, node side: every town of the world tallied: what it is known for must differ, its numbers a person's; a good with no price, a town gone, and a land with no one say so;
//   2. 🏷️ pressed by touch in the town: its board on the screen, its lines at a thumb's size and inside the phone, read off the real screen; hashes the same;
//   3. one reading: a loaf on the board is a loaf on a person's page, a good's page says the board's price;
//   4. a line pressed by touch: its good's page, the chain that made it, where it is cheap and dear, a market on that list its own board;
//   5. the square pressed by touch at its real screen place: the board;
//   6. the town's page: what it is known for, its board by touch;
//   7. the paths nobody watches: a town at war, a lesser town, a ghost, a colony, a water people, one lived as (from their own page, by touch, their day held).
import { mkdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { gunzipSync, gzipSync } from "node:zlib";
import { preview } from "vite";
import { chromium, type Page } from "playwright";
import {
  YEAR,
  loadWorld,
  rulesetId,
  saveWorld,
  seedFromText,
  type World,
} from "../src/kernel/index.ts";
import { ALIEN, EARTH } from "../src/host/planet.ts";
import {
  boardOf,
  boardPage,
  dearPage,
  goodCoin,
  knownInLand,
  timesWords,
} from "../src/host/inspect/board.ts";
import { coinWords } from "../src/host/inspect/living.ts";
import { G } from "../src/rules/index.ts";
import { marketsOf, politiesOf, populationContext, warsOf } from "../src/sim/index.ts";

const argv = process.argv.slice(2),
  soft = argv.includes("--soft"),
  ci = argv.includes("--ci"),
  arg = (name: string) => {
    const at = argv.indexOf(name);
    return at >= 0 ? argv[at + 1] : undefined;
  },
  shots = arg("--shots"),
  saveFile = arg("--save"),
  saveUniverse = (arg("--universe") ?? "alien") as "earth" | "alien",
  alienFile = arg("--alien");
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
console.log("gate 92, a town's price board");

type Forged = {
  readonly bytes: Buffer;
  readonly universe: "earth" | "alien";
  readonly seed: string;
};
const pack = (world: World, universe: "earth" | "alien"): Forged => {
  const u = universe === "earth" ? EARTH : ALIEN;
  return {
    bytes: gzipSync(
      JSON.stringify(saveWorld(world, rulesetId(world, u.version), { universe: u.name })),
    ),
    universe,
    seed: world.seed.text,
  };
};
const fromFile = (file: string, universe: "earth" | "alien"): World => {
  const u = universe === "earth" ? EARTH : ALIEN,
    doc = JSON.parse(gunzipSync(readFileSync(file)).toString("utf8")) as Parameters<
      typeof loadWorld
    >[0],
    probe = u.build(seedFromText(doc.seed));
  return loadWorld(doc, (s) => u.build(s), rulesetId(probe, u.version), {
    allowRulesetChange: true,
  }).world;
};

/** 1. Every town of a world tallied, node side. A rule that looks fine on the two towns a gate opens has been wrong on a whole world. */
function tally(world: World, name: string, young: boolean): void {
  const ctx = populationContext(world),
    lands = ctx.provinces.all().filter((p) => p.total() > 0),
    said = new Map<string, number>(),
    byRealm = new Map<string, Map<string, number>>();
  let towns = 0,
    silent = 0,
    thin = 0,
    boards = 0,
    lo = Infinity,
    hi = 0;
  for (const p of lands) {
    const known = knownInLand(world, p.cell),
      realm = politiesOf(world).of(p.cell)?.ref ?? `land:${p.cell}`,
      rt = byRealm.get(realm) ?? new Map<string, number>();
    byRealm.set(realm, rt);
    const seen = ctx.settlements.seenIn(p.cell);
    for (const s of seen) {
      if (s.population <= 0) continue;
      towns++;
      const k = known.get(s.ref) ?? [];
      if (!k.length) silent++;
      const line = k.map((x) => x.words).join(", and ");
      said.set(line, (said.get(line) ?? 0) + 1);
      rt.set(k[0]?.words ?? "", (rt.get(k[0]?.words ?? "") ?? 0) + 1);
      check(
        !/undefined|NaN|\[object|\b(dwell|lot|bldg|cell|pol|mkt):[0-9a-z]/.test(line),
        `${name}: a broken word in "${line}"`,
      );
    }
    const first = seen[0];
    const b = first ? boardOf(world, p.cell, first.ref, first.name) : null;
    if (b) {
      boards++;
      if (b.rows.length < 3) thin++;
      for (const r of b.rows) {
        check(
          !/undefined|NaN/.test(`${r.name} ${r.each} ${r.price} ${r.words} ${r.trend}`),
          `${name}: a broken line on ${first!.name}: ${r.name} ${r.price}`,
        );
        const n = Number(r.price.replace(/[^0-9.]/g, ""));
        if (n > 0) {
          lo = Math.min(lo, n);
          hi = Math.max(hi, n);
        }
      }
    }
  }
  const top = [...said].sort((a, b) => b[1] - a[1])[0],
    shareTop = top ? top[1] / Math.max(1, towns) : 0;
  let worst = 0,
    worstLine = "";
  for (const [r, m] of byRealm) {
    const sum = [...m.values()].reduce((a, b) => a + b, 0);
    if (sum < 12) continue;
    const t = [...m].sort((a, b) => b[1] - a[1])[0]!;
    if (t[1] / sum > worst) {
      worst = t[1] / sum;
      worstLine = `${r}: ${t[1]} of ${sum}, "${t[0]}"`;
    }
  }
  say(
    `${name}: ${towns} towns, ${said.size} sentences; commonest ${(shareTop * 100).toFixed(1)}%: "${top?.[0]}"; worst realm ${(worst * 100).toFixed(0)}% (${worstLine}); ${silent} silent; boards ${boards}, ${thin} under 3 lines; numbers ${lo} to ${hi}`,
  );
  if (towns > 40) {
    check(
      shareTop < (young ? 0.5 : 0.15),
      `${name}: every town says one thing: ${(shareTop * 100).toFixed(0)}% "${top?.[0]}"`,
    );
    check(
      said.size >= Math.min(30, towns / 8),
      `${name}: only ${said.size} sentences over ${towns} towns`,
    );
    if (!young) check(worst < 0.5, `${name}: a realm says one thing: ${worstLine}`);
  }
  check(silent <= towns * 0.02, `${name}: ${silent} of ${towns} towns are known for nothing`);
  if (boards) {
    check(lo >= 0.1 && hi < 20000, `${name}: a number no one would use: ${lo} to ${hi}`);
    check(thin <= boards * 0.1, `${name}: ${thin} of ${boards} boards under 3 lines`);
  }
}

// The paths with nothing to read, pure.
{
  check(
    timesWords(1.01) === "about the same" &&
      timesWords(2) === "twice that" &&
      timesWords(9) === "9 times that",
    "times in words are wrong",
  );
  const empty = EARTH.build(seedFromText("first light"));
  const none = boardPage(empty, "board:town:0:999999");
  check(none.tabs.length === 1 && none.title === "A market board", "a town gone has a board");
  const d = dearPage(empty, "dear:zz:yy");
  check(d.title === "A market board", "a nonsense good has a page");
  const atZero = dearPage(empty, "dear:0:0");
  check(atZero.tabs.length >= 1, "no one on the world: no page of where a good is dear");
  say(`no one yet: "${JSON.stringify(atZero.tabs[0]?.blocks[0]).slice(0, 90)}"`);
}

const root = fileURLToPath(new URL("..", import.meta.url)),
  server = await preview({ root, logLevel: "silent", preview: { port: 4292, strictPort: false } }),
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

async function loadSave(f: Forged) {
  const name = `${f.universe}:gate92`,
    q = `universe=${f.universe}&seed=${encodeURIComponent(f.seed)}`;
  await page.goto(`${base}?${q}&hold=1`);
  await page.waitForFunction(
    () => !!(globalThis as { causalis?: { client?: unknown } }).causalis?.client,
    undefined,
    { timeout: slow(120000) },
  );
  await page.waitForFunction(
    () => ((globalThis as { causalis?: { drawn?: () => number } }).causalis?.drawn?.() ?? 0) > 0,
    undefined,
    { timeout: slow(180000) },
  );
  await page.evaluate(
    async ([data, keep]) => {
      const bytes = Uint8Array.from(atob(data as string), (c) => c.charCodeAt(0));
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
      await c.importSave(bytes);
      await c.save(keep as string);
    },
    [f.bytes.toString("base64"), name],
  );
  await page.goto(`${base}?${q}&load=${encodeURIComponent(name)}&hold=1`);
  await page.waitForFunction(
    () => ((globalThis as { causalis?: { drawn?: () => number } }).causalis?.drawn?.() ?? 0) > 0,
    undefined,
    { timeout: slow(180000) },
  );
  await page.waitForTimeout(slow(600));
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
    `${what} lies off the screen, at ${Math.round(at.x)}, ${Math.round(at.y)}, ${Math.round(at.w)} wide`,
  );
  check(at.top, `${what} lies under ${at.over}`);
  await page.touchscreen.tap(at.x, at.y);
  await page.waitForTimeout(slow(300));
  return true;
}
/** A tab of the page by touch at its real place (tabs keep the size they have across the game). */
async function tapTab(label: string): Promise<boolean> {
  const at = await k<{ x: number; y: number; top: boolean } | null>(`(() => {
    const e = [...document.querySelectorAll(".page-window .tabs .tab")].find((b) => b.textContent.includes(${JSON.stringify(label)}));
    if (!e) return null;
    e.scrollIntoView({ block: "nearest" });
    const r = e.getBoundingClientRect(), x = r.x + r.width / 2, y = r.y + r.height / 2, at = document.elementFromPoint(x, y);
    return { x, y, top: !!at && (at === e || e.contains(at)) };
  })()`);
  if (!at) return false;
  check(at.top, `the tab ${label} lies under something`);
  await page.touchscreen.tap(at.x, at.y);
  await page.waitForTimeout(slow(500));
  return true;
}
const bySelector = (selector: string) =>
  `() => { for (const e of document.querySelectorAll(${JSON.stringify(selector)})) { const r = e.getBoundingClientRect(); if (r.width > 0 && r.height > 0) return e; } return null; }`;
const byWords = (selector: string, words: string) =>
  `() => { for (const e of document.querySelectorAll(${JSON.stringify(selector)})) { const r = e.getBoundingClientRect(); if (r.width > 0 && r.height > 0 && new RegExp(${JSON.stringify(words)}, "i").test(e.textContent)) return e; } return null; }`;

/** A row of the page's board by its name. */
const rowNamed = (words: string) =>
  `() => { for (const e of document.querySelectorAll(".page-window .board-row")) { const r = e.getBoundingClientRect(); const n = e.querySelector(".board-name"); if (r.width > 0 && r.height > 0 && n && new RegExp(${JSON.stringify(words)}, "i").test(n.textContent)) return e; } return null; }`;

const pageText = () => k<string>(`document.querySelector(".page-window")?.innerText ?? ""`);
const pageIs = () => k<string>(`String(globalThis.causalis.pageOpen() ?? "")`);
const pageSeen = () =>
  k<boolean>(`(() => {
    const r = document.querySelector(".page-window")?.getBoundingClientRect();
    return !!r && r.height > 40 && r.width > 40;
  })()`);
const closePage = async () => {
  await k("globalThis.causalis.closePage?.()");
  await page.waitForTimeout(slow(200));
};
const readWell = (text: string, where: string) => {
  check(
    !/\b(dwell|dwelt|lot|bldg|folk|agent|prsn|rule|court|seat|board|dear|mkt|cell|pol):[a-z0-9]/i.test(
      text,
    ),
    `a raw ref on ${where}: ${text.slice(0, 300)}`,
  );
  check(
    !/\b1 (roads|coasts|bars|tools|loaves|people|years)\b/.test(text),
    `"1 ..." wrong on ${where}: ${text.slice(0, 300)}`,
  );
  check(
    !/\b0 coin\b|\b0\.0 coin\b/.test(text),
    `a zero counted on ${where}: ${text.slice(0, 400)}`,
  );
  check(
    !/undefined|NaN|\[object|\d\.\d{3,}/.test(text),
    `a broken word on ${where}: ${text.slice(0, 300)}`,
  );
};
const openPage = async (ref: string, name: string): Promise<string> => {
  await k(`globalThis.causalis.open(${JSON.stringify(ref)})`);
  await page.waitForTimeout(slow(500));
  await shot(name);
  const text = await pageText();
  readWell(text, name);
  check(await pageSeen(), `${name}: the page is not to be seen`);
  return text;
};
async function goDown(ref: string): Promise<void> {
  await k(`globalThis.causalis.goTo(${JSON.stringify(ref)})`);
  await until(
    "the town",
    () =>
      k<boolean>(
        `globalThis.causalis.scale() === "village" && globalThis.causalis.planNow()?.ref === ${JSON.stringify(ref)}`,
      ),
    slow(60000),
  );
  await page.waitForTimeout(slow(800));
}
type BoardSeen = {
  known: string;
  coin: string;
  rows: { name: string; price: string; tag: string; left: number; right: number; h: number }[];
  height: number;
};
const boardSeen = () =>
  k<BoardSeen | null>(`(() => {
    const b = document.querySelector(".page-window .price-board");
    if (!b) return null;
    const r = b.getBoundingClientRect();
    return {
      known: b.querySelector(".board-known")?.innerText ?? "",
      coin: b.querySelector(".board-coin")?.innerText ?? "",
      height: r.height,
      rows: [...b.querySelectorAll(".board-row")].map((e) => {
        const q = e.getBoundingClientRect();
        return {
          name: e.querySelector(".board-name")?.innerText ?? "",
          price: e.querySelector(".board-price")?.innerText ?? "",
          tag: e.querySelector(".board-tag")?.innerText ?? "",
          left: q.left,
          right: q.right,
          h: q.height,
        };
      }),
    };
  })()`);
const boardWell = (b: BoardSeen | null, where: string, known = true): void => {
  check(!!b, `${where}: no board`);
  if (!b) return;
  check(b.height > 60, `${where}: the board is not to be seen`);
  if (known)
    check(
      /^Known for /.test(b.known),
      `${where}: its board does not say what it is known for: "${b.known}"`,
    );
  for (const r of b.rows) {
    check(r.h >= 44, `${where}: ${r.name} is ${Math.round(r.h)} px tall`);
    check(
      r.left >= 0 && r.right <= 430,
      `${where}: ${r.name} runs off the phone, ${Math.round(r.left)} to ${Math.round(r.right)}`,
    );
    check(/\d|told in|no price/.test(r.price), `${where}: ${r.name} has no price: "${r.price}"`);
    check(!!r.tag, `${where}: ${r.name} is not said to be dear or cheap`);
    check(!/ratio/i.test(`${r.price} ${r.tag}`), `${where}: "ratio" on a row`);
  }
};

/** A walk through one world's town, by touch. */
async function walk(world: World, f: Forged, name: string, young: boolean): Promise<void> {
  const ctx = populationContext(world),
    towns = ctx.provinces
      .all()
      .filter((p) => p.total() > 0)
      .flatMap((p) => ctx.settlements.seenIn(p.cell))
      .filter((s) => s.population > 0)
      .sort((a, b) => b.population - a.population);
  const town = towns.find((s) => s.market) ?? towns[0];
  check(!!town, `${name}: no town`);
  if (!town) return;
  say(`${name}: ${town.name}, ${town.population} people, land ${town.cell}`);
  await loadSave(f);
  await goDown(town.ref);
  const before = JSON.stringify(await ask<unknown>("hashes"));
  await closePage();

  // 2. 🏷️ by touch.
  await pressEl(bySelector(".town-board"), "the board's button");
  await until("the board", async () => (await pageIs()).startsWith("board:"));
  await page.waitForTimeout(slow(500));
  check(await pageSeen(), `${name}: the board's page is not to be seen`);
  await shot(`${name}-board`);
  const b = await boardSeen();
  boardWell(b, name);
  readWell(await pageText(), `${name}'s board`);
  say(`${name}: ${b?.known}`);
  say(`${name}: ${b?.coin}`);
  for (const r of b?.rows ?? [])
    say(`   ${r.name.replace(/\s+/g, " ")} | ${r.price} | ${r.tag.replace(/\s+/g, " ")}`);
  const coined = !!/coin/.test(b?.rows.map((r) => r.price).join(" ") ?? "");

  // 3. One reading: its grain on the board, against the sim's price and a person's page.
  const m = marketsOf(world).get(town.cell),
    grainRow = b?.rows.find((r) => /^Grain/.test(r.name));
  if (m && grainRow && coined) {
    const bread = coinWords(goodCoin(world, m.price[G.grain]!, G.grain));
    check(
      grainRow.price === `${bread} coin`,
      `${name}: a loaf reads ${grainRow.price}, the market ${bread}`,
    );
    const person = await k<string | null>(`(() => {
      const one = (globalThis.causalis.planNow()?.people ?? []).find((p) => !p.child && p.occupation > 0);
      return one ? one.ref : null;
    })()`);
    if (person) {
      const text = await openPage(person, `${name}-person`);
      const said = /at ([\d.,]+) coin of (?:bread|food) a day/.exec(text);
      if (said) {
        say(`${name}: a person's page says ${said[0]}; the board ${grainRow.price}`);
        check(
          said[1] === bread,
          `${name}: a person's page says a day's bread is ${said[1]}, the board ${bread}`,
        );
      } else say(`${name}: this person's page does not say what a day's bread is`);
      await closePage();
      await k(`globalThis.causalis.open(${JSON.stringify(`board:${town.ref}`)})`);
      await page.waitForTimeout(slow(400));
    }
  }

  // The board's second tab, by touch: what a merchant would carry; and back to the board.
  if (await tapTab("Where it is dear")) {
    const carry = await pageText();
    readWell(carry, `${name}'s tab of where it is dear`);
    say(`${name}, the tab: ${carry.replace(/\s+/g, " ").slice(0, 260)}`);
    check(
      /cheapest|about the same|only at|No one/.test(carry),
      `${name}: the tab does not say where: ${carry.slice(0, 200)}`,
    );
    await shot(`${name}-carry`);
    check(await tapTab("The board"), `${name}: no way back to the board`);
  } else problems.push(`${name}: no tab of where it is dear`);

  // 4. A line pressed by touch; a good's page says the board's price; its chain; where it is cheap and dear.
  const line = (
    b?.rows.find((r) => /^(Tools|Pottery|Clothing)/.test(r.name)) ?? b?.rows[0]
  )?.name.split("\n")[0];
  if (line) {
    await pressEl(rowNamed(`^${line}`), `the line for ${line}`);
    await until(`${line}'s page`, async () => (await pageIs()).startsWith("mkt:"));
    await page.waitForTimeout(slow(400));
    check(await pageSeen(), `${name}: ${line}'s page is not to be seen`);
    await shot(`${name}-good`);
    const text = await k<string>(
      `(() => { const w = document.querySelector(".page-window"); return w ? w.innerText : ""; })()`,
    );
    readWell(text, `${name}'s page of ${line}`);
    const row = b!.rows.find((r) => r.name.startsWith(line))!;
    check(
      text.includes(row.price),
      `${name}: ${line}'s page does not say the board's ${row.price}: ${text.slice(0, 400)}`,
    );
    if (!/not to be|no price/.test(row.price) && /Tools|Pottery|Clothing/.test(line))
      check(/From the ground to the market/i.test(text), `${name}: ${line}'s page has no chain`);
    await pressEl(rowNamed("cheap and dear"), "where it is cheap and dear");
    await until("where it is dear", async () => (await pageIs()).startsWith("dear:"));
    await page.waitForTimeout(slow(400));
    check(await pageSeen(), `${name}: where it is dear is not to be seen`);
    await shot(`${name}-dear`);
    const dear = await pageText();
    readWell(dear, `${name}'s where it is dear`);
    say(`${name}: ${dear.replace(/\s+/g, " ").slice(0, 300)}`);
    check(
      /cheapest|about the same|only at|No one/.test(dear),
      `${name}: it does not say where: ${dear.slice(0, 200)}`,
    );
    check(
      !/\b(tools|hides|machines) (is|costs)\b/i.test(dear),
      `${name}: a plural said as one: ${dear.slice(0, 200)}`,
    );
    // (The whole world's list, by touch, where the realm has its own.)
    if (await tapTab("The whole world")) {
      const wide = await pageText();
      readWell(wide, `${name}'s list of the whole world`);
      check(/the world over/i.test(wide), `${name}: the world's list: ${wide.slice(0, 200)}`);
      say(`${name}, the world over: ${wide.replace(/\s+/g, " ").slice(0, 200)}`);
    }
    const list = await boardSeen();
    if (list?.rows.length) {
      for (const r of list.rows)
        check(
          r.right <= 430 && r.h >= 44,
          `${name}: a market on the list is off the phone or small: ${r.name}`,
        );
      await pressEl(bySelector(".page-window .board-row"), "a market on the list");
      await until("that market's board", async () => (await pageIs()).startsWith("board:"));
      await page.waitForTimeout(slow(300));
      boardWell(await boardSeen(), `${name}: a board from the list`);
    }
    await closePage();
  }

  // 5. The square by touch, at its real place on the screen: a spot of it with no one on it.
  await k(`globalThis.causalis.goTo(${JSON.stringify(town.ref)})`);
  await page.waitForTimeout(slow(600));
  let pressed = false;
  const squareSpots: [number, number][] = [];
  for (const r of [3, 7, 11])
    for (let a = 0; a < 8; a++)
      squareSpots.push([r * Math.cos((a * Math.PI) / 4), r * Math.sin((a * Math.PI) / 4)]);
  for (const [x, z] of squareSpots) {
    const at = await k<{ x: number; y: number } | null>(
      `globalThis.causalis.townScreen(${x}, ${z})`,
    );
    if (!at || at.x < 10 || at.x > 420 || at.y < 150 || at.y > 780) continue;
    const onCanvas = await k<boolean>(
      `document.elementFromPoint(${at.x}, ${at.y})?.tagName === "CANVAS"`,
    );
    if (!onCanvas) continue;
    await page.touchscreen.tap(at.x, at.y);
    await page.waitForTimeout(slow(350));
    if ((await pageIs()).startsWith("board:") && (await pageSeen())) {
      pressed = true;
      say(
        `${name}: the square pressed at ${Math.round(at.x)}, ${Math.round(at.y)} (${x.toFixed(0)}, ${z.toFixed(0)} m): the board`,
      );
      await shot(`${name}-square`);
      break;
    }
    await k("globalThis.causalis.closePage?.()");
  }
  check(pressed, `${name}: no press on its square gave its board`);
  await closePage();

  // 6. The town's own page: what it is known for, its board by touch.
  {
    const text = await openPage(town.ref, `${name}-town`);
    check(
      /Known for/i.test(text),
      `${name}: the town's page does not say what it is known for: ${text.slice(0, 300)}`,
    );
    await pressEl(rowNamed("market board"), "the board's line on the town's page");
    await until("the board from its page", async () => (await pageIs()).startsWith("board:"));
    await closePage();
  }

  // 7. The paths nobody watches: pages over the world, each read.
  const others: [string, string | undefined][] = [];
  const realmsAtWar = politiesOf(world)
    .living()
    .filter((r) =>
      warsOf(world)
        .fighting(r.ref)
        .some((w) => w.ended === null),
    );
  others.push([
    "at-war",
    towns.find((s) => realmsAtWar.some((r) => politiesOf(world).of(s.cell)?.ref === r.ref))?.ref,
  ]);
  others.push([
    "lesser",
    towns.find(
      (s) =>
        !s.market && s.ref !== town.ref && ctx.settlements.seenIn(s.cell).some((o) => o.market),
    )?.ref,
  ]);
  others.push(["smallest", towns.at(-1)?.ref]);
  const allTowns = ctx.settlements.all?.() ?? [];
  others.push(["ghost", allTowns.find((s: { population: number }) => s.population <= 0)?.ref]);
  const base0 =
    (ctx.generated as unknown as { offworld?: { base?: number } }).offworld?.base ?? Infinity;
  others.push(["colony", towns.find((s) => s.cell >= base0)?.ref]);
  for (const [what, ref] of others) {
    if (!ref) {
      say(`${name}: no ${what} town here`);
      continue;
    }
    const text = await openPage(`board:${ref}`, `${name}-${what}`);
    const seen = await boardSeen();
    boardWell(seen, `${name}, ${what}`, what !== "ghost");
    say(`${name}, ${what} (${ref}): ${text.replace(/\s+/g, " ").slice(0, 420)}`);
    await closePage();
  }

  // Each mode's chrome hides the others': a page must come through a possession's.
  await k(`document.body.classList.add("possessing")`);
  await openPage(`board:${town.ref}`, `${name}-possessing`);
  boardWell(await boardSeen(), `${name}, under a possession's chrome`);
  await closePage();
  await k(`document.body.classList.remove("possessing")`);

  // On a desk: the same board, its lines inside its window.
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.waitForTimeout(slow(500));
  await openPage(`board:${town.ref}`, `${name}-desk`);
  const desk = await boardSeen();
  check(!!desk && desk.height > 60 && desk.rows.length > 0, `${name}: no board on a desk`);
  check(
    (desk?.rows ?? []).every((r) => r.left >= 0 && r.right <= 1280 && r.h >= 36),
    `${name}: a line off a desk's window`,
  );
  await closePage();
  await page.setViewportSize({ width: 430, height: 932 });
  await page.waitForTimeout(slow(500));

  const after = JSON.stringify(await ask<unknown>("hashes"));
  check(before === after, `${name}: reading moved history`);
  say(`${name}: hashes ${before === after ? "the same" : "MOVED"}`);

  // One lived as: from their own page, by touch, their day held behind it.
  await goDown(town.ref);
  const homes = await ask<{ n: number; state: string; people: number }[]>("home.survey", {
      town: town.ref,
    }),
    lived = homes.find((s) => s.state === "stands" && s.people > 0);
  if (lived) {
    const why = await k<string | null>(
      `globalThis.causalis.home.open(${JSON.stringify({ town: town.ref, n: lived.n })})`,
    );
    check(!why, `${name}: their home did not open: ${why}`);
    await until("its roof lifted", async () => {
      const s = await k<{ lifted: boolean; flying: boolean } | null>(
        "globalThis.causalis.home.state()",
      );
      return !!s && s.lifted && !s.flying;
    });
    await page.waitForTimeout(slow(300));
    const one = (
      await k<{ kind: string; x: number; y: number }[]>("globalThis.causalis.home.spots()")
    ).find((s) => s.kind === "person" && s.y > 180 && s.y < 800);
    if (one) {
      await page.touchscreen.tap(one.x, one.y);
      await until("their sheet", () => k<boolean>(`!document.querySelector(".home-who").hidden`));
      await pressEl(bySelector(".home-live"), "Live as them");
      await until(
        "their life",
        () => k<boolean>(`document.body.classList.contains("living")`),
        slow(90000),
      );
      await page.waitForTimeout(slow(1200));
      const life = await k<{ agent: number } | null>("globalThis.causalis.life.state()");
      if (life) {
        await pressEl(bySelector(".life-bookbtn"), "their Book");
        await until("their Book", () => k<boolean>(`!document.querySelector(".life-book").hidden`));
        await pressEl(byWords(".life-book .life-choice", "their page"), "their page");
        await until("their page", async () => (await pageIs()).startsWith("agent:"));
        await page.waitForTimeout(slow(500));
        await pressEl(rowNamed("market board"), "its market board");
        await until("the board in a life", async () => (await pageIs()).startsWith("board:"));
        await page.waitForTimeout(slow(500));
        check(await pageSeen(), `${name}: the board is not to be seen in a life`);
        check(
          await k<boolean>(
            `(() => { const t = document.querySelector(".life-tray"); return !t || t.getBoundingClientRect().height === 0; })()`,
          ),
          `${name}: a life's tray stands over the page's last lines`,
        );
        check(
          await k<boolean>(`document.querySelector(".life-book").hidden`),
          `${name}: the Book stands over a page it opened`,
        );
        {
          // (Its close within reach: under no strip of the life's.)
          const x = await k<{ top: boolean; over: string }>(`(() => {
            const e = document.querySelector(".page-window h2 .close");
            const r = e.getBoundingClientRect(), at = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2);
            return { top: at === e || e.contains(at), over: at ? String(at.className || at.tagName) : "" };
          })()`);
          check(x.top, `${name}: the page's close lies under ${x.over} in a life`);
        }
        await shot(`${name}-lived-board`);
        boardWell(await boardSeen(), `${name}, in a life`);
        const clock = await k<{ stopped: boolean }>("globalThis.causalis.clock()");
        check(clock.stopped, `${name}: their day went on behind the board`);
        await k("document.querySelector('.life-book').hidden = true");
        await closePage();
      } else problems.push(`${name}: no life is being lived`);
    } else say(`${name}: no one in at this hour, to live as`);
  }
  void young;
}

const far = saveFile ? fromFile(saveFile, saveUniverse) : null;
if (far) {
  tally(far, "far", false);
  await walk(far, pack(far, saveUniverse), "far", false);
  forced(far, "far");
} else {
  const young = EARTH.build(seedFromText("first light"));
  young.runTo(30 * YEAR);
  tally(young, "young", true);
  await walk(young, pack(young, "earth"), "young", true);
  forced(young, "young");
  // A people with no coin yet swap: no coin on its board, if none knows of it.
  const c = populationContext(young),
    p0 = c.provinces.all().find((p) => p.total() > 0),
    t0 = p0 ? c.settlements.seenIn(p0.cell)[0] : undefined,
    b0 = p0 && t0 ? boardOf(young, p0.cell, t0.ref, t0.name) : null;
  if (b0 && !b0.coined) {
    check(
      !b0.rows.some((r) => /coin/.test(r.price)),
      `young: a people with no coin read coin: ${b0.rows[0]?.price}`,
    );
    say(`young: told in ${b0.staple}: ${b0.rows.map((r) => `${r.name} ${r.price}`).join("; ")}`);
  }
}
if (alienFile) {
  const water = fromFile(alienFile, "alien");
  tally(water, "water", false);
  const f = pack(water, "alien");
  await loadSave(f);
  const c = populationContext(water),
    t = c.provinces
      .all()
      .filter((p) => p.total() > 0)
      .flatMap((p) => c.settlements.seenIn(p.cell))
      .sort((x, y) => y.population - x.population)[0];
  if (t) {
    const text = await openPage(`board:${t.ref}`, "water-board");
    boardWell(await boardSeen(), "water");
    say(`water: ${text.replace(/\s+/g, " ").slice(0, 500)}`);
    check(
      !/\bloaf\b|\bbread\b|\bloaves\b/i.test(text),
      `a water people have bread: ${text.slice(0, 500)}`,
    );
    await closePage();
  }
}

/** A world no longer shown, its numbers forced: a town no one is left in, and a good with a price of nothing. */
function forced(world: World, name: string): void {
  const c = populationContext(world),
    p = c.provinces.all().find((x) => x.total() > 0 && c.settlements.seenIn(x.cell).length > 1);
  if (!p) return;
  const [seat, other] = c.settlements.seenIn(p.cell) as unknown as {
      ref: string;
      name: string;
      population: number;
    }[],
    m = marketsOf(world).get(p.cell)!,
    wrote = (page: ReturnType<typeof boardPage>): string => JSON.stringify(page.tabs);
  (other as { population: number }).population = 0;
  const ghost = wrote(boardPage(world, `board:${other!.ref}`));
  check(
    /no one is left/.test(ghost),
    `${name}: a ghost town's board does not say so: ${ghost.slice(0, 300)}`,
  );
  check(!/board-row|"price":"/.test(ghost), `${name}: a ghost town has prices`);
  const was = m.price[G.tools]!;
  m.price[G.tools] = 0;
  const b = boardOf(world, p.cell, seat!.ref, seat!.name),
    row = b?.rows.find((r) => r.name === "Tools");
  check(!row || row.price === "no price", `${name}: a good at nothing reads "${row?.price}"`);
  check(!row || row.words === "not priced", `${name}: a good at nothing is "${row?.words}"`);
  m.price[G.tools] = was;
  say(
    `${name}: a ghost says "${/Nothing is bought[^"]*/.exec(ghost)?.[0]}"; a good at nothing reads "${row?.price}", ${row?.words}`,
  );
}

for (const e of errors) problems.push(`page error: ${e.slice(0, 400)}`);
await browser.close();
await server.close();
if (problems.length) {
  console.log(`gate 92: ${problems.length} problems`);
  for (const p of problems) console.log(`  x ${p}`);
  process.exit(1);
}
console.log("gate 92: passed");
process.exit(0);
