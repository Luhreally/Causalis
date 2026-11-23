// A house of higher learning on its body's page (2026-11-22, the audit's "universities as institutions"; the rule is sim/order/
// institutions.ts higherStep): when it was raised and by whom, who gives for it, its seat town, the learned society it rose
// among, its scholars of name (the notables of learning in its lands), what it adds to how readily its land inquires and what
// its lands have found since; or, shut, by whom and until when. A reading of the body, the notables and the lore: nothing kept.
import type { Ref, World } from "../../kernel/index.ts";
import type { Block, Item, Stat } from "../../bridge/index.ts";
import { DOMAIN, FUND, INST, NOTE } from "../../rules/index.ts";
import {
  beliefOf,
  housesOf,
  higherIn,
  loreOf,
  notablesOf,
  populationContext,
  type Body,
  type Polity,
} from "../../sim/index.ts";
import { item, link, part, share, stat } from "./words.ts";
import { faithLink, landLink, realmLink, townLink } from "./names.ts";
import { notableOf } from "./notables.ts";

/** Who gives for a house of higher learning beyond those taught, as a page's line: the person where one gives, by name. */
function giverOf(world: World, r: Polity | null, g: Readonly<Body>): Stat {
  if (g.fund === FUND.treasury && r)
    return stat("Who gives for it", [
      "its seat: ",
      link(r.ruler.name, `rule:${r.ref}`),
      ", who rules ",
      realmLink(world, r.ref),
    ]);
  if (g.fund === FUND.tithes && g.keeper) {
    const faith = beliefOf(world).get(g.keeper as Ref);
    return stat(
      "Who gives for it",
      faith ? ["the faithful of ", faithLink(world, faith.ref)] : "its faith's tithes",
    );
  }
  if (g.fund === FUND.patron) {
    // (The house that keeps it, and its head by name, where the house is seated where they can be found.)
    const h = r
        ? housesOf(world)
            ?.of(r.ref)
            ?.houses.find((x) => x.name === g.keeper)
        : undefined,
      ref = h && r ? `note:house:${r.ref}:${h.event}` : null,
      head = ref ? notableOf(world, ref) : null;
    return stat(
      "Who gives for it",
      head
        ? [link(head.name, ref), `, who heads the house of ${g.keeper}`]
        : g.keeper
          ? `the house of ${g.keeper}`
          : "a great house",
    );
  }
  const n = g.patron ? /^note:named:(\d+)$/.exec(g.patron) : null,
    one = n ? notablesOf(world)?.get(Number(n[1])) : undefined;
  return stat(
    "Who gives for it",
    one
      ? [link(one.name, g.patron!), ", grown rich in its land, beside the fees of those taught"]
      : "the fees of those taught",
  );
}

/**
 * Its founder: its head when it was raised, known by name from then (sim/notable/notables.ts makes them one of name at its
 * raising): the one of name whose deeds hold its raising, living or gone; else as its raising told them.
 */
function founderLine(
  world: World,
  g: Readonly<Body>,
  data: { leader?: string; head?: string } | null | undefined,
): (string | ReturnType<typeof link>)[] {
  const kept = notablesOf(world),
    n = g.raisedBy
      ? (kept?.in(g.home).find((x) => x.deeds.some((d) => d.e === g.raisedBy)) ??
        kept?.all().find((x) => x.deeds.some((d) => d.e === g.raisedBy)))
      : undefined;
  if (n) return [link(n.name, `note:named:${n.id}`), `, born year ${n.born}`];
  // (Else by name as it keeps them: its head still, with their page; or gone from its head, as its records keep them.)
  const name = g.founder ?? data?.leader ?? g.leader.name,
    born = g.founderBorn,
    heads = name === g.leader.name && (born === undefined || born === g.leader.born);
  return [
    data?.head ? link(name, data.head) : heads ? link(name, `note:head:${g.event}`) : name,
    born !== undefined ? `, born year ${born}` : "",
    heads ? ", at its head still" : "",
  ];
}

/** Its scholars of name: the living notables of learning in its lands, the most known first. */
function scholarsOf(world: World, g: Readonly<Body>): Item[] {
  const kept = notablesOf(world);
  if (!kept) return [];
  const all = g.lands
    .flatMap((c) => [...kept.in(c)])
    .filter((n) => (n.by[DOMAIN.knowledge] ?? 0) >= NOTE.line / 2);
  all.sort((a, b) => (b.by[DOMAIN.knowledge] ?? 0) - (a.by[DOMAIN.knowledge] ?? 0) || a.id - b.id);
  return all
    .slice(0, 8)
    .map((n) =>
      item(
        `${n.name}, born year ${n.born}: known for their learning since year ${n.since}${n.many ? " (a line of them, not one)" : ""}`,
        `note:named:${n.id}`,
      ),
    );
}

/** A house of teaching's higher learning, for its page (blocks; none where it never was raised and is not shut). */
export function higherBlocks(world: World, r: Polity | null, g: Readonly<Body>): Block[] {
  const year = Math.floor(world.now / (365 * 86_400));
  if (!g.higher && g.shut === undefined && g.raised === undefined) return [];
  const rows: Stat[] = [];
  if (g.higher) {
    const raised = g.raisedBy ? world.events.get(g.raisedBy) : undefined,
      data = raised?.data as
        { leader?: string; head?: string; society?: string } | null | undefined;
    rows.push(
      stat("Raised to it", `year ${g.raised ?? g.since}`, g.raisedBy ? { why: g.raisedBy } : {}),
      stat("Its founder", founderLine(world, g, data)),
      giverOf(world, r, g),
    );
    // (Its seat town: the greatest of its home land's towns.)
    const towns = populationContext(world).settlements.inProvince(g.home),
      seat = towns.reduce<(typeof towns)[number] | null>(
        (a, b) => (!a || b.population > a.population ? b : a),
        null,
      );
    rows.push(
      stat(
        "Its seat",
        seat
          ? [townLink(world, seat.ref), ", in ", landLink(world, g.home)]
          : [landLink(world, g.home)],
      ),
    );
    if (g.society)
      rows.push(stat("It rose among", `the ${g.society} learned society, its first fellows`));
    // (What flows back: how much more readily its land inquires, and what its lands have found since.)
    const lore = loreOf(world),
      since = g.raised ?? g.since;
    let found = 0;
    for (const c of g.lands)
      for (const [, k] of lore.of(c))
        if (k.year >= since && world.events.get(k.event)?.type === "lore.found") found++;
    rows.push(
      stat(
        "What it adds",
        `its land inquires ${share(INST.inquiry * higherIn(world, g.home))} the more readily`,
        {
          parts: [part("found in its lands since it was raised", `${found}`)],
        },
      ),
    );
  } else if (g.shut !== undefined)
    rows.push(
      stat(
        "Shut as a house of higher learning",
        g.shutBy === 1
          ? `since year ${g.shut}, by the seat taken by force, until that seat no longer holds it bound: it teaches letters`
          : g.shutBy === 2
            ? [
                `since year ${g.shut}, by `,
                ...(g.shutFor && beliefOf(world).get(g.shutFor)
                  ? [faithLink(world, g.shutFor), " "]
                  : ["a faith "]),
                "after what its land found crossed its creed, until that faith no longer holds against it: it teaches letters",
              ]
            : `since year ${g.shut}: it teaches letters`,
      ),
    );
  else
    rows.push(
      stat(
        "Higher learning",
        "it was, and its land's learning no longer keeps it so: it teaches letters",
      ),
    );
  const scholars = g.higher ? scholarsOf(world, g) : [];
  return [
    { type: "facts", title: "As a house of higher learning", rows },
    ...(scholars.length
      ? [{ type: "list" as const, title: "Its scholars of name", items: scholars }]
      : g.higher
        ? [
            {
              type: "text" as const,
              lines: [["No one of its lands is known by name for their learning yet."]],
            },
          ]
        : []),
  ];
}
