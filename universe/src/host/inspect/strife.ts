// Strife, read (Phase 22 M145, asked for 2026-10-23: "political violence — repression, coups,
// civil war"): a realm's army as one of its interest groups — how many it keeps under arms, its
// sway, what it wants — how near it is to reaching for the seat and why, its rule by a general,
// its coups and restorations, and the god's hand on it, for the realm's page; every coup and
// restoration side by side for the ledger.
import type { Ref, World } from "../../kernel/index.ts";
import {
  STRIFE,
  armyOf,
  coupDanger,
  interestsOf,
  orderOf,
  politiesOf,
  populationContext,
  realmName,
  strifeOf,
  type Polity,
} from "../../sim/index.ts";
import type { Block, Item, Stat } from "../../bridge/index.ts";
import { claimOf, count, item, part, share, stat, yearNow } from "./words.ts";
import { factorPart } from "./order.ts";
import { realmLink } from "./names.ts";

/** How near an army is to reaching for its seat, in words. */
export function dangerWords(score: number): string {
  const over = score - STRIFE.line;
  return over < -0.3
    ? "its army is content"
    : over < -0.1
      ? "its army grumbles"
      : over <= 0
        ? "its army is restless"
        : over < 0.2
          ? "a coup is feared"
          : "a coup is near";
}

/** A realm's strife, for its page: its army, how near a coup is and why, its rule, its coups. */
export function realmStrifeBlocks(world: World, r: Polity): Block[] {
  const store = strifeOf(world);
  if (!store) return [];
  const ctx = populationContext(world),
    year = yearNow(world),
    living = r.ended === null,
    o = orderOf(world)?.of(r.ref),
    s = store.of(r.ref),
    junta = s?.junta ?? null,
    coups = store.coups.filter((c) => c.realm === r.ref),
    restorations = store.restorations.filter((x) => x.realm === r.ref),
    rows: Stat[] = [];
  if (living) {
    const army = armyOf(ctx, r),
      interests = interestsOf(ctx, r, world.now),
      voice = interests.find((i) => i.group === "the army"),
      danger = o ? coupDanger(ctx, r, o, interests) : null;
    rows.push(
      {
        ...stat(
          "Under arms",
          `${count(army.people)} — ${army.standing ? "a standing army" : army.atWar ? "its levy, at war" : "its guard, in peace"}`,
        ),
        concept: "army-sway",
      },
      {
        ...stat("Its army's sway", share(voice?.sway ?? 0), {
          parts: (voice?.demands ?? []).map((d) => part(d.name, share(d.strength))),
        }),
        concept: "army-sway",
      },
    );
    if (danger) {
      const cowed = (s?.purged ?? 0) > year,
        chance = Math.max(0, STRIFE.chance * (danger.score - STRIFE.line));
      rows.push({
        ...stat(
          "A coup",
          cowed
            ? `its army cowed until year ${s!.purged}, after a coup foiled`
            : `${dangerWords(danger.score)}${chance > 0 ? ` — about ${Math.max(1, Math.round(chance * 1000)) / 10} in a hundred a year` : ""}`,
          {
            why: o?.crisis ?? null,
            parts: [
              part(
                "its weight, against the line",
                `${Math.round(danger.score * 100)} / ${Math.round(STRIFE.line * 100)}`,
              ),
              ...[...danger.factors]
                .filter((f) => Math.abs(f.contribution) >= 0.005)
                .sort((a, b) => Math.abs(b.contribution) - Math.abs(a.contribution))
                .map(factorPart),
            ],
          },
        ),
        concept: "coup",
      });
    }
  }
  rows.push({
    ...stat(
      "Rule",
      junta
        ? `its army's, since year ${junta.since}`
        : restorations.length
          ? `its own, given back in year ${restorations.at(-1)!.year}`
          : "its own",
      { why: junta?.event ?? restorations.at(-1)?.event ?? null },
    ),
    concept: "military-rule",
  });
  if (coups.length)
    rows.push({
      ...stat(
        "Coups",
        `${coups.filter((c) => c.won).length} seized the seat, ${coups.filter((c) => !c.won).length} foiled`,
        { why: coups.at(-1)!.event },
      ),
      concept: "coup",
    });
  const told = (x: { year: number; event: Ref }): Item => ({
    ...item([claimOf(world, x.event)], x.event, x.year),
    why: x.event,
  });
  return [
    { type: "facts", title: "Its army and its seat", rows },
    ...(living
      ? [
          {
            type: "tool" as const,
            tool: "acts.strife",
            args: { cell: r.seat, realm: realmName(r), junta: !!junta },
          },
        ]
      : []),
    {
      type: "list",
      title: "Coups and restorations, the newest first",
      items: [...coups, ...restorations].sort((a, b) => b.year - a.year).map(told),
    },
  ];
}

/** Every coup and restoration side by side, and the realms their armies rule, for the ledger. */
export function strifeLedger(world: World): Block[] {
  const store = strifeOf(world);
  if (!store || (!store.coups.length && !store.restorations.length))
    return [
      {
        type: "text",
        lines: [
          [
            "No army has reached for its seat yet: a coup comes where a rule is doubted and its army is heard.",
          ],
        ],
      },
    ];
  const realms = politiesOf(world),
    won = store.coups.filter((c) => c.won),
    ruled = realms.living().filter((p) => store.junta(p.ref));
  return [
    {
      type: "facts",
      title: "Strife",
      rows: [
        {
          ...stat(
            "Coups",
            `${won.length} seized the seat, ${store.coups.length - won.length} foiled`,
          ),
          concept: "coup",
        },
        {
          ...stat("Ruled by their armies now", `${ruled.length}`),
          concept: "military-rule",
        },
        { ...stat("Rule restored", `${store.restorations.length}`), concept: "military-rule" },
      ],
    },
    {
      type: "list",
      title: "Realms ruled by their armies now",
      items: ruled.map((p) => {
        const j = store.junta(p.ref)!;
        return {
          ...item([realmLink(world, p.ref), `, since year ${j.since}`], p.ref, j.since),
          why: j.event,
        };
      }),
    },
    {
      type: "table",
      title: "Every coup, the newest first",
      columns: ["Year", "Realm", "Who reached for the seat", "Came to"],
      rows: [...store.coups].reverse().map((c) => ({
        ref: c.event,
        cells: [
          [`year ${c.year}`],
          [realmLink(world, c.realm)],
          [c.general],
          [c.won ? "seized it" : "foiled"],
        ],
        keys: [
          c.year,
          realms.get(c.realm) ? realmName(realms.get(c.realm)!) : c.was,
          c.general,
          c.won ? 1 : 0,
        ],
      })),
    },
    {
      type: "list",
      title: "Rule restored, the newest first",
      items: [...store.restorations]
        .reverse()
        .map((x) => ({ ...item([claimOf(world, x.event)], x.event, x.year), why: x.event })),
    },
  ];
}
