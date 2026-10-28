// node tools/phase61-gate.ts [--ci] [--soft] [--webkit] [--shots dir] — the Phase 61 gate (a soldier,
// a beast and a creature possessed, the god's hand made flesh in any body; asked for 2026-10-27: "oh
// shit add in functionality to possess anything like worldbox/worldfall mod, plan for this later and
// make sure it works right in mobile"), in parts:
//   1. in node (not on CI): the oracle's histories as they were — a world where no soldier or beast is
//      possessed keeps every hash;
//   2. on the built app, the Earth seed at year 61, at a desk: a battle of year 60 laid before its
//      land's heart town; at twenty past eight, one of its men still in the fight taken from the
//      palette with a click, his strip his arm and the battle's tally; brought to the foe and struck at
//      by the keys until one falls, the tally moving as men fall and the fallen named; let go with
//      Esc (or struck down): the chronicle telling the god fought as him, the battle's record as his
//      fight left it, his page by the hand, the battle laid again and drawn from his fight, and the
//      war going on from the hand's result;
//   3. one of the town's beasts (its flock's, else the wild's) taken with a click: grazed, run from its
//      herd until it strays; let go: the chronicle telling it, lost to the flock and not drawn with it;
//   4. at an iPhone 15 Plus's size by touch (Chromium's own touches; with --webkit, WebKit's taps and
//      pointers), the world opened again: the soldier by taps and the stick, every control a thumb's
//      width, the game's own put away, the phone turned on its side and back; the beast by a tap; and
//      (not in software, nor WebKit) with the CPU slowed four times, the frames kept while he fights —
//      the slower fifth within 22 ms at Low and Balanced and where Auto comes to rest;
//   5. an age's living world in the beginning (the genesis), one of its beasts walked in from its acts
//      (a touch to follow one, then Walk in one; one that cannot eat where it stands let go, the next
//      walked in), eating, steered, let go, the beginning telling it — at a desk by clicks and keys,
//      and at the phone's size by touch;
//   6. the save of all that: its history replayed from the seed to the same world.
// (npm run build first; --soft draws in software, as CI's browser does; --shots keeps a picture of
// each step; --webkit runs parts 4 to 6 in WebKit alone, Safari's own engine.)
import { spawnSync } from "node:child_process";
import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { preview } from "vite";
import { chromium, webkit, type BrowserContext, type CDPSession, type Page } from "playwright";
import { verifyByReplay } from "../src/kernel/index.ts";
import { EARTH, decodeSave } from "../src/host/index.ts";
import { WILD_STRAY } from "../src/rules/index.ts";

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
const DAY = 86_400,
  HOUR = 3_600,
  YEAR = 365 * DAY,
  /** The year opened: its turn fights the battles of the year before. */
  OPENED = 61;
const problems: string[] = [];
const say = (line: string) => console.log(`  ${line}`);
const check = (ok: boolean, problem: string) => {
  if (!ok) problems.push(problem);
};
/** How long to wait on what the frames bring: longer where they come slowly. */
const slow = (ms: number) => (ci || soft ? ms * 4 : ms);
const t0 = performance.now();
const took = () => `${Math.round((performance.now() - t0) / 1000)} s`;
console.log(`the Phase 61 gate${kit ? " (WebKit, at a phone's size)" : ""}`);
if (shots) mkdirSync(shots, { recursive: true });

// —— 1. In node: a world where none is possessed keeps every hash ———————————————————————————

if (!ci && !kit && !process.argv.includes("--no-oracle")) {
  const oracle = spawnSync(
    process.execPath,
    [fileURLToPath(new URL("./oracle.ts", import.meta.url))],
    { encoding: "utf8" },
  );
  say(`the oracle's histories: ${oracle.status === 0 ? "as they were" : "changed"} (${took()})`);
  check(oracle.status === 0, `the oracle's histories changed:\n${oracle.stdout}`);
}

// —— 2–6. On the built app ————————————————————————————————————————————————————————————

type Offer = { act: number; icon: string; label: string; can: boolean; words: string };
type Body = { id: number; x: number; z: number; doing: string; hurt: number };
type Tally = {
  sides: { realm: string; standing: number; fallen: number }[];
  named: { name: string; side: number; dead: boolean; by: string; god: boolean }[];
  broke: number;
  brokeAt: number;
  mine: number;
};
type Live = {
  kind: "soldier" | "beast";
  step: number;
  bodies: Body[];
  offers: Offer[];
  told: { words: string; step: number; good: boolean } | null;
  strip: { name: string; what: string; strength: number; carries: string; body: string };
  tally: Tally | null;
  ended: string;
};
type HeldState = {
  kind: "soldier" | "beast";
  now: {
    name: string;
    town?: string;
    ref?: string;
    battle?: string;
    figure?: number;
    side?: number;
    village?: string;
    bodies: number[];
    members?: number[];
  };
  live: Live | null;
  me: { x: number; z: number; yaw: number } | null;
  eye: { yaw: number };
  /** Those between the eye and the body, not drawn. */
  cleared?: number;
  unposed?: number;
};
type Placed = {
  event: string;
  turn: number;
  stage: string | null;
  s: number;
  figures: number[];
  onScreen: { id: number; side: number; act: string; at: { x: number; y: number } | null }[];
};
type Span = string | { text: string; ref?: string };
type PageModel = {
  title: string;
  tabs: {
    id: string;
    blocks: {
      type: string;
      title?: string;
      items?: { line: Span[] }[];
      rows?: { label: string; value: Span[] }[];
    }[];
  }[];
};
const words = (l: Span[] | undefined) =>
  (l ?? []).map((s) => (typeof s === "string" ? s : s.text)).join("");
const first = (name: string) => name.replace(/ of .*$/, "");

const root = fileURLToPath(new URL("..", import.meta.url)),
  // (CAUSALIS_DIST: a build elsewhere, so that one can be looked at while dist/ is under test.)
  server = await preview({
    root,
    logLevel: "silent",
    preview: { port: 4361, strictPort: false },
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
/** A context of the browser's: a phone's (its frame, its pixels, its touch) or a desk's; never asked for a vibration uncounted. */
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
const held = () => k<HeldState | null>(`globalThis.causalis.held.state()`);
const placedNow = () => k<Placed | null>(`globalThis.causalis.placedBattle?.() ?? null`);
const now = () => k<number>(`globalThis.causalis.client.status?.t ?? 0`);
/** On to moment t (the clock held): the host's word of it come, and a few frames drawn there. */
const advance = async (t: number) => {
  await k(`globalThis.causalis.client.advance(${Math.round(t)})`);
  await page
    .waitForFunction(
      (at) =>
        ((globalThis as { causalis?: { client: { status?: { t: number } } } }).causalis?.client
          .status?.t ?? 0) >=
        at - 1,
      t,
      { timeout: slow(30_000) },
    )
    .catch(() => undefined);
  await page.waitForTimeout(slow(600));
};
/** Whether it comes within the time (not a problem if not). */
const comes = async (ok: () => Promise<boolean>, ms: number) => {
  const end = Date.now() + ms;
  while (Date.now() < end) {
    if (await ok().catch(() => false)) return true;
    await page.waitForTimeout(250);
  }
  return false;
};
const centre = async (selector: string) => {
  const r = await page
    .locator(selector)
    .first()
    .boundingBox({ timeout: slow(5000) })
    .catch(() => null);
  return r && r.width > 0 && r.height > 0 ? { x: r.x + r.width / 2, y: r.y + r.height / 2 } : null;
};
/** The controls shown (the held one's: app/held.ts keeps its own beside app/possess.ts's). */
const HUD = ".possess-hud:not([hidden])";

// —— the hands: a desk's keys and mouse, or a phone's fingers ———————————————————————————

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
  tap(x: number, y: number): Promise<void>;
  /** The body steered toward a ground direction (radians, as a yaw) as the eye looks, or let be (null). */
  steer(aim: number | null, eyeYaw: number, run: boolean): Promise<void>;
  act(slot: number): Promise<void>;
  letGo(): Promise<void>;
};
const keys = new Set<string>();
const desk: Hands = {
  name: "desk",
  tap: (x, y) => page.mouse.click(x, y),
  async steer(aim, eyeYaw, run) {
    const want = new Set<string>();
    if (aim !== null) {
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
        const e = document.querySelector("${HUD} .possess-stick");
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
    const at = await centre(`${HUD} .possess-act-${slot}`);
    if (at) await this.tap(at.x, at.y);
  },
  async letGo() {
    const at = await centre(`${HUD} .possess-letgo`);
    if (at) await this.tap(at.x, at.y);
  },
};

/** Possess taken up in the palette by the hands. */
async function arm(hands: Hands): Promise<string | null> {
  if ((await k<string | null>(`globalThis.causalis.palette.holding()`)) === "possess") return null;
  for (const selector of [".palette-toggle", '.palette-tab[data-kind="flesh"]', ".palette-act"]) {
    if (
      selector === ".palette-toggle" &&
      ((await k<boolean>(`!!document.querySelector(".palette.open")`)) || !(await centre(selector)))
    )
      continue;
    await page
      .locator(selector)
      .first()
      .waitFor({ state: "visible", timeout: slow(15000) })
      .catch(() => undefined);
    const at = await centre(selector);
    if (!at) {
      say(
        `palette unavailable: ${await k<string>(`JSON.stringify({scale:causalis.scale(),body:document.body.className,palette:document.querySelector('.palette')&&getComputedStyle(document.querySelector('.palette')).display, tabs:[...document.querySelectorAll('.palette-tab')].map(e=>({kind:e.dataset.kind,box:e.getBoundingClientRect().toJSON()}))})`)}`,
      );
      await shot(`${hands.name}-palette-unavailable`);
      return `no ${selector} to touch`;
    }
    await hands.tap(at.x, at.y);
    await page.waitForTimeout(slow(300));
  }
  const holding = await k<string | null>(`globalThis.causalis.palette.holding()`);
  return holding === "possess" ? null : `the palette holds ${holding ?? "nothing"}, not Possess`;
}
const paletteWords = () => k<string>(`document.querySelector(".palette-words")?.textContent ?? ""`);

// —— the world: the Earth seed at year 61, a battle of year 60 before its land's heart town ————————

/** The world opened on the page at year 61, the clock held; a battle of year 60 laid before its land's heart town. */
async function open(quality = "high"): Promise<{ event: string; town: string; turn: number }> {
  await page.goto(`${base}?universe=earth&seed=first%20light&year=${OPENED}&hold=1`);
  await page.waitForFunction(
    () => ((globalThis as { causalis?: { drawn?: () => number } }).causalis?.drawn?.() ?? 0) > 0,
    undefined,
    { timeout: 1_800_000 },
  );
  await k(`globalThis.causalis.setQuality(${JSON.stringify(quality)})`);
  await k(`globalThis.causalis.client.setSpeed(0)`);
  const turn = Math.floor((await now()) / YEAR),
    map = await ask<{
      wars: { battles: { event: string; year: number; spot: number; fallen: number }[] }[];
    }>("wars.map", {});
  battles = map.wars
    .flatMap((w) => w.battles.filter((b) => b.year === turn - 1 && b.spot >= 0))
    .sort((a, b) => b.fallen - a.fallen || (a.event < b.event ? -1 : 1));
  used.clear();
  await advance(turn * YEAR + 5 * HOUR);
  const into = await intoBattle(turn);
  if (into) return into;
  check(false, `no battle of year ${turn - 1} laid before its land's heart town`);
  await fail();
  throw new Error("unreachable");
}
/** The battles of the year before the turn, the greatest first; those gone into for a soldier. */
let battles: { event: string; spot: number; fallen: number }[] = [];
const used = new Set<string>();
/** Into the town before which the next battle not yet gone into is laid (null: none). */
async function intoBattle(
  turn: number,
): Promise<{ event: string; town: string; turn: number } | null> {
  for (const b of battles.filter((x) => !used.has(x.event)).slice(0, 8)) {
    used.add(b.event);
    const cell = await k<number>(
        `globalThis.causalis.client.latestFrame("globe").arrays.province[${b.spot}] ?? -1`,
      ),
      heart = cell >= 0 ? await ask<string | null>("land.heart", { cell }) : null;
    if (!heart) continue;
    await k(`globalThis.causalis.goTo(${JSON.stringify(heart)})`);
    if (
      !(await comes(
        async () => (await k<string>(`globalThis.causalis.scale()`)) === "village",
        slow(60_000),
      ))
    )
      continue;
    if (await comes(async () => (await placedNow())?.event === b.event, slow(20_000))) {
      say(
        `the Earth seed at year ${turn}: ${b.event} (${b.fallen} fallen) laid before ${heart}, at ${await k<string>("`${innerWidth}×${innerHeight} at ${devicePixelRatio}`")} (${took()})`,
      );
      return { event: b.event, town: heart, turn };
    }
  }
  return null;
}

/** The battle at twenty past eight, the eye on it: one of its men standing in the fight on the screen. */
async function fighting(turn: number): Promise<Placed["onScreen"][number] | null> {
  await advance(turn * YEAR + 8 * HOUR + 20 * 60);
  await k(`globalThis.causalis.faceBattle()`);
  await page.waitForTimeout(slow(2500));
  const p = await placedNow();
  if (!p) return null;
  const w = await k<number>(`innerWidth`),
    h = await k<number>(`innerHeight`),
    standing = p.onScreen.filter(
      (t) =>
        t.at &&
        t.act !== "fall" &&
        t.act !== "flee" &&
        t.at.x > 60 &&
        t.at.x < w - 60 &&
        t.at.y > 160 &&
        t.at.y < h - 240,
    );
  say(
    `at 8:20 the battle is at its second ${Math.round(p.s)} (${p.stage}); ${standing.length} standing on the screen`,
  );
  // (The nearest the screen's middle: clear of the controls.)
  return (
    standing.sort(
      (a, b) =>
        Math.hypot(a.at!.x - w / 2, a.at!.y - h / 2) - Math.hypot(b.at!.x - w / 2, b.at!.y - h / 2),
    )[0] ?? null
  );
}

/** The fight, for the checks after: who, what he did, the tally as it moved. */
type Fought = {
  name: string;
  figure: number;
  ref: string;
  battle: string;
  felled: boolean;
  fallen0: number;
  fallen1: number;
  named: number;
};

/** A soldier of the battle before the town taken by these hands and fought until one falls; let go. */
async function soldier(
  hands: Hands,
  tag: string,
  turn: number,
  turning = false,
): Promise<Fought | null> {
  const n = (s: string) => `${hands.name}: ${s}`;
  const man = await fighting(turn);
  check(!!man, n("none of the battle's men standing on the screen at twenty past eight"));
  if (!man) return null;
  const armed = await arm(hands);
  check(!armed, n(armed ?? ""));
  await hands.tap(man.at!.x, man.at!.y);
  await comes(async () => !!(await held())?.live, slow(30_000));
  let s = await held();
  check(s?.kind === "soldier", n(`no soldier taken from the palette: “${await paletteWords()}”`));
  if (!s?.live || s.kind !== "soldier") return null;
  const tally0 = s.live.tally!,
    fallen0 = tally0.sides[0]!.fallen + tally0.sides[1]!.fallen,
    him = {
      name: s.now.name,
      figure: s.now.figure ?? -1,
      ref: s.now.ref ?? "",
      battle: s.now.battle ?? "",
    };
  say(
    n(
      `${s.now.name} of ${s.now.town} taken (figure ${s.now.figure}, side ${s.now.side}): “${s.live.strip.what}”, bearing ${s.live.strip.carries}; the tally ${tally0.sides.map((x) => `${x.realm} ${x.standing}/${x.fallen}`).join(" against ")}; ${s.cleared ?? 0} between the eye and him not drawn, ${s.unposed ?? 0} out of its sight not posed (${took()})`,
    ),
  );
  check(/of the host of /.test(s.live.strip.what), n(`his strip says “${s.live.strip.what}”`));
  check(s.live.offers.length === 4, n(`${s.live.offers.length} acts before him`));
  check(
    tally0.sides.every((x) => x.standing > 0 && x.realm.length > 0),
    n(`the tally at the taking: ${JSON.stringify(tally0.sides)}`),
  );
  // The controls as the phone shows them (and the game's own put away).
  const sized = await k<{
    acts: number[];
    letGo: number;
    chrome: number;
    tally: boolean;
    touch: string;
  }>(`(() => {
    const hud = document.querySelector("${HUD}"), box = (e) => e.getBoundingClientRect();
    return {
      acts: [...hud.querySelectorAll(".possess-act")].map((b) => Math.min(box(b).width, box(b).height)),
      letGo: box(hud.querySelector(".possess-letgo")).height,
      chrome: [...document.querySelectorAll("#hud > *:not(.possess-hud)")].filter((e) => getComputedStyle(e).display !== "none").length,
      tally: !hud.querySelector(".possess-tally").hidden,
      touch: getComputedStyle(hud).touchAction,
    };
  })()`);
  check(
    sized.acts.length === 4 && sized.acts.every((a) => a >= 56),
    n(`the acts not four of 56 px or more: ${sized.acts.join(", ")}`),
  );
  check(sized.letGo >= 44, n(`Let go ${sized.letGo} px high`));
  check(sized.chrome === 0, n(`${sized.chrome} of the game's own controls shown while he fights`));
  check(sized.tally, n("the battle's tally not shown"));
  check(sized.touch === "none", n(`the controls' touch-action is ${sized.touch}`));
  await shot(`${tag}-1-taken`);
  // Turned on its side and back, the possession's clock held meanwhile.
  if (turning) {
    const still = await centre(`${HUD} .possess-pace[data-pace="0"]`);
    if (still) await hands.tap(still.x, still.y);
    await turned(hands, tag);
    const on = await centre(`${HUD} .possess-pace[data-pace="1"]`);
    if (on) await hands.tap(on.x, on.y);
  }
  // Brought to the foe and struck at until one falls (by his hand, or he).
  let felled = false,
    strikes = 0,
    bodyWords = "";
  const until = Date.now() + slow(70_000);
  while (Date.now() < until) {
    s = await held();
    if (!s?.live || s.live.ended) break;
    const tally = s.live.tally!;
    if (tally.named.some((x) => x.god)) {
      felled = true;
      break;
    }
    const foe = await k<{ id: number; x: number; z: number; far: number } | null>(
      `globalThis.causalis.held.foe()`,
    );
    if (foe && s.me) {
      const aim = Math.atan2(foe.x - s.me.x, foe.z - s.me.z);
      await hands.steer(foe.far > 1.4 ? aim : null, s.eye.yaw, foe.far > 4);
    }
    // (A blow where one is ready; else the blows coming at him turned.)
    if (s.live.offers[0]?.can) {
      await hands.act(0);
      strikes++;
    } else if (s.live.offers[1]?.can && foe && foe.far < 2.5) await hands.act(1);
    await page.waitForTimeout(150);
  }
  await hands.steer(null, 0, false);
  s = await held();
  // (Ended for him meanwhile: the small world as it stood when it did.)
  const last = s?.live ?? (await k<Live | null>(`globalThis.causalis.held.last()`)),
    tally = last?.tally ?? null,
    fallen1 = tally ? tally.sides[0]!.fallen + tally.sides[1]!.fallen : fallen0;
  bodyWords = last?.strip.body ?? "";
  say(
    n(
      `${strikes} blows struck; ${felled ? "one fell by his hand" : last?.ended ? `it ended for him: ${last.ended}` : "none fell by his hand"}; the fallen ${fallen0} → ${fallen1}; named: ${(tally?.named ?? []).map((x) => `${x.by} struck down ${x.name}${x.god ? " (by the hand)" : ""}`).join("; ")}; “${last?.told?.words ?? ""}”; his body: ${bodyWords} (${took()})`,
    ),
  );
  // (One falls: by his hand, or he.)
  check(
    felled || last?.ended === "dead" || last?.ended === "down",
    n(`none fell by his hand in ${strikes} blows, nor he (${last?.ended})`),
  );
  check(fallen1 > fallen0, n(`the tally's fallen did not move (${fallen0} → ${fallen1})`));
  check((tally?.named.length ?? 0) > 0, n("none of the fallen named"));
  await shot(`${tag}-2-fought`);
  const taken: Fought = {
    ...him,
    felled,
    fallen0,
    fallen1,
    named: tally?.named.length ?? 0,
  };
  // Let go (unless it ended for him): the controls put away, the battle laid again as he fought it.
  if (s) await hands.letGo();
  await comes(async () => !(await held()), slow(30_000));
  await page.waitForTimeout(slow(2000));
  const back = await k<{ held: boolean; chrome: number }>(`({
    held: !!globalThis.causalis.held.state(),
    chrome: [...document.querySelectorAll("#hud > *:not(.possess-hud)")].filter((e) => getComputedStyle(e).display !== "none").length,
  })`);
  check(!back.held, n("not let go"));
  check(back.chrome > 0, n("the game's own controls not back after letting go"));
  return taken;
}

/** What a soldier's fight wrote back: the chronicle, the battle's record, his page, the field as he left it, the war going on. */
async function foughtBack(hands: Hands, f: Fought, tag: string, turn: number) {
  const n = (s: string) => `${hands.name}: ${s}`,
    me = first(f.name),
    chron = await ask<{ events: { type: string; claim: string; ref?: string }[] }>("chronicle", {
      types: ["hand.soldier", "hand.fought"],
      limit: 200,
    }),
    took1 = chron.events.find((e) => e.type === "hand.soldier" && e.claim.includes(me)),
    fought = chron.events.find((e) => e.type === "hand.fought" && e.claim.includes(me));
  say(n(`the chronicle: “${took1?.claim}”; “${fought?.claim}”`));
  check(!!took1, n(`the chronicle does not tell the god taking ${me}'s body`));
  check(
    !!fought &&
      /^By your hand: the god fought as /.test(fought.claim) &&
      / won the day/.test(fought.claim),
    n(`the battle the god fought told as “${fought?.claim}”`),
  );
  // The battle's record as his fight left it, laid again before the town and drawn from his fight.
  const near = await ask<{
      hand?: { name: string; won: boolean; most: number; from: number };
    } | null>("battle.near", { event: f.battle }),
    end = await ask<{ last: number; bodies: unknown[]; broke: number } | null>("held.fought", {
      battle: f.battle,
    });
  say(
    n(
      `the battle's record: the god fought in it as ${near?.hand?.name}, his side ${near?.hand?.won ? "won" : "lost"} the day; his fight fought out to step ${end?.last} (${end?.bodies.length} bodies, side ${end?.broke} broke)`,
    ),
  );
  check(
    near?.hand?.name === f.name,
    n(`the battle's record does not hold the hand: ${JSON.stringify(near?.hand)}`),
  );
  check(!!end && end.last > 0, n("the fight not fought out after he was let go"));
  check(
    await comes(
      async () =>
        (await k<{ end: unknown }[]>(`globalThis.causalis.held.fought()`)).some((x) => !!x.end),
      slow(20_000),
    ),
    n("the battle not drawn from his fight once laid again"),
  );
  // His page: by the hand.
  if (f.ref) {
    const pg = await ask<PageModel | null>("page", { ref: f.ref }).catch(() => null),
      lines = (pg?.tabs ?? [])
        .flatMap((t) => t.blocks)
        .flatMap((b) => [
          ...(b.rows ?? []).map((x) => `${x.label}: ${words(x.value)}`),
          ...(b.items ?? []).map((i) => words(i.line)),
        ]);
    const by = lines.find((l) => /The god fought in his body/.test(l));
    say(n(`his page: “${by ?? lines.slice(0, 3).join(" | ")}”`));
    check(!!by, n(`his page does not tell the god fought in his body (${pg?.title})`));
  }
  await shot(`${tag}-3-as-he-left-it`);
  // The war goes on from the hand's result: the days after, the battle's record as he left it.
  const t1 = await now();
  await advance(turn * YEAR + 6 * DAY);
  const t2 = await now(),
    after = await ask<{ hand?: { won: boolean } } | null>("battle.near", { event: f.battle });
  say(
    n(
      `the world went on ${Math.round((t2 - t1) / DAY)} days; the day still ${after?.hand?.won ? "his side's" : "the foe's"} (${took()})`,
    ),
  );
  check(t2 - t1 >= 5 * DAY, n(`the world did not go on (${t2 - t1} s)`));
  check(after?.hand?.won === near?.hand?.won, n("the battle's record moved after he was let go"));
}

/**
 * The battle the god fought gone down to on its close field (Phase 37's): laid at the figures a side
 * he was taken at, drawn as history drew it until the second he was taken and from his fight from
 * then on, its panel saying so.
 */
async function closeField(f: Fought) {
  const end = await ask<{ second: number; last: number; per: number } | null>("held.fought", {
    battle: f.battle,
  });
  const shown = await k<boolean>(`globalThis.causalis.watchBattle(${JSON.stringify(f.battle)})`);
  check(shown && !!end, `desk: the battle the god fought not shown on its close field`);
  if (!shown || !end) return;
  type Field = { hand: boolean; figures: number[]; per: number } | null;
  const field = () => k<Field>(`globalThis.causalis.battle()`);
  await k(`globalThis.causalis.battleAt(${end.second - 2}, 0)`);
  const before = await field();
  await k(`globalThis.causalis.battleAt(${end.second + end.last / 20 + 1}, 0)`);
  await comes(async () => !!(await field())?.hand, slow(15_000));
  const after = await field(),
    title = await k<string>(
      `document.querySelector(".battle-panel-title, .battle-title")?.textContent ?? ""`,
    );
  say(
    `desk: the close field: ${after?.figures.join(" against ")} figures, ${after?.per} men a figure (his fight's ${end.per}); before the second he was taken ${before?.hand ? "his fight's" : "history's"}, after it ${after?.hand ? "his fight's" : "history's"}; “${title}”`,
  );
  check(before?.hand === false, "desk: the close field drawn from his fight before he was taken");
  check(after?.hand === true, "desk: the close field not drawn from his fight after he was taken");
  check(
    after?.per === end.per,
    `desk: the close field laid at ${after?.per} men a figure, not his fight's ${end.per}`,
  );
  check(
    /the god fought in it as /.test(title),
    `desk: the battle's panel does not tell the god fought in it: “${title}”`,
  );
  await shot("desk-6-close-field");
}

/** One of the town's beasts (its flock's, else the wild's) taken by these hands: grazed, run off until it strays; let go. */
async function beast(hands: Hands, tag: string): Promise<void> {
  const n = (s: string) => `${hands.name}: ${s}`;
  type Laid = {
    index: number;
    id: number;
    kind: string;
    flock: boolean;
    dead: boolean;
    x: number;
    z: number;
    at: { x: number; y: number } | null;
  };
  const all = await k<Laid[]>(`globalThis.causalis.held.beasts()`),
    pick = all
      .filter((b) => !b.dead && b.id < 900000)
      .sort((a, b) => Number(b.flock) - Number(a.flock))[0];
  check(!!pick, n(`no beast about the town to take (${all.length} laid)`));
  if (!pick) return;
  await k(
    `globalThis.causalis.rig.flyTo({ target: { x: ${pick.x * 0.1}, y: 0, z: ${pick.z * 0.1} }, distance: 3, pitch: -35 })`,
  );
  await page.waitForTimeout(slow(2500));
  const at = (await k<Laid[]>(`globalThis.causalis.held.beasts()`)).find(
    (b) => b.id === pick.id,
  )?.at;
  check(!!at, n(`the ${pick.kind} not on the screen`));
  if (!at) return;
  const armed = await arm(hands);
  check(!armed, n(armed ?? ""));
  await hands.tap(at.x, at.y);
  await comes(async () => !!(await held())?.live, slow(30_000));
  let s = await held();
  check(s?.kind === "beast", n(`no beast taken from the palette: “${await paletteWords()}”`));
  if (!s?.live || s.kind !== "beast") return;
  const flock = (s.now.members?.[0] ?? -1) >= 0;
  say(
    n(
      `${s.live.strip.name} taken (${s.live.strip.what}): ${s.live.strip.carries}; ${s.live.strip.body}; ${s.cleared ?? 0} between the eye and it not drawn (${took()})`,
    ),
  );
  check(s.live.offers.length === 4, n(`${s.live.offers.length} acts before it`));
  await shot(`${tag}-4-beast`);
  // Grazed.
  await hands.act(0);
  await comes(async () => /eats|drinks/.test((await held())?.live?.told?.words ?? ""), slow(8000));
  s = await held();
  say(n(`at the grass: “${s?.live?.told?.words ?? ""}”`));
  check(/It eats/.test(s?.live?.told?.words ?? ""), n(`grazing told as “${s?.live?.told?.words}”`));
  // Run off from its herd until it strays, well past the line (its herd's middle shifts a few metres
  // as they graze: stopped on the line, it could come back within it before it is let go).
  let strayed = false;
  const until = Date.now() + slow(40_000),
    past = (body: string) => Number(/^Strayed (\d+) m/.exec(body)?.[1] ?? 0) >= WILD_STRAY + 15;
  while (Date.now() < until) {
    s = await held();
    if (!s?.live || s.live.ended) break;
    if (past(s.live.strip.body) || !flock) {
      strayed = /^Strayed/.test(s.live.strip.body);
      if (strayed || Date.now() > until - slow(30_000)) break;
    }
    await hands.steer(s.eye.yaw, s.eye.yaw, true);
    await page.waitForTimeout(200);
  }
  await hands.steer(null, 0, false);
  s = await held();
  say(n(`run off: “${s?.live?.strip.body ?? ""}”`));
  if (flock) check(strayed, n(`run off, not strayed: “${s?.live?.strip.body}”`));
  await shot(`${tag}-5-strayed`);
  const id = s?.now.bodies[0] ?? pick.id;
  await hands.letGo();
  await comes(async () => !(await held()), slow(30_000));
  await page.waitForTimeout(slow(2500));
  const chron = await ask<{ events: { type: string; claim: string }[] }>("chronicle", {
      types: ["hand.beast", "hand.ran"],
      limit: 50,
    }),
    ran = chron.events.find((e) => e.type === "hand.ran");
  say(n(`the chronicle: “${ran?.claim}”`));
  check(
    !!chron.events.find((e) => e.type === "hand.beast"),
    n("the chronicle does not tell the god running as the beast"),
  );
  check(!!ran, n("the chronicle does not tell the beast let go"));
  if (flock && strayed) {
    check(/lost to it/.test(ran?.claim ?? ""), n(`the stray told as “${ran?.claim}”`));
    const still = (await k<Laid[]>(`globalThis.causalis.held.beasts()`)).some((b) => b.id === id);
    say(
      n(
        `the flock drawn again: the one that strayed ${still ? "still drawn with it" : "gone from it"}`,
      ),
    );
    check(!still, n("the beast lost to the flock still drawn with it"));
  }
}

/** The controls laid out on a phone held upright, turned on its side and back: none over another, none off the screen. */
async function turned(hands: Hands, tag: string) {
  const n = (x: string) => `${hands.name}: ${x}`;
  const laid = async (w: number, h: number) => {
    await page.setViewportSize({ width: w, height: h });
    await page.waitForTimeout(slow(900));
    return k<{ over: string[]; out: string[] }>(`(() => {
      const hud = document.querySelector("${HUD}");
      const names = [".possess-strip", ".possess-tally", ".possess-told", ".possess-letgo", ".possess-paces", ".possess-acts", ".possess-hint"];
      const boxes = names.map((n) => { const e = hud && hud.querySelector(n); return e && e.textContent !== "" && !e.hidden && getComputedStyle(e).display !== "none" && getComputedStyle(e).opacity !== "0" ? [n, e.getBoundingClientRect()] : null; }).filter(Boolean);
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
  await shot(`${tag}-landscape`);
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

/**
 * The phone floor's frames while a soldier is held in the battle (Chromium on this machine's GPU,
 * the CPU slowed as gates 8, 55 and 60 slow it): at Low, at Balanced and where Auto comes to rest,
 * each in a battle of its own laid at that setting before one of its men is taken (a battle is
 * fought by the hand once), the possession's clock at half pace and he kept back from the press,
 * a window of frames with the CPU slowed — the least of three — and let go.
 */
async function budget(turn: number) {
  const n = (x: string) => `${phone.name}: ${x}`;
  /** The stick pushed away from the foe: he keeps back while the battle goes on about him. */
  const keepBack = async () => {
    const s = await held(),
      foe = await k<{ x: number; z: number } | null>(`globalThis.causalis.held.foe()`);
    if (s?.me && foe)
      await phone.steer(Math.atan2(s.me.x - foe.x, s.me.z - foe.z), s.eye.yaw, false);
  };
  const window = async () => {
    let least = Infinity,
      windows = 0;
    for (; windows < 3 && least > P80; windows++) {
      if (windows) await page.waitForTimeout(3000);
      await keepBack();
      await cdp!.send("Emulation.setCPUThrottlingRate", { rate: SLOWED });
      await page.waitForTimeout(1000);
      const gaps = (await frameGaps(page, 150)).sort((a, b) => a - b);
      await cdp!.send("Emulation.setCPUThrottlingRate", { rate: 1 });
      await phone.steer(null, 0, false);
      least = Math.min(least, Math.round(gaps[Math.floor(gaps.length * 0.8)]!));
    }
    return { p80: least, windows };
  };
  /** Auto at four times the CPU's work until its setting holds ten seconds (a minute at most). */
  const settle = async () => {
    await cdp!.send("Emulation.setCPUThrottlingRate", { rate: SLOWED });
    let at = await k<string>(`globalThis.causalis.quality()`),
      since = Date.now();
    const by = Date.now() + 60_000;
    while (Date.now() < by && Date.now() - since < 10_000) {
      await page.waitForTimeout(500);
      const q = await k<string>(`globalThis.causalis.quality()`);
      if (q !== at) {
        at = q;
        since = Date.now();
      }
    }
    await cdp!.send("Emulation.setCPUThrottlingRate", { rate: 1 });
    return at;
  };
  for (const setting of ["low", "balanced", "auto"]) {
    await k(`globalThis.causalis.setQuality(${JSON.stringify(setting)})`);
    const into = await intoBattle(turn);
    check(!!into, n(`${setting}: no battle left to go into`));
    if (!into) return;
    const rest = setting === "auto" ? await settle() : setting,
      man = await fighting(turn);
    if (!man) {
      check(false, n(`${setting}: no man of ${into.event} to take for the frames`));
      continue;
    }
    const why = await k<string | null>(`globalThis.causalis.held.takeSoldier(${man.id})`);
    check(!why, n(`${setting}: not taken for the frames: ${why}`));
    if (why) continue;
    await comes(async () => !!(await held())?.live, slow(30_000));
    const half = await centre(`${HUD} .possess-pace[data-pace="0.5"]`);
    if (half) await phone.tap(half.x, half.y);
    const { p80, windows } = await window(),
      at = await k<string>(`globalThis.causalis.quality()`),
      p = await placedNow(),
      hs = await held(),
      bodies = hs?.live?.bodies.length ?? 0;
    say(
      n(
        `${setting === "auto" ? `auto at ${rest}` : setting} (${into.event}, ${p?.figures.join("/")} figures, ${bodies} in his fight, ${hs?.unposed ?? 0} out of the eye's sight not posed, ${hs?.cleared ?? 0} between not drawn), the CPU slowed ×${SLOWED}: p80 frame ${p80} ms${windows > 1 ? ` (the least of ${windows} windows)` : ""}${at !== rest ? `; at ${at} now` : ""}`,
      ),
    );
    check(
      p80 <= P80,
      n(
        `${setting === "auto" ? `at ${rest}, Auto's rest,` : `${setting}:`} the p80 frame is ${p80} ms with the CPU slowed ×${SLOWED}`,
      ),
    );
    await k(`globalThis.causalis.held.letGo()`);
    await comes(async () => !(await held()), slow(20_000));
  }
  await k(`globalThis.causalis.setQuality("high")`);
}

type Walked = {
  id: number;
  kind: string;
  x: number;
  z: number;
  energy: number;
  doing: string;
  told: string | null;
  offers: { label: string; can: boolean; words: string }[];
  killed: number;
  young: number;
  ate: number;
  yaw: number;
  /** How many beasts hid it this frame, not drawn. */
  cleared: number;
};
/** An age's living world in the beginning: one of its beasts walked in from its acts, eaten, steered, let go. */
async function creature(hands: Hands, tag: string) {
  const n = (x: string) => `${hands.name}: ${x}`,
    gen = () =>
      k<{
        stage: string;
        meadow: {
          age: number;
          beasts: number;
          first: { id: number; x: number; z: number } | null;
        } | null;
      }>(`globalThis.causalis.genesis()`),
    walked = () => k<Walked | null>(`globalThis.causalis.walked()`),
    tapOn = async (selector: string) => {
      const at = await centre(selector);
      if (at) await hands.tap(at.x, at.y);
      return !!at;
    },
    toldNow = () =>
      k<string>(
        `[...document.querySelectorAll(".genesis-told p")].map((p) => p.textContent).join(" | ")`,
      );
  await page.goto(`${base}?universe=earth&seed=first%20light&genesis=1`);
  await page.waitForSelector(".genesis h2", { timeout: 600_000 });
  for (let i = 0; i < 12 && (await gen()).stage !== "ages"; i++) {
    await page.locator(".genesis-row button:not(.link)").first().click();
    await page.waitForTimeout(400);
  }
  check((await gen()).stage === "ages", n(`not come to the ages (${(await gen()).stage})`));
  await page.locator(".genesis-bar .speed >> nth=4").click();
  await comes(async () => ((await gen()).meadow?.beasts ?? 0) > 0, slow(40_000));
  await page.locator(".genesis-bar .speed >> nth=1").click();
  await page.waitForTimeout(slow(2500));
  const m = (await gen()).meadow;
  check(!!m?.first, n("no beast on the land of the age"));
  if (!m?.first) return;
  // Walk in one: the one followed, or the next touched (the eye brought over them first).
  const walk = page.locator('.genesis-acts button:has-text("Walk in one")').first();
  check((await walk.count()) > 0, n("no Walk in one among the ages' acts"));
  // (The clock held so the beasts stand; the eye over the first that feeds where it stands — a
  // grazer, a browser, a pecker — where the age has one, else over the first.)
  await page.locator(".genesis-bar .speed >> nth=0").click();
  const over =
    (await k<{ x: number; z: number } | null>(`(() => {
      for (let id = 0; id < 4000; id++) {
        const b = globalThis.causalis.meadowBeast(id);
        if (b && b.feed !== "hunt" && b.feed !== "small" && b.feed !== "scavenge") return b;
      }
      return null;
    })()`)) ?? m.first;
  await k(
    `(() => { const r = globalThis.causalis.rig; r.target.set(${over.x * 0.1}, 0.2, ${over.z * 0.1}); r.distance = 6; })()`,
  );
  await page.waitForTimeout(slow(1500));
  /**
   * Those standing over the land itself, not under the beginning's panel: those that feed where they
   * stand first (grazers, browsers, peckers), then hunters, each nearest the screen's middle first.
   */
  const spots = (tried: readonly number[]) =>
    k<{ id: number; x: number; y: number }[]>(`(() => {
      const out = [], tried = ${JSON.stringify(tried)};
      for (let id = 0; id < 4000; id++) {
        const s = globalThis.causalis.meadowSpot(id);
        if (!s || tried.includes(id)) continue;
        if (s.x < 24 || s.x > innerWidth - 24 || s.y < 120 || s.y > innerHeight - 24) continue;
        const e = document.elementFromPoint(s.x, s.y);
        const feed = globalThis.causalis.meadowBeast(id)?.feed,
          hunts = feed === "hunt" || feed === "small" || feed === "scavenge" ? 1 : 0;
        if (e && e.tagName === "CANVAS")
          out.push({ id, x: s.x, y: s.y, hunts, d: Math.hypot(s.x - innerWidth / 2, s.y - innerHeight / 3) });
      }
      out.sort((a, b) => a.hunts - b.hunts || a.d - b.d || a.id - b.id);
      return out;
    })()`);
  // One walked in, as a viewer walks in one they see: a touch to follow it, then the act — and
  // where it cannot eat where it stands (a hunter with no kill near, a grazer off the grass), let go
  // and the next walked in, up to six.
  const EATS = /^(Eat|Graze|Browse|Peck|Feed)$/,
    tried: number[] = [],
    passed: string[] = [];
  let w: Walked | null = null;
  for (let i = 0; i < 6; i++) {
    const spot = (await spots(tried))[0];
    check(!!spot || i > 0, n("no beast on the screen clear of the beginning's panel"));
    if (!spot) break;
    tried.push(spot.id);
    // (Touched, it is followed; then Walk in one walks in the one followed — or, the touch having
    // missed it, waits for the next touch, given on it where it stands now.)
    await hands.tap(spot.x, spot.y);
    await page.waitForTimeout(slow(300));
    await walk.scrollIntoViewIfNeeded().catch(() => undefined);
    if (!(await tapOn('.genesis-acts button:has-text("Walk in one")'))) await walk.click();
    await comes(async () => !!(await walked()), slow(1500));
    if (!(await walked())) {
      const at = await k<{ x: number; y: number } | null>(
        `globalThis.causalis.meadowSpot(${spot.id})`,
      );
      if (at) await hands.tap(at.x, at.y);
      await comes(async () => !!(await walked()), slow(10_000));
    }
    w = await walked();
    if (!w) continue;
    if (w.id !== spot.id) tried.push(w.id);
    // (The last tried kept, whether it can eat or not.)
    if (w.offers.some((o) => EATS.test(o.label) && o.can) || i === 5) break;
    passed.push(
      `a ${w.kind} (${w.offers.find((o) => EATS.test(o.label))?.words ?? "no way to eat"})`,
    );
    await hands.letGo();
    await comes(async () => !(await walked()), slow(10_000));
    await page.waitForTimeout(slow(600));
  }
  if (passed.length)
    say(n(`walked in and let go, none to eat where they stood: ${passed.join("; ")}`));
  check(!!w, n(`no beast walked in: “${await toldNow()}”`));
  if (!w) return;
  const hud = await k<{ acts: number; shown: boolean }>(
    `({ acts: document.querySelectorAll("${HUD} .possess-act").length, shown: !!document.querySelector("${HUD}") })`,
  );
  say(
    n(
      `walked in a ${w.kind} of age ${m.age + 1}: ${w.offers.map((o) => `${o.label}${o.can ? "" : " (not now)"}`).join(", ")}; ${Math.round(w.energy * 100)}% fed (${took()})`,
    ),
  );
  check(
    hud.shown && hud.acts === 4,
    n(`the controls not shown with four acts (${JSON.stringify(hud)})`),
  );
  // (Two frames drawn first: the one walked in is drawn from behind it from the next frame on.)
  await k(`new Promise((done) => requestAnimationFrame(() => requestAnimationFrame(done)))`);
  await shot(`${tag}-creature-1`);
  // It eats: grazes, browses, pecks, feeds, or eats at a kill, as its way of feeding has it.
  const e0 = w.energy,
    ate0 = w.ate,
    eat = w.offers.findIndex((o) => EATS.test(o.label) && o.can);
  check(eat >= 0, n(`none walked in could eat where it stood: ${passed.join("; ")}`));
  await hands.act(Math.max(0, eat));
  await page.waitForTimeout(slow(2500));
  w = await walked();
  say(
    n(
      `${w?.offers[Math.max(0, eat)]?.label ?? "its act"}: “${w?.told ?? ""}”, ${Math.round((w?.energy ?? 0) * 100)}% fed (was ${Math.round(e0 * 100)}%)`,
    ),
  );
  check(!!w?.told, n("nothing told of its eating"));
  check(
    !!w && (w.ate > ate0 || w.energy > e0),
    n(`it did not eat (${w?.ate ?? 0} eaten, was ${ate0}; ${w?.energy ?? 0} fed, was ${e0})`),
  );
  // Steered off the way the eye looks.
  const at0 = w ? { x: w.x, z: w.z } : null;
  if (w) await hands.steer(w.yaw, w.yaw, false);
  await page.waitForTimeout(slow(2000));
  await hands.steer(null, 0, false);
  w = await walked();
  const went = w && at0 ? Math.hypot(w.x - at0.x, w.z - at0.z) : 0;
  say(n(`steered ${went.toFixed(1)} m; ${w?.cleared ?? 0} between the eye and it not drawn`));
  check(went > 1, n(`not steered by the stick (${went.toFixed(1)} m)`));
  await shot(`${tag}-creature-2`);
  await hands.letGo();
  await comes(async () => !(await walked()), slow(10_000));
  const told = await toldNow();
  say(n(`let go: “${told.split(" | ").at(-1)}”`));
  check(!(await walked()), n("the beast not let go"));
  check(/You let go of the /.test(told), n(`the letting go not told: “${told}”`));
}

// 2–3. At a desk.
if (!kit) {
  const opened = await open();
  const f = await soldier(desk, "desk", opened.turn);
  if (!f) await fail();
  await foughtBack(desk, f!, "desk", opened.turn);
  await beast(desk, "desk");
  await closeField(f!);
  await creature(desk, "desk");
}

// 4. At a phone's size, by touch: the world opened again in a phone's own context.
if (!kit) {
  await page.close();
  await context.close();
  context = await contextFor(true);
  page = await pageOf(context);
  cdp = await context.newCDPSession(page);
}
{
  const opened = await open(),
    f = await soldier(phone, "phone", opened.turn, true);
  if (!f) await fail();
  await beast(phone, "phone");
  const vibrated = await k<number>(`navigator.vibrated ?? 0`);
  check(vibrated === 0, `${phone.name}: the page asked for ${vibrated} vibrations`);
}

// 6. The save: its history replayed from the seed to the same world.
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

// 4 (on). The phone floor's frames, a soldier held (not in software, nor WebKit).
if (!kit && !ci && !soft && cdp) {
  const opened = await open("low");
  // (Its first battle not one taken from: each setting goes into one of its own.)
  await budget(opened.turn);
}

// 5. An age's living world: one of its beasts walked in.
await creature(phone, "phone");

await browser.close();
await server.close();
if (errors.length) problems.push(...errors.map((e) => `page error: ${e}`));
say(`(${took()})`);
if (problems.length) {
  console.log("FAILED:");
  for (const p of problems) console.log(`  - ${p}`);
  process.exit(1);
}
console.log("the Phase 61 gate passes");
