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
//   4. the page at a phone's width;
// and the crafts (M214) in that world: 5. the clamp smoking in the woodlot of the town that smelts;
// 6. a town's potters at their wheels, its boards filling with the day's pots, one tapped to its
// page — the land's own clay ware; 7. a town's weavers at their looms, the cloth growing through
// the day, one tapped — its land's cloth; and things made at scale (M215), the Earth seed in the
// modern age (1050): 8. a town's foundry blown and tapped, its moulds poured, its castings stacked,
// a mould tapped — "A cast iron …" by one of its founders; 9. its works' floor, presses and lathes
// at work, the bench filling, a finished part tapped — "A steel …" made in the converter.
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
  stuff?: {
    ore: { name: string } | null;
    clay?: { ware: string };
    cloth?: { name: string };
  } | null;
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

await page.goto(`${base}?universe=earth&seed=${encodeURIComponent("first light")}&year=300&hold=1`);
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
  await page
    .waitForFunction(() => !(globalThis as any).causalis.rig.flying, undefined, {
      timeout: slow(60000),
    })
    .catch(() => undefined);
  await page.waitForTimeout(slow(1000));
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

// —— The crafts (M214) ————————————————————————————————————————————————————————————
type Crafts = {
  wheels: number;
  turning: number;
  pots: number;
  looms: number;
  weaving: number;
  clamp: { stage: number; smoking: boolean } | null;
  boardsAt: { x: number; z: number; pots: number }[];
  loomsAt: { x: number; z: number; woven: number; index: number }[];
  clampAt: { x: number; z: number; stage: number; lit: boolean } | null;
  foundry: {
    blowing: boolean;
    tapping: boolean;
    poured: number;
    glowing: number;
    stacked: number;
  } | null;
  foundryAt: { x: number; z: number; moulds: { x: number; z: number; poured: boolean }[] } | null;
  floor: {
    lathes: number;
    presses: number;
    turning: number;
    pressing: number;
    benched: number;
  } | null;
  floorAt: {
    machines: { x: number; z: number; kind: string; running: boolean }[];
    bench: { x: number; z: number };
    benched: number;
  } | null;
};
const crafts = () => k<Crafts | null>(`globalThis.causalis.crafts?.() ?? null`);
const spots = (tool: string) => () =>
  k<{ x: number; y: number }[]>(`globalThis.causalis.${tool}?.() ?? []`);
await page.setViewportSize({ width: 1366, height: 800 });
await k(`document.querySelector(".page-window .close")?.click()`);
await page.waitForTimeout(slow(500));
/** The first of the first forty towns whose plan passes `ok`. */
const townWhere = async (ok: (p: Plan) => boolean): Promise<Plan | null> => {
  for (const c of (await ask<{ ref: string }[]>("towns.map", {})).slice(0, 40)) {
    const plan = await ask<Plan>("village.plan", { ref: c.ref, folk: 220 });
    if (ok(plan)) return plan;
  }
  return null;
};
/** Into a town, the clock held: its next working day. */
const enter = async (plan: Plan): Promise<number> => {
  await k(`document.querySelector(".page-window .close")?.click()`);
  await k(`globalThis.causalis.goTo(${JSON.stringify(plan.ref)})`);
  await until(`${plan.name}'s view`, async () => (await crafts()) !== null, slow(120000));
  await k(`globalThis.causalis.client.setSpeed(0)`);
  await page.waitForTimeout(slow(500));
  let d = Math.floor((await k<number>(`globalThis.causalis.client.status?.t ?? 0`)) / DAY) + 1;
  while ((d + (plan.seed % 7)) % 7 === 0) d++;
  return d;
};
/** A made thing tapped where it is on the screen, the eye brought near it: its page's title. */
const tapMade = async (
  at: { x: number; z: number },
  where: () => Promise<{ x: number; y: number }[]>,
  name: string,
) => {
  await k(
    `globalThis.causalis.rig.flyTo({ target: { x: ${at.x * 0.1}, y: 0.25, z: ${at.z * 0.1} }, distance: 3, pitch: -34 })`,
  );
  // (The flight eases on by the frames: waited out however slowly they come — a city's works lie
  // far out, and a great town draws slowly in software.)
  await page
    .waitForFunction(() => !(globalThis as any).causalis.rig.flying, undefined, {
      timeout: slow(60000),
    })
    .catch(() => undefined);
  await page.waitForTimeout(slow(1000));
  let seen = (await where()).filter(onScreen);
  if (!seen.length) {
    await page.waitForTimeout(slow(1000));
    seen = (await where()).filter(onScreen);
  }
  check(seen.length > 0, `${name} not on the screen`);
  if (!seen.length) return "";
  const p = seen[Math.floor(seen.length / 2)]!;
  await page.mouse.click(p.x, p.y);
  await page
    .waitForFunction(
      () => /^An? /.test(document.querySelector(".page-window .page-title")?.textContent ?? ""),
      undefined,
      { timeout: slow(20000) },
    )
    .catch(() => undefined);
  return title();
};

// 5. The clamp in the woodlot of the town that smelts its own ore: there, smoking or built up.
const clamp = await crafts();
say(
  `the clamp: ${clamp?.clampAt ? `stage ${clamp.clampAt.stage}, lit ${clamp.clampAt.lit}` : "none"}; drawn ${!!clamp?.clamp}`,
);
check(!!clamp?.clampAt && !!clamp.clamp, `no charcoal clamp drawn in ${town.name}'s woodlot`);

// 6. The potters: at their wheels of a morning, the boards filling, a pot tapped.
const potting = await townWhere(
  (p) => !!p.stuff?.clay && p.people.some((x) => x.trade?.kind === "potter"),
);
check(!!potting, "no town of the Earth seed keeps potters of its own by year 300");
if (potting) {
  const pday = await enter(potting);
  let turning = 0;
  for (const hour of [10, 11, 14, 15.5]) {
    await advance(pday * DAY + hour * HOUR);
    turning = Math.max(turning, (await crafts())?.turning ?? 0);
  }
  const boards = (await crafts())?.boardsAt.filter((b) => b.pots > 0) ?? [];
  say(
    `${potting.name}'s potters: a wheel turning ${turning > 0}; pots on the boards ${boards.reduce((a, b) => a + b.pots, 0)}`,
  );
  check(turning > 0, `no wheel turning at ${potting.name}'s kiln`);
  check(boards.length > 0, `no pots on ${potting.name}'s boards by the afternoon`);
  if (boards.length) {
    const opened = await tapMade(boards[0]!, spots("potsOnScreen"), "the boards' pots");
    say(`tapped on the boards: “${opened}”`);
    check(
      new RegExp(`^an? ${potting.stuff!.clay!.ware} (storage jar|cooking pot|bowl|jug)$`, "i").test(
        opened,
      ),
      `a pot on the boards opened “${opened}”, not a pot of ${potting.stuff!.clay!.ware}`,
    );
    const chain = await listOn("From the ground to the boards");
    check(
      !!chain && chain.refs.some((r) => r.startsWith("subst:")),
      "the pot not traced to its clay",
    );
    await shot("6-pot");
  }
}

// 7. The weavers: the cloth growing on the looms through the day, a loom tapped.
const weaving = await townWhere(
  (p) => !!p.stuff?.cloth && p.people.some((x) => x.trade?.kind === "weaver"),
);
check(!!weaving, "no town of the Earth seed keeps weavers of its own by year 300");
if (weaving) {
  const wday = await enter(weaving);
  await advance(wday * DAY + 9.5 * HOUR);
  const morning = new Map(((await crafts())?.loomsAt ?? []).map((l) => [l.index, l.woven]));
  let woven = 0;
  for (const hour of [11, 14, 16]) {
    await advance(wday * DAY + hour * HOUR);
    woven = Math.max(woven, (await crafts())?.weaving ?? 0);
  }
  const later = (await crafts())?.loomsAt ?? [],
    grew = later.filter((l) => l.woven > (morning.get(l.index) ?? 1) + 0.05);
  say(
    `${weaving.name}'s weavers: at the loom ${woven > 0}; cloth grown on ${grew.length} of ${later.length} looms`,
  );
  check(woven > 0, `no one seen weaving at ${weaving.name}'s looms`);
  check(grew.length > 0, `the cloth not growing on ${weaving.name}'s looms through the day`);
  if (later.length) {
    const opened = await tapMade(grew[0] ?? later[0]!, spots("loomsOnScreen"), "the looms' cloth");
    say(`tapped on a loom: “${opened}”`);
    check(
      opened === `A length of ${weaving.stuff!.cloth!.name}`,
      `a loom's cloth opened “${opened}”, not ${weaving.stuff!.cloth!.name}`,
    );
    await shot("7-loom");
  }
}

// —— At scale (M215): the Earth seed in the modern age ——————————————————————————————
await k(`document.querySelector(".page-window .close")?.click()`);
await page.goto(`${base}?universe=earth&seed=${encodeURIComponent("first light")}&year=1050&hold=1`);
await page.waitForFunction(
  () => ((globalThis as any).causalis?.drawn?.() as number) > 0,
  undefined,
  { timeout: 1500000 },
);
await k(`globalThis.causalis.setQuality("high")`);
await k(`globalThis.causalis.client.setSpeed(0)`);
const works = await townWhere(
  (p) =>
    p.people.some((x) => x.trade?.kind === "machinist") &&
    p.people.some((x) => x.trade?.kind === "founder"),
);
check(!!works, "no town of the Earth seed keeps founders and machinists at its works by 1050");
if (works) {
  const founders = new Set(
      works.people.filter((p) => p.trade?.kind === "founder").map((p) => p.name),
    ),
    hands = new Set(works.people.filter((p) => p.trade?.kind === "machinist").map((p) => p.name)),
    fday = await enter(works);

  // 8. The foundry: blown, tapped (in the middle of a founder's draw), poured, stacked; a mould tapped.
  await advance(fday * DAY + 7 * HOUR);
  let tapped = false;
  for (const p of (await people()).filter((x) => founders.has(x.name))) {
    const draw = (await k<Leg[]>(`globalThis.causalis.legs?.(${p.index}) ?? []`)).find(
      (l) => l.why === "Drawing the iron from the cupola into the ladle" && l.from > 7 * HOUR,
    );
    if (!draw) continue;
    await advance(fday * DAY + (draw.from + draw.to) / 2);
    tapped = !!(await crafts())?.foundry?.tapping;
    if (tapped) break;
  }
  await advance(fday * DAY + 16.75 * HOUR);
  const foundry = (await crafts())?.foundry ?? null,
    foundryAt = (await crafts())?.foundryAt ?? null;
  say(
    `${works.name}'s foundry: tapped ${tapped}; blowing ${foundry?.blowing}; moulds holding ${foundry?.poured ?? 0}; stacked ${foundry?.stacked ?? 0}`,
  );
  check(tapped, `${works.name}'s cupola not seen tapped in the middle of a founder's draw`);
  check((foundry?.poured ?? 0) >= 2, `${works.name}'s moulds not poured by the afternoon`);
  check((foundry?.stacked ?? 0) > 0, `no castings stacked by ${works.name}'s works`);
  const poured = foundryAt?.moulds.find((m) => m.poured);
  if (poured) {
    await shot("8-foundry");
    const opened = await tapMade(poured, spots("mouldsOnScreen"), "the foundry's moulds");
    say(`tapped on a mould: “${opened}”`);
    check(/^A cast iron [a-z ]+$/.test(opened), `a mould opened “${opened}”, not a casting`);
    const chain = await listOn("From the ground to the mould");
    const by = chain?.rows.at(-1) ?? "";
    check(
      [...founders].some((n) => by.includes(`by ${n}, a founder of ${works.name}`)),
      `the casting not poured by one of ${works.name}'s founders: “${by}”`,
    );
  }

  // 9. The works' floor: presses and lathes at work, the bench filling; a finished part tapped.
  await k(`document.querySelector(".page-window .close")?.click()`);
  const floorDay = fday + ((fday + 1 + (works.seed % 7)) % 7 === 0 ? 2 : 1);
  let running = 0;
  for (const hour of [9.5, 10.5, 14]) {
    await advance(floorDay * DAY + hour * HOUR);
    const f = (await crafts())?.floor;
    running = Math.max(running, (f?.turning ?? 0) + (f?.pressing ?? 0));
  }
  await advance(floorDay * DAY + 16 * HOUR);
  const floor = (await crafts())?.floor ?? null,
    floorAt = (await crafts())?.floorAt ?? null;
  say(
    `${works.name}'s works floor: ${floor?.presses ?? 0} presses, ${floor?.lathes ?? 0} lathes; at work ${running}; on the bench ${floor?.benched ?? 0}`,
  );
  check(running > 0, `no machine at work on ${works.name}'s floor`);
  check((floor?.benched ?? 0) > 0, `no finished parts on ${works.name}'s bench by the afternoon`);
  if (floorAt && floorAt.benched > 0) {
    await shot("9-floor");
    const opened = await tapMade(floorAt.bench, spots("benchOnScreen"), "the bench's parts");
    say(`tapped on the bench: “${opened}”`);
    check(
      /^A steel [a-z ]+$/.test(opened),
      `a part on the bench opened “${opened}”, not a steel part`,
    );
    const chain = await listOn("From the ground to the bench");
    for (const r of chain?.rows ?? []) say(`    ${r}`);
    check(
      !!chain && chain.rows.some((r) => /converter/.test(r)),
      "the part not traced through the converter",
    );
    const by = chain?.rows.at(-1) ?? "";
    check(
      [...hands].some((n) => by.includes(`by ${n}, a machinist of ${works.name}`)),
      `the part not made by one of ${works.name}'s machinists: “${by}”`,
    );
    await page.setViewportSize({ width: 430, height: 932 });
    await page.waitForTimeout(slow(800));
    const over = await k<number>(
      `Math.max(0, ...[...document.querySelectorAll(".page-window .block")].map((b) => b.scrollWidth - b.clientWidth))`,
    );
    say(`the part's page on a phone: overflow ${over} px`);
    check(over <= 2, `the part's page wider than a phone (${over} px over)`);
  }
}

await browser.close();
await server.close();
if (errors.length) problems.push(...errors.map((e) => `page error: ${e}`));
if (problems.length) {
  console.log("FAILED:");
  for (const p of problems) console.log(`  - ${p}`);
  process.exit(1);
}
console.log("the Phase 51 gate passes");
