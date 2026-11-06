// node tools/h1-tally.ts <universe> <seed> [--save file.save] [--young year] [--towns n] [--years n]: a town asked (H1), by force, over a world's towns:
// what is offered by world and age, the answers and why, how long a thing takes against its size and hands, what it took out of the stores, what food and people
// did after against the same land unasked, whether a raised thing stands through a save and a year's plan, and that words read clean.
import { readFileSync } from "node:fs";
import { gunzipSync } from "node:zlib";
import {
  YEAR,
  loadWorld,
  rulesetId,
  saveWorld,
  seedFromText,
  type World,
} from "../src/kernel/index.ts";
import { ALIEN, EARTH } from "../src/host/planet.ts";
import { askPage, townOffers } from "../src/host/inspect/asks.ts";
import { townPlan } from "../src/host/town.ts";
import {
  asksOf,
  effortOf,
  politiesOf,
  populationContext,
  spaceOf,
  townsOf,
  warsOf,
  type Ask,
} from "../src/sim/index.ts";
import { G, principle } from "../src/rules/index.ts";
import { colonyTownRef } from "../src/host/colony.ts";
import { marketsOf, loreOf } from "../src/sim/index.ts";

const argv = process.argv.slice(2),
  arg = (name: string) => {
    const at = argv.indexOf(name);
    return at >= 0 ? argv[at + 1] : undefined;
  },
  uni = (argv[0] ?? "earth") as "earth" | "alien",
  seed = argv[1] ?? "first light",
  file = arg("--save"),
  young = Number(arg("--young") ?? 300),
  most = Number(arg("--towns") ?? 60),
  runYears = Number(arg("--years") ?? 6),
  U = uni === "earth" ? EARTH : ALIEN,
  BAD = /undefined|NaN|\[object|\bnull\b|\b(ev|pol|war|cell):\d/;

const open = (): World => {
  if (file) {
    const doc = JSON.parse(gunzipSync(readFileSync(file)).toString("utf8"));
    return loadWorld(
      doc,
      (s) => U.build(s),
      rulesetId(U.build(seedFromText(doc.seed)), U.version),
      {
        allowRulesetChange: true,
      },
    ).world;
  }
  const w = U.build(seedFromText(seed));
  w.runTo(young * YEAR);
  return w;
};

const said = (v: unknown): string =>
  typeof v === "string"
    ? v
    : Array.isArray(v)
      ? v.map(said).join("")
      : v && typeof v === "object" && "text" in v
        ? String((v as { text: unknown }).text)
        : "";
const pageText = (world: World, ref: string): string => {
  const p = askPage(world, ref);
  return [
    p.title,
    said(p.subtitle),
    ...p.tabs[0]!.blocks.flatMap((b) => {
      const block = b as { title?: string; lines?: unknown[] };
      return [block.title ?? "", ...(block.lines ?? []).map(said)];
    }),
  ].join(" | ");
};

const world = open(),
  ctx = populationContext(world),
  y0 = Math.floor(world.now / YEAR);
console.log(`${uni} ${seed} at year ${y0}`);

// What's offered: over a spread of towns, small to great.
const towns = [...ctx.settlements.all()]
    .filter((s) => s.population > 0 && ctx.settlements.held(s.ref))
    .sort((a, b) => b.population - a.population),
  step = Math.max(1, Math.floor(towns.length / most)),
  spread = towns.filter((_, i) => i % step === 0).slice(0, most),
  firstOf = new Map<string, number>(),
  raiseOf = new Map<string, number>(),
  noOf = new Map<string, number>();
let none = 0;
const sets = new Set<string>();
for (const s of spread) {
  const o = townOffers(world, s.ref)!;
  if (!o.raises.length) none++;
  sets.add(o.raises.map((r) => r.what).join(","));
  for (const r of o.firsts) firstOf.set(r.what, (firstOf.get(r.what) ?? 0) + 1);
  for (const r of o.raises) raiseOf.set(r.what, (raiseOf.get(r.what) ?? 0) + 1);
  for (const r of o.no) noOf.set(`${r.name}: ${r.why}`, (noOf.get(`${r.name}: ${r.why}`) ?? 0) + 1);
}
const show = (m: Map<string, number>) =>
  [...m]
    .sort((a, b) => b[1] - a[1])
    .map(([k, n]) => `${k} ${n}`)
    .join(", ");
console.log(
  `towns ${towns.length}, read ${spread.length} (greatest ${spread[0]?.population}, least ${spread.at(-1)?.population})`,
);
console.log(`  first: ${show(firstOf)}`);
console.log(
  `  raise: ${show(raiseOf)}  (no raise offered: ${none}; different lists: ${sets.size})`,
);
console.log(`  not offered: ${show(noOf)}`);

// A baseline, the same world unasked: its food and people on the lands we ask, by year.
const base = open(),
  bctx = populationContext(base),
  lands = new Set<number>();
// Force: each town asked one raise and one priority, the first its list has.
const answers = new Map<string, number>(),
  whys = new Map<string, number>(),
  pick = spread.slice(0, Math.min(most, spread.length)),
  ids: Ask[] = [];
let bad = 0;
const clean = (where: string, text: string) => {
  if (BAD.test(text)) {
    bad++;
    console.log(`  BAD WORDS (${where}): ${text.slice(0, 300)}`);
  }
};
let sampleN = 0;
for (const [i, s] of pick.entries()) {
  const o = townOffers(world, s.ref)!;
  if (o.shut) continue;
  const r = o.raises[i % Math.max(1, o.raises.length)],
    f = o.firsts[(i * 3) % Math.max(1, o.firsts.length)];
  for (const a of [r, f]) {
    if (!a) continue;
    try {
      world.submit("town.ask", { village: s.ref, kind: a.kind, what: a.what });
    } catch (e) {
      console.log(`  refused by validate: ${s.name} ${a.what}: ${(e as Error).message}`);
    }
  }
  lands.add(s.cell);
}
// (Commands come in at the next step: a month of the clock.)
world.runTo(world.now + 1);
for (const a of asksOf(world).all()) {
  ids.push(a);
  answers.set(a.answer, (answers.get(a.answer) ?? 0) + 1);
  for (const [c] of a.why) whys.set(c, (whys.get(c) ?? 0) + 1);
  const t = pageText(world, `ask:${a.town}:${a.n}`);
  clean(`ask ${a.town}`, t);
  if (sampleN++ < 6) console.log(`  page: ${t.slice(0, 1700)}`);
}
console.log(`asked ${ids.length}: answers ${show(answers)}`);
console.log(`  why: ${show(whys)}`);
// Run on, a site at a time.
const t0 = world.now,
  takes: { what: string; hands: number; effort: number; months: number; town: number }[] = [];
for (let m = 1; m <= runYears * 12; m++) {
  world.runTo(t0 + (m * YEAR) / 12);
  base.runTo(t0 + (m * YEAR) / 12);
}
for (const a of ids) {
  const w = a.work;
  if (!w) continue;
  if (w.done !== null)
    takes.push({
      what: a.what,
      hands: w.hands,
      effort: w.effort,
      months: (w.done - a.t) / (YEAR / 12),
      town: a.people,
    });
}
takes.sort((a, b) => a.months - b.months);
const open2 = ids.filter((a) => a.work && a.work.done === null && !a.work.left),
  left = ids.filter((a) => a.work?.left),
  stopped = ids.filter((a) => a.work?.stops.length);
console.log(
  `after ${runYears} years: ${takes.length} finished, ${open2.length} still rising, ${left.length} given up, ${stopped.length} ever stopped`,
);
for (const t of [takes[0], takes[Math.floor(takes.length / 2)], takes.at(-1)])
  if (t)
    console.log(
      `  ${t.what} in ${t.months.toFixed(1)} months, ${t.hands} hands of a town of ${t.town}, ${t.effort} person-months`,
    );
if (takes.length)
  console.log(
    `  least ${takes[0]!.months.toFixed(1)} months: nothing the same day: ${takes[0]!.months >= 1}`,
  );
const food = ids.reduce((n, a) => n + (a.work?.food ?? 0), 0),
  tools = ids.reduce((n, a) => n + (a.work?.tools ?? 0), 0);
console.log(`  took ${food} measures of food, ${tools} of tools`);
// Words after.
for (const a of ids.slice(0, 80)) clean(`after ${a.town}`, pageText(world, `ask:${a.town}:${a.n}`));
// Food and people on those lands, against the same world unasked.
let peopleA = 0,
  peopleB = 0,
  fedA = 0,
  fedB = 0,
  n = 0,
  worst = 0;
for (const cell of lands) {
  const a = ctx.provinces.get(cell),
    b = bctx.provinces.get(cell);
  if (!a || !b) continue;
  peopleA += a.total();
  peopleB += b.total();
  const ra = ctx.history.yearsOf(cell).at(-1),
    rb = bctx.history.yearsOf(cell).at(-1);
  if (ra && rb) {
    fedA += ra.fed;
    fedB += rb.fed;
    n++;
    worst = Math.min(worst, ra.fed - rb.fed);
  }
}
console.log(
  `lands asked ${lands.size}: people ${peopleA} against ${peopleB} unasked (${((peopleA / Math.max(1, peopleB) - 1) * 100).toFixed(2)}%); fed ${(fedA / Math.max(1, n) / 10).toFixed(1)} against ${(fedB / Math.max(1, n) / 10).toFixed(1)} in a hundred; worst land ${(worst / 10).toFixed(1)} points`,
);
// A forced lean test: a town told to put walls or faith first, its land's fed before and after, against unasked: the greatest share.
const small = [...lands]
  .map((cell) => ({ cell, share: ids.find((a) => a.cell === cell)?.share ?? 0 }))
  .sort((a, b) => b.share - a.share)[0];
if (small) {
  const a = ctx.history
      .yearsOf(small.cell)
      .slice(-4)
      .map((r) => Math.round(r.fed / 10)),
    b = bctx.history
      .yearsOf(small.cell)
      .slice(-4)
      .map((r) => Math.round(r.fed / 10));
  console.log(
    `  a land whose town is ${small.share / 10}% of it: fed ${a.join(" ")} against ${b.join(" ")} unasked`,
  );
}

// A save half way through, a raised thing through a save and a plan.
const midDoc = JSON.parse(
    JSON.stringify(saveWorld(world, rulesetId(world, U.version), { universe: U.name })),
  ),
  back = loadWorld(midDoc, (s) => U.build(s), rulesetId(world, U.version)).world,
  hashA = world.checkpoint(world.now).chain,
  hashB = back.checkpoint(back.now).chain;
console.log(
  `save and load: asks ${asksOf(back).all().length} of ${ids.length}, open ${asksOf(back).open.length}; hash same: ${hashA === hashB}`,
);
let stands = 0,
  misses = 0;
for (const a of asksOf(back).all()) {
  if (!a.work || a.work.left) continue;
  const plan = townPlan(back, a.town, 0, 4000),
    drawn =
      a.what === "walls"
        ? !!plan?.walls?.asked
        : !!plan?.civics.some((c) => c.asked?.ref === `ask:${a.town}:${a.n}`);
  if (drawn) stands++;
  else {
    const f = townsOf(back).get(a.town);
    if ((f?.next ?? 0) <= 4000) {
      misses++;
      console.log(`  not in its plan: ${a.town} ${a.what} at ${a.work.at} of ${f?.next}`);
    }
  }
}
console.log(`in a plan read after loading: ${stands}, missing ${misses}`);
back.runTo(back.now + YEAR + 1);
world.runTo(world.now + YEAR + 1);
console.log(
  `run on a year after loading: hash same: ${world.checkpoint(world.now).chain === back.checkpoint(back.now).chain}`,
);
console.log(`bad words: ${bad}`);

// —— The paths nobody watches, each forced on a world of its own, and read aloud. ——————————————————
const force = argv.includes("--force");
if (force) {
  const allOf = (w: World) =>
    [...populationContext(w).settlements.all()]
      .filter((s) => s.population > 0 && populationContext(w).settlements.held(s.ref))
      .sort((a, b) => a.population - b.population);
  const fresh = () => open();
  const ask = (w: World, ref: string, kind: string, what: string): string | null => {
    try {
      w.runTo(w.submit("town.ask", { village: ref, kind, what }).t);
      const list = asksOf(w).ofTown(ref);
      return `ask:${ref}:${list.length - 1}`;
    } catch (e) {
      return `no: ${(e as Error).message}`;
    }
  };
  const read = (w: World, ref: string, n = 900) => pageText(w, ref).slice(0, n);
  const anyRaise = (w: World, ref: string) => townOffers(w, ref)?.raises[0]?.what ?? null;
  const months = (w: World, n: number) => w.runTo(w.now + (n * YEAR) / 12);
  const pickTown = (w: World, ok: (s: ReturnType<typeof allOf>[number]) => boolean) =>
    allOf(w).find((s) => ok(s) && (townOffers(w, s.ref)?.raises.length ?? 0) > 0);
  const stated = (w: World, ref: string) => {
    const m = /^ask:(.+):(\d+)$/.exec(ref);
    if (!m) return ref;
    const a = asksOf(w).ofTown(m[1]!)[Number(m[2])]!;
    return `${a.what} ${a.answer} why ${a.why.map(([c, by]) => `${c}${by}`).join(",")}${a.work ? ` worked ${a.work.worked}/${a.work.effort} hands ${a.work.hands} stops ${a.work.stops.length} left ${a.work.left?.why ?? "no"} done ${a.work.done !== null}` : ""}`;
  };

  // A lean year: the leanest land's town told to put its walls, faith or trade first, against the same world unasked.
  {
    const w = fresh(),
      c = populationContext(w),
      y = Math.floor(w.now / YEAR);
    const sharing = allOf(w)
        .map((s) => ({
          s,
          rec: c.history.yearsOf(s.cell).at(-1),
          share: s.population / Math.max(1, c.provinces.get(s.cell)?.total() ?? 1),
        }))
        .filter((x) => x.rec),
      much = sharing.filter((x) => x.share >= 0.3),
      lean = (much.length ? much : sharing).sort((a, b) => a.rec!.fed - b.rec!.fed)[0];
    if (lean) {
      const o = townOffers(w, lean.s.ref)!,
        what =
          o.firsts.find((f) => !["food", "stores", "homes"].includes(f.what))?.what ??
          o.firsts.find((f) => f.what !== "food")?.what ??
          "food",
        ref = ask(w, lean.s.ref, "first", what)!;
      console.log(
        `  its town is ${Math.round(lean.share * 100)} in a hundred of its land; it was offered first: ${o.firsts.map((f) => f.what).join(",")}`,
      );
      console.log(
        `LEAN: ${lean.s.name}, fed ${lean.rec!.fed / 10} in a hundred, year ${y}: ${what}: ${stated(w, ref)}`,
      );
      const v = fresh();
      for (let i = 1; i <= 3; i++) {
        w.runTo((y + i) * YEAR + 1);
        v.runTo((y + i) * YEAR + 1);
      }
      const a = c.history.yearsOf(lean.s.cell).at(-1),
        b = populationContext(v).history.yearsOf(lean.s.cell).at(-1);
      console.log(
        `  three years on: fed ${(a?.fed ?? 0) / 10} against ${(b?.fed ?? 0) / 10} unasked; people on its land ${c.provinces.get(lean.s.cell)?.total()} against ${populationContext(v).provinces.get(lean.s.cell)?.total()}`,
      );
      console.log(`  page: ${read(w, ref, 1100)}`);
    } else console.log("LEAN: no land with a ledger");
  }

  // A town at war: a battle on its land, and walls and something else asked.
  {
    const w = fresh(),
      y = Math.floor(w.now / YEAR);
    let found: { ref: string; name: string } | null = null;
    const wars = warsOf(w).all();
    const cells = new Set<number>();
    for (const x of wars) for (const b of x.battles) if (b.year >= y - 3) cells.add(b.land);
    for (const s of allOf(w))
      if (cells.has(s.cell)) {
        found = { ref: s.ref, name: s.name };
        break;
      }
    if (found) {
      const r = anyRaise(w, found.ref),
        first = townOffers(w, found.ref)!.firsts.find(
          (f) => f.what === "arms" || f.what === "walls",
        )?.what,
        a1 = r ? ask(w, found.ref, "raise", r) : null,
        a2 = first ? ask(w, found.ref, "first", first) : null;
      console.log(
        `WAR: ${found.name}: ${a1 ? stated(w, a1) : "nothing to raise"} / ${a2 ? stated(w, a2) : "no arms or walls to put first"}`,
      );
      if (a1) console.log(`  page: ${read(w, a1)}`);
    } else console.log(`WAR: no battle on any land these three years, of ${wars.length} wars`);
  }

  // Razed half way: a site whose building comes down; a town shaken and burned as it goes up.
  {
    const w = fresh(),
      s = pickTown(w, (x) => x.population > 300);
    if (s) {
      const c0 = populationContext(w),
        r = [...townOffers(w, s.ref)!.raises].sort(
          (x, y) => effortOf(c0, s, y.what as never) - effortOf(c0, s, x.what as never),
        )[0]!.what,
        ref = ask(w, s.ref, "raise", r)!;
      months(w, 1);
      const before = stated(w, ref);
      w.runTo(w.submit("act.fire", { village: s.ref }).t);
      const a = asksOf(w).ofTown(s.ref).at(-1)!;
      // (The fire takes homes; a site comes down only with its building.)
      const f = townsOf(w).get(s.ref)!,
        c = f.civics.find((x) => x.at === a.work?.at && x.start === a.work?.start);
      if (c && c.fell === null) c.fell = Math.floor(w.now / YEAR);
      months(w, 2);
      console.log(
        `RAZED: ${s.name}: before ${before}; after the fire and its building down: ${stated(w, ref)}`,
      );
      console.log(`  page: ${read(w, ref)}`);
    } else console.log("RAZED: no town to ask");
  }

  // Taken half way: a ruler's asking, and the town no longer theirs.
  {
    const w = fresh(),
      s = pickTown(w, (x) => x.population > 300 && !!politiesOf(w).of(x.cell)),
      realm = s ? politiesOf(w).of(s.cell) : null;
    if (s && realm) {
      const r = anyRaise(w, s.ref)!;
      let ref: string;
      try {
        w.runTo(
          w.submit("town.ask", {
            village: s.ref,
            kind: "raise",
            what: r,
            by: { realm: realm.ref, ruler: "The ruler of that realm" },
          }).t,
        );
        ref = `ask:${s.ref}:${asksOf(w).ofTown(s.ref).length - 1}`;
      } catch (e) {
        ref = `no: ${(e as Error).message}`;
      }
      const a = asksOf(w).ofTown(s.ref).at(-1);
      months(w, 1);
      console.log(`  a month on, still theirs: ${stated(w, ref)}`);
      if (a && a.by) {
        // (A ruler's word lapses with their hold: the record of it says who.)
        (a as { by: { realm: string; ruler: string } }).by = {
          realm: "pol:0:999999",
          ruler: a.by.ruler,
        };
        months(w, 2);
      }
      console.log(`TAKEN: ${s.name}: ${stated(w, ref)}`);
      console.log(`  page: ${read(w, ref)}`);
    } else console.log("TAKEN: no realm's town to ask");
  }

  // Fallen empty half way.
  {
    const w = fresh(),
      s = pickTown(w, (x) => x.population > 300);
    if (s) {
      const r = anyRaise(w, s.ref)!,
        ref = ask(w, s.ref, "raise", r)!;
      months(w, 2);
      s.population = 0;
      months(w, 1);
      console.log(`EMPTY: ${s.name}: ${stated(w, ref)}`);
      console.log(`  page: ${read(w, ref)}`);
      s.population = 1;
    } else console.log("EMPTY: no town to ask");
  }

  // Half way through a build: saved, loaded, run on: the same as not having saved.
  {
    const w = fresh(),
      s = pickTown(w, (x) => x.population > 300);
    if (s) {
      const r = anyRaise(w, s.ref)!,
        ref = ask(w, s.ref, "raise", r)!;
      months(w, 2);
      const doc = JSON.parse(
          JSON.stringify(saveWorld(w, rulesetId(w, U.version), { universe: U.name })),
        ),
        b = loadWorld(doc, (x) => U.build(x), rulesetId(w, U.version)).world;
      const was = stated(b, ref);
      w.runTo(w.now + 3 * YEAR);
      b.runTo(b.now + 3 * YEAR);
      console.log(
        `HALF SAVED: ${s.name}: loaded at ${was}; on: ${stated(b, ref)}; same chain as the world never saved: ${w.checkpoints().at(-1)?.chain === b.checkpoints().at(-1)?.chain}`,
      );
    } else console.log("HALF SAVED: no town to ask");
  }

  // A save from before this rule: its store absent; asked, run on.
  if (file) {
    const doc = JSON.parse(gunzipSync(readFileSync(file)).toString("utf8")),
      had = !!(
        doc.stores &&
        (doc.stores["town.asks"] ??
          (Array.isArray(doc.stores) &&
            doc.stores.find?.((x: { name?: string }) => x.name === "town.asks")))
      );
    const w = fresh(),
      s = pickTown(w, (x) => x.population > 300);
    if (s) {
      const r = anyRaise(w, s.ref)!,
        ref = ask(w, s.ref, "raise", r)!;
      months(w, 30);
      console.log(
        `OLD SAVE: store in it: ${had}, ruleset ${doc.ruleset ?? "?"}: ${stated(w, ref)}`,
      );
    }
  } else console.log("OLD SAVE: run with --save");

  // The greatest town: what can be asked of it and what it says of it. A town of 400,000 on a far world.
  {
    const w = fresh(),
      all = allOf(w),
      near = all.reduce(
        (best, s) =>
          Math.abs(s.population - 400_000) < Math.abs(best.population - 400_000) ? s : best,
        all[0]!,
      ),
      o = townOffers(w, near.ref)!;
    console.log(
      `GREAT: ${near.name}, ${near.population}, ${townsOf(w).get(near.ref)?.next} lots: raise ${o.raises.map((r) => r.what).join(",")}; first ${o.firsts.map((r) => r.what).join(",")}; not ${o.no.map((n) => `${n.name}: ${n.why}`).join("; ")}`,
    );
    const r = o.raises[0]?.what ?? null,
      ref = r ? ask(w, near.ref, "raise", r) : null;
    if (ref) {
      console.log(`  ${stated(w, ref)}`);
      console.log(`  page: ${read(w, ref)}`);
    }
  }

  // No empty lot: a town whose every lot is taken: where it goes, and who loses a home.
  {
    const w = fresh(),
      s = pickTown(w, (x) => {
        const f = townsOf(w).get(x.ref);
        return !!f && f.open.length === 0 && f.next > 30;
      });
    if (s) {
      const f = townsOf(w).get(s.ref)!,
        lotsBefore = f.next,
        homesBefore = f.homes.reduce((a, b) => a + b, 0),
        r = anyRaise(w, s.ref)!,
        ref = ask(w, s.ref, "raise", r)!,
        a = asksOf(w).ofTown(s.ref).at(-1)!;
      console.log(
        `NO LOT: ${s.name}: no open lot, ${lotsBefore} lots, ${homesBefore} homes: ${stated(w, ref)}; at lot ${a.work?.at}; homes now ${f.homes.reduce((x, y) => x + y, 0)}; lots ${f.next}`,
      );
    } else console.log("NO LOT: every town here has an open lot");
  }

  // A colony: its town is kept by its land: the word doesn't reach it.
  {
    if (argv.includes("--colony")) {
      const ROAD = [
        "astronomy",
        "medicine",
        "steel",
        "engines",
        "electricity",
        "electronics",
        "rocketry",
        "guidance",
        "orbital-flight",
        "life-support",
        "stations",
        "transfer-flight",
        "habitats",
      ];
      const w = EARTH.build(seedFromText("first light"));
      w.runTo(80 * YEAR);
      const realm = [...politiesOf(w).living()].sort(
        (a, b) => b.members.length - a.members.length || (a.ref < b.ref ? -1 : 1),
      )[0]!;
      for (const id of ROAD)
        loreOf(w).learn(realm.seat, id, { year: 80, event: realm.event }, principle(id));
      marketsOf(w).of(realm.seat).move("made", G.machines, 60_000_000);
      spaceOf(w).program(realm.ref).station = realm.event;
      let y = 80;
      while (!spaceOf(w).of(realm.ref)!.colonies.length && y < 200) w.runTo(++y * YEAR);
      const cell = spaceOf(w).of(realm.ref)!.colonies[0]?.cell;
      if (cell === undefined) console.log("COLONY: none by year 200");
      else {
        w.runTo((y + 6) * YEAR);
        const ref = colonyTownRef(cell),
          o = townOffers(w, ref);
        console.log(
          `COLONY: ${ref}, year ${y + 6}: named ${o?.name}, shut: ${o?.shut}; raises ${o?.raises.length}, firsts ${o?.firsts.length}`,
        );
        try {
          w.submit("town.ask", { village: ref, kind: "first", what: "food" });
          console.log("  the command went through!");
        } catch (e) {
          console.log(`  refused: ${(e as Error).message}`);
        }
      }
    } else console.log("COLONY: run with --colony");
  }

  // A band's camp: not a settlement: a page of its own, and nothing here asks it. The least settlement: what it offers.
  {
    const w = fresh(),
      least = allOf(w)[0],
      o = least ? townOffers(w, least.ref) : null;
    console.log(
      `CAMP: the least town now: ${least?.name}, ${least?.population}: raise ${o?.raises.map((r) => r.what).join(",") || "nothing"}; first ${o?.firsts.map((r) => r.what).join(",")}; not: ${o?.no.map((n) => `${n.name}: ${n.why}`).join("; ")}`,
    );
    try {
      w.submit("town.ask", { village: "band:0:0", kind: "first", what: "food" });
      console.log("  a band's ref went through!");
    } catch (e) {
      console.log(`  asked by a band's ref: refused: ${(e as Error).message}`);
    }
  }
}
process.exit(0);
