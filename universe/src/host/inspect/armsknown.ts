// Known, and carried (2026-11-19: "it put rifles and guns just way later"): a land knowing an arm, its realm's host carrying
// it, and a host having carried it once are three things, and a page that tells only the first reads as if they were one. So,
// for each arm of shot a land knows (the gun and its later kinds, the sea's darts and lances, arms of light): since when, and
// whether its realm's host carries it now, has carried it, or never has, and what it carries in its place. And on an arm's own
// page, of the realms whose seats know it, how many carry it. What an arm is, who holds it and what it does: never how it is made.
// Only reads.
import type { World } from "../../kernel/index.ts";
import { BEAMS, FIREARMS, partWords, realization, type Part } from "../../rules/index.ts";
import { designsOf, knows, loreOf, politiesOf, populationContext } from "../../sim/index.ts";
import { principleName } from "../../causal/index.ts";
import type { Block, Line, Stat } from "../../bridge/index.ts";
import { count, stat } from "./words.ts";
import { landLink, realmLink } from "./names.ts";

/** The arms of shot, least to greatest of each line: each a host's part, known by one principle. */
const SHOT: readonly string[] = [
  ...FIREARMS.map((f) => f.id),
  "gas-dart",
  "sound-lance",
  ...BEAMS.map((b) => b.id),
];
/** The principle that makes an arm known. */
const knownBy = (arm: string): string => realization(arm).needs[0]!;
/** The arms a principle makes known (none: it is not an arm's). */
const armsOf = (principle: string): string[] => SHOT.filter((a) => knownBy(a) === principle);

const armOf = (parts: readonly Part[] | undefined): Part | undefined =>
  parts?.find((x) => x.role === "arm");

/** The realms that have ever armed a host with each arm (by the designs kept: old ones stay). */
function everCarried(world: World, arms: readonly string[]): Set<string> {
  const out = new Set<string>();
  for (const d of designsOf(world).list())
    if (d.kind === "host" && d.parts.some((x) => arms.includes(x.id))) out.add(d.owner);
  return out;
}

/**
 * The arms of shot a land knows, and whether its realm's host carries each: a table for its Learned tab (none where it
 * knows no such arm).
 */
export function armsKnownBlocks(world: World, cell: number): Block[] {
  const ctx = populationContext(world),
    lore = loreOf(world),
    principles = [...new Set(SHOT.map(knownBy))].filter((id) => lore.get(cell, id));
  if (!principles.length) return [];
  const realm = politiesOf(world).of(cell),
    design = realm ? designsOf(world).of(realm.ref) : undefined,
    now = armOf(design?.parts),
    rows = principles.map((id) => {
      const arms = armsOf(id),
        since = lore.get(cell, id)!.year;
      let host: Line;
      if (!realm) host = ["no realm holds this land, and no host is armed from it"];
      else if (now && arms.includes(now.id))
        host = ["carried by the host of ", realmLink(world, realm.ref)];
      else if (!knows(ctx, realm.seat, id))
        host = [
          "not carried: the host of ",
          realmLink(world, realm.ref),
          " is armed by what its seat knows, and ",
          landLink(world, realm.seat, true),
          " does not know it",
        ];
      else {
        const once = everCarried(world, arms).has(realm.ref),
          // (A later arm of the same line in its place: set aside, not wanting.)
          later = now && SHOT.indexOf(now.id) > Math.max(...arms.map((a) => SHOT.indexOf(a)));
        host = [
          once
            ? later
              ? "carried once, since set aside: the host of "
              : "carried once, not now: the host of "
            : later
              ? "known, never carried, a later arm taken in its place: the host of "
              : "known, never carried: the host of ",
          realmLink(world, realm.ref),
          now ? ` carries ${partWords(now)}` : " has not been armed yet",
        ];
      }
      return {
        ref: `prin:${id}`,
        cells: [[principleName(id, world)], [String(since)], host],
        keys: [principleName(id, world), since, 0],
      };
    });
  return [
    {
      type: "table",
      title: "Arms they know, and whether a host carries them",
      columns: ["Known", "Since", "Its realm's host"],
      rows,
    },
    {
      type: "text",
      lines: [
        [
          "Knowing an arm is not carrying it. A host is armed every few years with what its realm's seat knows and can get made, of the metal and the works within its reach, and with what its realm thinks best for the field at what it can pay.",
        ],
      ],
    },
  ];
}

/** On an arm's own page: of the realms whose seats know it, how many carry it now, and how many ever have. */
export function carriedStats(world: World, principle: string): Stat[] {
  const arms = armsOf(principle);
  if (!arms.length) return [];
  const ctx = populationContext(world),
    designs = designsOf(world),
    ever = everCarried(world, arms);
  let know = 0,
    carry = 0;
  for (const r of politiesOf(world).living()) {
    if (!knows(ctx, r.seat, principle)) continue;
    know++;
    const a = armOf(designs.of(r.ref)?.parts);
    if (a && arms.includes(a.id)) carry++;
  }
  if (!know && !ever.size) return [];
  return [
    stat(
      "Carried by",
      `${count(carry)} of the ${count(know)} realms whose seats know it now; ${count(ever.size)} realms have armed a host with it at some time. Knowing it is not carrying it: a host is armed with what its seat can get made and what its realm thinks best for the field.`,
    ),
  ];
}
