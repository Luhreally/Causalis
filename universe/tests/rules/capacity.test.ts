// How far a seat's will is done (rules/capacity.ts): a chain, each link a share of what the one before left, at the seat and then
// in each land. The kinds of realm the rule was asked to tell apart, each by its own numbers.
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  REACH,
  forceKeeps,
  groundKeeps,
  landKeeps,
  linkLosses,
  linked,
  near,
  resentKeeps,
  seatLinks,
  type SeatFacts,
} from "../../src/rules/index.ts";

const modern: SeatFacts = {
  writing: true,
  clerks: true,
  readers: 0.8,
  taken: 0.2,
  short: 0,
  corruption: 0.02,
  kin: 0.1,
  legitimacy: 0.9,
  age: 300,
  civil: false,
  crisis: false,
};
const seat = (f: Partial<SeatFacts>) => linked(seatLinks({ ...modern, ...f }));

test("a seat's reach is a chain: every link keeps a share, none adds, and a whole seat is nearly whole", () => {
  for (const l of seatLinks(modern)) assert.ok(l.keeps > 0 && l.keeps <= 1, l.name);
  assert.ok(seat({}) > 0.85 && seat({}) <= 1, String(seat({})));
});

test("a chiefdom, an old kingdom, a modern state, a realm at war with itself: each stands apart", () => {
  const chiefdom = seat({
      writing: false,
      clerks: false,
      readers: 0,
      taken: 0.04,
      corruption: 0.3,
      kin: 0.5,
      legitimacy: 0.75,
    }),
    kingdom = seat({ clerks: false, readers: 0.1, taken: 0.06, corruption: 0.2, kin: 0.4 }),
    state = seat({ readers: 0.5, taken: 0.12 }),
    torn = seat({ readers: 0.5, taken: 0.12, civil: true, legitimacy: 0.4, crisis: true });
  assert.ok(chiefdom < 0.3, `a chiefdom ${chiefdom}`);
  assert.ok(kingdom > chiefdom * 1.3 && kingdom < 0.55, `a kingdom ${kingdom}`);
  assert.ok(state > kingdom * 1.4 && state < 0.9, `a state ${state}`);
  assert.ok(torn < state * 0.5, `torn ${torn} against ${state}`);
});

test("each link tells: letters, takings, a short treasury, the skim, kin in office, standing, a new seat", () => {
  assert.ok(seat({ writing: false, clerks: false }) < seat({ clerks: false, readers: 0 }));
  assert.ok(seat({ clerks: false, readers: 0 }) < seat({ clerks: false }));
  assert.ok(seat({ clerks: false }) < seat({}));
  assert.ok(seat({ taken: 0.03 }) < seat({ taken: 0.1 }));
  assert.ok(seat({ taken: 0.1 }) < seat({ taken: 0.2 }));
  assert.equal(seat({ taken: 0.2 }), seat({ taken: 0.5 }));
  assert.ok(seat({ short: 0.5 }) < seat({}));
  assert.equal(seat({ short: 1 }), seat({ short: 7 }));
  assert.ok(seat({ corruption: 0.5 }) < seat({ corruption: 0.1 }));
  assert.ok(seat({ kin: 0.6 }) < seat({}));
  assert.ok(seat({ legitimacy: 0.3 }) < seat({}));
  assert.ok(seat({ age: 5 }) < seat({ age: 40 }));
  assert.equal(seat({ age: REACH.settles }), seat({ age: 900 }));
});

test("a land keeps less of it the farther, the harder its ground, the more it resents, and where it is held by force", () => {
  assert.equal(near(0, 0), 1);
  assert.equal(near(REACH.steps, 0), 0.5);
  assert.ok(near(4, 6) > near(4, 1) && near(4, 1) > near(4, 0));
  assert.ok(near(8, 2) < near(2, 2));
  assert.equal(groundKeeps(0), 1);
  assert.ok(groundKeeps(900) < groundKeeps(300) && groundKeeps(5000) === 1 - REACH.ground);
  assert.equal(resentKeeps(0), 1);
  assert.ok(resentKeeps(1) < resentKeeps(0.4));
  assert.equal(forceKeeps(null), 1);
  assert.equal(forceKeeps(0), 1 - REACH.occupied);
  assert.ok(forceKeeps(0.8) < forceKeeps(0.2));
  const own = landKeeps({ steps: 0, carriers: 2, relief: 50, grievance: 0.1, resisted: null }),
    far = landKeeps({ steps: 6, carriers: 2, relief: 50, grievance: 0.1, resisted: null }),
    hills = landKeeps({ steps: 6, carriers: 2, relief: 700, grievance: 0.8, resisted: null }),
    held = landKeeps({ steps: 6, carriers: 2, relief: 700, grievance: 0.8, resisted: 0.6 });
  assert.ok(own > 0.9 && far < own * 0.6 && hills < far * 0.7 && held < hills * 0.5);
  // (An overstretched realm's far land under the same seat as its own: a quarter of it and less.)
  assert.ok(hills / own < 0.3, String(hills / own));
});

test("what the links take sums to what is missing of a whole reach", () => {
  const links = seatLinks({ ...modern, corruption: 0.3, taken: 0.05, age: 10 }),
    value = linked(links),
    losses = linkLosses(links, value);
  assert.ok(Math.abs(losses.reduce((s, x) => s + x, 0) - (value - 1)) < 1e-9);
  assert.ok(losses.every((x) => x <= 0));
  // (The weakest link takes the most.)
  const weakest = links.reduce((a, l, i) => (l.keeps < links[a]!.keeps ? i : a), 0);
  assert.equal(losses.indexOf(Math.min(...losses)), weakest);
});
