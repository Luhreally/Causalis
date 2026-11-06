// node tools/phase66-gate.ts [--ci] [--soft] [--shots dir] [--baked file] [--frames] — the Phase 66 gate
// (the ages past ours, asked for 2026-11-03: "the ages past the ages humans experniced can still emerge,
// yk like down to star wars level eras etc, with logic there for it to emerge if present for that
// world"), on the built app at an iPhone 15 Plus's size, by touch:
//   1. the title offers the ages past ours, says what they take first, and its way there asks the year;
//   2. the picker lists the new ages and fits a phone, a reached one said by what the world calls it;
//   3. a far world opened: its age on the chip by its own name; the chip's page, what it can do, its six
//      measures past ours, its great works, and what its world's matter shuts off and why;
//   4. the world seen whole: its lands built over painted on the globe; the mirrors about its star, drawn and
//      told, with the way to their page;
//   5. its land: built over, no fields, no bands, towers on it;
//   6. its greatest town: towers past any others' height and the eye kept out of their walls, fliers in its sky, machine folk in its streets,
//      vat halls for fields; one of its made tapped, their card and their page and why;
//   7. a battle of its last wars: beams, not smoke; soldiers of made limbs who do not bleed; its arm's page
//      from the ground up; fought on streets; back in the town, the same arms seen;
//   8. its colonies, a world remade first in the list: its open air and its halls open; a sealed one's
//      towers; a landing's film showing what its first ship found, then its air and its green coming over
//      the years its town grows, and the world as it stands when it is done;
//   9. watching changed nothing; the world runs on from there and its save is whole.
// Its small world being a people of the water's (asked for 2026-11-05, "the overlays dont look right in
// the underwater cities/countries"), it also looks at what they hold where they hold it: a town seen from
// under its sea; its land's map with the town drawn on the seabed; the Realms lens on their sea's spots.
// On CI and by default the world is a small one that gets there ("kestrel 557", twelve lands, to year
// 2,400, a couple of minutes); --baked <file> takes the title's own world instead, Earth's "tide 207"
// at year 2,000 (or --seed another at --year another), and looks at it (a world that wants a quarter of
// an hour on a runner to reach).
// (npm run build first; --frames, with a GPU, measures the frames in the town.)
import { mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { gzipSync } from "node:zlib";
import { preview } from "vite";
import { chromium } from "playwright";
import { YEAR, rulesetId, saveWorld, seedFromText } from "../src/kernel/index.ts";
import { ALIEN, EARTH } from "../src/host/planet.ts";
import { battleNear } from "../src/host/battle.ts";
import { warsOf } from "../src/sim/index.ts";
import type { BattleNear } from "../src/bridge/index.ts";
import { armLook } from "../src/view/index.ts";
import { PAST_WORLD } from "../src/ui/jump.ts";

const argv = process.argv.slice(2),
  soft = argv.includes("--soft"),
  ci = argv.includes("--ci"),
  frames = argv.includes("--frames"),
  shotsAt = argv.indexOf("--shots"),
  shots = shotsAt >= 0 ? argv[shotsAt + 1] : undefined,
  bakedAt = argv.indexOf("--baked"),
  bakedFile = bakedAt >= 0 ? argv[bakedAt + 1] : undefined;
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

// The world: a small one run there, or the title's own world as baked.
const root = fileURLToPath(new URL("..", import.meta.url)),
  baked = join(root, "dist", "baked"),
  started = performance.now(),
  universe = bakedFile ? EARTH : ALIEN,
  chosen = argv.indexOf("--seed"),
  chosenYear = argv.indexOf("--year"),
  seed = bakedFile ? (chosen >= 0 ? argv[chosen + 1]! : PAST_WORLD.seed) : "kestrel 557",
  AT = bakedFile ? (chosenYear >= 0 ? Number(argv[chosenYear + 1]) : PAST_WORLD.year) : 2500;
let direct: unknown = null,
  /** A battle of the world's history fought with beams (the map of wars keeps only the last century's). */
  beamBattle: BattleNear | null = null,
  bytes: Buffer,
  ruleset: string;
{
  const world = universe.build(seedFromText(seed));
  ruleset = rulesetId(world, universe.version);
  if (bakedFile) bytes = readFileSync(bakedFile);
  else {
    world.runTo(AT * YEAR);
    direct = world.domainHashes();
    const battles = warsOf(world)
      .all()
      .flatMap((w) => w.battles)
      .sort((a, b) => b.year - a.year);
    for (const b of battles) {
      const n = battleNear(world, b.event);
      if (n && armLook(n.attacker.host?.arm).beam && armLook(n.defender.host?.arm).beam) {
        beamBattle = n;
        break;
      }
    }
    bytes = gzipSync(JSON.stringify(saveWorld(world, ruleset, { universe: universe.name })));
    say(`the world run to year ${AT} in ${((performance.now() - started) / 1000).toFixed(0)} s`);
  }
}
mkdirSync(baked, { recursive: true });
const file = `${universe.name}-${AT}.save`;
writeFileSync(join(baked, file), bytes);
writeFileSync(
  join(baked, "manifest.json"),
  JSON.stringify({
    worlds: [
      {
        universe: universe.name,
        seed,
        year: AT,
        file,
        bytes: bytes.length,
        ruleset,
      },
    ],
  }),
);

const server = await preview({
    root,
    logLevel: "silent",
    preview: { port: 4266, strictPort: false },
  }),
  base = server.resolvedUrls!.local[0]!,
  browser = await chromium.launch({
    args: soft ? ["--use-angle=swiftshader", "--enable-unsafe-swiftshader"] : ci ? [] : GPU,
  });
const context = await browser.newContext({
    viewport: { width: 430, height: 932 },
    // (Three times the pixels each way is nine times the drawing: without a graphics card, as on CI,
    // frames then outlast a tap's wait.)
    deviceScaleFactor: ci || soft ? 1 : 3,
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
const hashes = () => ask<unknown>("hashes");
const worldNow = () => ask<{ t: number }>("now");
const scale = () => k<string>("globalThis.causalis.scale()");
const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);
const text = (sel: string) =>
  k<string>(`document.querySelector(${JSON.stringify(sel)})?.textContent ?? ""`);
const fly = async (x: number, z: number, distance: number, pitch: number) => {
  await k(
    `globalThis.causalis.rig.flyTo({ target: { x: ${x * 0.1}, y: 0, z: ${z * 0.1} }, distance: ${distance}, pitch: ${pitch} })`,
  );
  await page.waitForTimeout(slow(1800));
};
/** How much of the middle of the screen has an edge in it: a plain sea has none, a town many. */
const busyAround = async (): Promise<number> => {
  const data = (await page.screenshot()).toString("base64");
  return page.evaluate(async (d) => {
    const bitmap = await createImageBitmap(
        await (await fetch(`data:image/png;base64,${d}`)).blob(),
      ),
      c = new OffscreenCanvas(bitmap.width, bitmap.height),
      x = c.getContext("2d")!;
    x.drawImage(bitmap, 0, 0);
    const w = bitmap.width,
      h = bitmap.height,
      px = x.getImageData(0, 0, w, h).data,
      sum = (i: number) => px[i]! + px[i + 1]! + px[i + 2]!;
    let sharp = 0,
      n = 0;
    for (let y = Math.floor(h * 0.42); y < h * 0.62; y++)
      for (let i = Math.floor(w * 0.1); i < w * 0.7; i += 2) {
        n++;
        if (Math.abs(sum((y * w + i) * 4) - sum((y * w + i + 1) * 4)) > 24) sharp++;
      }
    return n ? sharp / n : 0;
  }, data);
};
/**
 * Of a people of the water's sea spots on the screen (clear of the panels), the share that read their
 * realm's colour rather than the sea's, by the way each colour leans (a bright or a shaded one alike).
 */
const seaInItsRealms = async (): Promise<{ spots: number; share: number }> => {
  const spots = await page.evaluate(async () => {
      const c = (
          globalThis as unknown as {
            causalis: {
              client: {
                query(q: unknown): Promise<{ cell: number; realm: number[] | null }[]>;
                latestFrame(view: string): { arrays: Record<string, ArrayLike<number>> } | null;
              };
              spotOnScreen(spot: number): { x: number; y: number } | null;
            };
          }
        ).causalis,
        map = await c.client.query({ type: "people.map" }),
        f = c.client.latestFrame("globe")!,
        province = f.arrays.province!,
        elevation = f.arrays.elevation!,
        by = new Map(map.map((m) => [m.cell, m.realm])),
        out: { x: number; y: number; realm: number[] }[] = [];
      for (let s = 0; s < province.length; s++) {
        const realm = by.get(province[s]!);
        if (!realm || elevation[s]! > 0) continue;
        const at = c.spotOnScreen(s);
        if (at) out.push({ x: at.x, y: at.y, realm });
      }
      return out;
    }),
    data = (await page.screenshot()).toString("base64");
  return page.evaluate(
    async ([d, list]) => {
      const bitmap = await createImageBitmap(
          await (await fetch(`data:image/png;base64,${d as string}`)).blob(),
        ),
        c = new OffscreenCanvas(bitmap.width, bitmap.height),
        x = c.getContext("2d")!;
      x.drawImage(bitmap, 0, 0);
      const w = bitmap.width,
        h = bitmap.height,
        px = x.getImageData(0, 0, w, h).data,
        sea = [0.1, 0.25, 0.55],
        lean = (a: number[], b: number[]) =>
          (a[0]! * b[0]! + a[1]! * b[1]! + a[2]! * b[2]!) /
          (Math.hypot(a[0]!, a[1]!, a[2]!) * Math.hypot(b[0]!, b[1]!, b[2]!) || 1);
      let spots = 0,
        theirs = 0;
      for (const s of list as { x: number; y: number; realm: number[] }[]) {
        if (s.y < h * 0.45 || s.y > h * 0.95 || s.x < w * 0.02 || s.x > w * 0.7) continue;
        // (A realm of the sea's own colour says nothing either way.)
        if (lean(s.realm, sea) > 0.95) continue;
        const q = (Math.round(s.y) * w + Math.round(s.x)) * 4,
          p = [px[q]!, px[q + 1]!, px[q + 2]!];
        spots++;
        if (lean(p, s.realm) > lean(p, sea)) theirs++;
      }
      return { spots, share: spots ? theirs / spots : 0 };
    },
    [data, spots] as const,
  );
};
const toTown = async (ref: string) => {
  await k(`globalThis.causalis.goTo(${JSON.stringify(ref)})`);
  await until(`the town ${ref}`, async () =>
    k<boolean>(
      `globalThis.causalis.scale() === "village" && globalThis.causalis.planNow?.()?.ref === ${JSON.stringify(ref)}`,
    ),
  );
};
type Entry = {
  cell: number;
  town: string | null;
  name: string | null;
  body: string | null;
  kind: string | null;
  people: number;
  founded: number;
  remade: number;
};
type TownMap = { ref: string; name: string; cell: number; people: number };

try {
  // 1. The title's way, what it takes said first; its other way, among where a world may begin.
  await page.goto(base);
  await page.waitForSelector(".title-menu .choice", { timeout: slow(60000) });
  const past = page.locator(".title-menu .choice:has-text('Ages past ours')");
  check(await past.isVisible(), "the title offers no way to the ages past ours");
  await until("what it takes, said", async () =>
    new RegExp(PAST_WORLD.seed).test((await past.textContent()) ?? ""),
  );
  const said = (await past.textContent()) ?? "";
  say(`the title: “${said.replace(/\s+/g, " ")}”`);
  check(/minute/.test(said), `it does not say how long it takes: “${said}”`);
  await shot("01-title");
  await page.tap(".title-menu .choice:has-text('New world')");
  await page.tap(".choice:has-text('Ages past ours')");
  await page.waitForTimeout(300);
  check(
    (await page.inputValue('.seed-input, input[aria-label="The world\'s seed"]')) ===
      PAST_WORLD.seed,
    "the way past our ages did not choose the world run ahead",
  );
  await page.tap(".title-form .begin");
  await page.waitForURL(/year=2000.*past=1/, { timeout: slow(60000) });
  check(/universe=earth/.test(page.url()), `the way past our ages begins ${page.url()}`);

  // 2. The picker: the new ages, fitting a phone; those reached named by what their worlds call them.
  await page.goto(base);
  await page.waitForSelector(".title-menu .choice", { timeout: slow(60000) });
  await page.tap(".title-menu .choice:has-text('A world that gets there')");
  await page.waitForSelector(".picker .pick-age", { timeout: slow(30000) });
  for (const id of ["fusion", "minds", "beams", "bodies", "remade", "covered", "gathered"])
    check(
      (await page.locator(`.pick-age[data-id='${id}']`).count()) === 1,
      `the picker has no age “${id}”`,
    );
  const offScreen = await page.$$eval(
    ".picker .pick-age, .picker .pick-row, .picker h3",
    (list) =>
      list.filter((e) => {
        const r = e.getBoundingClientRect();
        return r.width > 0 && (r.left < 0 || r.right > innerWidth + 0.5);
      }).length,
  );
  check(offScreen === 0, `${offScreen} of the picker's rows run off a phone's screen`);
  await page.tap(".picker .choice:has-text('Never seen')");
  await page.tap(".pick-age[data-id='gathered']");
  await page.waitForTimeout(slow(600));
  await shot("02-picker");
  say(`the picker, a star gathered: ${(await text(".picker")).replace(/\s+/g, " ").slice(0, 200)}`);
  // (The worlds that came to it, run in full, and each opens in its greatest town.)
  await until(
    "the worlds that gathered their stars",
    async () => (await page.$$(".pick-run")).length > 0,
    slow(30000),
  );
  say(`worlds run in full that gathered their stars: ${(await page.$$(".pick-run")).length}`);
  await page.locator(".pick-run").first().tap();
  await page.waitForSelector(".pick-more .pick-open", { timeout: slow(10000) });
  await shot("02b-picker-row");
  await page.locator(".pick-more .pick-open").first().tap();
  await page.waitForURL(/past=1/, { timeout: slow(30000) });

  // 3. A far world, the chip and its page. (Gates are spared the opening's news unless they ask.)
  await page.goto(
    `${base}?universe=${universe.name}&seed=${encodeURIComponent(seed)}&year=${AT}&hold&past=1`,
  );
  const loadT = Date.now();
  await until(
    "the first picture",
    () => k<boolean>("(globalThis.causalis?.drawn?.() ?? 0) > 0"),
    slow(180000),
  );
  say(`the first picture in ${((Date.now() - loadT) / 1000).toFixed(1)} s`);
  check((await worldNow()).t === AT * YEAR, `it stands at ${(await worldNow()).t / YEAR}`);
  const before = await hashes();
  if (direct) check(same(before, direct), "the world fetched is not the world run there");
  // (It begins in its greatest town: ?past.)
  await until("its greatest town", async () => (await scale()) === "village", slow(120000));
  await page.waitForTimeout(slow(1500));
  await shot("03-opened-in-its-greatest-town");
  const stage = await ask<{ id: string; name: string } | null>("world.stage");
  say(`its age: ${stage?.id} “${stage?.name}”`);
  check(
    ["gathered", "covered", "remade", "bodies", "beams", "minds", "fusion"].includes(
      stage?.id ?? "",
    ),
    `it stands at ${stage?.id}`,
  );
  const chip = await k<{ words: string; right: number } | null>(`(() => {
    const e = document.querySelector(".stat-chip.stage");
    if (!e) return null;
    return { words: e.textContent ?? "", right: e.getBoundingClientRect().right };
  })()`);
  check(!!chip && chip.words.includes(stage?.name ?? "?"), `the chip says “${chip?.words}”`);
  check(!!chip && chip.right <= 430, "the chip runs off a phone's screen");
  await k(`globalThis.causalis.open("world:means")`);
  await until("the page of what it can do", async () =>
    /What it can do/.test(await text(".page-window")),
  );
  await page.waitForTimeout(slow(500));
  await shot("04-what-it-can-do");
  const means = await text(".page-window");
  check(/Great works/.test(means), "the page has no tab of great works");
  await page.tap(".page-window button:has-text('Great works')");
  await until("its great works", async () => /mirror/i.test(await text(".page-window")));
  const works = await text(".page-window");
  say(`its great works: ${works.replace(/\s+/g, " ").slice(0, 300)}`);
  await shot("05-great-works");
  for (const id of ["energy", "computing", "materials", "precision", "life", "reach"]) {
    await k(`globalThis.causalis.open("means:${id}")`);
    await until(`the page of ${id}`, async () =>
      (await text(".page-window")).includes("What brings it"),
    );
  }
  // Each new step has a page, saying what it asks of its world's matter.
  for (const id of [
    "fusion-power",
    "machine-minds",
    "drawn-carbon",
    "beam-arms",
    "made-bodies",
    "machine-soldiers",
    "star-mirrors",
    "vat-food",
    "world-making",
    "world-city",
  ]) {
    const p = await ask<{ title?: string } | null>("page", { ref: `prin:${id}` });
    check(!!p?.title && p.title !== "Nothing is known of it", `no page for ${id}`);
  }
  const fusion = await ask<unknown>("page", { ref: "prin:fusion-power" });
  check(
    /Asks of its world/.test(JSON.stringify(fusion)),
    "a step past ours does not say what it asks of its world's matter",
  );
  await k("globalThis.causalis.closePage()");

  // 4. Out to its land, by its town's own button.
  const built = await ask<number[]>("past.lands");
  say(`lands built over: ${built.length}`);
  check(built.length > 0, "no land reads as built over");
  const top = (await ask<TownMap | null>("past.town"))!;
  say(`its greatest town: ${top.name}, ${top.people.toLocaleString("en")} people`);
  // (A people of the water's town: seen from under their sea.)
  if (!bakedFile)
    check(
      (await k<string | undefined>("document.body.dataset.colony")) === "air",
      "a town of a people of the water is not seen under their sea",
    );
  await page.locator("button:has-text('‹ The land'):visible").first().tap();
  await until("its land", async () => (await scale()) === "region", slow(60000));
  await until(
    "its land's towns",
    async () => (await k<{ parts: number }>("globalThis.causalis.land()")).parts > 0,
    slow(60000),
  );
  await page.waitForTimeout(slow(1500));
  const land = await k<{ parts: number; fields: number; camps: number }>(
    "globalThis.causalis.land()",
  );
  say(`its land: ${JSON.stringify(land)}`);
  if (built.includes(top.cell)) {
    check(land.fields === 0, `a land built over has ${land.fields} fields`);
    check(land.camps === 0, `a land built over has ${land.camps} camps of bands`);
    check(land.parts > 5000, `a land built over has only ${land.parts} parts`);
  }
  await shot("06-its-land");
  // (A people of the water's towns stand on the seabed: seen from over them, not a plain sea.)
  if (!bakedFile) {
    const on = await k<{ x: number; z: number; r: number } | null>(
      `globalThis.causalis.landTown(${JSON.stringify(top.ref)})`,
    );
    check(!!on, `its land draws no ${top.name}`);
    if (on) {
      await k(
        `globalThis.causalis.rig.flyTo({ target: { x: ${on.x}, y: 0, z: ${on.z} }, yaw: 0, pitch: -62, distance: ${on.r * 2.2} }, 0.05)`,
      );
      await page.waitForTimeout(slow(1800));
      const busy = await busyAround();
      say(`over ${top.name} on its land's map, under the sea: ${(busy * 100).toFixed(1)}% edges`);
      check(busy > 0.08, `${top.name} is not to be seen on its land's map (${busy.toFixed(3)})`);
      await shot("06a-its-town-on-the-seabed");
    }
  }

  // 5. The world seen whole: its lands built over painted on its face, and said in its legend.
  await page.locator("button:has-text('‹ The world'):visible").first().tap();
  await until("the world seen whole", async () => (await scale()) === "globe", slow(60000));
  await until("its legend", async () => /built over/.test(await text("#hud")), slow(30000));
  await page.waitForTimeout(slow(800));
  await shot("06b-the-world-seen-whole");
  // (A people of the water's lands are its sea: a realm's colour there, and not plain water.)
  if (!bakedFile) {
    await page.locator('.mapmodes .mode[aria-label^="Realms"]').first().click({ force: true });
    await page.waitForTimeout(slow(1500));
    const seen = await seaInItsRealms();
    say(
      `their sea under the Realms lens: ${seen.spots} spots, ${seen.share.toFixed(2)} in its colour`,
    );
    check(seen.spots > 8, `too few of their sea's spots on the screen (${seen.spots})`);
    check(seen.share > 0.6, `their sea does not read their realms (${seen.share.toFixed(2)})`);
    await shot("06b2-their-realms");
    await page.locator('.mapmodes .mode[aria-label^="Land"]').first().click({ force: true });
    await page.waitForTimeout(slow(500));
  }

  // Its star: the mirrors about it, drawn and told, and the way to their page.
  await k("globalThis.causalis.sky()");
  await until(
    "the star's system",
    async () => (await k<number>("globalThis.causalis.skyBodies()")) > 0,
    slow(60000),
  );
  await until(
    "the mirrors about its star",
    async () => ((await k<number | null>("globalThis.causalis.skyMirrors()")) ?? 0) > 100,
    slow(60000),
  );
  say(`the mirrors drawn: ${await k<number>("globalThis.causalis.skyMirrors()")} glints`);
  await shot("06c-its-star");
  await page.locator("button.line:has-text('km² about it'):visible").first().tap();
  await until(
    "the mirrors' page",
    async () =>
      k<boolean>(
        `!!document.querySelector(".page-window")?.textContent?.includes("Mirrors about its star")`,
      ),
    slow(60000),
  );
  await k("globalThis.causalis.closePage()");

  // 6. Its greatest town.
  await toTown(top.ref);
  await page.waitForTimeout(slow(1500));
  check(
    await k<boolean>(`document.body.dataset.mirrors === "1"`),
    "its star's mirrors are not in the sky over its ground",
  );
  const plan = await k<{
    people: number;
    past: { machines: number; fliers: number; covered: boolean } | null;
    made: { name: string; ref: string; role: string; index: number } | null;
    top: number;
    lots: number;
  }>(`(() => {
    const p = globalThis.causalis.planNow();
    const i = p.people.findIndex((q) => q.machine);
    return {
      people: p.people.length,
      past: p.past ?? null,
      made: i < 0 ? null : { name: p.people[i].name, ref: p.people[i].ref, role: p.people[i].role, index: i },
      top: Math.max(0, ...p.town.runs.map((r) => r[5])),
      lots: p.town.lots,
    };
  })()`);
  say(`the town: ${JSON.stringify(plan)}`);
  check(!!plan.past, "the town knows nothing past our ages");
  check(plan.top === 6, `its highest homes are of level ${plan.top}, not spires`);
  check((plan.past?.fliers ?? 0) > 0, "no craft in its sky");
  check(!!plan.made, "no one of made limbs among those drawn");
  await fly(0, 0, 90, -8);
  await shot("07-town");
  // (Come in close: over its spires, what stands in the way cut, not a wall across the screen.)
  check(await k<boolean>(`globalThis.causalis.rig.spires`), "the eye not told it is among spires");
  await fly(0, 0, 40, -8);
  await shot("08-town-among-them");
  // (Its works, drawn at the rim of what is drawn of it, and each a page.)
  const itsWorks = await k<
    { kind: string; at: number; truly?: number; start: number; lots: number }[]
  >(
    `globalThis.causalis.planNow().town.civics.filter((c) => c.kind === "fusion" || c.kind === "minds" || c.kind === "vats")`,
  );
  say(`its works: ${itsWorks.map((c) => c.kind).join(", ")}`);
  if (bakedFile)
    check(
      itsWorks.some((c) => c.kind === "fusion"),
      "no fusion works drawn in a town that has them",
    );
  for (const c of itsWorks.slice(0, 1)) {
    const p = await ask<unknown>("page", {
      ref: `bldg:${(await k<{ ref: string }>(`globalThis.causalis.planNow()`)).ref}:${c.truly ?? c.at}:${c.start}`,
    });
    check(
      /works|mind|vat/i.test(JSON.stringify(p)),
      `the page of its ${c.kind}: ${JSON.stringify(p).slice(0, 120)}`,
    );
  }
  if (frames) {
    await fly(0, 0, 90, -8);
    const fps = await k<{ mean: number; slowest: number }>(`new Promise((done) => {
      const out = [];
      let last = performance.now();
      const step = (t) => {
        out.push(t - last);
        last = t;
        if (out.length < 90) requestAnimationFrame(step);
        else {
          out.shift();
          done({ mean: out.reduce((a, b) => a + b, 0) / out.length, slowest: Math.max(...out) });
        }
      };
      requestAnimationFrame(step);
    })`);
    say(`its frames: ${fps.mean.toFixed(1)} ms, slowest ${fps.slowest.toFixed(1)} ms`);
  }
  // One of its made, near; their card; their page, and why.
  if (plan.made) {
    const madePage = await ask<unknown>("page", { ref: plan.made.ref });
    check(
      /A mind of crystal/.test(JSON.stringify(madePage)),
      "one of made limbs has no word of it on their page",
    );
    check(/of made limbs/.test(plan.made.role), `their card says “${plan.made.role}”`);
    say(`one of them: ${plan.made.name}, ${plan.made.role}`);
  }

  // 7. Its last wars: a battle with beams.
  const wars = await ask<{
    wars: { battles: { event: string; fallen: number; year: number }[] }[];
  }>("wars.map");
  const fought = wars.wars
    .flatMap((w) => w.battles)
    .sort((a, b) => b.year - a.year || b.fallen - a.fallen)
    .slice(0, 60);
  let near: BattleNear | null = beamBattle;
  for (const b of near ? [] : fought) {
    const n = await ask<BattleNear | null>("battle.near", { event: b.event });
    if (!n) continue;
    const beams = (s: BattleNear["attacker"]) => !!armLook(s.host?.arm).beam;
    if (beams(n.attacker) && beams(n.defender)) {
      near = n;
      break;
    }
    if (!near && (beams(n.attacker) || beams(n.defender))) near = n;
  }
  check(!!near, "no battle of its history was fought with beams");
  if (near) {
    say(`a battle: ${near.attacker.kit} against ${near.defender.kit}`);
    check(
      await k<boolean>(`globalThis.causalis.watchBattleNear(${JSON.stringify(near)})`),
      "the battle not watched",
    );
    await until(
      "the battle's field",
      async () =>
        (await k<{ event: string } | null>("globalThis.causalis.battle?.() ?? null"))?.event ===
        near!.event,
      slow(60000),
    );
    await k(`globalThis.causalis.battleAt(26, 0)`);
    await page.waitForTimeout(slow(900));
    await shot("09-battle-fire");
    const seen = await k<{ words: string; bolts: number; smoke: number }>(
      `globalThis.causalis.battle()`,
    );
    say(`at 26 s: “${seen.words}”, ${seen.bolts} beams in the air, ${seen.smoke} of smoke`);
    let most = seen.bolts;
    for (const s of [26.1, 26.2, 26.3, 27, 28, 30, 32]) {
      await k(`globalThis.causalis.battleAt(${s}, 0)`);
      await page.waitForTimeout(ci || soft ? 300 : 120);
      most = Math.max(most, await k<number>(`globalThis.causalis.battle().bolts`));
    }
    check(most > 0, "no beam in the air as they fired");
    if (armLook(near.attacker.host?.arm).beam && armLook(near.defender.host?.arm).beam)
      check(seen.smoke === 0, `${seen.smoke} of smoke where only beams are borne`);
    await k(`globalThis.causalis.battleAt(110, 0)`);
    await page.waitForTimeout(slow(900));
    await shot("10-battle-after");
    const blood = await k<number>(`globalThis.causalis.battle().blood`);
    say(`after: ${blood} pools of blood`);
    const machines =
      near.attacker.host?.mount === "machine-host" && near.defender.host?.mount === "machine-host";
    if (machines)
      check(blood === 0, `soldiers of made limbs, burned by beams, lie in ${blood} pools of blood`);
    // Its arm, from the ground up.
    const arm = await ask<unknown>("page", { ref: `arm:${near.event}:0:0` });
    const told = JSON.stringify(arm);
    check(
      /crystal/i.test(told) || !armLook(near.attacker.host?.arm).beam,
      "the page of a beam arm does not tell its crystal",
    );
    check(!/wooden|stock of/.test(told), "a beam arm's page speaks of wood");
    await page.locator("button:has-text('‹ The land'):visible").first().tap();
    await until("back out of the battle", async () => (await scale()) !== "battle", slow(30000));
  }

  // 8. Its colonies.
  const colonies = (await ask<Entry[]>("colony.list")).filter((c) => c.town);
  say(
    `its colonies: ${colonies.map((c) => `${c.name} ${c.people} (${Math.round(c.remade * 100)}%)`).join("; ")}`,
  );
  const remade = colonies.find((c) => c.remade >= 1),
    being = colonies.find((c) => c.remade > 0 && c.remade < 1),
    // (The list by touch: a world remade comes first in it, and says so.)
    firstRow = async () => {
      await page.tap(".colonies-button");
      await page.waitForSelector(".colony-row", { timeout: slow(10000) });
      await shot("10b-the-worlds-settled");
      const said = (await page.locator(".colony-row").first().textContent()) ?? "";
      await page.tap(".colony-sheet-head button[aria-label='Close the worlds settled']");
      return said;
    },
    sealed = [...colonies].filter((c) => !c.remade).sort((a, b) => b.people - a.people)[0];
  check(!bakedFile ? !!remade : true, "no world of it has been remade");
  if (remade) {
    const row = await firstRow();
    check(/remade/.test(row), `the list does not begin with its world remade: “${row}”`);
    await toTown(remade.town!);
    await page.waitForTimeout(slow(1200));
    const r = await k<{
      air: string;
      remade: number;
      sealed: boolean;
      dataset: string | undefined;
    }>(`(() => {
      const p = globalThis.causalis.planNow();
      return { air: p.colony?.air, remade: p.colony?.remade, sealed: !!p.town?.sealed, dataset: document.body.dataset.colony };
    })()`);
    say(`a world remade, ${remade.name}: ${JSON.stringify(r)}`);
    check(r.air === "breathable", `a world remade has air “${r.air}”`);
    check(!r.sealed, "a world remade still has its people under their halls");
    await fly(0, 0, 70, -2);
    await shot("11-world-remade");
    // Its landing's film: what its first ship found.
    const found = await ask<{ look: { air: string; remade?: number } }>("colony.look", {
      cell: remade.cell,
      landing: true,
    });
    check(
      found.look.air !== "breathable" || !found.look.remade,
      "the landing's film shows the world as remade",
    );
    // And played: its first ship on the world it found, its air and its green coming over the years.
    type Film = { stage: string | null; k: number; remade: number; words: string };
    const film = () => k<Film>(`globalThis.causalis.colonyFilm.state()`),
      airNow = () => k<string | undefined>(`document.body.dataset.colony`);
    await k(`void globalThis.causalis.colonyFilm.play(${remade.cell})`);
    await until(
      "the film at its ground",
      async () => (await film()).stage === "first",
      slow(120000),
    );
    const first = await film(),
      firstAir = await airNow();
    await shot("11b-its-first-ship");
    check(first.remade < 1, `its first ship came down on a world already remade (${first.remade})`);
    let last = first,
      lastAir = firstAir,
      saying = "";
    await until(
      "the film's end",
      async () => {
        const f = await film();
        if (f.stage === "growth" && f.k > 0.5 && !saying) {
          saying = f.words;
          await shot("11c-being-remade");
        }
        if (f.stage !== "growth") return f.stage === null;
        last = f;
        lastAir = await airNow();
        return f.k > 0.97;
      },
      slow(120000),
    );
    say(
      `its film: found ${first.remade} under “${firstAir}”, ${last.remade} under “${lastAir}” by its end; “${saying}”`,
    );
    await shot("11d-remade");
    check(last.remade > first.remade, "the film did not play its world's remaking");
    check(lastAir === "air", `a world remade is under “${lastAir}” at its film's end`);
    await k(`globalThis.causalis.colonyFilm.skip()`);
    await until(
      "the film over",
      async () =>
        (await film()).stage === null &&
        !(await k<boolean>(`globalThis.causalis.colonyFilm.playing`)),
      slow(60000),
    );
    const after = await k<{ air: string | undefined; sky: string | undefined }>(
      `({ air: globalThis.causalis.planNow()?.colony?.air, sky: document.body.dataset.colony })`,
    );
    check(
      after.sky === "air" && after.air === "breathable",
      `after its film: ${JSON.stringify(after)}`,
    );
  }
  if (being) say(`being remade: ${being.name}, ${Math.round(being.remade * 100)}%`);
  if (sealed) {
    await toTown(sealed.town!);
    await page.waitForTimeout(slow(1200));
    await fly(0, 0, 90, -2);
    const s = await k<{ sealed: boolean; past: unknown }>(`(() => {
      const p = globalThis.causalis.planNow();
      return { sealed: !!p.town?.sealed, past: p.past ?? null };
    })()`);
    say(`a sealed colony, ${sealed.name}: ${JSON.stringify(s)}`);
    check(s.sealed, "a colony on a world not remade is not sealed");
    await shot("12-sealed-colony");
  }

  // 9. Nothing changed by being watched; and it runs on, whole.
  check(same(before, await hashes()), "watching the ages past ours changed the world");
  const t = await worldNow();
  await k(`globalThis.causalis.client.advance(${Math.round(t.t + 30 * 86_400)})`);
  await until("the clock going on", async () => (await worldNow()).t > t.t, slow(60000));
  const saved = await k<{ bytes: number }>(`globalThis.causalis.client.save("phase 66 gate")`);
  say(`its save: ${(saved.bytes / 1e6).toFixed(2)} MB`);
  check(saved.bytes > 0, "its save failed");
} catch (e) {
  problems.push(`stopped: ${(e as Error).stack ?? e}`);
  await shot("99-where-it-stopped").catch(() => {});
}
for (const e of errors) problems.push(`error in the page: ${e.slice(0, 400)}`);
await browser.close();
await new Promise<void>((done) => server.httpServer.close(() => done()));
rmSync(baked, { recursive: true, force: true });
console.log(
  `Phase 66 gate: ${((performance.now() - started) / 1000).toFixed(0)} s, ${problems.length} problems`,
);
for (const p of problems) console.log(`  - ${p}`);
process.exit(problems.length ? 1 : 0);
