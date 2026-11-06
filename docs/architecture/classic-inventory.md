# Classic → Universe: feature inventory

What every Classic Causalis section did (the 185 files in `src/game/sections/`), set against Causalis Universe as it stands on 2026-10-25, so "all the original causalis had in this game" becomes an ordered work-down list.
Status was judged by reading each Classic section's header, then looking for Universe code that does the same thing (grep and file headers across `universe/src/`, plus the phase notes); Phase 50's uncommitted making chain (`host/chain.ts`, `rules/stuffs.ts`) is counted.
**in** = Universe code found doing it (in the simulation, or drawn by the views where seeing it is the point); **partial** = some of it, with the missing part named; **missing** = nothing found; **n/a** = Classic engine plumbing or a Classic-only fix that Universe's architecture (people kept as counts, the kernel, the worker host) makes unnecessary.
Universe paths are relative to `universe/src/`. Keep one thing in mind: Universe keeps people as counts by land. Individuals exist only under the god's hand (`sim/hand/hand.ts`) and as people met (`causal/observer.ts`), and a town's day is drawn from history by the views. That is why many Classic per-person systems show up below as partial: you can see them, but nobody is simulated one by one.

| Area | in | partial | missing | n/a |
|---|---|---|---|---|
| World & ground | 4 | 7 | 0 | 1 |
| Life & creatures | 4 | 4 | 0 | 0 |
| People & minds | 3 | 8 | 6 | 3 |
| Households, towns & building | 16 | 5 | 1 | 11 |
| Farming, crafts & industry | 12 | 5 | 0 | 1 |
| Trade, wealth & markets | 3 | 5 | 0 | 1 |
| Politics, diplomacy & law | 5 | 3 | 0 | 0 |
| War | 6 | 5 | 0 | 0 |
| Faith, culture, language & lore | 1 | 3 | 0 | 0 |
| History, legends & records | 7 | 2 | 0 | 0 |
| God's acts & player tools | 5 | 0 | 1 | 3 |
| Observation UI & lenses | 16 | 1 | 1 | 2 |
| Space | 3 | 0 | 0 | 1 |
| Engine, performance & saves | 1 | 0 | 0 | 19 |
| **All 185 sections** | **86** | **48** | **9** | **42** |

## World & ground

| Classic | What it did | Universe | Where / what's missing |
|---|---|---|---|
| 06 World generation | Per-seed world laws, an invented chemistry of ten matter families, terrain grammar, rivers, basins, salt flats, volcanic heat | **partial** | Plates, relief, rivers, climate, deposits and deep time go deeper here (`gen/`), and worlds are made by star, pull, orbit, seas and air (`rules/making.ts`). Missing: per-world laws (plant efficiency, combustion, hardness…) and a chemistry of the world's own |
| 07 Tile world | Each tile's moisture, fertility, food, smoke, disease, blood, fear, materials, phases and live reactions | **partial** | A region tile has ground, weather, water, soil and ore (`ui/region-panel.ts`, `gen/region.ts`). Missing: smoke, blood and fear signals, phases and reactions per tile |
| 08 Environment fields | Heat and moisture spreading tile to tile every tick | **partial** | Warmth and rain per cell come from the energy balance and shift as the world warms (`gen/climate.ts`, `sim/climate/air.ts`). Missing: fields that spread tick by tick |
| 13 Processes | Balanced reactions run on tiles, bodies and stores; matter and energy audited | **partial** | Real substances and balanced reactions as data and pages (`rules/matter.ts`, `host/inspect/matter.ts`). Missing: the sim moves goods, not substances, and nothing audits conservation |
| 17 Physical substrate | Weather cycle, lightning that ignites, fire, surface water, the sky breathing | **partial** | Dry years and droughts (`sim/population/systems.ts`), weather played up close from the climate (`view/weather.ts`, Phase 30), rivers and lakes (`gen/hydrology.ts`); lightning in a dry year lights the woods and the fire goes on across a land's ground tile by tile (`sim/acts/wild.ts`, `view/wildfire.ts`). Missing: water that rises and falls |
| 19 Plant ecology | Plants grow and spread tile by tile from the ground's matter | **partial** | Forest, wild food and soil as stocks per land that heal (`sim/ecology/ecology.ts`); a land's woods that reach out and draw back with its rain and warmth, read against every patch of its ground (`sim/ecology/woods.ts`); grass grown and grazed in the meadow (`view/meadow.ts`). Missing: plants growing tile by tile from the ground's matter |
| 46 Living world | Seasons from axial tilt, paths worn by feet, a new Voice on a death, eruptions, quakes and meteors, omens | **in** | Seasons (`view/seasons.ts`, `view/weather.ts`), successions (`sim/polity/polity.ts`), omens read by faiths (`sim/belief/belief.ts`), quakes where plates meet, fires and falling stones by themselves (`sim/acts/wild.ts`), and ways worn by who really walks them, greening where a town has shrunk, with tracks between camps and hamlets before any road (`view/worn.ts`) |
| 80 Provision | Laid pigment and polymer seams within reach so every world could learn letters | **n/a** | A Classic fix. Universe's deposits come from geology (`gen/deposits.ts`) and writing does not wait on pigment |
| 91 The long afternoon | Industry strains the sky; ways of rule; orbital stations; an epilogue | **in** | Carbon from burning and clearing warms the world and moves rain (`sim/climate/air.ts`); institutions and laws (`sim/polity/polity.ts`, `sim/order/laws.ts`); stations (`sim/space/space.ts`) |
| 93 Day and night | A slow day with dusk and night; people sleep, labour stops | **in** | Daylight by the hour (`render/stage.ts`); folk asleep at home at night (`view/village.ts`). Drawn, not simulated |
| 113 Grove and crag | Tree species by ground, autumn colour, bare winter boughs, crags with lit faces, ground grain | **partial** | Conifer, broadleaf, palm and scrub, flat crowns on savanna, tall dark ones in the rainforest, brown ones after a drought, autumn and bare boughs (`render/village.ts`, `view/region.ts`, `view/seasons.ts`). Missing: birch, willow and baobab kinds, crags and strata |
| 119 Living grove | Forests seed outward, saplings grow or wither, fruit in season, trees die back in drought | **in** | Saplings grow beside felled stumps (the woodlot, Phase 41), orchards fruit (`view/country.ts`), and a land's woods seed outward, wither and die back by its rain through history, brown for years after a drought took them (`sim/ecology/woods.ts`) |

## Life & creatures

| Classic | What it did | Universe | Where / what's missing |
|---|---|---|---|
| 20 Artificial life | Life emerges from chemistry, founders seeded, the biosphere kept alive | **in** | Life's history from the first cells (`gen/evolution.ts`, Phase 17), played in the genesis and the meadow (`view/genesis.ts`, `view/meadow.ts`, Phases 24 and 27) |
| 21 Perception & behaviour | Each creature senses, feeds, drinks, hunts, scavenges, gathers and socialises | **partial** | Seen in the meadow and around villages, where hunters stalk and scavengers trail (`view/meadow.ts`, `view/fauna.ts`); a land's creatures go where the green is, through the year and the centuries, and come past towns (`sim/ecology/herds.ts`, `render/landherds.ts`, Z1). Missing: one creature choosing for itself in the running world |
| 22 Health, disease, death | Infection, lifespan, death causes, corpses that decay back into the ground | **partial** | Sickness goes much deeper (`sim/health/health.ts`, Phase 20); deaths come from life tables. Missing: injuries, and corpses that lie and decay |
| 23 Reproduction & evolution | Offspring inherit a mutated genome; lineages evolve as you watch | **in** | Lineages evolve over deep time (`gen/evolution.ts`), traits pass to children under the hand (`sim/hand/hand.ts`), and the tree goes on through history: a new kind stands apart where it is cut off, a kind dies out on the last of its ground, one is made tame (`sim/ecology/herds.ts`, Z1) |
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
| 78 Instinct | Inherited instincts; hunger drives eating carrion and the dead, and robbery | **partial** | A land's hunger brings robbery, in a town's cases (`host/inspect/justice.ts`, J1). Missing: inherited instincts, eating carrion and the dead |
| 94 Figures | Poses for work (kneel, carry, sit, fight); dress by standing and era | **in** | Work motions (`view/motion.ts`); dress by era and group (`view/dress.ts`), though not by wealth |
| 102 Presence | Taller figures, tools in hand, hair, torches at night | **partial** | Tools carried and held (`view/work.ts`); hair and faces (`view/detail.ts`). Missing: torches carried at night |
| 111 Steady feet & cars | Walkers that don't jitter; motor freight on the roads | **in** | Smooth walkers (`view/presence.ts`); carts, trucks and trains as busy as trade (`render/landtraffic.ts`, Phase 26) |
| 132 Cradle | The widowed love again; towns keep bearing children | **n/a** | A birth-rate fix. Universe's births come from life tables |
| 141 Settled intent | The inspector shows what a life is steadily doing, not each tick's flicker | **n/a** | Universe's day is a pure function of time, so nothing flickers |
| 146 Steady steps | Walkers don't step straight back | **n/a** | A walking fix for Classic's agents |
| 148 Address | Where a person lives: the home, its owner, the rent, the household | **partial** | A home's page says whose it is, who lives there, what they pay and to whom, its size, age and what it was before (`host/inspect/home.ts`). A person's page leads to it (L6, second slice), for all but those past the homes a town draws. Missing: rent has no law behind it |
| 152 Conversation | Mood, stress, loneliness and standing; what people say to each other | **partial** | Rings of talk, hot words and brawls where grievance runs high (`view/village.ts`). Missing: mood kept for each person and passed between people |
| 153 First aid | Helpers chosen by kin, clinic care, field medics | **partial** | Healers spare a share of the sick (`sim/health/health.ts`); brigades turn out when the god strikes a town (Phase 42). Missing: carers for the hurt, clinics for wounds, field medics |

## Households, towns & building

| Classic | What it did | Universe | Where / what's missing |
|---|---|---|---|
| 25 Camps & settlements | Camps and towns with their food, water and defence; ruin | **in** | Settlements (`sim/population/stores.ts`); camps (`host/camp.ts`, Phases 28–29) |
| 30a Society places | Stages, crafts, buildings, plans, camps and towns | **in** | Buildings raised by need and knowledge (`rules/buildings.ts`, `sim/town/fabric.ts`, Phase 23); stages (`host/inspect/stage.ts`) |
| 30d Labour | Hands assigned to work; buildings kept up | **partial** | Work counted by occupation (`sim/population/model.ts`); homes wear out and are rebuilt (`sim/town/fabric.ts`); a day's errands drawn (`view/errands.ts`, Phase 39). Missing: hands assigned to sites, and upkeep as work |
| 32e Architecture render | Palettes, footprints, roofs, function marks, sites going up | **in** | Homes in their designs, rising inside scaffolds (`view/town.ts`, `render/town.ts`) |
| 32f Interiors | Cutaway homes: furniture, and who is inside | **partial** | Any home opens in cutaway with what its people need, can get and can pay for, and those who are in it (Lives L6, `rules/dwelling.ts`). Missing: workshops |
| 32g Town render | Work at its faces; the place itself | **in** | `render/work.ts`; trades at their buildings (`render/trades.ts`, Phase 41) |
| 52 Living society | Monuments, caravans that walk, wildlife lives, petty crime and captives | **in** | Traders on the road (`view/trade.ts`, Phase 48); captives (`sim/order/order.ts`); stones raised to what a town went through, each with its page (`host/inspect/memory.ts`, `render/memorial.ts`, T1). theft and exile, as a town's cases (`host/inspect/justice.ts`, J1); dens on a land's map, and beasts people give a name to, with their page and their end (`host/inspect/herds.ts`, Z1) |
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
| 122 Public streets | Buses carry real riders on built links | **in** | A town's lines run through its square with lit windows for those aboard; riders are its own people, pressed from the line's page; what a line is comes of what a people is: a bus, a hive's hauler, a water people's drift-line, a works-line for those who can't grip (`view/rides.ts`, `render/towntraffic.ts`, `bus:` pages in `host/inspect/road.ts`) |
| 124 Sidewalks | A street graph that walkers keep to | **in** | The walkers' street graph (`view/streets.ts`, Phase 23) |
| 125 Zoning | Quarters: a civic heart, commerce, homes, works, fields | **in** | City blocks put to use by what they're worth (`sim/city/city.ts`); lots laid from the square outward (`sim/town/fabric.ts`) |
| 128 Open ground | Launch tower sited outside a full city | **n/a** | A siting fix |
| 133 Hearth | A town's rations reach as far as its streets | **n/a** | A food-reach fix |
| 135 Hinterland | Fields past the seventh tile; a starving town takes in no strangers | **n/a** | A field-reach fix |
| 136 Ferry | Roads cross the water | **n/a** | Universe joins lands by sea routes (`sim/economy/sea.ts`) |
| 137 Field | The effort supplies farms left waiting | **n/a** | A fix for the Causal skip |
| 138 Field gates | People cross field gates; where a second city goes | **n/a** | A movement and siting fix |
| 155 Streets | Cars owned and driven to work; streets worn into being; crowds | **in** | Traffic on the land's ways (`render/landtraffic.ts`); crowds at one figure per 12 folk (Phase 45); what people keep at their door, driven to work on the walk their day already has, ridden in Live their day (`view/rides.ts`); streets worn by who walks them (`view/worn.ts`) |

## Farming, crafts & industry

| Classic | What it did | Universe | Where / what's missing |
|---|---|---|---|
| 18 Material resources | Tool quality from its head and its maker; extraction from the ground | **partial** | Tools are headed with the metal a land's crafters actually made them of, from what its market holds (`toolMetal`, `forgedMetal`, `sim/economy/systems.ts`, Phase 52); ore's grade sets what smelting yields (`sim/economy/ore.ts`); Phase 50 tells each thing's quality (`host/chain.ts`, `rules/stuffs.ts`), and arms' quality counts in battle (`sim/war/arms.ts`). Missing: a tool's quality changing what it yields |
| 27 Technology & discovery | Crafts found from what is seen nearby; artifacts made | **in** | Principles are found where the land allows (`sim/lore/lore.ts`). Named artifacts are missing |
| 30c Work | Personal tools by recipe, work orders, stores, salvage, research samples | **partial** | Stores by good (`host/inspect/stores.ts`) and the errands that move them (`view/errands.ts`). Missing: each person's tools by recipe, work orders and priorities, salvage |
| 30e Production | Facilities run, smelting, civic production | **partial** | Crafters make goods for each land (`sim/economy/systems.ts`), smelting copper, tin and iron from ore within reach as a step of their own, the metal then worked into tools and arms (Phase 52); works and what drives them (`sim/design/design.ts`); trades drawn at work (`render/trades.ts`). Missing: buildings that produce on their own |
| 30f Technology | Research, shared knowledge, stage gates, epochs | **in** | `sim/lore/lore.ts`, `rules/principles.ts`, `host/inspect/stage.ts` |
| 42 Environment & armament | Harvest uses up features; groves regrow while minerals run out; weapons emerge | **in** | Wild, forest and soil drawn down and healing (`sim/ecology/ecology.ts`); arms from the metals the seat's market holds — smelted within reach or brought by road — their kit worn out and drawn again from the markets, and counted in battle by what they are made of (`sim/design/design.ts`, `sim/war/arms.ts`, Phase 52); ores that run out by what has been dug, deeper by better means and then the old heaps (`sim/economy/lodes.ts`) |
| 42d Agriculture & herding | Fields as tile chemistry, herds in pens, defence against predators, herd theft | **in** | Fields sown and reaped, flocks folded and culled (`view/fields.ts`, `view/flock.ts`); predators take flocks (`sim/ecology/ecology.ts`), with a herder standing between them; herds driven off in war, and what the land loses by it (`sim/ecology/herds.ts`, Z1) |
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
| 88 Roads & wheels | Roads and rails laid stone by stone; carts, trucks, trains | **partial** | Roads trodden, then paved, then railed section by section by gangs you can see and press, in the land's own stone and the world's own metal, each road with a page: who built it, what it joins, what goes along it, what stopped or cut it (`host/roads.ts`, `host/inspect/road.ts`, `render/landworks.ts`); carriers in the economy. Missing: what a road takes drawn down from a land's stores, a gang's wage in coin |
| 89 Markets & coin | Price boards, specialties, treasuries; coin buys grain and hands | **partial** | Prices that follow scarcity (`sim/economy/market.ts`). A town's board, what each town is known for, and where a good is dear and where cheap (`host/inspect/board.ts`, gate 92). Missing: treasuries, coin that moves from hand to hand |
| 100 Blocs & loans | An alliance-blocs lens; loans between treasuries | **in** | Houses of lending, war loans, defaults and jubilees (`sim/credit/credit.ts`, Phase 21); a Blocs lens over who stands with whom, each bloc with its page (`sim/war/ties.ts`, `host/inspect/ties.ts`) |
| 101 Finery & tithe | The well-off want worked goods; a heavy tithe in war | **partial** | A grain tithe sent to the seat (`sim/polity/polity.ts`). Missing: demand for finery, a war tithe |
| 145 Wages | Hands paid for the time they work; rent follows the pay | **partial** | A year of each kind of work is valued, and people move toward the work that pays (`sim/economy/systems.ts`). A person's page reads what a day's work brings, what it buys, their rent and what is left (L6, second slice). Missing: wages and rent moved through history |

## Politics, diplomacy & law

| Classic | What it did | Universe | Where / what's missing |
|---|---|---|---|
| 26 Culture & factions | Ethos, polities, territory | **in** | Ways (`sim/culture/culture.ts`); realms and their lands (`sim/polity/polity.ts`) |
| 56 Diplomacy | Envoys, tribute, vassals, marriages, claims | **in** | Tribute and vassals between realms (`sim/war/bonds.ts`, W7); ties between ruling houses, at a ruler's word (`sim/order/reign.ts`, L5) and by the world's own rulers, by what a people is: a marriage, a fostering, a brood given, a reef grafted; a claim where a house has no one left, with four ends (`sim/war/ties.ts`); envoys seen on the road and standing at a court (`render/landtraffic.ts`, `render/court.ts`); a pretender's claim can start a civil war (`sim/strife/strife.ts`) |
| 64 Politics | Unrest, rebellion, secession, coups, civil war | **in** | Grievance and secession (`sim/polity/polity.ts`); coups, civil wars and revolutions (`sim/strife/strife.ts`, Phase 22) |
| 67 Polity traits | Named traits earned by deeds (Warlike, Merchants…) | **partial** | Eight ways, pushed by events and settable by the god (`sim/culture/culture.ts`, `sim/acts/natures.ts`). Missing: named tags |
| 73 Calamities | Disasters raise unrest and topple Voices | **in** | The god's disasters and the world's own leave dead and grievance (`sim/acts/disasters.ts`, `sim/acts/wild.ts`), and a ruler is judged by the help that reached those they left |
| 90 Statecraft | Opinion with reasons, pacts, open markets, embassies, coalitions, the wire | **partial** | Regard built from named terms, pacts sworn and broken (`sim/diplomacy/diplomacy.ts`), trade embargoes; a pact called on in war, embassies that keep what a realm believes of another's host true, compacts against the greatest (`sim/war/ties.ts`). Missing: open markets, the wire |
| 99 Civil society | Children learn crafts, circles speak up, the law gets a code | **partial** | Interest groups press their realm (`sim/polity/interests.ts`); laws (`sim/order/laws.ts`). Missing: children taught their parents' craft |
| 154 Justice | Offences become cases; courts, cells, sentences | **in** | A justice law, and convicts bound to labour (`sim/order/`); a town's cases, each from a cause (`host/inspect/justice.ts`); a court that sits and sentences carried out where they're seen (`view/court.ts`, `render/court.ts`), J1 |

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
| 97 War aims & peace | Aims steer the march; every peace has terms | **in** | Aims read off what drove a war and steering it (`sim/war/war.ts`); land, tribute, an oath or a truce (`sim/war/bonds.ts`, `rules/terms.ts`); a ruler's offers (`sim/order/reign.ts`), W7 |
| 142 Warfare view | A warfare lens, formations, a war tab | **in** | The war lens (`view/globe.ts`); the war panel (`ui/war-panel.ts`, Phase 38); war in place (`view/warplay.ts`, Phase 40) |
| 143 War strategy | Rally and interception | **partial** | The rally is drawn (`view/warplay.ts`). Missing: the rally and interception decided in the sim |

## Faith, culture, language & lore

| Classic | What it did | Universe | Where / what's missing |
|---|---|---|---|
| 48 Languages | Each world has a tongue; dialects split by sound change | **in** | `sim/culture/languages.ts` |
| 50 Belief | The god named; favour, rites, a Speaker, myths, schisms | **partial** | Faiths founded on signs, spreading and splitting (`sim/belief/belief.ts`); the god named by what each people saw (`host/inspect/peoples.ts`). Missing: rites with offerings, prophecy, myths |
| 58 Festivals & arts | Feasts, songs, tales, dances, murals | **partial** | Feasts with dancing, and market days (`view/feast.ts`, Phase 33); songs and tales made from a people's own history, sung at its feasts and wearing with age (`host/inspect/verse.ts`, T1). Missing: murals |
| 71 Faith | Sects, zeal, holy wars | **partial** | Faiths and schisms; rival faiths sour regard; the temple's sway toward war (`sim/polity/interests.ts`); wars fought as holy, naming the two faiths (`sim/war/war.ts`, W7). Missing: sect zeal |

## History, legends & records

| Classic | What it did | Universe | Where / what's missing |
|---|---|---|---|
| 15 Events | An event bus and a causal journal | **in** | `kernel/history.ts`, `causal/why.ts` |
| 29 History | Significance, chronicles, statistics | **in** | `host/inspect/world.ts`, `host/inspect/stats.ts` |
| 47 Legends | A linked encyclopedia of the world's history | **in** | Pages for everything (`host/inspect/`, Phase 10) |
| 55 Years | Year-by-year annals, filtered, with a digest for each year | **in** | The Years, a tab of the Chronicle: every year with something told, filtered by kind, each name a link, a year to go to (`host/inspect/annals.ts`, `ui/years.ts`, gate 91) |
| 66 Legends export | The whole history written out as HTML and text | **in** | One press on The Years writes it (`host/inspect/written.ts`, `ui/written.ts`, `ui/written-file.ts`): realms and their rulers, wars and how they ended, those who mattered, the great deeds by year, links inside it, what it leaves out said at its head; HTML and plain words, kept by a link or the phone's share sheet |
| 69 Eras | Ages, leagues, wonders, the ship that leaves | **partial** | Stages (`host/inspect/stage.ts`), flight to the stars (`sim/space/`), compacts of realms against the greatest (`sim/war/ties.ts`). Missing: wonders |
| 81 Records | Archives keep the crafts a fallen town knew | **partial** | Knowledge spreads, faster once writing is known (`sim/lore/lore.ts`). Missing: crafts lost with a fallen town, and archives that keep them |
| 164 Polities compared | Living realms side by side, sortable | **in** | `host/inspect/compare.ts`; the realms' ledger (`host/inspect/world.ts`) |
| 165 Ages strip | The world's years at a glance, with ages and wars | **in** | Timelines (`host/inspect/world.ts`, `ui/chart.ts`) |

## God's acts & player tools

| Classic | What it did | Universe | Where / what's missing |
|---|---|---|---|
| 31 God tools | Brushes: ignite, lightning, rain, drought, soil, seed life, plague, heal, terrain, water, ore, factions, disasters | **in** | The palette of acts (`ui/palette.ts`, `sim/acts/`): rain, harvest, plague, healing, inspiration, quake, meteor, flood, fire, spring, shrine, settlers, warming, a star's flare; brushes dragged on the ground: raise and lower land, add water, seed life or ore, lightning anywhere, claim land (Phase 62) |
| 34a Civic inspectors | Set a town's priority and policy; ask it to build | **in** | A town can be asked to raise a thing or put one first, by the god from its bar or page and by a ruler of its own realm; it answers by name and in its own voice (`sim/town/asks.ts`, `host/inspect/asks.ts`, `ui/ask-sheet.ts`) |
| 54 Divine acts | Mark a chosen one, whisper a craft, a sign in the sky, bind a truce, sow discord | **in** | One person inspired or blessed (`sim/acts/local.ts`); inspiration (`sim/acts/acts.ts`); a sign for or against a rule (`sim/order/acts.ts`); friendship, discord, a war ended (`sim/acts/peoples.ts`) |
| 79 Causal push | The skip aims at the next stage and tilts the odds | **missing** | There are speeds for each scale and a director, but nothing aims time at the next stage |
| 127 Many hands | The effort builds while scholars study | **n/a** | A tuning fix inside the skip |
| 129 Plain words | The skip says what stands in its way | **n/a** | What the skip reports. The need it met is under 160 |
| 131 Transit | One press runs with the ship | **n/a** | A tuning fix inside the skip |
| 159 Skip digest | What happened while you skipped | **in** | A note when a person comes back from running fast, from the same reading as the Years (`ui/ran.ts`); the message log and tidings keep what you follow (`ui/alerts.ts`, `ui/tidings.ts`) |
| 160 Next goal | The next stage, and what it still needs | **in** | The stage chip's page says what the next stage still needs, from F5's reading, and what could come instead where the way is shut (`host/inspect/next.ts`, `host/inspect/stage.ts`) |

## Observation UI & lenses

| Classic | What it did | Universe | Where / what's missing |
|---|---|---|---|
| 32 Render lenses | Projections and overlay lenses | **in** | 29 map modes with legends (`view/globe.ts`, `ui/mapmodes.ts`) |
| 32b Planet visuals | Each world's own grain, palette, clouds, wind, particles, aurora | **in** | Ground coloured by its rock, plus clouds, rain and snow, and air glow (`view/worlds.ts`, `render/weather.ts`, `render/glow.ts`); there is no aurora |
| 32d Figures & camera | Smooth motion, camera glide, labels | **in** | `view/presence.ts`, `render/orbit.ts`, `ui/labels.ts` |
| 33 Camera & input | Views, zoom, orbit, keys, pointer | **in** | `render/orbit.ts`, `view/steer.ts`, `ui/keys.ts`, free roam (`render/free.ts`) |
| 34 Interface & inspector | Tile, organism and settlement inspectors; chronicle; stats | **in** | `ui/inspector.ts` (Phase 10) |
| 35 Audio | Ambience, clicks, cues for what happens | **partial** | Every place has its own air, made in the browser, and what happens has its cue, with 🔊 in the corner (`app/sound.ts`, `app/sound-mix.ts`, gate 90). Missing: surf by a coastal town, a burning town's crackle, a possessed person's footsteps, a volume slider, music |
| 36 Menus | Title screen, new world, saves, settings, help | **in** | `app/title.ts` |
| 38 Field guide | Readable chemistry: formulas, reactions, a topic guide | **in** | The concept book (`host/inspect/concepts.ts`); matter pages (`host/inspect/matter.ts`, Phase 15) |
| 44 Mobile runtime | Touch-first panels, phone performance | **in** | `app/tier.ts`; the touch camera; the free-roam stick (`ui/free.ts`) |
| 45 Player experience | First expedition, journal, pinned lives, impact of acts | **in** | The guided walk (`ui/walk.ts`); follows (`ui/outliner.ts`); the message log (`ui/alerts.ts`); acts traced through why |
| 49 Observatory | People bar, linked alerts, map modes | **in** | Alerts and map modes (`ui/alerts.ts`, `ui/mapmodes.ts`); the people bar (`host/bar.ts`, `host/inspect/barread.ts`, `ui/people-bar.ts`): who matters where the eye is, why, and how they are, each a true reading |
| 123 World signatures | Climate, culture and lineage shape cars, buildings, canopies | **in** | Designs by land and body (`sim/design/design.ts`); each people's look made of their world (`host/folk.ts`, `view/folk.ts`, Phase 34) |
| 139 Follow a life | The camera keeps a life in the middle | **in** | `followPerson` in `app/main.ts`; the camera eases after them (`render/orbit.ts`) |
| 140 Map lenses | Twenty-six lenses in groups, with edges drawn | **in** | `view/globe.ts`, `host/lenses.ts` (Phase 12) |
| 144 Homes view | A lens of who owns or rents each home; the people with no bed | **partial** | 💰 in a town shows what each home has to spend and who owns or rents, by the law of land (L6, second slice). Missing: the people with no bed |
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
7. **Crime and justice in the town.** Classic 52, 78, 99, 154. Cases from what a town went through, courts that sit, cells, fines and sending away, each seen and given a page: built (2026-11-06). Next: being robbed or stealing when hungry as offers in a life, a decree seen in the cases, a crime lens. **M**
8. **The world acting on its own.** Classic 17, 46, 73. Quakes where plates meet, falling stones, wildfire that spreads and lightning that starts it, all seen where they strike and judging a ruler: built (2026-11-06). Next: tsunami, aftershocks, a fire's front reaching a town before it burns, paths worn by feet. **S**
9. **Wars with aims and terms.** Classic 97, 72, 71. Aims that steer the march, peace with terms and wars named holy: built (2026-11-06). Next: sea battles and blockades, recognition. **M**
10. **Coin, markets and personal standing.** Classic 89, 101, 145, 63. A price board and a specialty for each town, and who in a town is poor or rich: built (2026-11-06). Next: treasuries, coin that buys grain for the hungry, finery for the well-off, a war tithe. **L**
11. **Diplomacy with more moves.** Classic 56, 90, 100, 69. Tribute and vassals, envoys between seats, the world's own marriages and claims, embassies, allies who answer a call, compacts against the greatest and a blocs lens are built (2026-11-06). Next: open markets, a person's choice when their realm is called, a compact's own first march. **S**
12. **A living ecology through history.** Classic 19, 42, 113, 119. Forests that seed outward and wither in drought, long ages of rain, ores that run out, new crowns turning with the seasons: built (2026-11-06). Next: crags, weed beds drawn in the sea, who builds with what stands. **S**
13. **The god's hand on the ground.** Classic 31. Raise and lower land, add water, seed life or ore, strike lightning anywhere, claim land for a realm: WorldBox's own brushes, built (Phase 62). Next: a faith reading the strokes, an edit at a town's scale. **S**
14. **Wild lives.** Classic 52, 42d, 21, 23. Herds that follow the warmth, dens, beasts people name, herders guarding flocks, herds stolen in war and lineages still changing during history: built (2026-11-06). Next: herds feeding what a land can hunt, grazed pasture worn on the map, a fallen hunter as a person on the roster. **M**
15. **Roads built and travelled.** Classic 88, 46, 122, 155. Roads laid section by section by gangs you can press, ways worn by who walks them, what a household keeps for the trip to work, lines with riders: built (2026-11-06). Next: a road drawing down a land's stores, a gang's wage in coin, The Years telling a road opened, cars for a city's undrawn thousands. **M**
16. **Songs, tales, murals, monuments, rites.** Classic 58, 52, 50. Songs and tales made from the world's history and carried to feasts, and stones raised to wars and calamities: built (2026-11-06). Next: murals painted with pigment, solstice rites with offerings, a Speaker's prophecies. **M**
17. **Interiors.** Classic 32f. Homes and workshops opened in cutaway, with their furniture and the people inside. **M**
18. **Knowledge that can be lost.** Classic 81, 106. Crafts lost when a town falls and kept by archives; rare crafts opened only by having seen a quake or a falling star. **S**
19. **Town directives.** Classic 34a. The god or a ruler asks a town to raise something or put something first, and it answers in its own voice: built (2026-11-06). Next: each offered row reading how short of its want that town is, piety read against the realm's mean, a site crew's own words. **M**
20. **Time with a goal.** Classic 79, 129, 159, 160. What the next stage still needs and a digest of years run fast: built (2026-11-06). Next: a push aimed at that stage. **S**
21. **Reading the people and the years.** Classic 49, 55, 66. Year-by-year annals with digests, a bar of the lives that matter now, and the whole history written out as a file: built (2026-11-06). Next: a people's own names on the bar and in the file; a bar in a life or a reign; a town's and a faith's entry in the file. **S**
22. **Sound.** Classic 35. Ambience by place and scale, and cues for great events: first slice built (2026-11-06). Next: surf by a coastal town, a burning town, footsteps, a world's own birds. **M**
23. **A second people.** Classic 40. Another lineage rising to thought on the same world. **L**

Not ranked, on purpose: minds and character drama (30b, 62, 78, 42b, 53, 75, 76, 77). The user wants depth in systems and the UI, not a focus on characters, and these also cut against Universe's counts-first design. They stay in the tables above.

## Sound, first slice, as built (2026-11-06)

The game had no sound. Now every place has its own, made in the browser from noise and oscillators with no file to load: the title, a town by day and by night, in rain, on a market day, at a feast and at war; open land, a shore; a water people's town heard through the water; a colony's halls; the globe from high up; the stars around, the galaxy; a ground battle. Moving between them crossfades. What happens has its cue: a button, a page, a great event's bell, a world's first, thunder, a ship's beams and missiles and its breaking up, a jump and coming out of it, a landing, and the greatest fire, which takes the air away and leaves a hush. 🔊 sits in the corner's tools, 44 by 44, and stays reachable where a mode puts them away. It starts at the first touch, softly, and what a person chose is remembered.

- **It hears, it never touches.** `app/sound.ts` (graph, button, context) and `app/sound-mix.ts` (pure: a place and what is about it in, levels and rates out). No state, no events, no version bump; the fixtures don't move and the hashes are the same before and after. Its randomness is its own.
- **Told, not asked.** The page reads what a person sees four times a second, only while someone is listening, and `sound.tell` does nothing unless it changed. A film's place and hour are the film's. The one query is once a page, for the world's air, and only once someone is listening. A flash is read as it is drawn, since it's over before the next reading.
- **Bounded.** 50 standing nodes and at most 26 voices of three nodes each, under a bound of 130. A layer at nothing is unplugged. With 🔊 off or the tab hidden the context is suspended and its timer stopped; off before the first touch, there is no context at all. No WebAudio: no button, no error, and the game runs the same.
- **Measured for what a phone can give.** A phone's speaker gives little under 320 Hz, so loudness is read over it too: wind has no sub-bass to press on the limiter, and the land, which read -42 dB there, now reads -38.

Measures, on the final code (gate 90): every place from -16 to -30 dBFS, -46 for the hush after the greatest fire, peak at most 0.72, none clipping; each pair of nine places unlike by at least 8.3 against a noise floor of 2.2 for the same place from other randomness. Fifty ships at the worst the rules allow: -10 dBFS, peak 0.81, 10 voices, 76 nodes. Rendering runs at least 24 times as fast as it plays. Building the loops: at most 16 ms in any one slice after a touch. Frames in a town at the vsync cap with it on and off, 16.6 ms each, which shows no cost and could hide a small one.

Limits, stated: **no measure says whether it sounds good**, and the WAV files gate 90 writes with `--shots` exist for a person to judge. No real iPhone has run it. The silent switch relies on `navigator.audioSession.type = "ambient"` and wasn't thrown. Playwright's WebKit on Windows has no WebAudio, so the game there is the no-sound path, and Safari's own audio is unmeasured. A hidden tab was forged. A world's first and thunder are checked as rendered cues, and haven't been caught firing live in a gate.

Cut for later: surf by a coastal town, a burning town's crackle, a possessed person's footsteps, a world's own pitch for its birds, a volume slider, a camp's own sound (a camp reads as land), 🔊 on the sandbox and bench pages.

## The Years and what's next, as built (2026-11-06)

A person can run hundreds of years in a minute, and could not then easily say what happened, or what the world was reaching for. Now they can. On the Chronicle's second tab, **The Years**: every year with something told, newest or oldest first, in six filters (all, wars, firsts, sorrows, people, the stars), a year to go to, every name a link. Back from a run at speed, a small note says **what happened while you ran**, and goes by itself. The stage chip's page leads with **what's next**: what the next age still needs on this world, the way to it, and what it never will and why.

- **It only reads.** `host/inspect/annals.ts` reads `world.events`, which keeps everything for 20 years, importance 4 for 400, 5 for 1,200 and 6 on for good. No state, no events, no version bump; the fixtures don't move and hashes are the same before and after. The reading is kept outside the world and taken again only when the log has moved on.
- **One reading.** The scroll and the note are the same `annalsOf`, so they can't disagree. What's next is F5's `hereOf`, `openSteps`, `whyShut` and `stopWords`, so it can't disagree with What can be done here.
- **What makes a line worth a person's time.** What only spreads known things isn't told. A first anywhere is worth most, then a realm's fall. A war is told by its beginning, its end and its worst year, and a famine or sickness once, when it began, with how long and what it took. Several of a kind in a year are one line: the greatest, and how many more. With no filter a year shows at most three lines.
- **A name a person can say.** "The hot desert at 37.3°N 136.0°E" reads as "Koath's land" or "the hot desert", a link.
- **Never over anything.** The note waits for any film, window, page, life, possession, reign or home; comes once for a run; says nothing if nothing happened; and goes in 20 s, stepping aside for whatever comes meanwhile.

Found by reading the lines: a trade run read "0 light-years, 1 years a crossing" (now "among one star's own worlds, a year a crossing"), and a coup read "it became the league of X" of the same league (now "and its army took the rule"). Both had been live in the Chronicle. On a phone the filters took two rows and left two years of room, so they're one row now and only they and their count stay over the scroll. The bar's pause was 23 px wide on a phone, now 40.

Measures, on a loaded machine (a seed list at five jobs). `harrow 348` at 3000, 28,259 events: the tab pressed to words on the screen 645 ms; a piece of 24 years 6 to 8 ms over the wire; at most 48 rows drawn at once; 851 of 3,000 years told with no filter (28%), the emptiest stretch 45 years, bad words 0. Worst first readings, on the worker, once: `first light` at 2000 (188,730 events) 1.3 s, `vale 471` (321,290) 1.7 s, `marrow 266` at 1500 (418,830) 2.3 s. On those worlds 46%, 64% and 83% of years have a line with no filter, the commonest under one in ten: they are worlds with a lot going on, and `vale 471`'s famines (317 of its 2,287 lines) are its real history.

Limits, stated: the note's count "52 realms fell" in 240 years reads large, and is the world's own. A filter's lesser things can't be expanded. The first reading on a busy world stalls the worker for up to 2.3 s, once per reading, the world standing meanwhile; the note's own reading comes with the run over. While a far world runs at speed the bar's date leads the host by up to a second's worth of years, so it steps back when stopped: that's older than this work. No line "It never will" was seen on a screen on these worlds at their stages; it's read by rule against F5 on four worlds. Safari itself wasn't run.

Cut for later: writing the history out as a file (row 66), the people bar (row 49), a note kept to read again.

## Markets, first slice, as built (2026-11-06)

The simulation has had markets for a long time, one per land, with a stock, a price and a year's trade for each good. A person could barely see them. Now **🏷️** on a town's bar, or a press on its square, brings up a wooden board hanging in the town: what's for sale this year, what each costs in a unit a person asks for (a loaf, a fleece, a pot, a bar, a machine), whether that's dear or cheap against the usual, and whether it's rising or falling. Its head says **what the town is known for**. **Where it is dear** says what a merchant would carry: "Tin is cheapest at Gryrnar, at 119 coin a bar. At Humoney it costs 9 times that, 1,062 coin. It cannot be had at Bohaendholt or Emon or 4 more." Every line opens that good's page, and from there the chain that made it, from the ground up.

- **It only reads.** All of it is `host/inspect/board.ts`: no state, no events, no version bump, the fixtures unmoved, hashes the same before and after.
- **One reading.** `goodCoin` is the only place a price becomes coin, and the board's loaf is `breadCoin`, the loaf a person's page reckons by. The gate reads the same number off both.
- **A market is a land's, a name is a town's.** At a far age a land holds up to 48 towns, so the price is the land's and what differs is what each is known for, from the land's books and the town's own tile: water beside it, ground above it, soil against its land's other towns, deposits within a walk, what stands there. Each thing is shared out so no more than a sixth of a land's towns say it first: before that, a land of 48 towns had 33 known for "the machines of its works".
- **Coin only where it's known.** A people with no currency reads in what they eat: "a hide buys 16 days' gathering".

Tally, every town of six saves, 76,000 towns: no town known for nothing, no board under three lines, the commonest sentence between 5.9% and 12.7% of a world's towns, the worst realm's first thing at most 38% of its towns in far worlds (58% at year 30, when there's little to tell apart). Numbers on a board run from 0.5 to about 1,100 coin on every save. A board costs 1 to 6 ms on a town of 62 million, at most about 50 ms the first time a land's region is read, and nothing until opened.

Found by pressing: the Book stood over any page it opened, a tall sheet lay under a life's strips with its close, and a chrome rule of possession hid every page. **A life's and a reign's tray lay over a page's last lines**: it now gives way while a page is open.

What the board shows of the sim: **far prices are pinned.** `reprice` clamps a price between 0.33 and 3.03 of its worth, so at a far age clothing and wool sit at 3.03 on almost every market and tools at 0.33, with 781 thousand million in store at one land. The board is honest about it, and a far world's board reads much the same from town to town. That's a rule to look at after the seed list, not something a page should hide.

Limits, stated: the market hall's own press isn't exercised by touch, since no hook gives a hall's screen place; the square's and 🏷️'s are. Possession has no button that opens a page, so a board can't be reached there. No no-grip world's board was opened on the screen; `vale 471` was tallied and reads its own things.

Cut for later: a map lens of a good's price, treasuries, finery in rich homes linked to the board, a war's effect past a good's five years of books, a signboard drawn in the square.

## Memory in the town, as built (2026-11-06)

A town now keeps what happened to it. On the rim of its square stand up to five things raised: a standing stone to a hunger, a tomb for one who ruled long, a slab of black glass for the dead of a fire. Each is pressed like anything else, and its page says what it is, who raised it, whether they are gone, and who holds the town now and lets it stand. A people has songs and tales made from the same history. At a feast you see a note with what they're singing, and a town's page, a realm's and a people's have a Songs and tales tab.

- **It only reads.** One reading of the log (`host/inspect/memory.ts`, kept per world by the log's count and last id). No state, no events, no commands, no version bump; the hashes are the same before and after.
- **How a thing finds its town.** One that names a town: that town. A battle or landing: the land's heart if it stood then, else its oldest. A sickness, hunger or rising: one of its towns standing then, drawn by the event. A ruler or a realm's end: the town the realm is named for. No town then: a song, no stone.
- **Shape from what happened, stuff from who raised it.** The land's rock, cut. A people who can't grip heap: cairn, heap, barrow, and nothing is cut on them ("No one here can cut a word, so nothing is written on it, and everyone knows what it says"). A water people bind shell and coral. After fusion, black glass.
- **Songs wear.** Under 60 years they count the dead. Under 400 they round them. Under 1,200 names wear short. Older than that, no name is left, and the page says so under How it has changed, and says what really happened.
- **It stands in the way.** People go round a stone, and so does one walked.
- **Pressed anywhere in a town.** From the eye, during a life, and while walking in someone. Possessed, a stone 40 metres off or nearer opens, and the body stands on while it's read; further off it says to walk nearer. Gate 93 presses each by touch.

Tally of whole worlds: harrow 348 at 3000, 333 of 2,101 towns have a stone (16%); kestrel 557 at 2000, 25%; vale 471 at 2000, 16%; first light at 2000, 10%. At most 5 a town and 2 of a kind. The commonest song title is at most 9.9% of a world's. A town's stones are 45 parts at most; on harrow's worst town a frame takes 16.7 ms with them and 16.8 without. Reading a save's memory once takes 8 to 620 ms on the worker, then nothing until the log moves.

Found by tallying what stands against what a page lists: **a quarter of a far city's stones stood nowhere** (harrow 348 at 3000: 93 of 121), since the market's stalls ruled out most of the rim, their clearance counting a stone's breadth along the rim as if it reached inward. All stand now, on the rim, then a little in, then closer beside each other (`view/memorial.ts`), and a stone's ⌖ Go to always closes its page.

Found by pressing: the possession's controls lay over any page, so a page opened there couldn't be touched. It now lies over them, and what they tell gives way while it's open.

A city of towers hides its stones from the eye above it: its page lists them under What they raised, and a stone's own page has **⌖ Go to**, which brings the eye down across the square at it, past whatever stands around. Gate 93 checks the stone is truly in the picture afterward, with and without it.

Limits, stated: a tap isn't stopped by a building standing in front of a stone, as with everything else pressed in a town. Desktop size and Safari weren't run. No saved world tested here showed a stump, the great fire's own stone; it's read by rule.

Cut for later: murals, rites, a Speaker's sayings, a person going to the stone on the day, a song's own tongue-word titles.


## Crime and justice, as built (2026-11-06)

A town now has people brought before whoever judges there, for something that happened that year, for a reason you can follow. A case is a reading, like a home or a person's day: drawn by a stream from its town, year and number, off what the record holds of the year before (a land's food, its market's book, the battles and raids before then, the law as it stood). No state, no events, no bump: the same town and year tell the same cases each time, and hashes are the same before and after.

- **A person is a person.** Those named are the town's own people, the same ones its homes and lists name, and a plan always draws whoever a case of this year or last names. The gate presses a real accused's name and home from their case and reads the same name and age on all three. One who has since died keeps their case, and its page says so. A case can't kill anyone: the roster holds its dead by what history did, so the worst a court does is send a person away for two years.
- **A case comes from a cause,** each weighed and each linked where the record has it: a land's hunger, a lean year against that land's own usual, food going dear, what a poor home earns against what it owes, rent where the land's law has it, money in a town or little on the road, a battle in the land, a raid on the town, a levy called, grievance, a rising, a seat seized, one faith, the bound.
- **The law is who they are.** A hive tries no one: the rest turn from one of their own, and its offences are its own (taking another's share, not moving with the rest). A water people meets at a reef post and has no cell. No written word, or no realm: old ones in a ring. Custom: heads of families, a blood-price, stocks. A magistrate: fines, stocks, a cell, the realm's works where it binds its condemned, and a corrupt realm's let-off. One law for all: a bench, the only one who can find a person not guilty. A people who can't grip carve no bench and fly no flag: a low heap of stones, a pen, a pit.
- **Seen.** A court stands on the rim of the square and in the way of whoever walks into it. On its day the town's own people play it: the oldest judge, the one brought stands at the rail, up to 36 come to watch, a note says who stands and for what. Afterwards the sentence runs in the same day's legs: a fine paid at the bench, the stocks, the cell, labour, or walked out along the road. Pressed, by touch at its real place, in a life or a possession too, it opens the case. A town's page has **Law and order**: who judges, the law, how it stands beside its land's other towns, who is held now, this year's and last year's cases. A person's page has **Before the law**.

Tally, sampling about 60 towns of each world: `harrow 348` at 3000, 318 cases, 5 a town at the middle and 12 at most, stocks 38%, fine 30%, cell 28%, bread 21%. `first light` at 2000, 290 cases, 5 and 10, fine 41%, cell 25%, stall 29%. `harrow 259` (a hive) at 2000, 301 cases, 5 and 9, labour 51%, turned from 46%, scented out 3%. No town with none over five years, no town with only one kind of case, no bad word on any page.

Found by reading a whole world: "It was a lean year" fit almost every far town, since a far land's leanest month is short every year; a lean year is now one worse than that land's own last ten, and what's true every year says so. `fed` is what a land ate at its leanest, not what it grew, and the words were wrong. A hive was tried for rent and for robbing a market stall. A vale 471 people under a magistrate were drawn a carved bench.

Found by pressing: on any page, a tab pressed on a phone sent the page back to its top, so the tab that was asked for lay a screen below. A tab's row now stays in sight, with what it opened under it, on every page in the game.

Limits, stated: frame cost with a court against without isn't measured (23 parts in 4 batches at most, a budget gate runs on CI). Desktop size and Safari weren't run. A colony's halls and a far people's towns have no court. Where a town has five stones its court can stand within 2 m of one (one town of 60).

Cut for later: being robbed or stealing when hungry as offers on a life's tray; a decree seen in the cases that follow; a crime lens; a page of who's held across a realm; a colony's own court; hanging; a button that waits for the court (a town's sittings are days apart).

## The people bar and the history written out, as built (2026-11-06)

A slim row at the foot of the screen says who matters where the eye is, why, and how they are, and every word of it is read off the world. The ruler of the land you're over; one moving against them or wanting their seat; their heir; the ruler they're at war with; the last to take a seat by force anywhere. Where no realm stands, an elder of the town there. Those a person keeps with 📌 and those they follow come first. A chip opens the same page, with the same face and name, and that page says the same reading in full. And one press on The Years writes the world's whole history out as one file a person can keep and read with no network.

- **Mood is a reading, or it says so.** History keeps no mood for a ruler: it keeps their standing, so a ruler's chip shows ⚖️ and how many in a hundred hold their rule rightful. One at court shows what they want. One of the town's people with no mood kept says none, and their page says why. A body is its page's Body line, its age against what that people lives, and a sickness in its land.
- **It reads, it never touches.** No state, no events, no bump; the gate compares hashes. A pin is a viewer's, one list to a world. It asks the worker every 0.8 s at most whether the place has settled, and reads only when the place has held for 1.4 s or the year has moved.
- **It gives way.** A page, a star's card, a leader's chip, a possession, a life, a reign and a film each have the foot of the screen to themselves. On a phone at the stars' map and the galaxy, where a legend lives at the foot, it stands aside and comes back on the way down.
- **One who left a seat says so.** A pinned ruler who no longer rules reads "No longer rules Sairis", and a press goes to how it passed.
- **The file is the world's own pages,** cut: no second writer. A realm is its page's facts, rulers and wars; a war its facts; a person theirs; a year what The Years tells with no filter. Links work inside the file, nothing reaches outside it, and what was left out is said at its head. A press saves it; where the browser can hand a file to the share sheet, a second press does that (a share must come straight from a finger, so it can't follow the long read).

Found by measuring: the file took about six minutes on `first light` at 2000 and eleven on `vale 471` at 2000, in node, because a page builds all of its tabs: a realm's other dozen were 89% of what its page cost, and a history tab walked the whole log per realm. A page can now be asked for only the tabs a caller will read, which only the file does. A fallen ruler's "In their reign" and a realm's rulers stopped walking the years after they ended, which every such page gains. Same words in the file, about 64 s and 59 s, then the caps (800 realms, 800 wars, 600 people, each the greatest first) brought the worst world to about 45 s and 4.3 MB on `gale 710` at 2000, and 14 s and 3.0 MB on `first light` at 2000, in node under load.

Found by looking: 1.7 chips show on a phone and the rest are a swipe, which the gate now does with a real finger. On a phone at the stars' map the bar lay over the legend and a chip's name, hence standing aside there. Readings were 10 px: now 11, on a chip 12 px wider, with × a finger's width to press through a larger target than it shows.

Measures, on the final code: `harrow 348` at 3000, 117 peopled lands: at most 4 on the bar and 2.5 on average, nowhere with none, its commonest sentence 9% of them, a read 11 ms on average and 156 ms at worst; the file in about a second in a phone-sized browser, 1.47 MB, the page never held up. `first light` at 2000, 599 lands: at most 3, a read 3.6 ms on average and 1.3 s for the first under load; 9,955 links in the file and none leading nowhere. Over 12 years at three seats, the bar changed in 22% to 39% of seat-years, each a real change of who rules or who wants it. Hashes the same; WebKit read the file (1,061,281 characters).

Limits, stated: no real iPhone has pressed the share button, and it hasn't been pressed in any run, since a share sheet needs a real device. The people on a chip go by the world's own spelling, not a people's own tongue (a viewer's "as they say it" reaches pages only). Star realms' rulers aren't on the bar unless they also rule a land of the home world. A person past those a town draws has no address to go to, as elsewhere.

Cut for later: a people's own names on the bar and in the file; the bar during a life or a reign, showing who matters to that person; a town's, a faith's or a tongue's entry in the file.

## Wars with aims, peace with terms, as built (2026-11-06)

A war used to be about a land and end in a line. Now what a war is about is read off what drove it: hunger, a tribute unpaid, a land lost, a temple's press, a court's press on a much weaker realm, else a land. It's kept on the war's declaration, so a save grows by no column and an old save's wars simply have none. The aim steers: a host goes for the land it came for by name, a hungry host carries off grain and leaves the land, a holy war names the two faiths.

A peace now comes to something, by how the war went and how far each side is spent: land ceded, a tribute, an oath, a truce with a date. Whatever binds is kept in one small store, `sim/war/bonds.ts`, and runs out by the world's clock with a line in the log. A vassal keeps its lands and its ruler, pays what it can be asked, declares no war of its own and rises when it is strong enough. No one bound holds anyone bound, so a chain is at most one. A ruler can offer and demand on the War and peace sheet (`reign.peace`, `reign.rise`), and a refusal comes in the other ruler's voice.

- **A tribute really moves,** from the payer's lands to the other's seat, out of what each land holds above three months of its food, as a tithe does. Three short years and it has stopped paying, which is remembered and is a reason for the next war.
- **Where people eat all they make, no one asks.** Harvest and eating fall in the same month, so at far ages a market's food at a year's turn is often nothing: on `gale 710` at 2000, 12 of 701 realms could pay 1% of what they make. The first form asked anyway, and 179 of 180 tributes there ended in "stopped paying". Now a tribute needs grain to spare, an oath from one with none pays nothing and says so, and a ruler's offer is refused in those words.

Tally of 60 years each from a save at 2000. `gale 710`: 650 wars, 608 truces, 18 realms that fell, 4 oaths, 1 tribute, none unpaid, worst bond under 2% of what its payer makes, chain 1. `amber 101`: 192 wars, 146 truces, 12 oaths, 10 tributes, 3 lands ceded, 1 unpaid. `first light` before the spare rule: 209 wars, the same shape.

Found by pressing: a peace with no land left between the two said nothing of its terms, and so did one where a side fell and one by the greatest fire; each now says what it came to. The seventh button on the tray broke "Marriage" in two: it reads "Marry". 🔊 lay over the ends of a sheet's lines on the phone and now gives way.

Levers, with what's measured: **far worlds are 96% truces** (608 of 633 on `gale 710`), and attackers win about one battle in ten by design (`defend = strength × 1.5`), so "was beaten back, and swore a truce" is the commonest line of a far age. Tithes move nothing at far ages either, for the same reason as tribute. A peace made by the god's hand has no terms. Cut for later: a blocs lens, wars named by the world, a Years filter for terms ending, claimants across realms, an overlord defending its vassal, a ruler withholding tribute by word, a water people's word for grain in terms and credit lines.

## The world acting on its own, as built (2026-11-06)

A world now does things with no one's hand on it. The ground shakes where its plates meet, lightning in a dry year lights the woods and the fire goes on from there, a stone falls now and then from a sky that brings them, and a new mountain rises where one plate goes under another. Each has its page, and each page says why here: which plates, how often a land like this has a shock so great, how little rain fell that year, how far it burned. A ruler is judged by what they do about it: help reaches those it left, or it doesn't, and that is remembered.

- **The stakes are the owner's rule: the greater the blow, the rarer it falls and the more everyone feels it.** Magnitudes go by the Gutenberg-Richter law, ten times rarer for each step. Lightning, a wood's years between fires, a falling stone's size against its rarity all come from what an encyclopedia says, and `rules/nature.ts` says which. What a small fire or a small shock does stays in a land's own history. Only a world's great losses come as a window.
- **By what a world holds.** A shock needs plates, a fire needs something to burn and air to burn it, and a stone comes through the air it has to come through: a stone that bursts over one world strikes the ground on another. A world of sulfur burns blue. A methane world has no fire at all.
- **No second kind of disaster.** Natural shocks, town fires and stones are the god's own events with no hand among their causes, so a town's rubble, its fire brigade, its diggers, its grief and its stones to the dead all come as they do for an act of the god's.
- **A fire on a land is seen moving.** Its front goes tile by tile over the ground the land's map shows, through what can burn, slower across a river and stopped by a lake, the sea and bare ground. Flames at the line, smoke going up, char behind it going to dry brown over the years, the woods gone from it until they grow back. Its way is worked out once, so a frame only reads a slice of a list. At a fast clock it's drawn out to be watched for twelve of the viewer's seconds; a world's date goes on.

Found by watching, none of it by a green gate:

- **The first gate passed on a fire no one could see:** it stood on the moment a fire lit, and a held world shows nothing of that yet. It now goes back to the day before, on the land the fire crosses, and lets the clock run at a land's own first speed.
- **The burning ground was a flat orange sheet under floating brown boxes.** Now a thin glowing line, black ground behind it with embers in it, larger flames, and grey puffs that swell as they leave the ground and shrink to nothing at the top of their rise.
- **A town being watched heard of a shock only at the year's turn,** by when its fire had burned out unseen. It now listens for what the world did to it and reads itself again within seconds, walked in or lived in or only watched: gate 97 presses all three.
- **A sulfur world never burned blue:** the chemistry spells it sulphur and the rule looked for sulfur. It now goes by the world's kind.
- **A fire could end before its last patch had burned,** a new unit test found: a patch reached late isn't always the last on the list.
- **A great shock flattened all that was drawn of a far city's middle, and it fell back to a hamlet's drawing:** a ring of huts in the dark, with no shaking and no dust, 47,929 homes down. A gate's soft `if` had let it pass. A town flattened by anything now stays drawn as its rubble, burning, for as long as that ground lies flat.
- **Words.** "lit the savanna of the savanna" (a land with no name says its own ground twice), "11 died, and 0 homes fell", "0 died in", "a plate of land meets a plate of land". A forgotten shock's page said "By your hand": it now claims no one's.

Measures: over 40 years of far `first light` at 2000 (59 billion people), 405 shocks a century that reached anyone (magnitude 6s 197, 7s 85, 8s 15, 9s 2.5) and 155 fires, 47 of them reaching a town; 2.73 million dead of shocks and 30,645 of fires; the worst shock 551,847 and the worst fire 4,896. Young `first light`, years 0 to 200 (1 to 5 million people): 333 shocks and 992 fires a century, 416 reaching a town; 7,140 and 1,929 dead; the worst 349 and 32. `gale 710`, carbon, 2,140 shocks a century and no fire; young `tide 653`, sulfur, 1,424 shocks and 1,258 fires. The Years: 105 of 716 lines in `first light`'s first 60 years, in 56 of them; 33 of 269 in `harrow 348`'s 30 years from 3000, in 18, the many told as one with "and seven more like it". Ages, eight worlds against W7: mostly the same or within a step or two, `quill 742`'s electricity 150 years later and `ember 260`'s orbit 50 earlier; none stalled. A year costs 234 ms against 219 on `harrow 348` at 3000 (+7%, run side by side), 2,814 against 2,747 on `gale 710` at 2000 (+2%); a save grows 0.1 MB in 7.3 and 0.4 in 117 over those years.

Limits, stated: a shock brings down a town's heart first, as the god's does, so a great one leaves all that's drawn of a far city flat where a share of it, scattered, would be truer. no generated home world yet has too few plates, so a world with one lid is forged in a unit test, not met. Fire doesn't reach a water people's towns, since their patches lie under the sea; a shock does. A town burns the moment its fire lights rather than when the front comes to it. A flash of lightning stays drawn while the clock is paused.

Cut for later: tsunami, aftershocks, a ruler's answer offered in a possession, a land's page listing what it came through, paths worn by feet (Classic 46's last piece), a town's stone for a fire with under 100 dead, a season for a fire (it falls in its land's fixed month), a fire's front reaching a town before the town burns.

## What binds realms, as built (2026-11-06)

A pact used to be a word on a page. Now it's called on. A realm attacked calls whoever is sworn to it, and they answer or they don't, by how they stand, with the answer told in the world's words. Rulers marry their houses into each other's without anyone's hand, a house with no one left brings a claim to its seat, and realms keep people at each other's courts so that what they believe of each other is true. All of it is `sim/war/ties.ts`, one store that saves, and `host/inspect/ties.ts`.

- **A called war is its own war.** It has its own declaration, which says who called and by what, so battles, the levy, peace terms, strikes, pages, the war lens, the town at war, saves and going cold all work unchanged, and no field goes on a war. A chain is stopped by the rule, not a tuned number: a war a call began calls no one, and no more than four come to one war. A realm in more than one war divides its host among them, so an ally coming really does help.
- **A bloc is who stands with whom.** A realm stands with the strongest it's bound to, if stronger than it, so a chain of pacts ends at one head and no thread of pacts swallows a world. Read once a year. The Blocs lens 🪢 colours the map by it, and each bloc has its page.
- **A people with no houses binds as it is.** Read off what a people is, as a town's law is: a hive gives of its brood, a people of the water graft reef to reef, those who choose their rulers foster each other's young, and the rest marry. A fostering brings no war.
- **A claim comes where a house has no one left:** where a court names no one, or by chance where there's no court. It has four ends: the realm passes to the other house, one of the marriage is seated, it's fought for, or it passes them by.
- **An envoy can be seen.** One goes with each call, compact, marriage, claim and embassy, kept eight years: a rider under their realm's banner on the longest road of either seat's land, named as the eye comes near, standing before the other's court, each with their page. ⌖ Go to on the page takes the eye to them, and a press on them opens it. A ruler sends one from the tray.
- **An embassy keeps a reading true.** Without one a realm misreads another's host by up to half as much again, by decade, and that belief is what a declaration reads, so a war's why can say "a host they thought smaller than it was".
- **A compact is the many against the greatest.** ("League" was already a realm's own title.) At most one open, two past 300 realms; looked for every five years among the three most peopled only, 50 years' rest after one ends, 60 years at the most. It holds its enemy back by half, no member makes war on another, and each answers the others' call.

Found by watching, none of it by a green gate:

- **The first gate counted a rider on the road and showed bare ground,** and its eye stood where no one can stand: the land's nearest is twelve units off. There a rider was a speck with no way to find it among 307 km of land. They're now 2.5 times larger than life, named, and a page goes to them.
- **A land built over scattered 3,600 blocks and 3,000 towers with no regard for its roads,** so a third of each road and everything on it ran under them. Roads now run clear through it (`onLines`), and a far world's trucks and trains can be seen too.
- **A rider and a road ran under a field's plate and a far city's trodden ground,** since those lie flat at their highest corner on a slope. Roads, carriers and riders now go over both, tile by tile.
- **Words.** A hive's fostering said "raised between" where it gives of its brood, and its dead "no one left of the house"; the gift button didn't say how much.

Measures: `alien harrow 348`, 3000 to 3100: 29 wars a century, 6 of them called; 2.21 realms in the average war, 4 at the most; 8% of realms at war in a year; the largest realm 39% of the lands; 1 compact; 11 marriages and 3 claims. Earth `first light`, 2000 to 2040: 187 wars, 35 called; 5 at the most. `kestrel 557`, water, 2000 to 2040: no wars, 7 grafts, 5 claims (3 seated, 1 passed, 1 passed by). Young `first light`, 0 to 700: 571 wars, 11 called; 78 marriages and 33 claims. At year 800 of it, 126 realms stand and the largest holds 36 of 522 lands, against 71 realms and 60 lands before this: allies hold the strong back. `harrow 259`, a hive, 2000 to 2030: 89 given of the brood, 20 claims, 743 wars a century, 113 called. A year on `gale 710` at 2000 costs 2,090 ms against 2,169 before (the same, side by side), and `harrow 348` 179 against 166; a save grows 0.1 MB on 7.4 and 0.3 on 97. Ages don't stall.

Levers, not begun: open markets; a person's choice when their own realm is called (a window: come, or stand aside); a compact's own first march; embassies by a people's own form; envoys walking a town's streets; a window when a followed realm's call is answered. An ally's battles don't count toward the main war's edge at its peace: each war's peace reads its own.

## A living ecology through history, as built (2026-11-06)

A land's woods used to stand where the world first laid them, less what people cut, and an ore lay there for ever. Now woods reach out and draw back with a land's rain through the ages, rain has its long ages, and a lode can be dug out.

- **One number a land.** `reach`, for all 4,000 lands, looked at once in five years (`sim/ecology/woods.ts`). What stands is that share of what the ecology keeps, so fields, felling and fire go on as before. No patch of ground is read after a world's table is made: gen's own rule for where woods stand is asked once per patch at nine rains and three warmings, and read off that. On a people of the water it's the weed beds of their shelf, by how cold the sea is.
- **Rain has long ages.** Two waves round the world, no state, at most about 12% of a land's rain, so a wet age here is a dry one elsewhere (`sim/climate/long.ts`). Dry years, fires, fields and woods all read the one rain.
- **A lode gives out.** Only what has been dug is kept (`sim/economy/lodes.ts`). Depths come by means: picks, engines, machines that think, then the old heaps at 0.15 of the first grade, for ever. A town turns to a neighbour's lode, then to one two lands off, to a road, to its store, and some of those who worked it leave. Lore finds by what the world laid down, so the ages don't wait on a mine.
- **It can be seen.** A land's own map: on `harrow 348` the land at 5.3S 46.4W goes from 9,090 trees to 3,873 in 200 years, most of what's left brown for twelve years after a drought; on `first light` a savanna land goes from 3,378 to 8,310 by year 122, green coming in from its wettest corner. The Forest lens colours the world by what stands. A town's mine gives out as a dark pit among grey heaps. The Years tell a mine's end and seldom anything else; a land's page keeps its last three turns, each with its reason.

Found by watching, none of it by a green gate:

- **The first shots of a mine before and after were night and day,** so their pixel check proved nothing. The gate now takes both at the same noon.
- **`minds` came 120 years late on `first light` at the first lode sizes,** since the mines ran out before machines reached them. Lodes are a quarter of that size, and the age is back to about when it was.
- **Words.** A well's page said "dug as deep as picks could reach".

Measures. `first light`: woods 57% of its land at first, 47% by year 300, 28% at 700 when engines fell them, 33% at 1100. 46 mines give out, the first in year 826, all in the 300 years before machines that think reopen them; 30 towns turned to a neighbour's lode, 10 to one two lands off, 2 to a road, 4 to what was in store, none to nothing; 32 million of about 620 million left. Far worlds: none gives out, since machines already reach; `gale 710` has 1,207 go deeper in its first 50 years, importance 3, under the news.

Rain and people. `ash vale`'s people stand a quarter lower from year 300 on, and with the long rain off they match a world without it to a part in a hundred, so it's all the rain: a dry age of 9% at year 300 emptied 26 of its 92 lands fifty years sooner, and growth after that isn't bound by rain, so the gap stays. Elsewhere it goes both ways: `lumen 285` 3% up throughout; `north 495` 15% down at year 600 and 11% up at 800; `vale 496` 8% down at 400, level by 800; `tide 207` 16% down at 800. No world's age stalled. A year on `gale 710` at 2000 costs 730 ms against 706 side by side (3%), its save 97.8 MB against 97.6.

Limits, stated: "there is none to be had" has never fired, 0 of 46 mines on `first light`. Who builds with what, a battle's forests and a home's wood still read the ecology's forest, not what stands now, so this step doesn't move builds, battles and air at once. Weed beds are counted, told and on the lens, but not drawn in the sea. The Ores lens doesn't dim a done lode.

Cut for later: crags with lit faces, which need a flat-shaded mesh and a steepness measure across land scales; more crowns than these four, and a shape of its own for an alien life, which keep the world's tint for now.

## Wild lives, as built (2026-11-06)

A world's creatures used to be a drawn list that stood still while its history ran. Now they go where the green is, people drive them off, a town can come to know one of them by name, and the tree of life goes on.

- **One number a land.** `ecology.herds`, a byte for each of 4,002 lands, looked at once in five years (`sim/ecology/herds.ts`). Creatures walk in from the land beside and give way to fields, towns and a people's flocks. Everything seen moving is a reading of those numbers: `land.herds` moves nothing, and a kind's way through a year comes from warmth or rain either side of it.
- **Seen where they are.** Herds cross a land's map in their season and are gone out of it, a den is a mound with its page, and a town's edge has them coming past (`render/landherds.ts`, `view/fauna.ts`). A press on any of them opens what it is, what it eats, what eats it and where it lives.
- **A beast people name.** Seldom, about one in 80 years and never within 45 of the last, one hunter stands out on a land with a town: it gets a name in that town's tongue and a page (`beast:`). It takes from their flocks and from those who go out against it, and comes to its end by a hunter's hand, old age or leaving (`rules/herds.ts`). A herder stands between it and the fold.
- **War takes herds.** A host can drive off a quarter to over half of what a land keeps, told with who and why; what it took grows back over twelve years. On a people of the water, it's their pens.
- **The tree goes on.** A new kind stands apart where it's cut off, about once in 350 years. A kind dies out only when every land it has was pressed and lost it. Now and then one is made tame. The tree of life's page lists them under "Since the first peoples".

Tested by force, since no run reached them: a beast whose town has fallen, a kind going out both ways, a realm of one land raided and a hive's world's creatures (`tests/host/herds-paths.test.ts`). All read clean.

Measures. `first light` young, 0 to 700: 5 beasts named, all ended, 3 hunters fell to them, 16 to 38 herds driven a century, 1 new kind, none gone. Far `first light`, 2000 to 2300: 1 beast, 17 to 22 drives a century, 1 new kind, 1 tame. `alien harrow 348`, 3000 to 3600: no beast, 2 new kinds. Its 50 lands with both towns and wild left no hunter on any of them, so by that age none can rise there, and that's the world's own story. `gale 710`, far and always at war: 78 drives in 20 years, 354 million head. How far they go: the middle of a world's creatures moves 200 to 1,340 km a century, 4,000 and more once a young world fills. `fed` doesn't move beyond a part in a hundred. Year's cost on `gale 710`: 1352 ms against 1441 side by side, nothing that can be measured. Save: 17 to 64 KB of store before gzip.

Limits, stated: how many creatures a land holds doesn't feed what it can hunt. Overgrazing is told but pasture isn't worn on the map. A fallen hunter is a name, not a person on the roster. Tame kinds don't join the flocks. A new kind isn't in the tree's chart. A land built over shows no creature (`vale 471` at 2000 says so). No far world's kind has gone out by itself, though the rule is live: on `first light` at 2015 only 4 kinds live on 16 lands or fewer, 3 of those on lands no one lives on.

Cut for later: courtship and the young in a den, seen; a beast at large in the people bar.

## Roads built and travelled, as built (2026-11-06)

Roads were a look read off the year, and no one was ever seen laying one. A town at 2000 walked to work. Now a road comes to be, a town's ground shows where its people go, and those who live too far from their work ride. All of it is a reading of what the world already keeps: no rule moved and no save grew, so no world's history is touched.

- **A road being laid.** A gang works along a road a section at a time, with a flag, a shelter, heaps of the land's own stone or stacked lengths of rail, its way pegged out ahead and workers going to and fro. Behind them the road is what it's becoming, ahead of them what it was. A press on the gang or the road opens the road's page, and ⌖ Go to brings the eye back to the gang (`host/roads.ts`, `host/roadwords.ts`, `render/landworks.ts`). Up to 20 gangs are drawn on a land.
- **A road's page.** Who built it, when, what it's laid with, what goes along it, what it joins, who works it and who pays, how far along, what stopped it, and what cut it. A war or a shock cuts a road: it lies open with rubble, and traffic stops short of the gap (`host/inspect/road.ts`).
- **Ways worn by feet.** A town's ground wears where its people really walk: home to well, home to work, the square's corners, the way to the fields. Greening where a town has shrunk. Tracks run between camps and hamlets before a road is built (`view/worn.ts`). In a far paved town the wear is faint, as paving would make it.
- **Getting to work.** Past engines, people who live far from their work go in what they keep: it stands at their door by night and near their work by day, and it goes the way they would have walked. A line runs through the town by way of its square, with a window lit for each aboard. In Live their day one rides: the eye goes along from higher up, and a line's coach comes up about them (`view/rides.ts`, `render/towntraffic.ts`, `view/lived.ts`). Whether someone keeps one is read off that person alone, so a plan read again can't move it.
- **By what a people is.** A water people has current-sleds and a pale drift-line, a hive has haulers no household owns, a people with nothing to grip has a works-line laid in the ground, and before engines it's feet or a mount's back (`getAbout` in `host/roads.ts`). A water people's roads lie along the sea's floor: `linePieces` took a floor and ignored it, fixed here.

Found by watching: a town read again destroyed its cars and buses for good, since `VillageScene.build` destroys what stands under its root but the layers it names. The lists stayed full while the streets went empty, so gate 101 now counts a ride in the pixels. A clock jumped past the start of a ride left a person walking after their own car from 1.9 km back. A pressed car often gave someone standing by it: a press now asks for the car first and measures to the body drawn, and each car has a spot of its own. The other way about, a car only near the finger took presses meant for what stood there, in a city where cars stand along every street: now it takes the press on open ground alone.

Measures, gate 101 on the phone. `first light` at 2000, Gameason: 60 cars and 3 lines from the 220 people drawn, 21 aboard of a morning, 2,397 of 14,532 ways worn; three cars pressed, three owners, two with someone standing by. `kestrel 557` at 2000, Traelmere: 49 current-sleds, 3 drift-lines, 12 aboard. `harrow 259` and `vale 471` at 2000 and `harrow 348` at 3000 pass the same. Young `first light` at 300 and 540: no cars, a track being laid, 82 of 282 ways worn. A frame on the worst town, Saiseathaethwick at 2000 with 75 cars, at a phone's size on a desktop's graphics: 5.9 ms at the 95th percentile against 5.3 without, and 4.5 against 3.7 on its land.

Limits, stated. A road's stone is told in tonnes and comes out of no store; a gang's wage is words. Doing either is a rule change with its own A/B. A road opening isn't in The Years, and a cut road isn't news. Only those a town draws have cars, as with walkers, so a great city's sprawl has none. A car keeps its owner's walking pace on the clock, which at a town's speeds reads quick. A line runs a loop with no stops or timetable. No clade flies yet, so nothing is drawn for those who fly. On far worlds a gang is upkeep, relaying what's there: a road laid new is a young world's sight.

## A town asked, as built (2026-11-06)

A god could burn a town and couldn't ask it for a well. Now a town can be asked, and it's the town that decides how the asking goes. It's a rule change, and a world no one asks in is bit for bit what it was: the store keeps nothing until someone asks and stays out of the hash until then, so the eight oracle records didn't move.

- **Asking.** 🙏 on a town's bar or its page opens a sheet of what it can raise and what it can put first, each with about how long and how many at it, and a list of what isn't to be asked of it, with why: "A well: they live in the water". A ruler has the same sheet for the towns of their own realm, and is answered by that town's head. What a town can raise comes off what it has and what its people are, so a reef has its speaking hollow and a hive its brood store. A colony's sealed halls can't be asked, and a band's camp has no town to ask (`sim/town/asks.ts`, `ui/ask-sheet.ts`).
- **The answer.** It comes back as a page, by name, with why: glad, grudged, by half, or refused, from hunger, war on their land, how much they've been asked lately, and how devout they are. "Dree Biston, for the council, answered you: it will be done gladly." A hive doesn't answer at all: "No one says yes. The workers simply come." People in the town say their piece: "I've carried enough for the speaking hollow. I'd like to see who asked come and carry some." (`host/inspect/asks.ts`, `causal/asks.ts`).
- **The site.** Dug ground, a timber frame, heaps of the land's own stuff that go down as it goes up, an orange flag, down while the work stands idle, and the hands along both long sides. The building is one of the town's own, in its fabric, so it stands and reloads as they do, and it stands from the moment of asking with the clock stopped. Those at work can be pressed, and a press on the site opens its page. A band of hands costs the fields, and the page says how much: "Those hands aren't in the fields: 1 in a thousand of what Fathearney's land would have brought in isn't." Those at it eat from what the land brought in (`view/town.ts`, `view/errands.ts`).
- **A priority.** Put food, faith, trade, learning, walls or arms first: for some years a share of the town is at it, and it shows on their day and on the board. Walls asked for count in war.
- **What it leaves.** A stone of the asking and a song, kept as the town's other stones are, and The Years keep it. "We were asked, and we carried it, and it stands, and no one has yet told us why us." A site can be given up: what stood of it razed, the town taken by another realm, no one left, and its page says how far it got and why.

Found by watching. A site begun with the clock stopped didn't exist yet, because its start is the world's clock, a moment after the paused screen's, so it now stands from the asking. A stone in a far city stood taller than the screen's open part and its middle lay under the top panel; a stone or a car behind it could take the press; and a tall stone stood close under, its head behind the eye, couldn't be pressed at all, since a finger was only measured against a thing whose whole height lay in front of the eye. Now a finger right on a stone is a line from the eye against the very boxes it's made of, and whoever's nearer along that line takes the press first. A car beside the eye, its body thousands of pixels across as it was measured, took every press on the screen until its breadth was measured from its own middle; a car only near the finger took presses meant for what stood there. And someone of the crowd pressed in a life, a reign or a possession brought nothing at all, since those screens have no place for a card, so their page comes now. Gate 102 presses one under a reign.

Measures, `tools/h1-tally.ts` over each world's towns, one raise and one priority each. `first light` at 300: 30 towns, grudged 41, by half 10, glad 6, refused 2. `harrow 348` at 3000: glad 29, grudged 16, by half 15. `kestrel 557` at 2000: grudged 13, glad 9, by half 6. `vale 471`: glad 13, by half 9, grudged 6. `harrow 259`: glad 19, by half 8, refused 1. `gale 710`: glad 14, by half 9, grudged 5. A well in 4.0 months with 8 hands of 478, a school in 15.0 with 10 of 278; a workshop at harrow in 3.0 with 14 of 1,545,723. Lands asked against the same lands unasked: fed 90.7 against 90.6 at harrow, worst single land -0.2 points. Unasked, run against the tree before it: young `first light` 0 to 300 and far `harrow 348` 3000 to 3010, the same chain. Gate 102 passes on the phone on `first light` young, `harrow 348` at 3000, and `kestrel 557`, `vale 471`, `harrow 259` and `gale 710` at 2000. A frame at a far city's site, at a phone's size on a desktop's graphics: 16.8 ms at the median with a site and without, at the 60 fps cap, so a small cost couldn't show there. Not measured on a phone.

Limits, stated. Past about half a million people a town is offered much the same five things, so a far great town's list says little about that town, and "They are a devout people" stood on 60 of 60 far pages at harrow; the levers are in the ranked list. Trade, faith and learning change the day, the board's words and the hands, not a land's piety or lore. Homes changes who builds. Only asked walls count in war, not walls a town raised itself. Food and tools are really drawn; stone and timber are told, as a road's are. A raised thing can take a lot that held homes, and no page says whose homes they were. A person's name can read differently some years later, as the roster's name follows the tongue's drift.

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

