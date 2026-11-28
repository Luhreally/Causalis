// The sagas of lines lived (Live a Line, asked 2026-11-27): what a player did as a line of the world's life, cell by cell
// and generation by generation, kept with the world (in its save) so a line can be gone on with, and nowhere else. It is
// an observer's store outside the rules, as readings.years and readings.places are: never hashed, no part of the ruleset,
// holding nothing (dormant) until a line is first lived. Nothing of history reads it, so a world runs the same with it
// or without it. What a saga holds is the page's to say (app/line.ts: its choices, its deep clock, its stage); it is kept
// within a byte budget here. The page's askings of the world for a line (its liquid, its bodies, its young) are answered by
// host/line.ts, fetched by the worker only when a line is first lived.
import type { Hasher, StateStore, World } from "../kernel/index.ts";
import { isProvinceWorld, type Genome, type HomeWorld, type Way } from "../gen/index.ts";
import { homePlanet } from "../sim/index.ts";
import type { QueryHandler } from "./host.ts";

/** The most sagas kept (the least lately played let go first), and the most bytes they may hold in all. */
const SAGAS_MOST = 6,
  BYTES_MOST = 48_000;

export class SagaStore implements StateStore {
  readonly name = "readings.saga";
  readonly observational = true;
  readonly outsideRules = true;
  sagas: { id: number; at: number; data: unknown }[] = [];
  next = 1;
  private uses = 0;

  dormant(): boolean {
    return this.sagas.length === 0;
  }
  hashInto(h: Hasher): void {
    // (Never asked: a saga is no part of the world's hash.)
    h.int(0);
  }
  /** A saga kept (id 0: a new one, given its id): the least lately played let go while there are too many or too much. */
  keep(id: number, data: unknown): number {
    const at = ++this.uses,
      was = id > 0 ? this.sagas.find((s) => s.id === id) : undefined,
      sid = was?.id ?? this.next++;
    if (was) Object.assign(was, { at, data });
    else this.sagas.push({ id: sid, at, data });
    while (
      this.sagas.length > 1 &&
      (this.sagas.length > SAGAS_MOST || JSON.stringify(this.sagas).length > BYTES_MOST)
    ) {
      let least = 0;
      for (let i = 1; i < this.sagas.length; i++) if (this.sagas[i]!.at < this.sagas[least]!.at) least = i;
      if (this.sagas[least]!.id === sid) break;
      this.sagas.splice(least, 1);
    }
    return sid;
  }
  save(): unknown {
    return { next: this.next, uses: this.uses, sagas: this.sagas };
  }
  load(state: unknown): void {
    const s = state as { next?: number; uses?: number; sagas?: { id: number; at: number; data: unknown }[] };
    this.next = s.next ?? 1;
    this.uses = s.uses ?? 0;
    this.sagas = (s.sagas ?? []).map((x) => ({ ...x, data: structuredClone(x.data) }));
  }
}

/** Kept beside every world: empty, and nothing of it asked, until a line is lived. */
export function installSaga(world: World): void {
  if (!world.hasStore("readings.saga")) world.register(new SagaStore());
}

const sagaOf = (world: World) => world.peek<SagaStore>("readings.saga") ?? null;

/**
 * An asking of the line's own (host/line.ts), answered once its code is fetched: the god game's worker carries none of
 * it until a line is first lived. Pure reads of the world as generated, whenever they are answered.
 */
type LineArgs = {
  ref?: string;
  digest: string;
  saga: number;
  gen: number;
  genome?: Genome;
  way?: Way;
  my?: number;
  to?: number;
};
const later =
  (run: (m: typeof import("./line.ts"), g: HomeWorld, a: LineArgs) => unknown): QueryHandler =>
  (world, args) => {
    const g0 = homePlanet(world).generated,
      g = isProvinceWorld(g0) ? g0.fine : g0;
    return import("./line.ts").then((m) => run(m, g, (args ?? {}) as LineArgs));
  };

/** The page's askings: what a line is lived in, the bodies it founds and the young it goes on in, the sagas kept. */
export function sagaQueries(): Readonly<Record<string, QueryHandler>> {
  return {
    "line.facts": later((m, g, a) => m.lineFactsOf(g, a.ref ?? null)),
    "line.founders": later((m, g, a) => m.foundersOf(g, a.digest, a.saga, a.gen)),
    "line.young": later((m, g, a) => m.youngOf(g, a.genome!, a.way!, a.my!, a.digest, a.saga, a.gen)),
    "line.bred": later((m, g, a) => m.bredOn(g, a.genome!, a.way!, a.my!, a.to!, a.digest, a.saga, a.gen)),
    "saga.list": (world) =>
      [...(sagaOf(world)?.sagas ?? [])].sort((a, b) => b.at - a.at).map((s) => ({ id: s.id, data: s.data })),
    "saga.keep": (world, args) => {
      const a = args as { id: number; data: unknown };
      if (!world.hasStore("readings.saga")) installSaga(world);
      return sagaOf(world)!.keep(a.id, a.data);
    },
  };
}
