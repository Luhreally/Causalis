// Strife, read (Phase 22 M145, asked for 2026-10-23: "political violence — repression, coups,
// civil war"): a realm's army as one of its interest groups — how many it keeps under arms, its
// sway, what it wants — how near it is to reaching for the seat and why, its rule by a general,
// its coups and restorations, and the god's hand on it, for the realm's page; every coup and
// restoration side by side for the ledger. (M146: its civil wars and revolutions, and how near
// its people are to rising; a civil war's kind and end, for its war's page.)
import type { Ref, World } from "../../kernel/index.ts";
import {
  STRIFE,
  armyOf,
  coupDanger,
  farLands,
  interestsOf,
  orderOf,
  politiesOf,
  populationContext,
  realmName,
  revolutionDanger,
  strifeOf,
  type CivilKind,
  type CivilWar,
  type Polity,
  type War,
} from "../../sim/index.ts";
import type { Block, Item, Stat } from "../../bridge/index.ts";
import { claimOf, count, item, link, part, share, stat, yearNow } from "./words.ts";
import { factorPart } from "./order.ts";
import { landTitle, realmLink } from "./names.ts";

/** What a civil war is fought over, in words. */
export const CIVIL_WORDS: Readonly<Record<CivilKind, string>> = {
  succession: "a war of succession — a claimant raised at a ruler's death fights for the throne",
  general: "a general's revolt — a foiled general raised the far lands against the seat",
  pretender: "a pretender's claim — raised by the god's hand",
  revolution: "a counter-revolution — the old court fights to return",
  freed: "a war to take back the freed — their old masters march on them",
};
/** A civil war's kind in a word or two. */
export const CIVIL_SHORT: Readonly<Record<CivilKind, string>> = {
  succession: "A war of succession",
  general: "A general's revolt",
  pretender: "A pretender's war",
  revolution: "A counter-revolution",
  freed: "A war on the freed",
};

/** How a civil war came out, in words. */
export function civilOutcome(c: CivilWar): string {
  switch (c.outcome) {
    case "throne":
      return c.kind === "freed"
        ? "the freed taken back, and bound again"
        : c.kind === "revolution"
          ? "the old court back on its seat"
          : "the throne taken";
    case "subdued":
      return "the rising put down, its lands returned";
    case "parted":
      return "the realm left parted";
    case "overtaken":
      return "overtaken by another's war";
    case "kept":
      return "the freed kept their freedom";
    default:
      return "still fought";
  }
}

/** A civil war's kind and its end, for its war's page. */
export function civilWarRows(world: World, w: War): Stat[] {
  const c = strifeOf(world)?.civil.find((x) => x.war === w.ref);
  if (!c) return [];
  return [
    { ...stat("A civil war", CIVIL_WORDS[c.kind]), concept: "civil-war" },
    ...(c.ended !== null
      ? [
          {
            ...stat("It came to", civilOutcome(c), { why: c.settled ?? w.peace }),
            concept: "civil-war",
          },
        ]
      : []),
  ];
}

/** How near a realm's people are to rising, in words. */
export function risingWords(score: number): string {
  const over = score - STRIFE.rising;
  return over < -0.3
    ? "its people are quiet"
    : over < -0.1
      ? "its people murmur"
      : over <= 0
        ? "its people are restless"
        : over < 0.2
          ? "a revolution is feared"
          : "a revolution is near";
}

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
  if (living && o && o.movements.some((m) => m.cause !== "abolition")) {
    const danger = revolutionDanger(ctx, r, o),
      ready = !!danger.movement && danger.movement.strength >= STRIFE.movement,
      chance = ready ? Math.max(0, STRIFE.revolts * (danger.score - STRIFE.rising)) : 0;
    if (danger.movement && r.leadership !== 2)
      rows.push({
        ...stat(
          "A revolution",
          `${risingWords(danger.score)}${
            !ready
              ? " — its movement too weak yet to rise"
              : chance > 0
                ? ` — about ${Math.max(1, Math.round(chance * 1000)) / 10} in a hundred a year`
                : ""
          }`,
          {
            why: danger.movement.event,
            parts: [
              part(
                "its weight, against the line",
                `${Math.round(danger.score * 100)} / ${Math.round(STRIFE.rising * 100)}`,
              ),
              ...[...danger.factors]
                .filter((f) => Math.abs(f.contribution) >= 0.005)
                .sort((a, b) => Math.abs(b.contribution) - Math.abs(a.contribution))
                .map(factorPart),
            ],
          },
        ),
        concept: "revolution",
      });
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
  const civil = store.civilOf(r.ref),
    revolutions = store.revolutions.filter((x) => x.realm === r.ref);
  if (civil.length)
    rows.push({
      ...stat("Civil wars", `${civil.length}`, { why: civil.at(-1)!.war }),
      concept: "civil-war",
    });
  if (revolutions.length)
    rows.push({
      ...stat(
        "Revolutions",
        `${revolutions.filter((x) => x.won).length} won, ${revolutions.filter((x) => !x.won).length} drowned in blood`,
        { why: revolutions.at(-1)!.event },
      ),
      concept: "revolution",
    });
  const told = (x: { year: number; event: Ref }): Item => ({
    ...item([claimOf(world, x.event)], x.event, x.year),
    why: x.event,
  });
  const far = living ? farLands(ctx, r) : [];
  return [
    { type: "facts", title: "Its army and its seat", rows },
    ...(living
      ? [
          {
            type: "tool" as const,
            tool: "acts.strife",
            args: {
              cell: r.seat,
              realm: realmName(r),
              junta: !!junta,
              far: far[0] ?? null,
              farName: far[0] !== undefined ? landTitle(world, far[0]) : null,
            },
          },
        ]
      : []),
    {
      type: "list",
      title: "Its civil wars, the newest first",
      items: [...civil].reverse().map((c) => ({
        ...item(
          [
            link(CIVIL_SHORT[c.kind], c.war),
            c.rebel === r.ref ? " against " : " with ",
            realmLink(world, c.rebel === r.ref ? c.loyal : c.rebel),
            ` — year ${c.year}: ${civilOutcome(c)}`,
          ],
          c.war,
          c.year,
        ),
        why: c.settled ?? c.war,
      })),
    },
    {
      type: "list",
      title: "Coups, revolutions and restorations, the newest first",
      items: [...coups, ...restorations, ...revolutions].sort((a, b) => b.year - a.year).map(told),
    },
  ];
}

/** Every coup and restoration side by side, and the realms their armies rule, for the ledger. */
export function strifeLedger(world: World): Block[] {
  const store = strifeOf(world);
  if (
    !store ||
    (!store.coups.length &&
      !store.restorations.length &&
      !store.civil.length &&
      !store.revolutions.length)
  )
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
        { ...stat("Civil wars", `${store.civil.length}`), concept: "civil-war" },
        {
          ...stat(
            "Revolutions",
            `${store.revolutions.filter((x) => x.won).length} won, ${store.revolutions.filter((x) => !x.won).length} drowned in blood`,
          ),
          concept: "revolution",
        },
      ],
    },
    {
      type: "table",
      title: "Every civil war, the newest first",
      columns: ["Year", "Over", "Who rose", "Against", "Came to"],
      rows: [...store.civil].reverse().map((c) => ({
        ref: c.war,
        cells: [
          [`year ${c.year}`],
          [link(CIVIL_SHORT[c.kind], c.war)],
          [realmLink(world, c.rebel)],
          [realmLink(world, c.loyal)],
          [civilOutcome(c)],
        ],
        keys: [c.year, c.kind, c.rebel, c.loyal, c.outcome ?? ""],
      })),
    },
    {
      type: "list",
      title: "Revolutions, the newest first",
      items: [...store.revolutions]
        .reverse()
        .map((x) => ({ ...item([claimOf(world, x.event)], x.event, x.year), why: x.event })),
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
