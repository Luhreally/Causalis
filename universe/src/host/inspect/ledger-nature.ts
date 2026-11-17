// Three of the ledger's world-wide tabs (asked 2026-11-16: "whatever else is relevant to be on ledger"):
//   Arms     every realm's war footing (what it turns to arms, against whom, whom it arms in another's war, the host a peace has
//            it stand down), its fleet and the blockade on it, the seas fought for in each war, and the sieges laid now (the
//            last sweep, war: sim/war/arming.ts, navy.ts, siege.ts). A siege is kept only while it is laid: one lifted, stormed
//            or starved out is told on its war's page, never counted here by a walk of the whole chronicle.
//   Nature   realm by realm, its crops (how tame, how many of its lands sow a crop bred elsewhere), the pests carried in, its
//            herds, its people going short though fed, and the eruptions and floods the world keeps; the fires and floods
//            themselves, newest first; and what lies past the ages, realm by realm and for the world (sim/ecology, sim/planet,
//            sim/population/diet.ts, sim/frontier).
//   Making   realm by realm, the material ways its lands make (alloys, binders, ceramics, polymers, pure crystal …), its
//            hottest fire, the purity it refines to, and the work its lands turn a head and what drives it; and each way,
//            where it is made (sim/lore/materials.ts, sim/economy/energy.ts).
// Pure reads of what the stores keep: one pass over each store a page build, every table bounded by the realms, the lands or
// the few kept of each kind. Who, what, cost and effect; never how a weapon or a stuff is made.
import type { Ref, World } from "../../kernel/index.ts";
import type { Block, Row, Span, Stat } from "../../bridge/index.ts";
import { MATERIAL_WAYS, SOURCES, SOURCE_WORDS, type Source } from "../../rules/index.ts";
import {
  armingOf,
  cropReading,
  cropsOf,
  dietOfWorld,
  energyBooks,
  exchangeOf,
  firesOf,
  floodsOf,
  homeWeather,
  impactsOf,
  makingHeat,
  materialsOf,
  mindsOf,
  navyOf,
  orbitalOf,
  politiesOf,
  populationContext,
  siegesOf,
  upliftOf,
  warsOf,
  weatherOf,
  writtenOf,
  type Polity,
} from "../../sim/index.ts";
import { realmColor } from "../colors.ts";
import { landLink, landTitle, realmLink } from "./names.ts";
import { count, link, many, stat } from "./words.ts";
import {
  LEDGER_ROWS,
  allTold,
  honest,
  listedOf,
  mostLeast,
  mostLeastBlock,
  pct,
  type LedgerCtx,
  type Ranked,
} from "./ledger-kit.ts";

const tonnes = (n: number) => `${count(n)} t`,
  times = (x: number) =>
    x >= 100 ? count(x) : x >= 10 ? x.toFixed(0) : x >= 1 ? x.toFixed(1) : x.toPrecision(2),
  cap = (s: string) => (s ? s[0]!.toUpperCase() + s.slice(1) : s);

/** A realm's seat's name, for a sortable key (a realm gone: its ref). */
function seatName(world: World, ref: Ref | string | null | undefined): string {
  return ref ? (politiesOf(world).get(ref as Ref)?.town ?? String(ref)) : "";
}

/** A war as a link by its two sides ("Avalor upon Brin"). */
function warLink(world: World, ref: Ref): Span {
  const w = warsOf(world).get(ref);
  if (!w) return link("a war", ref);
  return link(`${seatName(world, w.attacker)} upon ${seatName(world, w.defender)}`, ref);
}

// —— Arms ————————————————————————————————————————————————————————————————————————————————————————————————

/** Every realm's footing, fleet and blockade, the seas fought for and the sieges laid now. */
export function armsLedger(world: World, lc: LedgerCtx): Block[] {
  const arming = armingOf(world),
    navy = navyOf(world),
    sieges = siegesOf(world),
    seaWars = navy?.wars() ?? [],
    laid = sieges?.wars() ?? [],
    footings = lc.standing.flatMap((r) => {
      const f = arming?.of(r.ref);
      return f ? [{ r, f }] : [];
    }),
    fleets = lc.standing.flatMap((r) => {
      const s = navy?.of(r.ref);
      return s && (s.tons > 0 || s.merchant > 0 || s.blockaded > 0) ? [{ r, s }] : [];
    });
  if (
    !footings.some(({ f }) => f.footing > 0 || f.wanted > 0) &&
    !fleets.length &&
    !seaWars.length &&
    !laid.length
  )
    return honest("No realm has armed against another yet.");
  const blocks: Block[] = [];
  // Their footing.
  const byFooting = [...footings].sort(
    (a, b) => b.f.footing - a.f.footing || (a.r.ref < b.r.ref ? -1 : 1),
  );
  if (byFooting.length) {
    blocks.push({
      type: "bars",
      title: "What each turns to arms",
      unit: "share",
      bars: byFooting.slice(0, 12).map(({ r, f }) => ({
        label: [r.town],
        ref: `${r.ref}#army`,
        value: f.footing,
        color: realmColor(r.ref),
      })),
    });
    const rows: Row[] = byFooting.slice(0, LEDGER_ROWS).map(({ r, f }) => {
      const disarmed = f.disarm > 0 && f.disarmUntil >= lc.now;
      return {
        ref: `${r.ref}#army`,
        cells: [
          [realmLink(world, r.ref)],
          [pct(f.footing)],
          [pct(f.wanted)],
          f.against
            ? [realmLink(world, f.against), ...(f.race ? [" (", link("a race", f.race), ")"] : [])]
            : ["no one"],
          f.backs && f.helps
            ? [link(`${pct(f.sends)} to`, f.backs), " ", realmLink(world, f.helps)]
            : ["none"],
          [f.gift > 0 ? pct(f.gift) : "none"],
          [disarmed ? `${pct(f.disarm)} until ${f.disarmUntil}` : "—"],
        ],
        keys: [
          r.town,
          f.footing,
          f.wanted,
          seatName(world, f.against),
          f.backs ? f.sends : 0,
          f.gift,
          disarmed ? f.disarm : 0,
        ],
      };
    });
    blocks.push({
      type: "table",
      title: "War footing",
      columns: ["Realm", "Footing", "Wants", "Arms against", "Sends arms", "Is sent", "Stood down"],
      rows,
    });
    blocks.push(...listedOf(rows.length, byFooting.length, "realms most armed"));
  }
  // Their fleets.
  const byTons = [...fleets].sort((a, b) => b.s.tons - a.s.tons || (a.r.ref < b.r.ref ? -1 : 1));
  if (byTons.length)
    blocks.push({
      type: "table",
      title: "Fleets",
      columns: ["Realm", "Warships", "Worth a tonne", "Merchant ships", "Blockaded", "Cost a year"],
      fit: true,
      rows: byTons.slice(0, LEDGER_ROWS).map(({ r, s }) => ({
        ref: `${r.ref}#army`,
        cells: [
          [realmLink(world, r.ref)],
          [tonnes(s.tons)],
          [s.quality.toFixed(2)],
          [tonnes(s.merchant)],
          [s.blockaded > 0 ? `${pct(s.blockaded)} cut` : "free"],
          [count(s.cost)],
        ],
        keys: [r.town, s.tons, s.quality, s.merchant, s.blockaded, s.cost],
      })),
    });
  // The seas fought for.
  if (seaWars.length && navy)
    blocks.push({
      type: "table",
      title: "Seas fought for",
      columns: ["War", "Its sea held", "Ships sunk", "Now"],
      fit: true,
      rows: seaWars.map((ref) => {
        const s = navy.sea(ref)!;
        return {
          ref,
          cells: [
            [warLink(world, ref)],
            [`${pct(s.command[0])} · ${pct(s.command[1])}`],
            [`${tonnes(s.sunk[0])} · ${tonnes(s.sunk[1])}`],
            s.won
              ? [link("the sea won", s.won)]
              : s.blockade
                ? [link("a blockade laid", s.blockade)]
                : ["contested"],
          ],
          keys: [
            seatName(world, warsOf(world).get(ref)?.attacker),
            s.command[0],
            s.sunk[0] + s.sunk[1],
            s.won ? 2 : s.blockade ? 1 : 0,
          ],
        };
      }),
    });
  // The sieges laid now.
  if (laid.length && sieges) {
    blocks.push({
      type: "table",
      title: "Sieges laid now",
      columns: ["War", "Land", "Since", "Food left", "Walls broken", "Dead", "By sea"],
      rows: laid.map((ref) => {
        const s = sieges.of(ref)!;
        return {
          ref: s.event,
          cells: [
            [warLink(world, ref)],
            [landLink(world, s.land), s.seat ? " (its seat)" : ""],
            [`year ${s.since}`],
            [`${Math.round(s.months)} months`],
            [pct(s.breach)],
            [`${count(s.campDead)} camp · ${count(s.townDead)} town`],
            [s.relief > 0 ? pct(s.relief) : "none"],
          ],
          keys: [
            seatName(world, warsOf(world).get(ref)?.attacker),
            landTitle(world, s.land),
            s.since,
            s.months,
            s.breach,
            s.campDead + s.townDead,
            s.relief,
          ],
        };
      }),
    });
  }
  blocks.push({
    type: "text",
    lines: [
      [
        "A siege is kept here while it is laid; one lifted, stormed or starved into giving up is told on its war's page.",
      ],
    ],
  });
  // All told, and the most and least.
  const racing = footings.filter(({ f }) => f.race).length,
    backing = footings.filter(({ f }) => f.backs && f.helps).length,
    blockaded = fleets.filter(({ s }) => s.blockaded > 0).length;
  blocks.unshift(
    allTold([
      stat(
        "Realms turning a share to arms",
        count(footings.filter(({ f }) => f.footing >= 0.005).length),
      ),
      stat("In an arms race", count(racing)),
      stat("Sending arms into another's war", count(backing)),
      stat("Warships the world over", tonnes(fleets.reduce((n, { s }) => n + s.tons, 0))),
      stat("Realms blockaded", count(blockaded)),
      stat("Seas fought for", count(seaWars.length)),
      stat("Sieges laid now", count(laid.length)),
    ]),
  );
  blocks.push(
    ...mostLeastBlock([
      mostLeast(
        "Most armed",
        footings.map(({ r, f }): Ranked => ({
          name: realmLink(world, r.ref),
          value: f.footing,
          said: pct(f.footing),
        })),
      ),
      mostLeast(
        "Greatest fleet",
        fleets.map(({ r, s }): Ranked => ({
          name: realmLink(world, r.ref),
          value: s.tons,
          said: tonnes(s.tons),
        })),
      ),
    ]),
  );
  return blocks;
}

// —— Nature ——————————————————————————————————————————————————————————————————————————————————————————————

/** A realm's crops, pests, herds and want, read over its lands in one pass. */
type RealmNature = {
  readonly r: Polity;
  sown: number;
  tamed: number;
  carried: number;
  tame: number;
  pests: number;
  herds: number;
  short: number;
  /** The people its readings are weighed over: of lands with a crop, a pest reading, a diet. */
  cropPeople: number;
  pestPeople: number;
  dietPeople: number;
  eruptions: number;
  erupted: number;
  floods: number;
  drowned: number;
};

/** Realm by realm, the land's crops and want; the fires and floods kept; and what lies past the ages. */
export function natureLedger(world: World, lc: LedgerCtx): Block[] {
  const crops = cropsOf(world),
    exch = exchangeOf(world),
    diet = dietOfWorld(world),
    fires = firesOf(world),
    floods = floodsOf(world),
    realms = world.hasStore("polity.states") ? politiesOf(world) : null,
    eruptions = fires?.eruptions ?? [],
    floodList = floods?.floods ?? [],
    rows: RealmNature[] = lc.standing.map((r) => ({
      r,
      sown: 0,
      tamed: 0,
      carried: 0,
      tame: 0,
      pests: 0,
      herds: 0,
      short: 0,
      cropPeople: 0,
      pestPeople: 0,
      dietPeople: 0,
      eruptions: 0,
      erupted: 0,
      floods: 0,
      drowned: 0,
    })),
    byRealm = new Map(rows.map((x) => [x.r.ref as string, x]));
  for (const x of rows)
    for (const c of x.r.members) {
      const n = lc.peopleOf(c),
        crop = crops?.get(c),
        ex = exch?.get(c),
        d = diet?.lands.get(c);
      if (crop) {
        x.sown++;
        if (crop.tame >= 1000) x.tamed++;
        if (crop.from !== c) x.carried++;
        x.tame += n * (crop.tame / 1000);
        x.cropPeople += n;
      }
      if (ex) {
        x.pests += n * (ex.pests / 1000);
        x.pestPeople += n;
        if (ex.beast >= 0) x.herds++;
      }
      if (d) {
        x.short += n * (d.short / 1000);
        x.dietPeople += n;
      }
    }
  for (const e of eruptions) {
    const x = byRealm.get(realms?.of(e.cell)?.ref ?? "");
    if (!x) continue;
    x.eruptions++;
    x.erupted += e.dead;
  }
  for (const f of floodList) {
    const x = byRealm.get(realms?.of(f.cell)?.ref ?? "");
    if (!x) continue;
    x.floods++;
    x.drowned += f.dead;
  }
  const kept =
    rows.some((x) => x.sown || x.pestPeople || x.dietPeople) ||
    eruptions.length > 0 ||
    floodList.length > 0 ||
    (fires?.tally.eruptions ?? 0) > 0 ||
    (floods?.tally.floods ?? 0) > 0;
  const blocks: Block[] = [];
  if (!kept) blocks.push(...honest("Nothing of the land's fires, floods or crops is kept yet."));
  else {
    const mean = (sum: number, people: number) => (people > 0 ? sum / people : 0),
      ctx = crops ? populationContext(world) : null,
      read = rows
        .filter((x) => x.sown || x.pestPeople || x.dietPeople || x.eruptions || x.floods)
        .sort(
          (a, b) =>
            mean(b.short, b.dietPeople) - mean(a.short, a.dietPeople) ||
            b.sown - a.sown ||
            (a.r.ref < b.r.ref ? -1 : 1),
        ),
      shown = read.slice(0, LEDGER_ROWS);
    const allSown = rows.reduce((n, x) => n + x.sown, 0),
      people = rows.reduce((n, x) => n + x.dietPeople, 0),
      shortPeople = rows.reduce((n, x) => n + x.short, 0);
    blocks.push(
      allTold([
        stat(
          "Eruptions",
          `${count(fires?.tally.eruptions ?? 0)}, ${count(fires?.tally.dead ?? 0)} dead${fires?.tally.greatest ? `; the greatest ${fires.tally.greatest} on the scale of ash` : ""}`,
        ),
        stat(
          "Floods",
          `${count(floods?.tally.floods ?? 0)}, ${count(floods?.tally.dead ?? 0)} drowned`,
        ),
        stat(
          "Lands sowing a crop",
          `${count(allSown)}: ${count(rows.reduce((n, x) => n + x.tamed, 0))} of them tamed, ${count(rows.reduce((n, x) => n + x.carried, 0))} bred elsewhere`,
        ),
        stat("Lands keeping herds", count(rows.reduce((n, x) => n + x.herds, 0))),
        stat(
          "Going short though fed",
          people > 0 ? `${pct(shortPeople / people)} of their want` : "no one reckoned",
        ),
      ]),
    );
    if (shown.length)
      blocks.push({
        type: "table",
        title: "Crops, herds and want, realm by realm",
        columns: [
          "Realm",
          "Its seat sows",
          "Tame",
          "Bred elsewhere",
          "Pests take",
          "Herds",
          "Going short",
          "Fires · floods",
        ],
        rows: shown.map((x) => {
          const seat = ctx ? cropReading(world, ctx, x.r.seat) : null,
            tame = mean(x.tame, x.cropPeople),
            pests = mean(x.pests, x.pestPeople),
            short = mean(x.short, x.dietPeople);
          return {
            ref: x.r.ref,
            cells: [
              [realmLink(world, x.r.ref)],
              seat ? [link(seat.name, seat.lineage)] : ["nothing"],
              [x.sown ? `${pct(tame)} (${count(x.tamed)} of ${count(x.sown)} tamed)` : "—"],
              [x.sown ? `${count(x.carried)} of ${count(x.sown)}` : "—"],
              [x.pestPeople ? pct(pests) : "—"],
              [count(x.herds)],
              [x.dietPeople ? pct(short) : "—"],
              [
                x.eruptions || x.floods
                  ? `${count(x.eruptions)} (${count(x.erupted)} dead) · ${count(x.floods)} (${count(x.drowned)} drowned)`
                  : "none kept",
              ],
            ],
            keys: [
              x.r.town,
              seat?.name ?? "",
              tame,
              x.carried,
              pests,
              x.herds,
              short,
              x.erupted + x.drowned,
            ],
          };
        }),
      });
    blocks.push(...listedOf(shown.length, read.length, "realms most short"));
    // The fires and floods themselves, newest first.
    const struck = [
      ...eruptions.map((e) => ({
        year: e.year,
        cell: e.cell,
        what: `An eruption of ${e.vei}`,
        size: e.vei,
        dead: e.dead,
        ref: e.event,
      })),
      ...floodList.map((f) => ({
        year: f.year,
        cell: f.cell,
        what: f.size >= 200 ? "A great flood" : "A flood",
        size: f.size / 100,
        dead: f.dead,
        ref: f.event as Ref | null,
      })),
    ].sort((a, b) => b.year - a.year || a.cell - b.cell);
    if (struck.length)
      blocks.push({
        type: "table",
        title: "Fires below and floods, newest first",
        columns: ["Year", "What", "Land", "Realm", "Dead"],
        fit: true,
        rows: struck.map((s) => {
          const r = realms?.of(s.cell);
          return {
            ...(s.ref ? { ref: s.ref } : {}),
            cells: [
              [String(s.year)],
              [link(s.what, s.ref)],
              [landLink(world, s.cell)],
              [r ? realmLink(world, r.ref) : "no realm"],
              [count(s.dead)],
            ],
            keys: [s.year, s.what, landTitle(world, s.cell), r?.town ?? "", s.dead],
          };
        }),
      });
    blocks.push(
      ...mostLeastBlock([
        mostLeast(
          "Most short",
          read
            .filter((x) => x.dietPeople > 0)
            .map((x): Ranked => {
              const v = mean(x.short, x.dietPeople);
              return { name: realmLink(world, x.r.ref), value: v, said: pct(v) };
            }),
        ),
        mostLeast(
          "Most taken by pests",
          read
            .filter((x) => x.pestPeople > 0)
            .map((x): Ranked => {
              const v = mean(x.pests, x.pestPeople);
              return { name: realmLink(world, x.r.ref), value: v, said: pct(v) };
            }),
        ),
      ]),
    );
  }
  blocks.push(...beyondBlocks(world));
  return blocks;
}

/** What lies past the ages: the star's storms, the great stones, the works in the sky, bodies written, beasts raised, minds. */
function beyondBlocks(world: World): Block[] {
  const weather = weatherOf(world),
    impacts = impactsOf(world),
    works = orbitalOf(world)?.all() ?? [],
    written = writtenOf(world)?.all() ?? [],
    raised = upliftOf(world)?.raisings ?? [],
    minds = mindsOf(world),
    mindRows = minds ? [...minds.rows.values()] : [],
    rows: Stat[] = [];
  if (weather) {
    const hw = homeWeather(world),
      ws = weather.state;
    rows.push(
      stat(
        "Its star's storms",
        `${hw.rate > 0 ? `${times(hw.rate)} a year as great as 1859's` : "none as great as 1859's"}; ${count(ws.storms)} that burned grids, ${count(ws.dead)} dead after`,
      ),
    );
  }
  if (impacts) {
    const st = impacts.state;
    rows.push(
      stat(
        "The great stones",
        st.fell || st.turned
          ? `${count(st.fell)} fallen, ${count(st.turned)} turned aside, ${count(st.dead)} dead`
          : "none fallen or turned aside yet",
      ),
    );
  }
  if (orbitalOf(world))
    rows.push(
      stat(
        "Works in the sky",
        works.length
          ? `${many(works.length, "realm's", "realms'")}, ${tonnes(works.reduce((n, w) => n + w.tonnes, 0))}`
          : "none yet",
      ),
    );
  if (writtenOf(world))
    rows.push(
      stat(
        "Bodies written for their worlds",
        written.length ? `by ${many(written.length, "realm", "realms")}` : "none yet",
      ),
    );
  if (upliftOf(world))
    rows.push(
      stat(
        "Beasts raised to thought",
        raised.length
          ? `${count(raised.length)}, ${count(raised.reduce((n, x) => n + x.founders, 0))} set down`
          : "none yet",
      ),
    );
  if (minds)
    rows.push(
      stat(
        "Minds past their makers",
        mindRows.length
          ? `in ${many(mindRows.length, "realm", "realms")}; ${count(minds.up)} people gone up into them`
          : "none yet",
      ),
    );
  if (!rows.length) return [];
  const blocks: Block[] = [{ type: "facts", title: "The world beyond", rows }];
  // Realm by realm, past the ages.
  const by = new Map<
      string,
      { works: number; minds: number | null; written: number | null; raised: number }
    >(),
    at = (r: string) => {
      let v = by.get(r);
      if (!v) by.set(r, (v = { works: 0, minds: null, written: null, raised: 0 }));
      return v;
    };
  for (const w of works) at(w.realm).works += w.tonnes;
  for (const m of mindRows) at(m.realm).minds = m.past;
  for (const w of written) at(w.realm).written = w.year;
  for (const x of raised) at(x.realm).raised++;
  if (by.size)
    blocks.push({
      type: "table",
      title: "Past the ages, realm by realm",
      columns: ["Realm", "Works in the sky", "Its minds", "Bodies written", "Beasts raised"],
      fit: true,
      rows: [...by]
        .sort((a, b) => b[1].works - a[1].works || (a[0] < b[0] ? -1 : 1))
        .map(([ref, v]) => ({
          ref,
          cells: [
            [realmLink(world, ref)],
            [v.works ? tonnes(v.works) : "none"],
            [
              v.minds === null
                ? "none"
                : v.minds >= 0
                  ? `${times(10 ** (v.minds / 100))} times their makers`
                  : `one in ${count(10 ** (-v.minds / 100))} of their makers`,
            ],
            [v.written === null ? "none" : `since ${v.written}`],
            [count(v.raised)],
          ],
          keys: [seatName(world, ref), v.works, v.minds ?? -1e9, v.written ?? 0, v.raised],
        })),
    });
  return blocks;
}

// —— Making ——————————————————————————————————————————————————————————————————————————————————————————————

/** Each kind of way, in a word for its realm's row. */
const KIND_WORDS: Readonly<Record<string, string>> = {
  treatment: "treated edges",
  alloy: "alloys",
  ceramic: "ceramics",
  binder: "binders",
  composite: "composites",
  polymer: "polymers",
  crystal: "pure crystal",
  magnet: "magnets",
  lossless: "lossless wire",
};

/** Realm by realm, the ways its lands make, its hottest fire, its purity and the work it turns; and each way, where it is made. */
export function makingLedger(world: World, lc: LedgerCtx): Block[] {
  const store = materialsOf(world),
    books = energyBooks(world),
    lands = store?.all() ?? [],
    made = lands.filter((m) => m.made > 0);
  const blocks: Block[] = [];
  if (!made.length) blocks.push(...honest("No realm makes a material way of its own yet."));
  // Each way: the realms and lands that make it, and the first year it was made.
  const realms = world.hasStore("polity.states") ? politiesOf(world) : null,
    ways = MATERIAL_WAYS.map(() => ({ lands: 0, realms: new Set<string>(), first: 0 }));
  for (const m of made)
    MATERIAL_WAYS.forEach((_, i) => {
      if (!(m.made & (1 << i))) return;
      const w = ways[i]!,
        y = m.years[i] ?? 0;
      w.lands++;
      const r = realms?.of(m.cell);
      if (r && r.ended === null) w.realms.add(r.ref);
      if (y > 0 && (w.first === 0 || y < w.first)) w.first = y;
    });
  // Realm by realm.
  const ctx = lc.standing.length ? populationContext(world) : null,
    rows = lc.standing.map((r) => {
      let bits = 0,
        purity = 0,
        making = 0,
        newest = -1,
        newestYear = 0,
        work = 0,
        heads = 0;
      const by = new Array<number>(SOURCES.length).fill(0);
      for (const c of r.members) {
        const m = store?.get(c);
        if (m) {
          if (m.made) making++;
          bits |= m.made;
          purity = Math.max(purity, m.purity);
          MATERIAL_WAYS.forEach((_, i) => {
            const y = m.made & (1 << i) ? (m.years[i] ?? 0) : 0;
            if (y > newestYear) {
              newestYear = y;
              newest = i;
            }
          });
        }
        const e = books?.get(c);
        if (e && e.people > 0) {
          heads += e.people;
          e.by.forEach((x, i) => {
            by[i] = by[i]! + x;
            work += x;
          });
        }
      }
      let drives: Source = "none",
        most = 0;
      SOURCES.forEach((s, i) => {
        if (s !== "none" && by[i]! > most) {
          most = by[i]!;
          drives = s;
        }
      });
      const ways = MATERIAL_WAYS.filter((_, i) => bits & (1 << i)),
        kinds = [...new Set(ways.map((w) => KIND_WORDS[w.cls] ?? w.cls))];
      return {
        r,
        ways: ways.length,
        kinds,
        newest: newest >= 0 ? MATERIAL_WAYS[newest]! : null,
        newestYear,
        making,
        nines: purity / 100,
        heat: ctx ? Math.round(makingHeat(ctx, r.seat)) : 0,
        work: heads > 0 ? work / heads : null,
        drives,
      };
    });
  const read = [...rows].sort(
      (a, b) => b.ways - a.ways || b.heat - a.heat || (a.r.ref < b.r.ref ? -1 : 1),
    ),
    shown = read.slice(0, LEDGER_ROWS);
  if (made.length)
    blocks.push(
      allTold([
        stat(
          "Ways made somewhere",
          `${count(ways.filter((w) => w.lands > 0).length)} of ${count(MATERIAL_WAYS.length)}`,
        ),
        stat("Lands making a way of their own", count(made.length)),
        stat(
          "The purest refining",
          `${(Math.max(...made.map((m) => m.purity)) / 100).toFixed(1)} nines`,
        ),
      ]),
    );
  if (shown.length)
    blocks.push({
      type: "table",
      title: "What each makes, and its fire",
      columns: [
        "Realm",
        "Ways",
        "Of kinds",
        "Newest",
        "Hottest fire",
        "Purity",
        "Work a head",
        "Driven by",
      ],
      rows: shown.map((x) => ({
        ref: x.r.ref,
        cells: [
          [realmLink(world, x.r.ref)],
          [x.ways ? `${count(x.ways)} in ${many(x.making, "land", "lands")}` : "none"],
          [x.kinds.join(", ") || "—"],
          [x.newest ? `${x.newest.name} (${x.newestYear})` : "—"],
          [x.heat > 0 ? `${count(x.heat)} °C` : "no fire"],
          [x.nines > 0 ? `${x.nines.toFixed(1)} nines` : "—"],
          [x.work === null ? "—" : `${x.work.toFixed(2)} kW`],
          [x.work === null ? "—" : SOURCE_WORDS[x.drives]],
        ],
        keys: [
          x.r.town,
          x.ways,
          x.kinds.length,
          x.newestYear,
          x.heat,
          x.nines,
          x.work ?? -1,
          x.drives,
        ],
      })),
    });
  blocks.push(...listedOf(shown.length, read.length, "realms that make the most"));
  if (made.length)
    blocks.push({
      type: "table",
      title: "Each way, where it is made",
      columns: ["Way", "Kind", "Realms", "Lands", "First made"],
      fit: true,
      rows: MATERIAL_WAYS.map((w, i) => ({ w, n: ways[i]! }))
        .filter(({ n }) => n.lands > 0)
        .sort((a, b) => b.n.lands - a.n.lands || (a.w.id < b.w.id ? -1 : 1))
        .map(({ w, n }) => ({
          cells: [
            [cap(w.name)],
            [KIND_WORDS[w.cls] ?? w.cls],
            [count(n.realms.size)],
            [count(n.lands)],
            [n.first ? `year ${n.first}` : "—"],
          ],
          keys: [w.name, w.cls, n.realms.size, n.lands, n.first],
        })),
    });
  blocks.push(
    ...mostLeastBlock([
      mostLeast(
        "Hottest fire",
        rows
          .filter((x) => x.heat > 0)
          .map((x): Ranked => ({
            name: realmLink(world, x.r.ref),
            value: x.heat,
            said: `${count(x.heat)} °C`,
          })),
      ),
      mostLeast(
        "Purest",
        rows
          .filter((x) => x.nines > 0)
          .map((x): Ranked => ({
            name: realmLink(world, x.r.ref),
            value: x.nines,
            said: `${x.nines.toFixed(1)} nines`,
          })),
      ),
      mostLeast(
        "Most work a head",
        rows.flatMap((x): Ranked[] =>
          x.work === null
            ? []
            : [{ name: realmLink(world, x.r.ref), value: x.work, said: `${x.work.toFixed(2)} kW` }],
        ),
      ),
    ]),
  );
  return blocks;
}
