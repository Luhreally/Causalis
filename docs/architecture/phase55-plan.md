# Phase 55 — open-world warfare, wounds, lost limbs and healing (M224–M231)

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
- **D2 spread the fallen (M224b):** the dead come from every land that sent men, not only the
  attacker's seat (war.ts:567) — calibrated (realm populations ±2%, battles per century ±5%).
- **D3 accidents:** wounds only from battles and strikes for now; a recorded mishaps ledger later.
- **D5 the fallen by arms (with M224b, added 2026-10-26 from Phase 53's results):** a battle's dead
  from the men engaged, the foe's arms against one's own protection — not, as since Phase 37, a share
  of the smaller side's armed strength, under which an even fight between well-armed realms kills
  28–45% of those fielded and better arms cost a host more of its own men. Calibrated with D2: war
  deaths a decade within ±35% of the parent by century, fallen/fielded falling from the bronze age
  to the machine gun, no battle's dead above its men in the field and those who rose with them.
- **D4 year label:** year B's battle (fought at the turn T = (B+1)·YEAR) is watched the next morning
  (year B+1, day 1, 08:00); pages say "year B", captions "the battle at the turn of year B".

## Blows seen where they land (asked for 2026-10-26)
"and like even in the sim battles where its like reenactted or wtv it should be more graphic, and
realistic where ever they are getting damaged yk". Every battle view, the close field that replays
history's battles first and the town's own field (M227) after, shows where each man is struck:
- the part hit (head, trunk, an arm or hand, a leg), and the fall that follows from it;
- the wound and its blood on that part, staying on the fallen;
- arrows and darts stuck where they hit, and shot's dark holes;
- limbs severed only where an edge, a cannon ball or a shell could do it, lying apart in their blood;
- the wounded who live (history's, scaled to the figures drawn): they stagger, kneel, clutch the
  wound, and crawl or are helped back through the ranks, leaving a trail.
It is graphic by default, in the game's low-poly look. Its spec is scratchpad p55/spec-blows.md
(Opus planner), a track kept file-disjoint from M224's tasks.

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
- **History (M224a, inert to counts):** each new Battle gains `fell` (per land a side's dead came
  from: `{cell, n, hurt, towns: [town, people, dead, hurt][]}`, split by population with the
  countryside last, the hand's village weight 0), `wounded` = min(fielded − fallen, round(fallen ×
  woundedPerFallen(foe shock, own protection, own care))), `maimed` = round(wounded ×
  maimedShare(blow, care)), `bore` (the design fought with). No new draws; only the war hash moves.
  Strikes' wounded derived: dead × {fire 2, quake 3, meteor 1.2, flood .4}.
- **When (M227):** `BATTLE_DAY = {from 8 h, second 60 s, length 150}`; stages eve / morning / battle /
  after / borne with clock caps (1 h/s, 1 min/s in the town, 10 min/s on the land, 1 day/s in the
  rout); the field built only from data fetched after T (hold "battle-roll" if late).
- **Where (M227):** `fieldFrame(plan, approach, walls)` along the town's road on the attackers' side;
  PLACED_SCALE 1.875 so soldiers match townsfolk (field 262 × 169 m); the battle's wall line on the
  town's walls at a seat; placed mode drops the BattleLayer's own hill/river/houses/camp.
- **Who (M225):** line k of a town stands for 12 people; holder n ≥ 1 keyed `folk ${town} ${k} ${n}`;
  eligible = not a child, male, in the sim's fighting bands (aliens by their own life table); the levy
  = the first stochasticRound(menSent/12) eligible lines by hash(war, k); `townRoster(world, town,
  year)` folds every battle and strike that took the town's people: the dead from the levy first, a
  dead holder's line empty 1–4 years then held again; fates kept 40 years.
- **The roll (`battle.roll {event, most}`):** per side `fell[]`, `hurt[]`, `stood[]`, `towns[]` —
  recorded line holders and met people first, then `lv:${event}:${side}:${j}` men named in the land's
  tongue; `battleFigures` (today's newBattle rule plus hurt) is the one rule for counts.
- **Met people:** followLife draws war deaths and wounds against the same pools (unhashed observer).
- **Wounds (M226):** `rules/anatomy.ts` members from the body plan (an arm takes its hand; vital
  members never lost; severing ≤ .45 as in Classic); blows by arm (edge/point/blunt/shot/fire/crush);
  `woundWords` ("lost his left hand at the battle at Pounholt in year 312, to a bronze axe; the stump
  bound by Sairis's healer"); `woundLook` hides parts, adds crutch/patch/bandage/limp, abed indoors.
- **Healing (M229):** hospital, else a healer seat where herb-lore is known, else household, else
  kin; `healDays` abed → bandaged → healed or gone; litters where care ≥ .35; the healer's rounds.
- **Buried (M225):** `VillageRest.war`; war funerals from the square at 14:00 two days after (four for
  towns bringing their dead home); ≤ 6 biers; perYear subtracts last year's war and strike dead (the
  double count goes).
- **Arms traced (M228):** `armsMade(…, who?)` varies the maker seat per soldier; `arms:` pages.
- **Pages:** townsfolk page (name, role, town, age, wounds, fate, burial, arms); battle/war pages gain
  wounded, maimed, fallen by town with names; panels "n fallen, m wounded".
- **Phone:** PLACED_MOST [60, 120, 240, 360] per side by detail; LOD past 160 m; shadows only at
  Ultra; the town shelters during the battle but 24 watchers; layer built on the eve.

## Milestones (waves of file-disjoint tasks; [S] senior)
- **M224** history keeps wounded and fallen by town: T1 rules/wounds.ts; T2 rules/apportion.ts; T3
  bridge types; T5 [S] war.ts + fell.ts (oracle war domain only); T6 host wars.map/campaign/battle;
  T7 pages/panels; T8 [S] spread the fallen (D2).
- **M225** the town's people kept: T9 bridge wounds + roll; T10 graveyard war funerals; T11 [S]
  host/roster.ts; T12 [S] observer war draws; T13 [S] village folk through the roster + healer seat +
  perYear fix; T14 [S] host/roll.ts + `battle.roll`; T15 townsfolk page; T16 met person's page.
- **M226** wounds seen: T17 anatomy; T18 view/wounds.ts; T19 host/wounds.ts; T20 [S] village moments
  (abed/away hidden, watchers); T21 [S] render (woundLook, placed BattleLayer under the village).
- **M227** the battle fought in place: T22 view/battleday.ts; T23 [S] battle.ts placed mode + hurt +
  roll; T24 [S] warplay (no falls before the turn); T25 townwar placed window + named soldiers; T26
  [S] render/battle placed; T27 [S] main.ts wiring + exposed hooks; T28 gates 37/38/40/43 updated.
- **M228** arms traced: T29 [S] chain + arms page; T30 battle panel trooper card; T38 village panel.
- **M229** healing: T31 litters; T32 healer rounds.
- **M230** view options: T33 view/warviews.ts; T34 ui/war-views.ts.
- **M231** gate 55, probe55, docs.

## Wave 4 as built (M227, M228, M230, M231; 2026-10-26)
- **The battle's day (D4, view/battleday.ts):** `BATTLE_DAY` = fought from 08:00 the morning after
  the turn, a battle second a minute of the world's, 150 of them; the eve from 18:00 the night
  before; toward it from ten days before; borne in from 12:00 two days on, buried at 14:00. The
  clock is slowed once a stage, told under the bar ("Slowed to a minute a second for the battle at
  the turn of year B") and let go at the viewer's word: toward it a day a second (town and land), the
  eve an hour, the battle a minute in its town and ten minutes on its land, after it a day, the
  borne an hour in its town. A speed chosen inside a stage goes to the world already slowed (the
  time bar's governor): a frame late, at a month a second, is days, and the battle would be gone.
  At the turn, until the page has the year's wars (a host round trip), the wars are drawn, and
  their battles' slowings kept, as they were the moment before (`warsAt`).
  The clock is brought down to each slowing as it nears it, no faster than would carry it half way
  there by the next frame (frames as long as they have lately been), so it comes to each beginning
  at its own speed however slowly frames come (view/battleday.ts `slowAhead`); the bar tells what
  holds it, the stage ahead where that is slower than the one in force.
- **Where (view/placed.ts):** along the town's road on the attackers' side, the defenders' rear rank
  12 m short of its homes; laid twice the close field's size (PLACED_SCALE 2, not 1.875: its figures
  as large as the town's folk, the field 280 × 180 m); flat, the field's own ridge and river dropped;
  at a seat its walls stand as outworks before the town's own; the beaten defenders fly to the
  flanks, its pursuers stop short of the town.
- **Seen (render):** every figure a man of the roll (`rollNames`, by the roll's lots: no line ever
  assumed); the town indoors 07:00–11:00 but 24 come out to its edge; the hosts' fires behind their
  lines until 06:30; the eye brought to the clash from its side as the battle begins, some 100 m off
  (on a phone held upright, drawn back until some 55 m about the clash fill its width); past 160 m
  only a figure's larger parts and no blows; shadows at Ultra alone; the layer built on the eve and
  kept through the town's rebuilding; laid again at a setting's detail; the victors and the beaten
  after it as the town's war draws them.
- **Phone (430 × 932 at 3, CPU ×4, the battle at the clash):** Low 18–19 ms and Balanced 18–20 ms
  p80 playing at a minute a second; High 25–31 ms and Ultra 34–39 ms held (the town alone at High is
  21 ms); Auto comes to rest within the budget, at Balanced (18 ms) on a quiet machine.
- **Arms traced (M228):** `arms.borne {event, side, who}` → what one man bore there, its maker, where
  and when it was made and its grade (`armsMade(…, who)` varies the maker's seat by the man); his
  `arms:` page from the ground to his hand; the battle panel's man and the town's card tell it.
- **Views (M230):** the war over the world, the march on the land, before the town, the close field —
  a column of four under the bar wherever a battle is watched; one closed says why ("Fought before
  its town the morning of the turn of year Y: the world is not there now"); each gone to as from
  nowhere.
- **The town, the way in while it is fought (2026-10-27: "i meant open world warfare on town view
  not land view"):** from its eve until the beaten fly (`foughtNow`), a battle is gone into before
  the town of its land — its mark on the land zoomed onto (the night before it, its hosts' mark), its
  page's watch, the tidings', an event window's, a war's or an age's bar — the eye brought onto the
  fight; a battle past, or on a land no town stands on, onto its field as before. The switcher's
  field and land stay a tap away; a war unfolding going down to each battle (M196) and the
  director's battle take keep the field.
- **Gate 55's battle part (B1–B6)** and `tools/probe-placed.ts` (figures, names, the rule, the
  roll's and the field's cost per setting); gate 40 follows the battle to the morning after, the
  clock left to run across the turn on the land and before a town.

## After Phase 55
Truly alien worlds (world kinds, alien biochemistry, their own names, invented matter as an option): docs/architecture/alien-worlds-plan.md, Phases 56–59, asked for 2026-10-26.

## Acceptance
Σ towns + countryside = each side's fallen (100%); roll lengths = figure counts; no dead holder in a
later plan; funerals = the town's share of last year's deaths ±1; watch-shadow and determinism tests;
wounded:fallen median 2.5–3.5 before gunpowder, 1.5–3 with guns, within [1.2, 4.5]; maimed:wounded
4–15%; `battle.roll` ≤ 30 ms; `newBattle` + `assignRoll` ≤ 15 ms; p80 frame ≤ 22 ms at 4× throttle;
gate 55 (a war's battle before a heart town: caps, named soldiers ≥ 95%, falls/hurt = battleFigures,
a fallen trooper's page "Fell at the battle at" and arms chain, the war funeral, no fallen names in the
next plan, wounds drawn, all four view options).
