// One a town names at a trade, and its healer, is at that work on its working days (view/errands.ts townDay, view/village.ts):
// never sent to the fields, the woods, the mine, a building site or the school because the yard was empty or no one was
// wounded. First light three hundred years on, spread: forty towns (the first twenty, and the first twenty whose land
// forges metal: most of its towns at 300 work stone, where a smith is at their craft by the market), each one flagged looked
// at mid-morning and mid-afternoon on five days of the year.
import { test } from "node:test";
import assert from "node:assert/strict";
import type { Ref } from "../../src/kernel/index.ts";
import { forgedMetal, populationContext } from "../../src/sim/index.ts";
import { villagePlan } from "../../src/host/village.ts";
import { momentOf } from "../../src/view/index.ts";
import { peopledWorld } from "../worlds.ts";

const world = peopledWorld("first light", 300, { start: "spread" }),
  ctx = populationContext(world),
  peopled = ctx.settlements.all().filter((t) => t.population > 0),
  forging = peopled.filter((t, i) => i >= 20 && forgedMetal(ctx, t.cell) !== "stone").slice(0, 20),
  towns = [...peopled.slice(0, 20), ...forging],
  day0 = Math.floor(world.now / 86_400);

/** Work that is another's: the fields' year, the woods, the diggings, a site, the school, the flock, the wild. */
const OTHERS =
  /Hoeing|Sowing|Reaping|stubble|Watering|parched|Pulling|Plough|muck|Felling|far woods|timber|Digging|To the mine|Raising|beam|Teaching|Herding|Gathering|Fishing|firewood|slack season|village's business|Cutting stone/;
/** Each one's own, as their day says it (a maker whose building does not stand, or a smith whose land forges nothing, is
 * at their craft by the market). */
const OWN: Readonly<Record<string, RegExp>> = {
  healer: /healed|herbs|wounded|Tending|Dressing|salve/,
  // (Bronze is cast: poured in its mould.)
  smith:
    /Casting|Forging|Hammering|hammering|Mending and sharpening|smithy|forge|rack|anvil|Pouring|mould|to melt|At their craft/,
  potter: /wheel|kiln|boards|pots/,
  weaver: /loom|Weaving|cloth/,
  founder: /foundry|mould|Casting|Pouring/,
  machinist: /machine|works|lathe/,
};

/** A smith at the forge itself. */
const FORGE =
  /Casting|Forging|Hammering|hammering|Mending and sharpening|smithy|forge|anvil|Pouring|mould/;

test("a town's named makers and its healer spend their working hours at that work, and never at another's", () => {
  const seen = new Map<string, { own: number; all: number }>(),
    wrong: string[] = [];
  let flagged = 0,
    forged = 0;
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
          const own = !!OWN[kind]?.test(why) || (kind !== "healer" && /^At their craft/.test(why));
          // (A day of rest, prayer, a burial, a feast, the court, a wound, an errand to market: no hour of work.)
          if (
            !own &&
            (!why ||
              /prayer|grave|feast|court|Before |wound|abed|market|bread|Home |Back to/.test(why))
          )
            continue;
          const s = seen.get(kind) ?? { own: 0, all: 0 };
          s.all++;
          if (own) s.own++;
          if (kind === "smith" && FORGE.test(why)) forged++;
          seen.set(kind, s);
        }
    });
  }
  assert.deepEqual(wrong.slice(0, 12), [], `${wrong.length} at another's work`);
  assert.ok(flagged >= 40, `${flagged} flagged`);
  assert.equal(forging.length, 20, "twenty towns whose land forges metal");
  assert.ok(seen.has("healer") && seen.has("smith"), [...seen.keys()].join(", "));
  assert.ok(forged >= 10, `${forged} of a smith's working moments at the forge`);
  for (const [kind, s] of seen)
    assert.ok(
      s.own >= 0.9 * s.all,
      `${kind}: at their own work ${s.own} of ${s.all} working moments`,
    );
});
