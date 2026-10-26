// node tools/phase50-gate.ts [--ci] [--soft] [--shots dir] — the Phase 50 gate (the chain from the
// ground to a thing, M212; asked for 2026-10-25: "mean crafting as the backbone of the whole game
// ... every made thing, at every age, is made by someone from what's actually around them ... The
// chain from ground to object stays the same, you can see it, and you can tap through it"), on the
// built app, the Earth seed three centuries on, in its greatest town whose tools are of metal and
// that keeps a smithy:
//   1. a working morning: its smiths at the anvil, forging what its land's metal makes; one tapped,
//      their card names them in its tongue, a smith of the town so many years at the anvil;
//   2. its smithy's page: that smith among who works there, and a tool made there this year traced
//      from its ore and its smelting to one of them; the ore's page opened from it;
//   3. one of its people's things: its page traces it from the ground to the hand, each step's
//      name a page;
//   4. a realm's host's arms, forged at the smithy of the town its realm is seated by: traced from
//      their ore to the smith who made them.
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
console.log("the Phase 50 gate");
if (shots) mkdirSync(shots, { recursive: true });

type Person = {
  name: string;
  x: number;
  z: number;
  index: number;
  task: string | null;
  why: string | null;
  folk: boolean;
};
type Civic = { kind: string; at: number; start: number; end: number; fell: number | null };
type Plan = {
  ref: string;
  name: string;
  seed: number;
  /** The metal its smiths forge (Phase 52 M217: its tools may still be mostly stone). */
  metal?: string;
  /** What its tools are headed with, mostly. */
  stuff?: { tool: { name: string } } | null;
  town?: { civics: Civic[] } | null;
  people: { ref: string; name: string; folk?: boolean; trade?: { kind: string } }[];
};
type Span = string | { text: string; ref?: string | null };
type Page = {
  kind: string;
  title: string;
  tabs: {
    id: string;
    blocks: { type: string; title?: string; items?: { ref?: string; line: Span[] }[] }[];
  }[];
};

const root = fileURLToPath(new URL("..", import.meta.url)),
  // (CAUSALIS_DIST: a build elsewhere, so that one can be looked at while dist/ is under test.)
  server = await preview({
    root,
    logLevel: "silent",
    preview: { port: 4307, strictPort: false },
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
/** The eye over a point of the town (metres), from so far off. */
const over = async (x: number, z: number, distance: number, pitch: number) => {
  await k(
    `globalThis.causalis.rig.flyTo({ target: { x: ${x * 0.1}, y: 0, z: ${z * 0.1} }, distance: ${distance}, pitch: ${pitch} })`,
  );
  await page.waitForTimeout(slow(2500));
};
/** One drawn tapped where they stand on the screen (the eye brought over them first). */
const tap = async (p: Person) => {
  await over(p.x, p.z, 3.5, -40);
  const at = await k<{ x: number; y: number } | null>(
    `globalThis.causalis.personOnScreen?.(${p.index}) ?? null`,
  );
  if (!at) return false;
  await page.mouse.click(at.x, at.y);
  await page.waitForTimeout(slow(900));
  return true;
};
const title = () =>
  page.$eval(".page-window .page-title", (e) => e.textContent ?? "").catch(() => "");
/** A page opened in the page window, its title come. */
const opened = async (ref: string) => {
  await k(`globalThis.causalis.open(${JSON.stringify(ref)})`);
  await page.waitForFunction(
    `document.querySelector(".page-window .page-title")?.textContent && document.querySelector(".page-window .page-title").textContent !== "…"`,
    undefined,
    { timeout: slow(30000) },
  );
  await page.waitForTimeout(300);
};
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
/** A link on the page window pressed: the first in the list titled so whose ref starts so. */
const follow = async (start: string, prefix: string) => {
  const was = await title();
  const ok = await k<boolean>(`(() => {
    const box = [...document.querySelectorAll(".page-window .block-list")].find((b) => b.querySelector("h3")?.textContent?.startsWith(${JSON.stringify(start)}));
    const a = box && [...box.querySelectorAll("a.ref-link")].find((a) => a.getAttribute("href").startsWith(${JSON.stringify(`#${prefix}`)}));
    if (!a) return false;
    a.click();
    return true;
  })()`);
  if (!ok) return null;
  await page
    .waitForFunction(
      (w) => {
        const t = document.querySelector(".page-window .page-title")?.textContent;
        return !!t && t !== "…" && t !== w;
      },
      was,
      { timeout: slow(30000) },
    )
    .catch(() => undefined);
  return title();
};
const words = (l: Span[]) => l.map((s) => (typeof s === "string" ? s : s.text)).join("");
const SMITHING = /^(Casting|Pouring|Forging) /;

await page.goto(`${base}?universe=earth&seed=${encodeURIComponent("first light")}&year=300&hold=1`);
await page.waitForFunction(
  () => ((globalThis as any).causalis?.drawn?.() as number) > 0,
  undefined,
  { timeout: 900000 },
);
await k(`globalThis.causalis.setQuality("high")`);
await k(`globalThis.causalis.client.setSpeed(0)`);
const t0 = await k<number>(`globalThis.causalis.client.status?.t ?? 0`),
  year = Math.floor(t0 / YEAR);

// The greatest town whose tools are of metal and that keeps a smithy, standing now. (Its tools
// mostly of the metal its smiths forge: Phase 52's tools are headed with what is made of them.)
const towns = await ask<{ ref: string; name: string; people: number }[]>("towns.map", {});
const standing = (c: Civic) => c.kind === "smithy" && (c.end + 1) * YEAR <= t0 && c.fell === null;
let town: Plan | null = null;
for (const c of towns.slice(0, 40)) {
  const plan = await ask<Plan>("village.plan", { ref: c.ref });
  if (
    plan.metal &&
    plan.metal !== "stone" &&
    plan.stuff?.tool.name === plan.metal &&
    plan.town?.civics.some(standing)
  ) {
    town = plan;
    break;
  }
}
say(`the town: ${town ? `${town.name}, its tools of ${town.metal}` : "none"}`);
check(!!town, "no town of the Earth seed works metal at a smithy by year 300");
if (!town) {
  await browser.close();
  await server.close();
  console.log("FAILED:");
  for (const p of problems) console.log(`  - ${p}`);
  process.exit(1);
}
const smithy = town.town!.civics.find(standing)!,
  smithyRef = `bldg:${town.ref}:${smithy.at}:${smithy.start}`;
await k(`globalThis.causalis.goTo(${JSON.stringify(town.ref)})`);
await until(
  `${town.name}'s smithy`,
  async () =>
    ((await k<{ smithies: number } | null>(`globalThis.causalis.trades?.() ?? null`))?.smithies ??
      0) > 0,
  slow(120000),
);
await k(`globalThis.causalis.client.setSpeed(0)`);
await page.waitForTimeout(slow(500));
const t1 = await k<number>(`globalThis.causalis.client.status?.t ?? 0`);
const rest = (day: number) => (day + (town!.seed % 7)) % 7 === 0;
let day = Math.floor(t1 / DAY) + 1;
while (rest(day)) day++;

// 1. A working morning: its smiths at the anvil; one tapped, their card naming them at it.
let smiths: Person[] = [];
for (let d = 0; d < 6 && !smiths.length; d++) {
  for (const hour of [10, 11.5, 14]) {
    await advance(day * DAY + hour * HOUR);
    smiths = (await people()).filter((p) => p.task === "hammer" && SMITHING.test(p.why ?? ""));
    if (smiths.length) break;
  }
  if (!smiths.length) {
    day++;
    while (rest(day)) day++;
  }
}
say(
  `at the anvil: ${smiths.length} — ${smiths
    .slice(0, 3)
    .map((p) => `${p.name}: “${p.why}”`)
    .join("; ")}`,
);
check(smiths.length > 0, "no smith seen at the anvil in six working days");
check(
  smiths.every((p) => p.why!.toLowerCase().includes(town!.metal!) || /iron/.test(p.why!)),
  `the smiths not forging the land's ${town.metal}`,
);
let tapped: { name: string; role: string } | null = null;
for (const p of smiths.slice(0, 4)) {
  if (!(await tap(p))) continue;
  const card = await k<{ name: string; role: string } | null>(`(() => {
    const role = [...document.querySelectorAll(".fact.folk-role")].find((e) => e.offsetParent !== null);
    const who = role?.closest("section")?.querySelector("h2");
    return role && who ? { name: who.textContent ?? "", role: role.textContent ?? "" } : null;
  })()`);
  if (card?.name === p.name) {
    tapped = card;
    break;
  }
}
say(`tapped: ${tapped ? `${tapped.name} — “${tapped.role}”` : "none"}`);
check(!!tapped, "no smith at the anvil tapped to their card");
if (tapped) {
  check(
    /^[A-Z][a-z]+ [A-Z][a-z]+$/.test(tapped.name),
    `the smith not named in the town's tongue: ${tapped.name}`,
  );
  check(
    new RegExp(`^A smith of ${town.name}, \\d+ years at the anvil$`).test(tapped.role),
    `the smith's card not telling their trade: “${tapped.role}”`,
  );
  await shot("1-smith");
}
await page.keyboard.press("Escape");
await page.waitForTimeout(slow(400));

// 2. Its smithy's page: who works there, and a tool made there this year traced from its ore.
await opened(smithyRef);
const who = await listOn("Who works here"),
  made = await listOn("Made here this year");
say(`${await title()}: ${who?.rows.length ?? 0} at work; ${made?.title ?? "nothing made"}`);
for (const r of made?.rows ?? []) say(`    ${r}`);
check(!!who && who.rows.length > 0, "the smithy's page not telling who works there");
if (who && tapped)
  check(
    who.rows.some((r) => r.startsWith(`${tapped!.name}, a smith of ${town!.name}`)),
    `${tapped.name}, tapped at its anvil, not among who works at the smithy`,
  );
check(!!made, "the smithy's page not telling a thing made there this year");
if (made) {
  check(
    made.refs.some((r) => r.startsWith("subst:")),
    "the smithy's thing not traced to its ore",
  );
  check(
    made.refs.some((r) => r.startsWith("rxn:")),
    "the smithy's thing not traced to its smelting",
  );
  check(made.refs.includes(smithyRef), "the smithy's thing not made at the smithy");
  check(
    !!who && who.rows.some((r) => made.rows.at(-1)!.includes(r.split(",")[0]!)),
    "the smithy's thing not made by one who works there",
  );
  await shot("2-smithy");
  const ore = await follow("Made here this year", "subst:");
  say(`its ore tapped: ${ore}`);
  check(!!ore && ore !== "…", "the ore's page not opened from the smithy's thing");
}

// 3. One of its people's things: traced from the ground to the hand, each name a page.
let traced: { title: string; rows: string[]; refs: string[] } | null = null,
  thing = "";
for (const p of town.people.filter((x) => !x.folk).slice(0, 12)) {
  const pp = await ask<Page>("page", { ref: p.ref }),
    held = pp.tabs
      .flatMap((t) => t.blocks)
      .find((b) => b.type === "list" && b.title === "What they hold");
  // (A tool of the town's metal, made since it came to work it.)
  const ref = held?.items?.find(
    (i) => i.ref?.startsWith("thing:") && words(i.line).includes(` ${town!.metal} `),
  )?.ref;
  if (!ref) continue;
  await opened(ref);
  traced = await listOn("From the ground to the hand");
  if (traced) {
    thing = await title();
    break;
  }
}
say(`a thing of theirs: ${thing || "none"}`);
for (const r of traced?.rows ?? []) say(`    ${r}`);
check(!!traced && traced.rows.length >= 2, "no tool of the town's people traced from the ground");
if (traced) {
  check(traced.refs.length >= 2, "a thing's chain linking too few pages");
  for (const r of traced.refs.slice(0, 6)) {
    const pg = await ask<Page>("page", { ref: r });
    check(pg.kind !== "unknown", `${r}, on a thing's chain, opening no page`);
  }
  await shot("3-thing");
}

// 4. A realm's host's arms, forged at the smithy of the town it is seated by: from ore to smith.
let forged: { title: string; rows: string[]; refs: string[] } | null = null;
for (const c of towns.slice(0, 40)) {
  const plan = c.ref === town.ref ? town : await ask<Plan>("village.plan", { ref: c.ref }),
    s = plan.town?.civics.find(standing);
  if (!s) continue;
  const sp = await ask<Page>("page", { ref: `bldg:${c.ref}:${s.at}:${s.start}` });
  if (
    !sp.tabs
      .flatMap((t) => t.blocks)
      .some((b) => b.title?.startsWith("Forged here this year for a realm's host"))
  )
    continue;
  await opened(`bldg:${c.ref}:${s.at}:${s.start}`);
  forged = await listOn("Forged here this year for a realm's host");
  if (forged) break;
}
say(`arms forged: ${forged?.title ?? "none"}`);
for (const r of forged?.rows ?? []) say(`    ${r}`);
check(!!forged, "no realm's arms forged at the smithy of its seat's town");
if (forged) {
  check(
    forged.refs.some((r) => r.startsWith("pol:")),
    "the arms not naming the realm whose host bears them",
  );
  check(
    forged.refs.some((r) => r.startsWith("rxn:")),
    "the arms not traced to their smelting",
  );
  check(
    / by [A-Z][a-z]+ [A-Z][a-z]+, a smith of /.test(forged.rows.at(-1) ?? ""),
    "the arms not made by a smith named",
  );
  await shot("4-arms");
  const realm = await follow("Forged here this year for a realm's host", "pol:");
  say(`its realm tapped: ${realm}`);
  check(!!realm, "the realm's page not opened from its arms");
}

// On the phone: the smithy's page fits its width.
await page.setViewportSize({ width: 430, height: 932 });
await opened(smithyRef);
await page.waitForTimeout(slow(600));
const wide = await k<number>(
  `Math.max(...[...document.querySelectorAll(".page-window .block-list")].map((b) => b.scrollWidth - b.clientWidth))`,
);
say(`on a phone: the smithy's lists overflow by ${wide} px`);
check(wide <= 2, `the smithy's page wider than a phone (${wide} px over)`);
await shot("5-phone");

await browser.close();
await server.close();
if (errors.length) problems.push(...errors.map((e) => `page error: ${e}`));
if (problems.length) {
  console.log("FAILED:");
  for (const p of problems) console.log(`  - ${p}`);
  process.exit(1);
}
console.log(`the Phase 50 gate passes (year ${year})`);
