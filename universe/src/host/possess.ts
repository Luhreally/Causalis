// One of a town's people possessed, as the page sees it (Phase 60): the small world the sim keeps,
// stepped on by the bids the page has not yet sent (sim/hand/possess.ts possessionAhead) so that it
// draws the bodies and shows what each act came to between the seconds it sends; and told in words
// — the four acts under the thumb, what each would do or why it cannot be done here ("No forge here:
// he is a weaver"), what the last came to, and the strip of who he is. Reading only: the kept world
// is never stepped here, so looking moves nothing.
import { yearOfMoment, type World } from "../kernel/index.ts";
import {
  BODY_SAYS,
  FEMALE,
  GOODS,
  HAND_ACT,
  HAND_TOLD,
  OCC,
  STORE_GOOD,
  TRADE_PLACE,
  WORK_STAGES,
  handOffers,
  inHand,
  moodAt,
  nearestWorkPlace,
  workPlaceNear,
  type HandOffer,
  type LocalBody,
  type LocalWorld,
  type WorkPlaceKind,
} from "../rules/index.ts";
import {
  agentById,
  agentName,
  handOf,
  populationContext,
  possessionAhead,
  type Agent,
  type JoinArgs,
  type Possession,
  type Window,
} from "../sim/index.ts";
import {
  bodyAt,
  bodyLine as bodyWords,
  type PossessBody,
  type PossessLive,
  type PossessNow,
  type PossessOffer,
  type PossessStrip,
  type StruckNow,
} from "../bridge/index.ts";
import type { QueryHandler } from "./host.ts";
import { bodyFrameOf, handWoundsOf } from "./wounds.ts";

/** Each place in words. */
const PLACE_WORDS: Readonly<Record<WorkPlaceKind, string>> = {
  forge: "forge",
  wheel: "potter's wheel",
  loom: "loom",
  row: "field",
  granary: "granary",
  rack: "smithy's rack",
  boards: "drying boards",
  shop: "workshop",
};
/** Whose each place of work is. */
const PLACE_TRADE: Readonly<Partial<Record<WorkPlaceKind, string>>> = {
  forge: "smith",
  wheel: "potter",
  loom: "weaver",
  row: "farmer",
};
/** What one does at one's trade, as its act is labelled. */
const WORK_LABEL: Readonly<Record<string, readonly [string, string]>> = {
  smith: ["🔨", "Forge"],
  potter: ["🏺", "Throw"],
  weaver: ["🧵", "Weave"],
  farmer: ["🌾", "Reap"],
};
/** What a thing given to its store is, in words: hung on the rack, set on the boards. */
const GIVEN: Readonly<Partial<Record<WorkPlaceKind, readonly [string, string]>>> = {
  rack: ["Hang it", "hung on the smithy's rack"],
  boards: ["Set to dry", "set on the boards to dry"],
  shop: ["Lay it by", "laid by in the workshop"],
  granary: ["Store it", "put in the granary"],
};
/** Each of their work, as it is said. */
const OCC_WORDS = ["child", "forager", "farmer", "herder", "crafter", "trader", "leader"];
/** A good taken from a store, in words. */
const GOOD_WORDS: Readonly<Record<number, string>> = {
  [STORE_GOOD.granary!]: "a sack of grain",
  [STORE_GOOD.rack!]: "a tool",
  [STORE_GOOD.boards!]: "a pot",
  [STORE_GOOD.shop!]: "a length of cloth",
};

const an = (w: string) => `${/^[aeiou]/i.test(w) ? "an" : "a"} ${w}`;
const cap = (w: string) => w.charAt(0).toUpperCase() + w.slice(1);
const firstOf = (name: string) => name.replace(/ of .*$/, "");
const heOf = (sex: number) => (sex === FEMALE ? "she" : "he");
const hisOf = (sex: number) => (sex === FEMALE ? "her" : "his");
const himOf = (sex: number) => (sex === FEMALE ? "her" : "him");

/** Where a point lies from a body, in words: "12 m ahead", "30 m behind him", "8 m to his left". */
function whereFrom(b: LocalBody, x: number, z: number, sex: number): string {
  const dx = x - b.x,
    dz = z - b.z,
    d = Math.round(Math.hypot(dx, dz));
  let turn = Math.atan2(dx, dz) - b.yaw;
  while (turn > Math.PI) turn -= 2 * Math.PI;
  while (turn < -Math.PI) turn += 2 * Math.PI;
  // (A turn toward +x from facing +z is toward the body's left, as the view draws it.)
  const way =
    Math.abs(turn) < Math.PI / 4
      ? "ahead"
      : Math.abs(turn) > (3 * Math.PI) / 4
        ? `behind ${himOf(sex)}`
        : turn > 0
          ? `to ${hisOf(sex)} left`
          : `to ${hisOf(sex)} right`;
  return `${d} m ${way}`;
}

/** The small world stepped ahead, kept for the bids last asked (the next ask steps only those added). */
type Ahead = {
  readonly kept: number;
  readonly letters: string;
  readonly joins: string;
  local: LocalWorld;
};
const AHEAD = new WeakMap<Possession, Ahead>();

/**
 * The small world as the bids not yet sent make it: from what was last asked if these go on from
 * those (the same second, the same joining), else from the kept one afresh. Null: bids that are not.
 */
function aheadOf(
  world: World,
  p: Possession,
  letters: string,
  joins: readonly JoinArgs[],
): LocalWorld | null {
  const life = populationContext(world).life,
    key = JSON.stringify(joins),
    was = AHEAD.get(p);
  if (
    was &&
    was.kept === p.local.step &&
    was.joins === key &&
    letters.startsWith(was.letters) &&
    letters.length > was.letters.length
  ) {
    const k = was.letters.length / 3,
      rest = joins.filter((j) => j.when >= k).map((j) => ({ ...j, when: j.when - k })),
      local = possessionAhead(
        world,
        life,
        letters.slice(was.letters.length),
        rest,
        world.now + 1,
        was.local,
      );
    if (local) {
      AHEAD.set(p, { kept: p.local.step, letters, joins: key, local });
      return local;
    }
  }
  if (was && was.kept === p.local.step && was.joins === key && was.letters === letters)
    return was.local;
  const local = possessionAhead(world, life, letters, joins);
  if (local) AHEAD.set(p, { kept: p.local.step, letters, joins: key, local });
  return local;
}

/** The one possessed and the town about him (null: no one is). */
export function possessNow(world: World): PossessNow | null {
  const w = handOf(world).resting,
    p = w?.possessed;
  if (!w || !p) return null;
  const v = populationContext(world).settlements.get(w.village)!;
  return {
    agent: p.agent,
    ref: `agent:${p.agent}`,
    name: p.name,
    town: w.village,
    townName: v.name,
    from: p.from,
    step: p.local.step,
    x: p.scene.x,
    z: p.scene.z,
    trade: p.scene.trade,
    form: p.scene.form,
    places: p.scene.places,
    bodies: p.local.bodies.map((b) => b.id),
    ended: p.local.ended,
  };
}

/** The words of one reading of the small world: names by id, the possessed's sex. */
type Speaker = {
  readonly name: (id: number) => string;
  readonly sex: number;
  readonly me: Agent | undefined;
  readonly first: string;
  /** What he is: "a smith of Sairis, 34". */
  readonly what: string;
};
function speakerOf(world: World, w: Window, p: Possession): Speaker {
  const ctx = populationContext(world),
    v = ctx.settlements.get(w.village)!,
    me = agentById(w, p.agent),
    names = new Map<number, string>();
  return {
    name: (id) => {
      if (id === p.agent) return firstOf(p.name);
      let n = names.get(id);
      if (n === undefined) {
        const a = agentById(w, id);
        n = a ? firstOf(agentName(ctx, a, v)) : "one of the town";
        names.set(id, n);
      }
      return n;
    },
    sex: me?.sex ?? 1,
    me,
    first: firstOf(p.name),
    what: whatOf(world, w, p, me),
  };
}

/** What a carried thing is, in words ("the sickle he made", "a sack of grain"). */
function thingWords(l: LocalWorld, carry: number, sex: number): string {
  if (carry < 0) {
    const form = l.made[-carry - 1]?.form ?? "thing";
    return `the ${form} ${heOf(sex)} made`;
  }
  return GOOD_WORDS[carry - 1] ?? GOODS[carry - 1]?.name ?? "goods";
}

/** What the possessed is about while he cannot act, in words. */
function busyWords(a: LocalBody): string {
  return a.doing === "work"
    ? "at his work"
    : a.doing === "strike"
      ? "striking"
      : a.doing === "wrestle"
        ? "in a hold"
        : a.doing === "thrown"
          ? "thrown to the ground"
          : "about something";
}

/** His trade's place in words, and why the work cannot be done where he stands. */
function noPlaceWords(p: Possession, a: LocalBody, s: Speaker): string {
  const trade = p.scene.trade,
    kind = TRADE_PLACE[trade]!,
    mine = PLACE_WORDS[kind],
    // (At another trade's place: it is theirs.)
    other = (["forge", "wheel", "loom", "row"] as const).find(
      (k) => k !== kind && workPlaceNear(p.scene, a, [k], 2.4) >= 0,
    ),
    near = nearestWorkPlace(p.scene, a, kind),
    at = near.place >= 0 ? p.scene.places[near.place]! : null,
    there = at
      ? `the nearest is ${whereFrom(a, at.x, at.z, s.sex)}`
      : `there is none in this town drawn`;
  return other
    ? `No ${mine} here: ${heOf(s.sex)} is ${an(trade)}, and the ${PLACE_WORDS[other]} is ${an(PLACE_TRADE[other]!)}'s — ${there}`
    : `No ${mine} here: ${heOf(s.sex)} is ${an(trade)} — ${there}`;
}

/** What he is, in a few words: "a smith of Sairis, 34". */
function whatOf(world: World, w: Window, p: Possession, me: Agent | undefined): string {
  const town = populationContext(world).settlements.get(w.village)!.name,
    age = me ? yearOfMoment(world.now) - me.birthYear : null,
    work = p.scene.trade || (me ? (OCC_WORDS[me.occupation] ?? "one") : "one");
  return `${an(me && me.occupation === OCC.dependent && !p.scene.trade ? "child" : work)} of ${town}${age !== null ? `, ${age}` : ""}`;
}

/** Why one can or cannot do an act now, in words, with its label. */
function offerOf(
  p: Possession,
  l: LocalWorld,
  a: LocalBody,
  o: HandOffer,
  slot: number,
  s: Speaker,
): PossessOffer {
  const trade = p.scene.trade,
    form = p.scene.form,
    busy = o.why === "busy" ? `${s.first} is busy: ${busyWords(a)}` : null,
    down = o.why === "down" ? `${s.first} is struck down` : null,
    held = inHand(l, a.carry),
    target = o.target >= 0 ? s.name(o.target) : "";
  if (slot === 0) {
    if (o.act === HAND_ACT.work) {
      const [icon, label] = WORK_LABEL[trade] ?? ["🛠️", "Work"],
        named = form === "row" ? ["⛏️", "Hoe"] : [icon, label];
      return {
        act: o.act,
        icon: named[0]!,
        label: named[1]!,
        can: !o.why,
        words:
          down ??
          busy ??
          (o.why === "no-trade"
            ? `No craft in ${hisOf(s.sex)} hands to work here: ${heOf(s.sex)} is ${s.what} — a smith works at a forge, a potter at a wheel, a weaver at a loom, a farmer in the fields`
            : o.why === "no-place"
              ? noPlaceWords(p, a, s)
              : `Work at the ${PLACE_WORDS[TRADE_PLACE[trade]!]}: stage ${l.work + 1} of ${WORK_STAGES} of ${form === "row" ? "a row hoed" : an(form)}`),
      };
    }
    if (o.act === HAND_ACT.drop && o.place >= 0) {
      const kind = p.scene.places[o.place]!.kind,
        [label, done] = GIVEN[kind] ?? ["Give it", "given"];
      return {
        act: o.act,
        icon: "📥",
        label,
        can: !o.why,
        words: down ?? busy ?? cap(`${thingWords(l, a.carry, s.sex)}, ${done}: the town's`),
      };
    }
    if (o.act === HAND_ACT.take) {
      const kind = p.scene.places[o.place]!.kind,
        good = STORE_GOOD[kind]!;
      return {
        act: o.act,
        icon: "🫳",
        label: `Take ${GOODS[good]?.name ?? "goods"}`,
        can: !o.why,
        words:
          down ??
          busy ??
          `Take ${GOOD_WORDS[good] ?? "goods"} from the ${PLACE_WORDS[kind]}: a theft, if anyone sees`,
      };
    }
    if (o.act === HAND_ACT.pick)
      return {
        act: o.act,
        icon: "✋",
        label: "Pick up",
        can: !o.why,
        words: down ?? busy ?? "Pick up what lies here",
      };
    return {
      act: o.act,
      icon: "⬇️",
      label: "Set down",
      can: !o.why,
      words: down ?? busy ?? `Set down ${thingWords(l, a.carry, s.sex)}`,
    };
  }
  if (o.act === HAND_ACT.talk)
    return {
      act: o.act,
      icon: "💬",
      label: "Talk",
      can: !o.why,
      words:
        down ??
        busy ??
        (o.why ? `No one before ${himOf(s.sex)} to talk to` : `Talk to ${target}: a word heartens`),
    };
  if (o.act === HAND_ACT.strike) {
    const armed = held.form ?? (a.carry > 0 && held.blow === "edge" ? "tool" : null);
    return {
      act: o.act,
      icon: held.blow === "edge" || held.blow === "point" ? "🗡️" : "👊",
      label: "Strike",
      can: !o.why,
      words:
        down ??
        busy ??
        (o.why
          ? `No one within ${hisOf(s.sex)} reach to strike`
          : `Strike ${target} ${armed ? `with the ${armed}` : `with ${hisOf(s.sex)} fists`}`),
    };
  }
  return {
    act: o.act,
    icon: "🤼",
    label: "Wrestle",
    can: !o.why,
    words:
      down ??
      busy ??
      (o.why
        ? `No one close enough to take hold of`
        : `Wrestle ${target}: the stronger throws the other`),
  };
}

/** What the last act came to, in words; and whether it went as it was bid. */
function toldOf(
  p: Possession,
  l: LocalWorld,
  a: LocalBody,
  s: Speaker,
): { words: string; step: number; good: boolean } | null {
  const [code, step, id, more] = l.told as [number, number, number, number],
    what = HAND_TOLD[code] ?? "",
    who = id >= 0 ? s.name(id) : "",
    he = s.first,
    last = <K extends string>(kind: K) =>
      l.deeds.findLast((d) => d.kind === kind && ("agent" in d ? d.agent === id : true)),
    told = (words: string, good = true) => ({ words, step, good });
  switch (what) {
    case "":
      return null;
    case "worked":
      return told(
        `${p.scene.form === "row" ? "The row" : `The ${p.scene.form}`}: stage ${more} of ${WORK_STAGES} done`,
      );
    case "made": {
      const form = l.made[more]?.form ?? p.scene.form;
      return told(
        form === "row"
          ? `A row hoed by ${he}'s hands: the town's work`
          : `${cap(an(form))} made by ${he}'s hands: the town's, ${hisOf(s.sex)} making`,
      );
    }
    case "no-trade":
      return told(`No craft in ${he}'s hands to work here`, false);
    case "no-place":
      return told(noPlaceWords(p, a, s), false);
    case "spoke": {
      const d = last("spoke") as { mood: number } | undefined;
      return told(
        (d?.mood ?? 0) > 0
          ? `${he} spoke to ${who}: ${who} is heartened`
          : `${he} spoke to ${who}, who turned away`,
      );
    }
    case "no-one":
      return told(
        more === 1
          ? `No one within ${he}'s reach to strike`
          : more === 2
            ? "No one close enough to take hold of"
            : `No one before ${he} to talk to`,
        false,
      );
    case "struck":
      return told(`${he} struck ${who}`);
    case "missed":
      return told(`${he} swung at ${who} and missed`, false);
    case "felled": {
      const d = last("struck") as { dead: boolean } | undefined;
      return told(`${who} is struck down${d?.dead ? ", dead" : ""}`);
    }
    case "held":
      return told(`${he} has hold of ${who}`);
    case "threw":
      return told(`${he} threw ${who} to the ground`);
    case "thrown":
      return told(`${who} threw ${he} to the ground`, false);
    case "took": {
      const d = l.deeds.findLast((x) => x.kind === "took") as { seen: number } | undefined;
      return told(
        `${he} took ${GOOD_WORDS[more] ?? "goods"}${d?.seen ? ` — seen by ${d.seen}` : ", unseen"}`,
      );
    }
    case "nothing":
      return told(more === 1 ? "Nothing lying here to pick up" : "No store within reach", false);
    case "full":
      return told(`${he}'s hands are full: set down what ${heOf(s.sex)} holds first`, false);
    case "picked":
      return told(`${he} picked up ${thingWords(l, more, s.sex)}`);
    case "set":
      return told(`${he} set down ${thingWords(l, more, s.sex)}`);
    case "gave": {
      const d = l.deeds.findLast((x) => x.kind === "gave") as { to: WorkPlaceKind } | undefined,
        done = d ? (GIVEN[d.to]?.[1] ?? "given") : "given";
      return told(cap(`${thingWords(l, more, s.sex)}, ${done}: the town's`));
    }
    case "empty":
      return told(`${he}'s hands are empty`, false);
    case "busy":
      return told(`${he} is busy`, false);
    case "parted":
      return told(`${who} came running and parted the brawl`);
    case "down":
      return told(`${he} is struck down by ${who}: your hand lets go`, false);
    default:
      return null;
  }
}

/**
 * His body in a line by the Body model (Phase 55 wave 5, bridge/body.ts): the wounds blows by hand
 * dealt him before (host/wounds.ts handWoundsOf), and the blows he has taken this while — "Whole";
 * "Struck in his left arm this day"; "Lost his right leg in a brawl in Sairis in 300".
 */
function bodyLine(world: World, l: LocalWorld, p: Possession, s: Speaker): string {
  const frame = bodyFrameOf(world),
    wounds = s.me ? handWoundsOf(world, s.me) : [],
    struck: StruckNow[] = l.deeds.flatMap((d) =>
      d.kind === "struck" && d.agent === p.agent
        ? [{ member: d.place, lost: d.maimed && frame.losable.includes(d.place), fell: d.dead }]
        : [],
    );
  return bodyWords(bodyAt(frame, wounds, world.now, null, struck), wounds, world.now, s.sex);
}

/** The small world as the page draws it, and its words. */
function liveOf(world: World, w: Window, p: Possession, l: LocalWorld): PossessLive {
  const a = l.bodies[0]!,
    s = speakerOf(world, w, p),
    offers = handOffers(p.scene, l),
    body = (b: LocalBody): PossessBody => {
      const h = b.carry ? inHand(l, b.carry) : null;
      return {
        id: b.id,
        x: b.x,
        z: b.z,
        yaw: b.yaw,
        vx: b.vx,
        vz: b.vz,
        doing: b.doing,
        task: b.task,
        carry: h && h.carry ? h.carry : null,
        say: BODY_SAYS[b.say] ?? "",
      };
    },
    strip: PossessStrip = {
      name: s.first,
      what: s.what,
      strength: Math.max(0, Math.min(1, a.strength)),
      carries: a.carry ? thingWords(l, a.carry, s.sex) : "empty-handed",
      body: bodyLine(world, l, p, s),
    };
  return {
    step: l.step,
    kept: p.local.step,
    bodies: l.bodies.map(body),
    lying: l.lying.map((x) => {
      const h = inHand(l, x.carry);
      return {
        x: x.x,
        z: x.z,
        what: thingWords(l, x.carry, s.sex),
        carry: h.carry || null,
      };
    }),
    offers: offers.map((o, i) => offerOf(p, l, a, o, i, s)),
    told: toldOf(p, l, a, s),
    strip,
    deeds: {
      made: l.deeds.filter((d) => d.kind === "made").length,
      struck: l.deeds.filter((d) => d.kind === "struck" && d.by === p.agent).length,
      spoke: l.deeds.filter((d) => d.kind === "spoke").length,
      took: l.deeds.filter((d) => d.kind === "took").length,
    },
    ended: l.ended,
  };
}

export const POSSESS_QUERIES: Readonly<Record<string, QueryHandler>> = {
  /** The one possessed and the town about him (null: no one is). */
  "possess.now": (world) => possessNow(world),
  /**
   * How one of the hand's people's spirits stand now, as the god's hand moved them (-1 … 1, faded
   * since; 0: never moved), and what was done to them in the god's hand (null: not one of them).
   */
  "possess.mood": (world, args) => {
    const w = handOf(world).resting,
      id = (args as { id?: unknown } | null)?.id,
      a = w && Number.isInteger(id) ? agentById(w, id as number) : undefined;
    if (!a) return null;
    return {
      mood: a.mood ? Math.round(moodAt(a.mood.by, a.mood.at, world.now) * 1000) / 1000 : 0,
      struck: a.struck?.length ?? 0,
    };
  },
  /**
   * The small world stepped on by the bids of the second begun (`steps`, three letters each, at most
   * twenty) and those joining it (`joins`), as the page draws it; null: no one is possessed, or the
   * bids are not.
   */
  "possess.live": (world, args) => {
    const w = handOf(world).resting,
      p = w?.possessed;
    if (!w || !p) return null;
    const a = (args ?? {}) as { steps?: unknown; joins?: unknown },
      letters = typeof a.steps === "string" ? a.steps : "",
      joins = Array.isArray(a.joins) ? (a.joins as JoinArgs[]) : [],
      local = aheadOf(world, p, letters, joins);
    return local ? liveOf(world, w, p, local) : null;
  },
};
