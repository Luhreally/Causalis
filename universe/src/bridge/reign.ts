// A ruler ruled by the god's hand (Lives L4), as the page reads it. Plain data, made by host/reign.ts from what
// history holds; nothing here is kept.

export type ReignWar = {
  readonly ref: string;
  readonly foe: string;
  readonly foeName: string;
  /** "You went to war for ...", in words. */
  readonly words: string;
  readonly since: number;
  /** The fallen: yours and theirs. */
  readonly fallen: readonly [number, number];
  readonly battles: number;
  /** The last battle: its page, and a line. */
  readonly last: { readonly ref: string; readonly words: string } | null;
};

/** What binds a ruler's realm since a peace: who, what it comes to, in words. */
export type ReignBond = {
  readonly kind: "oath" | "vassal" | "pays" | "paid" | "truce";
  readonly other: string;
  readonly otherName: string;
  readonly words: string;
  readonly grain: number;
  readonly until: number;
  /** An oath of one's own: whether they could rise, and why not. */
  readonly can?: boolean;
  readonly why?: string;
};

/** A peace that could be offered or demanded. */
export type ReignOffer = {
  readonly id: string;
  readonly label: string;
  readonly can: boolean;
  /** What it comes to, or the answer they would give. */
  readonly words: string;
};

/** How the ruler's rule ended, and who is offered. */
export type ReignFall = {
  readonly how: "died" | "overthrown" | "realm";
  readonly title: string;
  readonly words: string;
  readonly event: string | null;
  /** Who holds the seat now (null: it stands no more). */
  readonly heir: { readonly name: string; readonly age: number; readonly tie: string } | null;
};

export type ReignNeighbour = {
  readonly ref: string;
  readonly short: string;
  readonly head: number;
  readonly people: number;
  readonly color: readonly [number, number, number];
};

/** What stops the clock of a ruler played by the god's hand (Lives L5): a plot against them, an heir dead. */
export type ReignDrama = {
  /** It is asked once: the event it stands on. */
  readonly key: string;
  readonly kind: "plot" | "heir" | "fire";
  readonly title: string;
  readonly words: string;
  /** The page of the one it is about, and its why. */
  readonly who: string | null;
  readonly event: string;
  readonly choices: readonly {
    /** "seize", "buy", "name:<figure>"; "let" sends nothing. */
    readonly id: string;
    readonly label: string;
    readonly can: boolean;
    readonly words: string;
  }[];
};

export type ReignNow = {
  readonly realm: string;
  readonly realmName: string;
  readonly ruler: string;
  readonly rulerRef: string;
  readonly age: number;
  readonly since: number;
  /** "chief of Sairis", "head of the assembly of Braeol". */
  readonly title: string;
  readonly town: string | null;
  /** What their station comes to, in a sentence: what they can do and how they are answered. */
  readonly station: string;
  readonly carry: number;
  readonly people: number;
  readonly lands: number;
  readonly beyond: number;
  readonly host: number;
  readonly legitimacy: number;
  /** The mean grievance of its lands (0 … 1), by their people. */
  readonly unrest: number;
  readonly tithe: number;
  /** Worth a head, its place among the realms, and those it meets, itself among them. */
  readonly head: number;
  readonly rank: number;
  readonly of: number;
  readonly neighbours: readonly ReignNeighbour[];
  readonly wars: readonly ReignWar[];
  /** What binds the realm since a peace (W7). */
  readonly bonds: readonly ReignBond[];
  /** The one who would come after, in words (eldest child by birth; else how rule passes). */
  readonly heir: string;
  /** Their spouse, in words (null: no one). */
  readonly spouse: string | null;
  /** The newest things told of the realm. */
  readonly told: readonly { readonly year: number; readonly words: string; readonly ref: string }[];
  readonly fell: ReignFall | null;
  /** What must be answered now, if anything (Lives L5). */
  readonly drama: ReignDrama | null;
};

/** One way a law could be set: what, and what it would cost (or why not). */
export type ReignDecreeOption = {
  readonly to: number;
  readonly label: string;
  readonly can: boolean;
  /** If it can be done: its cost, in words. If not: why, in the same words the world refuses it with. */
  readonly words: string;
};
export type ReignLaw = {
  readonly law: string;
  readonly title: string;
  readonly now: string;
  readonly options: readonly ReignDecreeOption[];
};
export type ReignDecrees = {
  /** Their standing, and how they are answered, in a line. */
  readonly words: string;
  readonly laws: readonly ReignLaw[];
};

/** A neighbour in reach of war: what fighting them would be. */
export type ReignFoe = {
  readonly ref: string;
  readonly name: string;
  readonly host: number;
  readonly opinion: number;
  /** "Rivals", "at peace", "sworn to you by a pact". */
  readonly regard: string;
  readonly can: boolean;
  /** Its cost in words, or why not. */
  readonly words: string;
  /** Lands to fight for, the richest first. */
  readonly aims: readonly { readonly cell: number; readonly name: string }[];
};
export type ReignWars = {
  readonly words: string;
  readonly host: number;
  readonly wars: readonly (ReignWar & {
    readonly can: boolean;
    readonly peace: string;
    readonly offers: readonly ReignOffer[];
  })[];
  readonly bonds: readonly ReignBond[];
  /** Wars over in the last few years: how each came out, in words. */
  readonly lately: readonly (ReignWar & { readonly came: string })[];
  readonly foes: readonly ReignFoe[];
};

export type ReignPerson = {
  readonly name: string;
  readonly sex: number;
  readonly born: number;
  readonly tie: string;
};
/** A match to be had with another house. */
export type ReignMatch = {
  readonly to: string;
  readonly toName: string;
  readonly who: ReignPerson;
  readonly partner: ReignPerson;
  readonly can: boolean;
  /** What it moves, in words, or why not. */
  readonly words: string;
  /** What the two realms think of each other now, and would. */
  readonly opinion: number;
  readonly after: number;
};
export type ReignMatches = {
  readonly words: string;
  readonly matches: readonly ReignMatch[];
};
/** Whom a ruler could send an envoy to, and what for (D1). */
export type ReignEnvoyRealm = {
  readonly ref: string;
  readonly name: string;
  readonly regard: string;
  readonly known: string;
  readonly errands: readonly {
    readonly errand: string;
    readonly label: string;
    readonly can: boolean;
    readonly words: string;
  }[];
};
export type ReignEnvoys = {
  readonly words: string;
  readonly realms: readonly ReignEnvoyRealm[];
};
