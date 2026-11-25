// What a realm's schools teach (rules/curriculum.ts), read off the bodies that teach in it and who pays each, when its bodies
// are reckoned (sim/order/institutions.ts, once in twelve years a realm). One row a realm with a body that teaches; read where
// its crafters work (sim/trade/kept.ts craftsKept), where a land weighs leaving its faith (sim/belief/belief.ts) and where its
// host's drill is reckoned (sim/war/war.ts trainedOf).
import {
  defineEventType,
  type Factor,
  type Ref,
  type SimTime,
  type World,
} from "../../kernel/index.ts";
import {
  CONTENTS,
  CONTENT_WORDS,
  CURRICULUM,
  DOES,
  FUND,
  HOLD,
  INST_FUNDS,
  OCC,
  curriculumOf,
  schoolingReach,
  type Content,
} from "../../rules/index.ts";
import type { PopulationContext } from "../population/systems.ts";
import { heldScripture } from "../belief/belief.ts";
import { CURRICULUM_ROW, CURRICULUM_STORE, cultureRows } from "../culture/rows.ts";
import { realmName, type Polity } from "../polity/polity.ts";
import { holdsOf } from "./holds.ts";
import type { Body } from "./institutions-kept.ts";
import { capacityOf } from "./order.ts";

export const CURRICULUM_EVENTS = {
  /** What a realm's schools teach first changed (or was first set). */
  turned: defineEventType("order.curriculum", 3),
};

const FUND_WORDS: Readonly<Record<string, string>> = {
  tithes: "its faith's tithes",
  treasury: "its seat's treasury",
  patron: "its great houses' gifts",
  customers: "those who pay for their own young",
  dues: "its trades' dues",
  plunder: "what was taken",
};

/** A realm's row (thousandths): the share of each content by CONTENTS, its schooling's reach, and what it teaches first (+1). */
function rowOf(world: World, realm: Ref): readonly number[] | undefined {
  return cultureRows(world, CURRICULUM_STORE)?.get(realm);
}

/** How far a realm's schooling teaches a content to its young (0 … 1): the content's share times its reach. 0 where none. */
export function taughtOf(world: World, realm: Ref, content: Content): number {
  const row = rowOf(world, realm);
  if (!row) return 0;
  return (row[CONTENTS.indexOf(content)]! / 1000) * (row[CURRICULUM_ROW.reach]! / 1000);
}

/** How much more a realm's crafters make for the craft its schools teach (1 where none). */
export function craftTaught(world: World, realm: Ref): number {
  const rows = cultureRows(world, CURRICULUM_STORE);
  if (!rows) return 1;
  const row = rows.get(realm);
  return row
    ? 1 +
        CURRICULUM.skill * (row[CURRICULUM_ROW.craft]! / 1000) * (row[CURRICULUM_ROW.reach]! / 1000)
    : 1;
}

/** What a realm's schools teach, for its page: each content's share, how far its schooling reaches its young, and the first (null where none teach). */
export function schoolingOf(
  world: World,
  realm: Ref,
): { shares: Record<Content, number>; reach: number; lead: Content } | null {
  const row = rowOf(world, realm),
    lead = row ? CONTENTS[row[CURRICULUM_ROW.lead]! - 1] : undefined;
  if (!row || !lead) return null;
  return {
    shares: Object.fromEntries(CONTENTS.map((k, i) => [k, row[i]! / 1000])) as Record<
      Content,
      number
    >,
    reach: row[CURRICULUM_ROW.reach]! / 1000,
    lead,
  };
}

/** A realm ended: its row goes. */
export function curriculumForget(world: World, realm: Ref): void {
  cultureRows(world, CURRICULUM_STORE)?.drop(realm);
}

/** A realm's bodies were reckoned: what its schools teach is read off those that teach and who pays them. */
export function curriculumStep(ctx: PopulationContext, p: Polity, bodies: readonly Body[]): void {
  const { world } = ctx,
    rows = cultureRows(world, CURRICULUM_STORE);
  if (!rows) return;
  const paid = new Array<number>(INST_FUNDS.length).fill(0);
  let teachers = 0,
    greatest: Body | null = null;
  for (const g of bodies) {
    if (g.does !== DOES.teach) continue;
    paid[g.fund] = paid[g.fund]! + Math.max(0, g.income);
    teachers += g.staff;
    if (!greatest || g.income > greatest.income) greatest = g;
  }
  const was = rows.get(p.ref);
  if (!greatest) {
    if (was) rows.drop(p.ref);
    return;
  }
  let people = 0,
    traders = 0,
    crafters = 0;
  for (const c of p.members) {
    const prov = ctx.provinces.get(c);
    if (!prov) continue;
    people += prov.total();
    traders += prov.occupation(OCC.trader);
    crafters += prov.occupation(OCC.crafter);
  }
  const { shares, lead } = curriculumOf({
      tithes: paid[FUND.tithes]!,
      treasury: paid[FUND.treasury]!,
      patron: paid[FUND.patron]!,
      customers: paid[FUND.customers]!,
      dues: paid[FUND.dues]!,
      scripture: heldScripture(world, p.seat),
      capacity: capacityOf(ctx, p).value,
      force: holdsOf(world, p.ref)[HOLD.force]!,
      traders,
      crafters,
    }),
    reach = schoolingReach(teachers, people);
  if (!lead) {
    if (was) rows.drop(p.ref);
    return;
  }
  const next: number[] = [];
  CONTENTS.forEach((k, i) => (next[i] = shares[k] * 1000));
  next[CURRICULUM_ROW.reach] = reach * 1000;
  next[CURRICULUM_ROW.lead] = CONTENTS.indexOf(lead) + 1;
  rows.set(p.ref, next);
  if (was && was[CURRICULUM_ROW.lead] === next[CURRICULUM_ROW.lead]) return;
  // (What it teaches first is new, or has turned: told, with who pays.)
  const all = paid.reduce((s, x) => s + x, 0),
    funds = INST_FUNDS.map((f, i) => ({ f, share: all > 0 ? paid[i]! / all : 0 }))
      .filter((x) => x.share > 0)
      .sort((a, b) => b.share - a.share || (a.f < b.f ? -1 : 1)),
    second = [...CONTENTS].filter((k) => k !== lead).sort((a, b) => shares[b] - shares[a])[0]!,
    factors: Factor[] = funds.slice(0, 4).map((x, i) => ({
      name: `${FUND_WORDS[x.f] ?? x.f} keep its schools`,
      value: Math.round(x.share * 100) / 100,
      contribution: x.share,
      source: i === 0 ? { ref: greatest!.event, role: "enabler", weight: 1 } : null,
    })),
    decision = world.decisions.record({
      rule: "order.curriculum",
      subject: p.ref,
      outcome: { teaches: lead, share: Math.round(shares[lead] * 100) },
      score: shares[lead],
      threshold: shares[second],
      factors,
    });
  world.events.emit({
    type: CURRICULUM_EVENTS.turned.type,
    subjects: [p.ref],
    place: ctx.provinces.get(greatest.home)?.ref ?? ctx.provinces.get(p.seat)?.ref ?? null,
    causes: [
      { ref: decision, role: "trigger", weight: 1 },
      { ref: greatest.event, role: "enabler", weight: 0.5 },
    ],
    data: {
      realm: realmName(p),
      teaches: CONTENT_WORDS[lead],
      share: Math.round(shares[lead] * 100),
      payer: FUND_WORDS[funds[0]!.f] ?? funds[0]!.f,
      paid: Math.round(funds[0]!.share * 100),
      reach: Math.round(reach * 100),
      ...(was ? { from: CONTENT_WORDS[CONTENTS[was[CURRICULUM_ROW.lead]! - 1] ?? "letters"] } : {}),
    },
  });
}
