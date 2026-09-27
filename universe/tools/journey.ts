// node tools/journey.ts [--sky-year n] [--shots dir] — the brief's §29 journey, walked by a
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
  skyYear = Number(at("--sky-year") ?? 1400),
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
const inspector = ".panel:not([hidden]) .inspector:not([hidden])";
/** Click the first line or button in the open inspector whose text matches, and read the why that opens. */
async function whyOf(text: RegExp): Promise<string> {
  const line = page.locator(`${inspector} button, ${inspector} .fact`, { hasText: text }).first();
  await line.waitFor({ timeout: 15000 });
  await line.click();
  const claim = page.locator(`${inspector} .why .claim`).first();
  await claim.waitFor({ timeout: 15000 });
  return (await claim.textContent()) ?? "";
}
const heading = async (text: string) =>
  page.locator(`${inspector} h3`, { hasText: text }).first().waitFor({ timeout: 15000 });
/** Open the page a line stands for, and wait for it: its title, then its first fact. */
async function openPage(text: RegExp, title?: RegExp): Promise<string> {
  const line = page.locator(`${inspector} .page-line`, { hasText: text }).first();
  await line.waitFor({ timeout: 15000 });
  await line.click();
  await page.locator(`${inspector} .page .back`).first().waitFor({ timeout: 15000 });
  const h2 = page.locator(`${inspector} h2`).first();
  if (title)
    await page.waitForFunction(
      ([sel, re]) =>
        new RegExp(re as string).test(document.querySelector(sel as string)?.textContent ?? ""),
      [`${inspector} h2`, title.source] as const,
      { timeout: 15000 },
    );
  return (await h2.textContent()) ?? "";
}
/** The why the inspector shows once it has more than `n` claims open. */
async function claims(n: number): Promise<string[]> {
  await page.waitForFunction(
    ([sel, n]) => document.querySelectorAll(sel as string).length > (n as number),
    [`${inspector} .why .claim`, n] as const,
    { timeout: 15000 },
  );
  return page.locator(`${inspector} .why .claim`).allTextContents();
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
  const name = await openPage(/lives wild here/);
  await heading("What it is to the people");
  const facts = await page.locator(`${inspector} .page .fact`).allTextContents();
  return `${name}: ${facts.slice(0, 2).join("; ")} — ${(await claims(0))[0]}`;
});
await step("a civilization", async () => {
  await call("select", peopled.centre);
  await heading("Their rulers");
  const name = await openPage(/^(The seat of|Part of)/);
  await heading("Its rulers");
  return `${name}: ${(await claims(0))[0]}`;
});
await step("its technology", async () => {
  await heading("What they know, in the order");
  const known = page.locator(`${inspector} .page .line`, { hasText: /^Year \d+:/ });
  const n = await known.count();
  if (!n) throw new Error("the realm knows nothing yet");
  await known.first().click();
  return `${n} things known, in order; the first: ${(await claims(0))[0]}`;
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
  await page.locator(`${inspector} h2`).first().waitFor({ timeout: 15000 });
  return (await page.locator(`${inspector} h2`).first().textContent()) ?? "";
});
await step("an unimportant citizen", async () => {
  await page.locator(`${inspector} .act`, { hasText: "Meet a family" }).click();
  await page.waitForSelector(`${inspector} .family .person`, { timeout: 15000 });
  await page.click(`${inspector} .family .person`);
  await page.locator(`${inspector} .why .claim`).first().waitFor({ timeout: 15000 });
  // Their name, once their life has been told.
  await page.waitForFunction(
    (sel) => !/^[.…\s]*$/.test(document.querySelector(sel)?.textContent ?? ""),
    `${inspector} h2`,
    { timeout: 30000 },
  );
  return (await page.locator(`${inspector} h2`).first().textContent()) ?? "";
});
await step("a formative memory", async () => {
  const memory = page.locator(`${inspector} .memory, ${inspector} .life button`).first();
  await memory.waitFor({ timeout: 15000 });
  await memory.click();
  return (await page.locator(`${inspector} .why .claim`).first().textContent()) ?? "";
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
  const name = await openPage(/units of/);
  return `${name}: ${(await claims(0))[0]}`;
});
await step("geology", async () => {
  const plate = await openPage(/^It lies on a/, /plate/);
  const said = (await claims(0))[0];
  await openPage(/deep past/, /deep past/);
  const ages = await page.locator(`${inspector} .page .line`).count();
  if (!ages) throw new Error("no ages of the deep past");
  return `${plate}: ${said}; ${ages} ages of the deep past`;
});
await step("back out", async () => "the world again");
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
console.log(`\n${steps.length - missing.length} of ${steps.length} steps of the journey taken`);
if (missing.length) {
  console.log(`missing: ${missing.map((s) => s.name).join(", ")}`);
  process.exitCode = 1;
}
