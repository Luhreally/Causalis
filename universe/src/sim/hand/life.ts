// A life lived by the god's hand (Lives L3), as history keeps it: one of the hand's people taken up and
// lived on, day on day, on the world's own clock. Kept on the hand's Window and nowhere else, and only once
// begun, so a world where no one was lived keeps every hash. Its numbers are carried forward whenever
// something is chosen and at each month's close, in one step (rules/life.ts reckon), so the same choices come
// to the same life at any pace. What it moves in history is only what a life adds to what the counts already
// hold: what they make past the ordinary day goes to the town's market, what they buy leaves it, a marriage
// joins two of the hand's people (and the children that come to them), a child taught takes up that work when
// grown. All told as the god's hand. Their ordinary bread and work are in the counts already: nothing moves
// for those.
import {
  MONTH,
  defineEventType,
  defineStream,
  yearOfMoment,
  type Ref,
  type World,
} from "../../kernel/index.ts";
import {
  DOINGS,
  EXTRA_GOOD,
  G,
  GOODS,
  HABITS,
  LIFE_MOST,
  OCC,
  RIVAL_MOVES,
  SUITOR_COMES,
  TOOLS_MOST,
  WAGE_GOOD,
  LIFE_WANTS,
  WED_AT,
  blockEnd,
  bonded,
  clothCost,
  copyLife,
  dayWage,
  faceGoes,
  heartAt,
  levelOf,
  loveOf,
  reckon,
  rivalStanding,
  startPurse,
  startSkill,
  toolCost,
  wantNow,
  wantsOpen,
  type DoingId,
  type Happening,
  type Life,
  type LifeFacts,
  type WantId,
  STAKE,
  stakeCost,
} from "../../rules/index.ts";
import { marketsOf, type PopulationContext } from "../population/systems.ts";
import { agentName } from "../acts/local.ts";
import { handOf, type Agent, type Window } from "./hand.ts";
import { agentById } from "./possess.ts";

export const LIFE_EVENTS = {
  begun: defineEventType("life.begun", 5),
  ended: defineEventType("life.ended", 4),
  wed: defineEventType("life.wed", 4),
  child: defineEventType("life.child", 3),
  lost: defineEventType("life.lost", 3),
  want: defineEventType("life.want", 3),
  bought: defineEventType("life.bought", 2),
  faced: defineEventType("life.faced", 3),
  rival: defineEventType("life.rival", 2),
};

/** A life's own draws, keyed by whom, the moment and what for. */
export const HAND_LIFE = defineStream("hand.life");

/** Why each draw is asked. */
const P = { rival: 1, suitor: 2, face: 3, luck: 4, owned: 5, what: 6 };

const adultOf = (c: PopulationContext) => c.life.adulthood;

/** Their partner, parents, children and brothers and sisters, of those living. */
export function kinOf(w: Window, me: Agent): number[] {
  const out = new Set<number>();
  if (me.partner !== undefined && agentById(w, me.partner)) out.add(me.partner);
  for (const a of w.agents) {
    if (a.id === me.id) continue;
    if (
      a.id === me.mother ||
      a.id === me.father ||
      a.mother === me.id ||
      a.father === me.id ||
      (me.mother !== undefined && a.mother === me.mother) ||
      (me.father !== undefined && a.father === me.father)
    )
      out.add(a.id);
  }
  return [...out].sort((a, b) => a - b);
}

/** Those under one roof with them: them, their partner, their children not grown, and (a child's) their parents. */
export function householdOf(w: Window, l: Life, year: number, adulthood: number): number[] {
  const me = agentById(w, l.agent);
  if (!me) return [];
  const out = [me.id];
  for (const id of l.kin) {
    const a = agentById(w, id);
    if (!a) continue;
    if (
      a.id === me.partner ||
      ((a.mother === me.id || a.father === me.id) && year - a.birthYear < adulthood) ||
      a.id === me.mother ||
      a.id === me.father
    )
      out.push(a.id);
  }
  return out;
}

/** Those about a life, who must be among those a town draws: them, their kin, their rival, those free for them. */
export function livedAbout(l: Life): number[] {
  return [l.agent, ...l.kin, ...(l.rival >= 0 ? [l.rival] : []), ...l.suitors];
}

/** The price of a good against its usual worth at a land's market (1: none to read). */
export function ratioIn(world: World, cell: number, good: number): number {
  const m = marketsOf(world).get(cell);
  return good < 0 || !m ? 1 : m.price[good]! / GOODS[good]!.value;
}

/** What a life's numbers are carried forward by now. */
export function lifeFacts(
  world: World,
  c: PopulationContext,
  w: Window,
  l: Life,
  t: number,
): LifeFacts {
  const me = agentById(w, l.agent),
    year = yearOfMoment(t),
    adulthood = adultOf(c);
  let mouths = 1,
    others = 0,
    children = 0,
    partnered = false;
  if (me)
    for (const id of l.kin) {
      const a = agentById(w, id);
      if (!a) continue;
      if (a.id === me.partner) {
        partnered = true;
        mouths++;
        others += dayWage(
          a.occupation,
          0,
          0,
          ratioIn(world, w.cell, WAGE_GOOD[a.occupation] ?? -1),
        );
      } else if (a.mother === me.id || a.father === me.id) {
        children++;
        if (year - a.birthYear < adulthood) mouths++;
      }
    }
  const occupation = me?.occupation ?? OCC.dependent;
  return {
    age: me ? year - me.birthYear : adulthood,
    adulthood,
    occupation,
    mouths,
    others,
    bread: Math.max(0.3, ratioIn(world, w.cell, G.grain)),
    ratio: ratioIn(world, w.cell, WAGE_GOOD[occupation] ?? -1),
    partnered,
    children,
  };
}

/** Their rival's coin-and-standing, for wants that measure against them (null: no rival living). */
export function rivalOf(
  w: Window,
  l: Life,
  year: number,
  adulthood: number,
): { purse: number; standing: number; agent: Agent } | null {
  const a = l.rival >= 0 ? agentById(w, l.rival) : undefined;
  if (!a) return null;
  const age = year - a.birthYear;
  return {
    agent: a,
    purse: Math.round(
      (dayWage(a.occupation, 0, 0, 1) *
        Math.max(0, age - adulthood) *
        20 *
        (0.6 + 0.8 * l.rivalLuck)) /
        1,
    ),
    standing: rivalStanding(age, adulthood, l.rivalLuck),
  };
}

const say = (l: Life, at: number, words: string) => {
  l.log.push({ at, words });
  if (l.log.length > LIFE_MOST.log) l.log.splice(0, l.log.length - LIFE_MOST.log);
};

const wait = (l: Life, h: Happening) => {
  if (l.waiting.some((x) => x.key === h.key)) return;
  l.waiting.push(h);
  if (l.waiting.length > LIFE_MOST.waiting) l.waiting.splice(0, 1);
};

/** How a suitor told "not now" is kept among those asked (children are kept there by their ids). */
const notNow = (id: number): number => -1 - id;

/** Who they would measure themselves against: their own age and work first; never kin. */
function rivalFor(
  w: Window,
  me: Agent,
  kin: readonly number[],
  year: number,
  adult: number,
): number {
  const mine = year - me.birthYear >= adult;
  let best = -1,
    far = Infinity;
  for (const a of w.agents) {
    if (a.id === me.id || kin.includes(a.id) || year - a.birthYear >= adult !== mine) continue;
    const gap =
      Math.abs(a.birthYear - me.birthYear) +
      (a.occupation === me.occupation ? 0 : 20) +
      (a.sex === me.sex ? 0 : 5);
    if (gap < far) {
      far = gap;
      best = a.id;
    }
  }
  return best;
}

/** Those free for a single one to court, the nearest in age first, those about to be grown after them (kept unpaired by the hand). */
function freeFor(
  w: Window,
  me: Agent,
  kin: readonly number[],
  year: number,
  adult: number,
): number[] {
  if (year - me.birthYear < adult || (me.partner !== undefined && agentById(w, me.partner)))
    return [];
  const open: { id: number; rank: number }[] = [];
  for (const a of w.agents) {
    if (a.sex === me.sex || a.id === me.id || kin.includes(a.id)) continue;
    const age = year - a.birthYear,
      gap = Math.abs(a.birthYear - me.birthYear);
    if (gap > 12 || age < adult - 3) continue;
    if (a.partner !== undefined && agentById(w, a.partner)) continue;
    open.push({ id: a.id, rank: gap + (age < adult ? 100 : 0) });
  }
  return open
    .sort((a, b) => a.rank - b.rank || a.id - b.id)
    .slice(0, LIFE_MOST.suitors)
    .map((x) => x.id);
}

/** Those held free for them set afresh: those no longer among them go back to being paired as the hand pairs anyone. */
function setSuitors(w: Window, l: Life, next: readonly number[]): void {
  for (const id of l.suitors)
    if (!next.includes(id)) {
      const a = agentById(w, id);
      if (a) delete a.free;
    }
  for (const id of next) {
    const a = agentById(w, id);
    if (a) a.free = true;
  }
  l.suitors = [...next];
}

function tell(
  world: World,
  c: PopulationContext,
  w: Window,
  l: Life,
  type: string,
  data: Record<string, unknown>,
  cause?: Ref,
): Ref {
  const event = world.events.emit({
    type,
    subjects: [w.village],
    place: c.provinces.get(w.cell)!.ref,
    causes: cause
      ? [
          { ref: cause, role: "agent", weight: 0.7 },
          { ref: l.event as Ref, role: "enabler", weight: 0.3 },
        ]
      : [{ ref: l.event as Ref, role: "enabler", weight: 1 }],
    data: { agent: l.agent, name: l.name, ...data },
  });
  w.notables = [...(w.notables ?? []), { agent: l.agent, deed: event }];
  return event;
}

/** A life's numbers carried forward to `t`, and what that came to written where it lasts. */
function settle(
  world: World,
  c: PopulationContext,
  w: Window,
  l: Life,
  t: number,
  cause?: Ref,
): void {
  if (t <= l.settled) return;
  const f = lifeFacts(world, c, w, l, t),
    me = agentById(w, l.agent),
    block = l.doing,
    from = l.settled,
    purseWas = l.purse,
    level = levelOf(l.skill),
    span = reckon(l, f, t);
  if (block) {
    const h = (Math.min(t, block.to) - from) / 3600,
      d = DOINGS[block.what];
    if (h > 0 && d.bond) {
      if (block.what === "family" && me)
        for (const id of householdOf(w, l, yearOfMoment(t), f.adulthood))
          if (id !== me.id) bonded(l.bonds, id, d.bond * h);
      if (block.target >= 0) bonded(l.bonds, block.target, d.bond * h);
    }
    if (h > 0 && block.what === "teach" && block.target >= 0) {
      l.taught += h;
      const child = agentById(w, block.target);
      if (child && me) child.taught = me.occupation;
    }
    if (t >= block.to) {
      const coin = Math.round(l.purse - purseWas);
      say(l, block.to, `${d.label} done${coin ? `: ${coin > 0 ? "+" : ""}${coin} coin` : ""}`);
      if (block.what === "face") faced(world, c, w, l, block.from, f, cause);
    }
  }
  // The days let go by: what their habit gives those at home.
  const ownDays = (t - Math.max(from, block?.to ?? from)) / 86_400,
    habit = HABITS[l.habit] ?? HABITS[0]!;
  if (ownDays > 0 && habit.bond && me)
    for (const id of householdOf(w, l, yearOfMoment(t), f.adulthood))
      if (id !== me.id) bonded(l.bonds, id, (habit.bond * ownDays) / 30);
  // What they made past the ordinary day is the town's.
  const good = EXTRA_GOOD[f.occupation];
  if (span.past > 0 && good) {
    l.extra += (span.past / 8) * good[1];
    const whole = Math.floor(l.extra),
      market = marketsOf(world).get(w.cell);
    if (whole > 0 && market) {
      market.move("made", good[0], whole);
      l.extra -= whole;
    }
  }
  if (levelOf(l.skill) > level) say(l, t, `You have come on at your work`);
  wantCheck(world, c, w, l, t, f, cause);
}

/** Done with what they wanted: a home bought, and the next to be chosen. */
function wantCheck(
  world: World,
  c: PopulationContext,
  w: Window,
  l: Life,
  t: number,
  f: LifeFacts,
  cause?: Ref,
): void {
  if (!l.want) return;
  const rival = rivalOf(w, l, yearOfMoment(t), f.adulthood);
  if (!wantNow(l.want, l, f, rival).done) return;
  // (A home bought: its price from the purse, said as such; it is still theirs, to their name.)
  const bought = l.want === "home" && !l.owned;
  if (bought) {
    l.purse -= LIFE_WANTS.home.goal;
    l.owned = true;
  }
  const want = l.want;
  l.want = null;
  l.wantsDone++;
  if (!l.won?.includes(want)) l.won = [...(l.won ?? []), want];
  if (want === "best") l.bested = l.rival;
  l.heart = Math.min(1, l.heart + 0.3);
  l.standing = Math.min(100, l.standing + 5);
  tell(world, c, w, l, LIFE_EVENTS.want.type, { want }, cause);
  say(
    l,
    t,
    bought
      ? `You bought your home for ${LIFE_WANTS.home.goal} coin: the rent stops, and it is yours`
      : `${LIFE_WANTS[want].label}: done`,
  );
  wait(l, { key: `want:${t}`, kind: "want", who: l.agent, at: t, more: 0 });
}

/** The face-to-face over: their standing or the other's. */
function faced(
  world: World,
  c: PopulationContext,
  w: Window,
  l: Life,
  at: number,
  f: LifeFacts,
  cause?: Ref,
): void {
  const year = yearOfMoment(at),
    rival = rivalOf(w, l, year, f.adulthood);
  if (!rival) return;
  const won = faceGoes(
    world.rng.real(HAND_LIFE, l.agent, at, P.face),
    l.standing + levelOf(l.skill) * 5,
    rival.standing,
  );
  l.standing = Math.max(0, Math.min(100, l.standing + (won ? 4 : -4)));
  l.heart = Math.max(0, Math.min(1, l.heart + (won ? 0.15 : -0.15)));
  bonded(l.bonds, rival.agent.id, won ? -0.1 : -0.2);
  tell(world, c, w, l, LIFE_EVENTS.faced.type, { won, rival: rival.agent.id }, cause);
  say(
    l,
    at,
    won
      ? "You had it out before the town, and carried it"
      : "You had it out before the town, and came off worse",
  );
}

/** A life begun: of one of the hand's people, or their heir going on from them. */
function begin(
  world: World,
  c: PopulationContext,
  w: Window,
  me: Agent,
  home: number,
  t: number,
  cause: Ref,
  from: Life | null,
): Life {
  const year = yearOfMoment(t),
    adult = adultOf(c),
    age = year - me.birthYear,
    v = c.settlements.get(w.village)!,
    name = agentName(c, me, v),
    kin = kinOf(w, me),
    event = world.events.emit({
      type: LIFE_EVENTS.begun.type,
      subjects: [w.village],
      place: c.provinces.get(w.cell)!.ref,
      causes: [
        { ref: cause, role: "agent", weight: 0.8 },
        { ref: w.event, role: "enabler", weight: 0.2 },
      ],
      data: { agent: me.id, name, town: v.name, heirOf: from?.name ?? null },
    }),
    rival = rivalFor(w, me, kin, year, adult),
    l: Life = {
      agent: me.id,
      name,
      event,
      began: t,
      home,
      generation: (from?.generation ?? 0) + 1,
      settled: t,
      fed: 0.8,
      rested: 0.8,
      heart: 0.6,
      purse: from?.purse ?? startPurse(me.occupation, age, adult),
      standing: Math.min(30, Math.max(0, age - adult)),
      skill: startSkill(age, adult),
      tool: 0,
      finery: 0,
      owned: from?.owned ?? world.rng.real(HAND_LIFE, me.id, t, P.owned) < 0.15,
      short: false,
      doing: null,
      habit: 0,
      want: null,
      wantsDone: 0,
      rival,
      rivalLuck: world.rng.real(HAND_LIFE, me.id, t, P.luck),
      bonds: [],
      kin,
      suitors: [],
      taught: 0,
      extra: 0,
      asked: [],
      waiting: [],
      log: [],
      ended: "",
    };
  me.free = true;
  for (const id of kin) {
    const a = agentById(w, id)!;
    bonded(l.bonds, id, a.id === me.partner ? 0.6 : 0.5);
  }
  if (rival >= 0) bonded(l.bonds, rival, -0.2);
  setSuitors(w, l, freeFor(w, me, kin, year, adult));
  l.want = wantsOpen(l, lifeFacts(world, c, w, l, t))[0] ?? null;
  w.notables = [...(w.notables ?? []), { agent: me.id, deed: event }];
  return l;
}

/** Why a life cannot be chosen for now (null: it can). */
function lifeProblem(world: World): string | null {
  const w = handOf(world).resting;
  if (!w) return "your hand rests on no town";
  if (!w.life) return "you are living no one's life";
  if (w.possessed) return "your hand is in their body: let it go back to their day first";
  if (w.life.ended || !agentById(w, w.life.agent)) return "this life is over";
  return null;
}

/** Why a block cannot be begun (null: it can). */
function doProblem(world: World, c: PopulationContext, args: unknown, t: number): string | null {
  const bad = lifeProblem(world);
  if (bad) return bad;
  const w = handOf(world).resting!,
    l = w.life!,
    a = (args ?? {}) as { what?: unknown; target?: unknown },
    d = typeof a.what === "string" ? DOINGS[a.what as DoingId] : undefined;
  if (!d || !Object.hasOwn(DOINGS, a.what as string)) return "no such thing to do";
  const me = agentById(w, l.agent)!,
    year = yearOfMoment(t),
    grown = year - me.birthYear >= adultOf(c);
  if (d.who === "grown" && !grown) return `${d.label} is for the grown`;
  if (d.who === "child" && grown) return `${d.label} is for the young`;
  const target = a.target;
  if (d.target === "none") return target === undefined || target === -1 ? null : "no one is needed";
  if (!Number.isInteger(target)) return "with whom?";
  const who = agentById(w, target as number);
  if (!who) return "they are no longer among the living";
  if (d.target === "child") {
    if (who.mother !== me.id && who.father !== me.id) return "only your own child";
    if (year - who.birthYear >= adultOf(c)) return "they are grown";
  }
  if (d.target === "suitor") {
    if (!l.suitors.includes(who.id)) return "they are not free for you";
    if (year - who.birthYear < adultOf(c)) return "they are not grown";
  }
  if (d.target === "rival" && who.id !== l.rival) return "they are not your rival";
  return null;
}

/** Two of the hand's people joined. */
function wed(
  world: World,
  c: PopulationContext,
  w: Window,
  l: Life,
  who: Agent,
  t: number,
  cause: Ref,
): void {
  const me = agentById(w, l.agent)!;
  me.partner = who.id;
  who.partner = me.id;
  setSuitors(w, l, []);
  delete who.free;
  l.kin = kinOf(w, me);
  bonded(l.bonds, who.id, 0.2);
  l.standing = Math.min(100, l.standing + 5);
  l.heart = Math.min(1, l.heart + 0.3);
  const v = c.settlements.get(w.village)!;
  tell(world, c, w, l, LIFE_EVENTS.wed.type, { to: who.id, toName: agentName(c, who, v) }, cause);
  say(l, t, `You married ${agentName(c, who, v).replace(/ of .*$/, "")}`);
}

/** Those a life could go on as: their children, the eldest first; then their partner; then their brothers and sisters. */
export function heirsOf(w: Window, l: Life): number[] {
  const living = l.kin.flatMap((id) => {
      const a = agentById(w, id);
      return a ? [a] : [];
    }),
    gone = w.gone?.find((g) => g.id === l.agent),
    rank = (a: Agent) =>
      a.mother === l.agent || a.father === l.agent
        ? 0
        : a.id === gone?.partner || a.partner === l.agent
          ? 1
          : 2;
  return living
    .sort((a, b) => rank(a) - rank(b) || a.birthYear - b.birthYear || a.id - b.id)
    .map((a) => a.id)
    .slice(0, 6);
}

/** Teach a peopled world lives: "life.begin", "life.do", "life.buy", "life.habit", "life.want", "life.answer", "life.heir", "life.end", and a month's close. */
export function installLife(world: World, ctx: () => PopulationContext): void {
  const resting = () => handOf(world).resting;

  world.defineCommand({
    type: "life.begin",
    validate: (args) => {
      const w = resting();
      if (!w) return "lay your hand on their town first";
      if (w.possessed) return "your hand is in a body: let it go first";
      if (w.life) return "you are living a life already: let it go first";
      const a = args as { agent?: unknown; home?: unknown } | null;
      if (!a || !Number.isInteger(a.agent)) return "whose life?";
      if (!agentById(w, a.agent as number)) return "no such person under your hand";
      if (!Number.isInteger(a.home) || (a.home as number) < 0)
        return "their home is one of the town's";
      return null;
    },
    apply: (command, t) => {
      const w = resting()!,
        a = command.args as { agent: number; home: number };
      w.life = begin(world, ctx(), w, agentById(w, a.agent)!, a.home, t, command.id, null);
      keepNames(ctx(), w, w.life);
    },
  });

  world.defineCommand({
    type: "life.do",
    validate: (args) => doProblem(world, ctx(), args, world.now + 1),
    apply: (command, t) => {
      const c = ctx(),
        w = resting()!,
        l = w.life!,
        a = command.args as { what: DoingId; target?: number };
      settle(world, c, w, l, t, command.id);
      const target = a.target ?? -1,
        who = target >= 0 ? agentById(w, target) : undefined;
      // Courted long enough, they say yes.
      if (a.what === "court" && who && loveOf(l.bonds, who.id) >= WED_AT) {
        wed(world, c, w, l, who, t, command.id);
        l.doing = { what: "family", from: t, to: blockEnd("family", t), target: -1 };
        return;
      }
      l.doing = { what: a.what, from: t, to: blockEnd(a.what, t), target };
    },
  });

  world.defineCommand({
    type: "life.buy",
    validate: (args) => {
      const bad = lifeProblem(world);
      if (bad) return bad;
      const c = ctx(),
        w = resting()!,
        l = w.life!,
        good = (args as { good?: unknown } | null)?.good;
      if (good !== "tool" && good !== "cloth" && good !== "stake")
        return "a better tool, good clothes, or a share in the works";
      if (l.doing?.what !== "market") return "go to the market first";
      if (good === "stake") {
        const price = stakeCost(l.stakes ?? 0);
        if ((l.stakes ?? 0) >= STAKE.most) return "you hold as much of the works as is to be had";
        return l.purse < price ? `${price} coin, and you have ${Math.floor(l.purse)}` : null;
      }
      const g = good === "tool" ? G.tools : G.clothing,
        cost = (good === "tool" ? toolCost : clothCost)(ratioIn(world, w.cell, g));
      if (good === "tool" && l.tool >= TOOLS_MOST) return "you have the best to be had";
      if ((marketsOf(world).get(w.cell)?.stock[g] ?? 0) < 1)
        return `no ${good === "tool" ? "tools" : "cloth"} to be had in this town`;
      void c;
      if (l.purse < cost) return `${cost} coin, and you have ${Math.floor(l.purse)}`;
      return null;
    },
    apply: (command, t) => {
      const c = ctx(),
        w = resting()!,
        l = w.life!,
        good = (command.args as { good: "tool" | "cloth" | "stake" }).good;
      if (good === "stake") {
        const price = stakeCost(l.stakes ?? 0);
        settle(world, c, w, l, t, command.id);
        if (l.purse < price || (l.stakes ?? 0) >= STAKE.most) return;
        l.purse -= price;
        l.stakes = (l.stakes ?? 0) + 1;
        say(l, t, `A share in the works: -${price} coin, ${STAKE.pay * l.stakes} coin a day`);
        return;
      }
      const g = good === "tool" ? G.tools : G.clothing,
        cost = (good === "tool" ? toolCost : clothCost)(ratioIn(world, w.cell, g));
      settle(world, c, w, l, t, command.id);
      if (l.purse < cost) return;
      if (!marketsOf(world).get(w.cell)!.take("carriedOut", g, 1)) return;
      l.purse -= cost;
      if (good === "tool") l.tool++;
      else {
        l.finery++;
        l.standing = Math.min(100, l.standing + 5);
      }
      tell(world, c, w, l, LIFE_EVENTS.bought.type, { good, cost }, command.id);
      say(l, t, good === "tool" ? `A better tool: -${cost} coin` : `Good clothes: -${cost} coin`);
    },
  });

  world.defineCommand({
    type: "life.habit",
    validate: (args) => {
      const bad = lifeProblem(world);
      if (bad) return bad;
      const h = (args as { habit?: unknown } | null)?.habit;
      return Number.isInteger(h) && (h as number) >= 0 && (h as number) < HABITS.length
        ? null
        : "no such way of going on";
    },
    apply: (command, t) => {
      const c = ctx(),
        w = resting()!,
        l = w.life!;
      settle(world, c, w, l, t, command.id);
      l.habit = (command.args as { habit: number }).habit;
      l.doing = null;
    },
  });

  world.defineCommand({
    type: "life.want",
    validate: (args) => {
      const bad = lifeProblem(world);
      if (bad) return bad;
      const c = ctx(),
        w = resting()!,
        l = w.life!,
        want = (args as { want?: unknown } | null)?.want;
      return wantsOpen(l, lifeFacts(world, c, w, l, world.now)).includes(want as WantId)
        ? null
        : "that is not to be wanted now";
    },
    apply: (command) => {
      const l = resting()!.life!;
      l.want = (command.args as { want: WantId }).want;
      l.waiting = l.waiting.filter((h) => h.kind !== "want");
    },
  });

  world.defineCommand({
    type: "life.answer",
    validate: (args) => {
      const bad = lifeProblem(world);
      if (bad) return bad;
      const a = args as { key?: unknown; choice?: unknown } | null;
      if (!resting()!.life!.waiting.some((h) => h.key === a?.key)) return "nothing waits on that";
      return Number.isInteger(a?.choice) ? null : "which?";
    },
    apply: (command, t) => {
      const c = ctx(),
        w = resting()!,
        l = w.life!,
        a = command.args as { key: string; choice: number },
        h = l.waiting.find((x) => x.key === a.key)!;
      l.waiting = l.waiting.filter((x) => x !== h);
      settle(world, c, w, l, t, command.id);
      if (h.kind === "rival" && a.choice === 1 && agentById(w, l.rival)) {
        l.doing = { what: "face", from: t, to: blockEnd("face", t), target: l.rival };
      } else if (h.kind === "rival") {
        l.heart = Math.max(0, l.heart - 0.03);
      } else if (h.kind === "suitor" && a.choice !== 1) {
        l.asked = [...l.asked, notNow(h.who)].slice(-LIFE_MOST.asked);
      } else if (h.kind === "suitor" && agentById(w, h.who)) {
        l.doing = { what: "court", from: t, to: blockEnd("court", t), target: h.who };
      } else if (h.kind === "trade" && a.choice >= 0 && a.choice < 7) {
        const who = agentById(w, h.who);
        if (who) who.taught = a.choice;
      }
    },
  });

  world.defineCommand({
    type: "life.heir",
    validate: (args) => {
      const w = resting();
      if (!w?.life) return "you are living no one's life";
      if (agentById(w, w.life.agent)) return "they live yet";
      const id = (args as { agent?: unknown } | null)?.agent;
      return Number.isInteger(id) && heirsOf(w, w.life).includes(id as number)
        ? null
        : "they are not of the family";
    },
    apply: (command, t) => {
      const c = ctx(),
        w = resting()!,
        was = w.life!,
        heir = agentById(w, (command.args as { agent: number }).agent)!;
      setSuitors(w, was, []);
      tell(
        world,
        c,
        w,
        was,
        LIFE_EVENTS.ended.type,
        { died: true, years: yearsOf(was, t) },
        command.id,
      );
      w.life = begin(world, c, w, heir, was.home, t, command.id, was);
      keepNames(c, w, w.life);
    },
  });

  world.defineCommand({
    type: "life.end",
    validate: () => {
      const w = resting();
      if (!w?.life) return "you are living no one's life";
      return w.possessed ? "your hand is in their body: let it go back to their day first" : null;
    },
    apply: (command, t) => {
      const c = ctx(),
        w = resting()!,
        l = w.life!,
        me = agentById(w, l.agent);
      if (me) settle(world, c, w, l, t, command.id);
      setSuitors(w, l, []);
      if (me) delete me.free;
      tell(
        world,
        c,
        w,
        l,
        LIFE_EVENTS.ended.type,
        { died: !me, years: yearsOf(l, t), wants: l.wantsDone, purse: Math.round(l.purse) },
        command.id,
      );
      delete w.life;
    },
  });

  world.system({ key: "101.hand.life", every: MONTH, run: (t) => lifeMonth(world, ctx(), t) });
}

const yearsOf = (l: Life, t: number) => yearOfMoment(t) - yearOfMoment(l.began);

/** A month's close: their numbers carried forward; who is born and gone; what waits on the viewer. */
/** Those a life knows keep the names it knows them by, whatever the tongue does about them. */
function keepNames(c: PopulationContext, w: Window, l: Life): void {
  const v = c.settlements.get(w.village);
  if (!v) return;
  for (const id of livedAbout(l)) {
    const a = agentById(w, id);
    if (a && !a.name) a.name = agentName(c, a, v);
  }
}

export function lifeMonth(world: World, c: PopulationContext, t: number): void {
  const w = handOf(world).resting,
    l = w?.life;
  if (!w || !l || l.ended) return;
  const me = agentById(w, l.agent);
  if (!me) {
    l.ended = "died";
    l.doing = null;
    l.waiting = [{ key: `died:${t}`, kind: "died", who: l.agent, at: t, more: 0 }];
    say(l, t, "Your life here is over");
    return;
  }
  keepNames(c, w, l);
  const year = yearOfMoment(t),
    adult = adultOf(c),
    kin = kinOf(w, me);
  // Who has come and who has gone.
  for (const id of kin)
    if (!l.kin.includes(id)) {
      const a = agentById(w, id)!;
      if (a.mother === me.id || a.father === me.id) {
        bonded(l.bonds, id, 0.5);
        l.heart = Math.min(1, l.heart + 0.2);
        tell(world, c, w, l, LIFE_EVENTS.child.type, { child: id, sex: a.sex });
        wait(l, { key: `child:${id}`, kind: "child", who: id, at: t, more: 0 });
      }
    }
  for (const id of l.kin)
    if (!kin.includes(id)) {
      const near = loveOf(l.bonds, id);
      l.heart = Math.max(0, l.heart - 0.1 - Math.max(0, near) * 0.3);
      l.bonds = l.bonds.filter((b) => b.id !== id);
      tell(world, c, w, l, LIFE_EVENTS.lost.type, { who: id });
      wait(l, { key: `mourn:${id}`, kind: "mourn", who: id, at: t, more: 0 });
    }
  l.kin = kin;
  settle(world, c, w, l, t);
  // Those free for them.
  setSuitors(w, l, freeFor(w, me, kin, year, adult));
  if (l.want === "wed" && !l.suitors.length) l.want = null;
  // Their rival gone, another; their rival moves.
  if (l.rival < 0 || !agentById(w, l.rival)) {
    l.rival = rivalFor(w, me, kin, year, adult);
    if (l.rival >= 0) bonded(l.bonds, l.rival, -0.2);
  } else if (world.rng.real(HAND_LIFE, l.agent, t, P.rival) < RIVAL_MOVES) {
    const take = Math.min(30, Math.floor(l.purse * 0.05)),
      what = world.rng.real(HAND_LIFE, l.agent, t, P.what) < 0.5;
    if (what) l.purse -= take;
    else l.standing = Math.max(0, l.standing - 2);
    tell(world, c, w, l, LIFE_EVENTS.rival.type, { rival: l.rival, took: what ? take : 0 });
    wait(l, { key: `rival:${t}`, kind: "rival", who: l.rival, at: t, more: what ? take : 0 });
  }
  // One free for them comes forward.
  // (One told "not now" does not ask again: Court is still on the tray.)
  const grownFree = l.suitors.filter((id) => {
    const a = agentById(w, id);
    return !!a && year - a.birthYear >= adult && !l.asked.includes(notNow(id));
  });
  if (grownFree.length && world.rng.real(HAND_LIFE, l.agent, t, P.suitor) < SUITOR_COMES)
    wait(l, { key: `suitor:${grownFree[0]}`, kind: "suitor", who: grownFree[0]!, at: t, more: 0 });
  // A year from being grown: what will they be?
  for (const id of [me.id, ...kin]) {
    const a = agentById(w, id)!;
    if (
      (a === me || a.mother === me.id || a.father === me.id) &&
      year - a.birthYear === adult - 1 &&
      !l.asked.includes(id)
    ) {
      l.asked = [...l.asked, id].slice(-LIFE_MOST.asked);
      wait(l, { key: `trade:${id}`, kind: "trade", who: id, at: t, more: 0 });
    }
  }
  // Nothing wanted and nothing asked: the next want to be chosen.
  if (
    !l.want &&
    !l.waiting.some((h) => h.kind === "want") &&
    wantsOpen(l, lifeFacts(world, c, w, l, t)).length
  )
    wait(l, { key: `want:${t}`, kind: "want", who: l.agent, at: t, more: 0 });
  void heartAt;
  void copyLife;
}
