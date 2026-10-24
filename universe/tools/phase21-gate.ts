// node tools/phase21-gate.ts [--ci] [--soft] [--shots dir] — the Phase 21 gate (credit, asked for
// 2026-10-23: "debt, credit, banking" and "debt bondage"), done in a real browser on the built app,
// on the Earth seed four centuries and a half on:
//   1. the ledger's credit: every house of lending side by side, what each holds;
//   2. the greatest house's page: what it holds, is owed, lent, earned and drew, and the book's
//      page of credit opened from the ⓘ beside it;
//   3. a realm's credit: its war chests, its lands' debts;
//   4. the map's lens of debt, its legend, a land's tooltip under it;
//   5. the god's hand: a house of lending broken, asked twice, told on its page;
//   6. a house's page on a phone, nothing running off its side.
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
console.log("the Phase 21 gate");
if (shots) mkdirSync(shots, { recursive: true });

type Row = { ref?: string; cells: unknown[]; keys?: (number | string)[] };
type Fact = { label: string; value: unknown; why?: string | null };
type Model = {
  tabs: {
    id: string;
    blocks: { type: string; title?: string; rows?: (Row & Fact)[] }[];
  }[];
};

const root = fileURLToPath(new URL("..", import.meta.url)),
  server = await preview({ root, logLevel: "silent", preview: { port: 4275, strictPort: false } }),
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

await page.goto(`${base}?universe=earth&year=450`);
await page.waitForFunction(
  () => ((globalThis as any).causalis?.drawn?.() as number) > 0,
  undefined,
  { timeout: 900000 },
);
await k("globalThis.causalis.client.setSpeed(0)");
await page.waitForTimeout(1500);

// 1. The ledger's credit: every house side by side, what each holds.
const ledger = await q<Model>("page", { ref: "world:ledger" }),
  table = ledger.tabs
    .find((t) => t.id === "credit")
    ?.blocks.find((b) => b.type === "table" && b.title === "Every house"),
  greatest = table?.rows?.[0],
  house = greatest?.ref ?? null;
check(!!house, "the ledger lists no house of lending four centuries and a half on");
say(
  `houses: ${table?.rows?.length ?? 0}; the greatest ${house} (lent ${greatest?.keys?.[5] ?? 0})`,
);
{
  await open("world:ledger#credit", "the ledger's credit", "Every house");
  const body = await window_();
  check(body.includes("What each house holds"), "the ledger has no bars of what each house holds");
  await shot("1-ledger-credit");
  await k(`document.querySelector(".page-window .close")?.click()`);
}

// 2. The greatest house's page; the book's page of credit from the ⓘ beside what it holds.
if (house) {
  await open(house, "the house's page", "It holds");
  const body = await window_();
  for (const words of [
    "It holds",
    "Owed it now",
    "Lent, ever",
    "Earned in interest",
    "Drawn by its family",
    "It began",
  ])
    check(body.includes(words), `its page does not tell “${words}”`);
  say(`its page: “${body.slice(0, 160).replace(/\s+/g, " ")}…”`);
  await shot("2-house");
  const opened = await k<boolean>(
    `(() => { const a = document.querySelector(".page-window a.concept-link[href='#concept:credit']"); if (!a) return false; a.click(); return true; })()`,
  );
  check(opened, "what it holds has no ⓘ to the book of concepts");
  await until(
    "the book's page of credit",
    async () => (await window_()).includes("Credit and its houses"),
    slow(15000),
  );
  check(
    (await window_()).includes("three times what it holds"),
    "the page of credit does not say how far a house lends",
  );
  await shot("3-concept");
  await k(`document.querySelector(".page-window .close")?.click()`);
}

// 3. A realm's credit: its war chests (the first realm of the ledger's that has one).
{
  const realms = ledger.tabs
    .find((t) => t.id === "realms")
    ?.blocks.flatMap((b) => (b.type === "table" ? (b.rows ?? []) : []))
    .map((r) => r.ref)
    .filter((r): r is string => !!r);
  let found: string | null = null;
  for (const ref of realms ?? []) {
    const m = await q<Model>("page", { ref });
    const rows = m.tabs
      .find((t) => t.id === "credit")
      ?.blocks.flatMap((b) => (b.type === "facts" ? (b.rows ?? []) : []));
    const chests = rows?.find((r) => r.label === "War chests");
    if (chests && JSON.stringify(chests.value) !== '"none"') {
      found = ref;
      break;
    }
  }
  check(!!found, "no realm has borrowed for a war four centuries and a half on");
  if (found) {
    await open(`${found}#credit`, "a realm's credit", "War chests");
    const body = await window_();
    check(
      body.includes("Its war chests, the newest first"),
      "the realm's credit lists no war chest",
    );
    check(body.includes("for its war"), "the realm's war chests do not say what they were for");
    say(`a realm's credit: “${body.slice(0, 160).replace(/\s+/g, " ")}…”`);
    await shot("4-realm-credit");
    await k(`document.querySelector(".page-window .close")?.click()`);
  }
}

// 4. The lens of debt: its legend; a land's tooltip under it.
{
  const map =
      await q<{ cell: number; centre: number; people: number; debt: number }[]>("people.map"),
    owing = [...map].sort((a, b) => b.debt - a.debt || b.people - a.people)[0];
  await press(".mapmodes .mode[aria-label='Debt']");
  await page.waitForTimeout(slow(800));
  const legend = await page
      .$eval(".mapmodes .legend-title", (e) => e.textContent ?? "")
      .catch(() => ""),
    ends = await text(".mapmodes .legend-ends");
  check(legend === "Debt", "the Debt lens has no legend");
  check(ends.includes("a year's food"), "the Debt lens's legend does not run to a year's food");
  if (owing) {
    await point(owing.centre);
    const tipped = await until(
      "a land's tooltip under the Debt lens",
      async () => (await tooltip()).includes("Debt:"),
      slow(15000),
    );
    say(`Debt: legend “${legend}”; a land's tip: “${(await tooltip()).slice(0, 110)}”`);
    if (tipped) await shot("5-debt-lens");
    await page.mouse.move(30, 400);
  }
  await press(".mapmodes .mode[aria-label='Land']");
}

// 5. The god's hand: the greatest house broken, asked twice, told on its page.
if (house) {
  const p = await q<{ place: { spot?: number } | null; subtitle: unknown }>("page", { ref: house }),
    cell = Number(/cell:0:(\d+)/.exec(JSON.stringify(p.subtitle))?.[1] ?? NaN);
  check(Number.isInteger(cell), "the house's page does not name its land");
  if (Number.isInteger(cell)) {
    await open(`cell:0:${cell}#debt`, "the house's land's debts", "A house lends here");
    await pressWords("🔨 Break");
    await page.waitForTimeout(300);
    await pressWords("🔨 Break");
    await k("globalThis.causalis.client.setSpeed(1)");
    await k(`globalThis.causalis.open(${JSON.stringify(house)})`);
    const told = await until(
      "the house's breaking told on its page",
      async () => {
        await k(`globalThis.causalis.open(${JSON.stringify(house)})`);
        return (await window_()).includes("It failed");
      },
      slow(30000),
    );
    await k("globalThis.causalis.client.setSpeed(0)");
    say(`the house broken: ${told ? "told on its page" : "not told"}`);
    await shot("6-broken");
    await k(`document.querySelector(".page-window .close")?.click()`);
  }
}

// 6. On a phone: a house's page, nothing running off its side.
if (house) {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.waitForTimeout(slow(1000));
  await open(house, "the house's page on a phone", "It holds");
  const fit = await k<boolean>(
    `(() => { const w = document.querySelector(".page-window"), b = w?.querySelector(".page-body"); if (!w || !b) return false; const r = w.getBoundingClientRect(); return r.left >= 0 && r.right <= innerWidth + 1 && b.scrollWidth <= b.clientWidth + 1 && document.documentElement.scrollWidth <= innerWidth + 1; })()`,
  );
  check(fit, "a house's page runs off a phone's side");
  await shot("7-phone");
}

for (const e of errors) problems.push(`the page said: ${e}`);
await browser.close();
await server.close();
if (problems.length) {
  console.log(`\nthe Phase 21 gate fails:\n${problems.map((p) => `  ✗ ${p}`).join("\n")}`);
  process.exit(1);
}
console.log("\nthe Phase 21 gate passes");
process.exit(0);
