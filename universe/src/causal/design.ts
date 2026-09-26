// Designs in words (docs/architecture §22, §13): how a land's people build their
// houses and how a realm arms its host — and why: the principles that made it
// possible, and the land that gave what it is made of (its climate, its ore).
import { yearOfMoment, type CauseRef } from "../kernel/index.ts";
import { designWords } from "../rules/index.ts";
import { DESIGN, DESIGN_EVENTS, designsOf, politiesOf, realmName } from "../sim/index.ts";
import { landWords } from "./generated.ts";
import { edges, registerEventWords, registerExplainer } from "./why.ts";

registerExplainer(DESIGN.code, (world, ref) => {
  if (!world.storeNames().includes("design.designs")) return null;
  const d = designsOf(world).get(ref);
  if (!d) return null;
  const whose =
    d.kind === "house"
      ? `In ${landWords(world, d.owner)} people build ${designWords(d.parts)}`
      : d.kind === "works"
        ? `In ${landWords(world, d.owner)} the crafts are done in ${designWords(d.parts)}`
        : `${cap(realmName(politiesOf(world).get(d.owner) ?? { leadership: 0, town: "a realm" }))} fights with ${designWords(d.parts)}`;
  const causes: CauseRef[] = [{ ref: d.event, role: "trigger", weight: 1 }];
  return {
    ref,
    claim: `${whose}, since year ${d.since}`,
    basis: "recorded",
    t: null,
    causes: edges(world, causes),
  };
});

const words = (data: unknown) => {
  const w = (data as { words?: unknown } | null)?.words;
  return typeof w === "string" ? w : "something new";
};
registerEventWords(
  DESIGN_EVENTS.house.type,
  (world, e) =>
    `In ${landWords(world, e.place)} people began to build ${words(e.data)}, year ${yearOfMoment(e.t)}`,
);
registerEventWords(
  DESIGN_EVENTS.works.type,
  (world, e) =>
    `In ${landWords(world, e.place)} the crafts came to be done in ${words(e.data)}, year ${yearOfMoment(e.t)}`,
);
registerEventWords(DESIGN_EVENTS.host.type, (world, e) => {
  const realm = politiesOf(world).get(e.subjects[1]!);
  return `${cap(realm ? realmName(realm) : "a realm")} armed its host with ${words(e.data)}, year ${yearOfMoment(e.t)}`;
});

function cap(s: string): string {
  return s ? s[0]!.toUpperCase() + s.slice(1) : s;
}
