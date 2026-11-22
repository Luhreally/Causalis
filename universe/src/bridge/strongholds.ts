// Strongholds and seats (asked 2026-11-21: "we're missing castles and private homes ... and how all that looks different?";
// corrected the same day: from first principles, as they arose, not a ladder keyed to the age). One rule:
//
//   • A holder fortifies what others can reach. A realm's seat is the state's; a great house's seat land is its own. A house
//     raises a stronghold of its own only where the realm's will is weakly done on its land: where it is well done the realm
//     keeps the peace, and private walls do not pay.
//   • A stronghold answers the pressure on its land: the battles fought on it, and (half as much) on the lands beside it, in
//     the years about. Each is met with what its foe brought, read off what the foe knew when it came: hands and ladders,
//     siege engines, shot, or what comes after (arms that loose their own fire, armour, rockets).
//   • What the wall must be is what the attacker brings. Against hands and ladders, height and a ditch: an earth mound and a
//     palisade, or a stone keep in a curtain where the land builds in stone and the holder can pay. Against engines, thick
//     walls and towers that flank them; rings within rings where the pressure comes again and again and the holder can pay.
//     Against shot, high thin walls fail: low, thick, earth-backed and angled bastions, which only a state can pay for: a
//     private castle stops paying. Against what comes after, no wall answers.
//   • Cost against means: a poor holder, or a land with no stone, builds in earth and timber whatever the threat.
//   • When the threat goes (no battle near it for a long while, or arms that no wall answers), the seat turns to display. A
//     stronghold kept up by a holder who still holds it and can pay is lived in, its grounds laid out; else it falls to a
//     ruin. A house that holds its land and can pay raises a country house; a state whose clerks reach far, offices.
//   • It stands where an attacker would face the most: up the town's rise, behind its water (a bend, a headland), never on
//     water nor across a road in.
//
// Pure: facts in (read by the host from what the world keeps, host/strongholds.ts), a stronghold out; the views draw it and
// its page says it. Nothing kept; no world's history turns on it.
import { wetGround, type TownSite } from "./sites.ts";

/** What a foe brought against a land: hands and ladders, siege engines, shot, or what comes after. */
export const BROUGHT = { hands: 0, engines: 1, shot: 2, beyond: 3 } as const;
export type Brought = (typeof BROUGHT)[keyof typeof BROUGHT];

/** A battle that pressed a land: when, what its foe brought, how near (1 on the land, 0.5 beside it). */
export type HoldThreat = {
  readonly year: number;
  readonly brought: Brought;
  readonly weight: number;
  /** The battle's event, and its foe's name (for its page). */
  readonly event?: string;
  readonly foe?: string;
};

/** What a stronghold is reckoned from, all read from what the world keeps. */
export type HoldFacts = {
  /** Whose: a realm's seat, or a great house's seat land. */
  readonly holder: "realm" | "house";
  /** The battles that pressed its land, oldest first. */
  readonly threats: readonly HoldThreat[];
  readonly now: number;
  /** What its land knows of raising walls (the summed `walls` effect of what it knows: 0 none, 1 it builds in stone…). */
  readonly walls: number;
  /** What the holder can pay (0 … 1). */
  readonly means: number;
  /** How far its realm's will is done on its land (0 … 1). */
  readonly reach: number;
  /** Whether the holder still holds it. */
  readonly holds: boolean;
};

/** The strongholds, weakest first: earth mound and palisade; stone keep in a curtain; curtain flanked by towers; rings; bastions. */
export const HOLD_FORMS = ["mound", "keep", "towers", "rings", "bastions"] as const;
export type HoldForm = (typeof HOLD_FORMS)[number];
/** The seats of display: a country house in its park; offices of state. */
export type ShowForm = "house" | "offices";
export type HoldState = "held" | "kept" | "ruin";

export type Hold = {
  /** The strongest stronghold raised there (null: none ever was). */
  readonly form: HoldForm | null;
  /** The year it was raised to that form (or first raised), and the threats it answers (the last few). */
  readonly raised: number;
  /** The battle that raised it to that form (its foe and what it brought). */
  readonly by: HoldThreat | null;
  readonly answers: readonly HoldThreat[];
  /** Manned; kept up and lived in, its threat gone; or a ruin. */
  readonly state: HoldState;
  /** Why its threat went (null: it has not): no battle near for long, or arms no wall answers. */
  readonly gone: "secure" | "outmatched" | null;
  /** A seat of display raised there since (null: none). */
  readonly show: ShowForm | null;
  /** Built in stone (else earth and timber). */
  readonly stone: boolean;
  /** The pressure on its land at its worst (battles' weight within PRESS_YEARS). */
  readonly worst: number;
};

/** How many years a battle presses its land; how much pressure raises a stronghold (a battle on the land, or two beside it). */
export const PRESS_YEARS = 40,
  PRESS_RAISE = 1,
  /** Pressure that comes again and again: rings within rings, where the holder can pay. */
  PRESS_RINGS = 3;
/** No battle near for so long (years): the land is secure, and walls stop paying. */
export const GONE_YEARS = 120;
/** A great house fortifies its own land only where its realm's will is done less than this. */
export const PRIVATE_REACH = 0.6;
/** What each costs (means, 0 … 1); a stone keep, towers and rings need the land to build in stone. */
export const HOLD_COST: Readonly<Record<HoldForm, number>> = {
  mound: 0,
  keep: 0.3,
  towers: 0.35,
  rings: 0.6,
  bastions: 0.45,
};
/** A stronghold is kept up by a holder who can pay this; a country house raised by one who can pay this; offices where its will is done this far. */
export const KEEP_MEANS = 0.25,
  SHOW_MEANS = 0.4,
  OFFICE_REACH = 0.7;

const rankOf = (f: HoldForm | null): number => (f ? HOLD_FORMS.indexOf(f) : -1);

/** What answers a threat (null: nothing the holder can raise or would pay for). */
export function holdFor(
  brought: Brought,
  pressure: number,
  stone: boolean,
  means: number,
  holder: "realm" | "house",
): HoldForm | null {
  if (brought === BROUGHT.beyond) return null;
  if (brought === BROUGHT.shot)
    // (High thin walls fail against shot: low earth-backed bastions, which only a state can pay for.)
    return holder === "realm" && means >= HOLD_COST.bastions ? "bastions" : null;
  if (brought === BROUGHT.engines) {
    if (!stone) return "mound";
    if (pressure >= PRESS_RINGS && means >= HOLD_COST.rings) return "rings";
    return means >= HOLD_COST.towers ? "towers" : "mound";
  }
  return stone && means >= HOLD_COST.keep ? "keep" : "mound";
}

/** A holder's stronghold from its facts. */
export function holdOf(f: HoldFacts): Hold {
  const stone = f.walls >= 1,
    threats = [...f.threats].sort((a, b) => a.year - b.year),
    // (A house's own walls pay only where its realm does not keep the peace.)
    privateOk = f.holder === "realm" || f.reach < PRIVATE_REACH;
  let form: HoldForm | null = null,
    raised = 0,
    by: HoldThreat | null = null,
    worst = 0,
    lastMatter = -Infinity;
  const answers: HoldThreat[] = [];
  for (let i = 0; i < threats.length; i++) {
    const t = threats[i]!;
    if (t.brought === BROUGHT.beyond) continue;
    lastMatter = t.year;
    let pressure = 0;
    for (let j = i; j >= 0 && threats[j]!.year > t.year - PRESS_YEARS; j--)
      if (threats[j]!.brought !== BROUGHT.beyond) pressure += threats[j]!.weight;
    worst = Math.max(worst, pressure);
    if (pressure < PRESS_RAISE || !privateOk) continue;
    const want = holdFor(t.brought, pressure, stone, f.means, f.holder);
    if (rankOf(want) > rankOf(form)) {
      form = want;
      raised = t.year;
      by = t;
      answers.push(t);
    } else if (form) answers.push(t);
  }
  const latest = threats[threats.length - 1],
    gone: Hold["gone"] =
      latest && latest.brought === BROUGHT.beyond
        ? "outmatched"
        : f.now - lastMatter >= GONE_YEARS
          ? "secure"
          : null,
    state: HoldState = gone === null ? "held" : f.holds && f.means >= KEEP_MEANS ? "kept" : "ruin",
    show: ShowForm | null =
      gone === null || !f.holds || f.means < SHOW_MEANS
        ? null
        : f.holder === "realm"
          ? gone === "outmatched" && f.reach >= OFFICE_REACH
            ? "offices"
            : null
          : // (A house whose stronghold it keeps up lives in it: its country house is that.)
            form && state === "kept"
            ? null
            : "house";
  return {
    form,
    raised,
    by,
    answers: answers.slice(-4),
    state: form ? state : "held",
    gone,
    show,
    stone: stone && (form === null || form !== "mound"),
    worst,
  };
}

/** How broad a stronghold's or a seat's ground is (metres from its middle). */
export const HOLD_FOOT: Readonly<Record<HoldForm | ShowForm, number>> = {
  mound: 26,
  keep: 30,
  towers: 38,
  rings: 50,
  bastions: 64,
  house: 44,
  offices: 34,
};

/** A spot a stronghold or seat stands on (metres from the town's square), its turn (its gate toward the town), its ground's reach. */
export type HoldSpot = {
  readonly x: number;
  readonly z: number;
  readonly yaw: number;
  readonly r: number;
  /** What an attacker would face there: how much higher than the square (metres), and the share of its ring that is water. */
  readonly climb: number;
  readonly wet: number;
};

/** The bearings and rings a spot is sought on. */
const SPOT_WAYS = 24,
  SPOT_RINGS = [1, 1.3, 1.7, 2.2] as const;

/**
 * Where a stronghold or seat stands about its town: the spot, of those on rings from `out` metres, an attacker would face the
 * most at (up the town's rise; water about it on more sides, as in a river's bend or on a headland), a little the nearer the
 * better. Never on water, nor across a road in, nor on ground `free` refuses (a building, a main street, another spot).
 * Null where no spot is dry.
 */
export function holdSpot(
  site: TownSite | null | undefined,
  water: { readonly x: number; readonly z: number; readonly r: number } | null,
  out: number,
  r: number,
  free: (x: number, z: number, r: number) => boolean = () => true,
): HoldSpot | null {
  const wet = (x: number, z: number) =>
      wetGround(site, x, z) ||
      (!!water && Math.hypot(x - water.x, z - water.z) < water.r + (site?.wet ? 0 : 4)),
    roads = site?.roads.map((x) => x.bearing) ?? [],
    up = site?.up ?? 0,
    rise = site?.rise ?? 0;
  let best: HoldSpot | null = null,
    bestScore = -Infinity;
  for (const ring of SPOT_RINGS)
    for (let k = 0; k < SPOT_WAYS; k++) {
      const a = (k / SPOT_WAYS) * 2 * Math.PI,
        d = out * ring,
        x = d * Math.cos(a),
        z = d * Math.sin(a);
      // (Not across a road in: the road keeps a stronghold's breadth and more clear each side.)
      if (roads.some((b) => Math.abs(Math.atan2(Math.sin(a - b), Math.cos(a - b))) * d < r + 14))
        continue;
      let dry = !wet(x, z);
      for (let j = 0; dry && j < 8; j++) {
        const b = (j / 8) * 2 * Math.PI;
        if (wet(x + r * Math.cos(b), z + r * Math.sin(b))) dry = false;
        else if (wet(x + 0.55 * r * Math.cos(b + 0.4), z + 0.55 * r * Math.sin(b + 0.4)))
          dry = false;
      }
      if (!dry || !free(x, z, r)) continue;
      // (What an attacker faces: the climb up the town's rise to it, and water on the sides of its ring.)
      let sides = 0;
      for (let j = 0; j < 12; j++) {
        const b = (j / 12) * 2 * Math.PI;
        if (wet(x + 1.7 * r * Math.cos(b), z + 1.7 * r * Math.sin(b))) sides++;
      }
      // (Up the rise is read by the way it lies, not how far: the ground rises evenly, and a spot further out is no harder to
      // climb to from the ground beside it. Nearer is better: the holder's people and its town are close under it.)
      const climb = (rise * Math.cos(a - up) * d) / 1000,
        uphill = (rise * Math.cos(a - up) * out) / 1000,
        score = uphill / 4 + (2.5 * sides) / 12 - 0.8 * (ring - 1) - (sides >= 10 ? 1 : 0);
      if (score > bestScore + 1e-9) {
        bestScore = score;
        best = { x, z, yaw: Math.PI / 2 - a, r, climb: Math.round(climb), wet: sides / 12 };
      }
    }
  return best;
}

/** A form in words. */
export const HOLD_WORDS: Readonly<Record<HoldForm | ShowForm, string>> = {
  mound: "an earth mound and a palisade of timber, a ditch about them",
  keep: "a stone keep in a curtain wall",
  towers: "a thick curtain wall, flanked by towers",
  rings: "rings of walls within walls, each flanked by towers",
  bastions: "low earth-backed walls with angled bastions",
  house: "a country house in its park, an avenue of trees to its door",
  offices: "offices of state",
};
const BROUGHT_WORDS = [
  "hands and ladders",
  "siege engines",
  "shot",
  "arms that loose their own fire",
] as const;

/** Why a stronghold stands as it does, in plain lines: its holder's name and its land's in words. */
export function holdWhys(h: Hold, f: HoldFacts, holder: string, land: string): string[] {
  const out: string[] = [],
    Holder = holder.charAt(0).toUpperCase() + holder.slice(1);
  if (!h.form) {
    if (f.holder === "house" && f.reach >= PRIVATE_REACH && h.worst >= PRESS_RAISE)
      out.push(
        `${Holder} raised no walls of their own: the realm's will is done on ${land} ${Math.round(f.reach * 10)} parts in 10, and it keeps the peace there.`,
      );
    else if (h.worst < PRESS_RAISE)
      out.push(
        `No war pressed ${land} hard enough for ${holder} to fortify it: ${h.worst > 0 ? "a battle or so beside it, never one on it within a generation" : "no battle was fought on it or beside it"}.`,
      );
  } else {
    const last = h.by,
      brought = h.by?.brought ?? BROUGHT.hands;
    out.push(
      `${Holder} raised ${HOLD_WORDS[h.form]} in year ${h.raised}, against ${BROUGHT_WORDS[brought] ?? "hands and ladders"} brought on ${land}${last?.foe ? ` by ${last.foe}` : ""}.`,
    );
    if (h.form === "mound")
      out.push(
        f.walls < 1
          ? "Its land does not build in stone: earth and timber, however hard it was pressed."
          : "Its holder could not pay for stone: earth and timber.",
      );
    if (h.form === "rings")
      out.push("Its land was pressed again and again, and its holder could pay for a second ring.");
    if (h.form === "bastions")
      out.push(
        "High thin walls fall to shot: these are low, thick and earth-backed, angled so that no face is out of the guns' reach. Only a state can pay for them.",
      );
    if (
      f.holder === "house" &&
      h.answers.some((t) => t.brought === BROUGHT.shot) &&
      h.form !== "bastions"
    )
      out.push("Against shot a house's own walls stopped paying: it raised no more.");
  }
  if (h.gone === "outmatched")
    out.push("Its foes now bring arms no wall answers: walls stopped mattering here.");
  else if (h.gone === "secure" && h.form)
    out.push(
      `No battle has been fought near it for ${GONE_YEARS} years and more: its walls no longer pay.`,
    );
  if (h.form && h.gone)
    out.push(
      h.state === "kept"
        ? "Its holder still holds it and keeps it up: it is lived in, its grounds laid out about it."
        : f.holds
          ? "Its holder cannot pay to keep it up: it has fallen to a ruin."
          : "Its holder holds it no more: it has fallen to a ruin.",
    );
  if (h.show === "house")
    out.push(
      `${Holder} holds ${land} and can pay for display: a country house in its park, an avenue of trees to its door.`,
    );
  if (h.show === "offices")
    out.push(
      `The realm's will is done here ${Math.round(f.reach * 10)} parts in 10: its seat is offices of state.`,
    );
  return out;
}
