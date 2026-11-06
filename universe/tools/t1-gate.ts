// node tools/t1-gate.ts [--ci] [--soft] [--shots dir] [--save file.save --universe earth|alien] [--water file.save] [--nogrip file.save]: gate 93, memory in the town
// (T1), at a phone's size, by real touch. On far saves, else (as on CI) a young world run a few decades:
//   1. the reading, off the save: the same world, the same stones and songs; hashes the same; no bad word on any stone's or song's page; not every town, not almost none;
//   2. the town with the most stones: they stand on the screen, in the pixels (the town with them against without), a stone pressed by touch at its real place, its page's words read off the screen;
//   3. a feast's evening: someone sings, the note on the screen, pressed by touch, the song's words on its page;
//   4. a town's page: Songs and tales pressed by touch, a song in it; a realm's page too;
//   5. the paths nobody watches: a town with no past, a stone of a realm that is gone, one pressed during a possession and a life, a water people's, a people who cannot grip; a young world.
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
import { populationContext, politiesOf } from "../src/sim/index.ts";
import {
  memoryOf,
  memorialsOf,
  songFor,
  songPage,
  stonePage,
  townSongs,
  type Deed,
} from "../src/host/inspect/memory.ts";

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
  nogripFile = arg("--nogrip");
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
console.log("gate 93, memory in the town");

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

const BAD = /undefined|NaN|\[object|\bnull\b|\b(ev|pol|town|stone|song|war|sick|cell):\d/;
const plainLine = (l: readonly unknown[]) =>
  l.map((s) => (typeof s === "string" ? s : (s as { text: string }).text)).join("");

/** The reading, off the save: same twice, no bad word, hashes the same; a table's worst read. */
function read(f: Forged, far: boolean): { most: string | null; none: string | null } {
  const w = f.world,
    before = JSON.stringify(w.domainHashes()),
    m = memoryOf(w),
    towns = populationContext(w)
      .settlements.all()
      .filter((s) => s.population > 0),
    withStone = towns.filter((t) => (m.stones.get(t.ref) ?? []).length > 0),
    share = withStone.length / Math.max(1, towns.length);
  let most: string | null = null,
    mostN = 0;
  for (const [t, l] of m.stones)
    if (l.length > mostN && populationContext(w).settlements.get(t as never)?.population) {
      mostN = l.length;
      most = t;
    }
  say(
    `${f.seed}: ${m.deeds.length} things remembered; ${withStone.length} of ${towns.length} towns have a stone (${Math.round(share * 100)}%), most ${mostN}`,
  );
  if (far) {
    check(
      share >= 0.05 && share <= 0.7,
      `${f.seed}: ${Math.round(share * 100)}% of towns have a stone`,
    );
    check(mostN <= 5, `${f.seed}: a town with ${mostN} stones`);
  }
  const titles = new Map<string, number>();
  for (const d of m.deeds as readonly Deed[]) {
    const s = songFor(w, d),
      text = `${s.title} ${s.lines.join(" ")}`;
    titles.set(s.title, (titles.get(s.title) ?? 0) + 1);
    check(!BAD.test(text), `${f.seed}: a bad word in a song: ${text.slice(0, 200)}`);
    check(s.lines.length > 0, `${f.seed}: ${s.title} has no words`);
  }
  if (far && m.deeds.length > 100) {
    const top = [...titles].sort((a, b) => b[1] - a[1])[0]!;
    say(`commonest title ${top[0]}: ${top[1]} of ${m.deeds.length}`);
    check(top[1] / m.deeds.length < 0.15, `${f.seed}: ${top[0]} is ${top[1]} of ${m.deeds.length}`);
  }
  for (const [t, l] of m.stones)
    for (const d of l) {
      const pages = [stonePage(w, `stone:${t}:${d.id}`), songPage(w, `song:${d.id}`)];
      for (const p of pages) {
        const words = [
          p.title,
          ...p.tabs.flatMap((x) =>
            x.blocks.flatMap((b) => (b.type === "text" ? b.lines.map(plainLine) : [])),
          ),
        ].join(" ");
        check(!BAD.test(words), `${f.seed}: a bad word on ${p.ref}: ${words.slice(0, 200)}`);
      }
    }
  // The same world, the same stones and songs: read afresh from the save.
  const first = most ? JSON.stringify([memorialsOf(w, most), townSongs(w, most)]) : "";
  if (most) {
    const again = f.bytes,
      doc = JSON.parse(gunzipSync(again).toString("utf8")) as Parameters<typeof loadWorld>[0],
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
      JSON.stringify([memorialsOf(w2, most), townSongs(w2, most)]) === first,
      `${f.seed}: the same world raised other stones`,
    );
  }
  check(JSON.stringify(w.domainHashes()) === before, `${f.seed}: reading moved the hashes`);
  const none = towns.find((t) => !(m.stones.get(t.ref) ?? []).length)?.ref ?? null;
  return { most, none };
}

const root = fileURLToPath(new URL("..", import.meta.url)),
  server = await preview({ root, logLevel: "silent", preview: { port: 4293, strictPort: false } }),
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
  const name = `${f.universe}:gate93`,
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
type StoneShown = {
  ref: string;
  form: string;
  x: number;
  y: number;
  footX: number;
  footY: number;
  headY: number;
  worldX: number;
  worldZ: number;
  front: boolean;
};
const stones = () =>
  k<{ list: StoneShown[]; drawn: { parts: number; batches: number; placed: number } } | null>(
    "globalThis.causalis.stones?.() ?? null",
  );
/** A stone a finger can reach: it lies on the screen, nothing of the page's chrome over it. */
const reachable = () =>
  k<(StoneShown & { px: number; py: number })[]>(`(() => {
    const got = globalThis.causalis.stones?.();
    if (!got) return [];
    const out = [];
    for (const s of got.list) {
      if (!s.front) continue;
      // (Its middle, and low on it, and high on it.)
      for (const u of [0.5, 0.3, 0.7]) {
        const px = s.footX, py = s.footY + (s.headY - s.footY) * u;
        if (px < 12 || px > innerWidth - 12 || py < 12 || py > innerHeight - 12) continue;
        const e = document.elementFromPoint(px, py);
        if (e && e.tagName === "CANVAS") { out.push({ ...s, px, py }); break; }
      }
    }
    return out;
  })()`);
/** The eye brought to look at a thing raised, at the height a person looks. */
const lookAt = (s: { worldX: number; worldZ: number }) =>
  k(
    `globalThis.causalis.rig.flyTo({ target: { x: ${s.worldX * 0.1}, y: 0.4, z: ${s.worldZ * 0.1} }, distance: 5, pitch: -22 }, 0.3)`,
  );
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

/** A town gone to, its first stone looked at by real touch: the page's words off the screen. */
async function pressStone(label: string, want: RegExp): Promise<string> {
  const got = await stones();
  check(!!got && got.list.length > 0, `${label}: no stone drawn`);
  if (!got?.list.length) return "";
  await lookAt(got.list[0]!);
  await page.waitForTimeout(slow(900));
  const can = await reachable();
  check(can.length > 0, `${label}: no stone a finger can reach`);
  if (!can.length) return "";
  const s = can[0]!;
  await page.touchscreen.tap(s.px, s.py);
  await until(`${label}: its page`, async () =>
    String((await pageNow()) ?? "").startsWith("stone:"),
  );
  await page.waitForTimeout(slow(350));
  const text = await pageText();
  check(want.test(text), `${label}: its page says "${text.slice(0, 280)}"`);
  check(!BAD.test(text), `${label}: a bad word on its page: ${text.slice(0, 280)}`);
  await shot(`${label}-page`);
  await closePage();
  return text;
}

/** From its page, ⌖ Go to: the page gone, the eye at it, and the stone truly in the picture, whatever stands about it. */
async function goToStone(label: string, ref: string, drawn = true): Promise<void> {
  await k(`globalThis.causalis.open(${JSON.stringify(ref)})`);
  await until(`${label}: its page`, async () => (await pageNow()) === ref);
  await page.waitForTimeout(slow(300));
  await press(".page-window .go-to");
  await until(`${label}: its page gone`, async () => (await pageNow()) === null, slow(60000));
  const town = /^stone:(town:\d+:\d+):/.exec(ref)?.[1] ?? "";
  await until(
    `${label}: its town`,
    () =>
      k<boolean>(
        `globalThis.causalis.scale() === "village" && globalThis.causalis.planNow()?.ref === ${JSON.stringify(town)}`,
      ),
    slow(60000),
  );
  await page.waitForTimeout(slow(1600));
  // (One the world has since displaced from the town's five stands nowhere: the town is what it can show.)
  if (!drawn || !(await stones())?.list.some((s) => s.ref === ref)) {
    check(!drawn, `${label}: the stone asked for is not drawn in its town`);
    await shot(`${label}-go-to`);
    say(`${label}: a stone no longer drawn: its Go to came to its town and closed its page`);
    return;
  }
  const withIt = await shot(`${label}-go-to`);
  await k("globalThis.causalis.stonesShown(false)");
  await page.waitForTimeout(slow(300));
  const without = await shot(`${label}-go-to-without`);
  await k("globalThis.causalis.stonesShown(true)");
  const seen = await unlike(withIt, without);
  say(`${label}: from its page, ${(seen * 100).toFixed(1)}% of the picture is the stone`);
  check(seen > 0.006, `${label}: its page's Go to does not show it: ${(seen * 100).toFixed(2)}%`);
}

// The worlds.
const far = !!saveFile;
const made = saveFile ? fromFile(saveFile, universeArg) : youngWorld();
const { most, none } = read(made, far);
let standing: string[] = [];
await loadSave(made);
const hashesBefore = await ask<unknown>("hashes");

if (most) {
  await goDown(most);
  // 2. In the pixels, from the height a person looks: the town with its stones and without.
  const got = await stones();
  check(
    !!got &&
      got.drawn.placed === got.list.length &&
      got.list.length > 0 &&
      got.list.length ===
        (await k<number>("globalThis.causalis.planNow()?.memorials?.length ?? -1")),
    `the town's stones are not all drawn: ${got?.drawn.placed} of ${await k<number>("globalThis.causalis.planNow()?.memorials?.length ?? -1")}`,
  );
  check((got?.drawn.parts ?? 0) <= 45, `${got?.drawn.parts} parts in one town`);
  say(
    `${most}: ${got?.list.map((s) => s.form).join(", ")}; ${got?.drawn.parts} parts in ${got?.drawn.batches} batches`,
  );
  const fps = async () => {
    const t0 = await k<number>("performance.now()");
    await k(
      `new Promise((res) => { let n = 0; const f = () => (++n >= 30 ? res(n) : requestAnimationFrame(f)); requestAnimationFrame(f); })`,
    );
    return ((await k<number>("performance.now()")) - t0) / 30;
  };
  const first = await shot("1-town-first-view");
  await lookAt(got!.list[0]!);
  await page.waitForTimeout(slow(1000));
  const withThem = await shot("1-stone-near"),
    frameWith = await fps();
  await k("globalThis.causalis.stonesShown(false)");
  await page.waitForTimeout(slow(300));
  const without = await shot("1-stone-near-without"),
    frameWithout = await fps();
  await k("globalThis.causalis.stonesShown(true)");
  const shown = await unlike(withThem, without);
  say(
    `with and without: ${(shown * 100).toFixed(1)}% of the picture differs; a frame ${frameWith.toFixed(1)} ms with, ${frameWithout.toFixed(1)} ms without`,
  );
  check(shown > 0.006, `the stones hardly show: ${(shown * 100).toFixed(2)}% of the picture`);
  void first;
  // Pressed by touch at its real place; not the ground beneath it.
  const text = await pressStone("2-stone", /Raised|Left standing|No one raised|year/);
  say(`a stone's page: ${text.replace(/\s+/g, " ").slice(0, 200)}`);
  standing = got!.list.map((s) => s.ref);
  await goToStone("2-stone", got!.list[0]!.ref);
  // 4. Songs and tales on its town's page, pressed by touch.
  await k(`globalThis.causalis.open(${JSON.stringify(most)})`);
  await until("the town's page", async () => (await pageNow()) === most);
  const tabAt = await k<number>(
    `[...document.querySelectorAll(".page-window .tabs .tab")].findIndex((b) => /Songs and tales/.test(b.textContent))`,
  );
  check(tabAt >= 0, "no Songs and tales tab on a town's page");
  await press(`.page-window .tabs .tab:nth-child(${tabAt + 1})`);
  await page.waitForTimeout(slow(300));
  const tab = await pageText();
  check(/what they sing here/i.test(tab), `the town's Songs and tales: ${tab.slice(0, 200)}`);
  await shot("4-town-songs");
  await press(`.page-window a.ref-link[href^="#song:"]`);
  await until("a song's page", async () => String((await pageNow()) ?? "").startsWith("song:"));
  await page.waitForTimeout(slow(300));
  const song = await pageText();
  check(
    /how it has changed/i.test(song) && /what really happened/i.test(song),
    `a song's page: ${song.slice(0, 280)}`,
  );
  say(`a song: ${song.replace(/\s+/g, " ").slice(0, 260)}`);
  await shot("4-song-page");
  await closePage();
  check(
    JSON.stringify(await ask<unknown>("hashes")) === JSON.stringify(hashesBefore),
    "looking moved the hashes",
  );
  // 3. A feast's evening (the gate moves the clock for it, so the hashes are not asked after).
  const feasts = await k<{ day: number; words: string }[]>(
    "globalThis.causalis.planNow()?.life?.feasts ?? []",
  );
  const today = await k<number>("Math.floor(globalThis.causalis.now?.() ?? 0)");
  void today;
  const f = feasts[feasts.length - 1];
  check(!!f, "the town keeps no feast");
  if (f) {
    await k(`globalThis.causalis.client.advance(${f.day * 86400 + 19 * 3600})`);
    await until(
      "the song at the feast",
      async () => !!(await k<unknown>("globalThis.causalis.sung?.()")),
      slow(30000),
    );
    await page.waitForTimeout(slow(900));
    const sung = await k<{
      ref: string;
      title: string;
      who: string | null;
      x: number;
      y: number;
    } | null>("globalThis.causalis.sung?.()");
    say(`at ${f.words}: ${sung?.who ?? "they"} sing ${sung?.title}`);
    await shot("3-feast");
    const note = await k<{
      h: number;
      x: number;
      y: number;
      top: boolean;
      text: string;
    } | null>(`(() => {
      const e = globalThis.causalis.sungNote?.();
      if (!e) return null;
      const r = e.getBoundingClientRect(), t = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2);
      return { h: r.height, x: r.x + r.width / 2, y: r.y + r.height / 2, top: !!t && (t === e || e.contains(t)), text: e.innerText };
    })()`);
    check((note?.h ?? 0) >= 44, `the song's note is ${note?.h ?? 0} px tall`);
    check(!!note?.top, "something lies over the song's note");
    if (note && note.h > 0) {
      await page.touchscreen.tap(note.x, note.y);
      await until("the song's page, from the note", async () =>
        String((await pageNow()) ?? "").startsWith("song:"),
      );
      await page.waitForTimeout(slow(300));
      const words = await pageText();
      check(words.includes(sung?.title ?? "?"), `the note's song: ${words.slice(0, 200)}`);
      await shot("3-feast-song");
      await closePage();
    }
    // By day, as most will see it; every shot above is the town's midnight or its evening's rain.
    await k(`globalThis.causalis.client.advance(${(f.day + 1) * 86400 + 12 * 3600})`);
    await page.waitForTimeout(slow(900));
    const near = await stones();
    if (near?.list.length) {
      await lookAt(near.list[0]!);
      await page.waitForTimeout(slow(1000));
      await shot("1-stone-day");
    }
  }
} else if (far) problems.push("a far world with no town with a stone");

// 5. A town with no past.
if (none) {
  await goDown(none);
  const got = await stones();
  check((got?.list.length ?? -1) === 0, `a town with no great past has ${got?.list.length} stones`);
  await shot("5-no-past");
  await k(`globalThis.causalis.open(${JSON.stringify(none)})`);
  await until("its page", async () => (await pageNow()) === none);
  await closePage();
  // (From another town, a stone's page brings the eye to it there: one that stands now, by what the town drew. And one the node's copy of the world, a little
  // behind the browser's, lists and the town no longer draws, if there is one: its page is still a way there.)
  if (standing[0]) await goToStone("5-from-afar", standing[0]);
  const worn = most
    ? memorialsOf(made.world, most).find((m) => !standing.includes(m.ref))?.ref
    : undefined;
  if (worn) {
    await goDown(none);
    await goToStone("5-worn", worn, false);
  }
}

// A stone of a realm that is gone: its page says so.
{
  const w = made.world,
    realms = politiesOf(w);
  let gone: string | null = null;
  outer: for (const [t, l] of memoryOf(w).stones)
    for (const d of l) {
      const by = d.raiser === 1 ? d.themRef : d.usRef,
        r = by ? realms.get(by as never) : undefined;
      if (r && r.ended !== null && d.kind !== "fire") {
        gone = `stone:${t}:${d.id}`;
        break outer;
      }
    }
  if (gone) {
    const p = stonePage(w, gone),
      words = p.tabs
        .flatMap((x) => x.blocks.flatMap((b) => (b.type === "text" ? b.lines.map(plainLine) : [])))
        .join(" ");
    check(/which is gone/.test(words), `a stone of a realm gone says: ${words.slice(0, 240)}`);
    say(`a realm gone: ${words.slice(0, 200)}`);
  } else if (far) say("no stone of a realm gone on this world");
}

// During a life and a possession: a stone pressed, as a person's finger would, its page on the screen.
if (most && far) {
  await goDown(most);
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
    // (The eye held on the one lived: a finger pinches it back until a stone is in sight.)
    let can = await reachable();
    for (const distance of [24, 48, 90]) {
      if (can.length) break;
      await k(`globalThis.causalis.rig.flyTo({ distance: ${distance}, pitch: -40 }, 0.2)`);
      await page.waitForTimeout(slow(700));
      can = await reachable();
    }
    say(`in a life: ${can.length} stones a finger can reach`);
    await shot("5-living");
    check(can.length > 0, "in a life: no stone a finger can reach");
    if (can.length) {
      // (Someone may stand before a stone, and a press on them opens theirs, as it should: try the next, then another moment.)
      let pressed = false;
      for (let tries = 0; tries < 12 && !pressed; tries++) {
        const list = await reachable();
        for (const s of list.length ? list : can) {
          await page.touchscreen.tap(s.px, s.py);
          await page.waitForTimeout(slow(900));
          const opened = String((await pageNow()) ?? "");
          if (opened.startsWith("stone:")) {
            pressed = true;
            break;
          }
          if (opened) await closePage();
        }
        if (!pressed) await page.waitForTimeout(slow(1500));
      }
      await until("a stone's page, in a life", async () =>
        String((await pageNow()) ?? "").startsWith("stone:"),
      );
      await page.waitForTimeout(slow(350));
      const t = await pageText();
      check(/Stands in/.test(t), `a stone's page, in a life: "${t.slice(0, 120)}"`);
      await shot("5-living-page");
      await closePage();
      check(await shownAt(".life-strip"), "reading a stone ended the life");
    }
    await press(".life-letgo");
    await until("the life let go", async () => !(await shownAt(".life-strip")), slow(60000));
  }

  // A possession: a stone far off says to walk nearer; near, it opens, and the body stands on.
  type Me = { agent: number; x: number; z: number; yaw: number };
  const me = () =>
    k<Me | null>(`(() => {
      const p = globalThis.causalis.possess, s = p?.state(), m = s && p.drawn(s.agent);
      return m ? { agent: s.agent, x: m.x, z: m.z, yaw: s.eye.yaw } : null;
    })()`);
  /** The stones where a finger could come down on one: on the screen and off the possession's controls. */
  const inSight = () =>
    k<(StoneShown & { px: number; py: number })[]>(`(() => {
      const got = globalThis.causalis.stones?.();
      if (!got) return [];
      const out = [];
      for (const s of got.list) {
        if (!s.front) continue;
        for (const u of [0.5, 0.25, 0.75, 0.1]) {
          const px = s.footX, py = s.footY + (s.headY - s.footY) * u;
          if (px < 12 || px > innerWidth - 12 || py < 12 || py > innerHeight - 12) continue;
          const e = document.elementFromPoint(px, py);
          if (e && e.classList.contains("possess-hud")) {
            out.push({ ...s, px, py });
            break;
          }
        }
      }
      return out;
    })()`);
  /** The eye turned by a finger's drag across the right of the screen until one is in sight (the same stone, if asked). */
  const fingers = await context.newCDPSession(page);
  const turnTo = async (ref?: string) => {
    const at = (x: number) => [{ x, y: 470, id: 2, radiusX: 6, radiusY: 6, force: 1 }];
    for (let i = 0; i < 32; i++) {
      const can = (await inSight()).filter((s) => !ref || s.ref === ref);
      if (can.length) return can[0]!;
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
  /** Walked on the keys toward a point until near it, stepping aside where a wall stops the body. */
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

  const sheetFor = await k<number>(
    `(() => { const p = globalThis.causalis.planNow(); return p?.people?.findIndex((x) => !x.child && x.ref.startsWith("agent:")) ?? -1; })()`,
  );
  const take = () => k<string | null>(`globalThis.causalis.possess?.take?.(${sheetFor}) ?? null`);
  let why = await take();
  if (why) {
    // (No life's hand on it: laid, as a person lays it from the town's page.)
    await k(`globalThis.causalis.client.command("hand.lay", { village: ${JSON.stringify(most)} })`);
    const t = await k<number>("globalThis.causalis.client.status?.t ?? 0");
    await k(`globalThis.causalis.client.advance(${t + 3600})`);
    await until(
      "the hand laid",
      async () => !!(await k<unknown>(`globalThis.causalis.client.query({ type: "hand" })`)),
      slow(30000),
    );
    why = await take();
  }
  check(sheetFor >= 0, "no one of the town to possess");
  check(!why, `no possession: ${why}`);
  const took =
    !why &&
    (await until(
      "a possession",
      () => k<boolean>(`document.body.classList.contains("possessing")`),
      slow(60000),
    ));
  if (took) {
    await page.waitForTimeout(slow(900));
    const seen = await turnTo();
    check(!!seen, "possessed: no stone comes in sight, turning all the way round");
    await shot("5-possessed");
    if (seen) {
      const m = await me(),
        off = m ? Math.hypot(seen.worldX - m.x, seen.worldZ - m.z) : 0;
      say(`possessed; a stone ${off.toFixed(0)} m off`);
      if (off > 45) {
        await page.touchscreen.tap(seen.px, seen.py);
        await page.waitForTimeout(slow(350));
        check(
          (await pageNow()) === null,
          "possessed: a stone far off opened without walking to it",
        );
        const told = await k<string>(`document.querySelector(".possess-told")?.textContent ?? ""`);
        check(/walk nearer/.test(told), `possessed: a stone far off, told "${told}"`);
      }
      const there = await walkNear(seen.worldX, seen.worldZ, 14);
      check(there, "possessed: could not walk to the stone");
      await page.waitForTimeout(slow(600));
      const close = await turnTo(seen.ref);
      check(!!close, "possessed: the stone is not in sight from beside it");
      if (close) {
        await page.touchscreen.tap(close.px, close.py);
        await until("a stone's page, possessed", async () =>
          String((await pageNow()) ?? "").startsWith("stone:"),
        );
        await page.waitForTimeout(slow(350));
        const t = await pageText();
        check(/Stands in/.test(t), `a stone's page, possessed: "${t.slice(0, 120)}"`);
        // (A real finger reaches all of it, and nothing of the controls lies over it.)
        const over = await k<string[]>(`(() => {
          const w = document.querySelector(".page-window");
          if (!w) return ["no page"];
          const r = w.getBoundingClientRect(), out = [];
          for (let i = 0; i < 6; i++)
            for (let j = 0; j < 8; j++) {
              const x = r.x + ((i + 0.5) * r.width) / 6, y = r.y + ((j + 0.5) * r.height) / 8,
                e = document.elementFromPoint(x, y);
              if (!e || !w.contains(e)) out.push(e ? e.className || e.tagName : "nothing");
            }
          return out;
        })()`);
        check(!over.length, `possessed: over a stone's page: ${over.slice(0, 4).join(", ")}`);
        await shot("5-possessed-page");
        await press(".page-window h2 .close");
        check((await pageNow()) === null, "possessed: the page's close did not close it");
        check(!!(await me()), "reading a stone ended the possession");
        // (Walked straight at it, the body does not pass through what stands there.)
        const into = await walkNear(close.worldX, close.worldZ, 0.15, 7000);
        check(!into, "possessed: walked through the stone");
      }
    }
    await k(`globalThis.causalis.possess?.letGo?.()`);
    await until(
      "let go",
      () => k<boolean>(`!document.body.classList.contains("possessing")`),
      slow(30000),
    );
  }
}

// Other peoples' worlds.
for (const [file, label, want] of [
  [waterFile, "water", /shell|coral/i],
  [nogripFile, "nogrip", /heap|carried|barrow|cairn|rolled|what was left/i],
] as const) {
  if (!file) continue;
  const f = fromFile(file, "alien"),
    r = read(f, true);
  if (!r.most) {
    problems.push(`${label}: no town with a stone`);
    continue;
  }
  await loadSave(f);
  await goDown(r.most);
  await page.waitForTimeout(slow(600));
  const got = await stones();
  say(`${label}: ${r.most}: ${got?.list.map((s) => s.form).join(", ")}`);
  await shot(`6-${label}-town`);
  const t = await pressStone(`6-${label}`, want);
  say(`${label}: ${t.replace(/\s+/g, " ").slice(0, 220)}`);
  // (Where towers hide it from above: its page's Go to looks across the square at it.)
  if (got?.list[0]) await goToStone(`6-${label}`, got.list[0].ref);
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
