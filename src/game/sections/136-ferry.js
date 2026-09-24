// ═══════════════════════════════════════════════════════════════════════════
// 136. FERRY — a road may cross the water
// ═══════════════════════════════════════════════════════════════════════════
// A road link was begun only along a land path (88), and the modern world's
// last requirement is a paved road or rail between two towns (114). On phone
// ship-b the world stood from year 105 to 119 a single requirement short of
// its ship: a hundred and fifteen people, fed, a polity of three towns that
// knew the craft, its towns twenty-two to forty-nine tiles apart and well
// within reach — and not one road link in the world, because the pathfinder
// found no land between any two of them. An island world lays no roads, and
// so it never leaves.
//
// When no land joins two towns, the link takes the sea road (59): a short
// walk to the shore, the crossing, a short walk from the far shore. Paving
// already skips deep water and counts it as bridged — "left to the boats" —
// so the shore tiles are paved with the same stone, the crossing is ferried,
// and the road stands. The link says it was ferried, and the chronicle does.
const FERRY = { links: 0 };
const startRoadLinkFerryBase = startRoadLink;
startRoadLink = function (faction, a, b, kind) {
  const link = startRoadLinkFerryBase(faction, a, b, kind);
  if (link || !faction || !a || !b) return link;
  const path = civilPathFind(idx(a.x, a.y), b, faction.id, "sea");
  if (path.length < 2) return null;
  // The same record 88 keeps, with the crossing marked.
  const ferried = {
    id: W.roads.nextId++,
    kind,
    a: a.id,
    b: b.id,
    factionId: faction.id,
    path,
    paved: 0,
    complete: false,
    abandoned: false,
    startedTick: W.tick,
    completedTick: 0,
    ferried: true,
  };
  W.roads.links.push(ferried);
  FERRY.links++;
  return ferried;
};
eventText(["RoadEvent", "RailEvent"], function (e, next) {
  if ((e.type === "RoadEvent" || e.type === "RailEvent") && e.data?.ferried && e.data.a && e.data.b)
    return `A ${e.type === "RailEvent" ? "railway" : "road"} of ${e.data.tiles} tiles joined ${e.data.a} and ${e.data.b}, the crossing left to the boats.`;
  return next(e);
});
const roadEventForFerryBase = roadEventFor;
roadEventFor = function (link, a, b) {
  const ev = roadEventForFerryBase(link, a, b);
  if (ev && link?.ferried) {
    ev.data = { ...(ev.data || {}), ferried: true };
    ev.evidence = [...(ev.evidence || []), "the deep water between was crossed by boat"];
  }
  return ev;
};
window.ALIFE_FERRY_DEBUG = Object.freeze({
  counts: () => ({ ...FERRY }),
  link: (aId, bId, kind = "road") => {
    const a = W.settlements.find((s) => s.id === aId),
      b = W.settlements.find((s) => s.id === bId),
      f = a ? W.factions.find((x) => x.id === a.factionId) || W.factions[0] : null;
    return f ? startRoadLink(f, a, b, kind) : null;
  },
});
