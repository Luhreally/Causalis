// People as individuals (Phase 14 M118): what a person is like — their traits as chips, each a
// page that says what it does, how one comes to have it and who has it now — and their family as
// a tree, the eldest first: grandparents, parents, them and their partner, their children, their
// grandchildren. For the people under the god's hand (the world's own individuals: their mothers,
// fathers and partners kept, their children born one by one) and for the families met (their
// family as their household's roles tell it).
import { yearOfMoment, type World } from "../../kernel/index.ts";
import { FEMALE } from "../../rules/index.ts";
import {
  type Agent,
  agentName,
  type Gone,
  handOf,
  natureOf,
  PERSON_TRAITS,
  type PersonTrait,
  populationContext,
  TRAIT_ANEW,
  TRAIT_INHERITED,
  TRAIT_SHARE,
  type Window,
} from "../../sim/index.ts";
import { observer, type Person } from "../../causal/index.ts";
import type { Block, Line, PageModel } from "../../bridge/index.ts";
import { item, link, share, yearNow } from "./words.ts";

/** Each trait a person under the hand may have: its sign, its name, what it does. */
export const TRAIT_LOOK: Readonly<
  Record<PersonTrait, { icon: string; name: string; does: string }>
> = {
  hardy: { icon: "💪", name: "Hardy", does: "a quarter less likely to die in any year" },
  frail: { icon: "🩹", name: "Frail", does: "a third again as likely to die in any year" },
  fertile: {
    icon: "🌸",
    name: "Fertile",
    does: "children come two in five again as often to them and their partner",
  },
  lucky: { icon: "🍀", name: "Lucky", does: "a tenth less likely to die in any year" },
  clever: {
    icon: "🧠",
    name: "Clever",
    does: "quick to learn: three times as likely to take up a craft when grown",
  },
  brave: {
    icon: "🦁",
    name: "Brave",
    does: "fearless: twice as likely to take to the hunt or the herds when grown",
  },
  kind: {
    icon: "💗",
    name: "Kind",
    does: "gentle: the young in their care a sixth less likely to die",
  },
  pious: {
    icon: "🙏",
    name: "Pious",
    does: "devout: your blessing holds on them half again as long",
  },
  greedy: {
    icon: "💰",
    name: "Greedy",
    does: "grasping: three times as likely to take up trade when grown",
  },
  wise: {
    icon: "🦉",
    name: "Wise",
    does: "far-seeing: three times as likely to be among those who lead when grown",
  },
};

/** What the families met are like, word by word (each of five ways of being, at its ends). */
const MET_TRAITS: Readonly<Record<string, { icon: string; of: string; high: boolean }>> = {
  cautious: { icon: "🐢", of: "boldness", high: false },
  bold: { icon: "🦁", of: "boldness", high: true },
  reserved: { icon: "🤐", of: "warmth", high: false },
  warm: { icon: "💗", of: "warmth", high: true },
  "free-handed": { icon: "🎁", of: "thrift", high: false },
  thrifty: { icon: "🏺", of: "thrift", high: true },
  "set in their ways": { icon: "🪨", of: "curiosity", high: false },
  curious: { icon: "🔭", of: "curiosity", high: true },
  "quick-tempered": { icon: "🌶️", of: "patience", high: false },
  patient: { icon: "🌿", of: "patience", high: true },
};

const slug = (words: string) => words.replace(/\s+/g, "-");

/** A person under the hand's traits, as chips (each its page). */
export function traitChips(traits: readonly PersonTrait[]): Block {
  return {
    type: "chips",
    title: "What they are like",
    chips: traits.map((t) => ({
      icon: TRAIT_LOOK[t].icon,
      name: TRAIT_LOOK[t].name,
      ref: `trait:${t}`,
      words: TRAIT_LOOK[t].does,
    })),
  };
}

/** A met person's character words, as chips (each its page). */
export function metChips(words: readonly string[]): Block {
  return {
    type: "chips",
    title: "What they are like",
    chips: words.map((w) => ({
      icon: MET_TRAITS[w]?.icon ?? "•",
      name: w[0]!.toUpperCase() + w.slice(1),
      ref: MET_TRAITS[w] ? `trait:${slug(w)}` : null,
    })),
  };
}

/** Someone of the hand's people, living or gone, as the tree shows them. */
type Kin = (Agent & { died?: undefined }) | Gone;

/** Everyone the hand has known: the living and the gone, by id. */
function kinOf(w: Window): Map<number, Kin> {
  const all = new Map<number, Kin>();
  for (const g of w.gone ?? []) all.set(g.id, g);
  for (const a of w.agents) all.set(a.id, a);
  return all;
}

/** A person of the hand's family tree: their name (a link while they live) and a few words. */
function kinCell(
  world: World,
  w: Window,
  k: Kin,
  self = false,
): { name: Line; note: string; woman: boolean; self?: boolean; dead?: boolean } {
  const ctx = populationContext(world),
    town = ctx.settlements.get(w.village)!,
    // (Reckoned as the person's own page reckons it.)
    now = yearOfMoment(world.now),
    name = agentName(ctx, k as Agent, town),
    dead = k.died !== undefined;
  return {
    // (Walked from a tree, a person opens on their own tree.)
    name: dead ? [name] : [link(name, `agent:${k.id}#family`)],
    note: dead ? `${k.birthYear}–${k.died}` : `${now - k.birthYear}`,
    woman: k.sex === FEMALE,
    ...(self ? { self } : {}),
    ...(dead ? { dead } : {}),
  };
}

/** A person under the hand's family: their tree, and their brothers and sisters. */
export function agentFamily(world: World, w: Window, a: Agent): Block[] {
  const all = kinOf(w),
    parentsOf = (k: Kin | undefined) =>
      k
        ? [k.mother, k.father].flatMap((id) =>
            id === undefined ? [] : all.get(id) ? [all.get(id)!] : [],
          )
        : [],
    childrenOf = (ids: readonly number[]) =>
      [...all.values()]
        .filter((k) => ids.some((id) => k.mother === id || k.father === id))
        .sort((x, y) => x.birthYear - y.birthYear || x.id - y.id),
    parents = parentsOf(a),
    grand = parents.flatMap((p) => parentsOf(p)),
    partner = a.partner !== undefined ? all.get(a.partner) : undefined,
    children = childrenOf([a.id]),
    grandchildren = childrenOf(children.map((c) => c.id)),
    siblings = [...all.values()]
      .filter(
        (k) =>
          k.id !== a.id &&
          ((a.mother !== undefined && k.mother === a.mother) ||
            (a.father !== undefined && k.father === a.father)),
      )
      .sort((x, y) => x.birthYear - y.birthYear || x.id - y.id),
    row = (label: string, people: readonly Kin[]) =>
      people.length ? [{ label, people: people.map((k) => kinCell(world, w, k)) }] : [];
  const tree: Block = {
    type: "tree",
    title: "Their family",
    rows: [
      ...row("Grandparents", grand),
      ...row("Parents", parents),
      {
        label: partner ? "Them, and their partner" : "Them",
        people: [kinCell(world, w, a, true), ...(partner ? [kinCell(world, w, partner)] : [])],
      },
      ...row("Children", children),
      ...row("Grandchildren", grandchildren),
    ],
  };
  const blocks: Block[] = [tree];
  if (siblings.length)
    blocks.push({
      type: "list",
      title: "Brothers and sisters",
      items: siblings.map((k) => {
        const c = kinCell(world, w, k);
        return item([...c.name, ` — ${c.dead ? `lived ${c.note}` : `aged ${c.note}`}`]);
      }),
    });
  return blocks;
}

/** A met person's family, as their household's roles tell it. */
export function metFamily(world: World, p: Person): Block | null {
  const ledger = observer(world),
    hh = ledger.household(p.household);
  if (!hh) return null;
  const now = yearNow(world),
    members = hh.members.map((r) => ledger.person(r)).filter((m): m is Person => !!m),
    cell = (m: Person, self = false) => ({
      name: self ? [`${m.name} ${m.surname}`] : [link(`${m.name} ${m.surname}`, m.ref)],
      note: m.alive ? `${now - m.birthYear}` : `${m.birthYear}–${m.diedYear ?? "?"}`,
      woman: m.sex === FEMALE,
      ...(self ? { self } : {}),
      ...(!m.alive ? { dead: true } : {}),
    }),
    by = (role: string) => members.filter((m) => m.role === role && m.ref !== p.ref),
    head = members.find((m) => m.role === "head"),
    spouse = members.find((m) => m.role === "spouse"),
    rows: { label: string; people: ReturnType<typeof cell>[] }[] = [],
    add = (label: string, people: readonly Person[]) => {
      if (people.length) rows.push({ label, people: people.map((m) => cell(m)) });
    };
  // (The household's head and spouse are its children's parents; its elder is the head's.)
  switch (p.role) {
    case "child":
      add("Grandparents", by("elder"));
      add(
        "Parents",
        [head, spouse].filter((m): m is Person => !!m),
      );
      rows.push({
        label: "Them, and their brothers and sisters",
        people: [cell(p, true), ...by("child").map((m) => cell(m))],
      });
      break;
    case "head":
    case "spouse": {
      add("Parents", p.role === "head" ? by("elder") : []);
      const partner = p.role === "head" ? spouse : head;
      rows.push({
        label: partner ? "Them, and their partner" : "Them",
        people: [cell(p, true), ...(partner ? [cell(partner)] : [])],
      });
      add("Children", by("child"));
      break;
    }
    case "elder":
      rows.push({ label: "Them", people: [cell(p, true)] });
      add(
        "Children",
        [head].filter((m): m is Person => !!m),
      );
      add("Grandchildren", by("child"));
      break;
    default:
      rows.push({ label: "Them", people: [cell(p, true)] });
      add(
        "Kin in the household",
        members.filter((m) => m.ref !== p.ref),
      );
  }
  return { type: "tree", title: "Their family", rows };
}

/** A trait's page: what it does, how one comes to have it, who has it now. */
export function traitPage(world: World, ref: string): PageModel {
  const id = ref.slice(ref.indexOf(":") + 1),
    year = yearNow(world),
    hand = (PERSON_TRAITS as readonly string[]).includes(id) ? (id as PersonTrait) : null,
    met = hand ? null : (Object.keys(MET_TRAITS).find((w) => slug(w) === id) ?? null);
  if (!hand && !met) throw new Error(`no trait ${ref}`);
  if (hand) {
    const look = TRAIT_LOOK[hand],
      w = handOf(world).resting,
      ctx = populationContext(world),
      town = w ? ctx.settlements.get(w.village) : undefined,
      having = w && town ? w.agents.filter((a) => a.traits?.includes(hand)) : [],
      now = yearOfMoment(world.now);
    return {
      ref,
      kind: "trait",
      icon: look.icon,
      title: look.name,
      subtitle: ["What one of the people under your hand may be like"],
      color: null,
      place: null,
      stats: [],
      tabs: [
        {
          id: "overview",
          name: "Overview",
          blocks: [
            { type: "text", lines: [[`${look.name}: ${look.does}.`]] },
            {
              type: "text",
              title: "How one comes to be so",
              lines: [
                [
                  `When your hand is laid on a village, ${share(TRAIT_SHARE)} of its people are so. A child born under it takes each of its parents' traits by half (${share(TRAIT_INHERITED)}), and one in ${Math.round(1 / TRAIT_ANEW)} has one of its own. Your hand may give or take it.`,
                ],
              ],
            },
            {
              type: "list",
              title: w ? `Who is so under your hand now` : "Your hand rests on no village",
              items: having
                .slice(0, 60)
                .map((a) =>
                  item([
                    link(agentName(ctx, a, town!), `agent:${a.id}`),
                    ` — aged ${now - a.birthYear}`,
                  ]),
                ),
              ...(having.length > 60 ? { more: having.length - 60 } : {}),
            },
          ],
        },
      ],
      followable: false,
      year,
    };
  }
  const look = MET_TRAITS[met!]!,
    ledger = observer(world),
    // (Its end of the way of being: below a third, or above two thirds.)
    alike = ledger
      .allHouseholds()
      .flatMap((h) => h.members.map((r) => ledger.person(r)))
      .filter((p): p is Person => {
        const v = p?.alive ? natureOf(world, p.ref, p.traits ?? {})[look.of] : undefined;
        return v !== undefined && (look.high ? v > 0.65 : v < 0.35);
      });
  return {
    ref,
    kind: "trait",
    icon: look.icon,
    title: met![0]!.toUpperCase() + met!.slice(1),
    subtitle: ["What one of the families met may be like"],
    color: null,
    place: null,
    stats: [],
    tabs: [
      {
        id: "overview",
        name: "Overview",
        blocks: [
          {
            type: "text",
            lines: [
              [
                `One of the ends of their ${look.of}: each person met is born with some of it, and what they live through moves it — a famine in their youth makes the thrifty, a move the bold. Only its ends are said: most are between.`,
              ],
            ],
          },
          {
            type: "list",
            title: `Who is so, of the families met (${alike.length})`,
            items: alike
              .slice(0, 60)
              .map((p) =>
                item([link(`${p.name} ${p.surname}`, p.ref), ` — ${year - p.birthYear}`]),
              ),
            ...(alike.length > 60 ? { more: alike.length - 60 } : {}),
          },
        ],
      },
    ],
    followable: false,
    year,
  };
}
