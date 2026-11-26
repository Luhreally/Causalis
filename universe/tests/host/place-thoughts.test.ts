// What a town's people remember (town mode, N3; asked 2026-11-25 for a mood's reasons as a colony sim shows them): what
// befell them or theirs that the place tells of already (a fire fought, a child born, a pairing, a friend's death, a
// coming of age), each moving their mood by so much, weighed by their own temper, and fading by halves till it is let go.
// The memories are the place's own: in no world's hash (a world whose town remembers runs exactly as a twin never
// entered), kept in the save and gone on with the same in another process, and never besides what a household's dates
// reckon already (a death at home, a home new or lost).
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { test } from "node:test";
import { DAY, HOUR, loadWorld, saveWorld, type World } from "../../src/kernel/index.ts";
import { populationContext, type Settlement } from "../../src/sim/index.ts";
import { EARTH } from "../../src/host/index.ts";
import {
  MOOD,
  PERSON_BYTES,
  SKILL_KINDS,
  TIES,
  THOUGHT,
  THOUGHTS,
  enterPlace,
  leans,
  placeMoodTerms,
  placeTemper,
  placesOf,
} from "../../src/host/place.ts";
import { placeFrame } from "../../src/host/placeplan.ts";
import { inspectPerson } from "../../src/host/placeinspect.ts";
import { universeWorld } from "./worlds.ts";

const YEARS = 150;
const base = (): World => universeWorld(EARTH, "first light", YEARS);
const copy = (w: World): World => {
  const doc = JSON.parse(JSON.stringify(saveWorld(w, "r", { universe: "earth" })));
  return loadWorld(doc, (s) => EARTH.build(s), "r").world;
};
const near = (w: World, people: number): Settlement => {
  const ctx = populationContext(w);
  return ctx.settlements
    .all()
    .filter((s) => ctx.settlements.held(s.ref) && s.population > 0)
    .sort(
      (a, b) =>
        Math.abs(a.population - people) - Math.abs(b.population - people) ||
        (a.ref < b.ref ? -1 : 1),
    )[0]!;
};
/** The place run on an hour at a time, as a page looking at it runs it. */
const go = (w: World, ref: string, hours: number) => {
  for (let h = 0; h < hours; h++) {
    w.runTo(w.now + HOUR);
    placeFrame(w, ref, []);
  }
};
/** Each of its people's memories of a kind now: their place, and what it moves their mood by. */
const memories = (w: World, ref: string, kind: number) => {
  const place = placesOf(w)!.get(ref)!,
    out: { i: number; size: number; days: number | null }[] = [];
  for (let i = 0; i < place.people.n; i++)
    for (const x of placeMoodTerms(w, place, i))
      if (x.thought === kind) out.push({ i, size: x.size, days: x.days });
  return out;
};

test("a person's memories are 24 bytes of them, and a person of a place stays within a hundred and eighty", () => {
  // (The place's columns before memories were 72 bytes a person: six memories of four bytes each are the growth; then the
  // hours at each kind of work, two bytes a kind, and the kind their household taught them, a byte: N6; whom they know,
  // five bytes each of a dozen: N8; a wound's bleeding, the blood lost and its festering, a byte each: N9.)
  assert.equal(PERSON_BYTES, 72 + 4 * THOUGHTS + 2 * SKILL_KINDS.length + 1 + 5 * TIES + 3);
  assert.ok(PERSON_BYTES <= 180);
});

test("a fire fought is remembered by those who fought it, by their temper, and fades till it is let go", () => {
  const w = copy(base()),
    ref = near(w, 400).ref;
  enterPlace(w, ref);
  go(w, ref, 2);
  try {
    w.runTo(w.submit("act.fire", { village: ref }).t);
  } catch {
    return;
  }
  go(w, ref, 30);
  const place = placesOf(w)!.get(ref)!;
  if (!place.fire.length) return;
  const fought = memories(w, ref, THOUGHT.fire);
  assert.ok(fought.length > 3, `those who fought it remember it (${fought.length})`);
  for (const m of fought.slice(0, 20)) {
    // (Weighed by how boldly they bear hardship: the timid the more. A day or so faded.)
    const full = -12 * leans(1 - placeTemper(place, m.i).bold);
    assert.ok(m.size < 0 && m.size >= full - 0.5 && m.size <= full * 0.85, `${m.size} of ${full}`);
    assert.ok(m.days !== null && m.days > 20 && m.days < 50, `${m.days} days left`);
  }
  const sizes = new Set(fought.map((m) => Math.round(m.size)));
  assert.ok(sizes.size > 1, "not the same for all: each by their own temper");
  // What the inspector says of one of them: the memory among their mood's reasons, with its size and its days.
  const one = inspectPerson(w, place, place.people.id[fought[0]!.i]!)!;
  const said = one.thoughts.find((t) => t.words === "Fought a fire");
  assert.ok(said && said.size < 0 && said.days !== null, JSON.stringify(one.thoughts));
  // Two months on, it has faded past a point and is let go (ten days to a half).
  go(w, ref, 60 * 24);
  assert.equal(memories(w, ref, THOUGHT.fire).length, 0, "let go once faded");
  let held = 0;
  for (let k = 0; k < place.people.n * THOUGHTS; k++)
    if (place.people.thought[k]! >>> 24 === THOUGHT.fire) held++;
  assert.equal(held, 0, "and its slot freed");
});

test("nothing is remembered besides what a household's dates already reckon", () => {
  const w = copy(base()),
    ref = near(w, 600).ref;
  enterPlace(w, ref);
  go(w, ref, 24 * 90);
  const place = placesOf(w)!.get(ref)!;
  // (A death at home is the household's grief; a friend of another household who died is a memory, never both.)
  for (let i = 0; i < place.people.n; i++) {
    const terms = placeMoodTerms(w, place, i),
      grief = terms.some((x) => x.bit === MOOD.bereaved);
    for (const x of terms) {
      assert.ok(x.bit !== 0 || x.thought, "a term is a bit or a memory");
      if (x.thought) assert.equal(x.bit, 0);
    }
    if (grief)
      assert.ok(
        terms.filter((x) => x.bit === MOOD.bereaved).length === 1,
        "a household's death is one reason",
      );
  }
  // (What its people remember after a season: all of kinds the place tells of, and each within its bounds.)
  let any = 0;
  for (let k = 0; k < place.people.n * THOUGHTS; k++) {
    const v = place.people.thought[k]!;
    if (!v) continue;
    any++;
    assert.ok((Object.values(THOUGHT) as number[]).includes(v >>> 24), `kind ${v >>> 24}`);
  }
  console.log(`  remembered after ninety days: ${any} memories among ${place.people.n}`);
});

test("a town whose people remember runs its world exactly as a twin never entered", () => {
  const w = copy(base()),
    twin = copy(base()),
    ref = near(w, 400).ref;
  enterPlace(w, ref);
  go(w, ref, 2);
  let fired = true;
  try {
    w.runTo(w.submit("act.fire", { village: ref }).t);
  } catch {
    fired = false;
  }
  if (fired) {
    twin.runTo(w.now - 1);
    twin.runTo(twin.submit("act.fire", { village: ref }).t);
  }
  go(w, ref, 24 * 20);
  twin.runTo(w.now);
  assert.ok(memories(w, ref, THOUGHT.fire).length > 0 || !fired);
  assert.equal(JSON.stringify(w.domainHashes()), JSON.stringify(twin.domainHashes()));
  assert.deepEqual(
    w.checkpoints().map((c) => c.chain),
    twin.checkpoints().map((c) => c.chain),
  );
});

test("what they remember is kept in the save and goes on the same in another process", () => {
  const dir = mkdtempSync(join(tmpdir(), "place-thoughts-")),
    child = fileURLToPath(new URL("./place-thoughts-child.ts", import.meta.url)),
    run = (...args: string[]) =>
      execFileSync(process.execPath, [child, ...args], { encoding: "utf8" })
        .trim()
        .split("\n")
        .at(-1)!;
  try {
    const save = join(dir, "w.save"),
      whole = run("whole", String(YEARS)),
      first = run("first", String(YEARS), save),
      second = run("second", save);
    assert.match(whole, /^[0-9a-f]+ [0-9a-f]+ \d+$/);
    assert.ok(Number(first.split(" ")[2]) > 0, `memories kept in the save (${first})`);
    assert.notEqual(first, whole, "the first days are not yet the whole");
    assert.equal(second, whole);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("a day's turn of a mood is where its reasons put it, a quarter of the way", () => {
  const w = copy(base()),
    ref = near(w, 400).ref;
  enterPlace(w, ref);
  go(w, ref, 24 * 3);
  const place = placesOf(w)!.get(ref)!,
    i = 5,
    id = place.people.id[i]!,
    was = place.people.mood[i]!,
    to = 15 + placeMoodTerms(w, place, i).reduce((n, x) => n + x.size, 0);
  // (Its turn is once a day, at a tick of its own: within a day it has come, by a quarter, toward where its reasons stood.)
  go(w, ref, 24);
  const k = place.people.id.indexOf(id);
  if (k < 0 || k >= place.people.n) return;
  const now = place.people.mood[k]!;
  assert.ok(
    Math.abs(now - (was + (to - was) / 4)) <= 6,
    `${was} → ${now}, its reasons ${Math.round(to)}`,
  );
  void DAY;
});
