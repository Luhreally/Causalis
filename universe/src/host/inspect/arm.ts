// A trooper's arm in a battle (Phase 53): the arm a trooper of a host bore on the day of a battle, as
// its realm's design armed it then — what it is made of and where that came from, who made it and how
// good it is, and for a firearm what it fires and how far it carries true. Traced from the ground by
// the chain (host/chain.ts). And one man's (Phase 55 M228, asked for 2026-10-25: "every made thing at
// every age made by someone"): the arm a man of the battle's roll bore, made at one of his seat's
// benches by its maker then — his own smith, not his realm's. Pure reads of the world as it stands:
// looking at an arm changes nothing.
import { hashString, type Ref, type World } from "../../kernel/index.ts";
import { firearm, type Part } from "../../rules/index.ts";
import { hostFor, politiesOf, populationContext, warsOf, type Battle } from "../../sim/index.ts";
import { observer } from "../../causal/index.ts";
import {
  parseLevyManRef,
  parseTownsfolkRef,
  type ArmBorne,
  type Block,
  type Line,
  type PageModel,
  type Stat,
} from "../../bridge/index.ts";
import { hostDesign } from "../arms.ts";
import { armsMade, hostPartWords, makerWords, type Made } from "../chain.ts";
import { madeHowOf, thingPortrait } from "../looks.ts";
import { resolveLevyMan } from "../roll.ts";
import { townRoster } from "../roster.ts";
import { landTitle, realmLink } from "./names.ts";
import { count, item, link, sentence, stat, yearNow } from "./words.ts";

/** The arms that are set on a wooden haft, shaft or stock (a club or a bow is the wood itself). */
const HAFTED: ReadonlySet<string> = new Set([
  "spear",
  "axe",
  "sword",
  "musket",
  "rifle",
  "repeater",
  "autoloader",
  "automatic",
]);
/** The colour of a wooden haft. */
const WOOD = [0.5, 0.36, 0.22] as const;

/** The bench an arm's maker works at: the knapping stone, the anvil, or the machines of a works. */
function benchOf(arm: Part, made: Made): string {
  if (arm.material === "stone") return "knapping stone";
  return arm.material === "machined" || made.workshop.name.startsWith("the factory")
    ? "machines"
    : "anvil";
}

/** A side's arm in a battle: the battle, its realm, the arm its design bore that day (null: none). */
function armOf(
  world: World,
  event: string,
  side: number,
): { readonly b: Battle; readonly realm: string; readonly arm: Part } | null {
  const war = warsOf(world)
      .all()
      .find((w) => w.battles.some((b) => b.event === event)),
    b = war?.battles.find((x) => x.event === event);
  if (!war || !b || (side !== 0 && side !== 1)) return null;
  const realm = side === 0 ? war.attacker : war.defender,
    r = politiesOf(world).get(realm),
    host =
      hostDesign(world, realm, { year: b.year, design: b.designs?.[side] })?.parts ??
      (r && r.ended === null ? hostFor(populationContext(world), r).parts : undefined),
    arm = host?.find((x) => x.role === "arm");
  return arm ? { b, realm, arm } : null;
}

/** One of an arm's kind, said of the one who bore it: "chert-tipped spears", "a chert-tipped spear". */
export function oneArm(words: string): string {
  const one = words
    .replace(/\b(spear|sword|club|bow|musket|rifle|gun)s\b/, "$1")
    .replace(/\baxes\b/, "axe");
  return one === words ? words : `${/^[aeiou]/i.test(one) ? "an" : "a"} ${one}`;
}

/** A man of a battle's roll by his page (a town's line holder, one of the levy, one met): his name (null: none such). */
function nameOfWho(world: World, who: string): string | null {
  const folk = parseTownsfolkRef(who);
  if (folk) {
    if (folk.n === null) return null;
    const roster = townRoster(world, folk.town),
      h = roster.holderOf(folk.line, folk.n);
    return h ? roster.nameOf(h) : null;
  }
  if (parseLevyManRef(who)) return resolveLevyMan(world, who)?.name ?? null;
  const p = observer(world).person(who as Ref);
  return p ? `${p.name} ${p.surname}` : null;
}

/** The page of the arm a man bore in a battle: `arms:<battle>:<side>:<his page>`. */
export function armsRef(event: string, side: 0 | 1, who: string): string {
  return `arms:${event}:${side}:${who}`;
}

/** What one man bore in a battle and who made it (his seat's maker of his own: Phase 55 M228; null: no such battle or arm). */
export function armBorne(world: World, event: string, side: 0 | 1, who: string): ArmBorne | null {
  const a = armOf(world, event, side);
  if (!a) return null;
  const made = armsMade(world, a.realm, a.arm, a.b.year, who),
    m = made?.maker,
    town = m?.town ? populationContext(world).settlements.get(m.town as Ref) : undefined;
  return {
    words: oneArm(hostPartWords(world, a.realm, a.arm)),
    maker: m
      ? `${m.name}, ${/^[aeiou]/i.test(m.trade) ? "an" : "a"} ${m.trade}${town ? ` of ${town.name}` : ""}`
      : null,
    at: made?.workshop.name ?? null,
    grade: made?.grade ?? null,
    page: armsRef(event, side, who),
  };
}

/**
 * What a man bore in a battle, for his page (Phase 55 M228): the arm, linked to its own page, and
 * where its stuff came from to his hand (null: no such battle or arm).
 */
export function armsBlock(world: World, event: string, side: 0 | 1, who: string): Block | null {
  const a = armOf(world, event, side);
  if (!a) return null;
  const made = armsMade(world, a.realm, a.arm, a.b.year, who);
  return {
    type: "list",
    title: "What he bore",
    items: [
      item(
        [
          link(sentence(oneArm(hostPartWords(world, a.realm, a.arm))), armsRef(event, side, who)),
          ` at the battle at ${landTitle(world, a.b.land, true)}, year ${a.b.year}`,
        ],
        armsRef(event, side, who),
      ),
      ...(made ? made.chain.map((l) => item(l)) : []),
    ],
  };
}

/** An arm's page: of a side's host that day (\`who\` null), or of the one man who bore it. */
function armModel(
  world: World,
  ref: string,
  event: string,
  side: number,
  who: string | null,
): PageModel {
  const a = armOf(world, event, side);
  if (!a) throw new Error(`no arm ${ref}`);
  const { b, realm, arm } = a,
    name = who === null ? null : nameOfWho(world, who);
  if (who !== null && name === null) throw new Error(`no arm ${ref}`);
  const made = armsMade(world, realm, arm, b.year, who ?? undefined),
    gun = firearm(arm.id),
    chain: Line[] = made
      ? [...made.chain]
      : [
          [
            "The arm is the body's own, or of what the land gives unworked: nothing is smelted or knapped for it.",
          ],
        ],
    stats: Stat[] = made
      ? [
          stat(
            "Made at",
            made.workshop.ref ? [link(made.workshop.name, made.workshop.ref)] : made.workshop.name,
          ),
          stat(
            "Made by",
            made.maker ? makerWords(world, made.maker, benchOf(arm, made)) : "at home",
          ),
          stat("Quality", `${made.grade} (${made.quality} of 100)`),
          ...(gun
            ? [
                stat(
                  "Fires",
                  `${count(gun.rate)} aimed rounds a minute, true to ${count(gun.range)} m`,
                ),
              ]
            : []),
        ]
      : [];
  // Its picture (Phase 54 M223): drawn as its stuff was made, fresh; a body's own arm is no thing made.
  const portrait =
    arm.material === "body"
      ? undefined
      : thingPortrait({
          form: arm.id,
          made: madeHowOf(made?.stuff ?? arm.material, "arms", arm.material),
          color: made?.colour ?? [0.55, 0.55, 0.58],
          haft: HAFTED.has(arm.id) ? WOOD : null,
          quality: made?.quality ?? 50,
          worn: 0,
          key: hashString(ref),
        });
  const words = hostPartWords(world, realm, arm),
    where = landTitle(world, b.land, true);
  return {
    ref,
    kind: "thing",
    icon: gun ? "🔫" : "⚔️",
    title:
      who === null
        ? `${sentence(words)} in the battle at ${where}`
        : `${name}'s ${oneArm(words).replace(/^an? /, "")}`,
    subtitle:
      who === null
        ? [realmLink(world, realm), `, year ${b.year}`]
        : [
            link(name!, who),
            ", in the host of ",
            realmLink(world, realm),
            `, at the battle at ${where}, year ${b.year}`,
          ],
    color: null,
    ...(portrait ? { portrait } : {}),
    place: { scale: "region", cell: b.land },
    stats,
    tabs: [
      {
        id: "overview",
        name: "Overview",
        blocks: [
          {
            type: "list",
            title: who === null ? "From the ground to the hand" : "From the ground to his hand",
            items: chain.map((l) => item(l)),
          },
          {
            type: "text",
            lines: [
              who === null
                ? ["Carried in ", link("the battle", b.event), "."]
                : ["Borne by ", link(name!, who), " in ", link("the battle", b.event), "."],
            ],
          },
        ],
      },
    ],
    followable: false,
    year: yearNow(world),
  };
}

/**
 * The page of a trooper's arm in a battle, `arm:<battle>:<side>:<trooper>` (side 0 the attacker, 1
 * the defender): the arm its realm's host bore that day, as the design the battle fought by armed it
 * (else as the realm had it then), traced from the ground.
 */
export function armPage(world: World, ref: string): PageModel {
  const parts = ref.slice("arm:".length).split(":"),
    trooper = Number(parts.pop()),
    side = Number(parts.pop()),
    event = parts.join(":");
  if (!Number.isInteger(trooper) || trooper < 0) throw new Error(`no arm ${ref}`);
  return armModel(world, ref, event, side, null);
}

/**
 * The page of the arm one man bore in a battle, `arms:<battle>:<side>:<his page>` (Phase 55 M228): as
 * his host's, made at one of his seat's benches by its maker then, traced from the ground to his hand.
 */
export function armsPage(world: World, ref: string): PageModel {
  const m = /^arms:([a-z]{2,5}:\d+:\d+):([01]):(.+)$/.exec(ref);
  if (!m) throw new Error(`no arm ${ref}`);
  return armModel(world, ref, m[1]!, Number(m[2]), m[3]!);
}
