// node tools/phase11-gate.ts [--ci] [--soft] — the Phase 11 gate (docs/architecture §I.11,
// milestone 105), what the viewer asked for ("the visual style and ui and lenses doesn't have
// enough Paradox games influence"), done in a real browser on the built app:
//   1. heraldry: every realm bears its arms, on its page and beside its name;
//   2. counters: each host on the globe and in a land is a counter, its realm's arms and the
//      men it fields, edged by how it stands to what is followed;
//   3. event windows: a great happening to what is followed told in its window, the clock
//      waiting, the god's hand offering its answers; let be, the clock runs again;
//   4. side by side: two realms compared, a war's tally;
//   5. the map closer: lands taken by force in shadow, seats under siege marked.
// (npm run build first; --soft draws in software, as CI's browser does.)
import { fileURLToPath } from "node:url";
import { preview } from "vite";
import { chromium } from "playwright";

const ci = process.argv.includes("--ci"),
  soft = process.argv.includes("--soft");
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
console.log("the Phase 11 gate");

const root = fileURLToPath(new URL("..", import.meta.url)),
  server = await preview({ root, logLevel: "silent", preview: { port: 4263, strictPort: false } }),
  base = server.resolvedUrls!.local[0]!,
  browser = await chromium.launch({
    args: soft ? ["--use-angle=swiftshader", "--enable-unsafe-swiftshader"] : ci ? [] : GPU,
  }),
  page = await browser.newPage({ viewport: { width: 1366, height: 800 } });
const errors: string[] = [];
page.on("pageerror", (e) => errors.push(e.message));
page.on("console", (m) => {
  if (m.type() === "error") errors.push(m.text());
});
const k = <T>(code: string): Promise<T> => page.evaluate(code) as Promise<T>;
const q = <T>(type: string, args: unknown = {}): Promise<T> =>
  k<T>(
    `globalThis.causalis.client.query({ type: ${JSON.stringify(type)}, args: ${JSON.stringify(args)} })`,
  );
const scale = () => k<string>("globalThis.causalis.scale()");
const title = () =>
  page.$eval(".page-window .page-title", (e) => e.textContent ?? "").catch(() => "");
const opened = async (ref: string) => {
  await k(`globalThis.causalis.open(${JSON.stringify(ref)})`);
  await page.waitForFunction(
    `document.querySelector(".page-window .page-title")?.textContent && document.querySelector(".page-window .page-title").textContent !== "…"`,
    undefined,
    { timeout: 30000 },
  );
};
const until = async (what: string, ok: () => Promise<boolean>, ms = 60000) => {
  const end = Date.now() + ms;
  while (Date.now() < end) {
    if (await ok()) return true;
    await page.waitForTimeout(250);
  }
  problems.push(`${what} did not come`);
  return false;
};
/** The middle of what a selector names on the screen, or null if it is not shown. */
const centre = (sel: string) =>
  k<{ x: number; y: number } | null>(
    `(() => { const e = document.querySelector(${JSON.stringify(sel)}); if (!e) return null; const r = e.getBoundingClientRect(); return r.width ? { x: r.left + r.width / 2, y: r.top + r.height / 2 } : null; })()`,
  );
// (Pressed by the pointer as a viewer's is: Playwright's own checks wait for two frames alike,
// long where the frames come slowly, as in CI.)
const press = async (sel: string) => {
  const at = await centre(sel);
  if (!at) {
    problems.push(`${sel} was not there to press`);
    return false;
  }
  await page.mouse.click(at.x, at.y);
  return true;
};
const shown = (sel: string) =>
  page.$$eval(sel, (xs) => xs.filter((x) => !(x as HTMLElement).hidden).length);
/** The clock's speed as the host last told it. */
const speed = () =>
  k<number>(
    `new Promise((done) => { let got = false; const off = globalThis.causalis.client.onStatus((s) => { if (got) return; got = true; setTimeout(() => off(), 0); done(s.speed); }); })`,
  );
const follow = async (ref: string) => {
  await opened(ref);
  if (await page.$(".page-window .follow:not(.on)")) await press(".page-window .follow:not(.on)");
  await page.waitForTimeout(400);
};

// (?events: great happenings in their windows, though a machine drives the page.)
await page.goto(`${base}?universe=earth&year=400&events=1`);
await page.waitForFunction(
  () => ((globalThis as any).causalis?.drawn?.() as number) > 0,
  undefined,
  { timeout: 900000 },
);
await k("globalThis.causalis.client.setSpeed(0)");
await page.waitForTimeout(1500);
const realms = (await q<{ ref: string; people: number }[]>("realms.map")).sort(
  (a, b) => b.people - a.people,
);

// 1. Heraldry: a realm's page shows its arms, and its names bear them.
{
  const top = realms[0]!;
  await opened(top.ref);
  const model = await q<{ portrait?: { kind: string } }>("page", { ref: top.ref }),
    pictured = await shown(".page-window canvas.portrait");
  // (Other realms named on its page — those to set beside it — bear theirs.)
  await opened(`${top.ref}#compare`);
  const shields = await page.$$eval(".page-window canvas.arms", (x) => x.length);
  const arms = await q<({ charge: string } | null)[]>("arms", { refs: realms.map((r) => r.ref) }),
    charges = new Set(arms.map((a) => a?.charge));
  say(
    `a realm's page: its picture ${model.portrait?.kind}, ${shields} shields beside names; ${arms.length} realms' arms, ${charges.size} kinds of charge`,
  );
  check(model.portrait?.kind === "arms" && pictured > 0, "a realm's page does not show its arms");
  check(shields >= 1, "the names on a realm's page bear no arms");
  check(charges.size >= 4, "the realms' arms are too alike");
  await k(`document.querySelector(".page-window .close")?.click()`);
}

// 2. Counters: the hosts on the globe, edged once their realm is followed; and in a land.
const wars = await q<{
  wars: {
    ref: string;
    ended: number | null;
    to: number;
    siege: number | null;
    attacker: { ref: string };
  }[];
}>("wars.map");
const war = wars.wars.find((w) => w.ended === null);
if (!war) say("no war being fought: the counters are not tried");
else {
  await follow(war.attacker.ref);
  await k(`document.querySelector(".page-window .close")?.click()`);
  await k(`globalThis.causalis.faceSpot(${war.to}, 1.9)`);
  const globe = await until(
    "counters on the globe",
    async () => (await shown(".labels .counter")) > 0,
    45000,
  );
  const stances = await until(
    "a counter edged by its stance",
    async () => (await shown(".labels .counter.ours, .labels .counter.foe")) > 0,
    30000,
  );
  const counters = await page.$$eval(".labels .counter:not([hidden])", (x) =>
    x.map(
      (e) =>
        `${e.classList.contains("ours") ? "ours " : e.classList.contains("foe") ? "foe " : ""}${e.textContent}`,
    ),
  );
  const cell = await k<number>(
    `globalThis.causalis.client.latestFrame("globe").arrays.province[${war.to}]`,
  );
  await k(`globalThis.causalis.descend(${cell})`);
  await until("the land fought over", async () => (await scale()) === "region", 60000);
  const land = await until(
    "counters in the land",
    async () => (await shown(".labels .counter")) > 0,
    45000,
  );
  say(
    `counters on the globe: ${counters.slice(0, 4).join(", ")}; edged: ${stances}; in the land: ${land ? await shown(".labels .counter") : 0}`,
  );
  check(globe && land, "the hosts are not counters on the globe and in their land");
  await k(`globalThis.causalis.zoomThrough("out")`);
  await until("the globe again", async () => (await scale()) === "globe", 60000);
}

// 3. Event windows: great happenings to what is followed, the clock waiting, the hand's answers.
{
  for (const r of realms.slice(0, 8)) await follow(r.ref);
  await k(`document.querySelector(".page-window .close")?.click()`);
  await k("globalThis.causalis.client.setSpeed(86400 * 365)");
  const came = await until(
    "a great happening's window",
    () => k<boolean>("globalThis.causalis.eventOpen()"),
    ci ? 240000 : 120000,
  );
  if (came) {
    await page.waitForTimeout(1500);
    const waited = await speed(),
      name = await page.$eval(".event-window .event-name", (e) => e.textContent ?? ""),
      answers = await page.$$eval(".event-window > .act", (x) => x.length),
      pictured = !!(await page.$(".event-window .event-picture"));
    // From now on as cards: those waiting let be, the clock given back.
    await k(`localStorage.setItem("causalis.events", "card")`);
    await until(
      "every window let be",
      async () => {
        if (!(await k<boolean>("globalThis.causalis.eventOpen()"))) return true;
        await press(".event-window .event-be");
        await page.waitForTimeout(400);
        return false;
      },
      60000,
    );
    await page.waitForTimeout(1500);
    const after = await speed();
    say(
      `a great happening: “${name}”, its picture ${pictured}, ${answers} answers of the hand; the clock ${waited} while open, ${after} after`,
    );
    check(waited === 0, "the clock did not wait while a great happening was open");
    check(after > 0, "the clock was not given back when the windows were let be");
  }
  await k("globalThis.causalis.client.setSpeed(0)");
}

// 4. Side by side: two realms compared; a war's tally.
{
  await opened(`${realms[0]!.ref}#compare`);
  await press(".page-window .entry");
  await until(
    "two realms side by side",
    async () => (await title()).includes("side by side"),
    30000,
  );
  const rows = await page.$$eval(".page-window .tally-row", (x) => x.length),
    compared = await title();
  const fought = (await q<{ wars: { ref: string }[] }>("wars.map")).wars[0];
  let tally = 0;
  if (fought) {
    await opened(fought.ref);
    tally = await page.$$eval(".page-window .tally-row", (x) => x.length);
  }
  say(
    `side by side: “${compared}”, ${rows} numbers pulled against each other; a war's tally: ${tally} rows`,
  );
  check(rows >= 6, "two realms side by side show too few numbers");
  check(!fought || tally >= 2, "a war's page has no tally");
  await k(`document.querySelector(".page-window .close")?.click()`);
}

// 5. The map closer: taken lands in shadow on the realms' map; seats under siege marked.
{
  await press(".mapmodes .mode[aria-label='Realms']");
  await page.waitForTimeout(3000);
  const legend = await page.$eval(".mapmodes", (e) => e.textContent ?? "").catch(() => "");
  const lens = await q<{ taken: unknown[] }>("war.lens"),
    now = await q<{ wars: { siege: number | null }[] }>("wars.map"),
    siege = now.wars.find((w) => w.siege !== null)?.siege ?? null;
  let marked = false;
  if (siege !== null) {
    await k(`globalThis.causalis.faceSpot(${siege}, 1.9)`);
    marked = await until(
      "a siege marked",
      async () =>
        (await page.$$eval(".labels > span:not([hidden])", (x) =>
          x.some((e) => (e.textContent ?? "").includes("besieged")),
        )) === true,
      30000,
    );
  }
  say(
    `the realms' map: ${lens.taken.length} lands in shadow, taken by force; sieges: ${now.wars.filter((w) => w.siege !== null).length}, one marked: ${siege === null ? "none to mark" : marked}`,
  );
  check(legend.includes("in shadow"), "the realms' map does not say what its shadows are");
}

await browser.close();
await server.close();
const real = errors.filter((e) => !/favicon|ERR_ABORTED/i.test(e));
if (real.length) problems.push(...real.slice(0, 5).map((e) => `the page logged: ${e}`));
console.log();
if (problems.length) {
  for (const p of problems) console.log(`  ✗ ${p}`);
  console.log("the Phase 11 gate fails");
  process.exit(1);
}
console.log("the Phase 11 gate passes");
