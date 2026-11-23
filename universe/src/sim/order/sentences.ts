// Those a court sentences, and those it holds (the rules are rules/sentences.ts; what is kept ./sentences-kept.ts). Each year,
// after the bodies' own reckoning (sim/order/institutions.ts), each land a court holds of the realms whose year it is (one year
// in SENTENCE.every, for those years; the court of the most hands where two hold it):
//   1. what its people did that is brought before it: their small wrongs (how many they are, how hungry, how aggrieved, how harsh
//      its seat), its killings (the underworld's, as reckoned), and the young of its gangs its watch took (sim/order/underworld.ts
//      jailed) — as far as the court reaches, is not bought, and its watch is honest;
//   2. what comes of them, by how grave and by the realm's law (rules sentenceMix): fined, put to death, put to labour, held, or
//      found not guilty, each a whole number of its people (the remainder by a draw);
//   3. those held leave as their terms run out (a mean, by how grave), and the newly held come in: its prison's count; those put
//      to death die (of its grown, from its ledger); a harsh year grieves the land.
// What it does flows back: the court's held is this count (institutions read it: its prison raised, sim/town/fabric.ts), those
// at labour are the land's condemned in bondage (sim/order/order.ts, through institutions-kept courtLabourIn), and the share of
// its gangs' young held ties them the more to their gangs (sim/order/underworld.ts). The town's own people sentenced are read
// from these counts by host/sentenced.ts and host/roster.ts (who, by their lines); nothing here keeps a person.
import { YEAR, defineStream, yearOfMoment, type SimTime, type World } from "../../kernel/index.ts";
import {
  BANDS,
  DOES,
  HOLD,
  SENTENCE,
  harshOf,
  keepsPersons,
  pettyBrought,
  sentenceMix,
} from "../../rules/index.ts";
import type { PopulationContext } from "../population/systems.ts";
import { politiesOf, type Polity } from "../polity/polity.ts";
import { grieve } from "../acts/disasters.ts";
import { poolOf } from "../war/levy.ts";
import { COLS } from "../population/model.ts";
import { holdOf } from "./holds.ts";
import { LAW_OF } from "./laws.ts";
import { orderOf } from "./order.ts";
import { bodiesOf, courtIn, watchIn, type Body } from "./institutions-kept.ts";
import { GANG_ROW, gangsStore, killedOf } from "./underworld-kept.ts";
import { SENT_ROW, SentencesStore, sentencesOf } from "./sentences-kept.ts";

const DRAW = defineStream("order.sentences");

/** A count, its remainder whole by a draw. */
const whole = (x: number, u: number): number => {
  const f = Math.floor(Math.max(0, x));
  return f + (u < Math.max(0, x) - f ? 1 : 0);
};

const serialOf = (ref: string): number => Number(ref.slice(ref.lastIndexOf(":") + 1)) || 0;

/** The year's sentences: every land a court holds whose realm reckons them this year (each realm one year in SENTENCE.every). */
export function sentencesYear(ctx: PopulationContext, t: SimTime): void {
  const { world } = ctx,
    store = sentencesOf(world),
    bodies = bodiesOf(world);
  if (!store || !bodies) return;
  const year = yearOfMoment(t),
    realms = politiesOf(world),
    hive = !keepsPersons(ctx.generated.life.people?.body.social),
    gangs = gangsStore(world),
    seen = new Set<number>();
  for (const p of realms.living()) {
    if ((year + serialOf(p.ref)) % SENTENCE.every !== 0) continue;
    const v = bodies.of(p.ref);
    if (!v) continue;
    const courts = v.bodies
      .filter((g) => g.does === DOES.judge && g.since < year && g.standing > 0)
      .sort((a, b) => b.staff - a.staff || a.id - b.id);
    if (!courts.length) continue;
    const harsh = harshOf(holdOf(world, p.ref, HOLD.force), holdOf(world, p.ref, HOLD.voice)),
      justice = orderOf(world)?.realms.get(p.ref)?.laws[LAW_OF.justice] ?? 1;
    for (const g of courts)
      for (const c of g.lands) {
        if (seen.has(c)) continue;
        seen.add(c);
        // (A land reckoned already for these years, by the realm that held it then, waits for them to run out.)
        if ((store.row(c)?.[SENT_ROW.until] ?? 0) > year) continue;
        landYear(ctx, store, p, g, c, { harsh, justice, hive, gangs: !!gangs }, t, year);
      }
  }
  // (A land no court holds any more: those it held serve out their terms, and its row goes once it is empty.)
  for (const c of store.cells()) {
    if (seen.has(c) || store.row(c)![SENT_ROW.until]! > year) continue;
    const r = store.ensure(c),
      leave = 1 / Math.max(1, r[SENT_ROW.term]! / 10);
    r[SENT_ROW.inside] = Math.floor(r[SENT_ROW.inside]! * (1 - leave));
    r[SENT_ROW.labour] = Math.min(
      r[SENT_ROW.inside]!,
      Math.floor(r[SENT_ROW.labour]! * (1 - leave)),
    );
    r[SENT_ROW.gangHeld] = 0;
    if (r[SENT_ROW.inside]! <= 0 && !store.yearOf(c, year - 1)) store.drop(c);
  }
  if (year % 10 === 0) store.forget(year);
  store.fold(year);
}

function landYear(
  ctx: PopulationContext,
  store: SentencesStore,
  p: Polity,
  court: Body,
  c: number,
  law: { harsh: number; justice: number; hive: boolean; gangs: boolean },
  t: SimTime,
  year: number,
): void {
  const { world } = ctx,
    prov = ctx.provinces.get(c),
    people = prov?.total() ?? 0,
    // (The years this reckoning stands for: its own and those to its realm's next.)
    span = SENTENCE.every;
  if (!prov || people <= 0) return;
  const row = courtIn(world, c),
    watch = watchIn(world, c),
    bought = Math.max(row.bought, 1 - court.quality / 1000),
    // (How far it reaches, unbought, with an honest watch to bring them.)
    reach = Math.max(0, row.court - 0.5 * row.bought) * (0.5 + 0.5 * watch.watch * watch.honest),
    u = (k: number) => world.rng.real(DRAW, c, t, k);
  // 1. Brought: its small wrongs, its killings, its gangs' young taken.
  const petty = pettyBrought(
      people,
      prov.leanest,
      politiesOf(world).discontent(c).level,
      law.harsh,
      reach,
    ),
    kill = people * killedOf(world, c) * SENTENCE.perKilling * reach,
    gang = law.gangs ? (gangsStore(world)?.at(c, GANG_ROW.jailed) ?? 0) : 0;
  // 2. What comes of them, each kind by how grave.
  const out = [0, 0, 0, 0, 0],
    terms = [0, 0];
  const judge = (n: number, grave: number, term: number) => {
    if (!(n > 0)) return [0, 0, 0, 0, 0];
    const mix = sentenceMix({
      grave,
      harsh: law.harsh,
      bought,
      decree: p.law === 1,
      justice: law.justice,
      hive: law.hive,
    });
    const got = mix.map((s) => n * s);
    for (let k = 0; k < 5; k++) out[k]! += got[k]!;
    terms[0]! += (got[2]! + got[3]!) * term;
    terms[1]! += got[2]! + got[3]!;
    return got;
  };
  // (Each a year's; the span's are so many years of them.)
  judge(petty * span, SENTENCE.pettyGrave, SENTENCE.pettyTerm);
  judge(kill * span, SENTENCE.killGrave, SENTENCE.graveTerm);
  const g = judge(gang * span, SENTENCE.gangGrave, (SENTENCE.pettyTerm + SENTENCE.graveTerm) / 2);
  const fined = whole(out[0]!, u(0)),
    death = whole(out[1]!, u(1)),
    labour = whole(out[2]!, u(2)),
    held = whole(out[3]!, u(3)),
    acquitted = whole(out[4]!, u(4)),
    brought = fined + death + labour + held + acquitted;
  // 3. Its prison: those whose terms run out leave, the newly held come in.
  const r = store.ensure(c),
    was = r[SENT_ROW.inside]!,
    term = r[SENT_ROW.term]! > 0 ? r[SENT_ROW.term]! / 10 : SENTENCE.pettyTerm,
    // (One in `term` leaves a year, for each year of the span: products, so the same on any machine.)
    leave =
      1 - Array.from({ length: span }).reduce<number>((k) => k * (1 - 1 / Math.max(1, term)), 1),
    stays = Math.floor(was * (1 - leave)),
    labourStays = Math.min(stays, Math.floor(r[SENT_ROW.labour]! * (1 - leave))),
    newTerm = terms[1]! > 0 ? terms[0]! / terms[1]! : term,
    inside = stays + held + labour;
  r[SENT_ROW.inside] = inside;
  r[SENT_ROW.labour] = labourStays + labour;
  r[SENT_ROW.term] = Math.round(
    (10 * (stays * term + (held + labour) * newTerm)) / Math.max(1, inside),
  );
  r[SENT_ROW.gangHeld] = Math.round((g[2]! + g[3]!) / span);
  r[SENT_ROW.gangShare] = gang > 0 ? Math.round((1000 * (g[2]! + g[3]!)) / (gang * span)) : 1000;
  const pm = 1e6 / people / span;
  store.noteSpan(c, span, {
    year,
    brought: brought * pm,
    fined: fined * pm,
    held: held * pm,
    labour: labour * pm,
    death: death * pm,
    acquitted: acquitted * pm,
  });
  const y = store.tally;
  y.brought += brought;
  y.fined += fined;
  y.held += held;
  y.labour += labour;
  y.death += death;
  y.acquitted += acquitted;
  // Those put to death die, of the land's grown; and a harsh year grieves it.
  if (death > 0) putToDeath(ctx, c, death, year);
  const grief = Math.min(
    SENTENCE.griefMost * span,
    (SENTENCE.griefDeath * death + SENTENCE.griefLabour * labour) / people,
  );
  if (grief >= 0.001) grieve(world, c, grief, court.event);
}

/**
 * Those a court puts to death, of its land's grown who could bear arms (as a levy reads them: sim/war/levy.ts): each kind of them
 * by its share, the remainders to the largest parts (no draw, so a land's many dead cost no more than its few).
 */
function putToDeath(ctx: PopulationContext, c: number, n: number, year: number): void {
  const prov = ctx.provinces.get(c),
    pool = poolOf(ctx, c, year);
  if (!prov || !(pool.men > 0)) return;
  const k = Math.min(n, pool.men),
    whole: number[] = [],
    order: number[] = [];
  let left = k;
  for (let i = 0; i < pool.counts.length; i++) {
    const w = Math.floor((pool.counts[i]! * k) / pool.men);
    whole.push(w);
    order.push(i);
    left -= w;
  }
  const frac = (i: number) => (pool.counts[i]! * k) / pool.men - whole[i]!;
  order.sort((a, b) => frac(b) - frac(a) || a - b);
  for (let j = 0; left > 0 && j < order.length; j++) {
    const i = order[j]!;
    if (whole[i]! < pool.counts[i]!) {
      whole[i]!++;
      left--;
    }
  }
  for (let i = 0; i < whole.length; i++) {
    const d = whole[i]!;
    if (!d) continue;
    const at = pool.rows[i]!,
      r = Math.floor(at / COLS);
    prov.counts.add(r, at % COLS, -d);
    ctx.history.addDeaths(c, year, r % BANDS, d);
  }
}

/** Teach a peopled world those its courts sentence and hold. */
export function installSentences(world: World, ctx: () => PopulationContext): SentencesStore {
  const store = world.register(new SentencesStore());
  world.system({ key: "188.order.zzzsentences", every: YEAR, run: (t) => sentencesYear(ctx(), t) });
  return store;
}
