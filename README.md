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
