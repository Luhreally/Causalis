// node tools/notices-gate.ts [--ci] [--soft] [--shots dir]: gate 107, a notice is always put away with one tap (asked 2026-11-12: "let me be
// able to click out of the new planet landed notification that just forces on my screen"). On first light at year 1300, where worlds are
// settled, at 430 by 932 by real touch, with great happenings told in windows (?events) and landings told aloud (?landings):
//   1. the landing card: its ✕ on the screen, and pressed, it is gone;
//   2. landings told by how much they matter: the first landing on another world opens a window; a later one does not (a card);
//   3. the window: its ✕ and its buttons on the screen without scrolling; the ✕ puts it away, a tap outside it puts it away and opens
//      nothing beneath, Escape puts it away; a happening put away is not shown again; five waiting go with one "Let all be";
//   4. a family of news told its own way: realms' news chosen "as cards" opens no window;
//   5. no page errors.
import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { preview } from "vite";
import { chromium } from "playwright";
import { YEAR } from "../src/kernel/index.ts";

const argv = process.argv.slice(2),
  soft = argv.includes("--soft"),
  ci = argv.includes("--ci"),
  at = argv.indexOf("--shots"),
  shots = at >= 0 ? argv[at + 1] : undefined;
if (shots) mkdirSync(shots, { recursive: true });
const slow = (ms: number) => (ci || soft ? ms * 4 : ms);
const GPU = ["--enable-gpu", "--ignore-gpu-blocklist", "--use-angle=d3d11"];
const problems: string[] = [];
const check = (ok: boolean, what: string) => {
  if (!ok) problems.push(what);
};
const say = (s: string) => console.log(`  ${s}`);
console.log("the gate of notices put away (107)");

const root = fileURLToPath(new URL("..", import.meta.url)),
  server = await preview({ root, logLevel: "silent", preview: { port: 4321, strictPort: false } }),
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
const settle = (ms: number) => page.waitForTimeout(slow(ms));
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
type Box = {
  x: number;
  y: number;
  top: number;
  bottom: number;
  left: number;
  right: number;
  under: string | null;
};
/** Where a thing shows, as it stands (never scrolled to), and what lies over its middle. */
const where = (sel: string) =>
  k<Box | null>(`(() => {
    for (const e of document.querySelectorAll(${JSON.stringify(sel)})) {
      const r = e.getBoundingClientRect();
      if (!(r.width > 0 && r.height > 0)) continue;
      const x = r.left + r.width / 2, y = r.top + r.height / 2, top = document.elementFromPoint(x, y);
      return { x, y, top: r.top, bottom: r.bottom, left: r.left, right: r.right,
        under: top && (e === top || e.contains(top)) ? null : String(top ? top.className || top.tagName : "nothing") };
    }
    return null;
  })()`);
/** On the screen as it stands, and nothing over it. */
const onScreen = async (sel: string, what: string) => {
  const b = await where(sel);
  if (!b) {
    problems.push(`${what} is not shown`);
    return null;
  }
  check(
    b.top >= 0 && b.bottom <= 932 && b.left >= 0 && b.right <= 430,
    `${what} is not on the screen without scrolling (${Math.round(b.left)},${Math.round(b.top)} to ${Math.round(b.right)},${Math.round(b.bottom)})`,
  );
  check(!b.under, `${what} lies under ${b.under}`);
  return b;
};
const tapAt = async (x: number, y: number) => {
  await page.touchscreen.tap(x, y);
  await settle(500);
};
const open = () => k<boolean>("globalThis.causalis.eventOpen()");
const pageNow = () => k<string | null>("globalThis.causalis.pageOpen() ?? null");
/** News told as the tidings tell it: whether it was told otherwise than as a card. */
const tell = (t: { ref: string; type: string; year: number }) =>
  k<boolean>(
    `globalThis.causalis.tellGreat(${JSON.stringify({ watch: "world", label: "The world", claim: "A great happening", importance: 6, world: true, ...t })})`,
  );

await page.goto(`${site}?universe=earth&seed=first%20light&year=1300&hold=1&events&landings`);
await page.waitForFunction(
  () => ((globalThis as { causalis?: { drawn?: () => number } }).causalis?.drawn?.() ?? 0) > 0,
  undefined,
  { timeout: slow(600000) },
);
await k("globalThis.causalis.client.setSpeed(0)");
await settle(2500);
await k("globalThis.causalis.closePage?.()");

// 1. The landing card, told as a world opens with worlds settled.
type Colony = {
  event: string | null;
  town: string | null;
  star: string | null;
  founded: number;
  sailing: boolean;
};
const colonies = (
  await k<Colony[]>(`globalThis.causalis.client.query({ type: "colony.list" })`)
).filter((c) => !c.sailing && c.town && c.event);
say(`${colonies.length} worlds settled`);
check(colonies.length >= 2, `only ${colonies.length} worlds settled at year 1300`);
if (await until("the landing card", async () => !!(await where(".colony-news")))) {
  await shot("1-card");
  // (Where it stands: under the bar and over nothing, as no window stands over another.)
  {
    const card = await where(".colony-news"),
      bar = await k<number>(
        `Math.round([...document.querySelectorAll(".panel > header.bar")].find((b) => b.offsetParent !== null)?.getBoundingClientRect().bottom ?? 0)`,
      );
    check(
      !!card && card.top >= bar,
      `the landing card stands over the bar (its top ${Math.round(card?.top ?? 0)}, the bar's foot ${bar})`,
    );
  }
  const x = await onScreen(".colony-news-close", "the landing card's ✕");
  if (x) {
    await tapAt(x.x, x.y);
    check(!(await where(".colony-news")), "the landing card stayed after its ✕");
    check(
      !(await k<boolean>(`!!document.querySelector(".colonies-button.new")`)),
      "the 🚀 still glows after the card was put away",
    );
  }
}

// 2. Landings by how much they matter: of the home star's worlds, the first in a window, a later one not.
const home = colonies.filter((c) => !c.star).sort((a, b) => a.founded - b.founded);
if (home.length >= 2) {
  const later = home[1]!;
  check(
    !(await tell({ ref: later.event!, type: "space.colony", year: later.founded })),
    "a later landing was told in a window",
  );
  await settle(800);
  check(!(await open()), "a later landing opened a window");
  const first = home[0]!;
  check(
    await tell({ ref: first.event!, type: "space.colony", year: first.founded }),
    "the first landing on another world was not told in a window",
  );
  await until("the first landing's window", open);
  await settle(1200);
  await shot("2-window");
  // 3. Its ✕ and its buttons on the screen as it opens; the ✕ puts it away.
  await onScreen(".event-buttons", "the window's buttons");
  const x = await onScreen(".event-close", "the window's ✕");
  if (x) {
    await tapAt(x.x, x.y);
    check(!(await open()), "the window stayed after its ✕");
  }
  check(
    !(await tell({ ref: first.event!, type: "space.colony", year: first.founded })) ||
      !(await open()),
    "a landing put away was shown again",
  );
  await settle(800);
  check(!(await open()), "a landing put away was shown again");
} else problems.push("fewer than two of the home star's worlds settled");

// Other happenings, for the rest: any real ones, told as realms' news.
const refs = colonies.map((c) => c.event!).slice(2);
// (The world's own news of its last six centuries, as the tidings ask it.)
const more = await k<string[]>(
  `globalThis.causalis.client.query({ type: "observe.world", args: { since: 0 } }).then((a) => globalThis.causalis.client.query({ type: "observe.world", args: { since: Math.max(0, a.now - ${600 * YEAR}) } })).then((a) => a.told.map((t) => t.ref))`,
);
for (const r of more) if (!refs.includes(r)) refs.push(r);
say(`${refs.length} other happenings to tell`);
check(refs.length >= 7, `only ${refs.length} happenings to tell`);
const great = (i: number) => ({ ref: refs[i]!, type: "polity.formed", year: 1300 });
if (refs.length >= 7) {
  // A tap outside: put away, and nothing beneath opened.
  await tell(great(0));
  await until("a window to tap outside of", open);
  await settle(1000);
  const w = await where(".event-window");
  if (w) {
    const y = w.bottom < 900 ? Math.min(925, w.bottom + 12) : Math.max(4, w.top - 8),
      x = w.bottom < 900 || w.top > 12 ? 215 : 3;
    await tapAt(x, y);
    check(!(await open()), `a tap outside the window (${x}, ${Math.round(y)}) did not put it away`);
    check((await pageNow()) === null, `the tap that put the window away opened ${await pageNow()}`);
  }
  // Escape.
  await tell(great(1));
  await until("a window for Escape", open);
  await settle(800);
  await page.keyboard.press("Escape");
  await settle(500);
  check(!(await open()), "Escape did not put the window away");
  // Five waiting, put away with one tap.
  for (let i = 2; i < 7; i++) await tell(great(i));
  await until("five windows waiting", open);
  await settle(1200);
  const all = await onScreen(".event-all", "“Let all be”");
  if (all) {
    const words = await k<string>(`document.querySelector(".event-all").innerText`);
    check(/Let all 5 be/.test(words), `the button reads “${words}”, not “Let all 5 be”`);
    await tapAt(all.x, all.y);
    await settle(1500);
    check(!(await open()), "windows were still waiting after “Let all be”");
  }
  // 4. Realms' news chosen as cards: no window.
  await k(`localStorage.setItem("causalis.events.realms", "card")`);
  const fresh = refs[7] ?? colonies[0]!.event!;
  check(
    !(await tell({ ref: fresh, type: "polity.formed", year: 1300 })),
    "realms' news told in a window when chosen as cards",
  );
  await settle(800);
  check(!(await open()), "realms' news chosen as cards opened a window");
  await k(`localStorage.removeItem("causalis.events.realms")`);
}
await shot("3-end");

check(errors.length === 0, `page errors: ${errors.slice(0, 3).join(" | ")}`);
await browser.close();
await server.close();
if (problems.length) {
  console.log(`gate 107 FAILED:\n${problems.map((p) => `  - ${p}`).join("\n")}`);
  process.exit(1);
}
console.log("gate 107 passed");
process.exit(0);
