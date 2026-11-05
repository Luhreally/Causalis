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

## Steps

| Step | What the owner sees | Moves history |
| --- | --- | --- |
| **W1 Order from fire** | Town view: no more lines past the rifle. Squads apart, in bounds, using walls and yards; machine-gun teams and cars; guns standing off and shells landing, not tents round the walls. Spears and swords as they are. | No: view only, no list |
| **W2 Wings** | Flyers from `lift` and engines: scouts, then bombers over a town and fires lot by lot, seen in town and land. Thin-air worlds never fly; thick-air, low-pull worlds fly early and big. | Yes, past the first flyer |
| **W3 Reach** | Rockets with a miss. Strikes on towns and works far from any front, arcs on the globe, a strike seen in town, works' output falling after. War's target choice. | Yes |
| **W4 No one aboard** | Link, then mind. Swarms over a town. Possess one (Phase 60): fly it. | Yes |
| **W5 The greatest fire** | The densest store a world has, a great works that costs a realm years, a leader who decides. The flash, the lots gone, fallout on the weather's wind, soot and cold years, the harvest and the famine. Realms that both hold it stop fighting each other directly. Treaties, tests, the god's hand to give or take it. Worlds without the ore never get it, and a page says why. | Yes |
| **W6 Past imagination** | The list above, each by its numbers, carried by ships to other worlds, including the machines against natives already planned for Phase 69. | Yes |

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

## Order

W1 now: it is drawing only and answers "why do they line up". W2 to W5 are one history batch with one seed list, Earth
included, so they alternate with L4 rather than each moving Earth's id. W6 comes with Phases 69–70.

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
- W5: how many worlds reach it; how many use it; years of cold after; how often history survives it; deterrence as
  wars between holders per century against others'.
