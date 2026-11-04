// History's blocks, each part of them (Phase 63): what a block leaves out, because its other rows or
// its row's own outcome give it, comes back to the letter, however the rows fall.
import { test } from "node:test";
import assert from "node:assert/strict";
import { ColdDecisions, ColdEvents } from "../../src/kernel/cold.ts";
import type { DecisionRecord, HistoryEvent, Ref } from "../../src/kernel/index.ts";

const r = (s: string) => s as Ref;

function event(
  n: number,
  type: string,
  subjects: string[],
  place: string | null,
  causes: [string, number?][],
  data: unknown,
): HistoryEvent {
  return {
    id: r(`ev:0:${n}`),
    t: 1000 + n * 10,
    type,
    importance: 1 + (n % 6),
    subjects: subjects.map(r),
    place: place === null ? null : r(place),
    causes: causes.map(([ref, weight]) => ({
      ref: r(ref),
      role: n % 2 ? "trigger" : "enabler",
      weight: weight ?? 1,
    })),
    data,
  };
}

/** Rows as the world writes them, and every way they might not be. */
function rows(): HistoryEvent[] {
  const out: HistoryEvent[] = [];
  let n = 1;
  const add = (...a: Parameters<typeof event> extends [number, ...infer R] ? R : never) =>
    out.push(event(n++, ...a));
  for (let k = 0; k < 40; k++) {
    const war = `war:0:${1 + (k % 3)}`,
      a = `the league of A${k % 3}`,
      // (One side's name changes partway through: written again, then given again.)
      b = k < 20 ? `the league of B${k % 3}` : `the empire of B${k % 3}`;
    add(
      "war.battle",
      [war, `pol:0:${10 + (k % 3)}`, `pol:0:${20 + (k % 3)}`],
      `cell:0:${100 + k}`,
      k % 7 === 0 ? [[`ev:0:${1 + (k % 3)}`], [`dec:0:${5 + k}`, 0.5]] : [[`ev:0:${1 + (k % 3)}`]],
      { a, b, won: k % 2 === 0, fallen: 100 + k },
    );
    add(
      "people.famine",
      [],
      `cell:0:${k}`,
      [
        [`cell:0:${k}`, 0.4],
        [`ev:0:${1 + k}`, 0.6],
      ],
      {
        fed: 500 + k,
        people: 9000 + k,
      },
    );
    add(
      "people.migration",
      [`cell:0:${k}`, `cell:0:${k + 1}`],
      `cell:0:${k}`,
      [[`cell:0:${k + 1}`], [`town:0:${k}`]],
      { count: k },
    );
    add("polity.succession", [`pol:0:${10 + (k % 3)}`], null, [], {
      name: k % 5 === 4 ? `the league of A${k % 3}!` : `the league of A${k % 3}`,
      old: `Ruler ${k}`,
    });
    // A field that is sometimes a number is never left out; one missing from some rows may be.
    add("odd.fields", [`pol:0:${10 + (k % 2)}`], `cell:0:1`, [], {
      sometimes: k % 9 === 0 ? 0 : "a word",
      ...(k % 2 ? { name: "the same" } : {}),
    });
    add("odd.data", [`pol:0:${k % 2}`], null, [], [k % 3 ? null : k, "text", 0, [0], { name: 0 }]);
    add("odd.subjects", k % 2 ? ["a", "b"] : ["a", "c"], null, [["a"], ["b"], ["elsewhere"]], null);
  }
  return out;
}

const plain = (v: unknown) => JSON.parse(JSON.stringify(v));
const readAll = (c: ColdEvents) => Array.from({ length: c.n }, (_, k) => plain(c.plain(k)));

test("a block's events read back as they went in", () => {
  const list = rows(),
    c = new ColdEvents();
  c.freeze(list);
  assert.deepEqual(readAll(c), plain(list));
});

test("in any order of asking: a row alone, of a group not yet read, its parts apart", () => {
  const list = rows(),
    c = new ColdEvents();
  c.freeze(list);
  for (let k = list.length - 1; k >= 0; k -= 5) {
    assert.deepEqual(plain(c.causes(k)), plain(list[k]!.causes));
    assert.deepEqual(plain(c.data(k)), plain(list[k]!.data));
    assert.deepEqual(plain(c.subjects(k)), plain(list[k]!.subjects));
    assert.deepEqual([...c.kids(k)].length <= list[k]!.causes.length, true);
  }
});

test("through a save, its rows forgotten or written again", () => {
  const list = rows(),
    c = new ColdEvents();
  // Over several blocks, each read back after a save.
  c.freeze(list.slice(0, 100));
  c.freeze(list.slice(100, 200));
  c.freeze(list.slice(200));
  const again = new ColdEvents();
  again.load(plain(c.save()));
  assert.deepEqual(readAll(again), plain(list));
  // Half of the rows of the first two blocks forgotten: moved over, as a reckoning moves them.
  let w = 0;
  const left: HistoryEvent[] = [];
  for (let k = 0; k < again.n; k++) {
    if (k < 200 && k % 2) {
      again.blocks[again.block[k]!]!.dead++;
      continue;
    }
    again.move(k, w++);
    left.push(list[k]!);
  }
  again.n = w;
  assert.deepEqual(readAll(again), plain(left));
  const third = new ColdEvents();
  third.load(plain(again.save()));
  assert.deepEqual(readAll(third), plain(left), "saved with its forgotten marked");
  assert.ok(third.tidy(1, 400) >= 1, "written again");
  assert.deepEqual(readAll(third), plain(left), "written again without them");
  const fourth = new ColdEvents();
  fourth.load(plain(third.save()));
  assert.deepEqual(readAll(fourth), plain(left), "and through a save again");
});

// ---------------------------------------------------------------------------

function decision(
  n: number,
  rule: string,
  subject: string,
  outcome: unknown,
  factors: [string, number, ([string, string, number] | null)?][],
): DecisionRecord {
  return {
    id: r(`dec:0:${n}`),
    t: 500 + n,
    rule,
    subject: r(subject),
    outcome,
    score: 0.126 + n / 7,
    threshold: n % 3,
    factors: factors.map(([name, contribution, source]) => ({
      name,
      value: contribution * 3.3,
      contribution,
      source: source
        ? { ref: r(source[0]), role: source[1] as "trigger", weight: source[2] }
        : null,
    })),
  };
}

function decisions(): DecisionRecord[] {
  const out: DecisionRecord[] = [];
  for (let k = 1; k <= 30; k++) {
    const realm = `pol:0:${k}`,
      foe = `pol:0:${k % 2 ? 1000 + k : 2 + k}`,
      // (As a relation's ref is made: by the order of the refs' text, not their numbers.)
      [x, y] = realm < foe ? [realm, foe] : [foe, realm],
      rel = `rel:${x.split(":")[2]}:${y.split(":")[2]}`;
    out.push(
      decision(2 * k, "war.declare", realm, { against: foe, prize: 100 + k }, [
        ["their rivalry", 0.63 + k / 100, [rel, "pressure", 1]],
        ["their strength", 0.5, null],
        ["the land they want", 0.5, [`cell:0:${100 + k}`, "enabler", 1]],
        ["hunger", -0.004, [`ev:0:${k}`, "trigger", 0.5]],
        ["a whim", 1 / 3, [`dec:0:${k}`, "trigger", 1]],
      ]),
      decision(2 * k + 1, "space.crew", realm, k % 2 ? { launcher: "atomic", stages: 2 } : 3, [
        ["the realm", 1.005, [realm, "agent", 1]],
        ["nothing it names", 2, [`town:0:${k}`, "agent", 0.25]],
        ["its number", 0, [`cell:0:2`, "agent", 1]],
      ]),
    );
  }
  return out;
}

const toldAs = (d: DecisionRecord) => ({
  ...d,
  score: d.score.toFixed(2),
  factors: d.factors.map((f) => [f.name, f.contribution.toFixed(2), f.source]),
});

test("a block's decisions read back as they are told", () => {
  const list = decisions(),
    c = new ColdDecisions();
  c.freeze(list);
  const back = Array.from({ length: c.n }, (_, k) => c.record(k));
  assert.deepEqual(back.map(toldAs), list.map(toldAs));
  // A source its own outcome names costs next to nothing in the block; another is written out.
  const other = new ColdDecisions();
  other.freeze(
    list.map((d) => ({
      ...d,
      factors: d.factors.map((f, k) =>
        f.source && !/^(ev|dec):/.test(f.source.ref)
          ? { ...f, source: { ...f.source, ref: r(`thing:${d.t}:${k}`) } }
          : f,
      ),
    })),
  );
  assert.ok(c.blocks[0]!.body.length < other.blocks[0]!.body.length);
});

test("the warm saved as a block, with words of their own: a save changes nothing", () => {
  const list = decisions(),
    c = new ColdDecisions(),
    words = c.words.list.length,
    written = c.written(list)!;
  assert.equal(c.words.list.length, words);
  assert.deepEqual(c.unwritten(plain(written)).map(toldAs), list.map(toldAs));
  assert.equal(c.written([]), null);
  // One that would not read back so: all saved as they are.
  const odd = [...list];
  odd[3] = { ...odd[3]!, id: r("dec:0:007") };
  assert.equal(c.written(odd), null);
});
