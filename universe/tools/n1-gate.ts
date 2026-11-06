// node tools/n1-gate.ts [--ci] [--soft] [--shots dir] [--save file.save --universe earth|alien] [--seed text --universe earth|alien] [--nofire file.save]: gate 97, the world acting on its own (N1), at a phone's size.
// On a far save, else (as on CI) a young world run on:
//   1. off the world: a run forward brings shocks and fires by themselves, none by any hand; every one's words and page read aloud clean; a shock's page opens its land and its plates; an old save ran on; no fire on a world with nothing to burn;
//   2. a fire watched: the same world again to the day before it lights, on the land it crosses, the clock let run at a land's own first speed as anyone's does. Nothing burns; it comes: flames off the real layer and in the pixels; the front moves on; it burns out: no flames, its scar in the ground's colours, its woods gone;
//   3. its page: its words off the screen, a link pressed by touch;
//   4. a shock watched: the same world again to the day before one that brought homes down, in that town: the ground shakes, homes in dust, and its words say no hand did it;
//   5. the same shock with someone walked in that town, and with someone's life lived there: neither is lost to it.
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { gunzipSync, gzipSync, inflateSync } from "node:zlib";
import { preview } from "vite";
import { chromium, type Page } from "playwright";
import {
  DAY,
  YEAR,
  loadWorld,
  rulesetId,
  saveWorld,
  seedFromText,
  type World,
} from "../src/kernel/index.ts";
import { ALIEN, EARTH, region } from "../src/host/planet.ts";
import { landPlan } from "../src/host/land.ts";
import { populationContext, wildOf } from "../src/sim/index.ts";
import { eventPage } from "../src/host/inspect/history.ts";
import { why } from "../src/causal/index.ts";
import { burnTiles, type LandGround } from "../src/view/index.ts";

const argv = process.argv.slice(2),
  soft = argv.includes("--soft"),
  ci = argv.includes("--ci"),
  arg = (name: string) => {
    const at = argv.indexOf(name);
    return at >= 0 ? argv[at + 1] : undefined;
  },
  shots = arg("--shots"),
  saveFile = arg("--save"),
  seedText = arg("--seed"),
  universe = (arg("--universe") ?? "alien") as "earth" | "alien",
  noFire = arg("--nofire");
if (shots) mkdirSync(shots, { recursive: true });
const slow = (ms: number) => (ci || soft ? ms * 4 : ms),
  problems: string[] = [],
  check = (ok: boolean, what: string) => {
    if (!ok) problems.push(what);
  },
  say = (s: string) => console.log(`  ${s}`);
console.log("gate 97, the world acting on its own");

const BAD = /undefined|NaN|\[object|\bnull\b|\b(ev|pol|town|war|cell):\d/;
const open = (file: string, u: "earth" | "alien"): World => {
  const U = u === "earth" ? EARTH : ALIEN,
    doc = JSON.parse(gunzipSync(readFileSync(file)).toString("utf8"));
  return loadWorld(doc, (s) => U.build(s), rulesetId(U.build(seedFromText(doc.seed)), U.version), {
    allowRulesetChange: true,
  }).world;
};
const u = saveFile || seedText ? universe : "earth",
  fresh = () =>
    saveFile
      ? open(saveFile, universe)
      : (u === "earth" ? EARTH : ALIEN).build(seedFromText(seedText ?? "first light"));
const world = fresh(),
  U = u === "earth" ? EARTH : ALIEN,
  from = Math.floor(world.now / YEAR);
// An old save has none of this: it loads empty, and goes on.
check(saveFile ? wildOf(world)!.scars.length === 0 : true, "an old save came with scars");

/** The pixels of a shot that pass a test (8-bit, whole RGB or RGBA, not interlaced). */
function pixels(png: Buffer, test: (r: number, g: number, b: number) => boolean): number {
  let at = 8,
    width = 0,
    height = 0,
    channels = 0;
  const idat: Buffer[] = [];
  while (at + 12 <= png.length) {
    const size = png.readUInt32BE(at),
      type = png.toString("latin1", at + 4, at + 8),
      body = png.subarray(at + 8, at + 8 + size);
    if (type === "IHDR") {
      width = body.readUInt32BE(0);
      height = body.readUInt32BE(4);
      channels = body[9] === 6 ? 4 : 3;
    } else if (type === "IDAT") idat.push(body);
    else if (type === "IEND") break;
    at += size + 12;
  }
  const raw = inflateSync(Buffer.concat(idat)),
    stride = width * channels,
    rows = Buffer.alloc(stride * height),
    paeth = (a: number, b: number, c: number) => {
      const p = a + b - c,
        pa = Math.abs(p - a),
        pb = Math.abs(p - b),
        pc = Math.abs(p - c);
      return pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
    };
  let count = 0;
  for (let y = 0; y < height; y++) {
    const filter = raw[y * (stride + 1)]!,
      src = y * (stride + 1) + 1,
      dst = y * stride;
    for (let x = 0; x < stride; x++) {
      const a = x >= channels ? rows[dst + x - channels]! : 0,
        b = y > 0 ? rows[dst - stride + x]! : 0,
        c = x >= channels && y > 0 ? rows[dst - stride + x - channels]! : 0,
        predicted =
          filter === 0
            ? 0
            : filter === 1
              ? a
              : filter === 2
                ? b
                : filter === 3
                  ? (a + b) >> 1
                  : paeth(a, b, c);
      rows[dst + x] = (raw[src + x]! + predicted) & 255;
    }
    for (let x = 0; x < stride; x += channels)
      if (test(rows[dst + x]!, rows[dst + x + 1]!, rows[dst + x + 2]!)) count++;
  }
  return count;
}
/** A flame's own colour, far from any ground's: hot and little blue in it; on a world of sulfur, a saturated blue, though the sky is near it. */
let blueFire = false;
const flamePixel = (r: number, g: number, b: number) =>
  blueFire ? b > 200 && b - g > 70 && g - r > 20 : r > 190 && r - g > 70 && g - b > 30;
/** Char, going to dry brown. */
const scarPixel = (r: number, g: number, b: number) =>
  r < 118 && g < 96 && b < 72 && r >= b && r - b < 56;

// Run on till shocks and fires have come by themselves.
const plain = (b: { text?: string; lines?: readonly (readonly unknown[])[] }) =>
  (b.lines ?? [])
    .map((l) => l.map((s) => (typeof s === "string" ? s : (s as { text: string }).text)).join(""))
    .join(" ");
let y = from,
  fires = 0,
  fireId: string | null = null,
  quake: string | null = null,
  felled: { id: string; t: number; homes: number; town: string } | null = null;
// (A people of the water has no woods to watch burn: what comes to its towns is the shock.)
const shockOnly = process.argv.includes("--shock-only"),
  most = saveFile ? from + (shockOnly ? 300 : 40) : 60,
  /** Enough fires that one crossing a peopled land well is among them, and a shock that brought homes down. */
  enough = () => (shockOnly || fires >= 24) && !!quake && (felled?.homes ?? 0) >= 3;
while (y < most && !enough()) {
  y++;
  const was = world.events.count;
  world.runTo(y * YEAR);
  for (let i = was; i < world.events.count; i++) {
    const e = world.events.at(i),
      d = (e.data ?? {}) as { natural?: boolean; homes?: Record<string, number> };
    if (!d.natural && e.type !== "wild.answer") continue;
    check(!e.causes.some((c) => c.ref.startsWith("cmd:")), `${e.id} has a hand among its causes`);
    const claim = why(world, e.id).claim;
    check(!BAD.test(claim), `bad words: ${claim}`);
    if (e.type === "wild.fire") {
      fires++;
      fireId = e.id;
    }
    if (e.type === "act.quake") {
      // (The last to come: a small one's page is not kept for ever.)
      quake = e.id;
      for (const [town, homes] of Object.entries(d.homes ?? {}))
        if (homes > (felled?.homes ?? 0)) felled = { id: e.id, t: e.t, homes, town };
    }
  }
}
const store = wildOf(world)!;
say(
  `year ${y}: ${store.tally.quakes} shocks, ${store.tally.fires} fires, ${store.scars.length} scars`,
);
check(!!quake, "no shock came by itself");
check(shockOnly || !!fireId, "no fire came by itself");
if (quake) {
  const page = eventPage(world, quake),
    text = page.tabs[0]!.blocks.map((b) => plain(b as never)).join(" ");
  say(`shock: ${text.slice(0, 220)}`);
  check(/Why here/.test(JSON.stringify(page)), "a shock's page says nothing of why here");
  check(
    /plate:/.test(JSON.stringify(page)) || /within|far from where/.test(text),
    "a shock's page opens no plate",
  );
  check(!BAD.test(text), `bad words on a shock's page: ${text.slice(0, 200)}`);
}
// No fire where nothing burns.
if (noFire) {
  const w = open(noFire, "alien"),
    y0 = Math.floor(w.now / YEAR);
  w.runTo((y0 + 12) * YEAR);
  say(
    `a world with nothing to burn, 12 years on: ${wildOf(w)!.tally.fires} fires, ${wildOf(w)!.tally.quakes} shocks`,
  );
  check(wildOf(w)!.tally.fires === 0, "a fire fell on a world with nothing to burn");
}

// The fire to watch: on a peopled land, the most of it on the land's ground, nearest the middle; one that reached a town first.
type Watch = {
  event: string;
  cell: number;
  from: number;
  until: number;
  tiles: number;
  x: number;
  z: number;
  towns: number;
};
const groundOf = (w: World, cell: number): LandGround => {
  const f = region(w, cell) as unknown as {
    size: number;
    tileKm: number;
    elevation: ArrayLike<number>;
    water: ArrayLike<number>;
    fertility: ArrayLike<number>;
  };
  return {
    size: f.size,
    tileKm: f.tileKm,
    heights: Float32Array.from(f.elevation),
    water: Uint8Array.from(f.water),
    fertility: Uint8Array.from(f.fertility, (x) => Math.round(x * 255)),
  } as LandGround;
};
let watch: Watch | null = null,
  bestScore = 0;
const ctx = populationContext(world);
for (const f of store.scars.slice(-80)) {
  const e = world.events.get(f.event),
    towns = ((e?.data as { towns?: string[] } | null)?.towns ?? []).length;
  for (const cell of f.lands.slice(0, 8)) {
    if ((ctx.provinces.get(cell)?.total() ?? 0) <= 0) continue;
    const burn = landPlan(world, cell, 60).burns?.find((b) => b.event === f.event);
    if (!burn) continue;
    const t = burnTiles(burn, groundOf(world, cell)),
      n = t.tiles.length;
    if (n < 40) continue;
    let x = 0,
      z = 0;
    for (let i = 0; i < n; i++) {
      x += t.x[i]!;
      z += t.z[i]!;
    }
    const score = n * (towns ? 3 : 1);
    if (score > bestScore) {
      bestScore = score;
      watch = {
        event: f.event,
        cell,
        from: f.from,
        until: f.until,
        tiles: n,
        x: x / n,
        z: z / n,
        towns,
      };
      blueFire = burn.flame[2]! > burn.flame[0]!;
    }
  }
}
check(shockOnly || !!watch, "no fire crossed a peopled land by enough to be watched");
if (watch)
  say(
    `to watch: ${watch.event} on land ${watch.cell}, ${watch.tiles} tiles around (${watch.x.toFixed(0)}, ${watch.z.toFixed(0)}), ${((watch.until - watch.from) / DAY).toFixed(0)} days, ${watch.towns} towns reached`,
  );

/** A world again to a moment, saved. */
const forkTo = (t: number): Buffer => {
  const w = fresh();
  w.runTo(t);
  return gzipSync(JSON.stringify(saveWorld(w, rulesetId(w, U.version), { universe: U.name })));
};

if ((watch || shockOnly) && !problems.length) {
  const seed = world.seed.text,
    root = fileURLToPath(new URL("..", import.meta.url)),
    server = await preview({
      root,
      logLevel: "silent",
      preview: { port: 4297, strictPort: false },
    }),
    base = server.resolvedUrls!.local[0]!,
    browser = await chromium.launch({
      args: soft
        ? ["--use-angle=swiftshader", "--enable-unsafe-swiftshader"]
        : ci
          ? []
          : ["--enable-gpu", "--ignore-gpu-blocklist", "--use-angle=d3d11"],
    }),
    context = await browser.newContext({
      viewport: { width: 430, height: 932 },
      deviceScaleFactor: 1,
      hasTouch: true,
      isMobile: true,
    }),
    page: Page = await context.newPage(),
    errors: string[] = [],
    k = <T>(code: string): Promise<T> => page.evaluate(code) as Promise<T>,
    q = `universe=${u}&seed=${encodeURIComponent(seed)}`,
    drawn = () =>
      page.waitForFunction(() => ((globalThis as any).causalis?.drawn?.() ?? 0) > 0, undefined, {
        timeout: slow(180000),
      }),
    /** Into a world saved at that moment, held. */
    enter = async (bytes: Buffer, name: string) => {
      await page.goto(`${base}?${q}&hold=1`);
      await drawn();
      await page.evaluate(
        async ([data, as]) => {
          const b = Uint8Array.from(atob(data as string), (c) => c.charCodeAt(0)),
            c = (globalThis as any).causalis.client;
          await c.importSave(b);
          await c.save(as);
        },
        [bytes.toString("base64"), name],
      );
      await page.goto(`${base}?${q}&load=${name}&hold=1`);
      await drawn();
    },
    /** On to moment t, the clock held: the host's word of it come, and a few frames drawn there. */
    advance = async (t: number) => {
      await k(`globalThis.causalis.client.advance(${Math.round(t)})`);
      await page
        .waitForFunction(
          (at) => ((globalThis as any).causalis.client.status?.t ?? 0) >= at - 1,
          t,
          {
            timeout: slow(60000),
          },
        )
        .catch(() => undefined);
      await page.waitForTimeout(slow(400));
    },
    fireNow = () =>
      k<{ flames: number; smoke: number; scar: number; burns: number; bare: number } | null>(
        "globalThis.causalis.landFire ? globalThis.causalis.landFire() : null",
      ),
    /** The real layer's word, within a while. */
    until = async (what: string, ok: () => Promise<boolean>, ms = 60000) => {
      const end = Date.now() + slow(ms);
      while (Date.now() < end) {
        if (await ok().catch(() => false)) return true;
        await page.waitForTimeout(250);
      }
      problems.push(`${what} did not come`);
      return false;
    },
    shot = async (name: string): Promise<Buffer> => {
      const png = await page.screenshot();
      if (shots) writeFileSync(join(shots, `${name}.png`), png);
      return png;
    };
  page.setDefaultTimeout(slow(90000));
  page.on("pageerror", (e) => errors.push(e.message));

  if (watch) {
    // 2. The fire, from the day before it.
    await enter(forkTo(watch.from - DAY), "gate97");
    await k(`globalThis.causalis.goTo("cell:0:${watch.cell}")`);
    await until(
      "the land",
      async () => (await k<string>("globalThis.causalis.scale()")) === "region",
    );
    await page.waitForTimeout(slow(3000));
    await k(`globalThis.causalis.faceLand(${watch.x}, ${watch.z}, 150)`);
    await page.waitForTimeout(slow(1500));
    const before = await fireNow(),
      shotBefore = await shot("1-before"),
      flameBefore = pixels(shotBefore, flamePixel),
      scarBefore = pixels(shotBefore, scarPixel);
    say(
      `the day before: ${JSON.stringify(before)}, ${flameBefore} flame pixels, ${scarBefore} of char`,
    );
    check((before?.flames ?? 1) === 0, "flames on the land before the fire lit");

    // It comes, the clock running as anyone's on a land does: stopped with flames up, the eye on them, and again with the front gone on.
    const running = (speed: number) => k(`globalThis.causalis.client.setSpeed(${speed})`),
      frontNow = () => k<{ x: number; z: number } | null>("globalThis.causalis.landFront()"),
      catchFront = async (name: string, least: number) => {
        await running(30 * DAY);
        const end = Date.now() + slow(60000);
        let n = 0;
        while (Date.now() < end) {
          n = (await fireNow())?.flames ?? 0;
          if (n >= least) break;
          await page.waitForTimeout(100);
        }
        await running(0);
        await page.waitForTimeout(slow(300));
        const at = await frontNow();
        // (As a person sees it from where a land opens.)
        if (shots) await shot(`${name}-far`);
        if (at) await k(`globalThis.causalis.faceLand(${at.x}, ${at.z}, 70)`);
        await page.waitForTimeout(slow(1200));
        const png = await shot(name),
          flames = pixels(png, flamePixel),
          shown = await fireNow();
        say(
          `${name}: ${JSON.stringify(shown)}, front ${at ? `${at.x.toFixed(0)}, ${at.z.toFixed(0)}` : "none"}, ${flames} flame pixels`,
        );
        return { at, flames, shown };
      };
    // (A small fire has a few flames up at a time: as many as a line across it has.)
    const first = await catchFront(
      "2-burning",
      Math.max(3, Math.min(16, Math.floor(watch.tiles / 40))),
    );
    check(!!first.at, "no flames came in the layer");
    // On: the front a good way off, the fire not yet done.
    await running(30 * DAY);
    await page.waitForTimeout(3000);
    const second = await catchFront("3-later", 1);
    check((second.shown?.scar ?? 0) > (first.shown?.scar ?? 0), "the front did not go on");

    // It burns out: its scar stays, its woods gone.
    await running(30 * DAY);
    await until("the flames gone", async () => {
      const f = await fireNow(),
        t = await k<number>("globalThis.causalis.client.status?.t ?? 0");
      return f?.flames === 0 && t > watch!.until;
    });
    await running(0);
    // (From where the flames were first seen: what was hot there and isn't now was the fire, on a land of any colour.)
    if (first.at) await k(`globalThis.causalis.faceLand(${first.at.x}, ${first.at.z}, 70)`);
    await page.waitForTimeout(slow(2500));
    const coldThere = pixels(await shot("3b-cold"), flamePixel);
    say(`the same place when it had gone: ${coldThere} flame pixels, against ${first.flames}`);
    check(
      first.flames > coldThere + 30,
      `no flames in the pixels (${first.flames} burning, ${coldThere} after)`,
    );
    await k(`globalThis.causalis.faceLand(${watch.x}, ${watch.z}, 150)`);
    await page.waitForTimeout(slow(2500));
    const after = await fireNow(),
      shotAfter = await shot("4-scar"),
      flameAfter = pixels(shotAfter, flamePixel),
      scarAfter = pixels(shotAfter, scarPixel);
    say(`burned out: ${JSON.stringify(after)}, ${flameAfter} flame pixels, ${scarAfter} of char`);
    check((after?.scar ?? 0) >= watch.tiles * 0.9, `its scar is not on the land (${after?.scar})`);
    check(
      scarAfter > scarBefore + 200,
      `no scar in the pixels (${scarBefore} before, ${scarAfter} after)`,
    );
    check((after?.bare ?? 0) > 0, "nothing stands bare where it burned");

    // 3. Its page.
    await k(`globalThis.causalis.open(${JSON.stringify(watch.event)})`);
    await page.waitForFunction(
      () => {
        const e = document.querySelector(".page-window:not([hidden])");
        return !!e && (e as HTMLElement).innerText.length > 80;
      },
      undefined,
      { timeout: slow(30000) },
    );
    const words = await k<string>(
      `(() => { const e = document.querySelector(".page-window:not([hidden])"); return e ? e.innerText : ""; })()`,
    );
    say(`page: ${words.slice(0, 360).replace(/\n/g, " | ")}`);
    await shot("5-fire-page");
    check(/Why here/i.test(words), "the fire's page does not say why here on the screen");
    check(!BAD.test(words), `bad words on the screen: ${words.slice(0, 200)}`);
  }

  // 4. A shock, in the town it brought down.
  if (felled) {
    const f = felled as { id: string; t: number; homes: number; town: string };
    await enter(forkTo(f.t - DAY), "gate97b");
    await k(`globalThis.causalis.goTo(${JSON.stringify(f.town)})`);
    await until(
      "the town drawn",
      async () => (await k<string>("globalThis.causalis.scale()")) === "village",
    );
    await page.waitForTimeout(slow(3000));
    await advance(f.t + 12);
    // (The town being watched hears of it by itself, and reads its plan again: not at the year's turn.)
    const lotByLot = await k<boolean>("!!globalThis.causalis.planNow?.()?.town"),
      shaking = lotByLot
        ? await until("the ground shaking in the town it struck", async () => {
            const b = await k<{ shake?: number } | null>("globalThis.causalis.blaze()");
            return (b?.shake ?? 0) > 0;
          }).then(() => k<{ shake?: number } | null>("globalThis.causalis.blaze()"))
        : null;
    await shot("6-shaken");
    await advance(f.t + 5 * 60);
    await page.waitForTimeout(slow(1500));
    const dust = await k<{ dust?: number } | null>(
      "globalThis.causalis.blaze ? globalThis.causalis.blaze() : null",
    );
    await shot("7-dust");
    say(
      `a shock in ${f.town} (${f.homes} homes, ${lotByLot ? "drawn lot by lot" : "not drawn lot by lot"}): shaking ${shaking?.shake?.toFixed(2)}, ${dust?.dust} in dust`,
    );
    if (lotByLot) check((dust?.dust ?? 0) > 0, "no home in dust where a shock brought homes down");
    const said = why(world, f.id as never).claim;
    say(`told: ${said}`);
    check(!/By your hand|Your act/.test(said), "a shock by itself told as a hand's");

    // 5. With someone walked there when it comes, and with a life lived there.
    const back = async () => {
      await page.goto(`${base}?${q}&load=gate97b&hold=1`);
      await drawn();
      await k(`globalThis.causalis.goTo(${JSON.stringify(f.town)})`);
      await until(
        "the town again",
        async () => (await k<string>("globalThis.causalis.scale()")) === "village",
      );
      await page.waitForTimeout(slow(3000));
    };
    await back();
    // (Laid on the town as a person lays it from its page, and those it draws asked for again.)
    await k(
      `globalThis.causalis.client.command("hand.lay", { village: ${JSON.stringify(f.town)} })`,
    );
    await advance(f.t - DAY + 3600);
    await until(
      "the hand laid",
      async () => !!(await k<unknown>(`globalThis.causalis.client.query({ type: "hand" })`)),
    );
    await k("globalThis.causalis.reloadPlan()");
    const hand = await k<number>(
      `(() => { const p = globalThis.causalis.planNow(); return p?.people?.findIndex((x) => !x.child && x.ref.startsWith("agent:")) ?? -1; })()`,
    );
    if (hand >= 0) {
      const refused = await k<string | null>(`globalThis.causalis.possess.take(${hand})`);
      check(!refused, `no one to walk in ${f.town}: ${refused}`);
      await until(
        "a body in hand",
        async () =>
          !!(await k<{ live?: unknown } | null>("globalThis.causalis.possess.state()"))?.live,
      );
      await advance(f.t + 12);
      await page.waitForTimeout(slow(1000));
      check(
        !!(await k<{ live?: unknown } | null>("globalThis.causalis.possess.state()"))?.live,
        "the body let go when the ground shook",
      );
      await shot("8-possessed");
    } else say(`no one to walk in ${f.town}`);
    await back();
    const shown = (selector: string) =>
      k<boolean>(
        `(() => { const e = document.querySelector(${JSON.stringify(selector)}); return !!e && e.getBoundingClientRect().height > 0; })()`,
      );
    await until("Live here", () => shown(".town-live"));
    await k(`document.querySelector(".town-live").click()`);
    await until("the sheet of lives", () => shown(".life-picker .life-card"));
    await k(`document.querySelector(".life-picker .life-live").click()`);
    await until(
      "a life",
      async () => !!(await k<unknown>("globalThis.causalis.life.state()")),
      120000,
    );
    await advance(f.t + 12);
    await page.waitForTimeout(slow(1000));
    check(
      !!(await k<unknown>("globalThis.causalis.life.state()")),
      "the life ended when the ground shook",
    );
    await shot("9-life");
  }

  check(!errors.length, `page errors: ${errors.slice(0, 3).join(" / ")}`);
  await browser.close();
  await server.close();
}
if (problems.length) {
  console.log(`gate 97 FAILED:\n  - ${problems.join("\n  - ")}`);
  process.exit(1);
}
console.log("gate 97 passed");
process.exit(0);
