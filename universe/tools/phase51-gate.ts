// node tools/phase51-gate.ts [--ci] [--soft] [--shots dir] — the Phase 51 gate (things seen being
// made, M213; asked for 2026-10-25: "see it being made ... smiths at the forge ... The chain from
// ground to object stays the same, you can see it, and you can tap through it"), on the built app,
// the Earth seed three centuries on, in its greatest town that digs its own copper ore and keeps a
// smithy and smiths of its own:
//   1. a working morning: one of its people at the furnace by the diggings working the bellows, the
//      furnace's mouth aglow; its smiths carrying copper to the forge;
//   2. the day's tools hung on the rack before the smithy as they are made, more by the afternoon;
//   3. one of them tapped where it hangs: its page — "A copper sickle" — made by one of the town's
//      smiths, traced from its ore to the rack, its ore's page opened from it;
//   4. the page at a phone's width.
// (npm run build first; --soft draws in software, as CI's browser does; --shots keeps a
// picture of each step.)
import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { preview } from "vite";
import { chromium } from "playwright";

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
console.log("the Phase 51 gate");
if (shots) mkdirSync(shots, { recursive: true });

type Person = {
  name: string;
  x: number;
  z: number;
  index: number;
  task: string | null;
  why: string | null;
  carry: string | null;
  folk: boolean;
};
type Civic = { kind: string; at: number; start: number; end: number; fell: number | null };
type Plan = {
  ref: string;
  name: string;
  seed: number;
  metal?: string;
  stuff?: { ore: { name: string } | null } | null;
  works?: { mine: { what: string } | null } | null;
  town?: { civics: Civic[] } | null;
  people: { ref: string; name: string; folk?: boolean; trade?: { kind: string } }[];
};
type Trades = {
  smithies: number;
  smelting: boolean;
  hung: number;
  sparks: number;
  rack: { x: number; z: number } | null;
};

const root = fileURLToPath(new URL("..", import.meta.url)),
  // (CAUSALIS_DIST: a build elsewhere, so that one can be looked at while dist/ is under test.)
  server = await preview({
    root,
    logLevel: "silent",
    preview: { port: 4308, strictPort: false },
    ...(process.env.CAUSALIS_DIST ? { build: { outDir: process.env.CAUSALIS_DIST } } : {}),
  }),
  base = server.resolvedUrls!.local[0]!,
  browser = await chromium.launch({
    args: soft ? ["--use-angle=swiftshader", "--enable-unsafe-swiftshader"] : ci ? [] : GPU,
  });
const errors: string[] = [];
const page = await browser.newPage({ viewport: { width: 1366, height: 800 } });
page.on("pageerror", (e) => errors.push(e.message));
page.on("console", (m) => {
  if (m.type() === "error") errors.push(m.text());
});
const k = <T>(code: string): Promise<T> => page.evaluate(code) as Promise<T>;
const until = async (what: string, ok: () => Promise<boolean>, ms = 60000) => {
  const end = Date.now() + ms;
  while (Date.now() < end) {
    if (await ok().catch(() => false)) return true;
    await page.waitForTimeout(250);
  }
  problems.push(`${what} did not come`);
  return false;
};
const shot = async (name: string) => {
  if (shots) await page.screenshot({ path: join(shots, `${name}.png`) });
};
const people = () => k<Person[]>(`globalThis.causalis.peopleNow?.() ?? []`);
const trades = () => k<Trades | null>(`globalThis.causalis.trades?.() ?? null`);
const rack = () =>
  k<{ x: number; y: number; form: string }[]>(`globalThis.causalis.rackOnScreen?.() ?? []`);
const ask = <T>(type: string, args: unknown) =>
  k<T>(
    `globalThis.causalis.client.query({ type: ${JSON.stringify(type)}, args: ${JSON.stringify(args)} })`,
  );
const DAY = 86400,
  HOUR = 3600,
  YEAR = 365 * DAY;
/** On to moment t (the clock held): the host's word of it come, and a few frames drawn there. */
const advance = async (t: number) => {
  await k(`globalThis.causalis.client.advance(${Math.round(t)})`);
  await page
    .waitForFunction((at) => ((globalThis as any).causalis.client.status?.t ?? 0) >= at - 1, t, {
      timeout: slow(20000),
    })
    .catch(() => undefined);
  await page.waitForTimeout(slow(800));
};
/** The eye over a point of the town (metres), so far off. */
const face = async (x: number, z: number, distance = 22) => {
  await k(`globalThis.causalis.faceTown(${x}, ${z}, ${distance})`);
  await page.waitForTimeout(slow(1500));
};
const mean = (ps: readonly { x: number; z: number }[]) => ({
  x: ps.reduce((a, p) => a + p.x, 0) / Math.max(1, ps.length),
  z: ps.reduce((a, p) => a + p.z, 0) / Math.max(1, ps.length),
});
const title = () =>
  page.$eval(".page-window .page-title", (e) => e.textContent ?? "").catch(() => "");
/** A list on the page window by the start of its title: its rows' words and the refs they link. */
const listOn = (start: string) =>
  k<{ title: string; rows: string[]; refs: string[] } | null>(`(() => {
    const box = [...document.querySelectorAll(".page-window .block-list")].find((b) => b.querySelector("h3")?.textContent?.startsWith(${JSON.stringify(start)}));
    if (!box) return null;
    return {
      title: box.querySelector("h3").textContent,
      rows: [...box.querySelectorAll(".entry")].map((e) => e.textContent ?? ""),
      refs: [...box.querySelectorAll("a.ref-link")].map((a) => a.getAttribute("href").slice(1)),
    };
  })()`);

await page.goto(`${base}?universe=earth&seed=${encodeURIComponent("first light")}&year=300`);
await page.waitForFunction(
  () => ((globalThis as any).causalis?.drawn?.() as number) > 0,
  undefined,
  { timeout: 900000 },
);
await k(`globalThis.causalis.setQuality("high")`);
await k(`globalThis.causalis.client.setSpeed(0)`);
const t0 = await k<number>(`globalThis.causalis.client.status?.t ?? 0`);

// The greatest town digging its own copper ore, with a smithy standing and smiths of its own.
const towns = await ask<{ ref: string; name: string }[]>("towns.map", {});
const standing = (c: Civic) => c.kind === "smithy" && (c.end + 1) * YEAR <= t0 && c.fell === null;
let town: Plan | null = null;
for (const c of towns.slice(0, 40)) {
  const plan = await ask<Plan>("village.plan", { ref: c.ref, folk: 220 });
  if (
    plan.works?.mine?.what === "ore" &&
    plan.stuff?.ore &&
    plan.town?.civics.some(standing) &&
    plan.people.some((p) => p.trade?.kind === "smith")
  ) {
    town = plan;
    break;
  }
}
say(`the town: ${town ? `${town.name}, digging its own ${town.stuff!.ore!.name}` : "none"}`);
check(!!town, "no town of the Earth seed digs and smelts its own ore by year 300");
if (!town) {
  await browser.close();
  await server.close();
  console.log("FAILED:");
  for (const p of problems) console.log(`  - ${p}`);
  process.exit(1);
}
const smiths = new Set(town.people.filter((p) => p.trade?.kind === "smith").map((p) => p.name));
await k(`globalThis.causalis.goTo(${JSON.stringify(town.ref)})`);
await until(
  `${town.name}'s smithy`,
  async () => ((await trades())?.smithies ?? 0) > 0,
  slow(120000),
);
await k(`globalThis.causalis.client.setSpeed(0)`);
await page.waitForTimeout(slow(500));
const t1 = await k<number>(`globalThis.causalis.client.status?.t ?? 0`);
const rest = (day: number) => (day + (town!.seed % 7)) % 7 === 0;
let day = Math.floor(t1 / DAY) + 1;
while (rest(day)) day++;

// 1. A working morning: at the furnace, the bellows worked and its mouth aglow; copper to the forge.
let smelter: Person | null = null,
  glowing = false;
for (let d = 0; d < 4 && !smelter; d++) {
  for (const hour of [9, 10.5, 14]) {
    await advance(day * DAY + hour * HOUR);
    smelter =
      (await people()).find((p) => p.task === "tend" && /bellows/.test(p.why ?? "")) ?? null;
    if (smelter) break;
  }
  if (!smelter) {
    day++;
    while (rest(day)) day++;
  }
}
say(`at the furnace: ${smelter ? `${smelter.name}, “${smelter.why}”` : "no one"}`);
check(!!smelter, "no one at the furnace by the diggings in four working days");
if (smelter) {
  await face(smelter.x, smelter.z, 16);
  for (let tries = 0; tries < 12 && !glowing; tries++) {
    glowing = (await trades())?.smelting ?? false;
    if (!glowing) await page.waitForTimeout(slow(250));
  }
  say(`the furnace's mouth aglow: ${glowing}`);
  check(glowing, "the furnace not aglow while its smelter works the bellows");
  await shot("1-furnace");
}
// (Each smith's walk from the yard with the bars is a few minutes of an errand: the next one ahead
// found in their day, and looked at halfway along it.)
type Leg = { from: number; to: number; why: string | null; carry: string | null };
const secs = async () => (await k<number>(`globalThis.causalis.client.status?.t ?? 0`)) - day * DAY;
let carrying: Person | null = null;
for (const smith of (await people()).filter((p) => smiths.has(p.name))) {
  const legs = await k<Leg[]>(`globalThis.causalis.legs?.(${smith.index}) ?? []`),
    after = (await secs()) + 60,
    walk = legs.find(
      (l) =>
        l.carry === "metal" &&
        /^Carrying the /.test(l.why ?? "") &&
        (l.from + l.to) / 2 > after &&
        (l.from + l.to) / 2 < 11 * HOUR,
    );
  if (!walk) continue;
  await advance(day * DAY + (walk.from + walk.to) / 2);
  carrying =
    (await people()).find(
      (p) =>
        p.index === smith.index &&
        p.carry === "metal" &&
        /^Carrying the (copper|copper and tin|iron) to /.test(p.why ?? ""),
    ) ?? null;
  if (carrying) break;
}
say(`copper to the forge: ${carrying ? `${carrying.name}, “${carrying.why}”` : "none seen"}`);
check(!!carrying, "no smith of the town seen carrying copper to the forge");

// 2. The day's tools on the rack before the smithy, more as the day goes.
await advance(day * DAY + Math.max(11.5 * HOUR, (await secs()) + 60));
const noon = (await trades())?.hung ?? 0;
await advance(day * DAY + 16 * HOUR);
const late = (await trades())?.hung ?? 0;
say(`on the rack: ${noon} by half past eleven, ${late} by four`);
check(noon > 0, "no tools hung on the rack by the late morning");
check(late >= noon && late > 1, "the rack not filling as the day goes");

// 3. One of them tapped where it hangs: its page, its maker, its chain. (The eye brought near the
// rack, looking down on it.)
const rackAt = (await trades())?.rack ?? null;
check(!!rackAt, "no rack before the smithy");
if (rackAt) {
  await k(
    `globalThis.causalis.rig.flyTo({ target: { x: ${rackAt.x * 0.1}, y: 0.25, z: ${rackAt.z * 0.1} }, distance: 2.6, pitch: -32 })`,
  );
  await page.waitForTimeout(slow(2500));
}
const onScreen = (r: { x: number; y: number }) => r.x > 20 && r.x < 1346 && r.y > 120 && r.y < 680;
let hung = (await rack()).filter(onScreen);
if (!hung.length) {
  await page.waitForTimeout(slow(1000));
  hung = (await rack()).filter(onScreen);
}
check(hung.length > 0, "the rack's tools not on the screen");
let opened = "";
if (hung.length) {
  const tool = hung[Math.floor(hung.length / 2)]!;
  await shot("2-rack");
  await page.mouse.click(tool.x, tool.y);
  await page
    .waitForFunction(
      () => /^An? /.test(document.querySelector(".page-window .page-title")?.textContent ?? ""),
      undefined,
      { timeout: slow(20000) },
    )
    .catch(() => undefined);
  opened = await title();
  say(`tapped on the rack: “${opened}” (a ${tool.form} hung there)`);
  check(
    opened.toLowerCase() === `a ${town.metal} ${tool.form}`,
    `the rack's ${tool.form} tapped opened “${opened}”`,
  );
  const chain = await listOn("From the ground to the rack");
  for (const r of chain?.rows ?? []) say(`    ${r}`);
  check(
    !!chain && chain.refs.some((r) => r.startsWith("subst:")),
    "the tool not traced to its ore",
  );
  check(
    !!chain && chain.refs.some((r) => r.startsWith("rxn:")),
    "the tool not traced to its smelting",
  );
  const by = chain?.rows.at(-1) ?? "";
  check(
    [...smiths].some((n) => by.includes(` by ${n}, a smith of ${town!.name}`)),
    `the tool not made by one of ${town.name}'s smiths: “${by}”`,
  );
  await shot("3-tool");
  const before = await title();
  const ore = await k<boolean>(`(() => {
    const box = [...document.querySelectorAll(".page-window .block-list")].find((b) => b.querySelector("h3")?.textContent?.startsWith("From the ground to the rack"));
    const a = box && [...box.querySelectorAll("a.ref-link")].find((a) => a.getAttribute("href").startsWith("#subst:"));
    if (!a) return false;
    a.click();
    return true;
  })()`);
  if (ore)
    await page
      .waitForFunction(
        (w) => {
          const t = document.querySelector(".page-window .page-title")?.textContent;
          return !!t && t !== "…" && t !== w;
        },
        before,
        { timeout: slow(20000) },
      )
      .catch(() => undefined);
  const orePage = await title();
  say(`its ore tapped: ${orePage}`);
  check(ore && orePage !== before, "the ore's page not opened from the tool");
  await page.keyboard.press("Alt+ArrowLeft").catch(() => undefined);
}

// 4. At a phone's width.
await page.setViewportSize({ width: 430, height: 932 });
await page.waitForTimeout(slow(800));
const wide = await k<number>(
  `Math.max(0, ...[...document.querySelectorAll(".page-window .block")].map((b) => b.scrollWidth - b.clientWidth))`,
);
say(`on a phone: the page's blocks overflow by ${wide} px`);
check(wide <= 2, `the page wider than a phone (${wide} px over)`);
await shot("4-phone");

await browser.close();
await server.close();
if (errors.length) problems.push(...errors.map((e) => `page error: ${e}`));
if (problems.length) {
  console.log("FAILED:");
  for (const p of problems) console.log(`  - ${p}`);
  process.exit(1);
}
console.log("the Phase 51 gate passes");
