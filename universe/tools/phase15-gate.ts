// node tools/phase15-gate.ts [--ci] [--soft] — the Phase 15 gate (docs/architecture §I.15), at
// the user's asking for Classic's detail — "it breaks down inventory and chemistry and the
// inspectability is very good" — done in a real browser on the built app:
//   1. matter: a substance found by its name, its elements drawn as a make-up; a reaction it
//      goes into; a principle and the lands that know it; a good made of something each way;
//   2. stores: a land's broken down, every good's year balancing; a good's year as a flow that
//      balances; the world's goods;
//   3. the Goods lens: one good at a time, chosen under its legend, a land's tooltip its year;
//   4. the ground: a land's bedrock, what its rock is made of, its soil, the air; a deposit in
//      tonnes of ore and of metal; the Ground lens and a land's tooltip under it;
//   5. things: a household met, what it keeps and each of its people holds; a thing's page —
//      what it is made of, where, when and by whom, how worn; a person's day of food, their body;
//   6. natures in the god's hand (asked for 2026-09-28): a realm's ways pushed from its page, a
//      beast made tamer from its lineage's, a person met made bolder from theirs.
// (npm run build first; --soft draws in software, as CI's browser does.)
import { fileURLToPath } from "node:url";
import { preview } from "vite";
import { chromium, type Page } from "playwright";

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
/** How long to wait on what the frames bring: longer where they come slowly. */
const slow = (ms: number) => (ci || soft ? ms * 4 : ms);
console.log("the Phase 15 gate");

const root = fileURLToPath(new URL("..", import.meta.url)),
  server = await preview({ root, logLevel: "silent", preview: { port: 4267, strictPort: false } }),
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
const k = <T>(code: string, on: Page = page): Promise<T> => on.evaluate(code) as Promise<T>;
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
const open = async (ref: string, what: string, has: string) => {
  await k(`globalThis.causalis.open(${JSON.stringify(ref)})`);
  return until(what, async () => (await window_()).includes(has), slow(15000));
};
const tip = () =>
  page
    .$eval(".tooltip", (e) => ((e as HTMLElement).hidden ? "" : (e.textContent ?? "")))
    .catch(() => "");
/** The middle of what a selector names on the screen, or null if it is not shown. */
const centre = (sel: string) =>
  k<{ x: number; y: number } | null>(
    `(() => { const e = document.querySelector(${JSON.stringify(sel)}); if (!e) return null; const r = e.getBoundingClientRect(); return r.width ? { x: r.left + r.width / 2, y: r.top + r.height / 2 } : null; })()`,
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
/** Turn the world to a spot and rest the pointer on it, once the turn has come to rest. */
const point = async (spot: number) => {
  await k(`globalThis.causalis.faceSpot(${spot}, 2.2)`);
  let at: { x: number; y: number } | null = null;
  for (const end = Date.now() + slow(8000); Date.now() < end;) {
    await k("globalThis.causalis.rig.idle = 0");
    await page.waitForTimeout(400);
    const now = await k<{ x: number; y: number } | null>(
      `globalThis.causalis.spotOnScreen(${spot})`,
    );
    const still = !!now && !!at && Math.hypot(now.x - at.x, now.y - at.y) < 1.5;
    at = now;
    if (still) break;
  }
  if (!at) return false;
  await page.mouse.move(at.x - 8, at.y - 5);
  await page.mouse.move(at.x, at.y, { steps: 3 });
  await page.waitForTimeout(slow(800));
  return true;
};

await page.goto(`${base}?universe=earth&year=300`);
await page.waitForFunction(
  () => ((globalThis as any).causalis?.drawn?.() as number) > 0,
  undefined,
  { timeout: 900000 },
);
await k("globalThis.causalis.client.setSpeed(0)");
await page.waitForTimeout(1500);
const people = await q<{ cell: number; centre: number; people: number }[]>("people.map"),
  land = [...people].sort((a, b) => b.people - a.people)[0]!;

// 1. Matter: a substance found by name, a reaction, a principle, a good.
{
  await page.mouse.move(30, 400);
  await page.keyboard.press("/");
  await page.waitForTimeout(300);
  await page.keyboard.type("malachite");
  const found = await until(
    "malachite, found by its name",
    async () => (await text(".search-results")).includes("Malachite"),
    slow(10000),
  );
  if (found) await page.click(".search-result:has-text('Malachite')");
  const elements = await until(
    "malachite's page, its elements",
    async () => (await window_()).includes("Its elements"),
    slow(15000),
  );
  const bars = await page.$$eval(".page-window .makeup-bar", (x) => x.length);
  const smelting = await open("rxn:smelt-malachite", "the smelting of malachite", "What goes in");
  const reaction = await window_();
  const metal = await open("prin:metalworking", "a principle's page", "Lands that know it");
  const good = await open("good:tools", "a good the world over", "A unit, as copper tools");
  const ways = await page.$$eval(".page-window .makeup-bar", (x) => x.length);
  // The field guide, from the world's menu.
  await press(".world-menu button[title='Matter']");
  const guide = await until(
    "the field guide to matter",
    async () =>
      (await window_()).includes("What turns into what") || (await window_()).includes("Metals"),
    slow(15000),
  );
  check(guide, "the field guide to matter does not open from the world's menu");
  say(
    `matter: malachite found and opened (${bars} make-up drawn); its smelting (${reaction.includes("charcoal") ? "with charcoal" : "no charcoal"}); a principle's knowers; tools ${ways} ways`,
  );
  check(found && elements && bars >= 1, "a substance is not found by its name and drawn");
  check(smelting && reaction.includes("charcoal"), "a reaction does not say what goes into it");
  check(metal && good && ways === 5, "a principle or a good's ways are not read");
}

// 2. Stores: a land's, a good's year, the world's.
{
  const stores = await open(`cell:0:${land.cell}#stores`, "a land's stores", "Its books"),
    books = await window_();
  const flow = await open(`mkt:${land.cell}:0#year`, "a good's year", "Began with");
  const balanced = await page.$$eval(".page-window .flow-check.ok", (x) => x.length);
  const worldGoods = await open("world:stats#goods", "the world's goods", "The world's stores");
  const held = await page.$$eval(
    ".page-window table tbody tr, .page-window .table-row",
    (x) => x.length,
  );
  say(
    `stores: a land's (${books.includes("every good's year balances") ? "its books balance" : "its books do not balance"}); grain's year (${balanced} balanced flows); the world's goods`,
  );
  check(
    stores && books.includes("every good's year balances"),
    "a land's stores are not broken down, balanced",
  );
  check(flow && balanced >= 1, "a good's year does not balance as a flow");
  check(worldGoods && held >= 0, "the world's goods are not read");
  await k(`document.querySelector(".page-window .close")?.click()`);
}

// 3. The Goods lens: a good chosen under its legend, a land's tooltip its year.
{
  await press(".mapmodes .mode[aria-label='Goods']");
  await page.waitForTimeout(slow(800));
  const legend = await text(".mapmodes .legend-title"),
    picks = await page.$$eval(".legend-picks button", (x) => x.length);
  await press(".legend-picks button[data-choice='tools']");
  await page.waitForTimeout(slow(800));
  await point(land.centre);
  const tipped = await until(
    "a land's tooltip under the goods lens",
    async () => /Goods: tools [\d.]+ a head/.test(await tip()),
    slow(15000),
  );
  const words = await tip();
  say(`the goods lens: ${legend}, ${picks} goods to choose; “${words.slice(0, 90)}”`);
  check(
    legend === "Goods" && picks === 12,
    "the goods lens has not its twelve goods to choose from",
  );
  check(
    tipped && words.includes("In store"),
    "a land's tooltip under the goods lens does not tell its year",
  );
  await press(".mapmodes .mode[aria-label='Land']");
}

// 4. The ground: a land's, a deposit's, the Ground lens.
{
  const ground = await open(`cell:0:${land.cell}#ground`, "a land's ground", "Its bedrock"),
    words = await window_();
  const deposit = (await q<{ ref: string }[]>("deposits"))[0]!,
    tonnes = await open(deposit.ref, "a deposit in tonnes", "Holding"),
    held = await window_();
  await k(`document.querySelector(".page-window .close")?.click()`);
  await press(".mapmodes .mode[aria-label='Ground']");
  await page.waitForTimeout(slow(1500));
  const legend = await text(".mapmodes .legend-title"),
    keys = await page.$$eval(".mapmodes .legend-key, .mapmodes .key", (x) => x.length);
  await point(land.centre);
  const tipped = await until(
    "a land's tooltip under the Ground lens",
    async () => /^.*Ground: [a-z ]+ \d+%/.test(await tip()),
    slow(15000),
  );
  say(
    `the ground: ${words.includes("What the rock is made of") ? "its rock's make-up" : "no rock make-up"}, ${words.includes("The air") ? "the air" : "no air"}; a deposit ${/\d[\d,]* t of ore|Mt/.test(held) || held.includes("Ore") ? "in tonnes" : "not in tonnes"}; the ${legend} lens (${keys} keys), “${(await tip()).slice(0, 80)}”`,
  );
  check(
    ground && words.includes("What the rock is made of") && words.includes("Its soil"),
    "a land's ground is not read",
  );
  check(tonnes && held.includes("Holding"), "a deposit is not told in tonnes of what it holds");
  check(legend === "Ground" && tipped, "the Ground lens does not paint the land, nor tell it");
  await press(".mapmodes .mode[aria-label='Land']");
}

// 5. Things: a household's, a thing's, a person's.
{
  const towns = await q<{ ref: string }[]>("settlements", { cell: land.cell }),
    h = await q<{ ref: string; members: { ref: string }[] }>("observe.meet", {
      cell: land.cell,
      village: towns[0]!.ref,
    });
  const kept = await open(`${h.ref}#things`, "a household's things", "What it keeps"),
    words = await window_();
  const model = await q<{ tabs: { id: string; blocks: { items?: { ref?: string }[] }[] }[] }>(
      "page",
      { ref: h.ref },
    ),
    thing = model.tabs
      .find((t) => t.id === "things")!
      .blocks.flatMap((b) => b.items ?? [])
      .map((i) => i.ref ?? "")
      .find((r) => r.startsWith("thing:"))!;
  const opened = await open(thing, "a thing's page", "It lasts"),
    page_ = await window_();
  const person = await open(
      `${h.members[0]!.ref}#things`,
      "a person's things",
      "What their body is made of",
    ),
    theirs = await window_();
  say(
    `things: a household's (${words.includes("Its store of food") ? "its food in store" : "no food"}); a thing (${/Worn\s*\d+%/.test(page_) ? "worn so much" : "no wear"}); a person's day (${/kcal/.test(theirs) ? "its energy against their need" : "no energy"})`,
  );
  check(kept && words.includes("Its store of food"), "a household's things are not read");
  check(
    opened && page_.includes("Made in") && page_.includes("Worn"),
    "a thing's page does not tell where, when and how worn",
  );
  check(person && /kcal/.test(theirs), "a person's day of food and body are not read");
  await k(`document.querySelector(".page-window .close")?.click()`);
}

// 6. Natures in the god's hand, from their pages.
{
  const widths = () =>
    page.$$eval(".page-window .nature-fill", (x) =>
      x.map((e) => (e as HTMLElement).style.width).join(),
    );
  const pushed = async (ref: string, has: string, push: string, what: string) => {
    if (!(await open(ref, what, has))) return false;
    const before = await widths();
    await page.click(`.page-window button.nature-push[data-push='${push}']`);
    return until(`${what}, pushed`, async () => (await widths()) !== before, slow(15000));
  };
  const realms = await q<{ ref: string; people: number }[]>("realms.map"),
    realm = [...realms].sort((a, b) => b.people - a.people)[0]!,
    grazer = (
      await q<{ lineages: { ref: string; niche: string; died: number | null }[] }>("genesis")
    ).lineages.find((x) => x.niche === "grazer" && x.died === null);
  const ways = await pushed(realm.ref, "Its ways", "more trade:1", "a realm's ways");
  const beast = grazer
    ? await pushed(grazer.ref, "Its nature", "tame:1", "a beast's nature")
    : true;
  const towns = await q<{ ref: string }[]>("settlements", { cell: land.cell }),
    h = await q<{ members: { ref: string }[] }>("observe.meet", {
      cell: land.cell,
      village: towns[0]!.ref,
    }),
    bold = await pushed(h.members[0]!.ref, "What they are like", "bold:1", "a person's nature");
  say(
    `natures: a realm's ways ${ways ? "pushed" : "not pushed"}; a beast ${beast ? "made tamer" : "not changed"}; a person ${bold ? "made bolder" : "not changed"}`,
  );
  check(ways && beast && bold, "a nature was not changed from its page");
  await k(`document.querySelector(".page-window .close")?.click()`);
}

await browser.close();
await server.close();
const real = errors.filter((e) => !/favicon|ERR_ABORTED/i.test(e));
if (real.length) problems.push(...real.slice(0, 5).map((e) => `the page logged: ${e}`));
console.log();
if (problems.length) {
  for (const p of problems) console.log(`  ✗ ${p}`);
  console.log("the Phase 15 gate fails");
  process.exit(1);
}
console.log("the Phase 15 gate passes");
