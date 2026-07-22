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
- `npm run test:fast` runs syntax, conservation/cohort, mobile, causal conflict, and save regressions.
- `npm run test:conflict` checks tactical wounds, blood-matter conservation, internal conflict, cited siege damage, and non-destructive capture.
- `npm test` runs the complete deterministic simulation suite.
- `npm run format` and `npm run format:check` keep the migrated sections consistent.

## Mobile profile

The interface switches automatically on touch phones and can also be forced from Settings. It uses safe-area-aware drawers, a six-button world dock, one-finger pan, combined two-finger pinch/orbit/tilt in free roam, 44 px controls, and a reduced mobile render budget without changing fixed-tick simulation order.

New phone worlds default to the `Phone` profile (`96 × 58`, Lean simulation, Low rendering, labels off). `Battery saver` (`72 × 44`) is the smallest supported world for longer sessions. Existing saves retain their original dimensions and rules.

## Causal conflict and occupation

Person-level combat resolves attack tactics against defensive responses using training, formation, morale, supply, equipment, armor, terrain, fatigue, and body-part vulnerability. Injuries persist as bleeding wounds, pain, trauma, treatment, healing, and scars. Blood deposited by an injury is transferred from conserved body chemistry.

Internal violence is implicit: scarcity, instability, crowding, resentment, trust, cultural or faction difference, occupation, and individual temperament can produce a confrontation without a scripted incident. Faction and personal xenophobia affect out-group tension and integration but do not independently create violence.

Armies must establish physical control to capture a settlement. Defended walls can be breached through cited structural-damage events; intact buildings transfer to the occupier and display its faction color. Damaged buildings retain their integrity state and residents repair them through ordinary labor, while collapsed buildings are rebuilt from conserved construction matter. Residents can integrate or retain their former allegiance, creating persistent occupation resistance and later reconciliation.
