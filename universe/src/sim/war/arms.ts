// Arms as they are made (Phase 52 M217): a realm's host is armed as its design says, and the design
// counts in battle by what its parts are made of and by how much of the host bears them. Each part's
// stuff is its seat's — the keenest stone its own rocks give (gen/bedrock.ts), bog iron where the
// seat's iron is its own bog ore, else the metal — and its quality is that stuff's against the
// material's usual, worked by the seat's craft and by seasoned makers. Every year, after the crafts
// and before the trade, the host draws from its lands' markets the metal its kit wears out (and some
// of what it lacks); what it cannot get leaves it the less armed. Its power is the bare host's, and
// as much of the full kit's as it is armed with. A design changed is not borne at once: the host
// keeps the strength its old arms gave it until the new are made. No random draws: watching changes
// nothing.
import { Hasher, type Ref, type StateStore, type World } from "../../kernel/index.ts";
import { groundStone } from "../../gen/index.ts";
import {
  G,
  GOOD_MATTER,
  GOODS,
  MATERIAL,
  METALS,
  ROLE_KG,
  STONES,
  hostPower,
  performanceOf,
  qualityOf,
  type Edge,
  type MaterialProps,
  type Metal,
  type Part,
} from "../../rules/index.ts";
import { designsOf, hostFor } from "../design/design.ts";
import type { MarketStore } from "../economy/market.ts";
import { metalSource } from "../economy/metals.ts";
import { loreOf } from "../lore/lore.ts";
import type { Polity } from "../polity/polity.ts";
import type { PopulationContext } from "../population/systems.ts";

/** The share of a host's kit worn out, broken, lost or rusted in a year. */
export const ARMS_WEAR = 0.1;
/** At most this share of a full kit is made good in a year, besides. */
export const REARM = 0.25;
/**
 * At most this share of what a market holds after its year's crafts is drawn for the host in a
 * year: the rest is left for the smiths' tools (a host re-armed with heavier kit takes years).
 */
export const ARMS_TAKE = 0.5;
/** A part's quality against its material's usual, at least and at most. */
export const QUALITY_BOUNDS = [0.8, 1.15] as const;
/** The years at the work of the makers of a realm's arms. */
export const SEASONED = 15;
/** The craft (0 … 1) a material's usual stuff is worked with. */
const USUAL_CRAFT = 0.5;

/** What a kit's parts are worked from: a metal, or steel machined at a works (Phase 53 M219). */
type Kit = Metal | "machined";
/** The machines worn out at the works for each kg of a part machined there (Phase 53 M219). */
const MACHINE_WEAR = 0.05;
/** An armoured car's weight a man of the host (kg): some thirty tonnes for every hundred and fifty. */
export const VEHICLE_KG = 200;

/**
 * The goods a kg of a part of each is made of (bronze: a tenth of tin; machined: steel, and the
 * machines it wears out at the works — a host cut off from works and their machines is not re-armed).
 */
const KIT_GOODS: Readonly<Record<Kit, readonly (readonly [number, number])[]>> = {
  copper: [[G.copper, 1]],
  bronze: [
    [G.copper, 0.9],
    [G.tin, 0.1],
  ],
  iron: [[G.iron, 1]],
  steel: [[G.iron, 1]],
  machined: [
    [G.iron, 1],
    [G.machines, MACHINE_WEAR],
  ],
};

const isKit = (m: string): m is Kit => m in KIT_GOODS,
  isMetal = (m: string): m is Metal => isKit(m) && m !== "machined";

/** A host part's stuff as it was found and worked: its name, its edge. Null: no worked stuff. */
export function partStuff(
  ctx: PopulationContext,
  seat: number,
  part: Part,
): { readonly stuff: string; readonly edge: Edge; readonly usual: Edge } | null {
  if (part.material === "stone") {
    const { stone } = groundStone(ctx.generated, seat);
    return { stuff: stone.name, edge: stone, usual: STONES.limestone! };
  }
  if (!isMetal(part.material)) return null;
  // Bog iron, where the seat's own iron is bog ore: softer, uneven.
  const source = part.material === "iron" ? metalSource(ctx, seat, G.iron) : null,
    bog = source?.how === "ore" && source.ore.lie === "bog";
  return {
    stuff: bog ? "bog iron" : part.material,
    edge: METALS[bog ? "bog iron" : part.material],
    usual: METALS[part.material],
  };
}

/** A part's quality against its material's usual (1: as usual), within QUALITY_BOUNDS. */
export function partQuality(ctx: PopulationContext, seat: number, part: Part): number {
  const s = partStuff(ctx, seat, part);
  if (!s) return 1;
  const craft = Math.min(1, loreOf(ctx.world).effect(seat, "tools")),
    q = qualityOf(s.edge, craft, SEASONED) / qualityOf(s.usual, USUAL_CRAFT, SEASONED);
  return Math.min(QUALITY_BOUNDS[1], Math.max(QUALITY_BOUNDS[0], q));
}

/** A part's material as its seat found and worked it: its edge and guard by its quality. */
function partProps(ctx: PopulationContext, seat: number, part: Part): MaterialProps | undefined {
  const q = partQuality(ctx, seat, part);
  if (q === 1) return undefined;
  const m = MATERIAL[part.material];
  return { ...m, edge: m.edge * q, guard: m.guard * q };
}

/**
 * A host bare of its worked kit: stone-tipped spears for its metal or machined arms, hide shields for
 * its metal guard, and on foot where its armoured cars are not made (Phase 53 M219).
 */
function bareOf(parts: readonly Part[]): Part[] {
  return parts.map((p) =>
    isKit(p.material)
      ? p.role === "arm"
        ? { ...p, id: "spear", material: "stone" }
        : p.role === "guard"
          ? { ...p, id: "shield", material: "hide" }
          : p.role === "mount"
            ? { ...p, id: "foot", material: "hide" }
            : p
      : p,
  );
}

/** What a host's full kit weighs in each good it is worked from, a man (kg). */
export function kitKg(parts: readonly Part[]): Map<number, number> {
  const out = new Map<number, number>();
  for (const p of parts) {
    if (!isKit(p.material)) continue;
    const kg = p.role === "mount" ? VEHICLE_KG : (ROLE_KG[p.role] ?? 0);
    for (const [good, share] of KIT_GOODS[p.material])
      out.set(good, (out.get(good) ?? 0) + kg * share);
  }
  return out;
}

/** How a realm's host fights now: its design and parts, bare and fully armed, how armed it is, its power. */
export type Arms = {
  /** Its design (null: none realized yet — armed as its seat can arm it). */
  readonly design: Ref | null;
  readonly parts: readonly Part[];
  readonly bare: number;
  readonly full: number;
  readonly armed: number;
  readonly power: number;
  /**
   * What its arms loose against the rifle's (rules/firearms.ts), and how far its armour carries it
   * through a line dug in, as much of the host as is armed (Phase 53 M219: 0 before the magazine).
   */
  readonly fire: number;
  readonly breach: number;
};

/** The power of a host of parts at a seat, bare and fully armed (each part as its seat makes it). */
function powers(
  ctx: PopulationContext,
  seat: number,
  parts: readonly Part[],
): { bare: number; full: number } {
  const bare = hostPower(bareOf(parts)),
    full = hostPower(parts, (p) => partProps(ctx, seat, p));
  return { bare, full: Math.max(bare, full) };
}

/** How armed a host is with its design now: as kept, or carried over from the design it had. */
function armedNow(ctx: PopulationContext, p: Polity, parts: readonly Part[], design: Ref | null) {
  const kept = armsOf_(ctx.world)?.get(p.ref);
  if (!kept) return 1;
  if (kept.design === design) return kept.armed;
  // A new design: the strength its old arms gave, until the new are made.
  const old = kept.design ? designsOf(ctx.world).get(kept.design)?.parts : undefined;
  if (!old) return kept.armed;
  const was = powers(ctx, p.seat, old),
    is = powers(ctx, p.seat, parts),
    power = was.bare + kept.armed * (was.full - was.bare);
  return is.full > is.bare ? Math.min(1, Math.max(0, (power - is.bare) / (is.full - is.bare))) : 1;
}

/** How a realm's host fights now (read alike by battles, pages and the strength lens). */
export function armsOf(ctx: PopulationContext, p: Polity): Arms {
  const d = designsOf(ctx.world).of(p.ref),
    parts = d?.parts ?? hostFor(ctx, p).parts,
    { bare, full } = powers(ctx, p.seat, parts),
    armed = armedNow(ctx, p, parts, d?.ref ?? null),
    does = performanceOf(parts);
  return {
    design: d?.ref ?? null,
    parts,
    bare,
    full,
    armed,
    power: bare + armed * (full - bare),
    fire: armed * (does.firepower ?? 0),
    breach: armed * (does.breach ?? 0),
  };
}

/** How armed each realm's host is, with which design (Phase 52 M217). */
export class ArmsStore implements StateStore {
  readonly name = "war.arms";
  private readonly kept = new Map<string, { armed: number; design: Ref | null }>();

  get(realm: Ref): { readonly armed: number; readonly design: Ref | null } | undefined {
    return this.kept.get(realm);
  }

  set(realm: Ref, armed: number, design: Ref | null): void {
    this.kept.set(realm, { armed, design });
  }

  forget(realm: Ref): void {
    this.kept.delete(realm);
  }

  realms(): string[] {
    return this.sorted().map(([realm]) => realm);
  }

  private sorted(): [string, { armed: number; design: Ref | null }][] {
    return [...this.kept.entries()].sort((a, b) => (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0));
  }

  hashInto(h: Hasher): void {
    const all = this.sorted();
    h.int(all.length);
    for (const [realm, k] of all)
      h.string(realm)
        .float(k.armed)
        .string(k.design ?? "");
  }

  save(): unknown {
    return { arms: this.sorted().map(([realm, k]) => [realm, k.armed, k.design]) };
  }

  load(state: unknown): void {
    this.kept.clear();
    for (const [realm, armed, design] of (state as { arms: [string, number, Ref | null][] }).arms)
      this.kept.set(realm, { armed, design });
  }
}

function armsOf_(world: World): ArmsStore | null {
  return world.storeNames().includes("war.arms") ? world.store<ArmsStore>("war.arms") : null;
}

/**
 * The hosts re-armed, yearly (called by the economy's year after its crafts, before its trade): each
 * living realm's host draws from its lands' markets, in proportion to what each holds (never more
 * than ARMS_TAKE of it), the metal its kit wore out and as much of what it lacks as can be made good
 * in a year; what it asked is wanted there (its price feels it), and what it got arms it.
 */
export function rearmYear(
  ctx: PopulationContext,
  realms: readonly Polity[],
  wanted: ReadonlyMap<number, number[]>,
  fielded: (p: Polity) => number,
): void {
  const store = armsOf_(ctx.world),
    markets = ctx.world.store<MarketStore>("economy.markets"),
    designs = designsOf(ctx.world);
  if (!store) return;
  // (The ended are let go.)
  const living = new Set(realms.map((p) => p.ref));
  for (const realm of store.realms()) if (!living.has(realm as Ref)) store.forget(realm as Ref);
  for (const p of realms) {
    const d = designs.of(p.ref);
    if (!d) continue;
    const parts = d.parts,
      kit = kitKg(parts),
      armed = armedNow(ctx, p, parts, d.ref);
    if (!kit.size) {
      store.set(p.ref, 1, d.ref);
      continue;
    }
    const men = fielded(p),
      worn = armed * (1 - ARMS_WEAR),
      ask = Math.min(1 - worn, ARMS_WEAR + REARM);
    let got = 1;
    if (ask > 0 && men > 0)
      for (const [good, kg] of kit) {
        const need = Math.round((ask * men * kg) / (GOOD_MATTER[GOODS[good]!.id]?.unitKg ?? 5));
        if (need <= 0) continue;
        const lands = [...p.members].sort((a, b) => a - b),
          held = lands.reduce((s, c) => s + (markets.get(c)?.stock[good] ?? 0), 0);
        let drawn = 0;
        for (const c of lands) {
          const m = markets.get(c);
          if (!m) continue;
          const share = held > 0 ? m.stock[good]! / held : c === p.seat ? 1 : 0,
            asked = Math.round(need * share);
          if (asked <= 0) continue;
          drawn += m.take("used", good, Math.min(asked, Math.floor(m.stock[good]! * ARMS_TAKE)));
          const want = wanted.get(c);
          if (want) want[good] = want[good]! + asked;
        }
        got = Math.min(got, drawn / need);
      }
    store.set(p.ref, Math.min(1, worn + ask * got), d.ref);
  }
}
