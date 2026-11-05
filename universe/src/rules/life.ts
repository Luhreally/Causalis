// A life lived by the god's hand (Lives L3; asked for 2026-11-04: "sims like game play i can load into on
// town view ... this functionality should essentially blend in with the bringing back causalis og"): what
// one of a town's people needs, earns and wants, hour by hour. Pure: a life's numbers carried forward over
// any span in one step, whether that span is a walk to the well or ten years let go by, so the same choices
// come to the same life at any pace. Coin is a person's bread for a day: a market's price, against the usual
// worth of what is bought or made, says how far it goes (the granary's glut, a year's famine). The sim keeps
// a Life under the hand (sim/hand/life.ts) and moves history only for what a life adds to what the counts
// already hold: things made past the day's work, goods bought, a marriage, a child taught.
import { dmath } from "../kernel/index.ts";
import { G } from "./goods.ts";
import { OCC } from "./species.ts";

const HOUR = 3600,
  DAY = 86_400;

/** The most a life keeps of each list: its lines, those it knows, what waits on the viewer, those free for it, those asked about. */
export const LIFE_MOST = { log: 40, bonds: 12, waiting: 3, suitors: 3, asked: 24 };

export const DOING_IDS = [
  "work",
  "eat",
  "sleep",
  "rest",
  "family",
  "square",
  "market",
  "pray",
  "teach",
  "court",
  "face",
  "play",
  "learn",
  "drill",
] as const;
export type DoingId = (typeof DOING_IDS)[number];

/**
 * What a block of a day is given to: how long it runs (hours), what it does to each need an hour, what it
 * pays (a share of an hour's wage), whether it counts to one's craft, what it adds to one's standing and to
 * the bond with whom it is spent, who may do it, and whom it needs before them.
 */
export type Doing = {
  readonly icon: string;
  readonly label: string;
  readonly hours: number;
  readonly fed: number;
  readonly rested: number;
  readonly heart: number;
  readonly pay: number;
  readonly skill: boolean;
  readonly standing: number;
  readonly bond: number;
  readonly who: "all" | "grown" | "child";
  readonly target: "none" | "child" | "suitor" | "rival";
};

const doing = (
  icon: string,
  label: string,
  hours: number,
  fed: number,
  rested: number,
  heart: number,
  more: Partial<Doing> = {},
): Doing => ({
  icon,
  label,
  hours,
  fed,
  rested,
  heart,
  pay: 0,
  skill: false,
  standing: 0,
  bond: 0,
  who: "all",
  target: "none",
  ...more,
});

export const DOINGS: Readonly<Record<DoingId, Doing>> = {
  work: doing("🔨", "Work", 4, -0.03, -0.035, -0.005, { pay: 1, skill: true, who: "grown" }),
  eat: doing("🍲", "Eat", 1, 0.5, 0.02, 0.03),
  sleep: doing("🛏️", "Sleep", 8, -0.01, 0.12, 0.005),
  rest: doing("🪑", "Rest", 2, -0.02, 0.1, 0.03),
  family: doing("👪", "Family", 2, -0.02, 0.02, 0.08, { bond: 0.03 }),
  square: doing("🗣️", "The square", 2, -0.025, -0.01, 0.06, { standing: 0.5 }),
  market: doing("🧺", "Market", 1, -0.02, -0.01, 0.02),
  pray: doing("🙏", "Pray", 1, -0.02, 0.02, 0.1),
  teach: doing("📖", "Teach", 2, -0.02, -0.02, 0.05, {
    bond: 0.04,
    who: "grown",
    target: "child",
  }),
  court: doing("💗", "Court", 2, -0.02, -0.01, 0.08, {
    bond: 0.08,
    who: "grown",
    target: "suitor",
  }),
  face: doing("😠", "Have it out", 1, -0.03, -0.04, -0.03, { target: "rival" }),
  play: doing("🪁", "Play", 2, -0.04, -0.03, 0.12, { who: "child" }),
  learn: doing("✏️", "Learn", 4, -0.03, -0.03, 0.01, { skill: true, who: "child" }),
  drill: doing("🛡️", "Drill", 2, -0.04, -0.06, 0.02, { pay: 0.5, standing: 0.3, who: "grown" }),
};

/** What each work is called when it is pressed, and its sign, by OCC. */
export const WORK_WORDS: readonly (readonly [string, string])[] = [
  ["🔨", "Work"],
  ["🧺", "Gather"],
  ["🌾", "The fields"],
  ["🐑", "The flock"],
  ["🔨", "Your craft"],
  ["🧾", "Trade"],
  ["👑", "Hold court"],
];

/**
 * What a working day of each work brings, in coin at usual prices (by OCC): for those who get food, the food
 * a worker brings in a year (rules/species.ts PRODUCTIVITY) as it comes to a day's bread for so many.
 */
export const DAY_WAGE: readonly number[] = [0, 2, 3.2, 2.4, 4, 5, 6];
/** The good each work makes, and how much of it (units) a day's work past the ordinary comes to; null: nothing to hold. */
export const EXTRA_GOOD: readonly (readonly [number, number] | null)[] = [
  null,
  [G.wild, 0.02],
  [G.grain, 0.02],
  [G.meat, 0.02],
  [G.tools, 0.25],
  null,
  null,
];
/** The good whose price moves each work's wage (-1: none). */
export const WAGE_GOOD: readonly number[] = [-1, G.wild, G.grain, G.meat, G.tools, -1, -1];

/** The hours one has given to one's craft, as they count: new to it, a hand, skilled, a master of many years. */
export const SKILL_LEVELS: readonly number[] = [0, 200, 800, 2000, 8000];
export const SKILL_WORDS: readonly string[] = [
  "new to it",
  "a hand",
  "able",
  "skilled",
  "a master",
];
export function levelOf(hours: number): number {
  let n = 0;
  for (let k = 1; k < SKILL_LEVELS.length; k++) if (hours >= SKILL_LEVELS[k]!) n = k;
  return n;
}

/** How a market's price against the usual worth moves a wage: a glut pays less, a want more. */
export const priceTerm = (ratio: number): number => dmath.clamp(ratio, 0.7, 2);

/** A working day's pay: the work, the skill, the better tools bought, and the price of what it makes. */
export function dayWage(occupation: number, skill: number, tool: number, ratio: number): number {
  return (
    (DAY_WAGE[occupation] ?? 0) * priceTerm(ratio) * (1 + 0.1 * levelOf(skill)) * (1 + 0.15 * tool)
  );
}

/** A household's rent a day, where its home is not its own. */
export const RENT_DAY = 0.5;
/** What a home of one's own costs; a better tool and good clothes at usual prices (and the most tools). */
export const HOME_COST = 3000,
  TOOL_COST = 300,
  CLOTH_COST = 100,
  TOOLS_MOST = 3;

/** Hours of the ordinary working day between two moments: 8 to 12 and 13 to 17. In one step, whatever the span. */
export function workHours(a: number, b: number): number {
  if (b <= a) return 0;
  const upTo = (t: number): number => {
    const days = Math.floor(t / DAY),
      s = t - days * DAY,
      morning = dmath.clamp(s - 8 * HOUR, 0, 4 * HOUR),
      afternoon = dmath.clamp(s - 13 * HOUR, 0, 4 * HOUR);
    return days * 8 + (morning + afternoon) / HOUR;
  };
  return upTo(b) - upTo(a);
}

/** How the days go when no block is chosen: the work one gives them, how one rests, how one's heart lies, what a month adds to bonds and standing. */
export type Habit = {
  readonly icon: string;
  readonly label: string;
  readonly work: number;
  readonly rested: number;
  readonly heart: number;
  readonly bond: number;
  readonly standing: number;
  readonly words: string;
};
export const HABITS: readonly Habit[] = [
  {
    icon: "🙂",
    label: "Steady",
    work: 1,
    rested: 0.8,
    heart: 0,
    bond: 0.02,
    standing: 0,
    words: "A full day's work, and evenings at home.",
  },
  {
    icon: "🔥",
    label: "Hard at it",
    work: 1.3,
    rested: 0.55,
    heart: -0.1,
    bond: 0,
    standing: 0,
    words: "Long hours: more coin and more skill, less rest, and home sees little of you.",
  },
  {
    icon: "👪",
    label: "Family first",
    work: 0.75,
    rested: 0.8,
    heart: 0.1,
    bond: 0.06,
    standing: 0,
    words: "Short days and long evenings: less coin, a lighter heart, closer kin.",
  },
  {
    icon: "🗣️",
    label: "Out and about",
    work: 0.5,
    rested: 0.85,
    heart: 0.15,
    bond: 0.02,
    standing: 0.3,
    words: "Half days and the square: little coin, and a name in the town.",
  },
];

/** What one wants, one at a time: its sign, its words, and how much of what it counts it is done at. */
export const WANT_IDS = [
  "home",
  "wed",
  "child",
  "teach",
  "master",
  "name",
  "fortune",
  "best",
  "learn",
] as const;
export type WantId = (typeof WANT_IDS)[number];
export const LIFE_WANTS: Readonly<
  Record<WantId, { icon: string; label: string; goal: number; grown: boolean; words: string }>
> = {
  home: {
    icon: "🏠",
    label: "A home of your own",
    goal: HOME_COST,
    grown: true,
    words: `Save ${HOME_COST} coin: it buys the roof you sleep under, and the rent stops.`,
  },
  wed: {
    icon: "💍",
    label: "Someone to share it with",
    goal: 1,
    grown: true,
    words: "Court someone free until they would have you, and marry them.",
  },
  child: {
    icon: "👶",
    label: "A child of your own",
    goal: 1,
    grown: true,
    words: "Children come to a couple as the years go: let them pass with your partner.",
  },
  teach: {
    icon: "📖",
    label: "A child who knows your trade",
    goal: 200,
    grown: true,
    words: "Teach a child two hundred hours: when grown they will take up your work.",
  },
  master: {
    icon: "⚒️",
    label: "Master your work",
    goal: SKILL_LEVELS[4]!,
    grown: true,
    words: "Eight thousand hours at your work: a master's wage, and the town knows it.",
  },
  name: {
    icon: "🗣️",
    label: "A name in the town",
    goal: 60,
    grown: true,
    words: "Standing is earned in the square, by mastery, by a good marriage, in fine clothes.",
  },
  fortune: {
    icon: "💰",
    label: "A fortune",
    goal: 30000,
    grown: true,
    words: "Thirty thousand coin in the purse.",
  },
  best: {
    icon: "⚔️",
    label: "Get ahead of your rival",
    goal: 1,
    grown: true,
    words: "More coin than your rival, and more standing.",
  },
  learn: {
    icon: "✏️",
    label: "Learn all you can",
    goal: 300,
    grown: false,
    words: "Three hundred hours of learning before you are grown: your first work pays the more.",
  },
};

/** What a life waits on the viewer for, and why. */
export const HAPPENINGS = ["child", "mourn", "rival", "suitor", "trade", "want", "died"] as const;
export type HappeningKind = (typeof HAPPENINGS)[number];
/** Something that waits on the viewer: which it is, whom it is about, when, a number more (coin lost, standing lost). */
export type Happening = {
  readonly key: string;
  readonly kind: HappeningKind;
  readonly who: number;
  readonly at: number;
  readonly more: number;
};

/** A line of a life's book. */
export type LifeLine = { readonly at: number; readonly words: string };
/** How one stands with someone: -1 … 1. */
export type LifeBond = { readonly id: number; love: number };
/** The block under way: from when to when, with whom (-1 no one). */
export type LifeBlock = {
  readonly what: DoingId;
  readonly from: number;
  readonly to: number;
  readonly target: number;
};

/** One of the hand's people lived by the god (sim/hand/life.ts keeps it on the hand's Window). */
export type Life = {
  readonly agent: number;
  readonly name: string;
  /** The event that tells it, and the command that began it. */
  readonly event: string;
  readonly began: number;
  /** Which of the town's homes is theirs (bridge's VillagePlan.homes). */
  readonly home: number;
  /** Lives lived in this line: 1 the first, more for each heir taken up. */
  readonly generation: number;
  /** The moment its numbers stand at. */
  settled: number;
  fed: number;
  rested: number;
  heart: number;
  purse: number;
  /** 0 … 100. */
  standing: number;
  /** Hours given to their work. */
  skill: number;
  tool: number;
  finery: number;
  owned: boolean;
  short: boolean;
  doing: LifeBlock | null;
  habit: number;
  want: WantId | null;
  wantsDone: number;
  /** Who they measure themselves against (-1: no one), and how lucky that one is (0 … 1). */
  rival: number;
  rivalLuck: number;
  bonds: LifeBond[];
  /** Their partner, their children and their parents, as last counted. */
  kin: number[];
  /** Those free for them to court, kept unpaired by the hand while they are single. */
  suitors: number[];
  /** Hours they have taught a child, all told. */
  taught: number;
  /** Units of what they made past the ordinary not yet a whole unit. */
  extra: number;
  /** Those whose coming of age has been asked about. */
  asked: number[];
  waiting: Happening[];
  log: LifeLine[];
  /** Why it ended ("": it goes on; "died"). */
  ended: string;
};

/** A life copied to go on in place (a load's own, apart from the state it was read from). */
export function copyLife(l: Life): Life {
  return {
    ...l,
    doing: l.doing ? { ...l.doing } : null,
    bonds: l.bonds.map((b) => ({ ...b })),
    kin: [...l.kin],
    suitors: [...l.suitors],
    asked: [...l.asked],
    waiting: l.waiting.map((h) => ({ ...h })),
    log: l.log.map((x) => ({ ...x })),
  };
}

/** What a life's numbers are carried forward by: who they are now, whom they feed and what things cost. */
export type LifeFacts = {
  readonly age: number;
  readonly adulthood: number;
  readonly occupation: number;
  /** Those the purse feeds, them among them. */
  readonly mouths: number;
  /** What the others of the household bring home in a day (coin). */
  readonly others: number;
  /** A person's bread for a day (coin): the grain's price against its usual worth. */
  readonly bread: number;
  /** The price of what their work makes against its usual worth. */
  readonly ratio: number;
  readonly partnered: boolean;
  readonly children: number;
};

const unit = (v: number) => dmath.clamp(v, 0, 1);

/** How a heart comes to lie when left to itself. */
export function heartAt(l: Pick<Life, "standing" | "short" | "habit">, f: LifeFacts): number {
  return unit(
    0.45 +
      (f.partnered ? 0.1 : 0) +
      0.05 * Math.min(3, f.children) +
      l.standing / 400 +
      (l.short ? -0.25 : 0) +
      (HABITS[l.habit]?.heart ?? 0),
  );
}

/** A need drawn toward where it lies when left to itself, over so many hours. */
const toward = (v: number, to: number, hours: number): number =>
  v + (to - v) * (1 - dmath.exp(-hours / 8));

/** What a span came to, past what is written on the life. */
export type Span = {
  /** Hours worked past the ordinary day. */
  readonly past: number;
  /** Coin earned and spent. */
  readonly earned: number;
  readonly spent: number;
};

/**
 * A life's numbers carried forward to `t` (the block under way as far as it runs, the day left to itself
 * after it), in place. In one step, whatever the span: a month or a walk to the well.
 */
export function reckon(l: Life, f: LifeFacts, t: number): Span {
  let past = 0,
    earned = 0;
  const from = l.settled,
    grown = f.age >= f.adulthood,
    wage = grown ? dayWage(f.occupation, l.skill, l.tool, f.ratio) / 8 : 0;
  let at = from;
  const block = l.doing;
  if (block && at < block.to) {
    const until = Math.min(t, block.to),
      h = (until - at) / HOUR,
      d = DOINGS[block.what];
    l.fed = unit(l.fed + d.fed * h);
    l.rested = unit(l.rested + d.rested * h);
    l.heart = unit(l.heart + d.heart * h);
    l.standing = dmath.clamp(l.standing + d.standing * h, 0, 100);
    if (d.skill) l.skill += h;
    if (d.pay) {
      earned += d.pay * wage * h;
      if (block.what === "work") past += h - workHours(at, until);
    }
    at = until;
  }
  if (block && t >= block.to) l.doing = null;
  if (at < t) {
    const h = (t - at) / HOUR,
      habit = HABITS[l.habit] ?? HABITS[0]!,
      worked = grown ? workHours(at, t) * habit.work : 0;
    earned += wage * worked;
    if (grown) l.skill += worked;
    else l.skill += workHours(at, t) * 0.5;
    l.fed = unit(toward(l.fed, l.short ? 0.35 : 0.8, h));
    l.rested = unit(toward(l.rested, habit.rested, h));
    l.heart = unit(toward(l.heart, heartAt(l, f), h));
    l.standing = dmath.clamp(l.standing + (habit.standing * h) / (30 * 24), 0, 100);
  }
  const days = (t - from) / DAY,
    others = grown ? f.others * days : 0,
    spent = grown ? (f.mouths * f.bread + (l.owned ? 0 : RENT_DAY)) * days : 0,
    purse = l.purse + earned + others - spent;
  l.short = purse < 0;
  l.purse = Math.max(0, purse);
  l.settled = t;
  return { past, earned: earned + others, spent };
}

/** When the block begun at `t` runs to: its hours; sleep, to the next six in the morning. */
export function blockEnd(what: DoingId, t: number): number {
  if (what !== "sleep") return t + DOINGS[what].hours * HOUR;
  const day = Math.floor(t / DAY),
    six = day * DAY + 6 * HOUR;
  return t < six ? six : six + DAY;
}

/** A bond moved by so much (known already, or a new one in place of the coldest once full). */
export function bonded(bonds: LifeBond[], id: number, by: number): void {
  const b = bonds.find((x) => x.id === id);
  if (b) {
    b.love = dmath.clamp(b.love + by, -1, 1);
    return;
  }
  if (bonds.length >= LIFE_MOST.bonds) {
    let least = 0;
    bonds.forEach((x, i) => {
      if (Math.abs(x.love) < Math.abs(bonds[least]!.love)) least = i;
    });
    bonds.splice(least, 1);
  }
  bonds.push({ id, love: dmath.clamp(by, -1, 1) });
}

/** How one stands with someone (0: not known). */
export const loveOf = (bonds: readonly LifeBond[], id: number): number =>
  bonds.find((b) => b.id === id)?.love ?? 0;

/** How far courting must have come for them to say yes. */
export const WED_AT = 0.6;

/** What a rival has by now: their work's wage over their working years, by their luck. */
export function rivalPurse(
  occupation: number,
  age: number,
  adulthood: number,
  luck: number,
): number {
  return Math.round(
    (DAY_WAGE[occupation] ?? 2) * Math.max(0, age - adulthood) * 20 * (0.6 + 0.8 * luck),
  );
}
/** What a rival's standing comes to: their years and their luck. */
export const rivalStanding = (age: number, adulthood: number, luck: number): number =>
  dmath.clamp(Math.round(Math.max(0, age - adulthood) * (0.6 + 0.8 * luck)), 0, 100);

/** What one has in the purse when first lived: a share of their working years' wage. */
export const startPurse = (occupation: number, age: number, adulthood: number): number =>
  Math.round((DAY_WAGE[occupation] ?? 0) * Math.min(60, Math.max(0, age - adulthood) * 3));
/** The hours they have given their work when first lived. */
export const startSkill = (age: number, adulthood: number): number =>
  Math.min(3000, Math.max(0, age - adulthood) * 120);

/** How a want stands: how much of what it counts, of how much. */
export function wantNow(
  want: WantId,
  l: Pick<Life, "purse" | "owned" | "skill" | "standing" | "taught">,
  f: Pick<LifeFacts, "partnered" | "children">,
  rival: { readonly purse: number; readonly standing: number } | null,
): { have: number; goal: number; done: boolean } {
  const goal = LIFE_WANTS[want].goal,
    of = (have: number) => ({ have: Math.round(have), goal, done: have >= goal });
  switch (want) {
    case "home":
      return l.owned ? { have: goal, goal, done: true } : of(l.purse);
    case "wed":
      return of(f.partnered ? 1 : 0);
    case "child":
      return of(f.children > 0 ? 1 : 0);
    case "teach":
      return of(l.taught);
    case "master":
    case "learn":
      return of(l.skill);
    case "name":
      return of(l.standing);
    case "fortune":
      return of(l.purse);
    case "best":
      return of(rival && l.purse > rival.purse && l.standing > rival.standing ? 1 : 0);
  }
}

/** The wants one could take up now, those that still mean something, the first the most natural. */
export function wantsOpen(
  l: Pick<Life, "purse" | "owned" | "skill" | "standing" | "taught" | "suitors" | "rival">,
  f: Pick<LifeFacts, "partnered" | "children" | "age" | "adulthood">,
): WantId[] {
  if (f.age < f.adulthood) return wantNow("learn", l, f, null).done ? [] : ["learn"];
  const out: WantId[] = [];
  if (!f.partnered && l.suitors.length) out.push("wed");
  if (!l.owned) out.push("home");
  if (f.partnered && !f.children) out.push("child");
  if (f.children && !wantNow("teach", l, f, null).done) out.push("teach");
  if (!wantNow("master", l, f, null).done) out.push("master");
  if (!wantNow("name", l, f, null).done) out.push("name");
  if (l.rival >= 0) out.push("best");
  if (!wantNow("fortune", l, f, null).done) out.push("fortune");
  return out;
}

/** One of those a life can turn to, as the tray shows it: what it is, with whom, why or why not. */
export type LifeOffer = {
  readonly what: DoingId;
  readonly target: number;
  readonly icon: string;
  readonly label: string;
  readonly can: boolean;
  readonly words: string;
};

/** Those about a life by name, for the tray. */
export type LifeOfferFacts = {
  readonly hour: number;
  readonly children: readonly { readonly id: number; readonly name: string }[];
  readonly suitors: readonly { readonly id: number; readonly name: string }[];
  readonly rival: { readonly id: number; readonly name: string } | null;
  readonly atWar: boolean;
  readonly shrine: boolean;
};

/**
 * The tray: what this life could turn to now, the most pressing first (a need gone low, the next step of
 * what they want), each saying what it would come to. Nothing here decides: it only reads.
 */
export function lifeOffers(l: Life, f: LifeFacts, o: LifeOfferFacts): LifeOffer[] {
  const out: LifeOffer[] = [],
    grown = f.age >= f.adulthood,
    wage = grown ? dayWage(f.occupation, l.skill, l.tool, f.ratio) : 0,
    [wIcon, wLabel] = WORK_WORDS[f.occupation] ?? WORK_WORDS[0]!,
    now = l.doing?.what,
    add = (
      what: DoingId,
      words: string,
      more: { target?: number; label?: string; icon?: string; can?: boolean } = {},
    ) =>
      out.push({
        what,
        target: more.target ?? -1,
        icon: more.icon ?? DOINGS[what].icon,
        label: more.label ?? DOINGS[what].label,
        can: (more.can ?? true) && now !== what,
        words,
      });
  if (l.fed < 0.35) add("eat", "Hungry: bread at home brings you back.");
  if (l.rested < 0.3) add("sleep", "Worn out: sleep until six.");
  if (grown)
    add(
      "work",
      f.occupation === OCC.leader
        ? `Hold court: hear the town out. Pays ${wage.toFixed(1)} coin a day. What a ruler can decree is under 👑 Rule.`
        : `A day's work pays ${wage.toFixed(1)} coin here now${workHours(l.settled, l.settled + 4 * HOUR) < 2 ? ", and past the day's hours what you make is the town's" : ""}.`,
      { icon: wIcon!, label: wLabel! },
    );
  else {
    add("learn", "Learn: what you know when grown your first work pays for.");
    add("play", "Play: a child's heart.");
  }
  if (l.want === "wed" || !f.partnered)
    for (const s of o.suitors) {
      const love = loveOf(l.bonds, s.id);
      add(
        "court",
        love >= WED_AT
          ? `${s.name} would have you: tap to ask.`
          : `Court ${s.name}: ${Math.round(love * 100)}% of the way to ${WED_AT * 100}%.`,
        { target: s.id, label: love >= WED_AT ? `Marry ${s.name}` : `Court ${s.name}` },
      );
    }
  if (l.fed >= 0.35) add("eat", "Sit down to bread at home.");
  if (grown)
    for (const c of o.children.slice(0, 3))
      add("teach", `Teach ${c.name} your work: hours toward what they take up when grown.`, {
        target: c.id,
        label: `Teach ${c.name}`,
      });
  add(
    "family",
    f.partnered || f.children ? "Time with those at home: closer kin." : "Quiet at home.",
  );
  add("square", "Be seen in the square: your standing, and your heart.");
  add("market", "The market: better tools and good clothes, if the town has them.");
  if (o.shrine) add("pray", "Pray: a lighter heart.");
  if (o.atWar && grown)
    add("drill", "Your realm is at war: drill with the young for the levy's penny.");
  if (o.rival)
    add("face", `Have it out with ${o.rival.name} before the town: your standing or theirs.`, {
      target: o.rival.id,
      label: `Face ${o.rival.name}`,
    });
  if (l.rested >= 0.3) add("sleep", "Sleep until six.");
  add("rest", "Sit a while.");
  return out;
}

/** A better tool's price and a suit of good clothes' at the market's prices against their usual worth. */
export const toolCost = (ratio: number): number => Math.round(TOOL_COST * Math.max(0.5, ratio));
export const clothCost = (ratio: number): number => Math.round(CLOTH_COST * Math.max(0.5, ratio));

/** How a face-to-face goes: your standing and skill against theirs, by a draw. True: you carried it. */
export function faceGoes(u: number, mine: number, theirs: number): boolean {
  return u < dmath.clamp(0.5 + (mine - theirs) / 100, 0.15, 0.85);
}

/** How often a month a rival moves against you, and a suitor comes forward. */
export const RIVAL_MOVES = 0.04,
  SUITOR_COMES = 0.25;
