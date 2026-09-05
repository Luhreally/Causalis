# Causalis — The Living Equation

Causalis is a deterministic artificial-life god game in which chemistry, ecology, evolution, settlements, technology, conflict, and recorded history all share one conserved world state.

## Project layout

- `index.html` contains the accessible game shell.
- `src/styles/` separates foundation, layout, dialogs, observatory, and mobile presentation.
- `src/game/sections/` contains the simulation in explicit load order. The section manifest preserves the original closure and execution order without rewriting the engine during migration.
- `src/main.js` starts the game.
- `tests/` covers determinism, conservation, cohorts, ecology, causal conflict/occupation, camera behavior, saves, construction, cognition, civilization progression, and the phone interface.
- `legacy/index.single-file.html` is the untouched pre-migration source for comparison.

## Player experience

Choose **First expedition** to begin in a small, inhabited world with a five-step
field journal: inspect a life, observe time, bring rain, inspect the recorded
change, and save. **Create a world** retains the full cellular start and generation
controls. Expedition saves use an empty manual slot; existing manual saves are
never silently overwritten.

Simple controls are the default. **All controls** exposes the full instruments.
Inspectors lead with the selected life or habitat and put the original detailed
record behind a disclosure. Pin up to eight identities to the watchlist, and jump
from notable event notifications into their history. Pins and journal progress
are device-local; world archives still export and import through the save menu.

Sound can be enabled in the expedition setup or world controls. Ambient rain and
wind, intervention cues, and discovery/warning tones respect the volume setting.
Reduced motion can be selected in Settings and follows the operating-system
preference for interface motion and intervention rings. Switching to another tab
pauses an active simulation.

Projected terrain is reused between unchanged frames, with immediate invalidation
for camera changes, overlays, and interventions. Creatures and atmospheric effects
continue to draw. This reduces repeated terrain work; it is not a universal
frame-rate guarantee. Large worlds remain more expensive than Small or Phone.

The **Legends** tab is a linked encyclopedia of the world's history. Every notable
event is also written to the annals, a durable ledger that survives the chronicle
feed's compression, so old history stays readable and causes can be followed back
for the life of the world. Pages exist for lives (born, died, family, deeds,
bonds, and a personal chronicle with a live portrait), polities (Voices in order,
wars, allies and enemies), peoples, places, species, artifacts, wars, and
calamities; every name is a link to another page, every page can jump to its
subject in the world, and every inspector offers "Open in Legends". Search boxes
filter the index and its lists. `npm run test:legends` renders the pages headlessly
and checks that annals outlive event compression.

Every world speaks. A first tongue is drawn from the seed: a phoneme inventory,
syllable shapes, a spelling style, and a small lexicon for the concepts names are
built from. Each culture speaks a dialect derived from it by one to three regular
sound changes with a few words replaced, so a world's peoples sound related but
distinct, and the culture page in Legends shows the tongue, its sounds, its sound
changes, and sample words. People take a given name in their culture's tongue and
a family name shared by their kin group, children are born into their parents'
culture, and residents adopt their settlement's culture; camps, towns, polities,
cultures, species, and artifacts are named from the lexicon. The canonical
Earth-adjacent seed keeps the founding word lists. `npm run test:languages` checks
that alien seeds differ, kin share family names, names are deterministic, and old
saves regain their tongues.

The drama is on screen without hunting. A **people bar** along the bottom of the
world shows the lives that matter now (followed, selected, pinned, every polity's
Voice, and whoever the annals just named) with a live portrait, mood, current
activity, and health; a click selects and finds them, a second click follows them.
**Alert cards** at the top right announce notable events as they happen and link
each one to the earlier event it follows, so a Voice's death and the succession
that answers it, or a war and its ending, read as one arc; each card opens its
Legends page or jumps to its place, and alerts can be muted. **Map modes** join
the field lenses: polities and borders, cultures, roads and trade (worn paths in
brown, trade routes in gold), season (warm and cold offsets), species ranges (one
colour per species), and history (brighter where the annals gather), each with a
one-line legend in the map badge. `npm run test:observatory` covers all three.

`npm run test:experience` exercises the expedition sequence, real intervention
readings, successful-save completion, archive restoration, optional storage
failure, render isolation, and terrain cache invalidation.

## Development commands

```sh
npm install
npm run dev
```

Useful commands:

- `npm run build` creates a production build in `dist/`.
- `npm run test:fast` runs syntax, conservation/cohort, mobile, causal conflict, social/embodied systems, and save regressions.
- Saves store the world's determinism hash; archives written before save version 10 load without the integrity check because the hash algorithm changed.
- `npm run test:conflict` checks tactical wounds, blood-matter conservation, internal conflict, cited siege damage, and non-destructive capture.
- `npm run test:systems` checks causal love/betrayal/grief/revenge, critical emotion priority, buckets and fire suppression, deep-water vessels, persistent limb loss and fluid traces, field cycles, living herds, predator defense, and matter conservation.
- `npm test` runs the complete deterministic simulation suite.
- `npm run format` and `npm run format:check` keep the migrated sections consistent.

## Render lenses

Rendering reads world state and never writes it, so nothing here affects the simulation hash or replay determinism.

Terrain is lit rather than merely coloured. Each tile blends part way into its neighbours so a biome boundary reads as a transition instead of a hard palette step, and shading combines a directional key light with concavity so ridges catch light and hollows collect occlusion; shaded faces drift toward the atmosphere colour instead of turning grey. Terrace faces between columns are tinted from the tile they belong to and darkened in proportion to the actual step, so gentle relief melts into the surface while genuine escarpments read as shadowed rock. Polygons overlap by a fraction of a pixel to close the antialiasing seams that otherwise draw a dark grid over a projected heightfield.

An alien biome palette is drawn per band from an independent hue harmony, which can place fully saturated complements side by side. Hue variety is the planet's identity and is kept; chroma and value are pulled toward the planet's own key so those hues read as materials under one sun. Earth-adjacent palettes are already coherent and pass through untouched.

Projected views apply aerial perspective — screen depth is world depth, so a single haze ramp separates far ground from near ground and, at Rich quality, a bloom marks where the key light meets the horizon. Liquid carries drifting ripples, a specular highlight, and a two-pass shoreline of diffuse wet margin plus bright break line. Fire layers tongues over an additive halo and sheds embers.

Every seed also carries a surface genome, drawn from its own random stream so existing palettes are unchanged: a grain grammar (banded, mottled, crystalline, fibrous, scaled, dunes, or porous) with its own angle, scale, and strength; a second vegetation form mixed into the first in coherent patches; a prevailing wind with speed and gustiness; a cloud form and coverage; what the air carries (snow on cold worlds, ash on burned ones, dust on dry bare ones, pollen or spores on green ones, glowing motes on the strangest); an optional aurora; and the swell direction of its liquid. The top-down view bakes the grain into a texture composited over the terrain, spread across frames so a new world never stalls; projected views carry one grain mark per near tile in the grammar's shape. Live layers read the wall clock and weather only: cloud shadows drift with the wind and thicken in rain, wind sweeps cross the ground at Rich quality, particles fall or rise by kind and turn to rain streaks in a storm, canopy crowns and plant motifs sway on one travelling wind wave, geothermal vents breathe, hearths and furnaces smoke downwind, and idle creatures breathe while grazers dip to feed. The World tab lists the genome so two seeds can be compared.

Relief itself varies by seed beyond the six relief grammars: a landform grammar drawn from its own stream layers canyon lands, fjord coasts, karst towers, dune seas, mesa country, a volcanic chain of cones with a hot geothermal field, atoll rings seeded from deep water with shallow lagoons, a great rift with raised shoulders, shattered plates, or glacial troughs onto the base relief. Hydrology takes a style per world (meandering, braided, delta, sparse, or no rivers), basins collect lakes where the land is wet enough, and the dry basins of arid worlds are salt flats with no producers and mineral-rich ground. These are authoritative generation inputs recorded in the world's terrain genome; the World tab lists them.

Creatures share a family resemblance per world through a fauna morphospace: each seed favours a few body plans, and gives its animals a limb style (jointed, tentacle, stilt, paddle, or hooked), a head style (bulb, crest, beak, eye stalks, hood, or none), a tail, a skin finish (matte, glossy, iridescent, translucent, or furred), an eye style, an ornament that some species carry (antlers, fins, tendrils, lanterns, or plates), and a palette of three body patterns from ten. Species still differ within that space through their genomes. Sapients get an upright form per world (biped, tall, broad, tripod, or rearing quadruped) with a head style, and each culture dresses its people in a hue taken from the culture's defining substance and a style hashed per culture (band, sash, cloak, paint, or collar); a faction's colour shows as a mark at the brow. Lost limbs, lameness, and the inspector portrait all read the same model.

Buildings are drawn from the architecture genome each place already carried: the layout sets the silhouette (rectilinear block, courtyard with an inner gap, round drum, hive hexagon, terraced steps, or a branching annex), the wall form its texture (stacked courses, a woven diagonal rib, grown-shell curves, cut-prism facets, or an interlocked lattice), and the roof form its cap (pitched gable, membrane dome, rib vault, layered cap, or open lattice). Each type adds its function: hearths burn open under a low ring, kilns and forges carry a stack and a glowing mouth, halls stand taller with columns and fly the faction's colour, archives show shelf lines, clinics a mark over the door, workshops an awning, stockpiles open bins heaped in the colours of what they actually hold, waterworks a rippling basin with a channel, and shrines a spire with a lit crown. Walls follow the world's grid, crenellate in their own wall idiom, and run a faction band. Damaged buildings crack.

Detail is budgeted by the render quality setting: Lean skips haze, surf wash, water highlights, flame detail, shadow penumbra, and every surface-genome layer above, keeping the mobile render budget unchanged. Reduced motion freezes the live layers in place.

## Mobile profile

The interface switches automatically on touch phones and can also be forced from Settings. It uses safe-area-aware drawers, a six-button world dock, one-finger pan, combined two-finger pinch/orbit/tilt in free roam, 44 px controls, and a reduced mobile render budget without changing fixed-tick simulation order.

New phone worlds default to the `Phone` profile (`96 × 58`, Lean simulation, Low rendering, labels off). `Battery saver` (`72 × 44`) is the smallest supported world for longer sessions. Existing saves retain their original dimensions and rules.

## Deep time and pacing

A year is 256 fixed ticks. People mature at about fifteen, bear children through their forties, and live around seventy-five years with individually varied senescence; grazers and hunters turn over in years, so herds track pasture and predators track herds instead of accumulating immortal individuals. Villages therefore grow by generations: a founding band holds steady until its first children come of age, then roughly doubles every decade until food, disease, or war intervene.

Each settlement pursues one line of inquiry at a time. Side topics only gather incidental notes, a village of twenty needs about a generation per discovery, a city of sixty roughly half that, and a process already practiced by a neighboring people within reach is learned faster. Knowledge survives collapse as legacy and is rediscovered quickest in the ruins of those who held it. The History tab opens on a notable-events lens (founding, discovery, war, famine, collapse, legends); the raw feed of births, bites, and feedings is one click away.

Famine is recorded history: a community that loses more than eight percent of its people to hunger in a year enters the chronicle and loses stability. Species extinctions are recorded only for lineages that established themselves, and losing a limb is a rare, dramatic outcome rather than the usual result of a bite.

## Causal conflict and occupation

Person-level combat resolves attack tactics against defensive responses using training, formation, morale, supply, equipment, armor, terrain, fatigue, and body-part vulnerability. Injuries persist as bleeding wounds, pain, trauma, treatment, healing, and scars. Blood deposited by an injury is transferred from conserved body chemistry.

Internal violence is implicit: scarcity, instability, crowding, resentment, trust, cultural or faction difference, occupation, and individual temperament can produce a confrontation without a scripted incident. Faction and personal xenophobia affect out-group tension and integration but do not independently create violence.

A launched column keeps its roster until it returns: fighters draw rations from the home stores when their orders are issued, follow a shared route of wadeable, unbuilt tiles around lakes and districts, hold so the column arrives together, and are neither drafted into civilian labor nor absorbed as immigrants by the town they attack. Only militia, the armed, and the aggressive count as a settlement's defenders in a war turn, so a force that has beaten them can take the town rather than besieging it indefinitely.

Armies must establish physical control to capture a settlement. Defended walls can be breached through cited structural-damage events; intact buildings transfer to the occupier and display its faction color. Damaged buildings retain their integrity state and residents repair them through ordinary labor, while collapsed buildings are rebuilt from conserved construction matter. Residents can integrate or retain their former allegiance, creating persistent occupation resistance and later reconciliation.

## Social drama and embodied consequences

Emotion emoji are readable summaries of measured state rather than random decoration: affection, secure love, betrayal, grief, fear, jealousy, anger, contentment, and revenge resolve cite needs, relationships, or remembered events. Critical injury, uncontrolled bleeding, failing regulation, and acute pain have hard display priority, so a dying person cannot retain a contentment face. The inspector summarizes broad attachment conditions—secure, developing, strained, grieving, guarded, conflicted, connected, or isolated—instead of exposing one exceptional secret counter. Trust and familiarity grow through repeated proximity; affairs remain concealed until physically observed; discovery can break a reciprocal bond; death can produce grief and an identified-killer revenge vow.

People and creatures have persistent modeled anatomy. Tactical and predator attacks select body parts, can disable or sever appendages, transfer the lost tissue into the local substrate, and permanently alter locomotion, manipulation, perception, combat, work, and the rendered silhouette. Primitive equipment is built from conserved local matter into alien forms with recognizable functions: buckets, shields, armor, vessels, cutters, mauls, reach weapons, slings, and ranged casters.

## Cultivation, herding, and predator defense

Completed farms now run an explicit fallow → sowing → tended growth → ripe → harvest cycle. Workers move seed, nutrient, solvent, and gas from finite community stores into a real farm tile; balanced photosynthesis changes that tile's chemistry; harvesting transfers only the resulting crop matter back into finite storage. Fire and drought can causally destroy crop order while leaving its matter in the substrate.

Herds contain ordinary, individually simulated prey rather than an abstract livestock number. A herder gathers real grazers, guides them through adjacent traversable tiles toward changing pastures, watches them feed and reproduce from parent matter, absorbs their actual offspring into the herd, and retains their ordinary fear, injury, anatomy, and death behavior. People now intercept predators that threaten herd members or nearby people and fight through the same tactical wounds, equipment, limb damage, blood transfer, and death rules as person-level combat. Restrained puddles, sprays, droplets, severed tissue, and alien blood hues are rendered only from conserved fluid that actually left a body; they darken, soak in, wash away, and disappear according to amount, weather, moisture, and temperature.

Every living herd now causes its community to plan and physically construct a livestock enclosure from the culture's locally available rigid and flexible materials. Its rendered perimeter and closed gate constrain the movement of each enclosed animal. Predators bite and damage the structure before they can reach prey, while hostile wartime intruders are prevented from taking an animal until they physically breach it. Low integrity can permit individual escapes or theft; existing repair labor restores the same structure, and enclosed feeding transfers conserved organic and nutrient matter from community stores onto the animals' tile.

Firefighters must acquire a functional container, reach a conserved solvent source, fill it, carry it to a protected fire, and dissipate measured heat. Navigation knowledge or a carried watercraft permits deep-water movement. Military forces report distinct mustering, forming, marching, engaged, rerouting, withdrawing, recovering, and guarding phases; “marching” is reserved for an active advance rather than recruitment or a permanently stalled order.

## Living world

The year turns. Each world's terrain genome carries an axial tilt: untilted worlds have no seasons, tilted ones swing tile temperature through the year by up to twenty-eight degrees, opposite in the two hemispheres of a latitudinal or diagonal climate and as one on radial or banded worlds. The swing is applied as an exact per-tile offset every sixteen ticks, so producers, herds, and people feel real winters and summers, the two solstices enter the chronicle, the HUD names the season under the camera, cold ground whitens, and rain falls as snow where the ground is below freezing.

Feet wear the ground. Every step a person, grazer, or hunter takes adds traffic to its tile; traffic fades over a few years. Worn tiles draw as trails joining their neighbours, and a tile worn to a road lets people move one tick faster between steps, so the routes between a village, its fields, its water, and its trading partners emerge from use and speed the traffic that made them.

Polities keep a Voice. When a faction's leader dies, the polity chooses a successor from the members around its capital: a hierarchical people prefers the last Voice's children, a communal one the most trusted and dominant adult. The succession is chronicled with its cause, the new Voice takes the title, and the polity's aggression drifts toward the new Voice's temperament, so a warlike heir or a cautious elder changes what the faction does next.

The ground acts. Scaled by the disaster setting and the world's landforms, vents erupt (most often on volcanic worlds), earthquakes shake rifted and shattered lands, and falling stars strike anywhere. Eruptions turn rock to ash on the same tile, heat and ignite the ground, and raise the cone; earthquakes damage buildings by distance and material brittleness; impacts crater the land, ignite it, and leave ore in the rock. No matter is created or destroyed. Each is a chronicle entry that later famines, fires, and collapses can cite.

Peoples read signs. An intervention within twelve tiles of a settlement is read by its culture as favour (rain, healing, blessing, growth, riches, water), wrath (fire, lightning, drought, blight, disease, erasure, disaster), or a portent, weighted by the faction's spiritual ethos: favour steadies the settlement and binds the polity, wrath does the reverse, and the reading enters the chronicle citing the intervention. Spiritual peoples, or any settlement that has seen two omens, plan a shrine; a completed shrine adds stability and cohesion.

People have character. Each person carries two or three traits read from genome, phenotype, and culture at birth (bold or wary, warm or aloof, restless or rooted, curious or settled, devout or skeptic, proud or humble, hardy or frail); one want at a time chosen from those traits and their situation (a partner, a child, to become the Voice, mastery, a finished roof, a journey beyond the horizon, a place of their own, or to see the god named and honoured), fulfilled or given up in the chronicle with a lift or a dip in mood; and eight skills that grow from what they actually do, with adept and master titles. Skill and boldness sharpen a strike and a crafter's skill outlasts in the tools they make. The inspector and the Legends life page show character.

Society keeps living. Towns raise monuments to what they have lived through (a war's end, a succession, a fulfilled prophecy, a naming, a calamity survived), each stone remembering its event in Legends. Caravans embody the trade the economy records: real people set out with real provisions along the roads they wear, reach the partner town, and return. Herds are walked to the warmest grazing in the cold half of the year and wild grazers drift toward the equator when the food fails; predators keep dens and return to them; courtship shows; and an old hunter with many kills becomes a beast of legend. The hungry steal from a stranger's store and the theft is a grievance between polities; repeat offenders are exiled under sentence; the wounded losers of a war turn can be taken captive, freed when the war ends, or folded into their captors after years. `npm run test:character` and `npm run test:society` cover these.

People form bonds. Measured trust and affection become named friendships (a warm arc joins friends who stand together), grievance and pride become rivalries (a crackle of light between rivals), and rivals who meet quarrel and sometimes brawl. A killing between two houses that are not at war, or a third brawl between them, begins a feud that outlives the people who started it: members know each other on sight, embers pass between them, the polities that shelter the houses take on grievance, and the feud ends when the blood cools, a house dies out, or a marriage joins the two. Bonds show on the inspector and the Legends life page, feuds have their own pages and index section. `npm run test:bonds` covers this.

The god can speak. Five instruments act on minds and on the ties between polities rather than on matter: Mark a chosen one gives the nearest person renown, a calling, and the Speaker's role if their people have named the god; Whisper knowledge reveals the next process a town could learn (knowledge moves, matter does not, and the technology ledger records it as such); Sign in the sky writes a portent that nearby towns read and Speakers answer with prophecy; Bind a truce ends the nearest polity's war or stills its bitterest quarrel for eight years; Sow discord tears open old wounds between neighbours. Each is an intervention like any other, so omens and belief read it through the same path. Chosen ones wear a halo of sparks, whispers spiral up from the town, truces ring both capitals in white, discord flickers a dark bolt between them, and the sign crosses the sky. `npm run test:divine` covers this.

The annals can be read year by year. A card at the top of Legends opens the timeline: a bar for every year (pick one to read that year alone), chips for polities, war, conflict, people, settlements, disasters, and ecology, and the events grouped under year headings, newest first, each linking onward. Polity, place, and people pages carry a "Chronicle by year" button that scopes the same view to them. At the turn of every year the world writes a digest of what the annals hold for that year and chronicles it as a YearEvent, so the summary survives compression and appears in the chronicle of every page it touched. `npm run test:years` covers this.

Polities practise diplomacy. Envoys are real people who walk from capital to capital under a swaying pennant carrying terms: a losing side offers tribute for peace or bends the knee as a vassal, a long even war is offered peace, and neighbours at peace offer a marriage between the Voices' kin. Tribute is paid each year as real food moved from store to store and carried by a gold-laden caravan; a polity that cannot pay defaults, and two defaults end the treaty in hostility. Vassals fly their overlord's pennant above their own, follow the overlord into war, are protected when attacked, and throw off the yoke when they grow stronger. A marriage moves the bride or groom across the border in a ring of petals and leaves a claim on the other house: at the next succession the claim either binds the two polities as one house when the new Voice carries both bloods, or is pressed as a grievance that can become a war of succession. Polity pages carry a Diplomacy section. `npm run test:diplomacy` covers this.

The coast has a life. A town beside enough water builds a dock at the shore: a plank pier on piles with a moored boat that bobs, a drying net, and gulls turning above. Fishers go out from it and bring the shallows' organic matter into the store, tile to hand to store with nothing created, casting a line with a red float from the pier or from the town's boat; every fifth catch is chronicled as a heavy haul. Once a polity knows Gradient Navigation, its boats are seagoing: caravans and envoys sail when both ends know the sea, boats under way leave fading ripples, and a town of fourteen or more sends settlers with provisions across open water to found a camp on a far shore, which is chronicled as a colony or a lost voyage. Place pages of harbour towns show boats, catches, and voyages. `npm run test:sea` covers this.

Peoples come to know their god. Every culture keeps a belief: a running favour, the attention and awe your acts have earned, and counts of what it has seen. After three witnessed acts a culture names the power that moves its world in its own tongue, with an epithet drawn from the act it has seen most (the Rain-Giver, the Burning One, the Mender, the Shaper, and more), derives tenets from its readings, and from then on omens cite the god by name. Spiritual peoples raise a Speaker who prophesies plenty or fire, and a prophecy that comes true within eight years is chronicled and remembered. Named peoples hold rites at their shrines on the solstices, offering real stored matter to the shrine's ground and gaining stability and cohesion. Acts and calamities become myths that pin the truth to the event but drift with every retelling, and Legends shows both the tale as told now and what happened. When two towns of one spiritual people read the god in opposite ways, the dissenter breaks away as a new culture with a dialect of the parent tongue and an inverted reading. The belief map mode paints each culture's ground green for favour, red for wrath, and violet for portents. `npm run test:belief` covers naming, tenets, myths and drift, rites and their conservation, prophets, and schism. `npm run test:living` checks the seasonal offsets, path wear, forced eruption, quake, and impact conservation, succession, omen readings, and shrine planning.
