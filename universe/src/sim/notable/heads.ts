// Who heads a body, where the world keeps one of name for it (sim/order/institutions.ts headsWith): a land's standing notable of
// the domain the body's work is, where they hold no post and head no other body of their realm. A pure reading of the two
// stores: nothing is kept here. The id given is their page's ref, so a body's head is found as themselves.
import type { World } from "../../kernel/index.ts";
import { DOMAIN, NOTE, type InstDoes } from "../../rules/index.ts";
import { headsWith } from "../order/institutions.ts";
import { bodiesOf } from "../order/institutions-kept.ts";
import { notablesOf } from "./kept.ts";

/** The domain one must be known in to head a body that does each thing (none: no one of name is asked). */
const FIELD: Partial<Record<InstDoes, number>> = {
  make: DOMAIN.making,
  craft: DOMAIN.making,
  bargain: DOMAIN.rule,
  judge: DOMAIN.law,
  teach: DOMAIN.knowledge,
  heal: DOMAIN.healing,
  worship: DOMAIN.faith,
  insure: DOMAIN.wealth,
};

export const namedHeadId = (id: number): string => `note:named:${id}`;

export function notableHead(
  world: World,
  asked: { readonly realm: string; readonly cell: number; readonly does: InstDoes },
): { id: string; name: string; born: number } | null {
  const d = FIELD[asked.does],
    kept = notablesOf(world);
  if (d === undefined || !kept) return null;
  const heading = new Set<string>();
  for (const g of bodiesOf(world)?.of(asked.realm as never)?.bodies ?? [])
    if (g.headId) heading.add(g.headId);
  let best: { id: number; name: string; born: number; by: number } | null = null;
  for (const n of kept.in(asked.cell)) {
    const by = n.by[d] ?? 0;
    if (n.many || n.post || by < NOTE.line / 2 || heading.has(namedHeadId(n.id))) continue;
    if (!best || by > best.by || (by === best.by && n.id < best.id))
      best = { id: n.id, name: n.name, born: n.born, by };
  }
  return best ? { id: namedHeadId(best.id), name: best.name, born: best.born } : null;
}

headsWith(notableHead, (world, id) => {
  const m = /^note:named:(\d+)$/.exec(id);
  return !!m && !notablesOf(world)?.get(Number(m[1]));
});
