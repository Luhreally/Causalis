// node tools/life-starts.ts [from=0] [to=300]: whether life starts on the open worlds (B5 of the life plan), each made
// twice, as the old tables kept it ("~bodies kept") and as its own places, energy and time give it; the odds, the draw,
// and what a lifeless world lacked. It reads only: no world is run.
import { seedFromText } from "../src/kernel/index.ts";
import { generateHomeWorld, homeOrigin, worldKindOf } from "../src/gen/index.ts";
import { OPEN, lifeDraw, lifeOdds } from "../src/rules/index.ts";
import { protoGround, protoLiquidWhy } from "../src/gen/index.ts";

const nums = process.argv.slice(2).filter((a) => /^\d+$/.test(a)).map(Number),
  from = nums[0] ?? 0,
  to = nums[1] ?? 300;
const tally = new Map<string, number>(),
  why = new Map<string, number>(),
  add = (m: Map<string, number>, k: string) => m.set(k, (m.get(k) ?? 0) + 1);
let before = 0,
  after = 0;
for (let i = from; i < to; i++) {
  const seed = `alien ${i}`,
    kept = generateHomeWorld(seedFromText(`${seed} ~bodies kept`), OPEN, 16),
    g = generateHomeWorld(seedFromText(seed), OPEN, 16),
    was = kept.life.species.length > 0,
    is = g.life.species.length > 0,
    odds = lifeOdds(protoGround(g as never), protoLiquidWhy(g));
  if (was) before++;
  if (is) after++;
  add(tally, `${worldKindOf(g)} ${was ? "lived" : "lifeless"} → ${is ? "lives" : "lifeless"}`);
  if (!is) add(why, odds.lacks ?? `never quickened (odds ${Math.round(odds.odds * 100)}%)`);
  if (process.argv.includes("--each"))
    console.log(`${seed} ${worldKindOf(g)}: ${was ? "lived" : "lifeless"} → ${is ? "lives" : "lifeless"}; odds ${odds.odds.toFixed(3)} draw ${lifeDraw(seed).toFixed(3)}; ${odds.words}`);
  void homeOrigin;
}
const sorted = (m: Map<string, number>) =>
  [...m].sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k} ${v}`).join("; ");
console.log(`alien ${from}..${to - 1} at grid 16: with life ${before} as kept, ${after} as read`);
console.log(sorted(tally));
console.log(`lifeless, why: ${sorted(why)}`);
