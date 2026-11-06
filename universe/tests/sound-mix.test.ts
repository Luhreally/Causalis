// What is heard, as numbers (Sound, first slice): the mix of each place, pure; the places differ, and
// what is about them moves them as a person would expect. (What it sounds like: gate 90.)
import { strict as assert } from "node:assert";
import { test } from "node:test";
import {
  CUES,
  CUE_RULES,
  airOf,
  airOfWorld,
  cueAllowed,
  mixOf,
  type Air,
  type Place,
} from "../src/app/sound-mix.ts";

const PLACES: Place[] = [
  "title",
  "town",
  "land",
  "shore",
  "halls",
  "globe",
  "stars",
  "galaxy",
  "battle",
];
const at = (place: Place, o: Partial<Air> = {}): Air => ({ ...airOf(place), ...o });

test("the same air gives the same mix, and no two places the same", () => {
  const seen = new Set<string>();
  for (const p of PLACES) {
    assert.deepEqual(mixOf(at(p)), mixOf(at(p)));
    seen.add(JSON.stringify(mixOf(at(p))));
  }
  assert.equal(seen.size, PLACES.length);
});

test("every level is finite and none is a wall", () => {
  for (const p of PLACES)
    for (const rain of [0, 1])
      for (const night of [0, 1])
        for (const war of [false, true]) {
          const m = mixOf(at(p, { rain, night, war, wind: 1, thin: 0.5 }));
          for (const [k, v] of Object.entries(m)) {
            assert.ok(Number.isFinite(v), `${p} ${k}`);
            assert.ok(v >= 0, `${p} ${k} ${v}`);
          }
          assert.ok(m.level <= 1);
        }
});

test("a world with nothing alive has no birds, no insects, no owls, no gulls", () => {
  for (const p of ["town", "land", "shore"] as const) {
    const m = mixOf(at(p, { alive: false }));
    assert.equal(m.birds + m.crickets + m.owls + m.gulls + m.moans, 0, p);
    const n = mixOf(at(p, { alive: false, night: 1 }));
    assert.equal(n.birds + n.crickets + n.owls + n.gulls + n.moans, 0, p);
  }
  assert.ok(mixOf(at("land")).birds > 0);
});

test("rain falls only where there is sky to fall from, and sends the birds in", () => {
  assert.ok(mixOf(at("town", { rain: 1 })).rain > 0.5);
  assert.equal(mixOf(at("town")).rain, 0);
  assert.ok(mixOf(at("town", { rain: 1 })).birds < mixOf(at("town")).birds / 4);
  assert.equal(mixOf(at("stars", { rain: 1 })).rain, 0);
  assert.equal(mixOf(at("globe", { rain: 1 })).rain, 0);
  assert.equal(mixOf(at("town", { rain: 1, under: true })).rain, 0);
});

test("night, a market and a war each move a town", () => {
  const day = mixOf(at("town")),
    night = mixOf(at("town", { night: 1 })),
    market = mixOf(at("town", { market: true })),
    war = mixOf(at("town", { war: true }));
  assert.ok(night.crowd < day.crowd / 4);
  assert.ok(night.crickets > 0 && day.crickets === 0);
  assert.ok(market.crowd > day.crowd && market.hawkers > 0);
  assert.ok(war.drums > 0 && war.birds === 0 && war.hawkers === 0);
  // (No market stands by night.)
  assert.equal(mixOf(at("town", { night: 1, market: true })).hawkers, 0);
});

test("under water, all of it through the water, and only what is made in it", () => {
  const m = mixOf(at("town", { under: true }));
  assert.ok(m.waterHz < 800);
  assert.ok(m.bubbles > 0);
  assert.equal(m.wind + m.high + m.birds + m.gulls + m.crickets, 0);
  assert.equal(mixOf(at("stars", { under: true })).waterHz, mixOf(at("stars")).waterHz);
});

test("what the greatest fire leaves is quieter, never louder", () => {
  const was = mixOf(at("town")),
    hush = mixOf(at("town", { hush: 1 }));
  assert.ok(hush.level < was.level);
  assert.equal(hush.crowd + hush.birds + hush.tinks, 0);
});

test("a paused world's air stays back, and nothing happens in it", () => {
  const m = mixOf(at("battle", { held: true }));
  assert.ok(m.level < 1 && m.crowd > 0);
  assert.equal(m.drums + m.clashes + m.shots, 0);
});

test("a world's air: thin carries less, hard wind blows harder", () => {
  assert.deepEqual(airOfWorld(1, 1), { thin: 0, wind: 0 });
  assert.ok(airOfWorld(0.1, 1).thin > 0.8);
  assert.ok(airOfWorld(4, 0.5).wind > 0.8);
  const thin = mixOf(at("land", { thin: 1 })),
    land = mixOf(at("land")),
    hard = mixOf(at("land", { wind: 1 }));
  assert.ok(thin.wind < land.wind / 2);
  assert.ok(thin.windHz < land.windHz);
  assert.ok(hard.wind > land.wind * 2);
  assert.ok(hard.windHz > land.windHz);
});

test("a cue waits its turn, and no more of its kind sound than it may", () => {
  for (const c of CUES) {
    const rule = CUE_RULES[c];
    assert.equal(cueAllowed(c, rule.wait, 0), true, c);
    assert.equal(cueAllowed(c, rule.wait - 1, 0), false, c);
    assert.equal(cueAllowed(c, rule.wait, rule.most), false, c);
  }
});
