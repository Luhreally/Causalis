// HUMAN-READABLE OBSERVATORY, FIELD GUIDE, AND VISUAL CLUTTER BUDGET
const HUMAN_CHEMISTRY = Object.freeze([
  {
    label: "Water-like solvent",
    analogue: "water, blood plasma, and an industrial solvent",
    utility:
      "Carries dissolved matter, enables reactions, hydrates organisms, and fills seas and wetlands.",
    hazard: "Too little causes dehydration; too much can drown land habitats.",
  },
  {
    label: "Breathable oxidizer",
    analogue: "oxygen or another strong electron acceptor",
    utility: "Lets cells release usable energy from food and also supports combustion.",
    hazard: "High concentrations make fire and oxidative tissue damage easier.",
  },
  {
    label: "Dissolved nutrient",
    analogue: "fertilizer salts such as nitrogen and phosphate",
    utility: "Feeds producer growth and supplies scarce building atoms for living tissue.",
    hazard: "Shortage limits ecosystems; excess can drive bloom-and-crash cycles.",
  },
  {
    label: "Living biomass",
    analogue: "proteins, fats, sugars, and humus",
    utility: "Forms edible tissue, soil organic matter, bodies, and flexible building feedstock.",
    hazard: "Dense stores attract consumers and decompose when abandoned.",
  },
  {
    label: "Energy carrier",
    analogue: "ATP, glucose, fuel, or a charged battery",
    utility: "Stores chemical free energy used for movement, repair, growth, and reproduction.",
    hazard: "A body with too little starves even when other matter is present.",
  },
  {
    label: "Structural mineral",
    analogue: "stone, clay, shell mineral, or concrete aggregate",
    utility: "Provides hard terrain and durable material for tools, walls, and foundations.",
    hazard: "Hardness helps construction but makes extraction laborious.",
  },
  {
    label: "Metal-bearing ore",
    analogue: "iron or copper ore",
    utility:
      "A raw mineral that can become stronger tools and conductive structures after processing.",
    hazard: "Usually heavy and not useful until mined and transformed.",
  },
  {
    label: "Catalyst",
    analogue: "an enzyme or industrial catalyst",
    utility:
      "Speeds reactions without being consumed, making metabolism and manufacturing practical.",
    hazard: "The wrong catalyst can accelerate corrosion, toxins, or runaway reactions.",
  },
  {
    label: "Toxin",
    analogue: "poison, heavy metal, or reactive pollutant",
    utility: "Can deter predators or become a weapon, but disrupts regulation in exposed life.",
    hazard: "Accumulation damages tissue and can make a niche uninhabitable.",
  },
  {
    label: "Metabolic waste",
    analogue: "carbon dioxide, urea, sewage, or exhaust",
    utility: "Records spent metabolism and can be recycled by decomposers or later processes.",
    hazard: "Build-up poisons bodies and soils when removal cannot keep pace.",
  },
  {
    label: "Pathogen pattern",
    analogue: "virus, bacterium, parasite, or infectious prion",
    utility: "A self-propagating biological pattern that exploits compatible hosts.",
    hazard: "Raises disease pressure and can spread through crowded populations.",
  },
  {
    label: "Blood-borne scent",
    analogue: "blood, wound fluid, and carrion odor",
    utility: "Marks injury and transfers body matter; predators may use it as a tracking cue.",
    hazard: "Advertises vulnerable prey and can carry pathogens.",
  },
  {
    label: "Alarm pheromone",
    analogue: "fear scent, stress hormone, or warning call",
    utility:
      "Lets nearby organisms inherit information about recent danger without seeing it directly.",
    hazard: "Persistent alarm can suppress feeding and reproduction.",
  },
  {
    label: "Ash mineral",
    analogue: "wood ash and combustion residue",
    utility: "Returns mineral matter after fire and may enrich or alkalize soil.",
    hazard: "Heavy deposits smother growth and signal recent burning.",
  },
  {
    label: "Combustible fuel",
    analogue: "wood, peat, oil, or stored plant resin",
    utility: "Powers hearths and heat-based technology and also stores ecological energy.",
    hazard: "Dry concentrated fuel increases wildfire risk.",
  },
  {
    label: "Atmospheric gas",
    analogue: "nitrogen, carbon dioxide, or an inert carrier gas",
    utility: "Builds the atmosphere and participates in climate and gas-phase chemistry.",
    hazard: "Locally concentrated gas can displace breathable oxidizer.",
  },
  {
    label: "Hereditary code",
    analogue: "DNA or RNA",
    utility:
      "Stores copyable instructions for anatomy, metabolism, senses, and inherited behavior.",
    hazard: "Damage or copying errors can be lethal, neutral, or evolutionary.",
  },
  {
    label: "Cell boundary",
    analogue: "lipid membrane, skin, or a sealed vessel wall",
    utility:
      "Keeps a living chemical network together while controlling exchange with its environment.",
    hazard: "Boundary failure causes loss of regulation and death.",
  },
  {
    label: "Biological pigment",
    analogue: "chlorophyll, melanin, or a dye",
    utility: "Captures light, provides camouflage, communicates, and colors organisms and terrain.",
    hazard: "Some pigments absorb damaging radiation or reveal an organism.",
  },
  {
    label: "Medicinal inhibitor",
    analogue: "antibiotic, antidote, or regulatory drug",
    utility: "Suppresses harmful reactions and pathogens and supports healing.",
    hazard: "Dose and compatibility matter; inhibition can also slow useful biology.",
  },
  {
    label: "Worked metal",
    analogue: "forged iron, bronze, or copper",
    utility: "Makes durable cutting edges, impact tools, fasteners, armor, and conductors.",
    hazard: "Requires ore, heat, skill, and maintenance against corrosion.",
  },
  {
    label: "Ordered crystal",
    analogue: "quartz, salt crystal, or semiconductor crystal",
    utility: "Provides hard edges, optics, storage lattices, and specialized catalytic surfaces.",
    hazard: "Often brittle despite high hardness.",
  },
  {
    label: "Fired ceramic",
    analogue: "pottery, brick, or refractory ceramic",
    utility: "Makes heat-resistant containers, hearths, walls, and kiln parts.",
    hazard: "Brittle under impact and requires controlled high temperature.",
  },
  {
    label: "Dissolved salt",
    analogue: "table salt and mineral ions",
    utility: "Controls fluid balance and supplies ions for nerves, soil, and chemical processing.",
    hazard: "Excess salinity dehydrates organisms and suppresses crops.",
  },
  {
    label: "Acidic solvent",
    analogue: "vinegar, stomach acid, or mineral acid",
    utility: "Dissolves minerals, digests matter, and enables extraction and etching.",
    hazard: "Corrosive outside organisms or vessels adapted to contain it.",
  },
  {
    label: "Basic solvent",
    analogue: "lye, ammonia solution, or alkaline brine",
    utility: "Breaks down fats, alters minerals, and supports complementary chemical pathways.",
    hazard: "Caustic at high concentration.",
  },
  {
    label: "Producer spore",
    analogue: "seed, spore, cyst, or dormant propagule",
    utility:
      "Lets producer lineages disperse, wait through bad conditions, and recolonize habitat.",
    hazard: "Needs the right moisture, temperature, and substrate to establish.",
  },
  {
    label: "Bone-like support",
    analogue: "bone, shell, chitinous plate, or internal strut",
    utility: "Supports larger bodies, protects organs, and transfers muscular force.",
    hazard: "Costs matter to grow and can fracture.",
  },
  {
    label: "Structural fiber",
    analogue: "wood, cellulose, tendon, rope, or cloth",
    utility: "Provides flexible strength for bodies, shelters, handles, cordage, and composites.",
    hazard: "Often flammable and vulnerable to decay.",
  },
  {
    label: "Glass-like solid",
    analogue: "glass, obsidian, or transparent ceramic",
    utility: "Makes sharp edges, windows, vessels, optics, and sealed surfaces.",
    hazard: "Sharp and brittle when fractured.",
  },
  {
    label: "Corrosion product",
    analogue: "rust, tarnish, or weathered scale",
    utility:
      "Shows where metal or minerals reacted with the environment; sometimes becomes pigment or ore.",
    hazard: "Weakens tools and structures if maintenance is neglected.",
  },
  {
    label: "Rare conductor",
    analogue: "copper, graphite, a semiconductor, or a rare-earth material",
    utility:
      "Enables efficient energy transfer, signaling, advanced tools, and specialized devices.",
    hazard: "Scarcity creates strategic pressure and expensive extraction.",
  },
]);
const GUIDE_TOPICS = Object.freeze({
  "reading-world": {
    title: "How to read the living world",
    plain:
      "The ground tiles are habitat, the large rooted forms are persistent ecological structures, and the moving seeded models are individual organisms. Short flashes and motion show action; the compact Scene events panel holds the words.",
    analogue:
      "Think of the map as a nature documentary, GIS map, and colony cutaway sharing one camera.",
    use: "Click a visible organism, building, tool, corpse, or tile. The Inspect tab starts with a plain-language summary; deeper measurements stay folded underneath.",
  },
  temperature: {
    title: "Temperature",
    plain: "Local heat available to bodies, weather, fire, and chemical reactions.",
    analogue: "Degrees Celsius in ordinary weather and engineering terms.",
    use: "It changes comfort, metabolism, evaporation, ignition, and which manufacturing reactions can run.",
    overlay: "temperature",
  },
  liquid: {
    title: "Liquid depth",
    plain: "How much of this world's solvent is standing above or within a tile.",
    analogue: "Water depth, groundwater, puddling, rivers, and flooding.",
    use: "Life needs solvent, but deep liquid excludes land organisms and changes movement and chemistry.",
    overlay: "moisture",
  },
  runoff: {
    title: "Natural waterline and runoff",
    plain: "The waterline is the stable local baseline; runoff is temporary extra liquid above it.",
    analogue: "A floodplain's normal river or groundwater level versus stormwater after rain.",
    use: "This distinction explains whether wet ground is a durable habitat or a passing weather event.",
    overlay: "moisture",
  },
  moisture: {
    title: "Moisture",
    plain: "Biologically available solvent in soil, air, and surface pools.",
    analogue: "Soil moisture and humidity.",
    use: "Controls producer growth, thirst, decomposition, fire spread, and spore establishment.",
    overlay: "moisture",
  },
  fertility: {
    title: "Fertility",
    plain:
      "A combined estimate of nutrients, organic matter, useful catalysts, moisture, and soil structure.",
    analogue: "Agricultural soil quality.",
    use: "High fertility supports producer growth; it is not food by itself.",
    overlay: "fertility",
  },
  food: {
    title: "Food abundance",
    plain: "Edible, accessible chemical energy and biomass for the selected diet.",
    analogue: "Forage, crops, prey, and stored calories.",
    use: "Different organisms read the same tile differently because their diets and tools differ.",
    overlay: "food",
  },
  fire: {
    title: "Fire and smoke",
    plain:
      "Active combustion and its airborne residue. Fire requires heat, oxidizer, and real fuel.",
    analogue: "Wildfire, hearth fire, and smoke exposure.",
    use: "It can clear biomass and enable technology, but damages bodies and structures and consumes fuel.",
    overlay: "fire",
  },
  signals: {
    title: "Blood and fear signals",
    plain: "Short-lived environmental traces left by injury and alarm behavior.",
    analogue: "Blood scent, tracks, distress calls, and pheromones.",
    use: "Predators track them; prey avoid them; memories may outlast the field itself.",
    overlay: "blood",
  },
  disease: {
    title: "Pathogen pressure",
    plain: "The local amount and transmission opportunity of infectious patterns.",
    analogue: "Environmental infection risk.",
    use: "Crowding, wounds, contaminated matter, resistance, and medicine determine whether exposure becomes disease.",
    overlay: "disease",
  },
  danger: {
    title: "Danger",
    plain:
      "A learned and environmental estimate combining predators, combat, fire, disease, and remembered threats.",
    analogue: "A wildlife risk map or public-safety heat map.",
    use: "It guides avoidance and settlement decisions but is not an invisible damage source.",
    overlay: "danger",
  },
  territory: {
    title: "Territory and culture",
    plain: "Political claim strength and the spread of shared behavior, memory, and institutions.",
    analogue: "Borders, influence, language, and civic identity.",
    use: "They affect cooperation, conflict, logistics, and governance without changing the underlying matter.",
    overlay: "territory",
  },
  chemistry: {
    title: "Generated chemistry",
    plain:
      "Every seed creates named matter families and balanced compounds. Alien names are identifiers; the human translation tells you the job each compound performs.",
    analogue:
      "Elements, molecules, metabolism, geology, and industrial materials in one conserved ledger.",
    use: "Click any chemical row for its analogue, properties, family formula, reactions, uses, and hazards.",
    tab: "worldinfo",
  },
  materials: {
    title: "Materials and structure",
    plain:
      "Composition says what matter a thing contains; structure says how that matter is arranged.",
    analogue:
      "The difference between carbon as graphite or diamond, or clay as soil versus fired brick.",
    use: "Hardness, brittleness, conductivity, porosity, and processing determine possible tools and buildings.",
    tab: "worldinfo",
  },
  niches: {
    title: "Ecological niches",
    plain:
      "A niche is a survival opportunity created by food, shelter, temperature, solvent, chemistry, predators, and access.",
    analogue:
      "Forest canopy, cave, reef, hydrothermal vent, mountain ledge, or fertile floodplain.",
    use: "Generated structures alter real habitat fields, so they can support different lineages instead of acting as decoration.",
  },
  health: {
    title: "Health and regulation",
    plain:
      "Health summarizes whether a body can keep its boundary, tissues, temperature, chemistry, and repair processes within survivable ranges.",
    analogue: "Physiological condition rather than a videogame hit-point pool.",
    use: "Open body chemistry and recent causes to see why health changed.",
  },
  energy: {
    title: "Energy and hunger",
    plain:
      "Energy is usable carrier compound inside a body; hunger is the pressure created when that reserve falls.",
    analogue: "ATP and blood glucose backed by stored calories.",
    use: "Food must be compatible, reached, eaten, and metabolized before it becomes usable energy.",
  },
  behavior: {
    title: "Behavior and reasons",
    plain:
      "Behavior is the current chosen action; Why is the strongest need, memory, perception, social pressure, or work demand behind it.",
    analogue: "An animal's immediate decision or a worker's current task.",
    use: "Inspect the sensory controller to see inputs and competing drives instead of treating action as random.",
  },
  cognition: {
    title: "Liquid-time-constant cognition",
    plain:
      "A small recurrent controller integrates senses over several time horizons and ranks possible actions.",
    analogue:
      "A lightweight nervous system with short-term memory, closer to an adaptive control network than human language thought.",
    use: "Live inputs, hidden states, action drives, confidence, reward, and inherited connection weights are inspectable.",
  },
  heredity: {
    title: "Hereditary information",
    plain:
      "The information polymer stores inherited instructions; phenotype is the body and behavior compiled from those instructions in this environment.",
    analogue: "Genotype versus phenotype in biology.",
    use: "Mutation and paired reproduction recombine traits, while survival filters what remains in each niche.",
  },
  civilization: {
    title: "Civilization progression",
    plain:
      "Social life advances only when populations actually gather matter, craft functional tools, build completed structures, preserve knowledge, and form institutions.",
    analogue:
      "From mobile bands through villages, cities, states, and complex terrestrial societies.",
    use: "Open a camp or settlement to inspect workers, stores, construction stages, policy, households, research, and defenses.",
    tab: "worldinfo",
  },
  history: {
    title: "Causal history",
    plain: "The chronicle records changes and links each event to immediate causes and evidence.",
    analogue: "A combined historical archive, incident report, and scientific provenance log.",
    use: "Click a Scene event or History row to trace what happened and why.",
    tab: "chronicle",
  },
});
function humanChem(sp) {
  return (
    HUMAN_CHEMISTRY[sp] || {
      label: titleCase(W.definitions.species[sp]?.role || "Unknown matter"),
      analogue: "no close Earth equivalent",
      utility: "Its function is derived from this world's reaction network.",
      hazard: "Inspect its measured properties and reactions.",
    }
  );
}
function chemSymbol(sp) {
  const s = W.definitions.species[sp];
  if (!s) return `X${sp}`;
  const raw = s.composition
    .slice(0, 2)
    .map(([f, n]) => `${W.definitions.families[f].symbol}${n > 1 ? n : ""}`)
    .join("");
  return raw || `M${sp}`;
}
function qualitative(v, low, high, words = ["low", "moderate", "high"]) {
  return v < low ? words[0] : v > high ? words[2] : words[1];
}
function cleanObservatoryHtml(html) {
  return String(html)
    .replaceAll("\u00e2\u2020\u2019", "\u2192")
    .replaceAll("\u00c2\u00b7", "\u00b7");
}
function familyAnalogue(f) {
  if (f.toxicity > 0.52) return "heavy-metal-like reactive family";
  if (f.catalytic > 0.7) return "transition-metal-like catalyst family";
  if (f.solventAffinity > 0.72) return "polar, salt-forming family";
  if (f.thermal > 1.25 && f.stability > 0.65) return "refractory rock-forming family";
  if (f.energyTransfer > 0.7) return "redox and energy-transfer family";
  return "common rock- or tissue-forming family";
}
function guideTopicButton(key, label = "Explain") {
  return `<button class="small" data-guide-topic="${key}">${esc(label)}</button>`;
}
function humanBiomeAnalogue(name) {
  const b = String(name).toLowerCase();
  if (/swamp|marsh|bog/.test(b)) return "freshwater marsh or wetland";
  if (/deep water|ocean|sea/.test(b)) return "open lake or ocean";
  if (/shallow|shore|coast/.test(b)) return "shoreline or tidal flat";
  if (/desert|arid|dune/.test(b)) return "desert or dry scrub";
  if (/forest|canopy|wood/.test(b)) return "forest or woodland";
  if (/tundra|ice|frost/.test(b)) return "tundra or polar plain";
  if (/mount|highland|ridge/.test(b)) return "mountain or rocky upland";
  if (/grass|plain|meadow/.test(b)) return "grassland or prairie";
  if (/cave|cavern/.test(b)) return "cave or karst system";
  return "mixed terrestrial habitat";
}
function tilePlainCard(i) {
  const biome = featureSpecAt(i)?.name || biomeDisplayName(i),
    temp = W.tiles.temperature[i] / 10,
    moist = tileMoisture(i),
    fert = tileFertility(i),
    food = tileFood(i, "omnivore"),
    danger = W.tiles.danger[i] / 10,
    n = ecologicalNicheAt(i),
    wet = qualitative(moist, 25, 70, ["dry", "moist", "saturated"]),
    heat = qualitative(temp, 8, 31, ["cold", "temperate", "hot"]),
    productive = qualitative(fert, 28, 62, ["sparse", "productive", "lush"]),
    risk = qualitative(danger, 12, 40, ["low-risk", "contested", "dangerous"]),
    support =
      n.shelter > 0.55
        ? "strong natural shelter"
        : food > 18
          ? "abundant accessible food"
          : moist > 65
            ? "reliable solvent"
            : "limited concentrated resources";
  return `<div class="plain-card"><div class="eyebrow">In plain language</div><div class="plain-title">A ${heat}, ${wet}, ${productive} ${esc(biome)} -- functionally closest to a ${esc(humanBiomeAnalogue(biome))}.</div><p>It currently offers ${esc(support)} and reads as ${risk}. Generated names describe alien identity; the measurements below explain the familiar ecological job.</p><div class="plain-actions">${guideTopicButton("niches", "Explain this niche")}${guideTopicButton("chemistry", "Translate chemistry")}<button class="small" data-guide-overlay="fertility">Show fertility</button></div></div>`;
}
function organismPlainCard(id) {
  const k = W.kind[id],
    l = W.components.life[id],
    b = W.components.body[id],
    c = W.components.cognition?.[id],
    role =
      k === KINDS.PREDATOR
        ? "a predator filling a hunter or ambush niche"
        : k === KINDS.HERBIVORE
          ? "a grazer or browser converting producer tissue into animal biomass"
          : k === KINDS.PERSON
            ? "a social tool-user capable of households, work, and culture"
            : "a decomposing body returning matter to the ecosystem",
    state = l
      ? `${qualitative(l.health, 35, 75, ["critical condition", "some physiological strain", "good condition"])} and ${qualitative(l.energy, 25, 68, ["low", "usable", "high"])} energy reserves`
      : "a completed life",
    action = l?.behavior
      ? `${titleCase(l.behavior)} because ${l.behaviorReason || "its controller selected that drive"}`
      : "no current action";
  return `<div class="plain-card"><div class="eyebrow">In plain language</div><div class="plain-title">This is ${esc(role)}.</div><p>Right now it has ${esc(state)}. Current action: ${esc(action)}. Its alien anatomy is novel, but every need below maps to a familiar biological function.</p><div class="plain-actions">${guideTopicButton("behavior", "Explain behavior")}${guideTopicButton("cognition", "Explain its brain")}${guideTopicButton("health", "Explain health")}${guideTopicButton("heredity", "Genes and evolution")}</div></div>`;
}
const chemistryRowsHumanBase = chemistryRows;
chemistryRows = function (q, limit = 10) {
  const rows = [];
  for (let i = 0; i < q.length; i++) if (q[i] > 0) rows.push([i, q[i]]);
  rows.sort((a, b) => b[1] - a[1] || a[0] - b[0]);
  const max = rows[0]?.[1] || 1;
  return (
    rows
      .slice(0, limit)
      .map(([i, v]) => {
        const s = W.definitions.species[i],
          h = humanChem(i);
        return `<button class="chem-row" data-guide-chem="${i}" title="Inspect ${esc(s.name)}: ${esc(h.label)}"><span class="chem-identity"><strong>${esc(s.name)}</strong><small>${esc(h.label)}</small></span><span class="chem-bar"><i style="width:${(v / max) * 100}%;background:${hsl(s.colorHue, 65, 55)}"></i></span><b class="mono">${fmt(v)}</b></button>`;
      })
      .join("") || `<div class="empty">No measurable inventory</div>`
  );
};
const tileInspectorHumanBase = tileInspector;
tileInspector = function (i) {
  let html = tileInspectorHumanBase(i),
    mat = tileMaterial(i),
    labels = {
      Temperature: "temperature",
      "Liquid depth": "liquid",
      "Natural waterline": "runoff",
      "Transient runoff": "runoff",
      Moisture: "moisture",
      Fertility: "fertility",
      "Food abundance": "food",
      "Fire / smoke": "fire",
      "Blood / fear signal": "signals",
      "Pathogen pressure": "disease",
      Danger: "danger",
      Territory: "territory",
      Culture: "territory",
    };
  html = html.replace(/<div class="subhead">/, `${tilePlainCard(i)}<div class="subhead">`);
  for (const [label, key] of Object.entries(labels))
    html = html.replace(
      `<span>${label}</span>`,
      `<button class="explain-link" data-guide-topic="${key}">${label}</button>`,
    );
  const materialName = esc(W.definitions.species[mat.speciesId].name);
  html = html.replace(
    `<span>Composition</span><b>${materialName}</b>`,
    `<button class="explain-link" data-guide-topic="materials">Composition</button><button class="explain-link" data-guide-chem="${mat.speciesId}">${materialName}</button>`,
  );
  return cleanObservatoryHtml(html);
};
const organismInspectorHumanBase = organismInspector;
organismInspector = function (id) {
  let html = organismInspectorHumanBase(id);
  if (!W.components.life[id])
    return cleanObservatoryHtml(
      html +
        `<div class="plain-actions">${guideTopicButton("history", "Open causal history")}${guideTopicButton("chemistry", "Where its matter went")}</div>`,
    );
  html = html.replace(
    `<div class="subhead">Life and causality</div>`,
    `${organismPlainCard(id)}<div class="subhead">Life and causality</div>`,
  );
  const labels = {
    Health: "health",
    Energy: "energy",
    "Hunger / thirst": "energy",
    Behavior: "behavior",
    "Why?": "behavior",
    "Injury / pathogen": "disease",
  };
  for (const [label, key] of Object.entries(labels))
    html = html.replace(
      `<span>${label}</span>`,
      `<button class="explain-link" data-guide-topic="${key}">${label}</button>`,
    );
  return cleanObservatoryHtml(html);
};
const nonLifeInspectorHumanBase = nonLifeInspector;
nonLifeInspector = function (id) {
  let html = nonLifeInspectorHumanBase(id),
    k = W.kind[id],
    label =
      k === KINDS.ARTIFACT
        ? "A physical object whose utility comes from its material, shape, quality, and wear."
        : k === KINDS.SETTLEMENT || k === KINDS.CAMP
          ? "A built place: stored matter, completed rooms, workers, households, and policy all remain inspectable."
          : k === KINDS.CORPSE
            ? "A former organism whose matter now feeds scavengers and decomposition."
            : "A persistent world object with a causal record.";
  return `<div class="plain-card"><div class="eyebrow">In plain language</div><div class="plain-title">${esc(label)}</div><div class="plain-actions">${guideTopicButton(k === KINDS.ARTIFACT ? "materials" : k === KINDS.CORPSE ? "chemistry" : "civilization")}${guideTopicButton("history", "Trace history")}</div></div>${html}`;
};
const refreshWorldInfoHumanBase = refreshWorldInfo;
refreshWorldInfo = function () {
  refreshWorldInfoHumanBase();
  DOM.worldPane.innerHTML = `<div class="plain-card"><div class="eyebrow">World reference</div><div class="plain-title">Alien names preserve this seed's identity. The field guide translates them into familiar physical, biological, and civic jobs.</div><p>The generated chemistry is still authoritative; human analogues are an explanatory lens, not a replacement.</p><div class="plain-actions"><button class="small" data-field-guide>Open matter table and glossary</button>${guideTopicButton("reading-world", "How to read the map")}</div></div>${DOM.worldPane.innerHTML}`;
  for (const f of W.definitions.families)
    DOM.worldPane.innerHTML = DOM.worldPane.innerHTML.replace(
      `<b>${esc(f.name)}</b><span class="tag mono">${esc(f.symbol)}</span>`,
      `<button class="explain-link" data-guide-family="${f.id}">${esc(f.name)}</button><span class="tag mono">${esc(f.symbol)}</span>`,
    );
};
function formulaHtml(sp) {
  const s = W.definitions.species[sp];
  return (
    s.composition
      .map(
        ([f, n]) =>
          `<button class="explain-link" data-guide-family="${f}">${esc(W.definitions.families[f].symbol)}${n > 1 ? n : ""}</button>`,
      )
      .join(" + ") || "Unresolved"
  );
}
function reactionEquation(rx) {
  const side = (xs) =>
    xs.map(([sp, n]) => `${n > 1 ? n + " " : ""}${humanChem(sp).label}`).join(" + ");
  return `${side(rx.reactants)} &rarr; ${side(rx.products)}`;
}
function guideSearchKey(...parts) {
  return esc(parts.join(" ").toLowerCase());
}
function fieldGuideBody() {
  const families = W.definitions.families
      .map(
        (f) =>
          `<div class="guide-card" data-guide-searchable data-guide-key="${guideSearchKey(f.name, f.symbol, familyAnalogue(f))}"><div class="row between"><h4>${esc(f.name)}</h4><span class="tag mono">${esc(f.symbol)}</span></div><p>${esc(familyAnalogue(f))}. Atomic-mass analogue ${f.mass}; ${qualitative(f.stability, 0.4, 0.75)} stability and ${qualitative(f.catalytic, 0.3, 0.7)} catalytic activity.</p><button data-guide-family="${f.id}">Inspect family</button></div>`,
      )
      .join(""),
    compounds = W.definitions.species
      .map((s, sp) => {
        const h = humanChem(sp);
        return `<button class="matter-cell" data-guide-chem="${sp}" data-guide-searchable data-guide-key="${guideSearchKey(s.name, s.role, h.label, h.analogue)}" style="box-shadow:inset 0 2px ${hsl(s.colorHue, 65, 55)}"><span class="cell-id">${sp + 1}</span><span class="symbol">${esc(chemSymbol(sp))}</span><span class="alien-name">${esc(s.name)}</span><span class="human-name">${esc(h.label)}</span></button>`;
      })
      .join(""),
    topics = Object.entries(GUIDE_TOPICS)
      .map(
        ([key, t]) =>
          `<div class="guide-card" data-guide-searchable data-guide-key="${guideSearchKey(t.title, t.plain, t.analogue, t.use)}"><h4>${esc(t.title)}</h4><p>${esc(t.plain)}</p><button data-guide-topic="${key}">Explain and navigate</button></div>`,
      )
      .join("");
  return `<div class="guide-intro"><div><div class="eyebrow">Human-readable reference</div><h3 style="margin:5px 0">This seed's matter, life, and society -- translated</h3><p class="muted" style="line-height:1.55">Alien terms stay unique to the seed. Each entry adds an Earth analogue, practical utility, hazard, and a route back to the relevant map lens or observatory section.</p></div><div class="guide-search"><label class="field"><span>Search names, analogues, or uses</span><input id="guideSearchInput" type="text" placeholder="Try water, wood, disease, shelter..."></label><div class="guide-jumps"><button data-guide-anchor="guide-families">Families</button><button data-guide-anchor="guide-compounds">Compounds</button><button data-guide-anchor="guide-glossary">Glossary</button></div></div></div><div id="guide-families" class="guide-section"><div class="subhead">Fundamental families -- element analogue</div><div class="matter-family-grid">${families}</div></div><div id="guide-compounds" class="guide-section"><div class="subhead">Generated compound table -- click any cell</div><div class="periodic-grid">${compounds}</div></div><div id="guide-glossary" class="guide-section"><div class="subhead">World glossary and navigation</div><div class="glossary-grid">${topics}</div></div>`;
}
function bindGuideSearch() {
  const input = $("#guideSearchInput");
  if (!input) return;
  input.oninput = () => {
    const query = input.value.trim().toLowerCase();
    $$("[data-guide-searchable]", DOM.modalBody).forEach((el) =>
      el.classList.toggle("guide-empty", !!query && !el.dataset.guideKey.includes(query)),
    );
  };
}
function resetModalScroll() {
  if (DOM.modalBox) DOM.modalBox.scrollTop = 0;
}
function showFieldGuide() {
  openModal(
    "Field guide",
    fieldGuideBody(),
    `<button id="closeFieldGuide" class="primary">Return to world</button>`,
    true,
  );
  resetModalScroll();
  $("#closeFieldGuide").onclick = closeModal;
  bindGuideSearch();
}
function showChemicalGuide(sp) {
  sp = Number(sp);
  const s = W.definitions.species[sp],
    h = humanChem(sp);
  if (!s) return;
  const reactions = W.definitions.reactions
      .filter((rx) => rx.reactants.some((x) => x[0] === sp) || rx.products.some((x) => x[0] === sp))
      .slice(0, 12),
    uses = knownUsesForMaterial(sp),
    phase = titleCase(s.phase || "variable"),
    body = `<div class="analogue-hero"><div class="analogue-symbol" style="color:${hsl(s.colorHue, 72, 67)}">${esc(chemSymbol(sp))}</div><div><div class="eyebrow">Compound ${sp + 1} · ${esc(s.role)}</div><h3 style="margin:5px 0">${esc(s.name)}</h3><div class="human-translation">Human translation: ${esc(h.label)}</div><p class="muted" style="line-height:1.5">Closest familiar analogue: ${esc(h.analogue)}.</p></div></div><div class="plain-card"><div class="plain-title">What it does here</div><p>${esc(h.utility)}</p><div class="divider"></div><div class="plain-title">What can go wrong</div><p>${esc(h.hazard)}</p></div><div class="subhead">Measured identity</div><div class="card"><div class="kv"><span>Generated role</span><b>${esc(s.role)}</b><span>Formula families</span><b class="row wrap">${formulaHtml(sp)}</b><span>Phase tendency</span><b>${esc(phase)}</b><span>Mass analogue</span><b>${s.molecularMass}</b><span>Stability</span><b>${s.stability.toFixed(2)} · ${qualitative(s.stability, 0.4, 0.75)}</b><span>Toxicity</span><b>${s.toxicity.toFixed(2)} · ${qualitative(s.toxicity, 0.2, 0.55)}</b><span>Energy value</span><b>${s.freeEnergy.toFixed(2)}</b><span>Catalytic potential</span><b>${s.catalyticPotential.toFixed(2)}</b><span>Known civic uses</span><b>${esc(uses.join(", ") || "not yet discovered in this world's history")}</b></div></div><details><summary>Balanced reactions involving this compound · ${reactions.length}</summary><div>${reactions.map((rx) => `<div class="reaction-row"><b>${esc(titleCase(rx.id.replaceAll("_", " ")))}</b><div class="muted" style="margin-top:3px">${reactionEquation(rx)}</div><small class="muted">Temperature ${rx.minimumTemperature} to ${rx.maximumTemperature}° · ${rx.requiredCatalysts.length ? "catalyst required" : "no catalyst required"}</small></div>`).join("") || `<div class="empty">No common reaction currently references it.</div>`}</div></details>`;
  DOM.modalTitle.textContent = `Matter: ${s.name}`;
  DOM.modalBody.innerHTML = body;
  DOM.modalFoot.innerHTML = `<button data-field-guide>Back to field guide</button><button id="closeChemicalGuide" class="primary">Return to world</button>`;
  resetModalScroll();
  $("#closeChemicalGuide").onclick = closeModal;
}
function showFamilyGuide(id) {
  const f = W.definitions.families[Number(id)];
  if (!f) return;
  const compounds = W.definitions.species.filter((s) =>
    s.composition.some(([family]) => family === f.id),
  );
  DOM.modalTitle.textContent = `Matter family: ${f.name}`;
  DOM.modalBody.innerHTML = `<div class="analogue-hero"><div class="analogue-symbol">${esc(f.symbol)}</div><div><div class="eyebrow">Fundamental family ${f.id + 1}</div><h3 style="margin:5px 0">${esc(f.name)}</h3><div class="human-translation">${esc(familyAnalogue(f))}</div><p class="muted">This is closer to an element family than a finished material. Its usefulness depends on which compounds and structures contain it.</p></div></div><div class="subhead">Physical tendencies</div><div class="card"><div class="kv"><span>Mass analogue</span><b>${f.mass}</b><span>Charge</span><b>${f.charge}</b><span>Bonding capacity</span><b>${f.bonding}</b><span>Bond strength</span><b>${f.bondStrength}</b><span>Geometry</span><b>${esc(f.geometry)}</b><span>Stability</span><b>${f.stability}</b><span>Thermal behavior</span><b>${f.thermal}</b><span>Solvent affinity</span><b>${f.solventAffinity}</b><span>Catalytic activity</span><b>${f.catalytic}</b><span>Toxicity</span><b>${f.toxicity}</b></div></div><div class="subhead">Compounds containing this family · ${compounds.length}</div><div class="periodic-grid">${compounds
    .map((s) => {
      const h = humanChem(s.id);
      return `<button class="matter-cell" data-guide-chem="${s.id}"><span class="cell-id">${s.id + 1}</span><span class="symbol">${esc(chemSymbol(s.id))}</span><span class="alien-name">${esc(s.name)}</span><span class="human-name">${esc(h.label)}</span></button>`;
    })
    .join("")}</div>`;
  DOM.modalFoot.innerHTML = `<button data-field-guide>Back to field guide</button><button id="closeFamilyGuide" class="primary">Return to world</button>`;
  resetModalScroll();
  $("#closeFamilyGuide").onclick = closeModal;
}
function showTopicGuide(key) {
  const t = GUIDE_TOPICS[key];
  if (!t) return;
  DOM.modalTitle.textContent = t.title;
  DOM.modalBody.innerHTML = `<div class="plain-card"><div class="eyebrow">In plain language</div><div class="plain-title">${esc(t.plain)}</div></div><div class="subhead">Closest real-world analogue</div><div class="guide-card"><p>${esc(t.analogue)}</p></div><div class="subhead">Why it matters in the simulation</div><div class="guide-card"><p>${esc(t.use)}</p></div><div class="plain-actions">${t.overlay ? `<button data-guide-overlay="${t.overlay}" class="primary">Show ${esc(titleCase(t.overlay))} lens</button>` : ""}${t.tab ? `<button data-guide-tab="${t.tab}" class="primary">Open relevant observatory section</button>` : ""}<button data-field-guide>Open full glossary</button></div>`;
  DOM.modalFoot.innerHTML = `<button data-field-guide>Back to field guide</button><button id="closeTopicGuide" class="primary">Return to world</button>`;
  resetModalScroll();
  $("#closeTopicGuide").onclick = closeModal;
}
function handleGuideAction(e) {
  const wt = e.target.closest("[data-world-target]"),
    wg = e.target.closest("[data-world-goto]");
  if (wt || wg) {
    if (wt) focusHistoryTarget(Number(wt.dataset.worldTarget), Number(wt.dataset.worldTile ?? -1));
    else focusHistoryTarget(0, Number(wg.dataset.worldGoto));
    if (DOM.modalLayer.classList.contains("open")) closeModal();
    return;
  }
  const chem = e.target.closest("[data-guide-chem]"),
    family = e.target.closest("[data-guide-family]"),
    topic = e.target.closest("[data-guide-topic]"),
    field = e.target.closest("[data-field-guide]"),
    overlay = e.target.closest("[data-guide-overlay]"),
    tab = e.target.closest("[data-guide-tab]"),
    anchor = e.target.closest("[data-guide-anchor]");
  if (chem) {
    if (!DOM.modalLayer.classList.contains("open")) openModal("Field guide", "", "", true);
    showChemicalGuide(chem.dataset.guideChem);
    return true;
  }
  if (family) {
    if (!DOM.modalLayer.classList.contains("open")) openModal("Field guide", "", "", true);
    showFamilyGuide(family.dataset.guideFamily);
    return true;
  }
  if (topic) {
    if (!DOM.modalLayer.classList.contains("open")) openModal("Field guide", "", "", true);
    showTopicGuide(topic.dataset.guideTopic);
    return true;
  }
  if (field) {
    if (!DOM.modalLayer.classList.contains("open")) showFieldGuide();
    else {
      DOM.modalTitle.textContent = "Field guide";
      DOM.modalBody.innerHTML = fieldGuideBody();
      DOM.modalFoot.innerHTML = `<button id="closeFieldGuide" class="primary">Return to world</button>`;
      resetModalScroll();
      $("#closeFieldGuide").onclick = closeModal;
      bindGuideSearch();
    }
    return true;
  }
  if (overlay) {
    closeModal();
    setOverlay(overlay.dataset.guideOverlay);
    toast(`${titleCase(overlay.dataset.guideOverlay)} lens enabled`);
    return true;
  }
  if (tab) {
    closeModal();
    refreshTabs(tab.dataset.guideTab);
    return true;
  }
  if (anchor) {
    document
      .getElementById(anchor.dataset.guideAnchor)
      ?.scrollIntoView({ behavior: "smooth", block: "start" });
    return true;
  }
  return false;
}
function sceneEventLabel(e) {
  const sentence = eventSentence(e);
  return sentence.length > 92 ? sentence.slice(0, 89) + "..." : sentence;
}
function updateSceneFeed() {
  if (!DOM.sceneFeed) return;
  const events = (ACTIVE_COMBAT_STATE?.events || [])
      .filter((x) => x.combat)
      .slice(-3)
      .reverse(),
    key = `${W.seed}|${events.map((x) => x.e.id).join(":")}`;
  if (UI.sceneFeedKey === key) return;
  UI.sceneFeedKey = key;
  if (!events.length) {
    DOM.sceneFeed.classList.add("hidden");
    DOM.sceneFeed.innerHTML = "";
    return;
  }
  DOM.sceneFeed.innerHTML = `<div class="scene-feed-head"><span>Scene events</span><button data-guide-tab="chronicle">History</button></div>${events.map(({ e }) => `<button class="scene-event ${/Kill|Death/.test(e.type) ? "kill" : ""}" data-event="${e.id}"><i class="scene-mark"></i><span>${esc(sceneEventLabel(e))}</span><small>${Math.max(0, W.tick - e.tick)}t ago</small></button>`).join("")}`;
  DOM.sceneFeed.classList.remove("hidden");
}
function focusedCombatEvents(events) {
  events = events.filter((x) => x.combat);
  const focus = new Set([UI.selectedEntity, UI.followId].filter(Boolean)),
    chosen = [],
    seen = new Set();
  for (const item of [
    ...events.filter((x) => x.e.subjects.some((id) => focus.has(id))).slice(-3),
    ...events.slice(-4),
  ])
    if (!seen.has(item.e.id)) {
      seen.add(item.e.id);
      chosen.push(item);
    }
  return chosen.slice(-6);
}
drawCombatEffects = function (now, bounds) {
  const m = ACTIVE_RENDER_METRICS || projectionMetrics(),
    events = focusedCombatEvents(ACTIVE_COMBAT_STATE?.events || []),
    focus = new Set([UI.selectedEntity, UI.followId].filter(Boolean));
  ctx.save();
  for (const item of events) {
    const e = item.e,
      [x, y] = xy(e.location),
      impact = proceduralProjectTile(x + 0.5, y + 0.5, m),
      attacker =
        e.type === "InjuryEvent" ? e.subjects[1] : e.type === "KillEvent" ? e.subjects[0] : 0,
      victim =
        e.type === "InjuryEvent"
          ? e.subjects[0]
          : e.type === "KillEvent"
            ? e.subjects[1]
            : e.subjects[0],
      ap = W.components.position[attacker],
      vp = W.components.position[victim],
      isFocus = e.subjects.some((id) => focus.has(id));
    if (ACTIVE_PREDATION_IDS.has(attacker) || ACTIVE_PREDATION_IDS.has(victim)) continue;
    if (item.combat && ap && vp && events.indexOf(item) >= Math.max(0, events.length - 3)) {
      const a = W.components.genome[attacker]
          ? visualAnchor(attacker, ap, m, now).s
          : proceduralProjectTile(ap.x + 0.5, ap.y + 0.5, m),
        v = W.components.genome[victim]
          ? visualAnchor(victim, vp, m, now).s
          : proceduralProjectTile(vp.x + 0.5, vp.y + 0.5, m),
        lift = clamp(m.tw * 0.24, 9, 30);
      ctx.globalAlpha = 0.45 + 0.35 * item.fade;
      ctx.strokeStyle = W.components.social[attacker]?.factionId
        ? W.factions.find((f) => f.id === W.components.social[attacker].factionId)?.color ||
          "#f0cf8d"
        : "#f0cf8d";
      ctx.lineWidth = clamp(m.tw * 0.04, 1.2, 3.2);
      ctx.beginPath();
      ctx.moveTo(lerp(a.x, v.x, 0.22), lerp(a.y, v.y, 0.22));
      ctx.quadraticCurveTo(lerp(a.x, v.x, 0.55), Math.min(a.y, v.y) - lift, v.x, v.y);
      ctx.stroke();
    }
    ctx.globalAlpha = 0.65 + 0.35 * item.fade;
    drawImpactBurst(impact, item, now, { ...m, tw: Math.min(m.tw, 38) });
    if (isFocus && UI.camera.zoom > 5) {
      const label = /Kill|Death/.test(e.type)
        ? "KILL"
        : e.type === "InjuryEvent"
          ? "HIT"
          : "CONFLICT";
      ctx.font = "800 9px system-ui";
      ctx.textAlign = "center";
      ctx.fillStyle = "#fff1d4";
      ctx.fillText(label, impact.x, impact.y - clamp(m.tw * 0.38, 12, 28));
    }
  }
  const wounded = W.activeIds
    .filter((id) => {
      const l = W.components.life[id],
        p = W.components.position[id];
      return (
        l?.wounded &&
        p &&
        p.x >= bounds.x0 - 2 &&
        p.x <= bounds.x1 + 2 &&
        p.y >= bounds.y0 - 2 &&
        p.y <= bounds.y1 + 2
      );
    })
    .sort(
      (a, b) =>
        (focus.has(b) ? 1 : 0) - (focus.has(a) ? 1 : 0) ||
        derivedLife(a).health - derivedLife(b).health,
    )
    .slice(0, focus.size ? 4 : 3);
  for (const id of wounded) {
    const p = W.components.position[id],
      s = W.components.genome[id]
        ? visualAnchor(id, p, m, now).s
        : proceduralProjectTile(p.x + 0.5, p.y + 0.5, m),
      health = clamp(derivedLife(id).health / 100, 0, 1),
      r = clamp(m.tw * 0.24, 5, 22),
      off = Math.max(r * 1.25, m.tw * 0.5);
    ctx.globalAlpha = focus.has(id) ? 1 : 0.72;
    ctx.fillStyle = "#071016d8";
    ctx.fillRect(s.x - r, s.y - off, r * 2, 4);
    ctx.fillStyle = health > 0.5 ? "#d99c66" : "#e05f5a";
    ctx.fillRect(s.x - r, s.y - off, r * 2 * health, 4);
  }
  ctx.restore();
  updateSceneFeed();
};
const drawRealtimePredationClutterBase = drawRealtimePredation;
drawRealtimePredation = function (now, bounds) {
  const valid = (UI.combatVisuals || []).filter(
      (v) => v.world === W && now - v.started < v.duration,
    ),
    focus = new Set([UI.selectedEntity, UI.followId].filter(Boolean)),
    picked = [],
    seen = new Set();
  const clutterCap = W.activeWars?.some((w) => !w.ended) ? 6 : 3;
  for (const v of [
    ...valid.filter((v) => focus.has(v.attacker) || focus.has(v.victim)).slice(-2),
    ...valid.slice(-(clutterCap - 1)),
  ])
    if (!seen.has(v.eventId)) {
      seen.add(v.eventId);
      picked.push(v);
    }
  UI.combatVisuals = picked.slice(-clutterCap);
  drawRealtimePredationClutterBase(now, bounds);
};
const makeCombatVisualStateReadableBase = makeCombatVisualState;
makeCombatVisualState = function (bounds) {
  const state = makeCombatVisualStateReadableBase(bounds);
  state.events = state.events.filter((item) => item.combat || item.death);
  state.actors = new Map();
  for (const item of state.events) {
    const e = item.e;
    for (let n = 0; n < e.subjects.length; n++) {
      const id = e.subjects[n];
      if (id)
        state.actors.set(id, {
          event: e,
          role:
            e.type === "InjuryEvent"
              ? n
                ? "attacker"
                : "victim"
              : e.type === "KillEvent"
                ? n
                  ? "victim"
                  : "attacker"
                : "fallen",
        });
    }
  }
  return state;
};
const drawEcologicalStructureReadableBase = drawEcologicalStructure,
  drawStructureIdentityReadableBase = drawStructureIdentity;
drawEcologicalStructure = drawEcologicalStructureReadableBase;
drawStructureIdentity = drawStructureIdentityReadableBase;
function resetObservatoryScroll() {
  const scroll = DOM.rightPanel?.querySelector?.(".side-scroll");
  if (scroll) scroll.scrollTop = 0;
}
const refreshTabsReadableBase = refreshTabs;
refreshTabs = function (tab) {
  const changed = UI.activeTab !== tab;
  refreshTabsReadableBase(tab);
  if (changed) resetObservatoryScroll();
};
const selectTileReadableBase = selectTile,
  selectEntityReadableBase = selectEntity;
selectTile = function (tile) {
  selectTileReadableBase(tile);
  resetObservatoryScroll();
};
selectEntity = function (id) {
  selectEntityReadableBase(id);
  resetObservatoryScroll();
};
const cacheDomFieldGuideBase = cacheDom;
cacheDom = function () {
  cacheDomFieldGuideBase();
  DOM.sceneFeed = document.getElementById("sceneFeed");
  DOM.fieldGuideBtn = document.getElementById("fieldGuideBtn");
};
const bindUICausalSkipBase = bindUI;
bindUI = function () {
  bindUICausalSkipBase();
  DOM.causalSkipBtn.onclick = () => causalSkipForward();
};
const bindUIFieldGuideBase = bindUI;
bindUI = function () {
  bindUIFieldGuideBase();
  DOM.fieldGuideBtn.onclick = showFieldGuide;
  DOM.rightPanel.addEventListener("click", handleGuideAction);
  DOM.modalBody.addEventListener("click", handleGuideAction);
  DOM.modalFoot.addEventListener("click", handleGuideAction);
  DOM.stage.addEventListener("click", (e) => {
    const ev = e.target.closest("[data-event]");
    if (ev) {
      UI.selectedEvent = Number(ev.dataset.event);
      refreshTabs("chronicle");
      return;
    }
    handleGuideAction(e);
  });
  window.addEventListener("keydown", (e) => {
    if (
      e.key.toLowerCase() === "g" &&
      !e.ctrlKey &&
      !e.metaKey &&
      !e.altKey &&
      !e.target.matches("input,textarea,select") &&
      !DOM.modalLayer.classList.contains("open")
    ) {
      e.preventDefault();
      showFieldGuide();
    }
  });
};
function bindCameraUI() {
  DOM.zoomOutBtn.onclick = () => zoomCamera(1 / 1.5);
  DOM.zoomInBtn.onclick = () => zoomCamera(1.5);
  DOM.centerCameraBtn.onclick = () => centerCamera();
  DOM.rotateLeftBtn.onclick = () => orbitCameraEased(-Math.PI / 12);
  DOM.rotateRightBtn.onclick = () => orbitCameraEased(Math.PI / 12);
  DOM.cameraModeLabel.onclick = () => setView("oblique");
  DOM.tiltRange.oninput = (e) => {
    if (UI.view !== "oblique") setView("oblique");
    UI.camera.tilt = clamp(Number(e.target.value), 0.22, 1);
    refreshCameraControls();
  };
  DOM.edgeScrollToggle.onchange = (e) => {
    UI.camera.edgeScroll = !!e.target.checked;
    UI.cameraMotion.x = 0;
    UI.cameraMotion.y = 0;
  };
  DOM.interiorBtn.onclick = () => toggleCutaway();
  DOM.canvas.addEventListener("pointerenter", () => (UI.pointerInside = true));
  DOM.canvas.addEventListener("pointerleave", () => {
    UI.pointerInside = false;
    UI.cameraMotion.x = 0;
    UI.cameraMotion.y = 0;
  });
  refreshCameraControls();
  window.addEventListener("keyup", handleKeyUp);
  window.addEventListener("blur", () => {
    UI.keys.clear();
    UI.cameraMotion = { x: 0, y: 0, orbit: 0, tilt: 0 };
  });
}
function runSimulationClock(dt, budgetMs = null) {
  if (!W || !UI.running || UI.clockInterrupted) return 0;
  accumulator += dt * UI.speed;
  const warp = UI.speed >= 128,
    fast = UI.speed >= 64,
    budget = budgetMs ?? (warp ? 42 : fast ? 24 : UI.speed >= 16 ? 18 : 10),
    started = performance.now(),
    maxSteps = warp ? 512 : fast ? 256 : UI.speed >= 16 ? 128 : 48;
  let steps = 0;
  while (accumulator >= 100 && steps < maxSteps && UI.running && !UI.clockInterrupted) {
    simTick();
    accumulator -= 100;
    steps++;
    if (steps % 4 === 0 && performance.now() - started >= budget) break;
  }
  if (UI.clockInterrupted) accumulator = 0;
  else {
    const maxBacklog = maxSteps * 300;
    if (accumulator > maxBacklog) accumulator = maxBacklog;
  }
  return steps;
}
function mainLoop(now) {
  if (!frameTime) frameTime = now;
  const dt = Math.min(250, now - frameTime);
  frameTime = now;
  updateCameraKeys(dt);
  runSimulationClock(dt);
  if (W && !DOM.game.classList.contains("hidden")) {
    const interval =
      UI.speed >= 128
        ? 160
        : UI.speed >= 64
          ? 100
          : UI.speed >= 16
            ? 50
            : UI.quality === "low"
              ? 50
              : UI.quality === "high"
                ? 20
                : 33;
    if (now - UI.lastRender >= interval) renderWorld(now);
    const refreshInterval =
      UI.speed >= 128 ? 1100 : UI.speed >= 64 ? 750 : UI.speed >= 16 ? 400 : 240;
    if (now - (UI.lastRefreshTime || 0) > refreshInterval) {
      refreshUI();
      UI.lastRefreshTime = now;
    }
  }
  requestAnimationFrame(mainLoop);
}
