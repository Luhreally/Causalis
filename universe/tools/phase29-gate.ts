// node tools/phase29-gate.ts [--ci] [--soft] [--shots dir] — the Phase 29 gate (the bands on
// the land, M159; asked for 2026-10-24: "i should be able to be in my game and see the cell stage
// and every stage like spore i would just watch it emerge"), done in a real browser on the built
// app, the Earth seed begun at its first people as the genesis begins it:
//   1. the eye goes down on the land most peopled, near its greatest camp: its bands camped about
//      it, tents round their fires, their smoke going up, each camp named on the land;
//      a camp tapped opens its page, and from it the eye goes down among one of its bands (M160):
//      the land's own beasts about them, their hour the world's, their day going on as it runs;
//      each of them named, and one tapped kept in the eye, the bar telling what they are at (M161);
//   2. as the seasons turn they move camp about their ranges;
//   3. the years on, they come to farm and the first village is founded: the eye goes down to it;
//   4. on a phone: the land and its camps' names within the screen; and among a band, its bar.
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
console.log("the Phase 29 gate");
if (shots) mkdirSync(shots, { recursive: true });

type Camp = {
  cell: number;
  id: number;
  tile: number;
  x: number;
  z: number;
  people: number;
  herds: boolean;
};
type Land = { towns: number; camps: number; campParts: number };
type Near = {
  people: number;
  beasts: number;
  kinds: string[];
  hour: number;
  day: number;
  parts: number;
  names: string[];
  followed: string | null;
  onScreen: { id: number; at: { x: number; y: number } | null }[];
};

const root = fileURLToPath(new URL("..", import.meta.url)),
  server = await preview({ root, logLevel: "silent", preview: { port: 4281, strictPort: false } }),
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
const page = await browser.newPage({ viewport: { width: 1366, height: 800 } });
watch(page);
const k = <T>(code: string, p: Page = page): Promise<T> => p.evaluate(code) as Promise<T>;
const until = async (what: string, ok: () => Promise<boolean>, ms = 60000, p: Page = page) => {
  const end = Date.now() + ms;
  while (Date.now() < end) {
    if (await ok()) return true;
    await p.waitForTimeout(250);
  }
  problems.push(`${what} did not come`);
  return false;
};
const shot = async (name: string, p: Page = page) => {
  if (shots) await p.screenshot({ path: join(shots, `${name}.png`) });
};
const scale = (p: Page = page) => k<string>(`globalThis.causalis.scale()`, p);
const camps = (p: Page = page) => k<Camp[]>(`globalThis.causalis.camps?.() ?? []`, p);
const land = (p: Page = page) => k<Land>(`globalThis.causalis.land()`, p);
/** The camps' names on the land shown (not hidden under another's). */
const campNames = (p: Page = page) =>
  p.$$eval(".labels .label", (x) =>
    x
      .filter((e) => !(e as HTMLElement).hidden && /^(⛺|🐑)/.test(e.textContent ?? ""))
      .map((e) => {
        const r = e.getBoundingClientRect();
        return {
          text: e.textContent ?? "",
          left: r.left,
          right: r.right,
          x: (r.left + r.right) / 2,
          y: (r.top + r.bottom) / 2,
        };
      }),
  );
const begin = async (p: Page) => {
  await p.goto(`${base}?universe=earth&seed=${encodeURIComponent("first light")}&cradle=1`);
  await p.waitForFunction(
    () => ((globalThis as any).causalis?.drawn?.() as number) > 0,
    undefined,
    { timeout: 900000 },
  );
};

// 1. Down on the land most peopled, near its greatest camp.
await begin(page);
{
  await until("the eye down on the land", async () => (await scale()) === "region", slow(60000));
  await until("the camps drawn", async () => (await camps()).length >= 3, slow(30000));
  await until(
    "the eye near the greatest camp",
    async () =>
      (await k<boolean>(
        "!globalThis.causalis.rig.flying && globalThis.causalis.rig.distance < 60",
      )) === true,
    slow(20000),
  );
  // (Held, so the season stands while it is looked at.)
  await k(`globalThis.causalis.client.setSpeed(0)`);
  await page.waitForTimeout(slow(1500));
  const c = await camps(),
    l = await land(),
    names = await campNames();
  say(
    `the land: ${l.camps} camps (${c.map((x) => x.people).join(", ")} people), ${l.campParts} parts drawn, ${l.towns} towns; ${names.length} camps named (“${names[0]?.text ?? ""}”)`,
  );
  check(c.length >= 3 && l.campParts >= c.length * 8, "the bands' camps are not drawn");
  check(l.towns === 0, "a town stands before any people farm");
  check(names.length >= 1, "no camp is named on the land");
  await shot("1-camps");
  // A camp tapped by its name: its page, who they are and how they live.
  const named = names[0];
  if (named) {
    const ref = await k<string | null>(`globalThis.causalis.refAt(${named.x}, ${named.y})`);
    check(!!ref && /^camp:\d+:\d+$/.test(ref), `a tap on a camp's name found ${ref ?? "nothing"}`);
    await page.mouse.click(named.x, named.y);
    const shown = { title: "", body: "" };
    await until(
      "the camp's page",
      async () => {
        Object.assign(
          shown,
          await k<{ title: string; body: string }>(
            `(() => { const w = document.querySelector(".page-window"); return w && !w.hidden ? { title: w.querySelector(".page-title")?.textContent ?? "", body: w.querySelector(".page-body")?.textContent ?? "" } : { title: "", body: "" }; })()`,
          ),
        );
        return /^(A band|\d+ bands) of (foragers|herders)$/.test(shown.title);
      },
      slow(20000),
    );
    say(`a camp tapped: “${shown.title}” — ${shown.body.slice(0, 120)}…`);
    check(/km across/.test(shown.body), "a camp's page does not tell how far its band ranges");
    await shot("1b-a-camp");
    // Down among one of its bands, from its page (M160): the land's own beasts about them, their
    // hour the world's; their day goes on while the clock runs; back up to the land by the bar.
    const watch = page.locator(".page-window button", { hasText: "Watch them near" });
    check((await watch.count()) === 1, "a camp's page has no way down among its band");
    if ((await watch.count()) === 1) {
      await watch.click();
      await until("down among the band", async () => (await scale()) === "camp", slow(30000));
      const world = await k<number>(`globalThis.causalis.client.advance(0).then((s) => s.t)`),
        first = await k<Near | null>(`globalThis.causalis.near?.() ?? null`),
        worldHour = ((world % 86400) / 86400) * 24;
      say(
        `among the band: ${first?.people ?? 0} of them, ${first?.beasts ?? 0} beasts of ${first?.kinds.join(", ") ?? ""}; their hour ${first?.hour.toFixed(1)} (the world's ${worldHour.toFixed(1)}); ${first?.parts ?? 0} parts drawn`,
      );
      check(
        !!first && first.people >= 6 && first.beasts > 0 && first.kinds.length >= 2,
        "the band or the land's beasts are not there",
      );
      check(
        !!first &&
          Math.min(Math.abs(first.hour - worldHour), 24 - Math.abs(first.hour - worldHour)) < 1,
        "the band's hour is not the world's",
      );
      // (The clock run at the band's fastest a while: their day goes on.)
      await k(`globalThis.causalis.client.setSpeed(36 * 60)`);
      await page.waitForTimeout(slow(4000));
      const later = await k<Near | null>(`globalThis.causalis.near?.() ?? null`),
        bar = await k<string>(
          `document.querySelector(".panel:not([hidden]) .camp-doing")?.textContent ?? ""`,
        );
      say(`a while on: their hour ${later?.hour.toFixed(1)}, day ${later?.day}; “${bar}”`);
      check(
        !!first && !!later && (later.day > first.day || (later.hour - first.hour + 24) % 24 > 0.3),
        "the band's day does not go on while the clock runs",
      );
      check(/^(The band of|Night: the band of)/.test(bar), "what the band is at is not told");
      await k(`globalThis.causalis.client.setSpeed(0)`);
      await page.waitForTimeout(slow(500));
      await shot("1c-among-the-band");
      // One of them tapped (M161): each of the band named in their land's tongue; the eye keeps
      // to the one tapped, and the bar tells who they are and what they are at.
      const held = await k<Near | null>(`globalThis.causalis.near?.() ?? null`),
        one = held?.onScreen.find(
          (o) => o.at && o.at.x > 60 && o.at.x < 1306 && o.at.y > 140 && o.at.y < 660,
        );
      check(
        !!held &&
          held.names.length === held.people &&
          held.names.every((n) => n.length >= 2) &&
          new Set(held.names).size >= held.people * 0.7,
        "the band are not named, each their own name",
      );
      check(!!one, "none of the band is on the screen to be tapped");
      if (one?.at) {
        await page.mouse.click(one.at.x, one.at.y);
        let line = "",
          who: string | null = null;
        await until(
          "one of the band followed",
          async () => {
            who = (await k<Near | null>(`globalThis.causalis.near?.() ?? null`))?.followed ?? null;
            line = await k<string>(
              `document.querySelector(".panel:not([hidden]) .camp-doing")?.textContent ?? ""`,
            );
            return !!who && line.startsWith(`${who}, `);
          },
          slow(10000),
        );
        await page.waitForTimeout(slow(1200));
        const over = await page.$$eval(".labels .label", (x) =>
          x.filter((e) => !(e as HTMLElement).hidden).map((e) => e.textContent ?? ""),
        );
        say(`one of them tapped: “${line}”; ${over.length} named over them`);
        check(!!who && over.includes(`👁 ${who}`), "the one followed is not named over them");
        await shot("1d-one-of-them");
      }
      await page.locator(".panel:not([hidden]) button", { hasText: "‹ The land" }).click();
      await until("back up on the land", async () => (await scale()) === "region", slow(30000));
    } else await k(`document.querySelector(".page-window .close")?.click()`);
    await page.waitForTimeout(500);
  }
}

// 2. As the seasons turn, they move camp.
{
  const before = await camps(),
    t = await k<number>(`globalThis.causalis.client.advance(0).then((s) => s.t)`);
  await k(`globalThis.causalis.client.advance(${t} + 365 * 86400 / 4)`);
  const moved = await until(
    "the camps moved with the season",
    async () => {
      const after = await camps();
      return after.length > 0 && after.some((c, i) => before[i] && c.tile !== before[i]!.tile);
    },
    slow(15000),
  );
  const after = await camps();
  say(
    `a season on: ${after.filter((c, i) => before[i] && c.tile !== before[i]!.tile).length} of ${after.length} camps moved`,
  );
  if (moved) await shot("2-a-season-on");
}

// 3. The years on: the first village founded, and the eye down to it.
{
  const t0 = await k<number>(`globalThis.causalis.client.advance(0).then((s) => s.t)`);
  let year = Math.floor(t0 / (365 * 86400)),
    towns = 0;
  for (; year < 80 && towns === 0; year++) {
    await k(`globalThis.causalis.client.advance(${(year + 1) * 365 * 86400 + 3600})`);
    towns = (
      await k<unknown[]>(`globalThis.causalis.client.query({ type: "towns.map", args: {} })`)
    ).length;
  }
  say(`the first village: year ${year}`);
  check(towns > 0, "no village was founded in eighty years");
  await k(`globalThis.causalis.client.setSpeed(1)`);
  const down = await until(
    "the eye down to the first village",
    async () => (await scale()) === "village",
    slow(60000),
  );
  if (down) await shot("3-the-first-village");
}

// 4. On a phone: the land and its camps' names within the screen.
{
  const phone = await browser.newPage({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 2,
    isMobile: true,
    hasTouch: true,
  });
  watch(phone);
  await begin(phone);
  await until(
    "the land on a phone",
    async () => (await scale(phone)) === "region",
    slow(60000),
    phone,
  );
  await until(
    "the camps on a phone",
    async () => (await camps(phone)).length >= 3,
    slow(30000),
    phone,
  );
  await phone.waitForTimeout(slow(2000));
  const fit = await phone.evaluate(() => document.documentElement.scrollWidth - innerWidth),
    names = await campNames(phone);
  say(`on a phone: ${names.length} camps named`);
  check(fit <= 0, `the page runs ${fit}px off a phone's side`);
  check(
    names.every((n) => n.left >= -1 && n.right <= 391),
    "a camp's name runs off a phone's side",
  );
  await shot("4-phone", phone);
  // And among a band on a phone: its bar and what they are at within the screen.
  const greatest = [...(await camps(phone))].sort((a, b) => b.people - a.people)[0];
  if (greatest) {
    await k(`globalThis.causalis.goNear(${greatest.cell}, ${greatest.id})`, phone);
    await until(
      "among a band on a phone",
      async () => (await scale(phone)) === "camp",
      slow(30000),
      phone,
    );
    await phone.waitForTimeout(slow(1500));
    const off = await phone.evaluate(() => {
      const bar = document.querySelector(".panel:not([hidden]) .bar")?.getBoundingClientRect(),
        line = document.querySelector(".panel:not([hidden]) .camp-doing")?.getBoundingClientRect();
      return Math.max(
        document.documentElement.scrollWidth - innerWidth,
        bar ? bar.right - innerWidth : 0,
        line ? line.right - innerWidth : 0,
        line ? -line.left : 0,
      );
    });
    say(`among a band on a phone: ${off <= 0 ? "within the screen" : `${off}px off its side`}`);
    check(off <= 0, `among a band, the bar runs ${off}px off a phone's side`);
    await shot("4b-phone-band", phone);
  }
}

check(errors.length === 0, `errors: ${errors.slice(0, 3).join(" | ")}`);
await browser.close();
await new Promise<void>((done) => server.httpServer.close(() => done()));
console.log(
  problems.length
    ? `\nthe Phase 29 gate fails:\n${problems.map((p) => `  ✗ ${p}`).join("\n")}`
    : "\nthe Phase 29 gate passes",
);
process.exit(problems.length ? 1 : 0);
