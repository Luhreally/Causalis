// node tools/w6-gate.ts [--ci] [--soft] [--shots dir] [--far file.save] [--seed s --universe u]: gate 83, arms past the greatest fire (war-reach-plan.md W6), at a
// phone's size. The paths nobody watches go first: what a world's numbers ask and no one commands, the page that says why; and a world after its unmaking, in every view that names it.
//   1. the numbers: a sky and a world by their own mass and size; a hull's speed; each rung rarer; a first of a rung deepening the dread;
//   2. a world no one can touch: its panel sets the two numbers side by side, its principle's page goes past it;
//   3. the god's hand, by touch: a world whole, its seams opening (pixels), its plates going, its light out; rubble and a card; then the world's view, its star, the map, the galaxy, its page, its colony's row, all changed and staying changed through years and a save;
//   4. a ruler played, by touch: a fleet a year out, the window, the word; history's own year brings it; a sky burned, its film, the world under it dark.
// Everything seen is looked for in the pixels: a list count is not a sight.
import { mkdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { gunzipSync, gzipSync } from "node:zlib";
import { preview } from "vite";
import { chromium } from "playwright";
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
import {
  FAR,
  G,
  chanceOfRung,
  cruise,
  dreadAfter,
  hullMj,
  principle,
  rungOf,
  skyMj,
  starDriveFor,
  unmakeMj,
  type Principle,
} from "../src/rules/index.ts";
import {
  STARWAR,
  civilizationsNear,
  clusterOf,
  contactsOf,
  loreOf,
  politiesOf,
  populationContext,
  starSitesOf,
  starWarsOf,
  worldsOf,
  type MarketStore,
} from "../src/sim/index.ts";

const argv = process.argv.slice(2),
  soft = argv.includes("--soft"),
  ci = argv.includes("--ci"),
  arg = (name: string) => {
    const at = argv.indexOf(name);
    return at >= 0 ? argv[at + 1] : undefined;
  },
  shots = arg("--shots");
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
console.log("gate 83, arms past the greatest fire");

// 1. The numbers: pure.
{
  const earth = { pull: 1, radius: 1, airBar: 1 },
    sky = skyMj(earth),
    world = unmakeMj(earth),
    great = hullMj(0.3),
    fusion = hullMj(0.02 * Math.log(10)),
    d = { desperation: 0.8, valour: 0.5, fear: 0, dread: 0 };
  say(
    `Earth's sky ${sky.toExponential(1)} MJ, its binding energy ${world.toExponential(1)} MJ; a fleet at 0.3 c ${great.toExponential(1)} MJ, at a fusion drive's ${fusion.toExponential(1)} MJ`,
  );
  check(sky > 1e17 && sky < 1e18, `Earth's sky takes ${sky} MJ`);
  check(great > sky, "a fleet at the highest drive's cruise does not reach a sky like Earth's");
  check(fusion < sky, "a fusion drive's fleet reaches a sky like Earth's");
  check(world / great > 1e7, "a fleet's speed comes near to unmaking a world");
  check(
    !Number.isFinite(skyMj({ pull: 1, radius: 1, airBar: 0 })),
    "a world with no air has a sky to burn",
  );
  const c = { fireMj: 0, hullMj: great, lightMj: 0, works: false };
  check(rungOf(c, earth) === "sky", "a great fleet reads no sky");
  check(
    rungOf({ ...c, hullMj: fusion }, earth) === null,
    "a fusion fleet with no fire reads a rung",
  );
  check(
    rungOf({ ...c, hullMj: fusion, fireMj: 1 }, earth) === "carried",
    "a fire and a drive read no rung",
  );
  check(
    rungOf({ ...c, lightMj: world * 2 }, earth) === "sky",
    "a star's light counts before its works are done",
  );
  check(
    rungOf({ ...c, lightMj: world * 2, works: true }, earth) === "world",
    "a star's light at its need reads no world",
  );
  const a = chanceOfRung("carried", d),
    b = chanceOfRung("sky", d),
    e = chanceOfRung("world", d);
  say(
    `the chance at a fleet's worst odds: carried ${a.toFixed(4)}, sky ${b.toFixed(4)}, world ${e.toFixed(5)}`,
  );
  check(a > b && b > e && e < 0.001, "each rung is not rarer than the last");
  check(
    dreadAfter("world", 0.1, true) > dreadAfter("sky", 0.1, true),
    "a first world unmade sets less dread than a sky",
  );
  check(
    chanceOfRung("sky", { ...d, dread: FAR.dread.sky }) < b / 10,
    "a first of a rung does not change what rulers will do",
  );
}

const uOf = (name: string) => (name === "earth" ? EARTH : ALIEN);
const loaded = (name: string, file: string): World => {
  const u = uOf(name),
    doc = JSON.parse(gunzipSync(readFileSync(file)).toString("utf8")) as Parameters<
      typeof loadWorld
    >[0];
  return loadWorld(doc, (s) => u.build(s), rulesetId(u.build(seedFromText(doc.seed)), u.version), {
    allowRulesetChange: true,
  }).world;
};

type Forged = {
  readonly bytes: Buffer;
  readonly universe: string;
  readonly seed: string;
  readonly t: number;
  /** A world for the god's hand, one for the fleet, its realm, and a world no one can touch. */
  readonly god: { star: string; planet: number; hall: boolean };
  readonly holder: string;
  readonly target: { star: string; planet: number };
  readonly war: string;
  /** Who live on that world; and a world for the least of it. */
  readonly civ: string;
  readonly least: { star: string; planet: number };
};

/** A world taken up: the fleet's realm given what it takes and a war a year from coming in, what follows being history's own year. */
function forge(universe: string, seed: string, year: number, file?: string): Forged {
  const u = uOf(universe),
    started = performance.now(),
    world = file ? loaded(universe, file) : u.build(seedFromText(seed));
  if (!file) world.runTo(year * YEAR);
  const y = Math.floor(world.now / YEAR),
    realms = politiesOf(world),
    living = [...realms.living()].sort((a, b) => b.members.length - a.members.length),
    holder = living[0]!,
    lore = loreOf(world),
    told = lore.get(holder.seat, "writing")?.event ?? holder.event,
    numbersOf = (star: string, planet: number) => {
      const s = clusterOf(world).find((x) => x.ref === star)!,
        p = worldsOf(world, s)[planet]!;
      return { pull: p.gravity, radius: p.radius, airBar: p.pressure, kind: p.kind };
    };
  for (const id of ["antimatter-drive"])
    if (!lore.get(holder.seat, id))
      lore.learn(holder.seat, id, { year: y, event: told }, principle(id) as Principle);
  const drive = starDriveFor((id) => !!lore.get(holder.seat, id))!,
    hull = hullMj(cruise(drive));
  // A people who has sailed, whose world's sky that fleet reaches and no more.
  const civ = civilizationsNear(world)
    .filter((c) => c.stars <= y)
    .find((c) => {
      const n = numbersOf(c.star, c.planet);
      return n.airBar > 0 && hull >= skyMj(n) && hull < unmakeMj(n);
    });
  if (!civ)
    throw new Error(`no people of the stars by year ${y} on ${seed} whose sky a fleet reaches`);
  if (!contactsOf(world).of(civ.ref))
    contactsOf(world).add({ civ: civ.ref, heard: told, by: holder.ref, year: y });
  const wars = starWarsOf(world),
    ref = makeRef(STARWAR, 0, wars.all().length);
  wars.add({
    ref,
    realm: holder.ref,
    enemy: civ.ref,
    declared: y,
    event: told,
    sailed: y,
    // (It comes in two turns of the year on: the next brings the brink, the one after the word.)
    arrives: y + 2,
    // (Its odds read badly, as a fleet a long way from anything does.)
    strength: 0.1,
    battle: null,
    won: null,
    ended: null,
  });
  const markets = world.store<MarketStore>("economy.markets");
  for (const c of holder.members) {
    const m = markets.of(c);
    m.stock[G.machines] = Math.max(m.stock[G.machines]!, 1e6);
  }
  // A colony's world for the god's hand where one stands: else a world of a star near by, rock with some air.
  const ctx = populationContext(world),
    site =
      starSitesOf(world)
        ?.all()
        .find(
          ([c, s]) =>
            !!s.arrived && s.star !== civ.star && (ctx.provinces.get(c)?.total() ?? 0) > 0,
        ) ?? null;
  let god = site ? { star: site[1].star as string, planet: site[1].planet, hall: true } : null;
  if (!god)
    for (const s of clusterOf(world)) {
      if (s.ref === civ.star) continue;
      const i = worldsOf(world, s).findIndex((p) => p.kind === "rocky" && p.pressure > 0.1);
      if (i >= 0) {
        god = { star: s.ref as string, planet: i, hall: false };
        break;
      }
    }
  let least: { star: string; planet: number } | null = null;
  for (const s of clusterOf(world)) {
    if (s.ref === civ.star || s.ref === god?.star) continue;
    const i = worldsOf(world, s).findIndex((p) => p.kind === "rocky" && p.pressure > 0.1);
    if (i >= 0) {
      least = { star: s.ref as string, planet: i };
      break;
    }
  }
  const bytes = gzipSync(
    JSON.stringify(saveWorld(world, rulesetId(world, u.version), { universe: u.name })),
  );
  say(
    `${seed}: year ${y}: ${holder.ref} sends a fleet to ${civ.star}/${civ.planet}, ${god?.hall ? "a colony's" : "a bare"} world ${god?.star}/${god?.planet} for the god's hand; made in ${((performance.now() - started) / 1000).toFixed(0)} s`,
  );
  return {
    bytes,
    universe,
    seed,
    t: world.now,
    god: god!,
    holder: holder.ref,
    target: { star: civ.star as string, planet: civ.planet },
    war: ref,
    civ: civ.ref as string,
    least: least!,
  };
}

const root = fileURLToPath(new URL("..", import.meta.url)),
  server = await preview({ root, logLevel: "silent", preview: { port: 4283, strictPort: false } }),
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
  page = await context.newPage(),
  errors: string[] = [];
page.setDefaultTimeout(slow(60000));
page.on("pageerror", (e) => errors.push(`${e.message}\n${e.stack ?? ""}`));
page.on("console", (m) => {
  if (m.type() === "error") errors.push(m.text());
});
const k = <T>(code: string): Promise<T> => page.evaluate(code) as Promise<T>;
const ask = <T>(type: string, args: unknown = {}) =>
  k<T>(
    `globalThis.causalis.client.query({ type: ${JSON.stringify(type)}, args: ${JSON.stringify(args)} })`,
  );
const shot = async (name: string) => {
  if (shots) await page.screenshot({ path: join(shots, `${name}.png`) });
};
const until = async (what: string, ok: () => Promise<boolean>, ms = slow(60000)) => {
  const end = Date.now() + ms;
  while (Date.now() < end) {
    if (await ok().catch(() => false)) return true;
    await page.waitForTimeout(60);
  }
  problems.push(`${what} did not come`);
  return false;
};
const settle = (ms: number) => page.waitForTimeout(slow(ms));
const seen = (sel: string) =>
  k<boolean>(
    `[...document.querySelectorAll(${JSON.stringify(sel)})].some((e) => e.offsetParent !== null || e.getClientRects().length > 0)`,
  );
const advanceTo = async (t: number) => {
  await k(`globalThis.causalis.client.advance(${Math.round(t)})`);
  await until(`the clock at ${t}`, async () =>
    k<boolean>(`globalThis.causalis.client.status.t >= ${Math.round(t)} - 1`),
  );
};
const pageWords = async (ref: string) => JSON.stringify(await ask<unknown>("page", { ref }));

/** Of the screen's middle: how much is hot (fire's colours), red, bright, and how bright on the whole; and how much differs from an earlier shot. */
async function read(before?: string): Promise<{
  hot: number;
  red: number;
  white: number;
  mean: number;
  dark: number;
  changed: number;
  data: string;
}> {
  const data = (await page.screenshot()).toString("base64"),
    r = await page.evaluate(
      async ([a, b]) => {
        const load = async (s: string) => {
          const bitmap = await createImageBitmap(
              await (await fetch(`data:image/png;base64,${s}`)).blob(),
            ),
            c = new OffscreenCanvas(bitmap.width, bitmap.height),
            x = c.getContext("2d")!;
          x.drawImage(bitmap, 0, 0);
          return {
            d: x.getImageData(0, 0, bitmap.width, bitmap.height).data,
            w: bitmap.width,
            h: bitmap.height,
          };
        };
        const q = await load(a!),
          p = b ? await load(b) : null;
        let hot = 0,
          red = 0,
          white = 0,
          dark = 0,
          sum = 0,
          changed = 0,
          n = 0;
        for (let y = Math.floor(q.h * 0.12); y < q.h * 0.72; y += 3)
          for (let i = 0; i < q.w; i += 3) {
            const o = (y * q.w + i) * 4,
              R = q.d[o]!,
              G2 = q.d[o + 1]!,
              B = q.d[o + 2]!,
              l = R * 0.3 + G2 * 0.59 + B * 0.11;
            n++;
            sum += l;
            if (R > 190 && G2 < 150 && B < 90 && R > G2 * 1.5) hot++;
            if (R > 110 && G2 < 80 && B < 80) red++;
            if (l > 225) white++;
            if (l < 26) dark++;
            if (
              p &&
              Math.abs(p.d[o]! - R) + Math.abs(p.d[o + 1]! - G2) + Math.abs(p.d[o + 2]! - B) > 60
            )
              changed++;
          }
        return {
          hot: hot / n,
          red: red / n,
          white: white / n,
          dark: dark / n,
          mean: sum / n,
          changed: changed / n,
        };
      },
      [data, before ?? null] as const,
    );
  return { ...r, data };
}

const pct = (x: number) => `${(x * 100).toFixed(1)}%`;
const filmState = () =>
  k<{ stage: string | null; k: number; card: boolean; words: string; rung: string | null }>(
    "globalThis.causalis.farFilm.state()",
  );
const atStage = (name: string, at: number) =>
  until(
    `the film at ${name} ${at}`,
    async () => {
      const s = await filmState();
      return s.stage === name && s.k >= at;
    },
    slow(90000),
  );

/** A world as the page takes it up. */
async function takeUp(f: Forged): Promise<void> {
  const name = `${f.universe}:gate83`,
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
      const bytes = Uint8Array.from(atob(data as string), (c) => c.charCodeAt(0)),
        c = (
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
  await page.goto(`${base}?${q}&load=${encodeURIComponent(name)}&hold=1`);
  await page.waitForFunction(
    () => ((globalThis as { causalis?: { drawn?: () => number } }).causalis?.drawn?.() ?? 0) > 0,
    undefined,
    { timeout: slow(180000) },
  );
  await k("globalThis.causalis.client.setSpeed(0)");
}

async function run(f: Forged): Promise<void> {
  await takeUp(f);
  // 2. A world no one can touch: both numbers on its panel, and what anyone commands against them.
  await k(`globalThis.causalis.seeWorld(${JSON.stringify(f.god.star)}, ${f.god.planet})`);
  await until("the world's panel", () => seen(".far-reach"), slow(30000));
  await settle(1200);
  const words = await k<string[]>(
    `[...document.querySelectorAll(".far-reach")].map((e) => e.textContent)`,
  );
  say(`its panel: ${words.join(" ")}`);
  check(
    words.some((w) => /To unmake it, its binding energy/.test(w ?? "")),
    "the panel does not say what would unmake it",
  );
  check(
    words.some((w) => /The most anyone commands|No people anywhere/.test(w ?? "")),
    "the panel does not set what anyone commands beside it",
  );
  check(
    words.some((w) => /one part in/.test(w ?? "")),
    "the panel does not say how far short the nearest falls",
  );
  await shot("1-world-panel");
  const prin = await pageWords("prin:greatest-fire");
  check(
    /Past it/.test(prin) && /binding energy/.test(prin),
    "the principle's page does not go past it",
  );
  // 3. The god's hand, by real touch. First, the world and its star as they stood.
  await k(`globalThis.causalis.pageWindowOpen && 0`);
  const whole = await read();
  await page.locator(".far-unmake").first().scrollIntoViewIfNeeded();
  const sure = page.locator(".far-unmake").first(),
    box = await sure.boundingBox();
  check(!!box && box.height >= 36, `the hand's button is too small to press: ${box?.height}`);
  await shot("2-hand");
  await sure.tap();
  await settle(300);
  check(/no undoing/.test((await sure.textContent()) ?? ""), "the hand does not ask twice");
  check((await ask<unknown[]>("far.falls")).length === 0, "one touch was enough to unmake a world");
  await shot("2b-asked-twice");
  await sure.tap();
  await until("the film", async () => (await filmState()).stage === "whole", slow(30000));
  const falls =
    await ask<{ event: string; rung: string; dead: number; need: number; mj: number }[]>(
      "far.falls",
    );
  check(falls.length === 1 && falls[0]!.rung === "world", "the hand did not unmake it");
  const fall = falls[0]!;
  say(`unmade: ${JSON.stringify(fall)}`);
  await atStage("whole", 0.5);
  const stood = await read();
  await shot("3-whole");
  await atStage("strikes", 0.6);
  const seams = await read();
  say(`its seams, 60% through: ${pct(seams.hot)} of the screen fire's colours`);
  check(
    seams.hot > stood.hot + 0.015,
    `its seams do not show: ${pct(seams.hot)} against ${pct(stood.hot)}`,
  );
  await shot("4-seams");
  await atStage("strikes", 0.95);
  await shot("4b-seams-late");
  await until("the white of it", async () => (await filmState()).stage === "breaks", slow(30000));
  const flash = await read();
  say(`it breaks: ${pct(flash.white)} near white`);
  await shot("5-breaks");
  await atStage("breaks", 0.3);
  const going = await read(stood.data);
  say(`30% on: ${pct(going.changed)} of the screen is not what stood there`);
  check(going.changed > 0.3, `its plates going change only ${pct(going.changed)}`);
  await shot("5b-plates");
  await atStage("breaks", 0.7);
  await shot("5c-plates-far");
  await atStage("gone", 0.5);
  await shot("6-going-out");
  await atStage("after", 0.5);
  const left = await read(stood.data);
  say(
    `what is left: ${pct(left.changed)} changed; ${pct(left.dark)} dark; mean ${left.mean.toFixed(0)} against ${stood.mean.toFixed(0)}`,
  );
  check(left.changed > 0.2, `what is left is too like what stood: ${pct(left.changed)}`);
  check(
    left.mean < stood.mean * 0.8,
    `its light has not gone out: mean ${left.mean.toFixed(0)} against ${stood.mean.toFixed(0)}`,
  );
  await shot("7-what-is-left");
  await until("the card", async () => (await filmState()).card, slow(30000));
  await settle(400);
  const cardText = await k<string>(`document.querySelector(".far-film .contact-card").textContent`);
  check(
    /binding energy/.test(cardText) && /gone/.test(cardText),
    `the card does not say what it took and did: ${cardText}`,
  );
  await shot("8-card");
  await page.locator(".far-film .contact-go").tap();
  await until(
    "the film's end",
    async () => !(await k<boolean>("globalThis.causalis.farFilm.playing")),
    slow(30000),
  );
  await settle(1500);
  // After it, in every view that names it. Its world's view.
  check(
    await k<boolean>("globalThis.causalis.worldRuined()"),
    "the world's view draws it whole after",
  );
  const after = await read(whole.data);
  say(`its world after: ${pct(after.changed)} changed`);
  check(after.changed > 0.2, `its world after is too like what stood: ${pct(after.changed)}`);
  check(await seen(".far-gone"), "its panel does not say it is gone");
  check(!(await seen(".far-unmake")), "its panel still offers to unmake it");
  await shot("9-world-after");
  // (The hand's own unmaking is no news to the hand.)
  check(!(await seen(".tiding-watch.far-watch")), "the hand is told what it has just done");
  // Its star: rubble where it went round.
  await page
    .getByRole("button", { name: /Its star/ })
    .first()
    .tap();
  await settle(1800);
  const starAfter = await read();
  const lines = await k<string>(`document.body.textContent`);
  check(/unmade, rubble/.test(lines), "its star's panel does not say a world there is gone");
  say(`its star: ${pct(starAfter.hot + starAfter.red)} rubble's colours`);
  await shot("10-its-star");
  // The map: from the stars around, and the galaxy.
  await k(`globalThis.causalis.zoomThrough?.("out")`);
  await settle(2500);
  await shot("11-stars-around");
  const map = await read();
  say(`the map: ${pct(map.red)} red`);
  check(
    (await ask<{ stars: number[] }>("far.scars")).stars.length === 1,
    "the map holds no mark of it",
  );
  check(map.red > 0.0005, `the map shows no mark of it: ${pct(map.red)} red`);
  await page
    .getByRole("button", { name: /The galaxy/ })
    .first()
    .tap();
  await settle(2500);
  await shot("11b-galaxy");
  const disk = await read();
  say(`the galaxy: ${pct(disk.red)} red`);
  check(disk.red > 0.0002, `the galaxy shows no mark of it: ${pct(disk.red)} red`);
  // Its pages.
  const worldPage = await pageWords(`${f.god.star}/${f.god.planet}`);
  check(/It is gone/.test(worldPage), "its page does not say it is gone");
  check(/rubble/.test(worldPage), "its page does not say what is left");
  check(/watch\.far/.test(worldPage), "its page offers no film");
  await k(`globalThis.causalis.open(${JSON.stringify(`${f.god.star}/${f.god.planet}`)})`);
  await settle(900);
  await shot("12-its-page");
  await k(
    `document.querySelectorAll(".page-window .close, .page-close, [aria-label='Close']").forEach((e) => e.click())`,
  );
  await k(`globalThis.causalis.closePage?.()`);
  // A colony of it.
  const colonies = await ask<
      {
        star: string | null;
        planet: number | null;
        cell: number;
        people: number;
        gone?: { year: number };
      }[]
    >("colony.list"),
    mine = colonies.filter((c) => c.star === f.god.star && c.planet === f.god.planet);
  if (f.god.hall) {
    check(mine.length > 0, "its colony is not listed");
    check(
      mine.every((c) => c.people === 0 && !!c.gone),
      "its colony still has people, or says nothing",
    );
    const land = await pageWords(`cell:0:${mine[0]!.cell}`);
    check(/Its world was unmade/.test(land), "its colony's land does not tell it");
  }
  // Told: the firsts, and every ruler's dread.
  const firsts = await ask<{ what: string }[]>("world.firsts");
  check(
    firsts.some((x) => x.what.startsWith("🌑")),
    "the Director's firsts do not have it",
  );
  const shadow = await ask<{ near: number; words: string }>("fire.shadow");
  say(`the world's panel reads: ${JSON.stringify(shadow)}`);
  check(/unmade/.test(shadow.words), "the world's panel does not remember it");
  const ev = await pageWords(fall.event);
  check(/unmade a world/.test(ev), "its event's page does not tell it");
  // Years on, and through a save: it stays.
  const t0 = await k<number>("globalThis.causalis.client.status.t"),
    yearAt = Math.floor(t0 / YEAR);
  await advanceTo((yearAt + 1) * YEAR + 1);
  await settle(800);
  await k(`globalThis.causalis.client.save("gate83b")`);
  const q = `universe=${f.universe}&seed=${encodeURIComponent(f.seed)}`;
  await page.goto(`${base}?${q}&load=gate83b&hold=1`);
  await page.waitForFunction(
    () => ((globalThis as { causalis?: { drawn?: () => number } }).causalis?.drawn?.() ?? 0) > 0,
    undefined,
    { timeout: slow(180000) },
  );
  await k("globalThis.causalis.client.setSpeed(0)");
  await k(`globalThis.causalis.seeWorld(${JSON.stringify(f.god.star)}, ${f.god.planet})`);
  await settle(2000);
  check(
    await k<boolean>("globalThis.causalis.worldRuined()"),
    "through a save it stands whole again",
  );
  check(await seen(".far-gone"), "through a save its panel forgets");
  await shot("13-after-a-save");
  // 4. A ruler played, by touch: the fleet's year comes first.
  await advanceTo((await k<number>("globalThis.causalis.client.status.t")) + YEAR);
  await settle(600);
  const shadow2 = await ask<{ crises: number; near: number; words: string }>("fire.shadow");
  say(`at the brink: ${JSON.stringify(shadow2)}`);
  check(shadow2.crises >= 1, "a fleet a year out with what it could bring brings no crisis");
  check(shadow2.near >= 40, `the world's panel reads a far crisis at only ${shadow2.near}`);
  check(!/0 realms/.test(shadow2.words), "the panel counts no one");
  await k(`globalThis.causalis.open(${JSON.stringify(`${f.holder}#leaders`)})`);
  await until("the leaders tab", () => seen(".leader-rule"), slow(60000));
  await settle(300);
  await page.locator(".leader-rule").first().tap();
  await until(
    "the window",
    async () =>
      k<boolean>(
        `[...document.querySelectorAll(".reign-window .life-wintitle")].some((e) => /reach of the stars holds their breath/.test(e.textContent ?? "") && e.offsetParent !== null)`,
      ),
    slow(90000),
  );
  await settle(500);
  await shot("14-the-window");
  const loose = page.locator(`.reign-drama[data-choice="loose"]`);
  check(
    /Burn its sky/.test((await loose.first().textContent()) ?? ""),
    "the window does not name what it would do",
  );
  check(
    (await page.locator(`.reign-drama[data-choice="hold"]`).count()) === 1,
    "the window offers no way to hold back",
  );
  await loose.first().tap();
  await settle(800);
  await shot("14b-word-gone-out");
  if (await seen(".reign-letgo")) await page.locator(".reign-letgo").first().tap();
  await settle(600);
  // (As a person has it, for a machine is given cards: a window, and in it what to watch.)
  await k(`localStorage.setItem("causalis.events", "window")`);
  await advanceTo(
    (Math.floor((await k<number>("globalThis.causalis.client.status.t")) / YEAR) + 1) * YEAR + 1,
  );
  await settle(800);
  const skies = (
    await ask<
      { event: string; rung: string; by: string | null; dead: number; decision: string | null }[]
    >("far.falls")
  ).filter((x) => x.rung === "sky");
  check(
    skies.length === 1 && skies[0]!.by === f.holder && !!skies[0]!.decision,
    "the word did not bring a sky down by history's own year",
  );
  // Told to everyone, with nothing followed: its window pressed, its film.
  const watchFell = page.locator(".event-window .event-go", { hasText: "Watch what fell" });
  if (await until("its window", () => seen(".event-window"), slow(12000))) {
    await settle(600);
    await shot("14c-told");
    const told = await k<string>(`document.querySelector(".event-window")?.textContent ?? ""`);
    say(`told: ${told.slice(0, 220)}`);
    check(/burned a world/.test(told), `its window does not say what fell: ${told.slice(0, 160)}`);
    check((await watchFell.count()) === 1, "its window offers no film");
    await watchFell.first().tap();
    await until(
      "the film from its window",
      async () => (await filmState()).stage === "whole",
      slow(30000),
    );
    await k("globalThis.causalis.farFilm.skip()");
    await until(
      "its end again",
      async () => !(await k<boolean>("globalThis.causalis.farFilm.playing")),
      slow(30000),
    );
    await settle(1500);
    check(!(await seen(".event-window")), "its window stays over the world after its film");
  }
  await k(`localStorage.removeItem("causalis.events")`);
  const warPage = await pageWords(f.war);
  check(/What fell/.test(warPage), "the war's page does not tell it");
  const realmPage = await pageWords(f.holder);
  check(/What it has done past any town/.test(realmPage), "the realm's page does not tell it");
  check(
    /What it could bring across the stars/.test(realmPage),
    "the realm's page does not read what it could bring",
  );
  await k(
    `document.querySelectorAll(".page-window .close, .page-close, [aria-label='Close']").forEach((e) => e.click())`,
  );
  await k(`globalThis.causalis.closePage?.()`);
  await settle(300);
  if (skies[0]) {
    await k(
      `globalThis.causalis.farFilm.play(${JSON.stringify(skies[0].event)})`.replace(
        "globalThis.causalis.farFilm.play",
        "void globalThis.causalis.farFilm.play",
      ),
    );
    await atStage("whole", 0.5);
    const clear = await read();
    await shot("15-sky-before");
    await atStage("breaks", 0.8);
    const burning = await read();
    say(`its sky at 80%: mean ${burning.mean.toFixed(0)} against ${clear.mean.toFixed(0)}`);
    check(
      burning.mean < clear.mean * 0.75,
      `its sky does not darken: ${burning.mean.toFixed(0)} against ${clear.mean.toFixed(0)}`,
    );
    await shot("15b-sky-burning");
    await until("the card", async () => (await filmState()).card, slow(30000));
    await page.locator(".far-film .contact-go").tap();
    await until(
      "its end",
      async () => !(await k<boolean>("globalThis.causalis.farFilm.playing")),
      slow(30000),
    );
    await settle(1500);
    const dark = await read();
    check(
      dark.mean < clear.mean * 0.85,
      `the world under it is not dark after: ${dark.mean.toFixed(0)} against ${clear.mean.toFixed(0)}`,
    );
    check(await seen(".far-burned"), "its panel does not say its sky burned");
    await shot("16-world-dark");
  }
  // 5. The Director's eye: a first of a rung goes to its film by itself, its card closing by itself. The least of them: a far-off flash and a mark.
  // (Its button stands on the home world, and it stays on when the eye is here: pressed for it.)
  await k(`document.querySelector(".director-button").click()`);
  await settle(1200);
  await k(`globalThis.causalis.time?.pick?.(1)`);
  await k(`globalThis.causalis.client.setSpeed?.(86400)`);
  await k(
    `globalThis.causalis.client.command("far.strike", ${JSON.stringify({ ...f.least, rung: "carried" })})`,
  );
  if (
    await until(
      "the Director's film of it",
      async () => (await filmState()).rung === "carried",
      slow(60000),
    )
  ) {
    await atStage("whole", 0.5);
    const before = await read();
    await shot("17-least-before");
    await atStage("breaks", 0.5);
    const marked = await read(before.data);
    say(
      `the least of it, marked: ${pct(marked.changed)} changed, ${pct(marked.hot + marked.red)} its colours`,
    );
    await shot("17b-least-mark");
    check(
      marked.changed > 0.0005,
      `the least of it leaves no mark: ${pct(marked.changed)} changed`,
    );
    await until("the card", async () => (await filmState()).card, slow(30000));
    await shot("17c-least-card");
    // (Nothing pressed: the Director's own eye goes on.)
    await until(
      "the card closing by itself",
      async () => !(await k<boolean>("globalThis.causalis.farFilm.playing")),
      slow(45000),
    );
  }
  await k(`document.querySelector(".director-button").click()`);
  await k(`globalThis.causalis.client.setSpeed?.(0)`);
  await settle(800);
  // 6. A people whose world is gone: their name is still a page, and it says what became of them.
  await k(
    `globalThis.causalis.client.command("far.strike", ${JSON.stringify({ ...f.target, rung: "world" })})`,
  );
  await settle(600);
  const peoplePage = await pageWords(f.civ);
  say(`a people unmade: ${peoplePage.slice(0, 260)}`);
  check(
    /are gone/.test(peoplePage) &&
      /"kind":"civilization"/.test(peoplePage) &&
      !/civ:\d+:\d+\)/.test(peoplePage),
    `a people whose world is gone has no page of its own: ${peoplePage.slice(0, 260)}`,
  );
  await k(`globalThis.causalis.open(${JSON.stringify(f.civ)})`);
  await settle(900);
  await shot("18-a-people-gone");
  await k(
    `document.querySelectorAll(".page-window .close, .page-close, [aria-label='Close']").forEach((e) => e.click())`,
  );
  await k(`globalThis.causalis.closePage?.()`);
  await k(`globalThis.causalis.seeWorld(${JSON.stringify(f.god.star)}, ${f.god.planet})`);
  await settle(800);
}

try {
  // (A young world where a people of the stars already sails under a sky a fleet reaches: most of them have far thicker air.)
  const seed = arg("--seed") ?? "lumen 285",
    universe = arg("--universe") ?? "alien";
  await run(forge(universe, seed, 320, arg("--far")));
} catch (e) {
  problems.push(`${(e as Error).message}\n${(e as Error).stack ?? ""}`);
}
for (const e of errors) problems.push(`in the page: ${e}`);
await browser.close();
await server.close();
if (problems.length) {
  console.error(`gate 83 FAILED:\n${problems.map((p) => `  - ${p}`).join("\n")}`);
  process.exit(1);
}
console.log("gate 83 passed");
process.exit(0);
