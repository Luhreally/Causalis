// A meeting of fleets, read for watching (2026-11-19): of the event that tells one (sim/war/fleets.ts) — whose fleets, their
// tonnes as they met and what each lost, each one's flagship and who commanded, what each side's shipwrights knew that year,
// and who held the sea after. And the button that plays it, wherever one is told. Pure reads: nothing here is stored, and the
// hulls drawn of it are the eye's.
import { parseRef, type HistoryEvent, type Ref, type World } from "../../kernel/index.ts";
import {
  SEA_FIGHT_TYPE,
  type Block,
  type SeaFightNear,
  type SeaFightSide,
  type SeaRig,
} from "../../bridge/index.ts";
import {
  notablesOf,
  politiesOf,
  realmName,
  rigOf,
  type FleetRig,
  type Polity,
} from "../../sim/index.ts";
import { sideColors } from "../battle.ts";
import { realmColor } from "../colors.ts";
import { kindOf } from "../kinds.ts";
import { landTitle } from "./names.ts";
import { yearAt } from "./words.ts";

type Data = {
  a?: string;
  b?: string;
  tons?: [number, number];
  sunk?: [number, number];
  flags?: [string, string];
  led?: [string | null, string | null];
  ledId?: [number | null, number | null];
  rig?: [FleetRig, FleetRig];
  won?: 0 | 1;
  lost?: 0 | 1;
};

/** Whether an event is a meeting of fleets. */
export const isSeaFight = (e: HistoryEvent | undefined): boolean =>
  !!e && e.type === SEA_FIGHT_TYPE;

/** The button that plays a meeting of fleets from its event. */
export function watchSeaTool(event: string, label = "▶ Watch the fleets meet"): Block {
  return { type: "tool", tool: "watch.sea", args: { event, label } };
}

/** What a people's ships are, by how far they carry and whether its works give their hulls. */
export function seaRig(rig: FleetRig): SeaRig {
  const [steps, works] = rig;
  return works
    ? "works"
    : steps >= 16
      ? "steam"
      : steps >= 8
        ? "tall"
        : steps >= 4
          ? "planked"
          : "oared";
}

const RIG_WORDS: Readonly<Record<SeaRig, string>> = {
  oared: "oared ships under one sail",
  planked: "planked ships under sail",
  tall: "tall ships that keep the sea",
  steam: "ships under steam and sail",
  works: "ships of metal from its works, under steam",
};

/** A side's ships in words, with how they fight. */
export const shipWords = (rig: SeaRig, guns: boolean): string =>
  `${RIG_WORDS[rig]}, ${guns ? "with guns" : "fought hull to hull"}`;

export function seaFightOf(world: World, ref: string): SeaFightNear | null {
  const e = world.events.get(ref as Ref);
  if (!e || !isSeaFight(e)) return null;
  const d = (e.data ?? {}) as Data,
    realms = politiesOf(world),
    refs = [e.subjects[1] as Ref, e.subjects[2] as Ref],
    won = d.won === 1 ? 1 : 0,
    colors = sideColors(realmColor(refs[0]!), realmColor(refs[1]!)),
    kept = notablesOf(world),
    side = (i: 0 | 1): SeaFightSide => {
      const p: Polity | undefined = realms.get(refs[i]!),
        // (As its wrights were that year, where the meeting kept it; an older record: as its seat's are now.)
        rig = d.rig?.[i] ?? (p ? rigOf(world, p) : ([4, 0, 0] as const)),
        kind = seaRig(rig),
        id = d.ledId?.[i] ?? null,
        // (Their page while the world keeps them, living or gone.)
        known = id !== null && !!kept && (!!kept.get(id) || !!kept.goneOf?.(id));
      return {
        ref: refs[i]!,
        name: (i ? d.b : d.a) ?? (p ? realmName(p) : "a fallen realm"),
        color: [colors[i][0], colors[i][1], colors[i][2]],
        tons: d.tons?.[i] ?? 0,
        sunk: d.sunk?.[i] ?? 0,
        flagship: d.flags?.[i] ?? "",
        flagLost: d.lost === i,
        led: d.led?.[i] ?? null,
        ledRef: known ? `note:named:${id}` : null,
        rig: kind,
        guns: rig[2] === 1,
        ships: shipWords(kind, rig[2] === 1),
      };
    },
    cell = e.place ? parseRef(e.place).b : null,
    sides: [SeaFightSide, SeaFightSide] = [side(0), side(1)];
  return {
    event: ref,
    war: e.subjects[0] as string,
    title: `The fleets of ${sides[0].name} and ${sides[1].name} meet`,
    year: yearAt(e.t),
    cell,
    off: cell !== null ? landTitle(world, cell) : null,
    sides,
    won,
    kind: kindOf(world),
  };
}

export const SEA_FIGHT_QUERIES = {
  "fleet.fight": (world: World, args: unknown) =>
    seaFightOf(world, (args as { event: string }).event),
};
