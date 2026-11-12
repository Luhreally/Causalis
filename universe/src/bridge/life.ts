// A life lived by the god's hand (Lives L3): what the page reads of it (`life.now`), and whom it may take up
// (`life.pick`). Plain data; the host makes it from the hand's Window (host/life.ts); nothing here is kept.

/** One of the things this life could turn to now (rules/life.ts lifeOffers). */
export type LifeOfferNow = {
  readonly what: string;
  readonly target: number;
  readonly icon: string;
  readonly label: string;
  readonly can: boolean;
  readonly words: string;
};

/** Someone about a life: who, how old, what they are to them, how they stand. */
export type LifeKin = {
  readonly id: number;
  readonly ref: string;
  readonly name: string;
  readonly age: number;
  /** "wife", "son", "mother", "sister", "rival", "free". */
  readonly is: string;
  /** -1 … 1. */
  readonly love: number;
  /** Their work, in a word. */
  readonly work: string;
};

/** A choice in a window that waits on the viewer: what is sent with its key, and what it says. */
export type LifeChoice = {
  readonly choice: number;
  readonly label: string;
  readonly words: string;
};

/** Something that waits on the viewer. */
export type LifeWindow = {
  readonly key: string;
  readonly kind: string;
  readonly icon: string;
  readonly title: string;
  readonly words: string;
  readonly choices: readonly LifeChoice[];
};

/** What a life is as it stands, carried forward to the moment asked. */
export type LifeNow = {
  /** The realm they rule, if the one lived is its ruler (Lives L4). */
  readonly rules?: string | null;
  readonly agent: number;
  readonly ref: string;
  readonly name: string;
  readonly town: string;
  readonly townName: string;
  /** "a smith of Sairis, 34". */
  readonly what: string;
  readonly home: number;
  readonly generation: number;
  readonly day: number;
  readonly fed: number;
  readonly rested: number;
  readonly heart: number;
  readonly purse: number;
  readonly standing: number;
  /** "a master, 8,200 hours". */
  readonly skill: string;
  readonly tool: number;
  readonly owned: boolean;
  readonly short: boolean;
  readonly doing: {
    readonly what: string;
    readonly from: number;
    readonly to: number;
    readonly target: number;
  } | null;
  readonly habit: number;
  readonly want: {
    readonly id: string;
    readonly icon: string;
    readonly label: string;
    readonly have: number;
    readonly goal: number;
    readonly words: string;
  } | null;
  readonly rival: {
    readonly id: number;
    readonly name: string;
    readonly purse: number;
    readonly standing: number;
    /** Bested once already (a want won against them, not set again). */
    readonly bested: boolean;
  } | null;
  /** What they have to their name: the purse, and their home if they own it. */
  readonly worth?: number;
  readonly kin: readonly LifeKin[];
  /** Those of them to draw, whom the plan must hold (Agent.id). */
  readonly about: readonly number[];
  readonly offers: readonly LifeOfferNow[];
  /** What can be bought while at the market (null: not there). */
  readonly market:
    | readonly {
        readonly good: "tool" | "cloth" | "stake";
        readonly label: string;
        readonly cost: number;
        readonly can: boolean;
        readonly words: string;
      }[]
    | null;
  readonly windows: readonly LifeWindow[];
  readonly log: readonly { readonly at: number; readonly words: string }[];
  /** Why it is over ("": it goes on). */
  readonly ended: string;
  /** Those it could go on as, when it is over. */
  readonly heirs: readonly LifeKin[];
};

/** A life that could be taken up, as the picker shows it. */
export type LifeCard = {
  readonly id: number;
  readonly ref: string;
  readonly name: string;
  readonly age: number;
  readonly what: string;
  readonly hook: string;
  /** Which of the town's homes (as the plan draws it, -1: when drawn). */
  readonly kind: string;
};
