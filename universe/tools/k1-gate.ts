// node tools/k1-gate.ts [--ci] [--soft] [--shots dir] [--save file.save --universe earth|alien] [--young year] [--seed text]
// Knowledge that can be lost (K1). On a far save, else (as on CI) a young world run on; lands are made to fall by what their people come to, and
// the world's own rule does the rest:
//   1. nine in ten of a land's people gone: what goes is deepest first, what stands on nothing does not stay, and what it brought goes with it;
//   2. a land emptied whole, its town's archive standing; a craft whose only knowers are that land: lost to the world, kept in its ruin;
//   3. an old save loads with nothing lost and runs on; a save made after loads the same, and goes on the same;
//   4. new people there and the hands to hold it: found again from what was kept, far sooner than from nothing, and the page says from whose;
//   5. on the phone: a land's page and its Lost tab by touch; a craft's page; who was last; ⌖ Go to the archive; the archive pressed where it stands by
//      touch; a shut building and its page; the tree; The Years.
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
import { PRINCIPLES, PRINCIPLE_DEPTH, needsMet, principle } from "../src/rules/index.ts";
import {
  GREAT_DEPTH,
  loreOf,
  lostOf,
  lostYear,
  politiesOf,
  populationContext,
  townsOf,
  type Archive,
} from "../src/sim/index.ts";
import { archivePage, landLostBlocks, lostPage, shutFor } from "../src/host/inspect/lost.ts";
import { annalsRead } from "../src/host/inspect/annals.ts";
import { pageOf } from "../src/host/inspect/index.ts";

const argv = process.argv.slice(2),
  soft = argv.includes("--soft"),
  ci = argv.includes("--ci"),
  arg = (name: string) => {
    const at = argv.indexOf(name);
    return at >= 0 ? argv[at + 1] : undefined;
  },
  shots = arg("--shots"),
  saveFile = arg("--save"),
  u = (arg("--universe") ?? "earth") as "earth" | "alien",
  youngYear = Number(arg("--young") ?? 300),
  U = u === "earth" ? EARTH : ALIEN;
if (shots) mkdirSync(shots, { recursive: true });
const slow = (ms: number) => (ci || soft ? ms * 4 : ms),
  problems: string[] = [],
  check = (ok: boolean, what: string) => {
    if (!ok) problems.push(what);
  },
  say = (s: string) => console.log(`  ${s}`),
  line = (s: string, n = 700) => s.slice(0, n).replace(/\s*\n\s*/g, " | "),
  BAD =
    /undefined|NaN|\[object|\bnull\b|\b(ev|pol|war|cell):\d|Gone from the world|nothing is known of it/;
console.log("gate 103, knowledge that can be lost");

const open = (file: string): World => {
  const doc = JSON.parse(gunzipSync(readFileSync(file)).toString("utf8"));
  return loadWorld(doc, (s) => U.build(s), rulesetId(U.build(seedFromText(doc.seed)), U.version), {
    allowRulesetChange: true,
  }).world;
};
const world = saveFile ? open(saveFile) : U.build(seedFromText(arg("--seed") ?? "first light"));
const far = !!saveFile;
if (!saveFile) world.runTo(youngYear * YEAR);
const yearNow = () => Math.floor(world.now / YEAR);
const ctx = populationContext(world),
  lore = loreOf(world),
  store = lostOf(world);

// An old save: nothing here, and it runs on.
if (saveFile) {
  const opened = store.allOpen().length + store.archives.length;
  say(`a save from before the rule: ${opened} things lost in it at year ${yearNow()}`);
  check(
    opened === 0 || !/harrow|first_light--2000/.test(saveFile),
    "an old save loaded with something lost",
  );
}

/** A land's people cut to a share, as a plague or a sack leaves them: everything else is the world's own. */
function fall(cell: number, share: number): void {
  const p = ctx.provinces.get(cell)!,
    t = p.counts;
  for (let r = 0; r < t.rows; r++)
    for (let c = 0; c < t.cols; c++) t.set(r, c, Math.floor(t.get(r, c) * share));
  for (const s of ctx.settlements.inProvince(cell)) s.population = Math.floor(s.population * share);
}
/** Lands peopled, greatest first, with a town and a building that keeps things, or their people's own way. */
function candidates(): { cell: number; town: string; people: number }[] {
  const out: { cell: number; town: string; people: number }[] = [];
  for (const p of ctx.provinces.all()) {
    if (!p.total() || !lore.sizeOf(p.cell)) continue;
    const towns = ctx.settlements
      .inProvince(p.cell)
      .filter((s) => s.population > 0 && townsOf(world).get(s.ref));
    if (!towns.length) continue;
    out.push({ cell: p.cell, town: towns[0]!.ref, people: p.total() });
  }
  return out.sort((a, b) => b.people - a.people || a.cell - b.cell);
}
const lands = candidates();
check(lands.length >= 3, `only ${lands.length} lands to work with`);
const middle = Math.floor(lands.length / 2),
  hurt = lands[middle]!,
  gone = lands[Math.min(lands.length - 1, middle + 1)]!;
const year0 = yearNow(),
  knew = lore.sizeOf(hurt.cell),
  writingBefore = lore.effect(hurt.cell, "writing");
const sumOf = (cell: number, e: "farmYield" | "health") =>
  lore.of(cell).reduce((n, [id]) => n + (PRINCIPLES.find((p) => p.id === id)!.effects[e] ?? 0), 0);
say(
  `${world.seed.text} at ${year0}: nine in ten gone from land ${hurt.cell} (${hurt.people} people, ${knew} crafts); land ${gone.cell} emptied`,
);

// The craft whose only knowers are in the land emptied: the deepest it holds that nothing it holds stands on.
const only = lore
  .of(gone.cell)
  .map(([id]) => id)
  .sort((a, b) => (PRINCIPLE_DEPTH.get(b) ?? 0) - (PRINCIPLE_DEPTH.get(a) ?? 0))[0]!;
for (const c of lore.knowers(only)) if (c !== gone.cell) lore.forget(c, only);
check(
  lore.landsKnowing(only) === 1,
  `${only} has ${lore.landsKnowing(only)} knowers after the forge`,
);
// (Of a young land of 24,000, one in ten is hands enough for all its shallow crafts: on a young world it takes more than that.
// One in fifty was not enough either: a tenth of 470 is 47 hands, more than the 18 of every craft but those two steps deep, so
// a land of fifteen crafts most of them shallow lost none in twelve years one run in four, at the K1 merge as since. Down to one
// in two hundred, a dozen hands: what needs eighteen goes as the rule has it, what needs six stays.)
fall(hurt.cell, saveFile ? 0.1 : 0.005);
fall(gone.cell, 0);

const forged = yearNow();
// (At once: on a far world those next door have moved in within the year, and the rule must see it as it stood.)
lostYear(ctx, world.now);
check(!!lostOf(world).worldLoss(only), `${only}, its only land emptied, is not lost to the world`);
// (Down for some years, as a far land never is: else a far land is full again before anything has gone from it.)
if (far) for (let y = 1; y <= 6; y++) lostYear(ctx, (world.now + y * YEAR) as typeof world.now);
check(lore.sizeOf(gone.cell) === 0, `an emptied land still knows ${lore.sizeOf(gone.cell)} things`);
const worldEvent = lostOf(world).worldLoss(only)?.event;
// (A year's turn reads as the year it closes.)
const told = annalsRead(world, [forged - 1, forged]).flatMap((y) =>
  y.lines.map((l) => JSON.stringify(l.line)),
);
check(
  told.some((t) => /went from the world/.test(t)),
  `The Years of ${forged} don't tell ${only} going from the world: ${told.slice(0, 4).join(" | ").slice(0, 300)}`,
);
say(
  `The Years of ${forged}: ${told.find((t) => /went from the world/.test(t))?.slice(0, 260) ?? "nothing"}`,
);
void worldEvent;
const ruin = store.archivesIn(gone.cell)[0] as Archive | undefined;
say(
  `emptied: ${store.ofLand(gone.cell)?.size ?? 0} crafts gone, archive ${ruin ? `${ruin.form} ${ruin.civic} at ${ruin.name} holding ${ruin.crafts.length}` : "none"}`,
);
world.runTo((forged + 14) * YEAR);
{
  const people = ctx.provinces.get(gone.cell)!.total(),
    fed = ctx.history.yearsOf(gone.cell).at(-1)?.fed ?? 0;
  say(
    `${people} live there 14 years on, fed ${fed} of 1000; it has ${lore.sizeOf(gone.cell)} back; the archive read ${ruin?.read.length ?? 0} times; ${only}: ${lostOf(world).worldLoss(only) ? "still lost to the world" : "found again"}`,
  );
  // (Those who filled it came from next door, and they did not forget on the way.)
  if (far && people > 10000)
    check(
      lore.sizeOf(gone.cell) > 40 && fed > 500,
      `a land filled again by ${people} knows ${lore.sizeOf(gone.cell)} things, and is fed ${fed}`,
    );
}
const lostHere = [
  ...(store.ofLand(hurt.cell)?.values() ?? []),
  ...store.closed.filter((l) => l.cell === hurt.cell),
];
say(
  `nine in ten gone: ${lostHere.length} crafts lost in 12 years of ${knew}: ${lostHere
    .slice(0, 6)
    .map((l) => l.id)
    .join(", ")}`,
);
check(
  lostHere.length > 0 && lostHere.length < knew * 0.8,
  `a land nine in ten down lost ${lostHere.length} of ${knew}`,
);
// Nothing lost out from under what still stands.
for (const [id] of lore.of(hurt.cell)) {
  const p = principle(id);
  const stays = (x: string) =>
    x === "cultivation" || x === "metalworking" || !!lore.get(hurt.cell, x);
  if (!needsMet(p, stays) && lostHere.some((l) => p.needs.some((n) => n.split("|").includes(l.id))))
    check(false, `${id} stayed with what it needs lost`);
}
// What it brought goes with it.
check(
  Math.abs(lore.effect(hurt.cell, "farmYield") - sumOf(hurt.cell, "farmYield")) < 1e-9,
  "a land's totals are not what it still knows",
);
void writingBefore;
// A great loss, as a person has it: the deepest craft of a land of a realm, held nowhere else, its keepers razed, its people gone as this year turns.
let armed: string | null = null,
  armedTown: string | null = null;
if (far) {
  // (Long known there: what a land has just read back doesn't go in the same fall. And not the one just lost and found.)
  const longKnown = (cell: number) =>
    lore
      .of(cell)
      .filter(
        ([id, k]) =>
          id !== only && yearNow() - k.year > 20 && (PRINCIPLE_DEPTH.get(id) ?? 0) >= GREAT_DEPTH,
      )
      .map(([id]) => id);
  const land = lands.find(
    (l) =>
      l.cell !== hurt.cell &&
      l.cell !== gone.cell &&
      !!politiesOf(world).of(l.cell) &&
      longKnown(l.cell).length > 0,
  );
  if (land) {
    const deep = longKnown(land.cell).sort(
      (a, b) => (PRINCIPLE_DEPTH.get(b) ?? 0) - (PRINCIPLE_DEPTH.get(a) ?? 0),
    )[0]!;
    // (Kept nowhere: an archive that holds it makes its going no great news.)
    for (const a of lostOf(world).archives)
      (a as { crafts: string[] }).crafts = a.crafts.filter((x) => x !== deep);
    for (const c of lore.knowers(deep)) if (c !== land.cell) lore.forget(c, deep);
    // (And those next door, or they have filled it before the year has turned: nothing is lost by a land that isn't empty.)
    const g = ctx.generated;
    for (let i = g.grid.offsets[land.cell]!; i < g.grid.offsets[land.cell + 1]!; i++) {
      const n = g.grid.neighbours[i]!;
      if (ctx.provinces.get(n)) fall(n, 0);
    }
    for (const s of ctx.settlements.inProvince(land.cell))
      for (const c of townsOf(world).get(s.ref)?.civics ?? [])
        if (
          ["academy", "school", "observatory", "hall", "temple", "shrine"].includes(c.kind) &&
          c.fell === null
        )
          (c as { fell: number | null }).fell = yearNow();
    fall(land.cell, 0);
    armed = deep;
    armedTown = ctx.settlements.inProvince(land.cell)[0]?.ref ?? null;
    say(`next year: ${deep} goes with land ${land.cell}, kept nowhere`);
  }
  check(!!armed, "no land of a realm with a deep craft to lose");
}
// The last here who knows how: someone of a land that fell.
let lastHere: string | null = null;
for (const s of ctx.settlements.inProvince(hurt.cell).slice(0, 6)) {
  const plan = U.queries["village.plan"]!(world, {
    ref: s.ref,
    families: 10,
    folk: 220,
    figures: true,
  }) as { people?: { ref: string; child?: boolean }[] } | null;
  for (const p of (plan?.people ?? []).slice(0, 80)) {
    if (p.child || !p.ref.startsWith("agent:")) continue;
    if (/the last here who knows how/.test(JSON.stringify(pageOf(world, p.ref)))) {
      lastHere = p.ref;
      break;
    }
  }
  if (lastHere) break;
}
say(
  lastHere ? `the last here who knows how: ${lastHere}` : "no one there is the last who knows how",
);
// A save made now loads and goes on the same.
const pack = (w: World) => saveWorld(w, rulesetId(w, U.version), { universe: U.name });
const doc = pack(world),
  bytes = gzipSync(JSON.stringify(doc));
{
  const again = loadWorld(
    JSON.parse(JSON.stringify(doc)),
    (s) => U.build(s),
    rulesetId(U.build(seedFromText(doc.seed)), U.version),
  ).world;
  const fold = (w: World) => JSON.stringify(w.domainHashes());
  check(fold(again) === fold(world), "a save loaded does not hash as it was");
  say(
    `the store in a save: ${JSON.stringify(store.save()).length} bytes of json; the whole save ${(bytes.length / 1e6).toFixed(2)} MB`,
  );
}
// Every word read over.
const plain = (p: ReturnType<typeof lostPage>) =>
  JSON.stringify(p).replace(/"(ref|why|event|place|town|stone)":("[^"]*"|\{[^}]*\})|:null/g, "");
const wordsOf = [
  ...store
    .allOpen()
    .slice(0, 60)
    .map((l) => lostPage(world, `lost:${l.id}`)),
  ...store.archives.map((a) => archivePage(world, `archive:${a.n}`)),
];
for (const p of wordsOf)
  check(!BAD.test(plain(p)), `a bad word on ${p.ref}: ${plain(p).slice(0, 300)}`);
check(landLostBlocks(world, gone.cell).length > 0, "an emptied land's page has nothing lost on it");

// The browser.
const root = fileURLToPath(new URL("..", import.meta.url)),
  server = await preview({ root, logLevel: "silent", preview: { port: 4303, strictPort: false } }),
  base = server.resolvedUrls!.local[0]!,
  GPU = ["--use-angle=d3d11", "--ignore-gpu-blocklist", "--enable-gpu-rasterization"],
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
  if (m.type() === "error" && !/favicon|Failed to load resource/.test(m.text()))
    errors.push(m.text());
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
const shot = async (name: string) => {
  if (shots) await page.screenshot({ path: join(shots, `${name}.png`) });
};
const pageText = () =>
  k<string>(
    `(() => { const e = document.querySelector(".page-window"); return e && e.getBoundingClientRect().height > 0 ? e.innerText : ""; })()`,
  );
const pageNow = () => k<string | null>("globalThis.causalis.pageOpen()");
const closePage = async () => {
  await k(`globalThis.causalis.closePage?.()`);
  await page.waitForTimeout(slow(200));
};
const frames = () =>
  k(`new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(() => r(true))))`);
async function press(selector: string): Promise<boolean> {
  const where = () =>
    k<{ x: number; y: number } | null>(`(() => {
    for (const e of document.querySelectorAll(${JSON.stringify(selector)})) {
      e.scrollIntoView({ block: "center" });
      const r = e.getBoundingClientRect();
      if (r.width > 0 && r.height > 0) return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
    }
    return null;
  })()`);
  let at = await where();
  if (!at) {
    problems.push(`nothing to press at ${selector}`);
    return false;
  }
  for (let i = 0; i < 30; i++) {
    await frames();
    const now = await where();
    if (!now) break;
    if (now.x === at.x && now.y === at.y) break;
    at = now;
  }
  await page.touchscreen.tap(at.x, at.y);
  await page.waitForTimeout(slow(300));
  return true;
}
async function openPage(ref: string, want: RegExp, label: string): Promise<string> {
  await k(`globalThis.causalis.open(${JSON.stringify(ref)})`);
  await until(`${label}: its page`, async () => (await pageNow()) === ref);
  await until(`${label}: its words`, async () => want.test(await pageText()), slow(15000));
  const text = await pageText();
  check(want.test(text), `${label}: its page says "${line(text, 400)}"`);
  check(!BAD.test(text), `${label}: a bad word: ${line(text, 400)}`);
  say(`${label}: ${line(text, 420)}`);
  await shot(label);
  return text;
}

const name = `${u}:gate103`,
  q = `universe=${u}&seed=${encodeURIComponent(world.seed.text)}`;
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
    const b = Uint8Array.from(atob(data as string), (c) => c.charCodeAt(0));
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
    await c.importSave(b);
    await c.save(keep as string);
  },
  [bytes.toString("base64"), name],
);
await page.goto(`${base}?${q}&load=${encodeURIComponent(name)}&hold=1`);
await page.waitForFunction(
  () => ((globalThis as { causalis?: { drawn?: () => number } }).causalis?.drawn?.() ?? 0) > 0,
  undefined,
  { timeout: slow(180000) },
);
await page.waitForTimeout(slow(600));

// By day: what stands in a town is looked at as a person looks at it.
{
  const day = Math.ceil(world.now / 86400);
  await k(`globalThis.causalis.client.advance(${day * 86400 + 12 * 3600})`);
  await page.waitForTimeout(slow(400));
}
/** A shut building: its page, ⌖ Go to, there it stands. */
async function seeShut(town: string, c: { at: number; start: number; kind: string }) {
  const bldg = `bldg:${town}:${c.at}:${c.start}`;
  await openPage(bldg, /shut/i, "shut-building");
  await press(".page-window .go-to");
  await until("the shut building's page gone", async () => (await pageNow()) === null, slow(30000));
  // (By day: at midnight no one could say what stands shut.)
  const t = await k<number>("globalThis.causalis.client.status.t");
  await k(
    `globalThis.causalis.client.advance(${Math.floor(t / 86400) * 86400 + 86400 + 10 * 3600})`,
  );
  await until(
    "the morning it is seen in",
    async () =>
      (await k<number>("globalThis.causalis.client.status.t")) >=
      Math.floor(t / 86400) * 86400 + 86400 + 10 * 3600 - 1,
    slow(60000),
  );
  await page.waitForTimeout(slow(1600));
  for (let i = 0; i < 6; i++) await frames();
  await shot("shut-standing");
  await page.waitForTimeout(slow(600));
}
// A land's page, by its Lost tab, pressed.
const cellRefOf = (cell: number) => ctx.provinces.get(cell)!.ref;
await openPage(cellRefOf(gone.cell), /./, "land-emptied");
const tabAt = await k<number>(
  `[...document.querySelectorAll(".page-window .tabs .tab")].findIndex((b) => /^Lost/.test(b.textContent.trim()))`,
);
check(tabAt >= 0, "no Lost tab on a land's page");
if (tabAt >= 0) {
  await press(`.page-window .tabs .tab:nth-child(${tabAt + 1})`);
  // (On a far world what's lost is mostly back by now: what it came back to, and how.)
  const lostWords = far ? /What it came back to/i : /What it has lost/i;
  await until("the Lost tab's words", async () => lostWords.test(await pageText()));
  const t = await pageText();
  say(`Lost tab: ${line(t, 800)}`);
  check(lostWords.test(t), `the Lost tab says: ${line(t, 300)}`);
  check(
    !ruin || /What it still keeps/i.test(t),
    `an archive not on its land's page: ${line(t, 300)}`,
  );
  check(!BAD.test(t), `a bad word on the Lost tab: ${line(t, 300)}`);
  await shot("lost-tab");
}
await closePage();

// A craft lost to the world: its page says who, when, why, who has it now.
await openPage(`lost:${only}`, /Lost to the world/, "craft-lost-to-the-world");
await closePage();
// The tree says so.
await openPage(`prin:${only}`, /Lost to the world in year|Lost in \d+ land/i, "tree-principle");
await closePage();

// The archive: from its page ⌖ Go to, then pressed where it stands.
if (ruin) {
  await openPage(`archive:${ruin.n}`, /What it holds/i, "archive-page");
  await press(".page-window .go-to");
  await until("the archive's page gone", async () => (await pageNow()) === null, slow(60000));
  await until(
    "the archive's town",
    () =>
      k<boolean>(
        `globalThis.causalis.scale() === "village" && globalThis.causalis.planNow()?.ref === ${JSON.stringify(ruin.town)}`,
      ),
    slow(90000),
  );
  await page.waitForTimeout(slow(1600));
  await shot("archive-go-to");
  // What it can't work now stands shut.
  const shut = await k<{ at: number; start: number; kind: string }[]>(
    `(globalThis.causalis.planNow()?.town?.civics ?? []).filter((c) => c.shut)`,
  );
  say(`shut in ${ruin.name}: ${shut.map((c) => c.kind).join(", ") || "nothing"}`);
  if (shut[0]) await seeShut(ruin.town, shut[0]);
  const placed = await k<
    {
      ref: string;
      footX: number;
      footY: number;
      headY: number;
      worldX: number;
      worldZ: number;
      front: boolean;
    }[]
  >(`(globalThis.causalis.stones?.()?.list ?? [])`);
  const it = placed.find((s) => s.ref === `archive:${ruin.n}`);
  check(
    !!it,
    `the archive is not among what stands in ${ruin.name}: ${placed.map((s) => s.ref).join(", ")}`,
  );
  if (it) {
    let at: { px: number; py: number } | null = null;
    for (let tries = 0; tries < 5 && !at; tries++) {
      const now = await k<typeof placed>(`(globalThis.causalis.stones?.()?.list ?? [])`),
        s = now.find((x) => x.ref === it.ref);
      if (!s) break;
      await k(
        `globalThis.causalis.rig.flyTo({ target: { x: ${s.worldX * 0.1}, y: 0.4, z: ${s.worldZ * 0.1} }, distance: 5, pitch: -22 }, 0.3)`,
      );
      await page.waitForTimeout(slow(900));
      for (let i = 0; i < 6; i++) await frames();
      at = await k<{ px: number; py: number } | null>(`(() => {
        const s = (globalThis.causalis.stones?.()?.list ?? []).find((x) => x.ref === ${JSON.stringify(it.ref)});
        if (!s || !s.front) return null;
        for (const u of [0.5, 0.3, 0.7]) {
          const px = s.footX, py = s.footY + (s.headY - s.footY) * u;
          if (px < 12 || px > innerWidth - 12 || py < 12 || py > innerHeight - 12) continue;
          const e = document.elementFromPoint(px, py);
          if (e && e.tagName === "CANVAS") return { px, py };
        }
        return null;
      })()`);
    }
    check(!!at, "the archive is nowhere a finger can reach");
    if (at) {
      await shot("archive-standing");
      await page.touchscreen.tap(at.px, at.py);
      await until("the archive pressed", async () =>
        String((await pageNow()) ?? "").startsWith("archive:"),
      );
      await page.waitForTimeout(slow(350));
      const t = await pageText();
      check(/What it holds/i.test(t), `the archive pressed says: ${line(t, 300)}`);
      await shot("archive-pressed");
      await closePage();
    }
  }
}

// A shut building.
{
  let shutTown: string | null = null,
    shutKind = "";
  for (const s of ctx.settlements.inProvince(hurt.cell)) {
    const f = townsOf(world).get(s.ref);
    if (!f) continue;
    for (const c of f.civics) {
      if (c.fell !== null) continue;
      const list = store.ofLand(hurt.cell);
      if (!list) continue;
      const wanting = shutFor(world, hurt.cell, c.kind);
      if (wanting) {
        shutTown = s.ref;
        shutKind = c.kind;
        const bldg = `bldg:${s.ref}:${c.at}:${c.start}`;
        const p = pageOf(world, bldg);
        check(JSON.stringify(p).includes("shut"), `a shut ${c.kind} doesn't say so on its page`);
        break;
      }
    }
    if (shutTown) break;
  }
  say(shutTown ? `a shut ${shutKind} in ${shutTown}` : "no building shut in the land that fell");
}

if (lastHere) {
  await openPage(lastHere, /the last here who knows how/i, "the-last-here");
  await closePage();
}

// A great loss comes as a window to a person who follows nothing.
if (armed) {
  await k(`localStorage.setItem("causalis.events", "window")`);
  const t = await k<number>("globalThis.causalis.client.status.t");
  await k(`globalThis.causalis.client.advance(${(Math.floor(t / YEAR) + 1) * YEAR + 1})`);
  let told = "";
  await until(
    "the great loss's window",
    async () => {
      const seen = await k<string>(
        `(() => { const e = document.querySelector(".event-window"); return e && !e.hidden ? e.textContent : ""; })()`,
      );
      if (/no one living knows/i.test(seen)) {
        told = seen;
        return true;
      }
      if (seen) await k(`document.querySelector(".event-window .event-be")?.click()`);
      return false;
    },
    slow(60000),
  );
  say(`its window: ${line(told, 260)}`);
  await page.waitForTimeout(slow(500));
  await shot("great-loss-window");
  await k(`document.querySelector(".event-window .event-be")?.click()`);
  await k(`localStorage.removeItem("causalis.events")`);
  // What it can't work now stands shut, in the land that went.
  if (armedTown) {
    await k(`globalThis.causalis.goTo(${JSON.stringify(armedTown)})`);
    await until(
      "the town that went",
      () =>
        k<boolean>(
          `globalThis.causalis.scale() === "village" && globalThis.causalis.planNow()?.ref === ${JSON.stringify(armedTown)}`,
        ),
      slow(90000),
    );
    await page.waitForTimeout(slow(1000));
    const shut = await k<{ at: number; start: number; kind: string }[]>(
      `(globalThis.causalis.planNow()?.town?.civics ?? []).filter((c) => c.shut)`,
    );
    say(
      `shut where it went: ${
        shut
          .map((c) => c.kind)
          .slice(0, 12)
          .join(", ") || "nothing"
      }`,
    );
    check(shut.length > 0, "nothing stands shut in a town whose land has just gone");
    if (shut[0]) await seeShut(armedTown, shut[0]);
  }
}

check(errors.length === 0, `errors on the page: ${errors.slice(0, 3).join(" | ").slice(0, 600)}`);
await browser.close();
await server.close();

for (const p of problems) console.log(`  PROBLEM: ${p}`);
console.log(problems.length ? `gate 103: ${problems.length} problems` : "gate 103 passed");
process.exit(problems.length ? 1 : 0);
