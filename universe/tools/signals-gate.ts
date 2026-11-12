// node tools/signals-gate.ts [--ci] [--soft] [--shots dir] [--seed text]: gate 109, signals and the world known
// (docs/architecture/first-principles-plan.md, "Signals", asked 2026-11-11: "the utility of phones and laptops and information age"
// and "the whole world should technically be explored before they reach space"). An alien world run in node past its first orbit
// and into machines in the pocket, taken up in the app at 430 by 932, by real touch:
//   1. its pages show the signal steps: what can be done here, its ladder of talking at a distance from a runner to a web of machines,
//      and how much of its world is known; a land's economy, how fast its word goes and what being on the line does; a step's page,
//      what it does and what it changes;
//   2. something drawn shows them: in a town of a land with machines in the pocket, poles and the wire slung between them, a mast
//      over its square, phones in its people's hands, and at night the cold light of screens in its windows, seen in the pixels;
//   3. the world map fully known after orbit: under the knowledge lens no land is left dark, where the same world before its first orbit
//      had much of it dark, counted in the pixels; and no page errors.
import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { gzipSync } from "node:zlib";
import { preview } from "vite";
import { chromium, type Page } from "playwright";
import { YEAR, rulesetId, saveWorld, seedFromText, type World } from "../src/kernel/index.ts";
import { ALIEN } from "../src/host/planet.ts";
import { knownWorld } from "../src/host/known.ts";
import { homePlanet, loreOf } from "../src/sim/index.ts";
import { homeCells } from "../src/host/known.ts";

const argv = process.argv.slice(2),
  soft = argv.includes("--soft"),
  ci = argv.includes("--ci"),
  arg = (name: string) => {
    const at = argv.indexOf(name);
    return at >= 0 ? argv[at + 1] : undefined;
  },
  shots = arg("--shots"),
  seed = arg("--seed") ?? "alien 132";
if (shots) mkdirSync(shots, { recursive: true });
const slow = (ms: number) => (ci || soft ? ms * 4 : ms);
const GPU = ["--enable-gpu", "--ignore-gpu-blocklist", "--use-angle=d3d11"];
const problems: string[] = [],
  check = (ok: boolean, what: string) => {
    if (!ok) problems.push(what);
  },
  say = (s: string) => console.log(`  ${s}`);
console.log("gate 109, signals and the world known");

// The world, run in node: a save before its first orbit, and one in its information age.
const firstKnown = (world: World, id: string): number | null => {
  const lore = loreOf(world),
    n = homeCells(homePlanet(world).generated);
  let best: number | null = null;
  for (let c = 0; c < n; c++) {
    const k = lore.get(c, id);
    if (k && (best === null || k.year < best)) best = k.year;
  }
  return best;
};
const pack = (world: World) =>
  gzipSync(
    JSON.stringify(saveWorld(world, rulesetId(world, ALIEN.version), { universe: "alien" })),
  );
const t0 = Date.now(),
  world = ALIEN.build(seedFromText(seed));
let young: Buffer | null = null,
  youngShare = 1;
for (let y = 100; y <= 2400; y += 50) {
  world.runTo(y * YEAR);
  const orbit = firstKnown(world, "orbital-flight");
  if (orbit === null && y >= 600) {
    young = pack(world);
    youngShare = knownWorld(world).share;
  }
  if (orbit !== null && firstKnown(world, "pocket-machines") !== null && y >= orbit + 50) break;
}
const year = Math.floor(world.now / YEAR),
  orbitYear = firstKnown(world, "orbital-flight"),
  webYear = firstKnown(world, "networks"),
  late = pack(world);
say(
  `${seed}: run to ${year} in ${Math.round((Date.now() - t0) / 1000)} s; first orbit ${orbitYear}, first web ${webYear}; before orbit ${Math.round(youngShare * 100)}% known`,
);
check(orbitYear !== null && webYear !== null, `${seed} came to no orbit or no web by ${year}`);
check(!!young, "no save before its first orbit");

const root = fileURLToPath(new URL("..", import.meta.url)),
  server = await preview({ root, logLevel: "silent", preview: { port: 4325, strictPort: false } }),
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
const settle = (ms: number) => page.waitForTimeout(slow(ms));
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
const drawn = () =>
  page.waitForFunction(
    () => ((globalThis as { causalis?: { drawn?: () => number } }).causalis?.drawn?.() ?? 0) > 0,
    undefined,
    { timeout: slow(180000) },
  );

async function loadSave(bytes: Buffer, name: string) {
  const q = `universe=alien&seed=${encodeURIComponent(seed)}`;
  await page.goto(`${base}?${q}&hold=1`);
  await page.waitForFunction(
    () => !!(globalThis as { causalis?: { client?: unknown } }).causalis?.client,
    undefined,
    { timeout: slow(120000) },
  );
  await drawn();
  await page.evaluate(
    async ([data, keep]) => {
      const b = Uint8Array.from(atob(data as string), (c) => c.charCodeAt(0));
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
      await c.importSave(b);
      await c.save(keep as string);
    },
    [bytes.toString("base64"), name],
  );
  await page.goto(`${base}?${q}&load=${encodeURIComponent(name)}&hold=1`);
  await drawn();
  await k("globalThis.causalis.client.setSpeed(0)");
  await settle(1500);
  await k("globalThis.causalis.closePage?.()");
}

type At = { x: number; y: number; h: number; under: string | null };
const centre = (sel: string) =>
  k<At | null>(`(() => {
    for (const e of document.querySelectorAll(${JSON.stringify(sel)})) {
      e.scrollIntoView({ block: "center", inline: "center" });
      const r = e.getBoundingClientRect();
      if (!(r.width > 0 && r.height > 0)) continue;
      const x = r.left + Math.min(r.width / 2, 40), y = r.top + r.height / 2, top = document.elementFromPoint(x, y);
      return { x, y, h: r.height, under: top && (e === top || e.contains(top) || top.contains(e)) ? null : String(top ? top.className || top.tagName : "nothing") };
    }
    return null;
  })()`);
/** A tap by a finger, where it shows. */
const tap = async (sel: string, what: string) => {
  let at: At | null = null;
  await until(`${what} on the screen`, async () => {
    at = await centre(sel);
    return !!at;
  });
  if (!at) return false;
  const p = at as At;
  check(!p.under, `${what} lies under ${p.under}`);
  check(p.x >= 0 && p.x <= 430 && p.y > 0 && p.y < 932, `${what} lies off the screen`);
  await page.touchscreen.tap(p.x, p.y);
  await settle(400);
  return true;
};
const pageOpen = () => k<string | null>("globalThis.causalis.pageOpen() ?? null");
const pageText = () => k<string>(`document.querySelector(".page-window")?.innerText ?? ""`);
const BAD = /undefined|NaN|\[object|\bnull\b|\b(prin|cell|town|pol):[a-z0-9]/i;
const lensButton = async (name: string) => {
  const sel = `.mapmodes .mode[aria-label="${name}"]`;
  if (!(await centre(sel)) && (await centre(".bar-fold"))) await tap(".bar-fold", "the bar's ☰");
  await tap(sel, `the ${name} lens`);
  if (await k<boolean>("document.body.classList.contains('bar-open')"))
    await tap(".bar-fold", "the bar's ☰, to fold it");
};
/** Of the globe's spots, the share its lens painted near black (what the app painted, before light and sea lie over it). */
const paintedDark = () =>
  k<number>(
    `(() => { let d = 0, n = 0; for (let s = 0; ; s++) { const c = globalThis.causalis.lensColorAt(s); if (!c || c.length < 3) break; n++; if (Math.max(...c) < 48) d++; } return n ? d / n : -1; })()`,
  );
/** Of the pixels of the globe's middle, those dim (none of red, green or blue past 100 of 255): land and sea a lens leaves dark, under the
 * light and the thin sea over it. */
const darkShare = (data: string) =>
  page.evaluate(async (d) => {
    const bm = await createImageBitmap(await (await fetch(`data:image/png;base64,${d}`)).blob()),
      c = new OffscreenCanvas(bm.width, bm.height),
      x = c.getContext("2d")!;
    x.drawImage(bm, 0, 0);
    const w = bm.width,
      h = bm.height,
      px = x.getImageData(
        Math.round(w * 0.25),
        Math.round(h * 0.45),
        Math.round(w * 0.5),
        Math.round(h * 0.3),
      ).data;
    let dark = 0,
      n = 0;
    for (let i = 0; i < px.length; i += 16) {
      n++;
      if (Math.max(px[i]!, px[i + 1]!, px[i + 2]!) < 100) dark++;
    }
    return dark / n;
  }, data);

// 3, first: the same world before its first orbit, under the knowledge lens: much of it dark.
let youngDark = 0,
  youngPainted = 0,
  // (A spot of the young world's dark, faced in both shots: its home, where the camera starts, is what it knows best.)
  farSpot = -1;
if (young) {
  await loadSave(young, "alien:gate109-young");
  await lensButton("Knowledge");
  await until("its unknown lands painted dark", async () => (await paintedDark()) > 0.2);
  farSpot = await k<number>(
    `(() => { const d = []; for (let s = 0; ; s++) { const c = globalThis.causalis.lensColorAt(s); if (!c || c.length < 3) break; if (Math.max(...c) < 48) d.push(s); } return d.length ? d[d.length >> 1] : -1; })()`,
  );
  if (farSpot >= 0) await k(`globalThis.causalis.faceSpot(${farSpot})`);
  await settle(2500);
  const k0 = await ask<{ share: number; unknown: number[] }>("known.lands");
  youngDark = await darkShare(await shot("1-young-knowledge"));
  youngPainted = await paintedDark();
  const said = await k<string>(`document.querySelector(".mapmodes")?.innerText ?? ""`);
  say(
    `before orbit: ${Math.round(k0.share * 100)}% known, ${k0.unknown.length} lands dark; ${Math.round(youngDark * 100)}% of the globe's middle dark, ${Math.round(youngPainted * 100)}% of its spots painted dark; the lens says “${said.replace(/\n+/g, " | ").slice(0, 160)}”`,
  );
  check(k0.share < 1 && k0.unknown.length > 0, "before its first orbit its people knew all of it");
  check(/% of its world known/.test(said), "the knowledge lens does not say how much is known");
}

await loadSave(late, "alien:gate109");
const before = JSON.stringify(await ask<unknown>("hashes"));
const stage = await ask<{
  id: string;
  name: string;
  stages: { id: string; year: number | null }[];
}>("world.stage");
say(
  `the world's age: ${stage.name}; Information first in ${stage.stages.find((s) => s.id === "information")?.year}`,
);
check(
  stage.stages.some((s) => s.id === "information" && s.year !== null),
  "the world never came to its information age",
);

// 1. Its pages: what can be done here, from the world's page by touch.
await k(`globalThis.causalis.open("world:means")`);
await until("the world's page", async () => (await pageOpen()) === "world:means");
await settle(400);
await tap(`.page-window .entry a[href="#world:can"]`, "what can be done here, on the world's page");
await until("what can be done", async () => (await pageOpen()) === "world:can");
await settle(600);
await shot("2-can");
let text = await pageText();
check(!BAD.test(text), `a broken word on what can be done: ${text.match(BAD)?.[0]}`);
for (const w of [
  /talking at a distance/i,
  /a word down a wire/i,
  /the telephone/i,
  /words on waves through the air|words sent by sound through the deep/i,
  /machines joined in a web/i,
  /machines in the pocket/i,
  /of its world known\s*100%/i,
])
  check(w.test(text), `what can be done here does not show ${w}`);
say(
  `what can be done: ${(text.match(/Talking at a distance[^\n]*\n[^\n]*/i)?.[0] ?? "").replace(/\n/g, " | ")}`,
);
// (The rest: its reckoning and its seeing.)
await tap(`.page-window .tabs .tab:nth-child(2)`, "the rest's tab");
await settle(400);
text = await pageText();
check(/switches of pure crystal/i.test(text), "the rest does not show switches of pure crystal");
check(/seeing its world whole/i.test(text), "the rest does not show seeing its world whole");

// A land's economy: its word and what being on the line does.
type Town = { ref: string; name: string; cell: number; people: number };
const towns = await ask<Town[]>("towns.map");
const lore = loreOf(world);
const wired = towns.find((t) => lore.get(t.cell, "pocket-machines"));
check(!!wired, "no town of a land on the web");
if (wired) {
  await k(`globalThis.causalis.open("cell:0:${wired.cell}")`);
  await until("the land's page", async () => (await pageOpen())?.startsWith("cell:") ?? false);
  await settle(400);
  const economy = await centre(`.page-window .tabs .tab[data-tab="economy"]`);
  if (economy) await tap(`.page-window .tabs .tab[data-tab="economy"]`, "the land's economy");
  else {
    // (Tabs named, not keyed: the one that says it.)
    const i = await k<number>(
      `[...document.querySelectorAll(".page-window .tabs .tab")].findIndex((e) => /economy/i.test(e.textContent ?? ""))`,
    );
    check(i >= 0, "the land's page has no economy");
    if (i >= 0) await tap(`.page-window .tabs .tab:nth-child(${i + 1})`, "the land's economy");
  }
  await settle(500);
  await shot("3-land-economy");
  text = await pageText();
  check(!BAD.test(text), `a broken word on the land's economy: ${text.match(BAD)?.[0]}`);
  for (const w of [/a word goes/i, /on the line/i, /information work/i, /its markets/i])
    check(w.test(text), `the land's economy does not show ${w}`);
  say(`the land: ${(text.match(/Signals[\s\S]{0,300}/i)?.[0] ?? "").replace(/\n+/g, " | ")}`);
}
// A step's page: what it does and what it changes.
await k(`globalThis.causalis.open("prin:networks")`);
await until("the web's page", async () => (await pageOpen()) === "prin:networks");
await settle(400);
text = await pageText();
check(
  /what it does/i.test(text) && /what it changes/i.test(text),
  "a signal step's page does not say what it does and changes",
);
check(
  /switch in a pure crystal|band gap/i.test(text) || /needs first/i.test(text),
  "the web's page says nothing of what it needs",
);
await k("globalThis.causalis.closePage?.()");
await settle(400);

// 2. Drawn: the greatest town of a land on the web, its poles, wire and mast; at night, screens in its windows.
if (wired) {
  await k(`globalThis.causalis.goTo(${JSON.stringify(wired.ref)})`);
  await until(
    `${wired.name}'s wire`,
    async () =>
      ((await k<{ poles: number } | null>("globalThis.causalis.townSignals?.() ?? null"))?.poles ??
        0) > 0,
    slow(120000),
  );
  const sig = await k<{
    poles: number;
    wires: number;
    mast: boolean;
    screens: number;
    phones: number;
  } | null>("globalThis.causalis.townSignals?.() ?? null");
  say(`${wired.name}: ${JSON.stringify(sig)}`);
  check(
    !!sig && sig.poles > 0 && sig.wires > 0,
    "no poles and wire drawn in a town of a land on the wire",
  );
  check(!!sig?.mast, "no mast over the square of a town of a land with words on the air");
  check((sig?.screens ?? 0) > 0, "no screens in the windows of a town on the web");
  check((sig?.phones ?? 0) > 0, "no one about a town of machines in the pocket holds one");
  const t = await k<number>("globalThis.causalis.client.status?.t ?? 0"),
    day = Math.floor(t / 86400) + 1;
  await k(`globalThis.causalis.client.advance(${(day * 86400 + 22 * 3600) | 0})`);
  await settle(2500);
  const night = await shot("4-town-night");
  const lit = await page.evaluate(async (d) => {
    const bm = await createImageBitmap(await (await fetch(`data:image/png;base64,${d}`)).blob()),
      c = new OffscreenCanvas(bm.width, bm.height),
      x = c.getContext("2d")!;
    x.drawImage(bm, 0, 0);
    const px = x.getImageData(0, 0, bm.width, bm.height).data;
    let cool = 0,
      warm = 0;
    for (let i = 0; i < px.length; i += 4) {
      const r = px[i]!,
        g = px[i + 1]!,
        b = px[i + 2]!;
      if (b > 150 && b >= r + 20 && g > 120) cool++;
      else if (r > 170 && r > b + 60) warm++;
    }
    return { cool, warm };
  }, night);
  say(`at night in ${wired.name}: ${lit.cool} cold-lit pixels, ${lit.warm} warm-lit`);
  check(lit.cool > 40, `no screen's light seen in ${wired.name}'s windows at night (${lit.cool})`);
}

// 3. The map fully known after orbit: reload, the knowledge lens, no land dark.
await loadSave(late, "alien:gate109");
await lensButton("Knowledge");
if (farSpot >= 0) await k(`globalThis.causalis.faceSpot(${farSpot})`);
await settle(2500);
const k1 = await ask<{ share: number; unknown: number[] }>("known.lands");
const lateDark = await darkShare(await shot("5-late-knowledge")),
  latePainted = await paintedDark();
const said = await k<string>(`document.querySelector(".mapmodes")?.innerText ?? ""`);
say(
  `after orbit: ${Math.round(k1.share * 100)}% known, ${k1.unknown.length} lands dark; ${Math.round(lateDark * 100)}% of the globe's middle dark, ${Math.round(latePainted * 100)}% of its spots painted dark (before: ${Math.round(youngDark * 100)}%)`,
);
check(k1.share === 1 && k1.unknown.length === 0, "after orbit some of its world is still unknown");
check(
  /all of its world known/i.test(said),
  "the knowledge lens does not say all of its world is known",
);
if (young) {
  check(
    youngDark > 0.1,
    `the unknown of its world not dark on the screen before orbit (${youngDark})`,
  );
  check(
    latePainted < youngPainted / 2,
    `no fewer spots painted dark after orbit (${latePainted} against ${youngPainted})`,
  );
}
if (young)
  check(
    lateDark < youngDark / 2,
    `the globe no less dark after orbit (${lateDark} against ${youngDark})`,
  );
check(JSON.stringify(await ask<unknown>("hashes")) !== "" && before.length > 0, "no hashes");
check(
  (await k<number>("document.documentElement.scrollWidth")) <= 431,
  "something wider than the screen",
);
check(!errors.length, `page errors: ${errors.slice(0, 3).join(" / ")}`);

await browser.close();
await server.close();
if (problems.length) {
  console.log("FAILED:");
  for (const p of problems) console.log(`  - ${p}`);
  process.exit(1);
}
console.log("gate 109 passes");
process.exit(0);
