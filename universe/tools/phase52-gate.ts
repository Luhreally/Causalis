// node tools/phase52-gate.ts [--ci] [--soft] [--shots dir] — the Phase 52 gate (the chain decides,
// M216–M217; asked for 2026-10-25: "every made thing, at every age, is made by someone from what's
// actually around them, so the land decides what a people can make ... quality from material,
// maker, workshop"), on the built app, the Earth seed three centuries on:
//   1. a town whose smiths forge bronze, its tin brought down the road: its smithy's page traces
//      the bronze tool made there from its copper and its tin — the tin "Brought down the road" —
//      alloyed, and worked by one of its smiths;
//   2. a battle its arms decided: ringed so on its war's course; its page says so — "won it for
//      …: with even arms it would have gone the other way" — with each side's arms and how much of
//      its host bore them;
//   3. the winner's army: how much of its host bears its arms, and what a man of it is worth;
//   4. each page at a phone's width.
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
console.log("the Phase 52 gate");
if (shots) mkdirSync(shots, { recursive: true });

type Span = string | { text: string; ref?: string };
type Line = Span[];
type Block = { type: string; title?: string; items?: { line: Line }[]; rows?: Stat[] };
type Stat = { label: string; value: Line; parts?: { label: Line; value: string }[] };
type PageModel = { title: string; tabs: { id: string; blocks: Block[] }[] };
type Civic = { kind: string; at: number; start: number; end: number; fell: number | null };
type Plan = {
  ref: string;
  name: string;
  metal?: string;
  town?: { civics: Civic[] } | null;
  people: { trade?: { kind: string } }[];
};
type Campaign = {
  ref: string;
  attacker: { ref: string; name: string };
  defender: { ref: string; name: string };
  battles: { event: string; year: number; won: boolean; tip?: boolean; land: string }[];
};
const words = (l: Line) => l.map((s) => (typeof s === "string" ? s : s.text)).join("");
/**
 * Whether a bronze tool's chain brings its tin down a road: the copper's lines, then the tin's —
 * its ore ("Tin stone …", "Stream tin …") or the metal bought ("Tin, smelted …") — then a road,
 * before the two are alloyed.
 */
const tinByRoad = (rows: readonly string[]) => {
  const tin = rows.findIndex((r) => /^(?:\w+ )?tin\b/i.test(r)),
    alloyed = rows.findIndex((r) => r.startsWith("Alloyed"));
  return (
    tin >= 0 &&
    alloyed > tin &&
    rows.slice(tin, alloyed).some((r) => r.startsWith("Brought down the road from "))
  );
};

const root = fileURLToPath(new URL("..", import.meta.url)),
  // (CAUSALIS_DIST: a build elsewhere, so that one can be looked at while dist/ is under test.)
  server = await preview({
    root,
    logLevel: "silent",
    preview: { port: 4309, strictPort: false },
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
/** A list on the page window by the start of its title: its rows' words. */
const listOn = (start: string) =>
  k<string[] | null>(`(() => {
    const box = [...document.querySelectorAll(".page-window .block-list")].find((b) => b.querySelector("h3")?.textContent?.startsWith(${JSON.stringify(start)}));
    return box ? [...box.querySelectorAll(".entry")].map((e) => e.textContent ?? "") : null;
  })()`);
/** A fact of the page window by its label: its words, and its parts once asked why. */
const factOn = async (label: string) => {
  await k(`(() => {
    const row = [...document.querySelectorAll(".page-window .fact")].find((r) => r.querySelector(".fact-label")?.textContent === ${JSON.stringify(label)});
    const ask = row?.querySelector(".ask");
    if (ask && !ask.classList.contains("on")) ask.click();
  })()`);
  await page.waitForTimeout(slow(300));
  return k<{ value: string; parts: string[] } | null>(`(() => {
    const row = [...document.querySelectorAll(".page-window .fact")].find((r) => r.querySelector(".fact-label")?.textContent === ${JSON.stringify(label)});
    if (!row) return null;
    const more = row.parentElement?.querySelector(".fact-more");
    return {
      value: row.querySelector(".fact-value")?.textContent ?? "",
      parts: more ? [...more.querySelectorAll(".part")].map((p) => p.textContent ?? "") : [],
    };
  })()`);
};
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

await page.goto(`${base}?universe=earth&seed=${encodeURIComponent("first light")}&year=300&hold=1`);
await page.waitForFunction(
  () => ((globalThis as any).causalis?.drawn?.() as number) > 0,
  undefined,
  { timeout: 900000 },
);
await k(`globalThis.causalis.setQuality("high")`);
await k(`globalThis.causalis.client.setSpeed(0)`);
const year = Math.floor((await k<number>(`globalThis.causalis.client.status?.t ?? 0`)) / 31536000);

// 1. A town whose smiths forge bronze, its tin brought down the road: the bronze tool made at its
// smithy this year, traced from the ground.
const towns = await ask<{ ref: string; name: string; people: number }[]>("towns.map", {});
let smithy: { town: Plan; ref: string; rows: string[] } | null = null,
  bronze = 0;
for (const c of [...towns].sort((a, b) => b.people - a.people).slice(0, 120)) {
  const plan = await ask<Plan>("village.plan", { ref: c.ref, folk: 40 });
  if (plan.metal !== "bronze") continue;
  bronze++;
  const at = plan.town?.civics.find((x) => x.kind === "smithy" && x.fell === null && x.end < year);
  if (!at) continue;
  const ref = `bldg:${plan.ref}:${at.at}:${at.start}`,
    p = await ask<PageModel>("page", { ref }),
    made = p.tabs
      .flatMap((t) => t.blocks)
      .find((b) => b.type === "list" && b.title?.startsWith("Made here this year"));
  const rows = made?.items?.map((i) => words(i.line)) ?? [];
  if (tinByRoad(rows)) {
    smithy = { town: plan, ref, rows };
    break;
  }
}
say(
  `bronze towns looked at: ${bronze}; ${smithy ? `${smithy.town.name}'s smithy, its tin by road` : "none with its tin by road"}`,
);
check(!!smithy, "no town forging bronze with its tin brought down the road by year 300");
if (!smithy) await fail();
const shown = await opened(smithy!.ref);
const made = (await listOn("Made here this year")) ?? [];
say(`the smithy's page: “${shown}”`);
for (const r of made) say(`    ${r}`);
const heading = await k<string>(
  `[...document.querySelectorAll(".page-window .block-list h3")].map((h) => h.textContent ?? "").find((t) => t.startsWith("Made here this year")) ?? ""`,
);
say(`    (${heading})`);
check(
  /^Made here this year: a bronze /.test(heading),
  "the smithy's thing of this year not bronze",
);
check(tinByRoad(made), "the tin's road not told on the smithy's page");
check(
  made.some((r) => r.startsWith("Alloyed")),
  "the bronze not alloyed on the smithy's page",
);
check(
  made.some((r) => / a smith of /.test(r)),
  "the bronze tool not made by one of the town's smiths",
);
await shot("1-smithy");
const over1 = await onPhone("1-smithy-phone");
say(`the smithy's page on a phone: overflow ${over1} px`);
check(over1 <= 2, `the smithy's page wider than a phone (${over1} px over)`);

// 2. A battle its arms decided: found among the world's wars of each half-century.
let tipped: { war: Campaign; battle: Campaign["battles"][number] } | null = null;
for (let to = year; to > 0 && !tipped; to -= 50) {
  const age = await ask<{ wars: Campaign[] }>("wars.age", {
    from: Math.max(0, to - 50),
    to,
    most: 40,
  });
  for (const w of age.wars)
    for (const b of [...w.battles].reverse())
      if (b.tip && (!tipped || b.year > tipped.battle.year)) tipped = { war: w, battle: b };
}
say(
  tipped
    ? `a battle arms decided: at ${tipped.battle.land}, year ${tipped.battle.year} (${tipped.war.attacker.name} upon ${tipped.war.defender.name})`
    : "no battle arms decided",
);
check(!!tipped, "no battle of the Earth seed's first three centuries decided by arms");
if (!tipped) await fail();
const { war, battle } = tipped!,
  winner = battle.won ? war.attacker : war.defender;
// Ringed so on its war's course.
await k(`globalThis.causalis.watchWar(${JSON.stringify(war.ref)})`);
await page
  .waitForSelector(".war-panel:not([hidden]) .war-mark", { timeout: slow(60000) })
  .catch(() => undefined);
const rings = await k<number>(
  `document.querySelectorAll(".war-panel:not([hidden]) .war-mark.tipped").length`,
);
say(`its war's course: ${rings} battle${rings === 1 ? "" : "s"} ringed as decided by arms`);
check(rings >= 1, "the battle not ringed on its war's course");
await shot("2-course");
await k(`globalThis.causalis.client.setSpeed(0)`);
// Its page.
const battleTitle = await opened(battle.event);
const arms = await factOn("Arms");
say(`the battle's page: “${battleTitle}”; arms: “${arms?.value ?? "none"}”`);
for (const p of arms?.parts ?? []) say(`    ${p}`);
check(
  !!arms &&
    arms.value.startsWith("won it for ") &&
    arms.value.includes(winner.name.split(" ").at(-1)!),
  "the battle's page does not say arms won it for the winner",
);
check(
  !!arms && /with even arms it would have gone the other way/.test(arms.value),
  "the battle's page does not say how arms decided it",
);
check(
  (arms?.parts.length ?? 0) === 2 &&
    arms!.parts.every((p) => /% of the host so armed, a man worth \d/.test(p)),
  "each side's arms and how much of its host bore them not told",
);
await shot("3-battle");
const over2 = await onPhone("3-battle-phone");
say(`the battle's page on a phone: overflow ${over2} px`);
check(over2 <= 2, `the battle's page wider than a phone (${over2} px over)`);

// 3. The winner's army: how much of its host bears its arms.
await opened(`${winner.ref}#army`);
const armed = await factOn("So armed");
say(`${winner.name}'s army: so armed “${armed?.value ?? "not told"}”`);
for (const p of armed?.parts ?? []) say(`    ${p}`);
check(
  !!armed && /^\d+% of the host$/.test(armed.value),
  "the army's page does not tell how armed its host is",
);
check(
  (armed?.parts ?? []).some((p) => /^a man of it now/.test(p)) &&
    (armed?.parts ?? []).some((p) => /^fully armed/.test(p)),
  "the army's arms not broken down",
);
await shot("4-army");
const over3 = await onPhone("4-army-phone");
say(`the army's page on a phone: overflow ${over3} px`);
check(over3 <= 2, `the army's page wider than a phone (${over3} px over)`);

await browser.close();
await server.close();
if (errors.length) problems.push(...errors.map((e) => `page error: ${e}`));
if (problems.length) {
  console.log("FAILED:");
  for (const p of problems) console.log(`  - ${p}`);
  process.exit(1);
}
console.log("the Phase 52 gate passes");
