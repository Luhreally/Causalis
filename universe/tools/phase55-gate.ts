// node tools/phase55-gate.ts [--ci] [--soft] [--shots dir] — the Phase 55 gate, wave 3 (wounds
// seen, M226, and healing, M229; asked for 2026-10-26: "Wounds and lost limbs shown on the person
// and told on their page. Healers tending the wounded."), on the built app, the Earth seed at the
// turn of year 365, in a town whose levy comes home wounded from the battles at the year's turn:
//   1. the levy home: the town come out by the road, kin waiting at the door, the wounded borne in
//      on a litter between two, set down at their door;
//   2. abed: the one borne home out of sight, abed at home;
//   3. the healer: seeing to the fresh wounds that evening, and the next morning's round, door to
//      door to those abed;
//   4. up and bound: one healing walks out bandaged;
//   5. marked for good: one with a crutch, a stump or a patch drawn so;
//   6. their card: tapped, their wounds told on it; their page: "Their wounds"; the healer's card
//      opening the healer's page;
//   7. the town's page: its Wounded tab; the healer's page, whom they tend;
//   8. the pages at a phone's width.
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
console.log("the Phase 55 gate (wave 3)");
if (shots) mkdirSync(shots, { recursive: true });

const DAY = 86400,
  HOUR = 3600,
  YEAR = 365 * DAY,
  /** The village's quality: its families and its crowd, as the app asks its plan (render/quality.ts, "high"). */
  QUALITY = { name: "high", families: 10, folk: 220 } as const;

type Wound = {
  event: string;
  from: string;
  member: string;
  outcome: string;
  lasting: string | null;
  at: number;
  home: number;
  up: number;
  mended: number;
  tended: string;
  borne: boolean;
};
type PlanPerson = {
  ref: string;
  name: string;
  home: number;
  folk?: boolean;
  trade?: unknown;
  healer?: { years: number };
  wounds?: Wound[];
  away?: { event: string; from: number; until: number }[];
};
type Plan = { ref: string; name: string; people: PlanPerson[] };
type Row = {
  ref: string;
  name: string;
  population: number;
  healer: boolean;
  hospital: boolean;
  wounded: number;
  borne: number;
  maimed: number;
  at: number;
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
type Shown = {
  looks: number;
  drawn: {
    bandage: number;
    patch: number;
    sling: number;
    crutch: number;
    scar: number;
    stumps: number;
  };
  abed: number[];
  away: number;
  gone: number;
  homes: { index: number; x: number; z: number }[];
  healing: { index: number; ref: string; up: number; mended: number }[];
  lasting: { index: number; ref: string; marks: string[] }[];
  homecomings: {
    event: string;
    at: number;
    where: string;
    people: number;
    wounded: number;
    borne: number;
  }[];
  litters: { index: number; start: number; arrive: number; bearers: number[] }[];
  littersNow: { x: number; z: number; borne: boolean; index: number }[];
  edge: { x: number; z: number };
};
type Leg = { from: number; to: number; why: string | null; task: string | null };

const root = fileURLToPath(new URL("..", import.meta.url)),
  // (CAUSALIS_DIST: a build elsewhere, so that one can be looked at while dist/ is under test.)
  server = await preview({
    root,
    logLevel: "silent",
    preview: { port: 4313, strictPort: false },
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
const shot = async (name: string) => {
  if (shots) await page.screenshot({ path: join(shots, `${name}.png`) });
};
const fail = async () => {
  await browser.close();
  await server.close();
  console.log("FAILED:");
  for (const p of problems) console.log(`  - ${p}`);
  process.exit(1);
};
const people = () => k<Person[]>(`globalThis.causalis.peopleNow?.() ?? []`);
const shown = () => k<Shown | null>(`globalThis.causalis.wounds?.() ?? null`);
const legs = (i: number) => k<Leg[]>(`globalThis.causalis.legs?.(${i}) ?? []`);
const now = () => k<number>(`globalThis.causalis.client.status?.t ?? 0`);
/** On to moment t (the clock held): the host's word of it come, and a few frames drawn there. */
const advance = async (t: number) => {
  await k(`globalThis.causalis.client.advance(${Math.round(t)})`);
  await page
    .waitForFunction((at) => ((globalThis as any).causalis.client.status?.t ?? 0) >= at - 1, t, {
      timeout: slow(30000),
    })
    .catch(() => undefined);
  await page.waitForTimeout(slow(600));
};
/** The eye over a point of the town (metres), so far off (the rig's units: ten metres each). */
const face = async (x: number, z: number, distance = 4) => {
  await k(`globalThis.causalis.faceTown(${x}, ${z}, ${distance})`);
  await page.waitForTimeout(slow(1200));
};
const near = (p: { x: number; z: number }, q: { x: number; z: number }, r: number) =>
  Math.hypot(p.x - q.x, p.z - q.z) < r;
const title = () =>
  page.$eval(".page-window .page-title", (e) => e.textContent ?? "").catch(() => "");
/** A page opened in the page window, by ref: its title come. */
const opened = async (ref: string) => {
  const before = await title();
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
  return title();
};
/** A list on the page window by the start of its title: its rows' words. */
const listOn = (start: string) =>
  k<string[] | null>(`(() => {
    const box = [...document.querySelectorAll(".page-window .block-list")].find((b) => b.querySelector("h3")?.textContent?.startsWith(${JSON.stringify(start)}));
    return box ? [...box.querySelectorAll(".entry")].map((e) => e.textContent ?? "") : null;
  })()`);
/** A fact of the page window by its label: its words. */
const factOn = (label: string) =>
  k<string | null>(`(() => {
    const row = [...document.querySelectorAll(".page-window .fact")].find((r) => r.querySelector(".fact-label")?.textContent === ${JSON.stringify(label)});
    return row ? (row.querySelector(".fact-value")?.textContent ?? "") : null;
  })()`);
/** At a phone's width: how far the page window's blocks run over. */
const onPhone = async (name: string) => {
  await page.setViewportSize({ width: 430, height: 932 });
  await page.waitForTimeout(slow(800));
  const over = await k<number>(
    `Math.max(0, ...[...document.querySelectorAll(".page-window .block")].map((b) => b.scrollWidth - b.clientWidth))`,
  );
  await shot(name);
  await page.setViewportSize({ width: 1366, height: 800 });
  await page.waitForTimeout(slow(500));
  return over;
};
/** The village's card (the page window is an inspector too). */
const CARD = ".inspector:not(.page-window)";
/** The page window put away, where it is open. */
const putAway = async () => {
  const close = page.locator(".page-window button.close:visible");
  if (await close.count()) await close.first().click();
  await page.waitForTimeout(slow(300));
};
/** One drawn tapped, the eye brought down to them first (the page window put away): whether their card came. */
const tap = async (i: number) => {
  const p = (await people()).find((q) => q.index === i);
  if (!p) return false;
  await putAway();
  await k(
    `globalThis.causalis.rig.flyTo({ target: { x: ${p.x * 0.1}, y: 0, z: ${p.z * 0.1} }, distance: 3.5, pitch: -40 })`,
  );
  await page.waitForTimeout(slow(2500));
  const at = await k<{ x: number; y: number } | null>(
    `globalThis.causalis.personOnScreen?.(${i}) ?? null`,
  );
  if (!at) return false;
  await page.mouse.click(at.x, at.y);
  await page.waitForTimeout(slow(1200));
  return (await page.locator(`${CARD} h2:visible`, { hasText: p.name }).count()) > 0;
};
const ofDay = (t: number) => Math.floor(t / DAY);

await page.goto(`${base}?universe=earth&seed=${encodeURIComponent("first light")}&year=365&hold=1`);
await page.waitForFunction(
  () => ((globalThis as any).causalis?.drawn?.() as number) > 0,
  undefined,
  { timeout: 900000 },
);
await k(`globalThis.causalis.setQuality("${QUALITY.name}")`);
await k(`globalThis.causalis.client.setSpeed(0)`);
const t0 = await now();
say(`the world at year ${Math.floor(t0 / YEAR)}, day ${ofDay(t0 % YEAR)}`);

// The town: of those whose levy comes home wounded, the first whose plan as drawn has one borne
// home on a litter and its healer, and no hospital (so the healer goes the round); one with an old
// wound marking them for good, where there is such a town.
const rows = await ask<Row[]>("village.wounded", { most: 40 });
say(`${rows.length} towns whose levy comes home wounded this year`);
check(rows.length > 0, "no town's levy comes home wounded at the turn of year 365");
let town: { row: Row; plan: Plan; borne: number; healer: number; marked: number } | null = null;
for (const row of rows.filter((r) => r.healer && !r.hospital && r.borne > 0).slice(0, 12)) {
  const plan = await ask<Plan>("village.plan", {
      ref: row.ref,
      families: QUALITY.families,
      folk: QUALITY.folk,
    }),
    borne = plan.people.findIndex((p) =>
      (p.wounds ?? []).some((w) => w.borne && w.home >= t0 && w.home < t0 + 12 * DAY),
    ),
    healer = plan.people.findIndex((p) => !!p.healer),
    marked = plan.people.findIndex((p) =>
      (p.wounds ?? []).some(
        (w) =>
          (w.lasting === "crutch" || w.lasting === "stump" || w.lasting === "patch") &&
          w.up < t0 + 60 * DAY,
      ),
    );
  if (borne < 0 || healer < 0) continue;
  if (!town || (town.marked < 0 && marked >= 0)) town = { row, plan, borne, healer, marked };
  if (marked >= 0) break;
}
say(
  town
    ? `the town: ${town.row.name} (${town.row.population} people): ${town.row.wounded} of its lines wounded, ${town.row.borne} borne, ${town.row.maimed} maimed; drawn: ${town.plan.people.length}, its healer ${town.plan.people[town.healer]!.name}`
    : "no town with one borne home drawn and a healer",
);
check(!!town, "no town whose wounded borne home are drawn, with a healer and no hospital");
if (!town) await fail();
const { plan, healer } = town!;
await k(`globalThis.causalis.goTo(${JSON.stringify(plan.ref)})`);
await page
  .waitForFunction(() => ((globalThis as any).causalis.watching?.() ?? 0) > 0, undefined, {
    timeout: slow(120000),
  })
  .catch(() => undefined);
await k(`globalThis.causalis.client.setSpeed(0)`);
await page.waitForTimeout(slow(800));
const drawnCount = await k<number>(`globalThis.causalis.watching?.() ?? 0`);
check(
  drawnCount === plan.people.length,
  `${drawnCount} drawn, not the plan's ${plan.people.length}`,
);

// 1. The levy home.
const comesHome = plan.people[town!.borne]!.wounds!.find((w) => w.borne && w.home >= t0)!,
  homeDay = ofDay(comesHome.home);
await advance(homeDay * DAY + 15.6 * HOUR);
let s = await shown();
const coming = s?.homecomings.find((h) => ofDay(h.at) === homeDay && h.borne > 0);
say(
  coming
    ? `the levy home from ${coming.where}: day ${homeDay - ofDay(t0)} at ${((coming.at % DAY) / HOUR).toFixed(2)} h, ${coming.people} drawn of it, ${coming.wounded} wounded, ${coming.borne} borne`
    : "no homecoming told",
);
check(!!coming, "the homecoming with one borne not told");
const lit = s?.litters ?? [];
say(
  `its litters: ${lit.length} (${lit.map((l) => `${l.bearers.length} bearing ${l.index}`).join(", ")})`,
);
check(lit.length >= 1, "no litter to bear the wounded home");
check(
  lit.every((l) => l.bearers.length === 2),
  "a litter without two to bear it",
);
if (coming && lit.length) {
  // The town come out by the road, kin at the door, before the column comes in.
  await advance(coming.at - 4 * 60);
  const before = await people(),
    crowd = before.filter((p) => p.why?.startsWith("Come to see the levy home")),
    kin = before.filter((p) => p.why?.startsWith("Waiting at the door for")),
    bearers = before.filter((p) => p.why?.startsWith("Waiting at the road's end to bear"));
  s = await shown();
  say(
    `before it comes in: ${crowd.length} come to see it home, ${kin.length} waiting at the door, ${bearers.length} at the road's end to bear the wounded`,
  );
  check(crowd.length >= 3, `too few come out to see the levy home (${crowd.length})`);
  check(kin.length >= 1, "no kin waiting at the door");
  check(bearers.length >= 2, `too few waiting to bear the wounded (${bearers.length})`);
  if (s) {
    await face(s.edge.x, s.edge.z, 6);
    await shot("1-the-road");
  }
  // Borne in between two.
  const l = lit[0]!;
  await advance((l.start + l.arrive) / 2);
  s = await shown();
  const now1 = await people(),
    on = s?.littersNow.find((q) => q.index === l.index),
    carrying = now1.filter((p) => l.bearers.includes(p.index));
  say(
    `on the way: the litter ${on ? (on.borne ? "borne" : "set down") : "not drawn"}; its bearers ${carrying.map((p) => `${p.task}/${p.carry}`).join(", ")}`,
  );
  check(!!on && on.borne, "the litter not borne");
  check(
    carrying.length === 2 && carrying.every((p) => p.task === "carry" && p.carry === "litter"),
    "the litter's bearers not carrying it",
  );
  check(!!on && carrying.every((p) => near(p, on, 4)), "the litter not between its bearers");
  check(!now1.some((p) => p.index === l.index), "the one borne drawn walking");
  if (on) {
    await face(on.x, on.z, 3);
    await shot("2-litter");
  }
  // Set down at their door.
  await advance(l.arrive + 20);
  s = await shown();
  const down = s?.littersNow.find((q) => q.index === l.index),
    home = plan.people[l.index]!.home;
  say(`at the door: the litter ${down ? (down.borne ? "still borne" : "set down") : "gone"}`);
  check(!!down && !down.borne, "the litter not set down at the door");
  if (down) {
    await face(down.x, down.z, 3);
    await shot("3-door");
  }
  // 2. Abed.
  await advance(l.arrive + 10 * 60);
  s = await shown();
  say(
    `then: ${s?.abed.length ?? 0} abed, ${s?.away ?? 0} away with the levy still, ${s?.gone ?? 0} gone`,
  );
  check(!!s?.abed.includes(l.index), "the one borne home not abed");
  check(
    !(await people()).some((p) => p.index === l.index),
    "the one borne home drawn up and about",
  );
  check(
    !!s?.homes.some((h) => h.index === l.index),
    `the home of the one borne (home ${home}) not among the homes of those abed`,
  );
}

// 3. The healer: the fresh wounds seen to that evening; the next morning's round.
const evening = (await legs(healer)).find(
  (g) => g.task === "heal" && g.why?.startsWith("Seeing to"),
);
say(`the healer's evening: ${evening ? evening.why : "no one seen to"}`);
check(!!evening, "the healer sees no one newly home that evening");
if (evening) {
  await advance(homeDay * DAY + (evening.from + evening.to) / 2);
  const h = (await people()).find((p) => p.index === healer);
  check(h?.task === "heal", `the healer at ${h?.task ?? "nothing"}, not seeing to the wounds`);
  if (h) {
    await face(h.x, h.z, 3);
    await shot("4-evening");
  }
}
await advance((homeDay + 1) * DAY + 7 * HOUR);
const round = (await legs(healer)).filter((g) => g.task === "heal");
say(`the morning's round: ${round.length} doors (${round.map((g) => g.why).join("; ")})`);
check(round.length >= 1, "no round of the wounded abed the next morning");
if (round.length) {
  const g = round[0]!;
  await advance((homeDay + 1) * DAY + (g.from + g.to) / 2);
  s = await shown();
  const h = (await people()).find((p) => p.index === healer);
  check(h?.task === "heal", "the healer not at the round's first door");
  check(
    !!h && !!s?.homes.some((q) => near(q, h, 12)),
    "the healer's first door not the home of one abed",
  );
  if (h) {
    await face(h.x, h.z, 3);
    await shot("5-round");
    // The healer's card opens their page.
    if (await tap(healer)) {
      const button = page.locator(`${CARD} button:visible`, { hasText: "Their page" });
      check((await button.count()) > 0, "no page on the healer's card");
      if (await button.count()) {
        await button.first().click();
        await page
          .waitForFunction(
            () => String((globalThis as any).causalis.pageOpen?.() ?? "").startsWith("heal:"),
            undefined,
            { timeout: slow(30000) },
          )
          .catch(() => undefined);
        await page.waitForTimeout(slow(600));
        const ref = String(await k(`globalThis.causalis.pageOpen?.() ?? ""`)),
          named = await title();
        say(`the healer's card: their page ${ref}, “${named}”`);
        check(ref === `heal:${plan.ref}`, `the healer's card opened ${ref || "nothing"}`);
        check(named === plan.people[healer]!.name, `the healer's page titled “${named}”`);
        await shot("6-healer-page");
        await putAway();
      }
    } else check(false, "the healer could not be tapped");
  }
}

// 4. Up and bound: the first of those healing up again from here on, bound.
s = await shown();
const t3 = await now(),
  up = (s?.healing ?? []).filter((q) => q.up >= t3).sort((a, b) => a.up - b.up)[0];
say(up ? `up first: ${plan.people[up.index]!.name}, day ${ofDay(up.up) - ofDay(t0)}` : "no one up");
check(!!up, "no one healing gets up again");
if (up) {
  await advance((ofDay(up.up) + 1) * DAY + 15.5 * HOUR);
  s = await shown();
  const p = (await people()).find((q) => q.index === up.index);
  say(
    `up and bound: ${p ? (p.why ?? p.task ?? "about") : "not drawn"}; drawn ${s?.drawn.bandage ?? 0} bandages, ${s?.drawn.sling ?? 0} slings`,
  );
  check(!!p, "the one up again not drawn");
  check((s?.drawn.bandage ?? 0) + (s?.drawn.sling ?? 0) >= 1, "no wound bound drawn");
  if (p) {
    await face(p.x, p.z, 2.5);
    await shot("7-bound");
  }
}

// 5. Marked for good: one with a crutch, a stump or a patch, by day.
const markedFor = (l: Shown["lasting"]) =>
  l.find((q) => q.marks.some((m) => m === "crutch" || m === "stump" || m === "patch"));
let marked = markedFor(s?.lasting ?? []);
if (!marked) {
  // (None yet: on to the morning after the first maimed is up again.)
  const first = plan.people
    .flatMap((p, i) =>
      (p.wounds ?? [])
        .filter((w) => w.lasting === "crutch" || w.lasting === "stump" || w.lasting === "patch")
        .map((w) => ({ i, up: w.up })),
    )
    .sort((a, b) => a.up - b.up)[0];
  if (first) await advance((ofDay(Math.max(first.up, await now())) + 1) * DAY + 10.5 * HOUR);
  s = await shown();
  marked = markedFor(s?.lasting ?? []);
} else {
  await advance((ofDay(await now()) + 1) * DAY + 10.5 * HOUR);
  s = await shown();
  marked = markedFor(s?.lasting ?? []);
}
say(
  marked
    ? `marked for good: ${plan.people[marked.index]!.name} (${marked.marks.join(", ")}); drawn ${s?.drawn.crutch ?? 0} crutches, ${s?.drawn.stumps ?? 0} stumps, ${s?.drawn.patch ?? 0} patches, ${s?.drawn.scar ?? 0} scars`
    : "no one marked for good",
);
check(!!marked, "no one marked for good in the town");
check(
  (s?.drawn.crutch ?? 0) + (s?.drawn.stumps ?? 0) + (s?.drawn.patch ?? 0) >= 1,
  "no crutch, stump or patch drawn",
);
if (marked) {
  const one = marked.index,
    p = (await people()).find((q) => q.index === one);
  check(!!p, "the one marked for good not drawn by day");
  if (p) {
    await face(p.x, p.z, 2.5);
    await shot("8-marked");
  }
  // 6. Their card, and their page.
  if (p && (await tap(one))) {
    const lines = await k<string[]>(
      `[...document.querySelectorAll("${CARD} .folk-wound")].map((e) => e.textContent ?? "")`,
    );
    say(`their card: ${lines.join(" | ") || "no wound told"}`);
    check(lines.length >= 1, "their wounds not told on their card");
    await shot("9-card");
    const button = page.locator(`${CARD} button:visible`, { hasText: "Their page" });
    if (await button.count()) {
      await button.first().click();
      await page
        .waitForFunction(
          () => String((globalThis as any).causalis.pageOpen?.() ?? "").startsWith("folk:"),
          undefined,
          { timeout: slow(30000) },
        )
        .catch(() => undefined);
      await page.waitForTimeout(slow(800));
      const told = (await listOn("Their wounds")) ?? [];
      say(`their page “${await title()}”: ${told.join(" | ")}`);
      check(told.length >= 1, "their wounds not told on their page");
      check(
        told.some((r) => /^(Lost|Wounded|Burned|Crushed)/.test(r)),
        "no wound told by what it did",
      );
      await shot("10-their-page");
      const over = await onPhone("10-their-page-phone");
      check(over <= 2, `their page wider than a phone (${over} px over)`);
    } else check(false, "no page on their card");
  } else if (p) check(false, "the one marked for good could not be tapped");
}

// 7. The town's wounded, and its healer's page.
await opened(`${plan.ref}#wounded`);
const healing = Number((await factOn("Healing now")) ?? 0),
  forGood = Number((await factOn("Marked for good")) ?? 0),
  healerFact = (await factOn("Healer")) ?? "";
say(
  `${plan.name}'s wounded: ${healing} healing now, ${forGood} marked for good; healer ${healerFact}`,
);
check(healing + forGood >= 1, "the town's Wounded tab tells none");
check(healerFact === plan.people[healer]!.name, `the town's healer told as “${healerFact}”`);
await shot("11-town-wounded");
const named = await opened(`heal:${plan.ref}#wounded`),
  tending = (await listOn("Whom they tend now")) ?? [];
say(`the healer's page “${named}”: tending ${tending.length}`);
check(named === plan.people[healer]!.name, `the healer's page titled “${named}”`);
check(tending.length >= 1, "the healer's page tells no one they tend");
await shot("12-healer-tending");
const over = await onPhone("12-healer-tending-phone");
check(over <= 2, `the healer's page wider than a phone (${over} px over)`);

await browser.close();
await server.close();
if (errors.length) problems.push(...errors.map((e) => `page error: ${e}`));
if (problems.length) {
  console.log("FAILED:");
  for (const p of problems) console.log(`  - ${p}`);
  process.exit(1);
}
console.log("the Phase 55 gate (wave 3) passes");
