// node tools/phase53-gate.ts [--ci] [--soft] [--shots dir] — the Phase 53 gate (later-age arms,
// M219–M220; asked for 2026-10-25: "later-age arms (semi/automatic, armour vehicles)"), in two
// parts:
//   1. in node, a realm of the Earth seed taught the later arms, with works in one of its lands and
//      oil in store: its machine gun traced from the ground — blown to steel in the converter,
//      turned by a named machinist, its cartridges of drawn brass, its smokeless powder — and its
//      armoured car, rolled steel on an oil engine;
//   2. on the built app, the Earth seed three centuries on: one of its battles fought again as
//      machine guns and armoured cars against repeating rifles, watched near — the attackers
//      coming on in rushes and going to ground to fire, the defenders in their trench, machine
//      guns on their tripods, the armoured cars rolling forward, some knocked out and burning; a
//      machine gunner followed and told; their weapon traced from the battle's bar to its page;
//      the bar at a phone's width.
// (npm run build first; --soft draws in software, as CI's browser does; --shots keeps a
// picture of each step.)
import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { preview } from "vite";
import { chromium } from "playwright";
import { YEAR, seedFromText, type Ref, type World } from "../src/kernel/index.ts";
import { cellRef } from "../src/gen/index.ts";
import { G, principle } from "../src/rules/index.ts";
import * as sim from "../src/sim/index.ts";
import { armsMade, type Made } from "../src/host/chain.ts";

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
console.log("the Phase 53 gate");
if (shots) mkdirSync(shots, { recursive: true });

// —— 1. The later arms traced from the ground (in node) ————————————————————————————————

type Span = string | { text: string; ref?: string };
const words = (line: readonly Span[]) =>
  line.map((s) => (typeof s === "string" ? s : s.text)).join("");
const chainOf = (made: Made | null) => (made ? made.chain.map(words) : []);

/** Teach a land principles outright (the tree takes centuries to reach them). */
function teach(world: World, cell: number, list: readonly string[]): void {
  const lore = sim.loreOf(world);
  for (const id of list) {
    if (lore.get(cell, id)) continue;
    const event = world.events.emit({
      type: sim.LORE_EVENTS.found.type,
      place: cellRef(0, cell),
      data: { principle: id },
    });
    lore.learn(cell, id, { year: Math.floor(world.now / YEAR), event }, principle(id));
  }
}

{
  const world = sim.makePopulationWorld(seedFromText("first light"), { start: "spread" });
  world.runTo(80 * YEAR);
  const year = Math.floor(world.now / YEAR),
    p = sim
      .politiesOf(world)
      .living()
      .find((r) => r.members.length >= 2);
  check(!!p, "a realm of two lands or more at year 80");
  if (p) {
    teach(world, p.seat, [
      ...["bronze", "iron", "writing", "mathematics", "steel", "clockwork", "medicine"],
      ...["gunpowder", "firearms", "rifling", "repeating-fire", "self-loading"],
      ...["automatic-fire", "armoured-vehicles"],
    ]);
    const land = [...p.members].sort((a, b) => a - b).at(-1)!,
      market = sim.marketsOf(world).of(land);
    teach(world, land, ["steel"]);
    market.works = world.events.emit({
      type: sim.LORE_EVENTS.found.type,
      place: cellRef(0, land),
    }) as Ref;
    market.stock[G.machines] = 10;
    market.stock[G.oil] = 5;
    const gun = armsMade(
        world,
        p.ref,
        { role: "arm", id: "automatic", material: "machined" },
        year,
      ),
      car = armsMade(world, p.ref, { role: "mount", id: "armoured", material: "machined" }, year),
      gunRows = chainOf(gun),
      carRows = chainOf(car);
    say(`${p.ref}'s machine gun, from the ground (${gun?.stuff ?? "not traced"}):`);
    for (const r of gunRows) say(`    ${r}`);
    say(`made by: ${gun?.maker ? `${gun.maker.name}, a ${gun.maker.trade}` : "no one"}`);
    check(
      gunRows.some((r) => /converter/.test(r)),
      "the machine gun's steel not blown in the converter",
    );
    check(
      !!gun?.maker && /machinist/.test(gun.maker.trade),
      "the machine gun not turned by a named machinist",
    );
    check(
      gunRows.some((r) => /brass/.test(r)) && gunRows.some((r) => /gun cotton/.test(r)),
      "its cartridges of brass and its smokeless powder not traced",
    );
    say(`its armoured car (${car?.stuff ?? "not traced"}):`);
    for (const r of carRows) say(`    ${r}`);
    check(
      carRows.some((r) => /rolled steel/.test(r)) && carRows.some((r) => /oil/.test(r)),
      "the armoured car's rolled steel and its oil not traced",
    );
  }
}

// —— 2. A battle of the later arms watched near (the built app) ———————————————————————————

type Side = {
  ref: string;
  name: string;
  fielded: number;
  fallen: number;
  host: { arm: string; guard: string; mount: string } | null;
  kit: string;
  risen?: number;
  armed?: number;
};
type Near = {
  event: string;
  title: string;
  attacker: Side;
  defender: Side;
  won: boolean;
  outcome: string;
  hills: boolean;
  river: boolean;
  walls: 0 | 1 | 2;
  town: string | null;
};
type Seen = {
  event: string;
  s: number;
  words: string;
  followed: string | null;
  cars: number;
  wrecks: number;
  prone: number;
  guns: number;
  trench: boolean;
  weapon: boolean;
  onScreen: {
    id: number;
    side: number;
    act: string;
    gun?: true;
    at: { x: number; y: number } | null;
  }[];
};

const root = fileURLToPath(new URL("..", import.meta.url)),
  // (CAUSALIS_DIST: a build elsewhere, so that one can be looked at while dist/ is under test.)
  server = await preview({
    root,
    logLevel: "silent",
    preview: { port: 4310, strictPort: false },
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
const shot = async (name: string) => {
  if (shots) await page.screenshot({ path: join(shots, `${name}.png`) });
};
const seen = () => k<Seen | null>(`globalThis.causalis.battle?.() ?? null`);
/** The battle held at a moment of it, drawn. */
const at = async (s: number) => {
  await k(`globalThis.causalis.battleAt(${s}, 0)`);
  await page.waitForTimeout(slow(900));
  return (await seen())!;
};
const until = async (what: string, ok: () => Promise<boolean>, ms: number) => {
  const end = Date.now() + ms;
  while (Date.now() < end) {
    if (await ok()) return true;
    await page.waitForTimeout(250);
  }
  problems.push(`waited too long for ${what}`);
  return false;
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
// One of its battles (the most fallen), fought again with the later arms: machine guns, steel
// helmets and armoured cars against repeating rifles and plate, on open ground.
const wars = await k<{ wars: { battles: { event: string; fallen: number }[] }[] }>(
    `globalThis.causalis.client.query({ type: "wars.map" })`,
  ),
  greatest = wars.wars.flatMap((w) => w.battles).sort((a, b) => b.fallen - a.fallen)[0];
check(!!greatest, "a battle in the world's history to fight again");
if (!greatest) await fail();
const real = await k<Near>(
    `globalThis.causalis.client.query({ type: "battle.near", args: { event: ${JSON.stringify(greatest!.event)} } })`,
  ),
  near: Near = {
    ...real,
    attacker: {
      ...real.attacker,
      fielded: 6000,
      fallen: 1500,
      host: { arm: "automatic", guard: "helmet", mount: "armoured" },
      kit: "machine guns and steel helmets, with armoured cars",
      risen: 0,
      armed: 1,
    },
    defender: {
      ...real.defender,
      fielded: 4000,
      fallen: 1700,
      host: { arm: "repeater", guard: "plate", mount: "" },
      kit: "repeating rifles and plate",
      risen: 0,
      armed: 1,
    },
    won: true,
    outcome: "field",
    hills: false,
    river: false,
    walls: 0,
    town: null,
  };
say(`${near.title} fought again: ${near.attacker.kit} against ${near.defender.kit}`);
check(
  await k<boolean>(`globalThis.causalis.watchBattleNear(${JSON.stringify(near)})`),
  "the battle not watched",
);
await until("the battle's field", async () => (await seen())?.event === near.event, slow(60000));

// The attackers come on in rushes, going to ground to fire; the defenders in their trench; the
// machine guns on their tripods; the armoured cars rolling forward.
let b = await at(12);
say(`12 s: "${b.words}"`);
check(/rushes/.test(b.words), `the attackers do not come on in rushes ("${b.words}")`);
b = await at(25);
const acts = new Map<string, number>();
for (const t of b.onScreen) if (t.side === 0) acts.set(t.act, (acts.get(t.act) ?? 0) + 1);
say(
  `25 s: "${b.words}"; the attackers ${[...acts].map(([a, n]) => `${a} ${n}`).join(", ")}; ${b.prone} down in all; ${b.guns} at machine guns; ${b.cars} armoured cars; a trench ${b.trench}`,
);
check((acts.get("prone") ?? 0) > 0 && (acts.get("run") ?? 0) > 0, "no rushes and going to ground");
check(b.trench, "no trench dug by the defenders");
check(b.guns > 0, "no machine guns' teams");
check(b.cars > 0, "no armoured cars");
await shot("1-rushes");
b = await at(45);
await shot("2-the-cars");
b = await at(140);
say(`140 s: "${b.words}"; ${b.wrecks} of ${b.cars} armoured cars knocked out`);
check(b.wrecks > 0, "no armoured car knocked out");
await shot("3-wrecks-burning");

// A machine gunner followed and told; their weapon traced from the battle's bar.
b = await at(30);
const gunner = b.onScreen.find(
  (t) => t.gun && t.at && t.at.y > 200 && t.at.y < 720 && t.at.x > 40 && t.at.x < 1320,
);
check(!!gunner, "no machine gunner seen on the screen");
if (gunner?.at) {
  await page.mouse.click(gunner.at.x, gunner.at.y);
  await until(
    "the gunner followed",
    async () => !!(await page.locator(".battle-followed-words").textContent())?.trim(),
    slow(8000),
  );
  const told = (await page.locator(".battle-followed-words").textContent()) ?? "";
  say(`followed: ${told}`);
  check(
    /^👁 A machine gunner of /.test(told),
    `the one followed not told a machine gunner (${told})`,
  );
  b = (await seen())!;
  check(b.weapon, "no weapon to trace beside the one followed");
  await shot("4-a-machine-gunner");
  await page.locator(".battle-weapon").click();
  await until(
    "the weapon's page",
    async () =>
      /in the battle at/.test(
        await page.$eval(".page-window .page-title", (e) => e.textContent ?? "").catch(() => ""),
      ),
    slow(30000),
  );
  const title = await page
      .$eval(".page-window .page-title", (e) => e.textContent ?? "")
      .catch(() => ""),
    rows = await k<string[]>(`(() => {
      const box = [...document.querySelectorAll(".page-window .block-list")].find((b) => b.querySelector("h3")?.textContent?.startsWith("From the ground"));
      return box ? [...box.querySelectorAll(".entry")].map((e) => e.textContent ?? "") : [];
    })()`);
  say(`their weapon's page: "${title}", ${rows.length} steps from the ground`);
  check(rows.length > 0, "their weapon's page traces nothing from the ground");
  await shot("5-their-weapon");
  await k(`document.querySelector(".page-window .close")?.click()`);
  await page.waitForTimeout(slow(500));
}

// The battle's bar at a phone's width.
await page.setViewportSize({ width: 430, height: 932 });
await page.waitForTimeout(slow(1200));
const over = await k<number>(
  `(() => { const p = document.querySelector(".battle-panel"); return p ? Math.max(0, p.scrollWidth - p.clientWidth) : -1; })()`,
);
say(`the battle's bar on a phone: overflow ${over} px`);
check(over >= 0 && over <= 2, `the battle's bar wider than a phone (${over} px over)`);
await shot("6-phone");

await browser.close();
await server.close();
if (errors.length) problems.push(...errors.map((e) => `page error: ${e}`));
if (problems.length) {
  console.log("FAILED:");
  for (const p of problems) console.log(`  - ${p}`);
  process.exit(1);
}
console.log("the Phase 53 gate passes");
