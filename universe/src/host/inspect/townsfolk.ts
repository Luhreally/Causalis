// The pages of a town's many and of a battle's levy (Phase 55 M225): one of a town's people kept by
// their line (`folk:<town>:<line>:<n>`: the holder of the line, or who held it, their work, the battles
// they went to, how they fell and where they lie), and one of the men a battle's roll names from his
// ref alone (`lv:<battle>:<side>:<j>`). Read from the roster and the battle's record, never drawn, so
// looking moves nothing; a line that stands empty or the town never had, a number that holds no one,
// or a levy man out of his battle's places gives the router's unknown page, since these throw.
import type { Ref, World } from "../../kernel/index.ts";
import { parseTownsfolkRef, type Block, type PageModel, type Stat } from "../../bridge/index.ts";
import { OCC } from "../../rules/index.ts";
import { lifeOf, populationContext } from "../../sim/index.ts";
import { landEra, peopleBody } from "../village.ts";
import { battleWords, burialWords } from "../burials.ts";
import { LINE, folkWork, townRoster, workOf, type Fate } from "../roster.ts";
import { resolveLevyMan } from "../roll.ts";
import { holderWounds } from "../wounds.ts";
import { armsBlock } from "./arm.ts";
import { foughtFate } from "../held.ts";
import { item, link, sentence, stat, yearNow } from "./words.ts";
import { landLink, realmLink, townLink } from "./names.ts";
import { lookOf, woundBlock } from "./wounds.ts";

/** How a man came home from a battle he went to, said before its name (as the veterans' page does). */
const WAR_WORDS: Readonly<Record<Fate, string>> = {
  stood: "Fought at ",
  hurt: "Wounded at ",
  maimed: "Maimed at ",
  fell: "Fell at ",
};
const OCCUPATION_WORDS = ["child", "forager", "farmer", "herder", "crafter", "trader", "leader"];

/** One of a town's many, by their line's ref: the holder now, or the one who held it (n null). */
export function townsfolkPage(world: World, ref: string): PageModel {
  const parsed = parseTownsfolkRef(ref),
    s = parsed ? populationContext(world).settlements.get(parsed.town as Ref) : undefined;
  if (!parsed || !s) throw new Error(`no town of the many in ${ref}`);
  const roster = townRoster(world, s.ref),
    // (The most lines the town had in the roster's years, or has now: one past them is no one's.)
    had = Math.max(
      Math.ceil(s.population / LINE),
      ...roster.battles.map((b) => b.lines),
      ...roster.strikes.map((x) => x.lines),
    ),
    h =
      parsed.line >= had
        ? null
        : parsed.n === null
          ? roster.holder(parsed.line)
          : roster.holderOf(parsed.line, parsed.n);
  if (!h) throw new Error(`no one of the town's many is ${ref}`);
  const now = yearNow(world),
    holds = roster.holder(h.line)?.n === h.n,
    fell = h.fates.find((f) => f.fate === "fell"),
    died = h.struck.find((f) => f.fate === "died"),
    age = (holds ? now : (h.died ?? Math.min(now, h.end - 1))) - h.born,
    child = age < lifeOf(world).adulthood,
    occupation = child ? OCC.dependent : workOf(h.key, folkWork(world, s.cell)),
    // (The wounds they came home with, or a strike dealt them: Phase 55 M226.)
    wounds = holderWounds(world, s.ref, h),
    told = woundBlock(wounds, h.sex, world.now);

  const rows: Stat[] = [
    stat("Born", `year ${h.born}`),
    stat(holds ? "Lives in" : "Lived in", [
      townLink(world, s.ref),
      ", ",
      landLink(world, s.cell, true),
    ]),
    stat("Who", `a ${h.sex ? "man" : "woman"} of ${s.name}, one of its many`),
  ];
  if (fell)
    rows.push(
      stat(
        "Fate",
        ["Fell at ", link(battleWords(world, fell.land), fell.event), ` in year ${fell.year}`],
        { why: fell.event },
      ),
      stat("Grave", sentence(burialWords(world, fell.land, s.cell, s.name))),
    );
  if (died)
    rows.push(
      stat(
        "Fate",
        [
          "Died in ",
          link(`the ${died.kind === "meteor" ? "fire from the sky" : died.kind}`, died.event),
          ` of year ${died.year}`,
        ],
        { why: died.event },
      ),
    );
  if (!fell && !died && !holds) rows.push(stat("Now", "no longer among the town's people"));

  const blocks: Block[] = [{ type: "facts", rows }];
  if (h.fates.length)
    blocks.push({
      type: "list",
      title: "Their battles",
      items: h.fates.map((f) =>
        item(
          [WAR_WORDS[f.fate], link(battleWords(world, f.land), f.event), `, year ${f.year}`],
          f.event,
          f.year,
        ),
      ),
    });
  if (told) blocks.push(told);
  // What he bore at the battle he fell at, else his last (Phase 55 M228), from the ground to his hand.
  const bore = fell ?? h.fates.at(-1),
    arms = bore ? armsBlock(world, bore.event, bore.side, h.ref) : null;
  if (arms) blocks.push(arms);
  blocks.push({
    type: "text",
    lines: [
      [
        "One of the town's many, kept by their line: one of every twelve of its people, named in its tongue. History counts the men each town sends to war, its fallen and its wounded, and keeps them by name; it does not follow their days.",
      ],
    ],
  });

  return {
    ref: h.ref,
    kind: "person",
    icon: holds ? (child ? "🧒" : "🧑") : "🪦",
    portrait: {
      kind: "person",
      ref: h.ref,
      age,
      span: peopleBody(world)?.span ?? 70,
      occupation,
      child,
      era: landEra(world, s.cell),
      body: peopleBody(world),
      ...lookOf(wounds, world.now),
    },
    title: roster.nameOf(h),
    subtitle: [holds ? `${age}, ` : fell ? `Fell at ${age}, ` : `${age}, `, townLink(world, s.ref)],
    color: null,
    place: holds
      ? { scale: "village", town: s.ref, person: h.ref }
      : { scale: "region", cell: s.cell },
    stats: [
      stat("Age", `${age}`),
      stat("Work", child ? "a child" : (OCCUPATION_WORDS[occupation] ?? "")),
      stat("Home", [townLink(world, s.ref)]),
    ],
    tabs: [{ id: "overview", name: "Overview", blocks }],
    followable: false,
    year: now,
  };
}

/** One of a battle's levy, named for the roll alone, from his ref (`lv:<battle>:<side>:<j>`). */
export function levyManPage(world: World, ref: string): PageModel {
  const man = resolveLevyMan(world, ref);
  if (!man) throw new Error(`no one of a battle's levy is ${ref}`);
  // (In a battle the god fought, as his fight left this man: Phase 61.)
  const hand = foughtFate(world, man.event, ref),
    fate = hand?.fate ?? man.fate;
  const from = man.place,
    // (What he bore there, from the ground to his hand: Phase 55 M228.)
    arms = armsBlock(world, man.event, man.side, ref);
  return {
    ref,
    kind: "person",
    icon: fate === "fell" ? "🪦" : "🧑",
    title: man.name,
    subtitle: [
      `${man.age}, of `,
      from?.ref ? townLink(world, from.ref) : (from?.name ?? "the host"),
      ", in the host of ",
      realmLink(world, man.realm),
    ],
    color: null,
    place: { scale: "region", cell: man.land },
    stats: [],
    tabs: [
      {
        id: "overview",
        name: "Overview",
        blocks: [
          {
            type: "facts",
            rows: [
              stat(
                "Fate",
                [
                  WAR_WORDS[fate],
                  link(battleWords(world, man.land), man.event),
                  ` in year ${man.year}`,
                ],
                { why: man.event },
              ),
              stat(
                "From",
                from?.ref
                  ? [townLink(world, from.ref)]
                  : [from?.name ?? "a place the record does not tell"],
              ),
              stat("Host", [realmLink(world, man.realm)]),
              ...(hand ? [stat("By your hand", [hand.words], { why: hand.event })] : []),
            ],
          },
          ...(arms ? [arms] : []),
          {
            type: "text",
            lines: [
              [
                "One of the levy, named for the battle's roll: history counts the men each place sent and its fallen, not who they were.",
              ],
            ],
          },
        ],
      },
    ],
    followable: false,
    year: yearNow(world),
  };
}
