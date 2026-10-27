// node tools/probe-placed.ts [seeds] [year] — the battles at the turn fought before their towns
// (Phase 55 M227), in no page: of the year before's battles fought on a land, at each setting's
// detail, the figures laid to a side, how many of them the roll names, the falls and the wounded
// against the one rule (bridge/roll.ts battleFigures), and what asking the roll and laying the field
// cost (the plan's budgets: the roll within 30 ms, the field with its blows and its names within 15).
import { YEAR, seedFromText } from "../src/kernel/index.ts";
import { EARTH } from "../src/host/planet.ts";
import { battleFigures, type BattleNear, type BattleRoll } from "../src/bridge/index.ts";
import { PLACED_MOST, newBattle, newBlows, rollNames } from "../src/view/index.ts";

const seeds = (process.argv[2] ?? "first light").split(","),
  year = Number(process.argv[3] ?? 365);
type Fought = { event: string; year: number; spot: number; fallen: number };
for (const seed of seeds) {
  const world = EARTH.build(seedFromText(seed)),
    began = performance.now();
  world.runTo(year * YEAR);
  const ask = <T>(type: string, args: unknown) => EARTH.queries[type]!(world, args) as T,
    map = ask<{ wars: { battles: Fought[] }[] }>("wars.map", {}),
    fought = map.wars.flatMap((w) => w.battles.filter((b) => b.year === year - 1 && b.spot >= 0));
  console.log(
    `${seed}: ${fought.length} battles of year ${year - 1} fought on a land, at the turn of year ${year} (${((performance.now() - began) / 1000).toFixed(1)} s to make)`,
  );
  let worstRoll = 0,
    worstLay = 0,
    named = 0,
    drawn = 0,
    astray = 0;
  for (const b of fought) {
    const near = ask<BattleNear | null>("battle.near", { event: b.event });
    if (!near) continue;
    const cells: string[] = [];
    for (const [d, most] of PLACED_MOST.entries()) {
      const t0 = performance.now(),
        roll = ask<BattleRoll | null>("battle.roll", { event: b.event, most }),
        t1 = performance.now();
      if (!roll) {
        cells.push(`d${d}: no roll`);
        astray++;
        continue;
      }
      const field = newBattle(near, most, true),
        blows = newBlows(field),
        names = rollNames(field, blows, roll),
        t2 = performance.now(),
        rule = battleFigures(near, most),
        n = names.filter((e) => e !== null).length,
        wrong = ([0, 1] as const).filter((s) => {
          const falls = field.troopers.filter((t) => t.side === s && t.falls !== null).length,
            side = rule.sides[s];
          return falls !== side.falls || blows.hurt[s] !== side.hurt;
        });
      worstRoll = Math.max(worstRoll, t1 - t0);
      worstLay = Math.max(worstLay, t2 - t1);
      named += n;
      drawn += field.troopers.length;
      astray += wrong.length;
      cells.push(
        `d${d}: ${field.hosts[0].n}/${field.hosts[1].n} figures, ${n} named, roll ${(t1 - t0).toFixed(1)} ms, field ${(t2 - t1).toFixed(1)} ms${wrong.length ? ` — side ${wrong.join(", ")} off the rule` : ""}`,
      );
    }
    console.log(
      `  ${near.title} (${b.event}): ${near.attacker.fielded} against ${near.defender.fielded}, ${b.fallen} fell\n    ${cells.join("\n    ")}`,
    );
  }
  console.log(
    `  named ${named} of ${drawn} figures (${drawn ? ((100 * named) / drawn).toFixed(1) : "–"}%); off the rule ${astray}; slowest roll ${worstRoll.toFixed(1)} ms (budget 30), slowest field ${worstLay.toFixed(1)} ms (budget 15)`,
  );
}
