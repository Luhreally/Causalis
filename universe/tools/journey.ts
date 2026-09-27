// node tools/journey.ts [--sky-year n] [--shots dir] [--json] — the brief's §29 journey, walked by a
// machine at a phone's size in WebKit (Phase 7 M66): each step opens its page and asks
// "why?", and the report says what it saw or what was missing. Part one walks an open
// world three centuries on (the planet, its living things, a people, their knowledge, a
// town, a citizen, a memory, a move, a war, trade, the ground); part two the Earth seed in
// its space age (the sky, a colony, its drift, a state of its own, a war out there).
// (npm run build first.)
import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { preview } from "vite";
import { webkit, type Page } from "playwright";

const args = process.argv.slice(2),
  at = (flag: string) => (args.includes(flag) ? args[args.indexOf(flag) + 1] : undefined),
  skyYear = Number(at("--sky-year") ?? 1450),
  shots = at("--shots");
const root = fileURLToPath(new URL("..", import.meta.url));
const server = await preview({
  root,
  logLevel: "silent",
  preview: { port: 4211, strictPort: false },
});
const base = server.resolvedUrls!.local[0]!;
const browser = await webkit.launch();

type Exposed = Record<string, (...a: unknown[]) => unknown> & {
  client?: { query<T>(q: { type: string; args?: unknown }): Promise<T> };
};
const steps: { name: string; ok: boolean; saw: string }[] = [];
let page: Page;

async function step(name: string, run: () => Promise<string>): Promise<void> {
  try {
    const saw = await run();
    steps.push({ name, ok: true, saw });
    console.log(`  ✓ ${name.padEnd(28)} ${saw.slice(0, 110)}`);
  } catch (error) {
    const saw = (error as Error).message.split("\n")[0]!;
    steps.push({ name, ok: false, saw });
    console.log(`  ✗ ${name.padEnd(28)} ${saw.slice(0, 110)}`);
  }
  if (shots)
    await page.screenshot({ path: join(shots, `journey-${steps.length}.png`) }).catch(() => {});
}

const call = (fn: string, ...a: unknown[]) =>
  page.evaluate(
    ([fn, a]) =>
      (
        (globalThis as { causalis?: Exposed }).causalis![fn as string] as (
          ...x: unknown[]
        ) => unknown
      )(...(a as unknown[])),
    [fn, a] as const,
  );
const query = <T>(type: string, a?: unknown) =>
  page.evaluate(
    ([type, a]) =>
      (globalThis as { causalis?: Exposed }).causalis!.client!.query({
        type: type as string,
        args: a,
      }),
    [type, a] as const,
  ) as Promise<T>;
// Every thing's page opens in one window (Phase 10 M92); the sky's scales keep their own.
const win = ".page-window";
const heading = async (text: string) =>
  page
    .locator(".panel:not([hidden]) .inspector:not([hidden]) h3", { hasText: text })
    .first()
    .waitFor({ timeout: 15000 });
/** The title of the page open, once it has one (not the "…" of one still being read). */
async function title(not?: string): Promise<string> {
  await page.waitForFunction(
    ([sel, not]) => {
      const t = document.querySelector(sel as string)?.textContent ?? "";
      return !!t && t !== "…" && t !== not;
    },
    [`${win} .page-title`, not ?? ""] as const,
    { timeout: 15000 },
  );
  return (await page.locator(`${win} .page-title`).first().textContent()) ?? "";
}
/** Open a tab of the page open. */
async function tab(name: string): Promise<void> {
  const t = page.locator(`${win} .tab`, { hasText: name }).first();
  await t.waitFor({ timeout: 15000 });
  await t.click();
}
/** Open the first entry of the tab open whose words match, and wait for its page. */
async function openEntry(text: RegExp): Promise<string> {
  const before = (await page.locator(`${win} .page-title`).first().textContent()) ?? "";
  const entry = page.locator(`${win} .line.entry`, { hasText: text }).first();
  await entry.waitFor({ timeout: 15000 });
  await entry.click();
  return title(before);
}
/** Open the first name on the page whose words match, and wait for its page. */
async function openLink(text: RegExp): Promise<string> {
  const before = (await page.locator(`${win} .page-title`).first().textContent()) ?? "";
  const link = page.locator(`${win} .ref-link`, { hasText: text }).first();
  await link.waitFor({ timeout: 15000 });
  await link.click();
  return title(before);
}
/** The whys the page shows once it has more than `n` claims. */
async function claims(n: number): Promise<string[]> {
  await page.waitForFunction(
    ([sel, n]) => document.querySelectorAll(sel as string).length > (n as number),
    [`${win} .why .claim`, n] as const,
    { timeout: 15000 },
  );
  return page.locator(`${win} .why .claim`).allTextContents();
}
if (shots) mkdirSync(shots, { recursive: true });

// Part one: an open world, three centuries on.
page = await browser.newPage({ viewport: { width: 390, height: 844 } });
console.log("an open world, three centuries on");
await step("generate", async () => {
  await page.goto(`${base}?universe=alien&seed=alien%2055&year=300`);
  await page.waitForFunction(
    () => ((globalThis as { causalis?: Exposed }).causalis?.drawn?.() as number) > 0,
    undefined,
    { timeout: 600000 },
  );
  return "an alien world drawn";
});
await step("discover an alien planet", async () => {
  const world = (await page.locator(".world-line").first().textContent()) ?? "";
  await call("sky");
  await page.waitForFunction(
    () => ((globalThis as { causalis?: Exposed }).causalis?.skyBodies?.() as number) > 0,
    undefined,
    { timeout: 30000 },
  );
  await page.locator(".panel:not([hidden]) .bar button", { hasText: "The world" }).click();
  return world.trim() || "its star's system seen";
});
const map = await query<{ cell: number; centre: number; people: number }[]>("people.map");
const byPeople = [...map].sort((a, b) => b.people - a.people || a.cell - b.cell);
// The most peopled land where beasts live wild (a people of the sea may live where none do).
let peopled = byPeople[0]!;
for (const p of byPeople.slice(0, 40)) {
  const f = await query<{ wild: unknown[]; realm: unknown } | null>("province", { cell: p.cell });
  if (f && f.wild.length && f.realm) {
    peopled = p;
    break;
  }
}
await step("examine its ecosystem and species", async () => {
  await call("select", peopled.centre);
  await title();
  // (A lineage that lives there: the land's page, its living world.)
  await tab("Life");
  const name = await openEntry(/./);
  const facts = await page.locator(`${win} .fact`).allTextContents();
  return `${name}: ${facts.slice(0, 2).join("; ")} — ${(await claims(0))[0]}`;
});
await step("a civilization", async () => {
  await call("select", peopled.centre);
  await title();
  await tab("Realm");
  const name = await openLink(/^the /);
  const said = (await claims(0))[0];
  await tab("Rulers");
  const rulers = await page.locator(`${win} .line.entry`).count();
  return `${name}: ${said}; ${rulers} rulers remembered`;
});
await step("its technology", async () => {
  await tab("Lore");
  const known = page.locator(`${win} .line.entry`, { hasText: /year \d+/ });
  const n = await known.count();
  if (!n) throw new Error("the realm knows nothing yet");
  await openEntry(/year \d+/);
  return `${n} things known, in order; the newest: ${(await claims(0))[0]}`;
});
let village: { ref: string; tile: number; name: string } | null = null;
await step("a city", async () => {
  for (const p of [...map].sort((a, b) => b.people - a.people || a.cell - b.cell).slice(0, 40)) {
    const vs = await query<{ ref: string; tile: number; name: string }[]>("settlements", {
      cell: p.cell,
    });
    if (vs.length) {
      await call("descend", p.cell);
      village = vs[0]!;
      break;
    }
  }
  if (!village) throw new Error("no town on the world");
  await page.waitForFunction(
    () => ((globalThis as { causalis?: Exposed }).causalis?.villages?.() as number) > 0,
    undefined,
    { timeout: 30000 },
  );
  await call("select", village.tile);
  return title();
});
await step("an unimportant citizen", async () => {
  // A family of the town met: its household's page, then one of them.
  await tab("Families");
  const before = await title();
  await page.locator(`${win} .act`, { hasText: "Meet a family" }).click();
  await title(before);
  const who = await openEntry(/./);
  await claims(0);
  return who;
});
await step("a formative memory", async () => {
  // What they remember; or, if nothing yet, what their life has brought.
  const tabs = await page.locator(`${win} .tab`).allTextContents();
  await tab(tabs.includes("Memories") ? "Memories" : "Life");
  await openEntry(/./);
  return (await claims(0))[0] ?? "";
});
async function chronicled(types: string[]): Promise<string> {
  const c = await query<{ events?: { type: string; ref: string }[] }>("chronicle", {
    limit: 50,
    types,
  });
  const e = (c.events ?? [])[0];
  if (!e) throw new Error(`none of ${types.join(", ")} in the chronicle`);
  return (await query<{ claim: string }>("why", { ref: e.ref, depth: 1 })).claim;
}
await step("migration", () => chronicled(["people.migration", "province.peopled"]));
await step("war", () => chronicled(["war.declared"]));
await step("economic conflict", () => chronicled(["trade.embargo", "trade.relief"]));
await step("deposit", async () => {
  const deposits = await query<{ cell: number; kind: string }[]>("deposits");
  if (!deposits.length) throw new Error("no deposits");
  await page
    .locator(".panel:not([hidden]) .bar button", { hasText: "The world" })
    .first()
    .click()
    .catch(() => {});
  await call("select", deposits[0]!.cell);
  await title();
  // What lies in the land's ground.
  await tab("Land");
  const name = await openEntry(/./);
  return `${name}: ${(await claims(0))[0]}`;
});
await step("geology", async () => {
  const plate = await openLink(/plate/);
  const said = (await claims(0))[0];
  // The ages of the deep past, from the deposit's own (or the first of them).
  await page.locator(`${win} .nav-back`).click();
  await title(plate);
  const age = page.locator(`${win} .ref-link`, { hasText: /deep past/ });
  if (await age.count()) await openLink(/deep past/);
  else await call("open", "age:0:0");
  await title(plate);
  const ages = await page.locator(`${win} .line.entry`, { hasText: /million years ago/ }).count();
  if (!ages) throw new Error("no ages of the deep past");
  return `${plate}: ${said}; ${ages} ages of the deep past`;
});
await step("back out", async () => {
  // Back through the pages, one at a time, to the land's own.
  for (let i = 0; i < 12; i++) {
    const back = page.locator(`${win} .nav-back`).first();
    if (await back.isDisabled()) break;
    const was = (await page.locator(`${win} .page-title`).first().textContent()) ?? "";
    await back.click();
    await title(was);
    if (/'s land$|^The .* at /.test((await page.locator(`${win} .page-title`).textContent()) ?? ""))
      break;
  }
  const t = (await page.locator(`${win} .page-title`).first().textContent()) ?? "";
  if (!(await page.locator(`${win} .fact`).first().isVisible()))
    throw new Error("the land's own page did not come back");
  return `back to ${t}`;
});
await page.close();

// Part two: the Earth seed in its space age.
page = await browser.newPage({ viewport: { width: 390, height: 844 } });
console.log(`the Earth seed at year ${skyYear}`);
await page.goto(`${base}?year=${skyYear}`);
await page.waitForFunction(
  () => ((globalThis as { causalis?: Exposed }).causalis?.drawn?.() as number) > 0,
  undefined,
  { timeout: 1_800_000 },
);
type Sky = {
  programs: { name: string }[];
  colonies: { event: string | null; realm: string | null; founder: string | null }[];
  ships?: { voyage: string; arrived: boolean; realm: string | null }[];
};
const sky = await query<Sky>("space.state");
await step("spaceflight", async () => {
  await call("sky");
  await heading("In the sky");
  if (!sky.programs.length) throw new Error("no one in the sky");
  return `${sky.programs.length} realms in the sky`;
});
await step("colony", async () => {
  const c = sky.colonies.find((x) => x.event);
  if (!c) throw new Error("no colony");
  return (await query<{ claim: string }>("why", { ref: c.event, depth: 1 })).claim;
});
await step("divergence", async () => {
  const drifted = sky.colonies.find((x) => x.founder && x.realm !== x.founder);
  if (!drifted) throw new Error("no colony gone its own way yet");
  return `a colony of ${drifted.founder}, now ${drifted.realm ?? "their own"}`;
});
await step("new states", async () => {
  const own = sky.colonies.filter((x) => x.realm === null || x.realm !== x.founder).length;
  if (!own) throw new Error("no colony a state of its own");
  return `${own} colonies their own`;
});
await step("interplanetary or interstellar war", async () => {
  try {
    return await chronicled(["starwar.declared"]);
  } catch {
    // Or a war fought over a land beyond the world.
    const c = await query<{ events?: { ref: string; claim: string }[] }>("chronicle", {
      limit: 400,
      types: ["war.declared"],
    });
    const e = (c.events ?? []).find((x) => /halls on|light-years/.test(x.claim));
    if (!e) throw new Error("no war between worlds or stars in the chronicle");
    return e.claim;
  }
});
await page.close();

await browser.close();
await server.close();
const missing = steps.filter((s) => !s.ok);
// --json: the steps as one line of JSON (for the Phase 7 gate).
if (args.includes("--json")) console.log(JSON.stringify(steps));
console.log(`\n${steps.length - missing.length} of ${steps.length} steps of the journey taken`);
if (missing.length) {
  console.log(`missing: ${missing.map((s) => s.name).join(", ")}`);
  process.exitCode = 1;
}
