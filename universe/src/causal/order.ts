// Bonds and freedoms in words (Phase 19 M137): captives carried off, the hungry sold into
// debt, farmers bound to the land, newcomers bound for their passage, the condemned at labour,
// the people called to the seat's works; the bound fleeing and rising, freed or crushed;
// movements among a realm's people, a realm's crisis of standing, and its law freeing the bound.
import { yearOfMoment } from "../kernel/index.ts";
import { ORDER_ACTS, ORDER_EVENTS, politiesOf, realmName } from "../sim/index.ts";
import { landWords } from "./generated.ts";
import { count } from "./words.ts";
import { registerDecisionWords, registerEventWords } from "./why.ts";
import type { World } from "../kernel/index.ts";

type Data = {
  realm?: string;
  count?: number;
  dead?: number;
  share?: number;
  cause?: string;
  seat?: boolean;
} | null;

const realm = (d: unknown) => (d as Data)?.realm ?? "a realm",
  n = (d: unknown, k: "count" | "dead" | "share") => (d as Data)?.[k] ?? 0,
  year = (t: number) => `year ${yearOfMoment(t)}`,
  cap = (s: string) => (s ? s[0]!.toUpperCase() + s.slice(1) : s),
  people = (k: number) => `${count(k)} ${k === 1 ? "person" : "people"}`;

registerEventWords(
  ORDER_EVENTS.captives.type,
  (world, e) =>
    `${cap(realm(e.data))} carried off ${people(n(e.data, "count"))} of ${landWords(world, e.place)} into bondage, ${year(e.t)}`,
);
registerEventWords(
  ORDER_EVENTS.bondage.type,
  (world, e) =>
    `In the hungry years ${people(n(e.data, "count"))} of ${landWords(world, e.place)} sold themselves into debt bondage, ${year(e.t)}`,
);
registerEventWords(
  ORDER_EVENTS.serfdom.type,
  (_, e) =>
    `The farmers of ${realm(e.data)} were bound to the land: ${n(e.data, "share")} in a hundred of its people serfs, ${year(e.t)}`,
);
registerEventWords(
  ORDER_EVENTS.indenture.type,
  (world, e) =>
    `${cap(people(n(e.data, "count")))} who came hungry to ${landWords(world, e.place)} were bound for seven years for their passage, ${year(e.t)}`,
);
registerEventWords(
  ORDER_EVENTS.convicts.type,
  (_, e) => `${cap(realm(e.data))} set its condemned to labour, ${year(e.t)}`,
);
registerEventWords(
  ORDER_EVENTS.corvee.type,
  (_, e) =>
    `${cap(realm(e.data))} called its people to labour on its works, ${n(e.data, "share")} days in a hundred, ${year(e.t)}`,
);
registerEventWords(
  ORDER_EVENTS.flight.type,
  (world, e) =>
    `${cap(people(n(e.data, "count")))} fled their bonds in ${landWords(world, e.place)}, ${year(e.t)}`,
);
registerEventWords(
  ORDER_EVENTS.revolt.type,
  (world, e) =>
    `The bound of ${landWords(world, e.place)} rose against ${realm(e.data)}, ${people(n(e.data, "count"))}, ${year(e.t)}`,
);
registerEventWords(ORDER_EVENTS.freed.type, (world, e) =>
  (e.data as Data)?.seat
    ? `The bound of ${landWords(world, e.place)} overthrew the court of ${realm(e.data)} and freed all its bound, ${year(e.t)}`
    : `The bound of ${landWords(world, e.place)} broke their chains and broke away from ${realm(e.data)}, ${year(e.t)}`,
);
registerEventWords(
  ORDER_EVENTS.crushed.type,
  (world, e) =>
    `The rising in ${landWords(world, e.place)} was crushed by ${realm(e.data)}: ${people(n(e.data, "dead"))} died, ${year(e.t)}`,
);
registerEventWords(ORDER_EVENTS.movement.type, (_, e) => {
  const cause = (e.data as Data)?.cause;
  return `A movement ${cause === "abolition" ? "to free the bound" : cause === "land" ? "to give the land to those who till it" : "to give the many a voice"} arose in ${realm(e.data)}, ${year(e.t)}`;
});
registerEventWords(
  ORDER_EVENTS.abolished.type,
  (_, e) =>
    `${cap(realm(e.data))} outlawed bondage: ${people(n(e.data, "count"))} freed (all but the condemned), ${year(e.t)}`,
);
registerEventWords(
  ORDER_EVENTS.crisis.type,
  (_, e) => `${cap(realm(e.data))} lost its people's faith in its rule, ${year(e.t)}`,
);

// The god's hand on bonds and freedoms (M138).
registerEventWords(
  ORDER_ACTS.unchain.type,
  (_, e) =>
    `The god broke the chains of ${people(n(e.data, "count"))} held in ${realm(e.data)}, ${year(e.t)}`,
);
registerEventWords(
  ORDER_ACTS.stir.type,
  (world, e) =>
    `The god stirred the bound of ${landWords(world, e.place)} to rise against ${realm(e.data)}, ${year(e.t)}`,
);
registerEventWords(
  ORDER_ACTS.mandate.type,
  (_, e) =>
    `A sign from the heavens ${(e.data as { sign?: number } | null)?.sign === -1 ? "against" : "for"} the rule of ${realm(e.data)}, ${year(e.t)}`,
);

const realmOf = (world: World, ref: string) => {
  const p = politiesOf(world).get(ref as Parameters<ReturnType<typeof politiesOf>["get"]>[0]);
  return p ? realmName(p) : "a realm";
};
registerDecisionWords(
  "order.captives",
  (world, d) =>
    `${cap(realmOf(world, d.subject))} weighed carrying off the people of a land it took`,
);
registerDecisionWords(
  "order.bondage",
  (world, d) => `The hungry of ${landWords(world, d.subject)} weighed selling themselves for grain`,
);
registerDecisionWords(
  "order.serfdom",
  (world, d) => `${cap(realmOf(world, d.subject))} bound its farmers to the land`,
);
registerDecisionWords(
  "order.indenture",
  (world, d) =>
    `Those who came hungry to ${landWords(world, d.subject)} were bound for their passage`,
);
registerDecisionWords(
  "order.flight",
  (world, d) => `The bound of ${landWords(world, d.subject)} weighed flight`,
);
registerDecisionWords(
  "order.revolt",
  (world, d) => `The bound of ${landWords(world, d.subject)} rose`,
);
registerDecisionWords(
  "order.abolish",
  (world, d) => `${cap(realmOf(world, d.subject))} weighed freeing its bound`,
);
registerDecisionWords(
  "order.legitimacy",
  (world, d) => `${cap(realmOf(world, d.subject))}'s people weighed its right to rule`,
);
