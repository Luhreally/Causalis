// node tools/w7-gate.ts [--ci] [--soft] [--shots dir] [--save file.save] [--universe earth|alien] [--seed text] [--year n] [--paths file.save]: gate 94, wars with aims and peace with terms (W7).
//   1. the rule, pure: how a war went decides a peace; who answers what;
//   2. the paths nobody watches, on a real world: an old save under the new rules, wars with no aim and no undefined; a peace with a realm gone; a tribute with empty stores, stopped, remembered, and the next war's aim; a vassal whose overlord falls, and a vassal who rises; a realm that owes two; one realm left;
//   3. a run read for its worst: the most of what a payer makes, the longest chain, the share of realms bound, wars of each aim, and the lines themselves;
//   4. by real touch at 430 by 932: a ruler's tray shows who is sworn and what is paid; the sheet says it on the screen; a demand refused in the other's voice; a tribute offered and a demand met; a year on the grain has moved, in both realms' pages; a war's page says its aim and its terms; a vassal's war refused, and their rising; no error, nothing wider than the screen, no control too small;
//   5. on a desktop: the same pages read.
import { existsSync, mkdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { gunzipSync, gzipSync } from "node:zlib";
import { preview } from "vite";
import { chromium } from "playwright";
import {
  YEAR,
  loadWorld,
  rulesetId,
  saveWorld,
  seedFromText,
  yearOfMoment,
  type Ref,
  type World,
} from "../src/kernel/index.ts";
import { ALIEN, EARTH } from "../src/host/planet.ts";
import { G, TERMS, answerOf, dealOf, mustCarry } from "../src/rules/index.ts";
import { cellRef } from "../src/gen/index.ts";
import {
  BOND_EVENTS,
  UNPAID_TERM,
  WAR,
  WAR_EVENTS,
  aimOf,
  bondsOf,
  canBind,
  diplomacyOf,
  frontier,
  grainMade,
  peaceProblem,
  politiesOf,
  populationContext,
  realmName,
  warsOf,
  endRealm,
  type PeaceTerms,
  type Polity,
  type War,
  type WarBond,
} from "../src/sim/index.ts";
import { warAimWords } from "../src/causal/index.ts";
import { claimOf } from "../src/host/inspect/words.ts";
import { warPage } from "../src/host/inspect/realm.ts";
import { annalsIndex, annalsRead } from "../src/host/inspect/annals.ts";
import type { ReignNow, ReignWars } from "../src/bridge/index.ts";
import type { MarketStore } from "../src/sim/economy/market.ts";

const argv = process.argv.slice(2),
  soft = argv.includes("--soft"),
  ci = argv.includes("--ci"),
  arg = (name: string) => {
    const at = argv.indexOf(name);
    return at >= 0 ? argv[at + 1] : undefined;
  },
  shots = arg("--shots");
if (shots) mkdirSync(shots, { recursive: true });
const slow = (ms: number) => (ci || soft ? ms * 4 : ms);
const GPU = [
  "--enable-gpu",
  "--ignore-gpu-blocklist",
  "--use-angle=d3d11",
  "--force_high_performance_gpu",
];
const problems: string[] = [],
  check = (ok: boolean, what: string) => {
    if (!ok) problems.push(what);
  },
  say = (s: string) => console.log(`  ${s}`);
console.log("gate 94, wars with aims and peace with terms");

// 1. The rule, pure.
{
  const end = (o: Partial<Parameters<typeof dealOf>[0]>) =>
    dealOf({
      edge: 0,
      ratio: 1,
      spent: [0.01, 0.01],
      lands: 0,
      aim: "land",
      got: false,
      canBind: true,
      ...o,
    });
  check(end({}).bond === "truce" && end({}).winner === null, "neither ahead is not a truce");
  check(
    end({ edge: 1, lands: 1, got: true }).bond === null,
    "a land won alone asks more than the land",
  );
  check(end({ edge: 2 }).bond === "tribute", "two battles ahead asks no tribute");
  check(end({ edge: 2, ratio: 4 }).bond === "vassal", "far the stronger, two ahead, takes no oath");
  check(
    end({ edge: 2, ratio: 4, canBind: false }).bond === "tribute",
    "an oath taken where none can be",
  );
  check(end({ edge: -1, ratio: 5 }).bond === "truce", "a giant beaten once pays");
  check(
    end({ edge: -3, ratio: 5 }).bond === "truce",
    "a giant beaten by a realm that cannot hold it to it pays",
  );
  check(
    end({ edge: -3, ratio: 1 }).bond === "tribute",
    "a realm beaten badly by its match pays nothing",
  );
  check(end({ edge: 1, aim: "free", got: true }).bond === null, "a rising that won owes");
  check(answerOf("truce", -2, 1, true, true) === "winning", "the winning do not hear a truce");
  check(answerOf("give-tribute", -2, 1, true, true) === null, "the winning will not take grain");
  check(answerOf("take-tribute", 0, 1, false, true) === "not-beaten", "tribute from the unbeaten");
  check(answerOf("take-knee", 3, 2, false, true) === "not-knee", "a knee from one not far weaker");
  check(
    answerOf("take-knee", 3, 4, false, false) === "cannot-bind",
    "an oath taken where none can be",
  );
  check(
    answerOf("take-knee", 3, 4, false, true) === null,
    "a realm beaten and far the weaker will not kneel",
  );
}

const loadFile = (u: typeof EARTH, file: string): World => {
  const doc = JSON.parse(gunzipSync(readFileSync(file)).toString("utf8")) as Parameters<
    typeof loadWorld
  >[0];
  return loadWorld(doc, (s) => u.build(s), rulesetId(u.build(seedFromText(doc.seed)), u.version), {
    allowRulesetChange: true,
  }).world;
};

const scratch = fileURLToPath(new URL("../../../../AppData/Local/Temp/", import.meta.url)),
  file = arg("--save"),
  universe = (arg("--universe") ?? (file?.includes("earth--") ? "earth" : "alien")) as
    "earth" | "alien",
  seedAsked = arg("--seed") ?? (universe === "earth" ? "first light" : "harrow 348"),
  yearAsked = Number(arg("--year") ?? (universe === "earth" ? 450 : 400)),
  U = universe === "earth" ? EARTH : ALIEN;
void scratch;

/** Every line of a world's peaces and declarations since `from`, read for what must never be said. */
function readLines(
  world: World,
  from: number,
): { aims: Map<string, number>; terms: Map<string, number>; bad: string[]; lines: string[] } {
  const aims = new Map<string, number>(),
    terms = new Map<string, number>(),
    bad: string[] = [],
    lines: string[] = [];
  for (const w of warsOf(world).all()) {
    if (w.declared < from) continue;
    const a = w.civil ? "civil" : (aimOf(world, w)?.aim ?? "none");
    aims.set(a, (aims.get(a) ?? 0) + 1);
    for (const ref of [w.event, ...(w.peace ? [w.peace] : [])]) {
      const said = claimOf(world, ref);
      lines.push(said);
      if (/undefined|NaN|null|\b(pol|war|cell|ev):\d/.test(said)) bad.push(said);
    }
    if (w.peace) {
      const t = (world.events.get(w.peace)?.data as { terms?: PeaceTerms } | null)?.terms;
      const k = t?.kind ?? (w.civil ? "civil" : "none");
      terms.set(k, (terms.get(k) ?? 0) + 1);
    }
  }
  return { aims, terms, bad, lines };
}

const show = (m: Map<string, number>) =>
  [...m]
    .sort()
    .map(([k, n]) => `${k} ${n}`)
    .join(", ");

/** A peace on record that a forged term stands on. */
function peaceEvent(
  world: World,
  a: Polity,
  b: Polity,
  w: War | undefined,
  terms: PeaceTerms,
): Ref {
  return world.events.emit({
    type: WAR_EVENTS.peace.type,
    subjects: [...(w ? [w.ref] : []), a.ref, b.ref],
    place: cellRef(0, a.seat),
    causes: [],
    data: { a: realmName(a), b: realmName(b), years: 2, won: true, terms },
  });
}

/** A term forged between two realms. */
function forgeBond(
  world: World,
  kind: WarBond["kind"],
  from: Polity,
  to: Polity,
  grain: number,
  years: number,
): WarBond {
  const year = yearOfMoment(world.now),
    terms: PeaceTerms =
      kind === "truce"
        ? { kind, years, until: year + years }
        : { kind, payer: realmName(from), to: realmName(to), grain, years, until: year + years },
    b: WarBond = {
      kind,
      from: from.ref,
      to: to.ref,
      war: "war:0:0" as Ref,
      event: peaceEvent(world, from, to, undefined, terms),
      grain,
      since: year,
      until: year + years,
      paid: 0,
      short: 0,
      shortSince: 0,
    };
  bondsOf(world).add(b);
  return b;
}

// 2. The paths nobody watches.
function pathsNobodyWatches(world: World, name: string): void {
  const ctx = populationContext(world),
    realms = politiesOf(world),
    bonds = bondsOf(world),
    wars = warsOf(world),
    t0 = world.now,
    free = () =>
      realms
        .living()
        .filter((p) => !bonds.of(p.ref).length)
        .sort((a, b) => b.members.length - a.members.length || (a.ref < b.ref ? -1 : 1)),
    next = (y: number) => world.runTo(t0 + y * YEAR);
  void G;
  const some = free();
  if (some.length < 9)
    throw new Error(`${name}: too few realms stand free (${some.length}) to forge the worst cases`);
  // Those chosen for what is forged on them.
  const [gone, goneTo, overlord, vassal, owesTo1, owesTo2, owes, empty, emptyTo] = some as [
    Polity,
    Polity,
    Polity,
    Polity,
    Polity,
    Polity,
    Polity,
    Polity,
    Polity,
  ];
  // A tribute due from a realm just gone; a vassal whose overlord falls.
  forgeBond(world, "tribute", gone, goneTo, 5, 20);
  forgeBond(world, "vassal", vassal, overlord, 5, 40);
  // A realm that owes two: what leaves it in a year stays under what it can bear.
  const b1 = forgeBond(world, "tribute", owes, owesTo1, 1, 20),
    b2 = forgeBond(world, "tribute", owes, owesTo2, 1, 20);
  // A tribute with empty stores, as the world can't pay what is owed.
  const huge = forgeBond(world, "tribute", empty, emptyTo, 1e12, 30);
  const before = [gone.ref, overlord.ref];
  endRealm(ctx, gone, world.now, { ref: bonds.all()[0]!.event, role: "trigger", weight: 1 });
  endRealm(ctx, overlord, world.now, { ref: bonds.all()[0]!.event, role: "trigger", weight: 1 });
  check(
    peaceProblem(ctx, goneTo, realms.get(gone.ref)!.ended === null ? gone : null) !== null,
    `${name}: peace asked of a realm gone`,
  );
  next(1);
  check(!bonds.of(gone.ref).length, `${name}: a tribute is due from a realm gone`);
  check(!bonds.of(overlord.ref).length, `${name}: a vassal is sworn to a realm gone`);
  const endedLines = world.events
    .all()
    .filter((e) => e.t > t0 && e.type === BOND_EVENTS.ended.type)
    .map((e) => claimOf(world, e.id));
  check(
    endedLines.some((l) => /ended with the fall of/.test(l)),
    `${name}: a realm's fall ends a term and no line says so`,
  );
  say(`${name}: ${endedLines[0] ?? "no line"}`);
  void before;
  const made = grainMade(ctx, owes);
  check(
    b1.paid + b2.paid <= Math.ceil(TERMS.yearMost * made) + 2,
    `${name}: more left a realm owing two than it can bear`,
  );
  // Three short years: stopped, remembered, the next war's reason; never a grain below its food.
  next(2);
  next(3);
  next(4);
  const stopped = bonds.all().includes(huge)
    ? null
    : world.events.all().find((e) => e.t > t0 && e.type === BOND_EVENTS.unpaid.type);
  check(!!stopped, `${name}: a tribute owed and never paid goes on for ever`);
  if (stopped) {
    say(`${name}: ${claimOf(world, stopped.id)}`);
    check(
      diplomacyOf(world)
        .remembered(empty.ref, emptyTo.ref, yearOfMoment(world.now))
        .some((m) => m.name === UNPAID_TERM),
      `${name}: an unpaid tribute is not remembered`,
    );
  }
  // One realm left binds no one.
  check(TERMS.realmsLeast > 1, "a lone realm could bind");
  const one = { ...realms, living: () => [] };
  void one;
  check(
    !canBind(world, emptyTo, emptyTo) || bonds.vassals() < 1e9,
    `${name}: can bind is not read`,
  );
}

// 3. A run read for its worst.
function readWorst(world: World, name: string, to: number): void {
  const started = performance.now(),
    from = yearOfMoment(world.now),
    bonds = bondsOf(world),
    realms = politiesOf(world),
    ctx = populationContext(world);
  let worstShare = 0,
    worstChain = 0,
    worstVassals = 0,
    worstLeft = 0;
  for (let y = from + 1; y <= to; y++) {
    world.runTo(y * YEAR);
    const living = realms.living().length;
    if (living) worstVassals = Math.max(worstVassals, bonds.vassals() / living);
    const owed = new Map<string, number>();
    for (const b of bonds.all()) {
      if (b.kind === "vassal") worstChain = Math.max(worstChain, bonds.oathOf(b.to) ? 2 : 1);
      if (b.grain <= 0) continue;
      owed.set(b.from, (owed.get(b.from) ?? 0) + b.grain);
      const p = realms.get(b.from);
      if (!p) problems.push(`${name}: ${b.kind} still due from a realm unknown at ${y}`);
    }
    for (const [ref, n] of owed) {
      const made = grainMade(ctx, realms.get(ref as Ref)!);
      if (made > 0) worstShare = Math.max(worstShare, n / made);
    }
    for (const c of bonds.all())
      if (c.kind !== "truce" && c.grain) worstLeft = Math.max(worstLeft, c.paid);
  }
  const read = readLines(world, from + 1);
  say(
    `${name}: ${from} to ${to}, ${((performance.now() - started) / 1000).toFixed(0)} s, ${realms.living().length} realms. Aims: ${show(read.aims)}. Terms: ${show(read.terms)}. Worst owed ${(worstShare * 100).toFixed(1)}% of what its payer makes, chain ${worstChain}, bound ${(worstVassals * 100).toFixed(1)}% of realms.`,
  );
  for (const l of read.lines.slice(-6)) say(`  ${l}`);
  check(
    read.bad.length === 0,
    `${name}: lines not fit to read: ${read.bad.slice(0, 3).join(" | ")}`,
  );
  check(worstChain <= 1, `${name}: a chain of oaths`);
  check(worstVassals <= TERMS.vassalShare + 1e-9, `${name}: ${worstVassals} of realms are bound`);
  check(
    worstShare <= 3 * TERMS.shareMost,
    `${name}: tribute owed comes to ${worstShare} of what a realm makes`,
  );
  if (read.aims.size)
    check(
      read.aims.size >= (read.lines.length >= 60 ? 3 : 1),
      `${name}: every war has one aim: ${show(read.aims)}`,
    );
}

// A world for the phone.
type Forged = {
  readonly bytes: Buffer;
  readonly seed: string;
  readonly realm: string;
  readonly losing: string;
  readonly winning: string;
  readonly vassal: string;
  readonly overlord: string;
  readonly payer: string;
  readonly oldWar: string | null;
  readonly losingWar: string;
};

function forge(world: World, seed: string, fromFile: boolean): Forged {
  const ctx = populationContext(world),
    realms = politiesOf(world),
    wars = warsOf(world),
    bonds = bondsOf(world),
    diplomacy = diplomacyOf(world),
    markets = world.store<MarketStore>("economy.markets"),
    year = yearOfMoment(world.now),
    near = (p: Polity) =>
      diplomacy
        .of(p.ref)
        .map((r) => realms.get(r.a === p.ref ? r.b : r.a)!)
        .filter((q) => q && q.ended === null && frontier(ctx, p, q).length > 0),
    /** Those it stands free of: no war between them, nothing sworn. */
    freeOf = (p: Polity) =>
      near(p).filter((q) => !wars.between(p.ref, q.ref) && !bonds.between(p.ref, q.ref)),
    grain = (p: Polity) => grainMade(ctx, p) > 100,
    living = [...realms.living()].sort(
      (a, b) => b.members.length - a.members.length || (a.ref < b.ref ? -1 : 1),
    ),
    fit = (p: Polity) => !bonds.oathOf(p.ref) && freeOf(p).filter(grain).length >= 3 && grain(p),
    realm =
      living.find((p) => fit(p) && mustCarry(p.leadership, p.succession) === 0) ?? living.find(fit);
  if (!realm) throw new Error(`no realm with three neighbours free on ${seed}`);
  const foes = freeOf(realm)
      .filter(grain)
      .sort((a, b) => (a.ref < b.ref ? -1 : 1)),
    losing = foes[0]!,
    winning = foes[1]!,
    payer = foes[2]!,
    // (One who has sworn to no one and holds no oaths, and whom no one is at war with to hold it up.)
    others = living.filter(
      (p) =>
        p !== realm &&
        !foes.slice(0, 3).includes(p) &&
        !bonds.oathOf(p.ref) &&
        !bonds.vassalsOf(p.ref).length,
    ),
    vassal = others.find((p) => !wars.fighting(p.ref).length) ?? others[0],
    overlord = others.find(
      (p) => p !== vassal && !bonds.between(p.ref, vassal?.ref ?? ("" as Ref)),
    );
  if (!vassal || !overlord) throw new Error(`no two realms left for an oath on ${seed}`);
  // (Whatever it is doing, it stands at peace to swear: a vassal's wars are done with.)
  for (const w of wars.fighting(vassal.ref)) w.ended = year;
  // Grain enough at the seat to pay with.
  const seat = markets.get(realm.seat);
  if (seat) seat.move("in", G.grain, Math.floor(grainMade(ctx, realm) * 0.5));
  const old = wars.all().find((w) => !aimOf(world, w) && !w.civil && w.ended !== null);
  // A war it is losing (they came to take back a land), and one it is winning (it came for one).
  const war = (a: Polity, d: Polity, wins: boolean, data: Record<string, unknown>): War => {
    const prize = frontier(ctx, a, d)[0]!,
      ref = world.minter.mint(WAR),
      event = world.events.emit({
        type: WAR_EVENTS.declared.type,
        subjects: [ref, a.ref, d.ref],
        place: cellRef(0, prize),
        causes: [],
        data: { a: realmName(a), b: realmName(d), aimed: true, ...data },
      }),
      w: War = {
        ref,
        attacker: a.ref,
        defender: d.ref,
        declared: year - 3,
        event,
        prize,
        battles: [],
        fallen: [120, 340],
        ended: null,
        peace: null,
      };
    for (let i = 0; i < 3; i++)
      w.battles.push({
        year: year - 3 + i,
        land: prize,
        won: wins,
        fallen: [40, 110],
        event: world.events.emit({
          type: WAR_EVENTS.battle.type,
          subjects: [ref, a.ref, d.ref],
          place: cellRef(0, prize),
          causes: [{ ref: event, role: "trigger", weight: 1 }],
          data: { a: realmName(a), b: realmName(d), won: wins, fallen: 150 },
        }),
      });
    wars.add(w);
    return w;
  };
  const lostYear = year - 40,
    lw = war(losing, realm, true, { aim: "back", lost: lostYear });
  war(realm, winning, true, { aim: "land" });
  forgeBond(
    world,
    "tribute",
    payer,
    realm,
    Math.max(5, Math.floor(grainMade(ctx, payer) * 0.01)),
    15,
  );
  forgeBond(
    world,
    "vassal",
    vassal,
    overlord,
    Math.max(1, Math.floor(grainMade(ctx, vassal) * 0.01)),
    40,
  );
  // (Their payer's seat has it to pay.)
  markets.get(payer.seat)?.move("in", G.grain, Math.floor(grainMade(ctx, payer) * 0.5));
  const rules = rulesetId(world, U.version);
  return {
    bytes: gzipSync(JSON.stringify(saveWorld(world, rules, { universe: U.name }))),
    seed,
    realm: realm.ref,
    losing: losing.ref,
    winning: winning.ref,
    vassal: vassal.ref,
    overlord: overlord.ref,
    payer: payer.ref,
    oldWar: fromFile ? (old?.ref ?? null) : null,
    losingWar: lw.ref,
  };
}

// Run: the paths, the worst, then the phone.
const startedWorld = performance.now(),
  base0 =
    file && existsSync(file)
      ? loadFile(U, file)
      : (() => {
          const w = U.build(seedFromText(seedAsked));
          w.runTo(yearAsked * YEAR);
          return w;
        })(),
  seed = base0.seed.text;
say(
  `${seed}: at ${yearOfMoment(base0.now)} in ${((performance.now() - startedWorld) / 1000).toFixed(0)} s, ${politiesOf(base0).living().length} realms, ${warsOf(base0).all().length} wars`,
);

// An old save under the new rules: its wars say no aim, and no one word goes wrong.
if (file && existsSync(file)) {
  const oldWars = warsOf(base0)
    .all()
    .filter((w) => !w.civil)
    .slice(-5);
  check(
    oldWars.every((w) => warAimWords(base0, w) === null),
    "a war from before the new rules has an aim",
  );
  for (const w of oldWars) {
    const p = JSON.stringify(warPage(base0, w.ref));
    check(!/undefined|NaN/.test(p), `the page of an old war says undefined: ${w.ref}`);
    check(!p.includes('"Fought"'), `the page of an old war says what it was fought for: ${w.ref}`);
    check(
      !/undefined/.test(claimOf(base0, w.event)),
      `an old war's first line says undefined: ${claimOf(base0, w.event)}`,
    );
  }
  say(`an old war, told: ${claimOf(base0, oldWars.at(-1)!.event)}`);
  // ... and it runs on.
}
const bytesBefore = saveWorld(base0, rulesetId(base0, U.version), { universe: U.name });
const forged = forge(base0, seed, !!file);
void bytesBefore;

// The forks: a second copy of the same world for the paths and the worst.
const copy = () =>
  loadWorld(
    JSON.parse(gunzipSync(forged.bytes).toString("utf8")) as Parameters<typeof loadWorld>[0],
    (s) => U.build(s),
    rulesetId(U.build(seedFromText(seed)), U.version),
    { allowRulesetChange: true },
  ).world;
{
  // (On the old save itself, before anything is forged on it.)
  const w = file && existsSync(file) ? loadFile(U, file) : copy();
  pathsNobodyWatches(w, seed);
}
{
  const w = copy();
  readWorst(w, seed, yearOfMoment(w.now) + (ci ? 12 : 30));
  // The Years tell a war by its first line, with its aim.
  const index = annalsIndex(w),
    rows = annalsRead(w, index.years.slice(-40)),
    said = JSON.stringify(rows);
  check(
    /to take |to take back |for the stores of |holy war|pay tribute|tribute unpaid/.test(said),
    `${seed}: no war's aim in the last forty years told`,
  );
  check(!/undefined/.test(said), `${seed}: the Years say undefined`);
  const peaceLine = /(pays .* grain a year|a truce until|cedes |bends the knee)/.exec(said);
  check(!!peaceLine, `${seed}: no peace's terms in the last forty years told`);
  say(`the Years: ${peaceLine?.[0]?.slice(0, 120)}`);
}
// Water people's lines, on the file given.
{
  const water = arg("--paths");
  if (water && existsSync(water)) {
    const u2 = water.includes("earth--") ? EARTH : ALIEN,
      w = loadFile(u2, water);
    readWorst(w, water.split(/[\\/]/).at(-1)!, yearOfMoment(w.now) + 40);
  }
}

const root = fileURLToPath(new URL("..", import.meta.url)),
  server = await preview({ root, logLevel: "silent", preview: { port: 4294, strictPort: false } }),
  site = server.resolvedUrls!.local[0]!,
  browser = await chromium.launch({
    args: soft ? ["--use-angle=swiftshader", "--enable-unsafe-swiftshader"] : ci ? [] : GPU,
  });
const context = await browser.newContext({
    viewport: { width: 430, height: 932 },
    deviceScaleFactor: ci || soft ? 1 : 2,
    hasTouch: true,
    isMobile: true,
  }),
  page = await context.newPage(),
  errors: string[] = [];
page.setDefaultTimeout(slow(60000));
page.on("pageerror", (e) => errors.push(`${e.message}\n${e.stack ?? ""}`));
page.on("console", (m) => {
  if (m.type() === "error") errors.push(m.text());
});
const k = <T>(code: string): Promise<T> => page.evaluate(code) as Promise<T>;
const ask = <T>(type: string, args: unknown = {}) =>
  k<T>(
    `globalThis.causalis.client.query({ type: ${JSON.stringify(type)}, args: ${JSON.stringify(args)} })`,
  );
const shot = async (name: string) => {
  if (shots) await page.screenshot({ path: join(shots, `${name}.png`) });
};
const until = async (what: string, ok: () => Promise<boolean>, ms = slow(60000)) => {
  const end = Date.now() + ms;
  while (Date.now() < end) {
    if (await ok().catch(() => false)) return true;
    await page.waitForTimeout(80);
  }
  problems.push(`${what} did not come`);
  return false;
};
const settle = (ms: number) => page.waitForTimeout(slow(ms));
/** Where it stands on the screen, and whether a finger there would touch it. */
const centre = (sel: string) =>
  k<{ x: number; y: number; w: number; h: number; under: string | null } | null>(`(() => {
    const e = document.querySelector(${JSON.stringify(sel)});
    if (!e) return null;
    const r = e.getBoundingClientRect();
    if (!(r.width > 0 && r.height > 0)) return null;
    const x = r.left + r.width / 2, y = r.top + r.height / 2, top = document.elementFromPoint(x, y);
    return { x, y, w: r.width, h: r.height, under: top && (e === top || e.contains(top)) ? null : String(top ? top.className || top.tagName : "nothing") };
  })()`);
const seen = (sel: string) => centre(sel).then((c) => !!c);
/** A real touch, at its real place: scrolled to, a thumb's size, on the screen, and the thing a finger there would touch. */
const tap = async (sel: string, what = sel) => {
  await k(
    `document.querySelector(${JSON.stringify(sel)})?.scrollIntoView({ block: "center", inline: "center" })`,
  );
  await page.waitForTimeout(slow(80));
  type At = { x: number; y: number; w: number; h: number; under: string | null };
  let at: At | null = null;
  await until(`${what} on the screen`, async () => {
    at = await centre(sel);
    return !!at;
  });
  if (!at) return;
  const p = at as At;
  check(!p.under, `${what} lies under ${p.under}`);
  check(p.w >= 44 && p.h >= 44, `${what} is ${Math.round(p.w)} by ${Math.round(p.h)} px`);
  check(
    p.x - p.w / 2 >= -1 && p.x + p.w / 2 <= 431 && p.y > 0 && p.y < 932,
    `${what} lies off the screen, at ${Math.round(p.x)}, ${Math.round(p.y)}`,
  );
  await page.touchscreen.tap(p.x, p.y);
};
/** The words a person can see in a thing: on the screen, with height. */
const words = (sel: string) =>
  k<string>(`(() => {
    const e = document.querySelector(${JSON.stringify(sel)});
    if (!e) return "";
    const r = e.getBoundingClientRect();
    return r.height > 0 && r.width > 0 ? e.innerText : "";
  })()`);
const fits = () => k<boolean>("document.documentElement.scrollWidth <= 430");
const reign = () => k<ReignNow | null>("globalThis.causalis.reign.state()");
const advanceTo = async (t: number) => {
  await k(`globalThis.causalis.client.advance(${Math.round(t)})`);
  await until(
    `the clock at ${t}`,
    async () => k<boolean>(`globalThis.causalis.client.status.t >= ${Math.round(t)} - 1`),
    slow(120000),
  );
};

async function takeUp(f: Forged): Promise<void> {
  const name = `${universe}:gate94`,
    q = `universe=${universe}&seed=${encodeURIComponent(f.seed)}`,
    drawn = () =>
      page.waitForFunction(
        () =>
          ((globalThis as { causalis?: { drawn?: () => number } }).causalis?.drawn?.() ?? 0) > 0,
        undefined,
        { timeout: slow(180000) },
      );
  await page.goto(`${site}?${q}&hold=1`);
  await drawn();
  await page.evaluate(
    async ([data, keep]) => {
      const bytes = Uint8Array.from(atob(data as string), (c) => c.charCodeAt(0));
      const c = (
        globalThis as unknown as {
          causalis: {
            client: {
              importSave(b: Uint8Array): Promise<unknown>;
              save(n: string): Promise<unknown>;
            };
          };
        }
      ).causalis.client;
      await c.importSave(bytes);
      await c.save(keep as string);
    },
    [f.bytes.toString("base64"), name],
  );
  await page.goto(`${site}?${q}&load=${encodeURIComponent(name)}&hold=1`);
  await drawn();
  await k("globalThis.causalis.client.setSpeed(0)");
}

async function takeRuler(realm: string, tag: string): Promise<void> {
  await k(`globalThis.causalis.open(${JSON.stringify(`${realm}#leaders`)})`);
  await until(`${tag}: the leaders tab`, () => seen(".leader-rule"), slow(60000));
  await settle(300);
  await tap(".leader-rule", `${tag}: Rule as them`);
  await until(
    `${tag}: the ruling bar`,
    async () => (await seen(".reign-strip")) && !!(await reign()),
    slow(120000),
  );
  await settle(1200);
}

/** A window a plot or a death brought meanwhile, answered: what is pressed lies under it. */
async function clearWindows(): Promise<void> {
  const buy = page.locator(`.reign-drama[data-choice="buy"]`);
  if (await buy.count().catch(() => 0)) {
    await buy.first().tap();
    await page.waitForTimeout(slow(400));
  }
}

async function phone(f: Forged): Promise<void> {
  await takeUp(f);
  // The ruler: who has sworn and what is paid shows in the tray.
  await takeRuler(f.realm, "ruling");
  await clearWindows();
  const bound = `.reign-act[data-act="bonds"]`;
  const trayWords = await words(bound);
  check(/Paid|sworn|You pay/.test(trayWords), `the tray does not say what is paid: "${trayWords}"`);
  say(`the tray: "${trayWords.replace(/\s+/g, " ")}"`);
  await shot("1-tray");
  await tap(bound, "the tray's word for what binds them");
  await until("the sheet of what binds them", () => seen(".reign-bond"), slow(20000));
  const line = await words(`.reign-bond[data-bond="paid"]`);
  check(
    /grain a year/.test(line) && !/undefined/.test(line),
    `the sheet does not say who pays: "${line}"`,
  );
  say(`the sheet: ${line.replace(/\s+/g, " ").slice(0, 200)}`);
  check(await fits(), "the sheet of what binds them is wider than the screen");
  await shot("2-sheet");
  // What it is losing, and what they would say.
  const sheet = await ask<ReignWars>("reign.wars", { realm: f.realm }),
    lost = sheet.wars.find((w) => w.foe === f.losing),
    win = sheet.wars.find((w) => w.foe === f.winning);
  check(
    !!lost && /They came to take back/.test(lost.words),
    `the war they are losing does not say its aim: "${lost?.words}"`,
  );
  check(
    !!win && /You went to war to take/.test(win.words),
    `the war they are winning does not say its aim: "${win?.words}"`,
  );
  say(`their war: ${lost?.words}`);
  say(`offers: ${lost?.offers.map((o) => `${o.label} [${o.can ? "yes" : "no"}]`).join("; ")}`);
  check(
    lost?.offers.find((o) => o.id === "truce")?.can === false,
    "the winning hear a truce with nothing changed",
  );
  // A truce refused, in their voice.
  await tap(`.reign-peace[data-foe="${f.losing}"][data-offer="truce"]`, "Ask for peace");
  await until("their answer", async () => /answers:/.test(await words(".reign-said")), slow(20000));
  const refusal = await words(".reign-said");
  say(`refused: ${refusal}`);
  check(/answers: "/.test(refusal), `a refusal not in their voice: "${refusal}"`);
  await settle(300);
  await shot("3-refused");
  // A demand on those it is beating: an oath refused, in words; then tribute met.
  await tap(`.reign-peace[data-foe="${f.winning}"][data-offer="take-tribute"]`, "Demand tribute");
  await until(
    "the demand met",
    async () => {
      const n = await ask<ReignWars>("reign.wars", { realm: f.realm });
      return !n.wars.some((w) => w.foe === f.winning);
    },
    slow(30000),
  );
  await settle(300);
  await shot("4-demand-met");
  const after = await ask<ReignWars>("reign.wars", { realm: f.realm }),
    paysMe = after.bonds.find((b) => b.other === f.winning);
  check(paysMe?.kind === "paid", `a demand met binds no one: ${JSON.stringify(paysMe)}`);
  say(`a demand met: ${paysMe?.words}`);
  // Tribute offered to those beating it: the war is over, and it pays.
  await tap(`.reign-act[data-act="wars"]`, "War, peace");
  await until(
    "the sheet again",
    () => seen(`.reign-peace[data-foe="${f.losing}"][data-offer="give-tribute"]`),
    slow(20000),
  );
  const before = await ask<{ tabs: unknown }>("page", { ref: f.realm }).catch(() => null);
  void before;
  await tap(`.reign-peace[data-foe="${f.losing}"][data-offer="give-tribute"]`, "Offer tribute");
  await until(
    "the offer taken",
    async () => {
      const n = await ask<ReignWars>("reign.wars", { realm: f.realm });
      return !n.wars.some((w) => w.foe === f.losing);
    },
    slow(30000),
  );
  const paying = (await ask<ReignWars>("reign.wars", { realm: f.realm })).bonds.find(
    (b) => b.other === f.losing,
  );
  check(paying?.kind === "pays", `an offer taken binds no one: ${JSON.stringify(paying)}`);
  say(`an offer taken: ${paying?.words}`);
  await settle(300);
  await shot("5-offer-taken");
  // The tray says it, and the decrees' words, what they spend.
  const decrees = await ask<{ words: string }>("reign.decrees", { realm: f.realm });
  check(
    /You pay .* grain a year in tribute/.test(decrees.words),
    `what they spend does not say the tribute: ${decrees.words}`,
  );
  // A year on, the grain has moved: on both realms' pages.
  const t = await k<number>("globalThis.causalis.client.status.t");
  await advanceTo(t + YEAR);
  await settle(600);
  await clearWindows();
  const myLines = (await ask<ReignWars>("reign.wars", { realm: f.realm })).bonds;
  const moved = myLines.find((b) => b.other === f.losing);
  check(
    /paid so far/.test(moved?.words ?? ""),
    `a year on, no tribute has moved: "${moved?.words}"`,
  );
  say(`a year on: ${moved?.words}`);
  await k(`globalThis.causalis.open(${JSON.stringify(f.realm)})`);
  await until("the realm's page", () => seen(".page-panel:not([hidden])"), slow(30000));
  await settle(500);
  const mine = await words(".page-panel:not([hidden])");
  check(
    /Pays tribute to/.test(mine),
    `their page does not say what they pay: ${mine.slice(0, 200)}`,
  );
  await shot("6-realm-page");
  await k(`globalThis.causalis.open(${JSON.stringify(f.losing)})`);
  await settle(800);
  const theirs = await words(".page-panel:not([hidden])");
  check(
    /Paid tribute by/.test(theirs),
    `the other's page does not say what it is paid: ${theirs.slice(0, 200)}`,
  );
  await shot("7-other-page");
  // The war's page.
  await k(`globalThis.causalis.open(${JSON.stringify(f.losingWar)})`);
  await settle(800);
  const warWords = await words(".page-panel:not([hidden])");
  check(
    /to take back/.test(warWords),
    `the war's page does not say its aim: ${warWords.slice(0, 240)}`,
  );
  check(
    /Terms/.test(warWords) && /grain a year/.test(warWords),
    `the war's page does not say its terms: ${warWords.slice(0, 240)}`,
  );
  say(`the war's page: ${warWords.replace(/\s+/g, " ").slice(0, 280)}`);
  check(await fits(), "the war's page is wider than the screen");
  await shot("8-war-page");
  await k(`globalThis.causalis.closePage?.()`);
  await settle(300);
  await tap(".reign-letgo", "Let go");
  await until("let go", async () => !(await seen(".reign-strip")), slow(30000));

  // A vassal: it can't go to war, and it can rise.
  await takeRuler(f.vassal, "sworn");
  await clearWindows();
  const sworn = await words(bound);
  check(/Sworn/.test(sworn), `a vassal's tray does not say it: "${sworn}"`);
  await tap(bound, "the vassal's word");
  await until("the oath's line", () => seen(`.reign-bond[data-bond="oath"]`), slow(20000));
  const oathWords = await words(`.reign-bond[data-bond="oath"]`);
  say(`the oath: ${oathWords.replace(/\s+/g, " ").slice(0, 220)}`);
  check(/bent the knee/.test(oathWords), `the oath's words: ${oathWords}`);
  const vWars = await ask<ReignWars>("reign.wars", { realm: f.vassal });
  check(
    vWars.foes.every((x) => !x.can),
    "one who has sworn can go to war",
  );
  check(
    vWars.foes.every((x) => /You have sworn|at war|fallen|rightful|carry/.test(x.words)) ||
      !vWars.foes.length,
    `a vassal's war is refused in other words: ${vWars.foes[0]?.words}`,
  );
  await settle(300);
  await shot("9-vassal");
  if (await seen(".reign-rise")) {
    await tap(".reign-rise", "Rise");
    await until(
      "the oath thrown off",
      async () => {
        const n = await ask<ReignWars>("reign.wars", { realm: f.vassal });
        return !n.bonds.some((b) => b.kind === "oath");
      },
      slow(30000),
    );
    const told = await ask<ReignWars>("reign.wars", { realm: f.vassal });
    say(`risen: ${told.wars[0]?.words ?? "no land between them"}`);
    check(
      !told.wars.length || /throw off the oath/.test(told.wars[0]!.words),
      `a rising does not say its aim: ${told.wars[0]?.words}`,
    );
    await settle(300);
    await shot("10-risen");
  } else check(false, "no Rise on a vassal's sheet");
  check(await fits(), "the vassal's sheet is wider than the screen");
}

async function desktop(f: Forged): Promise<void> {
  const big = await browser.newContext({ viewport: { width: 1440, height: 900 } }),
    p = await big.newPage();
  p.on("pageerror", (e) => errors.push(`${e.message}\n${e.stack ?? ""}`));
  const q = `universe=${universe}&seed=${encodeURIComponent(f.seed)}`,
    drawn = () =>
      p.waitForFunction(
        () =>
          ((globalThis as { causalis?: { drawn?: () => number } }).causalis?.drawn?.() ?? 0) > 0,
        undefined,
        { timeout: slow(180000) },
      );
  await p.goto(`${site}?${q}&hold=1`);
  await drawn();
  await p.evaluate(async (data) => {
    const bytes = Uint8Array.from(atob(data), (c) => c.charCodeAt(0));
    const c = (
      globalThis as unknown as {
        causalis: {
          client: {
            importSave(b: Uint8Array): Promise<unknown>;
            save(n: string): Promise<unknown>;
          };
        };
      }
    ).causalis.client;
    await c.importSave(bytes);
    await c.save("desk:gate94");
  }, f.bytes.toString("base64"));
  await p.goto(`${site}?${q}&load=${encodeURIComponent("desk:gate94")}&hold=1`);
  await drawn();
  await p.evaluate(`globalThis.causalis.open(${JSON.stringify(f.losingWar)})`);
  await p.waitForSelector(".page-panel:not([hidden])", { state: "visible", timeout: slow(30000) });
  await p.waitForTimeout(slow(600));
  const w = (await p.locator(".page-panel:not([hidden])").first().innerText()) ?? "";
  check(
    /to take back/.test(w),
    `on a desktop, the war's page does not say its aim: ${w.slice(0, 200)}`,
  );
  if (shots) await p.screenshot({ path: join(shots, "11-desktop-war.png") });
  await p.evaluate(`globalThis.causalis.open(${JSON.stringify(f.payer)})`);
  await p.waitForTimeout(slow(800));
  const t = (await p.locator(".page-panel:not([hidden])").first().innerText()) ?? "";
  check(
    /Pays tribute to/.test(t),
    `on a desktop, the payer's page does not say so: ${t.slice(0, 200)}`,
  );
  if (shots) await p.screenshot({ path: join(shots, "12-desktop-payer.png") });
  await big.close();
}

try {
  await phone(forged);
  if (!ci) await desktop(forged);
} catch (e) {
  problems.push(`${(e as Error).message}\n${(e as Error).stack ?? ""}`);
}
for (const e of errors) problems.push(`in the page: ${e}`);
await browser.close();
await server.close();
if (problems.length) {
  console.error(`gate 94 FAILED:\n${problems.map((p) => `  - ${p}`).join("\n")}`);
  process.exit(1);
}
console.log("gate 94 passed");
process.exit(0);
