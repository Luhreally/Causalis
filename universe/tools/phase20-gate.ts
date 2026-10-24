// node tools/phase20-gate.ts [--ci] [--soft] [--shots dir] — the Phase 20 gate (sickness, asked
// for 2026-10-23: "health and epidemiology — pathogens, immunity, epidemics, sanitation,
// medicine, public health, healthcare inequality"), done in a real browser on the built app, on
// the Earth seed four centuries on:
//   1. the ledger's sicknesses: every sickness side by side, the deadliest first;
//   2. the deadliest sickness's page: its nature, its rising, its dead, a drop of a sick one's
//      blood under the glass, and the book's page for a sickness opened from the ⓘ beside it;
//   3. the map's lens of sickness, its legend, a land's tooltip breaking it down;
//   4. the god's hand: a land warded against sickness, asked twice, told on its page;
//   5. a sickness's page on a phone, nothing running off its side;
//   6. a world begun when strangers come down (M142): three centuries on, a people of another
//      star called down by the god among the most peopled land — their ship over the town and
//      themselves among its people.
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
console.log("the Phase 20 gate");
if (shots) mkdirSync(shots, { recursive: true });

type Row = { ref?: string; cells: unknown[]; keys?: (number | string)[] };
type Model = {
  tabs: { id: string; blocks: { type: string; title?: string; rows?: Row[] }[] }[];
};

const root = fileURLToPath(new URL("..", import.meta.url)),
  server = await preview({ root, logLevel: "silent", preview: { port: 4274, strictPort: false } }),
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

await page.goto(`${base}?universe=earth&year=400`);
await page.waitForFunction(
  () => ((globalThis as any).causalis?.drawn?.() as number) > 0,
  undefined,
  { timeout: 900000 },
);
await k("globalThis.causalis.client.setSpeed(0)");
await page.waitForTimeout(1500);

// 1. The ledger's sicknesses: every sickness side by side, the deadliest first.
const ledger = await q<Model>("page", { ref: "world:ledger" }),
  table = ledger.tabs
    .find((t) => t.id === "sickness")
    ?.blocks.find((b) => b.type === "table" && b.title === "Every sickness"),
  deadliest = table?.rows?.[0],
  sickness = deadliest?.ref ?? null;
check(!!sickness, "the ledger lists no sickness four centuries on");
say(
  `sicknesses: ${table?.rows?.length ?? 0}; the deadliest ${sickness} (${deadliest?.keys?.[5] ?? 0} dead)`,
);
{
  await open("world:ledger#sickness", "the ledger's sicknesses", "Every sickness");
  const body = await window_();
  check(body.includes("The dead, sickness by sickness"), "the ledger has no bars of the dead");
  await shot("1-ledger-sickness");
  await k(`document.querySelector(".page-window .close")?.click()`);
}

// 2. The deadliest sickness's page; its drop under the glass; the book's page of a sickness.
if (sickness) {
  await open(sickness, "the sickness's page", "It passes");
  const body = await window_();
  for (const words of [
    "It passes",
    "Of those it reaches",
    "Of those who take it",
    "The survivors",
    "It rose",
    "Its dead",
  ])
    check(body.includes(words), `its page does not tell “${words}”`);
  const drop = await until(
    "the drop of a sick one's blood under the glass",
    async () => (await k<number>(`document.querySelectorAll(".page-window canvas").length`)) > 0,
    slow(15000),
  );
  say(`its page: “${body.slice(0, 140).replace(/\s+/g, " ")}…”; the drop drawn: ${drop}`);
  await shot("2-sickness");
  const opened = await k<boolean>(
    `(() => { const a = document.querySelector(".page-window a.concept-link[href='#concept:sickness']"); if (!a) return false; a.click(); return true; })()`,
  );
  check(opened, "its nature has no ⓘ to the book of concepts");
  await until(
    "the book's page of a sickness",
    async () => (await window_()).includes("one of the world's workings"),
    slow(15000),
  );
  check(
    (await window_()).includes("on the breath"),
    "the page of sickness does not say how it passes",
  );
  await shot("3-concept");
  await k(`document.querySelector(".page-window .close")?.click()`);
}

// 3. The lens of sickness: its legend; a land's tooltip under it.
let struck: { cell: number; centre: number; sickness: number } | undefined;
{
  const map =
    await q<{ cell: number; centre: number; people: number; sickness: number }[]>("people.map");
  struck = [...map].sort((a, b) => b.sickness - a.sickness || b.people - a.people)[0];
  await press(".mapmodes .mode[aria-label='Sickness']");
  await page.waitForTimeout(slow(800));
  const legend = await page
      .$eval(".mapmodes .legend-title", (e) => e.textContent ?? "")
      .catch(() => ""),
    ends = await text(".mapmodes .legend-ends");
  check(legend === "Sickness", "the Sickness lens has no legend");
  check(ends.includes("a great dying"), "the Sickness lens's legend does not run to a great dying");
  if (struck) {
    await point(struck.centre);
    const tipped = await until(
      "a land's tooltip under the Sickness lens",
      async () => (await tooltip()).includes("Sickness:"),
      slow(15000),
    );
    say(`Sickness: legend “${legend}”; a land's tip: “${(await tooltip()).slice(0, 110)}”`);
    if (tipped) await shot("4-sickness-lens");
    await page.mouse.move(30, 400);
  }
  await press(".mapmodes .mode[aria-label='Land']");
}

// 4. The god's hand: a land warded, asked twice, told on its page.
if (struck) {
  await open(`cell:0:${struck.cell}#health`, "the land's health", "Its healers");
  await pressWords("💉 Ward this land");
  await page.waitForTimeout(300);
  await pressWords("💉 Ward this land");
  await k("globalThis.causalis.client.setSpeed(1)");
  const told = await until(
    "the ward told on the land's page",
    async () => (await window_()).includes("Warded by the god"),
    slow(30000),
  );
  await k("globalThis.causalis.client.setSpeed(0)");
  say(`the ward: ${told ? "told on the land's page" : "not told"}`);
  await shot("5-ward");
  await k(`document.querySelector(".page-window .close")?.click()`);
}

// 5. On a phone: a sickness's page, nothing running off its side.
if (sickness) {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.waitForTimeout(slow(1000));
  await open(sickness, "the sickness's page on a phone", "It passes");
  const fit = await k<boolean>(
    `(() => { const w = document.querySelector(".page-window"), b = w?.querySelector(".page-body"); if (!w || !b) return false; const r = w.getBoundingClientRect(); return r.left >= 0 && r.right <= innerWidth + 1 && b.scrollWidth <= b.clientWidth + 1 && document.documentElement.scrollWidth <= innerWidth + 1; })()`,
  );
  check(fit, "a sickness's page runs off a phone's side");
  await shot("6-phone");
}

// 6. When strangers come down: juniper three centuries on, the god's call answered.
{
  await page.setViewportSize({ width: 1366, height: 800 });
  await page.goto(`${base}?universe=earth&seed=juniper&year=300&contact=1`);
  await page.waitForFunction(
    () => ((globalThis as any).causalis?.drawn?.() as number) > 0,
    undefined,
    { timeout: 900000 },
  );
  const came = await until(
    "the strangers called down, among the town's people",
    async () =>
      ((await k<{ figures: number } | null>("globalThis.causalis.visitors?.() ?? null"))?.figures ??
        0) > 0,
    slow(120000),
  );
  // (And the eye gone down to them, its flight done.)
  const down =
    came &&
    (await until(
      "the eye gone down to the strangers",
      async () =>
        (await k<boolean>(
          "!globalThis.causalis.rig.flying && globalThis.causalis.rig.distance < 60",
        )) === true,
      slow(30000),
    ));
  const shown = await k<{ groups: number; figures: number; whys: string[] } | null>(
    "globalThis.causalis.visitors?.() ?? null",
  );
  say(
    `when strangers come down: ${shown?.groups ?? 0} ship (${shown?.whys.join(", ") ?? "none"}), ${shown?.figures ?? 0} of them among the people, the eye ${down ? "down among them" : "still far off"}`,
  );
  if (came) await shot("7-strangers-come-down");
}

for (const e of errors) problems.push(`the page said: ${e}`);
await browser.close();
await server.close();
if (problems.length) {
  console.log(`\nthe Phase 20 gate fails:\n${problems.map((p) => `  ✗ ${p}`).join("\n")}`);
  process.exit(1);
}
console.log("\nthe Phase 20 gate passes");
process.exit(0);
