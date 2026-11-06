// node tools/w7-tally.ts [--from file.save] [--universe earth|alien] [--seed text] [--to year] [--lines n]: a whole run read
// for its worst (W7): wars of each aim, peaces of each term, how long a vassal lasts, the largest tribute against what its
// payer makes, the longest chain of overlords, the share of realms bound at the end; a sample of real lines.
import { readFileSync } from "node:fs";
import { gunzipSync } from "node:zlib";
import {
  YEAR,
  loadWorld,
  rulesetId,
  saveWorld,
  seedFromText,
  type World,
} from "../src/kernel/index.ts";
import { ALIEN, EARTH } from "../src/host/planet.ts";
import { claimOf } from "../src/host/inspect/words.ts";
import {
  aimOf,
  bondsOf,
  grainMade,
  politiesOf,
  populationContext,
  warsOf,
  type PeaceTerms,
} from "../src/sim/index.ts";

const argv = process.argv.slice(2),
  arg = (name: string) => {
    const at = argv.indexOf(name);
    return at >= 0 ? argv[at + 1] : undefined;
  },
  file = arg("--from"),
  universe = arg("--universe") ?? (file?.includes("earth--") ? "earth" : "alien"),
  u = universe === "earth" ? EARTH : ALIEN,
  seed = arg("--seed") ?? "first light",
  to = Number(arg("--to") ?? 800),
  lines = Number(arg("--lines") ?? 0);
const started = performance.now();
let world: World;
if (file) {
  const doc = JSON.parse(gunzipSync(readFileSync(file)).toString("utf8")) as Parameters<
    typeof loadWorld
  >[0];
  world = loadWorld(doc, (s) => u.build(s), rulesetId(u.build(seedFromText(doc.seed)), u.version), {
    allowRulesetChange: true,
  }).world;
} else world = u.build(seedFromText(seed));
const startYear = Math.floor(world.now / YEAR),
  aims = new Map<string, number>(),
  terms = new Map<string, number>(),
  ended = new Map<string, number>(),
  note = (m: Map<string, number>, k: string) => m.set(k, (m.get(k) ?? 0) + 1);
let worstTribute = 0,
  worstAt = "",
  worstVassalShare = 0,
  worstChain = 0,
  worstOwed = 0,
  worstOwedAt = "",
  mostOf = 0;
const lived: number[] = [],
  sinceOath = new Map<string, number>(),
  sample: string[] = [];
const started2 = performance.now();
for (let y = startYear + 1; y <= to; y++) {
  world.runTo(y * YEAR);
  const bonds = bondsOf(world),
    ctx = populationContext(world),
    realms = politiesOf(world),
    living = realms.living().length;
  const vassals = bonds.vassals();
  if (living) worstVassalShare = Math.max(worstVassalShare, vassals / living);
  for (const b of bonds.all()) {
    const key = `${b.from}|${b.to}|${b.since}`;
    if (b.kind === "vassal" && !sinceOath.has(key)) sinceOath.set(key, y);
    if (b.kind === "vassal" && bonds.oathOf(b.to)) worstChain = Math.max(worstChain, 2);
    else if (b.kind === "vassal") worstChain = Math.max(worstChain, 1);
    if (b.grain <= 0) continue;
    const p = realms.get(b.from);
    if (!p || p.ended !== null) continue;
    const made = grainMade(ctx, p),
      share = made > 0 ? b.grain / made : 0;
    if (share > worstTribute) {
      worstTribute = share;
      worstAt = `${b.grain} of ${made} (${b.kind}), year ${y}`;
    }
  }
  const by = new Map<string, number>();
  for (const b of bonds.all()) if (b.grain > 0) by.set(b.from, (by.get(b.from) ?? 0) + 1);
  for (const [r, n] of by) {
    if (n > worstOwed) {
      worstOwed = n;
      worstOwedAt = `${r} year ${y}`;
    }
  }
  for (const b of bonds.all()) mostOf = Math.max(mostOf, bonds.vassalsOf(b.to).length);
}
const runMs = performance.now() - started2,
  wars = warsOf(world).all();
let warsSeen = 0;
for (const w of wars) {
  if (w.declared <= startYear) continue;
  warsSeen++;
  note(aims, w.civil ? `civil:${w.civil}` : (aimOf(world, w)?.aim ?? "none"));
  if (w.peace) {
    const t = (world.events.get(w.peace)?.data as { terms?: PeaceTerms } | null)?.terms;
    note(terms, t ? t.kind : w.civil ? "civil" : "(none)");
  }
}
const all = world.events.all();
for (let i = 0; i < all.length; i++) {
  const e = all[i]!;
  if (e.t <= startYear * YEAR) continue;
  if (e.type.startsWith("terms.")) {
    const d = e.data as { kind?: string; how?: string; years?: number } | null;
    note(ended, `${e.type}:${d?.kind ?? ""}:${d?.how ?? ""}`);
    if (d?.kind === "vassal" && d.years !== undefined) lived.push(d.years);
    if (e.type === "terms.rose" && d?.years !== undefined) lived.push(d.years);
  }
}
if (lines) {
  const types = [
    "war.declared",
    "war.peace",
    "terms.ended",
    "terms.unpaid",
    "terms.rose",
    "terms.sacked",
  ];
  const pick = all.filter((e) => e.t > startYear * YEAR && types.includes(e.type));
  const step = Math.max(1, Math.floor(pick.length / lines));
  for (let i = 0; i < pick.length && sample.length < lines; i += step)
    sample.push(claimOf(world, pick[i]!.id));
}
const realms = politiesOf(world),
  living = realms.living().length,
  save = JSON.stringify(saveWorld(world, rulesetId(world, u.version), { universe: u.name })).length,
  bondsNow = bondsOf(world).all();
console.log(
  JSON.stringify(
    {
      world: file ?? `${universe} ${seed}`,
      from: startYear,
      to,
      msPerYear: Math.round((runMs / Math.max(1, to - startYear)) * 100) / 100,
      living,
      warsSeen,
      warsPerCentury: Math.round((warsSeen / Math.max(1, to - startYear)) * 1000) / 10,
      aims: Object.fromEntries([...aims].sort()),
      terms: Object.fromEntries([...terms].sort()),
      endings: Object.fromEntries([...ended].sort()),
      vassalsNow: bondsNow.filter((b) => b.kind === "vassal").length,
      bondsNow: bondsNow.length,
      bondsBytes: JSON.stringify(bondsNow).length,
      saveBytes: save,
      worstVassalShare: Math.round(worstVassalShare * 1000) / 1000,
      worstChain,
      mostVassalsOfOne: mostOf,
      worstOwedAtOnce: worstOwed,
      worstOwedAt,
      worstTributeShare: Math.round(worstTribute * 1000) / 1000,
      worstTributeAt: worstAt,
      vassalYears: lived.length
        ? {
            n: lived.length,
            mean: Math.round(lived.reduce((a, b) => a + b, 0) / lived.length),
            max: Math.max(...lived),
          }
        : null,
      totalMs: Math.round(performance.now() - started),
    },
    null,
    1,
  ),
);
for (const s of sample) console.log(`LINE ${s}`);
