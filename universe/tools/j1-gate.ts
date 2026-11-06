// node tools/j1-gate.ts [--ci] [--soft] [--shots dir] [--save file.save --universe earth|alien] [--water file.save] [--nogrip file.save] [--hive file.save]: gate 95, crime and justice in the town (J1), at a
// phone's size, by real touch. On far saves, else (as on CI) a young world run a few decades:
//   1. the reading, off the save: the same world, the same cases; hashes the same; no bad word on a case's page or a tab; not every town, not almost none; no one thing all of it;
//   2. a real person of a real case: their page, their home and the case say the same; drawn in their town;
//   3. the town with the most cases: Law and order pressed by touch, a case in it, its page's words off the screen; a name pressed from there;
//   4. the court in the pixels from the height a person looks, with it and without; on its day, the one brought standing at it; pressed by touch at its real place, the case opens; the ground's hand isn't cast;
//   5. the paths nobody watches: a ghost town; a sentence read in a life; a water people's and a no-grip people's law; a young world.
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
import { populationContext } from "../src/sim/index.ts";
import { casePage, casesOf, townLawTab, type Case } from "../src/host/inspect/justice.ts";

const argv = process.argv.slice(2),
  soft = argv.includes("--soft"),
  ci = argv.includes("--ci"),
  arg = (name: string) => {
    const at = argv.indexOf(name);
    return at >= 0 ? argv[at + 1] : undefined;
  },
  shots = arg("--shots"),
  saveFile = arg("--save"),
  universeArg = (arg("--universe") ?? "alien") as "earth" | "alien",
  waterFile = arg("--water"),
  nogripFile = arg("--nogrip"),
  hiveFile = arg("--hive");
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
console.log("gate 95, crime and justice in the town");

type Forged = {
  readonly bytes: Buffer;
  readonly universe: "earth" | "alien";
  readonly seed: string;
  readonly world: World;
};
const pack = (world: World, universe: "earth" | "alien"): Forged => {
  const u = universe === "earth" ? EARTH : ALIEN;
  return {
    bytes: gzipSync(
      JSON.stringify(saveWorld(world, rulesetId(world, u.version), { universe: u.name })),
    ),
    universe,
    seed: world.seed.text,
    world,
  };
};
const fromFile = (file: string, universe: "earth" | "alien"): Forged => {
  const u = universe === "earth" ? EARTH : ALIEN,
    doc = JSON.parse(gunzipSync(readFileSync(file)).toString("utf8")) as Parameters<
      typeof loadWorld
    >[0],
    probe = u.build(seedFromText(doc.seed)),
    world = loadWorld(doc, (s) => u.build(s), rulesetId(probe, u.version), {
      allowRulesetChange: true,
    }).world;
  return pack(world, universe);
};
const youngWorld = (): Forged => {
  const world = EARTH.build(seedFromText("first light"));
  world.runTo(40 * YEAR);
  return pack(world, "earth");
};

const BAD =
  /undefined|NaN|\[object|\bnull\b|\b(ev|pol|town|stone|song|war|sick|cell|case|folk):\d|\bfolk:town/;
const plainLine = (l: readonly unknown[]) =>
  l.map((s) => (typeof s === "string" ? s : (s as { text: string }).text)).join("");
type Blocks = {
  blocks: readonly {
    type: string;
    lines?: unknown[];
    items?: { line: unknown }[];
    rows?: { value: unknown }[];
  }[];
};
const wordsOf = (tabs: readonly Blocks[]): string =>
  tabs
    .flatMap((x) =>
      x.blocks.flatMap((b) =>
        b.type === "text"
          ? (b.lines ?? []).map((l) => plainLine(l as readonly unknown[]))
          : b.type === "list"
            ? (b.items ?? []).map((it) => plainLine(it.line as readonly unknown[]))
            : b.type === "facts"
              ? (b.rows ?? []).map((r) =>
                  typeof r.value === "string" ? r.value : plainLine(r.value as readonly unknown[]),
                )
              : [],
      ),
    )
    .join(" ");

/** The reading: same twice, no bad word, hashes the same; the worst of a sample of a whole world read. */
function read(f: Forged, far: boolean) {
  const w = f.world,
    before = JSON.stringify(w.domainHashes()),
    year = Math.floor(w.now / YEAR),
    towns = populationContext(w)
      .settlements.all()
      .filter((s) => s.population > 0),
    step = Math.max(1, Math.floor(towns.length / (far ? 90 : 40))),
    sample = towns.filter((_, i) => i % step === 0),
    t0 = performance.now(),
    cases = sample.map((t) => [...casesOf(w, t.ref, year)]),
    ms = (performance.now() - t0) / Math.max(1, sample.length),
    flat = cases.flat(),
    offences = new Map<string, number>(),
    sentences = new Map<string, number>();
  for (const c of flat) {
    offences.set(c.offence, (offences.get(c.offence) ?? 0) + 1);
    sentences.set(c.sentence, (sentences.get(c.sentence) ?? 0) + 1);
    const p = casePage(w, c.ref),
      text = `${p.title} ${wordsOf(p.tabs as never)}`;
    check(!BAD.test(text), `${f.seed}: a bad word on ${c.ref}: ${text.slice(0, 240)}`);
    check(c.accused.age >= 1 && !!c.accused.name, `${f.seed}: ${c.ref} has no one brought`);
    check(c.why.length > 0, `${f.seed}: ${c.ref} has no why`);
  }
  // The paths nobody watches: a town with no case at all says it was quiet; one named who has since died is said to have.
  const quiet = sample.find((_, i) => !cases[i]!.length);
  if (quiet) {
    const words = wordsOf([townLawTab(w, quiet.ref) as never]);
    check(
      /quiet|No one yet/.test(words),
      `${f.seed}: a town with no case says: ${words.slice(0, 200)}`,
    );
    check(!BAD.test(words), `${f.seed}: a bad word on a quiet town's tab: ${words.slice(0, 200)}`);
  }
  let gone = 0;
  for (const t of sample)
    for (const c of casesOf(w, t.ref, year - 1)) {
      const text = wordsOf(casePage(w, c.ref).tabs as never);
      check(
        !BAD.test(text),
        `${f.seed}: a bad word on last year's ${c.ref}: ${text.slice(0, 200)}`,
      );
      if (/has since died|no longer among/.test(text)) gone++;
    }
  say(`${f.seed}: last year's cases whose page says someone has since gone: ${gone}`);
  const none = cases.filter((l) => !l.length).length,
    topO = [...offences].sort((a, b) => b[1] - a[1])[0],
    topS = [...sentences].sort((a, b) => b[1] - a[1])[0];
  say(
    `${f.seed} year ${year}: ${flat.length} cases in ${sample.length} of ${towns.length} towns (${ms.toFixed(1)} ms a town), none ${none}; commonest ${topO?.[0]} ${topO?.[1]}, ${topS?.[0]} ${topS?.[1]}`,
  );
  if (far) {
    check(
      flat.length > sample.length / 2,
      `${f.seed}: only ${flat.length} cases in ${sample.length} towns`,
    );
    check(none / sample.length < 0.6, `${f.seed}: ${none} of ${sample.length} towns have no case`);
    if (topO)
      check(topO[1] / flat.length < 0.6, `${f.seed}: ${topO[0]} is ${topO[1]} of ${flat.length}`);
    if (topS)
      check(topS[1] / flat.length < 0.75, `${f.seed}: ${topS[0]} is ${topS[1]} of ${flat.length}`);
  }
  // The same world, the same cases: read afresh from the save.
  const most = cases.reduce((a, b, i) => (b.length > cases[a]!.length ? i : a), 0),
    mostTown = sample[most]?.ref ?? null,
    first = mostTown ? JSON.stringify(casesOf(w, mostTown, year)) : "";
  if (mostTown) {
    const doc = JSON.parse(gunzipSync(f.bytes).toString("utf8")) as Parameters<typeof loadWorld>[0],
      u = f.universe === "earth" ? EARTH : ALIEN,
      w2 = loadWorld(
        doc,
        (s) => u.build(s),
        rulesetId(u.build(seedFromText(doc.seed)), u.version),
        {
          allowRulesetChange: true,
        },
      ).world;
    check(
      JSON.stringify(casesOf(w2, mostTown, year)) === first,
      `${f.seed}: the same world tells other cases`,
    );
    const tab = townLawTab(w, mostTown);
    check(
      !!tab && !BAD.test(wordsOf([tab as never])),
      `${f.seed}: a bad word on a Law tab: ${wordsOf(tab ? [tab as never] : []).slice(0, 200)}`,
    );
  }
  check(JSON.stringify(w.domainHashes()) === before, `${f.seed}: reading moved the hashes`);
  return {
    town: mostTown,
    year,
    list: mostTown ? casesOf(w, mostTown, year) : ([] as readonly Case[]),
  };
}

const root = fileURLToPath(new URL("..", import.meta.url)),
  server = await preview({ root, logLevel: "silent", preview: { port: 4295, strictPort: false } }),
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
const until = async (what: string, ok: () => Promise<boolean>, ms = slow(25000)) => {
  const end = Date.now() + ms;
  while (Date.now() < end) {
    if (await ok().catch(() => false)) return true;
    await page.waitForTimeout(80);
  }
  problems.push(`${what} did not come`);
  return false;
};
const ask = <T>(type: string, args: unknown = {}) =>
  k<T>(
    `globalThis.causalis.client.query({ type: ${JSON.stringify(type)}, args: ${JSON.stringify(args)} })`,
  );
const shot = async (name: string) => {
  const b = await page.screenshot(shots ? { path: join(shots, `${name}.png`) } : {});
  return b.toString("base64");
};
async function loadSave(f: Forged) {
  const name = `${f.universe}:gate95`,
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
    [f.bytes.toString("base64"), name],
  );
  await page.goto(`${base}?${q}&load=${encodeURIComponent(name)}&hold=1`);
  await page.waitForFunction(
    () => ((globalThis as { causalis?: { drawn?: () => number } }).causalis?.drawn?.() ?? 0) > 0,
    undefined,
    { timeout: slow(180000) },
  );
  await page.waitForTimeout(slow(600));
}
async function press(selector: string): Promise<boolean> {
  const where = () =>
    k<{ x: number; y: number; w: number; h: number } | null>(`(() => {
    for (const e of document.querySelectorAll(${JSON.stringify(selector)})) {
      e.scrollIntoView({ block: "center" });
      const r = e.getBoundingClientRect();
      if (r.width > 0 && r.height > 0) return { x: r.x + r.width / 2, y: r.y + r.height / 2, w: r.width, h: r.height };
    }
    return null;
  })()`);
  let at = await where();
  if (!at) {
    problems.push(`nothing to press at ${selector}`);
    return false;
  }
  for (let i = 0; i < 40; i++) {
    await page.waitForTimeout(slow(120));
    const now = await where();
    if (!now) break;
    if (now.x === at.x && now.y === at.y) break;
    at = now;
  }
  await page.touchscreen.tap(at.x, at.y);
  await page.waitForTimeout(slow(300));
  return true;
}
const pageText = () =>
  k<string>(
    `(() => { const e = document.querySelector(".page-window"); return e && e.getBoundingClientRect().height > 0 ? e.innerText : ""; })()`,
  );
const pageNow = () => k<string | null>("globalThis.causalis.pageOpen()");
const closePage = async () => {
  await k(`globalThis.causalis.closePage?.()`);
  await page.waitForTimeout(slow(200));
};
async function goDown(ref: string): Promise<void> {
  await k(`globalThis.causalis.goTo(${JSON.stringify(ref)})`);
  await until(
    "the town",
    () =>
      k<boolean>(
        `globalThis.causalis.scale() === "village" && globalThis.causalis.planNow()?.ref === ${JSON.stringify(ref)}`,
      ),
    slow(60000),
  );
  await page.waitForTimeout(slow(1000));
}
const unlike = (a: string, b: string): Promise<number> =>
  page.evaluate(
    async ([p, q]) => {
      const read = async (d: string) => {
        const bm = await createImageBitmap(
            await (await fetch(`data:image/png;base64,${d}`)).blob(),
          ),
          c = new OffscreenCanvas(bm.width, bm.height),
          x = c.getContext("2d")!;
        x.drawImage(bm, 0, 0);
        return x.getImageData(
          0,
          Math.round(bm.height * 0.1),
          bm.width,
          Math.round(bm.height * 0.75),
        ).data;
      };
      const A = await read(p as string),
        B = await read(q as string);
      let n = 0;
      for (let i = 0; i < A.length; i += 16)
        if (
          Math.abs(A[i]! - B[i]!) +
            Math.abs(A[i + 1]! - B[i + 1]!) +
            Math.abs(A[i + 2]! - B[i + 2]!) >
          60
        )
          n++;
      return n / (A.length / 16);
    },
    [a, b] as const,
  );
type CourtShown = {
  form: string;
  law: string;
  sittings: number;
  sitting: {
    ref: string;
    day: number;
    accused: string;
    who: string;
    sentence: string;
    days: number;
  } | null;
  stands: { x: number; z: number; activity: number; hidden: boolean } | null;
  held: { who: string; sentence: string; x: number | null; z: number | null }[];
  parts: number;
  batches: number;
  place: {
    footX: number;
    footY: number;
    headY: number;
    worldX: number;
    worldZ: number;
    yaw: number;
    front: boolean;
  } | null;
};
const court = () => k<CourtShown | null>("globalThis.causalis.court?.() ?? null");
/** The eye brought to look at the court, across the square, at the height a person looks. */
const lookAtCourt = (c: NonNullable<CourtShown["place"]>, distance = 4.2, pitch = -20) =>
  k(
    `globalThis.causalis.rig.flyTo({ target: { x: ${c.worldX * 0.1}, y: 0.4, z: ${c.worldZ * 0.1} }, yaw: ${(c.yaw * 180) / Math.PI}, distance: ${distance}, pitch: ${pitch} }, 0.3)`,
  );
/** A point of the court a finger can press: on the screen, on the canvas itself. */
const reachable = () =>
  k<{ x: number; y: number } | null>(`(() => {
    const c = globalThis.causalis.court?.()?.place;
    if (!c || !c.front) return null;
    for (const u of [0.5, 0.3, 0.7, 0.15]) {
      const x = c.footX, y = c.footY + (c.headY - c.footY) * u;
      if (x < 12 || x > innerWidth - 12 || y < 12 || y > innerHeight - 12) continue;
      const e = document.elementFromPoint(x, y);
      if (e && e.tagName === "CANVAS") return { x, y };
    }
    return null;
  })()`);

/** A real person of a real case: their page, their home and the case agree. */
async function samePerson(f: Forged, c: Case) {
  await k(`globalThis.causalis.open(${JSON.stringify(c.ref)})`);
  await until("the case's page", async () => (await pageNow()) === c.ref);
  await page.waitForTimeout(slow(300));
  const text = await pageText();
  check(text.includes(c.accused.name), `a case's page doesn't name them: ${text.slice(0, 240)}`);
  check(/Why/i.test(text) && /What came of it/i.test(text), `a case's page: ${text.slice(0, 240)}`);
  check(!BAD.test(text), `a bad word on a case's page: ${text.slice(0, 300)}`);
  say(`a case: ${text.replace(/\s+/g, " ").slice(0, 400)}`);
  await shot(`2-case-${f.seed.replace(/\W+/g, "_")}`);
  // Their name pressed: their page.
  await press(`.page-window a.ref-link[href^="#${c.accused.ref.split(":")[0]}:"]`);
  await until("their page", async () => (await pageNow()) === c.accused.ref);
  await page.waitForTimeout(slow(300));
  const theirs = await pageText();
  check(theirs.includes(c.accused.name), `their page: ${theirs.slice(0, 200)}`);
  check(
    theirs.includes(String(c.accused.age)) || c.year !== Math.floor(f.world.now / YEAR),
    `their age: ${theirs.slice(0, 200)}`,
  );
  await shot(`2-person-${f.seed.replace(/\W+/g, "_")}`);
  await closePage();
  // Their home lists them.
  await k(`globalThis.causalis.open(${JSON.stringify(c.ref)})`);
  await until("the case's page again", async () => (await pageNow()) === c.ref);
  await page.waitForTimeout(slow(300));
  const home = await k<string | null>(
    `document.querySelector('.page-window a.ref-link[href^="#dwell:"]')?.getAttribute("href")?.slice(1) ?? null`,
  );
  check(!!home, "a case's page has no home for one still here");
  if (home) {
    await press(`.page-window a.ref-link[href^="#dwell:"]`);
    await until("their home", async () => (await pageNow()) === home);
    await page.waitForTimeout(slow(300));
    const lives = await pageText();
    check(
      lives.includes(c.accused.name.split(" ")[0]!),
      `their home doesn't list them: ${lives.slice(0, 300)}`,
    );
    await shot(`2-home-${f.seed.replace(/\W+/g, "_")}`);
  }
  await closePage();
}

/** A possession: the court pressed by a finger, near; far off it says to walk nearer; a page over the controls; and the body stopped by the bench. */
async function possessed(town: string) {
  type Me = { x: number; z: number; yaw: number };
  const me = () =>
    k<Me | null>(`(() => {
      const p = globalThis.causalis.possess, s = p?.state(), m = s && p.drawn(s.agent);
      return m ? { x: m.x, z: m.z, yaw: s.eye.yaw } : null;
    })()`);
  const inSight = () =>
    k<{ px: number; py: number; worldX: number; worldZ: number } | null>(`(() => {
      const c = globalThis.causalis.court?.()?.place;
      if (!c || !c.front) return null;
      for (const u of [0.5, 0.25, 0.75, 0.1]) {
        const px = c.footX, py = c.footY + (c.headY - c.footY) * u;
        if (px < 12 || px > innerWidth - 12 || py < 12 || py > innerHeight - 12) continue;
        const e = document.elementFromPoint(px, py);
        if (e && e.classList.contains("possess-hud")) return { px, py, worldX: c.worldX, worldZ: c.worldZ };
      }
      return null;
    })()`);
  const fingers = await context.newCDPSession(page);
  const turnTo = async () => {
    const at = (x: number) => [{ x, y: 470, id: 2, radiusX: 6, radiusY: 6, force: 1 }];
    for (let i = 0; i < 32; i++) {
      const can = await inSight();
      if (can) return can;
      await fingers.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: at(370) });
      for (let j = 1; j <= 5; j++)
        await fingers.send("Input.dispatchTouchEvent", {
          type: "touchMove",
          touchPoints: at(370 - j * 12),
        });
      await fingers.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
      await page.waitForTimeout(slow(200));
    }
    return null;
  };
  const walkNear = async (x: number, z: number, near: number, ms = 90000) => {
    const down = new Set<string>(),
      end = Date.now() + slow(ms);
    let best = Infinity,
      bestAt = Date.now(),
      side = 1,
      sideUntil = 0,
      there = false;
    while (Date.now() < end) {
      const m = await me();
      if (!m) break;
      const dx = x - m.x,
        dz = z - m.z,
        d = Math.hypot(dx, dz);
      if (d <= near) {
        there = true;
        break;
      }
      if (d < best - 0.5) {
        best = d;
        bestAt = Date.now();
      } else if (Date.now() - bestAt > 2500 && Date.now() > sideUntil) {
        side = -side;
        sideUntil = Date.now() + 1500;
        bestAt = Date.now();
      }
      const rel = Math.atan2(dx, dz) + (Date.now() < sideUntil ? (side * Math.PI) / 2 : 0) - m.yaw,
        ahead = Math.cos(rel),
        right = -Math.sin(rel),
        want = new Set<string>();
      if (ahead > 0.38) want.add("KeyW");
      if (ahead < -0.38) want.add("KeyS");
      if (right > 0.38) want.add("KeyD");
      if (right < -0.38) want.add("KeyA");
      if (d > 8) want.add("ShiftLeft");
      for (const key of [...down])
        if (!want.has(key)) {
          await page.keyboard.up(key);
          down.delete(key);
        }
      for (const key of want)
        if (!down.has(key)) {
          await page.keyboard.down(key);
          down.add(key);
        }
      await page.waitForTimeout(100);
    }
    for (const key of down) await page.keyboard.up(key);
    return there;
  };
  const whom = await k<number>(
    `(() => { const p = globalThis.causalis.planNow(); return p?.people?.findIndex((x) => !x.child && x.ref.startsWith("agent:")) ?? -1; })()`,
  );
  const take = () => k<string | null>(`globalThis.causalis.possess?.take?.(${whom}) ?? null`);
  let why = await take();
  if (why) {
    await k(`globalThis.causalis.client.command("hand.lay", { village: ${JSON.stringify(town)} })`);
    const t = await k<number>("globalThis.causalis.client.status?.t ?? 0");
    await k(`globalThis.causalis.client.advance(${t + 3600})`);
    await until(
      "the hand laid",
      async () => !!(await k<unknown>(`globalThis.causalis.client.query({ type: "hand" })`)),
      slow(30000),
    );
    why = await take();
  }
  check(!why, `no possession: ${why}`);
  const took =
    !why &&
    (await until(
      "a possession",
      () => k<boolean>(`document.body.classList.contains("possessing")`),
      slow(60000),
    ));
  if (!took) return;
  await page.waitForTimeout(slow(900));
  const seen = await turnTo();
  check(!!seen, "possessed: the court doesn't come in sight, turning all the way round");
  await shot("5-possessed");
  if (seen) {
    const m = await me(),
      off = m ? Math.hypot(seen.worldX - m.x, seen.worldZ - m.z) : 0;
    say(`possessed; the court ${off.toFixed(0)} m off`);
    if (off > 45) {
      await page.touchscreen.tap(seen.px, seen.py);
      await page.waitForTimeout(slow(350));
      check((await pageNow()) === null, "possessed: a court far off opened without walking to it");
      const told = await k<string>(`document.querySelector(".possess-told")?.textContent ?? ""`);
      check(/walk nearer/.test(told), `possessed: a court far off, told "${told}"`);
    }
    const there = await walkNear(seen.worldX, seen.worldZ, 16);
    check(there, "possessed: could not walk to the court");
    await page.waitForTimeout(slow(600));
    const close = await turnTo();
    check(!!close, "possessed: the court is not in sight from beside it");
    if (close) {
      await page.touchscreen.tap(close.px, close.py);
      await until("a page from the court, possessed", async () => {
        const o = String((await pageNow()) ?? "");
        return o.startsWith("case:") || o === town;
      });
      await page.waitForTimeout(slow(350));
      const t = await pageText();
      say(`possessed, pressed: ${t.replace(/\s+/g, " ").slice(0, 160)}`);
      check(!BAD.test(t), `possessed: a bad word: ${t.slice(0, 200)}`);
      await shot("5-possessed-page");
      await press(".page-window h2 .close");
      check((await pageNow()) === null, "possessed: the page's close did not close it");
      check(!!(await me()), "reading a case ended the possession");
      // (The bench stands in the way of a body walked straight at it.)
      const bench = await k<{ x: number; z: number } | null>(
        `(() => { const c = globalThis.causalis.court?.()?.place; if (!c) return null; const s = globalThis.causalis.court?.()?.form; return s === "elders" || s === "reef" ? null : { x: c.worldX - Math.sin(c.yaw) * 6, z: c.worldZ - Math.cos(c.yaw) * 6 }; })()`,
      );
      if (bench) {
        const into = await walkNear(bench.x, bench.z, 0.6, 7000);
        check(!into, "possessed: walked through the bench");
      }
    }
  }
  await k(`globalThis.causalis.possess?.letGo?.()`);
  await until(
    "let go",
    () => k<boolean>(`!document.body.classList.contains("possessing")`),
    slow(30000),
  );
}

// The worlds.
const far = !!saveFile;
const made = saveFile ? fromFile(saveFile, universeArg) : youngWorld();
const r = read(made, far);
await loadSave(made);
const hashesBefore = await ask<unknown>("hashes");

if (r.town) {
  await goDown(r.town);
  const got = await court();
  check(!!got, "no court in a town with cases");
  check((got?.parts ?? 99) <= 26, `${got?.parts} parts in a court`);
  say(
    `${r.town}: ${got?.law}, ${got?.form}, ${got?.sittings} sittings, ${got?.parts} parts in ${got?.batches} batches`,
  );
  await k(`document.body.classList.add("gate-probe")`);
  const planned = await k<
    {
      ref: string;
      day: number;
      accused: string;
      who: string;
      sentence: string;
      days: number;
      line: string;
    }[]
  >("globalThis.causalis.planNow()?.court?.sittings ?? []");
  const listed = r.list.filter((c) => c.year === r.year);
  // A person of the case is drawn in the town.
  const drawn = await k<string[]>("globalThis.causalis.planNow()?.people?.map((p) => p.ref) ?? []");
  for (const c of listed) {
    check(
      drawn.includes(c.accused.ref) || c.accused.ref.startsWith("prsn:"),
      `${c.accused.name} is not drawn in their town`,
    );
  }
  // 3. The town's page: Law and order pressed by touch.
  await k(`globalThis.causalis.open(${JSON.stringify(r.town)})`);
  await until("the town's page", async () => (await pageNow()) === r.town);
  const tabAt = await k<number>(
    `[...document.querySelectorAll(".page-window .tabs .tab")].findIndex((b) => /Law and order/.test(b.textContent))`,
  );
  check(tabAt >= 0, "no Law and order tab on a town's page");
  await press(`.page-window .tabs .tab:nth-child(${tabAt + 1})`);
  await page.waitForTimeout(slow(300));
  const tab = await pageText();
  check(/who judges/i.test(tab), `the Law and order tab: ${tab.slice(0, 240)}`);
  check(!BAD.test(tab), `a bad word on the Law and order tab: ${tab.slice(0, 300)}`);
  say(`the tab: ${tab.replace(/\s+/g, " ").slice(0, 300)}`);
  // (Its row in sight and what it opened under it, on the phone: not the page's top, a screen away from it.)
  const tabAtNow = await k<{ top: number; below: number } | null>(`(() => {
    const w = document.querySelector(".page-window"), t = w?.querySelector(".tabs");
    if (!w || !t) return null;
    const a = w.getBoundingClientRect(), b = t.getBoundingClientRect();
    return { top: b.top - a.top, below: a.bottom - b.bottom };
  })()`);
  check(
    !!tabAtNow && tabAtNow.top >= -2 && tabAtNow.below > 150,
    `a tab pressed lies off the page: ${JSON.stringify(tabAtNow)}`,
  );
  await shot("3-law-tab");
  await press(`.page-window a.ref-link[href^="#case:"]`);
  await until("a case's page from the tab", async () =>
    String((await pageNow()) ?? "").startsWith("case:"),
  );
  await closePage();
  // 2. One real person.
  const one = listed[0];
  if (one) await samePerson(made, one);
  check(
    JSON.stringify(await ask<unknown>("hashes")) === JSON.stringify(hashesBefore),
    "looking moved the hashes",
  );
  // 4. By day (a far world's first view is its midnight), the court with it and without.
  const firstDay = planned[0]?.day;
  check(firstDay !== undefined, "a town with cases has no sitting");
  if (firstDay !== undefined) {
    const nowT = await k<number>("globalThis.causalis.client.status?.t ?? 0");
    const toHour = async (d: number, h: number) => {
      await k(`globalThis.causalis.client.advance(${d * 86400 + h * 3600})`);
      await page.waitForTimeout(slow(1200));
    };
    // Its next sitting not yet past: the first of those to come, else the clock goes where it can.
    const nowDay = Math.floor(nowT / 86400),
      next = planned.find((s) => s.day > nowDay + 1) ?? planned.at(-1)!;
    say(`now day ${nowDay}; sitting on ${next.day}: ${next.line} (${next.sentence})`);
    await toHour(next.day, 11);
    const c = await court();
    check(!!c?.sitting, `the court doesn't sit on its day: ${JSON.stringify(c?.sitting)}`);
    if (c?.place) {
      await lookAtCourt(c.place);
      await page.waitForTimeout(slow(1500));
      const withIt = await shot("4-court-sitting");
      await k("globalThis.causalis.courtShown(false)");
      await page.waitForTimeout(slow(300));
      const without = await shot("4-court-without");
      await k("globalThis.causalis.courtShown(true)");
      const seen = await unlike(withIt, without);
      say(`with and without: ${(seen * 100).toFixed(1)}% of the picture differs`);
      check(seen > 0.01, `the court hardly shows: ${(seen * 100).toFixed(2)}%`);
      // The one brought stands at it.
      const stood = (await court())?.stands,
        off = stood ? Math.hypot(stood.x - c.place.worldX, stood.z - c.place.worldZ) : Infinity;
      say(`the one brought stands ${off.toFixed(1)} m from the court, hidden: ${stood?.hidden}`);
      check(
        off < 30 && !stood?.hidden,
        `the one brought stands ${off.toFixed(0)} m from their court`,
      );
      const note = await k<{ h: number; x: number; y: number; text: string } | null>(`(() => {
        const e = globalThis.causalis.courtNote?.();
        if (!e) return null;
        const r = e.getBoundingClientRect();
        return { h: r.height, x: r.x + r.width / 2, y: r.y + r.height / 2, text: e.innerText };
      })()`);
      say(`the note: ${note?.text?.replace(/\s+/g, " ")}`);
      check((note?.h ?? 0) >= 40, `the court's note is ${note?.h ?? 0} px tall`);
      // Pressed by touch at its real place; not the ground beneath it.
      const at = await reachable();
      check(!!at, "no point of the court a finger can reach");
      if (at) {
        await page.touchscreen.tap(at.x, at.y);
        await until("a case's page, pressed on the court", async () =>
          String((await pageNow()) ?? "").startsWith("case:"),
        );
        await page.waitForTimeout(slow(350));
        const text = await pageText();
        check(/what came of it/i.test(text), `pressed: ${text.slice(0, 200)}`);
        await shot("4-court-pressed");
        await closePage();
      }
    }
    // After: what came of it, where it's seen.
    await toHour(next.day, 16);
    await shot("4-court-after");
    const n = await k<{ ref: string; sentence: string } | null>(`(() => {
      const p = globalThis.causalis.planNow()?.court?.sittings ?? [];
      return p[0] ? { ref: p[0].ref, sentence: p[0].sentence } : null;
    })()`);
    say(`after: ${n?.sentence}`);
    // A sentence seen: one in the stocks or a cell, the day after they were heard, standing where they are held.
    const heldCase = planned.find(
      (s) => s.day > next.day && (s.sentence === "stocks" || s.sentence === "cell"),
    );
    if (heldCase) {
      await toHour(heldCase.day + 1, 11);
      const h = (await court())?.held.find((x) => x.who === heldCase.who),
        at = (await court())?.place;
      say(`held: ${heldCase.who}, ${heldCase.sentence}, at ${h?.x?.toFixed(1)}, ${h?.z?.toFixed(1)}`);
      check(!!h && h.x !== null, `${heldCase.who} is not held in the town the day after`);
      if (h && h.x !== null && h.z !== null && at) {
        const off = Math.hypot(h.x - at.worldX, h.z - at.worldZ);
        check(off < 40, `${heldCase.who} is held ${off.toFixed(0)} m from the court`);
        await lookAtCourt(at);
        await page.waitForTimeout(slow(1400));
        await shot("4-court-held");
      }
    } else say("no one sentenced to the stocks or a cell later this year");
    // ⌖ Go to from its page: the eye at the court.
    await k(`globalThis.causalis.open(${JSON.stringify(next.ref)})`);
    await until("its page", async () => (await pageNow()) === next.ref);
    await page.waitForTimeout(slow(300));
    await press(".page-window .go-to");
    await until("its page gone", async () => (await pageNow()) === null, slow(60000));
    await page.waitForTimeout(slow(1400));
    await shot("4-go-to");
  }
  // A town with cases, in a life: a case pressed from the court while living someone.
  if (far) {
    const shownAt = (sel: string) =>
      k<boolean>(
        `(() => { const e = document.querySelector(${JSON.stringify(sel)}); return !!e && e.getBoundingClientRect().height > 0; })()`,
      );
    await press(".town-live");
    await until("the sheet of lives", () => shownAt(".life-picker .life-card"), slow(60000));
    await press(".life-picker .life-live");
    const lived = await until("the strip of a life", () => shownAt(".life-strip"), slow(120000));
    if (lived) {
      await page.waitForTimeout(slow(1400));
      let can = await reachable();
      for (const distance of [24, 48, 90, 160, 280]) {
        if (can) break;
        await k(`globalThis.causalis.rig.flyTo({ distance: ${distance}, pitch: -40 }, 0.2)`);
        await page.waitForTimeout(slow(700));
        can = await reachable();
      }
      await shot("5-living");
      check(!!can, "in a life: no point of the court a finger can reach");
      if (can) {
        let opened = "";
        for (let tries = 0; tries < 10 && !opened.startsWith("case:"); tries++) {
          const at = (await reachable()) ?? can;
          await page.touchscreen.tap(at.x, at.y);
          await page.waitForTimeout(slow(900));
          opened = String((await pageNow()) ?? "");
          if (!opened.startsWith("case:")) {
            if (opened) await closePage();
            await page.waitForTimeout(slow(1200));
          }
        }
        say(`in a life, pressed: ${opened}`);
        check(opened.startsWith("case:"), `in a life: the court opens "${opened}"`);
        await shot("5-living-page");
        await closePage();
        check(await shownAt(".life-strip"), "reading a case ended the life");
      }
      await press(".life-letgo");
      await until("the life let go", async () => !(await shownAt(".life-strip")), slow(60000));
    }
    await possessed(r.town);
  }
} else if (far) problems.push("a far world with no town with a case");

// Other peoples' worlds.
for (const [file, label, want] of [
  [waterFile, "water", /reef|current/i],
  [nogripFile, "nogrip", /old ones|pit|penned|ring/i],
  [hiveFile, "hive", /hive tries no one/i],
] as const) {
  if (!file) continue;
  const f = fromFile(file, "alien"),
    o = read(f, true);
  if (!o.town) {
    problems.push(`${label}: no town with a case`);
    continue;
  }
  await loadSave(f);
  await goDown(o.town);
  await page.waitForTimeout(slow(600));
  // (By day, on its next sitting: each of these has only been seen at midnight.)
  {
    const sits = await k<{ day: number; line: string; sentence: string }[]>(
        "globalThis.causalis.planNow()?.court?.sittings ?? []",
      ),
      nowT = await k<number>("globalThis.causalis.client.status?.t ?? 0"),
      coming = sits.find((s) => s.day > Math.floor(nowT / 86400) + 1);
    if (coming) {
      await k(`globalThis.causalis.client.advance(${coming.day * 86400 + 11 * 3600})`);
      await page.waitForTimeout(slow(1400));
      say(`${label}: sitting on ${coming.day}: ${coming.line} (${coming.sentence})`);
      check(!BAD.test(coming.line), `${label}: a bad word in a sitting: ${coming.line}`);
      if (label === "hive")
        check(
          !/rent|stall|market|square/i.test(coming.line),
          `a hive's offence is the common table's: ${coming.line}`,
        );
    }
  }
  const got = await court();
  say(`${label}: ${o.town}: ${got?.law}, ${got?.form}, ${got?.parts} parts`);
  if (got?.place) {
    await lookAtCourt(got.place);
    await page.waitForTimeout(slow(1000));
    await shot(`6-${label}-court`);
    const at = await reachable();
    check(!!at, `${label}: no point of the court a finger can reach`);
    if (at) {
      await page.touchscreen.tap(at.x, at.y);
      await page.waitForTimeout(slow(900));
      const text = await pageText();
      say(`${label}: ${text.replace(/\s+/g, " ").slice(0, 280)}`);
      await shot(`6-${label}-page`);
      await closePage();
    }
  }
  const tab = townLawTab(f.world, o.town),
    words = tab ? wordsOf([tab as never]) : "";
  check(want.test(words), `${label}: its law says: ${words.slice(0, 240)}`);
}

const real = errors.filter(
  (e) => !/ResizeObserver|Failed to load resource|favicon|WebGL|GL Driver|GPU stall/.test(e),
);
for (const e of real.slice(0, 5)) problems.push(`page error: ${e.slice(0, 400)}`);
await browser.close();
await server.close();
if (problems.length) {
  console.log("FAILED");
  for (const p of problems) console.log(`  - ${p}`);
  process.exit(soft ? 0 : 1);
}
console.log("passed");
process.exit(0);
