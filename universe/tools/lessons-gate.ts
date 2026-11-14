// node tools/lessons-gate.ts [--ci] [--soft] [--shots dir]: gate 110, what a people has learned from what has cost it (asked
// 2026-11-12: "they should learn at some point if they have this many earthquakes ... armies that lose a learn"). On first light at
// 430 by 932, by real touch:
//   1. the world's own record: some land and some realm lean on a lesson read off what history did to them;
//   2. a land with lessons: its page, its Learned tab pressed, What they have learned with its numbers (what it cost them, in how
//      many years), what they do now and whether it worked; no raw ids, nothing past the screen's edges;
//   3. its realm, pressed from the land's page: a realm's Learned tab, the same checks, where it has one;
//   4. the annals tell when a lesson was first taken up;
//   5. no page errors.
// And its second step (asked 2026-11-12: "it should also be learned philosphies/logic and everything u learn ... more nuanced battle
// tactics ... rn its says their learned to ram engines before they even have engines"): the land's tab in its three parts (from what
// has cost them, by their own thought and finding, from others), the found shown a few at first and all at "show all"; what they
// do named only by means they know; a realm's tactic row (a screen, formations, riders, supply trains), with what it cost them and
// whether it worked.
import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { preview } from "vite";
import { chromium } from "playwright";

const argv = process.argv.slice(2),
  soft = argv.includes("--soft"),
  ci = argv.includes("--ci"),
  at = argv.indexOf("--shots"),
  shots = at >= 0 ? argv[at + 1] : undefined,
  YEAR_AT = ci ? 700 : 900;
if (shots) mkdirSync(shots, { recursive: true });
const slow = (ms: number) => (ci || soft ? ms * 4 : ms);
const GPU = ["--enable-gpu", "--ignore-gpu-blocklist", "--use-angle=d3d11"];
const problems: string[] = [];
const check = (ok: boolean, what: string) => {
  if (!ok) problems.push(what);
};
const say = (s: string) => console.log(`  ${s}`);
console.log("the gate of lessons learned (110)");

/**
 * Words of means and what a people must know to have them (rules/lessons.ts means, rules/designs.ts): any of these on a holder's
 * tab without its needs known is the defect asked about ("ram engines before they even have engines").
 */
const MEANS: readonly [RegExp, string][] = [
  [/throwing engines/, "siege-craft"],
  [/great guns|powder mines|siege guns/, "gunpowder"],
  [/pike and shot|skirmishers in open order|muskets/, "firearms"],
  [/riflemen|fire by rank|\brifles\b/, "rifling"],
  [/trenches, wire/, "automatic-fire"],
  [/carts and depots/, "cart"],
  [/trains to the front/, "railways"],
  [/lorries/, "engines"],
  [/on horseback|as horsemen/, "riding"],
  [/in chariots/, "chariots"],
  [/braced timber frames/, "carpentry"],
  [/frames braced with steel/, "steel|made-oxygen|drawn-carbon"],
  [/walls of stone/, "masonry|reef-building"],
];
/** The means a holder's tab names, in what they do now, without knowing them. */
async function unknownMeans(ref: string, text: string): Promise<string[]> {
  const known = new Set(
    await k<string[]>(
      `globalThis.causalis.client.query({ type: "lessons.knows", args: { ref: ${JSON.stringify(ref)} } })`,
    ),
  );
  const does = text
    .split("\n")
    .filter((l) => /What they do now/i.test(l))
    .join("\n");
  return MEANS.filter(
    ([re, needs]) => re.test(does) && !needs.split("|").some((n) => known.has(n)),
  ).map(([re, needs]) => `${String(re)} without ${needs}`);
}
/** The tactics a battle teaches (rules/lessons.ts), by their tab titles. */
const TACTICS: Readonly<Record<string, RegExp>> = {
  "skirmish-screen": /A screen ahead of the line/i,
  formations: /Formations that hold/i,
  "mounted-wings": /Wings of their own riders/i,
  "supply-trains": /Supply trains and depots/i,
};

/** Words a page must never show: a raw id, a number gone wrong, a word left unfilled. */
const BAD = /\b(?:cell|pol|ev|town|war):\d+(?::\d+)?\b|undefined|NaN|null|\[object/;

const root = fileURLToPath(new URL("..", import.meta.url)),
  server = await preview({ root, logLevel: "silent", preview: { port: 4327, strictPort: false } }),
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
const until = async (what: string, ok: () => Promise<boolean>, ms = slow(20000)) => {
  const end = Date.now() + ms;
  while (Date.now() < end) {
    if (await ok().catch(() => false)) return true;
    await page.waitForTimeout(80);
  }
  problems.push(`${what} did not come`);
  return false;
};
/** Press a thing by touch where it stands, once it has stopped moving. */
async function press(selector: string, what: string): Promise<boolean> {
  const where = () =>
    k<{ x: number; y: number } | null>(`(() => {
    for (const e of document.querySelectorAll(${JSON.stringify(selector)})) {
      e.scrollIntoView({ block: "center", inline: "center" });
      const r = e.getBoundingClientRect();
      if (r.width > 0 && r.height > 0) return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
    }
    return null;
  })()`);
  let spot = await where();
  if (!spot) {
    problems.push(`nothing to press for ${what}`);
    return false;
  }
  for (let i = 0; i < 40; i++) {
    await page.waitForTimeout(slow(100));
    const now = await where();
    if (!now || (now.x === spot.x && now.y === spot.y)) break;
    spot = now;
  }
  await page.touchscreen.tap(spot.x, spot.y);
  await page.waitForTimeout(slow(400));
  return true;
}
const pageNow = () => k<string | null>("globalThis.causalis.pageOpen() ?? null");
const pageText = () =>
  k<string>(
    `(() => { const e = document.querySelector(".page-window"); return e && e.getBoundingClientRect().height > 0 ? e.innerText : ""; })()`,
  );
/** Whatever of the page's open tab lies past the screen's sides, or is cut off within its own box. */
/** What of the open tab runs off the screen, or of its one block whose title starts so, where one is named. */
const offScreen = (block?: string) =>
  k<string[]>(`(() => {
    const w = document.querySelector(".page-window"), out = [];
    if (!w) return ["no page"];
    const a = w.getBoundingClientRect();
    if (a.left < -1 || a.right > innerWidth + 1) out.push("the page " + Math.round(a.left) + " to " + Math.round(a.right));
    const named = ${JSON.stringify(block ?? "")},
      within = named
        ? [...w.querySelectorAll(".page-body .block")].filter((b) => (b.querySelector("h3")?.textContent ?? "").trim().startsWith(named))
        : [w.querySelector(".page-body")].filter(Boolean);
    if (named && !within.length) out.push("no block " + named);
    // (What the open tab holds: the page's own head is the page's, cut to a line by design.)
    for (const e of within.flatMap((b) => [...b.querySelectorAll("*")])) {
      const r = e.getBoundingClientRect();
      if (!(r.width > 0 && r.height > 0)) continue;
      if (r.left < -1 || r.right > innerWidth + 1)
        out.push((e.className || e.tagName) + " " + Math.round(r.left) + " to " + Math.round(r.right) + ": " + (e.textContent || "").slice(0, 40));
      if (e.scrollWidth > e.clientWidth + 2 && getComputedStyle(e).overflowX === "hidden")
        out.push((e.className || e.tagName) + " cut off: " + (e.textContent || "").slice(0, 40));
    }
    return out.slice(0, 6);
  })()`);
/** Open a page, then press its Learned tab by touch; what the tab says (empty: none such). */
async function learnedTab(ref: string, what: string): Promise<string> {
  return tabNamed("Learned", ref, what);
}
/** On an open page, press the tab of that name by touch; what the tab says (empty: none such). */
async function tabNamed(name: string, ref: string, what: string): Promise<string> {
  const tabAt = await k<number>(
    `[...document.querySelectorAll(".page-window .tabs .tab")].findIndex((b) => b.textContent.trim().startsWith(${JSON.stringify(name)}))`,
  );
  if (tabAt < 0) {
    problems.push(`no ${name} tab on ${what} (${ref})`);
    return "";
  }
  await press(`.page-window .tabs .tab:nth-child(${tabAt + 1})`, `${what}'s ${name} tab`);
  await until(`${what}'s ${name} tab open`, () =>
    k<boolean>(
      `(document.querySelector(".page-window .tabs .tab.on")?.textContent ?? "").trim().startsWith(${JSON.stringify(name)})`,
    ),
  );
  await page.waitForTimeout(slow(400));
  return k<string>(
    `(() => { const e = document.querySelector(".page-window .page-body"); return e ? e.innerText : ""; })()`,
  );
}
/** The section's checks: its title, its numbers, no raw ids, nothing off the screen. */
async function checkSection(text: string, what: string): Promise<void> {
  check(
    /What they have learned/i.test(text),
    `${what}: no “What they have learned”: ${text.slice(0, 200)}`,
  );
  check(
    /\d[\d,]* [\w' ]*(?:lost to|went hungry)[^\n]* in (?:a year|[\d,]+ years) \([\d,]+ \w/.test(
      text,
    ),
    `${what}: what it cost them is not told in numbers and years: ${text.slice(0, 300)}`,
  );
  check(
    !BAD.test(text),
    `${what}: a raw id or a word gone wrong: ${(text.match(BAD) ?? [""])[0]} in ${text.slice(0, 300)}`,
  );
  const off = await offScreen();
  check(off.length === 0, `${what}: off the screen: ${off.join(" | ")}`);
}

await page.goto(`${site}?universe=earth&seed=first%20light&year=${YEAR_AT}&hold=1`);
await page.waitForFunction(
  () => ((globalThis as { causalis?: { drawn?: () => number } }).causalis?.drawn?.() ?? 0) > 0,
  undefined,
  { timeout: slow(600000) },
);
await k("globalThis.causalis.client.setSpeed(0)");
await page.waitForTimeout(slow(2000));
await k("globalThis.causalis.closePage?.()");

// 1. The world's own record.
type Held = { ref: string; lessons: string[]; lost: number };
const held = await k<Held[]>(`globalThis.causalis.client.query({ type: "lessons.held" })`),
  lands = held.filter((h) => h.ref.startsWith("cell:")),
  realms = held.filter((h) => h.ref.startsWith("pol:"));
say(`at year ${YEAR_AT}: ${lands.length} lands and ${realms.length} realms lean on a lesson`);
check(lands.length > 0, `no land has learned anything by year ${YEAR_AT}`);
const counts = new Map<string, number>();
for (const h of held) for (const l of h.lessons) counts.set(l, (counts.get(l) ?? 0) + 1);
say(`lessons: ${[...counts.entries()].map(([l, n]) => `${l} ${n}`).join(", ")}`);

// 2. A land with lessons, the most learned.
const land = lands[0];
if (land) {
  await k(`globalThis.causalis.open(${JSON.stringify(land.ref)})`);
  if (await until("the land's page", async () => (await pageNow()) === land.ref)) {
    const text = await learnedTab(land.ref, "a land");
    say(`the land's tab: ${text.replace(/\s+/g, " ").slice(0, 400)}`);
    await checkSection(text, "a land");
    check(
      /What they do now/i.test(text) && /Has it worked/i.test(text),
      `a land: no “what they do now” or “has it worked”`,
    );
    // Its three parts: from what has cost them, by their own thought and finding, from others.
    check(/From what has cost them/i.test(text), "a land: no “from what has cost them”");
    check(
      /By their own thought and finding/i.test(text),
      "a land: no “by their own thought and finding”",
    );
    check(/From others/i.test(text), "a land: no “from others”");
    check(
      /By their own thought and finding: [\d,]+ \([a-z ,]+ \d+/i.test(text),
      `a land: what they found is not told by field: ${(text.match(/By their own thought[^\n]*/i) ?? [""])[0]}`,
    );
    const bad = await unknownMeans(land.ref, text);
    check(bad.length === 0, `a land names means it does not know: ${bad.join("; ")}`);
    await shot("1-land");
    // The few shown first; all at "show all", by touch.
    const rows = () =>
      k<number[]>(
        `[...document.querySelectorAll(".page-window .page-body .table-wrap")].map((t) => t.querySelectorAll("tbody tr").length)`,
      );
    const before = await rows(),
      showAll = await k<number>(
        `[...document.querySelectorAll(".page-window .page-body .show-all")].filter((b) => !b.hidden).length`,
      );
    say(`the land's tables: ${before.join(", ")} rows shown; ${showAll} with more at “show all”`);
    check(
      before.length >= 2,
      `a land: its found and its learned from others not both drawn (${before.length} tables)`,
    );
    if (showAll) {
      await press(".page-window .page-body .show-all:not([hidden])", "show all");
      const after = await rows();
      say(`after “show all”: ${after.join(", ")} rows`);
      check(
        after.reduce((a, b) => a + b, 0) > before.reduce((a, b) => a + b, 0),
        "“show all” showed no more",
      );
      const offAll = await offScreen();
      check(offAll.length === 0, `a land, all shown: off the screen: ${offAll.join(" | ")}`);
      await shot("1b-land-all");
    }
    // 3. Its realm, pressed from the page's own link.
    const realm = await k<string | null>(
      `(() => { const a = document.querySelector('.page-window a.ref-link[href^="#pol:"]'); return a ? a.getAttribute("href").slice(1) : null; })()`,
    );
    // (A realm with a tactic a battle taught it, where any has one; else the land's own.)
    const tactical = realms.find((r) => r.lessons.some((l) => l in TACTICS)),
      target = tactical
        ? tactical.ref
        : realms.find((r) => r.ref === realm)
          ? realm
          : (realms[0]?.ref ?? null);
    if (realm && target === realm && !tactical) {
      await press(`.page-window a.ref-link[href="#${realm}"]`, "the land's realm");
      await until("its realm's page", async () => (await pageNow()) === realm);
    } else if (target) await k(`globalThis.causalis.open(${JSON.stringify(target)})`);
    if (target && (await until("a realm's page", async () => (await pageNow()) === target))) {
      const text = await learnedTab(target, "a realm");
      say(`the realm's tab: ${text.replace(/\s+/g, " ").slice(0, 400)}`);
      await checkSection(text, "a realm");
      const badR = await unknownMeans(target, text);
      check(badR.length === 0, `a realm names means it does not know: ${badR.join("; ")}`);
      if (tactical) {
        const [id, re] = Object.entries(TACTICS).find(([t]) => tactical.lessons.includes(t))!,
          at = text.search(re),
          row = at >= 0 ? text.slice(at, at + 400) : "";
        say(`its tactic: ${row.replace(/\s+/g, " ").slice(0, 300)}`);
        check(at >= 0, `a realm that leans on ${id}: no row for it on its tab`);
        check(
          /men [\w' ]+ in (?:a year|[\d,]+ years) \([\d,]+ battles?\)/i.test(row) &&
            /Has it worked/i.test(row),
          `a realm's tactic row without what it cost them in battles, or whether it worked: ${row.slice(0, 200)}`,
        );
        // Its row in view, as the eye sees it.
        await k(`(() => {
          for (const h of document.querySelectorAll(".page-window .page-body h3"))
            if (${String(re)}.test(h.textContent)) { h.scrollIntoView({ block: "start" }); return; }
        })()`);
        await page.waitForTimeout(slow(300));
      }
      await shot("2-realm");
    } else say("no realm with a lesson to open");
  }
}

// 3c. How a realm is held, and what it learned of rule (asked 2026-11-13: "do they learn and adapt from their diplomatic actions,
// politcal, econmic actions ... maybe some countires ban guns/weapons ... maybe others are more democratic, maybe some countires learn
// from other countires faults"): a realm that learned of rule, the most from another's fate; its Learned tab tells what befell it and
// others, and whose fate it was; its Order tab how it is held, each number in words read off it and the people; the Years tell a
// lesson from another's fate in its year.
{
  const ruled = await k<{ ref: string; taught: number; seen: number; year: number | null }[]>(
    `globalThis.causalis.client.query({ type: "holds.taught" })`,
  );
  say(
    `realms that learned of rule: ${ruled.length}, ${ruled.filter((r) => r.seen).length} from another's fate`,
  );
  check(ruled.length > 0, "no realm learned of rule");
  // (One that told another's fate as a lesson first, so the Years can be read for it.)
  const r = [...ruled].sort(
    (a, b) =>
      +(b.year !== null) - +(a.year !== null) ||
      b.seen - a.seen ||
      b.taught - a.taught ||
      (a.ref < b.ref ? -1 : 1),
  )[0];
  if (r) {
    await k(`globalThis.causalis.open(${JSON.stringify(r.ref)})`);
    if (await until("a realm that learned of rule", async () => (await pageNow()) === r.ref)) {
      const text = await learnedTab(r.ref, "a realm that learned of rule"),
        at = text.search(/From what befell them and others/i);
      say(`its lessons of rule: ${text.slice(Math.max(0, at)).replace(/\s+/g, " ").slice(0, 400)}`);
      check(at >= 0, "a realm that learned of rule: no “from what befell them and others”");
      if (r.seen)
        check(
          /Seeing [^.:]+, it (held|blamed|took|thanked|credited)/i.test(text),
          "a realm that learned from another's fate: whose fate it was is not told",
        );
      check(!/\{them\}|undefined|NaN/.test(text), "a lesson of rule with a word unfilled");
      await k(`(() => {
        for (const h of document.querySelectorAll(".page-window .page-body h3"))
          if (/From what befell them/i.test(h.textContent)) { h.scrollIntoView({ block: "start" }); return; }
      })()`);
      await page.waitForTimeout(slow(300));
      const off1 = await offScreen();
      check(off1.length === 0, `a realm's lessons of rule: off the screen: ${off1.join(" | ")}`);
      await shot("3-rule-lessons");
      const order = await tabNamed("Order", r.ref, "a realm");
      say(
        `how it is held: ${order
          .slice(Math.max(0, order.search(/How it is held/i)))
          .replace(/\s+/g, " ")
          .slice(0, 400)}`,
      );
      for (const label of [
        "How it is held",
        "Who bears arms",
        "Who decides",
        "How word moves",
        "Its bonds to others",
      ])
        check(new RegExp(label, "i").test(order), `a realm's Order tab: no “${label}”`);
      check(
        /Held by (one|a few|many|all)/.test(order),
        "a realm's Order tab: how it is held, in all, not told",
      );
      check(/\(\d+ of 100\)/.test(order), "a realm's Order tab: its numbers not told");
      check(!/undefined|NaN/.test(order), "a realm's Order tab with a word unfilled");
      await k(`(() => {
        for (const h of document.querySelectorAll(".page-window .page-body h3"))
          if (/How it is held/i.test(h.textContent)) { h.scrollIntoView({ block: "start" }); return; }
      })()`);
      await page.waitForTimeout(slow(300));
      // (Its own block: the tables after it scroll sideways in their own frame on a phone.)
      const off2 = await offScreen("How it is held");
      check(off2.length === 0, `a realm's Order tab: off the screen: ${off2.join(" | ")}`);
      await shot("3b-held");
    }
    if (r.year !== null) {
      // (The Years' words, their spans joined: a realm's name is a link of its own.)
      const words = (x: unknown): string =>
          typeof x === "string"
            ? x
            : Array.isArray(x)
              ? x.map(words).join("")
              : x && typeof x === "object"
                ? "text" in x && typeof (x as { text: unknown }).text === "string"
                  ? (x as { text: string }).text
                  : Object.values(x).map(words).join(" ")
                : "",
        years = words(
          await k<unknown>(
            `globalThis.causalis.client.query({ type: "annals.read", args: { years: [${r.year}] } })`,
          ),
        ),
        told = years.match(/[^.]*seeing the [^.]*/i)?.[0] ?? "(none)";
      say(`the Years at ${r.year}: ${told.trim().slice(0, 240)}`);
      check(
        /seeing the [^,]+(, [^,]+)*, (took|held|blamed)/i.test(told),
        `the Years do not tell a lesson from another's fate in year ${r.year}`,
      );
    }
  }
}

// 4. The Years tell the first taking up of a lesson in all the world, in the year it was.
const firsts = await k<{ lesson: string; year: number }[]>(
  `globalThis.causalis.client.query({ type: "lessons.firsts" })`,
);
say(`firsts: ${firsts.map((f) => `${f.lesson} ${f.year}`).join(", ")}`);
const firstYear = firsts[0]?.year ?? NaN;
if (Number.isFinite(firstYear)) {
  const years = await k<unknown>(
    `globalThis.causalis.client.query({ type: "annals.read", args: { years: [${firstYear}] } })`,
  );
  const words = JSON.stringify(years);
  say(
    `the Years at ${firstYear}: ${(words.match(/[^"]*began to[^"]*/) ?? ["(none)"])[0].slice(0, 200)}`,
  );
  check(
    /began to/.test(words),
    `the Years do not tell the first lesson taken up, in year ${firstYear}`,
  );
} else problems.push("no lesson taken up to look for in the Years");

check(errors.length === 0, `page errors: ${errors.slice(0, 3).join(" | ")}`);
await browser.close();
await server.close();
if (problems.length) {
  console.log(`gate 110 FAILED:\n${problems.map((p) => `  - ${p}`).join("\n")}`);
  process.exit(1);
}
console.log("gate 110 passed");
process.exit(0);
