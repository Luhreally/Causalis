// Who comes to a town's gate (town mode, P2), read off its world: caravans of the lands its land traded with, those its world
// moved into its land, envoys to its court, raiders; each on a keyed day of its year, the same wherever read; told in its
// log on their day; on its own page with what sent them a tap away. Its gate shut by order (place.gate) turns away those its
// land's count brings to live in it, across a year's turn when it brings them: the town is the fewer by them, its open twin
// takes them in; and opened again, it takes them in. Only town mode: the world's hash is the same either way.
import assert from "node:assert/strict";
import { test } from "node:test";
import { DAY, HOUR, YEAR, loadWorld, saveWorld, type World } from "../../src/kernel/index.ts";
import { managedOf } from "../../src/sim/index.ts";
import { GATE_ASKS, gateArrivals, gateOn } from "../../src/host/placegate.ts";
import { GATE_TURNED, HAP, advancePlace, enterPlace, type Place } from "../../src/host/place.ts";
import { placeInspect } from "../../src/host/placeinspect.ts";
import { placeGateRef, type PlaceInspectGate } from "../../src/bridge/index.ts";
import { PLACE_UNIVERSE, noTown, placeWorld, townWhere } from "./worlds.ts";

const copy = (w: World): World =>
  loadWorld(
    JSON.parse(JSON.stringify(saveWorld(w, "r", { universe: PLACE_UNIVERSE.name }))),
    (s) => PLACE_UNIVERSE.build(s),
    "r",
  ).world;
const order = (w: World, type: string, args: unknown): void => {
  const c = w.submit(type, args);
  w.runTo(c.t);
};
const came = (p: Place) => p.log.filter((x) => x.what === HAP.came).length;

test("those come to a town's gate read off its world; its gate shut turns away those its land brings, across a year's turn", (t) => {
  const w0 = placeWorld(150);
  w0.runTo(151 * YEAR - 6 * DAY);
  const s = townWhere(w0, () => true, { near: 600, least: 300 }) ?? noTown(t, "of three hundred");
  if (!s) return;
  const town: string = s.ref,
    open = copy(w0),
    shut = copy(w0),
    po = enterPlace(open, town)!,
    ps = enterPlace(shut, town)!;
  // (Read the same wherever: a copy of its world gives the same days.)
  assert.deepEqual(gateArrivals(open, town, po.cell, 150), gateArrivals(shut, town, ps.cell, 150));
  order(shut, "place.gate", { town, shut: true });
  assert.equal(managedOf(shut)?.get(town as never)?.gate, 0);
  assert.throws(() => shut.submit("place.gate", { town, shut: false }));
  for (let h = 0; h < 30 * 24; h++)
    for (const [w, p] of [
      [open, po],
      [shut, ps],
    ] as const) {
      w.runTo(w.now + HOUR);
      advancePlace(w, p);
    }
  // Across the turn its land's count brought newcomers: the open town took them in; the shut one turned them away.
  assert.ok(came(po) > 0, "its land's count brought newcomers across the turn");
  assert.equal(came(ps), 0, "none came to live in it with its gate shut");
  assert.ok(
    po.people.n > ps.people.n,
    `the open town the more by them (${po.people.n} / ${ps.people.n})`,
  );
  const away = ps.log.filter((x) => x.what === HAP.gate && x.b & GATE_TURNED);
  assert.equal(
    away.reduce((a, x) => a + (x.b & (GATE_TURNED - 1)), 0),
    came(po),
    "each turned away told, as many as its twin took in",
  );
  assert.ok(
    !po.log.some((x) => x.what === HAP.gate && x.b & GATE_TURNED),
    "none turned away from the open",
  );
  // Those come on a day are told on it, in both; those asking to live in it turned away only where it is shut.
  const day0 = Math.floor((151 * YEAR - 6 * DAY) / DAY);
  for (let d = day0; d < day0 + 30; d++)
    for (const [w, p, isShut] of [
      [open, po, false],
      [shut, ps, true],
    ] as const)
      for (const x of gateOn(w, town, p.cell, d)) {
        const line = `${x.kind}|${x.from}|${x.why}|${x.ref ?? ""}`,
          k = p.gates?.indexOf(line) ?? -1,
          told = p.log.find((y) => y.what === HAP.gate && y.a === k && Math.floor(y.t / DAY) === d);
        assert.ok(told, `${x.kind} from ${x.from} told on day ${d}`);
        assert.equal(!!(told.b & GATE_TURNED), isShut && GATE_ASKS.has(x.kind));
      }
  // Its page: each come and to come, each with what sent them where a page tells of it; its order said.
  const page = placeInspect(shut, town, placeGateRef(town)) as PlaceInspectGate;
  assert.equal(page.kind, "gate");
  assert.equal(page.shut, true);
  assert.ok(page.orderWords.startsWith(`${came(po)} turned away`), page.orderWords);
  assert.ok(!/undefined|NaN/.test(JSON.stringify(page)), JSON.stringify(page).slice(0, 300));
  for (const a of page.arrivals) assert.ok(a.when && a.who && a.words, JSON.stringify(a));
  // Opened again: its land's count's newcomers come to it at the next month's turn.
  order(shut, "place.gate", { town, shut: null });
  assert.equal(managedOf(shut)?.get(town as never)?.gate, undefined);
  const before = came(ps);
  for (let h = 0; h < 40 * 24; h++) {
    shut.runTo(shut.now + HOUR);
    advancePlace(shut, ps);
  }
  assert.ok(came(ps) > before, "opened, it takes in those its land brings");
});
