// node tools/phase55b-gate.ts [--ci] [--soft] [--shots dir] — the Phase 55 gate, wave 5 (the
// soldier as a person; asked for 2026-10-27: "i cant click on the soldiers on the field and see
// they family and anatomy etc in town vieww"), on the built app, the Earth seed at the turn of year
// 365, in a town before which a battle was fought at the turn:
//   1. a fallen soldier tapped where he lies (of the war drawn about the town, or of the battle
//      fought in place before it where the app has it): his card names him from the battle's roll,
//      with his family and his body (the blow that killed); his page's Family tab (his kin, the
//      same on a second opening) and Body tab (each member of his people's plan, the blow that
//      killed);
//   2. one maimed in it: his page's Body tab, the member he lost as his wounds tell it;
//   3. one of the town's people tapped: their card's family and body; their page's Family tab, its
//      roof the household the town draws; a maker's, the healer's and one met's pages too;
//   4. one borne home on a litter, tapped: their card;
//   5. an alien people's body plan, not Earth's;
//   6. on a phone: a soldier tapped, his card and his page within the screen — at a phone's width
//      in Chromium, and in WebKit at 430×932, three to a pixel, by touch (not with --ci: CI's
//      runners keep WebKit for gate 7).
// (npm run build first; --soft draws in software, as CI's browser does; --shots keeps a
// picture of each step.)
import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { preview } from "vite";
import { chromium, webkit, type Browser, type Locator, type Page } from "playwright";

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
console.log("the Phase 55 gate (wave 5)");
if (shots) mkdirSync(shots, { recursive: true });

const DAY = 86400,
  HOUR = 3600,
  YEAR = 365 * DAY,
  /** The village's quality: its families and its crowd, as the app asks its plan (render/quality.ts, "high"). */
  QUALITY = { name: "high", families: 10, folk: 220 } as const,
  /** The world opened: the Earth seed at the turn of year 365, held. */
  WORLD = `?universe=earth&seed=${encodeURIComponent("first light")}&year=365&hold=1`;

type Frame = { members: string[]; words: Record<string, string> };
type Battle = { event: string; spot: number; year: number; fallen: number; seat?: boolean };
type Candidate = Battle & { town: string };
type TownWarNow = {
  fought: { event: string; outcome: string } | null;
  fallen: number;
  soldiers: number;
  middles: ({ x: number; z: number } | null)[];
};
type Man = {
  slot: number;
  fallen: boolean;
  x: number;
  y: number;
  ground: { x: number; z: number };
};
type Entry = { ref: string; name: string; age: number; maimed?: true };
type Roll = {
  attacker: { fell: Entry[]; hurt: Entry[]; stood: Entry[] };
  defender: { fell: Entry[]; hurt: Entry[]; stood: Entry[] };
};
type PlanPerson = {
  ref: string;
  name: string;
  home: number;
  child?: boolean;
  folk?: boolean;
  trade?: { kind: string; seat: number };
  healer?: unknown;
  wounds?: { borne: boolean; home: number }[];
};
type Plan = { ref: string; name: string; people: PlanPerson[] };
type Kin = { family: string | null; body: string | null };
type Card = { name: string; now: string; facts: string[]; family: string; body: string };
/**
 * The battle fought in place before the town (Phase 55 M227, where it is in the tree): its figures
 * on the screen, each as the roll names him.
 */
type PlacedMan = {
  id: number;
  fate: string;
  name: string | null;
  ref: string | null;
  at: { x: number; y: number } | null;
};
type PlacedNow = {
  event: string;
  lying: number;
  frame: { x: number; z: number };
  onScreen: PlacedMan[];
};
type Shown = {
  litters: { index: number; start: number; arrive: number; bearers: number[] }[];
  littersNow: { x: number; z: number; borne: boolean; index: number }[];
};

const root = fileURLToPath(new URL("..", import.meta.url)),
  // (CAUSALIS_DIST: a build elsewhere, so that one can be looked at while dist/ is under test.)
  server = await preview({
    root,
    logLevel: "silent",
    preview: { port: 4313, strictPort: false },
    ...(process.env.CAUSALIS_DIST ? { build: { outDir: process.env.CAUSALIS_DIST } } : {}),
  }),
  base = server.resolvedUrls!.local[0]!;
const errors: string[] = [];
const browsers: Browser[] = [];
const desk = await chromium.launch({
  args: soft ? ["--use-angle=swiftshader", "--enable-unsafe-swiftshader"] : ci ? [] : GPU,
});
browsers.push(desk);
const watchErrors = (p: Page, where: string) => {
  p.on("pageerror", (e) => errors.push(`${where}: ${e.message}`));
  p.on("console", (m) => {
    if (m.type() === "error") errors.push(`${where}: ${m.text()}`);
  });
};
let page = await desk.newPage({ viewport: { width: 1366, height: 800 } });
watchErrors(page, "desk");

// —— The look tools, on whichever page is under test ——————————————————————————————————————
const k = <T>(code: string, p: Page = page): Promise<T> => p.evaluate(code) as Promise<T>;
const ask = <T>(type: string, args: unknown, p: Page = page) =>
  k<T>(
    `globalThis.causalis.client.query({ type: ${JSON.stringify(type)}, args: ${JSON.stringify(args)} })`,
    p,
  );
const shot = async (name: string, p: Page = page) => {
  if (shots) await p.screenshot({ path: join(shots, `${name}.png`) });
};
const finish = async () => {
  for (const b of browsers) await b.close().catch(() => undefined);
  await server.close();
  if (errors.length) problems.push(...errors.slice(0, 6).map((e) => `page error: ${e}`));
  if (problems.length) {
    console.log("FAILED:");
    for (const p of problems) console.log(`  - ${p}`);
    process.exit(1);
  }
  console.log("the Phase 55 gate (wave 5) passes");
  process.exit(0);
};
const now = (p: Page = page) => k<number>(`globalThis.causalis.client.status?.t ?? 0`, p);
/** The world opened and drawn, held still at its own moment. */
const begin = async (p: Page) => {
  await p.goto(`${base}${WORLD}`);
  await p.waitForFunction(
    () => ((globalThis as any).causalis?.drawn?.() as number) > 0,
    undefined,
    { timeout: 900000 },
  );
  await k(`globalThis.causalis.setQuality("${QUALITY.name}")`, p);
  await k(`globalThis.causalis.client.setSpeed(0)`, p);
};
/** On to moment t (the clock held): the host's word of it come, and a few frames drawn there. */
const advance = async (t: number, p: Page = page) => {
  await k(`globalThis.causalis.client.advance(${Math.round(t)})`, p);
  await p
    .waitForFunction((at) => ((globalThis as any).causalis.client.status?.t ?? 0) >= at - 1, t, {
      timeout: slow(30000),
    })
    .catch(() => undefined);
  await p.waitForTimeout(slow(600));
};
/** Into a town (its people drawn), the clock held. */
const into = async (ref: string, p: Page = page) => {
  await k(`globalThis.causalis.goTo(${JSON.stringify(ref)})`, p);
  await p
    .waitForFunction(() => ((globalThis as any).causalis.watching?.() ?? 0) > 0, undefined, {
      timeout: slow(120000),
    })
    .catch(() => undefined);
  await k(`globalThis.causalis.client.setSpeed(0)`, p);
  await p.waitForTimeout(slow(800));
};
const townWar = (p: Page = page) =>
  k<TownWarNow | null>(`globalThis.causalis.townWar?.() ?? null`, p);
const menOnScreen = (p: Page = page) => k<Man[]>(`globalThis.causalis.warMenOnScreen?.() ?? []`, p);
/** The eye over a point of the town (metres), so far off (the rig's units: ten metres each). */
const face = async (x: number, z: number, distance: number, p: Page = page) => {
  // (A flight under way, as into a town, would carry the eye on past the point faced.)
  const landed = () =>
    p
      .waitForFunction(() => !(globalThis as any).causalis.rig?.flying, undefined, {
        timeout: slow(30000),
      })
      .catch(() => undefined);
  await landed();
  await k(`globalThis.causalis.faceTown(${x}, ${z}, ${distance})`, p);
  await p.waitForTimeout(slow(1500));
  await landed();
};
/** The village's card (the page window is an inspector too). */
const CARD = ".inspector:not(.page-window)";
/** The village's card shown now: the inspector, not the page window, in sight with a family's place on it. */
const CARD_NOW = `[...document.querySelectorAll(${JSON.stringify(CARD)})].find((b) => !b.hidden && b.getClientRects().length > 0 && b.querySelector(".folk-kin"))`;
const card = (p: Page = page) =>
  k<Card>(
    `(() => {
    const box = ${CARD_NOW};
    const text = (s) => box?.querySelector(s)?.textContent ?? "";
    // (What they are doing now, its line under their name; then the card's own lines.)
    return {
      name: text("h2"),
      now: box?.querySelector(":scope > .fact")?.textContent ?? "",
      facts: [...(box?.querySelectorAll(".fact") ?? [])]
        .filter((e) => e.parentElement !== box && !e.closest(".folk-kin"))
        .map((e) => e.textContent ?? ""),
      family: text(".folk-kin .folk-family"),
      body: text(".folk-kin .folk-body"),
    };
  })()`,
    p,
  );
/** The card come with its family's and body's lines (the host asked for them as it opened). */
const cardWithKin = async (p: Page = page) => {
  await p
    .waitForFunction(
      `(() => { const box = ${CARD_NOW}; return !!box?.querySelector(".folk-kin .folk-family") && !!box.querySelector(".folk-kin .folk-body"); })()`,
      undefined,
      { timeout: slow(30000) },
    )
    .catch(() => undefined);
  return card(p);
};
const title = (p: Page = page) =>
  p.$eval(".page-window .page-title", (e) => e.textContent ?? "").catch(() => "");
/** A page opened in the page window, by ref: its title come. */
const opened = async (ref: string, p: Page = page) => {
  const before = await title(p);
  await k(`globalThis.causalis.open(${JSON.stringify(ref)})`, p);
  await p
    .waitForFunction(
      (was) => {
        const t = document.querySelector(".page-window .page-title")?.textContent;
        return !!t && t !== "…" && t !== was;
      },
      before,
      { timeout: slow(30000) },
    )
    .catch(() => undefined);
  await p.waitForTimeout(slow(500));
  return title(p);
};
/** The page window put away, where it is open. */
const putAway = async (p: Page = page) => {
  const close = p.locator(".page-window button.close:visible");
  if (await close.count()) await close.first().click();
  await p.waitForTimeout(slow(300));
};
/** A tab of the page window chosen by its name; whether it was there. */
/**
 * A touch where an element is drawn: Playwright's own tap in WebKit first waits on a scroll that a
 * page busy drawing may never give it (the element is in sight already).
 */
const touchOn = async (l: Locator, p: Page) => {
  const b = await l.boundingBox();
  if (b) await p.touchscreen.tap(b.x + b.width / 2, b.y + b.height / 2);
  else await l.tap();
};
const tabTo = async (name: string, p: Page = page, touch = false) => {
  const tab = p.locator(".page-window nav.tabs button.tab", { hasText: name });
  if (!(await tab.count())) return false;
  if (touch) await touchOn(tab.first(), p);
  else await tab.first().click();
  await p.waitForTimeout(slow(600));
  // (A body drawn, brought into the window's view for its picture.)
  await k(
    `document.querySelector(".page-window .body-view")?.scrollIntoView({ block: "center" })`,
    p,
  );
  await p.waitForTimeout(slow(300));
  return true;
};
/** The tabs of the page window, by name. */
const tabs = (p: Page = page) =>
  p.$$eval(".page-window nav.tabs button.tab", (bs) => bs.map((b) => b.textContent ?? ""));
/** A fact of the page window by its label: its words. */
const factOn = (label: string, p: Page = page) =>
  k<string | null>(
    `(() => {
    const row = [...document.querySelectorAll(".page-window .fact")].find((r) => r.querySelector(".fact-label")?.firstChild?.textContent === ${JSON.stringify(label)});
    return row ? (row.querySelector(".fact-value")?.textContent ?? "") : null;
  })()`,
    p,
  );
/** A list of the page window by the start of its title: its rows' words, and the pages each names. */
const listOn = (start: string, p: Page = page) =>
  k<{ text: string; refs: string[] }[] | null>(
    `(() => {
    const box = [...document.querySelectorAll(".page-window .block-list")].find((b) => b.querySelector("h3")?.textContent?.startsWith(${JSON.stringify(start)}));
    return box ? [...box.querySelectorAll(".entry")].map((e) => ({ text: e.textContent ?? "", refs: [...e.querySelectorAll("a.ref-link")].map((a) => (a.getAttribute("href") ?? "").slice(1)) })) : null;
  })()`,
    p,
  );
/** The Family tab as drawn: its kin in the tree (not themself), and all its words. */
const familyShown = (p: Page = page) =>
  k<{ kin: string[]; text: string }>(
    `(() => {
    const body = document.querySelector(".page-window .page-body");
    return {
      kin: [...(body?.querySelectorAll(".family-tree .tree-person:not(.self)") ?? [])].map((e) => e.textContent ?? ""),
      text: body?.textContent ?? "",
    };
  })()`,
    p,
  );
/** The Body tab as drawn: each member and its state, from the body drawn, and whether it is drawn. */
const bodyShown = (p: Page = page) =>
  k<{ members: { member: string; state: string }[]; drawn: boolean }>(
    `(() => {
    const view = document.querySelector(".page-window .body-view"),
      canvas = view?.querySelector("canvas.body-figure");
    return {
      members: (view?.dataset.members ?? "").split(" ").filter(Boolean).map((x) => { const [member, state] = x.split(":"); return { member, state }; }),
      drawn: !!canvas && canvas.width > 0 && canvas.height > 0,
    };
  })()`,
    p,
  );
/** The battle fought in place before the town, where the tree has it (null: none). */
const placedNow = (p: Page = page) =>
  k<PlacedNow | null>(`globalThis.causalis.placedBattle?.() ?? null`, p);
/** How far the page window's blocks, the card and the page run over a phone's width. */
const overPhone = (p: Page = page) =>
  k<number>(
    `Math.max(0, document.documentElement.scrollWidth - innerWidth, ...[...document.querySelectorAll(".page-window:not([hidden]), .page-window .block")].map((b) => b.scrollWidth - b.clientWidth), ...[...document.querySelectorAll(${JSON.stringify(CARD)})].filter((c) => !c.hidden).map((c) => Math.ceil(c.getBoundingClientRect().right - innerWidth)))`,
    p,
  );
const sameSet = (a: readonly string[], b: readonly string[]) =>
  a.length === b.length && [...a].sort().join(" ") === [...b].sort().join(" ");

// —— 0. The world, and its people's plan ——————————————————————————————————————————————————
await begin(page);
const t0 = await now();
say(`the world at year ${Math.floor(t0 / YEAR)}, day ${Math.floor((t0 % YEAR) / DAY)}`);
const earth = await ask<Frame>("people.anatomy", {});
say(`Earth's people: ${earth.members.join(", ")}`);
check(earth.members.length >= 9, `Earth's plan has ${earth.members.length} members`);
// (The battle's blows are dealt at its hour, the morning of the turn's day: noon, all are dealt.)
const noon = Math.floor(t0 / DAY) * DAY + 12 * HOUR;
await advance(noon);

// —— 1. A fallen soldier before the town ————————————————————————————————————————————————
const candidates = await k<Candidate[]>(`(async () => {
  const c = globalThis.causalis.client,
    wars = await c.query({ type: "wars.map" }),
    province = c.latestFrame("globe")?.arrays.province,
    out = [];
  for (const b of wars.wars.flatMap((w) => w.battles)) {
    if (b.year !== wars.year - 1 || !(b.fallen > 0) || b.spot < 0) continue;
    const land = province?.[b.spot] ?? -1,
      town = land >= 0 ? await c.query({ type: "land.heart", args: { cell: land } }) : null;
    if (town) out.push({ ...b, town });
  }
  return out.sort((a, b) => b.fallen - a.fallen || (a.event < b.event ? -1 : 1));
})()`);
say(`${candidates.length} battles fought before a town at the turn`);
check(candidates.length > 0, "no battle fought before a town at the turn of year 365");
let at: (Candidate & { war: TownWarNow }) | null = null;
for (const c of candidates.slice(0, 4)) {
  await into(c.town);
  await page
    .waitForFunction(
      () => {
        const c = (globalThis as any).causalis,
          w = c.townWar?.();
        return (!!w?.fought && w.fallen > 0) || c.placedBattle?.()?.lying > 0;
      },
      undefined,
      { timeout: slow(15000) },
    )
    .catch(() => undefined);
  const w = await townWar(),
    pl = await placedNow();
  say(
    `${c.town}: ${w?.fought ? `the battle ${w.fought.event} (${w.fought.outcome}), ${w.fallen} fallen drawn, ${w.soldiers} standing` : "no battle fought before it drawn"}${pl ? `; fought in place: ${pl.lying} lying` : ""}`,
  );
  if (w?.fought && (w.fallen > 0 || (pl?.event === w.fought.event && pl.lying > 0))) {
    at = { ...c, war: w };
    break;
  }
}
check(!!at, "no town with the fallen of a battle fought before it drawn");
if (!at) await finish();
const town = at!.town,
  event = at!.war.fought!.event,
  roll = await ask<Roll | null>("battle.roll", { event });
check(!!roll, `no roll for the battle ${event}`);
const rolled = (side: Roll["attacker"] | undefined) => [
  ...(side?.fell ?? []),
  ...(side?.hurt ?? []),
  ...(side?.stood ?? []),
];
const names = new Set([...rolled(roll?.attacker), ...rolled(roll?.defender)].map((e) => e.name));
{
  const ms = at!.war.middles.filter((m): m is { x: number; z: number } => !!m);
  if (ms.length)
    await face(
      ms.reduce((a, m) => a + m.x, 0) / ms.length,
      ms.reduce((a, m) => a + m.z, 0) / ms.length,
      34,
    );
  await shot("1-before-the-town");
}
/** Who the figure tapped stands for, as the battle fought in place names him (where it was one of it). */
let expected: { name: string; ref: string } | null = null;
/** A soldier of the war tapped: the eye brought down to him first; his card. */
const tapMan = async (fallen: boolean, p: Page = page, touch = false, skip = 0) => {
  // The card put away (on a phone it covers the screen's lower half), the eye over the war.
  const close = p.locator(`${CARD} button.close:visible`);
  if (await close.count()) await close.first().click();
  expected = null;
  // (The battle fought in place, Phase 55 M227: its fallen lie on its field till they are borne in.)
  const pl = await placedNow(p);
  if (pl && pl.lying > 0) {
    await face(pl.frame.x, pl.frame.z, 34, p);
    const vw = await k<number>(`innerWidth`, p),
      vh = await k<number>(`innerHeight`, p),
      men = ((await placedNow(p))?.onScreen ?? []).filter(
        (m) => m.at && m.name && m.ref && (m.fate === "fell") === fallen,
      ),
      man = [...men].sort(
        (a, b) =>
          Math.hypot(a.at!.x - vw / 2, a.at!.y - vh / 2) -
            Math.hypot(b.at!.x - vw / 2, b.at!.y - vh / 2) || a.id - b.id,
      )[skip];
    if (!man) {
      say(`no ${fallen ? "fallen" : "standing"} soldier of the battle in place before the eye`);
      return null;
    }
    expected = { name: man.name!, ref: man.ref! };
    if (touch) await p.touchscreen.tap(man.at!.x, man.at!.y);
    else await p.mouse.click(man.at!.x, man.at!.y);
    await p.waitForTimeout(slow(800));
    return cardWithKin(p);
  }
  const ms = ((await townWar(p))?.middles ?? []).filter((m): m is { x: number; z: number } => !!m);
  if (ms.length)
    await face(
      ms.reduce((a, m) => a + m.x, 0) / ms.length,
      ms.reduce((a, m) => a + m.z, 0) / ms.length,
      34,
      p,
    );
  const drawn = await menOnScreen(p),
    men = drawn.filter((m) => m.fallen === fallen),
    vw = await k<number>(`innerWidth`, p),
    vh = await k<number>(`innerHeight`, p),
    // (The one nearest the middle of the screen.)
    man = [...men].sort(
      (a, b) =>
        Math.hypot(a.x - vw / 2, a.y - vh / 2) - Math.hypot(b.x - vw / 2, b.y - vh / 2) ||
        a.slot - b.slot,
    )[skip];
  if (!man) {
    say(`no ${fallen ? "fallen" : "standing"} soldier before the eye (${drawn.length} drawn)`);
    return null;
  }
  await face(man.ground.x, man.ground.z, 5, p);
  const again = (await menOnScreen(p)).find((m) => m.slot === man.slot);
  if (!again) {
    say("the soldier faced is out of sight");
    return null;
  }
  if (touch) await p.touchscreen.tap(again.x, again.y);
  else await p.mouse.click(again.x, again.y);
  await p.waitForTimeout(slow(800));
  return cardWithKin(p);
};
let fell = await tapMan(true);
// (Another of them, if the first stood for no man named.)
/** Whether a card tapped is of a man the roll names: the one the figure stands for, where told. */
const ofRoll = (c: Card | null) => {
  const name = c?.name.replace(/^\S+ /, "") ?? "";
  return !!c && (expected ? name === expected.name : names.has(name));
};
for (let skip = 1; skip < 4 && fell && !ofRoll(fell); skip++)
  fell = await tapMan(true, page, false, skip);
const fellName = fell?.name.replace(/^\S+ /, "") ?? "",
  fellExpected = expected as { name: string; ref: string } | null;
say(
  `a fallen soldier tapped: “${fell?.name}” — ${fell?.facts.join(" | ")} | ${fell?.family} | ${fell?.body}`,
);
check(ofRoll(fell), `the fallen soldier tapped not named from the roll (${fell?.name})`);
check(
  !!fell?.facts.some((f) => /^Fell in the battle/.test(f)),
  "the fallen soldier's card does not tell he fell there",
);
check(/^Family: \S/.test(fell?.family ?? ""), `no family on the soldier's card (${fell?.family})`);
// (No day of his is drawn: no line of one's day, nor one left from whom the eye looked at before.)
check(!/^Now [a-z]/.test(fell?.now ?? ""), `the soldier's card tells a day of his (${fell?.now})`);
check(
  /^Body: Killed by a blow to /.test(fell?.body ?? ""),
  `the soldier's card does not tell the blow that killed him (${fell?.body})`,
);
await shot("2-fallen-card");
// His page: the Family tab, then the Body tab; the family the same on a second opening.
let fallenRef = "";
{
  const button = page.locator(`${CARD} button:visible`, { hasText: /^(Their|His) page/ });
  check((await button.count()) > 0, "no page on the fallen soldier's card");
  if (await button.count()) {
    const before = await title();
    await button.first().click();
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
  }
  const named = await title(),
    shownTabs = await tabs();
  fallenRef =
    fellExpected?.ref ??
    [...(roll?.attacker.fell ?? []), ...(roll?.defender.fell ?? [])].find(
      (e) => e.name === fellName,
    )?.ref ??
    "";
  say(`his page “${named}”: tabs ${shownTabs.join(", ")}`);
  check(named === fellName, `the page opened from his card is “${named}”, not ${fellName}'s`);
  check(
    shownTabs.includes("Family") && shownTabs.includes("Body"),
    `his page lacks a Family or Body tab (${shownTabs.join(", ")})`,
  );
  const lines = { family: await factOn("Family"), body: await factOn("Body") };
  check(
    !!lines.family && !!lines.body,
    "his page's overview does not tell his family and body in a line",
  );
  await tabTo("Family");
  const fam = await familyShown();
  say(`his family: ${fam.kin.length} kin (${fam.kin.slice(0, 4).join("; ")})`);
  check(fam.kin.length >= 1, "no kin in the fallen soldier's family");
  await shot("3-fallen-family");
  await tabTo("Body");
  const body = await bodyShown(),
    each = (await listOn("Each member")) ?? [];
  say(
    `his body: ${body.members.map((m) => `${m.member}:${m.state}`).join(" ")}; drawn ${body.drawn}`,
  );
  check(
    sameSet(
      body.members.map((m) => m.member),
      earth.members,
    ),
    "his body's members are not his people's plan",
  );
  check(
    body.members.some((m) => m.state === "killed"),
    "no member of the fallen soldier's body bears the blow that killed",
  );
  check(
    each.some((r) => r.text.includes("the blow that killed")),
    "the fallen soldier's members do not tell the blow that killed",
  );
  check(body.drawn, "the fallen soldier's body not drawn");
  await shot("4-fallen-body");
  // Opened again: the same family.
  await putAway();
  if (fallenRef) {
    await opened(`${fallenRef}#family`);
    const again = await familyShown();
    check(again.text === fam.text, "the soldier's family differs on a second opening");
  }
}

// —— 2. One maimed in the battle: the member lost, as his wounds tell it ——————————————————————
{
  const maimed = [...(roll?.attacker.hurt ?? []), ...(roll?.defender.hurt ?? [])].filter(
    (e) => e.maimed,
  );
  let found = false;
  for (const e of maimed.slice(0, 16)) {
    const kin = await ask<Kin>("kin.card", { ref: e.ref, t: noon });
    if (!/^Lost /.test(kin.body ?? "")) continue;
    found = true;
    await putAway();
    const named = await opened(`${e.ref}#body`),
      body = await bodyShown(),
      lost = body.members.filter((m) => m.state === "lost"),
      wounds = (await listOn("His wounds")) ?? (await listOn("Her wounds")) ?? [];
    say(
      `maimed: ${named} — “${kin.body}”; lost ${lost.map((m) => m.member).join(", ")}; wounds: ${wounds.map((w) => w.text).join(" | ")}`,
    );
    check(named === e.name, `the maimed man's page is “${named}”, not ${e.name}'s`);
    check(lost.length >= 1, `${e.name}'s body shows no member lost`);
    check(
      lost.some((m) =>
        (kin.body ?? "")
          .toLowerCase()
          .includes((earth.words[m.member] ?? m.member).replace(/^.*~ /, "")),
      ),
      `${e.name}'s lost member (${lost.map((m) => m.member).join(", ")}) not the one his card tells (${kin.body})`,
    );
    check(
      wounds.some((w) => /^Lost /.test(w.text)),
      `${e.name}'s wounds do not tell the member lost`,
    );
    await shot("5-maimed-body");
    break;
  }
  say(`${maimed.length} maimed on the roll${found ? "" : ", none of them lost a member"}`);
  check(found || maimed.length === 0, "none maimed in the battle lost a member by their card");
}

// —— 3. One of the town's people ————————————————————————————————————————————————————————
const plan = await ask<Plan>("village.plan", {
  ref: town,
  families: QUALITY.families,
  folk: QUALITY.folk,
});
const lineOf = (ref: string) => Number(ref.split(":")[4] ?? -1);
{
  await putAway();
  const plain = plan.people
    .map((p, index) => ({ p, index }))
    .filter(({ p }) => p.folk && !p.trade && !p.healer && !p.child && /^folk:town:/.test(p.ref));
  const mates = (p: PlanPerson) =>
    plan.people.filter(
      (q) =>
        q.folk &&
        !q.trade &&
        !q.healer &&
        q.ref !== p.ref &&
        Math.floor(lineOf(q.ref) / 4) === Math.floor(lineOf(p.ref) / 4),
    );
  const one = plain.find(({ p }) => mates(p).length >= 1) ?? plain[0];
  check(!!one, `no one of ${plan.name}'s people drawn to tap`);
  if (one) {
    // The eye brought down to them; tapped.
    const p = one.p;
    const spot = await k<{ x: number; z: number } | null>(
      `(globalThis.causalis.peopleNow?.() ?? []).find((q) => q.index === ${one.index}) ?? null`,
    );
    if (spot) {
      await k(
        `globalThis.causalis.rig.flyTo({ target: { x: ${spot.x * 0.1}, y: 0, z: ${spot.z * 0.1} }, distance: 3.5, pitch: -40 })`,
      );
      await page.waitForTimeout(slow(2500));
    }
    const on = await k<{ x: number; y: number } | null>(
      `globalThis.causalis.personOnScreen?.(${one.index}) ?? null`,
    );
    if (on) await page.mouse.click(on.x, on.y);
    await page.waitForTimeout(slow(800));
    const c = await cardWithKin();
    say(`${p.name} tapped: “${c.name}” | ${c.family} | ${c.body}`);
    check(c.name === p.name, `the card of ${p.name} not come (“${c.name}”)`);
    check(/^Family: \S/.test(c.family), `no family on ${p.name}'s card`);
    check(/^Body: \S/.test(c.body), `no body on ${p.name}'s card`);
    await shot("6-townsfolk-card");
    const named = await opened(`${p.ref}#family`),
      roof = (await listOn("Under the same roof")) ?? [],
      under = new Set(roof.flatMap((r) => r.refs)),
      drawnWith = mates(p).map((q) => q.ref),
      missing = drawnWith.filter((r) => !under.has(r)),
      fam = await familyShown();
    say(
      `their page “${named}”: ${fam.kin.length} kin; under the same roof ${roof.length}; drawn at their home ${drawnWith.length}${missing.length ? `, missing ${missing.join(", ")}` : ""}`,
    );
    check(named === p.name, `${p.name}'s page titled “${named}”`);
    check(fam.kin.length >= 1, `no kin in ${p.name}'s family`);
    check(!missing.length, `${p.name}'s roof leaves out those the town draws at their home`);
    await shot("7-townsfolk-family");
    await tabTo("Body");
    const body = await bodyShown();
    check(
      sameSet(
        body.members.map((m) => m.member),
        earth.members,
      ),
      `${p.name}'s body is not their people's plan`,
    );
    await shot("8-townsfolk-body");
  }
  // A maker, the healer, and one met: their pages tell their family and body too.
  const maker = plan.people.find((p) => p.trade),
    met = plan.people.find((p) => !p.folk && /^prsn:/.test(p.ref));
  for (const [what, ref] of [
    ["a maker", maker?.trade ? `seat:${town}:${maker.trade.kind}:${maker.trade.seat}` : null],
    ["the healer", plan.people.some((p) => p.healer) ? `heal:${town}` : null],
    ["one met", met?.ref ?? null],
  ] as const) {
    if (!ref) {
      say(`${what}: none drawn in ${plan.name}`);
      continue;
    }
    await putAway();
    const named = await opened(ref),
      shownTabs = await tabs();
    say(`${what}: “${named}”, tabs ${shownTabs.join(", ")}`);
    check(shownTabs.includes("Body"), `${what}'s page (${ref}) has no Body tab`);
    check(
      what === "one met" || shownTabs.includes("Family"),
      `${what}'s page (${ref}) has no Family tab`,
    );
  }
}

// —— 6a. At a phone's width (Chromium): the soldier's card and page ——————————————————————————————
{
  await putAway();
  await page.setViewportSize({ width: 430, height: 932 });
  await page.waitForTimeout(slow(800));
  const c = await tapMan(true);
  check(!!c && /^Family: /.test(c.family), "a soldier's card on a phone's width has no family");
  check(!/^Now [a-z]/.test(c?.now ?? ""), `a soldier's card keeps a townsperson's day (${c?.now})`);
  await shot("10-narrow-card");
  const over1 = await overPhone();
  if (fallenRef) await opened(`${fallenRef}#body`);
  await page.waitForTimeout(slow(600));
  const over2 = await overPhone();
  await shot("11-narrow-body");
  say(`at a phone's width: the card ${over1} px over, the page ${over2} px over`);
  // (A pixel's rounding allowed, no more.)
  check(over1 <= 1 && over2 <= 1, `wider than a phone (card ${over1} px, page ${over2} px over)`);
  await page.setViewportSize({ width: 1366, height: 800 });
  await page.waitForTimeout(slow(500));
}

// —— 4. One borne home on a litter ——————————————————————————————————————————————————————————
{
  await putAway();
  type Row = { ref: string; name: string; healer: boolean; hospital: boolean; borne: number };
  const rows = await ask<Row[]>("village.wounded", { most: 40 });
  let tapped = false;
  for (const row of rows.filter((r) => r.borne > 0).slice(0, 6)) {
    const p2 = await ask<Plan>("village.plan", {
        ref: row.ref,
        families: QUALITY.families,
        folk: QUALITY.folk,
      }),
      t = await now(),
      borne = p2.people.findIndex((p) =>
        (p.wounds ?? []).some((w) => w.borne && w.home >= t && w.home < t + 12 * DAY),
      );
    if (borne < 0) continue;
    await into(row.ref);
    const day = Math.floor(
      p2.people[borne]!.wounds!.find((w) => w.borne && w.home >= t)!.home / DAY,
    );
    await advance(day * DAY + 15.6 * HOUR);
    let s = await k<Shown | null>(`globalThis.causalis.wounds?.() ?? null`);
    const l = s?.litters.find((x) => x.index === borne) ?? s?.litters[0];
    if (!l) continue;
    await advance((l.start + l.arrive) / 2);
    s = await k<Shown | null>(`globalThis.causalis.wounds?.() ?? null`);
    const q = s?.littersNow.find((x) => x.index === l.index && x.borne);
    if (!q) continue;
    await face(q.x, q.z, 3);
    const on = (
      await k<{ index: number; x: number; y: number }[]>(
        `globalThis.causalis.littersOnScreen?.() ?? []`,
      )
    ).find((x) => x.index === l.index);
    if (!on) continue;
    await page.mouse.click(on.x, on.y);
    await page.waitForTimeout(slow(800));
    const c = await cardWithKin(),
      who = p2.people[l.index]!;
    say(`borne home in ${row.name}: “${c.name}” — ${c.now} | ${c.family} | ${c.body}`);
    check(/^Now borne on a litter/.test(c.now), `the one borne is not told borne (${c.now})`);
    check(c.name === who.name, `the card of the one borne (${who.name}) not come (“${c.name}”)`);
    check(/^Family: \S/.test(c.family), "no family on the card of the one borne home");
    check(
      /^Body: (Struck|Lost|Burned|Hurt)/.test(c.body),
      `the card of the one borne home does not tell their wound (${c.body})`,
    );
    await shot("9-litter-card");
    tapped = true;
    break;
  }
  check(tapped, "no one borne home on a litter could be tapped");
}

// —— 5. An alien people's plan ——————————————————————————————————————————————————————————————
{
  await page.goto(`${base}?universe=alien&seed=${encodeURIComponent("alien 9")}&year=30&hold=1`);
  await page.waitForFunction(
    () => ((globalThis as any).causalis?.drawn?.() as number) > 0,
    undefined,
    { timeout: 900000 },
  );
  const alien = await ask<Frame>("people.anatomy", {});
  say(`alien 9's people: ${alien.members.join(", ")}`);
  check(alien.members.length > 0, "alien 9's people have no plan");
  check(!sameSet(alien.members, earth.members), "alien 9's people's plan is Earth's");
}

// —— 6. On a phone: WebKit at 430×932, three to a pixel, by touch ———————————————————————————————
if (!ci) {
  const phone = await webkit.launch();
  browsers.push(phone);
  const ctx = await phone.newContext({
      viewport: { width: 430, height: 932 },
      deviceScaleFactor: 3,
      // (Not isMobile: Playwright's WebKit here then brings no events from a touch at all.)
      hasTouch: true,
    }),
    p = await ctx.newPage();
  watchErrors(p, "phone");
  const a = performance.now();
  await begin(p);
  await advance(noon, p);
  await into(town, p);
  await p
    .waitForFunction(
      () => {
        const c = (globalThis as any).causalis,
          w = c.townWar?.();
        return (!!w?.fought && w.fallen > 0) || c.placedBattle?.()?.lying > 0;
      },
      undefined,
      { timeout: slow(15000) },
    )
    .catch(() => undefined);
  const w = await townWar(p),
    ms = (w?.middles ?? []).filter((m): m is { x: number; z: number } => !!m);
  if (ms.length)
    await face(
      ms.reduce((s, m) => s + m.x, 0) / ms.length,
      ms.reduce((s, m) => s + m.z, 0) / ms.length,
      34,
      p,
    );
  const c = await tapMan(true, p, true);
  say(
    `on the phone (${Math.round((performance.now() - a) / 1000)} s in): “${c?.name}” | ${c?.family} | ${c?.body}`,
  );
  check(ofRoll(c), `the soldier tapped on the phone not named (${c?.name})`);
  check(/^Family: \S/.test(c?.family ?? ""), "no family on the soldier's card on the phone");
  check(/^Body: \S/.test(c?.body ?? ""), "no body on the soldier's card on the phone");
  const over1 = await overPhone(p);
  await shot("12-webkit-card", p);
  const button = p.locator(`${CARD} button:visible`, { hasText: /^(Their|His) page/ });
  if (await button.count()) {
    await touchOn(button.first(), p);
    await p
      .waitForFunction(
        () => {
          const t = document.querySelector(".page-window .page-title")?.textContent;
          return !!t && t !== "…";
        },
        undefined,
        { timeout: slow(30000) },
      )
      .catch(() => undefined);
    await p.waitForTimeout(slow(600));
  } else check(false, "no page on the soldier's card on the phone");
  const shownTabs = await tabs(p);
  check(
    shownTabs.includes("Family") && shownTabs.includes("Body"),
    `his page on the phone lacks a Family or Body tab (${shownTabs.join(", ")})`,
  );
  await tabTo("Family", p, true);
  const fam = await familyShown(p);
  check(fam.kin.length >= 1, "no kin in his family on the phone");
  await shot("13-webkit-family", p);
  await tabTo("Body", p, true);
  const body = await bodyShown(p),
    over2 = await overPhone(p);
  check(body.drawn, "his body not drawn on the phone");
  await shot("14-webkit-body", p);
  say(`at the phone: the card ${over1} px over, the page ${over2} px over`);
  check(over1 <= 1 && over2 <= 1, `wider than a phone (card ${over1} px, page ${over2} px over)`);
}

await finish();
