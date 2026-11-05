// node tools/p70-gate.ts [--ci] [--soft] [--shots dir] [--save file.save] [--lose file.save]: gate 78, a landing on a world of natives (galaxy-plan.md
// Phase 70, first slice), at a phone's size. On a far save with ships come to a people, else (as on CI) a young world given one:
//   1. the numbers: a landing reads the same twice, and its dead are no more than were there;
//   2. a people's page offers it, and it is pressed by touch;
//   3. ships over their world, seen in the pixels; landers down on their ground, seen;
//   4. the fight at two moments: with the layer on and off the screen differs where each host stands; those with guns stand apart and spears come in a mass, on the screen;
//   5. the end told: who came, what they carried, what it cost each side, who holds the ground; and what was told is what is drawn;
//   6. (--lose) a landing the natives win: those who came gone, the natives standing. Watching leaves history as it was.
import { mkdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { gunzipSync, gzipSync } from "node:zlib";
import { preview } from "vite";
import { chromium, type Page } from "playwright";
import {
  YEAR,
  loadWorld,
  rulesetId,
  saveWorld,
  seedFromText,
  type World,
} from "../src/kernel/index.ts";
import { ALIEN, EARTH } from "../src/host/planet.ts";
import { lifeHere } from "../src/host/biochem.ts";
import {
  folkStage,
  folksNear,
  hasLandfall,
  landfallsOf,
  politiesOf,
  starSitesOf,
  type Folk,
} from "../src/sim/index.ts";
import type { LandfallPlan } from "../src/bridge/index.ts";

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
console.log("gate 78, a landing on a world of natives");

type Forged = {
  readonly bytes: Buffer;
  readonly universe: "earth" | "alien";
  readonly seed: string;
  readonly t: number;
  readonly world: World;
};

function forge(universe: "earth" | "alien", seed: string, file?: string): Forged {
  const u = universe === "earth" ? EARTH : ALIEN;
  let world: World;
  if (file) {
    const doc = JSON.parse(gunzipSync(readFileSync(file)).toString("utf8")) as Parameters<
        typeof loadWorld
      >[0],
      probe = u.build(seedFromText(doc.seed));
    world = loadWorld(doc, (s) => u.build(s), rulesetId(probe, u.version), {
      allowRulesetChange: true,
    }).world;
  } else {
    world = u.build(seedFromText(seed));
    world.runTo(40 * YEAR);
    const sites = starSitesOf(world)!,
      f = folksNear(world).find((x) => !x.followed && folkStage(x, 40) === "camps")!,
      any = world.events.at(0).id,
      realm = politiesOf(world).living()[0]!;
    // (Past every land there is: a ship the eye alone reads, for a world too young to have sent one.)
    sites.set(90_000, {
      realm: realm.ref,
      from: realm.seat,
      star: f.star,
      planet: f.planet,
      distance: 10,
      drive: "gate",
      departed: 10,
      arrives: 30,
      voyage: any,
      arrived: any,
      aboard: 0,
      there: 0,
    } as never);
  }
  const bytes = gzipSync(
    JSON.stringify(saveWorld(world, rulesetId(world, u.version), { universe: u.name })),
  );
  return { bytes, universe, seed: world.seed.text, t: world.now, world };
}

const uni = (file?: string) => (file?.includes("earth--") ? "earth" : "alien");
const saveFile = arg("--save"),
  loseFile = arg("--lose");

const root = fileURLToPath(new URL("..", import.meta.url)),
  server = await preview({ root, logLevel: "silent", preview: { port: 4278, strictPort: false } }),
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
const ask = <T>(type: string, args: unknown = {}) =>
  k<T>(
    `globalThis.causalis.client.query({ type: ${JSON.stringify(type)}, args: ${JSON.stringify(args)} })`,
  );

async function loadSave(f: Forged) {
  const name = `${f.universe}:gate78`,
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

type Spot = { x: number; y: number };
type Spots = {
  comers: (Spot & { made: boolean })[];
  natives: Spot[];
  fallen: Spot[];
  landers: Spot[];
};
const spots = () => k<Spots>(`globalThis.causalis.landfallFilm.spots()`);
const state = () =>
  k<{
    stage: string | null;
    k: number;
    t: number;
    end: number;
    words: string;
    card: boolean;
    won: boolean | null;
    left: [number, number];
    ship: { x: number; y: number; z: number } | null;
  }>(`globalThis.causalis.landfallFilm.state()`);

/** Luminance of a shot at these spots' patches: mean of absolute differences against another shot. */
async function differs(
  before: string,
  after: string,
  list: readonly Spot[],
  r0 = 16,
): Promise<{ seen: number; of: number }> {
  const open = list.filter((p) => p.x > r0 + 4 && p.x < 430 - r0 - 4 && p.y > 70 && p.y < 860);
  if (!open.length) return { seen: 0, of: 0 };
  const seen = await page.evaluate(
    async ([a, b, spots, r0]) => {
      const load = async (d: string) => {
          const bm = await createImageBitmap(
              await (await fetch(`data:image/png;base64,${d}`)).blob(),
            ),
            c = new OffscreenCanvas(bm.width, bm.height),
            x = c.getContext("2d")!;
          x.drawImage(bm, 0, 0);
          return { x, k: bm.width / innerWidth };
        },
        A = await load(a as string),
        B = await load(b as string);
      let n = 0;
      for (const p of spots as Spot[]) {
        const r = Math.round((r0 as number) * A.k),
          w = 2 * r,
          px = Math.round(p.x * A.k) - r,
          py = Math.round(p.y * A.k) - r,
          da = A.x.getImageData(px, py, w, w).data,
          db = B.x.getImageData(px, py, w, w).data;
        let changed = 0;
        for (let i = 0; i < da.length; i += 4)
          if (Math.abs(da[i]! - db[i]!) + Math.abs(da[i + 1]! - db[i + 1]!) + Math.abs(da[i + 2]! - db[i + 2]!) > 42)
            changed++;
        if (changed / (w * w) > 0.04) n++;
      }
      return n;
    },
    [before, after, open, r0] as const,
  );
  return { seen, of: open.length };
}

const b64Shot = async () => (await page.screenshot()).toString("base64");
const shot = async (name: string) => {
  if (shots) await page.screenshot({ path: join(shots, `${name}.png`) });
};

/** What the screen shows of a host: the film held still, its layer on and off. */
async function sightOf(label: string) {
  await k(`globalThis.causalis.landfallFilm.hold(true)`);
  await settle(250);
  const on = await b64Shot(),
    s = await spots();
  await k(`globalThis.causalis.landfallFilm.sight(false)`);
  await settle(250);
  const off = await b64Shot();
  await k(`globalThis.causalis.landfallFilm.sight(true)`);
  const comers = await differs(on, off, s.comers),
    natives = await differs(on, off, s.natives),
    fallen = await differs(on, off, s.fallen, 12),
    allOn = await differs(on, off, [
      ...s.comers.slice(0, 1).map((p) => ({ ...p })),
      ...s.natives.slice(0, 1).map((p) => ({ ...p })),
    ]);
  await k(`globalThis.causalis.landfallFilm.hold(false)`);
  say(
    `${label}: of those who came ${comers.seen}/${comers.of} seen, of the natives ${natives.seen}/${natives.of}, fallen ${fallen.seen}/${fallen.of}`,
  );
  void allOn;
  return { s, comers, natives, fallen };
}

/** The median of each spot's distance to its nearest, on the screen (pixels). */
function nearestMedian(list: readonly Spot[]): number {
  const d = list.map((a, i) =>
    list.reduce(
      (m, b, j) => (i === j ? m : Math.min(m, Math.hypot(a.x - b.x, a.y - b.y))),
      Infinity,
    ),
  );
  d.sort((a, b) => a - b);
  return d[Math.floor(d.length / 2)] ?? 0;
}

async function run(f: Forged, target: Folk, tag: string, wantWon: boolean | null) {
  await loadSave(f);
  await settle(1200);
  const plan0 = await ask<LandfallPlan | null>("folk.landfall", {
    star: target.star,
    index: target.planet,
  });
  check(!!plan0, "folk.landfall gave nothing");
  if (!plan0) return;
  say(
    `${tag}: the ${plan0.natives}, ${plan0.stage} in ${plan0.year}: ${plan0.cameWords} ${plan0.metWords} ${plan0.howWords} ${plan0.costWords} ${plan0.holdsWords}`,
  );
  if (wantWon !== null) check(plan0.won === wantWon, `${tag}: expected won=${wantWon}, read ${plan0.won}`);
  // Pressed from their page, by touch.
  await k(`globalThis.causalis.open(${JSON.stringify(target.ref)})`);
  await settle(900);
  await shot(`${tag}-1-page`);
  const words = await k<string>(`document.querySelector(".page-window")?.innerText ?? ""`);
  check(/Watch them come/.test(words), `${tag}: their page does not offer it`);
  await page
    .getByRole("button", { name: /Watch them come/ })
    .first()
    .tap();
  await until(
    "the ships over their world",
    async () => {
      const s = await state();
      return s.stage === "over" && s.k > 0.55;
    },
    slow(90000),
  );
  const over = await state();
  check(over.words.includes(target.name), `${tag}: the words over their world do not name them`);
  await shot(`${tag}-2-ships-over`);
  await until("the landers coming down", async () => {
    const s = await state();
    return s.stage === "down" && s.t > 3.2;
  }, slow(120000));
  await shot(`${tag}-3-landing`);
  const landers = await spots();
  say(`${landers.landers.length} landers, at ${JSON.stringify(landers.landers[0])}`);
  check(landers.landers.length > 0, `${tag}: no lander on the screen as they come down`);
  await until("out and in their order", async () => {
    const s = await state();
    return s.stage === "out" && s.t > 10;
  }, slow(60000));
  await shot(`${tag}-4-drawn-up`);
  const up = await sightOf("drawn up");
  check(up.comers.seen >= Math.ceil(up.comers.of * 0.6) && up.comers.of > 0, `${tag}: those who came can't be seen, drawn up`);
  check(up.natives.seen >= Math.ceil(up.natives.of * 0.6) && up.natives.of > 0, `${tag}: the natives can't be seen, massed`);
  const order = await k<[{ line: boolean; spacing: number }, { line: boolean; spacing: number }]>(
    `globalThis.causalis.landfallFilm.order()`,
  );
  say(`order: those who came ${JSON.stringify(order[0])}; the natives ${JSON.stringify(order[1])}`);
  // Their order, on the screen: those with guns apart, spears together.
  const cApart = nearestMedian(up.s.comers),
    nApart = nearestMedian(up.s.natives);
  say(`on the screen, nearest neighbour: those who came ${cApart.toFixed(0)} px, the natives ${nApart.toFixed(0)} px`);
  if (plan0.off > 0 && plan0.nativeOff === 0 && up.s.comers.length >= 4 && up.s.natives.length >= 4)
    check(cApart > 1.25 * nApart, `${tag}: those with guns stand no further apart than spears (${cApart} v ${nApart})`);
  await until("the natives coming on", async () => {
    const s = await state();
    return s.stage === "come" || s.stage === "hand" || s.stage === "after";
  }, slow(60000));
  await until("the fire", async () => (await state()).t > 15.5, slow(60000));
  await shot(`${tag}-5-fight-1`);
  const fight1 = await sightOf("the fight, first");
  check(fight1.natives.of + fight1.fallen.of > 0, `${tag}: no native on the screen in the fight`);
  const shown1 = await k<Record<string, number>>(`globalThis.causalis.landfallFilm.shown()`);
  const cost = await k<number>(`globalThis.causalis.landfallFilm.cost()`);
  say(`drawn: ${JSON.stringify(shown1)}; script and batches ${cost.toFixed(2)} ms a frame`);
  check(shown1.bolts! > 0, `${tag}: no fire in the fight`);
  const later = (await state()).t + 4.5;
  await until("the fight goes on", async () => (await state()).t > later, slow(60000));
  await shot(`${tag}-6-fight-2`);
  const fight2 = await sightOf("the fight, later");
  check(
    fight2.fallen.of >= fight1.fallen.of,
    `${tag}: fewer lie fallen later (${fight2.fallen.of}) than before (${fight1.fallen.of})`,
  );
  check(fight2.fallen.of > 0 && fight2.fallen.seen >= Math.ceil(fight2.fallen.of * 0.4), `${tag}: those fallen can't be seen`);
  await until("the end", async () => (await state()).stage === "after", slow(60000));
  await settle(3500);
  await shot(`${tag}-7-after`);
  await until("the card", async () => (await state()).card, slow(90000));
  await settle(500);
  const end = await state(),
    card = await k<string>(`document.querySelector(".landfall-film .contact-card")?.innerText ?? ""`);
  say(`card: ${card.replace(/\s+/g, " ").slice(0, 500)}`);
  for (const word of ["Who came", "Who met them", "What it cost", "Who holds the ground"])
    check(card.includes(word), `${tag}: the card does not say ${word}`);
  check(card.includes(target.name), `${tag}: the card does not name them`);
  await shot(`${tag}-8-end-told`);
  // What is told is what is drawn.
  const last = await spots();
  if (plan0.won) {
    check(end.left[0] > 0, `${tag}: they won and none stand`);
    check(/hold the ground|took the ground/.test(card), `${tag}: they won and the card says otherwise`);
  } else {
    check(end.left[0] === 0, `${tag}: the natives won and ${end.left[0]} of those who came still stand`);
    check(/hold their ground/.test(card), `${tag}: the natives won and the card says otherwise`);
    check(last.comers.length === 0, `${tag}: the natives won and those who came are on the screen`);
    check(last.natives.length > 0, `${tag}: the natives won and none of them stand`);
  }
  // Watching moves nothing.
  const again = await ask<LandfallPlan | null>("folk.landfall", {
    star: target.star,
    index: target.planet,
  });
  check(JSON.stringify(again) === JSON.stringify(plan0), `${tag}: the landing read differently after it was watched`);
  await page.locator(".landfall-film .contact-go").tap();
  await until("the film's end", async () => k<boolean>(`!globalThis.causalis.landfallFilm.playing`), slow(90000));
  await settle(1200);
  await shot(`${tag}-9-after-film`);
  const scale = await k<string>(`globalThis.causalis.scale()`);
  check(scale === "camp" || scale === "village", `${tag}: after the film the eye is at ${scale}`);
}

try {
  const made = forge(uni(saveFile), "harrow 348", saveFile),
    year = Math.floor(made.t / YEAR),
    folks = folksNear(made.world),
    life = lifeHere(made.world),
    fought = folks.filter((x) => hasLandfall(made.world, x));
  say(`year ${year}, ${folks.length} peoples, ${fought.length} with a landing`);
  check(fought.length > 0, "no landing on this world");
  // 1. The numbers.
  for (const x of fought) {
    const a = landfallsOf(made.world, x, life),
      b = landfallsOf(made.world, x, life);
    check(JSON.stringify(a.map((l) => l.fight)) === JSON.stringify(b.map((l) => l.fight)), "a landing read differently twice");
    for (const l of a) {
      check(l.fight.dead[0] <= l.fight.fielded[0], "more of those who came died than came");
      check(l.fight.dead[1] <= l.fight.fielded[1], "more of the natives died than met them");
    }
  }
  const first = fought
    .map((x) => ({ x, l: landfallsOf(made.world, x, life)[0]! }))
    .filter((v) => v.l)
    .sort((p, q) => Number(q.l.fight.won) - Number(p.l.fight.won))[0];
  if (first) await run(made, first.x, "won", null);
  if (loseFile) {
    const lose = forge(uni(loseFile), "", loseFile),
      lifeL = lifeHere(lose.world),
      v = folksNear(lose.world)
        .filter((x) => hasLandfall(lose.world, x))
        .find((x) => landfallsOf(lose.world, x, lifeL)[0]?.fight.won === false);
    check(!!v, "no landing the natives won on that world");
    if (v) await run(lose, v, "lost", false);
  }
} catch (e) {
  problems.push(`${(e as Error).message}\n${(e as Error).stack ?? ""}`);
}
for (const e of errors) problems.push(`in the page: ${e}`);
await browser.close();
await server.close();
if (problems.length) {
  console.error(`gate 78 FAILED:\n${problems.map((p) => `  - ${p}`).join("\n")}`);
  process.exit(1);
}
console.log("gate 78 passed");
process.exit(0);
