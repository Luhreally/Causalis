// node tools/phase60-gate.ts [--ci] [--soft] [--webkit] [--shots dir] — the Phase 60 gate (one of a
// town's people possessed, the god's hand made flesh; asked for 2026-10-27: "oh shit add in
// functionality to possess anything like worldbox/worldfall mod, plan for this later and make sure
// it works right in mobile"), in parts:
//   1. in node (not on CI): the oracle's histories as they were — a world where no one is possessed
//      keeps every hash;
//   2. on the built app, the Earth seed at year 300, the hand on its greatest town, at a desk: Possess
//      refused in plain words in a town the hand does not rest on; one of the greatest town's
//      craftsmen taken from the palette with a click, the words saying why he cannot work where he
//      stands; walked by the keys away from his work and back to it, his work done stroke by stroke
//      and a thing made, his and the town's; the eye turned by the mouse; a word to one near him,
//      their spirits moved; let go with Esc, the chronicle and his page telling it, the world going on;
//   3. the same at an iPhone 15 Plus's size by touch (Chromium's own touches; with --webkit, WebKit's
//      taps and pointers): Possess from the palette by a tap; the stick to his work and his work done
//      by taps; a word with a second finger while the first holds the stick; the phone turned on its
//      side and back, every control in its place; let go, the world going on; none of the page's own
//      gestures taking a touch; never a vibration; and (not in software, nor WebKit) with the CPU
//      slowed four times, the frames kept while he walks — the slower fifth within 22 ms at Low and
//      Balanced and where Auto comes to rest, High and Ultra told;
//   4. the save of all that: its history replayed from the seed to the same world.
// (npm run build first; --soft draws in software, as CI's browser does; --shots keeps a picture of
// each step; --webkit runs parts 3 and 4 in WebKit alone, Safari's own engine: CI's runner for
// this gate installs no WebKit, so it runs locally, as the Phase 7 gate's budgets do.)
import { spawnSync } from "node:child_process";
import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { preview } from "vite";
import { chromium, webkit, type BrowserContext, type CDPSession, type Page } from "playwright";
import { verifyByReplay } from "../src/kernel/index.ts";
import { EARTH, decodeSave } from "../src/host/index.ts";

const ci = process.argv.includes("--ci"),
  soft = process.argv.includes("--soft"),
  kit = process.argv.includes("--webkit"),
  shots = process.argv.includes("--shots")
    ? process.argv[process.argv.indexOf("--shots") + 1]
    : undefined;
const GPU = [
  "--use-angle=d3d11",
  "--ignore-gpu-blocklist",
  "--enable-gpu",
  "--force_high_performance_gpu",
];
/** The phone floor's frames: the CPU slowed so many times, the slower fifth of its frames within so many ms. */
const SLOWED = 4,
  P80 = 22;
const problems: string[] = [];
const say = (line: string) => console.log(`  ${line}`);
const check = (ok: boolean, problem: string) => {
  if (!ok) problems.push(problem);
};
/** How long to wait on what the frames bring: longer where they come slowly. */
const slow = (ms: number) => (ci || soft ? ms * 4 : ms);
const t0 = performance.now();
const took = () => `${Math.round((performance.now() - t0) / 1000)} s`;
console.log(`the Phase 60 gate${kit ? " (WebKit, at a phone's size)" : ""}`);
if (shots) mkdirSync(shots, { recursive: true });

// —— 1. In node: a world where no one is possessed keeps every hash ———————————————————————

if (!ci && !kit) {
  const oracle = spawnSync(
    process.execPath,
    [fileURLToPath(new URL("./oracle.ts", import.meta.url))],
    { encoding: "utf8" },
  );
  say(`the oracle's histories: ${oracle.status === 0 ? "as they were" : "changed"} (${took()})`);
  check(oracle.status === 0, `the oracle's histories changed:\n${oracle.stdout}`);
}

// —— 2–4. On the built app ————————————————————————————————————————————————————————————

type Offer = { act: number; icon: string; label: string; can: boolean; words: string };
type Body = { id: number; x: number; z: number; doing: string; say: string };
type Live = {
  step: number;
  bodies: Body[];
  offers: Offer[];
  told: { words: string; step: number; good: boolean } | null;
  strip: { name: string; what: string; carries: string };
  deeds: { made: number; struck: number; spoke: number; took: number };
  ended: string;
};
type Place = { kind: string; x: number; z: number };
type State = {
  agent: number;
  name: string;
  town: string;
  trade: string;
  form: string;
  places: Place[];
  live: Live | null;
  eye: { yaw: number };
  me: { x: number; z: number; yaw: number } | null;
};
type Candidate = {
  index: number;
  ref: string;
  name: string;
  child: boolean;
  trade: string;
  form: string;
  far: number;
};
type Span = string | { text: string; ref?: string };
type PageModel = {
  title: string;
  tabs: { id: string; blocks: { type: string; title?: string; items?: { line: Span[] }[] }[] }[];
};
const words = (l: Span[]) => l.map((s) => (typeof s === "string" ? s : s.text)).join("");
const first = (name: string) => name.replace(/ of .*$/, "");
/** Where each trade works. */
const WORKS: Readonly<Record<string, string>> = {
  smith: "forge",
  potter: "wheel",
  weaver: "loom",
  farmer: "row",
};

const root = fileURLToPath(new URL("..", import.meta.url)),
  // (CAUSALIS_DIST: a build elsewhere, so that one can be looked at while dist/ is under test.)
  server = await preview({
    root,
    logLevel: "silent",
    preview: { port: 4360, strictPort: false },
    ...(process.env.CAUSALIS_DIST ? { build: { outDir: process.env.CAUSALIS_DIST } } : {}),
  }),
  base = server.resolvedUrls!.local[0]!;
const PHONE = {
  viewport: { width: 430, height: 932 },
  deviceScaleFactor: 3,
  hasTouch: true,
  isMobile: true,
};
const browser = kit
  ? await webkit.launch()
  : await chromium.launch({
      args: soft ? ["--use-angle=swiftshader", "--enable-unsafe-swiftshader"] : ci ? [] : GPU,
    });
/**
 * A context of the browser's: a phone's (its frame, its pixels, its touch, as Playwright makes a
 * device: what the devtools' own frame would be undone by the next change of the page's size) or a
 * desk's; never asked for a vibration without its being counted.
 */
async function contextFor(asPhone: boolean): Promise<BrowserContext> {
  const c = await browser.newContext(
    asPhone ? PHONE : { viewport: { width: 1366, height: 800 }, hasTouch: true },
  );
  await c.addInitScript(() => {
    const n = navigator as Navigator & { vibrated?: number };
    n.vibrated = 0;
    Object.defineProperty(navigator, "vibrate", {
      value: () => {
        n.vibrated = (n.vibrated ?? 0) + 1;
        return true;
      },
      configurable: true,
    });
  });
  return c;
}
const errors: string[] = [];
/** A page of a context, its errors kept. */
async function pageOf(c: BrowserContext): Promise<Page> {
  const p = await c.newPage();
  p.on("pageerror", (e) => errors.push(e.message));
  p.on("console", (m) => {
    if (m.type() === "error") errors.push(m.text());
  });
  return p;
}
let context = await contextFor(kit),
  page = await pageOf(context);
const k = <T>(code: string): Promise<T> => page.evaluate(code) as Promise<T>;
const ask = <T>(type: string, args: unknown) =>
  k<T>(
    `globalThis.causalis.client.query({ type: ${JSON.stringify(type)}, args: ${JSON.stringify(args)} })`,
  );
const shot = async (name: string) => {
  if (shots) await page.screenshot({ path: join(shots, `${name}.png`) });
};
const fail = async () => {
  await browser.close();
  await server.close();
  console.log("FAILED:");
  for (const p of problems) console.log(`  - ${p}`);
  process.exit(1);
};
const state = () =>
  k<State | null>(`(() => {
    const p = globalThis.causalis.possess, s = p.state();
    if (!s) return null;
    const me = p.drawn(s.agent);
    return { ...s, me: me && { x: me.x, z: me.z, yaw: me.yaw } };
  })()`);
const centre = async (selector: string) => {
  const r = await page.locator(selector).first().boundingBox();
  return r && r.width > 0 && r.height > 0 ? { x: r.x + r.width / 2, y: r.y + r.height / 2 } : null;
};

// —— the hands: a desk's keys and mouse, or a phone's fingers ———————————————————————————

/** Touches by finger: Chromium's own (by the devtools protocol), or WebKit's taps and pointers made in the page. */
let cdp: CDPSession | null = null;
const fingers = new Map<number, { x: number; y: number }>();
const points = () =>
  [...fingers].map(([id, p]) => ({ x: p.x, y: p.y, id, radiusX: 6, radiusY: 6, force: 1 }));
/** A pointer of a touch made in the page (WebKit: its driver lifts no finger it did not set down). */
const pointer = (type: string, id: number, x: number, y: number) =>
  page.evaluate(
    ({ type, id, x, y }) => {
      const at = document.elementFromPoint(x, y) ?? document.body;
      at.dispatchEvent(
        new PointerEvent(type, {
          pointerId: id,
          pointerType: "touch",
          isPrimary: id === 1,
          clientX: x,
          clientY: y,
          bubbles: true,
          cancelable: true,
          composed: true,
          buttons: type === "pointerup" ? 0 : 1,
          pressure: type === "pointerup" ? 0 : 0.5,
          width: 12,
          height: 12,
        }),
      );
    },
    { type, id, x, y },
  );
const finger = {
  async down(id: number, x: number, y: number) {
    fingers.set(id, { x, y });
    if (cdp)
      await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: points() });
    else await pointer("pointerdown", id, x, y);
  },
  async move(id: number, x: number, y: number) {
    fingers.set(id, { x, y });
    if (cdp)
      await cdp.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: points() });
    else await pointer("pointermove", id, x, y);
  },
  async up(id: number) {
    const p = fingers.get(id);
    if (!p) return;
    fingers.delete(id);
    if (cdp)
      await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: points() });
    else await pointer("pointerup", id, p.x, p.y);
  },
};
type Hands = {
  readonly name: string;
  /** A tap (a click at a desk). */
  tap(x: number, y: number): Promise<void>;
  /** The body steered toward a ground direction (radians, as a yaw) as the eye looks, or let be (null). */
  steer(aim: number | null, eyeYaw: number, run: boolean): Promise<void>;
  /** One of the four acts. */
  act(slot: number): Promise<void>;
  /** The eye turned by a drag across the screen's right half. */
  look(dx: number): Promise<void>;
  letGo(): Promise<void>;
};
const keys = new Set<string>();
const desk: Hands = {
  name: "desk",
  tap: (x, y) => page.mouse.click(x, y),
  async steer(aim, eyeYaw, run) {
    const want = new Set<string>();
    if (aim !== null) {
      // (The stick's frame: ahead as the eye looks; its right, the eye's right.)
      const rel = aim - eyeYaw,
        ahead = Math.cos(rel),
        right = -Math.sin(rel);
      if (ahead > 0.38) want.add("KeyW");
      if (ahead < -0.38) want.add("KeyS");
      if (right > 0.38) want.add("KeyD");
      if (right < -0.38) want.add("KeyA");
      if (run) want.add("ShiftLeft");
    }
    for (const key of [...keys])
      if (!want.has(key)) {
        await page.keyboard.up(key);
        keys.delete(key);
      }
    for (const key of want)
      if (!keys.has(key)) {
        await page.keyboard.down(key);
        keys.add(key);
      }
  },
  act: (slot) => page.keyboard.press(["Space", "KeyE", "KeyF", "KeyR"][slot]!),
  async look(dx) {
    const y = 400,
      x = 1000;
    await page.mouse.move(x, y);
    await page.mouse.down();
    for (let i = 1; i <= 8; i++) await page.mouse.move(x + (dx * i) / 8, y);
    await page.mouse.up();
  },
  letGo: () => page.keyboard.press("Escape"),
};
/** Where the left thumb comes down for the stick; how far it is pushed to its rim. */
const STICK = { x: 110, y: 760 },
  RIM = 52;
let stickAt: { x: number; y: number } | null = null;
const phone: Hands = {
  name: kit ? "WebKit" : "phone",
  async tap(x, y) {
    if (kit) await page.touchscreen.tap(x, y);
    else {
      await finger.down(9, x, y);
      await page.waitForTimeout(50);
      await finger.up(9);
    }
  },
  async steer(aim, eyeYaw, run) {
    if (aim === null) {
      if (stickAt) await finger.up(1);
      stickAt = null;
      return;
    }
    if (!stickAt) {
      await finger.down(1, STICK.x, STICK.y);
      stickAt = await k<{ x: number; y: number } | null>(`(() => {
        const e = document.querySelector(".possess-stick");
        return e && !e.hidden ? { x: parseFloat(e.style.left), y: parseFloat(e.style.top) } : null;
      })()`);
      if (!stickAt) {
        problems.push("the stick did not come where the thumb came down");
        stickAt = STICK;
      }
    }
    const rel = aim - eyeYaw,
      push = run ? 1 : 0.7;
    await finger.move(
      1,
      stickAt.x - Math.sin(rel) * RIM * push,
      stickAt.y - Math.cos(rel) * RIM * push,
    );
  },
  async act(slot) {
    const at = await centre(`.possess-act-${slot}`);
    if (at) await this.tap(at.x, at.y);
  },
  async look(dx) {
    await finger.down(2, 330, 420);
    for (let i = 1; i <= 8; i++) await finger.move(2, 330 + (dx * i) / 8, 420);
    await finger.up(2);
  },
  async letGo() {
    const at = await centre(".possess-letgo");
    if (at) await this.tap(at.x, at.y);
  },
};

/**
 * Walked toward a point of the town (m) until within `near` of it, the way the eye looks turned
 * as it goes; stepping aside where a wall stops him. `then`, asked each beat: done when true. Its
 * time is the possession's own, `seconds` of its steps: where frames come slowly its clock goes
 * slower than the wall's (a stall does not throw him far, app/possess.ts), and he is given the
 * same walk wherever he is walked (the wall's own bound, four times as long, ends a clock stopped).
 */
async function walkTo(
  hands: Hands,
  to: { x: number; z: number },
  near: number,
  seconds: number,
  run: boolean,
  then?: (s: State) => Promise<boolean>,
): Promise<State | null> {
  const STEPS = 20,
    until = Date.now() + slow(seconds * 1000) * 4;
  let s: State | null = null,
    from: number | null = null,
    best = Infinity,
    bestAt = 0,
    side = 0,
    sideUntil = -1;
  while (Date.now() < until) {
    s = await state();
    if (!s?.me) break;
    const step = s.live?.step ?? 0;
    if (from === null) from = bestAt = step;
    if (step - from > seconds * STEPS) break;
    const dx = to.x - s.me.x,
      dz = to.z - s.me.z,
      d = Math.hypot(dx, dz);
    if (d <= near || (then && (await then(s)))) break;
    if (d < best - 0.5) {
      best = d;
      bestAt = step;
    } else if (step - bestAt > 2.5 * STEPS && step > sideUntil) {
      side = side >= 0 ? -1 : 1;
      sideUntil = step + 1.5 * STEPS;
      bestAt = step;
    }
    const aim = Math.atan2(dx, dz) + (step < sideUntil ? (side * Math.PI) / 2 : 0);
    await hands.steer(aim, s.eye.yaw, run && d > 4);
    await page.waitForTimeout(100);
  }
  await hands.steer(null, 0, false);
  await page.waitForTimeout(slow(400));
  return state();
}

// —— the world: the Earth seed at year 300, the hand on its greatest town, a working morning ———

const YEAR = 365 * 86_400,
  MORNING = 300 * YEAR + 3 * 86_400 + 10.5 * 3_600;
type Town = { ref: string; name: string; people: number };
/** The world opened on the page: the seed at year 300, the hand on its greatest town, a working morning. */
async function open(): Promise<{ great: Town; other: Town }> {
  await page.goto(`${base}?universe=earth&seed=first%20light&year=300&hold=1`);
  await page.waitForFunction(
    () => ((globalThis as { causalis?: { drawn?: () => number } }).causalis?.drawn?.() ?? 0) > 0,
    undefined,
    { timeout: 1_800_000 },
  );
  await k(`globalThis.causalis.client.setSpeed(0)`);
  const towns = [...(await ask<Town[]>("towns.map", {}))].sort(
      (a, b) => b.people - a.people || (a.ref < b.ref ? -1 : 1),
    ),
    great = towns[0]!;
  await k(
    `globalThis.causalis.client.command("hand.lay", { village: ${JSON.stringify(great.ref)} })`,
  );
  await k(`globalThis.causalis.client.advance(${MORNING})`);
  await page.waitForFunction(
    (at) =>
      ((globalThis as { causalis?: { client: { status?: { t: number } } } }).causalis?.client.status
        ?.t ?? 0) >=
      at - 1,
    MORNING,
    { timeout: slow(60_000) },
  );
  say(
    `the Earth seed at year 300, the hand on ${great.name} (${great.people}), at ${await k<string>("`${innerWidth}×${innerHeight} at ${devicePixelRatio}`")} (${took()})`,
  );
  return { great, other: towns[1]! };
}
const { great, other } = await open();

/** Down into a town, its people drawn, the clock held. */
async function into(ref: string): Promise<void> {
  await k(`globalThis.causalis.goTo(${JSON.stringify(ref)})`);
  await page.waitForFunction(
    (r) => {
      const c = (
        globalThis as {
          causalis?: { townShown?: () => { ref: string } | null; watching?: () => number };
        }
      ).causalis;
      return c?.townShown?.()?.ref === r && (c.watching?.() ?? 0) > 0;
    },
    ref,
    { timeout: slow(120_000) },
  );
  await k(`globalThis.causalis.client.setSpeed(0)`);
  await page.waitForTimeout(slow(1500));
}
/** Possess taken up in the palette by the hands. */
async function arm(hands: Hands): Promise<string | null> {
  // (Still in hand after a touch it refused: a touch on its tile again would put it down.)
  if ((await k<string | null>(`globalThis.causalis.palette.holding()`)) === "possess") return null;
  for (const selector of [".palette-toggle", '.palette-tab[data-kind="flesh"]', ".palette-act"]) {
    // (The palette's own button shows only where the palette folds away: a phone's width.)
    if (
      selector === ".palette-toggle" &&
      ((await k<boolean>(`!!document.querySelector(".palette.open")`)) || !(await centre(selector)))
    )
      continue;
    const at = await centre(selector);
    if (!at) return `no ${selector} to touch`;
    await hands.tap(at.x, at.y);
    await page.waitForTimeout(slow(300));
  }
  const holding = await k<string | null>(`globalThis.causalis.palette.holding()`);
  return holding === "possess" ? null : `the palette holds ${holding ?? "nothing"}, not Possess`;
}
/**
 * One of those drawn brought before the eye, and where they are on the screen: read once the
 * flight has come to rest (where frames come slowly, as on CI's software drawing, a point read on
 * the way is gone by the touch, or not on the screen yet).
 */
async function before(index: number): Promise<{ x: number; y: number } | null> {
  const p = (
    await k<{ index: number; x: number; z: number }[]>(`globalThis.causalis.peopleNow()`)
  ).find((q) => q.index === index);
  if (!p) return null;
  await k(
    `globalThis.causalis.rig.flyTo({ target: { x: ${p.x * 0.1}, y: 0, z: ${p.z * 0.1} }, distance: 3.5, pitch: -40 })`,
  );
  await page.waitForTimeout(slow(500));
  await page
    .waitForFunction(
      () => !(globalThis as { causalis?: { rig?: { flying?: boolean } } }).causalis?.rig?.flying,
      undefined,
      { timeout: slow(15_000) },
    )
    .catch(() => undefined);
  for (let i = 0; i < 5; i++) {
    await page.waitForTimeout(slow(400));
    const at = await k<{ x: number; y: number } | null>(
      `globalThis.causalis.personOnScreen(${index})`,
    );
    if (at) return at;
  }
  return null;
}
/** The palette's line. */
const paletteWords = () => k<string>(`document.querySelector(".palette-words")?.textContent ?? ""`);

/** A walk in one of the town's people by these hands; what was done, for the checks after. */
async function walk(
  hands: Hands,
  tag: string,
): Promise<{ agent: number; name: string; listener: number | null } | null> {
  const n = (s: string) => `${hands.name}: ${s}`;
  // The palette refused plainly in a town the hand does not rest on.
  if (hands === desk || kit) {
    await into(other.ref);
    const armed = await arm(hands);
    check(!armed, n(armed ?? ""));
    const anyone = (await k<{ index: number }[]>(`globalThis.causalis.peopleNow()`))[0];
    // (Touched again if the touch found no one: Possess stays in hand after it.)
    for (let i = 0; i < 3 && anyone; i++) {
      const at = await before(anyone.index);
      if (!at) continue;
      await hands.tap(at.x, at.y);
      await page.waitForTimeout(slow(1200));
      if ((await paletteWords()).includes("your hand rests on")) break;
    }
    const refused = await paletteWords();
    say(n(`in ${other.name}: “${refused}”`));
    check(
      refused.includes(`your hand rests on ${great.name}, not ${other.name}`),
      n(`Possess in a town the hand does not rest on said “${refused}”`),
    );
    check((await state()) === null, n("one of a town the hand does not rest on was taken"));
    await shot(`${tag}-0-refused`);
  }
  await into(great.ref);
  // One of its craftsmen a walk from his work (a farmer, if none).
  const all = await k<Candidate[]>(`globalThis.causalis.possess.candidates()`),
    order = ["smith", "potter", "weaver", "farmer"],
    chosen = all
      .filter((c) => !c.child && c.far >= 6 && c.far <= 60 && order.includes(c.trade))
      .sort((a, b) => order.indexOf(a.trade) - order.indexOf(b.trade) || a.far - b.far)[0];
  check(!!chosen, n(`none of ${great.name}'s ${all.length} under the hand a walk from their work`));
  if (!chosen) return null;
  const armed = await arm(hands);
  check(!armed, n(armed ?? ""));
  // (Touched again if the touch found no one, Possess taken up again if it was put down.)
  let s: Awaited<ReturnType<typeof state>> = null,
    seen = false;
  for (let i = 0; i < 3 && !s; i++) {
    if (i > 0) {
      const again = await arm(hands);
      check(!again, n(again ?? ""));
    }
    const at = await before(chosen.index);
    if (!at) continue;
    seen = true;
    await hands.tap(at.x, at.y);
    await page
      .waitForFunction(
        () => {
          const c = (
            globalThis as {
              causalis?: { possess?: { state(): { live: unknown } | null } };
            }
          ).causalis;
          return (
            !!c?.possess?.state()?.live ||
            (document.querySelector(".palette-words")?.textContent ?? "").includes(
              "no one is there",
            )
          );
        },
        undefined,
        { timeout: slow(30_000) },
      )
      .catch(() => undefined);
    s = await state();
  }
  check(seen, n(`${chosen.name} not on the screen`));
  if (!seen) return null;
  check(!!s, n(`${chosen.name} not taken from the palette: “${await paletteWords()}”`));
  if (!s?.live || !s.me) return null;
  const work = WORKS[s.trade]!,
    hint = s.live.offers[0]!.words;
  say(
    n(
      `${s.name} taken from the palette, ${s.trade} (${s.form}), his ${work} ${chosen.far} m off: “${hint}” (${took()})`,
    ),
  );
  check(s.agent === Number(chosen.ref.slice(6)), n(`took ${s.agent}, not ${chosen.ref}`));
  check(
    new RegExp(
      `^No ${work === "row" ? "field" : work === "wheel" ? "potter's wheel" : work} here: (he|she) is an? ${s.trade}`,
    ).test(hint),
    n(`the work's words before it could be done: “${hint}”`),
  );
  // The controls as the phone shows them: four acts a thumb's width, Let go, the strip; the game's own put away.
  // A property this engine does not know (WebKit's Windows build knows neither `overscroll-behavior`
  // nor `-webkit-touch-callout`; an iPhone's Safari knows both) it drops as it reads the page's
  // styles, so for that one the page's own style text is read for it instead.
  const sized = await k<{
    acts: number[];
    letGo: number;
    chrome: number;
    hud: { touchAction: string; userSelect: string; callout: string; overscroll: string };
    known: { callout: boolean; overscroll: boolean };
    styles: string[];
  }>(`(async () => {
    const box = (e) => e.getBoundingClientRect(), hud = document.querySelector(".possess-hud"), cs = getComputedStyle(hud);
    const styles = [...document.querySelectorAll("style")].map((e) => e.textContent ?? "");
    for (const l of document.querySelectorAll('link[rel="stylesheet"]')) styles.push(await (await fetch(l.href)).text());
    return {
      acts: [...document.querySelectorAll(".possess-act")].map((b) => Math.min(box(b).width, box(b).height)),
      letGo: box(document.querySelector(".possess-letgo")).height,
      chrome: [...document.querySelectorAll("#hud > *:not(.possess-hud)")].filter((e) => getComputedStyle(e).display !== "none").length,
      hud: { touchAction: cs.touchAction, userSelect: cs.userSelect || cs.webkitUserSelect, callout: cs.webkitTouchCallout ?? "", overscroll: getComputedStyle(document.body).overscrollBehaviorY ?? "" },
      known: { callout: CSS.supports("-webkit-touch-callout", "none"), overscroll: CSS.supports("overscroll-behavior-y", "none") },
      styles,
    };
  })()`);
  const declared = (rule: RegExp): string =>
    sized.styles.some((t) => rule.test(t))
      ? "none (declared; this engine knows it not)"
      : "not declared";
  if (!sized.known.callout)
    sized.hud.callout = declared(/\.possess-hud[^{}]*\{[^}]*-webkit-touch-callout\s*:\s*none/);
  if (!sized.known.overscroll)
    sized.hud.overscroll = declared(/body\.possessing[^{}]*\{[^}]*overscroll-behavior\s*:\s*none/);
  say(
    n(
      `the acts ${sized.acts.map((a) => Math.round(a)).join(", ")} px across, Let go ${Math.round(sized.letGo)} px; ${JSON.stringify(sized.hud)}`,
    ),
  );
  check(
    sized.acts.length === 4 && sized.acts.every((a) => a >= 56),
    n(`the acts not four of 56 px or more: ${sized.acts.join(", ")}`),
  );
  check(sized.letGo >= 44, n(`Let go ${sized.letGo} px high`));
  check(
    sized.chrome === 0,
    n(`${sized.chrome} of the game's own controls shown while he is walked`),
  );
  check(
    sized.hud.touchAction === "none",
    n(`the controls' touch-action is ${sized.hud.touchAction}`),
  );
  check(
    sized.hud.userSelect === "none",
    n(`the controls' text can be selected (${sized.hud.userSelect})`),
  );
  check(
    sized.hud.overscroll.startsWith("none"),
    n(`the page can be pulled (${sized.hud.overscroll})`),
  );
  if (kit)
    check(sized.hud.callout.startsWith("none"), n(`a long press calls out (${sized.hud.callout})`));
  await shot(`${tag}-1-taken`);
  // Off from his work, and back to it.
  const place = s.places
    .filter((p) => p.kind === work)
    .sort(
      (a, b) =>
        Math.hypot(a.x - s!.me!.x, a.z - s!.me!.z) - Math.hypot(b.x - s!.me!.x, b.z - s!.me!.z),
    )[0]!;
  {
    const dx = s.me.x - place.x,
      dz = s.me.z - place.z,
      l = Math.hypot(dx, dz) || 1;
    s = await walkTo(hands, { x: s.me.x + (dx / l) * 6, z: s.me.z + (dz / l) * 6 }, 1.5, 20, false);
  }
  const off = s?.me ? Math.hypot(s.me.x - place.x, s.me.z - place.z) : 0;
  s = await walkTo(hands, place, 1.2, 60, true);
  const at2 = s?.me ? Math.hypot(s.me.x - place.x, s.me.z - place.z) : Infinity;
  say(
    n(
      `walked ${Math.round(off)} m off and back to the ${work}: ${at2.toFixed(1)} m from it; “${s?.live?.offers[0]?.words}” (${took()})`,
    ),
  );
  check(at2 <= 2.4, n(`not brought to the ${work} (${at2.toFixed(1)} m from it)`));
  check(
    !!s?.live?.offers[0]?.can,
    n(`his work cannot be done at the ${work}: “${s?.live?.offers[0]?.words}”`),
  );
  await shot(`${tag}-2-at-work`);
  // His work, stroke by stroke, and a thing made.
  const made0 = s?.live?.deeds.made ?? 0;
  for (let stroke = 0; stroke < 4 && s?.live; stroke++) {
    await hands.act(0);
    await page.waitForTimeout(slow(500));
    for (let w = 0; w < 60; w++) {
      s = await state();
      if (!s?.live || (s.live.offers[0]?.can && s.live.told?.step !== undefined)) break;
      await page.waitForTimeout(250);
    }
  }
  const madeWords = s?.live?.told?.words ?? "";
  say(n(`at the ${work}: “${madeWords}”`));
  check(
    (s?.live?.deeds.made ?? 0) === made0 + 1,
    n(`no thing made at the ${work} (${s?.live?.deeds.made})`),
  );
  check(
    new RegExp(`made by ${first(chosen.name)}'s hands`).test(madeWords) ||
      /hoed by/.test(madeWords),
    n(`the thing made told as “${madeWords}”`),
  );
  await shot(`${tag}-3-made`);
  // The eye turned.
  const yaw0 = s?.eye.yaw ?? 0;
  await hands.look(-100);
  await page.waitForTimeout(slow(500));
  s = await state();
  const turned = Math.abs(
    Math.atan2(Math.sin((s?.eye.yaw ?? 0) - yaw0), Math.cos((s?.eye.yaw ?? 0) - yaw0)),
  );
  say(n(`a drag turned the eye ${turned.toFixed(2)} rad`));
  check(turned > 0.2, n(`a drag did not turn the eye (${turned.toFixed(2)} rad)`));
  // A word to the nearest of those about him: the stick held, the word said with another finger.
  let listener: number | null = null;
  const others = (s?.live?.bodies ?? [])
    .filter((b) => b.id !== s!.agent && b.doing === "way")
    .map((b) => ({ ...b, d: Math.hypot(b.x - s!.me!.x, b.z - s!.me!.z) }))
    .sort((a, b) => a.d - b.d);
  for (const o of others.slice(0, 4)) {
    for (let tries = 0; tries < 4 && listener === null; tries++) {
      const b = await k<{ x: number; z: number } | null>(
        `globalThis.causalis.possess.drawn(${o.id})`,
      );
      if (!b) break;
      s = await walkTo(hands, b, 1.6, 20, true, async (now) => {
        if (!now.live?.offers[1]?.can) return false;
        await hands.act(1);
        await page.waitForTimeout(slow(600));
        const after = await state();
        if ((after?.live?.deeds.spoke ?? 0) > 0) listener = o.id;
        return listener !== null;
      });
      if (listener === null && s?.live?.offers[1]?.can) {
        await hands.act(1);
        await page.waitForTimeout(slow(800));
        s = await state();
        if ((s?.live?.deeds.spoke ?? 0) > 0) listener = o.id;
      }
    }
    if (listener !== null) break;
  }
  s = await state();
  say(n(`a word: “${s?.live?.told?.words ?? ""}” (${others.length} about him; ${took()})`));
  check(listener !== null, n("no word said to anyone about him"));
  await shot(`${tag}-4-talk`);
  const taken = { agent: s?.agent ?? chosen.index, name: chosen.name, listener };
  // Turned on its side and back: every control in its place, none over another.
  if (hands !== desk) {
    const laid = async (w: number, h: number) => {
      await page.setViewportSize({ width: w, height: h });
      await page.waitForTimeout(slow(900));
      return k<{ over: string[]; out: string[] }>(`(() => {
        const names = [".possess-strip", ".possess-told", ".possess-letgo", ".possess-paces", ".possess-acts", ".possess-hint"];
        const boxes = names.map((n) => { const e = document.querySelector(n); return e && e.textContent !== "" && getComputedStyle(e).display !== "none" ? [n, e.getBoundingClientRect()] : null; }).filter(Boolean);
        const over = [], out = [];
        for (let i = 0; i < boxes.length; i++) {
          const [a, p] = boxes[i];
          if (p.left < -1 || p.top < -1 || p.right > innerWidth + 1 || p.bottom > innerHeight + 1) out.push(a);
          for (let j = i + 1; j < boxes.length; j++) {
            const [b, q] = boxes[j];
            if (p.left < q.right - 1 && q.left < p.right - 1 && p.top < q.bottom - 1 && q.top < p.bottom - 1) over.push(a + " over " + b);
          }
        }
        return { over, out };
      })()`);
    };
    const side = await laid(932, 430);
    await shot(`${tag}-5-landscape`);
    const upright = await laid(430, 932);
    say(
      n(
        `on its side: ${side.over.length ? side.over.join(", ") : "nothing over anything"}; upright again: ${upright.over.length ? upright.over.join(", ") : "nothing over anything"}`,
      ),
    );
    check(
      !side.over.length && !side.out.length,
      n(`on its side: ${[...side.over, ...side.out].join(", ")}`),
    );
    check(
      !upright.over.length && !upright.out.length,
      n(`upright: ${[...upright.over, ...upright.out].join(", ")}`),
    );
  }
  // The phone floor's frames, he walking (Chromium on this machine's GPU, the CPU slowed as gate 8
  // and gate 55 slow it): the town laid again at each setting at the machine's own pace, then the
  // frames of a window with the CPU slowed — where held to the budget, a window again a few seconds
  // on, three at most, and the least taken (other work on the machine only ever makes one slower).
  if (hands === phone && !kit && !ci && !soft && cdp) {
    const there = s?.places.find((p) => p.kind === "granary") ?? place,
      from = s?.me ?? { x: there.x + 20, z: there.z };
    /** The stick pushed to the granary, or back the way he came once there: walking all the while. */
    const aim = async () => {
      const now = await state(),
        to = now?.me && Math.hypot(there.x - now.me.x, there.z - now.me.z) > 5 ? there : from;
      if (now?.me)
        await phone.steer(Math.atan2(to.x - now.me.x, to.z - now.me.z), now.eye.yaw, false);
    };
    const p80Walking = async (budgeted: boolean) => {
      let least = Infinity,
        windows = 0;
      for (; windows < (budgeted ? 3 : 1) && least > P80; windows++) {
        if (windows) await page.waitForTimeout(3000);
        await aim();
        await cdp!.send("Emulation.setCPUThrottlingRate", { rate: SLOWED });
        await page.waitForTimeout(1000);
        const gaps = (await frameGaps(page, 150)).sort((a, b) => a - b);
        await cdp!.send("Emulation.setCPUThrottlingRate", { rate: 1 });
        await phone.steer(null, 0, false);
        least = Math.min(least, Math.round(gaps[Math.floor(gaps.length * 0.8)]!));
      }
      return { p80: least, windows };
    };
    for (const setting of ["low", "balanced", "high", "ultra"]) {
      await k(`globalThis.causalis.setQuality(${JSON.stringify(setting)})`);
      await page.waitForTimeout(3000);
      const budgeted = setting === "low" || setting === "balanced",
        { p80, windows } = await p80Walking(budgeted),
        // (How many of the town are drawn at the setting, and how many the small world holds.)
        seen = await k<{ drawn: number; bodies: number }>(
          `({ drawn: globalThis.causalis.watching(), bodies: globalThis.causalis.possess.state()?.live?.bodies.length ?? 0 })`,
        );
      say(
        n(
          `${setting.padEnd(8)} walking him, the CPU slowed ×${SLOWED}: p80 frame ${p80} ms${windows > 1 ? ` (the least of ${windows} windows)` : ""}; ${seen.drawn} of the town drawn, ${seen.bodies} in the small world`,
        ),
      );
      if (budgeted)
        check(
          p80 <= P80,
          n(`${setting}: the p80 frame is ${p80} ms with the CPU slowed ×${SLOWED}`),
        );
    }
    // Auto, from the finest, the CPU slowed and he walking: where it comes to rest (its setting
    // held ten seconds, a minute at most), measured there; had it stepped as it was measured,
    // settled and measured again (as gate 55 settles it). Each step reads the town again.
    await k(`globalThis.causalis.setQuality("auto")`);
    const settle = async () => {
      await aim();
      await cdp!.send("Emulation.setCPUThrottlingRate", { rate: SLOWED });
      let at = await k<string>(`globalThis.causalis.quality()`),
        since = Date.now(),
        aimed = Date.now();
      const by = Date.now() + 60_000;
      while (Date.now() < by && Date.now() - since < 10_000) {
        await page.waitForTimeout(500);
        const q = await k<string>(`globalThis.causalis.quality()`);
        if (q !== at) {
          at = q;
          since = Date.now();
        }
        if (Date.now() - aimed > 5000) {
          await aim();
          aimed = Date.now();
        }
      }
      await cdp!.send("Emulation.setCPUThrottlingRate", { rate: 1 });
      await phone.steer(null, 0, false);
      return at;
    };
    let rest = await settle(),
      settled = { p80: 0, windows: 0 };
    for (let tries = 1; ; tries++) {
      await page.waitForTimeout(3000);
      settled = await p80Walking(true);
      const at = await k<string>(`globalThis.causalis.quality()`);
      if (at === rest || tries === 3) {
        rest = at;
        break;
      }
      say(n(`auto     stepped from ${rest} to ${at} as it was measured: settled again`));
      rest = await settle();
    }
    const seen = await k<{ drawn: number; bodies: number }>(
      `({ drawn: globalThis.causalis.watching(), bodies: globalThis.causalis.possess.state()?.live?.bodies.length ?? 0 })`,
    );
    say(
      n(
        `auto     comes to rest at ${rest}; walking him, the CPU slowed ×${SLOWED}: p80 frame ${settled.p80} ms${settled.windows > 1 ? ` (the least of ${settled.windows} windows)` : ""}; ${seen.drawn} of the town drawn, ${seen.bodies} in the small world`,
      ),
    );
    check(
      settled.p80 <= P80,
      n(
        `at ${rest}, Auto's rest, the p80 frame is ${settled.p80} ms with the CPU slowed ×${SLOWED}`,
      ),
    );
    await k(`globalThis.causalis.setQuality("high")`);
    await page.waitForTimeout(1500);
  }
  // Let go: the town drawn from history again, the controls put away, the chrome back.
  await hands.letGo();
  await page
    .waitForFunction(
      () =>
        !(
          globalThis as { causalis?: { possess?: { state(): unknown } } }
        ).causalis?.possess?.state(),
      undefined,
      { timeout: slow(30_000) },
    )
    .catch(() => undefined);
  await page.waitForTimeout(slow(1500));
  // (And the orbit handed back over where he stood, as much of the town across the screen as a
  // desk shows at the nearest: metres across at its target, the lens 45° high.)
  const back = await k<{ held: boolean; hud: boolean; chrome: number; across: number }>(`({
    held: !!globalThis.causalis.possess.state(),
    hud: !document.querySelector(".possess-hud").hidden,
    chrome: [...document.querySelectorAll("#hud > *:not(.possess-hud)")].filter((e) => getComputedStyle(e).display !== "none").length,
    across: (globalThis.causalis.rig.distance / 0.1) * 2 * Math.tan(Math.PI / 8) * (innerWidth / innerHeight),
  })`);
  check(!back.held && !back.hud, n("not let go"));
  check(back.chrome > 0, n("the game's own controls not back after letting go"));
  say(n(`let go: the town handed back ${Math.round(back.across)} m across the screen`));
  check(
    back.across >= 50,
    n(`handed back too near: ${Math.round(back.across)} m of the town across the screen`),
  );
  await shot(`${tag}-6-let-go`);
  return taken;
}

/** The gaps between frames for the next `n` frames (ms). */
function frameGaps(p: Page, n: number): Promise<number[]> {
  return p.evaluate(
    (n) =>
      new Promise<number[]>((done) => {
        const gaps: number[] = [];
        let last = performance.now();
        const tick = () => {
          const t = performance.now();
          gaps.push(t - last);
          last = t;
          if (gaps.length < n) requestAnimationFrame(tick);
          else done(gaps);
        };
        requestAnimationFrame(tick);
      }),
    n,
  );
}

/** What a walk wrote back: the chronicle, his page, the spirits of the one spoken to. */
async function written(hands: Hands, w: { agent: number; name: string; listener: number | null }) {
  const n = (s: string) => `${hands.name}: ${s}`,
    me = first(w.name),
    chron = await ask<{ events: { type: string; claim: string }[] }>("chronicle", {
      types: ["hand.possessed", "hand.made", "hand.spoke", "hand.released"],
      limit: 400,
    }),
    of = (type: string) => chron.events.filter((e) => e.type === type).map((e) => e.claim);
  const possessed = of("hand.possessed").find((c) => c.includes(` as ${me} `)),
    made = of("hand.made").find((c) => c.startsWith(`By your hand: ${me} made `)),
    released = of("hand.released").find((c) => c.startsWith(`You let go of ${me},`));
  say(n(`the chronicle: “${possessed}”; “${made}”; “${released}”`));
  check(!!possessed, n(`the chronicle does not tell the god walking among them as ${me}`));
  check(
    !!made && made.includes(`in ${great.name}, the town's`),
    n(`the chronicle does not tell what ${me} made: ${made}`),
  );
  check(
    !!released && /1 made by hand/.test(released) && /spoken to/.test(released),
    n(`the letting go told as “${released}”`),
  );
  const page = await ask<PageModel>("page", { ref: `agent:${w.agent}` }),
    remembered =
      page.tabs
        .flatMap((t) => t.blocks)
        .find((b) => b.title === "Remembered for")
        ?.items?.map((i) => words(i.line)) ?? [];
  check(
    remembered.some((r) => r.startsWith(`By your hand: ${me} made `)),
    n(`his page does not remember what he made: ${remembered.join(" | ")}`),
  );
  if (w.listener !== null) {
    const mood = await ask<{ mood: number } | null>("possess.mood", { id: w.listener });
    say(n(`the one spoken to: spirits ${mood?.mood ?? "?"}`));
    check((mood?.mood ?? 0) > 0, n(`the spirits of the one spoken to not moved (${mood?.mood})`));
  }
}

/**
 * The world going on after he is let go: an hour a second until two hours have gone, then held
 * again (by the clock, not by the frames: in software they come slowly, and the working day after
 * would be gone).
 */
async function goesOn(hands: Hands) {
  const t1 = await k<number>(`globalThis.causalis.client.status.t`);
  await k(`globalThis.causalis.client.setSpeed(3600)`);
  await page
    .waitForFunction(
      (until) =>
        ((globalThis as { causalis?: { client: { status?: { t: number } } } }).causalis?.client
          .status?.t ?? 0) >= until,
      t1 + 2 * 3600,
      { timeout: slow(30_000) },
    )
    .catch(() => undefined);
  await k(`globalThis.causalis.client.setSpeed(0)`);
  await page.waitForTimeout(500);
  const t2 = await k<number>(`globalThis.causalis.client.status.t`);
  say(`${hands.name}: let go, the world went on ${Math.round(t2 - t1)} s (${took()})`);
  check(
    t2 - t1 >= 2 * 3600 - 60,
    `${hands.name}: the world did not go on after letting go (${t2 - t1} s)`,
  );
}

// 2. At a desk.
if (!kit) {
  const w = await walk(desk, "desk");
  if (!w) await fail();
  await written(desk, w!);
  await goesOn(desk);
}

// 3. At a phone's size, by touch: in a phone's own context (the desk's page put away), the same
// world opened again at the same morning; its fingers Chromium's own, by the devtools protocol.
if (!kit) {
  await page.close();
  await context.close();
  context = await contextFor(true);
  page = await pageOf(context);
  await open();
  cdp = await context.newCDPSession(page);
}
{
  const w = await walk(phone, "phone");
  if (!w) await fail();
  await written(phone, w!);
  const vibrated = await k<number>(`navigator.vibrated ?? 0`);
  check(vibrated === 0, `${phone.name}: the page asked for ${vibrated} vibrations`);
  await goesOn(phone);
}

// 4. The save: its history replayed from the seed to the same world.
{
  const bytes = new Uint8Array(
      Buffer.from(
        await k<string>(`globalThis.causalis.client.exportSave().then((b) => {
          let s = "";
          for (let i = 0; i < b.length; i += 0x8000) s += String.fromCharCode(...b.subarray(i, i + 0x8000));
          return btoa(s);
        })`),
        "base64",
      ),
    ),
    doc = await decodeSave(bytes),
    commands =
      (doc.stores["commands.log"]?.data as { commands?: { type: string }[] } | undefined)
        ?.commands ?? [],
    possessing = commands.filter((c) => c.type.startsWith("possess.")).length,
    started = performance.now(),
    verdict = verifyByReplay(doc, (seed) => EARTH.build(seed));
  say(
    `the save: ${Math.round(bytes.length / 1024)} KB, ${commands.length} commands (${possessing} of possession), replayed from the seed in ${Math.round((performance.now() - started) / 1000)} s: ${verdict.ok ? "the same world" : verdict.problem}`,
  );
  check(possessing >= 6, `the save holds ${possessing} commands of possession`);
  check(verdict.ok, `the save does not replay to the same world: ${verdict.problem}`);
}

await browser.close();
await server.close();
if (errors.length) problems.push(...errors.map((e) => `page error: ${e}`));
say(`(${took()})`);
if (problems.length) {
  console.log("FAILED:");
  for (const p of problems) console.log(`  - ${p}`);
  process.exit(1);
}
console.log("the Phase 60 gate passes");
