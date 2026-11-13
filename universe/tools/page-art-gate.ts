// node tools/page-art-gate.ts [--ci] [--soft] [--shots dir] [--before]: gate 115, a page's own art (asked 2026-11-13: "lowkey add more
// graphics and like icons and like stuff for the tabs ... make it generative and like derived from first principles ... but it shouldt
// make the game slower"). Three worlds run in node — Earth's first light, alien 20 (a carbon world under a white star) and alien 41 (a
// rocky world under a red dwarf) — each taken up in the app at 430 by 932, and on each:
//   1. the reading, node side: a land's, a town's, a realm's and a war's page each carry their art, of the right kind, and what reading
//      it costs; a far world's page its star; a far people's page the ground and light they rose under;
//   2. each page opened in the app with its art and without: its banner drawn and inked, its tabs' glyphs drawn and inked, the banner
//      within the page's width; the time its drawing took, first and opened again, against the same without art;
//   3. a land's banner not a town's, nor Earth's land's an alien's; a tab's glyph not the same in two worlds' colours;
//   4. hashes the same after all of it, and no page errors.
// With --before, against a build without art: only how long each page takes to open, to weigh against.
import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { gzipSync } from "node:zlib";
import { preview } from "vite";
import { chromium, type Page } from "playwright";
import { YEAR, rulesetId, saveWorld, seedFromText, type World } from "../src/kernel/index.ts";
import { ALIEN, EARTH, clusterOf } from "../src/host/planet.ts";
import { folksNear, politiesOf, populationContext, warsOf } from "../src/sim/index.ts";
import { pageOf } from "../src/host/inspect/index.ts";
import { homeLook, withArt, worksLook } from "../src/host/inspect/art.ts";
import type { Portrait } from "../src/bridge/index.ts";
import { keptLife } from "../src/rules/index.ts";

const argv = process.argv.slice(2),
  soft = argv.includes("--soft"),
  ci = argv.includes("--ci"),
  before = argv.includes("--before"),
  arg = (name: string) => {
    const at = argv.indexOf(name);
    return at >= 0 ? argv[at + 1] : undefined;
  },
  shots = arg("--shots");
if (shots) mkdirSync(shots, { recursive: true });
const slow = (ms: number) => (ci || soft ? ms * 4 : ms);
const GPU = ["--enable-gpu", "--ignore-gpu-blocklist", "--use-angle=d3d11"];
const problems: string[] = [],
  check = (ok: boolean, what: string) => {
    if (!ok) problems.push(what);
  },
  say = (s: string) => console.log(`  ${s}`);
console.log(`gate 115, a page's own art${before ? " (before: times only)" : ""}`);

type Case = {
  readonly name: string;
  readonly universe: "earth" | "alien";
  readonly seed: string;
  readonly year: number;
  readonly world: World;
  readonly refs: { readonly what: string; readonly ref: string; readonly banner: string }[];
};

/** A world run to its year, and the pages the gate opens on it: its greatest realm's seat's land and town, the realm, a war, a far world. */
function caseOf(name: string, universe: "earth" | "alien", seed: string, year: number): Case {
  const t0 = Date.now(),
    world = (universe === "earth" ? EARTH : ALIEN).build(seedFromText(seed));
  world.runTo(year * YEAR);
  const realm = politiesOf(world)
      .living()
      .sort((a, b) => b.members.length - a.members.length || (a.ref < b.ref ? -1 : 1))[0],
    ctx = populationContext(world),
    town = realm ? ctx.settlements.seenIn(realm.seat)[0] : undefined,
    war = [...warsOf(world).all()]
      .reverse()
      .find((w) => politiesOf(world).get(w.attacker) && politiesOf(world).get(w.defender)),
    far = clusterOf(world)
      .slice(0, 40)
      .map((s) => `${s.ref}/0`)
      .find((ref) => pageOf(world, ref).kind === "world"),
    // (A people of another world, as the stars about this one hold them: the first by ref whose page draws them.)
    folk = [...folksNear(world)]
      .sort((a, b) => (a.ref < b.ref ? -1 : 1))
      .find((f) => pageOf(world, f.ref).art?.banner?.kind === "people");
  const refs = [
    realm && { what: "land", ref: `cell:0:${realm.seat}`, banner: "land" },
    town && { what: "town", ref: town.ref, banner: "town" },
    realm && { what: "realm", ref: realm.ref, banner: "realm" },
    war && { what: "war", ref: war.ref, banner: "war" },
    far && { what: "far world", ref: far, banner: "world" },
    folk && { what: "far people", ref: folk.ref, banner: "people" },
  ].filter((x): x is { what: string; ref: string; banner: string } => !!x);
  say(
    `${name}: run to ${year} in ${Math.round((Date.now() - t0) / 1000)} s; ${refs.map((r) => `${r.what} ${r.ref}`).join(", ")}`,
  );
  check(refs.length >= 4, `${name}: only ${refs.length} pages to open`);
  check(!!folk, `${name}: no far people's page to open`);
  return { name, universe, seed, year, world, refs };
}

const cases = [
  caseOf("Earth", "earth", "first light", 600),
  // (Both as they were made, life kept: of its own chemistry a carbon world quickens no people now, and the old tables'
  // peoples are the ones these pages were drawn for. The case's name stays the seed's.)
  caseOf("alien 20", "alien", keptLife("alien 20"), 200),
  caseOf("alien 41", "alien", keptLife("alien 41"), 150),
];

// How each land builds and its works (asked 2026-11-13: "will i see the photo of like their architectural varying styles across seeds?"):
// every peopled land of the three worlds, its home and works as pictures, told apart by what they are drawn of.
const styles = new Map<string, Portrait>(),
  works = new Map<string, Portrait>();
for (const c of cases)
  for (const p of populationContext(c.world).provinces.all()) {
    if (!p.total()) continue;
    const h = homeLook(c.world, p.cell),
      w = worksLook(c.world, p.cell);
    if (h?.kind === "house") {
      // (A style is its walls, roof, plan and storeys: its roof's pitch follows each land's rain.)
      const { design, pitch, ...house } = h.house;
      void design;
      void pitch;
      const key = JSON.stringify([house, h.storeys, h.lifeLook ?? ""]);
      if (!styles.has(key)) styles.set(key, h);
    }
    if (w?.kind === "works") {
      const key = JSON.stringify([w.hall, w.material, w.drive]);
      if (!works.has(key)) works.set(key, w);
    }
  }
say(
  `${styles.size} ways of building over the three worlds' lands (${[...styles.values()].map((h) => (h.kind === "house" ? `${h.house.walls}/${h.house.roof}/${h.house.form}×${h.storeys}` : "")).join(", ")}); ${works.size} kinds of works (${[...works.values()].map((w) => (w.kind === "works" ? `${w.hall} of ${w.material}, ${w.drive}` : "")).join("; ")})`,
);
check(styles.size >= 6, `only ${styles.size} ways of building over three worlds`);
check(works.size >= 2, `only ${works.size} kinds of works over three worlds`);

// 1. The reading, node side.
if (!before)
  for (const c of cases)
    for (const r of c.refs) {
      const page = pageOf(c.world, r.ref);
      check(!!page.art, `${c.name} ${r.what}: no art`);
      check(
        page.art?.banner?.kind === r.banner,
        `${c.name} ${r.what}: its banner is ${page.art?.banner?.kind ?? "none"}, not ${r.banner}`,
      );
      // (What the art alone costs to read, the page read without it.)
      const bare = { ...page, art: undefined },
        t = performance.now();
      for (let i = 0; i < 5; i++) withArt(c.world, bare);
      const ms = (performance.now() - t) / 5;
      say(
        `${c.name} ${r.what}: art read in ${ms.toFixed(2)} ms, ${JSON.stringify(page.art).length} chars`,
      );
      check(ms < slow(25), `${c.name} ${r.what}: its art takes ${ms.toFixed(1)} ms to read`);
    }

const root = fileURLToPath(new URL("..", import.meta.url)),
  server = await preview({ root, logLevel: "silent", preview: { port: 4331, strictPort: false } }),
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
const ask = <T>(type: string, args: unknown = {}) =>
  k<T>(
    `globalThis.causalis.client.query({ type: ${JSON.stringify(type)}, args: ${JSON.stringify(args)} })`,
  );

async function load(c: Case) {
  const name = `${c.universe}:gate115`,
    q = `universe=${c.universe}&seed=${encodeURIComponent(c.seed)}`,
    bytes = gzipSync(
      JSON.stringify(
        saveWorld(c.world, rulesetId(c.world, (c.universe === "earth" ? EARTH : ALIEN).version), {
          universe: c.universe,
        }),
      ),
    );
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
      const b = Uint8Array.from(atob(data as string), (ch) => ch.charCodeAt(0));
      const client = (
        globalThis as unknown as {
          causalis: {
            client: {
              importSave(b: Uint8Array): Promise<unknown>;
              save(n: string): Promise<unknown>;
            };
          };
        }
      ).causalis.client;
      await client.importSave(b);
      await client.save(keep as string);
    },
    [bytes.toString("base64"), name],
  );
  await page.goto(`${base}?${q}&load=${encodeURIComponent(name)}&hold=1`);
  await page.waitForFunction(
    () => ((globalThis as { causalis?: { drawn?: () => number } }).causalis?.drawn?.() ?? 0) > 0,
    undefined,
    { timeout: slow(180000) },
  );
  await page.waitForTimeout(slow(600));
}

/** Open a page and answer how long it took, end to end (its read and its drawing), and its drawing alone where the build tells it. */
const open = (ref: string) =>
  k<{ ms: number; draw: number }>(`(async () => {
    const t = performance.now();
    await globalThis.causalis.open(${JSON.stringify(ref)});
    return { ms: performance.now() - t, draw: globalThis.causalis.pageArt ? globalThis.causalis.pageArt() : -1 };
  })()`);
const setArt = (on: boolean) => k(`globalThis.causalis.pageArt?.(${on})`);

/** The banner and the tabs' glyphs as drawn: inked pixels and a sum to tell them apart; the banner's box against the page's. */
const artSeen = () =>
  k<{
    banner: { kind: string; edges: number; sum: number; w: number; inside: boolean } | null;
    glyphs: { glyph: string; inked: number; sum: number }[];
    sections: number;
  }>(`(() => {
    const read = (c) => {
      const d = c.getContext("2d").getImageData(0, 0, c.width, c.height).data;
      let inked = 0, sum = 0;
      for (let i = 0; i < d.length; i += 4) if (d[i + 3] > 40) { inked++; sum = (sum * 31 + d[i] * 7 + d[i + 1] * 3 + d[i + 2] + i) % 1000000007; }
      return { inked, sum };
    };
    // (A banner fills its box: what tells it drawn is how much changes across it, pixel to pixel.)
    const edges = (c) => {
      const d = c.getContext("2d").getImageData(0, 0, c.width, c.height).data, W = c.width;
      let n = 0, sum = 0;
      const lum = (i) => d[i] * 0.3 + d[i + 1] * 0.59 + d[i + 2] * 0.11;
      for (let i = 0; i < d.length - 4; i += 4) {
        if ((i / 4) % W !== W - 1 && Math.abs(lum(i) - lum(i + 4)) > 18) n++;
        sum = (sum * 31 + d[i] * 7 + d[i + 1] * 3 + d[i + 2] + i) % 1000000007;
      }
      return { edges: n, sum };
    };
    const win = document.querySelector(".page-window"), b = win?.querySelector(".page-banner");
    const box = b?.closest(".page-banner-box");
    let banner = null;
    if (b && box && !box.hidden) {
      const r = b.getBoundingClientRect(), w = win.getBoundingClientRect();
      banner = { kind: b.dataset.banner, ...edges(b), w: r.width, inside: r.left >= w.left - 0.5 && r.right <= w.right + 0.5 };
    }
    const glyphs = [...(win?.querySelectorAll(".tabs .art-glyph") ?? [])].map((c) => ({ glyph: c.dataset.glyph ?? "", ...read(c) }));
    return { banner, glyphs, sections: win?.querySelectorAll(".page-body h3 .art-glyph").length ?? 0 };
  })()`);

const median = (v: number[]) => {
  const s = [...v].sort((a, b) => a - b);
  return s.length ? s[Math.floor(s.length / 2)]! : 0;
};
const seen = new Map<string, { banner: number; glyph: Map<string, number> }>(),
  banners: number[] = [],
  factRows: { label: string }[] = [],
  added: number[] = [],
  again: number[] = [],
  wall: { cold: number[]; coldBare: number[]; first: number[]; reopen: number[] } = {
    cold: [],
    coldBare: [],
    first: [],
    reopen: [],
  };

for (const c of cases) {
  await load(c);
  const hashes = JSON.stringify(await ask<unknown>("hashes"));
  // (A page opened once first, so that what every page loads once is not weighed against the first page.)
  await open("world:matter");
  // Each page opened cold, as a player first opens it: without its art, then, the app loaded afresh, with it (where the build has it).
  for (const on of before ? [true] : [false, true]) {
    if (!on) await setArt(false);
    else if (!before) {
      await page.reload();
      await page.waitForFunction(
        () =>
          ((globalThis as { causalis?: { drawn?: () => number } }).causalis?.drawn?.() ?? 0) > 0,
        undefined,
        { timeout: slow(180000) },
      );
      await page.waitForTimeout(slow(600));
      // (Read as the first load was before its pass, so neither pass meets a colder world.)
      await ask<unknown>("hashes");
      await open("world:matter");
    }
    for (const r of c.refs) {
      const cold = await open(r.ref);
      (on ? wall.cold : wall.coldBare).push(cold.ms);
      say(
        `${c.name} ${r.what}: opens cold in ${cold.ms.toFixed(1)} ms${on ? "" : " without its art"}`,
      );
      await open("world:matter");
    }
  }
  await k("globalThis.causalis.pageArt?.(true, true)");
  for (const r of c.refs) {
    if (before) {
      const first = await open(r.ref);
      await open("world:matter");
      const reopen = await open(r.ref);
      wall.first.push(first.ms);
      wall.reopen.push(reopen.ms);
      say(
        `${c.name} ${r.what}: opens in ${first.ms.toFixed(1)} ms, again ${reopen.ms.toFixed(1)} ms`,
      );
      continue;
    }
    // Without its art (once to warm what any page's first drawing loads, once to weigh), then with it: first, and again.
    await setArt(false);
    await open(r.ref);
    await open("world:matter");
    const bare = await open(r.ref);
    await open("world:matter");
    await setArt(true);
    const first = await open(r.ref);
    // (Its banner is drawn in the frame after its page: waited for, and weighed.)
    await page
      .waitForFunction(
        () =>
          document.querySelector(".page-window .page-banner")?.getAttribute("data-drawn") === "1",
        undefined,
        { timeout: slow(5000) },
      )
      .catch(() => problems.push(`${c.name} ${r.what}: its banner never drawn`));
    const bannerMs = await k<number>("globalThis.causalis.bannerMs?.() ?? -1");
    banners.push(bannerMs);
    const art = await artSeen();
    if (shots)
      await page.locator(".page-window").screenshot({
        path: join(shots, `${c.name.replace(/ /g, "-")}-${r.what.replace(/ /g, "-")}.png`),
      });
    await open("world:matter");
    const reopen = await open(r.ref);
    const bareAgain = bare;
    wall.first.push(first.ms);
    wall.reopen.push(reopen.ms);
    added.push(first.draw - bare.draw);
    again.push(reopen.draw - bareAgain.draw);
    say(
      `${c.name} ${r.what}: drawn in ${bare.draw.toFixed(1)} ms bare, ${first.draw.toFixed(1)} ms with its art, ${reopen.draw.toFixed(1)} ms again; its banner ${bannerMs.toFixed(1)} ms the frame after; opens in ${first.ms.toFixed(1)} ms, again ${reopen.ms.toFixed(1)} ms; banner ${art.banner ? `${art.banner.kind}, ${art.banner.edges} edges, ${Math.round(art.banner.w)} wide` : "none"}; ${art.glyphs.length} tab glyphs (${art.glyphs.map((g) => g.glyph).join(" ")}), ${art.sections} section glyphs`,
    );
    check(!!art.banner, `${c.name} ${r.what}: no banner`);
    if (art.banner) {
      check(art.banner.kind === r.banner, `${c.name} ${r.what}: a ${art.banner.kind} banner`);
      // (Drawn, not blank: a bare wash has next to no edges. A far world's star and limb over the dark, or a land's sky over
      // a still sea, are smooth by what they are and read some 1.3 to 2 an edge a pixel across, as looked at 2026-11-13.)
      check(
        art.banner.edges > art.banner.w,
        `${c.name} ${r.what}: its banner only ${art.banner.edges} edges across ${Math.round(art.banner.w)} px`,
      );
      check(art.banner.inside, `${c.name} ${r.what}: its banner runs past the page`);
    }
    check(art.glyphs.length > 0, `${c.name} ${r.what}: no tab glyphs`);
    for (const g of art.glyphs)
      check(g.inked > 20, `${c.name} ${r.what}: the ${g.glyph} glyph only ${g.inked} px inked`);
    check(
      first.draw - bare.draw < slow(10),
      `${c.name} ${r.what}: its art adds ${(first.draw - bare.draw).toFixed(1)} ms to its drawing`,
    );
    seen.set(`${c.name}|${r.what}`, {
      banner: art.banner?.sum ?? 0,
      glyph: new Map(art.glyphs.map((g) => [g.glyph, g.sum])),
    });
  }
  // Its land's homes and works on its economy's rows: each drawn once on screen, a thumb's size to press.
  const land = c.refs.find((r) => r.what === "land");
  if (land && !before) {
    await open(`${land.ref}#economy`);
    const facts = await k<{ drawn: boolean; w: number; h: number; label: string }[]>(`(async () => {
      const out = [];
      for (const c of document.querySelectorAll(".page-window .fact-thumb")) {
        c.scrollIntoView({ block: "center" });
        await new Promise((r) => setTimeout(r, ${slow(300)}));
        const r = c.getBoundingClientRect();
        out.push({ drawn: c.dataset.drawn === "1", w: r.width, h: r.height, label: c.closest(".fact")?.querySelector(".fact-label")?.textContent ?? "" });
      }
      return out;
    })()`);
    say(
      `${c.name} land's economy: ${facts.map((f) => `${f.label} ${f.drawn ? "drawn" : "NOT drawn"} ${Math.round(f.w)}×${Math.round(f.h)}`).join(", ") || "no pictured rows"}`,
    );
    factRows.push(...facts);
    for (const f of facts) {
      check(f.drawn, `${c.name}: ${f.label}'s picture never drawn`);
      check(
        f.w >= 44 && f.h >= 44,
        `${c.name}: ${f.label}'s picture is ${Math.round(f.w)} by ${Math.round(f.h)} px to press`,
      );
    }
    if (shots && facts.length)
      await page
        .locator(".page-window .fact-thumb")
        .first()
        .evaluate((e) => e.closest(".block")?.scrollIntoView({ block: "center" }))
        .then(() =>
          page
            .locator(".page-window")
            .screenshot({ path: join(shots, `${c.name.replace(/ /g, "-")}-works.png`) }),
        );
  }
  await k("globalThis.causalis.closePage?.()");
  const after = JSON.stringify(await ask<unknown>("hashes"));
  check(hashes === after, `${c.name}: reading moved history`);
  say(`${c.name}: hashes ${hashes === after ? "the same" : "MOVED"}`);
}

if (!before) {
  // Each way of building and each works drawn, inked, and none the same picture as another.
  const drawn: { inked: number; sum: number }[] = [];
  for (const p of [...styles.values(), ...works.values()].slice(0, 40))
    drawn.push(
      await k<{ inked: number; sum: number }>(
        `globalThis.causalis.picture(${JSON.stringify(p)}, 64)`,
      ),
    );
  const sums = new Set(drawn.map((d) => d.sum)),
    pictured = [...styles.values(), ...works.values()].slice(0, 40),
    faint = drawn.reduce((m, d, i) => (d.inked < drawn[m]!.inked ? i : m), 0);
  say(
    `${drawn.length} homes and works drawn at 64 px: ${Math.min(...drawn.map((d) => d.inked))} px inked the least, ${sums.size} different pictures`,
  );
  // (Which is faintest, so a picture barely inked can be looked at.)
  say(`  the faintest: ${JSON.stringify(pictured[faint]).slice(0, 400)}`);
  // (Drawn, not blank or broken: a house of one storey, long or about a court, is low and wide and covers some 6% of its
  // square at 64 px, looked at 2026-11-13; a burrow or a warren stands 0.4 as high as a house in the town it is drawn of,
  // so its picture is as much lower.)
  const low = (p: Portrait | undefined) =>
    p?.kind === "house" && (p.house.form === "warren" || p.house.walls === "burrow");
  const thin = drawn.flatMap((d, i) =>
    d.inked > 64 * 64 * 2 * 0.1 * (low(pictured[i]) ? 0.4 : 1)
      ? []
      : [`${d.inked} px: ${JSON.stringify(pictured[i]).slice(0, 300)}`],
  );
  check(!thin.length, `a home or works picture barely inked: ${thin.join(" | ")}`);
  check(sums.size === drawn.length, "two ways of building drawn the same");
  check(
    factRows.some((f) => /build/i.test(f.label)),
    "no land's page draws how it builds",
  );
  // 3. Banners apart: a land's not a town's; Earth's land not an alien's; a glyph in two worlds' colours not the same.
  const s = (key: string) => seen.get(key);
  check(
    !!s("Earth|land") && s("Earth|land")!.banner !== s("Earth|town")?.banner,
    "Earth's land and town banners the same",
  );
  for (const alien of ["alien 20", "alien 41"]) {
    check(
      !!s(`${alien}|land`) && s(`${alien}|land`)!.banner !== s("Earth|land")?.banner,
      `${alien}'s land banner the same as Earth's`,
    );
    const ours = s("Earth|land")?.glyph,
      theirs = s(`${alien}|land`)?.glyph,
      both = ours && theirs ? [...ours.keys()].filter((g) => theirs.has(g)) : [];
    check(both.length > 0, `no tab glyph on both Earth's and ${alien}'s land`);
    check(
      both.some((g) => ours!.get(g) !== theirs!.get(g)),
      `${alien}'s tab glyphs drawn in Earth's colours`,
    );
  }
  say(
    `its art adds ${median(added).toFixed(2)} ms (median; most ${Math.max(...added).toFixed(1)} ms) to a page's first drawing, ${median(again).toFixed(2)} ms opened again`,
  );
  say(
    `a banner draws in ${median(banners).toFixed(2)} ms (median; the first in the session ${banners[0]?.toFixed(1)} ms, the most after it ${Math.max(...banners.slice(1)).toFixed(1)} ms), in the frame after its page`,
  );
  check(
    Math.max(...banners.slice(1)) < slow(10),
    `a banner took ${Math.max(...banners.slice(1)).toFixed(1)} ms to draw`,
  );
  // (Opened again its banner and glyphs are not drawn anew: what is left is placing its glyphs' canvases among the tabs.)
  check(
    median(again) < slow(3),
    `opened again, a page's art still adds ${median(again).toFixed(1)} ms`,
  );
}
say(
  `pages open cold in ${median(wall.cold).toFixed(1)} ms (median, most ${Math.max(...wall.cold).toFixed(1)} ms)${wall.coldBare.length ? `, ${median(wall.coldBare).toFixed(1)} ms without their art (most ${Math.max(...wall.coldBare).toFixed(1)} ms)` : ""}; in ${median(wall.first).toFixed(1)} ms, again in ${median(wall.reopen).toFixed(1)} ms`,
);

for (const e of errors) problems.push(`page error: ${e.slice(0, 400)}`);
await browser.close();
await server.close();
if (problems.length) {
  console.log(`gate 115: ${problems.length} problems`);
  for (const p of problems) console.log(`  x ${p}`);
  process.exit(1);
}
console.log("gate 115: passed");
process.exit(0);
