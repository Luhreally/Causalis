# Phase 52 — the chain decides (M216–M218)

Planned 2026-10-25 (Opus planner, verified against the tree at 556e6ae). The making chain (Phase 50–51)
shows where every tool and weapon comes from; Phase 52 makes the simulation agree with it: one ore
rule, metals as goods that move by trade, tools and arms of the metal a land's market actually holds,
and arms that count in battle by what they are made of.

## Where things stand (measured on first light)

| | Economy `oreFor` (tools) | Design `oreFor` (arms) | Lore `oreNear` (finding) |
|---|---|---|---|
| Where | sim/economy/systems.ts:109-131 | sim/design/design.ts:224-242 | sim/lore/lore.ts:154-178 |
| Counts | deposits of the kind, surface copper, vents (water peoples) | surface showings only | deposits and showings |
| Reach | own land, else one ring (0.6) | two rings around every land of the realm | own land, else two rings |
| Trade | copper only, by stock (systems:185) | none (chain:883 says "traded for" in words only) | none |

Ore within reach of 1,157 land cells: copper 297 / 408 / 415 (economy / design / lore), tin 32 / 332 /
338, iron 76 / 910 / 960; the proposed one rule (one ring, deposits and showings) gives 297 / 228 / 774.
The world has 14 copper, 8 tin, 14 iron deposits; iron shows at the surface in 261 lands (211 bog,
50 hill ironstone).

At year 300: 549 peopled lands; metalworking known in 376, bronze in 83, iron in 4. Copper tools in
100 lands, stone in 449, bronze tools nowhere (they need a tin *deposit* within one ring). Of 71 realms,
10 field a host whose metal outranks its seat's tools (Sairis, seat 1792: stone tools, iron arms); 2
the other way.

The disagreements: which ore counts; reach; trade (copper tools only); whose knowledge (land vs seat);
stuff (pages say "bog iron", battle counts generic iron); time (past tools read today's ore; arms
re-decided every 5 years; the battle view shows today's design); `metalFrom` (chain.ts:597-609)
filters flows by `G.copper` for every metal; the sim never makes bronze, iron or steel tools
(`toolMetal` is a label only the host reads; `TOOL_GAIN` ignores it).

Battle: `strengthOf` = men × share fielded × `hostPower(parts)` × body strength (war.ts:235-243);
`hostPower` (designs.ts:807-817) already ranks tiers by `MATERIAL` edge/guard. The `Battle` record keeps
nothing about arms; the battle view reads the current design (host/battle.ts:128).

## Design: one rule, first principles

- **A. `oreWithin(ctx, cell, kind)`** (new `sim/economy/ore.ts`): the land's own deposit (richest
  first), else its surface showing (surface copper, stream tin, bog/hill iron via `ironShowing`, salt,
  coal, oil, vents for water peoples); else a neighbour's (ascending cell order, reach 0.6). Returns
  `{kind, cell, lie, ref, richness, reach, grade}`, grade = reach × `ORES[kind][lie].grade` (copper 1
  everywhere so copper's history doesn't move; tin 1; iron deposit 1, hill 0.9, bog 0.7). Pure, bounded
  cache keyed `${digest}:${medium}:${cell}:${kind}`. Used by smelting, finding metalworking, lore, chain.
- **B. Metals as goods**: append `tin` (G 12, value 12, bulk 0.5) and `iron` (G 13, value 5, rusts
  0.001/month, bulk 0.6). Smelting = knowledge + ore within reach (copper: metalworking; tin: bronze;
  iron: iron). Tool recipes need only the metal in the market: copper; bronze (copper 1.35 + tin 0.15
  → 14 tools); iron (1.5 → 15); steel (1.6 iron → 18, needs steel). Data tables `SMELTING`, `WORKED`
  drive everything (alien metals arrive as data). Metals move by ordinary trade; war embargo cuts them.
- **C. `metalsAt(ctx, cell)`** (new `sim/economy/metals.ts`): a metal is workable this year if the land
  knows the craft and its market holds every metal it needs (own ore, trade, or store). Sim and host
  read the same year: `Market.book(line, good)` with a `reckoned` flag (open books mid-moment, closed
  between moments). Tools: plurality metal of crafted tools (tie → better) stored as a series (year,
  metal, event); emit `industry.tools` the first time a land makes a better metal (causes: knowledge +
  own ore / road / market good). Arms: `hostFor` may choose only metals `metalsAt(seat)` allows; from
  M217 the host draws kit metal from the seat's market yearly (`ROLE_KG` arm 2 kg, guard 6 kg × men ×
  `ARMS_WEAR` 0.1) into `want`, keeping an `armed` share (0..1) per realm in a new `war.arms` store.
- **D. Arms in battle (M217)**: part stuff = the seat land's keenest stone (`landStone`, moved to
  `gen/`), "bog iron" if the seat smelted most of its iron from its own bog ore, else `METALS`. Quality
  = `qualityOf(stuff, seat craft, 15 years)` ÷ that material's usual stuff, clamped [0.8, 1.15], scaling
  edge/guard in `hostPower(parts, props)`. Power = bare + armed × (full − bare). A battle records each
  side's power and `tip` when even arms (same draw, attack ÷ powerA, defend ÷ powerB) would flip it; a
  tipped battle cites the winner's host design event. Tier stays dominant; quality moves power +15/−20%
  at most; cut-off metal decays power toward bare 10% a year.
- **E. Pages read the sim** (`toolMetal`, `metalSource`, `metalsAt`, `armsOf`, `partStuff`,
  `DesignStore.at(owner, year)`, `Battle.armed/tip`); traded metal traced back along last year's flows
  up to 4 roads to the smelting land. Read paths use `.get()`, never `MarketStore.of()`.
- **F. Alien worlds**: ore kinds, knowledge and alloys are data; fire-less peoples never get bronze or
  iron (`affordsPrinciple`); water peoples smelt vents; stone from each world's own rocks.

## Milestones (waves: file-disjoint tasks; [S] = senior pass)

**Wave 0** — `tools/arms-report.ts [seed] [years] [every] [--cradle]` (tool metal by land, tin/iron
flows, host tiers, mismatches, armed distribution, tipped share, median |ln(powerA/powerB)|, war
deaths per decade, ms/year; `typeof`-guarded so it runs on HEAD). [S] baseline on first light,
juniper, amber, kestrel, alien 55 at 300/500/700/900 + `npm run calibrate` + `gate:2`.

**M216 — one ore rule; tin and iron as goods; tools and host metal from the market**
- 216.1a goods.ts/matter.ts (+tests): append tin/iron; recipes appended after current-machines
  (CRAFT draws keyed by index unchanged); `TOOL_METALS`, `SMELTING`, `WORKED`, `TOOL_RECIPE_METAL`;
  `GOOD_MATTER` tin/iron; reactions point at recipes (smelt-cassiterite → tin-smelting; bloomery,
  bog-bloomery, smelt-magnetite → iron-smelting; alloy-bronze → bronze-tools; carburise → steel-tools).
- 216.1b stuffs.ts: `Ore.grade` (bog < hill ≤ deposit; copper 1).
- 216.1c market.ts: `toolMetal`, `toolMetals` series, `reckoned`, `toolMetalIn(year?)`,
  `setToolMetal`, `book(line, good)`; save/load defaults; `hashInto`; `pinned()` includes the events.
- 216.1d view/trade.ts, view/globe.ts, host/inspect/matter.ts, host/planet.ts: tin/iron stored at the
  smithy, icons, WEARS words; **bump version to `${name}-6`** (rulesetId doesn't hash GOODS).
- 216.2a [S] `ore.ts`, `metals.ts` (+tests: copper within reach in exactly the old 297 lands; iron
  774, tin 228; bog grade 0.7; neighbour reach 0.6; vents for alien 55; market count unchanged by reads).
- 216.3a [S] systems.ts: delete economy `oreFor`; `whyNot`, crafting output (× grade), `metalYear` use
  `oreWithin`; record plurality tool metal + `industry.tools` (level 3); `toolMetal` reads the series
  (falls back to `bestMetal(metalsAt)` for old saves).
- 216.3b lore.ts: `oreDriver(ctx, cell, kind)` (own 1, neighbour 0.5, held in market 0.5).
- 216.3c [S] design.ts: delete two-ring `oreFor`/`hostOre`; `hostFor(ctx, p, without = [])` from
  `metalsAt(seat)` returning `{parts, sources}`; `DesignStore.at(owner, year)`.
- 216.3d chain.ts: delete `economyOre*`, `tradedCopper`, `realmOre`; `oreLines`, `traced(world, cell,
  kind, hops = 4)`; fix `metalFrom`; `toolMade` from `WORKED`; `townStuff.ore` = what it smelted most
  last year with `yields`; data-driven `unforged`.
- 216.3e bridge/village.ts `TownStuff.ore.yields`; view words ("copper and tin" for bronze); host
  stores' ore includes tin and iron.
- 216.3f causal/economy.ts: words for `industry.tools`; price explainer cites bronze/iron knowledge.
- 216.4 [S] integrate; `npm run check`; move history-keyed tests (never weaken); oracle (`--expect`
  economy.markets first), `--write`, engines; arms report vs baseline; commit.

**M217 — arms' quality from what they're made of, counting in battle**
- 217.1a designs.ts: `MaterialProps`, `does(m, x?)`, `performanceOf/hostPower(parts, props?)`
  (unchanged without props), `ARMS_WEAR = 0.1`, `kitKg(parts)`.
- 217.1b `gen/bedrock.ts`: move `rockAt`, rock tally, `spotRock`, `bedrockOf`, `landStone`.
- 217.1c `sim/war/arms.ts` ArmsStore (`war.arms`, sorted save).
- 217.2a [S] `partStuff`, `armsOf` (read-only; power within [bare, 1.15 × tier]; bog iron < iron).
- 217.2b [S] systems.ts arms pass after crafting, before trade (bronze = 0.9 copper + 0.1 tin; steel =
  iron); `rearm(armed, need, had, wear)`.
- 217.2c host ground/chain delegate `bedrockOf`/`landStone` to `gen/`.
- 217.3a [S] war.ts: `strengthOf` uses `armsOf(...).power`; even-arms odds, `tip`; `Battle.armed`,
  `Battle.tip`; no new random draws.
- 217.3b chain `armsMade` from `partStuff` ("counted in battle: Q"); design page; observer test proves
  watching changes nothing.
- 217.3c battle view kit from `DesignStore.at(realm, year)`; battle page "their arms tipped it".
- 217.3d causal/war.ts words ("…, its iron swords tipped it").
- 217.4 [S] integrate, check, oracle, engines, bounds/`ARMS_WEAR` pass, commit.

**M218 — oracle and history calibrated**
- 218.1a oracle `--expect dom1,dom2`, `--report`; fixture `people/first-light-spread`.
- 218.1b `tools/phase52-gate.ts` (`gate:52`, CI after gate 51): a bronze town whose tin came by road
  (smithy page "Made here this year: a bronze …" with tin + road lines); a tipped battle's page; phone
  overflow ≤ 2 px.
- 218.1c classic-inventory rows 18, 30e, 42, 42e.
- 218.2 [S] calibration loop against the wave-0 baseline (tin/iron value, smelting outputs, grades,
  tool outputs, `ARMS_WEAR`, `ROLE_KG`, `QUALITY_BOUNDS`, `SEASONED`, draw order, held metal for lore,
  optional transit pull), then gates moved by survey, final oracle `--write`, engines, push.

## Acceptance (first light, spread start)
- Agreement: 0 hosts bearing a metal the seat's market lacked in the design year; 0 lands whose tools
  rank above `bestMetal`; stone tools with iron arms only where the seat made no such tools, and the
  page says why.
- Tin: 100% of bronze-tool lands have tin within reach or got it by trade; ≥ 25% by trade at 500;
  ≥ 1 tin road by 400.
- Spread: metal tools ≥ 20% of peopled lands at 300; bronze ≥ 5% at 400; iron ≥ 25% at 700; iron
  first found 200–450; first iron tools within 60 years.
- Battles: 5–20% tipped by arms in 200–700; median |ln(powerA/powerB)| ≤ 0.35; no ratio above 4.
- History: calibration bands pass; gate:2 on 11 seeds; war deaths per decade 300–900 within ±35% of
  baseline; fire-less worlds no bronze/iron.
- Performance: per-year cost ≤ +10%; gate:5 saves in bounds.

## Risks
- Determinism: `.get()` on read paths; pure bounded caches keyed by digest (no WeakMap); `dmath` for
  pow/exp/log; realms in list order; appended goods/recipes; no new random draws.
- Saves: version bump to -6 required; `Market.load` pads stock; new fields optional; `armed` defaults
  1; empty tool series falls back; storage test strips new fields and runs 2 years.
- Oracle: earth and toy fixtures must stay identical (proves the `gen/` move left generation alone).
- Plausibility: trade moves one road a year into lands that want the good (tin may stall → transit
  pull lever); arms may starve tools (draw after crafting); bog iron everywhere (774 lands) so the iron
  age comes fast once known; fewer lands can find bronze (228 vs 338) → count market-held metal for lore.
- Gates: first light's scenes may move (gate 40 needs a war at 119; 50/51 a copper smithy at 300) —
  survey and move years, never weaken.
