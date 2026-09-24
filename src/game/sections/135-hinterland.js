// ═══════════════════════════════════════════════════════════════════════════
// 135. HINTERLAND — a grown town's fields reach past the seventh tile, and a
// starving town takes in no strangers
// ═══════════════════════════════════════════════════════════════════════════
// Two rules of the village held a city to a village's food.
//
// Fields were laid no farther than seven tiles from the hall (92, 118), the
// range of a village's hands, and a city whose blocks stood eight tiles out
// had no ground left in that ring: on the post-ship battery fixture Zephyrford
// and Stonespire each held six farms for a decade whatever their granaries
// asked, while their people lived twelve to twenty tiles out and walked past
// the ring to work. The hands range as far as the town does now (133), so the
// fields may too: a town's field ring is three tiles past its built edge,
// never under seven nor over eleven. A village keeps its seven.
//
// And the home pass (86) gave every homeless person within fourteen tiles to
// the nearest town, whoever they were and however it fared. Section 40 kindles
// a band of eight in the wilds every dozen years or so, and on a small map the
// wilds are fourteen tiles from a city: Zephyrford, in famine on six fields,
// took in eight strangers in a year, and grew from thirty-one to forty-five
// with two children born. A town in famine adopts no stranger now; a child of
// its own people is taken in as before, and a band left to itself founds its
// own camp, as bands do.
const HINTERLAND_RING_MIN = 7,
  HINTERLAND_RING_MAX = 11,
  HINTERLAND_RING_MARGIN = 3;
const HINTERLAND = { widened: 0, refused: 0 };
function hinterlandFieldCap(place, buildings) {
  if (!place?.knownProcesses || typeof townOuterRing !== "function") return HINTERLAND_RING_MIN;
  return clamp(
    townOuterRing(place, buildings) + HINTERLAND_RING_MARGIN,
    HINTERLAND_RING_MIN,
    HINTERLAND_RING_MAX,
  );
}
const zoneTargetHinterlandBase = zoneTarget;
zoneTarget = function (zone, place, plan, buildings) {
  const base = zoneTargetHinterlandBase(zone, place, plan, buildings);
  // Fields and pasture only: widening the cottage belt as well sprawled the
  // town, lengthened every walk, and on battery causal-origin cost the launch.
  if (zone !== "farm" && zone !== "pasture") return base;
  const cap = hinterlandFieldCap(place, buildings);
  if (cap <= HINTERLAND_RING_MIN) return base;
  const outer = townOuterRing(place, buildings),
    wide = zone === "pasture" ? Math.min(outer + 4, cap + 1) : Math.min(outer + 2.5, cap);
  if (wide > base) HINTERLAND.widened++;
  return Math.max(base, wide);
};
// ── No strangers in a famine ──────────────────────────────────────────────────
function hinterlandParentLivesIn(id, place) {
  for (const parent of W.components.identity[id]?.parents || []) {
    const ps = W.components.social[parent];
    if (ps?.homePlaceKind === "settlement" && ps.homePlaceId === place.id && classifyAlive(parent))
      return true;
  }
  return false;
}
const adoptIntoHinterlandBase = adoptInto;
adoptInto = function (id, soc, kind, place) {
  if (
    kind === "settlement" &&
    place?.knownProcesses &&
    typeof foodOutlook === "function" &&
    !hinterlandParentLivesIn(id, place)
  ) {
    const outlook = foodOutlook(place);
    if (outlook?.famine) {
      HINTERLAND.refused++;
      return;
    }
  }
  return adoptIntoHinterlandBase(id, soc, kind, place);
};
window.ALIFE_HINTERLAND_DEBUG = Object.freeze({
  counts: () => ({ ...HINTERLAND }),
  fieldCap: (townId) => hinterlandFieldCap(W.settlements.find((s) => s.id === townId)),
  farmRing: (townId) => {
    const s = W.settlements.find((x) => x.id === townId);
    return s
      ? zoneTarget(
          "farm",
          s,
          typeof townPlan === "function" ? townPlan(s) : {},
          typeof townBuildings === "function" ? townBuildings(s) : [],
        )
      : null;
  },
});
