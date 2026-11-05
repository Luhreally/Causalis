// A life lived by the god's hand (Lives L3), as the page reads it: whom it may take up, and how the one
// lived stands now (their numbers carried forward to the moment asked on a copy, so asking moves nothing).
// Reading only.
import { yearOfMoment, type World } from "../kernel/index.ts";
import {
  FEMALE,
  G,
  OCC,
  SKILL_WORDS,
  LIFE_WANTS,
  TOOLS_MOST,
  clothCost,
  copyLife,
  levelOf,
  lifeOffers,
  loveOf,
  reckon,
  toolCost,
  wantNow,
  wantsOpen,
  type Happening,
  type Life,
  type WantId,
} from "../rules/index.ts";
import {
  agentById,
  type Agent,
  agentName,
  handOf,
  heirsOf,
  lifeFacts,
  livedAbout,
  marketsOf,
  populationContext,
  ratioIn,
  rivalOf,
  type Window,
  politiesOf,
  warsOf,
} from "../sim/index.ts";
import type { LifeCard, LifeKin, LifeNow, LifeWindow } from "../bridge/index.ts";
import type { QueryHandler } from "./host.ts";

const first = (name: string) => name.replace(/ of .*$/, "");
const WORK_WORD = ["child", "forager", "farmer", "herder", "crafter", "trader", "leader"];

/** What someone is to the one lived, in a word. */
/** What one still living is to one gone. */
function goneWord(gone: number, a: Agent): string {
  const she = a.sex === FEMALE;
  if (a.mother === gone || a.father === gone) return she ? "daughter" : "son";
  if (a.partner === gone) return she ? "wife" : "husband";
  return she ? "kinswoman" : "kinsman";
}

function kinWord(me: Agent, a: Agent): string {
  const she = a.sex === FEMALE;
  if (a.id === me.partner) return she ? "wife" : "husband";
  if (a.mother === me.id || a.father === me.id) return she ? "daughter" : "son";
  if (a.id === me.mother) return "mother";
  if (a.id === me.father) return "father";
  return she ? "sister" : "brother";
}

/** Whether the realm a land is of is at war now. */
function atWarHere(world: World, cell: number): boolean {
  const realm = politiesOf(world).of(cell);
  return (
    !!realm &&
    warsOf(world)
      .fighting(realm.ref)
      .some((w) => w.ended === null)
  );
}

/** Whoever it is told about, by name, living or lately gone. */
function nameOf(world: World, w: Window, id: number): string {
  const c = populationContext(world),
    v = c.settlements.get(w.village)!,
    a = agentById(w, id) ?? (w.gone?.find((g) => g.id === id) as unknown as Agent | undefined);
  return a ? first(agentName(c, a, v)) : "one of the town";
}

/** Something waiting, in words, with its choices. */
function windowOf(world: World, w: Window, l: Life, h: Happening): LifeWindow {
  const who = nameOf(world, w, h.who),
    c = populationContext(world),
    f = lifeFacts(world, c, w, l, world.now);
  switch (h.kind) {
    case "child":
      return {
        key: h.key,
        kind: h.kind,
        icon: "👶",
        title: `A child is born: ${who}`,
        words: `${who} has come to your home. Another mouth at your table, and in time someone to teach.`,
        choices: [{ choice: 0, label: "Go on", words: "" }],
      };
    case "mourn":
      return {
        key: h.key,
        kind: h.kind,
        icon: "🕯️",
        title: `${who} is gone`,
        words: `${who} has died. The town buries its dead by its own ways. Your heart is the heavier.`,
        choices: [{ choice: 0, label: "Go on", words: "" }],
      };
    case "rival":
      return {
        key: h.key,
        kind: h.kind,
        icon: "😠",
        title: `${who} moves against you`,
        words: h.more
          ? `${who} sold to your buyer: you are down ${h.more} coin.`
          : `${who} has been talking in the square: your standing falls.`,
        choices: [
          {
            choice: 0,
            label: "Let it go",
            words: "A little off your heart, and the town forgets.",
          },
          {
            choice: 1,
            label: "Have it out",
            words: "Before the town: your standing or theirs.",
          },
        ],
      };
    case "suitor":
      return {
        key: h.key,
        kind: h.kind,
        icon: "💗",
        title: `${who} looks your way`,
        words: `${who} is free, and has been seen looking at you.`,
        choices: [
          { choice: 0, label: "Not now", words: "" },
          { choice: 1, label: "Go to them", words: "Time together: the start of something." },
        ],
      };
    case "trade": {
      const self = h.who === l.agent,
        me = agentById(w, l.agent),
        own = me?.occupation ?? OCC.farmer;
      return {
        key: h.key,
        kind: h.kind,
        icon: "🧭",
        title: self ? "What will you be?" : `What will ${who} be?`,
        words: self
          ? "A year from now you are grown, and take up your work."
          : `A year from now ${who} is grown. They take after what they are taught.`,
        choices: [
          ...(self || own === OCC.dependent
            ? []
            : [{ choice: own, label: "Your own work", words: "" }]),
          { choice: OCC.farmer, label: "The fields", words: "" },
          { choice: OCC.crafter, label: "A craft", words: "" },
          { choice: OCC.trader, label: "Trade", words: "" },
        ],
      };
    }
    case "want": {
      const open = wantsOpen(l, f);
      return {
        key: h.key,
        kind: h.kind,
        icon: "🎯",
        title: "What do you want now?",
        words: "One thing at a time. It is what the days are for.",
        choices: open.slice(0, 4).map((id, i) => ({
          choice: i,
          label: `${LIFE_WANTS[id].icon} ${LIFE_WANTS[id].label}`,
          words: LIFE_WANTS[id].words,
        })),
      };
    }
    case "died":
      return {
        key: h.key,
        kind: h.kind,
        icon: "🪦",
        title: `${first(l.name)} has died`,
        words: `Lived ${yearOfMoment(world.now) - yearOfMoment(l.began)} years under your hand. Go on as one of the family, or let go.`,
        choices: [],
      };
  }
}

/** How the one lived stands now. Null: no one is lived. */
export function lifeNow(world: World): LifeNow | null {
  const w = handOf(world).resting,
    kept = w?.life;
  if (!w || !kept) return null;
  const c = populationContext(world),
    v = c.settlements.get(w.village)!,
    l = copyLife(kept),
    t = world.now,
    year = yearOfMoment(t),
    adult = c.life.adulthood,
    me = agentById(w, l.agent),
    f = lifeFacts(world, c, w, l, t);
  if (me && !l.ended) reckon(l, f, t);
  const person = (id: number, is?: string): LifeKin | null => {
      const a = agentById(w, id);
      if (!a) return null;
      return {
        id,
        ref: `agent:${id}`,
        name: first(agentName(c, a, v)),
        age: year - a.birthYear,
        is: is ?? (me ? kinWord(me, a) : goneWord(l.agent, a)),
        love: Math.round(loveOf(l.bonds, id) * 100) / 100,
        work: WORK_WORD[a.occupation] ?? "",
      };
    },
    kin = l.kin.flatMap((id) => {
      const p = person(id);
      return p ? [p] : [];
    }),
    children = kin.filter((k) => (k.is === "son" || k.is === "daughter") && k.age < adult),
    free = l.suitors.flatMap((id) => {
      const p = person(id, "free");
      return p && p.age >= adult ? [p] : [];
    }),
    rival = rivalOf(w, l, year, adult),
    hour = Math.floor((t % 86_400) / 3600),
    offers = lifeOffers(l, f, {
      hour,
      children,
      suitors: free,
      rival: rival ? { id: rival.agent.id, name: first(agentName(c, rival.agent, v)) } : null,
      atWar: atWarHere(world, v.cell),
      shrine: !!c.settlements.get(w.village),
    }),
    market = marketsOf(world).get(w.cell),
    wantWords = (id: WantId) => LIFE_WANTS[id].words,
    wantAt = l.want ? wantNow(l.want, l, f, rival) : null;
  return {
    agent: l.agent,
    ref: `agent:${l.agent}`,
    name: first(l.name),
    town: w.village,
    townName: v.name,
    what: me
      ? `${f.age < adult ? "a child" : `a ${WORK_WORD[f.occupation] ?? "person"}`} of ${v.name}, ${f.age}`
      : `gone from ${v.name}`,
    home: l.home,
    generation: l.generation,
    day: Math.floor(t / 86_400),
    fed: l.fed,
    rested: l.rested,
    heart: l.heart,
    purse: Math.floor(l.purse),
    standing: Math.round(l.standing),
    skill: `${SKILL_WORDS[levelOf(l.skill)]}, ${Math.round(l.skill)} hours`,
    tool: l.tool,
    owned: l.owned,
    short: l.short,
    doing: l.doing,
    habit: l.habit,
    want:
      l.want && wantAt
        ? {
            id: l.want,
            icon: LIFE_WANTS[l.want].icon,
            label: LIFE_WANTS[l.want].label,
            have: wantAt.have,
            goal: wantAt.goal,
            words: wantWords(l.want),
          }
        : null,
    rival: rival
      ? {
          id: rival.agent.id,
          name: first(agentName(c, rival.agent, v)),
          purse: rival.purse,
          standing: rival.standing,
        }
      : null,
    kin: [...kin, ...free],
    about: livedAbout(l),
    offers,
    market:
      l.doing?.what === "market" && market
        ? [
            {
              good: "tool",
              label: "A better tool",
              cost: toolCost(ratioIn(world, w.cell, G.tools)),
              can:
                l.tool < TOOLS_MOST &&
                market.stock[G.tools]! >= 1 &&
                l.purse >= toolCost(ratioIn(world, w.cell, G.tools)),
              words:
                market.stock[G.tools]! < 1
                  ? "No tools to be had in this town."
                  : `Wages a seventh better. The town has ${Math.round(market.stock[G.tools]!).toLocaleString("en-US")} in store.`,
            },
            {
              good: "cloth",
              label: "Good clothes",
              cost: clothCost(ratioIn(world, w.cell, G.clothing)),
              can:
                market.stock[G.clothing]! >= 1 &&
                l.purse >= clothCost(ratioIn(world, w.cell, G.clothing)),
              words:
                market.stock[G.clothing]! < 1
                  ? "No cloth to be had in this town."
                  : "Your standing rises when you are seen in them.",
            },
          ]
        : null,
    windows: me || l.ended ? l.waiting.map((h) => windowOf(world, w, l, h)) : [],
    log: l.log.slice(-12),
    ended: l.ended || (me ? "" : "died"),
    heirs:
      l.ended || !me
        ? heirsOf(w, l).flatMap((id) => {
            const p = person(id);
            return p ? [p] : [];
          })
        : [],
  };
}

/** Lives worth taking up in a town under the hand: one of each kind that it holds, each with why. */
export function lifeCards(world: World): LifeCard[] {
  const w = handOf(world).resting;
  if (!w) return [];
  const c = populationContext(world),
    v = c.settlements.get(w.village)!,
    year = yearOfMoment(world.now),
    adult = c.life.adulthood,
    kids = new Map<number, number>(),
    ids = new Set(w.agents.map((a) => a.id));
  for (const a of w.agents) {
    if (a.mother !== undefined) kids.set(a.mother, (kids.get(a.mother) ?? 0) + 1);
    if (a.father !== undefined) kids.set(a.father, (kids.get(a.father) ?? 0) + 1);
  }
  const age = (a: Agent) => year - a.birthYear,
    grown = (a: Agent) => age(a) >= adult,
    wed = (a: Agent) => a.partner !== undefined && ids.has(a.partner),
    most = (list: readonly Agent[]) =>
      list.reduce<Agent | null>(
        (best, a) =>
          !best ||
          (kids.get(a.id) ?? 0) > (kids.get(best.id) ?? 0) ||
          ((kids.get(a.id) ?? 0) === (kids.get(best.id) ?? 0) && a.id < best.id)
            ? a
            : best,
        null,
      ),
    workOf = (a: Agent) => WORK_WORD[a.occupation] ?? "person",
    famWords = (a: Agent) => {
      const n = kids.get(a.id) ?? 0;
      return `${wed(a) ? `${a.sex === FEMALE ? "a husband" : "a wife"}` : "no one at home"}${n ? `, ${n} ${n === 1 ? "child" : "children"}` : ""}`;
    },
    picks: { kind: string; a: Agent | null | undefined; hook: (a: Agent) => string }[] = [
      {
        kind: "named",
        a: w.agents.find((a) => a.name !== undefined),
        hook: (a) =>
          `${a.occupation === OCC.leader ? "Rules here" : "One you have touched"}: ${famWords(a)}.`,
      },
      {
        kind: "craft",
        a: most(w.agents.filter((a) => grown(a) && a.occupation === OCC.crafter)),
        hook: (a) => `A crafter with ${famWords(a)}. A trade to master and a rival at it.`,
      },
      {
        kind: "farm",
        a: most(w.agents.filter((a) => grown(a) && a.occupation === OCC.farmer)),
        hook: (a) => `On the land with ${famWords(a)}. Many mouths and a good year to pray for.`,
      },
      {
        kind: "young",
        a: w.agents.find((a) => grown(a) && age(a) < adult + 6 && !wed(a)),
        hook: () => "Just grown, with no one yet: all of it ahead.",
      },
      {
        kind: "child",
        a: w.agents.find(
          (a) =>
            !grown(a) &&
            age(a) >= 7 &&
            a.mother !== undefined &&
            ids.has(a.mother) &&
            a.father !== undefined &&
            ids.has(a.father),
        ),
        hook: (a) => `A child of ${age(a)}, with a mother and a father to learn from.`,
      },
      {
        kind: "widow",
        a: most(
          w.agents.filter((a) => grown(a) && age(a) < 60 && !wed(a) && (kids.get(a.id) ?? 0) > 0),
        ),
        hook: (a) =>
          `Alone with ${kids.get(a.id)} ${kids.get(a.id) === 1 ? "child" : "children"} to feed.`,
      },
      {
        kind: "elder",
        a: most(w.agents.filter((a) => age(a) >= 60)),
        hook: (a) =>
          `${age(a)} years old, with ${famWords(a)}: the town's memory, not long for it.`,
      },
      {
        kind: "trade",
        a: w.agents.find((a) => grown(a) && a.occupation === OCC.trader),
        hook: (a) => `A trader with ${famWords(a)}: a fortune to be made, or not.`,
      },
    ],
    seen = new Set<number>(),
    out: LifeCard[] = [];
  for (const p of picks) {
    if (!p.a || seen.has(p.a.id)) continue;
    seen.add(p.a.id);
    out.push({
      id: p.a.id,
      ref: `agent:${p.a.id}`,
      name: first(agentName(c, p.a, v)),
      age: age(p.a),
      what: `${grown(p.a) ? `a ${workOf(p.a)}` : "a child"} of ${v.name}`,
      hook: p.hook(p.a),
      kind: p.kind,
    });
  }
  return out;
}

export const LIFE_QUERIES: Readonly<Record<string, QueryHandler>> = {
  /** How the one lived stands now (null: no one is). */
  "life.now": (world) => lifeNow(world),
  /** Lives worth taking up in the town the hand rests on. */
  "life.pick": (world) => lifeCards(world),
};
