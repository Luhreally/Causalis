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

### Results (measured 2026-10-26)
Four Earth seeds (first light, kestrel, amber, juniper), each run to 1400 and saved
(tools/snapshot.ts), then read back. Phase 52's tree is the parent.

- **The same history until the magazine.** World hashes are bit-identical to the parent's through
  year 855 on first light; its first repeating rifle comes in 858. The oracle and the frozen
  digests of ten battles before the magazine are unchanged.
- **The finds, in need order on all four seeds:**

  | seed | rifling | repeating | self-loading | machine gun | armoured car | orbital flight |
  |---|---|---|---|---|---|---|
  | first light | 812 | 858 | 896 | 955 | 998 | 972 |
  | kestrel | 818 | 849 | 946 | 1002 | 1019 | 989 |
  | amber | 981 | 1020 | 1124 | 1181 | 1209 | 1190 |
  | juniper | 731 | 763 | 822 | 881 | 957 | 885 |

  - The plan's windows (repeating 900–1050 …) were set on the old tree. Since Phase 52, industry
    comes about a century sooner, and each step follows its need by 30–80 years.
  - On every seed the machine gun comes before orbital flight is found; the armoured car comes
    20–70 years after it.
- **Who bears them.** Realms with a later arm at 1300:

  | first light | kestrel | juniper | amber |
  |---|---|---|---|
  | 41% | 60% | 43% | 12% |

  - Three of the four seeds meet the plan's 30%. In amber, 383 of 408 lands know the magazine by
    1400, but only four realms reach works that make machines. Of its 42 realms, 36 have no works in
    any land, and no machines come to them by road.
  - Armour: on all four seeds from 1100 (first light 10–12 realms, kestrel 11–22, juniper 11–20,
    amber 3–4).
  - Machined by trade alone: 2–7 realms on first light.
- **Battles 1201–1400**, pooled over the four seeds (attacker won / fought):

  | battle | won | share | plan |
  |---|---|---|---|
  | machine guns against machine guns, no armour | 14/35 | 40% | .25–.60 |
  | armour and machine guns on both sides | 390/573 | 68% | — |
  | the attacker two steps ahead | 420/616 | 68% | ≤ .85 and ≥ equal arms |
  | armour against none | 575/778 | 74% | equal arms + .05 |

  - Equal rifles on the parent tree: 63–66%. Attackers mostly choose fights they can win.
  - Fire digs a defender in. An attacker with machine guns but no armour, against repeating
    rifles, is hardly better off than the defender. Armour breaches the line.
- **The fallen.** Where armour fought, 1.6–3.7% of the men in the field fell. On the parent tree,
  the rifle era's battles lost 6.6%. Fewer fall where fire lays both sides low.
  - Worst single battle: 78% of the men in the field. Plan bound: 150%.
  - War deaths a decade on first light, 1100–1400: 4.6, 4.4 and 4.3M, against the parent's 5.7,
    6.9 and 5.7M (−18% to −36%; the plan allows 0.5× to 2×).
- **Realms.** One world's history wanders far, so realm counts were read over several histories of a
  world, not one pair. Realms living, Phase 53 against the parent, 1250–1400:
  - kestrel −9% to +5%, amber −11% to +26%, juniper +7% to +30%.
  - first light, four of its histories against three of the parent's:

    | year | Phase 53 | parent | change |
    |---|---|---|---|
    | 1200 | 46 | 33 | +40% |
    | 1250 | 48 | 37 | +30% |
    | 1300 | 43 | 37 | +17% |
    | 1400 | 39 | 32 | +21% |

    The Phase 53 histories are three with one or both fire terms switched off, plus the real one; the
    parent's have their battles redrawn after 858. Each world's histories spread about ±6 realms
    around their mean. The single pair first measured had said +42% to +59%.
  - Where the later arms are common, attackers win less often. On juniper they won 52% and 50% of
    battles in the 1200s and 1300s, against the parent's 62%, and took about a quarter fewer lands.
    Fire digs defenders in, so more realms hold. That is the rule working, and it is kept: only first
    light at 1200–1250 goes beyond the plan's ±30%.
  - Realms re-arm as often as on the parent (1–2 times a century), and no more flip back to the arms
    they had. 7–25 a century lose their machined arms with the works or the road to them.
  - The largest realm's share holds on every seed:

    | seed | Phase 53 | parent |
    |---|---|---|
    | first light | 14% | 13% |
    | kestrel | 46% | 41% |
    | amber | 28% | 28% |
    | juniper | 18% | 20% |
- **Left as it was: the old loss rule.** Losses are still a share of the smaller side's armed
  strength (Phase 37's rule). So an even fight between two well-armed realms kills many: 28–45% of
  those fielded, among the last rifle realms after 1200. It is never more than the men in the field
  plus those who rose with them. A rule from first principles (the dead by the foe's arms against
  one's own protection) is planned with Phase 55's spread of the fallen (D5 there).
- **Performance:** first light runs at 28 s a century, as on the parent.
- **Gate 53:** in node, a taught realm's machine gun is traced to the converter, a named
  machinist, drawn brass and gun cotton, and its armoured car to rolled steel and oil. On the app,
  a battle of machine guns and armoured cars against rifles:
  - the attackers in rushes, the defenders' trench, the guns' teams, the cars and their wrecks;
  - a machine gunner followed, and their weapon traced from the battle's bar;
  - the bar at a phone's width.
- **Seen on the land:** a works' factory page lists the machine guns and armoured cars made there
  for each realm armed from it. Each is traced from the ore through the converter and its named
  machinist to the cartridge and the powder.

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
