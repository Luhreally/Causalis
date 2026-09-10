// ═══════════════════════════════════════════════════════════════════════════
// 124. SIDEWALKS — a paved street is somewhere to walk, not only to drive on
// ═══════════════════════════════════════════════════════════════════════════
// Paved tiles had curbs and crossings painted on them and meant nothing to
// anyone on foot: a townsman crossed the road exactly as they crossed a field.
// A street is now a graph. Its nodes are the paved tiles, its edges are the
// steps between them, and a person walking through a city keeps to it, the way
// anyone does, because the walking is easier there and it goes where they are
// going. The graph is also what traffic is counted on, so a street that carries
// the town's feet and its carts can say so.
//
// The graph is derived, never authoritative: it is rebuilt from the road tiles
// whenever the paving changes and at most once a tick, and nothing outside this
// section stores anything on it.
const SIDEWALK_PREFERENCE = 5.5,
  SIDEWALK_REFRESH = 64,
  SIDEWALK = { nodes: 0, edges: 0, walked: 0, rebuilds: 0 };
let sidewalkCache = { world: null, tick: -1, paving: -1, nodes: new Set(), edges: new Map() };

function sidewalkPavingMark() {
  let mark = 0;
  for (const l of W.roads?.links || []) mark += (l.paved || 0) * 3 + (l.complete ? 1 : 0);
  return mark;
}
function sidewalkGraph() {
  if (!W) return sidewalkCache;
  if (sidewalkCache.world === W && sidewalkCache.tick === W.tick) return sidewalkCache;
  const paving = sidewalkPavingMark();
  // Links are the cheap signal that paving changed, but road tiles can be laid
  // without one, so the graph also refreshes on a cadence: within half a year
  // of game time it is what the ground says, and it never walks every tile more
  // than once a tick.
  const stale = W.tick - (sidewalkCache.built ?? -1e9) >= SIDEWALK_REFRESH;
  if (sidewalkCache.world === W && sidewalkCache.paving === paving && !stale) {
    sidewalkCache.tick = W.tick;
    return sidewalkCache;
  }
  const nodes = new Set(),
    edges = new Map();
  for (let i = 0; i < W.tileCount; i++) if (roadLevel(i) >= ROAD_PAVED) nodes.add(i);
  let count = 0;
  for (const i of nodes) {
    const [x, y] = xy(i),
      near = [];
    for (const [dx, dy] of DIRS.slice(0, 8)) {
      const nx = x + dx,
        ny = y + dy;
      if (!inside(nx, ny)) continue;
      const j = idx(nx, ny);
      if (nodes.has(j)) near.push(j);
    }
    edges.set(i, near);
    count += near.length;
  }
  sidewalkCache = { world: W, tick: W.tick, built: W.tick, paving, nodes, edges };
  SIDEWALK.nodes = nodes.size;
  SIDEWALK.edges = Math.round(count / 2);
  SIDEWALK.rebuilds++;
  return sidewalkCache;
}
function onSidewalk(tile) {
  return sidewalkGraph().nodes.has(tile);
}
// The walk between two paved tiles, along the pavement only. This is what makes
// it a graph rather than a coat of paint: ask it for a route and it either has
// one or it does not.
function sidewalkRoute(from, to, limit = 400) {
  const g = sidewalkGraph();
  if (!g.nodes.has(from) || !g.nodes.has(to)) return null;
  if (from === to) return [from];
  const seen = new Map([[from, 0]]),
    queue = [from];
  for (let head = 0; head < queue.length && head < limit; head++) {
    const here = queue[head];
    for (const next of g.edges.get(here) || []) {
      if (seen.has(next)) continue;
      seen.set(next, here);
      if (next === to) {
        const path = [to];
        for (let step = here; step !== from; step = seen.get(step)) path.push(step);
        path.push(from);
        return path.reverse();
      }
      queue.push(next);
    }
  }
  return null;
}
// A person on foot in a town keeps to the pavement. Beasts do not, and neither
// does anyone out in open country, because there is no pavement to keep to.
const directionScoreSidewalkBase = directionScore;
directionScore = function (id, dx, dy, goal) {
  const score = directionScoreSidewalkBase(id, dx, dy, goal);
  if (score <= -1e8 || W.kind[id] !== KINDS.PERSON) return score;
  const p = W.components.position[id],
    x = p.x + dx,
    y = p.y + dy;
  if (!inside(x, y) || !onSidewalk(idx(x, y))) return score;
  return score + SIDEWALK_PREFERENCE;
};
// What the streets carry. Traffic is already written to the tile as feet pass;
// this reads it back per link so a street can be busy or quiet.
function sidewalkTraffic(link) {
  if (!link?.path) return 0;
  let total = 0;
  for (const tile of link.path) total += W.tiles.traffic?.[tile] || 0;
  return Math.round(total / Math.max(1, link.path.length));
}
const simTickSidewalkBase = simTick;
simTick = function () {
  const out = simTickSidewalkBase();
  if (W && W.tick % 64 === 0) {
    const g = sidewalkGraph();
    let walked = 0;
    for (const id of W.activeIds) {
      if (W.kind[id] !== KINDS.PERSON || !classifyAlive(id)) continue;
      const p = W.components.position[id];
      if (p && g.nodes.has(idx(p.x, p.y))) walked++;
    }
    SIDEWALK.walked = walked;
  }
  return out;
};
window.ALIFE_SIDEWALK_DEBUG = Object.freeze({
  counts: () => ({ ...SIDEWALK }),
  rebuild: () => {
    sidewalkCache = { world: null, tick: -1, paving: -1, nodes: new Set(), edges: new Map() };
    const g = sidewalkGraph();
    return { nodes: g.nodes.size, edges: SIDEWALK.edges };
  },
  graph: () => {
    const g = sidewalkGraph();
    return { nodes: g.nodes.size, edges: SIDEWALK.edges, tiles: [...g.nodes].slice(0, 12) };
  },
  route: (from, to) => sidewalkRoute(from, to),
  on: (x, y) => onSidewalk(idx(x, y)),
  traffic: () => (W.roads?.links || []).filter((l) => l.complete).map((l) => ({ id: l.id, kind: l.kind, traffic: sidewalkTraffic(l) })),
  wear: (x, y) => (typeof streetWear === "function" ? streetWear(idx(x, y)) : null),
});
