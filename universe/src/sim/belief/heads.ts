// A faith's head, and the faith against a ruler (the rules are rules/faithheads.ts; what is kept ./heads-kept.ts). Once a year,
// after the year's notable people (sim/notable) have lived and died:
//   1. each faith a people holds is found with its lands, and by the realms that hold them (one pass over the lands);
//   2. a faith without a living head finds one, as its facts say (rules faithForm): a line's heir of its family, the one its
//      clergy raise (the highest in the faith among its faithful of name), the eldest of its council, or the most learned. Where
//      none of its faithful is kept by name, someone of its seat is raised (sim/notable raiseNotable). The head is a notable who
//      holds the post "faith"; a faith of three lands or more tells its head's coming;
//   3. each faith in its year of FAITH_HEAD.every, against each realm that holds it: whether its ruler presses it (rules
//      clashScore; no draw), and what that comes to: a contest opened, a concord, the seat naming its priests, the ruler cast
//      out, reconciled by his death or his yielding, or his realm's lands breaking from the faith under one of them who leads it
//      out (sim/belief/belief.ts splitFaith: a schism with a named schismatic, who heads the new faith).
// What it does flows back: a ruler cast out loses standing with those of his people who keep the faith (sim/order/order.ts
// addsStanding), and his faithful grieve; a seat that names a faith's priests holds its clergy as a priest-king does
// (sim/order/institutions.ts reads investedIn). A head's deeds are their own (their standing in the faith).
// Bounded: one record a faith held, its clashes one a realm that holds it. The yearly pass is one walk of the lands; the
// weighing is a faith's realms in its year.
import {
  YEAR,
  defineEventType,
  yearOfMoment,
  type CauseRef,
  type Factor,
  type Ref,
  type SimTime,
  type World,
} from "../../kernel/index.ts";
import {
  CLASH,
  DOMAIN,
  FAITH_FORMS,
  FAITH_HEAD,
  HOLD,
  NOTE,
  TENET_POWERS,
  claimsOf,
  clashParts,
  clashScore,
  faithForm,
  keepsPersons,
  satOf,
} from "../../rules/index.ts";
import type { PopulationContext } from "../population/systems.ts";
import { WAY, cultureOf } from "../culture/culture.ts";
import { politiesOf, realmName, type Polity } from "../polity/polity.ts";
import { notableRef, notablesOf, type Notable } from "../notable/kept.ts";
import { creditNotable, nameOfLand, raiseNotable } from "../notable/notables.ts";
import { addsStanding, orderOf } from "../order/order.ts";
import { holdOf } from "../order/holds.ts";
import { clergyIn } from "../order/institutions-kept.ts";
import { warsOf } from "../war/war.ts";
import { grieve } from "../acts/disasters.ts";
import { beliefOf, creedOfFaith, splitFaith, type Faith } from "./belief.ts";
import {
  CLASH_WHAT,
  FaithHeadsStore,
  castOutOf,
  faithHeadsOf,
  type Clash,
  type FaithHead,
} from "./heads-kept.ts";

export const FAITH_HEAD_EVENTS = {
  /** A faith's new head, as its form found them. */
  head: defineEventType("faith.head", 3),
  /** A ruler pressed a faith held in his realm: who names its priests, what its faithful give, whose word they keep. */
  clash: defineEventType("faith.clash", 4),
  /** A realm's seat took the naming of a faith's priests in its lands. */
  invested: defineEventType("faith.invested", 4),
  /** A faith's head cast out a ruler. */
  cast: defineEventType("faith.cast", 5),
  /** A ruler and a faith's head at one again: a concord, the ruler's yielding, a new ruler. */
  settled: defineEventType("faith.settled", 3),
};

const serialOf = (ref: Ref): number => Number(ref.slice(ref.lastIndexOf(":") + 1)) || 0;
const r2 = (x: number) => Math.round(x * 100) / 100;

/** A faith's lands this year, and by the realms that hold them (the people of each). */
type Held = {
  lands: number[];
  people: number;
  realms: Map<Ref, { people: number; lands: number[] }>;
};

/** The year's heads of faiths, and the faiths against rulers. */
export function faithHeadsYear(ctx: PopulationContext, t: SimTime): void {
  const { world } = ctx,
    store = faithHeadsOf(world),
    kept = notablesOf(world);
  if (!store || !kept || !world.hasStore("belief.faiths")) return;
  const year = yearOfMoment(t),
    belief = beliefOf(world),
    realms = politiesOf(world);
  // (Between the years it weighs them all, only a faith whose head is gone finds another: no walk of the lands.)
  if (year % FAITH_HEAD.every !== 0) {
    for (const rec of store.all()) {
      const n = rec.id ? kept.get(rec.id) : undefined;
      if (n && n.post?.kind === "faith" && n.post.of === rec.faith) continue;
      const f = belief.get(rec.faith);
      if (!f) continue;
      headOf(
        ctx,
        store,
        f,
        rec.lands ?? 0,
        () => {
          if (belief.of(f.seat).faith === f.ref && ctx.provinces.get(f.seat)?.total())
            return f.seat;
          return belief.lands(f.ref).find((c) => ctx.provinces.get(c)?.total()) ?? null;
        },
        t,
      );
    }
    store.fold(year);
    return;
  }
  // 1. The faiths held, their lands, and the realms that hold them.
  const held = new Map<Ref, Held>(),
    realmPeople = new Map<Ref, number>();
  for (const p of ctx.provinces.all()) {
    const n = p.total();
    if (!(n > 0)) continue;
    const f = belief.of(p.cell).faith,
      realm = realms.of(p.cell)?.ref ?? null;
    if (realm) realmPeople.set(realm, (realmPeople.get(realm) ?? 0) + n);
    if (!f) continue;
    let h = held.get(f);
    if (!h) held.set(f, (h = { lands: [], people: 0, realms: new Map() }));
    h.lands.push(p.cell);
    h.people += n;
    if (realm) {
      let r = h.realms.get(realm);
      if (!r) h.realms.set(realm, (r = { people: 0, lands: [] }));
      r.people += n;
      r.lands.push(p.cell);
    }
  }
  // (A faith no one holds keeps no head: whoever headed it is themselves again.)
  for (const rec of store.all())
    if (!held.has(rec.faith)) {
      const n = rec.id ? kept.get(rec.id) : undefined;
      if (n?.post?.kind === "faith") {
        delete n.post;
        kept.moved();
      }
      store.drop(rec.faith);
    }
  // 2 and 3, each faith held in the order it was founded.
  const order = [...held.keys()].sort((a, b) => serialOf(a) - serialOf(b));
  for (const ref of order) {
    const f = belief.get(ref);
    if (!f) continue;
    const h = held.get(ref)!,
      rec = headOf(
        ctx,
        store,
        f,
        h.lands.length,
        () => (ctx.provinces.get(f.seat)?.total() ? f.seat : h.lands[0]!),
        t,
      );
    if (!rec) continue;
    rec.lands = h.lands.length;
    reckon(ctx, store, f, rec, h, realmPeople, t);
  }
  store.fold(year);
}

/** The faith's head, found anew where it has none living (null: no one is kept apart). */
function headOf(
  ctx: PopulationContext,
  store: FaithHeadsStore,
  f: Faith,
  /** How many lands hold it (as last walked), and the land to raise someone of where none of its faithful is kept. */
  lands: number,
  landOf: () => number | null,
  t: SimTime,
): FaithHead | null {
  const { world } = ctx,
    kept = notablesOf(world)!,
    year = yearOfMoment(t);
  let rec = store.get(f.ref);
  const now = rec?.id ? kept.get(rec.id) : undefined;
  if (rec && now && now.post?.kind === "faith" && now.post.of === f.ref) return rec;
  // (How it finds its head: its creed's pull on rank and kin, its seat's people's, whether its power knows; a hive keeps a line.)
  const creed = creedOfFaith(f),
    seat = cultureOf(world).get(f.seat)?.traits,
    form = faithForm({
      creedRank: creed[WAY.hierarchy] ?? 0,
      creedKin: creed[WAY.kinship] ?? 0,
      rank: seat?.[WAY.hierarchy] ?? 0.5,
      kin: seat?.[WAY.kinship] ?? 0.5,
      knows: TENET_POWERS[f.tenet]?.knows ?? 0,
      hive: !keepsPersons(ctx.generated.life.people?.body.social),
    }),
    k = FAITH_FORMS.indexOf(form),
    was = rec?.id ? kept.goneOf(rec.id) : undefined,
    wasLiving = rec?.id ? kept.get(rec.id) : undefined;
  // (The faithful of name: those free of another post and not held by a foe.)
  let best: Notable | undefined,
    bestScore = -Infinity;
  // (Its faithful of name wherever they live.)
  if (form !== "line")
    for (const n of kept.all()) {
      if (n.faith !== f.ref || n.post || n.held) continue;
      const faith = n.by[DOMAIN.faith] ?? 0;
      const score =
        form === "chosen"
          ? faith
          : form === "learned"
            ? faith + (n.by[DOMAIN.knowledge] ?? 0)
            : faith >= NOTE.line / 2
              ? -n.born
              : -Infinity;
      if (score > bestScore || (score === bestScore && best && n.id < best.id)) {
        best = n;
        bestScore = score;
      }
    }
  if (
    form === "learned" &&
    best &&
    (best.by[DOMAIN.knowledge] ?? 0) + (best.by[DOMAIN.faith] ?? 0) <= 0
  )
    best = undefined;
  const deed = {
    y: year,
    d: DOMAIN.faith,
    w: "faith.head",
    e: null,
    g: FAITH_HEAD.raised,
    n: f.name,
  };
  let n: Notable | null | undefined = best;
  let family = rec?.family ?? "";
  if (n) creditNotable(world, n.id, deed);
  else {
    // (A line's heir, of its family, born a generation after the one before; else someone of its seat its faithful raise, of
    // the age its form asks: an elder for a council, one in their middle years for the clergy's choice or the most learned.)
    const key = serialOf(f.ref) * 64 + ((rec?.heads ?? 0) % 64),
      cell = f.seat,
      before = was ?? wasLiving,
      drawn = nameOfLand(ctx, cell, key, t),
      life = ctx.life,
      elder = life.bands[7] ?? life.adulthood * 3,
      // (Their own given name, and the family's.)
      name = form === "line" && family ? `${drawn.name.split(" ")[0]} ${family}` : drawn.name,
      born =
        form === "line"
          ? before
            ? Math.min(
                year - Math.round(life.adulthood),
                before.born + Math.round(life.adulthood * FAITH_HEAD.heir * 2),
              )
            : year - Math.round(life.adulthood * 1.5)
          : form === "council"
            ? year - Math.round(elder)
            : year - Math.round((life.adulthood + elder) / 2);
    const at = ctx.provinces.get(cell)?.total() ? cell : landOf();
    n = at === null ? null : raiseNotable(ctx, at, key, deed, t, { name, sex: drawn.sex, born });
    if (n && form === "line" && !family) family = n.name.split(" ").at(-1) ?? "";
  }
  if (!n) return rec ?? null;
  n.post = { kind: "faith", of: f.ref };
  n.faith = f.ref;
  kept.moved();
  const told =
    lands >= 3
      ? world.events.emit({
          type: FAITH_HEAD_EVENTS.head.type,
          importance: lands >= 10 ? 4 : 3,
          subjects: [f.ref, notableRef(n.id)],
          place: ctx.provinces.get(n.home)?.ref ?? null,
          causes: [
            ...(was?.event ? [{ ref: was.event, role: "trigger" as const, weight: 1 }] : []),
            { ref: f.event, role: "enabler" as const, weight: 0.5 },
          ],
          data: {
            faith: f.name,
            name: n.name,
            id: n.id,
            form,
            n: (rec?.heads ?? 0) + 1,
            ...(was ? { was: was.name } : {}),
          },
        })
      : null;
  rec = {
    faith: f.ref,
    form: k,
    id: n.id,
    since: year,
    heads: (rec?.heads ?? 0) + 1,
    family: form === "line" ? family : "",
    event: told,
    lands,
    // (A new head is bound by no concord the one before made.)
    clashes: (rec?.clashes ?? []).filter((c) => c.state !== 0),
  };
  store.set(rec);
  return rec;
}

/** Each realm that holds a faith, weighed against its head in the faith's year. */
function reckon(
  ctx: PopulationContext,
  store: FaithHeadsStore,
  f: Faith,
  rec: FaithHead,
  h: Held,
  realmPeople: ReadonlyMap<Ref, number>,
  t: SimTime,
): void {
  const { world } = ctx,
    kept = notablesOf(world)!,
    head = kept.get(rec.id),
    realms = politiesOf(world),
    year = yearOfMoment(t),
    creed = creedOfFaith(f),
    claims = claimsOf(
      creed[WAY.hierarchy] ?? 0,
      cultureOf(world).get(f.seat)?.traits[WAY.hierarchy] ?? 0.5,
    ),
    belief = beliefOf(world),
    order = orderOf(world),
    wars = warsOf(world),
    keep: Clash[] = [];
  if (!head) return;
  const headRealm = head.realm;
  for (const [realmRef, r] of [...h.realms].sort((a, b) => serialOf(a[0]) - serialOf(b[0]))) {
    const p = realms.get(realmRef),
      was = rec.clashes.find((c) => c.realm === realmRef);
    if (!p || p.ended !== null) continue;
    const all = Math.max(1, realmPeople.get(realmRef) ?? 0),
      share = r.people / all,
      seatHolds = belief.of(p.seat).faith === f.ref;
    // (A priest-king of the faith is its own; and a realm the head rules is theirs.)
    const own = (p.leadership === 3 && seatHolds) || (head.as === "rule" && headRealm === realmRef);
    if (own || (share < FAITH_HEAD.least && !seatHolds)) {
      if (was && was.state !== 0) settle(ctx, f, rec, was, p, "its own", t, null);
      continue;
    }
    const legitimacy = order?.realms.get(realmRef)?.legitimacy ?? 0.6,
      lands = r.lands.slice(0, 8),
      read = {
        abroad: headRealm !== null && headRealm !== realmRef ? 1 : 0,
        force: holdOf(world, realmRef, HOLD.force),
        other: seatHolds ? 0 : 1,
        claims,
        clergy: lands.reduce((s, c) => s + clergyIn(world, c), 0) / Math.max(1, lands.length),
        standing: satOf(head.standing),
        war: headRealm && headRealm !== realmRef && wars.between(realmRef, headRealm) ? 1 : 0,
        doubt: Math.max(0, Math.min(1, (0.7 - legitimacy) * 2)),
        concord: was?.state === 0 ? 1 : 0,
      },
      score = clashScore(read),
      factors = (): Factor[] =>
        clashParts(read)
          .filter((x) => x.by !== 0)
          .sort((a, b) => Math.abs(b.by) - Math.abs(a.by))
          .slice(0, 6)
          .map((x) => ({ name: x.name, value: r2(x.value), contribution: r2(x.by), source: null })),
      decide = (outcome: string) =>
        world.decisions.record({
          rule: "faith.clash",
          subject: realmRef,
          outcome: { what: outcome, faith: f.ref },
          score: r2(score),
          threshold: CLASH.opens,
          factors: factors(),
        }),
      tell = (
        type: string,
        importance: number,
        causes: CauseRef[],
        data: Record<string, string | number>,
      ): Ref =>
        world.events.emit({
          type,
          importance,
          subjects: [f.ref, realmRef, notableRef(head.id)],
          place: ctx.provinces.get(p.seat)?.ref ?? null,
          causes,
          data: { faith: f.name, realm: realmName(p), head: head.name, ...data },
        });
    // (At one by a concord: kept while it holds, broken where he presses past it.)
    if (was && was.state === 0 && score < CLASH.opens) {
      keep.push(was);
      continue;
    }
    if (!was || was.state === 0) {
      if (score < CLASH.opens) continue;
      // (What he presses: whose word, where he keeps another faith; what its faithful give, where its clergy are strong; else
      // who names its priests.)
      const what = read.other ? 2 : read.clergy >= 0.3 ? 1 : 0,
        decision = decide("contested"),
        event = tell(
          FAITH_HEAD_EVENTS.clash.type,
          4,
          [
            { ref: decision, role: "trigger", weight: 1 },
            ...(was ? [{ ref: was.event, role: "enabler" as const, weight: 0.5 }] : []),
          ],
          {
            what: CLASH_WHAT[what]!,
          },
        );
      keep.push({
        realm: realmRef,
        state: 1,
        since: year,
        event,
        what,
        ruler: p.ruler.since,
        share: Math.round(share * 1000),
        opened: year,
      });
      continue;
    }
    was.share = Math.round(share * 1000);
    // (A ruler cast out: reconciled by a new ruler, or by his yielding; or his realm breaks from the faith.)
    if (was.state === 3) {
      if (p.ruler.since > was.ruler) {
        keep.push(concordOf(was, settle(ctx, f, rec, was, p, "a new ruler", t, null), year));
        continue;
      }
      if (read.doubt >= CLASH.yields) {
        keep.push(
          concordOf(was, settle(ctx, f, rec, was, p, "yielded", t, decide("yielded")), year),
        );
        continue;
      }
      if (year - was.since >= CLASH.breaksAfter && score >= CLASH.breaks && r.lands.length >= 2) {
        breaks(ctx, store, f, rec, was, p, r.lands, decide("broke"), t);
        continue;
      }
      keep.push(was);
      continue;
    }
    if (score >= CLASH.casts && claims >= CLASH.claimsLeast) {
      const decision = decide("cast");
      was.state = 3;
      was.since = year;
      was.event = tell(
        FAITH_HEAD_EVENTS.cast.type,
        5,
        [
          { ref: decision, role: "trigger", weight: 1 },
          { ref: was.event, role: "enabler", weight: 1 },
        ],
        { what: CLASH_WHAT[was.what]! },
      );
      (was as { ruler: number }).ruler = p.ruler.since;
      for (const c of r.lands) grieve(world, c, CLASH.grief, was.event);
      creditNotable(world, head.id, {
        y: year,
        d: DOMAIN.faith,
        w: FAITH_HEAD_EVENTS.cast.type,
        e: was.event,
        g: 300,
        n: realmName(p),
      });
      keep.push(was);
      continue;
    }
    if (was.state === 1 && read.force >= CLASH.invests && score >= CLASH.opens) {
      const decision = decide("invested");
      was.state = 2;
      was.since = year;
      was.event = tell(
        FAITH_HEAD_EVENTS.invested.type,
        4,
        [
          { ref: decision, role: "trigger", weight: 1 },
          { ref: was.event, role: "enabler", weight: 1 },
        ],
        { what: CLASH_WHAT[was.what]! },
      );
      keep.push(was);
      continue;
    }
    if (score < CLASH.settles) {
      const how = was.state === 2 ? "returned" : "concord";
      keep.push(concordOf(was, settle(ctx, f, rec, was, p, how, t, decide("settled")), year));
      continue;
    }
    keep.push(was);
  }
  // (A realm no longer holding the faith, or no more, has no quarrel with its head.)
  rec.clashes = keep;
  store.set(rec);
}

/** What a settled clash leaves: a concord, kept while it holds (state 0), on the settling's event. */
const concordOf = (c: Clash, event: Ref, year: number): Clash => ({
  ...c,
  state: 0,
  since: year,
  event,
});

/** A ruler and a faith's head at one again (the settling's event). */
function settle(
  ctx: PopulationContext,
  f: Faith,
  rec: FaithHead,
  c: Clash,
  p: Polity,
  how: string,
  t: SimTime,
  decision: Ref | null,
): Ref {
  const { world } = ctx,
    head = notablesOf(world)?.get(rec.id);
  rec.clashes = rec.clashes.filter((x) => x !== c);
  return world.events.emit({
    type: FAITH_HEAD_EVENTS.settled.type,
    importance: c.state === 3 ? 4 : 3,
    subjects: head ? [f.ref, p.ref, notableRef(head.id)] : [f.ref, p.ref],
    place: ctx.provinces.get(p.seat)?.ref ?? null,
    causes: [
      ...(decision ? [{ ref: decision, role: "trigger" as const, weight: 1 }] : []),
      { ref: c.event, role: "enabler", weight: 1 },
    ],
    data: {
      faith: f.name,
      realm: realmName(p),
      ...(head ? { head: head.name } : {}),
      how,
      was: c.state,
      years: yearOfMoment(t) - c.opened,
    },
  });
}

/**
 * A realm cast out breaks from the faith: its lands keep their own under one of them who leads it out (the highest of its
 * faithful of name there who heads nothing, or someone raised for it), who heads the new faith.
 */
function breaks(
  ctx: PopulationContext,
  store: FaithHeadsStore,
  f: Faith,
  rec: FaithHead,
  c: Clash,
  p: Polity,
  lands: readonly number[],
  decision: Ref,
  t: SimTime,
): void {
  const { world } = ctx,
    kept = notablesOf(world)!,
    year = yearOfMoment(t);
  let leader: Notable | undefined;
  for (const cell of lands)
    for (const n of kept.in(cell)) {
      if (n.post || n.held || n.faith !== f.ref) continue;
      const mine = n.by[DOMAIN.faith] ?? 0,
        theirs = leader ? (leader.by[DOMAIN.faith] ?? 0) : -1;
      if (!leader || mine > theirs || (mine === theirs && n.id < leader.id)) leader = n;
    }
  const first = lands.includes(p.seat) ? p.seat : (leader?.home ?? lands[0]!),
    deed = {
      y: year,
      d: DOMAIN.faith,
      w: "led a faith out",
      e: null,
      g: Math.round(NOTE.line * 1.5),
      n: realmName(p),
    };
  if (leader) creditNotable(world, leader.id, deed);
  else leader = raiseNotable(ctx, first, serialOf(c.event) * 4 + 3, deed, t) ?? undefined;
  // (They lead it from their own land, where it is one of the realm's: the land the faith's own split names them in.)
  const seat = leader && lands.includes(leader.home) ? leader.home : first,
    out = splitFaith(
      ctx,
      f,
      lands,
      seat,
      [
        { ref: decision, role: "trigger", weight: 1 },
        { ref: c.event, role: "enabler", weight: 1 },
      ],
      { ...(leader ? { by: leader.name, who: leader.id } : {}), realm: realmName(p) },
      t,
    );
  rec.clashes = rec.clashes.filter((x) => x !== c);
  // (The one who led it out heads it.)
  if (leader) {
    leader.post = { kind: "faith", of: out.ref };
    leader.faith = out.ref;
    kept.moved();
    store.set({
      faith: out.ref,
      form: rec.form,
      id: leader.id,
      since: year,
      heads: 1,
      family: "",
      event: out.event,
      clashes: [],
    });
  }
}

/** A ruler cast out by a faith's head stands the lower with those of his people who keep it (order's standing). */
function castStanding(ctx: PopulationContext, p: Polity): Factor[] {
  const c = castOutOf(ctx.world, p.ref);
  if (!c) return [];
  const share = c.share / 1000;
  return [
    {
      name: "a ruler cast out by the head of his people's faith",
      value: r2(share),
      contribution: -CLASH.standing * share,
      source: { ref: c.event, role: "pressure", weight: 1 },
    },
  ];
}

/** Teach a peopled world its faiths' heads. */
export function installFaithHeads(world: World, ctx: () => PopulationContext): FaithHeadsStore {
  const store = world.register(new FaithHeadsStore());
  world.addPinner(() => store.pinned());
  world.system({ key: "197.people.zfaith", every: YEAR, run: (t) => faithHeadsYear(ctx(), t) });
  addsStanding(castStanding);
  return store;
}
