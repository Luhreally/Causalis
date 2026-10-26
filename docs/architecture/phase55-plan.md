# Phase 55 — open-world warfare, wounds, lost limbs and healing (M223–M230)

Planned 2026-10-25 (Opus planner). Prerequisites: M214/M215 committed; Phase 52 (M216–M218) landed;
Phases 53–54 before the arms-traced tasks. The architecture already foresees this: "in a watched
window the battle's outcome — casualties, the winner, the ground held — is imported from the
aggregate engagement, and the shadow plays out a fight consistent with it" (universe-architecture.md
1074–1079; irreversible outcomes imported, §8.3).

## Decisions (taken 2026-10-25, per the standing rule to pick the path)
- **D1 no view switch:** the battle for a land is fought soldier by soldier in its heart town's scene,
  on the world clock — no hold, no separate scale; the land map shows the same battle as its token
  hosts at the same moments; the Phase 37 field stays as "the close field (replay)"; the old views
  stay as options in a switcher (globe war, the march over the land, before the town, the close field).
- **D2 spread the fallen (M223b):** the dead come from every land that sent men, not only the
  attacker's seat (war.ts:567) — calibrated (realm populations ±2%, battles per century ±5%).
- **D3 accidents:** wounds only from battles and strikes for now; a recorded mishaps ledger later.
- **D4 year label:** year B's battle (fought at the turn T = (B+1)·YEAR) is watched the next morning
  (year B+1, day 1, 08:00); pages say "year B", captions "the battle at the turn of year B".

## How it plays
A realm goes to war; each sending town's levy (named adult men of fighting age) musters at the drill
ground and leaves by the road, absent from the town's day until they come home; the hosts march by
the roads on the land map; the eve, both drawn up before the fought land's heart town with campfires;
at the turn history decides; at 08:00 the battle is fought on the field before that town at a minute
a second — every figure a named man of a named town bearing arms traced to their smith, as many
falling and wounded as history says; the beaten fly; the fallen lie till noon two days on, then are
borne from the square and buried by name; the wounded lie abed, then walk bandaged, some without a
hand, on a crutch, an eye patched — their pages tell it.

## Design
- **History (M223a, inert to counts):** each new Battle gains `fell` (per land a side's dead came
  from: `{cell, n, hurt, towns: [town, people, dead, hurt][]}`, split by population with the
  countryside last, the hand's village weight 0), `wounded` = min(fielded − fallen, round(fallen ×
  woundedPerFallen(foe shock, own protection, own care))), `maimed` = round(wounded ×
  maimedShare(blow, care)), `bore` (the design fought with). No new draws; only the war hash moves.
  Strikes' wounded derived: dead × {fire 2, quake 3, meteor 1.2, flood .4}.
- **When (M226):** `BATTLE_DAY = {from 8 h, second 60 s, length 150}`; stages eve / morning / battle /
  after / borne with clock caps (1 h/s, 1 min/s in the town, 10 min/s on the land, 1 day/s in the
  rout); the field built only from data fetched after T (hold "battle-roll" if late).
- **Where (M226):** `fieldFrame(plan, approach, walls)` along the town's road on the attackers' side;
  PLACED_SCALE 1.875 so soldiers match townsfolk (field 262 × 169 m); the battle's wall line on the
  town's walls at a seat; placed mode drops the BattleLayer's own hill/river/houses/camp.
- **Who (M224):** line k of a town stands for 12 people; holder n ≥ 1 keyed `folk ${town} ${k} ${n}`;
  eligible = not a child, male, in the sim's fighting bands (aliens by their own life table); the levy
  = the first stochasticRound(menSent/12) eligible lines by hash(war, k); `townRoster(world, town,
  year)` folds every battle and strike that took the town's people: the dead from the levy first, a
  dead holder's line empty 1–4 years then held again; fates kept 40 years.
- **The roll (`battle.roll {event, most}`):** per side `fell[]`, `hurt[]`, `stood[]`, `towns[]` —
  recorded line holders and met people first, then `lv:${event}:${side}:${j}` men named in the land's
  tongue; `battleFigures` (today's newBattle rule plus hurt) is the one rule for counts.
- **Met people:** followLife draws war deaths and wounds against the same pools (unhashed observer).
- **Wounds (M225):** `rules/anatomy.ts` members from the body plan (an arm takes its hand; vital
  members never lost; severing ≤ .45 as in Classic); blows by arm (edge/point/blunt/shot/fire/crush);
  `woundWords` ("lost his left hand at the battle at Pounholt in year 312, to a bronze axe; the stump
  bound by Sairis's healer"); `woundLook` hides parts, adds crutch/patch/bandage/limp, abed indoors.
- **Healing (M228):** hospital, else a healer seat where herb-lore is known, else household, else
  kin; `healDays` abed → bandaged → healed or gone; litters where care ≥ .35; the healer's rounds.
- **Buried (M224):** `VillageRest.war`; war funerals from the square at 14:00 two days after (four for
  towns bringing their dead home); ≤ 6 biers; perYear subtracts last year's war and strike dead (the
  double count goes).
- **Arms traced (M227):** `armsMade(…, who?)` varies the maker seat per soldier; `arms:` pages.
- **Pages:** townsfolk page (name, role, town, age, wounds, fate, burial, arms); battle/war pages gain
  wounded, maimed, fallen by town with names; panels "n fallen, m wounded".
- **Phone:** PLACED_MOST [60, 120, 240, 360] per side by detail; LOD past 160 m; shadows only at
  Ultra; the town shelters during the battle but 24 watchers; layer built on the eve.

## Milestones (waves of file-disjoint tasks; [S] senior)
- **M223** history keeps wounded and fallen by town: T1 rules/wounds.ts; T2 rules/apportion.ts; T3
  bridge types; T5 [S] war.ts + fell.ts (oracle war domain only); T6 host wars.map/campaign/battle;
  T7 pages/panels; T8 [S] spread the fallen (D2).
- **M224** the town's people kept: T9 bridge wounds + roll; T10 graveyard war funerals; T11 [S]
  host/roster.ts; T12 [S] observer war draws; T13 [S] village folk through the roster + healer seat +
  perYear fix; T14 [S] host/roll.ts + `battle.roll`; T15 townsfolk page; T16 met person's page.
- **M225** wounds seen: T17 anatomy; T18 view/wounds.ts; T19 host/wounds.ts; T20 [S] village moments
  (abed/away hidden, watchers); T21 [S] render (woundLook, placed BattleLayer under the village).
- **M226** the battle fought in place: T22 view/battleday.ts; T23 [S] battle.ts placed mode + hurt +
  roll; T24 [S] warplay (no falls before the turn); T25 townwar placed window + named soldiers; T26
  [S] render/battle placed; T27 [S] main.ts wiring + exposed hooks; T28 gates 37/38/40/43 updated.
- **M227** arms traced: T29 [S] chain + arms page; T30 battle panel trooper card; T38 village panel.
- **M228** healing: T31 litters; T32 healer rounds.
- **M229** view options: T33 view/warviews.ts; T34 ui/war-views.ts.
- **M230** gate 55, probe55, docs.

## Acceptance
Σ towns + countryside = each side's fallen (100%); roll lengths = figure counts; no dead holder in a
later plan; funerals = the town's share of last year's deaths ±1; watch-shadow and determinism tests;
wounded:fallen median 2.5–3.5 before gunpowder, 1.5–3 with guns, within [1.2, 4.5]; maimed:wounded
4–15%; `battle.roll` ≤ 30 ms; `newBattle` + `assignRoll` ≤ 15 ms; p80 frame ≤ 22 ms at 4× throttle;
gate 55 (a war's battle before a heart town: caps, named soldiers ≥ 95%, falls/hurt = battleFigures,
a fallen trooper's page "Fell at the battle at" and arms chain, the war funeral, no fallen names in the
next plan, wounds drawn, all four view options).
