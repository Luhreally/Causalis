// node tools/phase37-gate.ts [--ci] [--soft] [--shots dir] — the Phase 37 gate (battles seen,
// M183–M187: a battle of history watched fought on its field), on the built app:
//   1. a battle's page offers it watched, and down on its field the world's clock is held while
//      the battle plays on a clock of its own;
//   2. its clock: held still by Space, run at its speeds by the numbers, drawn back and forth on
//      its course;
//   3. its hosts drawn in proportion, so many men to a figure, and as many of each fall as history
//      says fell;
//   4. one who fought, tapped, is followed and told;
//   5. back to its land, the world's clock goes on as it went;
//   6. on a phone the battle's bar keeps to the screen's width;
//   7. Phase 55's blows where they land: the setting on the settings page (full, less, none);
//      on a battle of axes and swords with history's wounded and maimed, the wounds drawn on the
//      struck, the parts cut off lying where they fell, the wounded going back, kneeling and
//      helped, as many falling as history says; arrows stuck in the struck; none of it drawn when
//      the setting says none, the wounded still going back; on a phone.
// (npm run build first; --soft draws in software, as CI's browser does; --shots keeps pictures.)
import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { preview } from "vite";
import { chromium, type Page } from "playwright";

const ci = process.argv.includes("--ci"),
  soft = process.argv.includes("--soft"),
  shots = process.argv.includes("--shots")
    ? process.argv[process.argv.indexOf("--shots") + 1]
    : undefined;
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
console.log("the Phase 37 gate");
if (shots) mkdirSync(shots, { recursive: true });

const root = fileURLToPath(new URL("..", import.meta.url)),
  server = await preview({ root, logLevel: "silent", preview: { port: 4291, strictPort: false } }),
  base = server.resolvedUrls!.local[0]!,
  browser = await chromium.launch({
    args: soft ? ["--use-angle=swiftshader", "--enable-unsafe-swiftshader"] : ci ? [] : GPU,
  });
const errors: string[] = [];
const watch = (p: Page) => {
  p.on("pageerror", (e) => errors.push(e.message));
  p.on("console", (m) => {
    if (m.type() === "error") errors.push(m.text());
  });
};
const k = <T>(p: Page, code: string): Promise<T> => p.evaluate(code) as Promise<T>;
const until = async (p: Page, what: string, ok: () => Promise<boolean>, ms = 60000) => {
  const end = Date.now() + ms;
  while (Date.now() < end) {
    if (await ok().catch(() => false)) return true;
    await p.waitForTimeout(250);
  }
  problems.push(`${what} did not come`);
  return false;
};
const shot = async (p: Page, name: string) => {
  if (shots) await p.screenshot({ path: join(shots, `${name}.png`) });
};
type Seen = {
  event: string;
  title: string;
  outcome: string;
  s: number;
  speed: number;
  per: number;
  figures: number[];
  standing: number[];
  fallen: number[];
  men: { standing: number[]; fallen: number[] };
  words: string;
  followed: string | null;
  onScreen: { id: number; side: number; act: string; at: { x: number; y: number } | null }[];
  world: boolean;
};
const seen = (p: Page) => k<Seen | null>(p, `globalThis.causalis.battle()`);
type Near = {
  title: string;
  attacker: { fielded: number; fallen: number; name: string };
  defender: { fielded: number; fallen: number; name: string };
};

const page = await browser.newPage({ viewport: { width: 1366, height: 800 } });
watch(page);
await page.goto(`${base}?universe=earth&seed=${encodeURIComponent("first light")}&year=125`);
await page.waitForFunction(
  () => ((globalThis as any).causalis?.drawn?.() as number) > 0,
  undefined,
  {
    timeout: 900000,
  },
);
await k(page, `globalThis.causalis.client.setSpeed(0)`);

// (7, first: the blood and the wounds a battle shows, on the world's settings page.)
{
  const lines = () => page.$$eval("button.line", (x) => x.map((b) => b.textContent ?? ""));
  await page.click(".world-menu button[title='Settings']");
  await until(
    page,
    "the settings' blood and wounds",
    async () => (await lines()).some((l) => l.startsWith("None —")),
    slow(10000),
  );
  const gores = (await lines()).filter((l) => /^(Full|Less|None) —/.test(l));
  say(`blood and wounds: ${gores.map((l) => l.split(" —")[0]).join(", ")}`);
  check(gores.length === 3, `the setting's three choices (${gores.length})`);
  check(
    await page.locator("button.line.chosen", { hasText: "Full —" }).isVisible(),
    "full chosen unless chosen otherwise",
  );
  await page.click("button.line:has-text('None —')");
  check(
    (await k<string | null>(page, `localStorage.getItem("causalis.gore")`)) === "none" &&
      (await page.locator("button.line.chosen", { hasText: "None —" }).isVisible()),
    "none chosen, and kept",
  );
  await page.click("button.line:has-text('Full —')");
  check(
    (await k<string | null>(page, `localStorage.getItem("causalis.gore")`)) === "full",
    "full chosen again",
  );
}

// The greatest battle of the world's wars: the one with the most fallen.
const wars = await k<{ wars: { battles: { event: string; fallen: number; year: number }[] }[] }>(
    page,
    `globalThis.causalis.client.query({ type: "wars.map" })`,
  ),
  all = wars.wars.flatMap((w) => w.battles),
  greatest = [...all].sort((a, b) => b.fallen - a.fallen)[0];
check(!!greatest, "a battle to watch");
if (greatest) {
  const near = await k<Near>(
    page,
    `globalThis.causalis.client.query({ type: "battle.near", args: { event: ${JSON.stringify(greatest.event)} } })`,
  );
  say(
    `${near.title}, year ${greatest.year}: ${near.attacker.name} ${near.attacker.fielded} against ${near.defender.name} ${near.defender.fielded}, ${greatest.fallen} fell`,
  );

  // 1. Its page offers it watched; down on its field, the world held.
  // (The world set going first, at a land's months: held while the battle is watched.)
  await page.keyboard.press("Digit1");
  await k(page, `globalThis.causalis.open(${JSON.stringify(greatest.event)})`);
  const button = page.locator(".page-window button.act", { hasText: "Watch the battle" });
  await until(page, "the battle page's watch", async () => (await button.count()) > 0, slow(30000));
  await button.first().click();
  await until(page, "the battle's field", async () => (await seen(page)) !== null, slow(60000));
  let b = await seen(page);
  check(b?.event === greatest.event, `the battle watched is the one chosen (${b?.event})`);
  check(b?.world === true, "the world's clock held while its battle is watched");
  await page.waitForTimeout(slow(1500));
  check(
    await page.locator(".battle-panel:not([hidden]) .battle-sheet").isVisible(),
    "the battle's bar shown",
  );
  await shot(page, "1-drawn-up");

  // 2. Its own clock: it plays at its own pace; Space holds it; the numbers its speeds; the course.
  const s0 = (await seen(page))!.s;
  await page.waitForTimeout(2000);
  const s1 = (await seen(page))!.s;
  say(`its own pace: ${s0.toFixed(1)} → ${s1.toFixed(1)} seconds of it in two of ours`);
  check(s1 - s0 > 0.3, `the battle plays (${s0} → ${s1})`);
  await page.keyboard.press("Space");
  const held = (await seen(page))!;
  await page.waitForTimeout(1200);
  const still = (await seen(page))!;
  check(held.speed === 0 && Math.abs(still.s - held.s) < 0.01, "Space holds the battle still");
  check(
    (await k<{ stopped: boolean }>(page, `globalThis.causalis.clock()`)).stopped,
    "the world still held",
  );
  await page.keyboard.press("Digit4");
  check((await seen(page))!.speed === 4, "4: the battle at four times its pace");
  await page.keyboard.press("Space");
  check((await seen(page))!.speed === 0, "Space again holds it");
  const course = await page.locator(".battle-course").boundingBox();
  if (course) await page.mouse.click(course.x + course.width * 0.8, course.y + course.height / 2);
  b = await seen(page);
  say(`drawn to four fifths of its course: ${b?.s.toFixed(1)} — "${b?.words}"`);
  check(!!b && Math.abs(b.s - 120) < 4, `the course drawn to a moment (${b?.s})`);

  // 3. Its hosts in proportion, and as many fall as fell.
  const ratio = near.attacker.fielded / Math.max(1, near.defender.fielded),
    drawn = b!.figures[0]! / Math.max(1, b!.figures[1]!);
  say(`each figure ${b!.per} men: ${b!.figures.join(" against ")} figures`);
  check(
    Math.abs(Math.log(drawn / ratio)) < 0.25,
    `the hosts drawn in proportion (${drawn.toFixed(2)} against ${ratio.toFixed(2)})`,
  );
  await k(page, `globalThis.causalis.battleAt(70, 0)`);
  await page.waitForTimeout(slow(900));
  await shot(page, "2-the-lines-meet");
  await k(page, `globalThis.causalis.battleAt(150, 0)`);
  await page.waitForTimeout(slow(900));
  b = await seen(page);
  say(
    `its end: "${b?.words}" — fallen ${b?.men.fallen.join(" and ")}; history: ${near.attacker.fallen} and ${near.defender.fallen}`,
  );
  check(
    !!b && b.men.fallen[0] === near.attacker.fallen && b.men.fallen[1] === near.defender.fallen,
    "as many fall as history says fell",
  );
  check(!!b && b.fallen[0]! + b.fallen[1]! > 0, "the fallen lie on the field");
  await shot(page, "3-the-field-after");

  // 4. One who fought, tapped: followed and told.
  await k(page, `globalThis.causalis.battleAt(30, 0)`);
  await page.waitForTimeout(slow(900));
  b = await seen(page);
  const one = b?.onScreen.find(
    (t) => t.at && t.at.y > 260 && t.at.y < 760 && t.at.x > 40 && t.at.x < 1300,
  );
  check(!!one, "one who fought seen on the screen");
  if (one?.at) {
    await page.mouse.click(one.at.x, one.at.y);
    // (Told on the panel at the next frame drawn after: slow in software, so waited for too.)
    await until(
      page,
      "the one tapped followed",
      async () =>
        !!(await seen(page))?.followed &&
        !!(await page.locator(".battle-followed-words").textContent())?.trim(),
      slow(8000),
    );
    const told = await page.locator(".battle-followed-words").textContent();
    say(`followed: ${told}`);
    check(/^👁 .+ of .+, in the \w+ rank/.test(told ?? ""), `the one followed told (${told})`);
  }
  await shot(page, "4-one-followed");

  // 5. Back to the land: the world's clock as it went.
  await page.locator(".battle-panel button", { hasText: "The land" }).click();
  await until(page, "the land again", async () => (await seen(page)) === null, slow(30000));
  const after = await k<{ stopped: boolean; speed: number }>(page, `globalThis.causalis.clock()`);
  check(!after.stopped && after.speed > 0, `the world's clock goes on (${JSON.stringify(after)})`);

  // 6. On a phone, the battle's bar keeps to the screen.
  await k(page, `globalThis.causalis.client.setSpeed(0)`);
  await k(page, `globalThis.causalis.watchBattle(${JSON.stringify(greatest.event)})`);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.waitForTimeout(slow(1200));
  const fits = await k<{ wide: number; screen: number }>(
    page,
    `(() => { const b = document.querySelector(".battle-panel:not([hidden]) .bar"), r = b?.getBoundingClientRect(); return { wide: b && r ? Math.max(b.scrollWidth, Math.round(r.right)) : 9999, screen: innerWidth }; })()`,
  );
  check(
    fits.wide <= fits.screen + 1,
    `the battle's bar fits a phone (${fits.wide} in ${fits.screen})`,
  );
  await shot(page, "5-on-a-phone");

  // 7. The blows where they land (Phase 55), on battles made for them from this one.
  type Blows = {
    gore: string;
    dead: number[];
    hurt: number[];
    maimed: number[];
    loose: number;
    struck: number[];
    wounds: number;
    stuck: number;
    blood: number;
    limbs: { id: number; lost: string; striker: string; from: number; y: number }[];
    drawn: { wounds: number; ends: number; shafts: number; drops: number };
    acts: Record<string, number>;
    onScreen: {
      id: number;
      act: string;
      living: boolean;
      lost: string | null;
      crawl: boolean;
      at: { x: number; y: number } | null;
    }[];
  };
  const blows = () => k<Blows | null>(page, `globalThis.causalis.blows()`);
  const real = await k<{ event: string; attacker: object; defender: object }>(
      page,
      `globalThis.causalis.client.query({ type: "battle.near", args: { event: ${JSON.stringify(greatest.event)} } })`,
    ),
    host = (
      s: object,
      fielded: number,
      fallen: number,
      arm: string,
      guard: string,
      wounded: number,
      maimed: number,
    ) => ({
      ...s,
      fielded,
      fallen,
      host: { arm, guard, mount: "" },
      kit: `${arm}s, ${guard}`,
      risen: 0,
      armed: 1,
      wounded,
      maimed,
    }),
    made = (name: string, a: object, d: object) => ({
      ...real,
      // These are fabricated renderer fixtures with different armies and casualty totals.
      // They do not inherit the unrelated real battle's authoritative combat transcript.
      combat: undefined,
      event: `${real.event}:${name}`,
      attacker: a,
      defender: d,
      won: true,
      outcome: "field",
      hills: false,
      river: false,
      walls: 0,
      town: null,
    }),
    watchMade = async (near: object, what: string) =>
      check(
        await k<boolean>(page, `globalThis.causalis.watchBattleNear(${JSON.stringify(near)})`),
        what,
      ),
    // (The blows are laid over the moment at once; what is drawn of them, at the next frame.)
    at = (s: number) => k(page, `globalThis.causalis.battleAt(${s}, 0)`),
    drawnAs = (what: string, ok: (x: Blows) => boolean) =>
      until(
        page,
        what,
        async () => {
          const x = await blows();
          return !!x && ok(x);
        },
        slow(8000),
      );
  await page.setViewportSize({ width: 1366, height: 800 });
  // Axes against swords, history's wounded and maimed given.
  const blades = made(
    "blows",
    host(real.attacker, 700, 160, "axe", "mail", 300, 30),
    host(real.defender, 600, 220, "sword", "shield", 260, 36),
  );
  await watchMade(blades, "a battle of axes and swords watched");
  await at(90);
  await drawnAs("the wounds drawn", (x) => x.drawn.wounds > 0 && x.drawn.ends > 0);
  let w = await blows();
  say(
    `axes and swords: fallen ${w?.dead.join(" and ")} figures, wounded ${w?.hurt.join(" and ")}, maimed ${w?.maimed.join(" and ")}, ${w?.loose} parts cut off; at 90 s ${w?.drawn.wounds} wounds and ${w?.drawn.ends} raw ends drawn, ${w?.blood} pools, ${JSON.stringify(w?.acts)}`,
  );
  check(
    !!w && w.hurt.every((n) => n > 0) && w.maimed.every((n) => n > 0) && w.loose > 0,
    "history's wounded and maimed drawn on both sides, parts cut off",
  );
  check(!!w && w.blood > 0, "blood drawn");
  const going = (a: Record<string, number>) =>
    (a.kneel ?? 0) + (a.limp ?? 0) + (a.propped ?? 0) + (a.sit ?? 0);
  check(
    !!w && (w.acts.crawl ?? 0) > 0 && going(w.acts) > 0 && (w.acts.help ?? 0) > 0,
    "the wounded crawling, kneeling, limping and helped back",
  );
  await shot(page, "6-blows");
  // None drawn when the setting says none; the wounded go back all the same.
  await k(page, `globalThis.causalis.setGore("none")`);
  await drawnAs(
    "nothing drawn at none",
    (x) => x.drawn.wounds + x.drawn.ends + x.drawn.drops === 0,
  );
  const none = await blows();
  check(
    !!none &&
      none.gore === "none" &&
      none.wounds + none.blood + none.limbs.length + none.stuck === 0 &&
      JSON.stringify(none.acts) === JSON.stringify(w?.acts),
    `none drawn at none (${JSON.stringify(none?.drawn)}), the same going back`,
  );
  await k(page, `globalThis.causalis.setGore("full")`);
  // At its end: as many fell as history says, every wounded one struck, each part where it fell.
  await at(150);
  w = await blows();
  b = await seen(page);
  check(
    !!b && b.men.fallen[0] === 160 && b.men.fallen[1] === 220,
    `as many fall as history says among the blows (${b?.men.fallen})`,
  );
  check(
    !!w && !!b && w.dead[0] === b.fallen[0] && w.dead[1] === b.fallen[1],
    `each fallen figure struck (${w?.dead} of ${b?.fallen})`,
  );
  check(!!w && w.struck.join() === w.hurt.join(), `each wounded one struck (${w?.struck})`);
  const lying = w?.limbs ?? [];
  check(
    lying.length === w?.loose &&
      // The richer gore's bounce ends in an 18% slide beyond the original landing point.
      lying.every(
        (l) =>
          l.y === 0 &&
          (l.striker !== "hand" || (l.from >= 0.5 * 1.18 - 1e-6 && l.from <= 1.5 * 1.18 + 1e-6)),
      ),
    `each part cut off settled after its bounce and slide (${lying
      .slice(0, 4)
      .map((l) => `${l.lost} ${l.from.toFixed(2)} m`)
      .join(", ")})`,
  );
  // One who lost a part to a blade, followed and told (and, for the pictures, seen near).
  const maimed = w?.onScreen.find((t) => t.living && t.lost !== null);
  check(!!maimed, "one maimed to follow");
  if (maimed) {
    await k(page, `globalThis.causalis.followFighter(${maimed.id})`);
    await until(
      page,
      "the maimed one told",
      async () => / cut off, /.test((await seen(page))?.followed ?? ""),
      slow(8000),
    );
    say(`followed: ${(await seen(page))?.followed}`);
    if (shots) {
      await page.waitForTimeout(slow(1100));
      await k(
        page,
        `(() => { const r = globalThis.causalis.rig; r.userZoomed = true; r.distance = 0.7; r.pitch = -55; r.yaw = 40; })()`,
      );
      await page.waitForTimeout(slow(1200));
      await shot(page, "7-a-part-cut-off");
    }
  }
  // Arrows stuck in those they struck.
  const bows = made(
    "arrows",
    host(real.attacker, 900, 200, "bow", "hide", 400, 20),
    host(real.defender, 700, 160, "spear", "shield", 350, 20),
  );
  await watchMade(bows, "a battle of bows watched");
  await at(40);
  await drawnAs("arrows stuck in the struck, drawn", (x) => x.stuck > 0 && x.drawn.shafts > 0);
  w = await blows();
  say(`bows: at 40 s ${w?.stuck} shafts stuck, ${w?.drawn.shafts} drawn`);
  // On a phone: the blows drawn, the battle's bar to the screen.
  await watchMade(blades, "axes and swords again");
  await page.setViewportSize({ width: 390, height: 844 });
  await at(110);
  await drawnAs("the blows on a phone", (x) => x.drawn.wounds > 0);
  // (The eye flies in to the field framed for a phone's screen: the picture once it has come.)
  let was = -1;
  await until(
    page,
    "the eye come to the field on a phone",
    async () => {
      const d = await k<number>(page, `globalThis.causalis.rig.distance`),
        still = was > 0 && Math.abs(d - was) < 0.02 * was;
      was = d;
      return still;
    },
    slow(10000),
  );
  const phone = await k<{ wide: number; screen: number }>(
    page,
    `(() => { const b = document.querySelector(".battle-panel:not([hidden]) .bar"), r = b?.getBoundingClientRect(); return { wide: b && r ? Math.max(b.scrollWidth, Math.round(r.right)) : 9999, screen: innerWidth }; })()`,
  );
  check(
    phone.wide <= phone.screen + 1,
    `the battle's bar fits a phone among the blows (${phone.wide} in ${phone.screen})`,
  );
  await shot(page, "8-blows-on-a-phone");
}

check(errors.length === 0, `errors: ${errors.slice(0, 3).join(" | ")}`);
await browser.close();
await server.close();
if (problems.length) {
  console.log("FAILED:");
  for (const p of problems) console.log(`  - ${p}`);
  process.exit(1);
}
console.log("the Phase 37 gate passes");
