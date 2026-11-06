# War past the line: order, wings, reach and the greatest fire (W1–W6)

Asked 2026-11-05: "where are the missles and nukes and like drones and modern military and stuff beyond imagination
how can we implement this primitivley so you dont triggers safeguards which means make it emerge from first
principles, i say cause why do they line up medivially at the town still yk".

This is the rule of `first-principles-plan.md` applied to war: a principle says what it does, the world says how.

## Where it stands (read from the code, 2026-11-05)

- **The line.** `view/townwar.ts` `rankOf` stands every host in two ranks, 3.2 m a file, at every age, then closes
  them to 1.6 m to fight hand to hand. It never reads the arm. Only the close field (`view/battle.ts`) reads
  `armLook(...).order`, so rushes, trenches and machine-gun teams exist there and nowhere else. A host of machine
  guns walks up to a town and melees.
- **The siege.** Every siege is a ring of tents about the walls for a year and a storm at its end, whatever the guns.
- **The battle.** History fights one clash a year per war at a land's heart town (`sim/war/war.ts`). Nothing strikes
  anywhere else, so works, rail, power and ports are never hit. No reach exists to be had.
- **The arms.** Ground arms end at `automatic-fire` and `armoured-vehicles`, then a long gap to `beam-arms` and
  `machine-soldiers`. `rocketry` and `guidance` lead only to orbit. "Nuclear" is only a drive. Nothing flies in war.

## The rule

An arm is not a row. It is four numbers read off the world and what its people know:

| Number | What it is | What decides it |
| --- | --- | --- |
| **Energy** | what arrives at the target | muscle, then each store of energy that world's matter allows: powder, stronger chemistry, the world's densest store |
| **Reach** | how far it carries | arm, string, barrel; a wing needs air and a low pull (`lift`), a rocket uses the rocket equation against the world's own gravity and radius (`rules/launch.ts` already has it) |
| **Miss** | how far from the aim it lands | the eye, gun-laying, a gyro, radio, a machine mind |
| **Aboard** | who steers and who dies with it | a person, a link, or none |

What an arm does follows from one function of those: the ground it makes deadly grows with energy to the 2/3 power;
a miss wider than that ground wastes it. So cheap and many, one and exact, and one and vast all come out of the same
sum, and a world gets the mix its numbers give. A drone is a wing with a link or a mind aboard. A missile is a rocket
with a miss. The greatest fire is the densest store on a rocket. Names are words for the point reached, computed as
the alien arms already are.

**Order comes from fire too.** People stand apart until the ground the foe's fire makes deadly in a minute costs what
they can bear, and no further than command reaches (voice about 100 m, then wire, then radio). Trevor Dupuy's figures
(*Understanding War*, 1986, p. 84) are the check, a whole force's ground with its rear: about 10 m² a soldier in antiquity
(3.2 m apart, which is the code's number), 250 m² from 1650 to 1871 (16 m), some 2,500 m² in 1914–18 (50 m; his table, from
memory), 27,500 m² in 1939–45 (166 m) and some 50,000 m² at the Cold War's end (224 m). The same function, with spears,
must give today's line. (This plan first said 250, 2,750 and 4,000 from 1914 on, ten times low: those were his square
kilometres for 100,000 men.)

**Where the fight is comes from reach.** Past the range of the walls, the fight goes to what feeds the fight: within
reach, what hurts them most for each strike. Works, power, rail, ports, then what the owner of the arm dares.

## Past what people have done

The same four numbers keep going, with physics never broken and nothing on a list:

- **Fast is a weapon.** Energy is half the mass times speed squared, so anything from orbit, and any ship with a great
  drive, is a strike. `rules/starships.ts` already gives the speeds.
- **A star's light.** A mirror's area times the star's light, for peoples with mirrors in orbit.
- **A rock turned.** The speed change a rock needs against what a drive can give.
- **Machines that make machines.** The making chain with minds at the bench: they double until the ore runs out or
  someone stops them.
- **Made hands.** A made soldier has whatever hand it was made with, so a people who cannot grip a stock still arm
  theirs (`noBeamGrip` is the body's limit, not the machine's).
- **Minds at war.** Past `machine-minds`, the sides can be run by minds and fought by machines, with people watching.
- **What it would take to unmake a world.** The world's binding energy from its mass and radius, a number a page can
  set beside what a people commands.

## The stakes (asked 2026-11-05)

"whatever but like nukes shouldnt just be a ton of choas too i mean theres technially more powerful stuff like planet destoryers and star wars type stuff, but yk make it high stakes that everyone feels like real life yk"

**The greater the fire, the rarer it falls and the more everyone feels it.** A weapon like this matters mostly while it is not being used.

- **Rare.** Holding back is what the numbers usually say. A world where they fall often is a defect, whatever else it shows, and the step's measure fails on it.
- **The shadow.** A world that holds them lives under them. How near it stands is read from real things (who holds them, who is at odds, how a war between them is going) and shown on the world's panel.
- **The crisis is the main drama.** A war going badly for a holder brings a year when the world holds its breath. Most end with someone stepping back, and that is told as the event it is.
- **Everyone feels it.** Word reaches the whole world, not just the two sides. The Director films it, the clock slows, and it shows in towns far from the fight: people in the streets, what they say, what rulers and markets do next. A ruler you are playing gets the choice in a window.
- **A first fall changes the world.** It is remembered for generations, and every ruler's willingness falls after it.
- **It is not the top of the ladder.** Energy keeps going: a town, a land, a world's sky, a world unmade. Each step comes later, costs more, falls more rarely and reaches more people, up to every people in reach of the stars. Planet destroyers are W6, their energy set by the world's own mass and radius, with no borrowed names or ships.

## Steps

| Step | What the owner sees | Moves history |
| --- | --- | --- |
| **W1 Order from fire** | Town view: no more lines past the rifle. Squads apart, in bounds, using walls and yards; machine-gun teams and cars; guns standing off and shells landing, not tents round the walls. Spears and swords as they are. | No: view only, no list |
| **W2 Wings** | Flyers from `lift` and engines: scouts, then bombers over a town and fires lot by lot, seen in town and land. Thin-air worlds never fly; thick-air, low-pull worlds fly early and big. | Yes, past the first flyer |
| **W3 Reach** | Rockets with a miss. Strikes on towns and works far from any front, arcs on the globe, a strike seen in town, works' output falling after. War's target choice. | Yes |
| **W4 No one aboard** | Link, then mind. Swarms over a town. Possess one (Phase 60): fly it. | Yes |
| **W5 The greatest fire** | The densest store a world has, a great works that costs a realm years, a leader who decides. The flash, the lots gone, fallout on the weather's wind, soot and cold years, the harvest and the famine. Realms that both hold it stop fighting each other directly. Treaties, tests, the god's hand to give or take it. Worlds without the ore never get it, and a page says why. | Yes |
| **W6 Past imagination** | The list above, each by its numbers, carried by ships to other worlds, including the machines against natives already planned for Phase 69. Machines that can unmake a world, under the rule of "The stakes". | Yes |

## W1 and W1b, as built (2026-11-05)

`view/order.ts` is one function of numbers: the ground to a soldier is the foe's rounds-by-metres over what a body bears,
no wider than command reaches. `BEAR` is fitted on one figure, the magazine rifle at Dupuy's 2,500 m². The automatic then
comes out at 36,000 m² with nothing more fitted, between his 27,500 and 50,000. The line holds while `firepowerOf` is 0,
so muskets and rifles keep it, a decision and not a fit. A digest holds spears, swords, bows, muskets and rifles.

- **In the town:** past the rifle, squads staggered in depth, in bounds, in cover, with team guns and cars. From the
  self-loading rifle on, a siege has no tents about the walls: guns stand off and shells land in the lots.
- **The battle (W1b):** `fireOrder` says who stands off and who closes. Hosts that can answer fire stop at their stand-off,
  go to ground and fire; a side that breaks falls back under fire and the victors come on over the ground. A host with
  nothing to stand off with (spears against guns) comes on and closes, and most fall on the way.

| Battle | Dead by the hand, before | after | Closest, before | after |
|---|---|---|---|---|
| automatic v autoloader, field | 30% | 0% | 4 m | 61 m |
| repeater v repeater, held | 34% | 0% | 4 m | 90 m |
| spear v autoloader, held | 37% | 9% | they met | 4 m, those who arrive |

Falls stay history's in number, side and second; only who struck changes. A man's page now reads "killed by a shot to his
head" where a shot did it.

Still to do: a soldier possessed in such a battle still walks to the hand's fight (`sim/hand/fight.ts`, history's, so W2's).
Giving up is not drawn, since history keeps no prisoners. Squads have no banks or shell holes to bound between on the close
field. Shells knock nothing down and history does not hear them: W2 and W3.

## W2, as built (2026-11-05)

`rules/reach.ts` is the four numbers, pure: what flying asks of a world's pull and air, what its engine gives, what a load flattens, how
far it misses. Titan's numbers ask 1.9 W/kg, Earth's 80, Mars's 207. Two rows sit at the very end of the tree, so nothing moves until the first
find. `sim/war/air.ts` strikes the towns that hurt most within reach of the front, with no draw.

- **A town bombed (seen):** by day, one tight stream of machines across the town, drawn larger than life (at their true size they were one pixel), its
  loads falling and hits walking along under it; the eye goes low and ahead of them by itself; folk indoors; then its lots burn as any fire's. A gate reads the
  pixels, because it once counted machines for hours while none was drawn: `render/village.ts` `build()` destroys every child of its root not on a hand-kept list.
- **Ash:** a home burned from the air lies in ash three years, neither home nor open (`CHANGE.burned`, no new store: a save reads it back from its runs), then rises while
  its people want it. Without this a great town's heart stayed a hole for ever, and each raid chewed further out past what is drawn.
- **Where loads land:** hits about a point thin as e^(-r²/2σ²) and a plan's lots go as r², so a lot's number thins as an exponential: four sticks, no draw. A guided load lands near the aim, an eye-aimed one scattered.
- **The dead:** counted to the last one (`deathsIn`). A share over a land's ledgers, floored cell by cell, was killing no one in small strikes.

### Knowledge crosses the sea

Asked why they still line up medievally, a look at a real year 2000 found more than the order: on Earth, 54 of 139 realms still carried stone-tipped spears, a whole continent of 172 lands with 21 trade routes to a world of beam rifles. Nothing crossed the sea but goods. The principles' lore, sowing and smelting were all taught over land borders only. Now they are taught along sea routes as well, and what ships carry is shown as well as told: tongues matter less, and the further behind a land is, the more readily it copies (at most a principle a year, as any land).

**Measured, Earth, `first light`, from the start under these rules** (one run, with others alongside): first flyer year 817, first load 866. At year 900, 6 lands under 30 principles (223 by this point before the roots crossed), 25 under 60. At 1500 none under 30, and 91 of 93 realms on beam rifles. At 2000, 599 lands, 53.9 billion people, all 164 realms on beam rifles. Its last ten years: 1,131 raids on 281 towns, 334 million dead, against 1,134,804 dead in 381 raids in the ten years to 1500. Strike rows are 2.1% of a 13.9 MB save at 2000. A year costs 0.41 s on average from 1000 to 2000. Before: 54 of 139 realms still on stone-tipped spears at 2000. `vale 471` never flies, since nothing burns in its air: 1,082 lands, 356 billion people, 335 realms on automatic arms at 2000.

**Watching one.** At a year a second a raid is over between two frames, and only a few towns are struck a year. So a town lately bombed brings the clock down for the morning of its next two turns, and a strike's page, its town's page and its tiding offer it played again in its town with the world's clock held (`watch.raid`, `raidFilm`). A raid on a town it has already flattened drops its loads on the ruins under its stream (`strays`). In a city of spires they come over above its tops and the eye looks down from there.

### W1c: a battle by fire, as watched

A real year 2000 battle showed why they still looked medieval after W1 and W1b. **A wall stood on the field of any seat, a modern city's too**: `near.walls` is true of any seat with the lore, whatever the town has become. Fought by fire, no wall is on the field now, and the defenders come out to their trench. **Six figures against 240**: one figure stood for 82,945 men and the other side had hardly any, so the smaller host is drawn at no fewer than a quarter of the most drawn (`perOf`). **Blocks in straight files**, read as columns: each block now stands off the grid by its own draw and every other row a block's breadth along; cars keep no row. **From straight behind, a man lying down looks like a man standing with a pole**, which is what the eye along the line of fire showed: it now sits forty degrees off. **No fire to be seen**: more shots drawn in a battle by fire and thicker lines. Before the rifle's order, none of this moves: the digest of battles before the magazine holds.

Still to do: a soldier possessed in a battle by fire still walks to the hand's fight (`sim/hand/fight.ts`, history's). Overseas conquest stays rare, since a war needs a rivalry and rivalries are mostly between neighbours: W3's reach changes what a war is for, so look again there. A raid costs its side no fuel or machines yet.

## W3, as built (2026-11-05)

A rocket is the same four numbers as W2's wing, on one row at the tree's very end (`thrown-loads`). `rules/reach.ts`: reach from the rocket equation on a round world with the world's own charge, against its pull and radius; a tonne's energy; a miss as a share of the way flown, far less once steered; no one aboard. On Earth's numbers 302 km, 2,877 km in three stages. Pull 2.6 shuts it; a small light world's first goes around. Twelve sampled peoples' worlds range from 121 km (`cinder 570`, pull 1.57) to right around (`gale 710`, pull 0.63); none is shut.

**One departure from the brief, kept:** a world where nothing burns still throws if it has a charge. A rocket carries what it throws out, and those worlds already reach orbit on `rocketry`, so a page saying they could not would be false. So `vale 471` throws, 350 km on its first, though it never flies.

**What a realm chooses (`thrownAtOf`):** each foe land's greatest town within reach of where they leave, worth more where its land has works (x8) or goods pass through it (x2), and by the share that would land on it. A fall goes through W2's burning and dead. **Works stop:** a land's stock of machines goes in proportion to the lots flattened, and its works stand idle three years (`Market.idleUntil`, one optional number, hashed and saved only when set).

**Seen:** at 14:00, a streak out of a clear sky with no machine to be seen, a ball of fire over the roofs, then the lots burning as in a raid (in a great city a miss can carry it past the streets drawn: it comes down and burns out there, in the sprawl, and the eye goes with it); a line on the land and an arc on the globe from where it left; the pages say what fell, whose, from how far, what it cost. ✈ Watch plays it again at its own pace.

**Measured, on forks of far saves** (not from the start, so first years are ceilings): a median way of about 1,000 km, the longest 3,471 km. Rockets are 0.09% to 2.74% of a war's dead: small, and away from the front. Most falls stop a works. Whether a side with them wins more was too few wars to say: attackers with them won 2 of 6, against about 11% where neither had them. A year on a far world first looked 32% dearer on `vale 471`, with other runs alongside. Measured alone: 1,411 and 1,553 ms of CPU a year on W2's tree, 1,589 and 1,736 on W3's. A profile puts rockets' own code at about 9 ms a year (`airYear` 42 ms and `burnTown` 69 ms over twelve years of 22 s); the rest is two forks going different ways, since a rocket changes who holds what. Save size did not move measurably.

Levers: wasted rockets are counted, not drawn; nothing stops one yet; ports and rail read only as "goods go through"; no warning for a person possessed under a fall; a person's page says "raid" for a rocket's fall.

**What rockets cost, and how it was paid (2026-11-05).** Rockets make towns rise from ash every year in the space age. Each stretch that rose scanned the town's whole list of runs and sorted its open lots: 13,248 scans of some 2,500 runs and 4,528 sorts of some 930 lots in Earth's worst year, and gate 5 caught the slowest year at 1,317 ms on CI against a bound of 1,200. `TownBuilder.rise` now goes over a town once, and `standingRuns` passes each run and building once. `rise` went from 326 ms to 6 ms in that year, the year from 591 to 365 ms, and the run to 1080 from 339 s to 180 s with the slowest year at 335 ms, better than before rockets (497). It rests on runs never sharing a lot: 2.4 million looked over on far worlds, 37,283 of them in ash, none sharing, and hashes matched at every step on Earth and two alien worlds, so no history moved and no list is needed.

## Order

**W4 stays parked.** Its planner was stopped by a safety check on 2026-11-05 while writing the spec, before any code, and told not to write that content again, even reworded. Which part tripped it is not known. Asked 2026-11-05: "u cant even sneak em in thru first principles and axioms to get passed the safeguard for the game? it can be like proto/theoritical theory or some shit". No: that would be rewording it. It is not retried, reworded, split up or written by hand. Only a change from outside that check reopens it.

**W5 goes next, in the open.** No check ever stopped it: it was held back out of caution, and the owner wants it. It is planned under its real name, inside "What stays fixed" below. If a check stops it too, it stops there and is reported, and is not reworded. **W6 was never held,** and follows it. Asked 2026-11-05: "im not even saying like makee them make it at a super detailed manner just use whatever info u can already see in wikipedia yk". So W5 takes its figures for what these weapons do from what any encyclopedia says, and "What stays fixed" still holds. That does not reopen W4: the check did not say what tripped it, so a simpler version cannot be called safe from it.

A seed list no longer holds any of this up (2026-11-05): each ships as it is ready, the picker says "about" until the next list, and one list runs overnight when no rule change is about to land.

## What stays fixed

- **Pages say what, who, what it cost and what it did; never how.** No device design, no processing steps, no recipes.
  The making chain stops at "the great works at such a place" with its cost in people and years. Numbers are game
  numbers: an energy, a reach, a miss.
- Star Wars is the level, not the content: no borrowed names, ships or characters.
- A new arm changes nothing before it is found: pre-find history holds bit for bit, and W1 holds the pre-magazine
  scene's digest.
- Numbers are measured or marked as estimates, and each step reports on real seeds, Earth and alien both, by what can
  be seen on a phone.
- iPhone 15 Plus is the floor; a save stays in its bound.

## Measures to take

- W1: median spacing by arm in the town scene against the Dupuy figures; the pre-magazine digest; frame time on the
  phone floor with a modern host.
- W2: first flyer's year per world kind against air and pull; how many towns are bombed a war.
- W3: share of a war's dead and of works lost away from the front.
- W4: strikes per person lost.
- W5: how many worlds reach it; how many use it; falls per holder per century; crises per century and how many end in
  stepping back; years of cold after; how often history survives it; deterrence as wars between holders per century
  against others'.
