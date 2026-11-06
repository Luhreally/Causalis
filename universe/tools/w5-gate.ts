// node tools/w5-gate.ts [--ci] [--soft] [--shots dir] [--earth file.save] [--shut file.save]: gate 81, the greatest fire (war-reach-plan.md W5), at
// a phone's size. The path nobody watches goes first: a world without what it takes, and the cold years after.
//   1. the numbers: a world shut by its numbers says why; a fall flattens what the sum says; what a strike back frightens; rarity from the same sum;
//   2. a world without what it takes: its page says why, and no one there ever learns it however far it runs;
//   3. a realm's works: begun by a real ruler at a real cost; a realm whose works stand; the page says so; before it nothing is hashed;
//   4. a crisis: forged only in that its war is set going badly and its holder given the works: what follows is history's own year; pressed by real touch by a
//      ruler played, the window comes, and the answer holds: "hold" steps back and the war ends;
//   5. the same crisis let run with the word "loose": history's own fall: a strike with the decision as its cause, a town's homes gone, the wind's lands sick, soot;
//   6. the town: the flash whites out the screen (pixels), a cloud stands far taller than anything of the town's, far larger than a rocket's in the pixels; lots alight;
//   7. the dark years: forward the clock: harvests failing, famine by the same code; the sky's weather says so; the panel's chip shows it, and the pages tell it.
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
  rulesetId,
  saveWorld,
  seedFromText,
  type World,
} from "../src/kernel/index.ts";
import { meansNumbers } from "../src/gen/index.ts";
import { SPREAD } from "../src/bridge/index.ts";
import { ALIEN, EARTH } from "../src/host/planet.ts";
import {
  FIRE,
  FIRE_ID,
  G,
  chanceOfFall,
  fearOf,
  fireLots,
  fireShutBy,
  greatFallOf,
  holdBackBy,
  principle,
  unmakeMj,
  type Principle,
} from "../src/rules/index.ts";
import {
  WAR,
  WAR_EVENTS,
  fireOf,
  frontier,
  loreOf,
  politiesOf,
  populationContext,
  warsOf,
  type MarketStore,
  type Polity,
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
console.log("gate 81, the greatest fire");

// 1. The numbers: pure.
{
  const great = greatFallOf({ lots: 100000, people: 2e6, miss: 300 }),
    small = greatFallOf({ lots: 300, people: 9000, miss: 300 });
  say(
    `flattens ${Math.round(fireLots())} lots; a great city: ${Math.round(great.share * 100)}% gone, ${great.dead} dead; a small town: ${Math.round(small.share * 100)}%, ${small.dead} dead`,
  );
  check(great.dead > 100000, `a great city loses only ${great.dead}`);
  check(small.share >= FIRE.mostGone, "a small town is not lost");
  const bare = chanceOfFall({ desperation: 1, valour: 0.5, fear: 0, dread: 0 }),
    answered = chanceOfFall({ desperation: 1, valour: 0.5, fear: fearOf(0.01), dread: 0 }),
    after = chanceOfFall({ desperation: 1, valour: 0.5, fear: 0, dread: FIRE.dreadFirst });
  say(
    `the chance at its height ${bare.toFixed(3)}; against an answer ${answered.toFixed(4)}; after a first fall ${after.toFixed(3)}`,
  );
  check(bare < 0.5, "at its very worst a ruler looses it more often than not");
  check(answered < bare / 10, "a strike back does not hold a ruler back");
  check(after < bare / 3, "a first fall does not change every ruler's mind");
  check(holdBackBy(0) === 1, "no answer to fear still holds a war back");
  const earth = unmakeMj({ pull: 1, radius: 1 });
  check(earth > 1e26 && earth < 4e26, `Earth's binding energy is ${earth} MJ`);
}

type Forged = {
  readonly bytes: Buffer;
  readonly universe: "earth" | "alien";
  readonly seed: string;
  readonly holder: string;
  readonly foe: string;
  readonly war: string;
  readonly ruler: string;
  readonly t: number;
};

const loaded = (u: typeof EARTH, file: string): World => {
  const doc = JSON.parse(gunzipSync(readFileSync(file)).toString("utf8")) as Parameters<
      typeof loadWorld
    >[0],
    probe = u.build(seedFromText(doc.seed));
  return loadWorld(doc, (s) => u.build(s), rulesetId(probe, u.version), {
    allowRulesetChange: true,
  }).world;
};

/** The path nobody watches: a world shut by its numbers, run on: no one learns it, and its page says why. */
function shutWorld(file: string | undefined): void {
  const started = performance.now();
  // (A young world of a shut kind on CI: a far save where one is given.)
  let world: World | null = file ? loaded(ALIEN, file) : null;
  if (!world) {
    for (const seed of [
      "vale 471",
      "kestrel 557",
      "alien 41",
      "lumen 285",
      "wren 113",
      "north 292",
      "osier 692",
    ]) {
      const w = ALIEN.build(seedFromText(seed)),
        n = meansNumbers(populationContext(w).generated);
      if (fireShutBy(n)) {
        world = w;
        break;
      }
    }
  }
  if (!world) {
    problems.push("no world among those tried is shut");
    return;
  }
  const ctx = populationContext(world),
    n = meansNumbers(ctx.generated),
    shut = fireShutBy(n);
  say(
    `a shut world: ${world.seed.text}: ${shut}, metals ${n.metalShare.toFixed(2)}, rock ${n.rock}, ${n.medium}`,
  );
  check(shut !== null, "the world given is not shut");
  if (shut === null) return;
  world.runTo(world.now + 3 * YEAR);
  const lore = loreOf(world);
  for (const p of politiesOf(world).living())
    check(!lore.get(p.seat, FIRE_ID), `${p.ref} knows what its world cannot give`);
  check(fireOf(world).dormant(), "the store of a shut world woke");
  say(`  run on 3 years in ${((performance.now() - started) / 1000).toFixed(1)} s`);
}

/** Two great neighbours set at war, the one holding the works and losing. What follows is history's own year. */
function worldAtBrink(
  universe: "earth" | "alien",
  seed: string,
  year: number,
  file?: string,
): Forged {
  const u = universe === "earth" ? EARTH : ALIEN,
    started = performance.now();
  let world: World;
  if (file) world = loaded(u, file);
  else {
    world = u.build(seedFromText(seed));
    world.runTo(year * YEAR);
  }
  const ctx = populationContext(world),
    wars = warsOf(world),
    realms = politiesOf(world),
    lore = loreOf(world),
    markets = world.store<MarketStore>("economy.markets"),
    now = () => Math.floor((world.now - 1) / YEAR),
    living = [...realms.living()].sort((a, b) => b.members.length - a.members.length);
  // (The holder a realm of some size beside a far greater one: a great attacker's people are not soon weary, so its war lasts its year.)
  let pair: [Polity, Polity] | null = null;
  for (const foe of living) {
    for (const a of living)
      if (a !== foe && a.members.length >= 3 && frontier(ctx, foe, a).length) {
        pair = [a, foe];
        break;
      }
    if (pair) break;
  }
  if (!pair)
    for (const foe of living) {
      for (const a of living)
        if (a !== foe && frontier(ctx, foe, a).length) {
          pair = [a, foe];
          break;
        }
      if (pair) break;
    }
  if (!pair) throw new Error("no two realms border each other");
  const [holder, foe] = pair,
    // (The event a war stands on, and that history's reasons cite.)
    told = world.events.emit({
      type: WAR_EVENTS.declared.type,
      subjects: [foe.ref, holder.ref],
      place: ctx.provinces.get(holder.seat)!.ref,
      causes: [],
      data: { a: "", b: "" },
    });
  for (const id of [
    "gunpowder",
    "electricity",
    "astronomy",
    "rocketry",
    "electronics",
    "guidance",
    "thrown-loads",
    FIRE_ID,
  ])
    if (!lore.get(holder.seat, id))
      lore.learn(holder.seat, id, { year: now(), event: told }, principle(id) as Principle);
  for (const c of holder.members) {
    const m = markets.of(c);
    m.stock[G.machines] = Math.max(m.stock[G.machines]!, 1e6);
    m.works ??= told;
  }
  // Given by the god's hand: the command the owner has, and so the works stand when the year turns.
  world.submit("fire.give", { realm: holder.ref });
  world.runTo(world.now + 1);
  check(fireOf(world).loadsOf(holder.ref, now()) >= 1, "the realm given it does not hold it");
  // A war going badly for it, lost battle on lost battle. Its next turns come to the brink by history's own reading: a war may
  // end in its year before it does, by its own numbers, and another is set going.
  let ref = "" as Polity["ref"],
    crisis = null as ReturnType<typeof fireOf>["state"]["crises"][number] | null;
  for (let tries = 0; tries < 12 && !crisis; tries++) {
    ref = world.minter.mint(WAR);
    const land = frontier(ctx, foe, holder)[0];
    if (land === undefined) throw new Error("no land left between them");
    wars.add({
      ref,
      attacker: foe.ref,
      defender: holder.ref,
      declared: now(),
      event: told,
      prize: land,
      battles: Array.from({ length: 5 }, () => ({
        year: now(),
        land,
        won: true,
        fallen: [0, 0] as const,
        event: told,
      })),
      fallen: [0, 0],
      ended: null,
      peace: null,
    });
    const before = fireOf(world).state.crises.length;
    world.runTo(world.now + YEAR);
    crisis =
      fireOf(world)
        .state.crises.slice(before)
        .find((c) => c.war === ref && c.ended === null) ?? null;
    if (!crisis && wars.get(ref)?.ended === null) wars.get(ref)!.ended = now();
  }
  if (!crisis)
    throw new Error(`no crisis came of it on ${seed}: last ended ${wars.get(ref)?.ended}`);
  say(
    `${seed}: year ${crisis.year}: ${crisis.ruler} of ${holder.ref} at the brink with ${foe.ref}, going ${crisis.desperation.toFixed(2)}; made in ${((performance.now() - started) / 1000).toFixed(0)} s`,
  );
  const bytes = gzipSync(
    JSON.stringify(saveWorld(world, rulesetId(world, u.version), { universe: u.name })),
  );
  return {
    bytes,
    universe,
    seed,
    holder: holder.ref,
    foe: foe.ref,
    war: ref,
    ruler: crisis.ruler,
    t: world.now,
  };
}

const root = fileURLToPath(new URL("..", import.meta.url)),
  server = await preview({ root, logLevel: "silent", preview: { port: 4281, strictPort: false } }),
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
    await page.waitForTimeout(80);
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
const open = async (ref: string) => {
  await k(`globalThis.causalis.open(${JSON.stringify(ref)})`);
  await settle(800);
};
const closePages = () =>
  k(
    `document.querySelectorAll(".page-window .close, .page-close, [aria-label='Close']").forEach((e) => e.click())`,
  );

/** The mean brightness of a band of the screen and how much of the whole is near white, by the pixels. */
async function screenLight(): Promise<{ white: number; mean: number }> {
  const png = (await page.screenshot()).toString("base64");
  return page.evaluate(async (data) => {
    const bitmap = await createImageBitmap(
        await (await fetch(`data:image/png;base64,${data}`)).blob(),
      ),
      c = new OffscreenCanvas(bitmap.width, bitmap.height),
      x = c.getContext("2d")!;
    x.drawImage(bitmap, 0, 0);
    const d = x.getImageData(0, 0, bitmap.width, bitmap.height).data;
    let white = 0,
      sum = 0,
      n = 0;
    for (let i = 0; i < d.length; i += 4 * 7) {
      const l = d[i]! * 0.3 + d[i + 1]! * 0.59 + d[i + 2]! * 0.11;
      sum += l;
      n++;
      if (l > 225) white++;
    }
    return { white: white / n, mean: sum / n };
  }, png);
}

/** How much of the screen, in a tall box about a place on it, is what was not there before: pixels against an earlier shot. */
async function screenChange(before: string): Promise<{ share: number; top: number }> {
  const after = (await page.screenshot()).toString("base64");
  return page.evaluate(
    async ([a, b]) => {
      const read = async (data: string) => {
        const bitmap = await createImageBitmap(
            await (await fetch(`data:image/png;base64,${data}`)).blob(),
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
      const p = await read(a!),
        q = await read(b!);
      let changed = 0,
        n = 0,
        top = q.h;
      for (let y = Math.floor(q.h * 0.12); y < Math.floor(q.h * 0.85); y += 3)
        for (let x = 0; x < q.w; x += 3) {
          const i = (y * q.w + x) * 4,
            dl =
              Math.abs(p.d[i]! - q.d[i]!) +
              Math.abs(p.d[i + 1]! - q.d[i + 1]!) +
              Math.abs(p.d[i + 2]! - q.d[i + 2]!);
          n++;
          if (dl > 60) {
            changed++;
            if (y < top) top = y;
          }
        }
      return { share: changed / n, top: top / q.h };
    },
    [before, after] as const,
  );
}

/** A world as the page takes it up. */
async function takeUp(f: Forged): Promise<void> {
  const name = `${f.universe}:gate81`,
    q = `universe=${f.universe}&seed=${encodeURIComponent(f.seed)}`;
  await page.goto(`${base}?${q}&hold=1`);
  await page.waitForFunction(
    () => !!(globalThis as { causalis?: { client?: unknown } }).causalis?.client,
    undefined,
    {
      timeout: slow(120000),
    },
  );
  await page.waitForFunction(
    () => ((globalThis as { causalis?: { drawn?: () => number } }).causalis?.drawn?.() ?? 0) > 0,
    undefined,
    { timeout: slow(180000) },
  );
  const b64 = f.bytes.toString("base64");
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
    [b64, name],
  );
  await page.goto(`${base}?${q}&load=${encodeURIComponent(name)}&hold=1`);
  await page.waitForFunction(
    () => ((globalThis as { causalis?: { drawn?: () => number } }).causalis?.drawn?.() ?? 0) > 0,
    undefined,
    { timeout: slow(180000) },
  );
  await k("globalThis.causalis.client.setSpeed(0)");
}

async function watch(f: Forged, tag: string): Promise<void> {
  await takeUp(f);
  // The panel: a world under the shadow.
  const shadow = await ask<{ near: number; crises: number; holders: number; words: string }>(
    "fire.shadow",
  );
  say(`${tag}: the world's panel reads ${JSON.stringify(shadow)}`);
  check(
    shadow.holders >= 1 && shadow.crises >= 1,
    `${tag}: the shadow reads nothing of the crisis`,
  );
  check(shadow.near >= 45, `${tag}: a crisis reads only ${shadow.near}`);
  await shot(`${tag}-1-holding-breath`);
  // A ruler played: the window comes, pressed by real touch.
  await k(`globalThis.causalis.open(${JSON.stringify(`${f.holder}#leaders`)})`);
  await until(`${tag}: the leaders tab`, () => seen(".leader-rule"), slow(60000));
  await settle(300);
  await page.locator(".leader-rule").first().tap();
  await until(
    `${tag}: the window at the brink`,
    async () =>
      k<boolean>(
        `[...document.querySelectorAll(".reign-window .life-wintitle")].some((e) => /holds its breath/.test(e.textContent ?? "") && e.offsetParent !== null)`,
      ),
    slow(90000),
  );
  await settle(500);
  await shot(`${tag}-2-the-window`);
  const loose = page.locator(`.reign-drama[data-choice="loose"]`),
    box = await loose.first().boundingBox();
  check(!!box && box.height >= 40, `${tag}: Loose it is too small to press`);
  check(
    (await page.locator(`.reign-drama[data-choice="hold"]`).count()) === 1,
    `${tag}: the window offers no way to hold back`,
  );
  await loose.first().tap();
  await settle(800);
  const said = await ask<{ crises: number }>("fire.shadow");
  check(said.crises >= 1, `${tag}: a word at the brink ended it at once`);
  await shot(`${tag}-2b-word-gone-out`);
  if (await seen(".reign-letgo")) await page.locator(".reign-letgo").first().tap();
  await settle(800);
  // The year turns: history's own fall.
  const turn = (Math.floor(f.t / YEAR) + 1) * YEAR + 1;
  await advanceTo(turn);
  await settle(800);
  const page0 = JSON.stringify(await ask<unknown>("page", { ref: f.war }));
  check(/greatest fire fell/.test(page0), `${tag}: the war's page does not tell it`);
  const land = await ask<{
    wars: {
      raids?: {
        great?: boolean;
        event: string;
        town: string;
        year: number;
        dead: number;
        homes: number;
        rocket?: { to: number };
      }[];
    }[];
  }>("wars.map").catch(() => null);
  const strike = land?.wars.flatMap((w) => w.raids ?? []).find((r) => r.great);
  check(!!strike, `${tag}: no great fire on the wars' map`);
  if (!strike) return;
  say(`${tag}: it fell: ${JSON.stringify(strike)}`);
  check(strike.dead > 0 && strike.homes > 0, `${tag}: it fell and did nothing`);
  // The town: the eye goes itself. First, the town before it.
  await k(`globalThis.causalis.closePage?.()`);
  await closePages();
  await k(`globalThis.causalis.goTo(${JSON.stringify(strike.town)})`);
  await until(
    `${tag}: the town`,
    async () =>
      k<boolean>(
        `globalThis.causalis.scale() === "village" && globalThis.causalis.planNow?.()?.ref === ${JSON.stringify(strike.town)}`,
      ),
    slow(120000),
  );
  await settle(1500);
  const struck = await k<
    { at: number; raid?: { by: string; rocket?: boolean; great?: boolean } }[]
  >(
    `(globalThis.causalis.planNow()?.town?.struck ?? []).filter((s) => s.event === ${JSON.stringify(strike.event)})`,
  );
  check(
    struck.length === 1 && !!struck[0]!.raid?.great,
    `${tag}: the town's plan does not tell the greatest fire`,
  );
  const from = (struck[0]?.at ?? turn) + SPREAD.rocketFrom;
  await k(`globalThis.causalis.watchRaid(${JSON.stringify(strike.event)})`);
  await settle(1500);
  const filming = () => k<number | null>("globalThis.causalis.raidFilming?.() ?? null");
  // Before it: the sky as it was, the eye placed.
  await until(`${tag}: the film`, async () => ((await filming()) ?? 0) > 0, slow(15000));
  await shot(`${tag}-3-before`);
  const clear = (await page.screenshot()).toString("base64"),
    beforeLight = await screenLight();
  // To its moment: the film runs on its own clock, so wait for it.
  await until(`${tag}: its moment`, async () => ((await filming()) ?? 0) >= from, slow(60000));
  await page.waitForTimeout(150);
  const light = await screenLight();
  say(
    `${tag}: at its moment ${(light.white * 100).toFixed(0)}% of the screen near white (before ${(beforeLight.white * 100).toFixed(0)}%)`,
  );
  check(
    light.white > 0.5,
    `${tag}: the flash is not over the whole screen: ${(light.white * 100).toFixed(0)}%`,
  );
  await shot(`${tag}-4-flash`);
  await until(`${tag}: its head`, async () => ((await filming()) ?? 0) >= from + 14, slow(60000));
  const risen = await screenChange(clear);
  say(
    `${tag}: at 14 s, ${(risen.share * 100).toFixed(0)}% of the screen has changed, up to ${(risen.top * 100).toFixed(0)}% from its top`,
  );
  check(
    risen.share > 0.08,
    `${tag}: only ${(risen.share * 100).toFixed(1)}% of the screen shows it at 14 s: a rocket's fall shows more`,
  );
  await shot(`${tag}-5-rising`);
  await until(`${tag}: its cloud`, async () => ((await filming()) ?? 0) >= from + 44, slow(90000));
  await settle(300);
  const stood = await screenChange(clear),
    blaze = await k<{ alight: number; great: { since: number } | null } | null>(
      "globalThis.causalis.blaze()",
    );
  say(
    `${tag}: at 44 s, ${(stood.share * 100).toFixed(0)}% changed, up to ${(stood.top * 100).toFixed(0)}% from its top; ${blaze?.alight} lots alight`,
  );
  check(
    stood.share > 0.1,
    `${tag}: only ${(stood.share * 100).toFixed(1)}% of the screen shows its cloud`,
  );
  check(
    stood.top < 0.4,
    `${tag}: its cloud rises only to ${(stood.top * 100).toFixed(0)}% from the screen's top`,
  );
  check((blaze?.alight ?? 0) > 0, `${tag}: no lot burns after it`);
  check(!!blaze?.great, `${tag}: the town does not read the fire over it`);
  await shot(`${tag}-6-cloud`);
  await until(
    `${tag}: the fires after`,
    async () => ((await filming()) ?? 0) >= from + 300,
    slow(90000),
  );
  const after = await screenChange(clear);
  say(
    `${tag}: at 300 s, ${(after.share * 100).toFixed(0)}% changed, up to ${(after.top * 100).toFixed(0)}% from its top`,
  );
  check(after.share > 0.1, `${tag}: little of the screen shows what it did at 300 s`);
  await shot(`${tag}-7-after`);
  // From over it, where the lots it took lie: the screen is told from what stood there.
  await k(
    `globalThis.causalis.rig.flyTo({ target: { x: 0, y: 0, z: 0 }, yaw: 0, pitch: -62, distance: 70 }, 0.4)`,
  );
  await settle(1500);
  await shot(`${tag}-7b-from-over-it`);
  const overAfter = (await page.screenshot()).toString("base64");
  // What it did to the ground, as the plan tells it: its heart cleared, none of the buildings there standing.
  const ground = await k<{
    first: number;
    razed: number;
    civics: number;
    standing: number;
    lots: number;
  }>(`(() => {
    const plan = globalThis.causalis.planNow()?.town, runs = plan.runs, heart = Math.min(400, plan.lots), t = globalThis.causalis.raidFilming?.() ?? 0;
    let razed = 0;
    for (let p = 0; p < heart; p++)
      if (runs.some((r) => r[0] === 3 && r[1] <= p && p < r[2])) razed++;
    const near = plan.civics.filter((c) => c.at < heart);
    return { first: heart, razed, civics: near.length, standing: near.filter((c) => c.fell === null).length, lots: plan.lots };
  })()`);
  say(
    `${tag}: of the first ${ground.first} lots of ${ground.lots} drawn, ${ground.razed} are ash; ${ground.standing} of the ${ground.civics} buildings there stand`,
  );
  check(
    ground.razed >= ground.first * 0.9,
    `${tag}: its heart is not cleared: ${ground.razed} of the first ${ground.first} lots`,
  );
  check(ground.standing === 0, `${tag}: ${ground.standing} buildings stand in its heart`);
  // The town as it stood, by the same eye: the same film, from before its moment.
  await k("globalThis.causalis.stopRaidFilm?.()");
  await settle(800);
  await k(`globalThis.causalis.watchRaid(${JSON.stringify(strike.event)})`);
  await until(`${tag}: the film again`, async () => ((await filming()) ?? 0) > 0, slow(15000));
  await k(
    `globalThis.causalis.rig.flyTo({ target: { x: 0, y: 0, z: 0 }, yaw: 0, pitch: -62, distance: 70 }, 0.05)`,
  );
  await page.waitForTimeout(600);
  const stillBefore = ((await filming()) ?? 0) < from;
  await shot(`${tag}-7a-over-it-before`);
  check(stillBefore, `${tag}: its moment came before the eye was over it`);
  const flat = await screenChange(overAfter);
  say(`${tag}: from over it, ${(flat.share * 100).toFixed(0)}% of the screen differs from before`);
  check(
    flat.share > 0.35,
    `${tag}: from over it only ${(flat.share * 100).toFixed(0)}% of the screen differs: the town still stands`,
  );
  await k("globalThis.causalis.stopRaidFilm?.()");
  // The pages.
  await open(strike.event);
  const told = JSON.stringify(await ask<unknown>("page", { ref: strike.event }));
  check(/greatest fire fell/.test(told), `${tag}: the event's page does not tell it`);
  await shot(`${tag}-8-event-page`);
  await open(strike.town);
  const townWords = JSON.stringify(await ask<unknown>("page", { ref: strike.town }));
  check(/The greatest fire fell on it/.test(townWords), `${tag}: the town's page does not tell it`);
  await shot(`${tag}-9-town-page`);
  await open(f.holder);
  const realmWords = JSON.stringify(await ask<unknown>("page", { ref: f.holder }));
  check(
    /Holds the greatest fire/.test(realmWords),
    `${tag}: the realm's page does not say it holds it`,
  );
  check(/Loosed it/.test(realmWords), `${tag}: the realm's page does not say it loosed it`);
  await shot(`${tag}-10-realm-page`);
  await open("prin:greatest-fire");
  const prin = JSON.stringify(await ask<unknown>("page", { ref: "prin:greatest-fire" }));
  check(/What it is here/.test(prin), `${tag}: its page does not say what it is`);
  check(/unmake/.test(prin), `${tag}: its page leaves no room for what would unmake this world`);
  await shot(`${tag}-11-principle`);
  await closePages();
  await k(`globalThis.causalis.closePage?.()`);
  // The dark years: run the turns; harvests by the same code, the weather says so, the panel shows it.
  const sky = await ask<{ dark?: { soot: number; cold: number }; year: number }>("land.sky", {
    cell: strike.rocket?.to ?? 0,
  });
  say(`${tag}: the sky now ${JSON.stringify(sky.dark)}`);
  check((sky.dark?.soot ?? 0) > 0, `${tag}: no soot in the sky`);
  const shadow2 = await ask<{ cold: number; falls: number }>("fire.shadow");
  check(shadow2.falls >= 1, `${tag}: the panel does not know it fell`);
  await k(`globalThis.causalis.goTo("cell:0:${strike.rocket?.to ?? 0}")`);
  await settle(2500);
  await shot(`${tag}-12-land-dark`);
  const y0 = Math.ceil(turn / YEAR);
  await advanceTo((y0 + 2) * YEAR);
  await settle(1000);
  const later = await ask<{ cold: number; near: number }>("fire.shadow");
  say(`${tag}: two years on: ${JSON.stringify(later)}`);
  const landPage = JSON.stringify(
    await ask<unknown>("page", { ref: `cell:0:${strike.rocket?.to ?? 0}` }),
  );
  check(/greatest fire fell here/.test(landPage), `${tag}: the land's page does not tell it`);
  await k(`globalThis.causalis.zoomThrough?.("out")`);
  await settle(2500);
  await shot(`${tag}-13-world-after`);
}

try {
  shutWorld(arg("--shut"));
  await watch(worldAtBrink("earth", "first light", 450, arg("--earth")), "earth");
} catch (e) {
  problems.push(`${(e as Error).message}\n${(e as Error).stack ?? ""}`);
}
for (const e of errors) problems.push(`in the page: ${e}`);
await browser.close();
await server.close();
if (problems.length) {
  console.error(`gate 81 FAILED:\n${problems.map((p) => `  - ${p}`).join("\n")}`);
  process.exit(1);
}
console.log("gate 81 passed");
process.exit(0);
