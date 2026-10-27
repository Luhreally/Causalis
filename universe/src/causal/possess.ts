// The god's hand made flesh in words (Phase 60): the god walked among them in one of their
// bodies, what was made by his hands, those struck down by the god in another's body, goods
// taken, a word heard, and the letting go — the chronicle's lines and their pages'.
import { yearOfMoment, type Ref } from "../kernel/index.ts";
import { FEMALE, GOODS, anatomyOf, type Member } from "../rules/index.ts";
import { POSSESS_EVENTS, agentById, agentName, handOf, populationContext } from "../sim/index.ts";
import { registerCommandWords, registerEventWords } from "./why.ts";

type World = Parameters<Parameters<typeof registerEventWords>[1]>[0];

/** A name without its town ("Teadryn of Sairis": "Teadryn"). */
const first = (name: unknown): string =>
  typeof name === "string" && name ? name.replace(/ of .*$/, "") : "one of their people";
const town = (world: World, ref: unknown): string =>
  (typeof ref === "string" && populationContext(world).settlements.get(ref as Ref)?.name) ||
  "their town";
const many = (n: number, one: string): string =>
  n === 1
    ? `${/^[aeiou]/.test(one) ? "an" : "a"} ${one}`
    : `${n} ${one.endsWith("s") || one.endsWith("sh") ? `${one}es` : one === "cloth" ? "lengths of cloth" : `${one}s`}`;

registerEventWords(POSSESS_EVENTS.possessed.type, (world, e) => {
  const d = e.data as { name?: string; town?: string; trade?: string } | null;
  return `By your hand: you walked among the people of ${d?.town ?? town(world, e.subjects[0])} as ${first(d?.name)}${d?.trade ? ` the ${d.trade}` : ""}, year ${yearOfMoment(e.t)}`;
});

registerEventWords(POSSESS_EVENTS.released.type, (_, e) => {
  const d = e.data as {
      name?: string;
      seconds?: number;
      made?: number;
      struck?: number;
      took?: number;
      spoke?: number;
      ended?: string;
    } | null,
    done = [
      d?.made ? `${d.made} made by hand` : "",
      d?.struck ? `${d.struck} struck down` : "",
      d?.took ? `${d.took} taken` : "",
      d?.spoke ? `${d.spoke} spoken to` : "",
    ].filter(Boolean),
    why =
      d?.ended === "down"
        ? ": struck down, and your hand let go of him"
        : d?.ended === "died"
          ? ": dead of his years in your hand"
          : "";
  return `You let go of ${first(d?.name)}${why}, year ${yearOfMoment(e.t)}${done.length ? ` (${done.join(", ")})` : ""}`;
});

registerEventWords(POSSESS_EVENTS.made.type, (world, e) => {
  const d = e.data as { name?: string; things?: { form: string; n: number }[] } | null,
    things = (d?.things ?? []).map((x) => many(x.n, x.form));
  return `By your hand: ${first(d?.name)} made ${things.join(" and ") || "a thing"} in ${town(world, e.subjects[0])}, the town's, year ${yearOfMoment(e.t)}`;
});

/** Where a blow landed, in the struck body's own words ("her left arm"). */
function partWords(world: World, place: unknown, sex: unknown): string {
  const words =
    anatomyOf(populationContext(world).generated.life.people?.body ?? null).words[
      place as Member
    ] ?? "~ body";
  return words.replace("~", sex === FEMALE ? "her" : "his");
}

registerEventWords(POSSESS_EVENTS.struck.type, (world, e) => {
  const d = e.data as {
      name?: string;
      byName?: string;
      god?: boolean;
      hand?: string;
      dead?: boolean;
      place?: string;
      sex?: number;
      maimed?: boolean;
      arm?: string | null;
    } | null,
    what = d?.dead
      ? "killed"
      : `wounded in ${partWords(world, d?.place, d?.sex)}${d?.maimed ? ", maimed" : ""}`,
    arm = d?.arm ? ` with ${many(1, d.arm)}` : "";
  return d?.god
    ? `By your hand: ${d.name ?? "one of their people"} struck down by the god in ${first(d.hand)}'s body${arm}: ${what}, year ${yearOfMoment(e.t)}`
    : `By your hand: ${first(d?.hand)}, in whom the god walked, struck down by ${d?.byName ?? "one of the town"}${arm}: ${what}, year ${yearOfMoment(e.t)}`;
});

registerEventWords(POSSESS_EVENTS.took.type, (world, e) => {
  const d = e.data as {
      name?: string;
      goods?: { good: number; from: string }[];
      seen?: number;
    } | null,
    goods = (d?.goods ?? []).map(
      (g) =>
        `${GOODS[g.good]?.name ?? "goods"} from the ${g.from === "shop" ? "workshop" : g.from}`,
    );
  return `By your hand: ${first(d?.name)} took ${goods.join(" and ") || "goods"} in ${town(world, e.subjects[0])}${d?.seen ? `, seen by ${d.seen}` : ", unseen"}, year ${yearOfMoment(e.t)}`;
});

registerEventWords(POSSESS_EVENTS.spoke.type, (_, e) => {
  const d = e.data as { name?: string; hand?: string; mood?: number } | null;
  return `By your hand: the god spoke to ${d?.name ?? "one of their people"} in ${first(d?.hand)}'s body, and ${(d?.mood ?? 0) > 0 ? "they were heartened" : "they turned away"}, year ${yearOfMoment(e.t)}`;
});

/** The one under the hand a command names, by name. */
function agentWords(world: World, id: unknown): string {
  const w = handOf(world).resting,
    a = w && Number.isInteger(id) ? agentById(w, id as number) : undefined,
    ctx = populationContext(world),
    v = w ? ctx.settlements.get(w.village) : undefined;
  return a && v ? first(agentName(ctx, a, v)) : "one of the people under your hand";
}
registerCommandWords(
  "possess.take",
  (world, c) =>
    `Your act: you took the body of ${agentWords(world, (c.args as { agent?: number }).agent)}, year ${yearOfMoment(c.t)}`,
);
registerCommandWords(
  "possess.input",
  (_, c) => `Your hand moved the body it held a second on, year ${yearOfMoment(c.t)}`,
);
registerCommandWords(
  "possess.release",
  (_, c) => `Your act: you let go of the body you held, year ${yearOfMoment(c.t)}`,
);
