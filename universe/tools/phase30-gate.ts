// node tools/phase30-gate.ts [--ci] [--soft] [--shots dir] — the Phase 30 gate (the weather near,
// M162; asked for 2026-10-24: "be able to pause and influence and all that"), done in a real
// browser on the built app, the Earth seed begun at its first people as the genesis begins it:
//   1. down on the land, its weather told by the date; the god's rain sent on it from the palette:
//      rain falls over the land, its sky grey;
//   2. among a band of it: the rain falls on them too, the land about them greening; paused, the
//      rain stands in the air;
//   3. the rain withheld from among them: none falls, the land about them parching;
//   4. the coldest land in its winter, the god's rain sent on it: snow falls, and snow lies (M164);
//   5. the years on, the first village founded: its town in the god's rain; and the god's other acts
//      on its land seen there (M163): the harvest blessed (gold off the land), the ground shaken,
//      a stone from the sky (its fall, its smoke), each told by the date;
//   6. on a phone: the bar and its weather within the screen.
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
console.log("the Phase 30 gate");
if (shots) mkdirSync(shots, { recursive: true });

type Weather = {
  cell: number;
  words: string;
  icon: string;
  rain: number;
  snow: number;
  cloud: number;
  haze: number;
  warmth: number;
  drops: number;
  flakes: number;
  sky: string;
  sheltered: number;
  hand: {
    told: string[];
    motes: number;
    flames: number;
    smoke: number;
    light: number;
    shake: number;
  };
  seconds: number;
  season: { snow: number; leaf: number; turned: number; ice: number };
  ground: string;
};
type Camp = { cell: number; id: number; people: number };
type Sky = { cell: number; warmth: number; swing: number; wet: number };

const root = fileURLToPath(new URL("..", import.meta.url)),
  server = await preview({ root, logLevel: "silent", preview: { port: 4282, strictPort: false } }),
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
const weather = (p: Page = page) => k<Weather | null>(`globalThis.causalis.weather?.() ?? null`, p);
/** The weather's sign in the bar shown, and its words. */
const mark = (p: Page = page) =>
  k<{ text: string; title: string; right: number; left: number } | null>(
    `(() => { const m = [...document.querySelectorAll(".panel:not([hidden]) .weather-mark")].find((e) => !e.hidden); if (!m) return null; const r = m.getBoundingClientRect(); return { text: m.textContent ?? "", title: m.title, right: r.right, left: r.left }; })()`,
    p,
  );
const tell = (w: Weather | null) =>
  w
    ? `“${w.words}” ${w.icon} ${Math.round(w.warmth)}°, rain ${w.rain.toFixed(2)}, snow ${w.snow.toFixed(2)}, cloud ${w.cloud.toFixed(2)}, haze ${w.haze.toFixed(2)}; ${w.drops} drops, ${w.flakes} flakes drawn; sky “${w.sky}”${w.ground ? `; the ground ${w.ground}` : ""}`
    : "no weather";
const begin = async (p: Page) => {
  await p.goto(`${base}?universe=earth&seed=${encodeURIComponent("first light")}&cradle=1`);
  await p.waitForFunction(
    () => ((globalThis as any).causalis?.drawn?.() as number) > 0,
    undefined,
    { timeout: 900000 },
  );
};
/** An act of the palette cast by its tile, on whatever is under the screen's middle. */
const cast = async (act: string) => {
  await k(`globalThis.causalis.palette.take(${JSON.stringify(act)})`);
  await page.waitForTimeout(300);
  await page.mouse.click(683, 430);
  await page.waitForTimeout(slow(600));
  await k(`globalThis.causalis.palette.putDown()`);
};

// 1. Down on the land at the cradle; the god's rain sent on it.
await begin(page);
let cell = -1;
{
  await until("the eye down on the land", async () => (await scale()) === "region", slow(60000));
  await until("the land's weather", async () => (await weather()) !== null, slow(20000));
  const first = await weather(),
    sign = await mark();
  cell = first?.cell ?? -1;
  say(
    `the land as it is: ${tell(first)}; by the date “${sign?.text ?? ""}” (${sign?.title ?? ""})`,
  );
  check(
    !!sign && sign.text.length > 0 && sign.title === first?.words,
    "the weather is not told by the date",
  );
  await cast("rain");
  const rained = await until(
    "the god's rain over the land",
    async () => {
      const w = await weather();
      return !!w && w.words === "Rain sent by your hand" && w.drops > 0;
    },
    slow(30000),
  );
  const w = await weather();
  say(`the god's rain sent: ${tell(w)}; by the date “${(await mark())?.text ?? ""}”`);
  check(
    rained && !!w && w.sky === "grey" && w.cloud > 0.6,
    "the sky is not grey under the god's rain",
  );
  await shot("1-land-rain");
}

// 2. Among a band of the land: the rain on them, their land greening; paused, the rain stands.
const camps = await k<Camp[]>(`globalThis.causalis.camps?.() ?? []`),
  greatest = [...camps].sort((a, b) => b.people - a.people)[0];
check(!!greatest, "no camp to go down to");
if (greatest) {
  await k(`globalThis.causalis.goNear(${greatest.cell}, ${greatest.id})`);
  await until("down among the band", async () => (await scale()) === "camp", slow(30000));
  const rained = await until(
    "the rain among the band",
    async () => {
      const w = await weather();
      return !!w && w.words === "Rain sent by your hand" && w.rain > 0.3 && w.ground === "greening";
    },
    slow(30000),
  );
  say(`among the band: ${tell(await weather())}`);
  if (rained) await shot("2-camp-rain");
  // Paused in a downpour (if a spell's end came as the clock stopped, the next downpour waited
  // for): the drops stand in the air, the weather's seconds with them.
  let a: Weather | null = null,
    b: Weather | null = null;
  for (let tries = 0; tries < 3; tries++) {
    await until("a downpour", async () => ((await weather())?.rain ?? 0) > 0.3, slow(30000));
    await k(`globalThis.causalis.client.setSpeed(0)`);
    await page.waitForTimeout(slow(600));
    a = await weather();
    await page.waitForTimeout(slow(1000));
    b = await weather();
    if ((a?.drops ?? 0) > 0) break;
    await k(`globalThis.causalis.client.setSpeed(12 * 60)`);
  }
  say(
    `paused: the rain's own seconds ${a?.seconds.toFixed(2)} then ${b?.seconds.toFixed(2)}, ${a?.drops ?? 0} then ${b?.drops ?? 0} drops in the air`,
  );
  check(
    !!a && !!b && a.seconds === b.seconds && b.drops > 0 && a.drops === b.drops,
    "the rain does not stand while the clock is held",
  );
  await k(`globalThis.causalis.client.setSpeed(12 * 60)`);

  // 3. The rain withheld, from among them.
  await cast("drought");
  const dry = await until(
    "the rain withheld",
    async () => {
      const w = await weather();
      return !!w && w.words.startsWith("Dry") && w.drops === 0 && w.ground === "parching";
    },
    slow(30000),
  );
  say(`the rain withheld: ${tell(await weather())}`);
  if (dry) await shot("3-camp-dry");
  await page.locator(".panel:not([hidden]) button", { hasText: "‹ The land" }).click();
  await until("back up on the land", async () => (await scale()) === "region", slow(30000));
}

// 4. The coldest land in its winter, the god's rain sent on it: snow falls.
{
  const lands = await k<{ cell: number }[]>(
      `globalThis.causalis.client.query({ type: "people.map", args: {} })`,
    ),
    skies = await k<Sky[]>(
      `Promise.all(${JSON.stringify(lands.map((l) => l.cell))}.map((cell) => globalThis.causalis.client.query({ type: "land.sky", args: { cell } })))`,
    ),
    coldest = [...skies].sort((a, b) => a.warmth - a.swing - (b.warmth - b.swing))[0];
  say(
    `the coldest of ${skies.length} lands: ${coldest ? `${Math.round(coldest.warmth)}° ±${Math.round(coldest.swing)}°, ${Math.round(coldest.wet)} mm` : "none"}`,
  );
  check(!!coldest && coldest.warmth - coldest.swing < -2, "no land is cold in its winter");
  if (coldest) {
    await k(`globalThis.causalis.client.setSpeed(0)`);
    const t = await k<number>(`globalThis.causalis.client.advance(0).then((s) => s.t)`),
      winter = (Math.floor(t / (365 * 86400)) + 1) * 365 * 86400 + 4 * 86400 + 11 * 3600;
    await k(`globalThis.causalis.client.advance(${winter})`);
    await k(
      `globalThis.causalis.client.command("act.rain", { cell: ${coldest.cell}, sign: 1, years: 2 })`,
    );
    await k(`globalThis.causalis.descend(${coldest.cell})`);
    await until("down on the cold land", async () => (await scale()) === "region", slow(30000));
    await k(`globalThis.causalis.client.setSpeed(86400)`);
    const snowed = await until(
      "snow on the cold land",
      async () => {
        const w = await weather();
        return !!w && w.cell === coldest.cell && w.snow > 0 && w.flakes > 0;
      },
      slow(30000),
    );
    const w = await weather();
    say(
      `the cold land in its winter: ${tell(w)}; snow lying ${(w?.season.snow ?? 0).toFixed(2)}, ice ${(w?.season.ice ?? 0).toFixed(2)}`,
    );
    check((w?.season.snow ?? 0) > 0.5, "no snow lies on the cold land in its winter");
    if (snowed) await shot("4-snow");
  }
}

// 5. The years on: the first village, its town in the god's rain.
{
  const t0 = await k<number>(`globalThis.causalis.client.advance(0).then((s) => s.t)`);
  let year = Math.floor(t0 / (365 * 86400)),
    towns: { ref: string; cell: number }[] = [];
  for (; year < 80 && towns.length === 0; year++) {
    await k(`globalThis.causalis.client.advance(${(year + 1) * 365 * 86400 + 3600})`);
    towns = await k<{ ref: string; cell: number }[]>(
      `globalThis.causalis.client.query({ type: "towns.map", args: {} })`,
    );
  }
  check(towns.length > 0, "no village was founded in eighty years");
  const town = towns[0];
  if (town) {
    await k(
      `globalThis.causalis.client.command("act.rain", { cell: ${town.cell}, sign: 1, years: 2 })`,
    );
    await k(`globalThis.causalis.watch(${JSON.stringify(town.ref)})`);
    await until("down in the town", async () => (await scale()) === "village", slow(60000));
    await k(`globalThis.causalis.client.setSpeed(3600)`);
    const rained = await until(
      "the god's rain on the town",
      async () => {
        const w = await weather();
        return !!w && w.cell === town.cell && w.words === "Rain sent by your hand" && w.drops > 0;
      },
      slow(30000),
    );
    say(`the first village, year ${year}: ${tell(await weather())}`);
    if (rained) await shot("5-town-rain");
    // Those at their ease go in out of the downpour; at work, they work on (Phase 30).
    const atEase = (p: { activity: number; task: string | null }) =>
      [1, 4, 5, 6].includes(p.activity) || (p.activity === 7 && p.task !== "drill");
    let seen = "";
    const indoors = await until(
      "those at their ease in out of the downpour",
      async () => {
        const w = await weather(),
          people = await k<{ activity: number; task: string | null }[]>(
            `globalThis.causalis.peopleNow?.() ?? []`,
          );
        seen = `rain ${w?.rain.toFixed(2)}, ${w?.sheltered ?? 0} indoors out of it, ${people.length} out (${people.filter(atEase).length} at their ease)`;
        return !!w && w.rain > 0.5 && w.sheltered > 0 && !people.some(atEase);
      },
      slow(40000),
    );
    say(`in the downpour: ${seen}`);
    if (indoors) await shot("5a-town-sheltering");
    // The god's other acts on its land, seen from the town (M163).
    const acted = async (
      what: string,
      command: string,
      args: unknown,
      seen: (w: Weather) => boolean,
      picture?: string,
    ) => {
      await k(
        `globalThis.causalis.client.command(${JSON.stringify(command)}, ${JSON.stringify(args)})`,
      );
      const ok = await until(
        what,
        async () => {
          const w = await weather();
          return !!w && seen(w);
        },
        slow(30000),
      );
      const w = await weather();
      say(
        `${what}: told “${w?.hand.told.join("; ") ?? ""}”; ${w?.hand.motes ?? 0} motes, ${w?.hand.flames ?? 0} flames, ${w?.hand.smoke ?? 0} smoke, shaking ${(w?.hand.shake ?? 0).toFixed(2)}; by the date “${(await mark())?.text ?? ""}”`,
      );
      if (ok && picture) await shot(picture);
    };
    await acted(
      "the harvest blessed",
      "act.harvest",
      { cell: town.cell, sign: 1, years: 2 },
      (w) => w.hand.told.includes("the harvest blessed") && w.hand.motes > 0,
      "5b-town-blessed",
    );
    check(
      (await mark())?.text.includes("🌽") ?? false,
      "the blessed harvest is not told by the date",
    );
    await acted(
      "the ground shaken",
      "act.quake",
      { cell: town.cell },
      (w) => w.hand.told.includes("the ground shaken") && w.hand.shake > 0,
    );
    await acted(
      "a stone from the sky",
      "act.meteor",
      { cell: town.cell },
      (w) => w.hand.told.includes("a stone from the sky") && w.hand.flames + w.hand.smoke > 0,
      "5c-town-stone",
    );
  }
}

// 6. On a phone: the bar and its weather within the screen.
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
    "the weather on a phone",
    async () => (await mark(phone)) !== null,
    slow(20000),
    phone,
  );
  await phone.waitForTimeout(slow(1000));
  const sign = await mark(phone),
    off = await phone.evaluate(() => {
      const bar = document.querySelector(".panel:not([hidden]) .bar")?.getBoundingClientRect();
      return Math.max(
        document.documentElement.scrollWidth - innerWidth,
        bar ? bar.right - innerWidth : 0,
      );
    });
  say(
    `on a phone: “${sign?.text ?? ""}” at ${Math.round(sign?.left ?? -1)}–${Math.round(sign?.right ?? -1)} px; ${off <= 0 ? "the bar within the screen" : `${off}px off its side`}`,
  );
  check(!!sign && sign.left >= 0 && sign.right <= 390, "the weather runs off a phone's side");
  check(off <= 0, `the bar runs ${off}px off a phone's side`);
  await shot("6-phone", phone);
}

check(errors.length === 0, `errors: ${errors.slice(0, 3).join(" | ")}`);
await browser.close();
await new Promise<void>((done) => server.httpServer.close(() => done()));
console.log(
  problems.length
    ? `\nthe Phase 30 gate fails:\n${problems.map((p) => `  ✗ ${p}`).join("\n")}`
    : "\nthe Phase 30 gate passes",
);
process.exit(problems.length ? 1 : 0);
