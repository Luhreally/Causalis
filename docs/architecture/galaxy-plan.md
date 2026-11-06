# Ages past ours, and everything a galaxy brings (Phases 63–73)

Asked for 2026-11-03: "get down to first principles of many things so the alien worlds happen and ...
the ages past the ages humans experienced can still emerge ... down to star wars level eras etc, with
logic there for it to emerge if present for that world and also like alien contact and space age
exploration and exploitation and trading and just everything that comes with a galaxy".

And, approving the plan: "emphasize how i wanna see the star wars and landing in planets and
colonization and all that stuff"; "i wanna be able to pick seeds that plausibly get to the target age
i wanna see"; "im fine with some loading screen, i prefer not if the performance and optimization is
good enough".

From Phase 67 on these phases alternate with lives-plan.md (leaders, wealth, living as anyone, courts,
the rest of OG). Steps F1 to F3 of first-principles-plan.md (what a world can do, read from its physics and
not from a list of Earth's inventions) come before Phases 69 and 70, because the natives in those scenes
fight with what it gives them. This comes before the brush follow-up. Classic's war aims, coin and
markets, diplomacy and lost knowledge are built inside Phases 71–72, not twice.

## Where it stood (2026-11-03, commit 79682c6; one run each of tools/sky-survey.ts)

| | Earth | Alien 41 |
|---|---|---|
| First satellite | 963 | 720 |
| First station | 1097 | 846 |
| Voyages to other stars by 3100 | 6 (first 1850) | 0 |
| Peoples heard | 6 | 12 |
| Wars between the stars | 25 | 18 |
| Save at 3100 (bound: 18 MB × lands / 550) | 23.0 MB (18.6) | 60.4 MB (20.1) |
| Years a minute here | 321 | 164 |
| Slowest year | 346 ms | 1,368 ms |

- 111 principles, hand-listed, ending at the antimatter drive. WORLD_STAGES ends at "Other worlds".
- KIND_AGES is written by hand for each of four world kinds.
- Other peoples follow HOME_PACE, Earth's own timings, with natures drawn by hash.
- No routes, off-world mining or exploitation were found. An "exchange" is a one-off gift.
- A substance knows density, melting point and hardness only.
- Halls on another world are seen from orbit. Their ground cannot be gone down to.
- Strangers land in a home-world town only (render/visitors.ts).

## Decided

- **Faster than light is a law of each universe.** It reverses "Travel is sublight" (2026-09-25).
  Each universe draws it from its seed, a Creator's dial overrides it, and Earth starts with it on.
  A people must still find it, and until then light-lag holds. Pages mark it plainly as a law of this
  universe. Energy shields share the dial; psychic powers stay out unless asked for.
- **Star Wars is the level, not the content:** no borrowed names, ships or characters.
- **Seen first.** A phase is not done until what it adds can be watched, on the phone, in a scene.
- **Star wars moved up (2026-11-04).** Fleets and invasions come straight after Phase 66, not after
  trade. History already holds wars between the stars (`sim/space/starwar.ts`), so showing them need
  not change history. The politics behind them stays in Star nations.
- **Machine armies against primitive natives is a named scene (2026-11-04).** Asked for: "wars of like
  the people going to other planets and fighting the primitive aliens there with machines". A fleet
  arrives, machine armies land, and the natives fight with what they have, on their own ground, seen
  in the town or camp view, where anyone can be tapped and possessed. History records it, and each
  side's real means and numbers decide it, so the natives can win. Phase 69 makes the natives; Phase 70
  makes the war.

## The rule

Ages stop being a list. What a people can do is measured: energy per person, the limits of its
materials, precision, computing, mastery of life, reach. Its age is read from those and named after
its own means, and ages can fall as well as rise. New steps ask for a function ("switch a current",
"hold a fusion flame"), and a world's matter meets it or does not. rules/launch.ts, starships.ts and
firearms.ts are the models.

## Phases

| Phase | What it does | What you watch | Size |
|---|---|---|---|
| 63 Deep time | Saves within bound; late years fast; a run to year 6,000 on the phone; the save check on CI; jump to a year behind a loading screen, baked saves where running is too slow | Long worlds stay smooth | M |
| 64 Landing and colonies | With today's ships: the crossing, the descent, the first halls on alien ground growing into a town; go down to that ground (globe, land, town), tap and possess its people | A ship landing and a colony growing | L |
| 65 What a world can do | Matter's real properties, the measures, ages read from them; **seed picker v1** | Why a world is where it is; pick a seed by target age | L |
| 66 Ages past ours | Fusion, star-scale energy, machine minds, made bodies, beam arms, terraforming, city-covered worlds, where physics and the world allow | New town looks and battles; picker gains the ages | L |
| 67 Star wars seen | Fleets and invasions drawn from the wars between the stars that history already records; no change to history | Fleets fighting in orbit; invasions landing in the town view | M |
| 68 Laws of the universe | The dial, lanes between stars, shields; invented matter (Phase 59) | A ship leaving for the lane; the first jump | M |
| 69 Peoples who really arose | Histories from their own worlds at their own pace, so some are still primitive when others reach them; their own ground, with towns and camps you can go down to; some never leave, some leave ruins; contact by what they can say, breathe, eat and catch | Strangers met on their ground and ours | L |
| 70 Exploration and exploitation | Maps of what each has seen, probes, prospecting, wars of conquest on native worlds, mines, outposts, penal colonies, bonded natives, resistance, independence | Survey ships; machine armies landing on a world of primitive natives and fighting them on their own ground; a mining colony and its rising | L |
| 70b Worlds filled | A colony spreads over its world instead of stopping at one patch; more than 36 colonies in a whole history | A world's lights spreading over the years; towns of one colony world to go down to | Not designed |
| 71 Trade among stars | Goods from real shortages and freight costs; ports, merchant houses, credit, piracy, smuggling, blockades | Busy spaceports of many peoples; a lane raided | L |
| 72 Star nations | Federations, empires, vassals, civil wars, dark ages | The fleets of Phase 67 fighting for real empires; a realm falling apart | L |
| 73 Your hand in it | Galaxy lenses, the director filming firsts, a pilot possessed, god's acts at star scale | All of it, from the title screen | M |

## Worlds filled: asked (2026-11-05)

"do they ever fully colonize the whole planet or just set up their one hall and its done?"

**They do not, read from the code.** History keeps a colony as one land of 2,000 km² (`HALL_AREA`): one ship to a star (`voyageTarget` skips a star already taken), so one patch on one world, for ever. There are 36 such sites in a whole history (`STAR_SITES`), and 3 on each body of the home system (`SITES_PER_BODY`). "A world covered" counts only the home planet's lands (`coverOf`), so no colony can come to it. A colony does grow: its town is reckoned from its people, up to some 2 million in towers.

| Far saves at year 3000 | `earth tide 207` | `alien harrow 348` (lanes open) |
|---|---|---|
| Home world | 269 lands, 27.6 billion | 62 lands, 7.7 billion |
| Sites at other stars | all 36, 47.7 million | all 36, 70.6 million |
| The greatest | 1.8 million | 2.3 million |
| The last to be founded | 1661 | 1766 |

So every site is taken by about 1750, and nothing new is settled among the stars for the last 1,200 years of history. That is the larger gap: the galaxy stops growing.

**Direction, not yet designed.** Real lands are what make far years dear, so a world filling should not be 4,000 new provinces. A first thought: a number for how much of a colony world is settled, grown by its people, how livable it is and what they know, with its towns read from that, and the sites freed from a fixed count. To be tested against a year's cost and the save's bound. It comes after W5.

## Worlds filled, first slice, as built (2026-11-05)

**A number per world, not provinces.** Store `space.filled` (dormant until a people has a colony): for each world a people has come to, those beyond any land of it, grown each year by `rules/filling.ts` up to what it can hold. Real lands are what make far years dear, and this adds none.

**The first principle.** `openSky`: can they walk out, from the thresholds `habitability` itself weighs. Open or remade, it fills to its edges. Sealed, the top is `(1 - upkeep/10) x 0.6` of its ground, so the harder a world is to live on, the less of it can ever be roofed, and a page says so from its numbers. Natives who won their landing hold a world's comers to a tenth of its ground (`HELD_TOP`, est.). Those who follow scale with the drive's years over the lane's: 100 a year on a drive, about 350 by lanes (est.).

**`alien harrow 348`, forked 1500 to 3000 under these rules:**

| At year 3000 | Before | Now |
| --- | --- | --- |
| Worlds with people | 36 star sites and the home system's | 184 (129 with no land) |
| Last founded | 1766 | 3020 (a ship under way) |
| People on them | 70.6 million | 142.7 billion |
| Greatest | 2.3 million | 6.6 billion |
| Filled | none | 99, all sealed, at 15% to 54% of their ground |

The galaxy no longer stops growing: 66 worlds in 1800, 92 in 2100, 137 in 2500, 184 in 3000. Mean year 54 ms against 64 before, and a save 2.06 MB against 2.04: the cost does not show. Oracle: 8 of 8 unchanged.

**Seen.** 🚀, a row's 🪐 Its world: its globe with its halls' lights spreading from under 0.1% to a quarter of it and more, its panel "How far it is settled", and "Why no more?" in plain numbers. 🌆 The worlds settled lists them all.

**Levers.** Going down to a colony no land holds (its world and page only); remaking one; "until they lose it" (natives' hold is read once); lights keeping off a native people's ground; a world covered still counts the home world only. A world filled whole, the natives' cap and the tiding's See it have run headless, not been watched: no save at hand has a whole fill.

## Phase 68, first slice, as built (2026-11-05)

**The law.** `rules/lanes.ts` `laneLaw`: the dial's act if there is one, else open for a world like ours, else a hash of the seed's name: open in two of three alien universes (66.45% of 2,000 seeds). It touches no stream and lives in the seed's text like every making, so the save holds it. **The finding** is a row of its own after every other row: it needs annihilation drives, machine minds, and fusion or star mirrors, and asks the function `open-a-lane` of the world's matter. So a world can have the law and be shut by its matter (`alien quill 742`: nothing there carries a current without loss), and a page says so. A people of the stars finds it at a keyed year, never before 1400, so early histories hold.

**The lanes** are pure from stars' positions and masses: a tide of root(ma x mb) / d squared, at least 0.004, with no third star stronger with both: about 2,550 lanes among 2,000 stars. A lane is 2 to 8 times light's speed by its tide, a ship still crosses on its own drive from mouth to mouth, it burns 20 tonnes of annihilation fuel a light-year on a middling lane, and 0.2% to 10% of ships are thrown out part way (est.). A ship with no lane crosses as it always has. Word still goes at light's speed.

**Who is met, and why that had to be added.** Every star site is taken by about year 1750, so earlier ships alone could never meet towns and cities that rise later. So a realm that knows the lanes sends a ship to a people whose fields or lit towns it can see, once for each stage (`sim/space/lane-visits.ts`). It takes no land and no one stays. Phase 70's landing reads these arrivals.

**Measured on forks of `alien harrow 348`, 1500 to 3000, the dial shut against open.** First jump 1648, 16.4 light-years in 10 years where its drive took 50. Settler crossings 11 to 15 years against 42 to 60; 2 of 20 ships thrown. Arrivals at peoples: villages 5, towns 7, cities 6, works 4, against one at the stars. Landings the comers won: villages 5 of 5, towns 7 of 7, cities 2 of 6, works 0 of 4: **towns and cities are met in real history for the first time, and natives hold most cities and all works.** Wars between the stars 188 against 206: the law does not raise them, and a small change to the row's place moved that figure a lot, so it is not a finding. A mean year 104 ms against 96; save 1.91 MB against 1.90.

**Seen.** 🌌 The stars draws every lane as a blue web and its panel says "🌀 A law of this universe"; the world's menu has "🌀 The law", and its page has "🌀 Watch the first jump": the ship leaving, the mouth opening, the flash, streaks of the sky, the far star. A tiding and the Director carry it. The alien title's making row has "🌀 Lanes: as it falls / open / shut". Where the law is shut, no web, no film, and a page says why no one ever jumps.

**Levers.** Shields wait for a fight whose numbers they can change (a second law under this dial). Couriers and word by lane, a lane raided (Phase 71), a people's own first jump as a film, an age rung and picker row for the lanes, fleets through a lane in Phase 67's film, Earth's dial on the title. Not measured on an iPhone 15 Plus.

## Phase 69, first slice, as built (2026-11-05)

**Nothing moves history.** A people of a world is a pure reading of it (`sim/space/natives.ts`), no store, no event, no command: the ruleset's id stands, old saves load, the oracle does not move. A contact is read off what history already holds, a home ship's arrival or a people's hold. Its card says plainly that history holds that they came and no more of what passed: Phase 70 decides what passes, and that is what will move history.

**Who rises.** A world where `lifeElsewhere` says bodies have come ashore, and a mind has had time, a keyed 0.3 to 1.5 thousand million years after its first bodies. The cluster's followed civilizations keep their own years and read on the same ladder, so they are the ones far ahead.

**Stage:** camps, villages, towns, cities, works, then signals, orbit, stars (followed only), or ruins. How far is read from when the climb began, how slow it goes (pull, warmth, social body, span, metals, a draw) and a ceiling from the world's numbers: no hand for fire, no growing season, a solitary body, no crops or beasts to lead (a 22% draw, est.); flesh-eaters and thin-social bodies stop at villages; heat under 1,000 C or too few metals stop at towns; a pull over 2.2 g or too little buried life stops at cities. A people at its first machines falls before signals, since anyone who spoke would be heard. Camps and villages leave no ruins.

**Ground, look, carry.** `folkGround` is the ground a colony has; the look is Phase 34's `FolkFacts` from the world's numbers and the forebear its life sketched; arms come from `meansOf`: its keenest stone on a spear, a long blade of its edge stuff, a gun of its charge.

**Contact**, `contactBetween(a, b)`, is pure and reads the same swapped: speak (hearing and air, or sight and signs), breathe (oxygen from light-eaters, pressure within 2.6 times either way, est.; same liquid), eat (`rules/biochem.eats`), catch (same liquid, as Phase 57's `sharesStarSickness`).

**Seen:** from a people's page or their world's panel, ▶ The first meeting: the ship over their world, its coming down, a card of what each can do, then their ground. ⬇ Go down to them: their camp or town. `world:peoples`, from the cluster panel's 👥, lists them all, those a ship has come to first. Their town reads ‹ Their world, with no stores and no Live here. Ruins: all of it let fall, roofless, its walls yet high, no one in it.

**Measured**, twenty seeds, 40,977 stars, 549 peoples (382 risen, 167 followed), before a rounding change and not again since. Risen, at year 3000: camps 294, villages 22, towns 15, cities 10, works 1, ruins 40. Followed at 2000: camps 4, villages 9, towns 6, cities 6, works 5, signals 8, orbit 16, stars 113. Real arrivals at 3000, for example: `alien 41` has the Yutsashani (camps, 1100) and the Grythur (villages, 1129); Earth `amber 101` has the Kugrouai (camps, 1426); Earth `ember 260` the Seiketh (camps when found, cities by 3000); `cinder 570` the Xulithi (ruins when found, 1233). Reading every people of a seed takes about 100 ms, once. Earth's `first light` has no ship come to a people by 3000.

**Two defects found by looking, both worth remembering.** Bodies in a camp are drawn ten times larger than the ground they stand on, so a giant's band stood through one another and over their tents: `campFigure` clamps how broad a camp draws one, `campRoom` sets them as far apart as they are drawn. And a ruined town was dated decades ahead and let fall only its last lots, so it stood whole with its windows lit, past a check that asked for one fallen run: the gate now asks that no home or building stands whole.

**Levers.** Possession does not reach a people here: it needs a land under the hand and a people has no cell. The land step between globe and ground; water peoples as risen peoples; stragglers in ruins and second risings; a tiding when a ship reaches a people (it needs Phase 70's event).

## Phase 70, first slice, as built (2026-11-05)

**Nothing moves history.** A landing is a pure reading of a real arrival (`arrivalsAt`): `rules/landfall.ts` over what history holds of those who came and Phase 69's reading of those who met them, with draws keyed to the arrival. No store, event or command. What history does hold stays true and is told: a colony's halls stand whatever became of those who went out from them, so a landing the natives win says they went back to what they came down in. To make it history later: record the fight as an event with its causes, spend the comers' machines, take the natives' dead off a stored count. That costs a seed list.

**Why one term goes ahead of the fight.** The war formula sets like against like. Its `advantage` is bounded and `hostPower` is a log, so beam rifles on stone spears came out about 5.5 to 1 a head, where magazine rifles did about 500 to 1 a head in history. So a host with no stand-off must first cross its foe's fire: rate, time under fire, a hit share, what the ground hides, over how much a body takes. Past 39% struck (`combat.ts`'s own break) they turn, and are under fire as long again going back.

**Who comes.** A home ship carries 500, half of whom can fight (est.). Made soldiers only where the realm's host design has them, and only what the crossing's keep leaves: 22 years gives about 2,900, 200 years none. A people's ships are its raid's own strength. No horse or car crosses.

**Who meets them.** Their arm from `folkArms`; a quarter of those within a season's walk, 0.5 of a people in camps down to 0.05 in cities (est.), times a keyed draw of where it came down. Bodies count by their strength, as a host's do in war.

**What can turn it, all from numbers.** Cannot breathe there (flesh at 0.6, of the water at 0.4; made soldiers none); a heavier pull than home (flesh only); bodies past 60 kg take more fire; towns hide those who come on; few across a long way; a sickness crosses only where a life of the same liquid meets bare faces.

**Measured** on the 31 saves at year 3000: 22 real landings. Camps: comers 18, natives 1. Villages: comers 3, natives 0. Towns, cities and works: none met, since arrivals come early and these peoples rise late. The natives' one win is `earth sorrel 472`, the Mythix (1,906 kg, 0.39 g, tusks) against 3 ships of a people of the water sealed at 0.4 with a 48 m stand-off. Each of those forces against the same people at every step, 12 draws each, comers' share of wins: camps 96%, villages 82%, towns 39%, cities 14%, works 0.4%. A read is about 12 ms, only when a page or film asks. A frame of the film is 0.6 to 1.9 ms of script and batches, 31 to 48 draw calls, 50,000 to 80,000 triangles, on this PC; not measured on an iPhone 15 Plus.

**Seen.** From a people's page, their world's panel and `world:peoples`: ⚔ Watch them come. Ships over their world; landers coming down on their ground; those who came out and apart by `hostOrder`; the natives massed and coming on, since a people who never faced a gun has no drill for it; shots and stones, falls by the fight's own frames; flight, the place burning and the victors going over the ground, or those who came going back aboard and lifting off seen from among those who held; a card that starts with who holds the ground. Seeds: `earth amber 101` (Kugrouai, camps, comers win), `earth sorrel 472` (Mythix, natives win), `alien 41` (Grythur, a village burned).

**Found by watching it, each now checked by gate 78:**
- 56 natives closed on 18 places and made one slab. A mass is now pressed toward those who came by no more than the room between them.
- A short fight's end eye stood right over the pads, so the ships rose into it and the screen was hull. Turned back, the eye stands off among those who held and tilts up with them.
- "Who holds the ground" was last in a card that had to scroll, and the caption showed through it. It comes first, and the caption goes.
- A flame seen from above in one colour is a sticker on the ground, and capsules for smoke read as pillars. A camp now burns with the town's own fire.
- A low body lying down read as one standing. The fallen are flat, on a dark patch.
- The pixels check on order failed for giants, who stand far apart in pixels and shoulder to shoulder. It now counts in bodies apart, past a squad's own.

**Levers.** Larger fleets and earlier arrivals, to bring the towns' row into real history. Tapping or possessing a figure in the film. A landing does not yet change the camp drawn after it: pages say what it left. Mines, penal colonies, bonded natives, risings and independence are later slices.

## Phase 71, first slice, as built (2026-11-05)

**What is short is the market's own price; no list says what crosses.** A colony's land has a real market and no road, so its prices already say what it lacks: on far saves at year 2000, pots 9.1 against 1.0 at home where there is no clay to dig, copper 17 against 2.6. What a crossing costs is one function, `rules/freight.ts`: a drive's fuel by the rocket equation at its cruise, a sail's beam, a lane's fuel per ship, a hull per tonne-year, and what spoils for the years under way. A good goes if what it fetches there, times what survives, times what isn't lost to raids, beats what it costs here and what it takes to carry. So a drive's slow crossing carries only what is worth a great deal for its weight, and a lane opens the bulk.

| Ten light-years, machines at 8 grain | On a fusion drive | By two lanes |
| --- | --- | --- |
| Years | 218 | 10 |
| Machines a tonne | 330 | 34 |
| Grain, a sack's weight | 53 | 5.4 |
| What clears | Only machines, at their dearest | Pots, copper, tin and iron too; grain never does |

**It lands by the ledger.** The sender's realm pays in machines, goods leave by `out` and come by `in`, and what they do is the market's own: covers, prices, recipes, food. No new effect was written. On `alien harrow 348` from 2000 to 3000, mean pot cover across the 36 lands away goes from 0% to 19%, and a crafter with copper in store can make copper tools where they could not.

**Store `space.trade`, dormant until a first run opens:** at most 36 running, 60 kept, 4 holds under way each. Events `trade.opened` 4, `trade.came` 4, `trade.first` 6, `trade.raided` 5, `trade.first-raid` 7, `trade.closed` 4, `trade.rich` 5. Rules `earth-12`, `alien-16`. Oracle: 8 of 8 unchanged, since no fixture reaches a land away from home. `earth first light` is the same bit for bit through year 1000, and moves between 1000 and 1300, after its first colonies.

**A lane that bleeds stops paying.** Who sends a run reckons on losing what it has lost lately: each hold taken or come in moves its reckoning a quarter of the way to all or nothing. The first rule raised a fear by a raid and let it fade, and one run lost 73 holds and brought in 1 and still ran. Only reading the worst run showed it; the average looked fine.

| `harrow 348`, 2000 to 3000 | First rule | Raids averaged, fading | Now |
| --- | --- | --- | --- |
| Worst run, holds taken | 73 | 160 | 8 |
| That run's holds in | 1 | 42 | 1 |
| That run | Still running | Still running at 38% | Closed, unpaid, reckoning on losing 74% |

All in: 172 runs ever, 31 running and 29 ended of the 60 kept, 2,822 holds in, 112 taken. The cost does not show: 80 and 77 ms a year in the switched pair, one fork each. A save at year 3000 is 2.07 MB against 2.05, and a run's store is bounded.

**Seen, on `alien harrow 348` at year 3000.** 🚀, a row's 🛰️ Its port: down to its town and out over its port, apron, lit pads, a yard stacked by all that has come in, a tower, craft by who runs them. Its chip opens the run's page: what, from where, why, what the crossing costs, who gains and what it did, each from its numbers. A busy port, land 4075, beside a quiet one, 4072, takes 60 times the lit pad pixels. Every people (👥, from the stars around) links to "Trade among the stars". A land away's Overview says what comes there from other worlds, or why nothing does. A first trade and a first raid are the world's news: a window, for anyone, once. A press of the window path on a real fork showed them: year 2002 "Goods across the dark for gain", year 2022 "The first hold taken".

**Levers.**
- **Far colonies have no market,** so no run reaches the worlds no land holds (129 of 184 on `harrow 348`). Their want is readable from `upkeep`: machines landed could free hands and raise their growth. This is also what would make trade move the people count, which it does not yet.
- **One people at most at a real port:** 1 run in 33 on `harrow 348` is a far people's, as `opening` takes only the best candidate every 5 years. Give a people met its own turn, and measure far runs per port. Two peoples at a port and a whole saucer have been watched only on the world gate 84 forges.
- The stars' map and system view draw no runs. Reuse `voyageMarks`.
- See-it buttons from the window, and trade's firsts in the Director's list.
- The house as a person with a home in town, from L5's courts. A film of a ship coming in and of a raid. Runs to home-world lands. Credit across the stars, smuggling, blockades. Thrown ships on a lane. Tapping a craft.

## The seed picker

Choose Earth-like or alien, then a target age, and get seeds that plausibly reach it.

- **Can it?** For any seed, on the device: a pure reading of what it holds (pull, chemistry, bodies,
  life, its laws) gives the ages it allows.
- **Does it?** A shipped catalogue of seeds run in full gives the year each reached each age. History
  is deterministic, so these are exact for that ruleset unless the god's hand changes them.
- **Starting there:** run to that year behind a loading screen with progress, or load a baked save
  where a phone would take too long. Play itself has no loading screen.

## What stays fixed

Early histories and old saves hold. Watching never changes history. Physics breaks only where a
universe's laws openly say so. Everything new has a page and a why. The iPhone 15 Plus is the floor.
One planner at a time.
