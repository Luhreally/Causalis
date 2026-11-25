// place-real.ts --load <save.gz> --town <ref|name> --from <year.frac> --days <n> [--step <hours>] [--act type:json --at <days>]
//               [--order 'place.respond:{"what":"quarantine","on":true}' ...] [--twin] [--run <year.frac>]
// Town mode on a real world: opens a place over a town of a kept world at a moment, watches it for so many days as the page
// would (a frame every step), and tells what the world's own count says struck it beside what the place told of its
// people. With --order, the orders are given before it is entered. With --twin, a second copy of the same save is run to
// the same moment unwatched (given the same orders) and the two worlds' hashes are compared. With --run, the world is
// then run on unwatched to that year and its town's and land's counts told (what an order came to).
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { gunzipSync } from "node:zlib";
import {
  DAY,
  HOUR,
  YEAR,
  loadWorld,
  rulesetId,
  seedFromText,
  type Ref,
  type World,
} from "../src/kernel/index.ts";
import { healthOf, heartOf, managedOf, populationContext, siegesOf } from "../src/sim/index.ts";
import { EARTH } from "../src/host/planet.ts";
import { strikesOn } from "../src/host/town.ts";
import { battlesOfYear, townTally } from "../src/host/burials.ts";
import { HAP, enterPlace, hapTold, placeTable, placesOf, targetTable } from "../src/host/place.ts";
import { dangersSheet, placeFrame } from "../src/host/placeplan.ts";
import { lifeOf } from "../src/sim/index.ts";

const args = process.argv.slice(2),
  arg = (name: string, or = ""): string => {
    const at = args.indexOf(`--${name}`);
    return at >= 0 ? (args[at + 1] ?? or) : or;
  },
  orders = args.flatMap((x, k) => (x === "--order" ? [args[k + 1]!] : []));
const doc = JSON.parse(gunzipSync(readFileSync(arg("load"))).toString("utf8"));
const open = (): World =>
  loadWorld(
    JSON.parse(JSON.stringify(doc)),
    (s) => EARTH.build(s),
    rulesetId(EARTH.build(seedFromText(doc.seed)), EARTH.version),
    { allowRulesetChange: true },
  ).world;
const hashOf = (w: World) =>
  createHash("sha1").update(JSON.stringify(w.domainHashes())).digest("hex").slice(0, 16);
const from = Number(arg("from")),
  days = Number(arg("days", "30")),
  step = Number(arg("step", "3"));
const w = open(),
  ctx = populationContext(w);
// (To the day before, so that an order is given a day before the moment asked.)
w.runTo(Math.round(from * YEAR) - DAY);
const want = arg("town"),
  s0 = ctx.settlements.get(want as Ref) ?? ctx.settlements.all().find((s) => s.name === want);
if (!s0) throw new Error(`no town ${want}`);
const town = s0.ref,
  cell = s0.cell,
  name = s0.name,
  land = ctx.provinces.get(cell)!;
const give = (world: World): void => {
  for (const o of orders) {
    const at = o.indexOf(":"),
      c = world.submit(o.slice(0, at), { town, ...JSON.parse(o.slice(at + 1)) });
    world.runTo(c.t);
  }
};
give(w);
w.runTo(Math.round(from * YEAR));
const pop0 = Math.round(ctx.settlements.get(town)!.population),
  land0 = land.total();
const place = enterPlace(w, town)!,
  n0 = place.people.n,
  t0 = w.now;
console.log(
  `${name} (${town}) at year ${(w.now / YEAR).toFixed(3)}: ${pop0} people of its land's ${land0}; the place keeps ${n0}. Orders: ${JSON.stringify(managedOf(w)?.get(town)?.held ?? [])}`,
);
const seenNotices = new Map<string, string>(),
  doing = new Map<string, number>();
let sickMost = 0,
  siegedTicks = 0,
  fieldsWhileSieged = 0,
  brigadeMost = 0;
// (An act of the world's own rules sent on its land a while into the watch, where no world brings one: --act, --at days.)
const act = arg("act"),
  actAt = Number(arg("at", "2")) * 24;
let sent = false;
for (let h = 0; h < days * 24; h += step) {
  if (act && !sent && h >= actAt) {
    sent = true;
    const at = act.indexOf(":"),
      c = w.submit(act.slice(0, at), { cell, village: town, ...JSON.parse(act.slice(at + 1)) });
    w.runTo(c.t);
    console.log(`Sent ${act.slice(0, at)} on day ${(h / 24).toFixed(2)}.`);
  }
  w.runTo(w.now + step * HOUR);
  const f = placeFrame(w, town, [])!;
  for (const x of f.notices)
    if (!seenNotices.has(x.key)) seenNotices.set(x.key, `day ${(h / 24).toFixed(1)}: ${x.words}`);
  const p = place.people;
  let sick = 0,
    out = 0,
    brigade = 0;
  for (let i = 0; i < p.n; i++) {
    if (p.health[i] === 2) sick++;
    if (p.at[i] === -2 || p.to[i] === -2) out++;
    if (p.act[i] === 13) brigade++;
  }
  sickMost = Math.max(sickMost, sick);
  brigadeMost = Math.max(brigadeMost, brigade);
  if (place.matched.sieged) {
    siegedTicks++;
    fieldsWhileSieged = Math.max(fieldsWhileSieged, out);
  }
  if (h % 24 === 0 && (h / 24) % Math.max(1, Math.floor(days / 24)) === 0)
    doing.set(`day ${h / 24}`, sick);
}
// What the world says struck it in the time watched.
const strikes = strikesOn(w, town, land.ref, t0);
console.log(
  `The world's count of what struck it (host/town.ts strikesOn): ${JSON.stringify(strikes.map((k) => ({ kind: k.kind, day: +((k.at - t0) / DAY).toFixed(2), homes: k.homes, dead: k.dead ?? 0, hurt: k.hurt ?? 0 })))}`,
);
const sieges = siegesOf(w);
let siege = null;
if (sieges && !sieges.dormant())
  for (const war of sieges.wars()) if (sieges.of(war)!.land === cell) siege = sieges.of(war)!;
console.log(
  `The world's siege on its land now: ${siege ? JSON.stringify({ since: siege.since, months: +siege.months.toFixed(2), townDead: siege.townDead, heart: heartOf(ctx, cell)?.ref === town }) : "none"}; the place read a siege for ${siegedTicks} of ${Math.ceil((days * 24) / step)} frames, with at most ${fieldsWhileSieged} out to its fields then.`,
);
const last = healthOf(w)?.land(cell)?.last;
console.log(
  `The world's last sickness on its land: ${last ? JSON.stringify({ sickness: healthOf(w)!.get(last.sickness)?.name, year: last.year, dead: last.dead, share: +last.share.toFixed(4) }) : "none"}; most sick at once in the place ${sickMost}; sick by day ${JSON.stringify([...doing])}`,
);
const tally = new Map<string, number>();
for (const x of place.log) {
  const words = [HAP.born, HAP.came, HAP.left, HAP.trade, HAP.well].includes(x.what as never)
    ? hapTold(place, x).replace(/\d+/g, "N")
    : hapTold(place, x);
  tally.set(words, (tally.get(words) ?? 0) + 1);
}
console.log(
  `The place's log (${place.log.length} lines kept): ${JSON.stringify([...tally].sort((a, b) => b[1] - a[1]))}`,
);
console.log(`Notices seen: ${JSON.stringify([...seenNotices.values()])}`);
console.log(`Dangers now: ${JSON.stringify(dangersSheet(w, place).now.map((x) => x.words))}`);
console.log(
  `Most fighting a fire at once: ${brigadeMost}. Homeless: ${JSON.stringify(dangersSheet(w, place).homeless)}`,
);
const s1 = ctx.settlements.get(town)!,
  target = targetTable(w, s1, place),
  table = placeTable(place, lifeOf(w));
let off = 0;
for (let c = 0; c < target.length; c++) off += Math.abs(target[c]! - table[c]!);
console.log(
  `After ${days} days: town ${Math.round(s1.population)} (was ${pop0}), land ${land.total()} (was ${land0}), the place keeps ${place.people.n} (was ${n0}); its table differs from its town's by ${off} (ages crossing a band between matchings, and those waiting to be named: ${JSON.stringify(place.tolls)})`,
);
if (args.includes("--twin")) {
  const q = open();
  q.runTo(Math.round(from * YEAR) - DAY);
  give(q);
  q.runTo(w.now);
  console.log(
    `Unwatched twin: ${hashOf(q)}; watched: ${hashOf(w)}: ${hashOf(q) === hashOf(w) ? "the same" : "DIFFERENT"}; places kept in the twin: ${placesOf(q)?.places.length ?? 0}`,
  );
}
const run = Number(arg("run", "0"));
if (run > 0) {
  w.runTo(Math.round(run * YEAR));
  const s2 = ctx.settlements.get(town)!;
  const y = Math.floor(run) - 1;
  console.log(
    `Its land's years: ${JSON.stringify(
      ctx.history
        .yearsOf(cell)
        .slice(-3)
        .map((r) => ({ year: r.year, people: r.population, fed: r.fed })),
    )}; its land's dead in year ${y}: ${ctx.history.deathsIn(cell, y)}, in ${y - 1}: ${ctx.history.deathsIn(cell, y - 1)}`,
  );
  for (const yy of [y - 1, y])
    for (const { b } of battlesOfYear(w, yy))
      for (const side of [0, 1] as const) {
        const tt = townTally(w, b, side, town);
        if (tt && tt[0] > 0)
          console.log(
            `Battle of year ${yy} at land ${b.land}${b.land === cell ? " (its own)" : ""}: its side ${side === 0 ? "came against the land" : "held the land"}, ${b.won ? "the comers won" : "the holders won"}; fallen on the two sides ${JSON.stringify(b.fallen)}; of the town's men ${tt[0]} sent, ${tt[1]} fell, ${tt[2]} wounded`,
          );
      }
  console.log(
    `What struck it, all told: ${JSON.stringify(strikesOn(w, town, land.ref, t0).map((k) => ({ kind: k.kind, homes: k.homes, dead: k.dead ?? 0 })))}`,
  );
  console.log(
    `Run on to ${run}: town ${Math.round(s2.population)}, land ${land.total()}, land fed (year last reckoned) ${ctx.history.yearsOf(cell).at(-1)?.fed}, last sickness ${JSON.stringify(healthOf(w)?.land(cell)?.last ?? null)}`,
  );
}
