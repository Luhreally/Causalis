// ═══════════════════════════════════════════════════════════════════════════
// 106. THE WIDE TREE — three branches of knowledge, sixty more crafts, and what each changes
// ═══════════════════════════════════════════════════════════════════════════
// The tree of crafts was a spine: forty crafts from fire to the stars, most
// of them rungs on one ladder. Here it grows three branches with sixty more
// crafts between them, each with priors, materials, a facility, and a real
// hand on the world. Matter is stone, metal, engines, and arms: it quickens
// the work face, hardens walls and soldiers, drives factories and ships, and
// lets buildings shrug off quake and siege. Life is field, herd, and body: it
// fills the granary, thins the pathogens a town meets, lengthens lives, and
// eases births. Mind is letters, law, coin, and inquiry: it quickens research,
// calms unrest, fills treasuries, warms opinion between polities, and sends
// settlers out with maps in hand. Rare crafts open only to a town that has
// seen the thing itself: an earthquake, an eruption, a fallen star. Past the
// sixth tier each branch runs on in frontier crafts that repeat with rising
// cost and a small gain each, so a late civilisation always has somewhere to
// push. A polity's ethos tilts which branch its towns follow, and the branch
// it has neglected pulls a little harder, so no polity grows one-armed. The
// Technology page lays the branches out tier by tier, and the annals keep the
// first town to master each branch. Rendering only reads.
const BRANCHES = Object.freeze({ matter: "Matter", life: "Life", mind: "Mind" }),
  BRANCH_GLOSS = Object.freeze({
    matter: "stone, metal, engines, and arms",
    life: "field, herd, and body",
    mind: "letters, law, coin, and inquiry",
  }),
  BRANCH_MULTIPLICATIVE = Object.freeze([
    "research",
    "construction",
    "hygiene",
    "harvest",
    "military",
    "defense",
    "naval",
    "resilience",
    "fertility",
    "longevity",
    "factory",
    "barter",
  ]),
  BRANCH_ADDITIVE = Object.freeze(["unrest", "taxes", "opinion", "urge"]),
  BRANCH_FRONTIER_TIERS = 3,
  BRANCH_MASTERY_TICK = 120,
  EMPTY_BRANCH_EFFECTS = Object.freeze({
    research: 1,
    construction: 1,
    hygiene: 1,
    harvest: 1,
    military: 1,
    defense: 1,
    naval: 1,
    resilience: 1,
    fertility: 1,
    longevity: 1,
    factory: 1,
    barter: 1,
    unrest: 0,
    taxes: 0,
    opinion: 0,
    urge: 0,
  });
function branchDef(branch, tier, id, name, prior, materials, facility, threshold, process, effects, gate = null) {
  const def = { id, name, branch, tier, prior, materials, facility, threshold, process, effects };
  if (gate) {
    def.gate = gate;
    def.rare = true;
  }
  return Object.freeze(def);
}
const seen = (type) => (s) => typeof observedNear === "function" && !!observedNear(s, type);
const BRANCH_TECH_DEFS = Object.freeze([
  // ── Matter ──────────────────────────────────────────────────────────────────
  branchDef("matter", 1, "stone_dressing", "Dressed Stone", ["tools"], [C.MINERAL, C.FIBER], "workshop", 30, "blocks squared and coursed so a wall carries its own weight", { construction: 1.1 }),
  branchDef("matter", 2, "bronze_casting", "Bronze Casting", ["metalworking"], [C.METAL, C.FUEL], "forge", 46, "two metals poured as one into a mould", { military: 1.1, construction: 1.05 }),
  branchDef("matter", 2, "kiln_glass", "Kiln Glass", ["ceramics", "storage"], [C.MINERAL, C.FUEL], "kiln", 44, "sand and ash fused clear in a hot kiln", { research: 1.05, harvest: 1.03 }),
  branchDef("matter", 2, "pulleys", "Pulleys and Cranes", ["wheel", "masonry"], [C.FIBER, C.METAL], "workshop", 48, "rope over wheels lifting what no back could", { construction: 1.15 }),
  branchDef("matter", 2, "volcanic_glass", "Volcanic Glass", ["tools"], [C.MINERAL, C.CRYSTAL], "workshop", 40, "glass from the mountain's own fire knapped to an edge", { military: 1.08, research: 1.04 }, seen("EruptionEvent")),
  branchDef("matter", 3, "iron_smelting", "Iron Smelting", ["bronze_casting"], [C.ORE, C.FUEL], "forge", 56, "ore reduced in a tall furnace to a harder metal", { military: 1.15, defense: 1.1 }),
  branchDef("matter", 3, "arch_vault", "Arch and Vault", ["masonry", "mathematics"], [C.MINERAL, C.CERAMIC], "hall", 54, "stone that leans on stone to span a room", { resilience: 0.85, construction: 1.05 }),
  branchDef("matter", 3, "sailcloth", "Sailcloth and Keel", ["navigation", "tools"], [C.FIBER, C.ORGANIC], "dock", 50, "woven cloth on a mast and a keel that holds a line", { naval: 1.3, urge: 0.03 }),
  branchDef("matter", 3, "windmills", "Wind and Water Mills", ["wheel", "irrigation"], [C.FIBER, C.MINERAL], "workshop", 52, "a wheel turned by wind or stream to grind and pump", { harvest: 1.1, construction: 1.05 }),
  branchDef("matter", 3, "seismic_joinery", "Seismic Joinery", ["masonry"], [C.FIBER, C.MINERAL], "workshop", 50, "frames pinned to sway with the ground instead of against it", { resilience: 0.75 }, seen("EarthquakeEvent")),
  branchDef("matter", 3, "sky_iron", "Sky Iron", ["metalworking"], [C.ORE, C.METAL], "forge", 52, "metal worked from a stone that fell out of the sky", { military: 1.1, construction: 1.05 }, seen("MeteorEvent")),
  branchDef("matter", 4, "gunpowder", "Black Powder", ["iron_smelting", "mathematics"], [C.SALT, C.FUEL], "forge", 62, "a salt, a fuel, and a spark that throws stone", { military: 1.25 }),
  branchDef("matter", 4, "steel", "Crucible Steel", ["iron_smelting", "kiln_glass"], [C.ORE, C.CATALYST], "forge", 64, "iron held molten with a measure of carbon", { construction: 1.1, military: 1.15, resilience: 0.9 }),
  branchDef("matter", 4, "concrete", "Poured Concrete", ["arch_vault", "chemistry"], [C.MINERAL, C.SOLVENT], "workshop", 66, "ground stone that sets hard in any shape", { construction: 1.2, resilience: 0.8 }),
  branchDef("matter", 4, "steam_power", "Steam Power", ["mechanization", "windmills"], [C.METAL, C.FUEL], "forge", 64, "water boiled to drive a piston", { factory: 1.25, construction: 1.1 }),
  branchDef("matter", 5, "ballistics", "Ballistics", ["gunpowder", "mathematics"], [C.METAL, C.INFO], "archive", 68, "the arc of a shot worked out before it is fired", { military: 1.2 }),
  branchDef("matter", 5, "steel_frame", "Steel Frames", ["steel", "concrete"], [C.METAL, C.MINERAL], "factory", 72, "a skeleton of steel that walls merely clothe", { construction: 1.2, resilience: 0.9 }),
  branchDef("matter", 5, "power_grid", "Power Grid", ["electricity", "steel"], [C.METAL, C.CATALYST], "factory", 74, "current carried on wires to every door", { factory: 1.3, research: 1.05 }),
  branchDef("matter", 5, "petrochemistry", "Petrochemistry", ["combustion", "chemistry"], [C.FUEL, C.CATALYST], "factory", 74, "fuel cracked into a hundred useful things", { factory: 1.2, harvest: 1.05 }),
  branchDef("matter", 6, "aeronautics", "Aeronautics", ["combustion", "ballistics"], [C.METAL, C.FUEL], "factory", 80, "a wing that carries an engine through the air", { military: 1.2, urge: 0.05 }),
  branchDef("matter", 6, "fission_power", "Fission Power", ["power_grid", "computing"], [C.ORE, C.CATALYST], "factory", 86, "heavy nuclei split for heat and current", { factory: 1.4, construction: 1.05 }),
  branchDef("matter", 6, "composites", "Advanced Composites", ["petrochemistry", "steel_frame"], [C.FIBER, C.CATALYST], "factory", 84, "fibres bound in resin, lighter than metal and as strong", { construction: 1.15, naval: 1.2 }),
  // ── Life ────────────────────────────────────────────────────────────────────
  branchDef("life", 1, "herbalism", "Herb Lore", ["drying"], [C.ORGANIC, C.SOLVENT], "hearth", 28, "which leaf soothes and which root purges, remembered", { hygiene: 0.9, longevity: 1.03 }),
  branchDef("life", 1, "animal_husbandry", "Animal Husbandry", ["agriculture"], [C.ORGANIC, C.FIBER], "corral", 34, "herds kept and bred instead of hunted", { harvest: 1.1, fertility: 1.05 }),
  branchDef("life", 2, "crop_rotation", "Crop Rotation", ["agriculture", "storage"], [C.NUTRIENT, C.ORGANIC], "farm", 40, "fields rested and changed so the soil gives again", { harvest: 1.15 }),
  branchDef("life", 2, "midwifery", "Midwifery", ["medicine"], [C.MEDICINE, C.FIBER], "clinic", 42, "practised hands at every birth", { fertility: 1.1, longevity: 1.03 }),
  branchDef("life", 2, "brewing", "Brewing", ["storage", "ceramics"], [C.ORGANIC, C.CERAMIC], "kiln", 40, "grain fermented into a drink that keeps", { unrest: 0.03, hygiene: 0.95 }),
  branchDef("life", 3, "selective_breeding", "Selective Breeding", ["animal_husbandry", "crop_rotation"], [C.ORGANIC, C.INFO], "farm", 52, "the best of each generation chosen to seed the next", { harvest: 1.15 }),
  branchDef("life", 3, "quarantine", "Quarantine", ["medicine", "governance"], [C.MEDICINE, C.INFO], "clinic", 50, "the sick kept apart until the sickness passes", { hygiene: 0.7 }),
  branchDef("life", 3, "anatomy", "Anatomy", ["medicine", "writing"], [C.MEDICINE, C.PIGMENT], "clinic", 54, "the body opened, drawn, and understood", { longevity: 1.05, hygiene: 0.9 }),
  branchDef("life", 4, "surgery", "Surgery", ["anatomy", "bronze_casting"], [C.METAL, C.MEDICINE], "clinic", 60, "the knife used to mend what it once only wounded", { longevity: 1.06, military: 1.05 }),
  branchDef("life", 4, "fertilizer", "Mineral Fertilizer", ["chemistry", "crop_rotation"], [C.SALT, C.NUTRIENT], "workshop", 62, "the salts a field lacks, made and spread", { harvest: 1.2 }),
  branchDef("life", 4, "vaccination", "Vaccination", ["germ_theory", "quarantine"], [C.MEDICINE, C.CATALYST], "clinic", 66, "a small sickness given to forestall a great one", { hygiene: 0.6, longevity: 1.05 }),
  branchDef("life", 5, "refrigeration", "Cold Stores", ["electricity", "brewing"], [C.METAL, C.SOLVENT], "factory", 70, "a made cold that keeps food through any season", { harvest: 1.1, unrest: 0.02 }),
  branchDef("life", 5, "antibiotics", "Antibiotics", ["vaccination", "chemistry"], [C.MEDICINE, C.CATALYST], "clinic", 72, "a mould's own poison turned against the pathogens", { hygiene: 0.6, longevity: 1.08 }),
  branchDef("life", 5, "genetics", "Genetics", ["selective_breeding", "optics", "printing"], [C.INFO, C.MEDICINE], "archive", 76, "the thread of inheritance read letter by letter", { harvest: 1.15, fertility: 1.05 }),
  branchDef("life", 5, "ecology", "Ecology", ["selective_breeding", "mathematics"], [C.ORGANIC, C.INFO], "observatory", 70, "the web of living things counted and its knots found", { resilience: 0.9, harvest: 1.05 }),
  branchDef("life", 6, "hydroponics", "Hydroponics", ["fertilizer", "power_grid"], [C.NUTRIENT, C.SOLVENT], "factory", 80, "crops raised in water under a made light", { harvest: 1.25 }),
  branchDef("life", 6, "gene_therapy", "Gene Therapy", ["genetics", "computing"], [C.MEDICINE, C.INFO], "clinic", 86, "the thread of inheritance mended where it frays", { longevity: 1.12, fertility: 1.05 }),
  // ── Mind ────────────────────────────────────────────────────────────────────
  branchDef("mind", 1, "oral_tradition", "Oral Tradition", [], [C.PIGMENT, C.ORGANIC], "hearth", 26, "the long tale told the same way every winter", { research: 1.05, unrest: 0.02 }),
  branchDef("mind", 1, "ritual_calendar", "Ritual Calendar", ["oral_tradition"], [C.PIGMENT, C.MINERAL], "shrine", 34, "the year marked in stones and feasts so sowing is never late", { harvest: 1.05, unrest: 0.02 }),
  branchDef("mind", 2, "weights_measures", "Weights and Measures", ["writing"], [C.INFO, C.METAL], "market", 44, "one bushel and one span agreed by all", { taxes: 1, barter: 1.1 }),
  branchDef("mind", 2, "philosophy", "Philosophy", ["writing", "oral_tradition"], [C.INFO, C.PIGMENT], "archive", 46, "the habit of asking why, written down", { research: 1.1, unrest: 0.02 }),
  branchDef("mind", 2, "theatre", "Theatre", ["ritual_calendar", "writing"], [C.PIGMENT, C.FIBER], "hall", 44, "the town's own story played back to it", { unrest: 0.04 }),
  branchDef("mind", 3, "census", "The Census", ["governance", "mathematics"], [C.INFO, C.PIGMENT], "hall", 52, "every household counted and its due recorded", { taxes: 2, urge: 0.02 }),
  branchDef("mind", 3, "jurisprudence", "Jurisprudence", ["governance", "philosophy"], [C.INFO, C.PIGMENT], "hall", 54, "law reasoned from principle instead of remembered from custom", { unrest: 0.04, opinion: 4 }),
  branchDef("mind", 3, "cartography", "Cartography", ["navigation", "mathematics"], [C.PIGMENT, C.INFO], "archive", 50, "the known world drawn to scale", { urge: 0.05, naval: 1.1 }),
  branchDef("mind", 4, "banking", "Banking", ["currency", "weights_measures"], [C.METAL, C.INFO], "market", 60, "coin lent against a promise written down", { taxes: 3, barter: 1.1 }),
  branchDef("mind", 4, "universities", "Universities", ["philosophy", "printing"], [C.INFO, C.PIGMENT], "archive", 62, "scholars gathered to teach and to argue", { research: 1.2 }),
  branchDef("mind", 4, "diplomatic_corps", "Diplomatic Corps", ["jurisprudence", "cartography"], [C.INFO, C.PIGMENT], "hall", 58, "envoys trained to speak for the polity abroad", { opinion: 8 }),
  branchDef("mind", 4, "scientific_method", "The Scientific Method", ["universities", "optics"], [C.INFO, C.CRYSTAL], "archive", 66, "a claim tested against the world before it is believed", { research: 1.25 }),
  branchDef("mind", 5, "civil_service", "Civil Service", ["census", "universities"], [C.INFO, C.METAL], "hall", 68, "offices filled by examination and kept between rulers", { unrest: 0.05, taxes: 3 }),
  branchDef("mind", 5, "mass_media", "Mass Media", ["printing", "radio"], [C.INFO, C.PIGMENT], "archive", 70, "one voice heard in every house at once", { unrest: 0.03, research: 1.05 }),
  branchDef("mind", 5, "economics", "Economics", ["banking", "scientific_method"], [C.INFO, C.METAL], "market", 70, "the flow of coin and grain understood as a whole", { taxes: 4, barter: 1.15 }),
  branchDef("mind", 5, "sociology", "Sociology", ["census", "scientific_method"], [C.INFO, C.PIGMENT], "archive", 72, "the town studied as a living thing", { unrest: 0.05, opinion: 3 }),
  branchDef("mind", 6, "global_networks", "Global Networks", ["computing", "mass_media"], [C.CRYSTAL, C.INFO], "office", 84, "every archive joined to every other", { research: 1.15, opinion: 5 }),
  branchDef("mind", 6, "artificial_minds", "Thinking Machines", ["global_networks", "scientific_method"], [C.CRYSTAL, C.INFO], "office", 90, "a machine that reasons on the record without tiring", { research: 1.3, construction: 1.1 }),
]);
// Past the sixth tier each branch repeats in frontier crafts with rising cost.
const BRANCH_FRONTIER = Object.freeze({
  matter: { name: "Materials Science", prior: "composites", materials: [C.METAL, C.CRYSTAL], process: "the frontier of what matter can be made to do", effects: { construction: 1.05, military: 1.05 } },
  life: { name: "Biosciences", prior: "gene_therapy", materials: [C.MEDICINE, C.CRYSTAL], process: "the frontier of what a body can be helped to do", effects: { longevity: 1.03, harvest: 1.05 } },
  mind: { name: "Deep Theory", prior: "artificial_minds", materials: [C.INFO, C.CRYSTAL], process: "the frontier of what can be known", effects: { research: 1.05, unrest: 0.01 } },
});
const ROMAN = ["I", "II", "III", "IV", "V", "VI"];
function frontierDefs() {
  const out = [];
  for (const branch of Object.keys(BRANCH_FRONTIER)) {
    const f = BRANCH_FRONTIER[branch];
    for (let n = 1; n <= BRANCH_FRONTIER_TIERS; n++)
      out.push(
        branchDef(branch, 7, `frontier_${branch}_${n}`, `${f.name} ${ROMAN[n - 1]}`, [n === 1 ? f.prior : `frontier_${branch}_${n - 1}`], f.materials, "office", 96 + 12 * n, f.process, f.effects),
      );
  }
  return out;
}
const BRANCH_ALL_DEFS = Object.freeze([...BRANCH_TECH_DEFS, ...frontierDefs()]),
  BRANCH_BY_ID = new Map(BRANCH_ALL_DEFS.map((d) => [d.id, d]));
for (const def of BRANCH_ALL_DEFS) if (!TECH_EXTENSIONS.some((t) => t.id === def.id)) TECH_EXTENSIONS.push(def);
function branchOf(techId) {
  return BRANCH_BY_ID.get(techId)?.branch || null;
}
// ── What the branches change ─────────────────────────────────────────────────
const BRANCH_EFFECT_CACHE = new Map();
function branchEffects(place) {
  if (!place?.knownProcesses) return EMPTY_BRANCH_EFFECTS;
  const known = place.knownProcesses,
    signature = `${known.length}:${known[known.length - 1] || ""}`;
  let cached = BRANCH_EFFECT_CACHE.get(place.id);
  if (!cached || cached.world !== W || cached.signature !== signature) {
    const f = { ...EMPTY_BRANCH_EFFECTS };
    for (const id of known) {
      const e = BRANCH_BY_ID.get(id)?.effects;
      if (!e) continue;
      for (const k in e) if (BRANCH_ADDITIVE.includes(k)) f[k] += e[k];
      else f[k] *= e[k];
    }
    cached = { world: W, signature, f };
    BRANCH_EFFECT_CACHE.set(place.id, cached);
  }
  return cached.f;
}
// A polity's soldiers, ships, and envoys carry the best its towns know; its dues add up.
const FACTION_EFFECT_CACHE = { world: null, tick: -1, byKey: new Map() };
function factionBranchEffect(factionId, key) {
  if (!factionId) return BRANCH_ADDITIVE.includes(key) ? 0 : 1;
  if (FACTION_EFFECT_CACHE.world !== W || FACTION_EFFECT_CACHE.tick !== W.tick) {
    FACTION_EFFECT_CACHE.world = W;
    FACTION_EFFECT_CACHE.tick = W.tick;
    FACTION_EFFECT_CACHE.byKey.clear();
  }
  const cacheKey = `${factionId}:${key}`;
  let v = FACTION_EFFECT_CACHE.byKey.get(cacheKey);
  if (v === undefined) {
    const additive = BRANCH_ADDITIVE.includes(key);
    v = additive ? 0 : 1;
    for (const s of W.settlements) {
      if (s.ruined || s.factionId !== factionId) continue;
      const e = branchEffects(s)[key];
      v = additive ? v + e : Math.max(v, e);
    }
    FACTION_EFFECT_CACHE.byKey.set(cacheKey, v);
  }
  return v;
}
const researchTempoFactorBranchBase = researchTempoFactor;
researchTempoFactor = function (place) {
  return Math.min(3.2, researchTempoFactorBranchBase(place) * branchEffects(place).research);
};
const constructionTempoFactorBranchBase = constructionTempoFactor;
constructionTempoFactor = function (place) {
  return Math.min(2.8, constructionTempoFactorBranchBase(place) * branchEffects(place).construction);
};
const hygieneFactorBranchBase = hygieneFactor;
hygieneFactor = function (id) {
  return Math.max(0.2, hygieneFactorBranchBase(id) * branchEffects(homeSettlementOf(id)).hygiene);
};
const harvestCapFactorBranchBase = harvestCapFactor;
harvestCapFactor = function (place) {
  return harvestCapFactorBranchBase(place) * branchEffects(place).harvest;
};
function factoryTempoFactor(place) {
  return branchEffects(place).factory;
}
const militaryUnitStrengthBranchBase = militaryUnitStrength;
militaryUnitStrength = function (unit) {
  return militaryUnitStrengthBranchBase(unit) * factionBranchEffect(unit?.factionId, "military");
};
const settlementDefenseBranchBase = settlementDefense;
settlementDefense = function (s) {
  return clamp(settlementDefenseBranchBase(s) * branchEffects(s).defense, 0, 100);
};
const navalStrengthBranchBase = navalStrength;
navalStrength = function (f, docks) {
  return navalStrengthBranchBase(f, docks) * factionBranchEffect(f?.id, "naval");
};
// Engineering lets a town shrug off part of a quake, a siege, or a flood.
const damageBuiltPlaceBranchBase = damageBuiltPlace;
damageBuiltPlace = function (place, amount, cause = "impact damage", causeEvent = 0, focusTile = -1) {
  const softened = amount > 0 ? Math.max(1, Math.round(amount * branchEffects(place).resilience)) : amount;
  return damageBuiltPlaceBranchBase(place, softened, cause, causeEvent, focusTile);
};
const fertilityFactorBranchBase = fertilityFactor;
fertilityFactor = function (id, other) {
  return clamp(fertilityFactorBranchBase(id, other) * branchEffects(homeSettlementOf(id)).fertility, 0.2, 1.5);
};
const naturalLifespanBranchBase = naturalLifespan;
naturalLifespan = function (id, body) {
  return naturalLifespanBranchBase(id, body) * Math.min(1.4, branchEffects(homeSettlementOf(id)).longevity);
};
const unrestOfBranchBase = unrestOf;
unrestOf = function (place) {
  return Math.max(0, unrestOfBranchBase(place) - branchEffects(place).unrest);
};
const settlerUrgeBranchBase = settlerUrge;
settlerUrge = function (place) {
  return settlerUrgeBranchBase(place) + branchEffects(place).urge;
};
const collectTaxesBranchBase = collectTaxes;
collectTaxes = function (f) {
  const coin = collectTaxesBranchBase(f);
  if (!f || !polityCoins(f)) return coin;
  let extra = 0;
  for (const s of W.settlements) if (!s.ruined && s.factionId === f.id) extra += branchEffects(s).taxes;
  if (!extra) return coin;
  f.treasury = Math.round((f.treasury + extra) * 10) / 10;
  return Math.round((coin + extra) * 10) / 10;
};
const opinionTargetBranchBase = opinionTarget;
opinionTarget = function (a, b) {
  const r = opinionTargetBranchBase(a, b),
    warmth = Math.round(factionBranchEffect(a?.id, "opinion") + factionBranchEffect(b?.id, "opinion"));
  if (!warmth || !r?.reasons) return r;
  r.reasons.push({ label: "envoys and letters", value: warmth });
  r.target = clamp(r.reasons.reduce((n, x) => n + x.value, 0), -100, 100);
  r.reasons.sort((x, y) => Math.abs(y.value) - Math.abs(x.value));
  return r;
};
const bestBarterBranchBase = bestBarter;
bestBarter = function (a, b) {
  const offer = bestBarterBranchBase(a, b);
  if (!offer) return offer;
  const factor = (branchEffects(a).barter + branchEffects(b).barter) / 2;
  if (factor > 1) {
    offer.amountA = Math.round(offer.amountA * factor);
    offer.amountB = Math.round(offer.amountB * factor);
  }
  return offer;
};
// ── Which branch a polity follows ────────────────────────────────────────────
function branchKnownCount(place, branch) {
  let n = 0;
  for (const id of place?.knownProcesses || []) if (branchOf(id) === branch) n++;
  return n;
}
// Ethos tilts the choice; the branch a town has neglected pulls a little harder.
function branchPreference(f, place = null) {
  const e = f?.ethos || {},
    ideology = f?.ideology || {},
    inventive = e.inventive ?? 0.5,
    expansionist = e.expansionist ?? 0.5,
    mercantile = e.mercantile ?? 0.5,
    openness = ideology.openness ?? 0,
    pref = {
      matter: 0.85 + expansionist * 0.4 + (mercantile > 0.6 ? 0.05 : 0),
      life: 0.85 + (1 - expansionist) * 0.25 + Math.max(0, openness) * 0.2 + (inventive < 0.4 ? 0.1 : 0),
      mind: 0.85 + inventive * 0.4 + mercantile * 0.15,
    };
  if (place) {
    const counts = { matter: branchKnownCount(place, "matter"), life: branchKnownCount(place, "life"), mind: branchKnownCount(place, "mind") },
      least = Math.min(counts.matter, counts.life, counts.mind);
    for (const k in pref) pref[k] += 0.06 * Math.min(3, counts[k] - least) * -1 + (counts[k] === least ? 0.08 : 0);
  }
  return pref;
}
const chooseResearchFocusBranchBase = chooseResearchFocus;
chooseResearchFocus = function (s, eligible) {
  const current = eligible.find((entry) => entry.tech.id === s.researchFocus);
  if (current || !eligible.length) return chooseResearchFocusBranchBase(s, eligible);
  const f = W.factions.find((x) => x.id === s.factionId),
    pref = branchPreference(f, s),
    score = (entry) => {
      const t = entry.tech,
        threshold = researchThreshold(t),
        closeness = (s.researchProgress?.[t.id] || 0) / Math.max(1, threshold),
        branch = branchOf(t.id),
        // The spine of the tree keeps a slight lead so no polity forgets the stars.
        weight = branch ? pref[branch] : 1.15;
      return closeness * 2 + weight - threshold / 300;
    },
    ranked = eligible.slice().sort((a, b) => score(b) - score(a) || (a.tech.id < b.tech.id ? -1 : 1));
  s.researchFocus = ranked[0].tech.id;
  return ranked[0];
};
// ── Mastery milestones ───────────────────────────────────────────────────────
function branchTier(place, branch) {
  let tier = 0;
  for (let t = 1; t <= 6; t++) {
    const rung = BRANCH_TECH_DEFS.filter((d) => d.branch === branch && d.tier === t && !d.rare);
    if (rung.length && rung.every((d) => place.knownProcesses.includes(d.id))) tier = t;
    else break;
  }
  return tier;
}
function checkBranchMastery() {
  if (typeof recordMilestone !== "function") return;
  for (const s of W.settlements) {
    if (s.ruined || !s.knownProcesses) continue;
    for (const branch of Object.keys(BRANCHES)) {
      const tier = branchTier(s, branch);
      for (const rung of [3, 6])
        if (tier >= rung)
          recordMilestone(`branch-${branch}-${rung}`, `${s.name} mastered the ${BRANCHES[branch]} branch to the ${rung === 3 ? "third" : "sixth"} tier`, s, {
            evidence: `${branchKnownCount(s, branch)} crafts of ${BRANCH_GLOSS[branch]}`,
          });
    }
  }
}
const simTickBranchBase = simTick;
simTick = function () {
  simTickBranchBase();
  if (W?.settlements && W.tick % 256 === BRANCH_MASTERY_TICK) checkBranchMastery();
};
// ── The Technology page: the branches tier by tier ───────────────────────────
const renderTechnologyPageBranchBase = renderTechnologyPage;
renderTechnologyPage = function () {
  const html = renderTechnologyPageBranchBase(),
    towns = W.settlements.filter((s) => !s.ruined && s.knownProcesses),
    sections = Object.keys(BRANCHES)
      .map((branch) => {
        const defs = BRANCH_ALL_DEFS.filter((d) => d.branch === branch),
          known = defs.filter((d) => techKnownCount(d.id) > 0).length,
          lead = towns.slice().sort((a, b) => branchKnownCount(b, branch) - branchKnownCount(a, branch) || a.id - b.id)[0],
          rows = defs
            .map((d) => {
              const n = techKnownCount(d.id),
                researching = towns.filter((s) => s.researchFocus === d.id).length,
                status = n ? `${n} town${n === 1 ? "" : "s"}` : `<span class="muted">—</span>`,
                note = n ? "" : ` <span class="muted">${researching ? `${researching} at work` : d.rare ? "rare · needs the thing seen" : `tier ${d.tier}`}</span>`;
              return `<div class="kv"><span>${esc(d.name)}${note}</span><b>${status}</b></div>`;
            })
            .join("");
        return `<div class="subhead">${BRANCHES[branch]} · ${esc(BRANCH_GLOSS[branch])}</div><div class="muted" style="margin-bottom:6px">${known} of ${defs.length} known${lead && branchKnownCount(lead, branch) ? ` · ${legendLink("place", lead.id, esc(lead.name))} leads at tier ${branchTier(lead, branch)}` : ""}</div>${rows}`;
      })
      .join("");
  return `${html}<div class="subhead">The three branches</div><div class="muted">Beyond the spine of the tree, three branches: ${Object.keys(BRANCHES)
    .map((b) => `${BRANCHES[b]} (${esc(BRANCH_GLOSS[b])})`)
    .join(", ")}. Past the sixth tier each runs on in frontier crafts.</div>${sections}`;
};
window.ALIFE_BRANCHES_DEBUG = Object.freeze({
  defs: () => BRANCH_ALL_DEFS.map((d) => ({ id: d.id, name: d.name, branch: d.branch, tier: d.tier, prior: d.prior.slice(), materials: d.materials.slice(), facility: d.facility, threshold: d.threshold, rare: !!d.rare, effects: { ...d.effects } })),
  branchOf,
  effects: (placeId) => ({ ...branchEffects(W.settlements.find((s) => s.id === placeId)) }),
  faction: (factionId, key) => factionBranchEffect(factionId, key),
  preference: (factionId, placeId = 0) => branchPreference(W.factions.find((f) => f.id === factionId), W.settlements.find((s) => s.id === placeId) || null),
  tier: (placeId, branch) => branchTier(W.settlements.find((s) => s.id === placeId), branch),
  gateOpen: (placeId, techId) => {
    const d = BRANCH_BY_ID.get(techId),
      s = W.settlements.find((x) => x.id === placeId);
    return !!d && !!s && (typeof d.gate !== "function" || d.gate(s));
  },
  mastery: () => checkBranchMastery(),
  factory: (placeId) => factoryTempoFactor(W.settlements.find((s) => s.id === placeId)),
  reset: () => {
    BRANCH_EFFECT_CACHE.clear();
    FACTION_EFFECT_CACHE.tick = -1;
  },
});
