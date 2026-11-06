// A colony as the view reads it (Phase 64): the sky and ground its town stands under, how its ship
// came there, and the list of them all. Plain data: what is drawn from it is the view's.
import type { CampNear, TownPlan } from "./town.ts";
import type { VillagePlan } from "./village.ts";

/** What a colony's world is like where its halls stand. */
export type ColonyLook = {
  /** The body it stands on: its name, its page's ref, what it is, its air and its water. */
  readonly body: string;
  readonly bodyRef: string;
  readonly kind: string;
  readonly air: string;
  readonly water: string;
  /** Its air's pressure (atmospheres), its pull (g), the warmth of the ground there (°C). */
  readonly pressure: number;
  readonly gravity: number;
  readonly temperature: number;
  /** Which of its kind's colours its rock takes (0 … 1), as the world is painted seen whole. */
  readonly tint: number;
  /** Where on its world its halls stand: a cell of that world's own grid. */
  readonly hall: number;
  /** Whether ice lies where the halls stand. */
  readonly icy: boolean;
  /** The star's heat (K), how wide its disc stands in the sky (degrees), its light there (Earth's: 1). */
  readonly star: { readonly temperature: number; readonly disc: number; readonly light: number };
  /** What else hangs in its sky: a moon's planet, or a planet's moon (how wide, in degrees). */
  readonly over: {
    readonly designation: string;
    readonly kind: string;
    readonly degrees: number;
    readonly tint: number;
  } | null;
  /** How long a day is there (hours): a moon's is its month, turned one face to its planet. */
  readonly day: number;
  /** The year its first settlers came, the event of their coming, how many they were. */
  readonly founded: number;
  readonly event: string | null;
  readonly settlers: number;
  /** What its halls must keep against, in words (rules/habitat.ts). */
  readonly keeps: readonly string[];
  /**
   * How far its world has been remade (Phase 66; absent: not at all): 1, its air and warmth a home's now,
   * its people out from under their halls. Its air, pressure and warmth above are as they are now.
   */
  readonly remade?: number;
  /** Its port, where any run has come to it (Phase 71; absent: none has). */
  readonly port?: PortPlan;
  /**
   * For a landing's film (Phase 66; absent: its world has never been remade): how its remaking went, from the year
   * it was begun to the last it went on, how far it came, and the world it began from. The film plays it over the
   * years its town grows.
   */
  readonly remaking?: {
    readonly from: number;
    readonly to: number;
    readonly share: number;
    readonly base: {
      readonly air: string;
      readonly water: string;
      readonly pressure: number;
      readonly temperature: number;
      readonly icy: boolean;
    };
  };
};

/** A people on its own ground (Phase 69): how far it has come, and what the eye goes down to. */
export type FolkNear = {
  readonly ref: string;
  readonly name: string;
  readonly star: string;
  readonly index: number;
  readonly year: number;
  readonly stage: string;
  readonly stageWords: string;
  /** Its sky and ground. */
  readonly look: ColonyLook;
  /** Its camp, where it has no town; its town's ref, where it has (ruins: what stood). */
  readonly camp: CampNear | null;
  readonly town: string | null;
  /** Who came first, and how the two can meet (null: no one has come). */
  readonly contact: FolkContact | null;
  /** What their hands carry now. */
  readonly arms: readonly string[];
  readonly title: string;
  /** The year read at, where it is not now: a meeting filmed as it was found. */
  readonly at?: number;
};

/** A landing on a people's world (Phase 70): both sides' numbers, the fight they make, and how it is told. */
export type LandfallPlan = {
  readonly id: string;
  readonly star: string;
  readonly index: number;
  readonly n: number;
  readonly year: number;
  readonly nowYear: number;
  readonly kind: "home" | "people";
  readonly who: string;
  readonly whoRef: string;
  readonly sentBy: string | null;
  readonly color: readonly [number, number, number];
  readonly figure: NonNullable<VillagePlan["body"]>;
  readonly natives: string;
  readonly nativesRef: string;
  readonly stage: string;
  readonly stageWords: string;
  /** Whether it is fought at a camp (else a town). */
  readonly camp: boolean;
  readonly nativeFigure: NonNullable<VillagePlan["body"]>;
  /** Their world's pull. */
  readonly gravity: number;
  readonly ships: number;
  readonly flesh: number;
  readonly made: number;
  readonly years: number;
  readonly distance: number;
  /** Those who came: arm, guard, mount, as a host's parts are named. */
  readonly arm: string;
  readonly armWords: string;
  readonly guard: string;
  readonly mount: string;
  /** Those who met them: their arm; what they hold in words; whether a figure holds a shaft. */
  readonly nativeArm: string;
  readonly nativeArmWords: string;
  readonly nativeHolds: boolean;
  /** How many of them there are in all. */
  readonly people: number;
  readonly won: boolean;
  readonly how: "broke crossing" | "broke at the hand" | "overrun" | "held";
  readonly fielded: readonly [number, number];
  readonly dead: readonly [number, number];
  readonly crossed: number;
  readonly killedShare: number;
  readonly comerKilledShare: number;
  readonly brokeShare: number;
  readonly off: number;
  readonly nativeOff: number;
  readonly fire: readonly [
    { readonly rate: number; readonly range: number },
    { readonly rate: number; readonly range: number },
  ];
  readonly frames: readonly {
    readonly at: number;
    readonly dead: readonly [number, number];
    readonly morale: readonly [number, number];
    readonly pressure: number;
  }[];
  readonly rout: number | null;
  /** Whether anything burns in that world's air. */
  readonly burns: boolean;
  readonly terms: readonly string[];
  readonly landers: string;
  readonly cameWords: string;
  readonly metWords: string;
  readonly howWords: string;
  readonly costWords: string;
  readonly holds: "comers" | "natives";
  readonly holdsWords: string;
  readonly endWords: string;
  /** Whether those who came are on that world still. */
  readonly stay: boolean;
};
/** A landing on a people, in a line. */
export type LandfallRow = {
  readonly n: number;
  readonly year: number;
  readonly who: string;
  readonly won: boolean;
  readonly holds: string;
};

/** Who came to a people first, and what a meeting of the two can be, read off their numbers. */
export type FolkContact = {
  readonly year: number;
  readonly kind: "home" | "people";
  readonly who: string;
  /** The realm that sent a home ship. */
  readonly sentBy: string | null;
  /** A home ship's colony (its land). */
  readonly cell: number | null;
  readonly event: string | null;
  readonly foundStage: string;
  readonly found: string;
  readonly since: number;
  readonly reading: {
    readonly speak: FolkCan;
    readonly airThere: FolkCan;
    readonly airHome: FolkCan;
    readonly foodThere: FolkCan;
    readonly foodHome: FolkCan;
    readonly sickness: FolkCan;
  };
  readonly color: readonly [number, number, number];
  readonly figure?: NonNullable<VillagePlan["body"]>;
};
export type FolkCan = { readonly can: boolean; readonly words: string };

/** Every people about the stars within reach, and how far each has come. */
export type FolkList = readonly {
  readonly ref: string;
  readonly name: string;
  readonly star: string;
  readonly index: number;
  readonly stage: string;
  readonly followed: boolean;
  readonly came: number | null;
}[];

/** How a colony's ship came there, as history tells it. */
export type ColonyVoyage = {
  /** Within the star's system, a transfer flight; or between the stars, a voyage. */
  readonly kind: "system" | "star";
  /** The star sailed for, and which of its worlds (a voyage's). */
  readonly star: string | null;
  readonly planet: number | null;
  /** The body flown to, in the system's plan (a transfer's). */
  readonly body: number | null;
  /** Light-years (a voyage's). */
  readonly distance: number;
  /** The year it left and the year it arrived, and whether it has. */
  readonly departed: number;
  readonly arrives: number;
  readonly arrived: boolean;
  /** How long the crossing takes (days), and the speed asked of it (km/s; a transfer's). */
  readonly days: number;
  readonly speed: number | null;
  /** The drive it sailed by (a voyage's). */
  readonly drive: string | null;
  /** Why it went: the event of its founding or sailing. */
  readonly event: string | null;
};

/** One colony, or one ship still sailing, in the list of them. */
export type ColonyEntry = {
  /** Whether a run has ever come to it (Phase 71; absent: none). */
  readonly port?: boolean;
  /** Its world unmade (W6; absent: it stands): no one is there now. */
  readonly gone?: { readonly year: number; readonly by: string | null; readonly event: string };
  /** Its land. */
  readonly cell: number;
  /** Its town and its name (null: a ship still sailing). */
  readonly town: string | null;
  readonly name: string | null;
  /** The body it stands on (null: still sailing), its index in the system, and its kind. */
  readonly body: string | null;
  readonly bodyIndex: number;
  readonly kind: string | null;
  /** Another star's, its ref and which of its worlds. */
  readonly star: string | null;
  readonly planet: number | null;
  readonly people: number;
  /** The year it was founded (a ship's: the year it comes). */
  readonly founded: number;
  /** A ship's years of sailing and arriving (null: flown within the system). */
  readonly sailed: number | null;
  readonly arrives: number | null;
  readonly sailing: boolean;
  readonly event: string | null;
  /** Who rules it now, and who sent it. */
  readonly realm: string | null;
  readonly founder: string | null;
  /** How wide what hangs in its sky stands, in degrees (0: nothing does; a ship still sailing). */
  readonly sky: number;
  /** How far its world has been remade (Phase 66; 0: not at all). */
  readonly remade: number;
  /** How much of its world's ground is settled (0 … 1), and the people on all of it (Worlds filled). */
  readonly settled: number;
  readonly onWorld: number;
};

/** How far a world is filled (Worlds filled): what is drawn of it, and what is told. */
export type FillPlan = {
  readonly key: string;
  /** Its page. */
  readonly ref: string;
  /** Who first settled it, and when. */
  readonly who: string;
  readonly year: number;
  readonly sailing: boolean;
  /** Share of its usable ground settled now, and the most that can ever be. */
  readonly share: number;
  readonly top: number;
  readonly people: number;
  readonly holds: number;
  /** Whether its people can walk out on it. */
  readonly open: boolean;
  /** Whether a people of the water (its seas are their ground). */
  readonly sea: boolean;
  /** How many towns that many people make (est.). */
  readonly towns: number;
  /** Whether all it can settle is settled, and when. */
  readonly filled: number | null;
  readonly whole: boolean;
  /** The land it began as (null: no land holds it). */
  readonly cell: number | null;
  readonly star: string | null;
  readonly planet: number;
  readonly body: number;
  /** The words of what it is, why it is no more, and what stops it. */
  readonly head: string;
  readonly why: readonly string[];
  /** The people who were on it first. */
  readonly natives: string | null;
};

/** A colony's town at a few years of its growth, drawn as it stood then (for a film of it). */
export type ColonyGrowth = readonly {
  readonly year: number;
  readonly people: number;
  readonly homes: number;
  readonly town: TownPlan;
}[];

/** One who calls at a port (Phase 71). */
export type PortCaller = {
  readonly ref: string;
  readonly who: string;
  readonly color: readonly [number, number, number];
  /** A people of the stars, not a realm of the home people's. */
  readonly far: boolean;
  /** Years between its ships. */
  readonly every: number;
  readonly lanes: number;
  readonly goods: readonly string[];
};

/** A colony's port as the eye reads it, from what history holds (Phase 71). */
export type PortPlan = {
  readonly cell: number;
  readonly callers: readonly PortCaller[];
  readonly pads: number;
  readonly sheds: number;
  /** Boxes in its yard, by all that has come in. */
  readonly stacks: number;
  /** Ships a decade. */
  readonly busy: number;
  /** All its runs have ended: its pads stand cold. */
  readonly quiet: boolean;
  readonly raided: { readonly year: number; readonly by: string } | null;
  readonly head: string;
  /** The run to open first. */
  readonly run: string;
};
