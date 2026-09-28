// node tools/phase13-gate.ts [--ci] [--soft] — the Phase 13 gate (docs/architecture §I.13,
// milestone 116), still at the user's WorldBox-but-deeper asking, done in a real browser on the
// built app:
//   1. disasters from the palette: the ground shaken, fire from the sky and its crater, a river
//      raised (or its refusal told where no river runs);
//   2. makings: settlers sent, a realm blessed, two realms made one (the one taken in gone);
//   3. a battle played out in its land: its hosts fight, and some fall;
//   4. a realm's army (its host, the men it fields, its wars) and a war's course.
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
console.log("the Phase 13 gate");

const root = fileURLToPath(new URL("..", import.meta.url)),
  server = await preview({ root, logLevel: "silent", preview: { port: 4265, strictPort: false } }),
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

/** Cast the act in hand on a spot: touched, and told (done, or refused and why). */
const cast = async (spot: number, what: string) => {
  await point(spot, true);
  let told = "";
  await until(
    what,
    async () => {
      told = await words();
      return /Done|cannot|no river|no one|is no realm|not at war|already/.test(told);
    },
    slow(20000),
  );
  return told;
};
const lands = [...people].sort((a, b) => b.people - a.people);

// 1. Disasters: the ground shaken, fire from the sky (a crater left), a river raised.
{
  await take("quake", "disasters");
  const quake = await cast(lands[0]!.centre, "the ground shaken");
  await take("meteor", "disasters");
  const meteor = await cast(lands[2]!.centre, "fire from the sky");
  // (A river land, if the greatest lands have one; else the refusal is told.)
  await take("flood", "weather");
  const flood = await cast(lands[1]!.centre, "a river raised");
  const acts = await q<{ acts: { kind: string }[] }>("acts.map"),
    kinds = new Set(acts.acts.map((a) => a.kind));
  say(`disasters: “${quake}” · “${meteor}” · “${flood}”; playing: ${[...kinds].sort().join(", ")}`);
  check(quake.includes("Done") && kinds.has("quake"), "the ground was not shaken from the palette");
  check(
    meteor.includes("Done") && kinds.has("meteor") && kinds.has("crater"),
    "fire from the sky did not fall, or left no crater",
  );
  check(
    (flood.includes("Done") && kinds.has("flood")) || flood.includes("no river"),
    "a river raised was neither done nor refused",
  );
  await page.keyboard.press("Escape");
}

// 2. Makings: settlers sent, a realm blessed, two realms made one.
{
  await take("settle", "wonders");
  const settled = await cast(lands[3]!.centre, "settlers sent");
  await take("bless", "realms");
  const blessed = await cast(lands[4]!.centre, "a realm blessed");
  const wars = await q<{ wars: War[] }>("wars.map"),
    pair = wars.wars.find((w) => w.ended === null) ?? wars.wars[0];
  let united = "no two realms at hand",
    gone = false;
  if (pair) {
    await take("union", "peoples");
    await point(pair.from, true);
    await page.waitForTimeout(slow(1200));
    united = await cast(pair.to, "two realms made one");
    const realms = await q<{ ref: string }[]>("realms.map");
    gone = !realms.some((r) => r.ref === pair.defender.ref);
  }
  const acts = await q<{ acts: { kind: string }[] }>("acts.map"),
    kinds = new Set(acts.acts.map((a) => a.kind));
  say(`makings: “${settled}” · “${blessed}” · “${united}”; the realm taken in gone: ${gone}`);
  check(settled.includes("Done") && kinds.has("settle"), "settlers were not sent from the palette");
  check(blessed.includes("Done") && kinds.has("bless"), "a realm was not blessed from the palette");
  check(!pair || (united.includes("Done") && gone), "two realms were not made one");
  await page.keyboard.press("Escape");
}

// 3. A battle played out in its land: its hosts fight and fall.
{
  const now = await q<{ year: number; wars: War[] }>("wars.map"),
    battle = now.wars.flatMap((w) => w.battles).find((b) => b.year >= now.year - 1);
  if (battle) {
    const cell = await k<number>(
      `globalThis.causalis.client.latestFrame("globe").arrays.province[${battle.spot}]`,
    );
    await k(`globalThis.causalis.descend(${cell})`);
    await until("the land of the battle", async () => (await scale()) === "region", slow(60000));
    type Land = { fought: number; fallen: number };
    const fought = await until(
      "the battle fought out, and its fallen",
      async () => {
        const l = (await k<{ land: Land }>("globalThis.causalis.armies()")).land;
        return l.fought > 0 && l.fallen > 0;
      },
      slow(45000),
    );
    const land = (await k<{ land: Land }>("globalThis.causalis.armies()")).land;
    say(`a battle played out in its land: ${land.fought} fought, ${land.fallen} fallen`);
    check(fought, "a battle in its land was not played out");
    await k("globalThis.causalis.zoomThrough('out')");
    await until("the world again", async () => (await scale()) === "globe", slow(30000));
  } else say("a battle played out: none fought this year or last");
}

// 4. A realm's army and a war's course.
{
  const realms = (await q<{ ref: string; people: number }[]>("realms.map")).sort(
    (a, b) => b.people - a.people,
  );
  await k(`globalThis.causalis.open(${JSON.stringify(`${realms[0]!.ref}#army`)})`);
  await until(
    "a realm's army",
    async () =>
      (await page.$eval(".page-window", (e) => e.textContent ?? "").catch(() => "")).includes(
        "Fields",
      ),
    slow(20000),
  );
  const army = await page.$eval(".page-window", (e) => e.textContent ?? "").catch(() => ""),
    wars = await q<{ wars: War[] }>("wars.map"),
    war = wars.wars.find((w) => w.battles.length > 0);
  let course = 0;
  if (war) {
    await k(`globalThis.causalis.open(${JSON.stringify(`${war.ref}#course`)})`);
    await page.waitForTimeout(slow(1500));
    course = await page.$$eval(".page-window svg", (x) => x.length);
  }
  say(
    `a realm's army: ${army.includes("Armed with") ? "its arms named" : "no arms named"}, ${army.includes("Its wars") ? "its wars listed" : "no wars listed"}; a war's course: ${course} charts`,
  );
  check(army.includes("Fields") && army.includes("Battles"), "a realm's army tab is not there");
  check(!war || course >= 1, "a war's course shows no chart");
  await k(`document.querySelector(".page-window .close")?.click()`);
}

await browser.close();
await server.close();
const real = errors.filter((e) => !/favicon|ERR_ABORTED/i.test(e));
if (real.length) problems.push(...real.slice(0, 5).map((e) => `the page logged: ${e}`));
console.log();
if (problems.length) {
  for (const p of problems) console.log(`  ✗ ${p}`);
  console.log("the Phase 13 gate fails");
  process.exit(1);
}
console.log("the Phase 13 gate passes");
