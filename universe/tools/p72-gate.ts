// node tools/p72-gate.ts [--ci] [--soft] [--shots dir] [--save file.save] [--window file.save]: gate 85, realms among the stars (galaxy-plan.md, Phase 72, first slice), at a phone's size.
// On a far save with real realms, else (as on CI) a young world given them for the eye to read:
//   1. the numbers: a world within answering stays; past it, or with no seat, it goes; what it cannot make ties it; a world cut off falls by its numbers;
//   2. the stars around, in the pixels: the colour of the greatest realm covers more than a small one's, and each is there at all;
//   3. a realm's chip pressed by touch: its page says how many, who rules, from where, how long a word takes, what holds it, what pulls it apart;
//   4. a realm come apart, pressed by touch: its colour on the map at the first frame and gone from the last, its worlds held falling; the card; the fleet film from it;
//   5. a world in the dark: its page says what it lacked and what it held and holds;
//   6. the paths nobody watches: a realm with nothing among the stars, a realm whose home world is gone, a world of no one. No error in the page, no raw ref.
//   With --window, as a person has it: windows, not cards, on a save run on until a realm's news is told; its button pressed.
import { mkdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { gunzipSync, gzipSync } from "node:zlib";
import { preview } from "vite";
import { chromium, type Page } from "playwright";
import {
  YEAR,
  loadWorld,
  makeRef,
  rulesetId,
  saveWorld,
  seedFromText,
  type Ref,
  type World,
} from "../src/kernel/index.ts";
import { ALIEN, EARTH } from "../src/host/planet.ts";
import { DARK_FLOOR, breakChance, darkLimit, strainOf, worldDefence } from "../src/rules/index.ts";
import {
  STARWAR,
  STARWAR_EVENTS,
  clusterOf,
  filledOf,
  nationsOf,
  politiesOf,
  populationContext,
  starWarsOf,
  worldNation,
  type FilledWorld,
  type Holding,
} from "../src/sim/index.ts";

const argv = process.argv.slice(2),
  soft = argv.includes("--soft"),
  ci = argv.includes("--ci"),
  arg = (name: string) => {
    const at = argv.indexOf(name);
    return at >= 0 ? argv[at + 1] : undefined;
  },
  shots = arg("--shots"),
  saveFile = arg("--save"),
  windowFile = arg("--window");
if (shots) mkdirSync(shots, { recursive: true });
const slow = (ms: number) => (ci || soft ? ms * 4 : ms);
const GPU = [
  "--enable-gpu",
  "--ignore-gpu-blocklist",
  "--use-angle=d3d11",
  "--force_high_performance_gpu",
];
const problems: string[] = [],
  check = (ok: boolean, what: string) => {
    if (!ok) problems.push(what);
  },
  say = (s: string) => console.log(`  ${s}`);
console.log("gate 85, realms among the stars");

// 1. The numbers.
{
  const near = {
      answer: 18,
      hold: 22,
      fleet: true,
      forcedAgo: null,
      lostAgo: null,
      people: 1e6,
      seatPeople: 1e7,
      owes: false,
    },
    s = strainOf(near);
  check(breakChance(s.total) === 0, `a world within answering may go: ${s.total}`);
  const far = strainOf({ ...near, answer: 66 });
  check(breakChance(far.total) > 0, "a world at three times its answering stays for ever");
  check(
    breakChance(strainOf({ ...near, answer: 66, owes: true }).total) < breakChance(far.total),
    "what it cannot make does not tie it",
  );
  const lost = strainOf({ ...near, answer: Infinity, fleet: false });
  check(breakChance(lost.total) >= 0.5, `a world with no seat to answer it stays: ${lost.total}`);
  check(strainOf({ ...near, forcedAgo: 0 }).total > s.total, "being held by force weighs nothing");
  check(strainOf({ ...near, lostAgo: 1 }).total > s.total, "a fleet lost weighs nothing");
  check(darkLimit(1000, 0) === 1000, "a world cut off today has already fallen");
  check(darkLimit(1000, 80) < 500, "a world cut off eighty years holds as many as it did");
  check(
    Math.abs(darkLimit(1000, 5000) - 1000 * DARK_FLOOR) < 1,
    "a world cut off for ever falls past its floor",
  );
  check(worldDefence(2e9) > worldDefence(2e6), "more people defend no better");
}

type Forged = {
  readonly bytes: Buffer;
  readonly universe: "earth" | "alien";
  readonly seed: string;
};

function pack(world: World, universe: "earth" | "alien"): Forged {
  const u = universe === "earth" ? EARTH : ALIEN;
  return {
    bytes: gzipSync(
      JSON.stringify(saveWorld(world, rulesetId(world, u.version), { universe: u.name })),
    ),
    universe,
    seed: world.seed.text,
  };
}

/** A young world given two realms among the stars: one great; one come apart, a fleet sent for one of its worlds, some of them in the dark. */
function forgeYoung(): Forged {
  const world = EARTH.build(seedFromText("first light"));
  world.runTo(40 * YEAR);
  const realms = politiesOf(world).living(),
    a = realms[0]!,
    b = realms[1] ?? realms[0]!,
    filled = filledOf(world)!,
    store = nationsOf(world)!,
    any = world.events.at(0).id as Ref,
    stars = clusterOf(world).slice(0, 30);
  stars.forEach((star, i) => {
    const realm = i % 3 === 2 ? b : a,
      key = `${star.ref}/0`,
      w: FilledWorld = {
        key,
        body: -1,
        star: star.ref,
        planet: 0,
        cell: null,
        realm: realm.ref,
        name: realm.town,
        from: realm.seat,
        sailed: 5,
        arrives: 15,
        distance: star.distance,
        drive: "fusion",
        lanes: 0,
        comers: 0,
        held: null,
        voyage: any,
        arrived: any,
        people: 2_000_000 + 100_000 * i,
        filled: null,
        filledYear: null,
      };
    filled.add(w);
    const gone = realm === b && i > 2,
      h: Holding = {
        key,
        star: star.ref,
        planet: 0,
        cell: null,
        index: i,
        holder: gone ? null : realm.ref,
        how: gone ? "own" : i % 4 === 0 ? "taken" : i % 4 === 1 ? "joined" : "sent",
        since: 20,
        event: any,
        ...(gone ? { left: { from: realm.ref, year: 25 + i / 3, event: any } } : {}),
        ...(gone && i % 2
          ? { dark: { since: 28, before: 3_000_000, event: any, poor: i % 4 === 1 } }
          : {}),
        ...(gone ? { own: { drive: "fusion", lanes: false } } : {}),
      };
    store.add(h);
  });
  store.addNation({
    ref: a.ref,
    realm: a.ref,
    name: a.town,
    seat: null,
    founded: 15,
    event: null,
    worlds: 20,
    greatest: 20,
    greatestYear: 21,
    lostFleet: 36,
    lost: [],
    fell: null,
  });
  if (b !== a)
    store.addNation({
      ref: b.ref,
      realm: b.ref,
      name: b.town,
      seat: null,
      founded: 15,
      event: null,
      worlds: 1,
      greatest: 10,
      greatestYear: 22,
      lostFleet: null,
      lost: store
        .all()
        .filter((h) => h.left)
        .map((h) => [h.index, h.left!.year, 2_000_000, 20]),
      fell: { year: 36, event: any },
    });
  const taken = store.all().find((h) => h.left)!,
    battle = world.events.emit({
      type: STARWAR_EVENTS.battle.type,
      subjects: [b.ref, worldNation(taken.index)],
      place: null,
      causes: [{ ref: any, role: "trigger", weight: 1 }],
      data: { won: false, strength: 3, defence: 5.2, year: 38 },
    });
  starWarsOf(world).add({
    ref: makeRef(STARWAR, 0, starWarsOf(world).all().length),
    realm: b.ref,
    enemy: worldNation(taken.index),
    declared: 30,
    event: any,
    sailed: 30,
    arrives: 38,
    strength: 3,
    battle,
    won: false,
    ended: any,
    at: { key: taken.key, star: taken.star, planet: taken.planet },
  });
  void populationContext(world);
  return pack(world, "earth");
}

function fromFile(file: string): Forged {
  const universe = file.includes("earth--") ? "earth" : "alien",
    u = universe === "earth" ? EARTH : ALIEN,
    doc = JSON.parse(gunzipSync(readFileSync(file)).toString("utf8")) as Parameters<
      typeof loadWorld
    >[0],
    probe = u.build(seedFromText(doc.seed)),
    world = loadWorld(doc, (s) => u.build(s), rulesetId(probe, u.version), {
      allowRulesetChange: true,
    }).world;
  world.runTo(world.now + YEAR);
  return pack(world, universe);
}

const made = saveFile ? fromFile(saveFile) : forgeYoung();

const root = fileURLToPath(new URL("..", import.meta.url)),
  server = await preview({ root, logLevel: "silent", preview: { port: 4285, strictPort: false } }),
  base = server.resolvedUrls!.local[0]!,
  browser = await chromium.launch({
    args: soft ? ["--use-angle=swiftshader", "--enable-unsafe-swiftshader"] : ci ? [] : GPU,
  });
const context = await browser.newContext({
    viewport: { width: 430, height: 932 },
    deviceScaleFactor: ci || soft ? 1 : 2,
    hasTouch: true,
    isMobile: true,
  }),
  page: Page = await context.newPage(),
  errors: string[] = [];
page.setDefaultTimeout(slow(60000));
page.on("pageerror", (e) => errors.push(`${e.message}\n${e.stack ?? ""}`));
page.on("console", (m) => {
  if (m.type() === "error") errors.push(m.text());
});
const k = <T>(code: string): Promise<T> => page.evaluate(code) as Promise<T>;
const until = async (what: string, ok: () => Promise<boolean>, ms = slow(25000)) => {
  const end = Date.now() + ms;
  while (Date.now() < end) {
    if (await ok().catch(() => false)) return true;
    await page.waitForTimeout(80);
  }
  problems.push(`${what} did not come`);
  return false;
};
const settleFor = (ms: number) => page.waitForTimeout(slow(ms));
const shot = async (name: string) => {
  if (shots) await page.screenshot({ path: join(shots, `${name}.png`) });
};
const ask = <T>(type: string, args: unknown = {}) =>
  k<T>(
    `globalThis.causalis.client.query({ type: ${JSON.stringify(type)}, args: ${JSON.stringify(args)} })`,
  );

async function loadSave(f: Forged, tail = "&hold=1") {
  const name = `${f.universe}:gate85`,
    q = `universe=${f.universe}&seed=${encodeURIComponent(f.seed)}`;
  await page.goto(`${base}?${q}&hold=1`);
  await page.waitForFunction(
    () => !!(globalThis as { causalis?: { client?: unknown } }).causalis?.client,
    undefined,
    { timeout: slow(120000) },
  );
  await page.waitForFunction(
    () => ((globalThis as { causalis?: { drawn?: () => number } }).causalis?.drawn?.() ?? 0) > 0,
    undefined,
    { timeout: slow(180000) },
  );
  await page.evaluate(
    async ([data, keep]) => {
      const bytes = Uint8Array.from(atob(data as string), (c) => c.charCodeAt(0));
      const c = (
        globalThis as unknown as {
          causalis: {
            client: {
              importSave(b: Uint8Array): Promise<unknown>;
              save(n: string): Promise<unknown>;
            };
          };
        }
      ).causalis.client;
      await c.importSave(bytes);
      await c.save(keep as string);
    },
    [f.bytes.toString("base64"), name],
  );
  await page.goto(`${base}?${q}&load=${encodeURIComponent(name)}${tail}`);
  await page.waitForFunction(
    () => ((globalThis as { causalis?: { drawn?: () => number } }).causalis?.drawn?.() ?? 0) > 0,
    undefined,
    { timeout: slow(180000) },
  );
  await k("globalThis.causalis.client.setSpeed(0)");
}

async function press(selector: string): Promise<boolean> {
  const at = await k<{ x: number; y: number } | null>(`(() => {
    for (const e of document.querySelectorAll(${JSON.stringify(selector)})) {
      e.scrollIntoView({ block: "center" });
      const r = e.getBoundingClientRect();
      if (r.width > 0 && r.height > 0) return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
    }
    return null;
  })()`);
  if (!at) {
    problems.push(`nothing to press at ${selector}`);
    return false;
  }
  await page.waitForTimeout(slow(150));
  await page.touchscreen.tap(at.x, at.y);
  await page.waitForTimeout(slow(350));
  say(`pressed ${selector} at ${Math.round(at.x)},${Math.round(at.y)}`);
  return true;
}

/** How much of a shot is this colour, flat. */
async function colorShare(d: string, rgb: readonly [number, number, number]): Promise<number> {
  return page.evaluate(
    async ([data, want]) => {
      const bm = await createImageBitmap(
          await (await fetch(`data:image/png;base64,${data as string}`)).blob(),
        ),
        c = new OffscreenCanvas(bm.width, bm.height),
        x = c.getContext("2d")!;
      x.drawImage(bm, 0, 0);
      const w = want as readonly number[],
        // (The map alone: not the bars, nor the legend's swatches.)
        top = Math.round(bm.height * 0.13),
        h = Math.round(bm.height * 0.72),
        px = x.getImageData(0, top, bm.width, h).data;
      let n = 0;
      for (let i = 0; i < px.length; i += 4) {
        // (A disc is its colour flat; a star's dot of the same hue is not.)
        if (
          Math.abs(px[i]! / 255 - w[0]!) +
            Math.abs(px[i + 1]! / 255 - w[1]!) +
            Math.abs(px[i + 2]! / 255 - w[2]!) <
          0.14
        )
          n++;
      }
      return n / (px.length / 4);
    },
    [d, [...rgb]] as const,
  );
}

async function unlike(a: string, b: string): Promise<number> {
  return page.evaluate(
    async ([a, b]) => {
      const load = async (d: string) => {
          const bm = await createImageBitmap(
              await (await fetch(`data:image/png;base64,${d}`)).blob(),
            ),
            c = new OffscreenCanvas(bm.width, bm.height),
            x = c.getContext("2d")!;
          x.drawImage(bm, 0, 0);
          return { x, w: bm.width, h: bm.height };
        },
        A = await load(a as string),
        B = await load(b as string),
        pa = A.x.getImageData(0, 0, A.w, A.h).data,
        pb = B.x.getImageData(0, 0, A.w, A.h).data;
      let n = 0;
      for (let i = 0; i < pa.length; i += 4)
        if (
          Math.abs(pa[i]! - pb[i]!) +
            Math.abs(pa[i + 1]! - pb[i + 1]!) +
            Math.abs(pa[i + 2]! - pb[i + 2]!) >
          60
        )
          n++;
      return n / (pa.length / 4);
    },
    [a, b] as const,
  );
}

type Row = {
  ref: string;
  name: string;
  color: [number, number, number];
  worlds: number;
  people: number;
  greatest: number;
  word: string;
};
type TheMap = {
  year: number;
  nations: Row[];
  stars: { star: string; nation: number; seat: boolean; dark: boolean }[];
  fallen: string | null;
};
const png = async () => (await page.screenshot()).toString("base64");
const pageWords = () => k<string>(`document.body.innerText`);
const closePage = () => k("globalThis.causalis.closePage?.()");
const rawRef = /\b(?:pol|snat|swar|ev|star):\d+:\d+/;

await loadSave(made);
await settleFor(1200);
// 2. The stars around.
await k("globalThis.causalis.stars()");
await until("the stars drawn held", () =>
  k<boolean>(`(globalThis.causalis.nationsShown?.() ?? 0) > 0`),
);
await settleFor(2500);
// (The map itself, its panel put away: a person shuts it to look.)
await press(".panel:not([hidden]) .inspector .close");
await settleFor(800);
await shot("stars");
const map = await ask<TheMap>("nation.map");
say(
  `year ${map.year}: ${map.stars.length} worlds, ${map.nations.length} realms: ${map.nations
    .slice(0, 5)
    .map((n) => `${n.name} ${n.worlds} (${n.word})`)
    .join(
      ", ",
    )}; ${map.stars.filter((s) => s.nation < 0).length} of no one, ${map.stars.filter((s) => s.dark).length} in the dark`,
);
check(map.nations.length >= 2, "fewer than two realms among the stars");
const top = map.nations[0]!,
  // (The least of those marked plainly: those past them are faint and small, and their colour no sure measure.)
  least = map.nations[Math.min(9, map.nations.length - 1)]!,
  seen = await png(),
  aShare = await colorShare(seen, top.color),
  bShare = await colorShare(seen, least.color);
say(
  `${top.name}, ${top.worlds} worlds: ${(aShare * 100).toFixed(2)}% of the map; ${least.name}, ${least.worlds}: ${(bShare * 100).toFixed(2)}%`,
);
check(aShare > 0.002, `the greatest realm's colour is ${(aShare * 100).toFixed(2)}% of the map`);
if (top.worlds >= least.worlds * 2.5 && Math.abs(hueOf(top.color) - hueOf(least.color)) > 40)
  check(aShare > bShare * 1.5, "the greatest realm covers no more of the map than a small one");
function hueOf(c: readonly number[]): number {
  const [r, g, b] = c as [number, number, number],
    M = Math.max(r, g, b),
    d = M - Math.min(r, g, b);
  if (d < 1e-6) return 0;
  return (M === r ? ((g - b) / d + 6) % 6 : M === g ? (b - r) / d + 2 : (r - g) / d + 4) * 60;
}
// 3. A realm's chip, by touch.
{
  await until("the chips", () => k<boolean>(`!!document.querySelector(".nation-chip")`));
  await press(`.nation-chip[data-ref="${top.ref}"]`);
  await until("the realm's page", () =>
    k<boolean>(
      `/among the stars/i.test(document.body.innerText) && /Ruled from/i.test(document.body.innerText)`,
    ),
  );
  await settleFor(600);
  await shot("realm-page");
  const said = await pageWords();
  for (const [word, what] of [
    [/Worlds/i, "how many worlds"],
    [/People/i, "how many people"],
    [/Ruled from/i, "from where"],
    [/Who rules/i, "who rules"],
    [/Word and fleet across it/i, "how long a word takes"],
    [/What holds it together|What is pulling it apart/i, "what holds it or pulls it"],
  ] as const)
    check(word.test(said), `the realm's page does not say ${what}`);
  check(!rawRef.test(said), `a raw ref on the realm's page: ${rawRef.exec(said)?.[0]}`);
  await closePage();
}
// 4. A realm come apart, by touch.
const fallenRef = map.fallen;
check(!!fallenRef, "no realm has come apart here");
if (fallenRef) {
  await k(
    `globalThis.causalis.open(${JSON.stringify(fallenRef.startsWith("snat:") ? fallenRef : `nation:${fallenRef}`)})`,
  );
  await until("the fallen realm's page", () =>
    k<boolean>(`/Gone their own way/i.test(document.body.innerText)`),
  );
  await settleFor(500);
  await shot("fallen-page");
  const fallenSaid = await pageWords();
  check(/Fallen in year/.test(fallenSaid), "a fallen realm's page does not say so");
  check(
    !rawRef.test(fallenSaid),
    `a raw ref on the fallen realm's page: ${rawRef.exec(fallenSaid)?.[0]}`,
  );
  const plan = await ask<{
    color: [number, number, number];
    name: string;
    worlds: { left: number | null }[];
    fleet: string | null;
    from: number;
    to: number;
    lost: string[];
  }>("nation.fall", { ref: fallenRef });
  say(
    `${plan.name}: ${plan.worlds.length} worlds to play, ${plan.from} to ${plan.to}; ${plan.lost.length} told lost; fleet ${plan.fleet}`,
  );
  await press(".nation-watch");
  await until("the film", () => k<boolean>(`!!globalThis.causalis.nationFilm?.playing`));
  await settleFor(250);
  const first = await k<{ held: number; year: number }>("globalThis.causalis.nationFilm.state()"),
    earlyShot = await png();
  await shot("fall-early");
  let last = first;
  await until(
    "the card after its coming apart",
    async () => {
      last = await k<{ held: number; year: number; card: boolean } & typeof first>(
        "globalThis.causalis.nationFilm.state()",
      );
      return (last as unknown as { card: boolean }).card;
    },
    slow(50000),
  );
  await settleFor(200);
  await shot("fall-card");
  const cardWords = await pageWords();
  check(/held|went/.test(cardWords), "the card does not say what became of it");
  // (The map under the card: put away to look.)
  await k(`document.querySelector(".nation-card").style.visibility = "hidden"`);
  await settleFor(400);
  const lateShot = await png();
  await shot("fall-late");
  await k(`document.querySelector(".nation-card").style.visibility = ""`);
  const before = await colorShare(earlyShot, plan.color),
    after = await colorShare(lateShot, plan.color),
    apart = await unlike(earlyShot, lateShot);
  say(
    `film: ${first.held} worlds in ${first.year}, ${last.held} in ${last.year}; its colour ${(before * 100).toFixed(2)}% then, ${(after * 100).toFixed(2)}% after; ${(apart * 100).toFixed(1)}% of the screen differs`,
  );
  check(first.held >= 3, `the film begins with ${first.held} worlds held`);
  check(last.held <= 1, `the film ends with ${last.held} worlds held`);
  check(before > 0.001, `its colour is ${(before * 100).toFixed(2)}% of the map at its height`);
  check(
    after < before * 0.4,
    `its colour is ${(after * 100).toFixed(2)}% after it fell, against ${(before * 100).toFixed(2)}%`,
  );
  check(apart > 0.002, `only ${(apart * 100).toFixed(2)}% of the screen differs after it fell`);
  if (plan.fleet) {
    await press(".nation-fleet");
    await until(
      "the fleet's film",
      () => k<boolean>(`!!globalThis.causalis.fleetFilm?.playing`),
      slow(60000),
    );
    await settleFor(5000);
    await shot("fleet");
    await k("globalThis.causalis.fleetFilm?.skip?.()");
    await settleFor(500);
    await k("globalThis.causalis.fleetFilm?.skip?.()");
    await until(
      "the fleet's film over",
      () => k<boolean>(`!globalThis.causalis.fleetFilm?.playing`),
      slow(30000),
    );
  } else {
    say("no fleet went for one of this realm's worlds");
    await press(".nation-close");
  }
  await closePage();
}
// 5. A world in the dark.
{
  const rows = await k<string | null>(`globalThis.causalis.client
    .query({ type: "nation.dark" }).catch(() => null)`);
  check(!!rows, "no world in the dark to read");
  if (rows) {
    await k(`globalThis.causalis.open(${JSON.stringify(rows)})`);
    await until("a world in the dark", () =>
      k<boolean>(`/Its dark age/i.test(document.body.innerText)`),
    );
    await settleFor(500);
    await k(
      `[...document.querySelectorAll(".page-body *, .page *")].filter((e) => /Its dark age/i.test(e.textContent ?? "")).pop()?.scrollIntoView({ block: "start" })`,
    );
    await settleFor(300);
    await shot("dark-world");
    const said = await pageWords();
    check(
      /when it was cut off in year/.test(said),
      "a world in the dark does not say what it held",
    );
    check(/no one brings them/.test(said), "a world in the dark does not say what it lacks");
    check(!rawRef.test(said), `a raw ref on a dark world's page: ${rawRef.exec(said)?.[0]}`);
    await closePage();
  }
}
// 6. The paths nobody watches.
{
  // A realm with nothing among the stars.
  const none = await k<string | null>(
    `globalThis.causalis.client.query({ type: "nation.none" }).catch(() => null)`,
  );
  if (none) {
    await k(`globalThis.causalis.open(${JSON.stringify(`nation:${none}`)})`);
    await until("a realm with nothing among the stars", () =>
      k<boolean>(`/nothing among the stars/i.test(document.body.innerText)`),
    );
    await settleFor(300);
    await shot("no-worlds");
    const said = await pageWords();
    check(!rawRef.test(said), `a raw ref on a realm with no worlds: ${rawRef.exec(said)?.[0]}`);
    await closePage();
  } else say("every realm here has held a world");
  // A world of no one, and not in the dark: its page says so.
  const free = await k<string | null>(
    `globalThis.causalis.client.query({ type: "nation.free" }).catch(() => null)`,
  );
  if (free) {
    await k(`globalThis.causalis.open(${JSON.stringify(free)})`);
    await until("a world no one holds", () =>
      k<boolean>(`/No one holds it/i.test(document.body.innerText)`),
    );
    await settleFor(800);
    await shot("free-world");
    const said = await pageWords();
    check(!rawRef.test(said), `a raw ref on a world no one holds: ${rawRef.exec(said)?.[0]}`);
    await closePage();
  } else say("every world here has someone holding it, or is in the dark");
  await k(`globalThis.causalis.open("world:nations")`);
  await until("who holds the stars", () =>
    k<boolean>(`/Who holds the stars/i.test(document.body.innerText)`),
  );
  await settleFor(400);
  await shot("nations-page");
  const said = await pageWords();
  check(!rawRef.test(said), `a raw ref on the page of all realms: ${rawRef.exec(said)?.[0]}`);
  await closePage();
}
// As a person has it: windows, not cards.
if (windowFile) {
  const f = fromFile(windowFile);
  await page.addInitScript(() => {
    try {
      localStorage.setItem("causalis.events", "window");
    } catch {
      /* (a private window) */
    }
  });
  await loadSave(f, "&hold=1");
  await settleFor(800);
  await k(`globalThis.causalis.client.setSpeed(${YEAR})`);
  const end = Date.now() + 6 * 60000;
  let told = "";
  while (Date.now() < end && !told) {
    await page.waitForTimeout(400);
    const open = await k<boolean>(`!document.querySelector(".event-window").hidden`);
    if (!open) {
      await k(`globalThis.causalis.client.setSpeed(${YEAR})`);
      continue;
    }
    await page.waitForTimeout(600);
    const has = await k<boolean>(`!!document.querySelector(".event-window .event-nation")`);
    if (has) {
      told = (await k<string>(`document.querySelector(".event-window").textContent`)).slice(0, 240);
      await shot("window");
      break;
    }
    await page.locator(".event-window .event-be").first().tap();
    await page.waitForTimeout(250);
  }
  say(`the window: ${told}`);
  check(!!told, "no window told of a realm among the stars");
  if (told) {
    await press(".event-window .event-nation");
    await settleFor(2500);
    await shot("window-pressed");
    const seenThere = await k<{ film: boolean; page: boolean; held: number | null }>(`({
      film: !!globalThis.causalis.nationFilm?.playing,
      page: /Its dark age|Who holds it/i.test(document.body.innerText),
      held: globalThis.causalis.nationsShown?.() ?? null,
    })`);
    say(`pressed: ${JSON.stringify(seenThere)}`);
    check(
      seenThere.film || seenThere.page || (seenThere.held ?? 0) > 0,
      "the window's button shows nothing",
    );
  }
}
if (errors.length) problems.push(`errors on the page:\n${errors.slice(0, 5).join("\n")}`);
await browser.close();
await server.close();
if (problems.length) {
  console.log(`gate 85 FAILED:\n- ${problems.join("\n- ")}`);
  process.exitCode = 1;
} else console.log("gate 85 passed");
process.exit();
