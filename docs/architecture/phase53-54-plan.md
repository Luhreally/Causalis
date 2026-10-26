# Phases 53–54 — later-age arms (M219–M220) and novel elements (M221–M222)

Planned 2026-10-25 (Opus planner, against the tree with M214/M215 uncommitted). Order: commit
M214/M215, then Phase 52 (one ore rule, arms quality in battle, the loss rule), then 53, then 54.
Every milestone ends with `npm run check`, golden, oracle (unchanged unless said), engines, calibrate,
and its gate in CI after gate 51/52.

## Phase 53: later-age arms

### Where things stand
- Powder principles sit at the end of `TREE` (rules/principles.ts 685-711) so earlier discoveries keep
  their order: gunpowder (medicine + iron), firearms "the musket" (gunpowder + clockwork, `{arms 1}`),
  rifling "the rifle" (firearms + factories, `{arms 1}`). `arms` effects only raise `fieldShare`
  (war.ts:196, +0.03 each with a standing army).
- Design grammar (rules/designs.ts): musket 208-222, rifle 223-232, plate, foot, cavalry; `compose`
  greedy; `hostPower` = 1 + (shock − .3) + .6·range + .9·protection + .5·(mobility − .2).
- `designYear` re-decides every fifth year; `DesignStore` keeps every design but exposes the current.
- Battle: `strengthOf` = men × fieldShare × hostPower × strength; losses are a share of
  min(attack, defend) — power-weighted (source of the "risen men" patch in host/battle.ts).
- The battle view reads today's design, hostKinds and gunpowder knowledge, not the battle year's.

### Design: a firearm from its physics (new rules/firearms.ts)

| arm | principle | aimed rounds/min | range (m) | tolerance | cartridge | powder | firepower F | range axis |
|---|---|---|---|---|---|---|---|---|
| musket | firearms | 3 | 100 | hand-fitted | paper | black | 0 | .85 |
| rifle | rifling | 6 | 400 | hand-fitted | paper | black | 0 | 1.15 |
| repeater | repeating-fire | 15 | 500 | 0.05 mm | brass | black | 1.64 | 1.20 |
| autoloader | self-loading | 30 | 550 | 0.02 mm | brass | smokeless | 2.78 | 1.22 |
| automatic | automatic-fire | 120 | 900 | 0.02 mm | belted brass | smokeless | 5.49 | 1.33 |

- F = max(0, log2(rate × range / 2400)) (Dupuy lethality, rifle → machine gun ≈ ×20–45); range axis
  = 0.85 + 0.15·log2(range/100) (reproduces musket and rifle exactly).
- Tolerances under ~0.1 mm are beyond a file: parts are **machined at a works** (new material
  `machined`, MATERIAL {edge 1, guard .85, mass 0, lasting .95, cost .9}); brass needs zinc; smokeless
  powder needs nitric acid at scale (hence self-loading needs electricity).
- Armoured vehicle (mount `armoured`): oil engine, rolled plate, machine guns — mobility 1.1, shock
  .25, protection .25, firepower 1, breach 1, cost .6. Steel helmet (guard, needs self-loading):
  protection .7, cost .35.
- New principles after rifling (fire + land/shore asks; effects empty so they count through the
  design, not fieldShare): repeating-fire (rifling, .006), self-loading (repeating-fire + electricity,
  .005), automatic-fire (self-loading, .005), armoured-vehicles (automatic-fire + engines, .004). Target
  first finds: repeating 900–1050, self-loading 950–1100, automatic 1000–1150, armour 1000–1200.
  Histories before the first repeating-fire find stay bit-identical by construction.
- `HOST_AXES` += firepower, breach; `Realization.with?` (all must be at hand); hostPower += 0.5·log1p(F)
  for F > 0; doctrine firepower .35, breach .3. hostPower: sword/mail/foot 2.31, musket ≈3.0,
  rifle/plate/cavalry 3.56, repeater 4.07, autoloader+helmet 4.18, automatic+helmet 4.51, +armoured 5.01.
- Making gate (design.ts): `machinedFor(ctx, p, inflow)` — a member land that knows steel with
  `Market.works` and machines in stock/made (cause: the works event), else machines flowing in by
  trade (cause: the route). No supply → none of the five new parts. `fuelFor` — oil in stock or a
  seam. The host design event cites supply (.3) and fuel (.2). `DesignStore.at(owner, year)`,
  `before(ref)`.
- Battle (war.ts): `FIRE = {dig .06, breach 3, disperse .12}`; entrench = 1 + .06·max(0, def.fire −
  3·att.breach) into defend; disperse = 1/(1 + .12·max fire) into both sides' losses; both exactly 1 at
  F = 0. Attacker odds (equal men): rifles v rifles .40, auto v auto .33, armour v armour .36, armour
  v rifles .48, rifles v auto .28, armour v swords .59.
- Chain: `firearmMade` builds on `machinedMade` (ore, blast furnace, converter, named machinist;
  barrel bored and rifled; bolt to 0.05/0.02 mm; brass from copper + zinc; black or smokeless powder
  with reaction links; "Bought from the works of …" by trade); `armouredMade`. Soldier ref
  `arm:<battleEvent>:<side>:<trooper>` → a page tracing the trooper's weapon in every age.
- Views: new `view/arms.ts` table by arm id (fire kind, stroke, share of falls to shot, smoke,
  burst, bayonet, words) replacing literals in battle/render/village/regionwars; magazine fire and up:
  open order (file 3 m, rank 4 m), rushes, continuous fire, no ladders from self-loading up, one vehicle
  per 12 figures when armoured (some knocked out, wrecks smoking); hulls/turrets/tracks; tripod MGs;
  vehicles in region/globe wars; "their weapon: traced" link; `exposed.watchBattleNear` for the gate.

### Milestones
- **M219** (knowledge, grammar, making, battle, chain, pages): A1 firearms.ts; A2 principles; A3
  matter (Zn, sphalerite, brass, saltpetre, sulphur, black powder, nitric acid, nitrocellulose and
  their reactions); B1 [S] designs.ts (frozen old hostPower equality test); B2 DesignStore.at/before;
  C1 [S] machinedFor/fuelFor/hostFor supply; C2 [S] war.ts fire terms (zero fire = exactly 1); C3
  chain firearmMade/armouredMade; C4 battle kit by the battle's year; D1 causal "re-armed … in place
  of"; D2 arm: page; D3 army page "made at/bought along/could arm with X, but no machined parts"; E [S]
  calibration with the arms report to 1400 + worktree A/B.
- **M220** (seen): F1 view/arms.ts; F2 pre-53 battle digests; G1 [S] battle view; G2 village GUNS;
  G3 regionwars + rides; H1 render/battle + render/vehicles.ts; H2 wars vehicles; H3 panel link +
  watchBattleNear; I1 gate 53 (armour v rifles battle shows vehicles; "a machine gunner"; the weapon
  link names a converter and a machinist; phone width).

### Acceptance
All four principles in need order on 3 of 4 Earth seeds before 1400; ≥ 30% of realms with a 53 arm
by 1300 on 3 seeds; armour on ≥ 2 seeds; ≥ 1 realm armed by trade alone; pooled 1200–1400 battles:
auto v auto attacker win share in [.25, .60], two-steps-ahead ≤ .85 and ≥ equal-arms share, armour
+.05; modern fallen/fielded ≤ the rifle era's, never > 1.5 × fielded; war deaths per decade within
[0.5×, 2×] of the parent; largest realm's share ≤ max(parent + .10, .35); realms within ±30%; save
sizes within gates 5/6. A/B digests equal until the first repeating-fire find.

## Phase 54: novel elements

### Axioms
1. Substances and their properties are universal physics. 2. A world decides which it has and where:
its star (age → metallicity; temperature → oxygen), its formation (zone → Mg/Si; metallicity → C/O),
its crust (setting → rock → minerals; weathering and air → surface ores and soils). 3. A people decides
what it can do with them: furnace heat against each ore's reduction heat; its own words for them.
4. Earth is the solar case of the same functions — every earthlike world returns today's tables
(tests prove identity).

### Design
- Bulk chemistry keyed on `g.ground` (not hashed into the digest; dmath only): [Fe/H], C/O, Mg/Si, O2
  share = .2095·clamp(.72, 1.45, (T★/5778)^1.5). Classes: carbon (oxide / carbon-rich C/O ≥ .8),
  metals (poor < −.2 / solar / rich > .2), silica (high Mg/Si < .85 / solar / low > 1.3), air (thin <
  .17 / solar / rich > .26), redox (reduced if thin air or carbon-rich). Creator makings map: red/orange
  star → thin air; white → rich; far orbit → high silica; near orbit round an old star → low silica.
- Per class: rock names (tonalite, picrite, dacite, dolostone, greywacke, black shale, graphite
  schist…); edge stones (tachylite, moissanite, nephrite, corundum, greywacke; "fieldstone" .35/.8
  fallback); ores by role (reduced worlds: native copper, chalcocite, siderite, magnetite, telluric
  iron); the "tin" role is the world's hardener (silica low: nickel/garnierite; metals poor: arsenic/
  arsenopyrite; else tin), with an arsenical-copper fallback so no world stalls before bronze; metals by
  role (arsenical copper, cupronickel, bog iron, telluric iron, cohenite iron); furnaces open fire 800,
  kiln 1200, bloomery 1250, blast 1500, arc 3000, ±60 °C for thin/rich air — an ore is workable when the
  furnace's heat ≥ its reaction's; soils/wares/pigments by redox; air from the bulk; crust ppm =
  Rudnick & Gao × class multipliers; real names in the guide plus the people's own word (`called`).
- **M221 changes pages only** (chain, camp pigments, ground page, a "This world" tab in the matter
  guide, tool-head colours); **M222 changes alien history only** (showing abundance and native ores in
  `surfaceOre`/`ironShowing`, the heat gate in Phase 52's single ore rule, metal edges in the arms
  term, per-world principle names, heat-shortfall words). Earth unchanged by construction.

### Milestones
- **M221**: wave 0 [S] alien oracle fixtures recorded before the change + chain-pre54 snapshot test +
  stubs + `Prior.chemistry`; A1 rules/chemistry.ts (bulk, classes); A2 chem-stones; A3 chem-ores
  (hardener, furnaces, canWork); A4 chem-ground; A5 matter (As, Ni, the new minerals and reactions);
  A6 crust; B1 [S] gen/chemistry.ts `worldChemistry` (bounded cache, Earth seeds solar); C1–C5 chain,
  camp, ground, matter tab, tool heads; C6 tools/chem-survey.ts; D1 gate 54.
- **M222**: E1 [S] homeworld showings (frozen-copy identity on earthlike seeds; native iron on ≥ 1 of
  5 thin seeds); E2 [S] the heat gate in the one ore rule; E3 arms term reads `metalOf`; F1 principle
  names per world; F2 heat-shortfall words; [S] alien fixtures re-recorded, survey, gate:4, diversity,
  engines, calibrate (Earth identical), perf.

### Acceptance
Survey of 200 open peopled seeds: ≥ 85% non-solar in some class; ≥ 6 edge-stone sets; Sn, As, Ni each
≥ 5%; ≥ 10% thin worlds with native iron on ≥ 10% of those; ≥ 1 carbon-rich; no class value > 60%.
After M222 (gate:4, 100 worlds × 900 years): thin worlds' first iron a median ≥ 100 years later than
solar; share reaching iron by 900 falls ≤ 10 points; "alien 65" still comes to power; budgets pass.
