// A town asked, in words (H1): what is asked, by what name its people have for it, and the lines that keep it in the record.
import { yearOfMoment, type World } from "../kernel/index.ts";
import { civic, type CivicKind } from "../rules/index.ts";
import { ASK_EVENTS, populationContext, type AskAnswer } from "../sim/index.ts";
import { registerCommandWords, registerEventWords } from "./why.ts";

/** What a people of the water call the things they raise, and a hive. Whatever else is called as anyone calls it. */
const WATER_NAMES: Readonly<Record<string, string>> = {
  shrine: "a shell shrine",
  granary: "a kelp store",
  market: "a trading ledge",
  school: "a shoal school",
  temple: "a great shell hall",
  hall: "a speaking hollow",
  walls: "a reef wall",
  mill: "a current wheel",
  docks: "a landing",
};
const HIVE_NAMES: Readonly<Record<string, string>> = {
  shrine: "a still chamber",
  granary: "a brood store",
  market: "a sharing floor",
  school: "a rearing cell",
  temple: "a great still chamber",
  hall: "a chamber of the word",
  walls: "a rampart of chewed rock",
  hospital: "a mending chamber",
};

/** Who they are, for a thing's name. */
function folkOf(world: World): "water" | "hive" | null {
  const body = populationContext(world).generated.life.people?.body;
  if (body?.medium === "water") return "water";
  return (body?.social ?? 0) >= 0.9 && (body?.size ?? 100) < 100 ? "hive" : null;
}

/** What a thing asked for is called among them: "a granary", "a kelp store". */
export function raiseName(world: World, what: string): string {
  const folk = folkOf(world),
    own = folk === "water" ? WATER_NAMES[what] : folk === "hive" ? HIVE_NAMES[what] : undefined;
  if (own) return own;
  return what === "walls" ? "a ring of walls" : civic(what as CivicKind).name;
}

/** The same, the thing itself: "the granary". */
export function raiseThe(world: World, what: string): string {
  const name = raiseName(world, what);
  return /^(a|an) /.test(name) ? name.replace(/^(a|an) /, "the ") : `the ${name}`;
}

/** What they were asked to put first, in a sentence's middle. */
export function firstWords(world: World, what: string): string {
  const folk = folkOf(world);
  switch (what) {
    case "food":
      return folk === "water" ? "its pens and its beds" : "food";
    case "stores":
      return "its stores";
    case "homes":
      return folk === "water" ? "its dens" : folk === "hive" ? "its cells" : "its homes";
    case "walls":
      return folk === "water" ? "its reef wall" : "its walls";
    case "arms":
      return "its arms";
    case "trade":
      return "its trade";
    case "faith":
      return "its faith";
    default:
      return "its learning";
  }
}

/** How it was taken up, in a word for a list. */
export const ANSWER_WORD: Readonly<Record<AskAnswer, string>> = {
  glad: "taken up gladly",
  grudged: "grudged",
  half: "done by half",
  refused: "refused",
};

const asked = (e: { readonly data: unknown }) =>
  e.data as {
    name?: string;
    kind?: string;
    what?: string;
    answer?: AskAnswer;
    ruler?: string;
    why?: string;
  } | null;

const whoAsked = (ruler: string | undefined) =>
  ruler ? `By the word of ${ruler}` : "By your word";

registerEventWords(ASK_EVENTS.asked.type, (world, e) => {
  const d = asked(e),
    thing =
      d?.kind === "first"
        ? `to put ${firstWords(world, d?.what ?? "")} first`
        : `to raise ${raiseName(world, d?.what ?? "shrine")}`;
  return `${whoAsked(d?.ruler)}: ${d?.name ?? "a town"} was asked ${thing}, and it was ${ANSWER_WORD[d?.answer ?? "half"]}, year ${yearOfMoment(e.t)}`;
});
registerEventWords(ASK_EVENTS.raised.type, (world, e) => {
  const d = asked(e);
  return `${whoAsked(d?.ruler)}: ${d?.name ?? "a town"} raised ${raiseName(world, d?.what ?? "shrine")}, as it was asked, year ${yearOfMoment(e.t)}`;
});
registerEventWords(ASK_EVENTS.left.type, (world, e) => {
  const d = asked(e);
  return `${d?.name ?? "A town"} gave up on ${raiseThe(world, d?.what ?? "shrine")} it was asked for, year ${yearOfMoment(e.t)}`;
});
registerCommandWords("town.ask", (world, c) => {
  const a = c.args as { kind?: string; what?: string; by?: { ruler: string } },
    thing =
      a.kind === "first"
        ? `to put ${firstWords(world, a.what ?? "")} first`
        : `to raise ${raiseName(world, a.what ?? "shrine")}`;
  return `Your act: ${a.by ? `as ${a.by.ruler} you` : "you"} asked a town ${thing}, year ${yearOfMoment(c.t)}`;
});
