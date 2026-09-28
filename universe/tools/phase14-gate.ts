// node tools/phase14-gate.ts [--ci] [--soft] — the Phase 14 gate (docs/architecture §I.14,
// milestones 117–120), at the user's asking for a god who changes a people's ways, speech and
// faith, and for people to click through, done in a real browser on the built app:
//   1. ways, speech and faith from the palette: a people's way pushed (the way and which way
//      chosen), a faith founded (its tenet chosen), a tongue taught from one land to another,
//      a land given a tongue of its own;
//   2. the ways and belief lenses: the way chosen from the legend, a land's tooltip under each
//      breaking it down (what pushed their ways; what they have seen of the god);
//   3. one of the people under the hand: what they are like as chips (a trait's page opened
//      from one), their family as a tree walked to their mother's, a trait given by the hand;
//   4. a people read: its tongue's sounds and words, the god as they name it from what they
//      saw, their ways; a realm's faith and tongue;
//   5. (asked for 2026-09-28) the view still when left alone, turning only when chosen in the
//      settings; the main menu from a world keeps it and goes to the title screen, where
//      Continue takes it up again; a new world, of another kind, begun from the title.
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
console.log("the Phase 14 gate");

const root = fileURLToPath(new URL("..", import.meta.url)),
  server = await preview({ root, logLevel: "silent", preview: { port: 4266, strictPort: false } }),
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
const text = (sel: string) => page.$eval(sel, (e) => e.textContent ?? "").catch(() => "");
const words = () => text(".palette-words");
const tip = () =>
  page
    .$eval(".tooltip", (e) => ((e as HTMLElement).hidden ? "" : (e.textContent ?? "")))
    .catch(() => "");
/**
 * Turn the world to a spot, then take the pointer there as a viewer's hand would (moved onto
 * it, so the page sees it come), and — if asked — touch it. The screen point is read at once:
 * the orbit drifts when left.
 */
const point = async (spot: number, touch: boolean) => {
  await k(`globalThis.causalis.faceSpot(${spot}, 2.2)`);
  // Once the turn has come to rest (where frames come slowly it takes the longer), the orbit
  // kept from idling into its drift, the pointer is taken there.
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
  await k("globalThis.causalis.rig.idle = 0");
  await page.mouse.move(at.x - 8, at.y - 5);
  await page.mouse.move(at.x, at.y, { steps: 3 });
  if (touch) {
    await page.mouse.down();
    await page.mouse.up();
  } else await page.waitForTimeout(slow(800));
  return true;
};
/** The palette's act taken in hand, its kind's tab chosen first. */
const take = async (act: string, tab: string) => {
  await press(`.palette-tab[data-kind='${tab}']`);
  await page.waitForTimeout(200);
  await press(`.palette-act[data-act='${act}']`);
  await page.waitForTimeout(300);
  return k<string | null>("globalThis.causalis.palette.holding()");
};
/** Cast the act in hand on a spot: touched, and told (done, or refused and why). */
const cast = async (spot: number, what: string) => {
  await point(spot, true);
  let told = "";
  await until(
    what,
    async () => {
      told = await words();
      return /Done|cannot|no tongue|is no realm|already/.test(told);
    },
    slow(20000),
  );
  return told;
};
const kindsPlaying = async () =>
  new Set((await q<{ acts: { kind: string }[] }>("acts.map")).acts.map((a) => a.kind));

await page.goto(`${base}?universe=earth&year=400`);
await page.waitForFunction(
  () => ((globalThis as any).causalis?.drawn?.() as number) > 0,
  undefined,
  { timeout: 900000 },
);
await k("globalThis.causalis.client.setSpeed(0)");
await page.waitForTimeout(1500);
type Land = {
  cell: number;
  name: string;
  tongue: { ref: string; name: string } | null;
  realm: { ref: string; name: string } | null;
};
const people = await q<{ cell: number; centre: number; people: number }[]>("people.map"),
  lands = [...people].sort((a, b) => b.people - a.people),
  land = (cell: number) => q<Land>("palette.land", { cell });
const first = await land(lands[0]!.cell);

// 1. Ways, speech and faith from the palette.
{
  await take("ways", "ways");
  await press(".palette-choices button[data-choice='piety']");
  // (Less given to it.)
  await press(".palette-choices .palette-sign");
  const ways = await cast(lands[0]!.centre, "a people's way pushed");
  await take("faith", "ways");
  await press(".palette-choices button[data-choice='fire']");
  const faith = await cast(lands[1]!.centre, "a faith founded");
  // A tongue taught: from a land that speaks it, to one that speaks another.
  const from = await land(lands[2]!.cell);
  let to: (typeof lands)[number] | null = null;
  for (const l of lands.slice(3, 60)) {
    const t = await land(l.cell);
    if (t.tongue && from.tongue && t.tongue.ref !== from.tongue.ref) {
      to = l;
      break;
    }
  }
  await take("tongue", "ways");
  await point(lands[2]!.centre, true);
  await until(
    "the tongue to teach chosen",
    async () => (await words()).includes("now touch the land"),
    slow(15000),
  );
  const taught = to ? await cast(to.centre, "a tongue taught") : "no land of another tongue";
  const was = await land(lands[3]!.cell);
  await take("newtongue", "ways");
  const own = await cast(lands[3]!.centre, "a tongue of their own");
  const kinds = await kindsPlaying(),
    after = await land(lands[3]!.cell);
  say(
    `ways, speech and faith: “${ways}” · “${faith}” · “${taught}” · “${own}”; playing: ${[...kinds].sort().join(", ")}`,
  );
  check(
    ways.includes("Done") && ways.includes("less given to piety") && kinds.has("ways"),
    "a people's way was not pushed from the palette, the way and its sign chosen",
  );
  check(
    faith.includes("Done") && /flame/i.test(faith) && kinds.has("faith"),
    "a faith was not founded from the palette with its tenet chosen",
  );
  check(!to || (taught.includes("Done") && kinds.has("tongue")), "a tongue was not taught");
  check(
    own.includes("Done") && !!after.tongue && after.tongue.name !== was.tongue?.name,
    "a land was not given a tongue of its own",
  );
  await page.keyboard.press("Escape");
  await page.mouse.move(30, 400);
}

// 2. The ways and belief lenses: the way chosen from the legend, a land's tooltip under each.
{
  await press(".mapmodes .mode[aria-label='Ways']");
  await page.waitForTimeout(slow(800));
  const legend = await text(".mapmodes .legend-title"),
    picks = await page.$$eval(".legend-picks button", (x) => x.length);
  await press(".legend-picks button[data-choice='piety']");
  await page.waitForTimeout(slow(800));
  await point(lands[0]!.centre, false);
  const waysTipped = await until(
    "a land's tooltip under the ways lens",
    async () => /Ways: piety \d+%/.test(await tip()),
    slow(15000),
  );
  const waysTip = await tip();
  await page.mouse.move(30, 400);
  await press(".mapmodes .mode[aria-label='Belief']");
  await page.waitForTimeout(slow(800));
  const beliefLegend = await text(".mapmodes .legend-title");
  await point(lands[0]!.centre, false);
  const beliefTipped = await until(
    "a land's tooltip under the belief lens",
    async () => (await tip()).includes("Belief:"),
    slow(15000),
  );
  const beliefTip = await tip();
  say(
    `lenses: ${legend} (${picks} ways to choose), ${beliefLegend}; tips: “${waysTip.slice(0, 80)}” · “${beliefTip.slice(0, 80)}”`,
  );
  check(legend === "Ways" && picks === 8, "the ways lens has not its eight ways to choose from");
  check(
    waysTipped && waysTip.includes("What they return to"),
    "a land's tooltip under the ways lens does not break its way down",
  );
  check(
    beliefLegend === "Belief" && beliefTipped && beliefTip.includes("their ways changed"),
    "a land's tooltip under the belief lens does not tell what they saw of the god",
  );
  await press(".mapmodes .mode[aria-label='Land']");
  await page.mouse.move(30, 400);
}

// 3. One of the people under the hand: what they are like, their family, a trait given.
{
  type Line = (string | { text: string; ref: string })[];
  type Model = {
    title: string;
    tabs: {
      id: string;
      blocks: {
        type: string;
        chips?: { ref: string | null }[];
        rows?: { label: string; people: { name: Line; woman: boolean }[] }[];
      }[];
    }[];
  };
  const towns = await q<{ ref: string; population: number }[]>("settlements", {
      cell: lands[0]!.cell,
    }),
    town = [...towns].sort((a, b) => b.population - a.population)[0]!;
  await k(
    `globalThis.causalis.client.command("hand.lay", { village: ${JSON.stringify(town.ref)} })`,
  );
  const plan = await q<{ people: { ref: string }[] }>("village.plan", { ref: town.ref });
  // Someone with a mother and father, and some trait of their own.
  let who: { ref: string; model: Model; mother: string } | null = null;
  for (const p of plan.people.filter((x) => x.ref.startsWith("agent:"))) {
    const model = await q<Model>("page", { ref: p.ref }),
      tree = model.tabs.find((t) => t.id === "family")?.blocks.find((b) => b.type === "tree"),
      parents = tree?.rows?.find((r) => r.label === "Parents")?.people ?? [],
      chips = model.tabs[0]?.blocks.find((b) => b.type === "chips")?.chips ?? [],
      mother = parents.find((x) => x.woman)?.name.find((s) => typeof s !== "string");
    if (parents.length === 2 && chips.length && mother && typeof mother !== "string") {
      who = { ref: p.ref, model, mother: mother.ref };
      break;
    }
  }
  check(!!who, "no one under the hand with a mother, a father and a trait");
  if (who) {
    await k(`globalThis.causalis.open(${JSON.stringify(who.ref)})`);
    await until(
      "a person's page",
      async () => (await page.$$eval(".page-window .chips .chip", (x) => x.length)) > 0,
      slow(20000),
    );
    const chips = await page.$$eval(".page-window .chips .chip", (x) => x.length);
    // A trait's page, from its chip.
    await press(".page-window .chips .chip");
    await until(
      "a trait's page",
      async () => (await text(".page-window")).includes("Who is so"),
      slow(15000),
    );
    const traitTitle = await text(".page-window .page-title");
    // Their family: the tree, walked to their mother's.
    await k(`globalThis.causalis.open(${JSON.stringify(`${who.ref}#family`)})`);
    await until(
      "a person's family tree",
      async () => (await page.$$eval(".page-window .tree-row", (x) => x.length)) >= 2,
      slow(15000),
    );
    const rows = await page.$$eval(".page-window .tree-label", (x) =>
      x.map((e) => e.textContent ?? ""),
    );
    await press(`.page-window .tree-person a.ref-link[href='#${who.mother}']`);
    await until(
      "their mother's family tree",
      async () =>
        (
          await page.$$eval(".page-window .tree-label", (x) => x.map((e) => e.textContent))
        ).includes("Children"),
      slow(15000),
    );
    const theirs = await page.$$eval(".page-window .tree-row", (x) =>
      x.map((r) => [
        r.querySelector(".tree-label")?.textContent ?? "",
        [...r.querySelectorAll("a.ref-link")].map((a) => a.getAttribute("href") ?? ""),
      ]),
    );
    const among = theirs.some(
      ([label, refs]) => label === "Children" && (refs as string[]).includes(`#${who!.ref}#family`),
    );
    // A trait given: the first they have not, pressed twice (as the page asks).
    const id = Number(who.ref.slice(6)),
      before = await q<{
        traits: { id: string; icon: string; name: string; has: boolean; barred: boolean }[];
      }>("agent", { id }),
      give = before.traits.find((t) => !t.has && !t.barred)!;
    await k(`globalThis.causalis.open(${JSON.stringify(who.ref)})`);
    await until(
      "the hand's tools on them",
      async () => (await page.$$eval(".page-window button.tool", (x) => x.length)) > 2,
      slow(15000),
    );
    const button = `.page-window button.tool[data-label='Give ${give.icon} ${give.name}']`;
    await press(button);
    await page.waitForTimeout(300);
    await press(button);
    const given = await until(
      "a trait given",
      async () =>
        (await q<{ traits: { id: string; has: boolean }[] }>("agent", { id })).traits.find(
          (t) => t.id === give.id,
        )!.has,
      slow(15000),
    );
    say(
      `a person: ${chips} traits as chips (“${traitTitle}” opened from one); their tree: ${rows.join(" / ")}; among their mother's children: ${among}; given ${give.id}: ${given}`,
    );
    check(
      chips >= 1 && traitTitle.length > 0,
      "a person's traits are not chips opening their pages",
    );
    check(rows.includes("Parents"), "a person's family tree has not their parents");
    check(among, "a mother's tree does not have her child among her children");
    check(given, "a trait was not given by the hand");
  }
  await k(`document.querySelector(".page-window .close")?.click()`);
}

// 4. A people read: its tongue's sounds and words, the god as they name it, their ways; a
// realm's faith and tongue.
{
  const tongue = (await land(lands[0]!.cell)).tongue ?? first.tongue;
  let speech = "",
    theirs = "";
  if (tongue) {
    await k(`globalThis.causalis.open(${JSON.stringify(`${tongue.ref}#speech`)})`);
    await until(
      "a tongue's speech",
      async () => (speech = await text(".page-window")).includes("Its vowels"),
      slow(15000),
    );
    await k(`globalThis.causalis.open(${JSON.stringify(`${tongue.ref}#people`)})`);
    await until(
      "a tongue's people",
      async () => (theirs = await text(".page-window")).includes("The god, as they name it"),
      slow(15000),
    );
  }
  let realm = "";
  if (first.realm) {
    await k(`globalThis.causalis.open(${JSON.stringify(first.realm.ref)})`);
    await until(
      "a realm's faith and tongue",
      async () => /Faith/.test((realm = await text(".page-window"))),
      slow(15000),
    );
  }
  say(
    `a people: ${tongue?.name ?? "none"} — ${speech.includes("Words in it") ? "its words" : "no words"}, ${theirs.includes("their ways changed") ? "the god named from what they saw" : "the god unnamed"}; a realm names its faith and tongue: ${realm.includes("Faith") && realm.includes("Tongue")}`,
  );
  check(!!tongue, "the most peopled land speaks no tongue");
  check(
    speech.includes("Its vowels") && speech.includes("Words in it"),
    "a tongue's speech is not heard",
  );
  check(
    theirs.includes("The god, as they name it") && theirs.includes("their ways changed"),
    "a people does not name the god from what they saw",
  );
  check(
    !first.realm || (realm.includes("Faith") && realm.includes("Tongue")),
    "a realm names not its faith and tongue",
  );
  await k(`document.querySelector(".page-window .close")?.click()`);
}

// 5. The view left alone, the title screen, Continue, a new world.
{
  const yaw = () => k<number>("globalThis.causalis.rig.yaw");
  await page.mouse.move(30, 400);
  await page.waitForTimeout(slow(2000));
  const before = await yaw();
  await page.waitForTimeout(slow(6000));
  const still = Math.abs((await yaw()) - before) < 0.01;
  // Turning, chosen in the settings: then it turns when left alone.
  await press(".world-menu button[title='Settings']");
  const lines = () => page.$$eval("button.line", (x) => x.map((b) => b.textContent ?? ""));
  await until(
    "the view's settings",
    async () => (await lines()).some((l) => l.startsWith("Turning")),
    slow(10000),
  );
  const drift = (await lines()).filter((l) => /^(Still|Turning)/.test(l));
  await page.click("button.line:has-text('Turning')");
  const from = await yaw();
  const turned = await until(
    "the view turning when left alone",
    async () => Math.abs((await yaw()) - from) > 1,
    slow(15000),
  );
  await page.click("button.line:has-text('Still')");
  // The main menu: the world kept, and the title screen.
  const year = await k<number>(
    "Math.floor(globalThis.causalis.client.latestFrame('globe').t / (365 * 86400))",
  );
  await press(".world-menu button[title='Main menu']");
  await page.waitForURL((u) => !u.search, { timeout: slow(60000) });
  const titled = await until(
    "Continue on the title screen",
    async () => (await text(".title-menu")).includes("Continue"),
    slow(30000),
  );
  const menu = await text(".title-menu");
  await press(".title-menu .choice:first-child");
  await page.waitForURL(/load=/, { timeout: slow(20000) });
  await page.waitForFunction(
    () => ((globalThis as any).causalis?.drawn?.() as number) > 0,
    undefined,
    { timeout: 900000 },
  );
  await k("globalThis.causalis.client.setSpeed(0)");
  const again = await k<number>(
    "Math.floor(globalThis.causalis.client.latestFrame('globe').t / (365 * 86400))",
  );
  // A new world from the title: one never seen, its seed as drawn.
  await page.goto(base);
  await page.waitForSelector(".title-menu .choice");
  // (The title screen draws only a light turning world: its buttons are clicked as any page's.)
  await page.click(".title-menu .choice:has-text('New world')");
  await page.click(".choice-row .choice[data-id='alien']");
  const seed = await page.$eval(".seed-input", (e) => (e as HTMLInputElement).value);
  await page.click(".title-form .begin");
  await page.waitForURL(/universe=alien&seed=/, { timeout: slow(20000) });
  const begun = await until(
    "a new world never seen",
    async () => ((await k<number>("globalThis.causalis?.drawn?.() ?? 0")) ?? 0) > 0,
    slow(120000),
  );
  const said = await k<string>("globalThis.causalis.seed");
  say(
    `the view: ${still ? "still when left alone" : "turned by itself"}, ${turned ? "turning when chosen" : "not turning when chosen"} (${drift.length} choices); the title: “${menu.slice(0, 70)}…”; Continue at year ${again} (kept at ${year}); a new world “${said}”: ${begun}`,
  );
  check(still, "the view turned when left alone, turning not chosen");
  check(turned, "the view did not turn when left alone, turning chosen");
  // (Taken up where it was kept, not begun again: it runs on a little before it is read.)
  check(titled && again >= year, "the main menu did not keep the world for Continue to take up");
  check(begun && said === seed, "a new world was not begun from the title screen with its seed");
}

await browser.close();
await server.close();
const real = errors.filter((e) => !/favicon|ERR_ABORTED/i.test(e));
if (real.length) problems.push(...real.slice(0, 5).map((e) => `the page logged: ${e}`));
console.log();
if (problems.length) {
  for (const p of problems) console.log(`  ✗ ${p}`);
  console.log("the Phase 14 gate fails");
  process.exit(1);
}
console.log("the Phase 14 gate passes");
