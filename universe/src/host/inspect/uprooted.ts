// The held, the fled and the wrongs of a war, on pages (sim/war/held.ts). On a war's page: who holds how many of whom, where,
// what became of them at the peace, and each wrong done with who ordered it and whether it was answered for. On a realm's
// Army tab: those it holds and those of its people held. On a land's People tab: those sheltering there who fled, whence and
// from what, and those of its own who fled elsewhere. Each says what, who and why; never how.
import type { Ref, World } from "../../kernel/index.ts";
import type { Block, Item, Line, Span, Stat } from "../../bridge/index.ts";
import {
  displacedOf,
  fleetCommander,
  fleetsOf,
  notablesOf,
  politiesOf,
  realmName,
  type Camp,
  type Crime,
  type Polity,
  type SeaFight,
  type War,
} from "../../sim/index.ts";
import { FLED } from "../../rules/index.ts";
import { heldPhrase } from "../../causal/index.ts";
import { count, item, link, part, stat } from "./words.ts";
import { landLink, realmLink } from "./names.ts";

const FLED_WHY = ["a war in their land", "the ruin of their land", "hunger"] as const;

const spanText = (s: Span): string => (typeof s === "string" ? s : s.text);

const realmNameOf = (world: World, ref: Ref) => {
  const p = politiesOf(world).get(ref);
  return p ? realmName(p) : "a realm that is no more";
};

/** Who ordered a wrong, as a link where the world still keeps them. */
function doerSpan(world: World, c: Crime): Span {
  const store = notablesOf(world);
  return c.doer && (store?.get(c.doer) || store?.goneOf(c.doer))
    ? link(c.name, `note:named:${c.doer}`)
    : c.name;
}

function crimeItem(world: World, c: Crime): Item {
  const what =
      c.kind === "sword"
        ? `${count(c.dead)} of a stormed town put to the sword`
        : `${count(c.dead)} who had yielded put to death`,
    after =
      c.reckoned?.how === "tried"
        ? `; given up at the peace and put to death for it in year ${c.reckoned.year}`
        : c.reckoned?.how === "dead"
          ? "; named at the peace, dead by then"
          : c.reckoned
            ? "; no one answered for it"
            : "; not yet reckoned";
  const line: Line = [
    `Year ${c.year}, `,
    landLink(world, c.land),
    `: ${what} by the host of `,
    realmLink(world, c.by),
    ", by the order of ",
    doerSpan(world, c),
    after,
  ];
  return { ...item(line, c.event, c.year), why: c.reckoned?.event ?? c.event };
}

/** A war's held and its wrongs. Nothing where it has neither. */
export function warHeldBlocks(world: World, w: War): Block[] {
  const store = displacedOf(world),
    blocks: Block[] = [];
  if (!store) return blocks;
  const rows: Stat[] = [];
  for (const h of store.heldIn(w.ref) ?? [])
    if (h && h.men + h.folk > 0)
      rows.push(
        stat(
          `Held by ${realmNameOf(world, h.by)}`,
          [`${count(h.men + h.folk)} of `, realmLink(world, h.of)],
          {
            why: h.cause,
            parts: [
              part("taken in the field", count(h.men)),
              part("carried off from lands taken", count(h.folk)),
              part("kept at", spanText(landLink(world, h.at, true))),
              part("since", `year ${h.since}`),
            ],
          },
        ),
      );
  if (rows.length) blocks.push({ type: "facts", title: "Those held until the peace", rows });
  // What became of them, where the war is over: its settling is one event, caused by the peace.
  if (w.ended !== null && w.peace) {
    const from = world.events.get(w.peace)?.t ?? 0;
    for (let i = world.events.count - 1; i >= 0; i--) {
      const e = world.events.at(i);
      if (e.t < from) break;
      if (e.type !== "held.settled" || e.subjects[0] !== w.ref) continue;
      const parts = heldPhrase(e.data);
      if (parts.length)
        blocks.push({
          type: "list",
          title: "Those held, at the peace",
          items: parts.map((p) => item([p[0]!.toUpperCase() + p.slice(1)], e.id)),
        });
      break;
    }
  }
  const crimes = store.crimesOf(w.ref);
  if (crimes.length)
    blocks.push({
      type: "list",
      title: "Wrongs done in it",
      items: crimes.map((c) => crimeItem(world, c)),
    });
  return blocks;
}

/** Those a realm holds, those of its people held, and the wrongs its hosts did or suffered. Nothing where none. */
export function realmHeldBlocks(world: World, r: Polity): Block[] {
  const store = displacedOf(world),
    blocks: Block[] = [];
  if (!store) return blocks;
  const rows: Stat[] = [];
  for (const h of store.heldBy(r.ref))
    if (h.men + h.folk > 0)
      rows.push(
        stat("It holds", [`${count(h.men + h.folk)} of `, realmLink(world, h.of)], {
          why: h.cause,
          parts: [part("since", `year ${h.since}`), part("until", "the war's peace")],
        }),
      );
  for (const h of store.heldFrom(r.ref))
    if (h.men + h.folk > 0)
      rows.push(
        stat("Of its people", [`${count(h.men + h.folk)} held by `, realmLink(world, h.by)], {
          why: h.cause,
          parts: [part("since", `year ${h.since}`)],
        }),
      );
  if (rows.length) blocks.push({ type: "facts", title: "Held in its wars", rows });
  const crimes = store.allCrimes().filter((c) => c.by === r.ref || c.on === r.ref);
  if (crimes.length)
    blocks.push({
      type: "list",
      title: "Wrongs of war, done by its hosts and to its people",
      items: crimes.slice(-12).map((c) => crimeItem(world, c)),
    });
  return blocks;
}

function campLine(world: World, c: Camp, here: boolean): Line {
  const why = FLED_WHY[c.kind] ?? "what struck it";
  return here
    ? [
        `${count(c.count)} from `,
        landLink(world, c.from),
        `, who fled ${why} (since year ${c.since})`,
      ]
    : [
        `${count(c.count)} in `,
        landLink(world, c.at),
        `, fled from ${why} (since year ${c.since})`,
      ];
}

/** Those sheltering in a land who fled to it, and those of it who fled elsewhere. Nothing where none. */
export function landFledBlocks(world: World, cell: number): Block[] {
  const store = displacedOf(world),
    blocks: Block[] = [];
  if (!store || !store.campCount()) return blocks;
  const here = [...store.campsAt(cell)].sort((a, b) => b.count - a.count),
    away: Camp[] = [];
  for (const c of store.allCamps()) if (c.from === cell) away.push(c);
  away.sort((a, b) => b.count - a.count);
  if (here.length) {
    const all = here.reduce((n, c) => n + c.count, 0);
    blocks.push({
      type: "list",
      title: `Sheltering here: ${count(all)} who fled${all >= FLED.camp ? ", camped by its towns" : ""}`,
      items: here
        .slice(0, 8)
        .map((c) => ({ ...item(campLine(world, c, true), c.cause), why: c.cause })),
    });
  }
  if (away.length)
    blocks.push({
      type: "list",
      title: `Fled from here: ${count(away.reduce((n, c) => n + c.count, 0))} not yet settled elsewhere`,
      items: away
        .slice(0, 8)
        .map((c) => ({ ...item(campLine(world, c, false), c.cause), why: c.cause })),
    });
  return blocks;
}

function fightItem(world: World, f: SeaFight, a: Ref, b: Ref): Item {
  const sides = [a, b],
    led = f.led[f.won] ? ` under ${f.led[f.won]}` : "",
    gone =
      f.lost === 0 || f.lost === 1
        ? `; the ${f.flags[f.lost]}, flagship of the beaten, went down`
        : "";
  const line: Line = [
    `Year ${f.year}: the fleet of `,
    realmLink(world, sides[f.won]!),
    `${led}${f.flags[f.won] ? `, in the ${f.flags[f.won]},` : ""} beat that of `,
    realmLink(world, sides[1 - f.won]!),
    `: ${count(f.sunk[1 - f.won]!)} t sunk of ${count(f.tons[1 - f.won]!)}, for ${count(f.sunk[f.won]!)} of ${count(f.tons[f.won]!)}${gone}`,
  ];
  return { ...item(line, f.event, f.year), why: f.event };
}

/** A war's meetings of fleets. Nothing where its fleets never met in numbers. */
export function warFleetBlocks(world: World, w: War): Block[] {
  const fights = fleetsOf(world)?.fightsOf(w.ref) ?? [];
  return fights.length
    ? [
        {
          type: "list",
          title: "Its fleets met",
          items: fights.map((f) => fightItem(world, f, w.attacker, w.defender)),
        },
      ]
    : [];
}

/** A realm's fleet as a thing: its flagship, who commands it, the flagships it has lost and the meetings it has fought. */
export function realmFleetBlocks(world: World, r: Polity): Block[] {
  const store = fleetsOf(world),
    fleet = store?.of(r.ref);
  if (!store || !fleet) return [];
  const led = fleetCommander(world, r.ref),
    blocks: Block[] = [
      {
        type: "facts",
        title: "Its fleet",
        rows: [
          stat("Flagship", `the ${fleet.flagship}`, {
            parts: [
              part("hers since", `year ${fleet.laid}`),
              part("flagships lost before her", count(fleet.lost)),
            ],
          }),
          stat(
            "Commanded by",
            led ? [link(led.name, `note:named:${led.id}`)] : "no one the world keeps by name",
          ),
          stat("Meetings of fleets fought", count(fleet.fought)),
        ],
      },
    ],
    wars = new Map<Ref, SeaFight[]>();
  for (const f of store.allFights()) {
    const l = wars.get(f.war);
    if (l) l.push(f);
    else wars.set(f.war, [f]);
  }
  const items: Item[] = [];
  for (const [war, fights] of wars) {
    const e = world.events.get(fights[0]!.event),
      a = e?.subjects[1] as Ref | undefined,
      b = e?.subjects[2] as Ref | undefined;
    void war;
    if (!a || !b || (a !== r.ref && b !== r.ref)) continue;
    for (const f of fights) items.push(fightItem(world, f, a, b));
  }
  if (items.length)
    blocks.push({ type: "list", title: "Its fleet's meetings at sea", items: items.slice(-10) });
  return blocks;
}
