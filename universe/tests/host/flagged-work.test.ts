// One a town names at a trade, and its healer, is at that work on its working days (view/errands.ts townDay, view/village.ts):
// never sent to the fields, the woods, the mine, a building site or the school because the yard was empty or no one was
// wounded. First light three hundred years on, spread: forty towns, each one flagged looked at mid-morning and
// mid-afternoon on five days of the year.
import { test } from "node:test";
import assert from "node:assert/strict";
import type { Ref } from "../../src/kernel/index.ts";
import { populationContext } from "../../src/sim/index.ts";
import { villagePlan } from "../../src/host/village.ts";
import { momentOf } from "../../src/view/index.ts";
import { peopledWorld } from "../worlds.ts";

const world = peopledWorld("first light", 300, { start: "spread" }),
  towns = populationContext(world)
    .settlements.all()
    .filter((t) => t.population > 0),
  day0 = Math.floor(world.now / 86_400);

/** Work that is another's: the fields' year, the woods, the diggings, a site, the school, the flock, the wild. */
const OTHERS =
  /Hoeing|Sowing|Reaping|stubble|Watering|parched|Pulling|Plough|muck|Felling|far woods|timber|Digging|To the mine|Raising|beam|Teaching|Herding|Gathering|Fishing|firewood|slack season|village's business|Cutting stone/;
/** Each one's own, as their day says it. */
const OWN: Readonly<Record<string, RegExp>> = {
  healer: /healed|herbs|wounded|Tending|Dressing|salve/,
  smith:
    /Casting|Forging|Hammering|hammering|Mending and sharpening|smithy|forge|rack|anvil|At their craft/,
  potter: /wheel|kiln|boards|pots/,
  weaver: /loom|Weaving|cloth/,
  founder: /foundry|mould|Casting|Pouring/,
  machinist: /machine|works|lathe/,
};

test("a town's named makers and its healer spend their working hours at that work, and never at another's", () => {
  const seen = new Map<string, { own: number; all: number }>(),
    wrong: string[] = [];
  let flagged = 0;
  for (const t of towns.slice(0, 40)) {
    const plan = villagePlan(world, t.ref as Ref, undefined, 120);
    plan.people.forEach((p, i) => {
      const kind = p.healer ? "healer" : p.trade?.kind;
      if (!kind) return;
      flagged++;
      for (const d of [3, 40, 100, 200, 300])
        for (const h of [10.5, 15]) {
          const m = momentOf(plan, i, (day0 + d) * 86_400 + h * 3600),
            why = m.why ?? "";
          if (OTHERS.test(why)) wrong.push(`${t.ref} ${p.name} (${kind}), day +${d} ${h}h: ${why}`);
          // (A day of rest, prayer, a burial, a feast, the court, a wound: no day of work.)
          if (
            !why ||
            /prayer|grave|feast|court|Before |wound|abed|market|bread|Home |Back to/.test(why)
          )
            continue;
          const s = seen.get(kind) ?? { own: 0, all: 0 };
          s.all++;
          if (OWN[kind]?.test(why)) s.own++;
          seen.set(kind, s);
        }
    });
  }
  assert.deepEqual(wrong.slice(0, 12), [], `${wrong.length} at another's work`);
  assert.ok(flagged >= 40, `${flagged} flagged`);
  assert.ok(seen.has("healer") && seen.has("smith"), [...seen.keys()].join(", "));
  for (const [kind, s] of seen)
    assert.ok(
      s.own >= 0.9 * s.all,
      `${kind}: at their own work ${s.own} of ${s.all} working moments`,
    );
});
