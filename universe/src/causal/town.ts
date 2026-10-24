// Towns in words (Phase 23): walls raised about a town as war came near, a temple raised at its
// heart, a town forsaken as its last homes fell.
import { yearOfMoment } from "../kernel/index.ts";
import { TOWN_EVENTS } from "../sim/index.ts";
import { landWords } from "./generated.ts";
import { registerEventWords } from "./why.ts";

const name = (d: unknown) => {
  const v = (d as Readonly<Record<string, unknown>> | null)?.name;
  return typeof v === "string" ? v : "A town";
};

registerEventWords(
  TOWN_EVENTS.walled.type,
  (world, e) =>
    `${name(e.data)} in ${landWords(world, e.place)} raised walls about itself as war came near, year ${yearOfMoment(e.t)}`,
);
registerEventWords(
  TOWN_EVENTS.temple.type,
  (world, e) =>
    `${name(e.data)} in ${landWords(world, e.place)} raised a temple in stone at its heart, year ${yearOfMoment(e.t)}`,
);
registerEventWords(
  TOWN_EVENTS.forsaken.type,
  (world, e) =>
    `${name(e.data)} in ${landWords(world, e.place)} was forsaken, its last homes fallen to ruin, year ${yearOfMoment(e.t)}`,
);
