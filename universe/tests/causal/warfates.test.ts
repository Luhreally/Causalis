import { test } from "node:test";
import assert from "node:assert/strict";
import { YEAR, seedFromText, type Ref, type World } from "../../src/kernel/index.ts";
import { MALE, bandOf, fellRows, unpackTowns, type LandFell } from "../../src/rules/index.ts";
import {
  fighting,
  makePopulationWorld,
  poolOf,
  populationContext,
  warsOf,
  type Battle,
} from "../../src/sim/index.ts";
import {
  LIFE_WORDS,
  MEMORY_WORDS,
  WAR_PAST_YEARS,
  deepen,
  meetHousehold,
  observer,
  residence,
  settleAll,
  warClaimKey,
  warClaimLimit,
  why,
  type Person,
  type WarFate,
} from "../../src/causal/index.ts";
import { warFronts } from "../../src/causal/warfates.ts";

// Phase 55 M225: the men met go to war. A man met is drawn into his land's battles of the last
// thirty-nine years as one who came home; followed forward, he may fall. Every fate is claimed from
// the tally of the place he was sent from, within what history holds. One world: the first light,
// a hundred and twenty-five years on, as the game builds it (bands spread over the land: the cradle
// world of a single land has fought no battle by then).

const world = makePopulationWorld(seedFromText("first light"), { start: "spread" });
world.runTo(125 * YEAR);
const before = JSON.stringify(world.domainHashes()),
  ledger = observer(world),
  fresh = JSON.stringify(ledger.save()),
  ctx = populationContext(world),
  life = ctx.life,
  Y = Math.floor(world.now / YEAR),
  battles = new Map<string, { war: Ref; b: Battle }>();
/** Every battle of history by its event (again as the world runs on). */
function indexBattles(): void {
  battles.clear();
  for (const w of warsOf(world).all())
    for (const b of w.battles) battles.set(b.event, { war: w.ref, b });
}
indexBattles();

/** The 30 towns that sent the most men to the battles of the last 39 years (most first). */
const towns = (() => {
  const sent = new Map<string, number>();
  for (const { b } of battles.values()) {
    if (!b.fell || b.year < Y - 39) continue;
    for (const side of [0, 1] as const)
      for (const r of fellRows(b.fell[side])) {
        const s = r.town === null ? undefined : ctx.settlements.inProvince(r.cell)[r.town];
        if (s) sent.set(s.ref, (sent.get(s.ref) ?? 0) + r.sent);
      }
  }
  return [...sent.entries()]
    .sort((a, b) => b[1] - a[1] || (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0))
    .slice(0, 30)
    .map(([ref]) => ctx.settlements.get(ref as Ref)!);
})();

/** Meet up to four households in each town, in order; everyone met, in the order met. */
function meetAll(): Person[] {
  const met: Person[] = [];
  for (const v of towns)
    for (let k = 0; k < 4; k++) {
      try {
        for (const r of meetHousehold(world, v.cell, v.ref).members) met.push(ledger.person(r)!);
      } catch {
        // Everyone there has been met.
      }
    }
  return met;
}

/** The land's tally a fate was drawn from, and the place within it (its town, its countryside, the land whole). */
function placeOf(w: WarFate): { land: LandFell; place: number | "c" | "l" } {
  const b = battles.get(w.event)?.b,
    land = b?.fell?.[w.side].find((l) => l[0] === w.cell);
  assert.ok(land, `${w.event}: its side ${w.side} has no tally of ${w.cell}`);
  return { land, place: w.town ?? (land[4] === undefined ? "l" : "c") };
}

/** Every claim is within what history holds; each place's met are within its lot; each fate holds its claims. */
function assertWithinHistory(label: string): void {
  for (const [key, n] of ledger.allClaims()) {
    const [kind, a, b, c] = key.split(":");
    let limit: number;
    if (kind === "c") limit = ctx.provinces.get(Number(a))!.counts.get(Number(b), Number(c));
    else if (kind === "v") limit = ctx.settlements.get(`${a}:${b}:${c}` as Ref)!.population;
    else if (kind === "b") limit = ctx.history.birthsIn(Number(a), Number(b));
    else if (kind === "d") limit = ctx.history.deathsIn(Number(a), Number(b), Number(c));
    else if (kind === "f") limit = ctx.history.flowAt(Number(a))!.count;
    else if (kind === "l" || kind === "w" || kind === "h") limit = warClaimLimit(world, key);
    else throw new Error(`unknown claim ${key}`);
    assert.ok(n <= limit, `${label}: ${key}: ${n} claimed of ${limit}`);
    if (kind === "l") {
      // Those met who came home whole are no more than the place's men who did.
      const rest = key.slice(2),
        w = ledger.claimed(`w:${rest}`),
        h = ledger.claimed(`h:${rest}`),
        whole =
          warClaimLimit(world, key) -
          warClaimLimit(world, `w:${rest}`) -
          warClaimLimit(world, `h:${rest}`);
      assert.ok(
        n - w - h <= whole,
        `${label}: ${key}: ${n - w - h} met came home whole of ${whole}`,
      );
    }
  }
  // Each fate is one claim on its place: a levy, and a death or a wound where it was one.
  const held = new Map<string, number>();
  for (const p of ledger.persons.values())
    for (const w of p.wars ?? []) {
      const { place } = placeOf(w),
        keys = [warClaimKey("l", w.event, w.side, w.cell, place)];
      if (w.fate === "fell") keys.push(warClaimKey("w", w.event, w.side, w.cell, place));
      if (w.fate === "hurt" || w.fate === "maimed")
        keys.push(warClaimKey("h", w.event, w.side, w.cell, place));
      for (const k of keys) held.set(k, (held.get(k) ?? 0) + 1);
    }
  for (const [key, n] of ledger.allClaims())
    if (/^[lwh]:/.test(key)) assert.equal(held.get(key) ?? 0, n, `${label}: ${key} held by fates`);
  for (const [key, n] of held) assert.equal(ledger.claimed(key), n, `${label}: ${key} claimed`);
}

/** A land's people in a year, by its yearly ledger (the last year at or before it). */
function peopleAt(cell: number, year: number): number {
  const years = ctx.history.yearsOf(cell);
  for (let i = years.length - 1; i >= 0; i--)
    if (years[i]!.year <= year) return Math.max(1, years[i]!.population);
  return Math.max(1, ctx.provinces.get(cell)?.total() ?? 1);
}

const met = meetAll();

test("veterans: the men met came home from their land's battles, levied by its share", () => {
  assert.ok(met.length >= 200, `met ${met.length}`);
  const veterans = met.filter((p) => p.wars?.length);
  assert.ok(veterans.length > 0, "some of the men met went to war");
  for (const p of veterans) {
    assert.equal(p.sex, MALE, `${p.ref} went to war`);
    assert.ok(p.alive);
    for (const w of p.wars!) {
      assert.notEqual(w.fate, "fell", `${p.ref} was met alive`);
      const age = w.year - p.birthYear;
      assert.ok(age >= life.adulthood && fighting(life, bandOf(age, life)), `${p.ref} at ${age}`);
      assert.ok(w.year >= Y - WAR_PAST_YEARS && w.year < Y, `${p.ref} in ${w.year}`);
      assert.equal(WAR_PAST_YEARS, 39);
      const known = battles.get(w.event)!;
      assert.equal(known.war, w.war);
      assert.equal(known.b.year, w.year);
      assert.equal(known.b.land, w.land);
      assert.equal(residence(p, w.year), w.cell, `${p.ref} lived in ${w.cell} in ${w.year}`);
      if (w.town !== null) {
        assert.equal(ctx.settlements.inProvince(w.cell)[w.town]?.ref, p.village);
        assert.ok(!p.moves.some((m) => m.year > w.year), "he lived in his town then");
      }
    }
  }
  // Levied as his land sent its fighting men: of the fronts a man met could have gone to, about
  // the share each land sent (its sent, of its people then by the share of them who fight now).
  const byYear = new Map<number, Battle[]>();
  for (const { b } of battles.values())
    if (b.fell) byYear.set(b.year, [...(byYear.get(b.year) ?? []), b]);
  let chances = 0,
    levied = 0;
  for (const p of met) {
    if (p.sex !== MALE) continue;
    for (let y = Math.max(Y - WAR_PAST_YEARS, p.birthYear + life.adulthood); y < Y; y++) {
      const age = y - p.birthYear;
      if (!fighting(life, bandOf(age, life))) continue;
      const cell = residence(p, y);
      for (const b of byYear.get(y) ?? []) {
        for (const side of [0, 1] as const) {
          const land = b.fell![side].find((l) => l[0] === cell);
          if (!land) continue;
          // His place's men sent: his town's, else his land's countryside's (the land's whole, its towns let go).
          const v = p.village ? ctx.settlements.get(p.village) : undefined,
            k =
              v && v.cell === cell && v.founded <= y && !p.moves.some((m) => m.year > y)
                ? ctx.settlements.inProvince(cell).findIndex((s) => s.ref === v.ref)
                : -1,
            towns = land[4] === undefined ? null : unpackTowns(land[4]),
            sent = !towns
              ? land[1]
              : k >= 0
                ? (towns[k]?.[0] ?? 0)
                : land[1] - towns.reduce((n, t) => n + t[0], 0);
          if (sent <= 0) continue;
          const total = ctx.provinces.get(cell)!.total(),
            men = Math.max(1, Math.round((peopleAt(cell, y) * poolOf(ctx, cell, y).men) / total));
          chances += Math.min(1, land[1] / men);
          if (p.wars?.some((w) => w.event === b.event)) levied++;
        }
      }
    }
  }
  assert.ok(chances > 50, `${chances} men expected levied`);
  assert.ok(
    Math.abs(levied / chances - 1) <= 0.25,
    `${levied} levied, ${chances.toFixed(1)} expected`,
  );
});

test("claims within history", () => {
  assertWithinHistory("met");
  assert.ok(
    ledger.allClaims().some(([key]) => key.startsWith("l:")),
    "the levied claim their places",
  );
});

test("looking changes no history", () => {
  assert.equal(JSON.stringify(world.domainHashes()), before);
});

test("the same meeting draws the same wars", () => {
  const wars = (people: readonly Person[]) =>
    JSON.stringify(people.map((p) => [p.seq, p.wars ?? null]));
  const first = wars(met);
  ledger.load(JSON.parse(fresh));
  const again = meetAll();
  assert.equal(again.length, met.length);
  assert.equal(wars(again.map((p) => ledger.person(p.ref)!)), first);
  assert.equal(JSON.stringify(world.domainHashes()), before);
});

test("old saves send no one: battles with no record of their men give no fronts", () => {
  const old = warsOf(world)
      .all()
      .map((w) => ({
        ...w,
        battles: w.battles.map((b) => {
          const { fell, ...bare } = b;
          void fell;
          return bare;
        }),
      })),
    oldWorld = {
      storeNames: () => ["war.wars"],
      store: () => ({ all: () => old }),
    } as unknown as World;
  assert.ok(warFronts(world, Y - WAR_PAST_YEARS, Y).byYear.size > 0);
  assert.equal(warFronts(oldWorld, 0, Y + 1).byYear.size, 0);
  for (const [key] of ledger.allClaims())
    if (/^[lwh]:/.test(key)) assert.equal(warClaimLimit(oldWorld, key), 0, key);
});

test("their wars go on: the levy, the fallen, the wounded, as the years pass", () => {
  world.runTo((Y + 15) * YEAR);
  settleAll(world);
  indexBattles();
  const people = [...ledger.persons.values()],
    later = people.flatMap((p) => (p.wars ?? []).filter((w) => w.year >= Y).map((w) => ({ p, w })));
  assert.ok(later.length > 0, "the men met went to their land's battles after they were met");
  for (const { p, w } of later) {
    const age = w.year - p.birthYear;
    assert.ok(age >= life.adulthood && fighting(life, bandOf(age, life)), `${p.ref} at ${age}`);
    assert.equal(residence(p, w.year), w.cell, `${p.ref} lived in ${w.cell} in ${w.year}`);
    if (w.fate === "fell") {
      assert.equal(p.alive, false, `${p.ref} fell`);
      assert.equal(p.diedYear, w.year);
      assert.equal(p.wars!.at(-1), w, "his last battle");
      assert.ok(ledger.claimed(`d:${w.cell}:${w.year}:${bandOf(age, life)}`) > 0, "his death");
    }
  }
  assertWithinHistory("fifteen years on");
  // A life told cites its battles, in words the pages know.
  const told = people.filter((p) => p.wars?.length).slice(0, 25);
  for (const p of told) {
    deepen(world, p);
    for (const w of p.wars!) {
      const kind = {
        stood: "went-to-war",
        hurt: "wounded-in-battle",
        maimed: "maimed-in-battle",
        fell: "fell-in-battle",
      }[w.fate];
      assert.ok(
        p.life!.some((l) => l.year === w.year && l.kind === kind && l.event === w.event),
        `${p.ref}: ${kind} in ${w.year}`,
      );
      assert.ok(LIFE_WORDS[kind] && MEMORY_WORDS[kind], kind);
      // Each can be asked why, in words: the battle, and the war behind it.
      const node = why(world, w.event);
      assert.notEqual(node.basis, "unknown", node.claim);
      assert.doesNotMatch(node.claim, /\(t=\d+\)/, "said in words");
    }
    for (const m of p.memories ?? [])
      if (/war|battle/.test(m.kind))
        assert.ok(why(world, m.ref).claim.includes(MEMORY_WORDS[m.kind]!), m.kind);
  }
  assert.ok(told.length > 0);
  assert.ok(
    told.some((p) => p.memories?.some((m) => /war|battle/.test(m.kind))),
    "a battle is remembered",
  );
});

test("one battle a man a turn: no man met went to two battles of one year", () => {
  // (A year's battles are all fought at its turn: met after it or followed through it, a man went
  // to one of them.)
  let men = 0;
  for (const p of ledger.persons.values()) {
    const years = (p.wars ?? []).map((w) => w.year);
    if (years.length) men++;
    assert.equal(new Set(years).size, years.length, `${p.ref}: ${years.join(", ")}`);
  }
  assert.ok(men > 0, "some went to war");
});
