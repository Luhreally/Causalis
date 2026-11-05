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
| 71 Trade among stars | Goods from real shortages and freight costs; ports, merchant houses, credit, piracy, smuggling, blockades | Busy spaceports of many peoples; a lane raided | L |
| 72 Star nations | Federations, empires, vassals, civil wars, dark ages | The fleets of Phase 67 fighting for real empires; a realm falling apart | L |
| 73 Your hand in it | Galaxy lenses, the director filming firsts, a pilot possessed, god's acts at star scale | All of it, from the title screen | M |

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
