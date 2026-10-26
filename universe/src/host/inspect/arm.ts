// A trooper's arm in a battle (Phase 53): the arm a trooper of a host bore on the day of a battle, as
// its realm's design armed it then — what it is made of and where that came from, who made it and how
// good it is, and for a firearm what it fires and how far it carries true. Traced from the ground by
// the chain (host/chain.ts). Pure reads of the world as it stands: looking at an arm changes nothing.
import { hashString, type World } from "../../kernel/index.ts";
import { firearm, type Part } from "../../rules/index.ts";
import { hostFor, politiesOf, populationContext, warsOf } from "../../sim/index.ts";
import type { Line, PageModel, Stat } from "../../bridge/index.ts";
import { hostDesign } from "../arms.ts";
import { armsMade, hostPartWords, makerWords, type Made } from "../chain.ts";
import { madeHowOf, thingPortrait } from "../looks.ts";
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

/**
 * The page of a trooper's arm in a battle, `arm:<battle>:<side>:<trooper>` (side 0 the attacker, 1
 * the defender): the arm its realm's host bore that day, as the design the battle fought by armed it
 * (else as the realm had it then), traced from the ground.
 */
export function armPage(world: World, ref: string): PageModel {
  const parts = ref.slice("arm:".length).split(":"),
    trooper = Number(parts.pop()),
    side = Number(parts.pop()),
    event = parts.join(":"),
    war = warsOf(world)
      .all()
      .find((w) => w.battles.some((b) => b.event === event)),
    b = war?.battles.find((x) => x.event === event);
  if (!war || !b || (side !== 0 && side !== 1) || !Number.isInteger(trooper) || trooper < 0)
    throw new Error(`no arm ${ref}`);
  const realm = side === 0 ? war.attacker : war.defender,
    ctx = populationContext(world),
    r = politiesOf(world).get(realm),
    host =
      hostDesign(world, realm, { year: b.year, design: b.designs?.[side] })?.parts ??
      (r && r.ended === null ? hostFor(ctx, r).parts : undefined),
    arm = host?.find((x) => x.role === "arm");
  if (!arm) throw new Error(`no arm ${ref}`);
  const made = armsMade(world, realm, arm, b.year),
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
  return {
    ref,
    kind: "thing",
    icon: gun ? "🔫" : "⚔️",
    title: `${sentence(hostPartWords(world, realm, arm))} in the battle at ${landTitle(world, b.land, true)}`,
    subtitle: [realmLink(world, realm), `, year ${b.year}`],
    color: null,
    ...(portrait ? { portrait } : {}),
    place: { scale: "region", cell: b.land },
    stats,
    tabs: [
      {
        id: "overview",
        name: "Overview",
        blocks: [
          { type: "list", title: "From the ground to the hand", items: chain.map((l) => item(l)) },
          { type: "text", lines: [["Carried in ", link("the battle", b.event), "."]] },
        ],
      },
    ],
    followable: false,
    year: yearNow(world),
  };
}
