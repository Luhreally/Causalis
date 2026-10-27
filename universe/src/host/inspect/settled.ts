// The pages of those who live somewhere (Phase 10 M91): a town — its people, founding,
// market, city, how it lives now, the families met there and what has happened there — a
// household met, a person met (their life, family, moves, memories and character), a
// memory, and one of the people under the god's hand.
import { cellRef } from "../../gen/index.ts";
import {
  agentName,
  handOf,
  lifeOf,
  natureOf,
  politiesOf,
  populationContext,
  realmName,
  warsOf,
} from "../../sim/index.ts";
import {
  LIFE_WORDS,
  MEMORY_WORDS,
  TRAITS,
  observer,
  resolvePerson,
  settleAll,
  type Person,
  type WarFate,
} from "../../causal/index.ts";
import { yearOfMoment, type Ref, type World } from "../../kernel/index.ts";
import { FEMALE } from "../../rules/index.ts";
import type { Block, Item, PageModel, Stat, Tab } from "../../bridge/index.ts";
import { province, settlementFacts } from "../planet.ts";
import { landEra, landHouse, peopleBody } from "../village.ts";
import { battleWords, burialWords } from "../burials.ts";
import { townRoster } from "../roster.ts";
import { metWounds } from "../wounds.ts";
import { lookOf, woundBlock, woundedTab } from "./wounds.ts";
import { armsBlock } from "./arm.ts";
import { hashString } from "../../kernel/index.ts";
import { realmColor } from "../colors.ts";
import {
  claimOf,
  count,
  eventsAbout,
  item,
  link,
  many,
  sentence,
  share,
  stat,
  yearNow,
} from "./words.ts";
import { faithLink, landLink, landTitle, languageLink, realmLink, townLink } from "./names.ts";
import { TRAIT_LOOK, agentFamily, metChips, metFamily, traitChips } from "./folk.ts";
import { agentHolder, householdThingsBlocks, personThingsBlocks } from "./things.ts";
import { buildingsTab } from "./fabric.ts";
import { threadBlock } from "./thread.ts";

const OCCUPATION_WORDS = ["child", "forager", "farmer", "herder", "crafter", "trader", "leader"];
/** Each trait said low / middling / high. */
const TRAIT_WORDS: Readonly<Record<string, readonly [string, string, string]>> = {
  boldness: ["cautious", "steady", "bold"],
  warmth: ["reserved", "civil", "warm"],
  thrift: ["free-handed", "careful with food", "thrifty"],
  curiosity: ["set in their ways", "open to new ways", "curious"],
  patience: ["quick-tempered", "even-tempered", "patient"],
};
/** How a man came home from a battle he went to, said before its name (Phase 55 M225). */
const WAR_WORDS: Readonly<Record<WarFate["fate"], string>> = {
  stood: "Fought at ",
  hurt: "Wounded at ",
  maimed: "Maimed at ",
  fell: "Fell at ",
};

/** A town's page. */
export function townPage(world: World, ref: string): PageModel {
  const s = settlementFacts(world, ref),
    ctx = populationContext(world),
    p = province(world, s.cell),
    year = yearNow(world),
    realms = politiesOf(world),
    realm = realms.of(s.cell);
  settleAll(world);
  const ledger = observer(world),
    met = ledger.allHouseholds().filter((h) => h.village === s.ref),
    unmet = Math.max(0, s.population - ledger.claimedIn(s.ref as Ref));

  const stats: Stat[] = [
    stat("People", count(s.population), { why: s.event }),
    stat("Founded", `year ${s.founded}`, { why: s.event }),
    stat("Land", [landLink(world, s.cell)]),
  ];
  if (realm) stats.push(stat("Realm", [link(realmName(realm), realm.ref)]));

  // How it lives now: fed, at war, its grievance, a battle fought in its land lately.
  const now: Stat[] = [];
  if (p) now.push(stat("Fed", share(p.fed / 1000), { why: p.folk }));
  if (realm) {
    const fighting = warsOf(world)
      .fighting(realm.ref)
      .filter((w) => w.ended === null);
    now.push(
      stat(
        "At war",
        fighting.length
          ? fighting.flatMap((w, i) => [
              ...(i ? [", "] : []),
              link(
                `against ${realmName(realms.get(w.attacker === realm.ref ? w.defender : w.attacker) ?? realm)}`,
                w.ref,
              ),
            ])
          : ["at peace"],
      ),
      stat("Grievance", share(Math.min(1, realms.discontent(s.cell).level)), {
        why: realms.discontent(s.cell).cause,
      }),
    );
  }
  for (const w of warsOf(world).all()) {
    const b = w.battles.findLast((x) => x.land === s.cell && x.year >= year - 1);
    if (b)
      now.push(
        stat(
          "Battle",
          [link(`fought in year ${b.year}`, b.event), " in the ", link("war", w.ref)],
          {
            why: b.event,
          },
        ),
      );
  }

  const tabs: Tab[] = [];
  {
    const blocks: Block[] = [
      {
        type: "facts",
        rows: [
          stat("People", count(s.population)),
          stat("Founded", `year ${s.founded}`, { why: s.event }),
          stat("Land", [landLink(world, s.cell)]),
          ...(realm
            ? [stat("Realm", [link(realmName(realm), realm.ref)], { why: realm.ref })]
            : []),
          ...(p?.faith
            ? [stat("Faith", [faithLink(world, p.faith.ref)], { why: p.faith.event })]
            : []),
          ...(p?.ways?.language
            ? [stat("Tongue", [languageLink(world, p.ways.language.ref)])]
            : []),
          ...(s.market ? [stat("Market", "its land's market town", { why: s.market })] : []),
          ...(s.shrine ? [stat("Shrine", "the god raised one here", { why: s.shrine })] : []),
          ...(s.spring ? [stat("Spring", "the god opened one here", { why: s.spring })] : []),
        ],
      },
    ];
    if (now.length) blocks.push({ type: "facts", title: "Now", rows: now });
    if (s.city)
      blocks.push({
        type: "facts",
        title: "Its city",
        rows: [
          stat("A city since", `year ${s.city.founded}`, { why: s.city.event }),
          stat("Streets", s.city.paved ? "paved" : "of earth"),
          ...s.city.quarters.map((q) => stat(q.name, many(q.blocks, "block", "blocks"))),
        ],
      });
    blocks.push(
      // Down to its land to watch it grow, the clock a year a second (Phase 26 M154).
      { type: "tool", tool: "watch.grow", args: { cell: s.cell, town: s.ref } },
      { type: "why", title: "How it came to be", ref: s.event },
      { type: "tool", tool: "acts.place", args: { town: s.ref } },
    );
    tabs.push({ id: "overview", name: "Overview", blocks });
  }
  // Its fabric: its homes by level, its other buildings, its walls (Phase 25 M151).
  {
    const built = buildingsTab(world, s.ref as Ref);
    if (built) tabs.push(built);
  }
  {
    const items: Item[] = met.map((h) =>
      item(
        [
          link(`The ${h.surname} household`, h.ref),
          ` — ${many(h.members.length, "person", "people")}, met in year ${h.metIn}`,
        ],
        h.ref,
      ),
    );
    tabs.push({
      id: "families",
      name: "Families",
      blocks: [
        {
          type: "list",
          title: "Families you have met",
          items,
          ...(unmet ? { more: unmet } : {}),
        },
        { type: "tool", tool: "meet.town", args: { cell: s.cell, town: s.ref } },
        { type: "tool", tool: "hand.town", args: { town: s.ref } },
      ],
    });
  }
  // Its men at war (Phase 55 M225): each battle its men were levied to, newest first, and who fell
  // there (its line holders, then the people met from it).
  {
    const roster = townRoster(world, s.ref),
      fallen = new Map<string, Person[]>();
    for (const person of ledger.persons.values()) {
      const fate =
        person.village === s.ref ? person.wars?.find((w) => w.fate === "fell") : undefined;
      if (fate) fallen.set(fate.event, [...(fallen.get(fate.event) ?? []), person]);
    }
    const items: Item[] = [];
    for (const rb of [...roster.battles].reverse()) {
      const [sent, dead, hurt] = rb.tally;
      items.push(
        item(
          [
            link(sentence(battleWords(world, rb.land)), rb.event),
            `, year ${rb.year}: ${count(sent)} sent, ${count(dead)} fell, ${count(hurt)} came home wounded`,
          ],
          rb.event,
          rb.year,
        ),
      );
      for (const m of rb.men)
        if (m.fate === "fell")
          items.push(
            item(
              [
                "Fell there: ",
                link(roster.nameOf(m.holder), m.holder.ref),
                `, aged ${rb.year - m.holder.born}`,
              ],
              m.holder.ref,
              rb.year,
            ),
          );
      for (const person of fallen.get(rb.event) ?? [])
        items.push(
          item(
            [
              "Fell there: ",
              link(`${person.name} ${person.surname}`, person.ref),
              `, aged ${rb.year - person.birthYear}`,
            ],
            person.ref,
            rb.year,
          ),
        );
    }
    if (items.length)
      tabs.push({
        id: "war",
        name: "War",
        blocks: [{ type: "list", title: "Its men at war", items }],
      });
  }
  // Its wounded (Phase 55 M226, M229): those healing now, those marked for good, and its healer.
  const wounded = woundedTab(world, s.ref);
  if (wounded) tabs.push(wounded);
  // Back to the beginning (Phase 36 M182): its land, its people, their line, the world.
  tabs.push({ id: "origins", name: "Origins", blocks: [threadBlock(world, { town: s.ref })] });
  {
    const items = eventsAbout(world, [s.ref], 30);
    if (items.length)
      tabs.push({ id: "history", name: "History", blocks: [{ type: "list", items }] });
  }
  return {
    ref: s.ref,
    kind: "town",
    icon: s.city ? "🏙️" : "🏘️",
    portrait: {
      kind: "town",
      house: landHouse(world, s.cell),
      homes: Math.max(3, Math.round(s.population / 5)),
      city: !!s.city,
      key: hashString(s.ref),
    },
    title: s.name,
    subtitle: [s.city ? "A city of " : "A town of ", landLink(world, s.cell, true)],
    color: realm ? realmColor(realm.ref) : null,
    place: { scale: "village", town: s.ref },
    stats,
    tabs,
    followable: true,
    year,
  };
  // (ctx kept for symmetry with the other pages.)
  void ctx;
}

/** A household met: its people, where it lives, when it was met. */
export function householdPage(world: World, ref: string): PageModel {
  settleAll(world);
  const ledger = observer(world),
    h = ledger.household(ref as Ref);
  if (!h) throw new Error(`no household ${ref}`);
  const members = h.members.map((m) => ledger.person(m)!).filter((m) => !!m);
  return {
    ref: h.ref,
    kind: "household",
    icon: "🏠",
    title: `The ${h.surname} household`,
    subtitle: h.village
      ? ["Of ", townLink(world, h.village)]
      : ["Of ", landLink(world, h.cell, true)],
    color: null,
    place: h.village
      ? { scale: "village", town: h.village, household: h.ref }
      : { scale: "region", cell: h.cell },
    stats: [
      stat("People", count(members.filter((m) => m.alive).length)),
      stat("Met", `year ${h.metIn}`),
    ],
    tabs: [
      {
        id: "overview",
        name: "Overview",
        blocks: [
          {
            type: "list",
            title: "Its people",
            items: members.map((m) =>
              item([link(`${m.name} ${m.surname}`, m.ref), ` — ${personBrief(world, m)}`], m.ref),
            ),
          },
          { type: "why", ref: h.ref },
        ],
      },
      // Its things (Phase 15 M125): what it keeps, what each of its people holds, its food.
      { id: "things", name: "Things", blocks: householdThingsBlocks(world, h) },
    ],
    followable: false,
    year: yearNow(world),
  };
}

/** A person in a few words: their age and work, or when and how they died. */
function personBrief(world: World, p: Person): string {
  const now = yearNow(world),
    age = (p.alive ? now : (p.diedYear ?? now)) - p.birthYear,
    fell = p.wars?.find((w) => w.fate === "fell");
  return p.alive
    ? `${age}, ${OCCUPATION_WORDS[p.occupation] ?? "at work"}`
    : fell
      ? `fell at ${battleWords(world, fell.land)} in year ${fell.year}, at ${age}`
      : `died in year ${p.diedYear} at ${age}`;
}

/** A person met: who they are, the life they lived, what they remember and who they became. */
export function personPage(world: World, ref: string): PageModel {
  const p = resolvePerson(world, ref as Ref, 4),
    ledger = observer(world),
    hh = ledger.household(p.household),
    now = yearNow(world),
    age = (p.alive ? now : (p.diedYear ?? now)) - p.birthYear,
    grown = age >= lifeOf(world).adulthood;
  // How they came home from the battles they went to, and the one they fell in (Phase 55 M225).
  const wars = p.wars ?? [],
    fell = wars.find((w) => w.fate === "fell"),
    // (The wounds they came home with, or a strike dealt them: Phase 55 M226.)
    wounds = metWounds(world, p),
    told = woundBlock(wounds, p.sex, world.now),
    // (Where one who fell is laid: his town's square, else his land's name.)
    townName = p.village ? populationContext(world).settlements.get(p.village)?.name : undefined;
  // (What they are like: what they were born with, and what the god has pushed: Phase 16.)
  const nature = natureOf(world, p.ref, p.traits ?? {}),
    traits = TRAITS.flatMap((t) => {
      const v = nature[t] ?? 0.5,
        words = TRAIT_WORDS[t]!;
      return v < 0.35 ? [words[0]] : v > 0.65 ? [words[2]] : [];
    });
  const stats: Stat[] = [
    stat("Age", p.alive ? `${age}` : `died at ${age}`),
    stat("Work", grown ? (OCCUPATION_WORDS[p.occupation] ?? "") : "a child"),
    stat("Home", p.village ? [townLink(world, p.village)] : [landLink(world, p.cell)]),
  ];
  const tabs: Tab[] = [
    {
      id: "overview",
      name: "Overview",
      blocks: [
        {
          type: "facts",
          rows: [
            stat(
              "Born",
              `year ${p.birthYear}${p.bornBeforeChronicle ? " (before the chronicle)" : ""}`,
            ),
            stat("Born in", [landLink(world, p.birthCell)]),
            stat(
              "Lives in",
              p.village
                ? [townLink(world, p.village), ", ", landLink(world, p.cell, true)]
                : [landLink(world, p.cell)],
            ),
            stat("Who", `a ${p.sex === FEMALE ? "woman" : "man"}, the household's ${p.role}`),
            ...(hh ? [stat("Household", [link(`The ${hh.surname} household`, hh.ref)])] : []),

            ...(fell
              ? [
                  stat(
                    "Fate",
                    [
                      "Fell at ",
                      link(battleWords(world, fell.land), fell.event),
                      ` in year ${fell.year}`,
                    ],
                    { why: fell.event },
                  ),
                  stat(
                    "Grave",
                    sentence(
                      burialWords(
                        world,
                        fell.land,
                        fell.cell,
                        townName ?? landTitle(world, fell.cell, true),
                      ),
                    ),
                  ),
                ]
              : !p.alive
                ? [stat("Died", `year ${p.diedYear}`)]
                : []),
          ],
        },
        ...(traits.length ? [metChips(traits)] : []),
        // Each battle they went to, how they came home, and the year (Phase 55 M225).
        ...(wars.length
          ? [
              {
                type: "list" as const,
                title: "Their wars",
                items: wars.map((w) =>
                  item(
                    [
                      WAR_WORDS[w.fate],
                      link(battleWords(world, w.land), w.event),
                      `, year ${w.year}`,
                    ],
                    w.event,
                    w.year,
                  ),
                ),
              },
            ]
          : []),
        ...(told ? [told] : []),
        // What he bore at the battle he fell at, else his last (Phase 55 M228).
        ...(() => {
          const w = fell ?? wars.at(-1),
            arms = w ? armsBlock(world, w.event, w.side, p.ref) : null;
          return arms ? [arms] : [];
        })(),
        ...(hh
          ? [
              {
                type: "list" as const,
                title: "Their household",
                items: hh.members
                  .filter((r) => r !== p.ref)
                  .map((r) => ledger.person(r))
                  .filter((m): m is Person => !!m)
                  .map((m) =>
                    item(
                      [link(`${m.name} ${m.surname}`, m.ref), ` — ${personBrief(world, m)}`],
                      m.ref,
                    ),
                  ),
              },
            ]
          : []),
        { type: "why", ref: p.ref },
        {
          type: "tool",
          tool: "acts.person",
          args: {
            ref: p.ref,
            alive: p.alive,
            village: p.village,
            first: p.name,
            // (Who the hand would touch, laid on their town from them: Phase 54.)
            name: `${p.name} ${p.surname}`,
            age: yearNow(world) - p.birthYear,
            occupation: p.occupation,
            sex: p.sex,
            natures: TRAITS.map((t) => [
              t,
              TRAIT_WORDS[t]![0],
              TRAIT_WORDS[t]![2],
              nature[t] ?? 0.5,
            ]),
          },
        },
      ],
    },
    // Their family as a tree (Phase 14 M118), as their household's roles tell it.
    ...(() => {
      const tree = metFamily(world, p);
      return tree ? [{ id: "family", name: "Family", blocks: [tree] }] : [];
    })(),
    // What they hold, what they eat, what their body is made of (Phase 15 M125).
    { id: "things", name: "Things", blocks: personThingsBlocks(world, p) },
    {
      id: "life",
      name: "Life",
      blocks: [
        {
          type: "list",
          title: "Their life",
          items: (p.life ?? []).map((l) =>
            item(
              [`Year ${l.year}, at ${l.age}: `, link(LIFE_WORDS[l.kind] ?? l.kind, l.event)],
              l.event,
              l.year,
            ),
          ),
        },
        {
          type: "list",
          title: "Where they went",
          items: p.moves.map((m) =>
            item(
              [
                "Year ",
                `${m.year}: from `,
                landLink(world, m.from, true),
                " to ",
                landLink(world, m.to, true),
              ],
              m.event,
              m.year,
            ),
          ),
        },
      ],
    },
    {
      id: "memories",
      name: "Memories",
      blocks: [
        {
          type: "list",
          title: "What they remember",
          items: (p.memories ?? []).map((m) =>
            item(
              [
                link(
                  `${sentence(MEMORY_WORDS[m.kind] ?? m.kind)}, in year ${m.year}, at ${m.age}`,
                  m.ref,
                ),
              ],
              m.ref,
              m.year,
            ),
          ),
        },
      ],
    },
    // Back to the beginning (Phase 36 M182): their town, their land, their people, their line,
    // the world.
    { id: "origins", name: "Origins", blocks: [threadBlock(world, { person: p })] },
  ];
  return {
    ref: p.ref,
    kind: "person",
    icon: p.alive ? (grown ? "🧑" : "🧒") : "🪦",
    portrait: {
      kind: "person",
      ref: p.ref,
      age,
      span: peopleBody(world)?.span ?? 70,
      occupation: p.occupation,
      child: !grown,
      era: landEra(world, p.cell),
      body: peopleBody(world),
      ...lookOf(wounds, world.now),
    },
    title: `${p.name} ${p.surname}`,
    subtitle: [
      p.alive ? `${age}, ` : fell ? `Fell at ${age}, ` : `Died at ${age}, `,
      p.village ? townLink(world, p.village) : landLink(world, p.cell, true),
    ],
    color: null,
    place:
      p.village && p.alive
        ? { scale: "village", town: p.village, person: p.ref }
        : { scale: "region", cell: p.cell },
    stats,
    tabs,
    followable: true,
    year: now,
  };
}

/** A memory: whose it is, and the event it is of. */
export function memoryPage(world: World, ref: string): PageModel {
  const [, a, b] = ref.split(":"),
    person = observer(world).persons.get(Number(a)),
    memory = person?.memories?.[Number(b)];
  if (!person || !memory) throw new Error(`no memory ${ref}`);
  return {
    ref,
    kind: "memory",
    icon: "💭",
    title: sentence(MEMORY_WORDS[memory.kind] ?? memory.kind),
    subtitle: ["Remembered by ", link(`${person.name} ${person.surname}`, person.ref)],
    color: null,
    place: person.village ? { scale: "village", town: person.village, person: person.ref } : null,
    stats: [stat("Year", `${memory.year}`), stat("Their age", `${memory.age}`)],
    tabs: [
      {
        id: "overview",
        name: "Overview",
        blocks: [
          { type: "text", lines: [[claimOf(world, ref)]] },
          {
            type: "facts",
            rows: [stat("What happened", [link(claimOf(world, memory.event), memory.event)])],
          },
          { type: "why", ref },
        ],
      },
    ],
    followable: false,
    year: yearNow(world),
  };
}

/** One of the people under the god's hand (`agent:<id>`). */
export function agentPage(world: World, ref: string): PageModel {
  const id = Number(ref.slice(ref.indexOf(":") + 1)),
    w = handOf(world).resting,
    a = w?.agents.find((x) => x.id === id);
  if (!w || !a) throw new Error(`no one under the hand is ${ref}`);
  const ctx = populationContext(world),
    year = yearOfMoment(world.now),
    town = ctx.settlements.get(w.village)!,
    deeds = (w.notables ?? []).filter((n) => n.agent === id),
    age = year - a.birthYear,
    grown = age >= lifeOf(world).adulthood,
    kin = new Map([...(w.gone ?? []), ...w.agents].map((k) => [k.id, k])),
    named = (kid: number | undefined) => {
      const k = kid === undefined ? undefined : kin.get(kid);
      if (!k) return null;
      const name = agentName(ctx, k as typeof a, town);
      return "died" in k ? [`${name} († ${k.died})`] : [link(name, `agent:${k.id}`)];
    },
    children = [...kin.values()].filter((k) => k.mother === id || k.father === id).length,
    traits = a.traits ?? [];
  return {
    ref,
    kind: "agent",
    icon: grown ? "🧑" : "🧒",
    portrait: {
      kind: "person",
      ref,
      age,
      span: peopleBody(world)?.span ?? 70,
      occupation: a.occupation,
      child: !grown,
      era: landEra(world, w.cell),
      body: peopleBody(world),
    },
    title: agentName(ctx, a, town),
    subtitle: [
      `${age}, a ${a.sex === FEMALE ? "woman" : "man"}, under your hand in `,
      townLink(world, w.village),
    ],
    color: null,
    place: { scale: "village", town: w.village, person: ref },
    stats: [
      stat("Age", `${age}`),
      stat("Work", grown ? (OCCUPATION_WORDS[a.occupation] ?? "") : "a child"),
      stat("Children", `${children}`),
      ...(traits.length ? [stat("Traits", traits.map((t) => TRAIT_LOOK[t].icon).join(" "))] : []),
      ...(a.blessedUntil !== undefined && a.blessedUntil > year
        ? [stat("Blessed", `until year ${a.blessedUntil}`)]
        : []),
    ],
    tabs: [
      {
        id: "overview",
        name: "Overview",
        blocks: [
          ...(traits.length ? [traitChips(traits)] : []),
          {
            type: "facts",
            rows: [
              stat("Born", `year ${a.birthYear}`),
              stat("Who", `a ${a.sex === FEMALE ? "woman" : "man"} of ${town.name}`),
              ...(named(a.mother) ? [stat("Mother", named(a.mother)!)] : []),
              ...(named(a.father) ? [stat("Father", named(a.father)!)] : []),
              ...(named(a.partner) ? [stat("Partner", named(a.partner)!)] : []),
            ],
          },
          {
            type: "list",
            title: "Remembered for",
            items: deeds.map((n) => item([link(claimOf(world, n.deed), n.deed)], n.deed)),
          },
          { type: "tool", tool: "acts.agent", args: { id } },
        ],
      },
      // Their family as a tree (Phase 14 M118): parents and grandparents, partner, children
      // and grandchildren, those gone among them.
      { id: "family", name: "Family", blocks: agentFamily(world, w, a) },
      // What they hold, eat and are made of (Phase 15 M125), as the people met.
      { id: "things", name: "Things", blocks: personThingsBlocks(world, agentHolder(w, a)) },
      // Back to the beginning (Phase 36 M182), as the people met.
      {
        id: "origins",
        name: "Origins",
        blocks: [
          threadBlock(world, {
            life: {
              ref,
              name: agentName(ctx, a, town),
              alive: true,
              born: a.birthYear,
              beforeChronicle: a.birthYear < 0,
              cell: w.cell,
              home: w.cell,
              town: w.village,
              parents: [named(a.mother), named(a.father)].filter((n) => n !== null),
            },
          }),
        ],
      },
    ],
    // (Followed while the hand rests, Phase 54: their children, the god's touches, their death.)
    followable: true,
    year,
  };
}

export { realmLink, cellRef };
