import { test } from "node:test";
import assert from "node:assert/strict";
import { YEAR, seedFromText, type Ref } from "../../src/kernel/index.ts";
import {
  GROUPS,
  POLITY_EVENTS,
  interestsOf,
  makePopulationWorld,
  politiesOf,
  populationContext,
  swayOf,
} from "../../src/sim/index.ts";
import { why } from "../../src/causal/index.ts";

const PEOPLE = { farmers: 5000, herders: 800, crafters: 400, traders: 120, "the court": 60 };
const [CHIEF, COUNCIL, ASSEMBLY, PRIEST] = [0, 1, 2, 3];

test("sway is shared among the groups, weighed by who leads", () => {
  for (const leadership of [CHIEF, COUNCIL, ASSEMBLY, PRIEST]) {
    const s = swayOf(PEOPLE, leadership, 0.7, true, true);
    const total = GROUPS.reduce((a, g) => a + s[g], 0);
    assert.ok(Math.abs(total - 1) < 1e-9, `shares sum to one (${total})`);
  }
  const assembly = swayOf(PEOPLE, ASSEMBLY, 0.5, false, false),
    council = swayOf(PEOPLE, COUNCIL, 0.5, false, false),
    priest = swayOf(PEOPLE, PRIEST, 0.75, true, true);
  assert.ok(assembly.farmers > council.farmers, "an assembly hears the many");
  assert.ok(council["the court"] > assembly["the court"], "a council of elders, the few who lead");
  assert.ok(priest["the temple"] > assembly["the temple"], "a priest-king, the temple");
  assert.equal(assembly["the temple"], 0, "no faith, no temple");
});

const world = makePopulationWorld(seedFromText("kestrel"), { start: "spread" });
world.runTo(400 * YEAR);
const ctx = populationContext(world);

test("every realm's groups make demands that rest on something in the world", () => {
  const realms = politiesOf(world).living();
  assert.ok(realms.length >= 3);
  let sourced = 0,
    demands = 0;
  for (const p of realms)
    for (const i of interestsOf(ctx, p, world.now))
      for (const d of i.demands) {
        demands++;
        assert.ok(d.strength > 0 && d.strength <= 1);
        if (d.want === "peace" || d.want === "war")
          assert.ok(d.toward, "peace or war with someone");
        if (d.source) {
          sourced++;
          assert.ok(world.events.get(d.source), `${d.name} rests on a kept event`);
        }
      }
  assert.ok(sourced >= demands * 0.9, `${sourced} of ${demands} demands rest on something`);
});

test("the tithe moves with what the groups want: raised for war, eased when it is over", () => {
  const moves = world.events.all().filter((e) => e.type === POLITY_EVENTS.tithe.type);
  assert.ok(moves.length >= 10, `${moves.length} changes of tithe`);
  let raisedForWar = 0;
  for (const e of moves) {
    const d = world.decisions.get(e.causes[0]!.ref as Ref)!,
      { from, to } = e.data as { from: number; to: number };
    assert.equal(d.rule, "polity.tithe");
    assert.ok(Math.abs(to - from) >= 2 && to >= 2 && to <= 15, `${from} → ${to}`);
    assert.ok(
      d.factors.some((f) => (to > from ? f.contribution > 0 : f.contribution < 0)),
      "a demand pressed the way it moved",
    );
    if (
      to > from &&
      d.factors.some(
        (f) => f.source && world.events.get(f.source.ref as Ref)?.type === "war.declared",
      )
    )
      raisedForWar++;
    assert.match(why(world, e.id).claim, /(raised|eased) its tithe from \d+ to \d+ parts/);
  }
  assert.ok(raisedForWar >= 1, "some tithe was raised for a war");
  for (const p of politiesOf(world).living()) assert.ok(p.tribute >= 0.02 && p.tribute <= 0.15);
});
