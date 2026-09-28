// node tools/phase10-gate.ts [--ci] — the Phase 10 gate (docs/architecture §I.10, milestone 99),
// what the viewer asked for, done in a real browser on the built app:
//   1. everything is a page: a land, a town, a realm, a person, a war, a battle, a lineage, a
//      star — each opened by a tap or a link, its numbers explained (the book of concepts);
//   2. the pointer tells what it rests on (a tooltip), and everything drawn can be picked;
//   3. a grand strategy game's chrome: realms named across the political map, its modes and
//      legends, the top bar's numbers opening what they count and broken down in tooltips,
//      search, the outliner, the alerts (a tooltip over a tooltip), the message log, a
//      page's way up, the chronicle and the ledger;
//   4. zoom goes both ways, toward the pointer, and what is seen at one scale is seen at the
//      next: a battle on the globe zoomed into is in its land, and its village faces it;
//   5. go-to flies, and a person can be kept in view;
//   6. free roam: walked among a village's people, and flown up out of it through its land
//      to the world, and down again;
//   7. zoomed into another star, its own system; into one of its worlds, and back out again.
// (npm run build first; --soft draws in software, as CI's browser does.)
import { fileURLToPath } from "node:url";
import { preview } from "vite";
import { chromium, type Page } from "playwright";

const ci = process.argv.includes("--ci"),
  // (Drawn in software, as CI's browser draws with no GPU: its frames come slowly.)
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
console.log("the Phase 10 gate");

const root = fileURLToPath(new URL("..", import.meta.url)),
  server = await preview({ root, logLevel: "silent", preview: { port: 4262, strictPort: false } }),
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
// (The pointer is taken there and pressed, or rested, as a viewer's is — not by Playwright's
// own checks, which wait for two frames alike: long where the frames come slowly, as in CI.)
const press = async (sel: string) => {
  const at = await centre(sel);
  if (!at) {
    problems.push(`${sel} was not there to press`);
    return false;
  }
  await page.mouse.click(at.x, at.y);
  return true;
};
const rest = async (sel: string) => {
  const at = await centre(sel);
  if (!at) return false;
  await page.mouse.move(at.x - 3, at.y);
  await page.mouse.move(at.x, at.y);
  return true;
};
/** Do `step` until `done`, for at most `ms` (by time, not by count: the frames may come slowly). */
const whileNot = async (done: () => Promise<boolean>, step: () => Promise<void>, ms: number) => {
  const end = Date.now() + ms;
  while (Date.now() < end && !(await done())) await step();
};

await page.goto(`${base}?universe=earth&year=400`);
await page.waitForFunction(
  () => ((globalThis as any).causalis?.drawn?.() as number) > 0,
  undefined,
  {
    timeout: 900000,
  },
);
// (Held still: what is chosen stays as it was chosen.)
await k("globalThis.causalis.client.setSpeed(0)");
await page.waitForTimeout(1500);

// 1. Everything a page, its numbers explained.
{
  const map = await k<{ cell: number; people: number; centre: number }[]>(
      `globalThis.causalis.client.query({ type: "people.map" })`,
    ),
    land = [...map].sort((a, b) => b.people - a.people)[0]!,
    towns = await k<{ ref: string; name: string }[]>(
      `globalThis.causalis.client.query({ type: "settlements", args: { cell: ${land.cell} } })`,
    ),
    realms = await k<{ ref: string; people: number }[]>(
      `globalThis.causalis.client.query({ type: "realms.map" })`,
    ),
    wars = await k<{ year: number; wars: { ref: string; battles: { event: string }[] }[] }>(
      `globalThis.causalis.client.query({ type: "wars.map" })`,
    );
  const refs = [
    `cell:0:${land.cell}`,
    towns[0]!.ref,
    [...realms].sort((a, b) => b.people - a.people)[0]!.ref,
    ...(wars.wars[0] ? [wars.wars[0].ref] : []),
    ...(wars.wars.find((w) => w.battles.length)
      ? [wars.wars.find((w) => w.battles.length)!.battles[0]!.event]
      : []),
    "world:chronicle",
    "world:ledger",
    "concept:index",
  ];
  const titles: string[] = [];
  for (const ref of refs) {
    await opened(ref);
    titles.push(await title());
  }
  say(`pages opened: ${titles.map((t) => `“${t}”`).join(", ")}`);
  check(
    titles.every((t) => t.length > 1),
    "a page opened without a title",
  );
  // A land's numbers link to their concepts; one opens its page.
  await opened(`cell:0:${land.cell}`);
  const concepts = await page.$$(".page-window .concept-link");
  say(`a land's numbers explained: ${concepts.length} linked to the book of concepts`);
  check(concepts.length >= 2, "a land's numbers are not linked to the book of concepts");
  if (concepts[0]) {
    await press(".page-window .concept-link");
    await page.waitForTimeout(1200);
    const t = await title(),
      lines = await page.$$eval(".page-window .block-text p", (x) => x.length);
    say(`a concept opened: “${t}”, ${lines} lines`);
    check(lines >= 2, "a concept's page says too little");
  }
  const index = await k<{ tabs: { blocks: { items?: unknown[] }[] }[] }>(
    `globalThis.causalis.client.query({ type: "page", args: { ref: "concept:index" } })`,
  );
  const count = index.tabs[0]?.blocks[0]?.items?.length ?? 0;
  say(`the book of concepts: ${count} concepts`);
  check(count >= 12, "the book of concepts is thin");
  // Its way up: a town's page leads up through its realm and land.
  await opened(towns[0]!.ref);
  const crumbs = await page
    .$eval(".page-window .page-crumbs", (e) => e.textContent ?? "")
    .catch(() => "");
  say(`a town's way up: ${crumbs}`);
  check(crumbs.startsWith("The world") && crumbs.includes("›"), "a page shows no way up");
  await k(`document.querySelector(".page-window .close")?.click()`);
}

// 2. The pointer tells what it rests on.
{
  await page.mouse.move(683, 470);
  await page.mouse.move(690, 474);
  const shown = await until(
    "a tooltip over the globe",
    async () => !(await page.$eval(".tooltip", (e) => (e as HTMLElement).hidden)),
    8000,
  );
  if (shown)
    say(`a tooltip: ${(await page.$eval(".tooltip", (e) => e.textContent ?? "")).slice(0, 80)}`);
  await page.mouse.move(5, 790);
}

// 3. The chrome: the political map, its modes; the top bar's numbers; search; the outliner.
{
  await press(".mapmodes .mode[aria-label='Realms']");
  await page.waitForTimeout(6000);
  const names = await page.$$eval(".mapname", (x) => x.length);
  say(`realms named across the map: ${names}`);
  check(names >= 3, "the political map names too few realms");
  for (const mode of ["Diplomacy", "War"]) {
    await press(`.mapmodes .mode[aria-label='${mode}']`);
    await page.waitForTimeout(2500);
    const legend = await page.$eval(".mapmodes .legend-title", (e) => e.textContent ?? "");
    check(legend === mode, `the ${mode} map mode did not show its legend`);
  }
  await press(".mapmodes .mode[aria-label='Land']");
  // A chip of the top bar: its tab of the ledger.
  await press(".world-stats .stat-chip:nth-child(3)");
  await page.waitForTimeout(1500);
  const tab = await page.$eval(".page-window .tab.on", (e) => e.textContent ?? "").catch(() => "");
  say(`the realms' number opens: ${await title()}, on ${tab}`);
  check(tab === "Realms", "the top bar's realms did not open the ledger's realms");
  // Search.
  await page.keyboard.press("/");
  const realm = await k<string>(
    `globalThis.causalis.client.query({ type: "realms.map" }).then((r) => r.sort((a, b) => b.people - a.people)[0].short)`,
  );
  await page.keyboard.type(realm);
  await page.waitForSelector(".search-result", { timeout: 15000 });
  const found = await page.$$eval(".search-result .search-title", (x) =>
    x.map((e) => e.textContent ?? ""),
  );
  say(`searched for “${realm}”: ${found.slice(0, 4).join(", ")}`);
  check(
    found.some((f) => f.includes(realm)),
    "search did not find a realm by its seat's name",
  );
  await press(".search-result");
  await page.waitForTimeout(1500);
  // Follow it: the outliner lists it.
  const follow = await page.$(".page-window .follow");
  if (follow) {
    await press(".page-window .follow");
    await page.waitForTimeout(1500);
  }
  await press(".outliner-open");
  await page.waitForTimeout(500);
  const outlined = await page.$$eval(".outliner-row", (x) => x.length);
  say(`the outliner: ${outlined} followed`);
  check(outlined >= 1, "what was followed is not in the outliner");
  await press(".outliner-open");
  // The alerts: a realm at war followed, its war lit under the bar; rested on, its cases told,
  // and a name in them told in turn; tapped, listed.
  const fighting = await k<{ ref: string } | undefined>(
    `globalThis.causalis.client.query({ type: "world.breakdown", args: { what: "wars" } }).then((b) => b.lines[0]?.[0])`,
  );
  if (fighting) {
    const war = await k<{ subtitle: ({ ref?: string } | string)[] }>(
        `globalThis.causalis.client.query({ type: "page", args: { ref: ${JSON.stringify(fighting.ref)} } })`,
      ),
      side = war.subtitle.find((x) => typeof x !== "string" && x.ref?.startsWith("pol:")) as
        { ref: string } | undefined;
    if (side)
      await k(
        `globalThis.causalis.client.query({ type: "observe.watch", args: { ref: ${JSON.stringify(side.ref)}, on: true } })`,
      );
    const lit = await until(
      "the war alert",
      async () => (await page.$$(".alerts-row .alert.tone-war")).length > 0,
      30000,
    );
    if (lit) {
      const alerts = await page.$$eval(".alerts-row .alert", (x) =>
        x.map((e) => e.getAttribute("aria-label") ?? ""),
      );
      await rest(".alerts-row .alert.tone-war");
      await until(
        "the war alert's tooltip",
        async () => (await page.$$(".hovertip")).length > 0,
        5000,
      );
      const tip = await page.$eval(".hovertip", (e) => e.textContent ?? "").catch(() => "");
      await rest(".hovertip .ref-link");
      const nested = await until(
        "a tooltip over the tooltip",
        async () => (await page.$$(".hovertip")).length >= 2,
        5000,
      );
      await page.mouse.move(683, 790);
      await page.waitForTimeout(800);
      const left = (await page.$$(".hovertip")).length;
      await press(".alerts-row .alert.tone-war");
      const listed = await page.$$eval(".alert-list:not([hidden]) .alert-open", (x) => x.length);
      await press(".alerts-row .alert.tone-war");
      say(
        `alerts: ${alerts.join(", ")}; told: ${tip.slice(0, 70)}…; a name in it told: ${nested}; put away: ${left === 0}; listed: ${listed}`,
      );
      check(
        tip.includes("war") || tip.includes("War"),
        "the war alert's tooltip did not tell its war",
      );
      check(left === 0, "the tooltips stayed when the pointer left them");
      check(listed >= 1, "the war alert did not list its war");
    }
  } else say("no war being fought: the war alert is not tried");
  // The top bar's people, broken down by realm.
  await rest(".world-stats .stat-chip:nth-child(1)");
  await until("the people's breakdown", async () => (await page.$$(".hovertip")).length > 0, 5000);
  const people = await page.$eval(".hovertip", (e) => e.textContent ?? "").catch(() => "");
  say(`the people broken down: ${people.slice(0, 90)}…`);
  check(people.includes("The most peopled realms"), "the top bar's people were not broken down");
  await page.mouse.move(683, 790);
  // Two years pass; the message log keeps what was told of what is followed.
  await k("globalThis.causalis.client.setSpeed(86400 * 365)");
  await page.waitForTimeout(2000);
  await k("globalThis.causalis.client.setSpeed(0)");
  await page.waitForTimeout(2000);
  await press(".log-open");
  await until("the message log", async () => (await title()) === "The message log", 15000);
  const told = await page.$$eval(".page-window .table tr.entry", (x) => x.length);
  say(`the message log: ${told} told`);
  // The chronicle and the ledger: their tabs.
  await opened("world:chronicle");
  const ctabs = await page.$$eval(".page-window .tab", (x) => x.map((e) => e.textContent ?? ""));
  await opened("world:ledger");
  const ltabs = await page.$$eval(".page-window .tab", (x) => x.map((e) => e.textContent ?? ""));
  say(`the chronicle's tabs: ${ctabs.join(", ")}; the ledger's: ${ltabs.join(", ")}`);
  check(ctabs.includes("Firsts") && ctabs.includes("Ages"), "the chronicle lacks its comparisons");
  check(ltabs.includes("Realms") && ltabs.includes("Wars"), "the ledger lacks its tables");
  await k(`document.querySelector(".page-window .close")?.click()`);
}

// 4. Zoom both ways: a battle on the globe zoomed into, in its land, faced in its village.
{
  const wars = await k<{ year: number; wars: { battles: { spot: number; year: number }[] }[] }>(
      `globalThis.causalis.client.query({ type: "wars.map" })`,
    ),
    battle = wars.wars
      .flatMap((w) => w.battles)
      .filter((b) => b.spot >= 0 && wars.year - b.year <= 1)
      .sort((a, b) => b.year - a.year)[0];
  if (!battle) say("no battle lately: the zoom through a battle is not tried");
  else {
    await k(`globalThis.causalis.faceSpot(${battle.spot}, 1.5)`);
    await page.waitForTimeout(1500);
    await whileNot(
      async () => (await scale()) !== "globe",
      async () => {
        const at = (await k<{ x: number; y: number } | null>(
          `globalThis.causalis.spotOnScreen(${battle.spot})`,
        )) ?? { x: 683, y: 470 };
        await page.mouse.move(at.x, at.y);
        await page.mouse.wheel(0, -240);
        await page.waitForTimeout(60);
      },
      120000,
    );
    await page.waitForTimeout(2500);
    const land = await k<{ battles: number; marches: number }>("globalThis.causalis.landWars()");
    say(
      `zoomed into the battle's land: ${await scale()}, ${land.battles} battles and ${land.marches} hosts drawn`,
    );
    check(
      (await scale()) === "region" && land.battles >= 1,
      "a battle zoomed into was not in its land",
    );
    const label = async () =>
      k<{ x: number; y: number } | null>(
        `(() => { const l = [...document.querySelectorAll(".labels > *")].find((e) => e.textContent.includes("A battle of")); if (!l) return null; const r = l.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.bottom + 14 }; })()`,
      );
    await whileNot(
      async () => (await scale()) !== "region",
      async () => {
        const at = await label();
        if (at) await page.mouse.move(at.x, at.y);
        await page.mouse.wheel(0, -240);
        await page.waitForTimeout(60);
      },
      120000,
    );
    // Come down, and the swoop in to the fight over (it may be slow to draw).
    await page.waitForTimeout(3500);
    await whileNot(
      async () => !(await k<boolean>("globalThis.causalis.rig.flying")),
      () => page.waitForTimeout(250),
      30000,
    );
    // What the middle of the view is on (about it: a villager or a beast may pass before it).
    const view = { on: null as string | null };
    await whileNot(
      async () => !!view.on?.startsWith("ev:"),
      async () => {
        view.on = await k<string | null>(
          `(() => { const c = globalThis.causalis, top = document.querySelector(".panel:not([hidden]) > header.bar").getBoundingClientRect().bottom, x = innerWidth / 2, y = (innerHeight + top) / 2; for (const dx of [0, -40, 40, -80, 80]) for (const dy of [0, -30, 30]) { const r = c.refAt(x + dx, y + dy); if (r && r.startsWith("ev:")) return r; } return c.refAt(x, y); })()`,
        );
        if (!view.on?.startsWith("ev:")) await page.waitForTimeout(500);
      },
      20000,
    );
    const fight = view.on;
    say(`on into its village: ${await scale()}, the view on ${fight ?? "nothing"}`);
    check(
      (await scale()) === "village",
      "zooming into a land's battle did not come to its village",
    );
    check(!!fight && fight.startsWith("ev:"), "the village's view does not face its battle");
    // And back out again, both ways.
    await whileNot(
      async () => (await scale()) === "globe",
      async () => {
        await page.mouse.wheel(0, 240);
        await page.waitForTimeout(40);
      },
      120000,
    );
    await page.waitForTimeout(1500);
    check((await scale()) === "globe", "zooming out from a village did not come back to the globe");
  }
}

// 5. Go-to flies; a person kept in view.
{
  const realms = await k<{ ref: string; people: number }[]>(
    `globalThis.causalis.client.query({ type: "realms.map" })`,
  );
  await opened([...realms].sort((a, b) => b.people - a.people)[2]!.ref);
  await press(".page-window .go-to");
  const rig = { flying: false };
  await whileNot(
    async () => rig.flying,
    async () => {
      rig.flying = await k<boolean>("globalThis.causalis.rig.flying");
      if (!rig.flying) await page.waitForTimeout(100);
    },
    10000,
  );
  const flying = rig.flying;
  await page.waitForTimeout(1500);
  say(`“go to” a realm on the globe: ${flying ? "flown there" : "not flown"}, at ${await scale()}`);
  check(flying && (await scale()) === "globe", "go-to did not fly within the globe");
}

// 6. Free roam: walked, and flown out through the scales and down again.
{
  const map = await k<{ cell: number; people: number }[]>(
      `globalThis.causalis.client.query({ type: "people.map" })`,
    ),
    land = [...map].sort((a, b) => b.people - a.people)[0]!,
    towns = await k<{ ref: string }[]>(
      `globalThis.causalis.client.query({ type: "settlements", args: { cell: ${land.cell} } })`,
    );
  await k(`globalThis.causalis.goTo(${JSON.stringify(towns[0]!.ref)})`);
  await until("the village gone to", async () => (await scale()) === "village", 90000);
  await page.waitForTimeout(2500);
  // Kept in view: a person of the village (from its plan: at night they are indoors, not to
  // be found on the screen), their page, its scene action.
  const plan = await k<{ people: { ref: string }[] }>(
      `globalThis.causalis.client.query({ type: "village.plan", args: { ref: ${JSON.stringify(towns[0]!.ref)} } })`,
    ),
    person = plan.people[0]?.ref ?? null;
  if (person) {
    await opened(person);
    const act = await page.$(".page-window .scene-act");
    if (act) await press(".page-window .scene-act");
    await page.waitForTimeout(500);
    const kept = await page
      .$eval(".page-window .scene-act", (e) => e.textContent ?? "")
      .catch(() => "");
    say(`a person kept in view: ${kept}`);
    check(kept.includes("✓"), "a person could not be kept in view");
    await k(`document.querySelector(".page-window .close")?.click()`);
  } else problems.push("the village has no one to keep in view");
  await press(".free-walk");
  await page.waitForTimeout(600);
  const walking = await k<string>("globalThis.causalis.roaming()");
  await page.keyboard.down("KeyW");
  await page.waitForTimeout(1500);
  await page.keyboard.up("KeyW");
  await press(".free-fly");
  await page.keyboard.down("ShiftLeft");
  await page.keyboard.down("KeyE");
  await until(
    "the land, flown up out of the village",
    async () => (await scale()) === "region",
    30000,
  );
  // (Let go the moment the world comes: held on, it would go on rising into the sky.)
  for (let i = 0; i < 1200 && (await scale()) !== "globe"; i++) await page.waitForTimeout(50);
  await page.keyboard.up("KeyE");
  await page.keyboard.up("ShiftLeft");
  check((await scale()) === "globe", "the world, flown up out of the land, did not come");
  // Given back and taken again: the camera faces the world squarely (however high it rose) —
  // once it has come through into the world and is flying there again.
  await until(
    "flying over the world",
    async () =>
      (await k<string>("globalThis.causalis.roaming()")) === "fly" &&
      !(await k<{ passing: boolean }>("globalThis.causalis.freeState()")).passing,
    15000,
  );
  await page.keyboard.press("Escape");
  await page.waitForTimeout(400);
  await press(".free-fly");
  await page.waitForTimeout(400);
  // (Over the land flown up out of: the dive comes down into it.)
  const below = await k<{ province: number } | null>("globalThis.causalis.spotBelow()");
  say(`over the world, above the land flown from: ${below?.province === land.cell}`);
  check(below?.province === land.cell, "flown up out of a land, the world was not faced over it");
  await page.keyboard.down("KeyW");
  const dived = await until(
    "a land, flown down from the world",
    async () => (await scale()) === "region",
    60000,
  );
  await page.keyboard.up("KeyW");
  // (Once through into the land and flying there again.)
  for (let i = 0; i < 100; i++) {
    const on = await k<boolean>(
      `globalThis.causalis.roaming() === "fly" && !globalThis.causalis.freeState().passing`,
    );
    if (on) break;
    await page.waitForTimeout(100);
  }
  const flown = await k<string>("globalThis.causalis.roaming()");
  await page.keyboard.press("Escape");
  await page.waitForTimeout(500);
  const back = await k<string>("globalThis.causalis.roaming()");
  say(
    `free roam: ${walking} in the village, ${flown} out to the world and down again, ${back} after Esc`,
  );
  check(
    walking === "walk" && flown === "fly" && back === "orbit",
    "free roam did not walk, fly and give the camera back",
  );
}

// 7. The stars: into another star's own system, into one of its worlds, and back out again.
{
  await k("globalThis.causalis.stars()");
  await until("the stars about us", async () => (await scale()) === "cluster", 60000);
  await page.waitForTimeout(1500);
  const star = await k<{ ref: string } | null>(
    `globalThis.causalis.client.query({ type: "galaxy.cluster" }).then((c) => c.stars.find((s) => s.distance > 0 && s.planets > 1) ?? null)`,
  );
  if (!star) say("no star about us with worlds: its system is not tried");
  else {
    const ref = JSON.stringify(star.ref),
      skyOf = () => k<string | null>("globalThis.causalis.skyOf()");
    // (Zoomed through toward the star under the pointer.)
    const at = await k<{ x: number; y: number } | null>(`globalThis.causalis.starOnScreen(${ref})`);
    await k(`globalThis.causalis.rig.pointer = ${JSON.stringify(at)}`);
    await k(`globalThis.causalis.zoomThrough("in")`);
    await until("its system", async () => (await skyOf()) === star.ref, 60000);
    const bodies = await k<number>("globalThis.causalis.skyBodies()");
    await k("globalThis.causalis.rig.pointer = null");
    await k(`globalThis.causalis.zoomThrough("in")`);
    const world = await until("one of its worlds", async () => (await scale()) === "world", 60000);
    await k(`globalThis.causalis.zoomThrough("out")`);
    const back = await until("its system again", async () => (await skyOf()) === star.ref, 60000);
    await k(`globalThis.causalis.zoomThrough("out")`);
    const out = await until("the stars again", async () => (await scale()) === "cluster", 60000);
    say(
      `into another star's system: ${bodies} worlds; into one: ${world}; back to its system: ${back}; out to the stars: ${out}`,
    );
    check(bodies >= 2, "another star's system showed too few worlds");
  }
}

await browser.close();
await server.close();
const real = errors.filter((e) => !/favicon|ERR_ABORTED/i.test(e));
if (real.length) problems.push(...real.slice(0, 5).map((e) => `the page logged: ${e}`));
console.log();
if (problems.length) {
  for (const p of problems) console.log(`  ✗ ${p}`);
  console.log("the Phase 10 gate fails");
  process.exit(1);
}
console.log("the Phase 10 gate passes");
