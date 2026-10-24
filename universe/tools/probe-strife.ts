// (scratch probe, not committed) strife across worlds: coups, restorations, juntas, legitimacy.
import { YEAR, seedFromText } from "../src/kernel/index.ts";
import { EARTH } from "../src/host/planet.ts";
import {
  armyOf,
  coupDanger,
  interestsOf,
  orderOf,
  politiesOf,
  populationContext,
  realmName,
  strifeOf,
  warsOf,
} from "../src/sim/index.ts";

const seeds = (process.argv[2] ?? "first light,juniper,kestrel").split(","),
  years = Number(process.argv[3] ?? 700);
for (const seed of seeds) {
  const world = EARTH.build(seedFromText(seed)),
    started = Date.now();
  let lastLine = "";
  for (let y = 100; y <= years; y += 100) {
    world.runTo(y * YEAR);
    const ctx = populationContext(world),
      strife = strifeOf(world)!,
      order = orderOf(world)!,
      living = politiesOf(world).living(),
      juntas = living.filter((p) => p.leadership === 4).length,
      legit = living.map((p) => order.of(p.ref)?.legitimacy ?? 0.6).sort((a, b) => a - b),
      dangers = living
        .map((p) => {
          const o = order.of(p.ref);
          return o ? coupDanger(ctx, p, o).score : 0;
        })
        .sort((a, b) => b - a),
      armies = living.map((p) => {
        const army = interestsOf(ctx, p, world.now).find((i) => i.group === "the army");
        return army?.sway ?? 0;
      }),
      low = legit.filter((l) => l < 0.45).length,
      over = dangers.filter((d) => d > 0.45).length,
      won = strife.coups.filter((c) => c.won).length,
      foiled = strife.coups.length - won;
    lastLine = `  y${y}: realms ${living.length}, juntas ${juntas}, coups ${won} won / ${foiled} foiled, restored ${strife.restorations.length}; low ${low} over ${over}; legit min ${legit[0]?.toFixed(2)} med ${legit[Math.floor(legit.length / 2)]?.toFixed(2)}; danger top ${dangers
      .slice(0, 4)
      .map((d) => d.toFixed(2))
      .join(
        " ",
      )}; army sway max ${Math.max(0, ...armies).toFixed(2)} mean ${(armies.reduce((a, b) => a + b, 0) / Math.max(1, armies.length)).toFixed(3)}; wars ${warsOf(world).all().length}`;
    const civil = (strife as any).civil ?? [],
      kinds: Record<string, number> = {},
      outs: Record<string, number> = {};
    for (const c of civil) {
      kinds[c.kind] = (kinds[c.kind] ?? 0) + 1;
      outs[c.outcome ?? "on"] = (outs[c.outcome ?? "on"] ?? 0) + 1;
    }
    const revs = (strife as any).revolutions ?? [],
      splits = world.events.all().filter((e) => e.type === "polity.split").length;
    lastLine += `; civil ${civil.length} ${JSON.stringify(kinds)} ${JSON.stringify(outs)}; revolutions ${revs.filter((r: any) => r.won).length} won / ${revs.filter((r: any) => !r.won).length} lost; splits ${splits}`;
    console.log(`${seed}${lastLine}`);
  }
  const ctx = populationContext(world),
    strife = strifeOf(world)!;
  for (const c of strife.coups.slice(0, 12)) {
    const p = politiesOf(world).get(c.realm)!;
    console.log(
      `    ${c.year} ${c.won ? "COUP" : "foiled"} ${c.was} (${c.general}) → ${realmName(p)} ${p.ended !== null ? `ended ${p.ended}` : ""} army ${armyOf(ctx, p).people}`,
    );
  }
  for (const r of strife.restorations.slice(0, 6))
    console.log(`    ${r.year} restored ${politiesOf(world).get(r.realm)?.town} after ${r.years}`);
  console.log(`  (${Math.round((Date.now() - started) / 1000)} s)`);
}
process.exit(0);
