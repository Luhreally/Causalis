// node tools/w5-measure.ts [--years n] [--teach] file.save ...: the greatest fire, measured by forking far saves. Nothing is forced:
// each fork runs under these rules from where its save stood. Wars between holders per century against others' come from the same run.
import { readFileSync } from "node:fs";
import { gunzipSync } from "node:zlib";
import { YEAR, loadWorld, rulesetId, seedFromText } from "../src/kernel/index.ts";
import { meansNumbers } from "../src/gen/index.ts";
import { ALIEN, EARTH } from "../src/host/planet.ts";
import { FIRE_ID, fireName, fireShutBy, principle, type Principle } from "../src/rules/index.ts";
import {
  fireOf,
  loreOf,
  machinesOf,
  politiesOf,
  populationContext,
  warsOf,
} from "../src/sim/index.ts";

const argv = process.argv.slice(2),
  yearsAt = argv.indexOf("--years"),
  years = yearsAt >= 0 ? Number(argv[yearsAt + 1]) : 100,
  files = argv.filter((a, i) => !a.startsWith("--") && !(yearsAt >= 0 && i === yearsAt + 1));

for (const file of files) {
  const u = /earth--/.test(file) ? EARTH : ALIEN,
    doc = JSON.parse(gunzipSync(readFileSync(file)).toString("utf8")) as Parameters<
      typeof loadWorld
    >[0],
    probe = u.build(seedFromText(doc.seed)),
    world = loadWorld(doc, (s) => u.build(s), rulesetId(probe, u.version), {
      allowRulesetChange: true,
    }).world,
    ctx = populationContext(world),
    n = meansNumbers(ctx.generated),
    shut = fireShutBy(n),
    name = file.split(/[\\/]/).pop()!.replace(".save", "");
  const start = Math.floor(world.now / YEAR),
    fire = fireOf(world),
    wars = warsOf(world),
    realms = politiesOf(world),
    lore = loreOf(world);
  void principle as unknown as Principle;
  const people = () => ctx.provinces.all().reduce((s, p) => s + p.total(), 0),
    before = people();
  let holderWars = 0,
    otherWars = 0,
    holderPairYears = 0,
    otherPairYears = 0,
    ms = 0,
    firstKnown: number | null = null,
    least = before;
  const counted = new Set<string>(),
    dark: number[] = [];
  for (const w of wars.hot()) counted.add(w.ref);
  for (let y = 0; y < years; y++) {
    const t0 = performance.now();
    world.runTo(world.now + YEAR);
    ms += performance.now() - t0;
    const year = Math.floor(world.now / YEAR);
    if (firstKnown === null && realms.living().some((p) => lore.get(p.seat, FIRE_ID)))
      firstKnown = year;
    const held = new Set(fire.holders().map((h) => h.realm)),
      living = realms.living().length;
    holderPairYears += (held.size * (held.size - 1)) / 2;
    // (The same class, not holding: realms rich enough to pay for one, in pairs not both holders.)
    const list = realms.living().map((p) => ({ p, m: machinesOf(ctx, p) })),
      most = list.reduce((x, r) => Math.max(x, r.m), 0),
      rich = new Set(
        list.filter((r) => r.m >= 0.25 * most || held.has(r.p.ref)).map((r) => r.p.ref),
      );
    otherPairYears += (rich.size * (rich.size - 1)) / 2 - (held.size * (held.size - 1)) / 2;
    void living;
    for (const w of wars.hot()) {
      if (counted.has(w.ref)) continue;
      counted.add(w.ref);
      if (w.civil) continue;
      if (held.has(w.attacker) && held.has(w.defender)) holderWars++;
      else if (rich.has(w.attacker) && rich.has(w.defender)) otherWars++;
    }
    if (fire.state.soot >= 0.05) dark.push(year);
    least = Math.min(least, people());
  }
  const s = fire.state,
    stepped = s.crises.filter((c) => c.end === "stepped").length,
    fell = s.crises.filter((c) => c.end === "fell").length,
    gone = s.crises.filter((c) => c.end === "gone").length,
    open = s.crises.filter((c) => c.ended === null).length,
    brink = s.crises.filter((c) => c.war === null).length,
    holders = fire.holders().length,
    realmYears = (n2: number) => (n2 * 100) / years;
  console.log(
    JSON.stringify({
      name,
      from: start,
      years,
      shut,
      arm: fireName(n),
      metals: Math.round(n.metalShare * 100) / 100,
      knownFirst: firstKnown,
      realms: realms.living().length,
      begun: s.works.length,
      holders,
      firstHeld: s.works.find((w) => w.done !== null)?.done ?? null,
      crises: s.crises.length,
      stepped,
      fell,
      gone,
      open,
      brink,
      falls: s.falls.length,
      fallsPerHolderCentury: holders
        ? Math.round((s.falls.length / holders) * (100 / years) * 100) / 100
        : 0,
      crisesPerCentury: Math.round(realmYears(s.crises.length) * 10) / 10,
      fallDead: s.falls.map((f) => f.dead),
      fallHomes: s.falls.map((f) => f.homes),
      windDead: s.falls.map((f) => f.windDead),
      soot: s.falls.map((f) => f.soot),
      darkYears: dark.length,
      dread: Math.round(s.dread * 100) / 100,
      warsBetweenHolders: holderWars,
      warsOther: otherWars,
      holderWarRate: holderPairYears
        ? Math.round((holderWars / holderPairYears) * 1e5) / 1000
        : null,
      otherWarRate: otherPairYears ? Math.round((otherWars / otherPairYears) * 1e5) / 1000 : null,
      people: [Math.round(before / 1e6), Math.round(least / 1e6), Math.round(people() / 1e6)],
      msAYear: Math.round(ms / years),
    }),
  );
}
process.exit(0);
