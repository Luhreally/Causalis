// node tools/phase54-gate.ts [--ci] [--soft] [--shots dir] — the Phase 54 gate (novel elements,
// M221; asked for 2026-10-25: "bring back og causlaiss like primitve crafting and novel elements
// type stuff ... rememeber the whole game uses first principles and axioms so alien worlds work too
// it all might just be novel and diffrent with the first principles logic making sense"), in parts:
//   1. in node: Earth's chemistry is the Sun's own and its tables Earth's exactly; two hundred open
//      worlds (sixty on CI) draw chemistries as varied as the plan wants — most off the Sun's, every
//      hardener, thin air with native iron, carbon-rich rock — and (not on CI) the oracle's Earth
//      histories are as they were;
//   2. on the built app, a world round a small old star two centuries on: its matter guide's "This
//      world" tab — thin air, arsenic its hardener, native copper and mispickel among its ores,
//      lydite among its stones — and a town's smithy, its bronze-age tool an arsenical copper one
//      traced from its own grey arsenic ore, never tin;
//   3. Earth's matter guide with no such tab;
//   4. one of an Earth town's many tapped and inspired (asked for 2026-10-26: "how come i cant bless
//      or inspire people anymore ... when i clikc on a person"): the god's hand laid on their town
//      from them, and they among its people by their own name, remembered as inspired;
//   5. matter, elements and made things drawn (M223; asked for 2026-10-26: "for the tools and
//      elements it should have proceduerally item drawings for them like when i click on the tab for
//      it i should see the unique matter/tool or wtv"): the guide's substances each with a picture,
//      a crystal, a metal, an element and the inspired one's tool each drawn on its page;
//   6. each page at a phone's width.
// (npm run build first; --soft draws in software, as CI's browser does; --shots keeps a
// picture of each step.)
import { spawnSync } from "node:child_process";
import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { preview } from "vite";
import { chromium } from "playwright";
import { seedFromText } from "../src/kernel/index.ts";
import { generateHomeWorld, provinceWorld, worldChemistry } from "../src/gen/index.ts";
import {
  EARTHLIKE,
  ORES,
  REACTIONS,
  ROCKS,
  SOLAR,
  STONES,
  oresOn,
  reactionsOn,
  stonesFor,
  worldRocks,
} from "../src/rules/index.ts";
import { acceptance, surveyChemistry } from "./chem-survey.ts";

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
console.log("the Phase 54 gate");
if (shots) mkdirSync(shots, { recursive: true });

// —— 1. In node: Earth's chemistry is the Sun's; open worlds' are their own ————————————————

for (const seed of ["first light", "kestrel", "amber", "juniper"]) {
  const fine = generateHomeWorld(seedFromText(seed), EARTHLIKE);
  check(
    worldChemistry(fine) === SOLAR && worldChemistry(provinceWorld(fine)) === SOLAR,
    `${seed}: its chemistry not the Sun's own`,
  );
}
check(stonesFor(SOLAR) === STONES, "Earth's stones not its own table");
check(oresOn(SOLAR) === ORES, "Earth's ores not its own table");
check(worldRocks(SOLAR) === ROCKS, "Earth's rocks not its own table");
check(reactionsOn(SOLAR) === REACTIONS, "Earth's reactions not its own table");
say("Earth: the Sun's own chemistry, its stones, ores, rocks and reactions its own tables");
const surveyed = surveyChemistry(ci ? 60 : 200),
  judged = acceptance(surveyed);
say(`${surveyed.length} open worlds' chemistries:`);
for (const line of judged.lines) say(`    ${line}`);
for (const p of judged.problems) check(false, `open worlds: ${p}`);
if (!ci) {
  const oracle = spawnSync(
    process.execPath,
    [fileURLToPath(new URL("./oracle.ts", import.meta.url)), "toy/", "earth/", "people/"],
    { encoding: "utf8" },
  );
  say(`the oracle's Earth histories: ${oracle.status === 0 ? "as they were" : "changed"}`);
  check(oracle.status === 0, `the oracle's Earth histories changed:\n${oracle.stdout}`);
}

// —— 2–4. On the built app ————————————————————————————————————————————————————————————

type Span = string | { text: string; ref?: string };
type Line = Span[];
type Block = {
  type: string;
  title?: string;
  items?: { line: Line; ref?: string; thumb?: unknown }[];
};
type PageModel = { title: string; tabs: { id: string; blocks: Block[] }[] };
type Civic = { kind: string; at: number; start: number; end: number; fell: number | null };
type Plan = { ref: string; name: string; metal?: string; town?: { civics: Civic[] } | null };
const words = (l: Line) => l.map((s) => (typeof s === "string" ? s : s.text)).join("");

const root = fileURLToPath(new URL("..", import.meta.url)),
  // (CAUSALIS_DIST: a build elsewhere, so that one can be looked at while dist/ is under test.)
  server = await preview({
    root,
    logLevel: "silent",
    preview: { port: 4311, strictPort: false },
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
const shot = async (name: string) => {
  if (shots) await page.screenshot({ path: join(shots, `${name}.png`) });
};
const title = () =>
  page.$eval(".page-window .page-title", (e) => e.textContent ?? "").catch(() => "");
/** A page opened in the page window, by ref: its title come. */
const opened = async (ref: string) => {
  const before = await title();
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
  return title();
};
/** The titles of the page window's blocks. */
const headings = () =>
  k<string[]>(
    `[...document.querySelectorAll(".page-window .block h3")].map((h) => h.textContent ?? "")`,
  );
/** A list on the page window by the start of its title: its rows' words. */
const listOn = (start: string) =>
  k<string[] | null>(`(() => {
    const box = [...document.querySelectorAll(".page-window .block-list")].find((b) => b.querySelector("h3")?.textContent?.startsWith(${JSON.stringify(start)}));
    return box ? [...box.querySelectorAll(".entry")].map((e) => e.textContent ?? "") : null;
  })()`);
/** A fact of the page window by its label: its words. */
const factOn = (label: string) =>
  k<string | null>(`(() => {
    const row = [...document.querySelectorAll(".page-window .fact")].find((r) => r.querySelector(".fact-label")?.textContent === ${JSON.stringify(label)});
    return row ? (row.querySelector(".fact-value")?.textContent ?? "") : null;
  })()`);
/** At a phone's width: how far the page window's blocks run over. */
const onPhone = async (name: string) => {
  await page.setViewportSize({ width: 430, height: 932 });
  await page.waitForTimeout(slow(800));
  const over = await k<number>(
    `Math.max(0, ...[...document.querySelectorAll(".page-window .block")].map((b) => b.scrollWidth - b.clientWidth))`,
  );
  await shot(name);
  await page.setViewportSize({ width: 1366, height: 800 });
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
/** A world opened at a year, held there. */
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
  return Math.floor((await k<number>(`globalThis.causalis.client.status?.t ?? 0`)) / 31536000);
};

// 2. A world round a small old star: its matter, and a smithy's bronze-age tool.
const alienYear = await openWorld("alien", "alien 16", 200);
const matter = await opened("world:matter#world");
const blocks = await headings();
const oxygen = (await factOn("Oxygen")) ?? "",
  hardener = (await factOn("Its hardener")) ?? "",
  ores = (await listOn("Its ores")) ?? [],
  stones = (await listOn("Its stones")) ?? [];
say(`alien 16, year ${alienYear}: “${matter}”, the "This world" tab`);
say(`    oxygen: ${oxygen}; its hardener: ${hardener}`);
for (const o of ores) say(`    ore: ${o}`);
for (const s of stones) say(`    stone: ${s}`);
check(matter === "Matter", `the matter guide titled “${matter}”`);
check(blocks.includes("What this world is made of"), "the world's make-up not shown");
check(/^15\.\d% of the air/.test(oxygen), `its oxygen told as “${oxygen}”`);
check(hardener === "arsenic", `its hardener told as “${hardener}”`);
check(
  ores.some((o) => /^Native copper/.test(o)),
  "native copper not among its ores",
);
check(
  ores.some((o) => /^Mispickel/.test(o)),
  "mispickel not among its ores",
);
check(
  stones.some((s) => /^Lydite/.test(s)),
  "lydite not among its stones",
);
await shot("1-this-world");
const over1 = await onPhone("1-this-world-phone");
say(`the tab on a phone: overflow ${over1} px`);
check(over1 <= 2, `the "This world" tab wider than a phone (${over1} px over)`);

const towns = await ask<{ ref: string; name: string; people: number }[]>("towns.map", {});
let smithy: { town: Plan; ref: string } | null = null,
  bronze = 0;
for (const c of [...towns].sort((a, b) => b.people - a.people).slice(0, 120)) {
  const plan = await ask<Plan>("village.plan", { ref: c.ref, folk: 40 });
  if (plan.metal !== "bronze") continue;
  bronze++;
  const at = plan.town?.civics.find(
    (x) => x.kind === "smithy" && x.fell === null && x.end < alienYear,
  );
  if (!at) continue;
  const ref = `bldg:${plan.ref}:${at.at}:${at.start}`,
    p = await ask<PageModel>("page", { ref }),
    made = p.tabs
      .flatMap((t) => t.blocks)
      .find((b) => b.type === "list" && b.title?.startsWith("Made here this year"));
  if (made?.items?.length) {
    smithy = { town: plan, ref };
    break;
  }
}
say(
  `bronze-age towns looked at: ${bronze}; ${smithy ? `${smithy.town.name}'s smithy` : "none with a smithy that made a thing this year"}`,
);
check(!!smithy, `no bronze-age town with a standing smithy on alien 16 by year ${alienYear}`);
if (!smithy) await fail();
const shown = await opened(smithy!.ref);
const made = (await listOn("Made here this year")) ?? [];
const heading =
  (await headings()).find((t) => t.startsWith("Made here this year")) ?? "(no heading)";
say(`the smithy's page: “${shown}” — ${heading}`);
for (const r of made) say(`    ${r}`);
check(
  /^Made here this year: an? arsenical copper /.test(heading),
  "the smithy's thing of this year not of arsenical copper",
);
check(
  made.some((r) => /^(Mispickel|Arsenic stone|Grey copper ore)/.test(r)),
  "the arsenic's ore not traced on the smithy's page",
);
check(
  made.some((r) => /^Alloyed: white arsenic/.test(r)),
  "the copper not alloyed with white arsenic on the smithy's page",
);
check(!made.some((r) => /\btin\b/i.test(r)), "tin on the smithy's page of an arsenic world");
check(
  !made.some((r) => r.startsWith("Malachite") || r.startsWith("Copper ore —")),
  "an oxidised copper ore on the smithy's page of a world where nothing rusts",
);
await shot("2-smithy");
const over2 = await onPhone("2-smithy-phone");
say(`the smithy's page on a phone: overflow ${over2} px`);
check(over2 <= 2, `the smithy's page wider than a phone (${over2} px over)`);

// 3. Earth's matter guide: its own three tabs, no "This world".
await openWorld("earth", "first light", 300);
const guide = await ask<PageModel>("page", { ref: "world:matter" }),
  tabs = guide.tabs.map((t) => t.id);
say(`Earth's matter guide: tabs ${tabs.join(", ")}`);
check(
  JSON.stringify(tabs) === JSON.stringify(["substances", "reactions", "elements"]),
  `Earth's matter guide has tabs ${tabs.join(", ")}`,
);

// 4. One of the town's many tapped and inspired: the hand laid on their town from them.
type Person = { name: string; x: number; z: number; index: number; ref: string; folk: boolean };
const towns3 = await ask<{ ref: string; name: string; people: number }[]>("towns.map", {}),
  big = [...towns3].sort((a, b) => b.people - a.people || (a.ref < b.ref ? -1 : 1))[0]!;
await k(`globalThis.causalis.goTo(${JSON.stringify(big.ref)})`);
await page
  .waitForFunction(() => ((globalThis as any).causalis.watching?.() ?? 0) > 0, undefined, {
    timeout: slow(120000),
  })
  .catch(() => undefined);
await k(`globalThis.causalis.client.setSpeed(0)`);
// (By day, the many out at their work: the world opens at midnight, when they are all abed.)
const morning = 300 * 365 * 86400 + 3 * 86400 + 10.5 * 3600;
await k(`globalThis.causalis.client.advance(${morning})`);
await page
  .waitForFunction(
    (at) => ((globalThis as any).causalis.client.status?.t ?? 0) >= at - 1,
    morning,
    {
      timeout: slow(20000),
    },
  )
  .catch(() => undefined);
await page.waitForTimeout(slow(1500));
const many = (await k<Person[]>(`globalThis.causalis.peopleNow?.() ?? []`)).filter((p) => p.folk);
say(`${big.name}: ${many.length} of its many drawn`);
check(many.length > 0, `no one of ${big.name}'s many drawn`);
let touched: Person | null = null,
  agentRef = "";
for (const p of many.slice(0, 8)) {
  await k(
    `globalThis.causalis.rig.flyTo({ target: { x: ${p.x * 0.1}, y: 0, z: ${p.z * 0.1} }, distance: 3.5, pitch: -40 })`,
  );
  await page.waitForTimeout(slow(2500));
  const at = await k<{ x: number; y: number } | null>(
    `globalThis.causalis.personOnScreen?.(${p.index}) ?? null`,
  );
  if (!at) continue;
  await page.mouse.click(at.x, at.y);
  await page.waitForTimeout(slow(1200));
  const inspire = page.locator(".touch button:visible", { hasText: "Inspire them" });
  if ((await inspire.count()) === 0) continue;
  touched = p;
  await inspire.first().click();
  await page.waitForTimeout(slow(300));
  await inspire.first().click();
  break;
}
check(!!touched, "no Inspire on the card of one of the town's many");
if (touched) {
  await page
    .waitForFunction(
      () => String((globalThis as any).causalis.pageOpen?.() ?? "").startsWith("agent:"),
      undefined,
      { timeout: slow(60000) },
    )
    .catch(() => undefined);
  await page.waitForTimeout(slow(800));
  agentRef = String(await k(`globalThis.causalis.pageOpen?.() ?? ""`));
  const named = await title(),
    hand = await ask<{ village: string } | null>("hand", {}),
    remembered = (await listOn("Remembered for")) ?? [];
  say(`inspired ${touched.name}: ${agentRef}, “${named}”, the hand on ${hand?.village ?? "none"}`);
  check(agentRef.startsWith("agent:"), `the one inspired opened as ${agentRef || "nothing"}`);
  check(named === touched.name, `the one inspired titled “${named}”, not “${touched.name}”`);
  check(hand?.village === big.ref, "the hand not laid on their town");
  check(
    remembered.some((r) => /inspired/.test(r)),
    `not remembered as inspired: ${remembered.join(" | ")}`,
  );
  await shot("4-inspired");
}

// 5. Matter, elements and made things drawn.
/** How many pixels of a canvas of the page window are drawn on. */
const inked = (selector: string) =>
  k<number>(`(() => {
    const c = document.querySelector(${JSON.stringify(selector)});
    if (!c || c.hidden || !c.width) return 0;
    const d = c.getContext("2d").getImageData(0, 0, c.width, c.height).data;
    let n = 0;
    for (let i = 3; i < d.length; i += 4) if (d[i] > 40) n++;
    return n;
  })()`);
await opened("world:matter");
const thumbs = await k<number>(`document.querySelectorAll(".page-window canvas.thumb").length`),
  thumbInk = await inked(".page-window canvas.thumb");
say(`the matter guide: ${thumbs} pictures beside its substances, the first ${thumbInk} pixels`);
check(thumbs >= 40, `only ${thumbs} pictures beside the matter guide's substances`);
check(thumbInk > 60, `the guide's first picture not drawn (${thumbInk} pixels)`);
for (const [ref, want] of [
  ["subst:quartz", /^Quartz/],
  ["subst:copper", /^Copper/],
  ["subst:obsidian", /^Obsidian/],
  ["elem:Cu", /^Copper \(Cu\)$/],
  ["elem:S", /^Sulphur \(S\)$/],
  ["elem:Ar", /^Argon \(Ar\)$/],
] as const) {
  const named = await opened(ref),
    ink = await inked(".page-window canvas.portrait");
  say(`${ref}: “${named}”, ${ink} pixels drawn`);
  check(want.test(named), `${ref} titled “${named}”`);
  check(ink > 300, `${ref}'s picture not drawn (${ink} pixels)`);
}
await shot("5-element");
if (agentRef) {
  const person = await ask<PageModel>("page", { ref: agentRef }),
    things = person.tabs.find((t) => t.id === "things"),
    tool = things?.blocks
      .flatMap((b) => (b.type === "list" ? (b.items ?? []) : []))
      .find((i) => i.ref?.startsWith("thing:") && !!i.thumb);
  check(!!tool, "the inspired one's things carry no pictures");
  if (tool) {
    const named = await opened(tool.ref!),
      ink = await inked(".page-window canvas.portrait");
    say(`${tool.ref}: “${named}”, ${ink} pixels drawn`);
    check(ink > 300, `the tool's picture not drawn (${ink} pixels)`);
    await shot("5-tool");
  }
}
const over5 = await onPhone("5-tool-phone");
check(over5 <= 2, `a thing's page wider than a phone (${over5} px over)`);

await browser.close();
await server.close();
if (errors.length) problems.push(...errors.map((e) => `page error: ${e}`));
if (problems.length) {
  console.log("FAILED:");
  for (const p of problems) console.log(`  - ${p}`);
  process.exit(1);
}
console.log("the Phase 54 gate passes");
