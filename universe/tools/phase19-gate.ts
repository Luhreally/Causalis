// node tools/phase19-gate.ts [--ci] [--soft] [--shots dir] — the Phase 19 gate (bonds and
// freedoms, asked for 2026-10-23: "slavery and forced labour — chattel, debt bondage, serfdom,
// indenture, corvée, prison labour … resistance, revolts, abolition … legitimacy, state
// capacity, corruption … class and caste … political memory"), done in a real browser on the
// built app, on the Earth seed two centuries on:
//   1. a realm's order: the realm holding the most in bondage, its Order tab — its standing and
//      what makes it, its reach, rank and levies, who is held and where — and the book's page
//      for its standing, opened from the ⓘ beside it;
//   2. the map's lenses of bondage and of standing, each with its legend, a land's tooltip
//      breaking its number down;
//   3. the ledger's bonds: every realm's order side by side;
//   4. the god's hand: a sign against the realm's rule, asked twice, told and weighed on its page;
//   5. the Order tab on a phone, nothing running off its side.
// (npm run build first; --soft draws in software, as CI's browser does; --shots keeps a
// picture of each step.)
import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { preview } from "vite";
import { chromium, type Page } from "playwright";

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
console.log("the Phase 19 gate");
if (shots) mkdirSync(shots, { recursive: true });

type Row = { ref?: string; cells: unknown[]; keys?: (number | string)[] };
type Model = {
  tabs: { id: string; blocks: { type: string; title?: string; rows?: Row[] }[] }[];
};

const root = fileURLToPath(new URL("..", import.meta.url)),
  server = await preview({ root, logLevel: "silent", preview: { port: 4273, strictPort: false } }),
  base = server.resolvedUrls!.local[0]!,
  browser = await chromium.launch({
    args: soft ? ["--use-angle=swiftshader", "--enable-unsafe-swiftshader"] : ci ? [] : GPU,
  });
const errors: string[] = [];
const watch = (p: Page) => {
  p.on("pageerror", (e) => errors.push(e.message));
  p.on("console", (m) => {
    if (m.type() === "error") errors.push(m.text());
  });
};
const page = await browser.newPage({ viewport: { width: 1366, height: 800 } });
watch(page);
const k = <T>(code: string): Promise<T> => page.evaluate(code) as Promise<T>;
const q = <T>(type: string, args: unknown = {}): Promise<T> =>
  k<T>(
    `globalThis.causalis.client.query({ type: ${JSON.stringify(type)}, args: ${JSON.stringify(args)} })`,
  );
const until = async (what: string, ok: () => Promise<boolean>, ms = 60000) => {
  const end = Date.now() + ms;
  while (Date.now() < end) {
    if (await ok()) return true;
    await page.waitForTimeout(250);
  }
  problems.push(`${what} did not come`);
  return false;
};
const text = (sel: string) => page.$eval(sel, (e) => e.textContent ?? "").catch(() => "");
const window_ = () => text(".page-window");
const open = async (ref: string, what: string, has: string) => {
  await k(`globalThis.causalis.open(${JSON.stringify(ref)})`);
  return until(what, async () => (await window_()).includes(has), slow(15000));
};
/** The middle of what a selector names on the screen, or null if it is not shown. */
const centre = (sel: string) =>
  k<{ x: number; y: number } | null>(
    `(() => { const e = document.querySelector(${JSON.stringify(sel)}); if (!e) return null; e.scrollIntoView({ block: "center" }); const r = e.getBoundingClientRect(); return r.width ? { x: r.left + r.width / 2, y: r.top + r.height / 2 } : null; })()`,
  );
const press = async (sel: string) => {
  const at = await centre(sel);
  if (!at) {
    problems.push(`${sel} was not there to press`);
    return false;
  }
  await page.mouse.click(at.x, at.y);
  return true;
};
/** A button of the page window by its words (the first whose words begin so). */
const pressWords = async (words: string) => {
  const at = await k<{ x: number; y: number } | null>(
    `(() => { const b = [...document.querySelectorAll(".page-window button")].find((x) => (x.textContent ?? "").startsWith(${JSON.stringify(words)})); if (!b) return null; b.scrollIntoView({ block: "center" }); const r = b.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; })()`,
  );
  if (!at) {
    problems.push(`“${words}” was not there to press`);
    return false;
  }
  await page.mouse.click(at.x, at.y);
  return true;
};
const shot = async (name: string) => {
  if (shots) await page.screenshot({ path: join(shots, `${name}.png`) });
};
/** Turn the globe to a spot and take the pointer there, once the turn has come to rest. */
const point = async (spot: number) => {
  await k(`globalThis.causalis.faceSpot(${spot}, 2.2)`);
  let at: { x: number; y: number } | null = null;
  for (const end = Date.now() + slow(8000); Date.now() < end;) {
    await k("globalThis.causalis.rig.idle = 0");
    await page.waitForTimeout(400);
    const now = await k<{ x: number; y: number } | null>(
      `globalThis.causalis.spotOnScreen(${spot})`,
    );
    const still = !!now && !!at && Math.abs(now.x - at.x) + Math.abs(now.y - at.y) < 2;
    at = now;
    if (still) break;
  }
  if (!at) return false;
  await k("globalThis.causalis.rig.idle = 0");
  await page.mouse.move(at.x - 8, at.y - 5);
  await page.mouse.move(at.x, at.y, { steps: 3 });
  await page.waitForTimeout(slow(800));
  return true;
};
const tooltip = () =>
  page
    .$eval(".tooltip", (e) => ((e as HTMLElement).hidden ? "" : (e.textContent ?? "")))
    .catch(() => "");

await page.goto(`${base}?universe=earth&year=200`);
await page.waitForFunction(
  () => ((globalThis as any).causalis?.drawn?.() as number) > 0,
  undefined,
  { timeout: 900000 },
);
await k("globalThis.causalis.client.setSpeed(0)");
await page.waitForTimeout(1500);

// 1. A realm's order: the realm holding the most in bondage, its Order tab, its standing's page.
const ledger = await q<Model>("page", { ref: "world:ledger" }),
  table = ledger.tabs.find((t) => t.id === "bonds")?.blocks.find((b) => b.type === "table"),
  first = table?.rows?.[0],
  realm = first?.ref ?? null,
  held = Number(first?.keys?.[2] ?? 0);
check(!!realm, "the ledger lists no realm's order");
check(held > 0, "no realm holds anyone in bondage two centuries on");
say(`the realm holding the most in bondage: ${realm} (${held} held)`);
if (realm) {
  await open(`${realm}#order`, "the realm's order", "Standing");
  const body = await window_();
  for (const words of [
    "Standing",
    "Reach",
    "Skimmed",
    "Rank",
    "Corvée",
    "Held in bondage",
    "Law of bondage",
  ])
    check(body.includes(words), `its order does not tell “${words}”`);
  const pieces = await page.$$eval(".page-window .makeup-piece", (x) => x.length);
  check(pieces >= 2, "who is held is not drawn as a bar of the free and the bound");
  say(
    `its order: ${pieces} pieces in the bar of who is held; “${body.slice(0, 120).replace(/\s+/g, " ")}…”`,
  );
  await shot("1-order");
  // The ⓘ beside its standing opens the book's page of it.
  const opened = await k<boolean>(
    `(() => { const a = document.querySelector(".page-window a.concept-link[href='#concept:legitimacy']"); if (!a) return false; a.click(); return true; })()`,
  );
  check(opened, "its standing has no ⓘ to the book of concepts");
  await until(
    "the book's page of standing",
    async () => (await window_()).includes("one of the world's workings"),
    slow(15000),
  );
  const concept = await window_();
  check(
    concept.includes("held wrongful") || concept.includes("rightful"),
    "the page of standing does not say what it is",
  );
  await shot("2-concept");
  await k(`document.querySelector(".page-window .close")?.click()`);
}

// 2. The lenses of bondage and of standing: each its legend; a land's tooltip under it.
{
  const map =
      await q<
        { cell: number; centre: number; people: number; bondage: number; standing: number }[]
      >("people.map"),
    bound = [...map].sort((a, b) => b.bondage - a.bondage || b.people - a.people)[0],
    ruled = [...map].filter((e) => e.standing >= 0).sort((a, b) => b.people - a.people)[0];
  check(!!bound && bound.bondage > 0, "no land on the map holds anyone in bondage");
  for (const [name, entry, words, file] of [
    ["Bondage", bound, "Bondage:", "3-bondage-lens"],
    ["Standing", ruled, "Standing:", "4-standing-lens"],
  ] as const) {
    await press(`.mapmodes .mode[aria-label='${name}']`);
    await page.waitForTimeout(slow(800));
    const legend = await page
      .$eval(".mapmodes .legend-title", (e) => e.textContent ?? "")
      .catch(() => "");
    check(legend === name, `the ${name} lens has no legend`);
    if (!entry) continue;
    await point(entry.centre);
    const tipped = await until(
      `a land's tooltip under the ${name} lens`,
      async () => (await tooltip()).includes(words),
      slow(15000),
    );
    say(`${name}: legend “${legend}”; a land's tip: “${(await tooltip()).slice(0, 100)}”`);
    if (tipped) await shot(file);
    await page.mouse.move(30, 400);
  }
  await press(".mapmodes .mode[aria-label='Land']");
}

// 3. The ledger's bonds: every realm's order side by side.
{
  await open("world:ledger#bonds", "the ledger's bonds", "Each realm's order");
  const body = await window_();
  check(body.includes("The bound, realm by realm"), "the ledger's bonds have no bars of the bound");
  check(body.includes("Risings of the bound"), "the ledger's bonds tell no risings");
  say(`the ledger's bonds: “${body.slice(0, 120).replace(/\s+/g, " ")}…”`);
  await shot("5-ledger-bonds");
  await k(`document.querySelector(".page-window .close")?.click()`);
}

// 4. The god's hand: a sign against the realm's rule, asked twice, told on its page.
if (realm) {
  await open(`${realm}#order`, "the realm's order again", "Standing");
  await pressWords("🌩️ A sign against its rule");
  await page.waitForTimeout(300);
  await pressWords("🌩️ A sign against its rule");
  await k("globalThis.causalis.client.setSpeed(1)");
  const told = await until(
    "the sign told on the realm's page",
    async () => (await window_()).includes("A sign from the heavens"),
    slow(30000),
  );
  await k("globalThis.causalis.client.setSpeed(0)");
  say(`the sign against its rule: ${told ? "told and weighed on its page" : "not told"}`);
  await shot("6-sign");
}

// 5. On a phone: the Order tab, nothing running off its side.
if (realm) {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.waitForTimeout(slow(1000));
  await open(`${realm}#order`, "the realm's order on a phone", "Standing");
  // (The window within the screen, its body never wider than itself — a table scrolls in its own
  // box — and the page never scrolling sideways.)
  const fit = await k<boolean>(
    `(() => { const w = document.querySelector(".page-window"), b = w?.querySelector(".page-body"); if (!w || !b) return false; const r = w.getBoundingClientRect(); return r.left >= 0 && r.right <= innerWidth + 1 && b.scrollWidth <= b.clientWidth + 1 && document.documentElement.scrollWidth <= innerWidth + 1; })()`,
  );
  check(fit, "the Order tab runs off a phone's side");
  await shot("7-phone");
}

for (const e of errors) problems.push(`the page said: ${e}`);
await browser.close();
await server.close();
if (problems.length) {
  console.log(`\nthe Phase 19 gate fails:\n${problems.map((p) => `  ✗ ${p}`).join("\n")}`);
  process.exit(1);
}
console.log("\nthe Phase 19 gate passes");
process.exit(0);
