// "Does it?" (Phase 65): the seeds a catalogue ran in full, with the year each reached each age. History
// is deterministic, so a year here is exact for the rules it was run under. A catalogue of other rules,
// or one the deploy's bake found a world no longer keeping to, stays listed and is said to be from an
// earlier version: its years are close, not exact, until the worlds are next run. tools/catalogue-run.ts
// ran them, tools/catalogue.ts read them, and the deploy only carries the file.
import type { HostClient } from "../bridge/index.ts";
import { catalogueMoved } from "./jump.ts";

/** A world run in full, and what it came to. */
export type CatalogueSeed = {
  readonly universe: string;
  readonly seed: string;
  readonly kind: string;
  readonly medium: string;
  readonly lands: number;
  /** The year it first reached each age it reached, and what it called it. */
  readonly ages: Readonly<Record<string, { readonly year: number; readonly name: string }>>;
  /** Each fall it took: the year, the age it fell from and to, the year it came back if it did. */
  readonly falls: readonly {
    readonly year: number;
    readonly from: string;
    readonly to: string;
    readonly back?: number;
  }[];
  /** Where it stood at the end of its run. */
  readonly end: { readonly year: number; readonly id: string; readonly name: string };
};

/** How a reading ("Can it?") came out against the runs, age by age. */
export type Agreement = {
  /** Worlds whose reading allowed it, those that were not slowed by what they lack, and those of each that reached it. */
  readonly allowed: number;
  readonly reached: number;
  readonly clear: number;
  readonly clearReached: number;
  /** Worlds read as shut that reached it all the same (it ought to be none). */
  readonly shutReached: number;
  /** Worlds read as shut. */
  readonly shut: number;
};

type CatalogueFile = {
  readonly rulesets: Readonly<Record<string, string>>;
  readonly lastYear: number;
  readonly seeds: readonly CatalogueSeed[];
  /** Each universe's own, by age: what a reading is worth differs by what its worlds are. */
  readonly agreementOf: Readonly<Record<string, Readonly<Record<string, Agreement>>>>;
};

/** A universe's part of the catalogue, under the rules this build's worlds run by. */
export type UniverseCatalogue = {
  /** "ok"; "none": this deploy carries none; "other rules": run on an earlier version, so close, not exact. */
  readonly status: "ok" | "none" | "other rules";
  readonly seeds: readonly CatalogueSeed[];
  readonly lastYear: number;
  readonly agreement: Readonly<Record<string, Agreement>>;
};

let file: Promise<CatalogueFile | null> | null = null;

/** The file itself, fetched once (not one of an earlier deploy held in a cache). */
function catalogueFile(): Promise<CatalogueFile | null> {
  return (file ??= fetch("catalogue.json", { cache: "no-cache" })
    .then(async (reply) => (reply.ok ? ((await reply.json()) as CatalogueFile) : null))
    // (A page's fallback in its place will not read as one.)
    .catch(() => null));
}

/** The worlds run in full of a universe, and whether they were run under the rules it now runs by. */
export async function catalogueFor(
  client: Pick<HostClient, "rulesetOf">,
  universe: string,
): Promise<UniverseCatalogue> {
  const none = { seeds: [], lastYear: 0, agreement: {} },
    got = await catalogueFile();
  if (!got?.seeds) return { status: "none", ...none };
  const earlier =
    got.rulesets[universe] !== (await client.rulesetOf(universe)) || (await catalogueMoved());
  return {
    status: earlier ? "other rules" : "ok",
    seeds: got.seeds.filter((s) => s.universe === universe),
    lastYear: got.lastYear,
    agreement: got.agreementOf[universe] ?? {},
  };
}

/** "under a minute", "about 14 minutes", "about 2 hours": how long a run takes, in words. */
export function runWords(minutes: number): string {
  if (minutes >= 90) return `about ${Math.round(minutes / 6) / 10} hours`;
  if (minutes >= 1.5) return `about ${Math.round(minutes)} minutes`;
  return minutes >= 0.75 ? "about a minute" : "under a minute";
}
