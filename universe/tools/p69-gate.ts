// node tools/p69-gate.ts [--ci] [--soft] [--shots dir] [--save file.save] [--ruins file.save]: gate 77, peoples who really arose (galaxy-plan.md
// Phase 69, first slice), at a phone's size. On a far save with a ship come to a people, else (as on CI) a young world given one:
//   1. the numbers: a people's stage is pure and read off its world; the spread across a world's stars holds camps and more;
//   2. contact: a meeting's reading is true both ways: a thing said of the two swaps with them, a sickness crosses both ways or neither;
//   3. a star's readout and its world's page say who lives there and how far they have come;
//   4. down to them by touch: their own figures on their own ground, told from it in the pixels; one tapped by touch gives a page;
//   5. the first meeting played: the ship over their world, seen in the pixels, then down beside them, then the card, told in words;
//   6. a world with only ruins: walls standing and no one in them;
//   7. back up by the bar to their world; no error in the page. Watching leaves the history as it was.
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
import { ALIEN, EARTH } from "../src/host/planet.ts";
import {
  arrivalsAt,
  contactBetween,
  folkStage,
  folksNear,
  partyOf,
  politiesOf,
  starSitesOf,
  type Folk,
} from "../src/sim/index.ts";
import type { FolkContact, FolkNear } from "../src/bridge/index.ts";

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
console.log("gate 77, peoples who really arose");

type Forged = {
  readonly bytes: Buffer;
  readonly universe: "earth" | "alien";
  readonly seed: string;
  readonly t: number;
  readonly world: World;
};

/** A far save as it is; else a young world, one ship set down on a people's world for the eye to read. */
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
  return { bytes, universe, seed, t: world.now, world };
}

const saveFile = arg("--save"),
  ruinsFile = arg("--ruins");
const made = forge(saveFile?.includes("earth--") ? "earth" : "alien", "harrow 348", saveFile);
const year = Math.floor(made.t / YEAR);

// 1. The numbers.
const folks = folksNear(made.world),
  count: Record<string, number> = {};
for (const f of folks) count[folkStage(f, year)] = (count[folkStage(f, year)] ?? 0) + 1;
say(`year ${year}, ${folks.length} peoples: ${JSON.stringify(count)}`);
check(folks.length >= 3, "too few peoples about the stars");
check((count.camps ?? 0) > 0, "no people in camps");
const again = folksNear(made.world);
check(
  folks.every((f, i) => f.arose === again[i]!.arose && f.pace === again[i]!.pace),
  "a people's numbers read differently the second time",
);

// 2. Contact: the same whichever way it is read.
const pair = (a: Folk, b: Folk) => {
  const ab = contactBetween(partyOf(a), partyOf(b)),
    ba = contactBetween(partyOf(b), partyOf(a));
  check(ab.airThere.can === ba.airHome.can, "breathing reads differently swapped");
  check(ab.airHome.can === ba.airThere.can, "breathing reads differently swapped, the other way");
  check(ab.foodThere.can === ba.foodHome.can, "food reads differently swapped");
  check(ab.foodHome.can === ba.foodThere.can, "food reads differently swapped, the other way");
  check(ab.sickness.can === ba.sickness.can, "a sickness crosses one way only");
  check(ab.speak.can === ba.speak.can, "speech reads differently swapped");
};
for (let i = 0; i + 1 < Math.min(folks.length, 12); i++) pair(folks[i]!, folks[i + 1]!);

// The people a ship came to: a primitive one first.
const visited = folks
  .map((f) => ({ f, a: arrivalsAt(made.world, f)[0] }))
  .filter((x) => x.a && x.a.found !== "ruins")
  .sort(
    (x, y) =>
      Number(x.a!.found !== "camps") - Number(y.a!.found !== "camps") ||
      Number(!!x.f.followed) - Number(!!y.f.followed),
  );
const target = visited[0];
if (!target) problems.push("no people has been come to on this world");

const root = fileURLToPath(new URL("..", import.meta.url)),
  server = await preview({ root, logLevel: "silent", preview: { port: 4277, strictPort: false } }),
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

/** How much of the screen, away from the bar, differs from its neighbours: an empty ground has little. */
async function sightAt(
  spots: readonly { x: number; y: number }[],
  r0 = 14,
): Promise<{ seen: number; of: number }> {
  const open = spots.filter((p) => p.x > r0 + 4 && p.x < 430 - r0 - 4 && p.y > 70 && p.y < 900);
  if (!open.length) return { seen: 0, of: 0 };
  const png = (await page.screenshot()).toString("base64");
  const seen = await page.evaluate(
    async ([data, spots, r0]) => {
      const bitmap = await createImageBitmap(
          await (await fetch(`data:image/png;base64,${data as string}`)).blob(),
        ),
        c = new OffscreenCanvas(bitmap.width, bitmap.height),
        x = c.getContext("2d")!,
        k = bitmap.width / innerWidth;
      x.drawImage(bitmap, 0, 0);
      const lum = (d: Uint8ClampedArray, i: number) =>
        d[i]! * 0.3 + d[i + 1]! * 0.59 + d[i + 2]! * 0.11;
      let n = 0;
      for (const p of spots as { x: number; y: number }[]) {
        const r = Math.round((r0 as number) * k),
          w = 2 * r,
          px = x.getImageData(Math.round(p.x * k) - r, Math.round(p.y * k) - r, w, w).data;
        let lo = 255,
          hi = 0;
        for (let i = 0; i < px.length; i += 4) {
          const l = lum(px, i);
          lo = Math.min(lo, l);
          hi = Math.max(hi, l);
        }
        if (hi - lo > 26) n++;
      }
      return n;
    },
    [png, open, r0] as const,
  );
  return { seen, of: open.length };
}

/** A tap by a finger. */
const tap = async (x: number, y: number) => {
  await page.touchscreen.tap(x, y);
  await page.waitForTimeout(slow(350));
};

/** A world as the page takes it up: kept under its own name, then opened by it. */
async function loadSave(f: Forged) {
  const name = `${f.universe}:gate77`,
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

const ask = <T>(type: string, args: unknown = {}) =>
  k<T>(
    `globalThis.causalis.client.query({ type: ${JSON.stringify(type)}, args: ${JSON.stringify(args)} })`,
  );

async function watch() {
  const f = target!.f;
  say(
    `the ${f.name}: found ${target!.a!.found} in ${target!.a!.year}, now ${folkStage(f, year)} (${f.followed ? "followed" : "risen"}), ${f.star}/${f.planet}, by ${target!.a!.kind}`,
  );
  await loadSave(made);
  await settle(1500);
  const near0 = await ask<FolkNear | null>("folk.near", { star: f.star, index: f.planet });
  check(!!near0, "folk.near gave nothing");
  check(!!near0?.contact, "folk.near tells no contact");
  say(`${near0?.name}: ${near0?.stageWords}; carry ${near0?.arms.join(", ")}`);
  say(`contact: ${JSON.stringify((near0?.contact as FolkContact | null)?.reading.speak)}`);
  // 3. Pages: their world's says who lives there, a page of theirs tells them.
  await k(`globalThis.causalis.open(${JSON.stringify(`${f.star}/${f.planet}`)})`);
  await settle(900);
  const worldWords = await k<string>(`document.querySelector(".page-window")?.innerText ?? ""`);
  check(worldWords.includes(f.name), `their world's page does not name the ${f.name}`);
  check(/Go down/.test(worldWords), "their world's page offers no way down");
  await shot("1-world-page");
  await k(`globalThis.causalis.open(${JSON.stringify(f.ref)})`);
  await settle(900);
  const pageWords = await k<string>(`document.querySelector(".page-window")?.innerText ?? ""`);
  check(pageWords.includes("carry") || pageWords.includes("How far"), "their page tells nothing");
  await shot("2-people-page");
  await k(`globalThis.causalis.closePage?.()`);
  // 5. The first meeting, played from the world's panel by touch.
  const star = await ask<{ worlds: { folk?: { name: string; stage: string } }[] }>("galaxy.star", {
    ref: f.star,
  });
  check(
    !!star.worlds[f.planet]?.folk?.stage,
    "a star's readout does not say who lives on its world",
  );
  // (The film plays on: its parts are looked at as they come. Pressed by touch, as the owner would.)
  await k(`globalThis.causalis.open(${JSON.stringify(f.ref)})`);
  await settle(900);
  await page
    .getByRole("button", { name: /first meeting/i })
    .first()
    .tap();
  await until(
    "the ship over their world",
    async () =>
      k<boolean>(
        `globalThis.causalis.contactFilm.state().stage === "over" && globalThis.causalis.contactFilm.state().k > 0.45`,
      ),
    slow(90000),
  );
  const over = await k<{ words: string }>(`globalThis.causalis.contactFilm.state()`);
  say(`over: ${over.words}`);
  check(over.words.includes(f.name), "the film over their world does not name them");
  await shot("3-ship-over");
  await until(
    "the ship coming down",
    async () =>
      k<boolean>(
        `globalThis.causalis.contactFilm.state().stage === "down" && globalThis.causalis.contactFilm.state().k > 0.6`,
      ),
    slow(120000),
  );
  await shot("4-ship-down");
  await until(
    "the card",
    async () => k<boolean>(`globalThis.causalis.contactFilm.state().card`),
    slow(90000),
  );
  await settle(600);
  const card = await k<string>(`document.querySelector(".contact-card")?.innerText ?? ""`);
  say(`card: ${card.replace(/\s+/g, " ").slice(0, 300)}`);
  for (const word of ["Speak", "Breathe", "Eat", "Catch"])
    check(card.includes(word), `the card does not say ${word}`);
  await shot("5-contact-told");
  await page.locator(".contact-go").tap();
  await until(
    "the film's end",
    async () => k<boolean>(`!globalThis.causalis.contactFilm.playing`),
    slow(90000),
  );
  await settle(1500);
  // 4. On their ground: their own figures, told from it; one tapped gives a page.
  // (Their day: a save stands at a year's first midnight, and they sleep.)
  await k(`globalThis.causalis.client.advance(${Math.round(made.t + 86_400 * 0.45)})`);
  await settle(2500);
  const scale = await k<string>(`globalThis.causalis.scale()`);
  say(`after the film: ${scale}`);
  check(scale === "camp" || scale === "village", `after the film the eye is at ${scale}`);
  if (scale === "camp") {
    const n = await k<{
      people: number;
      onScreen: { id: number; at: { x: number; y: number } | null }[];
      names: string[];
      kinds: string[];
    }>(
      `(() => { const n = globalThis.causalis.near(); return { people: n.people, onScreen: n.onScreen, names: n.names, kinds: n.kinds }; })()`,
    );
    say(`${n.people} of them, among ${n.kinds.join(", ")}: ${n.names.slice(0, 3).join(", ")}`);
    check(n.people >= 6, "too few of them drawn at their camp");
    const spots = n.onScreen.flatMap((p) => (p.at ? [p.at] : []));
    // (No one stands in another: figures drawn no broader than the camp holds, as far apart as they are drawn.)
    let apart = 0;
    for (let i = 0; i < spots.length; i++) {
      let nearest = Infinity;
      for (let j = 0; j < spots.length; j++)
        if (j !== i)
          nearest = Math.min(
            nearest,
            Math.hypot(spots[i]!.x - spots[j]!.x, spots[i]!.y - spots[j]!.y),
          );
      if (nearest > 12) apart++;
    }
    say(`${apart} of ${spots.length} of them stand clear of the next on the screen`);
    check(apart >= Math.ceil(spots.length * 0.7), "their figures are piled on one another");
    const seen = await sightAt(spots, 26);
    say(`${seen.seen} of ${seen.of} of them can be told from the ground`);
    check(seen.seen >= Math.ceil(seen.of / 2) && seen.of > 0, "their figures can't be seen");
    await shot("6-camp");
    const one = spots.find((p) => p.y > 120 && p.y < 760) ?? spots[0];
    if (one) {
      await tap(one.x, one.y);
      await settle(500);
      const followed = await k<string | null>(`globalThis.causalis.near()?.followed ?? null`);
      say(`tapped: ${followed}`);
      check(!!followed, "a tap on one of them follows no one");
      const again = await k<{ id: number; at: { x: number; y: number } | null }[]>(
        `globalThis.causalis.near().onScreen`,
      );
      const who = await k<number>(
        `(() => { const n = globalThis.causalis.near(); return n.names.indexOf(n.followed); })()`,
      );
      const at = again[who]?.at ?? one;
      await tap(at.x, at.y);
      await settle(900);
      const words = await k<string>(`document.querySelector(".page-window")?.innerText ?? ""`);
      check(words.includes(f.name), "tapped twice, one of them gives no page of their people");
      await shot("7-one-tapped");
      await k(`globalThis.causalis.closePage?.()`);
    }
  } else await shot("6-town");
  await page.getByRole("button", { name: /^‹/ }).first().tap();
  await until(
    "back up to their world",
    async () => k<boolean>(`globalThis.causalis.scale() === "world"`),
    slow(60000),
  );
  await settle(1200);
  await shot("8-back-at-world");
  const panel = await k<string>(`document.querySelector("#hud")?.innerText ?? ""`);
  check(panel.includes(f.name), "their world's panel does not name them");
  // Down to them again, from their world's own panel, by touch.
  await page
    .getByRole("button", { name: /Go down to them/ })
    .first()
    .tap();
  await until(
    "down to them from their world's panel",
    async () => k<boolean>(`["camp", "village"].includes(globalThis.causalis.scale())`),
    slow(60000),
  );
  await settle(1500);
  await page.getByRole("button", { name: /^‹/ }).first().tap();
  await until(
    "back up to their world again",
    async () => k<boolean>(`globalThis.causalis.scale() === "world"`),
    slow(60000),
  );
  // Every people, on a page; one pressed gives theirs.
  await k(`globalThis.causalis.open("world:peoples")`);
  await settle(900);
  const peoples = await k<string>(`document.querySelector(".page-window")?.innerText ?? ""`);
  check(peoples.includes(f.name), `the page of all peoples does not name the ${f.name}`);
  await shot("8b-all-peoples");
  await page
    .locator(".page-window")
    .getByText(new RegExp(`The ${f.name}:`))
    .first()
    .tap();
  await until("that people's page", async () =>
    (await k<string>(`document.querySelector(".page-window")?.innerText ?? ""`)).includes(
      "rose on their world",
    ),
  );
  await k(`globalThis.causalis.closePage?.()`);
}

/** A living town of a people history does not follow: its folk, its lots, one tapped by touch. */
async function town() {
  const living = folks.find(
    (x) => !x.followed && ["towns", "cities", "villages"].includes(folkStage(x, year)),
  );
  if (!living) {
    say("no risen people in a town about these stars at this year");
    return;
  }
  await k(
    `(() => { void globalThis.causalis.toFolk(${JSON.stringify(living.star)}, ${living.planet}); return 0; })()`,
  );
  await until("their town", async () =>
    k<boolean>(
      `globalThis.causalis.scale() === "village" && !!globalThis.causalis.planNow()?.native`,
    ),
  );
  await settle(3000);
  const p = await k<{ name: string; people: number; lots: number; stage: string }>(
    `(() => { const p = globalThis.causalis.planNow(); return { name: p.name, people: p.people.length, lots: p.town?.lots ?? 0, stage: p.native.stage }; })()`,
  );
  say(`the ${living.name}, ${p.stage}: ${p.name}, ${p.people} drawn, ${p.lots} lots`);
  check(p.people > 0, "no one drawn in their town");
  check(p.lots > 0, "no lots in their town");
  const bar = await k<string>(`document.querySelector("#hud")?.innerText ?? ""`);
  check(bar.includes("Their world"), "the way back from their town does not say where it goes");
  check(
    !(await page.locator(".town-live").isVisible()),
    "Live here is offered in a town of another world",
  );
  await shot("9-town");
  const now = await k<{ index: number; x: number; z: number }[]>(`globalThis.causalis.peopleNow()`);
  let told = false;
  for (const one of now.slice(0, 40)) {
    const at = await k<{ x: number; y: number } | null>(
      `globalThis.causalis.personOnScreen?.(${one.index}) ?? null`,
    );
    if (!at || at.x < 20 || at.x > 410 || at.y < 240 || at.y > 880) continue;
    await tap(at.x, at.y);
    await settle(600);
    const words = await k<string>(`document.querySelector("#hud")?.innerText ?? ""`);
    if (words.includes(living.name) && words.includes("Their page")) {
      told = true;
      break;
    }
  }
  check(told, "a tap on one of their town gives no card of them");
  await shot("10-one-in-town");
}

async function ruins() {
  const file = ruinsFile;
  const r = file ? forge("alien", "cinder 570", file) : made;
  const y = Math.floor(r.t / YEAR),
    gone = folksNear(r.world).find((x) => folkStage(x, y) === "ruins");
  if (!gone) {
    say("no ruins about these stars at this year");
    return;
  }
  if (file) {
    await loadSave(r);
    await settle(1200);
  }
  say(`ruins: the ${gone.name} fell in ${gone.fell}: ${gone.fellWhy}`);
  await k(`globalThis.causalis.toFolk(${JSON.stringify(gone.star)}, ${gone.planet})`);
  await until("their ruins", async () => k<boolean>(`globalThis.causalis.scale() === "village"`));
  await settle(2500);
  await shot("11-ruins");
  const n = await k<number>(`globalThis.causalis.planNow()?.people.length ?? -1`);
  check(n === 0, `${n} folk in a world of ruins`);
  // (Lots that stand as ruins now, as the view reads them, against homes that stand with anyone's windows lit.)
  const fell = await k<{ fallen: number; homes: number; lots: number }>(
    `(() => { const s = globalThis.causalis.townLots?.(); return s ?? { fallen: -1, homes: -1, lots: 0 }; })()`,
  );
  say(`ruins: ${fell.fallen} lots fallen, ${fell.homes} homes standing, of ${fell.lots}`);
  check(fell.fallen > 0, "a world of ruins has no fallen lots");
  check(fell.homes === 0, `${fell.homes} homes stand whole in a world of ruins`);
  await k(`globalThis.causalis.open(${JSON.stringify(gone.ref)})`);
  await settle(900);
  const words = await k<string>(`document.querySelector(".page-window")?.innerText ?? ""`);
  check(/fell/i.test(words), "the ruined people's page does not say they fell");
  await shot("12-ruins-page");
  await k(`globalThis.causalis.closePage?.()`);
}

try {
  if (target) await watch();
  await town();
  await ruins();
} catch (e) {
  problems.push(`${(e as Error).message}\n${(e as Error).stack ?? ""}`);
}
for (const e of errors) problems.push(`in the page: ${e}`);
await browser.close();
await server.close();
if (problems.length) {
  console.error(`gate 77 FAILED:\n${problems.map((p) => `  - ${p}`).join("\n")}`);
  process.exit(1);
}
console.log("gate 77 passed");
process.exit(0);
