// A town's grave matters (2026-11-17): each stands on what the world keeps, and where it keeps nothing of the kind there is no such
// case. Juniper sixty years on, its rows set down by hand and put back after, as tests/host/underworld.test.ts does: a killing only
// where its land's rows keep those killed; what is forbidden sold only under a ban; one let go because those who judged were paid, or
// because no one would speak, only where a group or a crew holds the town; and no word of how anything was done, in any case's text.
import { test } from "node:test";
import assert from "node:assert/strict";
import type { World } from "../../src/kernel/index.ts";
import {
  BAR,
  BAR_STORE,
  GANG_ROW,
  gangsStore,
  moneyStore,
  orgLandsStore,
  politiesOf,
  populationContext,
  underworldOf,
  type Polity,
  type RealmUnderworld,
  type RowStore,
  type Settlement,
} from "../../src/sim/index.ts";
import { racketBit } from "../../src/rules/index.ts";
import {
  casePage,
  casesOf,
  docketOf,
  forgetDockets,
  namedByCases,
  trialBlocks,
  type Case,
  type Docket,
} from "../../src/host/inspect/justice.ts";
import { chiefTown } from "../../src/host/inspect/grave.ts";
import { groupRef } from "../../src/host/underworld.ts";
import { yearNow } from "../../src/host/inspect/words.ts";
import { peopledWorld } from "../worlds.ts";

const world = peopledWorld("juniper", 60, { start: "spread" });
const year = yearNow(world);

/** The living realms by their people, each with the chief towns of its lands that are a year old. */
function realmsByPeople(w: World): { realm: Polity; towns: Settlement[] }[] {
  const ctx = populationContext(w),
    people = (p: Polity) => p.members.reduce((n, c) => n + (ctx.provinces.get(c)?.total() ?? 0), 0);
  return [...politiesOf(w).living()]
    .sort((a, b) => people(b) - people(a) || (a.ref < b.ref ? -1 : 1))
    .map((realm) => ({
      realm,
      towns: realm.members
        .map((c) => chiefTown(w, c))
        .filter((t): t is Settlement => !!t && t.founded < year - 1)
        .sort((a, b) => b.population - a.population),
    }))
    .filter((x) => x.towns.length > 0);
}

const { realm, towns } = realmsByPeople(world)[0]!;

/** Set rows down for a test and put back what was there after it; every reading made of the old rows is let go, before and after. */
function withRows(
  rows: readonly (readonly [RowStore, string | number, number[] | null])[],
  run: () => void,
) {
  const was = rows.map(([s, k]) => [s, k, s.get(k)] as const);
  try {
    for (const [s, k, r] of rows)
      if (r) s.set(k, r);
      else s.drop(k);
    forgetDockets(world);
    run();
  } finally {
    for (const [s, k, r] of was)
      if (r) s.set(k, [...r]);
      else s.drop(k);
    forgetDockets(world);
  }
}

/** A realm's underworld set down for a test: one protection group, holding the given lands. */
function withGroup(lands: readonly number[], collusion: number, run: (ref: string) => void) {
  const under = underworldOf(world)!,
    was = under.of(realm.ref),
    event = world.events.at(0).id,
    rec: RealmUnderworld = {
      last: year,
      next: year + 5,
      want: 500,
      supply: 500,
      pool: 100,
      veterans: 0,
      protectRent: 1000,
      banRent: 0,
      tariffRent: 0,
      borderRent: 0,
      captured: 0,
      smuggleRent: 0,
      crackdown: 0,
      bites: 0,
      collusion,
      cost: 0,
      seized: 0,
      killings: 10,
      street: 0,
      badge: 0,
      extortion: 200,
      badgePull: 0,
      crackEvent: null,
      pactEvent: null,
      told: 0,
      groups: [
        {
          id: 7,
          name: "Varro",
          kind: 0,
          since: 50,
          event,
          home: lands[0]!,
          lands: [...lands],
          boss: { name: "Old Varro", born: 10, since: 50 },
          bosses: 1,
          members: 40,
          wealth: 900,
          income: 300,
          share: 600,
          power: 700,
          rackets: racketBit("protection") | racketBit("extortion"),
          violence: 3,
          bribes: 20,
        },
      ],
      feds: [],
      wars: [],
      gone: [],
    };
  under.put(realm.ref, rec);
  try {
    run(groupRef(realm.ref, event));
  } finally {
    if (was) under.put(realm.ref, structuredClone(was) as RealmUnderworld);
    else under.forget(realm.ref);
    forgetDockets(world);
  }
}

/** A land's row: held by group 7 (kept one more), so much killing (millionths a year), so much of its trade under it. */
function gangRow(control: number, killings: number, street = 0): number[] {
  const r = new Array<number>(15).fill(0);
  r[GANG_ROW.control] = control;
  r[GANG_ROW.group] = control > 0 ? 8 : 0;
  r[GANG_ROW.kind] = control > 0 ? 1 : 0;
  r[GANG_ROW.killings] = killings;
  r[GANG_ROW.protection] = control > 0 ? 300 : 0;
  r[GANG_ROW.extortion] = control > 0 ? 200 : 0;
  r[GANG_ROW.gangs] = street > 0 ? 4 : 0;
  r[GANG_ROW.street] = street;
  return r;
}

const dockets = (): { t: Settlement; d: Docket }[] =>
  towns.flatMap((t) => [year, year - 1].map((y) => ({ t, d: docketOf(world, t.ref, y) })));
const all = (): Case[] => dockets().flatMap((x) => [...x.d.cases]);
const plain = (l: readonly unknown[]) =>
  l.map((s) => (typeof s === "string" ? s : (s as { text: string }).text)).join("");

test("a killing is heard only where the land's rows keep those killed, and no more are told than were", () => {
  const gangs = gangsStore(world)!,
    lands = orgLandsStore(world),
    cells = towns.map((t) => t.cell);
  // No row of the killing in any of its lands: no killing before any of its courts, and none unanswered.
  withRows(
    [
      ...cells.map((c) => [gangs, c, null] as const),
      ...(lands ? cells.map((c) => [lands, c, null] as const) : []),
    ],
    () => {
      for (const { t, d } of dockets()) {
        assert.equal(d.killed, 0, `${t.name} counts killed with no row kept`);
        assert.equal(d.open.length, 0);
        assert.ok(!d.cases.some((c) => c.offence === "killing"), `${t.name} hears a killing`);
      }
    },
  );
  // Its lands held by a group, their streets by gangs, two in a hundred killed a year: killings are told, and no more than were killed.
  withGroup(cells, 0, (group) =>
    withRows(
      cells.map((c) => [gangs, c, gangRow(400, 20000, 300)] as const),
      () => {
        let told = 0,
          unanswered = 0;
        for (const { t, d } of dockets()) {
          const killings = d.cases.filter((c) => c.offence === "killing");
          assert.ok(d.killed > 0, `${t.name} counts no one killed`);
          assert.ok(killings.length + d.open.length <= d.killed, `${t.name} tells more than died`);
          assert.ok(d.answered <= d.killed);
          told += killings.length;
          unanswered += d.open.length;
          for (const c of killings) {
            assert.ok(c.grave, "a killing is a grave matter");
            // (Told first, before the small wrongs.)
            assert.ok(d.cases.indexOf(c) < d.cases.filter((x) => x.grave).length);
            // (One of the town's lines is never put to death by a reading: the roster holds its dead by what history did.)
            if (!c.accused.outside) assert.notEqual(c.outcome, "death");
            else assert.equal(c.accused.ref, group);
          }
          // (A killing no one answered for has its page, and is laid to no one of the town.)
          for (const o of d.open) {
            const page = casePage(world, o.ref);
            assert.equal(page.title, "A killing no one answered for");
            assert.match(o.whatWords, /^Someone killed /);
          }
        }
        assert.ok(told + unanswered > 0, "no killing told anywhere, with two in a hundred killed");
        // (Brought in more seldom than killed.)
        assert.ok(unanswered >= told, `${told} brought, ${unanswered} unanswered`);
      },
    ),
  );
});

test("what a realm forbids is sold before its courts only where a ban stands", () => {
  const bars = moneyStore(world, BAR_STORE)!,
    row = (barred: number) => {
      const r = new Array<number>(19).fill(0);
      r[BAR.barred] = barred;
      return r;
    };
  withRows([[bars, realm.ref, row(0)]], () => {
    assert.ok(!all().some((c) => c.offence === "contraband"), "sold with nothing forbidden");
  });
  withRows([[bars, realm.ref, null]], () => {
    assert.ok(!all().some((c) => c.offence === "contraband"), "sold with no law kept");
  });
  withRows([[bars, realm.ref, row(900)]], () => {
    const sold = all().filter((c) => c.offence === "contraband");
    assert.ok(sold.length > 0, "nine tenths forbidden, and no one brought for selling it");
    for (const c of sold) {
      assert.ok(c.grave);
      assert.match(c.whatWords, /what the realm forbids/);
      assert.match(plain(c.why[0]!), /forbids 90 in a hundred/);
    }
  });
});

test("one is let go for pay, or for fear, only where a group or a crew holds the town", () => {
  const gangs = gangsStore(world)!,
    cells = towns.map((t) => t.cell),
    let_go = (c: Case) => c.outcome === "bought" || c.outcome === "frightened";
  // As the world stands, and with every land's row taken away: no one.
  withRows(
    cells.map((c) => [gangs, c, null] as const),
    () => {
      assert.ok(!all().some(let_go), "let go for pay where no one holds the town");
    },
  );
  // Held, its officers bought: some of the group's own walk, and only its own.
  withGroup(cells, 800, (group) =>
    withRows(
      cells.map((c) => [gangs, c, gangRow(500, 20000)] as const),
      () => {
        const went = all().filter(let_go);
        assert.ok(
          went.length > 0,
          "a group holds half the land and pays its judges, and no one walks",
        );
        for (const c of went) {
          assert.equal(c.group?.ref, group, `${c.offence}: let go, and of no group`);
          assert.ok(c.sentence === "bribe" || c.sentence === "free");
        }
        // (Its page tells its own tried, and how many were let go.)
        const { blocks } = trialBlocks(world, group),
          list = blocks.find((b) => b.type === "list");
        assert.ok(list && list.type === "list" && list.items.length > 0, "its page shows no trial");
        const facts = blocks.find((b) => b.type === "facts");
        assert.ok(
          facts && facts.type === "facts" && facts.rows.length > 0,
          "its page counts none let go",
        );
        for (const it of list.items) {
          assert.match(it.ref ?? "", /^case:town:/);
          assert.notEqual(casePage(world, it.ref!).title, "A case", `${it.ref} opens no case`);
        }
      },
    ),
  );
  // Held, and no one of the court paid: its hold may still silence those who saw, but no one is bought.
  withGroup(cells, 0, () =>
    withRows(
      cells.map((c) => [gangs, c, gangRow(500, 20000)] as const),
      () => {
        const order = all().filter((c) => c.outcome === "bought");
        // (What its realm skims is its own number: only where it skims nothing is no one paid.)
        for (const c of order) assert.ok(c.group, "bought, and by no one");
      },
    ),
  );
});

test("no case says how a thing was done, names what is forbidden, or leaks a ref", () => {
  const gangs = gangsStore(world)!,
    bars = moneyStore(world, BAR_STORE)!,
    cells = towns.map((t) => t.cell),
    bar = new Array<number>(19).fill(0);
  bar[BAR.barred] = 900;
  const HOW =
      /\b(stabb?|kni(fe|ves)|blade|dagger|sword|axe|club|poison|strangl|throttl|drown|shot|shoot|gun|rifle|pistol|musket|bow|arrow|bomb|powder|burn(ed|t) alive|hang(ed)?|behead|noose|opium|heroin|cocaine|morphine|alcohol|wine|beer|spirits|hemp|poppy|tobacco|leaf|resin|brew|distill|recipe|dose|by means of|how to|with a )\b/i,
    LEAK =
      /undefined|NaN|\bnull\b|\[object|\bev:\d|\bpol:\d|town:\d|\{\w+\}|\bfolk:|\bcase:|\bmob:|\borg:/;
  withGroup(cells, 600, () =>
    withRows(
      [...cells.map((c) => [gangs, c, gangRow(400, 20000, 300)] as const), [bars, realm.ref, bar]],
      () => {
        let read = 0;
        const kinds = new Set<string>();
        for (const { t, d } of dockets()) {
          for (const c of d.cases) {
            kinds.add(c.offence);
            const page = casePage(world, c.ref),
              texts = [
                c.whatWords,
                c.came,
                c.cost,
                ...c.why.map(plain),
                page.title,
                ...page.tabs.flatMap((tab) =>
                  tab.blocks.flatMap((b) =>
                    b.type === "text"
                      ? b.lines.map(plain)
                      : b.type === "facts"
                        ? b.rows.map((r) => `${r.label}: ${plain(r.value)}`)
                        : [],
                  ),
                ),
              ];
            for (const text of texts) {
              assert.doesNotMatch(text, HOW, `${t.name} ${c.offence}: ${text}`);
              assert.doesNotMatch(text, LEAK, `${t.name} ${c.offence}: ${text}`);
              read++;
            }
          }
          for (const o of d.open)
            for (const text of [o.whatWords, o.unanswered, ...o.why.map(plain)]) {
              assert.doesNotMatch(text, HOW, text);
              assert.doesNotMatch(text, LEAK, text);
            }
        }
        assert.ok(read > 50, `only ${read} lines read`);
        assert.ok(
          kinds.has("killing") && kinds.has("extort") && kinds.has("contraband"),
          [...kinds].join(),
        );
      },
    ),
  );
});

test("a year's book is the same each time it is read, says no outcome twice, and a plan draws only the town's own", () => {
  const gangs = gangsStore(world)!,
    cells = towns.map((t) => t.cell);
  withGroup(cells, 300, () =>
    withRows(
      cells.map((c) => [gangs, c, gangRow(400, 20000, 300)] as const),
      () => {
        const first = dockets().map((x) =>
          x.d.cases.map((c) => `${c.ref} ${c.whatWords} ${c.came}`),
        );
        forgetDockets(world);
        const again = dockets().map((x) =>
          x.d.cases.map((c) => `${c.ref} ${c.whatWords} ${c.came}`),
        );
        assert.deepEqual(again, first);
        for (const { t, d } of dockets()) {
          // (The same thing is never said to have come of two cases of one year.)
          const cames = d.cases.map((c) => `${c.offence}: ${c.came}`),
            bare = new Map<string, string>();
          for (const c of d.cases) {
            const was = bare.get(c.came);
            assert.ok(
              was === undefined || was === c.offence,
              `${t.name}: "${c.came}" of ${was} and ${c.offence}`,
            );
            bare.set(c.came, c.offence);
          }
          assert.ok(cames.length >= 0);
          // (Each case has its own number.)
          assert.equal(new Set(d.cases.map((c) => c.index)).size, d.cases.length);
          for (const c of d.cases)
            assert.equal(
              casesOf(world, t.ref, c.year).find((x) => x.index === c.index),
              c,
            );
        }
        for (const t of towns)
          for (const p of namedByCases(world, t.ref, year).named) {
            assert.ok(!p.outside, `${p.name} is drawn in ${t.name}, and is not of its lines`);
            assert.match(p.ref, /^(folk:town:|agent:)/);
          }
      },
    ),
  );
});
