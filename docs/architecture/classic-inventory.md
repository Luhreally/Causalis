# Classic → Universe: feature inventory

What every Classic Causalis section did (the 185 files in `src/game/sections/`), set against Causalis Universe as it stands on 2026-10-25, so "all the original causalis had in this game" becomes an ordered work-down list.
Status was judged by reading each Classic section's header, then looking for Universe code that does the same thing (grep and file headers across `universe/src/`, plus the phase notes); Phase 50's uncommitted making chain (`host/chain.ts`, `rules/stuffs.ts`) is counted.
**in** = Universe code found doing it (in the simulation, or drawn by the views where seeing it is the point); **partial** = some of it, with the missing part named; **missing** = nothing found; **n/a** = Classic engine plumbing or a Classic-only fix that Universe's architecture (people kept as counts, the kernel, the worker host) makes unnecessary.
Universe paths are relative to `universe/src/`. Keep one thing in mind: Universe keeps people as counts by land. Individuals exist only under the god's hand (`sim/hand/hand.ts`) and as people met (`causal/observer.ts`), and a town's day is drawn from history by the views. That is why many Classic per-person systems show up below as partial: you can see them, but nobody is simulated one by one.

| Area | in | partial | missing | n/a |
|---|---|---|---|---|
| World & ground | 2 | 9 | 0 | 1 |
| Life & creatures | 3 | 5 | 0 | 0 |
| People & minds | 3 | 7 | 7 | 3 |
| Households, towns & building | 13 | 7 | 2 | 11 |
| Farming, crafts & industry | 10 | 7 | 0 | 1 |
| Trade, wealth & markets | 2 | 6 | 0 | 1 |
| Politics, diplomacy & law | 2 | 6 | 0 | 0 |
| War | 5 | 6 | 0 | 0 |
| Faith, culture, language & lore | 1 | 3 | 0 | 0 |
| History, legends & records | 5 | 3 | 1 | 0 |
| God's acts & player tools | 1 | 3 | 2 | 3 |
| Observation UI & lenses | 15 | 1 | 2 | 2 |
| Space | 3 | 0 | 0 | 1 |
| Engine, performance & saves | 1 | 0 | 0 | 19 |
| **All 185 sections** | **66** | **63** | **14** | **42** |

## World & ground

| Classic | What it did | Universe | Where / what's missing |
|---|---|---|---|
| 06 World generation | Per-seed world laws, an invented chemistry of ten matter families, terrain grammar, rivers, basins, salt flats, volcanic heat | **partial** | Plates, relief, rivers, climate, deposits and deep time go deeper here (`gen/`), and worlds are made by star, pull, orbit, seas and air (`rules/making.ts`). Missing: per-world laws (plant efficiency, combustion, hardness…) and a chemistry of the world's own |
| 07 Tile world | Each tile's moisture, fertility, food, smoke, disease, blood, fear, materials, phases and live reactions | **partial** | A region tile has ground, weather, water, soil and ore (`ui/region-panel.ts`, `gen/region.ts`). Missing: smoke, blood and fear signals, phases and reactions per tile |
| 08 Environment fields | Heat and moisture spreading tile to tile every tick | **partial** | Warmth and rain per cell come from the energy balance and shift as the world warms (`gen/climate.ts`, `sim/climate/air.ts`). Missing: fields that spread tick by tick |
| 13 Processes | Balanced reactions run on tiles, bodies and stores; matter and energy audited | **partial** | Real substances and balanced reactions as data and pages (`rules/matter.ts`, `host/inspect/matter.ts`). Missing: the sim moves goods, not substances, and nothing audits conservation |
| 17 Physical substrate | Weather cycle, lightning that ignites, fire, surface water, the sky breathing | **partial** | Dry years and droughts (`sim/population/systems.ts`), weather played up close from the climate (`view/weather.ts`, Phase 30), rivers and lakes (`gen/hydrology.ts`). Missing: fire that catches and spreads, lightning strikes, water that rises and falls |
| 19 Plant ecology | Plants grow and spread tile by tile from the ground's matter | **partial** | Forest, wild food and soil as stocks per land that heal (`sim/ecology/ecology.ts`); grass grown and grazed in the meadow (`view/meadow.ts`). Missing: plants growing tile by tile through history |
| 46 Living world | Seasons from axial tilt, paths worn by feet, a new Voice on a death, eruptions, quakes and meteors, omens | **partial** | Seasons (`view/seasons.ts`, `view/weather.ts`), successions (`sim/polity/polity.ts`) and omens read by faiths (`sim/belief/belief.ts`) are in. Missing: paths worn by feet, and natural disasters (only the god's exist, `sim/acts/disasters.ts`) |
| 80 Provision | Laid pigment and polymer seams within reach so every world could learn letters | **n/a** | A Classic fix. Universe's deposits come from geology (`gen/deposits.ts`) and writing does not wait on pigment |
| 91 The long afternoon | Industry strains the sky; ways of rule; orbital stations; an epilogue | **in** | Carbon from burning and clearing warms the world and moves rain (`sim/climate/air.ts`); institutions and laws (`sim/polity/polity.ts`, `sim/order/laws.ts`); stations (`sim/space/space.ts`) |
| 93 Day and night | A slow day with dusk and night; people sleep, labour stops | **in** | Daylight by the hour (`render/stage.ts`); folk asleep at home at night (`view/village.ts`). Drawn, not simulated |
| 113 Grove and crag | Tree species by ground, autumn colour, bare winter boughs, crags with lit faces, ground grain | **partial** | Conifer, broadleaf, palm and scrub (`render/village.ts`, `view/region.ts`). Missing: birch, willow and baobab kinds, autumn and bare trees, crags and strata |
| 119 Living grove | Forests seed outward, saplings grow or wither, fruit in season, trees die back in drought | **partial** | Saplings grow beside felled stumps (the woodlot, Phase 41) and orchards fruit (`view/country.ts`). Missing: forests that spread, wither and die back |

## Life & creatures

| Classic | What it did | Universe | Where / what's missing |
|---|---|---|---|
| 20 Artificial life | Life emerges from chemistry, founders seeded, the biosphere kept alive | **in** | Life's history from the first cells (`gen/evolution.ts`, Phase 17), played in the genesis and the meadow (`view/genesis.ts`, `view/meadow.ts`, Phases 24 and 27) |
| 21 Perception & behaviour | Each creature senses, feeds, drinks, hunts, scavenges, gathers and socialises | **partial** | Seen in the meadow and around villages, where hunters stalk and scavengers trail (`view/meadow.ts`, `view/fauna.ts`). Missing: creatures choosing for themselves in the running world |
| 22 Health, disease, death | Infection, lifespan, death causes, corpses that decay back into the ground | **partial** | Sickness goes much deeper (`sim/health/health.ts`, Phase 20); deaths come from life tables. Missing: injuries, and corpses that lie and decay |
| 23 Reproduction & evolution | Offspring inherit a mutated genome; lineages evolve as you watch | **partial** | Lineages evolve over deep time (`gen/evolution.ts`), and traits pass to children under the hand (`sim/hand/hand.ts`). Missing: evolution during history |
| 24 Memory & social | Fear memories of places that steer behaviour; social cohesion | **partial** | People met have memories drawn from history (`causal/observer.ts`, `causal/biography.ts`). Missing: memories that change what anyone does |
| 32c Creature visuals | Procedural creature models from the genome | **in** | Bodies built from each lineage's plan (`view/creature.ts`, Phase 9) |
| 40 Sentience continuity | Thinking life can't be stranded; wild kin uplifted; parallel peoples | **partial** | One people rises to thought on a living world (`gen/civilizations.ts`, `sim/population/world.ts`). Missing: two thinking peoples on one world, and wild kin uplifted |
| 104 Fauna | Side-view beasts with gait, faces and a kind per lineage | **in** | `view/creature.ts`, `view/fauna.ts`, `render/fauna.ts` (Phases 8–9) |

## People & minds

| Classic | What it did | Universe | Where / what's missing |
|---|---|---|---|
| 30b Society cognition | A small neural controller in every person biases each behaviour | **missing** | People are counts by land, so there are no minds |
| 42b Emotions & relationships | Measured emotions, love, betrayal and revenge, shown as emoji | **missing** | The signs over villagers' heads show the year's mood, not each person's (`view/village.ts`) |
| 51 Character | Traits from the genome, one want at a time, eight skills to master | **partial** | Ten traits for people under the hand and people met (`sim/hand/hand.ts`, `host/inspect/folk.ts`); ways of being the god can set (`sim/acts/natures.ts`). Missing: wants, and skills that grow from doing |
| 53 Bonds | Friends, rivals, quarrels and feuds between houses | **missing** | — |
| 60 Lore | A person's story in prose, wherever you click them | **in** | The person page: life, family, moves, memories (`host/inspect/settled.ts`, `causal/biography.ts`); their day told (`ui/day.ts`, Phase 45); their origins (`host/inspect/thread.ts`) |
| 62 Liquid mind | A liquid time-constant network in the genome; a Mind card | **missing** | — |
| 65 Dynasties | Houses, family trees, the Voices each house held | **partial** | Rulers keep their family name when an heir takes the seat by birth, and each realm lists them (`sim/polity/polity.ts`, `host/inspect/realm.ts`); family trees for people under the hand (`host/inspect/folk.ts`). Missing: a registry of houses with their trees |
| 75 Temptation | Courtship that becomes partnership; affairs | **missing** | — |
| 76 Mating | Coupling by choice: partner first, then a lover, never kin | **partial** | Under the hand, children are born to couples the sim pairs (`sim/hand/hand.ts`). Missing: choosing a partner, lovers, affairs |
| 77 Heartlines | Lines between lovers on the map; children of secret affairs | **missing** | — |
| 78 Instinct | Inherited instincts; hunger drives eating carrion and the dead, and robbery | **missing** | — |
| 94 Figures | Poses for work (kneel, carry, sit, fight); dress by standing and era | **in** | Work motions (`view/motion.ts`); dress by era and group (`view/dress.ts`), though not by wealth |
| 102 Presence | Taller figures, tools in hand, hair, torches at night | **partial** | Tools carried and held (`view/work.ts`); hair and faces (`view/detail.ts`). Missing: torches carried at night |
| 111 Steady feet & cars | Walkers that don't jitter; motor freight on the roads | **in** | Smooth walkers (`view/presence.ts`); carts, trucks and trains as busy as trade (`render/landtraffic.ts`, Phase 26) |
| 132 Cradle | The widowed love again; towns keep bearing children | **n/a** | A birth-rate fix. Universe's births come from life tables |
| 141 Settled intent | The inspector shows what a life is steadily doing, not each tick's flicker | **n/a** | Universe's day is a pure function of time, so nothing flickers |
| 146 Steady steps | Walkers don't step straight back | **n/a** | A walking fix for Classic's agents |
| 148 Address | Where a person lives: the home, its owner, the rent, the household | **partial** | The person page names their town (`host/inspect/settled.ts`). Missing: the house, its owner and the rent |
| 152 Conversation | Mood, stress, loneliness and standing; what people say to each other | **partial** | Rings of talk, hot words and brawls where grievance runs high (`view/village.ts`). Missing: mood kept for each person and passed between people |
| 153 First aid | Helpers chosen by kin, clinic care, field medics | **partial** | Healers spare a share of the sick (`sim/health/health.ts`); brigades turn out when the god strikes a town (Phase 42). Missing: carers for the hurt, clinics for wounds, field medics |

## Households, towns & building

| Classic | What it did | Universe | Where / what's missing |
|---|---|---|---|
| 25 Camps & settlements | Camps and towns with their food, water and defence; ruin | **in** | Settlements (`sim/population/stores.ts`); camps (`host/camp.ts`, Phases 28–29) |
| 30a Society places | Stages, crafts, buildings, plans, camps and towns | **in** | Buildings raised by need and knowledge (`rules/buildings.ts`, `sim/town/fabric.ts`, Phase 23); stages (`host/inspect/stage.ts`) |
| 30d Labour | Hands assigned to work; buildings kept up | **partial** | Work counted by occupation (`sim/population/model.ts`); homes wear out and are rebuilt (`sim/town/fabric.ts`); a day's errands drawn (`view/errands.ts`, Phase 39). Missing: hands assigned to sites, and upkeep as work |
| 32e Architecture render | Palettes, footprints, roofs, function marks, sites going up | **in** | Homes in their designs, rising inside scaffolds (`view/town.ts`, `render/town.ts`) |
| 32f Interiors | Cutaway homes: furniture, and who is inside | **missing** | — |
| 32g Town render | Work at its faces; the place itself | **in** | `render/work.ts`; trades at their buildings (`render/trades.ts`, Phase 41) |
| 52 Living society | Monuments, caravans that walk, wildlife lives, petty crime and captives | **partial** | Traders on the road (`view/trade.ts`, Phase 48); captives (`sim/order/order.ts`). Missing: monuments, dens and beasts of legend, theft and exile |
| 68 Expansion | Settlers found new camps; caps scale with the map | **in** | Bands spread and towns are founded (`sim/population/systems.ts`); the god can send settlers (`sim/acts/peoples.ts`) |
| 82 Granary | Farms scale with mouths, rations stretch, relief comes, the hungry move, births slow | **in** | Stores, fertility that follows how well fed, relief by trade, moves away from hunger (`sim/population/systems.ts`, `sim/economy/systems.ts`) |
| 83 Aftermath | Ruins resettled, refugees walk to friends, thinned towns colonised | **partial** | People leave hungry or war-torn lands (`sim/population/systems.ts`). Missing: ruins resettled, colonists sent to thinned towns |
| 84 Horizons | History's thresholds scale with the map's size | **n/a** | A Classic gate fix |
| 92 Townscape | Street patterns, a square, quarters, building families including alien forms | **in** | Lanes, grids and rings around a square, lot by lot (`sim/town/fabric.ts`, `bridge/town.ts`); designs by body plan and land, such as hives and burrows (`rules/designs.ts`) |
| 95 Cities & tenements | Engines before ships; tenements for crowded cities | **in** | Tenements are a home level (`rules/buildings.ts`) |
| 96 Solid world | Roads drawn in one stroke; bodies stay out of walls | **in** | Solids and routes (`view/ground.ts`, `view/streets.ts`); the land's ways (`view/land.ts`) |
| 103 Skyline | Buildings at true size; tower blocks and offices | **in** | Blocks, high-rises and offices (`rules/buildings.ts`, `view/town.ts`) |
| 105 Ghost towns | Fallen towns stand empty, weather and fall to rubble | **in** | Homes let fall, ruins weathering away, towns forsaken (`sim/town/fabric.ts`) |
| 108 Urban pull | Villagers move to the realm's great town | **partial** | People move toward better land (`migrateYear` in `sim/population/systems.ts`), and market towns become cities (`sim/city/city.ts`). Missing: the pull toward the realm's great town |
| 109 Fields of the city | A farm per six people; halls at letters | **n/a** | A Classic cap fix |
| 112 Tribes | Tents, roundhouses, fire pits, storage pits, racks, pit kilns, palisades, spirit posts, middens, canoes | **partial** | Tents ringed around a fire (`render/landcamps.ts`); band crafts (`view/band.ts`, Phase 49); huts as the first home level; a palisade around a seat in battle. Missing: storage pits, drying racks, pit kilns, spirit posts, middens and dugouts in a tribal village |
| 117 Granary call | The hungry walk home to a fed store | **n/a** | A food-reach fix. Universe feeds a land from its store |
| 118 Common fields | Neighbours reap ripe fields that would rot | **n/a** | A field-access fix |
| 120 Continuing world | A gentler birth pace once the gate is passed | **n/a** | A balance fix |
| 121 Lived-in city | Each bed has an address and each home a household; rent, eviction, floor plans | **partial** | A family's door opens on its street (`view/village.ts`); land tenure is law (`sim/order/laws.ts`). Missing: rent, landlords, eviction, homes held by households in the sim |
| 122 Public streets | Buses carry real riders on built links | **missing** | — |
| 124 Sidewalks | A street graph that walkers keep to | **in** | The walkers' street graph (`view/streets.ts`, Phase 23) |
| 125 Zoning | Quarters: a civic heart, commerce, homes, works, fields | **in** | City blocks put to use by what they're worth (`sim/city/city.ts`); lots laid from the square outward (`sim/town/fabric.ts`) |
| 128 Open ground | Launch tower sited outside a full city | **n/a** | A siting fix |
| 133 Hearth | A town's rations reach as far as its streets | **n/a** | A food-reach fix |
| 135 Hinterland | Fields past the seventh tile; a starving town takes in no strangers | **n/a** | A field-reach fix |
| 136 Ferry | Roads cross the water | **n/a** | Universe joins lands by sea routes (`sim/economy/sea.ts`) |
| 137 Field | The effort supplies farms left waiting | **n/a** | A fix for the Causal skip |
| 138 Field gates | People cross field gates; where a second city goes | **n/a** | A movement and siting fix |
| 155 Streets | Cars owned and driven to work; streets worn into being; crowds | **partial** | Traffic on the land's ways (`render/landtraffic.ts`); crowds at one figure per 12 folk (Phase 45). Missing: household cars, the drive to work, streets worn by feet |

## Farming, crafts & industry

| Classic | What it did | Universe | Where / what's missing |
|---|---|---|---|
| 18 Material resources | Tool quality from its head and its maker; extraction from the ground | **partial** | Tools are headed with the metal a land's crafters actually made them of, from what its market holds (`toolMetal`, `forgedMetal`, `sim/economy/systems.ts`, Phase 52); ore's grade sets what smelting yields (`sim/economy/ore.ts`); Phase 50 tells each thing's quality (`host/chain.ts`, `rules/stuffs.ts`), and arms' quality counts in battle (`sim/war/arms.ts`). Missing: a tool's quality changing what it yields |
| 27 Technology & discovery | Crafts found from what is seen nearby; artifacts made | **in** | Principles are found where the land allows (`sim/lore/lore.ts`). Named artifacts are missing |
| 30c Work | Personal tools by recipe, work orders, stores, salvage, research samples | **partial** | Stores by good (`host/inspect/stores.ts`) and the errands that move them (`view/errands.ts`). Missing: each person's tools by recipe, work orders and priorities, salvage |
| 30e Production | Facilities run, smelting, civic production | **partial** | Crafters make goods for each land (`sim/economy/systems.ts`), smelting copper, tin and iron from ore within reach as a step of their own, the metal then worked into tools and arms (Phase 52); works and what drives them (`sim/design/design.ts`); trades drawn at work (`render/trades.ts`). Missing: buildings that produce on their own |
| 30f Technology | Research, shared knowledge, stage gates, epochs | **in** | `sim/lore/lore.ts`, `rules/principles.ts`, `host/inspect/stage.ts` |
| 42 Environment & armament | Harvest uses up features; groves regrow while minerals run out; weapons emerge | **partial** | Wild, forest and soil drawn down and healing (`sim/ecology/ecology.ts`); arms from the metals the seat's market holds — smelted within reach or brought by road — their kit worn out and drawn again from the markets, and counted in battle by what they are made of (`sim/design/design.ts`, `sim/war/arms.ts`, Phase 52). Missing: ores that run out |
| 42d Agriculture & herding | Fields as tile chemistry, herds in pens, defence against predators, herd theft | **partial** | Fields sown and reaped, flocks folded and culled (`view/fields.ts`, `view/flock.ts`); predators take flocks (`sim/ecology/ecology.ts`). Missing: herders defending flocks, herds stolen in war |
| 61 Item models | Procedural models for tools, weapons and armour; glyphs for compounds | **partial** | A trade's tool in hand on portraits (`ui/portrait.ts`); tools by material (`view/detail.ts`). Missing: models by recipe, quality and wear; compound glyphs |
| 86 Harvest | Yields follow the tending and the water; ripeness | **in** | Harvests by soil, rain, tools and knowledge (`sim/population/systems.ts`); reaping row by row (`view/fields.ts`, Phase 44) |
| 87 The long tree | Sixteen middle and late crafts with real effects | **in** | 91 principles with effects (`rules/principles.ts`) |
| 98 Industry | Rails carry, factories smelt, knowledge travels | **in** | Railways, factories and engines are principles with effects; knowledge travels along roads (`sim/lore/lore.ts`) |
| 106 Wide tree | Three branches, sixty crafts, rare crafts from events seen | **partial** | One tree of 91 principles. Missing: named branches; crafts opened by having seen a quake or a fallen star; repeatable crafts |
| 115 Foundry | Builders draw metal from the stores | **n/a** | A fix for a missing causal link in Classic |
| 116 Farmland | Field bounds, orchards, sheds, silos, tractors, frost, stock at pasture | **in** | `view/country.ts`, `render/country.ts` (Phase 32) |
| 126 Irrigation | Water carried to the fields | **in** | Irrigation as a principle that raises yields (`rules/principles.ts`); fields watered in drought (`view/fields.ts`) |
| 134 Muck | The town's waste goes back to the fields | **in** | Soil wears out unless it is rested or dunged (`sim/ecology/ecology.ts`); manuring as a principle |
| 151 Machine farm | Industrial crafts raise yields | **in** | Machine and engine gains (`sim/economy/systems.ts`); tractors (`view/country.ts`) |
| 163 Husbandry | Herds feed their towns | **in** | Meat, milk, wool and hides from flocks (`rules/goods.ts`, `sim/economy/systems.ts`); culls and lambs (`view/flock.ts`, Phase 46) |

## Trade, wealth & markets

| Classic | What it did | Universe | Where / what's missing |
|---|---|---|---|
| 41 Implicit society | Barter, trade routes, institutions seen in behaviour, militias | **in** | Markets, prices and trade by land (`sim/economy/market.ts`, `sim/economy/systems.ts`); interest groups (`sim/polity/interests.ts`); armies (`sim/war/war.ts`) |
| 57 Seafaring | Docks, fishing, voyages to far shores, sea caravans | **in** | Sea reach and sea routes (`sim/economy/sea.ts`); fish stocks (`sim/ecology/ecology.ts`); harbours and boats (`view/country.ts`); fishers (`view/village.ts`) |
| 59 Wayfinding | Travellers on civil errands find a road | **n/a** | Path-finding for Classic's walkers |
| 63 Wealth | What a person owns, their standing, inequality, envy | **partial** | The wealth in a land's stores (`host/lenses.ts`); a realm's caste (`sim/order/order.ts`). Missing: personal riches and standing, and envy |
| 88 Roads & wheels | Roads and rails laid stone by stone; carts, trucks, trains | **partial** | Roads trodden, then paved, then railed as the era turns (`view/land.ts`, `host/land.ts`); carriers in the economy. Missing: roads built from stone and metal over the years |
| 89 Markets & coin | Price boards, specialties, treasuries; coin buys grain and hands | **partial** | Prices that follow scarcity (`sim/economy/market.ts`); currency is known as a principle. Missing: coin, treasuries, price boards, specialties |
| 100 Blocs & loans | An alliance-blocs lens; loans between treasuries | **partial** | Houses of lending, war loans, defaults and jubilees (`sim/credit/credit.ts`, Phase 21). Missing: a blocs lens |
| 101 Finery & tithe | The well-off want worked goods; a heavy tithe in war | **partial** | A grain tithe sent to the seat (`sim/polity/polity.ts`). Missing: demand for finery, a war tithe |
| 145 Wages | Hands paid for the time they work; rent follows the pay | **partial** | A year of each kind of work is valued, and people move toward the work that pays (`sim/economy/systems.ts`). Missing: wages paid to people, and rent |

## Politics, diplomacy & law

| Classic | What it did | Universe | Where / what's missing |
|---|---|---|---|
| 26 Culture & factions | Ethos, polities, territory | **in** | Ways (`sim/culture/culture.ts`); realms and their lands (`sim/polity/polity.ts`) |
| 56 Diplomacy | Envoys, tribute, vassals, marriages, claims | **partial** | A pretender's claim can start a civil war (`sim/strife/strife.ts`). Missing: envoys, tribute and vassals between realms, marriages |
| 64 Politics | Unrest, rebellion, secession, coups, civil war | **in** | Grievance and secession (`sim/polity/polity.ts`); coups, civil wars and revolutions (`sim/strife/strife.ts`, Phase 22) |
| 67 Polity traits | Named traits earned by deeds (Warlike, Merchants…) | **partial** | Eight ways, pushed by events and settable by the god (`sim/culture/culture.ts`, `sim/acts/natures.ts`). Missing: named tags |
| 73 Calamities | Disasters raise unrest and topple Voices | **partial** | The god's disasters leave dead and grievance (`sim/acts/disasters.ts`). Missing: natural calamities, and a ruler blamed for one |
| 90 Statecraft | Opinion with reasons, pacts, open markets, embassies, coalitions, the wire | **partial** | Regard built from named terms, pacts sworn and broken (`sim/diplomacy/diplomacy.ts`), trade embargoes. Missing: open markets, embassies, alliances in defence, coalitions |
| 99 Civil society | Children learn crafts, circles speak up, the law gets a code | **partial** | Interest groups press their realm (`sim/polity/interests.ts`); laws (`sim/order/laws.ts`). Missing: children taught their parents' craft |
| 154 Justice | Offences become cases; courts, cells, sentences | **partial** | A justice law, and convicts bound to labour (`sim/order/`). Missing: cases, courts, trials |

## War

| Classic | What it did | Universe | Where / what's missing |
|---|---|---|---|
| 28 War & conflict | Pressure, contact, war, casualties, the reckoning | **in** | `sim/war/war.ts` |
| 32h Conflict render | Predation, blood, combat effects, war fronts | **in** | Battles (`view/battle.ts`), hunts (`view/fauna.ts`), hosts on the globe (`view/war.ts`) |
| 32i Sieges & banners | Trade routes, sieges, banners, overlays | **in** | Siege camps (`view/townwar.ts`); banners (`render/wars.ts`, `render/regionwars.ts`) |
| 42a Causal combat | Wounds bleed matter, buildings lose integrity, occupation, killings inside a town | **partial** | Battles are counted (`sim/war/war.ts`) and replayed with the wounded and the fallen (`view/battle.ts`); towns sacked and burnt (`sim/town/fabric.ts`). Missing: fights between people with wounds that last; killings inside a town |
| 42c Anatomy & logistics | Injuries by body part, severed limbs, bucket brigades, burials, rescue, boats, tactics | **partial** | Fire brigades (`view/blaze.ts`, Phase 42); funerals (`view/graveyard.ts`, Phase 43); war across the sea. Missing: injuries by body part, lost limbs, rescue |
| 42e Refuges & gear | Shelter in buildings, campaign gates, a functional profile for each piece of primitive gear | **partial** | Walls raised as war nears (`sim/town/fabric.ts`); arms by realm design, each part's material with its edge, guard, mass, lasting and cost, worked to a quality by its seat's stuff and craft (`rules/designs.ts`, `sim/war/arms.ts`, Phase 52). Missing: taking shelter, gear for each person |
| 72 Naval warfare | Sea battles and blockades | **partial** | Hosts land from the sea (`sim/war/war.ts`). Missing: sea battles, blockades |
| 74 War-weariness | Weary realms end their wars | **in** | `sim/war/war.ts` |
| 97 War aims & peace | Aims steer the march; every peace has terms | **partial** | The land a realm wants and the stores it covets (`sim/war/war.ts`). Missing: peace terms such as tribute or bending the knee |
| 142 Warfare view | A warfare lens, formations, a war tab | **in** | The war lens (`view/globe.ts`); the war panel (`ui/war-panel.ts`, Phase 38); war in place (`view/warplay.ts`, Phase 40) |
| 143 War strategy | Rally and interception | **partial** | The rally is drawn (`view/warplay.ts`). Missing: the rally and interception decided in the sim |

## Faith, culture, language & lore

| Classic | What it did | Universe | Where / what's missing |
|---|---|---|---|
| 48 Languages | Each world has a tongue; dialects split by sound change | **in** | `sim/culture/languages.ts` |
| 50 Belief | The god named; favour, rites, a Speaker, myths, schisms | **partial** | Faiths founded on signs, spreading and splitting (`sim/belief/belief.ts`); the god named by what each people saw (`host/inspect/peoples.ts`). Missing: rites with offerings, prophecy, myths |
| 58 Festivals & arts | Feasts, songs, tales, dances, murals | **partial** | Feasts with dancing, and market days (`view/feast.ts`, Phase 33). Missing: songs, tales, murals |
| 71 Faith | Sects, zeal, holy wars | **partial** | Faiths and schisms; rival faiths sour regard; the temple's sway toward war (`sim/polity/interests.ts`). Missing: sect zeal, and wars named holy |

## History, legends & records

| Classic | What it did | Universe | Where / what's missing |
|---|---|---|---|
| 15 Events | An event bus and a causal journal | **in** | `kernel/history.ts`, `causal/why.ts` |
| 29 History | Significance, chronicles, statistics | **in** | `host/inspect/world.ts`, `host/inspect/stats.ts` |
| 47 Legends | A linked encyclopedia of the world's history | **in** | Pages for everything (`host/inspect/`, Phase 10) |
| 55 Years | Year-by-year annals, filtered, with a digest for each year | **partial** | Each thing's history, and the chronicle by age and century (`host/inspect/words.ts`, `host/inspect/world.ts`). Missing: a year-by-year scroll with digests |
| 66 Legends export | The whole history written out as HTML and text | **missing** | Only the save exports as a file |
| 69 Eras | Ages, leagues, wonders, the ship that leaves | **partial** | Stages (`host/inspect/stage.ts`) and flight to the stars (`sim/space/`). Missing: leagues of allied realms, wonders |
| 81 Records | Archives keep the crafts a fallen town knew | **partial** | Knowledge spreads, faster once writing is known (`sim/lore/lore.ts`). Missing: crafts lost with a fallen town, and archives that keep them |
| 164 Polities compared | Living realms side by side, sortable | **in** | `host/inspect/compare.ts`; the realms' ledger (`host/inspect/world.ts`) |
| 165 Ages strip | The world's years at a glance, with ages and wars | **in** | Timelines (`host/inspect/world.ts`, `ui/chart.ts`) |

## God's acts & player tools

| Classic | What it did | Universe | Where / what's missing |
|---|---|---|---|
| 31 God tools | Brushes: ignite, lightning, rain, drought, soil, seed life, plague, heal, terrain, water, ore, factions, disasters | **partial** | The palette of acts (`ui/palette.ts`, `sim/acts/`): rain, harvest, plague, healing, inspiration, quake, meteor, flood, fire, spring, shrine, settlers, warming, a star's flare. Missing: brushes on the ground: raise and lower land, add water, seed life or ore, lightning anywhere, claim land |
| 34a Civic inspectors | Set a town's priority and policy; ask it to build | **missing** | — |
| 54 Divine acts | Mark a chosen one, whisper a craft, a sign in the sky, bind a truce, sow discord | **in** | One person inspired or blessed (`sim/acts/local.ts`); inspiration (`sim/acts/acts.ts`); a sign for or against a rule (`sim/order/acts.ts`); friendship, discord, a war ended (`sim/acts/peoples.ts`) |
| 79 Causal push | The skip aims at the next stage and tilts the odds | **missing** | There are speeds for each scale and a director, but nothing aims time at the next stage |
| 127 Many hands | The effort builds while scholars study | **n/a** | A tuning fix inside the skip |
| 129 Plain words | The skip says what stands in its way | **n/a** | What the skip reports. The need it met is under 160 |
| 131 Transit | One press runs with the ship | **n/a** | A tuning fix inside the skip |
| 159 Skip digest | What happened while you skipped | **partial** | The message log and tidings keep what you follow (`ui/alerts.ts`, `ui/tidings.ts`). Missing: a summary of years run fast |
| 160 Next goal | The next stage, and what it still needs | **partial** | The stage chip shows the stages reached (`host/inspect/stage.ts`, Phase 31). Missing: what the next stage still needs |

## Observation UI & lenses

| Classic | What it did | Universe | Where / what's missing |
|---|---|---|---|
| 32 Render lenses | Projections and overlay lenses | **in** | 29 map modes with legends (`view/globe.ts`, `ui/mapmodes.ts`) |
| 32b Planet visuals | Each world's own grain, palette, clouds, wind, particles, aurora | **in** | Ground coloured by its rock, plus clouds, rain and snow, and air glow (`view/worlds.ts`, `render/weather.ts`, `render/glow.ts`); there is no aurora |
| 32d Figures & camera | Smooth motion, camera glide, labels | **in** | `view/presence.ts`, `render/orbit.ts`, `ui/labels.ts` |
| 33 Camera & input | Views, zoom, orbit, keys, pointer | **in** | `render/orbit.ts`, `view/steer.ts`, `ui/keys.ts`, free roam (`render/free.ts`) |
| 34 Interface & inspector | Tile, organism and settlement inspectors; chronicle; stats | **in** | `ui/inspector.ts` (Phase 10) |
| 35 Audio | Ambience, clicks, cues for what happens | **missing** | There is no sound |
| 36 Menus | Title screen, new world, saves, settings, help | **in** | `app/title.ts` |
| 38 Field guide | Readable chemistry: formulas, reactions, a topic guide | **in** | The concept book (`host/inspect/concepts.ts`); matter pages (`host/inspect/matter.ts`, Phase 15) |
| 44 Mobile runtime | Touch-first panels, phone performance | **in** | `app/tier.ts`; the touch camera; the free-roam stick (`ui/free.ts`) |
| 45 Player experience | First expedition, journal, pinned lives, impact of acts | **in** | The guided walk (`ui/walk.ts`); follows (`ui/outliner.ts`); the message log (`ui/alerts.ts`); acts traced through why |
| 49 Observatory | People bar, linked alerts, map modes | **partial** | Alerts and map modes (`ui/alerts.ts`, `ui/mapmodes.ts`). Missing: a bar of the lives that matter now, with mood, activity and health |
| 123 World signatures | Climate, culture and lineage shape cars, buildings, canopies | **in** | Designs by land and body (`sim/design/design.ts`); each people's look made of their world (`host/folk.ts`, `view/folk.ts`, Phase 34) |
| 139 Follow a life | The camera keeps a life in the middle | **in** | `followPerson` in `app/main.ts`; the camera eases after them (`render/orbit.ts`) |
| 140 Map lenses | Twenty-six lenses in groups, with edges drawn | **in** | `view/globe.ts`, `host/lenses.ts` (Phase 12) |
| 144 Homes view | A lens of who owns or rents each home; the people with no bed | **missing** | There is no tenure to show (see 121) |
| 156 Panel memory | Panels keep their scroll and open sections | **n/a** | UI plumbing |
| 157 Camera fit | A new world fills the screen | **n/a** | UI plumbing |
| 158 Trends | One small chart per measure, with years and values | **in** | `ui/chart.ts`, `host/inspect/stats.ts` |
| 161 World now | With nothing selected: the year, the wars, the hungry, the latest events | **in** | World pages and alerts (`host/inspect/world.ts`, `host/inspect/alerts.ts`) |
| 162 Expedition chapter | The tutorial goes on to the skip, the legends, a lens, a whisper | **in** | `ui/walk.ts` covers lenses, acts, the why and time |

## Space

| Classic | What it did | Universe | Where / what's missing |
|---|---|---|---|
| 85 Orbit | Charted stars, ships, colonies | **in** | `sim/space/space.ts`, `sim/space/voyages.ts`, `gen/galaxy.ts` |
| 107 Galaxy | Systems of worlds; colonies that grow, learn, trade and go on | **in** | Systems and worlds (`gen/system.ts`, `gen/worlds.ts`); colonies, wars among the stars, other peoples (`sim/space/`) |
| 110 Skyline before stars | No ship leaves a city of cottages | **n/a** | A launch-gate fix |
| 114 Modern world | A world that leaves looks modern: skylines, works, roads | **in** | Launch waits on works and knowledge (`sim/space/space.ts`); high-rises, factories and rail (`rules/buildings.ts`, `view/land.ts`) |

## Engine, performance & saves

| Classic | What it did | Universe | Where / what's missing |
|---|---|---|---|
| 01 Configuration | Constants, sizes, caps | **n/a** | Data in `rules/` |
| 02 Definitions | Data tables: name syllables, species roles, processes, techs | **n/a** | Data in `rules/` |
| 03 Utilities | Small helpers | **n/a** | — |
| 04 Determinism | Hashing and random streams | **n/a** | `kernel/rng.ts`, `kernel/hash.ts`, `kernel/dmath.ts` |
| 05 Save system | Saves, migration, autosave, import and export | **in** | Two save slots, autosave, and export or import of a `.causalis` file (`kernel/save.ts`, `host/storage.ts`, `app/main.ts`, `app/title.ts`) |
| 09 Entity allocator | Entity ids | **n/a** | `kernel/ref.ts` |
| 10 Component stores | A genome and phenotype for every organism | **n/a** | Universe keeps lineages' genomes (`gen/evolution.ts`); see 23 |
| 11 Relations | The kin and relations graph | **n/a** | The hand keeps parents and partners (`sim/hand/hand.ts`) |
| 12 Population cohorts | The wild kept as cohorts past a cap | **n/a** | Universe keeps everyone as counts by design (`sim/population/model.ts`) |
| 14 Effects | The effect queue and its resolver | **n/a** | `kernel/command.ts` |
| 16 Scheduler | Tick systems in a fixed order | **n/a** | `kernel/schedule.ts` |
| 30 Level of detail | Migration between detail tiers | **n/a** | Counts, the hand, people met |
| 37 Main loop | Wiring the UI and stepping the clock | **n/a** | `host/host.ts`, `host/worker.ts` |
| 39 Debug audits | Audits and probes | **n/a** | Tests, gates and the oracle under `universe/tests`, `universe/tools` |
| 43 Bootstrap & debug API | Boot and debug summaries | **n/a** | — |
| 70 Performance | Plans and searches memoised | **n/a** | — |
| 147 Thrift | Bonds and fields asked once | **n/a** | — |
| 149 Labour thrift | A town's work looked up once | **n/a** | — |
| 150 Townsfolk | The many kept as a town's ledger | **n/a** | Universe keeps everyone as counts from the start |
| 166 Sliced clock | The player acts between ticks | **n/a** | The host answers only between moments (`host/host.ts`) |

## Biggest missing pieces, as a player would see them

Ranked by how much each would add to the game's depth and to what you see, leaning toward what the user asked for: open-world warfare, wounds and healing, making, town and country life, depth in the sim, primitive crafting and new elements, and Classic's inspectable detail. Sizes: S = days, M = a phase, L = more than one phase.

1. **Soldiers who are the town's own people, fighting on the land.** Classic 41, 42a, 42c, 42e, 143. A host drawn from a town's named folk (their trade, their kit) musters, marches and meets the enemy on the land view itself, and the fallen and wounded are known by name back home. Today a battle is a yearly tally replayed on a field of its own. **L**
2. **Wounds, lost limbs and healing.** Classic 42c, 153, 22. Injuries by body part, limbs lost for good and drawn that way, bleeding, the hurt carried home, carers, healers and field medics, and recovery or death seen in the town. None of this exists today. **M**
3. **Making that matters.** Classic 18, 30c, 30e, 51, 61. Phase 50 tells each thing's chain; what comes next is quality and a maker's growing skill changing yields and battles, wear and mending, and every made thing drawn as its own model. **M**
4. **New matter on every world, kept track of as it moves.** Classic 06, 02, 07, 13, 38. Each world gets its own laws and an invented chemistry (matter families, compounds, reactions), so alien makings are new but still coherent, and substances move through ground, bodies and stores where you can inspect them at each step. Today every world shares Earth's elements, and the sim moves goods. **L**
5. **Primitive gear and the tribal village.** Classic 112, 42e, 30c. Beyond Phase 49's camp crafts: primitive arms and armour that each work differently (reach-spears, slings, bone and shell coats), storage pits, drying racks, pit kilns, palisades, spirit posts, dugouts. **M**
6. **Households in their homes.** Classic 121, 144, 145, 148. Each household's house, owned or rented, with wages paid and rent owed, eviction and people sleeping rough, plus a homes lens and the address on a person's page. **L**
7. **Crime and justice in the town.** Classic 52, 78, 99, 154. Theft from the stores and robbery by the hungry; offences that become cases; courts that sit, cells, fines and banishment, each one seen and given a page. **M**
8. **The world acting on its own.** Classic 17, 46, 73. Natural quakes, eruptions and falling stars, wildfire that spreads and lightning that starts it, all seen where they strike and shaking a town's order and its ruler; paths worn by feet. **M**
9. **Wars with aims and terms.** Classic 97, 72, 71. Aims that steer the march; peace terms such as tribute, bending the knee and recognition; sea battles and blockades; wars named holy. **M**
10. **Coin, markets and personal standing.** Classic 89, 101, 145, 63. Coin and treasuries, a price board and a specialty for each town, coin that buys grain for the hungry, finery for the well-off, a war tithe, and who in a town is poor or rich. **L**
11. **Diplomacy with more moves.** Classic 56, 90, 100, 69. Envoys between seats, tribute and vassals, marriages between ruling families, embassies, open markets, alliances in defence, leagues and coalitions, and a blocs lens. **L**
12. **A living ecology through history.** Classic 19, 42, 113, 119. Forests that seed outward and wither in drought, ores that run out, more kinds of tree turning with the seasons, crags. **L**
13. **The god's hand on the ground.** Classic 31. Raise and lower land, add water, seed plants, beasts, people or ore, strike lightning anywhere, claim land for a realm: WorldBox's own brushes. **L**
14. **Wild lives.** Classic 52, 42d, 21, 23. Herds that follow the warmth, dens, courtship, beasts of legend; herders guarding flocks and herds stolen in war; lineages still changing during history. **M**
15. **Roads built and travelled.** Classic 88, 46, 122, 155. Roads laid stone by stone and rails metal by metal, paths worn by feet, household cars for the trip to work, buses with riders. **M**
16. **Songs, tales, murals, monuments, rites.** Classic 58, 52, 50. Songs and tales made from the world's history and carried to feasts, murals painted with pigment, stones raised to wars and calamities, solstice rites with offerings, a Speaker's prophecies. **M**
17. **Interiors.** Classic 32f. Homes and workshops opened in cutaway, with their furniture and the people inside. **M**
18. **Knowledge that can be lost.** Classic 81, 106. Crafts lost when a town falls and kept by archives; rare crafts opened only by having seen a quake or a falling star. **S**
19. **Town directives.** Classic 34a. The god sets a town's priority or policy and asks it to build. **M**
20. **Time with a goal.** Classic 79, 129, 159, 160. What the next stage still needs, in plain words; a digest of years run fast; a push aimed at that stage. **S**
21. **Reading the people and the years.** Classic 49, 55, 66. A bar of the lives that matter now, year-by-year annals with digests, and the whole history written out as a file. **S**
22. **Sound.** Classic 35. Ambience by place and scale, and cues for great events. **M**
23. **A second people.** Classic 40. Another lineage rising to thought on the same world. **L**

Not ranked, on purpose: minds and character drama (30b, 62, 78, 42b, 53, 75, 76, 77). The user wants depth in systems and the UI, not a focus on characters, and these also cut against Universe's counts-first design. They stay in the tables above.

## The work-down order (2026-10-25)

The user's queue first (the making chain, then open-world warfare with wounds and healing), then the ranked list above, item by item. A row's status here and in the tables is corrected when the work reaches it (the tables were judged from file headers and searches, so a few may be off: seasons' autumn and bare boughs, for one, are in).

### The making chain, phase by phase

Asked for 2026-10-25: "mean crafting as the backbone of the whole game, not a tribal feature ...
every made thing, at every age, is made by someone from what's actually around them, so the land
decides what a people can make. Over the eras only the method changes, from knapping to the forge,
the foundry and the factory. The chain from ground to object stays the same, you can see it, and
you can tap through it."

The rule for all of it: first principles and axioms (materials' properties, chemistry, what a
people knows and its land holds), never Earth-only special cases, so an alien world's chain comes
out novel but coherent.

| Phase | Milestones | What it adds | Status |
|---|---|---|---|
| 49 | M211 | The camp's crafts: the band knapping its own land's stone, cord, spears, hides, fire made new | done (f04383f) |
| 50 | M212 | The chain's spine: every tool, pot, garment and a realm's arms traced ground → smelting → named maker → workshop → quality; a town's smiths, potters and weavers named and kept at their trades; workshop pages | done (a55adbb) |
| 51 | M213 | Seen being made, the forge: a clay furnace by the diggings smelting the land's own ore (charged, the bellows worked, the metal drawn); the metal carried to the smithy; the day's tools hung on the smithy's rack, each tapped to its own page and chain; tools and ore drawn in their own stuff's colour (obsidian black, malachite green, bronze) | done (556e6ae) |
| 51 | M214 | Seen being made, the crafts: weavers at upright looms with the cloth growing through the day; the potter's wheel turning and pots drying in rows before the firing; the colliers' charcoal clamp smoking in the woodlot. A land's clay fires to the colour its soil's iron and lime give it (red earthenware, terracotta, buff, pale); its cloth is the fibre of its own flocks (wool, a furred beast's hair, down) or of its plants; each pot on the boards and each loom's cloth tapped to its page | done |
| 51 | M215 | Seen being made, at scale: the foundry (a cupola, the pour into moulds) in a town with works in the age of engines, its named founders charging it of a morning, and at each tap in turn breaking the last day's castings out of their two moulds, stacking them, ramming the sand and pouring; the stack holds what was broken out; each mould tapped to its casting's page (ore, pig iron smelted with coke, the cupola, the founder). In the modern age the works' hall stands open at its front on a steel frame, its machinists at presses and lathes in rows, the part in each machine and the finished parts on the bench tapped to their pages (steel blown in the converter, turned and pressed at the works) | done |
| 52 | M216–M218 | The chain decides: one ore rule for tools, arms and lore; iron and tin as goods moved by trade (no tin, no bronze unless traded for); arms' quality from their stuff counting in battle; oracle rewritten and calibrated (plan: docs/architecture/phase52-plan.md) | done (1b65a78) |
| 53 | M219–M220 | Later-age arms: repeating, self-loading and automatic fire and armoured vehicles, each made through the chain (factory steel, machine-made parts), counted in battle, re-armed at the 5-yearly design; their battles seen in open order, rushes, trenches, machine guns on tripods and armoured cars knocked out burning; a trooper's weapon traced from the battle (plan: docs/architecture/phase53-54-plan.md) | done |
| 54 | M221–M222 | Novel elements: an alien world's own chemistry from first principles — its rocks, ores and stuffs, what takes an edge, what can be smelted and at what heat — its peoples' tools and arms of them | planned |
| 55 | M223– | Open-world warfare: battles fought on the land view where the hosts meet, the soldiers the towns' named people bearing chain-made arms (tapped, traced), the dead missing from their towns and buried, wounds and lost limbs healed or not and seen in the town; the war's view options kept (globe, march, siege, field) | planned |
| 56+ | — | The rest of Classic, worked down from classic-inventory.md | planned |

