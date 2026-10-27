// node tools/phase56-gate.ts [--ci] [--soft] [--shots dir] — the Phase 56 gate (world kinds: carbon,
// ice-and-ammonia, sulfur-volcano and methane worlds; asked for 2026-10-26: "add this into later
// plans too", of "whole new kinds of worlds ... each would have its own liquids, materials and path
// through the ages"), in parts:
//   1. in node: five hundred open worlds (a hundred and twenty on CI) fall into their kinds — most of
//      them rocky, a people on some world of each other kind — and the open seeds the tests and
//      gates name all rocky; each kind made by its dial; (not on CI) the oracle's histories as they
//      were;
//   2. the title: seven dials, the ices and the carbon turned through each kind, each told as it
//      turns, and a methane world begun so;
//   3. each kind's world on the built app, held where it was opened, by day: its globe and a land in
//      its kind's colours under its own sky; its greatest town told its kind, and where nothing
//      burns no kiln aglow and no sparks, its warmth in true degrees; its matter guide's "This
//      world" tab telling what it is and what burns; bronze shut where nothing burns ("no furnace
//      can be built"); its own ages on the stage chip;
//   4. Earth and a Phase 54 world as they were: rocky, no kind of their own on their sky;
//   5. the title and each page at a phone's width.
// (npm run build first; --soft draws in software, as CI's browser does; --shots keeps a picture of
// each step, on a desk and at a phone's size.)
import { spawnSync } from "node:child_process";
import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { preview } from "vite";
import { chromium } from "playwright";
import { seedFromText } from "../src/kernel/index.ts";
import { generateHomeWorld, worldKindOf } from "../src/gen/index.ts";
import { KINDS, KIND_SEAS, OPEN, type NovelKind } from "../src/rules/index.ts";
import { kindLines, surveyKinds } from "./chem-survey.ts";

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
console.log("the Phase 56 gate");
if (shots) mkdirSync(shots, { recursive: true });

// —— 1. In node: the open worlds' kinds, each made by its dial, the oracle ——————————————————

const surveyed = performance.now(),
  kinds = kindLines(surveyKinds(ci ? 120 : 500));
say(`the open worlds' kinds (${((performance.now() - surveyed) / 1000).toFixed(0)} s):`);
for (const line of kinds.lines) say(`    ${line}`);
check(
  kinds.ok,
  `the open worlds' kinds: ${kinds.lines.filter((l) => l.startsWith("FAIL")).join("; ")}`,
);
/** Each kind's dial, as its seed's text carries it. */
const DIALS: Readonly<Record<NovelKind, string>> = {
  carbon: "~carbon carbon",
  sulfur: "~volatiles sulfur",
  ammonia: "~volatiles ammonia",
  methane: "~volatiles methane",
};
for (const [kind, act] of Object.entries(DIALS) as [NovelKind, string][]) {
  const made = worldKindOf(generateHomeWorld(seedFromText(`violet hollow ${act}`), OPEN));
  check(made === kind, `“violet hollow ${act}” makes a ${made} world, not a ${kind} one`);
}
const pinned = worldKindOf(
  generateHomeWorld(seedFromText("violet hollow ~carbon oxygen ~volatiles water"), OPEN),
);
check(pinned === "rocky", `a world pinned rocky made a ${pinned} one`);
say(`each kind made by its dial; pinned to oxygen and water, a ${pinned} world`);
if (!ci) {
  const oracle = spawnSync(
    process.execPath,
    [fileURLToPath(new URL("./oracle.ts", import.meta.url))],
    { encoding: "utf8" },
  );
  const kept = (oracle.stdout.match(/: unchanged \(/g) ?? []).length;
  say(`the oracle's histories: ${kept} of them as they were`);
  check(oracle.status === 0 && kept === 8, `the oracle's histories changed:\n${oracle.stdout}`);
}

// —— 2–5. On the built app ————————————————————————————————————————————————————————————

type Stage = {
  id: string;
  name: string;
  stages: { id: string; name: string; year: number | null }[];
};
type Town = { ref: string; name: string; cell: number; people: number };
type Plan = { ref: string; name: string; kind?: string; fireless?: boolean; era: string };
type Trades = { kilns: number; smithies: number; glowing: number; sparks: number };

const root = fileURLToPath(new URL("..", import.meta.url)),
  // (CAUSALIS_DIST: a build elsewhere, so that one can be looked at while dist/ is under test.)
  server = await preview({
    root,
    logLevel: "silent",
    preview: { port: 4316, strictPort: false },
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
const ask = <T>(type: string, args: unknown) =>
  k<T>(
    `globalThis.causalis.client.query({ type: ${JSON.stringify(type)}, args: ${JSON.stringify(args)} })`,
  );
const text = async (sel: string) => ((await page.textContent(sel).catch(() => "")) ?? "").trim();
const until = async (what: string, ok: () => Promise<boolean>, ms = 60000) => {
  const end = Date.now() + ms;
  while (Date.now() < end) {
    if (await ok().catch(() => false)) return true;
    await page.waitForTimeout(250);
  }
  problems.push(`${what} did not come`);
  return false;
};
const DESK = { width: 1366, height: 800 },
  PHONE = { width: 430, height: 932 };
/** A picture of the step on a desk, and at a phone's size where `phone` (the eye's view redrawn). */
const shot = async (name: string, phone = false) => {
  if (!shots) return;
  await page.screenshot({ path: join(shots, `${name}.png`) });
  if (!phone) return;
  await page.setViewportSize(PHONE);
  await page.waitForTimeout(slow(1500));
  await page.screenshot({ path: join(shots, `${name}-phone.png`) });
  await page.setViewportSize(DESK);
  await page.waitForTimeout(slow(800));
};
const pageTitle = () =>
  page.$eval(".page-window .page-title", (e) => e.textContent ?? "").catch(() => "");
/** A page opened in the page window, by ref: its title come. */
const opened = async (ref: string) => {
  const before = await pageTitle();
  await k(`globalThis.causalis.open(${JSON.stringify(ref)})`);
  await page
    .waitForFunction(
      (was) => {
        const t = document.querySelector(".page-window .page-title")?.textContent;
        return !!t && t !== "…" && t !== was;
      },
      before,
      { timeout: slow(30000) },
    )
    .catch(() => undefined);
  await page.waitForTimeout(slow(500));
  return pageTitle();
};
/** The titles of the page window's blocks. */
const headings = () =>
  k<string[]>(
    `[...document.querySelectorAll(".page-window .block h3")].map((h) => h.textContent ?? "")`,
  );
/** A fact of the page window by its label: its words (null: none so labelled). */
const factOn = (label: string) =>
  k<string | null>(`(() => {
    const row = [...document.querySelectorAll(".page-window .fact")].find((r) => r.querySelector(".fact-label")?.textContent === ${JSON.stringify(label)});
    return row ? (row.querySelector(".fact-value")?.textContent ?? "") : null;
  })()`);
/** A block of the page window by its title: its words below the title (null: no such block). */
const blockText = (title: string) =>
  k<string | null>(`(() => {
    const box = [...document.querySelectorAll(".page-window .block")].find((b) => b.querySelector("h3")?.textContent === ${JSON.stringify(title)});
    if (!box) return null;
    const h = box.querySelector("h3");
    return (box.textContent ?? "").slice((h?.textContent ?? "").length).trim();
  })()`);
/** At a phone's width: how far the page window's blocks run over. */
const onPhone = async (name: string) => {
  await page.setViewportSize(PHONE);
  await page.waitForTimeout(slow(800));
  const over = await k<number>(
    `Math.max(0, ...[...document.querySelectorAll(".page-window .block")].map((b) => b.scrollWidth - b.clientWidth))`,
  );
  if (shots) await page.screenshot({ path: join(shots, `${name}.png`) });
  await page.setViewportSize(DESK);
  await page.waitForTimeout(slow(500));
  return over;
};
const fail = async () => {
  await browser.close();
  await server.close();
  console.log("FAILED:");
  for (const p of problems) console.log(`  - ${p}`);
  process.exit(1);
};
const YEAR = 365 * 86400,
  DAY = 86400,
  HOUR = 3600;
/** On to moment t (the clock held): the host's word of it come, and a few frames drawn there. */
const advance = async (t: number) => {
  await k(`globalThis.causalis.client.advance(${Math.round(t)})`);
  await page
    .waitForFunction((at) => ((globalThis as any).causalis.client.status?.t ?? 0) >= at - 1, t, {
      timeout: slow(20000),
    })
    .catch(() => undefined);
  await page.waitForTimeout(slow(500));
};
/** A world opened at a year, held there: the year it stands at. */
const openWorld = async (universe: string, seed: string, year: number) => {
  await page.goto(
    `${base}?universe=${universe}&seed=${encodeURIComponent(seed)}&year=${year}&hold=1`,
  );
  await page.waitForFunction(
    () => ((globalThis as any).causalis?.drawn?.() as number) > 0,
    undefined,
    { timeout: 900000 },
  );
  await k(`globalThis.causalis.client.setSpeed(0)`);
  return Math.floor((await k<number>(`globalThis.causalis.client.status?.t ?? 0`)) / YEAR);
};
/** The keys of the globe's lens legend, in words. */
const legendKeys = () =>
  page.$$eval(".mapmodes .legend-key", (x) => x.map((e) => e.textContent ?? ""));
/** The kind the globe's frame says its world is, and the kind its sky is drawn for (none: rocky). */
const kindShown = async () => ({
  frame: await k<string | null>(
    `globalThis.causalis.client.latestFrame("globe")?.meta?.kind ?? null`,
  ),
  sky: (await k<string | undefined>(`document.body.dataset.world`)) ?? "rocky",
});

// 2. The title: seven dials, each kind turned and told; a methane world begun so.
await page.goto(base);
await page.waitForSelector(".title-menu .choice", { timeout: slow(60000) });
await page.click(".title-menu .choice:has-text('New world')");
await page.click(".choice-row .choice[data-id='alien']");
await page.fill(".seed-input", "violet hollow");
await page.dispatchEvent(".seed-input", "input");
const dials = await page.$$eval(".making-dial", (b) => b.map((x) => x.textContent ?? ""));
say(`the title: ${dials.length} dials (${dials.join(", ")})`);
check(dials.length === 7, `${dials.length} making dials, not seven`);
/** The world the seed's text makes, told: its words come with this ending, and whether life arises. */
const told = async (what: string, ends: RegExp) => {
  const ok = await until(
    `the title's words of ${what}`,
    async () =>
      ends.test(await text(".seed-made")) && !["", "…"].includes(await text(".seed-life")),
    slow(30000),
  );
  const seedText = await page.inputValue(".seed-input"),
    made = await text(".seed-made"),
    life = await text(".seed-life");
  say(`    “${seedText}”: ${made}; ${life}`);
  return ok;
};
await told("a world as it falls", /% sea$/);
const turned: [string, string, RegExp][] = [
  ["volatiles", "water", /% sea$/],
  ["volatiles", "sulfur", / · 🌋 a sulfur-volcano world$/],
  ["volatiles", "ammonia", / · 🧊 an ice-and-ammonia world$/],
  ["volatiles", "methane", / · 🟠 a methane world$/],
  ["volatiles", "as it falls", /% sea$/],
  ["carbon", "oxygen-rich", /% sea$/],
  ["carbon", "carbon-rich", / · 💎 a carbon world$/],
  ["carbon", "as it falls", /% sea$/],
];
for (const [dial, choice, ends] of turned) {
  await page.click(`.making-dial[data-subject='${dial}']`);
  await told(`${dial} turned to ${choice}`, ends);
  if (ends.source.includes("world"))
    check(
      /^🌱 Life arises/.test(await text(".seed-life")),
      `life does not arise on violet hollow with its ${dial} turned to ${choice}`,
    );
}
for (let i = 0; i < 4; i++) await page.click(".making-dial[data-subject='volatiles']");
await told("a methane world, again", / · 🟠 a methane world$/);
await shot("1-title-methane");
{
  await page.setViewportSize(PHONE);
  await page.waitForTimeout(slow(800));
  const over = await k<number>(
    `Math.max(0, ...[...document.querySelectorAll(".making-dial")].map((b) => b.getBoundingClientRect().right - innerWidth))`,
  );
  if (shots) await page.screenshot({ path: join(shots, "1-title-methane-phone.png") });
  await page.setViewportSize(DESK);
  say(`the dials on a phone: overflow ${Math.round(over)} px`);
  check(over <= 2, `the making dials run off a phone's screen (${Math.round(over)} px)`);
}
await page.click(".title-form .begin");
await page.waitForURL(/universe=alien&seed=violet/, { timeout: slow(60000) });
await until(
  "the methane world begun",
  async () => ((await k<number>("globalThis.causalis?.drawn?.() ?? 0")) ?? 0) > 0,
  slow(180000),
);
const begun = await k<string>("globalThis.causalis.seed"),
  begunKind = await kindShown();
say(`begun “${begun}”: its globe drawn as ${begunKind.frame}, its sky as ${begunKind.sky}`);
check(begun === "violet hollow ~volatiles methane", `begun as “${begun}”`);
check(
  begunKind.frame === "methane" && begunKind.sky === "methane",
  `the world begun drawn as a ${begunKind.frame} world under a ${begunKind.sky} sky`,
);
await shot("1-begun-methane", true);

// 3. Each kind's world, by day.
const WORLDS: readonly { kind: NovelKind; seed: string; year: number; age: string | null }[] = [
  { kind: "carbon", seed: "alien 20", year: 150, age: "Diamond and copper" },
  { kind: "sulfur", seed: "alien 84", year: 70, age: null },
  { kind: "ammonia", seed: "alien 218", year: 30, age: "Worked ice" },
  { kind: "methane", seed: "alien 1429", year: 400, age: "Worked ice" },
];
for (const [n, w] of WORLDS.entries()) {
  const step = `${n + 2}-${w.kind}`,
    facts = KINDS[w.kind],
    fireless = !facts.burns,
    year = await openWorld("alien", w.seed, w.year);
  // (By day: the world opens at midnight, when all are abed and the land is dark.)
  const t0 = await k<number>(`globalThis.causalis.client.status?.t ?? 0`);
  await advance(Math.floor(t0 / DAY) * DAY + 2 * DAY + 11 * HOUR);
  const shown = await kindShown();
  say(
    `${w.seed} (${facts.name}), year ${year}: its globe drawn as ${shown.frame}, its sky as ${shown.sky}`,
  );
  check(shown.frame === w.kind, `${w.seed}'s globe drawn as ${shown.frame}`);
  check(shown.sky === w.kind, `${w.seed}'s sky drawn as ${shown.sky}`);
  // (Its land's legend in its own colours, its sea named for its liquid.)
  const keys = await legendKeys();
  say(`    its land's legend: ${keys.join(", ")}`);
  check(keys.at(-1) === KIND_SEAS[w.kind].sea, `${w.seed}'s legend names its sea “${keys.at(-1)}”`);
  await shot(`${step}-globe`, true);
  // Its own ages, where nothing burns.
  await until(
    `${w.seed}'s stage`,
    async () => !!(await k<Stage | null>(`globalThis.causalis.worldStage?.() ?? null`)),
    slow(30000),
  );
  const stage = await k<Stage | null>(`globalThis.causalis.worldStage?.() ?? null`),
    metal = stage?.stages.find((s) => s.id === "iron");
  say(
    `    its stage: ${stage?.name}; its metal age ${metal?.name}${metal?.year != null ? `, reached in ${metal.year}` : ", not yet"}`,
  );
  check(
    metal?.name === (w.age ?? "Iron"),
    `${w.seed}'s metal age named “${metal?.name}”, not “${w.age ?? "Iron"}”`,
  );
  if (w.age) check(metal?.year != null, `${w.seed} has not reached ${w.age} by year ${year}`);
  // A land: its greatest town's, in its kind's colours.
  const towns = (await ask<Town[]>("towns.map", {})).sort(
      (a, b) => b.people - a.people || (a.ref < b.ref ? -1 : 1),
    ),
    town = towns[0];
  check(!!town, `no town on ${w.seed} by year ${year}`);
  if (!town) await fail();
  await k(`globalThis.causalis.descend(${town!.cell})`);
  await until(
    `${w.seed}'s land`,
    async () => ((await k<number>(`globalThis.causalis.villages?.() ?? 0`)) ?? 0) > 0,
    slow(60000),
  );
  const landKind = await k<string | null>(
    `globalThis.causalis.client.latestFrame("region")?.meta?.kind ?? null`,
  );
  say(`    its land ${town!.cell}: drawn as ${landKind}`);
  check(landKind === w.kind, `${w.seed}'s land drawn as ${landKind}`);
  await page.waitForTimeout(slow(1500));
  await shot(`${step}-land`, true);
  // Its greatest town: told its kind; where nothing burns, no kiln aglow and no sparks.
  await k(`globalThis.causalis.goTo(${JSON.stringify(town!.ref)})`);
  await until(
    `${town!.name} (${w.seed})`,
    async () => ((await k<number>(`globalThis.causalis.watching?.() ?? 0`)) ?? 0) > 0,
    slow(120000),
  );
  await k(`globalThis.causalis.client.setSpeed(0)`);
  await page.waitForTimeout(slow(1500));
  const mark = () =>
    k<string>(
      `[...document.querySelectorAll(".panel:not([hidden]) .weather-mark")].find((e) => !e.hidden)?.textContent ?? ""`,
    );
  await until(`${town!.name}'s weather`, async () => /°/.test(await mark()), slow(20000));
  const plan = await ask<Plan>("village.plan", { ref: town!.ref }),
    trades = await k<Trades | null>(`globalThis.causalis.trades?.() ?? null`),
    warmth = await mark(),
    degrees = Number((/(-?\d+)°/.exec(warmth.replace("−", "-")) ?? [])[1] ?? NaN);
  say(
    `    ${plan.name} (${plan.era}): told ${plan.kind}${plan.fireless ? ", nothing burning" : ""}; ${trades?.kilns ?? 0} kilns, ${trades?.glowing ?? 0} aglow, ${trades?.smithies ?? 0} smithies, ${trades?.sparks ?? 0} sparks; “${warmth}”`,
  );
  check(plan.kind === w.kind, `${plan.name}'s plan told ${plan.kind}, not ${w.kind}`);
  check(
    !!plan.fireless === fireless,
    `${plan.name}'s plan has fire ${plan.fireless ? "none" : "burning"}`,
  );
  if (fireless)
    check(
      (trades?.glowing ?? 0) === 0 && (trades?.sparks ?? 0) === 0,
      `a kiln aglow or sparks in ${plan.name}, where nothing burns`,
    );
  // (Its warmth in true degrees: a methane world's some 180 below, an ammonia world's under its ice.)
  const band = w.kind === "methane" ? [-215, -150] : w.kind === "ammonia" ? [-100, -20] : [-60, 60];
  check(
    degrees >= band[0]! && degrees <= band[1]!,
    `${plan.name}'s warmth told “${warmth}”, not between ${band[0]} and ${band[1]} °C`,
  );
  await shot(`${step}-town`, true);
  // Its matter guide's "This world" tab: what it is and what burns, and why.
  await opened("world:matter#world");
  const blocks = await headings(),
    head = `${facts.icon} ${facts.name.replace(/^./, (c) => c.toUpperCase())}`,
    burns = await factOn("What burns"),
    furnaces = await blockText("Its furnaces");
  say(
    `    its matter: “${head}” ${blocks.includes(head) ? "told" : "not told"}; what burns: ${burns}`,
  );
  check(blocks.includes(head), `${w.seed}'s matter guide does not tell “${head}”`);
  check(burns === facts.fire, `${w.seed}'s matter guide tells what burns as “${burns}”`);
  if (fireless)
    check(
      furnaces === "None: nothing burns in its air, so no furnace can be built.",
      `${w.seed}'s furnaces told as “${furnaces}”`,
    );
  await shot(`${step}-matter`);
  const over = await onPhone(`${step}-matter-phone`);
  check(over <= 2, `${w.seed}'s "This world" tab wider than a phone (${over} px over)`);
  // Bronze: shut where nothing burns, and says why.
  const bronzeTitle = await opened("prin:bronze"),
    shut = await factOn("On this world");
  say(`    “${bronzeTitle}”: ${shut ?? "open to its people"}`);
  if (fireless) {
    check(bronzeTitle === "Bronze", `bronze titled “${bronzeTitle}” where nothing burns`);
    check(
      /^shut: nothing burns in its air, so no furnace can be built\./.test(shut ?? ""),
      `bronze on ${w.seed} not shut for want of fire: “${shut}”`,
    );
  } else check(shut === null, `bronze shut on ${w.seed}, where fire burns: “${shut}”`);
  await shot(`${step}-bronze`);
}

// 4. Earth and a Phase 54 world as they were: rocky, no kind on their sky.
for (const [universe, seed] of [
  ["earth", "first light"],
  ["alien", "alien 16"],
] as const) {
  await openWorld(universe, seed, 0);
  const shown = await kindShown(),
    keys = await legendKeys();
  await opened("world:matter#world");
  const blocks = await headings();
  say(
    `${seed}: its globe drawn as ${shown.frame}, its sky as ${shown.sky}; its legend ${keys.join(", ")}; ${blocks.length} blocks on its matter page`,
  );
  check(
    shown.frame === "rocky" && shown.sky === "rocky",
    `${seed} drawn as a ${shown.frame} world under a ${shown.sky} sky`,
  );
  // (Alien 16's woods its life's own blue: Phase 57.)
  const woods = seed === "alien 16" ? "blue woods" : "woods";
  check(
    keys.join(",") === `${woods},grassland,desert,ice,sea`,
    `${seed}'s land legend reads ${keys.join(", ")}`,
  );
  check(
    !blocks.some((b) => / world$/.test(b)),
    `${seed}'s matter guide tells a kind: ${blocks.filter((b) => / world$/.test(b)).join(", ")}`,
  );
}

await browser.close();
await server.close();
if (errors.length) problems.push(...errors.map((e) => `page error: ${e}`));
if (problems.length) {
  console.log("FAILED:");
  for (const p of problems) console.log(`  - ${p}`);
  process.exit(1);
}
console.log("the Phase 56 gate passes");
