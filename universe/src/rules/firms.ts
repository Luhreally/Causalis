// Carriers' firms (breadth round, 2026-11-23). Lone traders carry what they can between two lands, each paying the whole haul of
// what he carries. A firm keeps a crew and its wagons or hulls on a road the year round, full loads and runs to a time, and carries
// each unit for less; but its crew is paid whether or not anything moves. So a firm stands on a road where what passes it in a
// year, at what the firm saves on each, pays its crew's year: the road's own trade decides, not a list of ages or goods.
// Pure tables and functions.

/** The hands a carriers' firm keeps on a road (est: a train of wagons, or a hull's crew, and those who load them). */
export const FIRM_CREW = 8;
/** What a firm saves on each unit's haul against a lone trader's (est: full loads, runs to a time, a third). */
export const FIRM_SAVING = 0.3;

/**
 * Whether a firm stands on a road: what passed it last year (units of bulk) times what a firm saves on each unit's haul (`haul`,
 * grain a unit, times FIRM_SAVING) against its crew's year at the going trader's wage (grain a year).
 */
export function firmPays(bulk: number, haul: number, crewWage: number): boolean {
  return bulk > 0 && haul > 0 && bulk * haul * FIRM_SAVING >= FIRM_CREW * Math.max(0, crewWage);
}
