// node tools/finance-tally.ts <year> [seeds...]: a world's money and fears read over its whole history (sim/finance). For each seed,
// run to the year: the yields its realms paid (their range, each century), the debts sold and refused, who holds whom at the end (the
// matrix's shape), the greatest fears and whether two camps stand, and the turning points' years (for the pacing: tools/calibration-bands.ts).
// A seed "earth:<text>" is Earth's prior, any other the open. `--json <file>` writes the report. Pure reading; it changes nothing.
import { writeFileSync } from "node:fs";
import {
  YEAR,
  codeOf,
  seedFromText,
  yearOfMoment,
  type Ref,
  type World,
} from "../src/kernel/index.ts";
import {
  EARTHLIKE,
  FINANCE,
  LOSERS,
  OPEN,
  campsOf,
  campsStand,
  ownWords,
  wayWords,
  type CampRealm,
} from "../src/rules/index.ts";
import * as sim from "../src/sim/index.ts";
import { TURNS } from "./calibration-bands.ts";

const args = process.argv.slice(2),
  jsonAt = args.indexOf("--json"),
  json = jsonAt >= 0 ? args.splice(jsonAt, 2)[1] : null,
  last = Number(args[0] ?? 900),
  seeds = args.length > 1 ? args.slice(1) : ["earth:first light"];

const pc = (x: number) => `${(x / 100).toFixed(1)}%`;
const report: unknown[] = [];

/** A world's camps now, read as the pages read them. */
export function campsNow(world: World) {
  const ctx = sim.populationContext(world),
    store = sim.financeOf(world),
    realms = sim.politiesOf(world).living(),
    nodes: CampRealm[] = realms.map((p) => ({
      ref: p.ref,
      way: sim.wayOf(world, p.ref),
      people: p.members.reduce((n, c) => n + (ctx.provinces.get(c)?.total() ?? 0), 0),
      fears: (store?.of(p.ref)?.fears ?? []).map((f) => ({ of: f.of, level: f.level / 100 })),
      sworn: sim
        .diplomacyOf(world)
        .of(p.ref)
        .filter((r) => r.pact)
        .map((r) => (r.a === p.ref ? r.b : r.a)),
    }));
  return { nodes, camps: campsOf(nodes) };
}

for (const s of seeds) {
  const earth = s.startsWith("earth:"),
    text = earth ? s.slice(6) : s,
    world = sim.makePopulationWorld(seedFromText(text), {
      prior: earth ? EARTHLIKE : OPEN,
      start: "spread",
    }),
    ctx = sim.populationContext(world),
    store = sim.financeOf(world)!,
    name = (r: string) => {
      const p = sim.politiesOf(world).get(r as Ref);
      return p ? sim.realmName(p) : r;
    },
    t0 = performance.now(),
    turns = new Map<string, number>(),
    counts: Record<string, number> = {},
    centuries: string[] = [],
    campYears: number[] = [],
    backed: string[] = [],
    refusedBy: string[] = [];
  let read = 0,
    lo = Infinity,
    hi = 0,
    cLo = Infinity,
    cHi = 0,
    cFear = 0,
    campsEver = 0;
  console.log(`\n== ${s} to year ${last}`);
  for (let y = 1; y <= last; y++) {
    world.runTo(y * YEAR);
    const log = world.events;
    let top = read;
    for (let i = log.count - 1; i >= 0; i--) {
      const e = log.at(i),
        code = codeOf(e.id);
      if (code <= read) break;
      if (code > top) top = code;
      if (e.type.startsWith("finance.") || e.type === "credit.defaulted")
        counts[e.type] = (counts[e.type] ?? 0) + 1;
      if (e.type === "finance.refused")
        refusedBy.push(`${(e.data as { realm: string }).realm} (${yearOfMoment(e.t)})`);
      if (e.type === "finance.sold" && (e.data as { backer?: string }).backer) {
        const d = e.data as { backer: string; realm: string; foe?: string };
        backed.push(`${d.backer} paid for ${d.realm} against ${d.foe ?? "?"} (${yearOfMoment(e.t)})`);
      }
      for (const turn of TURNS)
        if (!turns.has(turn.id)) {
          if (turn.event && e.type === turn.event) turns.set(turn.id, yearOfMoment(e.t));
          else if (
            turn.principle &&
            (e.data as { principle?: string } | null)?.principle === turn.principle
          )
            turns.set(turn.id, yearOfMoment(e.t));
        }
    }
    read = top;
    for (const m of store.all()) {
      if (m.rate <= 0 || !sim.loreOf(world).get(sim.politiesOf(world).get(m.realm)!.seat, "banking"))
        continue;
      lo = Math.min(lo, m.rate);
      hi = Math.max(hi, m.rate);
      cLo = Math.min(cLo, m.rate);
      cHi = Math.max(cHi, m.rate);
    }
    for (const m of store.all()) cFear = Math.max(cFear, m.fears[0]?.level ?? 0);
    if (y % 10 === 0) {
      const c = campsNow(world).camps;
      if (campsStand(c)) {
        campsEver++;
        campYears.push(y);
      }
    }
    if (y % 100 === 0) {
      const all = store.all(),
        owing = all.filter((m) => sim.debtOf(m) > 0).length,
        feared = all.filter((m) => (m.fears[0]?.level ?? 0) >= FINANCE.feared * 100).length;
      centuries.push(
        `  year ${y}: ${sim.politiesOf(world).living().length} realms, ${owing} owing, yields ${cLo === Infinity ? "—" : `${pc(cLo)}–${pc(cHi)}`}, top fear ${cFear}, ${feared} fearing, ${Math.round(performance.now() - t0) / 1000}s`,
      );
      console.log(centuries.at(-1));
      cLo = Infinity;
      cHi = 0;
      cFear = 0;
    }
  }
  // At the end.
  const all = store.all(),
    holdings = all.flatMap((m) => m.shares.map(([q, n]) => ({ of: m.realm, by: q, n }))),
    debts = all.flatMap((m) => m.held.map(([q, n]) => ({ of: m.realm, by: q, n }))),
    fears = all
      .flatMap((m) => m.fears.map((f) => ({ m, f })))
      .sort((a, b) => b.f.level - a.f.level)
      .slice(0, 6),
    { nodes, camps } = campsNow(world),
    people = nodes.reduce((n, r) => n + r.people, 0);
  console.log(
    `  events: ${Object.entries(counts)
      .map(([k, v]) => `${k} ${v}`)
      .join(", ")}`,
  );
  console.log(`  yields over all years: ${lo === Infinity ? "none sold" : `${pc(lo)} to ${pc(hi)}`}`);
  console.log(`  refused: ${refusedBy.length ? refusedBy.slice(0, 8).join("; ") : "none"}`);
  console.log(
    `  who holds whom at ${last}: ${all.length} realms; shares held abroad in ${new Set(holdings.map((h) => h.of)).size} realms by ${new Set(holdings.map((h) => h.by)).size} peoples (${holdings.length} holdings, the greatest ${holdings.length ? pc(Math.max(...holdings.map((h) => h.n))) : "—"}); debt held abroad of ${new Set(debts.map((h) => h.of)).size} realms (${debts.length} holdings)`,
  );
  for (const h of [...holdings].sort((a, b) => b.n - a.n).slice(0, 5))
    console.log(`    the people of ${name(h.by)} hold ${pc(h.n)} of ${name(h.of)}'s listed worth`);
  for (const h of [...debts].sort((a, b) => b.n - a.n).slice(0, 5))
    console.log(`    the people of ${name(h.by)} hold ${h.n} of ${name(h.of)}'s debt`);
  console.log(`  the greatest fears at ${last}:`);
  for (const { m, f } of fears)
    console.log(
      `    ${name(m.realm)} of ${name(f.of)}: ${f.level} (unlike ${f.unlike}, works ${f.works}, exposed ${f.exposed}, loss ${f.loss}: ${LOSERS[f.who]}); ${wayWords(sim.wayOf(world, m.realm))} / ${wayWords(sim.wayOf(world, f.of))}`,
    );
  if (camps)
    console.log(
      `  camps at ${last}: ${name(camps.poles[0])} (${camps.camps[0].length}) against ${name(camps.poles[1])} (${camps.camps[1].length}), ${camps.apart.length} apart, fear between them ${camps.fear.toFixed(2)}; stand: ${campsStand(camps)}`,
    );
  else console.log(`  camps at ${last}: none`);
  console.log(
    `  camps stood in ${campsEver} of ${Math.floor(last / 10)} decades read${campYears.length ? ` (first ${campYears[0]}, last ${campYears.at(-1)})` : ""}`,
  );
  console.log(`  wars paid for by a third who feared the foe: ${backed.length}${backed.length ? `: ${backed.slice(0, 4).join("; ")}` : ""}`);
  const owns = all.map((m) => ownWords(m.own.map((x) => x / 100), ctx.generated.life.people?.body)),
    ownCount = new Map<string, number>();
  for (const o of owns) ownCount.set(o, (ownCount.get(o) ?? 0) + 1);
  console.log(`  how wealth is owned: ${[...ownCount].map(([k, v]) => `${v} ${k}`).join("; ")}`);
  console.log(
    `  turning points: ${TURNS.map((t) => `${t.id} ${turns.get(t.id) ?? "—"}${turns.has(t.id) && (turns.get(t.id)! < t.band[0] || turns.get(t.id)! > t.band[1]) ? "!" : ""}`).join(", ")}; people ${people}`,
  );
  report.push({
    seed: s,
    year: last,
    counts,
    yields: lo === Infinity ? null : [lo, hi],
    refused: refusedBy,
    holdings: holdings.length,
    debts: debts.length,
    fears: fears.map(({ m, f }) => ({ realm: name(m.realm), feared: name(f.of), level: f.level, who: LOSERS[f.who] })),
    camps: camps
      ? { poles: camps.poles.map(name), sizes: camps.camps.map((c) => c.length), apart: camps.apart.length, stand: campsStand(camps) }
      : null,
    campsEver,
    backed,
    turns: Object.fromEntries(turns),
    people,
    centuries,
  });
}
if (json) writeFileSync(json, JSON.stringify(report, null, 1));
