// The sagas of lines lived (Live a Line, asked 2026-11-27): what a player did as a line of the world's life, cell by cell
// and generation by generation, kept with the world (in its save) so a line can be gone on with, and nowhere else. It is
// an observer's store outside the rules, as readings.years and readings.places are: never hashed, no part of the ruleset,
// holding nothing (dormant) until a line is first lived. Nothing of history reads it, so a world runs the same with it
// or without it. Only the store is here, in the god game's worker from the start (a save keeps what it holds); how a
// saga is kept within its bounds, and every asking of the world for a line, are host/line.ts's, which the worker fetches
// only when a line is first lived.
import type { Hasher, StateStore, World } from "../kernel/index.ts";
import type { QueryHandler } from "./host.ts";

export type Saga = { id: number; at: number; data: unknown };

export class SagaStore implements StateStore {
  readonly name = "readings.saga";
  readonly observational = true;
  readonly outsideRules = true;
  sagas: Saga[] = [];
  next = 1;
  uses = 0;
  dormant(): boolean {
    return !this.sagas.length;
  }
  hashInto(h: Hasher): void {
    // (Never asked: a saga is no part of the world's hash.)
    h.int(0);
  }
  save(): unknown {
    return { next: this.next, uses: this.uses, sagas: this.sagas };
  }
  load(state: unknown): void {
    // (What save() gave: its next, uses and sagas.)
    Object.assign(this, structuredClone(state));
  }
}

/** Kept beside every world: empty, and nothing of it asked, until a line is lived. */
export function installSaga(world: World): void {
  if (!world.hasStore("readings.saga")) world.register(new SagaStore());
}

/** What answers the page's askings of a line (host/line.ts's `ask`), and how the host comes by it. */
export type LineAsk = (type: string, world: World, args: unknown) => unknown;
let fetchAsk: () => Promise<LineAsk>;
/** Set by the host's entry: the worker fetches host/line.ts when a line is first lived; the in-page host has it. */
export function lineFrom(get: () => Promise<LineAsk>): void {
  fetchAsk = get;
}

/** The page's askings of a line, answered by host/line.ts once it is fetched. */
const ASKED = ["line.facts", "line.founders", "line.young", "line.bred", "saga.list", "saga.keep"];
export function sagaQueries(): Readonly<Record<string, QueryHandler>> {
  return Object.fromEntries(
    ASKED.map((type) => [
      type,
      (world: World, args: unknown) => fetchAsk().then((ask) => ask(type, world, args)),
    ]),
  );
}
