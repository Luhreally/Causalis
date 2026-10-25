// node tools/phase40-gate.ts [--ci] [--soft] [--shots dir] — the Phase 40 gate (war in place, M203;
// asked for 2026-10-25: "...and like the more fluid views of wars and just actions of stuff yk"),
// on the built app, the Earth seed in year 120:
//   1. a war of history fought this year, gone down to the land it fights for next: its hosts where
//      its year has them on the world's clock, the attacker's mustering and the land's own holding it;
//   2. the clock held, they stand: nothing marches by the screen's clock;
//   3. as the year goes, its host marches on the land by its roads, and the two are drawn up before
//      it, what each is at on its counter, the battle to come named;
//   4. the land's clock set going: the battle drawn near, it is slowed to a day a second, told under
//      the bar; the two engaged, falling; at the year's turn, history's battle — its beaten falling
//      back or flying, its fallen on its field — and the clock going on as it went once the rout is
//      over;
//   5. on the globe, each of the world's wars' hosts as far along its way as its year has gone;
//   6. in a town at war (M204): a land's men mustering past its homes and marching out by its road;
//      before the heart of the land fought for, the hosts drawn up, named over them and told under
//      its bar, its clock slowed for the battle, the two engaged and falling, and after the turn
//      the fallen where they fell; a siege's camp about the town besieged, if one is laid.
// (npm run build first; --soft draws in software, as CI's browser does; --shots keeps a picture of
// each step.)
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
console.log("the Phase 40 gate");
if (shots) mkdirSync(shots, { recursive: true });

type Mark = {
  ref: string;
  side: number;
  doing: string;
  x: number;
  z: number;
  men: number;
  name: string;
};
type InPlace = {
  marks: Mark[];
  fights: { key: string; stage: string; k: number; x: number; z: number; name: string }[];
  camps: number;
  figures: number;
  fallen: number;
  slowed: string | null;
  told: string;
  wars: {
    ref: string;
    turn: number;
    f: number;
    attacker: string | null;
    defender: string | null;
  }[];
};
type War = {
  ref: string;
  attacker: { name: string };
  defender: { name: string };
  next?: number | null;
  siege: number | null;
  ended: number | null;
};

const root = fileURLToPath(new URL("..", import.meta.url)),
  server = await preview({ root, logLevel: "silent", preview: { port: 4291, strictPort: false } }),
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
/** Whether it comes within the time (not a problem if not). */
const comes = async (ok: () => Promise<boolean>, ms: number) => {
  const end = Date.now() + ms;
  while (Date.now() < end) {
    if (await ok().catch(() => false)) return true;
    await page.waitForTimeout(250);
  }
  return false;
};
const shot = async (name: string) => {
  if (shots) await page.screenshot({ path: join(shots, `${name}.png`) });
};
const YEAR = 365 * 86400,
  DAY = 86400;
const clockT = () => k<number>(`globalThis.causalis.client.status?.t ?? 0`);
/** On to moment t (as the clock stands), the host there, and a few frames drawn. */
const advance = async (t: number) => {
  await k(`globalThis.causalis.client.advance(${Math.round(t)})`);
  await until("the world at the moment asked", async () => (await clockT()) >= t - 1, slow(60000));
  await page.waitForTimeout(slow(600));
};
const inPlace = () => k<InPlace | null>(`globalThis.causalis.warsInPlace?.() ?? null`);
const scale = () => k<string>(`globalThis.causalis.scale()`);
const clock = () => k<{ stopped: boolean; speed: number }>(`globalThis.causalis.clock()`);
// (A speed by what its button says: "1 month/s"; the pause by its name.)
const press = (label: RegExp) =>
  k<boolean>(
    `(() => { const b = [...document.querySelectorAll(".panel:not([hidden]) .timebar .speeds button")].find((x) => ${label}.test((x.textContent ?? "") + " " + (x.getAttribute("aria-label") ?? ""))); b?.click(); return !!b; })()`,
  );
const labels = () =>
  k<string[]>(`[...document.querySelectorAll(".labels > *")].map((e) => e.textContent ?? "")`);

await page.goto(`${base}?universe=earth&seed=${encodeURIComponent("first light")}&year=119`);
await page.waitForFunction(
  () => ((globalThis as any).causalis?.drawn?.() as number) > 0,
  undefined,
  { timeout: 900000 },
);
await k(`globalThis.causalis.client.setSpeed(0)`);
// A year's start: its battles fought at its turn, its hosts mustering again.
const Y = Math.floor((await clockT()) / YEAR) + 1;
await advance((Y + 0.18) * YEAR);

// 1. A war fought this year, gone down to the land it fights for next.
const map = await k<{ year: number; wars: War[] }>(
  `globalThis.causalis.client.query({ type: "wars.map" })`,
);
const fought = map.wars.filter((w) => w.ended === null && w.next != null && w.siege === null);
say(
  `year ${map.year}: ${map.wars.length} wars, ${fought.length} with a battle to come in the field`,
);
check(fought.length > 0, "no war with a battle to come");
let war: War | null = null,
  now: InPlace | null = null;
const mine = (n: InPlace | null, side?: number) =>
  n?.marks.filter((m) => m.ref === war?.ref && (side === undefined || m.side === side)) ?? [];
for (const w of fought.slice(0, 6)) {
  const province = await k<number>(
    `globalThis.causalis.client.latestFrame("globe").arrays.province[${w.next}]`,
  );
  await k(`globalThis.causalis.descend(${province})`);
  await until("the land fought for", async () => (await scale()) === "region", slow(60000));
  war = w;
  const seen = await comes(
    async () => mine(await inPlace(), 0).length > 0 && mine(await inPlace(), 1).length > 0,
    slow(15000),
  );
  if (seen) break;
  war = null;
  say(`${w.ref}: its hosts not both in its land; the next`);
  await k(`globalThis.causalis.zoomThrough("out")`);
  await until("the world again", async () => (await scale()) === "globe", slow(30000));
}
check(!!war, "no war with both its hosts in the land it fights for");
now = await inPlace();
const attacker = () => mine(now, 0)[0],
  defender = () => mine(now, 1)[0];
say(`${war?.attacker.name} upon ${war?.defender.name}: ${attacker()?.name} · ${defender()?.name}`);
check(attacker()?.doing === "mustering", `the attacker's host mustering (${attacker()?.doing})`);
check(defender()?.doing === "garrisoned", `the land held by its own (${defender()?.doing})`);
if (attacker()) await k(`globalThis.causalis.faceLand(${attacker()!.x}, ${attacker()!.z}, 40)`);
await page.waitForTimeout(slow(1500));
await shot("1-mustering");

// 2. Held, they stand.
const held = attacker();
await page.waitForTimeout(slow(1500));
now = await inPlace();
check(
  !!held && !!attacker() && held.x === attacker()!.x && held.z === attacker()!.z,
  "a host moved while the clock was held",
);

// 3. On the march by the roads; drawn up before the land, what each is at told.
await advance((Y + 0.5) * YEAR);
now = await inPlace();
const a1 = attacker();
await advance((Y + 0.7) * YEAR);
now = await inPlace();
const a2 = attacker();
say(
  `on the march: ${a1?.doing} at ${a1?.x.toFixed(1)},${a1?.z.toFixed(1)} → ${a2?.doing} at ${a2?.x.toFixed(1)},${a2?.z.toFixed(1)}; the defenders ${defender()?.doing}`,
);
check(a1?.doing === "marching" && a2?.doing === "marching", "the host not on the march");
check(
  !!a1 && !!a2 && Math.hypot(a2.x - a1.x, a2.z - a1.z) > 1,
  "the host did not go on its way as the year went",
);
if (a2) await k(`globalThis.causalis.faceLand(${a2.x}, ${a2.z}, 40)`);
await page.waitForTimeout(slow(1500));
await shot("2-marching");
await advance((Y + 0.86) * YEAR);
now = await inPlace();
const drawn = now?.fights.find((f) => f.key.startsWith(`${war?.ref}:`));
say(`drawn up: ${attacker()?.doing} and ${defender()?.doing}; ${drawn?.name} (${drawn?.stage})`);
check(
  attacker()?.doing === "facing" && defender()?.doing === "facing",
  "the two hosts not drawn up",
);
check(drawn?.stage === "drawn", "the battle to come not told");
if (drawn) await k(`globalThis.causalis.faceLand(${drawn.x}, ${drawn.z}, 34)`);
await page.waitForTimeout(slow(2000));
const told = await labels();
check(
  told.some((t) => t.startsWith("⚔️ The battle for")),
  `the battle to come not named over its field (${told.filter((t) => t.includes("⚔")).join(" | ")})`,
);
check(
  told.some((t) => /🛡️ [\d.]+k?/.test(t)),
  `no host's counter telling it drawn up (${told.slice(0, 8).join(" | ")})`,
);
await shot("3-drawn-up");

// 4. The land's clock going: slowed for the battle, the two engaged, the turn, and on again.
check(await press(/^1 month/i), "no month-a-second speed in the land's bar");
const slowed = await until(
  "the land's clock slowed for the battle",
  async () => {
    const n = await inPlace(),
      c = await clock();
    return !!n?.slowed && c.speed === DAY;
  },
  slow(20000),
);
now = await inPlace();
say(`slowed: ${slowed} — "${now?.told}"`);
check(/slowed to a day a second/i.test(now?.told ?? ""), `the slowing not told (${now?.told})`);
await until(
  "the two hosts engaged",
  async () => {
    now = await inPlace();
    return attacker()?.doing === "engaged" && defender()?.doing === "engaged";
  },
  slow(30000),
);
// (On toward the turn, past the moment the first fall.)
await advance((Y + 0.985) * YEAR);
now = await inPlace();
say(`engaged: ${now?.fallen} fallen in the fight; ${now?.figures} figures`);
check((now?.fallen ?? 0) > 0, "none falls in the fight");
await shot("4-engaged");
const turned = await until(
  "history's battle at the year's turn",
  async () => {
    now = await inPlace();
    const w = now?.wars.find((x) => x.ref === war?.ref);
    return !!w && w.turn === Y + 1;
  },
  slow(90000),
);
now = await inPlace();
const after = now?.wars.find((x) => x.ref === war?.ref),
  armies = await k<{ land: { fallen: number } }>(`globalThis.causalis.armies()`);
say(
  `the turn: ${turned}; the attacker ${after?.attacker}, the defenders ${after?.defender}; ${armies.land.fallen} fallen on the field`,
);
check(
  ["holding", "withdrawing", "entering", "besieging"].includes(after?.attacker ?? "") ||
    ["holding", "routed", "besieged", "returning"].includes(after?.defender ?? ""),
  `no battle's end (${JSON.stringify(after)})`,
);
check(armies.land.fallen > 0, "no fallen on the field");
await shot("5-the-turn");
const goneOn = await until(
  "the land's clock going on as it went, the rout over",
  async () => {
    const c = await clock(),
      n = await inPlace();
    return c.speed === 30 * DAY && !n?.slowed && !n?.told;
  },
  slow(60000),
);
say(`after the rout: ${goneOn ? "a month a second again" : JSON.stringify(await clock())}`);

// 5. On the globe: each war's host as far along its way as its year has gone.
await k(`globalThis.causalis.client.setSpeed(0)`);
await k(`globalThis.causalis.zoomThrough("out")`);
await until("the world again", async () => (await scale()) === "globe", slow(30000));
const marching = () => k<Record<string, number>>(`globalThis.causalis.globeMarching()`);
await advance((Y + 1.5) * YEAR);
await page.waitForTimeout(slow(1000));
const m1 = await marching(),
  on = Object.entries(m1).find(([, v]) => v > 0 && v < 1);
await page.waitForTimeout(slow(1500));
const still = await marching();
await advance((Y + 1.65) * YEAR);
await page.waitForTimeout(slow(1000));
const m2 = await marching();
say(
  `on the globe: ${Object.keys(m1).length} wars in place; ${on ? `${on[0]} ${on[1].toFixed(2)} → ${m2[on[0]]?.toFixed(2)}` : "none on its way"}`,
);
check(!!on, "no host on its way on the globe");
check(!!on && still[on[0]] === on[1], "a host moved on the globe while the clock was held");
check(
  !!on && (m2[on[0]] ?? 0) > on[1],
  "a host on the globe not on along its way as its year went",
);
await shot("6-globe");

// 6. A town at war (M204), in the next year a host marches (the Earth seed's year 123 is at peace;
//    its 124 marches three): the men of the land it musters in, gathered past their town's homes
//    and then marching out by its road; before the heart of the land it marches on, the hosts drawn
//    up and fighting as the year ends, its clock slowed for it; the fallen after.
type TownWarNow = {
  ref: string;
  words: string;
  told: string;
  hosts: { side: number; doing: string; k: number; gathered: number }[];
  fight: { stage: string; k: number; key: string } | null;
  fought: { event: string; outcome: string } | null;
  siege: boolean;
  burning: number;
  soldiers: number;
  fallen: number;
  doing: string[];
  middles: ({ x: number; z: number } | null)[];
  tents: number;
  fires: number;
};
type TownRef = { ref: string; population: number };
const townWar = () => k<TownWarNow | null>(`globalThis.causalis.townWar?.() ?? null`),
  slowedNow = () =>
    k<{ slowed: string | null; told: string }>(`globalThis.causalis.battleSlowed()`),
  provinceOf = (spot: number) =>
    k<number>(`globalThis.causalis.client.latestFrame("globe").arrays.province[${spot}]`),
  townsOf = async (spot: number) =>
    (
      await k<{ towns: TownRef[] }>(
        `globalThis.causalis.client.query({ type: "towns.land", args: { cell: ${await provinceOf(spot)}, most: 0 } })`,
      )
    ).towns.filter((t) => t.population > 0),
  /** Into a town, and its war's soldiers drawn. */
  into = async (ref: string) => {
    await k(`globalThis.causalis.watch(${JSON.stringify(ref)})`);
    await until("the town come to", async () => (await scale()) === "village", slow(60000));
    await page.waitForTimeout(slow(1500));
  },
  /** Facing the middle of what its war draws. */
  faceWar = async (w: TownWarNow | null) => {
    const ms = (w?.middles ?? []).filter((m): m is { x: number; z: number } => !!m);
    if (!ms.length) return;
    const x = ms.reduce((a, m) => a + m.x, 0) / ms.length,
      z = ms.reduce((a, m) => a + m.z, 0) / ms.length;
    await k(`globalThis.causalis.faceTown(${x}, ${z}, 34)`);
    await page.waitForTimeout(slow(1200));
  };
type Marching = War & { muster?: number };
let Z = Y + 2,
  map2: { year: number; wars: Marching[] } = { year: Z, wars: [] },
  marches: Marching[] = [];
for (; Z <= Y + 8; Z++) {
  await advance((Z + 0.2) * YEAR);
  map2 = await k<{ year: number; wars: Marching[] }>(
    `globalThis.causalis.client.query({ type: "wars.map" })`,
  );
  marches = map2.wars.filter(
    (w) => w.ended === null && w.next != null && w.siege === null && w.muster != null,
  );
  if (marches.length) break;
  say(`year ${map2.year}: no host marches`);
}
check(marches.length > 0, `no war mustering in years ${Y + 2} to ${Y + 8}`);
// The muster: every town of the land its host musters in sends its men.
let mustered: TownWarNow | null = null,
  marchesOn: (War & { muster?: number }) | null = null;
for (const w of marches.slice(0, 4)) {
  const towns = await townsOf(w.muster!);
  if (!towns.length) continue;
  await into(towns[0]!.ref);
  mustered = (await comes(
    async () => (await townWar())?.hosts.some((h) => h.doing === "mustering") ?? false,
    slow(8000),
  ))
    ? await townWar()
    : null;
  if (mustered) {
    marchesOn = w;
    break;
  }
}
say(`a town mustering: ${mustered ? `“${mustered.told}”, ${mustered.soldiers} drawn` : "none"}`);
check(!!mustered && mustered.soldiers > 0, "no town's men seen mustering");
check(
  /📯/.test(mustered?.told ?? ""),
  `the muster not told under the town's bar (${mustered?.told})`,
);
await faceWar(mustered);
check(
  (await labels()).some((t) => t.startsWith("📯")),
  "the host mustering not named over it",
);
await shot("7-town-mustering");
await advance((Z + 0.34) * YEAR);
const leaving = await townWar();
say(`marching out: ${leaving?.hosts.map((h) => h.doing).join(", ")}; ${leaving?.doing.join(", ")}`);
check(
  !!leaving?.hosts.some((h) => h.doing === "leaving") && leaving.doing.includes("advance"),
  "the town's men not seen marching out by its road",
);
await faceWar(leaving);
await shot("8-town-marching-out");

// Before the heart of the land it marches on: drawn up, slowed for, engaged, and after.
let heart: string | null = null;
for (const t of marchesOn ? await townsOf(marchesOn.next!) : []) {
  const p = await k<{ life?: { heart?: boolean } }>(
    `globalThis.causalis.client.query({ type: "village.plan", args: { ref: ${JSON.stringify(t.ref)} } })`,
  );
  if (p.life?.heart) {
    heart = t.ref;
    break;
  }
}
check(!!heart, "the land marched on has no heart");
if (heart) await into(heart);
await advance((Z + 0.86) * YEAR);
const before = await townWar();
say(
  `before its heart: “${before?.told}”; ${before?.fight?.stage}; ${before?.hosts.map((h) => `${h.side ? "D" : "A"} ${h.doing}`).join(", ")}; ${before?.soldiers} drawn`,
);
check(before?.fight?.stage === "drawn", "the battle to come not drawn up before the town");
check(
  (before?.hosts.filter((h) => h.doing === "drawn").length ?? 0) === 2,
  "the two hosts not drawn up before the town",
);
await faceWar(before);
check(
  (await labels()).filter((t) => t.startsWith("🛡️")).length >= 1,
  "the hosts drawn up not named over them",
);
await shot("9-town-drawn-up");
check(await press(/^1 month/i), "no month-a-second speed in the town's bar");
const townSlowed = await until(
  "the town's clock slowed for the battle before it",
  async () => !!(await slowedNow()).slowed && (await clock()).speed === DAY,
  slow(20000),
);
const slowTold = (await slowedNow()).told;
say(`slowed: ${townSlowed} — "${slowTold}"`);
check(/the battle before/i.test(slowTold), `the town's slowing not told (${slowTold})`);
await advance((Z + 0.985) * YEAR);
const fighting = await townWar();
say(
  `engaged before it: ${fighting?.fight?.stage}; ${fighting?.fallen} fallen, ${fighting?.soldiers} fighting`,
);
check(fighting?.fight?.stage === "engaged", "the hosts not engaged before the town");
check((fighting?.fallen ?? 0) > 0, "none falls before the town");
await faceWar(fighting);
await shot("10-town-engaged");
await until(
  "the year turned before the town",
  async () => (await clockT()) >= (Z + 1) * YEAR + DAY,
  slow(90000),
);
await page.waitForTimeout(slow(1500));
const afterTown = await townWar();
say(
  `after: ${afterTown?.fought ? `${afterTown.fought.outcome}, ${afterTown.fallen} fallen where they fell` : "fought elsewhere"}; “${afterTown?.told}”`,
);
check(
  !!afterTown?.fought && afterTown.fallen > 0,
  "no fallen before the town after the battle fought there",
);
await shot("11-town-after");
await k(`globalThis.causalis.client.setSpeed(0)`);

// A siege laid, if one is: its besiegers' camp about the town.
const sieged = map2.wars.find((w) => w.ended === null && w.siege !== null);
if (sieged) {
  let at: string | null = null;
  for (const t of await townsOf(sieged.siege!)) {
    const p = await k<{ life?: { heart?: boolean } }>(
      `globalThis.causalis.client.query({ type: "village.plan", args: { ref: ${JSON.stringify(t.ref)} } })`,
    );
    if (p.life?.heart) at = t.ref;
  }
  if (at) {
    await into(at);
    const camp = await townWar();
    say(
      `a siege: ${camp?.siege ? `${camp.tents} tents, ${camp.hosts.map((h) => h.doing).join(", ")}` : `none now (${camp?.words ?? "no war"})`}`,
    );
    if (camp?.siege) {
      check(camp.tents >= 8, "the besiegers' camp not pitched about the town");
      await faceWar(camp);
      await shot("12-town-besieged");
    }
  }
} else say("a siege: none laid this year");

await browser.close();
await server.close();
if (errors.length) problems.push(...errors.map((e) => `page error: ${e}`));
if (problems.length) {
  console.log("FAILED:");
  for (const p of problems) console.log(`  - ${p}`);
  process.exit(1);
}
console.log("the Phase 40 gate passes");
