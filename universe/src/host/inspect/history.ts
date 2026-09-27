// The pages of history (Phase 10 M91): an event — what happened, when and where, who it
// was about, why it happened and what it led to — a decision with its reasons, and an act
// of the god's. A forgotten event still has its page: what the explainer keeps of it.
import { WAR_EVENTS } from "../../sim/index.ts";
import { why } from "../../causal/index.ts";
import { isRef, parseRef, type Ref, type World } from "../../kernel/index.ts";
import type { Block, PageModel, Place } from "../../bridge/index.ts";
import { eventsCiting, link, sentence, stat, yearAt, yearNow } from "./words.ts";
import { refLink } from "./names.ts";
import { landPlace } from "./land.ts";
import { battlePage } from "./realm.ts";

/** What an event's type is in a heading's words, and its icon. */
const HEADINGS: Readonly<Record<string, readonly [string, string]>> = {
  war: ["War", "⚔️"],
  polity: ["Realm", "👑"],
  belief: ["Faith", "✨"],
  population: ["People", "🧑"],
  economy: ["Trade", "📦"],
  lore: ["Learning", "📜"],
  ecology: ["The wild", "🦌"],
  climate: ["The air", "🌦️"],
  space: ["The sky", "🚀"],
  starwar: ["War among the stars", "🚀"],
  language: ["Speech", "🗣️"],
  act: ["The god's hand", "✋"],
  design: ["Craft", "📐"],
  city: ["Cities", "🏙️"],
  diplomacy: ["Diplomacy", "🤝"],
  culture: ["Ways", "🧭"],
};

/** Where a thing an event names is to be seen (its place, most often a land). */
export function placeOfRef(world: World, ref: string | null): Place | null {
  if (!ref || !isRef(ref)) return null;
  const code = ref.slice(0, ref.indexOf(":")),
    n = parseRef(ref).b;
  if (code === "cell") return landPlace(world, n);
  if (code === "spot") return { scale: "globe", spot: n };
  if (code === "town") return { scale: "village", town: ref };
  return null;
}

/** An event's page (a battle's is a battle page). */
export function eventPage(world: World, ref: string): PageModel {
  const e = world.events.get(ref as Ref);
  if (e?.type === WAR_EVENTS.battle.type) return battlePage(world, ref);
  const x = why(world, ref as Ref),
    type = e?.type ?? "",
    [domain, what] = type.split("."),
    heading = HEADINGS[domain ?? ""] ?? [sentence(domain ?? "Event"), "📜"],
    year = e ? yearAt(e.t) : x.t !== null ? yearAt(x.t) : null;
  const blocks: Block[] = [
    { type: "text", lines: [[x.claim]] },
    {
      type: "facts",
      rows: [
        ...(year !== null ? [stat("When", `year ${year}`)] : []),
        ...(e?.place ? [stat("Where", [refLink(world, e.place)])] : []),
        ...(e?.subjects.length
          ? [
              stat(
                "Who",
                e.subjects.flatMap((s, i) => [...(i ? [", "] : []), refLink(world, s)]),
              ),
            ]
          : []),
        ...(e ? [stat("It mattered", "★".repeat(Math.max(1, Math.min(8, e.importance))))] : []),
        stat(
          "Known",
          x.basis === "recorded"
            ? "as it was recorded"
            : x.basis === "forgotten"
              ? "only in outline: the rest is forgotten"
              : x.basis,
        ),
      ],
    },
    { type: "why", title: "Why it happened", ref },
  ];
  const led = eventsCiting(world, ref);
  if (led.length) blocks.push({ type: "list", title: "What it led to", items: led });
  return {
    ref,
    kind: "event",
    icon: heading[1],
    title: `${heading[0]}${what ? `: ${what.replace(/-/g, " ")}` : ""}`,
    subtitle: [
      ...(year !== null ? [`Year ${year}`] : []),
      ...(e?.place ? [" · ", refLink(world, e.place)] : []),
    ],
    color: null,
    place: placeOfRef(world, e?.place ?? null),
    stats: [
      ...(year !== null ? [stat("Year", `${year}`)] : []),
      ...(e?.place ? [stat("Where", [refLink(world, e.place)])] : []),
    ],
    tabs: [{ id: "overview", name: "Overview", blocks }],
    followable: false,
    year: yearNow(world),
  };
}

/** A decision: what was decided, and its reasons weighed. */
export function decisionPage(world: World, ref: string): PageModel {
  const x = why(world, ref as Ref);
  return {
    ref,
    kind: "decision",
    icon: "⚖️",
    title: "A decision",
    subtitle: x.t !== null ? [`Year ${yearAt(x.t)}`] : [],
    color: null,
    place: null,
    stats: x.t !== null ? [stat("Year", `${yearAt(x.t)}`)] : [],
    tabs: [
      {
        id: "overview",
        name: "Overview",
        blocks: [
          { type: "text", lines: [[x.claim]] },
          { type: "why", title: "Its reasons", ref },
        ],
      },
    ],
    followable: false,
    year: yearNow(world),
  };
}

/** An act of the god's (a command): what was done, and what it led to. */
export function actPage(world: World, ref: string): PageModel {
  const x = why(world, ref as Ref),
    led = eventsCiting(world, ref);
  return {
    ref,
    kind: "act",
    icon: "✋",
    title: "An act of the god",
    subtitle: x.t !== null ? [`Year ${yearAt(x.t)}`] : [],
    color: null,
    place: null,
    stats: x.t !== null ? [stat("Year", `${yearAt(x.t)}`)] : [],
    tabs: [
      {
        id: "overview",
        name: "Overview",
        blocks: [
          { type: "text", lines: [[x.claim]] },
          ...(led.length ? [{ type: "list" as const, title: "What it led to", items: led }] : []),
        ],
      },
    ],
    followable: false,
    year: yearNow(world),
  };
}

/** Anything else: what the explainer says of it. */
export function unknownPage(world: World, ref: string, gone = false): PageModel {
  const claim = isRef(ref) ? why(world, ref as Ref).claim : "nothing is known of it";
  return {
    ref,
    kind: "unknown",
    icon: gone ? "🕳️" : "❔",
    title: gone
      ? "Gone from the world"
      : sentence(claim.length > 48 ? `${claim.slice(0, 45)}…` : claim),
    subtitle: [],
    color: null,
    place: null,
    stats: [],
    tabs: [
      {
        id: "overview",
        name: "Overview",
        blocks: [
          { type: "text", lines: [[claim]] },
          ...(isRef(ref) ? [{ type: "why" as const, ref }] : []),
        ],
      },
    ],
    followable: false,
    year: yearNow(world),
  };
}

export { link };
