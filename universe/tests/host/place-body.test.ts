// One's body and what it is written in (town mode, R4): read off the world's own life (its liquid, its breath and the
// metal that carries it, its bones, its cells' skins, its hand), the people's body plan and lineage, and the person.
import assert from "node:assert/strict";
import { test } from "node:test";
import { BLOOD_WORDS, BONE_WORDS, FAMILY_WORDS, findSubstance } from "../../src/rules/index.ts";
import { worldLife } from "../../src/gen/index.ts";
import { homePlanet } from "../../src/sim/index.ts";
import { enterPlace, placeDigest } from "../../src/host/place.ts";
import { placeInspect } from "../../src/host/placeinspect.ts";
import {
  placeBodyRef,
  placePersonRef,
  type PlaceInspectBody,
  type PlaceInspectPerson,
} from "../../src/bridge/index.ts";
import { noTown, placeWorld, townWhere } from "./worlds.ts";

test("one's body: what it is made of, how it lives, what it is written in, by its world's own life", (t) => {
  const w = placeWorld(150),
    s = townWhere(w, () => true, { near: 3000, least: 500 }) ?? noTown(t, "of five hundred");
  if (!s) return;
  const town: string = s.ref,
    place = enterPlace(w, town)!,
    before = placeDigest(place),
    g = homePlanet(w).generated,
    life = worldLife(g),
    p = place.people;
  let read = 0;
  for (let i = 0; i < p.n && read < 40; i += Math.max(1, Math.floor(p.n / 40))) {
    const id = p.id[i]!,
      person = placeInspect(w, town, placePersonRef(town, id)) as PlaceInspectPerson;
    assert.equal(person.bodyRef, placeBodyRef(town, id));
    const b = placeInspect(w, town, person.bodyRef) as PlaceInspectBody;
    assert.equal(b.kind, "body");
    // (Its shares whole, its liquid its life's own, its bones' mineral its world's.)
    assert.equal(
      b.madeOf.reduce((n, m) => n + m.share, 0),
      100,
    );
    assert.equal(
      b.madeOf[0]!.what.toLowerCase(),
      (findSubstance(life.liquid)?.name ?? life.liquid).toLowerCase(),
    );
    assert.ok(b.madeOf.some((m) => m.what.toLowerCase() === BONE_WORDS[life.bone].name));
    const facts = Object.fromEntries(b.metabolism);
    assert.match(facts.Blood!, new RegExp(BLOOD_WORDS[life.blood].subst));
    assert.match(facts["Burns it with"]!, life.breath === "oxygen" ? /^Oxygen/ : /^Hydrogen/);
    assert.match(facts.Warmth!, new RegExp(FAMILY_WORDS[life.family].liquid));
    const genome = Object.fromEntries(b.genome);
    assert.ok(genome["Written in"] && genome.Kind && genome["Their own"]);
    if (g.life.people)
      assert.ok(genome.Lineage, "their lineage, where their people rose on their world");
    assert.match(b.sub, /^(Female|Male), \d+ of a span of \d+ years · about \d+ kg$/);
    read++;
  }
  t.diagnostic(
    `${read} read; life of ${life.family}, breathing ${life.breath}, blood of ${life.blood}`,
  );
  assert.equal(placeDigest(place), before, "read only");
});
