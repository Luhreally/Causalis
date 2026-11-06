// What goes along a road, in words, and how far a gang has got (R1): as the view reads a road's stages, so a road's page and its look can't disagree.
import type { GetAbout, LandEra, RoadWorks } from "../bridge/index.ts";

/** How far a gang has got by year y, its idle years not counted (view/land.ts worksShare, the same sum). */
export function worksShareOf(w: RoadWorks, y: number): number {
  let idle = 0,
    idleAll = 0;
  for (const s of w.stops) {
    idleAll += s.to - s.from;
    if (y > s.from) idle += Math.min(y, s.to) - s.from;
  }
  const all = w.until - w.from - idleAll;
  return all > 0 ? Math.max(0, Math.min(1, (y - w.from - idle) / all)) : 1;
}

/** What goes along a land's roads, by how far it has come and what its people are. */
export function CARRIER_WORDS(era: LandEra, about: GetAbout, rails: boolean): string {
  const train = rails ? ", and trains on its rails" : "";
  switch (about.how) {
    case "sled":
    case "swim":
      return era === "modern" || era === "industry"
        ? `sleds on the current${train}`
        : "shoals with their loads in slings";
    case "hauler":
      return `the hive's haulers${train}`;
    case "line":
      return `cars on a line laid in the ground${train}`;
    case "feet":
      return era === "forage" ? "those on foot" : "carriers on foot, with what they can bear";
    case "mount":
      return `${era === "farm" ? "carts" : "wagons"}${about.mount ? ` behind the ${about.mount}` : ""}, and riders on the far trips${train}`;
    case "wheels":
      return `trucks and cars${train}`;
  }
}

