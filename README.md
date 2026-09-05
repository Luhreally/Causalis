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

Detail is budgeted by the render quality setting: Lean skips haze, surf wash, water highlights, flame detail, and shadow penumbra entirely, keeping the mobile render budget unchanged.

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
