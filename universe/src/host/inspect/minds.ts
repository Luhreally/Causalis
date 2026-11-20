// A realm's made minds as someone (sim/frontier/minds.ts; rules/beyond.ts MIND): once they think more than all their makers
// they are spoken of as one, by a name. Their page: who they are, whose, since when, how far past their makers, whether they are
// kept or have gone their own way and why that turned on how tightly their makers hold what they make, and what they do. One
// named actor a realm, kept in the minds' own row; while kept they sit at its court as one of its figures (sim/court/court.ts).
import type { World } from "../../kernel/index.ts";
import type { Block, PageModel, Place, Stat } from "../../bridge/index.ts";
import { BEYOND, MIND, WAY, heldOf, mindCounsel } from "../../rules/index.ts";
import {
  courtOf,
  cultureOf,
  mindsOf,
  politiesOf,
  realmName,
  type Polity,
} from "../../sim/index.ts";
import { realmColor } from "../colors.ts";
import { count, eventsAbout, link, sentence, stat, yearNow } from "./words.ts";
import { landLink, spotOfLand } from "./names.ts";

export const mindRef = (realm: string): string => `mind:${realm}`;

const times = (x: number): string =>
  x >= 100 ? count(Math.round(x)) : String(Math.round(x * 10) / 10);

/** A realm's minds as a link, where they are past their makers and so spoken of as one (null: not yet). */
export function mindLink(world: World, realm: string): ReturnType<typeof link> | null {
  const row = mindsOf(world)?.rows.get(realm as never);
  return row?.passed && row.name ? link(row.name, mindRef(realm)) : null;
}

/** What a realm's page says of its minds (null: it has none past their makers). */
export function realmMindBlock(world: World, r: Polity): Block | null {
  const row = mindsOf(world)?.rows.get(r.ref),
    name = mindLink(world, r.ref);
  if (!row || !name) return null;
  const past = 10 ** (row.past / 100),
    reach = mindCounsel(past, !!row.free);
  return {
    type: "facts",
    title: "Its made minds",
    rows: [
      stat("Spoken of as", [name], { why: row.passed ?? undefined }),
      stat("They think", `${times(past)} times what all its people do`),
      stat(
        "They are",
        row.free ? "gone their own way: they answer to no one" : "kept: they counsel its seat",
        { why: row.free ?? row.passed ?? undefined },
      ),
      stat(
        "What that does to its seat's reach",
        `${reach >= 0 ? "+" : ""}${Math.round(reach * 100)}%`,
      ),
    ],
  };
}

export function mindPage(world: World, ref: string): PageModel {
  const realmRef = ref.slice("mind:".length),
    r = politiesOf(world).get(realmRef as never),
    row = mindsOf(world)?.rows.get(realmRef as never);
  if (!r || !row || !row.name) throw new Error(`no mind ${ref}`);
  const year = yearNow(world),
    past = 10 ** (row.past / 100),
    ways = cultureOf(world).get(r.seat)?.traits ?? [],
    held = heldOf(ways[WAY.hierarchy] ?? 0.5, ways[WAY.tradition] ?? 0.5),
    reach = mindCounsel(past, !!row.free),
    sits = courtOf(world)
      ?.of(r.ref)
      ?.figures.find((f) => f.seat === "minds"),
    spot = spotOfLand(world, r.seat),
    place: Place | null = spot === null ? null : { scale: "globe", spot },
    color = realmColor(`${ref}:mind`),
    facts: Stat[] = [
      stat("Made by", [link(realmName(r), r.ref)]),
      stat("At", [landLink(world, r.seat)]),
      stat("Minds began to design minds", `year ${count(row.begun)}`),
      ...(row.passed
        ? [stat("Thought more than all their makers from", "the year told", { why: row.passed })]
        : []),
      stat("They think", `${times(past)} times what all its people do`, {
        parts: [
          {
            label: [
              "their crystal doubles as minds design minds, until the realm's power is all they can burn",
            ],
            value: `every ${BEYOND.mindsDoubling} years`,
          },
        ],
      }),
      stat(
        "They are",
        row.free ? "gone their own way: they answer to no one" : "kept: they answer to the seat",
        { why: row.free ?? row.passed ?? undefined },
      ),
      stat(
        "How tightly their makers hold what they make",
        `${Math.round(held * 100)} in a hundred`,
        {
          parts: [
            { label: ["from its people's order and their keeping to old ways"], value: "" },
            {
              label: [
                "the farther past their makers and the looser held, the likelier in a year that they go their own way",
              ],
              value: "",
            },
          ],
        },
      ),
    ],
    does: Stat[] = row.free
      ? [
          stat("In the realm", "a power that answers to no one"),
          stat("The works in the sky they tended", "send nothing down"),
          stat("Its seat's reach, which leaned on them", `${Math.round(reach * 100)}%`, {
            parts: [{ label: ["at the most"], value: `-${Math.round(MIND.gone * 100)}%` }],
          }),
        ]
      : [
          stat("At the seat", [
            "they counsel it, one of its court",
            ...(sits ? [": ", link(row.name, `court:${r.ref}:${sits.id}`)] : []),
          ]),
          stat("Its seat's reach", `+${Math.round(reach * 100)}%`, {
            parts: [{ label: ["at the most"], value: `+${Math.round(MIND.counsel * 100)}%` }],
          }),
          stat("The works in the sky", "they tend them, where the realm has any"),
        ],
    history = eventsAbout(world, [r.ref], 60).filter((i) =>
      /minds|mirrors|sky|gone up/i.test(
        i.line.map((s) => (typeof s === "string" ? s : s.text)).join(""),
      ),
    );
  return {
    ref,
    kind: "mind",
    icon: "🧠",
    portrait: { kind: "sign", color, tenet: "teaching" },
    title: sentence(row.name),
    subtitle: [
      row.free
        ? `The made minds of ${realmName(r)}, gone their own way`
        : `The made minds of ${realmName(r)}, spoken of as one`,
    ],
    color,
    place,
    stats: [
      stat("Against their makers", `${times(past)} times`),
      stat("They are", row.free ? "their own" : "kept"),
      stat("Since", `year ${count(row.begun)}`),
    ],
    tabs: [
      {
        id: "overview",
        name: "Overview",
        blocks: [
          { type: "facts", rows: facts },
          { type: "facts", title: "What they do", rows: does },
          {
            type: "text",
            lines: [
              [
                "They are many, and are spoken of as one: the world keeps one name for a realm's minds, how far past their makers they think and whether they are kept. No one of them is kept apart.",
              ],
            ],
          },
          ...(history.length
            ? [{ type: "list" as const, title: "What has been told of them", items: history }]
            : []),
        ],
      },
    ],
    followable: false,
    year,
  };
}

/** The page of a realm's made minds, where a ref is their figure at its court (`court:<realm>:<id>`); null: anyone else's. */
export function mindOfCourtRef(world: World, ref: string): string | null {
  const m = /^court:(pol:\d+:\d+):(\d+)$/.exec(ref);
  if (!m) return null;
  const f = courtOf(world)
    ?.of(m[1] as never)
    ?.figures.find((x) => x.id === Number(m[2]));
  return f?.seat === "minds" ? mindRef(m[1]!) : null;
}
