// ═══════════════════════════════════════════════════════════════════════════
// 163. HERDS THAT FEED THEIR TOWNS
// ═══════════════════════════════════════════════════════════════════════════
// A town's herd (42d) was fed from its stores every eight ticks and gave
// nothing back: no meat, and animal husbandry itself only raised a field's
// harvest by a tenth (106). Measured on causal-origin, battery, no skips: a
// town's pen held six to twenty-seven grazers by year forty, each eating up to
// eighteen of the town's food a week. Now a herd is kept for food. A herd of a
// town, above the four it needs to go on breeding, gives one animal a season
// (every sixty-four ticks) when its pen is crowded (more than eight) or its
// town is going lean: the herder slaughters the oldest, four fifths of its
// flesh and stored energy go into the town's stores, and the rest of it goes
// back to the ground with its blood. Matter is conserved throughout; the herd
// is smaller, eats less, and the town has meat.
const HUSBANDRY = { slaughtered: 0, meat: 0 },
  HERD_BREEDING_KEEP = 4,
  HERD_PEN_CROWD = 8,
  SLAUGHTER_CADENCE = 64,
  SLAUGHTER_OFFSET = 37,
  MEAT_SHARE = 0.8;

function slaughterFromHerd(herd) {
  const place = fieldPlace(herd);
  if (!place || place.ruined || !place.knownProcesses || !place.inventory) return 0;
  const animals = herd.animalIds.filter(
    (animal) => W.kind[animal] === KINDS.HERBIVORE && classifyAlive(animal),
  );
  if (animals.length <= HERD_BREEDING_KEEP) return 0;
  const penned = !!herd.enclosedTick,
    lean = !!foodOutlook(place)?.lean;
  if (!lean && !(penned && animals.length > HERD_PEN_CROWD)) return 0;
  const animal = animals
      .slice()
      .sort(
        (a, b) => (W.components.life[b]?.age || 0) - (W.components.life[a]?.age || 0) || a - b,
      )[0],
    body = W.components.chemistry[animal]?.q,
    position = W.components.position[animal];
  if (!body || !position) return 0;
  let meat = 0;
  for (const species of [C.ORGANIC, C.ENERGY]) {
    const amount = Math.min(
      Math.floor(body[species] * MEAT_SHARE),
      65535 - (place.inventory[species] || 0),
    );
    if (amount <= 0) continue;
    body[species] -= amount;
    place.inventory[species] += amount;
    meat += amount;
  }
  const butcher = classifyAlive(herd.herderId) ? herd.herderId : 0,
    event = emitEvent("HerdSlaughteredEvent", {
      subjects: [butcher, animal, place.entityId].filter(Boolean),
      location: idx(position.x, position.y),
      factions: place.factionId ? [place.factionId] : [],
      causes: [herd.causeEvent].filter(Boolean),
      evidence: [
        `${meat} of the animal's flesh and stored energy went into the stores of ${place.name}`,
        lean ? "the town was going lean" : `the pen held ${animals.length}, more than it keeps`,
      ],
      magnitude: meat,
      importance: 1,
      data: {
        herdId: herd.id,
        place: place.name,
        meat,
        butcher: butcher ? entityName(butcher) : "",
      },
    });
  // The rest of the body goes back to the ground where it fell.
  killEntity(animal, "slaughtered for food", event.id, true);
  herd.animalIds = herd.animalIds.filter((id) => id !== animal);
  HUSBANDRY.slaughtered++;
  HUSBANDRY.meat += meat;
  return meat;
}
tickSystem("husbandry", function () {
  if (!W?.herds || W.tick % SLAUGHTER_CADENCE !== SLAUGHTER_OFFSET) return;
  for (const herd of W.herds) if (herd.active) slaughterFromHerd(herd);
});
eventText(["HerdSlaughteredEvent"], function (e) {
  const d = e.data || {};
  return `🥩 ${d.butcher || "A herder"} slaughtered one of the herd of ${d.place || "a town"}; ${fmt(d.meat || 0)} food went into its stores.`;
});
window.ALIFE_HUSBANDRY_DEBUG = Object.freeze({
  counts: () => ({ ...HUSBANDRY }),
  slaughter: (herdId) => {
    const herd = W.herds.find((h) => h.id === herdId);
    return herd ? slaughterFromHerd(herd) : 0;
  },
});
