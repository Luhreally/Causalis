// Four of the ledger's world-wide tables, realm by realm (asked 2026-11-16: "whatever else is relevant to be on ledger"):
//   Trade    each realm's years of plenty and want, its exchange and last crash, its plan, its price on smoke, its machines at the
//            crafts' tasks and its towns' ground rent (sim/trade); and every good sold abroad by a cartel among realms.
//   Society  each realm's people on the street, its healers' reach, its old kept and pensioned, its law written and held to, its
//            working day and days at work, and its bearers' work beyond the home (sim/society).
//   Culture  who each realm's people count their own and how far their "us" reaches, what its seat tells and how it is taken, its
//            works' renown, what its towns draw and its learned (the culture sweep); and every faith's temples.
//   Powers   who decides in each realm and how rule passes, who governs by its people's choice, its spies, the lands it holds by
//            force and those others hold of it, and the council of realms it sits in (round E's statecraft).
// Each reads the stores as their systems last set them, one pass a store a page build, and never the event log; a land's row is
// weighed by its people into its realm's. A tab whose system has kept nothing yet says so in one line.
import type { Ref, World } from "../../kernel/index.ts";
import type { Block, Line, Row, Span } from "../../bridge/index.ts";
import { GOODS, HOLDING, VOICE_WORDS, daysWorked, kinWords } from "../../rules/index.ts";
import {
  ACADEMY_STORE,
  ART_STORE,
  CAP,
  CAPITAL_STORE,
  CARE_ROW,
  CARE_STORE,
  CARTEL_STORE,
  CT,
  CY,
  CYCLE_STORE,
  EX,
  EXCHANGE_STORE,
  GENERAL,
  LAW_ROW,
  LAW_STORE,
  LEISURE_ROW,
  LEISURE_STORE,
  OLD_ROW,
  OLD_STORE,
  PL,
  PLAN_STORE,
  PROVISION,
  PROVISION_STORE,
  RENT_STORE,
  ROLE_ROW,
  ROLES_STORE,
  ROOFLESS_STORE,
  ROOF_ROW,
  RT,
  SM,
  SMOKE_STORE,
  TEMPLE_STORE,
  URBAN_STORE,
  VOICE_STORE,
  academyOf,
  artOf,
  beliefOf,
  cartelKey,
  chooses,
  councilsOf,
  cultureRows,
  electionsOf,
  holdsOf,
  identityOf,
  occupationOf,
  politiesOf,
  populationContext,
  realmFolk,
  refNumber,
  societyStore,
  spiesOf,
  templeOf,
  tradeStore,
  urbanOf,
  voiceOf,
  type Polity,
  type RowStore,
} from "../../sim/index.ts";
import { grainSum } from "../../causal/index.ts";
import { faithLink, realmLink } from "./names.ts";
import { count, link, many, part, stat } from "./words.ts";
import {
  LEDGER_ROWS,
  allTold,
  honest,
  listedOf,
  mostLeast,
  mostLeastBlock,
  pct,
  per,
  realmMean,
  type LedgerCtx,
  type Ranked,
} from "./ledger-kit.ts";

/** A realm as its row's name: its seat's name, a link to its page. */
const realmCell = (r: Polity): Span => link(r.town, r.ref);
const grain = (n: number) => `${grainSum(Math.max(0, Math.round(n)))} grain's worth`;
/** Nothing kept for this column: its words, and a key that sorts it last. */
const NONE = "—";
/** Whether a store holds any row at all. */
const holds = (s: RowStore | null): s is RowStore => !!s && s.size > 0;

/** The ranked rows of one column, for its "most / least" line: the realms that hold a number for it. */
function ranked(rs: readonly { r: Polity; v: number | null; said: string }[]): Ranked[] {
  return rs.flatMap((x) =>
    x.v === null ? [] : [{ name: realmCell(x.r), value: x.v, said: x.said }],
  );
}

// —— Trade ————————————————————————————————————————————————————————————————————————————————————————

/** Every realm's trade side by side, and every cartel among realms. */
export function tradeLedger(world: World, lc: LedgerCtx): Block[] {
  const cy = tradeStore(world, CYCLE_STORE),
    ex = tradeStore(world, EXCHANGE_STORE),
    pl = tradeStore(world, PLAN_STORE),
    sm = tradeStore(world, SMOKE_STORE),
    cap = tradeStore(world, CAPITAL_STORE),
    rent = tradeStore(world, RENT_STORE),
    cart = tradeStore(world, CARTEL_STORE);
  if (![cy, ex, pl, sm, cap, rent, cart].some(holds))
    return honest("No realm keeps a trade reckoning yet.");
  type Read = {
    r: Polity;
    idle: number | null;
    harvest: number | null;
    worth: number | null;
    bubble: number | null;
    crash: number;
    planned: number | null;
    smoke: number | null;
    machines: number | null;
    rent: number;
  };
  const reads: Read[] = [];
  for (const r of lc.standing) {
    const c = cy?.get(r.ref),
      e = ex?.get(r.ref),
      p = pl?.get(r.ref),
      s = sm?.get(r.ref),
      machines = cap
        ? realmMean(lc, r, (cell) => (cap.get(cell) ? cap.at(cell, CAP.share) / 1000 : null))
        : null;
    let ground = 0,
      grounds = 0;
    if (rent)
      for (const cell of r.members) {
        const x = rent.get(cell);
        if (x) {
          ground += x[RT.rent]!;
          grounds++;
        }
      }
    if (!c && !e && !p && !s && machines === null && !grounds) continue;
    reads.push({
      r,
      idle: c ? c[CY.slack]! / 1000 : null,
      harvest: c && c[CY.usual]! > 0 ? c[CY.food]! / c[CY.usual]! : null,
      worth: e ? e[EX.worth]! : null,
      bubble: e ? e[EX.bubble]! : null,
      crash: e ? e[EX.crash]! : 0,
      planned: p ? p[PL.planned]! / 1000 : null,
      smoke: s ? s[SM.price]! / 1000 : null,
      machines,
      rent: ground,
    });
  }
  // (The deepest slump first: what most marks a realm's year in trade.)
  reads.sort(
    (a, b) =>
      (b.idle ?? -1) - (a.idle ?? -1) ||
      (b.worth ?? -1) - (a.worth ?? -1) ||
      (a.r.ref < b.r.ref ? -1 : 1),
  );
  const rows: Row[] = reads.slice(0, LEDGER_ROWS).map((x) => {
    const c = cy?.get(x.r.ref),
      e = ex?.get(x.r.ref),
      s = sm?.get(x.r.ref);
    return {
      ref: `${x.r.ref}#treasury`,
      cells: [
        [realmCell(x.r)],
        [
          x.idle === null
            ? NONE
            : x.idle > 0
              ? `slump, ${pct(x.idle)} idle`
              : c && c[CY.food]! > c[CY.usual]!
                ? "booming"
                : "steady",
        ],
        [x.harvest === null ? NONE : `${pct(x.harvest)} of its usual`],
        [x.worth === null ? NONE : grain(x.worth)],
        [x.bubble === null ? NONE : x.bubble > 100 ? `${x.bubble - 100}% past` : "not past"],
        [e && x.crash > 0 ? `year ${x.crash}, ${grain(e[EX.fell]!)} gone` : "none"],
        [x.planned === null ? NONE : pct(x.planned)],
        [
          x.smoke === null || !s
            ? NONE
            : x.smoke > 0
              ? `${pct(x.smoke)} of its harm, ${per(s[SM.abated]!)} cut`
              : "unpriced",
        ],
        [x.machines === null ? NONE : pct(x.machines)],
        [x.rent > 0 ? grain(x.rent) : NONE],
      ],
      keys: [
        x.r.town,
        x.idle ?? -1,
        x.harvest ?? -1,
        x.worth ?? -1,
        x.bubble ?? -1,
        x.crash,
        x.planned ?? -1,
        x.smoke ?? -1,
        x.machines ?? -1,
        x.rent,
      ],
    };
  });
  // Every good sold abroad by a cartel among realms.
  const bySerial = new Map<number, Ref>(
      politiesOf(world)
        .living()
        .map((p) => [refNumber(p.ref) + 1, p.ref] as const),
    ),
    cartels: Row[] = [];
  if (cart)
    for (let g = 0; g < GOODS.length; g++) {
      const row = cart.get(cartelKey(g));
      if (!row) continue;
      const members: Span[] = [];
      for (let i = 0; i < 5; i++) {
        const ref = bySerial.get(row[CT.members + i]!);
        if (!ref) continue;
        if (members.length) members.push(", ");
        members.push(realmLink(world, ref));
      }
      const good = GOODS[g]!;
      cartels.push({
        ref: `good:${good.id}`,
        cells: [
          [link(good.name, `good:${good.id}`)],
          members.length ? members : ["realms now gone"],
          [`${per(row[CT.markup]!)} above`],
          [per(row[CT.share]!)],
          [per(row[CT.cohesion]!)],
          [`year ${row[CT.since]}`],
        ],
        keys: [
          good.name,
          members.length,
          row[CT.markup]!,
          row[CT.share]!,
          row[CT.cohesion]!,
          row[CT.since]!,
        ],
      });
    }
  cartels.sort((a, b) => (b.keys![2] as number) - (a.keys![2] as number));
  const slumps = reads.filter((x) => (x.idle ?? 0) > 0).length,
    crashes = reads.filter((x) => x.crash > 0).length,
    worth = reads.reduce((n, x) => n + (x.worth ?? 0), 0),
    machined = reads.filter((x) => x.machines !== null);
  const blocks: Block[] = [
    allTold([
      stat("Realms reckoned", count(reads.length)),
      stat("In a slump now", many(slumps, "realm", "realms")),
      stat("Their exchanges worth", grain(worth)),
      stat("Realms that have had a crash", count(crashes)),
      stat("Goods sold abroad by a cartel", count(cartels.length)),
    ]),
  ];
  if (rows.length)
    blocks.push(
      {
        type: "table",
        title: "Each realm's trade",
        columns: [
          "Realm",
          "Plenty or want",
          "Harvest",
          "Exchange",
          "Bid past",
          "Last crash",
          "Planned",
          "Smoke",
          "Machines",
          "Ground rent",
        ],
        rows,
      },
      ...listedOf(rows.length, reads.length, "realms deepest in want"),
      ...mostLeastBlock([
        mostLeast(
          "Idle for want of buyers",
          ranked(reads.map((x) => ({ r: x.r, v: x.idle, said: pct(x.idle ?? 0) }))),
        ),
        mostLeast(
          "Shared out by plan",
          ranked(reads.map((x) => ({ r: x.r, v: x.planned, said: pct(x.planned ?? 0) }))),
        ),
        mostLeast(
          "Tasks machines do",
          ranked(machined.map((x) => ({ r: x.r, v: x.machines, said: pct(x.machines ?? 0) }))),
        ),
      ]),
    );
  blocks.push(
    cartels.length
      ? {
          type: "table",
          title: "Cartels among realms",
          columns: ["Good", "Realms", "Asks", "Of the making", "Held together", "Since"],
          rows: cartels,
          fit: true,
        }
      : {
          type: "text",
          title: "Cartels among realms",
          lines: [["No good is sold abroad by a cartel of realms."]],
        },
  );
  return blocks;
}

// —— Society ——————————————————————————————————————————————————————————————————————————————————————

/** Every realm's people's lives side by side: the street, care, the old, its law, its work and rest, who does what. */
export function societyLedger(world: World, lc: LedgerCtx): Block[] {
  const roof = societyStore(world, ROOFLESS_STORE),
    care = societyStore(world, CARE_STORE),
    old = societyStore(world, OLD_STORE),
    pro = societyStore(world, PROVISION_STORE),
    law = societyStore(world, LAW_STORE),
    rest = societyStore(world, LEISURE_STORE),
    roles = societyStore(world, ROLES_STORE);
  if (![roof, care, old, pro, law, rest, roles].some(holds))
    return honest("No realm keeps a reckoning of its people's lives yet.");
  const mean = (s: RowStore | null, i: number, r: Polity) =>
    s ? realmMean(lc, r, (c) => (s.get(c) ? s.at(c, i) / 1000 : null)) : null;
  type Read = {
    r: Polity;
    street: number | null;
    reach: number | null;
    unkept: number | null;
    pension: number | null;
    written: number | null;
    secure: number | null;
    deals: number | null;
    hours: number | null;
    days: number | null;
    norm: number | null;
    roofless: number;
  };
  const reads: Read[] = [];
  for (const r of lc.standing) {
    const lw = law?.get(r.ref),
      pv = pro?.get(r.ref),
      x: Read = {
        r,
        street: mean(roof, ROOF_ROW.street, r),
        reach: mean(care, CARE_ROW.reach, r),
        unkept: mean(old, OLD_ROW.neglected, r),
        pension: pv ? pv[PROVISION.pension]! / 1000 : null,
        written: lw ? lw[LAW_ROW.written]! / 1000 : null,
        secure: lw ? lw[LAW_ROW.secure]! / 1000 : null,
        deals: lw ? lw[LAW_ROW.deals]! / 1000 : null,
        // (Its hours kept in tenths: a mean of the ten-times number, said in hours.)
        hours: rest
          ? realmMean(lc, r, (c) => (rest.get(c) ? rest.at(c, LEISURE_ROW.hours) / 10 : null))
          : null,
        days: rest
          ? realmMean(lc, r, (c) => {
              const row = rest.get(c);
              return row ? daysWorked(row[LEISURE_ROW.holy]!, row[LEISURE_ROW.feasts]!) : null;
            })
          : null,
        norm: mean(roles, ROLE_ROW.norm, r),
        roofless: 0,
      };
    if (roof)
      for (const c of r.members) {
        const row = roof.get(c);
        if (row) x.roofless += (row[ROOF_ROW.street]! / 1000) * row[ROOF_ROW.town]!;
      }
    if (
      [x.street, x.reach, x.unkept, x.pension, x.written, x.hours, x.norm].every((v) => v === null)
    )
      continue;
    reads.push(x);
  }
  if (!reads.length) return honest("No realm keeps a reckoning of its people's lives yet.");
  // (Those most on the street first: who a realm leaves without a roof says most of how it keeps its people.)
  reads.sort(
    (a, b) =>
      (b.street ?? -1) - (a.street ?? -1) ||
      (lc.people.get(b.r.ref) ?? 0) - (lc.people.get(a.r.ref) ?? 0) ||
      (a.r.ref < b.r.ref ? -1 : 1),
  );
  const share = (v: number | null) => (v === null ? NONE : pct(v)),
    rows: Row[] = reads.slice(0, LEDGER_ROWS).map((x) => ({
      ref: `${x.r.ref}#laws`,
      cells: [
        [realmCell(x.r)],
        [share(x.street)],
        [share(x.reach)],
        [share(x.unkept)],
        [share(x.pension)],
        [share(x.written)],
        [share(x.secure)],
        [share(x.deals)],
        [x.hours === null ? NONE : `${x.hours.toFixed(1)} hours`],
        [share(x.days)],
        [share(x.norm)],
      ],
      keys: [
        x.r.town,
        x.street ?? -1,
        x.reach ?? -1,
        x.unkept ?? -1,
        x.pension ?? -1,
        x.written ?? -1,
        x.secure ?? -1,
        x.deals ?? -1,
        x.hours ?? -1,
        x.days ?? -1,
        x.norm ?? -1,
      ],
    }));
  const street = reads.reduce((n, x) => n + x.roofless, 0),
    pensioned = reads.filter((x) => (x.pension ?? 0) > 0).length,
    written = reads.filter((x) => (x.written ?? 0) >= 0.5).length,
    line = (label: string, pick: (x: Read) => number | null, say = pct) =>
      mostLeast(label, ranked(reads.map((x) => ({ r: x.r, v: pick(x), said: say(pick(x) ?? 0) }))));
  return [
    allTold([
      stat("Realms reckoned", count(reads.length)),
      stat("On the street, the world over", many(Math.round(street), "person", "people")),
      stat("Realms that pay their old a pension", count(pensioned)),
      stat("Realms whose law is mostly written", count(written)),
    ]),
    {
      type: "table",
      title: "Each realm's people",
      columns: [
        "Realm",
        "On the street",
        "A healer's reach",
        "Old kept by none",
        "Pensioned",
        "Law written",
        "A holding safe",
        "Deals held",
        "Working day",
        "Days at work",
        "Bearers' work",
      ],
      rows,
    },
    ...listedOf(rows.length, reads.length, "realms most on the street"),
    ...mostLeastBlock([
      line("On the street", (x) => x.street),
      line("Within a healer's reach", (x) => x.reach),
      line("Law written", (x) => x.written),
      line(
        "Working day",
        (x) => x.hours,
        (v) => `${v.toFixed(1)} hours`,
      ),
    ]),
  ];
}

// —— Culture ——————————————————————————————————————————————————————————————————————————————————————

/** A voice's topic, short, for its row ("that its rule is rightful" → "its rule is rightful"). */
const told = (words: string) => words.replace(/^that /, "");

/** Every realm's culture side by side, and every faith's temples. */
export function cultureLedger(world: World, lc: LedgerCtx): Block[] {
  const stores = [
      cultureRows(world, "culture.folk"),
      cultureRows(world, VOICE_STORE),
      cultureRows(world, ART_STORE),
      cultureRows(world, URBAN_STORE),
      cultureRows(world, ACADEMY_STORE),
    ],
    temples = cultureRows(world, TEMPLE_STORE);
  if (![...stores, temples].some(holds)) return honest("No realm's culture has been weighed yet.");
  const ctx = populationContext(world);
  type Read = {
    r: Polity;
    kin: number | null;
    nation: number | null;
    strangers: number;
    topic: string | null;
    credence: number | null;
    reach: number | null;
    renown: number | null;
    draw: number | null;
    learned: number | null;
  };
  const reads: Read[] = [];
  for (const r of lc.standing) {
    const folk = realmFolk(ctx, r),
      v = voiceOf(world, r.ref);
    let strangers = 0,
      renown: number | null = null;
    for (const c of r.members) {
      const f = identityOf(world, c);
      if (f && f.kin < 0.6) strangers++;
      const a = artOf(world, c);
      if (a && a.works > 0 && (renown === null || a.renown > renown)) renown = a.renown;
    }
    const x: Read = {
      r,
      kin: folk.weighed ? folk.kin : null,
      nation: folk.weighed ? folk.nation : null,
      strangers,
      topic: v?.topic ? told(VOICE_WORDS[v.topic]) : null,
      credence: v?.topic ? v.credence : null,
      reach: v ? v.reach : null,
      renown,
      draw: realmMean(lc, r, (c) => urbanOf(world, c)?.draw ?? null),
      learned: realmMean(lc, r, (c) => academyOf(world, c)?.learned ?? null),
    };
    if ([x.kin, x.reach, x.renown, x.draw, x.learned].every((y) => y === null)) continue;
    reads.push(x);
  }
  // (Those whose people least count its seat's their own first: where its "us" is thinnest.)
  reads.sort(
    (a, b) =>
      (a.kin ?? 2) - (b.kin ?? 2) || b.strangers - a.strangers || (a.r.ref < b.r.ref ? -1 : 1),
  );
  const rows: Row[] = reads.slice(0, LEDGER_ROWS).map((x) => ({
    ref: `${x.r.ref}#culture`,
    cells: [
      [realmCell(x.r)],
      [x.kin === null ? NONE : `${kinWords(x.kin)} (${pct(x.kin)})`],
      [x.nation === null ? NONE : pct(x.nation)],
      [count(x.strangers)],
      [x.topic ?? (x.reach === null ? NONE : "nothing of note")],
      [x.credence === null ? NONE : pct(x.credence)],
      [x.reach === null ? NONE : pct(x.reach)],
      [x.renown === null ? NONE : pct(x.renown)],
      [x.draw === null ? NONE : `${x.draw.toFixed(1)}×`],
      [x.learned === null ? NONE : `${(x.learned * 100).toFixed(2)}%`],
    ],
    keys: [
      x.r.town,
      x.kin ?? -1,
      x.nation ?? -1,
      x.strangers,
      x.topic ?? "",
      x.credence ?? -1,
      x.reach ?? -1,
      x.renown ?? -1,
      x.draw ?? -1,
      x.learned ?? -1,
    ],
  }));
  // Every faith's temples.
  const faiths = world.hasStore("belief.faiths") ? beliefOf(world).all() : [],
    kept = faiths
      .map((f) => ({ f, h: templeOf(world, f) }))
      .filter(
        (x): x is { f: (typeof faiths)[number]; h: NonNullable<ReturnType<typeof templeOf>> } =>
          !!x.h,
      )
      .sort((a, b) => b.h.faithful - a.h.faithful || (a.f.ref < b.f.ref ? -1 : 1)),
    templeRows: Row[] = kept.slice(0, LEDGER_ROWS).map(({ f, h }) => ({
      ref: f.ref,
      cells: [
        [faithLink(world, f.ref)],
        [count(h.clergy)],
        [count(h.faithful)],
        [count(h.lands)],
        [`${count(h.granary)} grain`],
        [h.relief > 0 ? `${count(h.relief)} grain` : "none"],
        [h.teaching > 0 ? pct(h.teaching) : "none"],
        [`year ${h.since}`],
      ],
      keys: [f.name, h.clergy, h.faithful, h.lands, h.granary, h.relief, h.teaching, h.since],
    }));
  const blocks: Block[] = [
    allTold([
      stat("Realms weighed", count(reads.length)),
      stat(
        "Lands counting their seat strangers",
        count(reads.reduce((n, x) => n + x.strangers, 0)),
      ),
      stat("Seats that tell their people a thing", count(reads.filter((x) => x.topic).length)),
      stat("Faiths with temples", count(kept.length)),
      stat("Their clergy", count(kept.reduce((n, x) => n + x.h.clergy, 0))),
    ]),
  ];
  if (rows.length)
    blocks.push(
      {
        type: "table",
        title: "Each realm's people and its word",
        columns: [
          "Realm",
          "Its seat's people",
          "Its “us” reaches",
          "Lands apart",
          "Its seat tells",
          "Believed",
          "Heard",
          "Art's renown",
          "Towns draw",
          "Learned",
        ],
        rows,
      },
      ...listedOf(rows.length, reads.length, "realms least one"),
      ...mostLeastBlock([
        mostLeast(
          "One with their seat",
          ranked(reads.map((x) => ({ r: x.r, v: x.kin, said: pct(x.kin ?? 0) }))),
        ),
        mostLeast(
          "Its seat believed",
          ranked(reads.map((x) => ({ r: x.r, v: x.credence, said: pct(x.credence ?? 0) }))),
        ),
        mostLeast(
          "Its art's renown",
          ranked(reads.map((x) => ({ r: x.r, v: x.renown, said: pct(x.renown ?? 0) }))),
        ),
        mostLeast(
          "Learned",
          ranked(
            reads.map((x) => ({
              r: x.r,
              v: x.learned,
              said: `${((x.learned ?? 0) * 100).toFixed(2)}%`,
            })),
          ),
        ),
      ]),
    );
  blocks.push(
    templeRows.length
      ? {
          type: "table",
          title: "Each faith's temples",
          columns: [
            "Faith",
            "Clergy",
            "Faithful",
            "Lands",
            "Granary",
            "To the hungry",
            "Teach",
            "Since",
          ],
          rows: templeRows,
        }
      : {
          type: "text",
          title: "Each faith's temples",
          lines: [["No faith has a house of its own yet."]],
        },
    ...listedOf(templeRows.length, kept.length, "faiths of the most faithful"),
  );
  return blocks;
}

// —— Powers ———————————————————————————————————————————————————————————————————————————————————————

/** Who decides in a realm, in a word or two (as its Powers tab says it whole). */
function decides(r: Polity, voice: number): string {
  return r.leadership === GENERAL
    ? "a general"
    : voice >= 0.6
      ? "an assembly"
      : voice >= HOLDING.voiceMid
        ? "a council"
        : r.law === 2
          ? "a priest-king"
          : "a chief";
}

const PASSES = ["by birth", "by choice", "by acclaim"];

/** Every realm's powers side by side: who decides, who governs by choice, its spies, its lands held by force, its council. */
export function powersLedger(world: World, lc: LedgerCtx): Block[] {
  if (!lc.standing.length) return honest("No realm's powers are reckoned yet.");
  const votes = electionsOf(world),
    spies = spiesOf(world),
    occ = occupationOf(world),
    councils = councilsOf(world),
    // (One pass over each store: the spies in each realm, the lands each holds by force, those of it others hold.)
    within = new Map<string, number>(),
    held = new Map<string, number>(),
    risen = new Map<string, number>(),
    lost = new Map<string, number>();
  if (spies)
    for (const k of spies.realms())
      for (const s of spies.of(k)) within.set(s.in, (within.get(s.in) ?? 0) + 1);
  if (occ)
    for (const c of occ.cells()) {
      const o = occ.of(c)!;
      held.set(o.holder, (held.get(o.holder) ?? 0) + 1);
      if (o.rising) risen.set(o.holder, (risen.get(o.holder) ?? 0) + 1);
      lost.set(o.from, (lost.get(o.from) ?? 0) + 1);
    }
  type Read = {
    r: Polity;
    voice: number;
    governs: string;
    last: number;
    abroad: number;
    within: number;
    held: number;
    risen: number;
    lost: number;
    council: Line;
    councilName: string;
  };
  const reads: Read[] = lc.standing.map((r) => {
    const voice = holdsOf(world, r.ref)[1] ?? 0,
      v = votes?.of(r.ref),
      asked = chooses(world, r) && !!v,
      c = councils?.councilOf(r.ref) ?? null;
    return {
      r,
      voice,
      governs: !asked ? "not asked" : v!.governing ? `the ${v!.governing}` : "none chosen yet",
      last: asked ? (v!.past.at(-1)?.year ?? 0) : 0,
      abroad: spies?.of(r.ref).length ?? 0,
      within: within.get(r.ref) ?? 0,
      held: held.get(r.ref) ?? 0,
      risen: risen.get(r.ref) ?? 0,
      lost: lost.get(r.ref) ?? 0,
      council: c ? [link(c.name, c.event)] : ["none"],
      councilName: c?.name ?? "",
    };
  });
  // (Those holding the most by force first, then those watching the most abroad: what most marks a realm's reach.)
  reads.sort(
    (a, b) =>
      b.held - a.held ||
      b.abroad - a.abroad ||
      (lc.people.get(b.r.ref) ?? 0) - (lc.people.get(a.r.ref) ?? 0) ||
      (a.r.ref < b.r.ref ? -1 : 1),
  );
  const rows: Row[] = reads.slice(0, LEDGER_ROWS).map((x) => ({
    ref: `${x.r.ref}#powers`,
    cells: [
      [realmCell(x.r)],
      [decides(x.r, x.voice)],
      [PASSES[x.r.succession] ?? "by birth"],
      [x.governs],
      [x.last ? `year ${x.last}` : NONE],
      [count(x.abroad)],
      [count(x.within)],
      [x.held ? `${count(x.held)}${x.risen ? `, ${count(x.risen)} risen` : ""}` : "none"],
      [x.lost ? count(x.lost) : "none"],
      x.council,
    ],
    keys: [
      x.r.town,
      x.voice,
      x.r.succession,
      x.governs,
      x.last,
      x.abroad,
      x.within,
      x.held,
      x.lost,
      x.councilName,
    ],
  }));
  const sum = (f: (x: Read) => number) => reads.reduce((n, x) => n + f(x), 0),
    sitting = councils ? councils.councils().filter((c) => c.ended === null).length : 0;
  return [
    allTold([
      stat("Realms", count(reads.length)),
      stat(
        "Governed by their people's choice",
        count(reads.filter((x) => x.governs !== "not asked").length),
      ),
      stat("Spies kept abroad", count(sum((x) => x.abroad))),
      stat("Lands held by force", count(sum((x) => x.held)), {
        ...(sum((x) => x.risen)
          ? { parts: [part("risen against their holders", count(sum((x) => x.risen)))] }
          : {}),
      }),
      stat("Councils of realms sitting", count(sitting)),
    ]),
    {
      type: "table",
      title: "Each realm's powers",
      columns: [
        "Realm",
        "Decides",
        "Rule passes",
        "Governs by choice",
        "Last chosen",
        "Spies abroad",
        "Spies within",
        "Held by force",
        "Its lands held",
        "Council",
      ],
      rows,
    },
    ...listedOf(rows.length, reads.length, "realms of the most reach"),
    ...mostLeastBlock([
      mostLeast(
        "Spies abroad",
        reads.map((x) => ({ name: realmCell(x.r), value: x.abroad, said: count(x.abroad) })),
      ),
      mostLeast(
        "Lands held by force",
        reads.map((x) => ({ name: realmCell(x.r), value: x.held, said: count(x.held) })),
      ),
      mostLeast(
        "Choices carried by many",
        reads.map((x) => ({ name: realmCell(x.r), value: x.voice, said: pct(x.voice) })),
      ),
    ]),
  ];
}
