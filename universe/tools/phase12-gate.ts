// node tools/phase12-gate.ts [--ci] [--soft] — the Phase 12 gate (docs/architecture §I.12,
// milestone 111), what the viewer asked for ("an ultimate low poly version of WorldBox but
// deeper … the depth of the game and its stats and lenses and the manipulation it offers, and it
// visualizes armies and battles very well"), done in a real browser on the built app:
//   1. the god's palette: an act taken in hand lights its reach under the pointer and says what
//      it will do; touched, it is cast, told, and plays where it fell;
//   2. the peoples in the god's hand: two realms at war made to make peace, then set at war
//      again, from the palette, each told; in a land, an act cast on the land itself;
//   3. more lenses: unrest, strength, wealth, knowledge, growth paint the map with their legends,
//      and a land's tooltip under one breaks its number down;
//   4. the world in numbers: its page, its charts through the years;
//   5. armies seen: hosts as large as the men they field, garrisons at the seats of realms at
//      peace, battles as two masses and their fallen; in a land, a host in its kinds under its
//      banners;
//   6. on a phone: the palette a button's sheet, its acts at hand.
// (npm run build first; --soft draws in software, as CI's browser does.)
import { fileURLToPath } from "node:url";
import { preview } from "vite";
import { chromium, type Page } from "playwright";

const ci = process.argv.includes("--ci"),
  soft = process.argv.includes("--soft");
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
console.log("the Phase 12 gate");

const root = fileURLToPath(new URL("..", import.meta.url)),
  server = await preview({ root, logLevel: "silent", preview: { port: 4264, strictPort: false } }),
  base = server.resolvedUrls!.local[0]!,
  browser = await chromium.launch({
    args: soft ? ["--use-angle=swiftshader", "--enable-unsafe-swiftshader"] : ci ? [] : GPU,
  }),
  page = await browser.newPage({ viewport: { width: 1366, height: 800 } });
const errors: string[] = [];
const listen = (p: Page) => {
  p.on("pageerror", (e) => errors.push(e.message));
  p.on("console", (m) => {
    if (m.type() === "error") errors.push(m.text());
  });
};
listen(page);
const k = <T>(code: string, on: Page = page): Promise<T> => on.evaluate(code) as Promise<T>;
const q = <T>(type: string, args: unknown = {}): Promise<T> =>
  k<T>(
    `globalThis.causalis.client.query({ type: ${JSON.stringify(type)}, args: ${JSON.stringify(args)} })`,
  );
const scale = () => k<string>("globalThis.causalis.scale()");
const title = () =>
  page.$eval(".page-window .page-title", (e) => e.textContent ?? "").catch(() => "");
const until = async (what: string, ok: () => Promise<boolean>, ms = 60000) => {
  const end = Date.now() + ms;
  while (Date.now() < end) {
    if (await ok()) return true;
    await page.waitForTimeout(250);
  }
  problems.push(`${what} did not come`);
  return false;
};
/** The middle of what a selector names on the screen, or null if it is not shown. */
const centre = (sel: string, on: Page = page) =>
  k<{ x: number; y: number } | null>(
    `(() => { const e = document.querySelector(${JSON.stringify(sel)}); if (!e) return null; const r = e.getBoundingClientRect(); return r.width ? { x: r.left + r.width / 2, y: r.top + r.height / 2 } : null; })()`,
    on,
  );
// (Pressed by the pointer as a viewer's is: Playwright's own checks wait for two frames alike,
// long where the frames come slowly, as in CI.)
const press = async (sel: string, on: Page = page) => {
  const at = await centre(sel, on);
  if (!at) {
    problems.push(`${sel} was not there to press`);
    return false;
  }
  await on.mouse.click(at.x, at.y);
  return true;
};
const words = () => page.$eval(".palette-words", (e) => e.textContent ?? "").catch(() => "");
/**
 * Turn the world to a spot, then take the pointer there as a viewer's hand would (moved onto
 * it, so the page sees it come), and — if asked — touch it. The screen point is read at once:
 * the orbit drifts when left.
 */
const point = async (spot: number, touch: boolean) => {
  await k(`globalThis.causalis.faceSpot(${spot}, 2.2)`);
  // Once the turn has come to rest (where frames come slowly it takes the longer), the orbit
  // kept from idling into its drift, the pointer is taken there.
  let at: { x: number; y: number } | null = null;
  for (const end = Date.now() + slow(8000); Date.now() < end;) {
    await k("globalThis.causalis.rig.idle = 0");
    await page.waitForTimeout(400);
    const now = await k<{ x: number; y: number } | null>(
      `globalThis.causalis.spotOnScreen(${spot})`,
    );
    const still = !!now && !!at && Math.hypot(now.x - at.x, now.y - at.y) < 1.5;
    at = now;
    if (still) break;
  }
  if (!at) return false;
  await k("globalThis.causalis.rig.idle = 0");
  await page.mouse.move(at.x - 8, at.y - 5);
  await page.mouse.move(at.x, at.y, { steps: 3 });
  if (touch) {
    await page.mouse.down();
    await page.mouse.up();
  } else await page.waitForTimeout(slow(800));
  return true;
};
/** The palette's act taken in hand, its kind's tab chosen first. */
const take = async (act: string, tab: string) => {
  await press(`.palette-tab[data-kind='${tab}']`);
  await page.waitForTimeout(200);
  await press(`.palette-act[data-act='${act}']`);
  await page.waitForTimeout(300);
  return k<string | null>("globalThis.causalis.palette.holding()");
};

await page.goto(`${base}?universe=earth&year=400`);
await page.waitForFunction(
  () => ((globalThis as any).causalis?.drawn?.() as number) > 0,
  undefined,
  { timeout: 900000 },
);
await k("globalThis.causalis.client.setSpeed(0)");
await page.waitForTimeout(1500);
type Side = { ref: string; name: string; fields: number };
type War = {
  ref: string;
  from: number;
  to: number;
  ended: number | null;
  attacker: Side;
  defender: Side;
  battles: { spot: number; year: number; fallen: number }[];
};
const people = await q<{ cell: number; centre: number; people: number }[]>("people.map"),
  most = [...people].sort((a, b) => b.people - a.people)[0]!;

// 1. The palette: rain taken in hand, its reach lit and said under the pointer; cast; it plays.
{
  const holding = await take("rain", "weather");
  await point(most.centre, false);
  const aimed = await words(),
    lit = (await k<[number, string][]>("globalThis.causalis.lit()")).length;
  await page.mouse.down();
  await page.mouse.up();
  const told = await until(
    "the rain cast",
    async () => (await words()).includes("Done"),
    slow(20000),
  );
  const acts = await q<{ acts: { kind: string }[] }>("acts.map");
  await page.mouse.move(30, 400);
  await page.waitForTimeout(slow(2500));
  const playing = await k<number>("globalThis.causalis.actsPlaying()"),
    drawn = await k<number>("globalThis.causalis.actsDrawn()");
  say(
    `the palette: ${holding} in hand; aimed: “${aimed}”, ${lit} land lit; cast: ${told}; playing ${playing}, ${drawn} marks drawn`,
  );
  check(holding === "rain", "the palette did not take rain in hand");
  check(/touch to cast/.test(aimed) && lit >= 1, "the palette's reach was not lit and said");
  check(
    acts.acts.some((a) => a.kind === "rain"),
    "the rain cast from the palette is not in force",
  );
  check(playing >= 1 && drawn > 0, "the rain does not play where it fell");
  await page.keyboard.press("Escape");
  check(
    (await k<string | null>("globalThis.causalis.palette.holding()")) === null,
    "Esc did not put the act down",
  );
}

// 2. The peoples: a war ended by the god's hand, then set going again, both from the palette.
const wars = await q<{ year: number; wars: War[] }>("wars.map"),
  fought = wars.wars.find((w) => w.ended === null) ?? null;
if (fought) {
  await take("peace", "peoples");
  await point(fought.from, true);
  await page.waitForTimeout(slow(1200));
  const first = await words();
  await point(fought.to, true);
  const made = await until("peace made", async () => (await words()).includes("Done"), slow(20000));
  const after = await q<{ wars: War[] }>("wars.map"),
    ended = after.wars.find((w) => w.ref === fought.ref)?.ended ?? null;
  await take("war", "peoples");
  await point(fought.from, true);
  await page.waitForTimeout(slow(1200));
  await point(fought.to, true);
  const set = await until("war set", async () => (await words()).includes("Done"), slow(20000));
  const again = (await q<{ wars: War[] }>("wars.map")).wars.find(
    (w) =>
      w.ref !== fought.ref &&
      w.attacker.ref === fought.attacker.ref &&
      w.defender.ref === fought.defender.ref &&
      w.ended === null,
  );
  const acts = await q<{ acts: { kind: string; to: unknown }[] }>("acts.map");
  say(
    `the peoples: “${first}”; peace made ${made} (the war ended year ${ended}); war set again ${set}: ${again ? "declared" : "not declared"}; threads playing: ${acts.acts.filter((a) => a.to).length}`,
  );
  check(made && ended !== null, "peace made from the palette did not end the war");
  check(set && !!again, "war set from the palette was not declared");
  check(
    acts.acts.some((a) => a.kind === "war" && a.to),
    "the war set does not play between the realms",
  );
  // The war's declaration cites the act: its why is the god's.
  if (again) {
    const page0 = await q<{ tabs: { blocks: { type: string; lines?: unknown }[] }[] }>("page", {
      ref: again.ref,
    });
    say(`its page: ${page0.tabs.length} tabs`);
  }
  await page.keyboard.press("Escape");
} else say("the peoples: no war fought to end (none this year)");

// 3. More lenses: each paints the map with its legend; a land's tooltip breaks its number down.
{
  const seen: string[] = [];
  for (const name of ["Unrest", "Strength", "Wealth", "Knowledge", "Growth"]) {
    await press(`.mapmodes .mode[aria-label='${name}']`);
    await page.waitForTimeout(slow(800));
    const legend = await page
      .$eval(".mapmodes .legend-title", (e) => e.textContent ?? "")
      .catch(() => "");
    if (legend === name) seen.push(name);
  }
  // (Growth shown: a land's tip under it.)
  await point(most.centre, false);
  const tipped = await until(
    "a land's tooltip under the growth lens",
    async () =>
      (
        await page
          .$eval(".tooltip", (e) => ((e as HTMLElement).hidden ? "" : (e.textContent ?? "")))
          .catch(() => "")
      ).includes("Growth:"),
    slow(15000),
  );
  const tip = await page.$eval(".tooltip", (e) => e.textContent ?? "").catch(() => "");
  say(`lenses: ${seen.join(", ")}; a land's tip under growth: “${tip.slice(0, 90)}”`);
  check(seen.length === 5, "the deeper lenses are not all there, with their legends");
  check(tipped, "a land's tooltip does not break its lens's number down");
  await press(".mapmodes .mode[aria-label='Land']");
  await page.mouse.move(30, 400);
}

// 4. The world in numbers: its page, and its charts through the years.
{
  await press(".world-menu button[title='Numbers']");
  await until(
    "the world's numbers",
    async () => (await title()).includes("The World in Numbers"),
    slow(20000),
  );
  const charts = await page.$$eval(".page-window svg", (x) => x.length);
  await press(".page-window .tab:nth-child(2)");
  await page.waitForTimeout(slow(800));
  const realms = await page.$$eval(".page-window svg", (x) => x.length);
  say(
    `the world in numbers: “${await title()}”, ${charts} charts of its people, ${realms} of its realms and wars`,
  );
  check(charts >= 3, "the world's numbers show too few charts");
  check(realms >= 2, "the realms' and wars' numbers show too few charts");
  await k(`document.querySelector(".page-window .close")?.click()`);
}

// 5. Armies seen: on the globe (hosts, garrisons, battles) and in a land (a host in its kinds).
{
  const now = await q<{ year: number; garrisons: { spot: number }[]; wars: War[] }>("wars.map"),
    marching = now.wars.find((w) => w.ended === null);
  type Armies = {
    globe: Record<"marching" | "garrison" | "battle" | "fallen" | "riders" | "tents", number>;
    land: Record<"spears" | "bows" | "riders" | "chariots" | "shields" | "banners", number>;
  };
  const armies = () => k<Armies>("globalThis.causalis.armies()");
  if (now.garrisons.length) {
    await k(`globalThis.causalis.faceSpot(${now.garrisons[0]!.spot}, 1.9)`);
    await page.waitForTimeout(slow(2000));
  }
  const globe = (await armies()).globe,
    battle = now.wars.flatMap((w) => w.battles).find((b) => b.year >= now.year - 1);
  say(
    `armies on the globe: ${globe.marching} marching, ${globe.garrison} in garrison, ${globe.battle} in battle, ${globe.fallen} fallen, ${globe.riders} riding, ${globe.tents} tents`,
  );
  check(!marching || globe.marching > 0, "no host marches on the globe");
  check(now.garrisons.length === 0 || globe.garrison > 0, "no garrison stands at a seat");
  check(
    !battle || (globe.battle > 0 && globe.fallen > 0),
    "a battle is not two masses and its fallen",
  );
  if (marching) {
    const cell = await k<number>(
      `globalThis.causalis.client.latestFrame("globe").arrays.province[${marching.to}]`,
    );
    await k(`globalThis.causalis.descend(${cell})`);
    await until("the land fought over", async () => (await scale()) === "region", slow(60000));
    await page.waitForTimeout(slow(3000));
    const land = (await armies()).land,
      marks = await k<{ marches: number }>("globalThis.causalis.landWars()"),
      kinds = land.spears + land.bows + land.riders + land.chariots + land.shields;
    say(
      `a host in a land: ${marks.marches} marching, armed ${kinds} (spears ${land.spears}, bows ${land.bows}, riders ${land.riders}, chariots ${land.chariots}, shields ${land.shields}), ${land.banners} banners`,
    );
    check(marks.marches >= 1, "no host marches in the land fought over");
    check(kinds > 0, "the host in the land does not bear its arms");
    check(land.banners >= 1, "the host in the land marches under no banner");
    // In the land, an act cast on the land itself.
    const held = await take("bounty", "yield"),
      canvas = await centre("canvas");
    if (canvas) {
      await page.mouse.move(canvas.x - 6, canvas.y);
      await page.mouse.move(canvas.x, canvas.y, { steps: 2 });
      await page.waitForTimeout(slow(600));
      await page.mouse.down();
      await page.mouse.up();
    }
    const blessed = await until(
      "a harvest blessed in the land",
      async () => (await words()).includes("Done"),
      slow(20000),
    );
    say(`in the land: ${held} in hand, cast on the land: ${blessed}`);
    await page.keyboard.press("Escape");
  }
}

// 6. On a phone: the palette a button's sheet.
{
  const phone = await browser.newPage({
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
  });
  listen(phone);
  await phone.goto(`${base}?universe=earth&seed=phone`);
  await phone.waitForFunction(
    () => ((globalThis as any).causalis?.drawn?.() as number) > 0,
    undefined,
    { timeout: 900000 },
  );
  const hidden = await k<boolean>(
    `getComputedStyle(document.querySelector("#hud > .palette")).display === "none"`,
    phone,
  );
  await press(".palette-toggle", phone);
  await phone.waitForTimeout(500);
  const open = await k<boolean>(
      `getComputedStyle(document.querySelector("#hud > .palette")).display !== "none"`,
      phone,
    ),
    tiles = await phone.$$eval(
      ".palette-act",
      (x) => x.filter((e) => (e as HTMLElement).offsetWidth > 0).length,
    );
  say(
    `on a phone: the palette put away ${hidden}, opened by its button ${open}, ${tiles} acts at hand`,
  );
  check(hidden && open && tiles >= 2, "on a phone the palette is not a button's sheet");
  await phone.close();
}

await browser.close();
await server.close();
const real = errors.filter((e) => !/favicon|ERR_ABORTED/i.test(e));
if (real.length) problems.push(...real.slice(0, 5).map((e) => `the page logged: ${e}`));
console.log();
if (problems.length) {
  for (const p of problems) console.log(`  ✗ ${p}`);
  console.log("the Phase 12 gate fails");
  process.exit(1);
}
console.log("the Phase 12 gate passes");
