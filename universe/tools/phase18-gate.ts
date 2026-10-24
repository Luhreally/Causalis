// node tools/phase18-gate.ts [--ci] [--soft] [--shots dir] — the Phase 18 gate (the sky alive,
// asked for 2026-10-23: "worlds lifeless, microbial, complex ... i should see them landing on
// planets tryna socialize and like the different reactions and wars and exchanges"), done in
// a real browser on the built app:
//   1. life elsewhere: another star's world with bodies, its life told, its bodies drawn and
//      a drop of its seas under the glass; its star's page telling each world's life;
//   2. the peoples among the stars: a world whose neighbours came to the stars long ago —
//      the stars they hold and how they met, drawn in the cluster and listed beside it; a
//      people's own page; and on the home world the omen of their landing, named over its
//      land on the globe, their ship over the town and themselves among its people;
//   3. their own system: their world ringed in their colour, their craft about it, named;
// (npm run build first; --soft draws in software, as CI's browser does; --shots keeps a
// picture of each step.)
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
console.log("the Phase 18 gate");
if (shots) mkdirSync(shots, { recursive: true });

type Model = {
  kind: string;
  tabs: {
    id: string;
    blocks: { type: string; lines?: { ref: string; fate: string; name: string }[] }[];
  }[];
};

const root = fileURLToPath(new URL("..", import.meta.url)),
  server = await preview({ root, logLevel: "silent", preview: { port: 4273, strictPort: false } }),
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
let page = await browser.newPage({ viewport: { width: 1366, height: 800 } });
watch(page);
const k = <T>(code: string): Promise<T> => page.evaluate(code) as Promise<T>;
const q = <T>(type: string, args: unknown = {}): Promise<T> =>
  k<T>(
    `globalThis.causalis.client.query({ type: ${JSON.stringify(type)}, args: ${JSON.stringify(args)} })`,
  );
const until = async (what: string, ok: () => Promise<boolean>, ms = 60000) => {
  const end = Date.now() + ms;
  while (Date.now() < end) {
    if (await ok()) return true;
    await page.waitForTimeout(250);
  }
  problems.push(`${what} did not come`);
  return false;
};
const text = (sel: string) => page.$eval(sel, (e) => e.textContent ?? "").catch(() => "");
const window_ = () => text(".page-window");
const count = (sel: string) => page.$$eval(sel, (x) => x.length);
const open = async (ref: string, what: string, has: string) => {
  await k(`globalThis.causalis.open(${JSON.stringify(ref)})`);
  return until(what, async () => (await window_()).includes(has), slow(15000));
};
/** The middle of what a selector names on the screen, or null if it is not shown. */
const centre = (sel: string) =>
  k<{ x: number; y: number } | null>(
    `(() => { const e = document.querySelector(${JSON.stringify(sel)}); if (!e) return null; e.scrollIntoView({ block: "center" }); const r = e.getBoundingClientRect(); return r.width ? { x: r.left + r.width / 2, y: r.top + r.height / 2 } : null; })()`,
  );
const press = async (sel: string) => {
  const at = await centre(sel);
  if (!at) {
    problems.push(`${sel} was not there to press`);
    return false;
  }
  await page.mouse.click(at.x, at.y);
  return true;
};
/** How many of the canvases a selector names have something drawn on them. */
const drawn = (sel: string) =>
  page.$$eval(
    sel,
    (canvases) =>
      canvases.filter((c) => {
        const x = (c as HTMLCanvasElement).getContext("2d");
        if (!x || !(c as HTMLCanvasElement).width) return false;
        const d = x.getImageData(
          0,
          0,
          (c as HTMLCanvasElement).width,
          (c as HTMLCanvasElement).height,
        ).data;
        for (let i = 3; i < d.length; i += 16) if (d[i]! > 0) return true;
        return false;
      }).length,
  );
const shot = async (name: string) => {
  if (shots) await page.screenshot({ path: join(shots, `${name}.png`) });
};
/** Whether the page window's body is as wide as its contents (nothing runs off to the side). */
const fits = () =>
  k<boolean>(
    `(() => { const b = document.querySelector(".page-window .phylo"); return !!b && b.scrollWidth <= b.clientWidth + 1; })()`,
  );

await page.goto(`${base}?universe=earth&year=40`);
await page.waitForFunction(
  () => ((globalThis as any).causalis?.drawn?.() as number) > 0,
  undefined,
  { timeout: 900000 },
);
await k("globalThis.causalis.client.setSpeed(0)");
await page.waitForTimeout(1500);

// 1. Life elsewhere: a world of another star with bodies, its life told and drawn.
{
  const cluster = await q<{ stars: { ref: string; planets: number }[] }>("galaxy.cluster");
  let found: string | null = null;
  for (const s of cluster.stars.slice(0, 400)) {
    for (let i = 0; i < s.planets && !found; i++) {
      const m = await q<Model>("page", { ref: `${s.ref}/${i}` });
      if (m.tabs.some((t) => t.id === "life" && t.blocks.some((b) => b.type === "lineup")))
        found = `${s.ref}/${i}`;
    }
    if (found) break;
  }
  if (!found) problems.push("no world of another star with bodies near home");
  else {
    const opened = await open(`${found}#life`, "a living world's life", "as its own life grew it");
    await k(
      `document.querySelector(".page-window .drop-glass")?.scrollIntoView({ block: "center" })`,
    );
    await page.waitForTimeout(slow(2500));
    const bodies = await drawn(".page-window .lineup-body"),
      glass = await drawn(".page-window .drop-glass"),
      kinds = await count(".page-window .drop-kind"),
      still = await count(".page-window .lineup-card.still");
    await shot("1-life-elsewhere");
    const star = found.slice(0, found.lastIndexOf("/")),
      told = await open(star, "its star's page", "Its worlds, outward"),
      words = await window_();
    say(
      `life elsewhere: ${found} — ${bodies} bodies drawn (${still} with no page), its drop ${glass ? "drawn" : "not drawn"} with ${kinds} kinds; its star tells ${/lifeless|single cells|bodies|chemistry/.test(words) ? "each world's life" : "nothing of life"}`,
    );
    check(opened && bodies >= 3 && still === bodies, "another world's bodies are not drawn");
    check(glass === 1 && kinds >= 2, "another world's drop is not drawn");
    check(told && /bodies/.test(words), "a star's page does not tell its worlds' life");
  }
}

// 2. The peoples among the stars (M133–M135), on a world whose neighbours are old at the stars:
// one came down by its greatest seat in the year 126, and looked, and went.
{
  await page.goto(`${base}?universe=alien&seed=tide&year=127`);
  await page.waitForFunction(
    () => ((globalThis as any).causalis?.drawn?.() as number) > 0,
    undefined,
    { timeout: 900000 },
  );
  await k("globalThis.causalis.client.setSpeed(0)");
  await page.waitForTimeout(1500);
  type Peoples = {
    civs: { ref: string; name: string; star: string; holds: unknown[] }[];
    meetings: { civ: string; event: string }[];
    landings: { civ: string; cell: number; year: number; omen: boolean }[];
  };
  const sky = await q<{ peoples?: Peoples }>("space.state"),
    p = sky.peoples,
    held = p?.civs.filter((c) => c.holds.length > 1).length ?? 0,
    landing = p?.landings.at(-1);
  say(
    `the peoples: ${p?.civs.length ?? 0}, ${held} holding stars, ${p?.meetings.length ?? 0} met, ${p?.landings.length ?? 0} landed`,
  );
  check(held >= 2, "no peoples hold stars about their own");
  check(!!landing && landing.omen, "no people came down on the home world, as an omen");
  // On the globe: their name over the land they came down in.
  await until(
    "the visitors named on the globe",
    async () => (await k<number>("globalThis.causalis.visits?.() ?? 0")) > 0,
    slow(20000),
  );
  // The stars about us: their holds ringed, their reach and lines of contact drawn, and how
  // they met where they met.
  await k("globalThis.causalis.stars()");
  await until(
    "the stars about us",
    async () => (await k<number>("globalThis.causalis.starCount()")) > 0,
    slow(60000),
  );
  await page.waitForTimeout(slow(4000));
  const icons = await page.$$eval(
      ".label",
      (ls) => ls.filter((l) => /✨|😨|🤝|⚔/u.test(l.textContent ?? "")).length,
    ),
    listed = await count(".people-line");
  await shot("2-peoples-among-the-stars");
  say(`among the stars: ${listed} peoples listed, ${icons} meetings shown`);
  check(listed >= 2, "the peoples are not listed beside the stars");
  check(icons >= 1, "how peoples met is not shown where they met");
  // A people's own page: its nature, its stars, whom it met.
  if (landing) {
    const civ = p!.civs.find((c) => c.ref === landing.civ)!,
      opened = await open(civ.ref, "a people's page", "Their nature"),
      met = await open(`${civ.ref}#met`, "whom they met", "Whom they met");
    await shot("2-their-page");
    say(
      `their page: ${civ.name} — ${opened && met ? "their nature, stars and meetings" : "not whole"}`,
    );
    check(opened && met, "a people's page does not tell its nature and meetings");
    await k(`document.querySelector(".page-window .close")?.click()`);
    // Down into the town they came down by: their ship over it, themselves among its people.
    const towns = await q<{ ref: string; cell: number; people: number }[]>("towns.map"),
      town = towns.filter((t) => t.cell === landing.cell).sort((a, b) => b.people - a.people)[0];
    if (!town) problems.push("no town where they came down");
    else {
      // (As a page's “go to” takes one there, from the stars.)
      await k(`globalThis.causalis.goTo(${JSON.stringify(town.ref)})`);
      await until(
        "the visitors in the village",
        async () =>
          ((await k<{ groups: number } | null>("globalThis.causalis.visitors?.() ?? null"))
            ?.groups ?? 0) > 0,
        slow(60000),
      );
      await page.waitForTimeout(slow(2500));
      const shown = await k<{ groups: number; figures: number; whys: string[] } | null>(
          "globalThis.causalis.visitors?.() ?? null",
        ),
        named = await page.$$eval(
          ".label",
          (ls) => ls.filter((l) => (l.textContent ?? "").includes("🛸")).length,
        );
      await shot("2-their-ship-over-the-town");
      say(
        `in the town they came down by: ${shown?.groups ?? 0} ship (${shown?.whys.join(", ") ?? "none"}), ${shown?.figures ?? 0} of them among its people, ${named ? "named" : "not named"}`,
      );
      check(
        (shown?.groups ?? 0) >= 1 && (shown?.figures ?? 0) >= 1,
        "their ship and people are not drawn",
      );
      check(named >= 1, "their ship is not named over it");
      // A tap on their ship: the eye goes down among them, and their coming opens; they show
      // how they came, as the people show what they talk of (the land's talk is of them).
      const ship = (
        await k<{ x: number; y: number }[]>("globalThis.causalis.visitorsOnScreen?.() ?? []")
      )[0];
      if (ship) {
        const before = await k<number>("globalThis.causalis.rig.distance");
        await k(`globalThis.causalis.tapVillage(${ship.x}, ${ship.y + 26})`);
        await until(
          "their coming opened, the eye among them",
          async () =>
            (await page
              .$eval(".page-window .page-title", (e) => e.textContent ?? "")
              .catch(() => "")) !== "" && !(await k<boolean>("globalThis.causalis.rig.flying")),
          slow(20000),
        );
        await page.waitForTimeout(slow(3000));
        const near = await k<number>("globalThis.causalis.rig.distance"),
          opened = await page
            .$eval(".page-window .page-title", (e) => e.textContent ?? "")
            .catch(() => ""),
          signs = (
            await k<{ key: string; text: string }[]>("globalThis.causalis.bubblesNow()")
          ).filter((b) => b.key.startsWith("visitor:"));
        await k(`document.querySelector(".page-window .close")?.click()`);
        await page.waitForTimeout(slow(800));
        await shot("2-among-them");
        say(
          `a tap on their ship: “${opened}” opened, the eye from ${before.toFixed(0)} to ${near.toFixed(0)}, ${signs.length} of them showing how they came (${signs.map((b) => b.text).join("")})`,
        );
        check(!!opened && near < before, "a tap on their ship does not go down to them");
        check(signs.length >= 1, "the visitors do not show how they came");
      } else check(false, "their ship is not on the screen");
    }
  }
  // 3. Their own system (M136): their world ringed in their colour, their satellites and
  // stations about it, their ships plying, their name over it.
  if (landing) {
    const civ = p!.civs.find((c) => c.ref === landing.civ)!;
    await k("globalThis.causalis.stars()");
    await until(
      "the stars again",
      async () => (await k<number>("globalThis.causalis.starCount()")) > 0,
      slow(60000),
    );
    await k(`globalThis.causalis.starSystem(${JSON.stringify(civ.star)})`);
    type Shown = { worlds: number; craft: number; ships: number };
    await until(
      "their system",
      async () =>
        ((await k<Shown | null>("globalThis.causalis.systemPeople?.() ?? null"))?.worlds ?? 0) > 0,
      slow(30000),
    );
    await page.waitForTimeout(slow(2500));
    const shown = (await k<Shown | null>("globalThis.causalis.systemPeople?.() ?? null"))!,
      named = await page.$$eval(
        ".label",
        (ls) => ls.filter((l) => (l.textContent ?? "").includes("👽")).length,
      );
    await shot("3-their-system");
    say(
      `their own system: ${shown.worlds} world ringed, ${shown.craft} craft about it, ${shown.ships} ships about, ${named ? "named" : "not named"}`,
    );
    check(
      shown.worlds >= 1 && shown.craft >= 1 && named >= 1,
      "a people's own system does not show them",
    );
  }
}

await browser.close();
await server.close();
const real = errors.filter((e) => !/favicon|ERR_ABORTED/i.test(e));
if (real.length) problems.push(...real.slice(0, 5).map((e) => `the page logged: ${e}`));
console.log();
if (problems.length) {
  for (const p of problems) console.log(`  ✗ ${p}`);
  console.log("the Phase 18 gate fails");
  process.exit(1);
}
console.log("the Phase 18 gate passes");
