# Cohesion combat

Ordinary battles use `rules/combat.ts` instead of a single draw against attack odds.
Each exchange applies both sides' attacks simultaneously. Numbers determine the fighting
front (bounded by the enemy frontage); equipment, supply, funding, terrain and fortifications
determine effective power per fighter. Losses reduce the remaining force. Casualties, the
shock of an exchange, pressure and fatigue reduce cohesion. A broken line retreats, then
takes pursuit losses. Equal collapse or an engagement without a break leaves the defenders
holding the ground, with an orderly disengagement rather than an invented attacker rout.

This is a bounded army-level model, not individual pathfinding for every historical soldier.
It runs at most 64 exchanges and retains at most 38 compact frames. Keyed variation affects
exchanges; there is no draw that directly selects the victor. The transcript controls the
field's casualty curve, line pressure, break time and morale display. The counters distinguish
men fit to fight from the wounded. Display quality and the camera cannot change the outcome.

New possessions use effective power per fighter, without a bonus for the recorded winner or
repeated counterfactual runs to force that winner. Their unbroken attackers are not forced to
flee at second 130. Older held-fight checkpoints retain their original scene behavior. The
counterfactual casualty reconciliation still prevents taking and immediately releasing an
unchanged body from rerolling a whole army's history.

Earth's ruleset is `earth-7`, alien worlds' `alien-8`. Loading retains completed history and
continues future battles under the new rules. A battle without a combat transcript retains
its original replay. Oracle and late-Earth page snapshots were deliberately re-recorded:
changed wars change later populations, realms, settlements and discoveries. Kernel, early
planet generation, the matter guide and early camp snapshots remain unchanged.

Regression coverage includes numerical superiority, equipment/ground effects, stalemates,
JSON save fidelity, exact migration/continuation, causal casualty rendering, late possession,
and selecting the requested battle where multiple wars share a town. `npm run warfare-check`
uses the built app in phone-sized WebKit and Chromium, checking visible morale, retreat,
casualty totals and exact autosave/reload. Add `-- --public` to check the deployed Pages build.
