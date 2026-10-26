// node tools/phase49-gate.ts [--ci] [--soft] [--shots dir] — the Phase 49 gate (a band's crafts,
// M211; asked for 2026-10-25: "also bring back og causlaiss like primitve crafting and novel
// elements type stuff, like original casualisis is really neat"), on the built app, the Earth seed
// begun at its first people, down among a band of a camp whose land gives good stone:
//   1. of an evening, half of them at their crafts about the work ground by the fire — knapping
//      their land's stone into blades and points, twisting cord, binding points to shafts — sat on
//      the ground, the flakes they strike off about it, their things in a line under the bar;
//   2. by day, the old at their crafts while the grown are out; things made as the day goes;
//   3. packed up and walked on, the fire made at the fresh ground before it burns — by a drill, or
//      struck from their stone on pyrite — and told;
//   4. the camp's page: its stone, and its crafts in a line, the stone a link to what it is;
//   5. on a phone: what the band keeps within the screen.
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
console.log("the Phase 49 gate");
if (shots) mkdirSync(shots, { recursive: true });

type Camp = { cell: number; id: number; tile: number; people: number };
type Craft = {
  stone: { name: string; from: string; keen: number; tough: number; ref?: string };
  wood: string;
  fibre: string;
  binding: string;
  pigment: { name: string } | null;
  fire: string;
};
type Near = {
  cell: number;
  camp: number;
  people: number;
  hour: number;
  day: number;
  crafting: { id: number; kin: string; doing: string; words: string }[];
  kit: { spears: number; blades: number; cord: number; flakes: number; cloaks: number };
  kitWords: string;
  made: number;
  camps: number;
  lit: boolean;
  kindled: string;
  craft: Craft;
  work: { x: number; z: number };
  drawn: { flakes: number; frame: number; hide: number; racked: number };
};

/** The stones bands knap, the keenest first: a camp of a land with the keenest is gone down to. */
const KEENEST = ["obsidian", "flint", "chert", "quartzite", "quartz", "basalt"];
/** The world's seconds in a day, and the camp's slowest speed (a day of theirs in two minutes). */
const DAY = 86400,
  SLOWEST = 12 * 60;

const root = fileURLToPath(new URL("..", import.meta.url)),
  server = await preview({ root, logLevel: "silent", preview: { port: 4305, strictPort: false } }),
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
const near = (p: Page = page) => k<Near | null>(`globalThis.causalis.near?.() ?? null`, p);
const now = (p: Page = page) =>
  k<number>(`globalThis.causalis.client.advance(0).then((s) => s.t)`, p);
/** The world's clock on to the next `hour` of a day (from where it stands), and the band's with it. */
const toHour = async (hour: number, p: Page = page) => {
  const t = await now(p),
    day = Math.floor(t / DAY),
    at = (day + (((t % DAY) / DAY) * 24 >= hour ? 1 : 0)) * DAY + hour * 3600;
  await k(`globalThis.causalis.client.advance(${at})`, p);
  await until(
    `the band's hour at ${hour}`,
    async () => {
      const n = await near(p);
      return !!n && Math.abs(n.hour - hour) < 0.6;
    },
    slow(15000),
    p,
  );
};
const begin = async (p: Page) => {
  await p.goto(`${base}?universe=earth&seed=${encodeURIComponent("first light")}&cradle=1`);
  await p.waitForFunction(
    () => ((globalThis as any).causalis?.drawn?.() as number) > 0,
    undefined,
    { timeout: 900000 },
  );
  await until(
    "the eye down on the land",
    async () => (await scale(p)) === "region",
    slow(60000),
    p,
  );
  await until(
    "the camps drawn",
    async () => (await k<Camp[]>(`globalThis.causalis.camps?.() ?? []`, p)).length >= 3,
    slow(30000),
    p,
  );
  await k(`globalThis.causalis.client.setSpeed(0)`, p);
};
/** Down among a band of the camp whose land gives the keenest stone. */
const goDown = async (p: Page): Promise<{ camp: Camp; craft: Craft } | null> => {
  const camps = await k<Camp[]>(`globalThis.causalis.camps?.() ?? []`, p);
  let best: { camp: Camp; craft: Craft } | null = null;
  for (const c of camps) {
    const info = await k<{ craft: Craft } | null>(
      `globalThis.causalis.client.query({ type: "camp.near", args: { cell: ${c.cell}, id: ${c.id} } })`,
      p,
    );
    if (
      info &&
      (!best || KEENEST.indexOf(info.craft.stone.name) < KEENEST.indexOf(best.craft.stone.name))
    )
      best = { camp: c, craft: info.craft };
  }
  if (!best) return null;
  await k(`globalThis.causalis.goNear(${best.camp.cell}, ${best.camp.id})`, p);
  await until("down among the band", async () => (await scale(p)) === "camp", slow(30000), p);
  await until("the band", async () => (await near(p)) !== null, slow(15000), p);
  return best;
};

// 1. Of an evening, half of them at their crafts about the work ground by the fire.
await begin(page);
const chosen = await goDown(page);
say(
  `a camp of a land whose stone is ${chosen?.craft.stone.name ?? "none"} (${chosen?.craft.stone.from ?? ""}); ${chosen?.craft.wood} shafts, ${chosen?.craft.fibre} cord, fire by ${chosen?.craft.fire}`,
);
check(!!chosen, "no camp to go down among");
await toHour(18.6);
await k(`globalThis.causalis.client.setSpeed(${SLOWEST})`);
let evening: Near | null = null;
await until(
  "the band at their crafts of an evening",
  async () => {
    const n = await near();
    if (!n || n.crafting.length < 2) return false;
    evening = n;
    return true;
  },
  slow(25000),
);
await k(`globalThis.causalis.client.setSpeed(0)`);
{
  const n = evening as Near | null,
    stone = n?.craft.stone.name ?? "?",
    bar = await k<string>(
      `document.querySelector(".panel:not([hidden]) .camp-kit")?.textContent ?? ""`,
    );
  say(
    `of an evening at ${n?.hour.toFixed(1)}: ${n?.crafting.length ?? 0} at their crafts — ${n?.crafting
      .slice(0, 3)
      .map((c) => `“${c.words}”`)
      .join(", ")}`,
  );
  say(`what they keep, under the bar: “${bar}”`);
  check(
    !!n && n.crafting.length >= 2 && n.crafting.length < n.people,
    "not some of the band at their crafts of an evening",
  );
  check(
    !!n &&
      n.crafting.every((c) =>
        /knapping|twisting|binding|scraping|sewing|grinding|making fire|striking/.test(c.words),
      ),
    "a craft told in no words",
  );
  check(
    !!n &&
      n.crafting.some(
        (c) =>
          c.words.includes(`knapping ${stone}`) ||
          c.words.includes(`twisting ${n.craft.fibre}`) ||
          c.words.includes(`a ${stone} point to a shaft of ${n.craft.wood}`),
      ),
    "the crafts are not of what their land gives",
  );
  check(
    bar.includes(`${stone} blade`) && /🗡️ \d+ spear/.test(bar) && bar === n?.kitWords,
    `what the band keeps is not told under the bar (“${bar}”)`,
  );
  // (The eye down on the work ground.)
  if (n) {
    await k(
      `(() => { const r = globalThis.causalis.rig; r.follow = null; r.target.set(${n.work.x}, 0.1, ${n.work.z}); r.distance = 3.2; })()`,
    );
    await page.waitForTimeout(slow(1500));
  }
  const drawn = (await near())?.drawn;
  say(
    `the work ground drawn: ${drawn?.flakes ?? 0} flakes about it, its frame ${drawn?.frame ? "standing" : "not drawn"}, ${drawn?.racked ?? 0} spears stood together, ${drawn?.hide ? "a hide on the frame" : "the frame bare"}`,
  );
  check(!!drawn && drawn.flakes > 0 && drawn.frame === 3, "the work ground is not drawn");
  await shot("1-evening-crafts");
}

// 2. By day, the old at their crafts while the grown are out; things made as the day goes.
{
  const before = (await near())?.made ?? 0;
  await toHour(10.5);
  await k(`globalThis.causalis.client.setSpeed(${SLOWEST})`);
  let old = "";
  await until(
    "the old at their crafts by day",
    async () => {
      const n = await near();
      const c = n?.crafting.find((x) => x.kin === "old");
      if (c) old = c.words;
      return !!c;
    },
    slow(25000),
  );
  // (A thing takes them from half an hour to a few: the day let run on until one is made.)
  await until("a thing made by day", async () => ((await near())?.made ?? 0) > before, slow(45000));
  await k(`globalThis.causalis.client.setSpeed(0)`);
  const n = await near();
  say(`by day at ${n?.hour.toFixed(1)}: “${old}”; ${n?.made ?? 0} things made (${before} before)`);
  check(/one of the old/.test(old), "the old are not at their crafts by day");
  check(!!n && n.made > before, "nothing made as the day went");
  // (The eye close on the work ground: those sat at it, the flakes about its stone.)
  if (n) {
    await k(
      `(() => { const r = globalThis.causalis.rig; r.follow = null; r.target.set(${n.work.x}, 0.05, ${n.work.z}); r.distance = 2.4; })()`,
    );
    await page.waitForTimeout(slow(1500));
  }
  await shot("2-the-old-by-day");
}

// 3. Packed up and walked on: the fire made at the fresh ground before it burns, and told.
{
  const camps = (await near())?.camps ?? 1;
  await k(`globalThis.causalis.moveCamp()`);
  await k(`(() => { const r = globalThis.causalis.rig; r.distance = 9; })()`);
  await toHour(6.8);
  await k(`globalThis.causalis.client.setSpeed(${SLOWEST})`);
  let unlit = false,
    kindler = "";
  const moved = await until(
    "the band walked on to fresh ground",
    async () => {
      const n = await near();
      if (n && n.camps > camps && !n.lit) unlit = true;
      return !!n && n.camps > camps;
    },
    slow(60000),
  );
  const lit = await until(
    "the fire made at the fresh camp",
    async () => {
      const n = await near();
      if (!n) return false;
      if (!n.lit) unlit = true;
      const c = n.crafting.find((x) => /making fire|striking/.test(x.words));
      if (c) kindler = c.words;
      return n.lit && !!n.kindled;
    },
    slow(30000),
  );
  await k(`globalThis.causalis.client.setSpeed(0)`);
  const n = await near();
  say(
    `walked on: camp ${n?.camps ?? 0} of theirs; ${unlit ? "no fire as they came" : "a fire as they came"}; ${kindler ? `“${kindler}”; ` : ""}“${n?.kindled ?? ""}”`,
  );
  check(moved && lit, "the band did not walk on and make their fire");
  check(
    /(made fire with a (bow|hand) drill|struck fire from \w+ on pyrite) at the new camp\.$/.test(
      n?.kindled ?? "",
    ),
    `the fire's making not told (“${n?.kindled ?? ""}”)`,
  );
  check(
    !n ||
      (n.craft.fire === "strike-a-light"
        ? /struck fire/.test(n.kindled)
        : n.kindled.includes(n.craft.fire)),
    "the fire made other than their land's way",
  );
  await shot("3-fire-made");
}

// 4. The camp's page: its stone, its crafts in a line, the stone a link to what it is.
{
  await page.locator(".panel:not([hidden]) button", { hasText: "⛺ The camp" }).click();
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
      return /Their stone/.test(shown.body);
    },
    slow(20000),
  );
  const stone = chosen?.craft.stone.name ?? "?",
    line = /They knap [^.]*\./.exec(shown.body)?.[0] ?? "";
  say(`the camp's page “${shown.title}”: “${line.slice(0, 160)}…”`);
  check(
    new RegExp(`Their stone\\s*${stone}`).test(shown.body),
    "the camp's page has not its stone",
  );
  check(
    line.startsWith(`They knap ${stone} — `) && line.includes("into cord"),
    "the camp's page does not tell its crafts",
  );
  await shot("4-the-camp-page");
  if (chosen?.craft.stone.ref) {
    const link = page.locator(
      `.page-window:not([hidden]) a.ref-link[href="#${chosen.craft.stone.ref}"]`,
    );
    if ((await link.count()) > 0) {
      await link.first().click();
      // (Its page come: a title of its own, not the camp's nor the "…" of one still coming.)
      const went = await until(
        "the stone's page",
        async () => {
          const t = await k<string>(
            `document.querySelector(".page-window:not([hidden]) .page-title")?.textContent ?? ""`,
          );
          return /\w/.test(t) && t.toLowerCase() !== shown.title.toLowerCase();
        },
        slow(10000),
      );
      const title = await k<string>(
        `document.querySelector(".page-window:not([hidden]) .page-title")?.textContent ?? ""`,
      );
      say(`the stone tapped: “${title}”`);
      check(went, "the stone's link does not open what it is");
    } else problems.push("the stone is not a link on the camp's page");
  }
  await k(`document.querySelector(".page-window .close")?.click()`);
}

// 5. On a phone: what the band keeps within the screen. (The desk's page closed first, so the
// phone's has the machine to itself.)
await page.close();
{
  const phone = await browser.newPage({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 2,
    isMobile: true,
    hasTouch: true,
  });
  watch(phone);
  page = phone;
  await begin(phone);
  await goDown(phone);
  await toHour(19, phone);
  await k(`globalThis.causalis.client.setSpeed(${SLOWEST})`, phone);
  await phone.waitForTimeout(slow(3000));
  await k(`globalThis.causalis.client.setSpeed(0)`, phone);
  const kit = await k<{ text: string; left: number; right: number } | null>(
      `(() => { const e = document.querySelector(".panel:not([hidden]) .camp-kit"); if (!e) return null; const r = e.getBoundingClientRect(); return { text: e.textContent ?? "", left: r.left, right: r.right }; })()`,
      phone,
    ),
    off = await phone.evaluate(() => document.documentElement.scrollWidth - innerWidth);
  say(
    `on a phone: “${kit?.text ?? ""}” at ${Math.round(kit?.left ?? -1)}–${Math.round(kit?.right ?? -1)} px`,
  );
  check(
    !!kit && !!kit.text && kit.left >= 0 && kit.right <= 390,
    "what the band keeps runs off a phone",
  );
  check(off <= 0, `the page runs ${off}px off a phone's side`);
  await shot("5-phone", phone);
}

check(errors.length === 0, `errors: ${errors.slice(0, 3).join(" | ")}`);
await browser.close();
await new Promise<void>((done) => server.httpServer.close(() => done()));
console.log(
  problems.length
    ? `\nthe Phase 49 gate fails:\n${problems.map((p) => `  ✗ ${p}`).join("\n")}`
    : "\nthe Phase 49 gate passes",
);
process.exit(problems.length ? 1 : 0);
