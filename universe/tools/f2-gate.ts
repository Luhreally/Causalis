// node tools/f2-gate.ts [--ci] [--soft] [--shots dir]: gate 69b, F2 and F3 (heat, not fire) at a phone's size.
// A small methane world, "wren 455", is run on in node by tens from 400 to 1100 until a land knows a hearth of
// joined acetylene and has a town. That year (AT) and that town are kept; and from the same run the year before
// (BEFORE), a town in a land without the hearth, with the world as it stood then (its save is kept too). Searched
// for, not pinned. Then:
//   1. the world opened at AT, held, its hash as it was run there;
//   2. that town flown into: its plan not fireless, its homes with hearths, and at 22 o'clock its picture with
//      more warm-lit pixels than the dark town's picture at BEFORE (when there is a BEFORE);
//   3. the principle of joined acetylene: titled so, asking its matter with a tick, not shut, about 1670 °C,
//      and an estimate;
//   4. the principle of pots: "vessels of tholin fired hard", wanting 700 °C;
//   5. bronze shut for want of a hardener; the steam engine shut for want of fire, and driven by an engine when
//      one is known;
//   6. the world's matter page, "Its furnaces": joined acetylene, mirrors too little to work with, the electric
//      arc, and the page says these are estimates;
//   7. read directly, in node: Earth's reach true; a rocky land held; kestrel 557 out of reach; north 155's
//      mirrors between 1500 and 1700 °C (read before the browser starts);
//   8. the world's hash as it was, and no error in the page (then the dark town of BEFORE, as in 2).
// (npm run build first; the gate writes its saves and manifest into dist/baked.)
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { gzipSync } from "node:zlib";
import { preview } from "vite";
import { chromium } from "playwright";
import { YEAR, rulesetId, saveWorld, seedFromText, type World } from "../src/kernel/index.ts";
import { ALIEN, EARTH } from "../src/host/planet.ts";
import { meansOfWorld } from "../src/gen/index.ts";
import { OWN_ENGINES, reachIn } from "../src/rules/index.ts";
import { homePlanet, loreOf, populationContext } from "../src/sim/index.ts";

const argv = process.argv.slice(2),
  soft = argv.includes("--soft"),
  ci = argv.includes("--ci"),
  shotsAt = argv.indexOf("--shots"),
  shots = shotsAt >= 0 ? argv[shotsAt + 1] : undefined;
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

const SEED = "wren 455",
  SEARCH_FROM = 400,
  SEARCH_TO = 1100,
  SEARCH_BY = 10,
  HEARTH = "joined-hearth",
  DAY = 86_400,
  HOUR = 3_600,
  NIGHT_HOUR = 22;

/** A town with people in it, and the land it stands in. */
type Town = { ref: string; name: string; cell: number; people: number };
/** The year before AT in the same run: a town of a land without the hearth, and the world as it stood then. */
type Before = { year: number; town: Town; bytes: Buffer };

/** Every town with people in it, the largest first (ties by ref, so every run reads the same). */
const townsNow = (world: World): Town[] =>
  populationContext(world)
    .settlements.all()
    .filter((t) => t.population > 0)
    .map((t) => ({ ref: t.ref, name: t.name, cell: t.cell, people: t.population }))
    .sort((a, b) => b.people - a.people || (a.ref < b.ref ? -1 : 1));

const knowsHearth = (world: World, cell: number) => !!loreOf(world).get(cell, HEARTH);
const saveBytes = (world: World, ruleset: string) =>
  gzipSync(JSON.stringify(saveWorld(world, ruleset, { universe: ALIEN.name })));

/** The first year a land with a town knows the hearth; the year before, from the same run, a town without it. */
function search(world: World, ruleset: string): { at: number; town: Town; before: Before | null } {
  let before: Before | null = null;
  for (let y = SEARCH_FROM; y <= SEARCH_TO; y += SEARCH_BY) {
    world.runTo(y * YEAR);
    const towns = townsNow(world),
      hit = towns.find((t) => knowsHearth(world, t.cell));
    if (hit) return { at: y, town: hit, before };
    const dark = towns.find((t) => !knowsHearth(world, t.cell));
    before = dark ? { year: y, town: dark, bytes: saveBytes(world, ruleset) } : null;
  }
  throw new Error(
    `no hearth of joined acetylene in a land with a town by year ${SEARCH_TO} on ${SEED}`,
  );
}

// The year is searched for in the world's own run, then its save and manifest are written as f1's are.
const root = fileURLToPath(new URL("..", import.meta.url)),
  baked = join(root, "dist", "baked"),
  started = performance.now(),
  alien = ALIEN.build(seedFromText(SEED)),
  ruleset = rulesetId(alien, ALIEN.version),
  { at: AT, town, before } = search(alien, ruleset),
  direct = alien.domainHashes(),
  bytes = saveBytes(alien, ruleset);
const file = `alien-${AT}.save`,
  worlds = [{ universe: ALIEN.name, seed: SEED, year: AT, file, bytes: bytes.length, ruleset }];
mkdirSync(baked, { recursive: true });
writeFileSync(join(baked, file), bytes);
if (before) {
  const beforeFile = `alien-${before.year}.save`;
  writeFileSync(join(baked, beforeFile), before.bytes);
  worlds.push({
    universe: ALIEN.name,
    seed: SEED,
    year: before.year,
    file: beforeFile,
    bytes: before.bytes.length,
    ruleset,
  });
}
writeFileSync(join(baked, "manifest.json"), JSON.stringify({ worlds }));
say(
  `${SEED} run to year ${AT} in ${((performance.now() - started) / 1000).toFixed(0)} s: a hearth of joined acetylene known in a land with a town, ${town.name} (${town.people} people, land ${town.cell}); ${
    before
      ? `the year before, ${before.town.name} (${before.town.people} people, land ${before.town.cell}) in a land without it`
      : "no town of a land without it the year before"
  }`,
);

// The engines known by then, on any land (the steam engine's page says what drives its works, if one is).
const lore = loreOf(alien),
  lands = populationContext(alien).provinces.all(),
  engines = OWN_ENGINES.filter((id) => lands.some((p) => lore.get(p.cell, id)));
say(`its engines known by year ${AT}: ${engines.join(", ") || "none"}`);

// 7. The rules read directly, in node (before the browser starts).
const earthReach = reachIn(
    meansOfWorld(homePlanet(EARTH.build(seedFromText("first light"))).generated),
    () => false,
  ),
  rocky = meansOfWorld(homePlanet(ALIEN.build(seedFromText("cinder 570"))).generated),
  kestrelReach = reachIn(
    meansOfWorld(homePlanet(ALIEN.build(seedFromText("kestrel 557"))).generated),
    () => false,
  ),
  north = meansOfWorld(homePlanet(ALIEN.build(seedFromText("north 155"))).generated),
  northMirror = north.heats.find((h) => h.id === "mirror")?.heat;
say(
  `read in node: Earth's reach ${earthReach}; cinder 570, a rocky land, held ${rocky.held}; kestrel 557's reach ${kestrelReach}; north 155's mirrors ${northMirror} °C`,
);
check(earthReach === true, `Earth's reachIn is ${earthReach}, not true`);
check(rocky.held === true, "a rocky land (cinder 570) is not held");
check(kestrelReach === false, `kestrel 557's reachIn is ${kestrelReach}, not false`);
check(
  northMirror !== undefined && northMirror >= 1500 && northMirror <= 1700,
  `north 155's mirrors are ${northMirror} °C, not between 1500 and 1700`,
);

/** A page's title, words, facts (label and value) and tables (title and rows), read in one evaluate. */
type PageNow = {
  title: string;
  words: string;
  facts: { label: string; value: string }[];
  tables: { title: string; rows: string[][] }[];
};
/** The flight's plan, read in one evaluate: absent `fireless` is null; the homes are the plan's hearths. */
type Flown = {
  ref: string;
  name: string;
  scale: string;
  fireless: true | null;
  hearths: number;
  buildings: number;
};

const server = await preview({
    root,
    logLevel: "silent",
    preview: { port: 4270, strictPort: false },
  }),
  base = server.resolvedUrls!.local[0]!,
  browser = await chromium.launch({
    args: soft ? ["--use-angle=swiftshader", "--enable-unsafe-swiftshader"] : ci ? [] : GPU,
  });
const context = await browser.newContext({
    viewport: { width: 430, height: 932 },
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
const hashes = () => k<unknown>(`globalThis.causalis.client.query({ type: "hashes", args: {} })`);
const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);
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
const pageNow = () =>
  k<PageNow>(`(() => ({
    title: document.querySelector(".page-title")?.textContent ?? "",
    words: document.querySelector(".page-window")?.textContent ?? "",
    facts: [...document.querySelectorAll(".page-window .fact")].map((f) => ({
      label: f.querySelector(".fact-label")?.textContent ?? "",
      value: f.querySelector(".fact-value")?.textContent ?? "",
    })),
    tables: [...document.querySelectorAll(".page-window h3")].flatMap((h) => {
      const rows = h.nextElementSibling?.querySelectorAll("tbody tr");
      return rows
        ? [
            {
              title: h.textContent ?? "",
              rows: [...rows].map((tr) => [...tr.querySelectorAll("td")].map((td) => td.textContent ?? "")),
            },
          ]
        : [];
    }),
  }))()`);
const open = (ref: string) => k(`globalThis.causalis.open(${JSON.stringify(ref)})`);
/** A page opened afresh (the one before closed): read once its title is in and `ok` says its words are. */
const pageWhen = async (ref: string, ok: (p: PageNow) => boolean): Promise<PageNow> => {
  await k("globalThis.causalis.closePage()");
  await open(ref);
  const seen: { page?: PageNow } = {};
  await until(`the page of ${ref}`, async () => {
    const p = await pageNow();
    if (p.title === "" || p.title === "…" || !ok(p)) return false;
    seen.page = p;
    return true;
  });
  return seen.page ?? (await pageNow());
};
/** Flown into a town: its plan shown, and the flight over. */
const flyTo = async (ref: string) => {
  await k(`globalThis.causalis.goTo(${JSON.stringify(ref)})`).catch((e: Error) =>
    problems.push(`going to ${ref}: ${e.message}`),
  );
  await until(
    `the plan of ${ref}`,
    () =>
      k<boolean>(`(() => {
        const c = globalThis.causalis;
        return c.scale() === "village" && c.planNow()?.ref === ${JSON.stringify(ref)};
      })()`),
    slow(120000),
  );
  await k(
    `(async () => { for (let i = 0; i < 100 && globalThis.causalis.rig.flying; i++) await new Promise((r) => setTimeout(r, 100)); })()`,
  );
  await page.waitForTimeout(slow(600));
};
/** The plan of the town flown into, read in one evaluate. */
const flownNow = () =>
  k<Flown>(`(() => {
    const c = globalThis.causalis, p = c.planNow();
    return {
      ref: p?.ref ?? "",
      name: p?.name ?? "",
      scale: c.scale(),
      fireless: p?.fireless ?? null,
      hearths: p?.homes.length ?? 0,
      buildings: p?.town?.civics.length ?? 0,
    };
  })()`);
/** The clock set to an hour of its day, and held there: the picture is taken by that night. */
const atHour = (hour: number) =>
  k<number>(`(async () => {
    const c = globalThis.causalis, { t } = await c.client.advance(0), of = t % ${DAY};
    return (await c.client.advance(t - of + (of < ${hour * HOUR} ? 0 : ${DAY}) + ${hour * HOUR})).t;
  })()`);
/** The warm-lit pixels of the town in a picture (a lit window's yellow: the bars and buttons about it left out), counted where it is decoded. */
const litPixels = (png: Buffer) =>
  page.evaluate(async (base64: string) => {
    const bytes = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0)),
      bitmap = await createImageBitmap(new Blob([bytes], { type: "image/png" })),
      canvas = document.createElement("canvas");
    canvas.width = bitmap.width;
    canvas.height = bitmap.height;
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    if (!ctx) throw new Error("no 2D canvas to read the picture with");
    ctx.drawImage(bitmap, 0, 0);
    const data = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
    let lit = 0;
    const w = canvas.width,
      top = Math.round(canvas.height * 0.27),
      bottom = Math.round(canvas.height * 0.9),
      right = Math.round(w * 0.86);
    for (let y = top; y < bottom; y++)
      for (let x = 0; x < right; x++) {
        const i = (y * w + x) * 4;
        if (data[i]! > 180 && data[i + 1]! > 130 && data[i]! - data[i + 2]! > 40) lit++;
      }
    return lit;
  }, png.toString("base64"));
const oneLine = (s: string, n: number) => s.replace(/\s+/g, " ").slice(0, n);

// 1. The world at AT, held; its hash as it was run there.
await page.goto(`${base}?universe=alien&seed=${encodeURIComponent(SEED)}&year=${AT}&hold`);
await until(
  "the first picture",
  () => k<boolean>("(globalThis.causalis?.drawn?.() ?? 0) > 0"),
  slow(180000),
);
const hashed = await hashes();
check(same(hashed, direct), "the world fetched is not the world run there");

// 2. That town flown into, and its night picture counted.
await flyTo(town.ref);
const flown = await flownNow();
say(
  `${flown.name} (${flown.ref}), ${flown.scale}: fireless ${flown.fireless ?? "absent"}; ${flown.hearths} homes with hearths; ${flown.buildings} buildings of its plan`,
);
check(flown.ref === town.ref, `the plan is of ${flown.ref}, not ${town.ref}`);
check(flown.fireless === null, `its plan is fireless: ${JSON.stringify(flown.fireless)}`);
check(flown.hearths > 0, "its plan has no homes with hearths");
await atHour(NIGHT_HOUR);
// (The clock moved on to that night: what is read now is to leave it as it stands.)
const heldAt = await hashes();
await page.waitForTimeout(slow(1500));
const nightPng = await page.screenshot({ scale: "css" }),
  litAt = await litPixels(nightPng);
if (shots) writeFileSync(join(shots, "town-night.png"), nightPng);
say(`at ${NIGHT_HOUR} o'clock its picture has ${litAt} warm-lit pixels`);

// 3. The principle of joined acetylene.
const joined = await pageWhen(`prin:${HEARTH}`, (p) => p.words.includes("Needs first"));
const asked = joined.facts.find((f) => f.label === "Asks of its world's matter")?.value ?? "";
say(`“${joined.title}”: asks “${oneLine(asked, 160)}”`);
check(
  joined.title === "A hearth of joined acetylene",
  `the hearth's principle is titled “${joined.title}”`,
);
check(/✓[^✓✗]{0,12}join acetylene/.test(asked), `the hearth's asks show no tick: “${asked}”`);
check(!joined.words.includes("On this world"), "the hearth's principle says it is shut here");
check(/1,?670 °C/.test(joined.words), "the hearth's page has no 1670 °C");
check(/estimate/.test(joined.words), "the hearth's page says nothing of estimates");
await shot("joined");

// 4. The principle of pots: the vessels its tholin makes.
const pots = await pageWhen("prin:pottery-wheel", (p) => p.words.includes("Needs first"));
const wants = pots.facts.find((f) => f.label === "Wants")?.value ?? "";
say(`“${pots.title}”: wants “${wants}”`);
check(/tholin fired hard/.test(pots.title), `the pots' principle is titled “${pots.title}”`);
check(/700 °C/.test(wants), `the pots want “${wants}”, not 700 °C`);
await shot("pots");

// 5. Bronze shut for want of a hardener; the steam engine shut for want of fire.
const bronze = await pageWhen("prin:bronze", (p) => p.words.includes("Needs first"));
const bronzeShut = bronze.facts.find((f) => f.label === "On this world")?.value ?? "";
say(`bronze: ${bronzeShut ? `“${oneLine(bronzeShut, 160)}”` : "not shut"}`);
check(/harden copper/.test(bronzeShut), `bronze's shut line is “${bronzeShut}”`);
const steam = await pageWhen("prin:steam-engine", (p) => p.words.includes("Needs first"));
say(
  `the steam engine: ${oneLine(steam.facts.find((f) => f.label === "On this world")?.value ?? "not shut", 160)}`,
);
check(/nothing burns/.test(steam.words), "the steam engine's page does not say nothing burns");
if (engines.length)
  check(
    /driven by/.test(steam.words),
    `the steam engine's page does not say what drives its works, though ${engines.join(", ")} is known`,
  );

// 6. The world's matter page: its furnaces.
const matter = await pageWhen("world:matter#world", (p) => p.words.includes("Its furnaces"));
const furnaces = matter.tables.find((t) => t.title === "Its furnaces");
check(!!furnaces, "the matter page has no table titled Its furnaces");
const names = furnaces?.rows.map((r) => r[0] ?? "") ?? [];
for (const want of ["Joined acetylene", "Mirrors", "The electric arc"])
  check(
    names.some((n) => n.startsWith(want)),
    `Its furnaces has no row ${want}: ${names.join(", ")}`,
  );
const mirrors = furnaces?.rows.find((r) => (r[0] ?? "").startsWith("Mirrors"));
say(`its furnaces: ${(furnaces?.rows ?? []).map((r) => r.join(" | ")).join("; ")}`);
check(/too little/.test(mirrors?.[1] ?? ""), `the mirrors' heat is “${mirrors?.[1] ?? "absent"}”`);
check(/estimate/.test(matter.words), "the matter page says nothing of estimates");
await shot("furnaces");

// 8. The world as it was when read first; no error in the page (so far).
check(same(await hashes(), heldAt), "the world's hash changed while its pages were read");

// 2 again, the year before (BEFORE): a town of a land without the hearth, flown into; its night counted.
if (before) {
  await page.goto(
    `${base}?universe=alien&seed=${encodeURIComponent(SEED)}&year=${before.year}&hold`,
  );
  await until(
    "the first picture of the year before",
    () => k<boolean>("(globalThis.causalis?.drawn?.() ?? 0) > 0"),
    slow(180000),
  );
  await flyTo(before.town.ref);
  const dark = await flownNow();
  say(
    `the year before, ${before.year}: ${dark.name} (${dark.ref}), fireless ${dark.fireless ?? "absent"}, ${dark.hearths} homes with hearths`,
  );
  check(dark.fireless === true, `the town of the year before is not fireless: ${dark.fireless}`);
  await atHour(NIGHT_HOUR);
  await page.waitForTimeout(slow(1500));
  const darkPng = await page.screenshot({ scale: "css" }),
    litDark = await litPixels(darkPng);
  if (shots) writeFileSync(join(shots, "town-dark.png"), darkPng);
  say(
    `at ${NIGHT_HOUR} o'clock that picture has ${litDark} warm-lit pixels, against ${litAt} at ${AT}`,
  );
  check(
    litAt > litDark,
    `the lit town (${litAt} warm pixels) is not more lit than the dark one (${litDark})`,
  );
} else say("no town of a land without the hearth the year before: its picture is not compared");

// No error in the page.
check(errors.length === 0, `errors in the page: ${errors.slice(0, 3).join(" | ")}`);

console.log(
  `F2 gate (69b): ${((performance.now() - started) / 1000).toFixed(0)} s, ${problems.length} problems`,
);
for (const p of problems) console.log(`  - ${p}`);
await browser.close();
await server.close();
process.exit(problems.length ? 1 : 0);
