// node tools/charts-gate.ts [--ci] [--soft] [--shots dir] [--year n]: gate 117, a realm's, a land's and an alliance's numbers over time
// (asked 2026-11-13: "am i able to see stats and like graphs over time in the country/land/league panels please"):
//   1. pure, on the worlds the app runs (first light at year 450, and alien 55 at 300, made here alike): every standing realm's Over time
//      tab has its lines, each titled, in its units, thinned to at most 160 points, its latest the page's own number (its people, lands,
//      tithe, wealth a head, host, standing); a realm whose lands changed keeps its own past (its people of each year are its lands of that
//      year, and not those it holds now); a land's and an alliance's lines likewise; no word a raw id; what keeping the years costs;
//   2. by real touch at 430 by 932 on the same worlds: a realm whose lands changed, its seat's land and the greatest alliance each opened, its
//      Over time tab pressed, every line drawn with its title and its latest, the latest on the screen the page's own number on the screen, a
//      press on a line telling a year and its number; nothing over anything, nothing off the screen, the tab and the lines a finger's size.
import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { gzipSync } from "node:zlib";
import { fileURLToPath } from "node:url";
import { preview } from "vite";
import { chromium } from "playwright";
import { hudRead, type HudRead } from "./hud-read.ts";

const argv = process.argv.slice(2),
  soft = argv.includes("--soft"),
  ci = argv.includes("--ci"),
  arg = (name: string) => {
    const at = argv.indexOf(name);
    return at >= 0 ? argv[at + 1] : undefined;
  },
  shots = arg("--shots"),
  YEAR_EARTH = Number(arg("--year") ?? 450),
  WORLDS: readonly { universe: "earth" | "alien"; seed: string; year: number }[] = [
    { universe: "earth", seed: "first light", year: YEAR_EARTH },
    { universe: "alien", seed: "alien 55", year: 300 },
  ];
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
console.log("gate 117, numbers over time");

const BAD = /undefined|NaN|\[object|\bnull\b|Infinity|\b(ev|pol|war|cell|town|bloc):\d/;
const MOST = 160;
type Span = string | { text: string; ref: string };
type Series = {
  type: "series";
  title: string;
  units: string;
  unit: string;
  points: { x: number; y: number }[];
  latest: string;
  marks?: { x: number; kind: string; label: string }[];
};
type Model = {
  ref: string;
  title: string;
  stats: { label: string; value: Span[] }[];
  tabs: { id: string; name: string; blocks: Record<string, unknown>[] }[];
};
const plain = (x: unknown): string =>
  typeof x === "string"
    ? x
    : Array.isArray(x)
      ? x.map(plain).join("")
      : x && typeof x === "object" && "text" in x
        ? String((x as { text: unknown }).text)
        : "";
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
const linesOf = (m: Model): Series[] =>
  (m.tabs.find((t) => t.id === "time")?.blocks ?? []).filter(
    (b) => b.type === "series",
  ) as unknown as Series[];
const statOf = (m: Model, label: string) => {
  const s = m.stats.find((x) => x.label === label);
  return s ? plain(s.value) : null;
};
/** A tab's facts row, by its label (the army's Fields, the order's Standing). */
const factOf = (m: Model, tab: string, label: string) => {
  for (const b of m.tabs.find((t) => t.id === tab)?.blocks ?? [])
    if (b.type === "facts")
      for (const r of b.rows as { label: string; value: Span[] }[])
        if (r.label === label) return plain(r.value);
  return null;
};
/** Each line has points (no more than MOST), a title and its units; no raw word. */
function linesFine(where: string, lines: readonly Series[], least: number): void {
  check(lines.length >= least, `${where}: ${lines.length} lines over time, fewer than ${least}`);
  for (const l of lines) {
    check(!!l.title, `${where}: a line with no title`);
    check(!!l.units, `${where}: ${l.title} has no units`);
    check(
      l.points.length >= 2 && l.points.length <= MOST,
      `${where}: ${l.title} has ${l.points.length} points`,
    );
    check(
      l.points.every((p, i) => !i || p.x > l.points[i - 1]!.x),
      `${where}: ${l.title}'s years do not run forward`,
    );
    check(!!l.latest && !BAD.test(l.latest), `${where}: ${l.title}'s latest is "${l.latest}"`);
  }
  const w = wordsOf(lines);
  check(!BAD.test(w), `${where}: its lines say ${BAD.exec(w)?.[0]}`);
}
const latestOf = (lines: readonly Series[], title: string) =>
  lines.find((l) => l.title === title)?.latest ?? null;
const agrees = (where: string, line: string | null, page: string | null) => {
  check(
    line !== null && page !== null && line === page,
    `${where}: its line ends at "${line}", its page says "${page}"`,
  );
};

// 1. Pure, on the same worlds.
const chosen = new Map<string, { realm: string; seat: number; alliance: string | null }>();
{
  const planet = await import("../src/host/planet.ts");
  const { seedFromText, YEAR, saveWorld } = await import("../src/kernel/index.ts");
  const { pageOf } = await import("../src/host/inspect/index.ts");
  const { alliancesOf } = await import("../src/host/inspect/ties.ts");
  const { yearsOf, logAt, YEARS_COST } = await import("../src/host/years.ts");
  const { politiesOf, populationContext } = await import("../src/sim/index.ts");
  for (const w of WORLDS) {
    const before = { ...YEARS_COST },
      t0 = performance.now(),
      world = (w.universe === "earth" ? planet.EARTH : planet.ALIEN).build(seedFromText(w.seed));
    world.runTo(w.year * YEAR);
    const ran = performance.now() - t0,
      store = yearsOf(world)!,
      cost = (YEARS_COST.ms - before.ms) / Math.max(1, YEARS_COST.years - before.years),
      saved = saveWorld(world, "gate"),
      bytes = gzipSync(JSON.stringify(saved.stores["readings.years"])).length,
      all = gzipSync(JSON.stringify(saved)).length;
    say(
      `${w.seed} at year ${w.year}: run in ${(ran / 1000).toFixed(0)} s; the years read ${cost.toFixed(2)} ms a year (${((cost / (ran / w.year)) * 100).toFixed(2)}% of a year's work); kept ${(bytes / 1000).toFixed(1)} kB of a ${(all / 1e6).toFixed(2)} MB save`,
    );
    check(cost < 5, `${w.seed}: reading the years takes ${cost.toFixed(1)} ms a year`);
    const realms = politiesOf(world).living(),
      history = populationContext(world).history;
    check(realms.length >= 1, `${w.seed}: no realm stands at year ${w.year}`);
    let read = 0,
      slowest = 0,
      best: { ref: string; seat: number; moved: number; lands: number } | null = null;
    for (const r of realms) {
      const t1 = performance.now(),
        m = pageOf(world, r.ref) as unknown as Model,
        ms = performance.now() - t1,
        lines = linesOf(m),
        where = `${w.seed}: ${m.title}`;
      slowest = Math.max(slowest, ms);
      read++;
      if (r.founded > w.year - 3) continue;
      linesFine(where, lines, 6);
      agrees(`${where}, its people`, latestOf(lines, "People"), `${statOf(m, "People")} people`);
      agrees(`${where}, its lands`, latestOf(lines, "Lands"), `${statOf(m, "Lands")} lands`);
      agrees(
        `${where}, its tithe`,
        latestOf(lines, "Tithe")?.split(" ")[0] ?? null,
        statOf(m, "Tithe"),
      );
      const wealth = statOf(m, "Wealth"),
        worth = latestOf(lines, "Wealth a head");
      if (wealth && worth) agrees(`${where}, its wealth`, worth, wealth.split(",")[0]!.trim());
      const fields = factOf(m, "army", "Fields");
      if (fields) agrees(`${where}, its host`, latestOf(lines, "Its host"), `${fields} men`);
      const standing = factOf(m, "order", "Standing");
      if (standing && latestOf(lines, "Standing with its people"))
        agrees(
          `${where}, its standing`,
          latestOf(lines, "Standing with its people")!.split(" ")[0]!,
          standing.split(" ")[0]!,
        );
      // Its own past: its people of each year its lands of that year.
      const lands = lines.find((l) => l.title === "Lands"),
        people = lines.find((l) => l.title === "People");
      if (!lands || !people) {
        problems.push(
          `${where}: no lines of its people and lands (its page: ${m.tabs.map((t) => t.id).join(", ")})`,
        );
        continue;
      }
      const moved = new Set(lands.points.map((p) => p.y)).size;
      let mismatched = 0,
        differs = 0;
      for (const p of people.points.slice(0, -1)) {
        let mine = 0,
          now = 0,
          found = false;
        for (const [c, log] of store.landRealm) {
          if (p.x < log.first || logAt(log, p.x) !== r.ref) continue;
          const line = history.yearsOf(c).find((l) => l.year === p.x);
          if (line) found = true;
          mine += line?.population ?? 0;
        }
        for (const c of r.members)
          now += history.yearsOf(c).find((l) => l.year === p.x)?.population ?? 0;
        if (found && mine !== p.y) mismatched++;
        if (mine !== now) differs++;
      }
      check(!mismatched, `${where}: ${mismatched} of its years' people are not its lands' of then`);
      if (moved > 1 && (!best || moved > best.moved || (moved === best.moved && differs > 0)))
        if (differs > 0) best = { ref: r.ref, seat: r.seat, moved, lands: r.members.length };
    }
    say(
      `${w.seed}: ${read} realms' pages read, the slowest in ${slowest.toFixed(0)} ms; the realm whose lands moved most: ${best ? `${best.ref}, ${best.moved} counts of lands` : "none"}`,
    );
    check(slowest < 800, `${w.seed}: a realm's page reads in ${slowest.toFixed(0)} ms`);
    if (w.universe === "earth")
      check(!!best, `${w.seed}: no realm whose lands changed kept a past apart from its lands now`);
    const pick = best ?? {
      ref: [...realms].sort((a, b) => b.members.length - a.members.length)[0]!.ref,
      seat: [...realms].sort((a, b) => b.members.length - a.members.length)[0]!.seat,
    };
    // Its seat's land.
    {
      const m = pageOf(world, `cell:0:${pick.seat}`) as unknown as Model,
        lines = linesOf(m),
        where = `${w.seed}: ${m.title}`;
      linesFine(where, lines, 5);
      agrees(`${where}, its people`, latestOf(lines, "People"), `${statOf(m, "People")} people`);
      agrees(`${where}, its towns`, latestOf(lines, "Towns"), `${statOf(m, "Towns")} towns`);
      const food = statOf(m, "Food put by");
      if (food) agrees(`${where}, its food`, latestOf(lines, "Food put by"), food);
    }
    // The greatest alliance.
    const a = alliancesOf(world)[0] ?? null;
    if (a) {
      const m = pageOf(world, a.ref) as unknown as Model,
        lines = linesOf(m),
        where = `${w.seed}: ${m.title}`;
      linesFine(where, lines, 4);
      agrees(`${where}, its people`, latestOf(lines, "People"), `${statOf(m, "People")} people`);
      agrees(`${where}, its lands`, latestOf(lines, "Lands"), `${statOf(m, "Lands")} lands`);
      agrees(`${where}, its hosts`, latestOf(lines, "Hosts"), `${statOf(m, "Hosts")} men`);
      agrees(
        `${where}, its realms`,
        latestOf(lines, "Realms in it"),
        `${statOf(m, "Realms")} realms`,
      );
      const joined = lines[0]?.marks?.length ?? 0;
      say(
        `${w.seed}: ${m.title}, ${lines[0]?.points.length ?? 0} years drawn, ${joined} joinings and leavings marked`,
      );
    } else if (w.universe === "earth") problems.push(`${w.seed}: no alliance stands`);
    chosen.set(w.seed, { realm: pick.ref, seat: pick.seat, alliance: a?.ref ?? null });
  }
}

// 2. By real touch.
const root = fileURLToPath(new URL("..", import.meta.url)),
  server = await preview({ root, logLevel: "silent", preview: { port: 4334, strictPort: true } }),
  site = server.resolvedUrls!.local[0]!,
  browser = await chromium.launch({
    args: soft ? ["--use-angle=swiftshader", "--enable-unsafe-swiftshader"] : ci ? [] : GPU,
  });
const context = await browser.newContext({
    viewport: { width: 430, height: 932 },
    deviceScaleFactor: ci || soft ? 1 : 2,
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
const shot = async (name: string) => {
  if (shots) await page.screenshot({ path: join(shots, `${name}.png`) });
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
type At = { x: number; y: number; w: number; h: number; under: string | null };
/** The middle of the first of them shown that a text matches, its size, and what lies over it there. */
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
/** A tap by a finger, where it shows: on something a finger's size, under nothing, on the screen. */
const tap = async (sel: string, what: string, text = "", nth = 0, finger = true) => {
  let at: At | null = null;
  await until(`${what} on the screen`, async () => {
    at = await centre(sel, text, nth);
    return !!at;
  });
  if (!at) return false;
  const p = at as At;
  check(!p.under, `${what} lies under ${p.under}`);
  check(
    !finger || (p.h >= 44 && p.w >= 44),
    `${what} is ${Math.round(p.w)} by ${Math.round(p.h)}, under a finger's 44`,
  );
  check(
    p.x >= 0 && p.x <= 430 && p.y > 0 && p.y < 932,
    `${what} lies off the screen, at ${Math.round(p.x)}, ${Math.round(p.y)}`,
  );
  await page.touchscreen.tap(p.x, p.y);
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
const hudFine = async (where: string) => {
  const r = await k<HudRead>(READ);
  for (const o of r.overlaps) problems.push(`${where}: overlap: ${o}`);
  for (const c of r.covered) problems.push(`${where}: covered: ${c}`);
  for (const o of r.off) problems.push(`${where}: off the screen: ${o}`);
};
const model = (ref: string) =>
  k<Model>(
    `globalThis.causalis.client.query({ type: "page", args: { ref: ${JSON.stringify(ref)} } })`,
  );
/** The page's head numbers on the screen, by their labels (a label's own words, without the ⓘ of its concept). */
const chips = () =>
  k<Record<string, string>>(`(() => {
    const out = {};
    for (const c of document.querySelectorAll(".page-window .stat")) {
      const l = c.querySelector(".stat-label")?.firstChild?.textContent ?? "", v = c.querySelector(".stat-value")?.textContent ?? "";
      if (l) out[l] = v.trim();
    }
    return out;
  })()`);
/** Every line drawn on the open tab: its title, its latest, its plot's size. */
const drawn = () =>
  k<
    { title: string; latest: string; w: number; h: number; ticks: number }[]
  >(`[...document.querySelectorAll(".page-window .chart-over")].map((f) => {
    const s = f.querySelector("svg")?.getBoundingClientRect();
    return { title: f.querySelector(".series-title")?.textContent ?? "", latest: f.querySelector(".series-latest")?.textContent ?? "", w: s?.width ?? 0, h: s?.height ?? 0, ticks: f.querySelectorAll(".series-mark").length };
  })`);

/** A page opened, its Over time tab pressed, and every line on it read: the latest on the screen the head's own. */
async function overTime(
  ref: string,
  where: string,
  name: string,
  heads: readonly (readonly [string, string, (v: string) => string])[],
): Promise<void> {
  await k(`globalThis.causalis.closePage?.()`);
  await settle(300);
  await k(`globalThis.causalis.open(${JSON.stringify(ref)})`);
  if (!(await until(`${where}'s page`, async () => (await pageNow()) === ref))) return;
  await settle(600);
  const at = await k<number>(
    `[...document.querySelectorAll(".page-window .tabs .tab")].findIndex((b) => b.textContent.trim() === "Over time")`,
  );
  check(at >= 0, `${where} has no Over time tab on the screen`);
  if (at < 0) return;
  await tap(`.page-window .tabs .tab:nth-child(${at + 1})`, `${where}'s Over time tab`);
  if (
    !(await until(`${where}'s lines`, async () =>
      /Each line is|Its realms of each year/.test(await pageText()),
    ))
  )
    return;
  await settle(600);
  const lines = await drawn(),
    head = await chips(),
    text = await pageText();
  say(`${where}: ${lines.length} lines: ${lines.map((l) => `${l.title} ${l.latest}`).join("; ")}`);
  check(lines.length >= 4, `${where}: ${lines.length} lines drawn`);
  for (const l of lines) {
    check(!!l.title && !!l.latest, `${where}: a line drawn without its title or its latest`);
    check(
      l.h >= 44 && l.w >= 200,
      `${where}: ${l.title} is drawn ${Math.round(l.w)} by ${Math.round(l.h)}`,
    );
  }
  for (const [title, label, as] of heads) {
    const line = lines.find((l) => l.title === title);
    check(!!line, `${where}: no ${title} line drawn`);
    if (line && head[label] !== undefined)
      check(
        line.latest === as(head[label]!),
        `${where}: its ${title} line ends at "${line.latest}" on the screen, its head says "${head[label]}"`,
      );
    else if (line) problems.push(`${where}: its head shows no ${label}`);
  }
  check(!BAD.test(text), `${where} says ${BAD.exec(text)?.[0]}`);
  for (const o of await offScreen()) problems.push(`${where}: ${o}`);
  await hudFine(where);
  // A press on its first line, at its middle: a year and its number.
  await tap(".page-window .chart-over svg", `${where}'s first line`);
  const said = await k<string>(
    `document.querySelector(".page-window .chart-over .series-readout")?.textContent ?? ""`,
  );
  check(/^Year \d+: \S+/.test(said), `${where}: a press on its line says "${said}"`);
  say(`${where}: pressed, "${said}"`);
  await hudFine(`${where}, pressed`);
  await shot(`${name}`);
}

for (const w of WORLDS) {
  const c = chosen.get(w.seed)!;
  await page.goto(
    `${site}?universe=${w.universe}&seed=${encodeURIComponent(w.seed)}&year=${w.year}&hold=1`,
  );
  await page.waitForFunction(
    () => ((globalThis as { causalis?: { drawn?: () => number } }).causalis?.drawn?.() ?? 0) > 0,
    undefined,
    { timeout: slow(400000) },
  );
  await k("globalThis.causalis.client.setSpeed(0)");
  await settle(2500);
  await k("globalThis.causalis.closePage?.()");
  if (await centre(".ran-close")) await tap(".ran-close", "the run's note's ×", "", 0, false);
  const tag = w.seed.replace(/\W+/g, "-");
  // The realm: its lines, its head's numbers at their ends.
  await overTime(c.realm, `${w.seed}: the realm`, `${tag}-realm`, [
    ["People", "People", (v) => `${v} people`],
    ["Lands", "Lands", (v) => `${v} lands`],
    ["Tithe", "Tithe", (v) => `${v} of each land's grain to the seat`],
  ]);
  // Its past its own, as the app reads it: its people of a year kept are not its lands of now's.
  {
    const m = await model(c.realm),
      lines = linesOf(m),
      lands = lines.find((l) => l.title === "Lands"),
      people = lines.find((l) => l.title === "People"),
      members = (
        (
          m.tabs.find((t) => t.id === "lands")?.blocks[0] as
            { rows?: { ref: string }[] } | undefined
        )?.rows ?? []
      ).map((r) => r.ref),
      now = new Map<number, number>();
    for (const ref of members)
      for (const p of linesOf(await model(ref)).find((l) => l.title === "People")?.points ?? [])
        now.set(p.x, (now.get(p.x) ?? 0) + p.y);
    const differs = (people?.points ?? [])
      .slice(0, -1)
      .filter((p) => now.has(p.x) && now.get(p.x) !== p.y).length;
    say(
      `${w.seed}: the realm's lands through the years ${[...new Set(lands?.points.map((p) => p.y))].slice(0, 8).join(", ")}; ${differs} of its years' people apart from its ${members.length} lands of now`,
    );
    if (w.universe === "earth") {
      check(
        new Set(lands?.points.map((p) => p.y)).size > 1,
        `${w.seed}: the realm chosen never lost or gained a land`,
      );
      check(differs > 0, `${w.seed}: the realm's past reads as its lands of now`);
    }
  }
  await overTime(`cell:0:${c.seat}`, `${w.seed}: its seat`, `${tag}-land`, [
    ["People", "People", (v) => `${v} people`],
    ["Towns", "Towns", (v) => `${v} towns`],
    ["Food put by", "Food put by", (v) => v],
  ]);
  if (c.alliance)
    await overTime(c.alliance, `${w.seed}: the greatest alliance`, `${tag}-alliance`, [
      ["People", "People", (v) => `${v} people`],
      ["Lands", "Lands", (v) => `${v} lands`],
      ["Hosts", "Hosts", (v) => `${v} men`],
      ["Realms in it", "Realms", (v) => `${v} realms`],
    ]);
}
for (const e of errors.slice(0, 5)) say(`ERROR ${e.slice(0, 300)}`);
check(errors.length === 0, `${errors.length} errors on the page`);
await browser.close();
await server.close();
if (problems.length) {
  console.log(`gate 117 FAILED:\n${problems.map((p) => `  - ${p}`).join("\n")}`);
  process.exit(1);
}
console.log("gate 117 passed");
