# Causalis — The Living Equation

Causalis is a deterministic artificial-life god game in which chemistry, ecology, evolution, settlements, technology, conflict, and recorded history all share one conserved world state.

## Project layout

- `index.html` contains the accessible game shell.
- `src/styles/` separates foundation, layout, dialogs, observatory, and mobile presentation.
- `src/game/sections/` contains the simulation in explicit load order. The section manifest preserves the original closure and execution order without rewriting the engine during migration.
- `src/main.js` starts the game.
- `tests/` covers determinism, conservation, cohorts, ecology, causal conflict/occupation, camera behavior, saves, construction, cognition, civilization progression, and the phone interface.
- `legacy/index.single-file.html` is the untouched pre-migration source for comparison.

## Development

```sh
npm install
npm run dev
```

Useful commands:

- `npm run build` creates a production build in `dist/`.
- `npm run test:fast` runs syntax, conservation/cohort, mobile, causal conflict, social/embodied systems, and save regressions.
- `npm run test:conflict` checks tactical wounds, blood-matter conservation, internal conflict, cited siege damage, and non-destructive capture.
- `npm run test:systems` checks causal love/betrayal/grief/revenge, critical emotion priority, buckets and fire suppression, deep-water vessels, persistent limb loss and fluid traces, field cycles, living herds, predator defense, and matter conservation.
- `npm test` runs the complete deterministic simulation suite.
- `npm run format` and `npm run format:check` keep the migrated sections consistent.

## Mobile profile

The interface switches automatically on touch phones and can also be forced from Settings. It uses safe-area-aware drawers, a six-button world dock, one-finger pan, combined two-finger pinch/orbit/tilt in free roam, 44 px controls, and a reduced mobile render budget without changing fixed-tick simulation order.

New phone worlds default to the `Phone` profile (`96 × 58`, Lean simulation, Low rendering, labels off). `Battery saver` (`72 × 44`) is the smallest supported world for longer sessions. Existing saves retain their original dimensions and rules.

## Causal conflict and occupation

Person-level combat resolves attack tactics against defensive responses using training, formation, morale, supply, equipment, armor, terrain, fatigue, and body-part vulnerability. Injuries persist as bleeding wounds, pain, trauma, treatment, healing, and scars. Blood deposited by an injury is transferred from conserved body chemistry.

Internal violence is implicit: scarcity, instability, crowding, resentment, trust, cultural or faction difference, occupation, and individual temperament can produce a confrontation without a scripted incident. Faction and personal xenophobia affect out-group tension and integration but do not independently create violence.

Armies must establish physical control to capture a settlement. Defended walls can be breached through cited structural-damage events; intact buildings transfer to the occupier and display its faction color. Damaged buildings retain their integrity state and residents repair them through ordinary labor, while collapsed buildings are rebuilt from conserved construction matter. Residents can integrate or retain their former allegiance, creating persistent occupation resistance and later reconciliation.

## Social drama and embodied consequences

Emotion emoji are readable summaries of measured state rather than random decoration: affection, secure love, betrayal, grief, fear, jealousy, anger, contentment, and revenge resolve cite needs, relationships, or remembered events. Critical injury, uncontrolled bleeding, failing regulation, and acute pain have hard display priority, so a dying person cannot retain a contentment face. The inspector summarizes broad attachment conditions—secure, developing, strained, grieving, guarded, conflicted, connected, or isolated—instead of exposing one exceptional secret counter. Trust and familiarity grow through repeated proximity; affairs remain concealed until physically observed; discovery can break a reciprocal bond; death can produce grief and an identified-killer revenge vow.

People and creatures have persistent modeled anatomy. Tactical and predator attacks select body parts, can disable or sever appendages, transfer the lost tissue into the local substrate, and permanently alter locomotion, manipulation, perception, combat, work, and the rendered silhouette. Primitive equipment is built from conserved local matter into alien forms with recognizable functions: buckets, shields, armor, vessels, cutters, mauls, reach weapons, slings, and ranged casters.

## Cultivation, herding, and predator defense

Completed farms now run an explicit fallow → sowing → tended growth → ripe → harvest cycle. Workers move seed, nutrient, solvent, and gas from finite community stores into a real farm tile; balanced photosynthesis changes that tile's chemistry; harvesting transfers only the resulting crop matter back into finite storage. Fire and drought can causally destroy crop order while leaving its matter in the substrate.

Herds contain ordinary, individually simulated prey rather than an abstract livestock number. A herder gathers real grazers, guides them through adjacent traversable tiles toward changing pastures, watches them feed and reproduce from parent matter, absorbs their actual offspring into the herd, and retains their ordinary fear, injury, anatomy, and death behavior. People now intercept predators that threaten herd members or nearby people and fight through the same tactical wounds, equipment, limb damage, blood transfer, and death rules as person-level combat. Persistent puddles, sprays, droplets, severed tissue, and alien blood hues are rendered from those cited injuries without adding visual matter to the conservation ledger.

Firefighters must acquire a functional container, reach a conserved solvent source, fill it, carry it to a protected fire, and dissipate measured heat. Navigation knowledge or a carried watercraft permits deep-water movement. Military forces report distinct mustering, forming, marching, engaged, rerouting, withdrawing, recovering, and guarding phases; “marching” is reserved for an active advance rather than recruitment or a permanently stalled order.
