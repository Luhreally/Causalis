// One's character and mind (town mode, R2): their traits as tags with what each does, read off their temper, nature
// and values as the town reckons them; their best skills; what they want most now; what they have come to, as its log
// tells it; what drives them; their five leanings against most; how they learn; their people's senses. Read only.
import assert from "node:assert/strict";
import { test } from "node:test";
import { HOUR } from "../../src/kernel/index.ts";
import {
  HAP,
  advancePlace,
  enterPlace,
  leans,
  placeDigest,
  placeIndexOf,
  placeTemper,
} from "../../src/host/place.ts";
import { placeInspect } from "../../src/host/placeinspect.ts";
import { populationContext } from "../../src/sim/index.ts";
import {
  placeCharacterRef,
  placePersonRef,
  type PlaceInspectCharacter,
  type PlaceInspectPerson,
} from "../../src/bridge/index.ts";
import { noTown, placeWorld, townWhere } from "./worlds.ts";

test("one's character and mind: traits with what they do, skills, wants, what they came to, drive, leanings, senses", (t) => {
  const w = placeWorld(150),
    s = townWhere(w, () => true, { near: 3000, least: 800 }) ?? noTown(t, "of eight hundred");
  if (!s) return;
  const town: string = s.ref,
    place = enterPlace(w, town)!;
  // (Two months lived, so some have come to something: paired, of age, a work kept.)
  for (let h = 0; h < 60 * 24; h++) {
    w.runTo(w.now + HOUR);
    advancePlace(w, place);
  }
  const before = placeDigest(place),
    p = place.people,
    senses = populationContext(w).generated.life.people?.body?.senses;
  let read = 0,
    tagged = 0;
  for (let i = 0; i < p.n && read < 60; i += Math.max(1, Math.floor(p.n / 60))) {
    const id = p.id[i]!,
      person = placeInspect(w, town, placePersonRef(town, id)) as PlaceInspectPerson;
    assert.equal(person.characterRef, placeCharacterRef(town, id));
    const c = placeInspect(w, town, person.characterRef) as PlaceInspectCharacter;
    assert.equal(c.kind, "character");
    assert.equal(c.personRef, placePersonRef(town, id));
    // (Its leanings as the town reckons them, against most: the same numbers as weigh in their mood.)
    const temper = placeTemper(place, i);
    assert.deepEqual(
      c.leanings.map((l) => l.value),
      [temper.kin, temper.bidden, temper.sociable, temper.thrifty, temper.bold].map((x) =>
        Math.round(leans(x) * 100),
      ),
    );
    if (temper.kin >= 0.62) assert.ok(c.traits.some((x) => x.tag === "close to kin"));
    if (temper.bold <= 0.38) assert.ok(c.traits.some((x) => x.tag === "timid"));
    for (const x of c.traits) assert.ok(x.meaning.length > 10, `${x.tag}: what it does`);
    tagged += c.traits.length ? 1 : 0;
    assert.ok(c.skills.length <= 3);
    for (let k = 1; k < c.skills.length; k++)
      assert.ok(c.skills[k - 1]!.hours >= c.skills[k]!.hours);
    assert.ok(c.want.length > 0 && c.drive.length > 0);
    // (Their people's senses: the body their world gave them; upright apes see and hear.)
    assert.deepEqual(
      c.senses.map((x) => x.name.toLowerCase()),
      [...(senses ?? ["sight", "hearing"])],
    );
    read++;
  }
  assert.ok(tagged > read / 2, `${tagged} of ${read} with a trait`);
  // (What they came to, as its log tells it: each glad happening of one living, on its day.)
  const glad: Record<number, RegExp> = {
      [HAP.paired]: /^Paired, day/,
      [HAP.ofAge]: /^Came of age, day/,
      [HAP.well]: /^Well again, day/,
      [HAP.madeWork]: /^Made a work of their craft/,
    },
    came = place.log.filter((x) => glad[x.what] && placeIndexOf(place, x.id) >= 0).slice(-20);
  for (const x of came) {
    const c = placeInspect(w, town, placeCharacterRef(town, x.id)) as PlaceInspectCharacter;
    assert.ok(
      c.fulfilled.some((line) => glad[x.what]!.test(line)),
      `${c.name}: what they came to, ${c.fulfilled.join("; ")}`,
    );
  }
  t.diagnostic(`${read} read, ${tagged} with a trait; ${came.length} come to something read`);
  // Read only: the town as it was.
  assert.equal(placeDigest(place), before);
});
