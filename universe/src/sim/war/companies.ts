// Hired companies on the field (2026-11-19). A realm at war pays the companies that follow pay (sim/order/groups: the aim
// "hire"; their men add to its host, sim/war/war.ts strengthOf). Here they are someone in the battle: the greatest company a
// side pays stands under its own banner, named in the battle's telling and its page. What a company does goes by its pay and
// its prospects, no draw: paid, it fights; unpaid (its payer's treasury has nothing by it), it still fights a day it expects to
// win, and then takes its pay from the land's stores (the sack is the existing one: grain really carried off); it leaves the
// field before a day it expects to lose; and goes over to the foe where the foe has silver by it and the day is not its
// payer's to win. A company gone over or gone home takes its strength with it for that battle; whom it follows next year is
// the groups' own reckoning of who pays. Level: a named group (with its leader) in a battle of realms.
import { defineEventType, type Ref, type World } from "../../kernel/index.ts";
import { cellRef } from "../../gen/index.ts";
import { ORG_KINDS } from "../../rules/index.ts";
import type { PopulationContext } from "../population/systems.ts";
import { realmName, type Polity } from "../polity/polity.ts";
import { orgsOf, type Org } from "../order/groups-kept.ts";
import { FISC, TREASURY_STORE, moneyStore } from "../money/kept.ts";

export const COMPANY_EVENTS = {
  /** A hired company left the field unpaid, went over to the foe, or took its pay from a land's stores. */
  company: defineEventType("war.company", 4),
};

export const COMPANY = {
  /** Unpaid, it leaves before a day it gives its side less than this chance in (its side's strength against the foe's). */
  leaves: 0.7,
  /** Unpaid, with a foe that can pay, it goes over unless its side has the better of the day by this. */
  turns: 1,
} as const;

/** The company a side brings: who, how many, the share of its side's strength that is theirs, whether they are paid. */
export type CompanyAt = {
  readonly org: Org;
  readonly men: number;
  readonly share: number;
  readonly unpaid: boolean;
};

/** What a realm's treasury keeps by it (null: it keeps no treasury: its hired are paid in kind). */
function reserveOf(world: World, realm: Ref): number | null {
  const row = moneyStore(world, TREASURY_STORE)?.get(realm);
  return row ? (row[FISC.reserve] ?? 0) : null;
}

/** The greatest company a realm pays, with the share of its strength its hired are (`paid` of `all`). Null: it pays none. */
export function companyOf(world: World, p: Polity, paid: number, all: number): CompanyAt | null {
  if (!(paid > 0)) return null;
  const hired = orgsOf(world)?.hiredList(p.ref);
  if (!hired?.length) return null;
  let org = hired[0]!,
    men = 0;
  for (const g of hired) {
    men += g.members;
    if (g.members > org.members || (g.members === org.members && g.id < org.id)) org = g;
  }
  const reserve = reserveOf(world, p.ref);
  return { org, men, share: paid / Math.max(1e-9, all), unpaid: reserve !== null && reserve <= 0 };
}

/** What a company did on a day, for the battle's telling. */
export type CompanyDay = {
  readonly side: 0 | 1;
  readonly how: "fought" | "left" | "turned";
  readonly co: CompanyAt;
};

/**
 * The day's strengths with each side's company as it chose: what each side fights at, each side's company (null: none), and
 * what each did. `power`: each side's strength with its hired counted in.
 */
export function companiesField(
  world: World,
  sides: readonly [Polity, Polity],
  cos: readonly [CompanyAt | null, CompanyAt | null],
  power: readonly [number, number],
): { power: [number, number]; days: CompanyDay[] } {
  const out: [number, number] = [power[0], power[1]],
    days: CompanyDay[] = [];
  for (const s of [0, 1] as const) {
    const co = cos[s];
    if (!co) continue;
    const part = power[s] * co.share,
      prospects = power[s] / Math.max(1e-9, power[1 - s]!),
      foePays = (reserveOf(world, sides[1 - s]!.ref) ?? 0) > 0;
    let how: CompanyDay["how"] = "fought";
    if (co.unpaid && foePays && prospects < COMPANY.turns) how = "turned";
    else if (co.unpaid && prospects < COMPANY.leaves) how = "left";
    if (how !== "fought") out[s] = out[s]! - part;
    if (how === "turned") out[1 - s] = out[1 - s]! + part;
    days.push({ side: s, how, co });
  }
  return { power: out, days };
}

const kindOf = (g: Org) => ORG_KINDS[g.kind] ?? "free company";

/** The companies on a day's field, for its battle's own data: each side's name (null: none). Undefined: neither brought one. */
export function companiesTold(
  days: readonly CompanyDay[],
): { co: [string | null, string | null]; coMen: [number, number] } | undefined {
  if (!days.length) return undefined;
  const co: [string | null, string | null] = [null, null],
    coMen: [number, number] = [0, 0];
  for (const d of days) {
    co[d.side] = `the ${d.co.org.name} ${kindOf(d.co.org)}`;
    coMen[d.side] = d.co.men;
  }
  return { co, coMen };
}

/**
 * After the battle: a company that left or went over is told, with why; an unpaid one that fought and won on the foe's land
 * takes its pay from it (`sack`: the war's own carrying off, which tells what was taken). Returns nothing.
 */
export function companiesAfter(
  ctx: PopulationContext,
  war: Ref,
  sides: readonly [Polity, Polity],
  days: readonly CompanyDay[],
  won: boolean,
  land: number,
  battle: Ref,
  sack: () => number,
): void {
  for (const d of days) {
    const sacked = d.how === "fought" && d.co.unpaid && d.side === 0 && won ? sack() : 0;
    if (d.how === "fought" && sacked <= 0) continue;
    const payer = sides[d.side]!,
      foe = sides[1 - d.side]!;
    ctx.world.events.emit({
      type: COMPANY_EVENTS.company.type,
      importance: d.how === "turned" ? 4 : 3,
      subjects: [war, payer.ref, foe.ref],
      place: cellRef(0, land),
      causes: [
        { ref: battle, role: "trigger", weight: 1 },
        { ref: d.co.org.event, role: "agent", weight: 1 },
      ],
      data: {
        a: realmName(payer),
        b: realmName(foe),
        group: d.co.org.name,
        kind: kindOf(d.co.org),
        leader: d.co.org.leader.name,
        gid: d.co.org.id,
        men: d.co.men,
        how: d.how === "fought" ? "sacked" : d.how,
        ...(sacked > 0 ? { grain: sacked } : {}),
      },
    });
  }
}
