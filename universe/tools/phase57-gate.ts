// node tools/phase57-gate.ts [--ci] [--soft] [--shots dir] — the Phase 57 gate (alien biochemistry;
// asked for 2026-10-26: "alien biochemistry for their life: different fibres, dyes, foods and body
// matter"), in parts:
//   1. in node: the gate's worlds' lives as their chemistry makes them — Earth's own, and five open
//      worlds' bones, blood, cells' skins, colours and foods — and the life survey over the open
//      seeds (two hundred; sixty on CI); (not on CI) the oracle's histories as they were;
//   2. alien 84, a sulfur-volcano world of acid seas, at year 125 by day: its globe and a land in
//      its life's near-black, its legend's "black woods" on a desk and a phone; its greatest town;
//      a beast's page and one met's Body tab telling bones of silica and green blood, and why; the
//      tree of life's dawn and the matter guide telling what its life is made of; opal's page its
//      bones, vanadium's what holds it; a battle of its wars watched, its blood green;
//   3. alien 218, an ice-and-ammonia world, at year 30: its "golden woods"; its bare-skinned people
//      told their brown blood of iron and sulfur, for their faces; a garment traced to its own fibre
//      (chitosan turned the other way, or its flocks' mirrored hair), and why; a land's stores of
//      its own mirrored glucosamine starch;
//   4. alien 1429, a methane world, at year 400: its "amber woods"; its dawn fed by the haze; bones
//      of ice and blood of iron and sulfur;
//   5. a world where no life took hold: bare ground, no woods, told so;
//   6. Earth as it was: green, its legend's "woods", bones of bone mineral told without why, no
//      "This world"; bread ground and baked at a mill, as on every world;
//   7. each page at a phone's width.
// (npm run build first; --soft draws in software, as CI's browser does; --shots keeps a picture of
// each step, on a desk and at a phone's size.)
import { spawnSync } from "node:child_process";
import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { preview } from "vite";
import { chromium } from "playwright";
import { seedFromText } from "../src/kernel/index.ts";
import { generateHomeWorld, worldLife } from "../src/gen/index.ts";
import { EARTHLIKE, OPEN, type LifeChemistry, type Prior } from "../src/rules/index.ts";
import { lifeLines, surveyLife } from "./chem-survey.ts";

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
console.log("the Phase 57 gate");
if (shots) mkdirSync(shots, { recursive: true });

// —— 1. In node: the gate's worlds' lives, the survey, the oracle ————————————————————————————

/** What each of the gate's worlds' life is made of: its kind, hand, bone, blood, skin, colour and food. */
const LIVES: readonly {
  seed: string;
  prior: Prior;
  life: Partial<LifeChemistry>;
}[] = [
  {
    seed: "first light",
    prior: EARTHLIKE,
    life: { earth: true, bone: "apatite", blood: "iron", pigment: "chlorophyll", store: "starch" },
  },
  {
    seed: "alien 16",
    prior: OPEN,
    life: { kind: "rocky", hand: "right", bone: "calcite", blood: "iron", pigment: "phycocyanin" },
  },
  {
    seed: "alien 84",
    prior: OPEN,
    life: {
      kind: "sulfur",
      bone: "opal",
      blood: "vanadium",
      membrane: "tetraether",
      pigment: "bacteriochlorophyll",
    },
  },
  {
    seed: "alien 218",
    prior: OPEN,
    life: {
      kind: "ammonia",
      hand: "right",
      bone: "calcite",
      blood: "iron-sulfur",
      membrane: "supple",
      pigment: "carotene",
      store: "mirror-glucosamine-starch",
      fibre: "mirror-chitosan",
    },
  },
  {
    seed: "alien 20",
    prior: OPEN,
    life: { kind: "carbon", bone: "greigite", blood: "iron-sulfur", store: "squalene" },
  },
  {
    seed: "alien 1429",
    prior: OPEN,
    life: {
      kind: "methane",
      bone: "ice",
      blood: "iron-sulfur",
      membrane: "azotosome",
      pigment: "polyimine",
      store: "acetylene",
    },
  },
];
for (const w of LIVES) {
  const life = worldLife(generateHomeWorld(seedFromText(w.seed), w.prior)),
    wrong = Object.entries(w.life).filter(([k, v]) => life[k as keyof LifeChemistry] !== v);
  say(
    `${w.seed}: ${life.kind}, ${life.family}, ${life.hand}; bones ${life.bone}, blood ${life.blood}, skins ${life.membrane}, ${life.pigment}; stores ${life.store}, fibre ${life.fibre}`,
  );
  check(
    !wrong.length,
    `${w.seed}'s life: ${wrong.map(([k, v]) => `${k} ${String(life[k as keyof LifeChemistry])}, not ${String(v)}`).join("; ")}`,
  );
}
const surveyed = performance.now(),
  survey = lifeLines(surveyLife(ci ? 60 : 200));
say(`the open worlds' lives (${((performance.now() - surveyed) / 1000).toFixed(0)} s):`);
// (Every bone, blood and food comes about only over a thousand seeds and more: here, the shares.)
for (const line of survey.lines.filter((l) => !l.startsWith("FAIL"))) say(`    ${line}`);
check(
  !survey.lines.some((l) => /^FAIL right-handed/.test(l)) || ci,
  "the open worlds' hands not near even",
);
if (!ci) {
  const oracle = spawnSync(
    process.execPath,
    [fileURLToPath(new URL("./oracle.ts", import.meta.url))],
    { encoding: "utf8" },
  );
  const kept = (oracle.stdout.match(/: unchanged \(/g) ?? []).length;
  say(`the oracle's histories: ${kept} of them as they were`);
  check(oracle.status === 0 && kept === 8, `the oracle's histories changed:\n${oracle.stdout}`);
}

// —— 2–7. On the built app ————————————————————————————————————————————————————————————

type Town = { ref: string; name: string; cell: number; people: number };
type Person = { ref: string; folk?: boolean; name: string };
type Plan = {
  ref: string;
  name: string;
  lifeLook?: string;
  people: Person[];
  town?: { civics: { kind: string; at: number; start: number }[] };
  body?: { skin: string; folk: { blood?: string; shell?: string } | null } | null;
};
type Span = string | { text: string; ref: string };
type PageModel = {
  title: string;
  tabs: {
    id: string;
    blocks: { type: string; title?: string; items?: { ref?: string; line: Span[] }[] }[];
  }[];
};
type Near = {
  title: string;
  figure: { folk: { blood?: string; lifeLook?: string } | null } | null;
};

const root = fileURLToPath(new URL("..", import.meta.url)),
  // (CAUSALIS_DIST: a build elsewhere, so that one can be looked at while dist/ is under test.)
  server = await preview({
    root,
    logLevel: "silent",
    preview: { port: 4317, strictPort: false },
    ...(process.env.CAUSALIS_DIST ? { build: { outDir: process.env.CAUSALIS_DIST } } : {}),
  }),
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
const ask = <T>(type: string, args: unknown) =>
  k<T>(
    `globalThis.causalis.client.query({ type: ${JSON.stringify(type)}, args: ${JSON.stringify(args)} })`,
  );
const until = async (what: string, ok: () => Promise<boolean>, ms = 60000) => {
  const end = Date.now() + ms;
  while (Date.now() < end) {
    if (await ok().catch(() => false)) return true;
    await page.waitForTimeout(250);
  }
  problems.push(`${what} did not come`);
  return false;
};
const words = (l: readonly Span[]) => l.map((s) => (typeof s === "string" ? s : s.text)).join("");
const DESK = { width: 1366, height: 800 },
  PHONE = { width: 430, height: 932 };
/** A picture of the step on a desk, and at a phone's size where `phone`. */
const shot = async (name: string, phone = false) => {
  if (!shots) return;
  await page.screenshot({ path: join(shots, `${name}.png`) });
  if (!phone) return;
  await page.setViewportSize(PHONE);
  await page.waitForTimeout(slow(1500));
  await page.screenshot({ path: join(shots, `${name}-phone.png`) });
  await page.setViewportSize(DESK);
  await page.waitForTimeout(slow(800));
};
const pageTitle = () =>
  page.$eval(".page-window .page-title", (e) => e.textContent ?? "").catch(() => "");
/** A page opened in the page window, by ref: its title come. */
const opened = async (ref: string) => {
  const before = await pageTitle();
  await k(`globalThis.causalis.open(${JSON.stringify(ref)})`);
  await page
    .waitForFunction(
      (was) => {
        const t = document.querySelector(".page-window .page-title")?.textContent;
        return !!t && t !== "…" && t !== was;
      },
      before,
      { timeout: slow(30000) },
    )
    .catch(() => undefined);
  await page.waitForTimeout(slow(500));
  return pageTitle();
};
/** The titles of the page window's blocks. */
const headings = () =>
  k<string[]>(
    `[...document.querySelectorAll(".page-window .block h3")].map((h) => h.textContent ?? "")`,
  );
/** A fact of the page window by its label: its words (null: none so labelled). */
const factOn = (label: string) =>
  k<string | null>(`(() => {
    const row = [...document.querySelectorAll(".page-window .fact")].find((r) => r.querySelector(".fact-label")?.textContent === ${JSON.stringify(label)});
    return row ? (row.querySelector(".fact-value")?.textContent ?? "") : null;
  })()`);
/** A block of the page window by its title: its words below the title (null: no such block). */
const blockText = (title: string) =>
  k<string | null>(`(() => {
    const box = [...document.querySelectorAll(".page-window .block")].find((b) => b.querySelector("h3")?.textContent === ${JSON.stringify(title)});
    if (!box) return null;
    const h = box.querySelector("h3");
    return (box.textContent ?? "").slice((h?.textContent ?? "").length).trim();
  })()`);
/** A list on the page window by the start of its title: its rows' words. */
const listOn = (start: string) =>
  k<string[] | null>(`(() => {
    const box = [...document.querySelectorAll(".page-window .block-list")].find((b) => b.querySelector("h3")?.textContent?.startsWith(${JSON.stringify(start)}));
    return box ? [...box.querySelectorAll(".entry")].map((e) => e.textContent ?? "") : null;
  })()`);
/** At a phone's width: how far the page window's blocks run over. */
const onPhone = async (name: string) => {
  await page.setViewportSize(PHONE);
  await page.waitForTimeout(slow(800));
  const over = await k<number>(
    `Math.max(0, ...[...document.querySelectorAll(".page-window .block")].map((b) => b.scrollWidth - b.clientWidth))`,
  );
  if (shots) await page.screenshot({ path: join(shots, `${name}.png`) });
  await page.setViewportSize(DESK);
  await page.waitForTimeout(slow(500));
  return over;
};
/** A page opened and looked at on a phone: its overflow checked. */
const phoneOk = async (name: string) => {
  const over = await onPhone(name);
  say(`    on a phone: overflow ${over} px`);
  check(over <= 2, `${name}: wider than a phone (${over} px over)`);
};
const YEAR = 365 * 86400,
  DAY = 86400,
  HOUR = 3600;
/** On to moment t (the clock held): the host's word of it come, and a few frames drawn there. */
const advance = async (t: number) => {
  await k(`globalThis.causalis.client.advance(${Math.round(t)})`);
  await page
    .waitForFunction((at) => ((globalThis as any).causalis.client.status?.t ?? 0) >= at - 1, t, {
      timeout: slow(20000),
    })
    .catch(() => undefined);
  await page.waitForTimeout(slow(500));
};
/** A world opened at a year, held there, by day: the year it stands at. */
const openWorld = async (universe: string, seed: string, year: number) => {
  await page.goto(
    `${base}?universe=${universe}&seed=${encodeURIComponent(seed)}&year=${year}&hold=1`,
  );
  await page.waitForFunction(
    () => ((globalThis as any).causalis?.drawn?.() as number) > 0,
    undefined,
    { timeout: 900000 },
  );
  await k(`globalThis.causalis.client.setSpeed(0)`);
  // (By day: the world opens at midnight, when the land is dark.)
  const t0 = await k<number>(`globalThis.causalis.client.status?.t ?? 0`);
  await advance(Math.floor(t0 / DAY) * DAY + 2 * DAY + 11 * HOUR);
  return Math.floor((await k<number>(`globalThis.causalis.client.status?.t ?? 0`)) / YEAR);
};
/** A frame's life's colours (none: Earth's green). */
const lookOf = (view: "globe" | "region") =>
  k<string | null>(
    `globalThis.causalis.client.latestFrame(${JSON.stringify(view)})?.meta?.lifeLook ?? null`,
  );
/** The keys of the lens legend, in words. */
const legendKeys = () =>
  page.$$eval(".mapmodes .legend-key", (x) => x.map((e) => e.textContent ?? ""));
/** The legend at a phone's width: its keys shown, and how far any runs off the screen. */
const legendOnPhone = async (name: string) => {
  await page.setViewportSize(PHONE);
  await page.waitForTimeout(slow(1200));
  const fit = await k<{ shown: number; over: number }>(`(() => {
    const keys = [...document.querySelectorAll(".mapmodes .legend-key")].filter((e) => e.getClientRects().length);
    return {
      shown: keys.length,
      over: Math.max(0, ...keys.map((e) => Math.max(e.getBoundingClientRect().right - innerWidth, -e.getBoundingClientRect().left))),
    };
  })()`);
  if (shots) await page.screenshot({ path: join(shots, `${name}.png`) });
  await page.setViewportSize(DESK);
  await page.waitForTimeout(slow(800));
  say(`    its legend on a phone: ${fit.shown} keys shown, overflow ${Math.round(fit.over)} px`);
  check(
    fit.over <= 2,
    `${name}: the legend runs off a phone's screen (${Math.round(fit.over)} px)`,
  );
};
/** A world's globe: its life's colours on its frame, and its legend's first key. */
const globeLooks = async (seed: string, look: string | null, woods: string, name: string) => {
  const shown = await lookOf("globe");
  await until(`${seed}'s legend`, async () => (await legendKeys()).length > 0, slow(20000));
  const keys = await legendKeys();
  say(`${seed}: its globe's life ${shown ?? "Earth's green"}; its legend ${keys.join(", ")}`);
  check(shown === look, `${seed}'s globe drawn in ${shown}, not ${look}`);
  check(keys[0] === woods, `${seed}'s legend begins “${keys[0]}”, not “${woods}”`);
  await shot(name);
  await legendOnPhone(`${name}-legend-phone`);
};
/** The greatest town of a world, and its plan. */
const greatest = async () => {
  const towns = (await ask<Town[]>("towns.map", {})).sort(
    (a, b) => b.people - a.people || (a.ref < b.ref ? -1 : 1),
  );
  return towns[0] ?? null;
};
/** A world's first beast with bones (not a shell) and a body: its lineage's ref. */
const beastOf = (seed: string, prior: Prior) =>
  generateHomeWorld(seedFromText(seed), prior).life.species.find(
    (s) => s.body && s.body.covering !== "shell" && s.niche !== "seed grass",
  )!.ref;

// 2. Alien 84: bones of silica, green blood, near-black woods.
{
  const year = await openWorld("alien", "alien 84", 125);
  say(`alien 84 at year ${year}`);
  await globeLooks("alien 84", "bacteriochlorophyll", "black woods", "2-84-globe");
  const town = await greatest();
  check(!!town, "no town on alien 84");
  if (town) {
    await k(`globalThis.causalis.descend(${town.cell})`);
    await until(
      "alien 84's land",
      async () => ((await k<number>(`globalThis.causalis.villages?.() ?? 0`)) ?? 0) > 0,
      slow(60000),
    );
    const land = await lookOf("region");
    say(`    its land ${town.cell}: drawn in ${land}`);
    check(land === "bacteriochlorophyll", `alien 84's land drawn in ${land}`);
    await page.waitForTimeout(slow(1500));
    await shot("2-84-land", true);
    await k(`globalThis.causalis.goTo(${JSON.stringify(town.ref)})`);
    await until(
      `${town.name} (alien 84)`,
      async () => ((await k<number>(`globalThis.causalis.watching?.() ?? 0`)) ?? 0) > 0,
      slow(120000),
    );
    await k(`globalThis.causalis.client.setSpeed(0)`);
    await page.waitForTimeout(slow(2000));
    const plan = await ask<Plan>("village.plan", { ref: town.ref });
    say(`    ${plan.name}: its plan's life ${plan.lifeLook}`);
    check(plan.lifeLook === "bacteriochlorophyll", `${plan.name}'s plan's life ${plan.lifeLook}`);
    await shot("2-84-town", true);
    // One met's Body tab: bones of silica, green blood.
    const met = plan.people.find((p) => !p.folk && p.ref.startsWith("prsn:"));
    check(!!met, `no one met in ${plan.name}`);
    if (met) {
      await opened(`${met.ref}#body`);
      const bones = (await factOn("Bones")) ?? "",
        blood = (await factOn("Blood")) ?? "";
      say(
        `    ${met.name}'s Body tab: bones “${bones.slice(0, 60)}…”; blood “${blood.slice(0, 60)}…”`,
      );
      check(/^Silica \(opal\), of glass/.test(bones), `${met.name}'s bones told “${bones}”`);
      check(
        /^Green, its breath carried on vanadium \(vanabin\)/.test(blood),
        `${met.name}'s blood told “${blood}”`,
      );
      await shot("2-84-body");
      await phoneOk("2-84-body-phone");
    }
  }
  // A beast's page: its bones and blood, and why.
  const beast = beastOf("alien 84", OPEN);
  const named = await opened(beast);
  const bones = (await factOn("Its bones")) ?? "",
    blood = (await factOn("Its blood")) ?? "";
  say(`    ${named}: bones “${bones}”`);
  say(`        blood “${blood}”`);
  check(
    /^Silica \(opal\), of glass, as Earth's diatoms/.test(bones),
    `${named}'s bones told “${bones}”`,
  );
  check(
    /^Green, its breath carried on vanadium \(vanabin\): in acid/.test(blood),
    `${named}'s blood told “${blood}”`,
  );
  await shot("2-84-lineage");
  await phoneOk("2-84-lineage-phone");
  // The tree of life's dawn: what its life is made of.
  await opened("world:tree#dawn");
  const liquid = (await factOn("Its liquid")) ?? "",
    skins = (await factOn("Its cells' skins")) ?? "",
    colour = (await factOn("Its colour")) ?? "";
  say(
    `    its dawn: liquid “${liquid.slice(0, 50)}…”; skins “${skins.slice(0, 60)}…”; colour “${colour.slice(0, 50)}…”`,
  );
  check(/^water: /.test(liquid), `its dawn's liquid told “${liquid}”`);
  check(/caldarchaeol/.test(skins), `its cells' skins told “${skins}”`);
  check(/^Black, with bacteriochlorophyll/.test(colour), `its colour told “${colour}”`);
  await shot("2-84-dawn");
  await phoneOk("2-84-dawn-phone");
  // Its matter guide's "This world"; opal's page; vanadium's.
  await opened("world:matter#world");
  const blocks = await headings();
  check(
    blocks.includes("What its life is made of"),
    "the matter guide's “This world” does not tell its life",
  );
  const opal = await opened("subst:opal"),
    use = (await blockText("In this world's life")) ?? "";
  say(`    ${opal}: in this world's life “${use}”`);
  check(/^Its bones/.test(use), `opal's page tells its life's use as “${use}”`);
  await shot("2-84-opal");
  await phoneOk("2-84-opal-phone");
  const vanadium = await opened("elem:V"),
    holds = (await listOn("What holds it")) ?? [];
  say(`    ${vanadium}: held by ${holds.map((h) => h.split(" — ")[0]).join(", ")}`);
  check(
    holds.some((h) => /^Vanabin/.test(h)),
    "vanadium's page not holding vanabin",
  );
  // A battle of its wars, watched: its blood green.
  const wars = await ask<{
      wars: { battles: { event: string; fallen: number; year: number }[] }[];
    }>("wars.map", {}),
    battle = wars.wars
      .flatMap((w) => w.battles)
      .sort((a, b) => b.fallen - a.fallen || (a.event < b.event ? -1 : 1))[0];
  check(!!battle, "no battle on alien 84 by year 125");
  if (battle) {
    const near = await ask<Near>("battle.near", { event: battle.event });
    say(
      `    ${near.title}, year ${battle.year}: ${battle.fallen} fell; their blood ${near.figure?.folk?.blood ?? "iron"}`,
    );
    check(
      near.figure?.folk?.blood === "vanadium",
      `the battle's people's blood told ${near.figure?.folk?.blood}`,
    );
    check(
      near.figure?.folk?.lifeLook === "bacteriochlorophyll",
      "the battle's field not in its life's colours",
    );
    await page.keyboard.press("Escape");
    const down = await k<boolean>(
      `globalThis.causalis.watchBattle(${JSON.stringify(battle.event)})`,
    );
    check(down, "the battle not watched");
    if (down) {
      await k(`globalThis.causalis.battleAt(95, 0)`);
      await page.waitForTimeout(slow(2500));
      const now = await k<{ fallen: number[] } | null>(`globalThis.causalis.battle?.() ?? null`);
      say(`    on its field at 95 s: ${(now?.fallen ?? []).reduce((s, x) => s + x, 0)} fallen`);
      await shot("2-84-battle", true);
    }
  }
}

// 3. Alien 218: golden woods; a garment of its own fibre; stores of its own starch.
{
  const year = await openWorld("alien", "alien 218", 30);
  say(`alien 218 at year ${year}`);
  await globeLooks("alien 218", "carotene", "golden woods", "3-218-globe");
  const town = await greatest();
  check(!!town, "no town on alien 218");
  if (town) {
    // A garment of one met there: of its own fibre (its plants', or its flocks' hair), and why.
    const fibre = /^Its fibre is mirror (chitosan|keratin): .*turned the other way/;
    let garment: string | null = null;
    const plan = await ask<Plan>("village.plan", { ref: town.ref });
    // Its people bare-skinned, their faces flushed with their brown blood (iron and sulfur).
    const folk = plan.body?.folk;
    say(
      `    its people: ${plan.body?.skin ?? "upright apes"}, their blood ${folk?.blood ?? "iron"}`,
    );
    check(
      plan.body?.skin === "skin" && folk?.blood === "iron-sulfur" && !folk.shell,
      `alien 218's people told ${plan.body?.skin} skin, blood ${folk?.blood}, shell ${folk?.shell}`,
    );
    for (const p of plan.people.filter((x) => !x.folk && x.ref.startsWith("prsn:")).slice(0, 16)) {
      const ref = `thing:${p.ref}:tunic`,
        model = await ask<PageModel>("page", { ref }).catch(() => null),
        chain = model?.tabs
          .flatMap((t) => t.blocks)
          .find((b) => b.type === "list" && b.title === "From the ground to the hand");
      if (chain?.items?.some((i) => fibre.test(words(i.line)))) {
        garment = ref;
        break;
      }
    }
    check(!!garment, "no garment of alien 218 traced to its own fibre, and why");
    if (garment) {
      const thing = await opened(garment),
        chain = (await listOn("From the ground to the hand")) ?? [];
      say(`    ${thing}, from the ground to the hand:`);
      for (const r of chain) say(`        ${r}`);
      check(
        chain.some((r) => fibre.test(r)),
        `${thing}'s page does not tell its fibre`,
      );
      await shot("3-218-thing");
      await phoneOk("3-218-thing-phone");
    }
    // Its land's stores: of its own mirrored glucosamine starch.
    await opened(`cell:0:${town.cell}#stores`);
    const stores = (await blockText("What its stores are made of")) ?? "";
    say(`    its land's stores: “${stores.slice(0, 120)}…”`);
    check(/mirror glucosamine starch/i.test(stores), "its land's stores not of its own starch");
    await shot("3-218-stores");
    await phoneOk("3-218-stores-phone");
  }
}

// 4. Alien 1429: amber woods; its dawn fed by the haze; bones of ice, blood of iron and sulfur.
{
  const year = await openWorld("alien", "alien 1429", 400);
  say(`alien 1429 at year ${year}`);
  await globeLooks("alien 1429", "polyimine", "amber woods", "4-1429-globe");
  await opened("world:tree#dawn");
  const rungs = (await listOn("Life before the ages")) ?? [];
  say(`    its dawn: ${rungs.length} steps; ${rungs.find((r) => /haze/.test(r)) ?? "no haze"}`);
  check(
    rungs.some((r) => /The haze feeds life/.test(r)),
    "its dawn not fed by the haze",
  );
  await shot("4-1429-dawn");
  const named = await opened(beastOf("alien 1429", OPEN)),
    bones = (await factOn("Its bones")) ?? "",
    blood = (await factOn("Its blood")) ?? "";
  say(`    ${named}: bones “${bones.slice(0, 60)}…”; blood “${blood.slice(0, 60)}…”`);
  check(/^Ice \(/.test(bones), `${named}'s bones told “${bones}”`);
  check(
    /^Brown, its breath carried on iron and sulfur/.test(blood),
    `${named}'s blood told “${blood}”`,
  );
  await shot("4-1429-lineage");
}

// 5. A world where no life took hold: bare ground, no woods.
{
  let seed = "";
  for (let i = 0; i < 40 && !seed; i++)
    if (!generateHomeWorld(seedFromText(`alien ${i}`), OPEN).life.species.length)
      seed = `alien ${i}`;
  check(!!seed, "no lifeless world among the first forty open seeds");
  if (seed) {
    await openWorld("alien", seed, 0);
    const shown = await lookOf("globe");
    await until(`${seed}'s legend`, async () => (await legendKeys()).length > 0, slow(20000));
    const keys = await legendKeys();
    say(`${seed}, where no life took hold: its globe ${shown}; its legend ${keys.join(", ")}`);
    check(shown === "bare", `${seed}'s globe drawn as ${shown}`);
    check(
      keys[0] === "bare ground" && !keys.some((x) => /woods/.test(x)),
      `${seed}'s legend reads ${keys.join(", ")}`,
    );
    await shot("5-bare-globe");
  }
}

// 6. Earth as it was, and bread at its mill.
{
  const year = await openWorld("earth", "first light", 500);
  say(`first light at year ${year}`);
  await globeLooks("first light", null, "woods", "6-earth-globe");
  const keys = await legendKeys();
  check(
    keys.join(",") === "woods,grassland,desert,ice,sea",
    `Earth's legend reads ${keys.join(", ")}`,
  );
  const named = await opened(beastOf("first light", EARTHLIKE)),
    bones = (await factOn("Its bones")) ?? "",
    blood = (await factOn("Its blood")) ?? "";
  say(`    ${named}: bones “${bones}”; blood “${blood}”`);
  check(bones === "Calcium phosphate (bone mineral)", `Earth's bones told “${bones}”`);
  check(blood === "Red, its breath carried on iron (haem)", `Earth's blood told “${blood}”`);
  const guide = await ask<PageModel>("page", { ref: "world:matter" });
  check(
    guide.tabs.map((t) => t.id).join(",") === "substances,reactions,elements",
    `Earth's matter guide has tabs ${guide.tabs.map((t) => t.id).join(", ")}`,
  );
  // A mill: its land's seed ground to flour and baked into bread.
  const towns = (await ask<Town[]>("towns.map", {})).sort(
    (a, b) => b.people - a.people || (a.ref < b.ref ? -1 : 1),
  );
  let mill = "";
  for (const t of towns.slice(0, 40)) {
    const plan = await ask<Plan>("village.plan", { ref: t.ref }),
      c = plan.town?.civics.find((x) => x.kind === "mill");
    if (c) {
      mill = `bldg:${t.ref}:${c.at}:${c.start}`;
      break;
    }
  }
  check(!!mill, "no mill among Earth's forty greatest towns by year 500");
  if (mill) {
    await opened(mill);
    const ground = await listOn("Ground here this year");
    say(`    ${await pageTitle()}: ${ground?.join(" / ") ?? "nothing ground"}`);
    check(
      !!ground &&
        /stored as starch$/.test(ground[0] ?? "") &&
        ground[1] === "Ground between the millstones to flour" &&
        ground[2] === "Baked into bread in the town's ovens",
      `the mill's bread told as ${ground?.join(" / ")}`,
    );
    await shot("6-earth-mill");
    await phoneOk("6-earth-mill-phone");
  }
}

await browser.close();
await server.close();
if (errors.length) problems.push(...errors.map((e) => `page error: ${e}`));
if (problems.length) {
  console.log("FAILED:");
  for (const p of problems) console.log(`  - ${p}`);
  process.exit(1);
}
console.log("the Phase 57 gate passes");
