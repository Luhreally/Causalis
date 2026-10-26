// A battle seen near (Phase 37 M183, asked for 2026-10-24: "i still cant see warfare and like wars
// like theres no coherent animations and battle between them or a way to make time in a way for
// me to see the carnage"): what history says of one battle — its two hosts, how many each had in
// the field and how many of them fell, what they fought with, who won and what came of it — and
// the ground it was fought on: its land as it is now, its hills, its river, a seat's walls.
// Looked at, never lived: the battle is history's, and what is drawn follows what it says.
import type { Arms } from "./arms.ts";
import type { GenesisPlan, MeadowPlan } from "./genesis.ts";
import type { HostKinds } from "./wars.ts";

/** One of a battle's two hosts. */
export type BattleSideNear = {
  /** Its realm (a fallen one still has its name). */
  readonly ref: string;
  readonly name: string;
  readonly color: readonly [number, number, number];
  /** Its realm's arms (null: a realm fallen and forgotten). */
  readonly arms: Arms | null;
  /** The men it had in the field, and those of them who fell. */
  readonly fielded: number;
  readonly fallen: number;
  /**
   * Of those in the field, the men not of its host: where more fell than it fielded, the land's
   * men who rose with it (a defender's — at its seat the whole realm stands) or the levies sent
   * after it (an attacker's), counted with it so a remnant is left standing (none: its host alone).
   */
  readonly risen?: number;
  /** Of its men, the wounded who lived, and of them the maimed (Phase 55; absent in older saves). */
  readonly wounded?: number;
  readonly maimed?: number;
  /** Where its men came from, the most dead first, at most LEVY_SHOWN (absent in older saves). */
  readonly levy?: readonly LevyPlace[];
  /** What it fought with: its host's design (on foot with spears, where it had none). */
  readonly host: HostKinds | null;
  /** That host in words: "bronze swords and shields, on foot". */
  readonly kit: string;
  /** How much of its host bore that kit, 0 … 1 (Phase 52 M217; absent in older saves). */
  readonly armed?: number;
  /** Whether its realm knows black powder: it brings cannon to the field (Phase 37 M188). */
  readonly cannon?: boolean;
};

/** What the battle won: the field, a siege laid about a seat, a land taken, a seat stormed. */
export type BattleOutcome = "held" | "field" | "siege" | "taken" | "stormed";

/** A place a side's men came from (Phase 55 M224): a town, a land's countryside, or a land whole (its towns let go). */
export type LevyPlace = {
  readonly kind: "town" | "countryside" | "land";
  /** The town's ref (null: the countryside, or the land whole). */
  readonly ref: string | null;
  /** "Pounholt"; "the countryside of Lithiv's land"; "Lithiv's land". */
  readonly name: string;
  readonly cell: number;
  /** The men it sent to the field; of them, the fallen; of them, the wounded who lived. */
  readonly sent: number;
  readonly dead: number;
  readonly hurt: number;
};

export type BattleNear = {
  /** The battle's event, and its war's. */
  readonly event: string;
  readonly war: string;
  /** "The battle at Kanickath's land" — and where, and when. */
  readonly title: string;
  readonly cell: number;
  readonly land: string;
  readonly year: number;
  readonly attacker: BattleSideNear;
  readonly defender: BattleSideNear;
  /** Whether the attacker won. */
  readonly won: boolean;
  readonly outcome: BattleOutcome;
  /** Whether arms decided it: with even arms the day would have gone the other way (M217). */
  readonly tip?: boolean;
  /** A rising (a civil war's battle): what it was fought over (null: a war between realms). */
  readonly civil: string | null;
  /** The ground: hills the defenders hold, a river between, a seat's walls (0 none, 1 a palisade, 2 stone). */
  readonly hills: boolean;
  readonly river: boolean;
  readonly walls: 0 | 1 | 2;
  /** The town behind the walls, at a seat (null: none). */
  readonly town: string | null;
  /** The world's people's figure (their look, Phase 34), and the land's ground as it is now. */
  readonly figure: NonNullable<GenesisPlan["people"]>["figure"] | null;
  readonly plan: MeadowPlan;
};
