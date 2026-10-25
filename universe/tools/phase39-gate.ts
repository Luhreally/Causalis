// node tools/phase39-gate.ts [--ci] [--soft] [--shots dir] — the Phase 39 gate (the town lived,
// M198; asked for 2026-10-25: "bringing back og causlisis like town/country game play and sim like
// the depth the og game had ... and just actions of stuff"), on the built app, the Earth seed sixty
// years on, in its greatest town at the harvest:
//   1. the town drawn with its many as well as its families (one figure for every thirty of it, as
//      the setting allows);
//   2. its people at the work its needs set them: the farmers reaping, the sheaves carried to the
//      granary and stacked in it, its grain rising through the day; builders carrying beams from
//      the yard to what is going up; the yard heaped with timber;
//   3. under the bar, the line of its stores; a tap, their card: what each store holds and how long
//      it would last, what came in and went out today, who is at what, what is going up;
//   4. one of them tapped: what they are doing now, and why, told on their page (one of its many:
//      their card, and their work today);
//   5. watched growing (months a second), its stores told as history keeps them.
// (npm run build first; --soft draws in software, as CI's browser does; --shots keeps a
// picture of each step.)
import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { preview } from "vite";
import { chromium } from "playwright";

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
console.log("the Phase 39 gate");
if (shots) mkdirSync(shots, { recursive: true });

type Book = Record<"grain" | "food" | "wood" | "stone" | "ore" | "tools", number>;
type Stores = {
  have: Book;
  brought: Book;
  taken: Book;
  lasts: Book;
  months: number;
  lean: boolean;
  doing: { kind: string; n: number }[];
  sites: { words: string; x: number; z: number; hands: number }[];
  heaps: {
    sacks: number;
    logs: number;
    stones: number;
    ore: number;
    granary: { x: number; z: number; heap: boolean };
    yard: { x: number; z: number; heap: boolean };
  } | null;
  card: string | null;
};
type Person = {
  name: string;
  x: number;
  z: number;
  activity: number;
  task: string | null;
  index: number;
  ref: string;
  folk: boolean;
  carry: string | null;
  why: string | null;
};

const root = fileURLToPath(new URL("..", import.meta.url)),
  server = await preview({ root, logLevel: "silent", preview: { port: 4291, strictPort: false } }),
  base = server.resolvedUrls!.local[0]!,
  browser = await chromium.launch({
    args: soft ? ["--use-angle=swiftshader", "--enable-unsafe-swiftshader"] : ci ? [] : GPU,
  });
const errors: string[] = [];
const page = await browser.newPage({ viewport: { width: 1366, height: 800 } });
page.on("pageerror", (e) => errors.push(e.message));
page.on("console", (m) => {
  if (m.type() === "error") errors.push(m.text());
});
const k = <T>(code: string): Promise<T> => page.evaluate(code) as Promise<T>;
const until = async (what: string, ok: () => Promise<boolean>, ms = 60000) => {
  const end = Date.now() + ms;
  while (Date.now() < end) {
    if (await ok()) return true;
    await page.waitForTimeout(250);
  }
  problems.push(`${what} did not come`);
  return false;
};
const shot = async (name: string) => {
  if (shots) await page.screenshot({ path: join(shots, `${name}.png`) });
};
const stores = () => k<Stores | null>(`globalThis.causalis.stores?.() ?? null`);
const people = () => k<Person[]>(`globalThis.causalis.peopleNow?.() ?? []`);
const carriers = () => k<{ carry: string }[]>(`globalThis.causalis.carriersNow?.() ?? []`);
const line = () =>
  k<string>(
    `[...document.querySelectorAll(".panel:not([hidden]) .town-stores")].find((e) => !e.hidden)?.textContent ?? ""`,
  );
const YEAR = 365 * 86400,
  DAY = 86400,
  HOUR = 3600;
/** On to moment t (the clock held), and a few frames drawn there. */
const advance = async (t: number) => {
  await k(`globalThis.causalis.client.advance(${Math.round(t)})`);
  await page.waitForTimeout(slow(400));
};
/** The eye over a point of the town (metres), from so far off. */
const over = async (x: number, z: number, distance: number, pitch: number) => {
  await k(
    `globalThis.causalis.rig.flyTo({ target: { x: ${x * 0.1}, y: 0, z: ${z * 0.1} }, distance: ${distance}, pitch: ${pitch} })`,
  );
  await page.waitForTimeout(slow(2500));
};

await page.goto(`${base}?universe=earth&seed=${encodeURIComponent("first light")}`);
await page.waitForFunction(
  () => ((globalThis as any).causalis?.drawn?.() as number) > 0,
  undefined,
  { timeout: 900000 },
);
await k(`globalThis.causalis.setQuality("high")`);
await k(`globalThis.causalis.client.setSpeed(0)`);
// (A day of the reaping: the year's 0.65. Not a day of rest, nor a feast's: see below.)
let day = 60 * 365 + 238;
await advance(day * DAY + 5.5 * HOUR);
const towns = await k<{ ref: string; name: string; people: number }[]>(
  `globalThis.causalis.client.query({ type: "towns.map" })`,
);
const town = towns[0]!;
await k(`globalThis.causalis.goTo(${JSON.stringify(town.ref)})`);
const entered = await until(
  `${town.name}'s stores`,
  async () => (await stores()) !== null,
  slow(120000),
);
await k(`globalThis.causalis.client.setSpeed(0)`);
check(entered, "the town's stores are not told");

// (A working day: on a day of rest, or a feast's, the work is put down.)
for (let tries = 0; tries < 8; tries++) {
  await advance(day * DAY + 6 * HOUR);
  const s = await stores();
  if (s && s.doing.some((d) => d.kind === "reap" && d.n >= 3)) break;
  day++;
}

// 1. The town drawn with its many.
const drawn = await k<number>(`globalThis.causalis.watching?.() ?? 0`),
  everyone = await people(),
  many = everyone.filter((p) => p.folk).length;
say(`${town.name} (${town.people}): ${drawn} drawn, ${many} of them of its many (in sight now)`);
check(drawn >= Math.min(60, Math.ceil(town.people / 30)), `too few drawn (${drawn})`);
check(many >= 1, "none of the town's many drawn");

// 2. At the harvest: reaping, the sheaves carried in, the grain rising; builders and the yard.
const seen = new Set<string>(),
  tasks = new Set<string>();
let loads = 0;
const look = async (from: number, to: number, step: number) => {
  for (let m = from * 60; m <= to * 60; m += step) {
    const t = Math.round(day * DAY + m * 60);
    await k(`globalThis.causalis.client.advance(${t})`);
    // (Drawn at that moment: the host's word of it come, and a few frames drawn after it.)
    await page
      .waitForFunction((at) => ((globalThis as any).causalis.client.status?.t ?? 0) >= at, t, {
        timeout: slow(5000),
      })
      .catch(() => undefined);
    await page.waitForTimeout(slow(60));
    for (const c of await carriers()) seen.add(c.carry);
    for (const p of await people()) {
      if (p.carry) seen.add(p.carry);
      if (p.task) tasks.add(p.task);
      if (p.task === "load") loads++;
    }
  }
};
// (The builders' first beams, after breakfast, a minute apart: each is carried from the yard to
// its site in a minute or two, and then raised for a couple of hours.)
await look(6.25, 8, 1);
await advance(day * DAY + 9.5 * HOUR);
const morning = (await stores())!;
await look(9.5, 12, 3);
await advance(day * DAY + 15 * HOUR);
const afternoon = (await stores())!,
  doing = Object.fromEntries(afternoon.doing.map((d) => [d.kind, d.n]));
say(
  `the day's work: ${afternoon.doing.map((d) => `${d.n} ${d.kind}`).join(", ")}; ${afternoon.sites.length} going up`,
);
say(
  `carried through the morning: ${[...seen].join(", ")}; at: ${[...tasks].join(", ")}; ${loads} seen putting down or taking up a load`,
);
say(
  `the grain: ${Math.round(morning.have.grain)} at 9:30, ${Math.round(afternoon.have.grain)} at 15:00 (${Math.round(afternoon.brought.grain)} brought in, ${Math.round(afternoon.taken.grain)} taken); ${afternoon.months.toFixed(1)} months of food; the yard ${Math.round(afternoon.have.wood)} loads of timber, ${Math.round(afternoon.have.stone)} of stone`,
);
check((doing.reap ?? 0) >= 5, "the farmers not reaping at the harvest");
check(seen.has("sheaf"), "no sheaves carried");
check(tasks.has("reap"), "no one seen reaping");
check(loads >= 1, "no load seen put down at a store");
check(afternoon.brought.grain > 0, "no grain brought into the granary");
check(afternoon.have.grain > morning.have.grain, "the granary no fuller by the afternoon");
if (afternoon.sites.length) {
  check((doing.build ?? 0) >= 1, "no one building with buildings going up");
  check(seen.has("beam") || seen.has("stone"), "no beams or stone carried to the sites");
  check(tasks.has("build"), "no one seen building");
} else problems.push("nothing going up in the greatest town at sixty years");
const heaps = afternoon.heaps;
say(
  `heaped: ${heaps?.sacks ?? 0} sacks (${heaps?.granary.heap ? "in the open" : "within its granary"}), ${heaps?.logs ?? 0} logs, ${heaps?.stones ?? 0} stones, ore ${heaps?.ore ?? 0}`,
);
check(!!heaps && heaps.logs >= 1, "the yard not heaped with timber");
check(!!heaps && (!heaps.granary.heap || heaps.sacks >= 1), "the granary's heap not drawn");
if (heaps) await over(heaps.yard.x, heaps.yard.z, 7, -32);
await shot("1-yard");
if (heaps) await over(heaps.granary.x, heaps.granary.z, 7, -32);
await shot("2-granary");

// 3. The line of its stores under the bar, and their card.
const told = await line();
say(`the bar: “${told}”`);
check(/🌾/.test(told) && /🪵/.test(told), `the stores' line not told (“${told}”)`);
await page.click(".panel:not([hidden]) .town-stores");
await page.waitForTimeout(slow(600));
const card = (await stores())?.card ?? "";
say(`their card: “${card.slice(0, 220)}…”`);
check(/Its stores/.test(card) && /Grain/.test(card), "the stores' card does not tell them");
check(/reaping/.test(card), "the stores' card does not tell who is at what");
check(/today \+/.test(card), "the stores' card does not tell what came in today");
await shot("3-card");
await page.click(".panel:not([hidden]) > .inspector:not([hidden]):not(.page-window) > .close");

// 4. One of them tapped: what they are doing now, and why.
const tap = async (p: Person) => {
  await over(p.x, p.z, 3.5, -40);
  const at = await k<{ x: number; y: number } | null>(
    `globalThis.causalis.personOnScreen?.(${p.index}) ?? null`,
  );
  if (!at) return false;
  await page.mouse.click(at.x, at.y);
  await page.waitForTimeout(slow(900));
  return true;
};
{
  const reaper = (await people()).find((p) => !p.folk && p.task === "reap");
  check(!!reaper, "none of its families seen reaping");
  if (reaper && (await tap(reaper))) {
    const open = await k<string | null>(`globalThis.causalis.pageOpen?.() ?? null`),
      live = await k<string>(`document.querySelector(".page-live")?.textContent ?? ""`);
    say(
      `${reaper.name} tapped: their page ${open === reaper.ref ? "open" : `(${open})`} — “${live}”`,
    );
    check(open === reaper.ref, "the reaper's page not opened");
    check(/^Now at work: reaping/.test(live), `their work and why not told (“${live}”)`);
    await shot("4-reaper");
  }
  const one = (await people()).find((p) => p.folk && p.activity === 3);
  if (one && (await tap(one))) {
    const c = (await stores())?.card ?? "";
    say(`${one.name} tapped: “${c.slice(0, 160)}”`);
    check(new RegExp(`Today: `).test(c) && /many/.test(c), "one of the many's card not shown");
    await shot("5-one-of-many");
  } else problems.push("none of the town's many at work in sight");
}

// 5. Watched growing (a month a second): its stores told as history keeps them.
// (A speed by what its button says: "1 month/s"; the pause by its name.)
const press = (label: RegExp) =>
  k<boolean>(
    `(() => { const b = [...document.querySelectorAll(".panel:not([hidden]) .timebar .speeds button")].find((x) => ${label}.test((x.textContent ?? "") + " " + (x.getAttribute("aria-label") ?? ""))); b?.click(); return !!b; })()`,
  );
check(await press(/^1 month/i), "no month-a-second speed in the town's bar");
const was = (await stores())!.have.grain;
const grown = await until(
  "the stores told as the town grows",
  async () => {
    const s = await stores(),
      at = await k<number>(`globalThis.causalis.client.status?.t ?? 0`);
    return !!s && s.have.grain !== was && at > (day + 20) * DAY;
  },
  slow(40000),
);
check(grown, "the stores not told as the town grows");
await press(/pause/i);
say(
  `watched growing: the grain ${Math.round(was)} → ${Math.round((await stores())?.have.grain ?? 0)}; the line “${await line()}”`,
);

check(errors.length === 0, `errors: ${errors.slice(0, 3).join(" | ")}`);
await browser.close();
await new Promise<void>((done) => server.httpServer.close(() => done()));
console.log(
  problems.length
    ? `\nthe Phase 39 gate fails:\n${problems.map((p) => `  ✗ ${p}`).join("\n")}`
    : "\nthe Phase 39 gate passes",
);
process.exit(problems.length ? 1 : 0);
