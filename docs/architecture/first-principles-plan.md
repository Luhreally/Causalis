# Principles distilled to first principles

Asked for 2026-11-04: "theres 110 principles, yey i feel tho with all these alien worlds these principles
should be distilled to first principles so a lot more can emerge in alien worlds, on vale 471 theres no
even firearms or swords!"

## Where it stands (measured 2026-11-04, by the rules as they are)

The rules hold 121 principles. A methane world's page counts 110, because 11 are for other kinds only.
The list is Earth's inventions, with a few rows written by hand for each other kind of world.

| A land people on a world of kind | Principles it can ever reach | Arms it can ever bear |
|---|---|---|
| rocky, sulfur | 95, 97 | club, spear, axe, **sword**, bow, **musket, rifle, repeater, self-loading, automatic**, beams |
| carbon | 84 | club, spear, axe, bow, then nothing until beams |
| ammonia, methane | 82 | club, spear, axe, bow, then nothing until beams |

A people of the water, on any kind of world, reach 49 to 66, and bear club, spear, axe and shell darts until
beams.

Vale 471 is a methane world. It reached Cold chemistry in year 490 and Polymer wire in year 620, and it was
still fighting with bows when it reached Orbit in year 1060. That is not physics. It is the shape of the list:

- `sword` needs `bronze`, `bronze` needs `fire`, and nothing burns there, so no people there can ever have a
  long blade.
- `musket` needs `firearms`, which needs `gunpowder`, which needs `fire`. A gun asks only for something that
  makes gas fast, and solid acetylene does that with no air at all.
- `fire: true` stands in for "a high temperature", and `kinds: [...]` stands in for "what this world's matter
  allows". Both are shortcuts, and everything past them is shut.

## F1, as built (2026-11-05)

Arms are now chosen by what they do. `rules/means.ts` reads a world's numbers (its cold, its air, its pull, what its
ground and air hold) and picks what holds an edge, what makes a charge and what a barrel is wound of, each from
candidates with real figures, and never by the name of a kind. A gun's reach comes from its charge, the air's weight
and the pull. No arm ids or indexes moved; only three `needs` changed, by function (`@tough-stuff`, `@works`,
`@current`), and clockwork's took the first of them. Earth's history and every oracle fixture are unchanged, and
Earth's guns give the table's own ranges exactly. A world whose people have claws straps its arms along a limb.

| World | Kind | Long blades | Plates | Muskets | Rifles | Automatic |
|---|---|---|---|---|---|---|
| wren 455 | methane | 698 | 786 | 1760 | 1833 | 2034 |
| lumen 152 | methane | 135 | 486 | 1442 | 1509 | 1564 |
| north 155 | carbon | 268 | 453 | 895 | 949 | 1282 |
| quill 298 | carbon | 168 | 463 | 978 | 1285 | 1621 |
| cinder 671 | ammonia | 129 | 432 | 785 | 886 | not by 1000 |
| marrow 145 | ammonia, 6 lands | 1160 | 1556 | 1961 | not by 3000 | not by 3000 |
| kestrel 557 | rocky, a people of the water | 1020 | 1147 | sound lances instead | | |

(First known on any land. People at the last year held within a few percent on most of them; wren 455 ended 38%
lower at 2700 with fewer realms, and north 155 far higher, by reaching other worlds sooner.)

Not done by F1: armoured cars stay shut where nothing burns; bows are not shortened by thick air; a blade of flakes
in battle looks as a sword does, and only its page shows the flakes; machines have no recipe on a world that burns
nothing, so its top tier waits for F2 and F3.

## F2 and F3, as built (2026-11-05)

Fire is no longer asked for: each step asks for a temperature, and a world's means of heat are worked out from its
numbers. Burning is one; the others are mirrors, the ground's heat, a hearth of joined acetylene and the electric
arc. A row that was one kind's now asks a function of matter, so any world that meets it can find it, and a kind's
name decides only words. Rocky worlds, Earth among them, are held to their old road until F4.

| World, first year known | Hearth or furnace | Forged iron | Pots | Glass | Factory | Current | Steel |
|---|---|---|---|---|---|---|---|
| wren 455, methane | 659, joined acetylene, 1,670 °C | 693 | 756 | 955 | 1574 | 1583 | no |
| north 155, carbon | 463, mirrors, 1,597 °C | no | 527 | 814 | 859 | 1231 | 1304 |
| marrow 145, ammonia | 1829, mirrors, 829 °C | no | 1952 | no | no | no | no |
| alien 84, sulfur | burns | no | 42 | 140 | no | no | 549 |

By year 2000. One seed's year is one draw: a row earlier in the tree takes a land's one find of the year, so
compare across seeds, never one pair. On wren 455 at night a town of a land with the hearth has 3,794 warm-lit
pixels, and a town the year before with none has 0. Earth's eight history fixtures are unchanged, and kestrel
557, a rocky world, is the same as under F1.

Still shut, as the rules now say why: bronze and iron on methane, ammonia and carbon; steel on methane and
ammonia; coal, steam, oil and armoured cars on all three. Next levers: engines of portable fuel and armoured cars
where nothing burns, house walls of fired stuff, a town's height reading its pull (`tall-frames` is chronicle and
page only), and age names that follow which engine a land has.

## The rule

**A principle says what it does. The world says how.**

Three things replace the list:

1. **What a people wants done**, as a function with a physical measure: hold an edge, make gas fast, throw a
   mass, turn a difference of heat into work, carry a current. There are far fewer of these than inventions.
2. **What a world offers**, read from its numbers and never from the name of its kind: its temperature, its
   air and its pull; what its crust and seas hold; how hard and how tough each stuff is at that temperature;
   how hot each of its means of heating can get; what its people's bodies can do.
3. **How the two meet.** For each function, the means this world allows, each with its figures, so a thing's
   strength comes from what it is made of and where it is used. A gun's reach follows from its charge's energy,
   the air's weight and the world's pull. Its name comes from what it is: a sword may be flakes of ice set in
   a fibre spine, a gun may be charged with acetylene.

So the count differs from world to world, and so does the content, and nobody writes a row for a world.

Rocky worlds answer with what Earth did, at Earth's numbers, so Earth's history and the seed list's Earth rows
stay exact, and old saves load. What changes is what was shut.

## F4, as built (2026-11-05)

The hold on rocky worlds is gone: they read every row by their numbers, and a people turns aside only where its
numbers shut the first way, land by land. Flakes on a spine where no copper lies within reach, where a star has under
0.3 of the Sun's metals, or where limbs cannot grip a haft. Engines on mirrors or the ground's heat where no coal lies
within reach. Riders only where a tame beast is three times their weight, and their host's words name that beast. The
0.3 and the 3 are estimates. Earth reads by the same numbers and comes out the same: its eight history fixtures are
unchanged, and it knows the same 95 principles. Earth's principle pages do move, in words only: riding gains a line for
what it asks, and rows shut on Earth now say the true reason ("No diamond lies in its rock", not "Fire burns in its
air"). That is why the chain digest changed.

| Seed, first year known | Stand-in edge | Iron | Sun engines | Steam | Factory | Current | Orbit | Host at 1500 |
|---|---|---|---|---|---|---|---|---|
| alien 132, no copper near, before | no | no | no | no | no | no | no | stone spears |
| alien 132, after | 299 | 372 | 536 | 1131 | 651 | 826 | 1034 | automatic arms |
| alien 116, trunk, 1,180 kg, before | no | 660 | no | 1082 | 1115 | 1135 | 1351 | tusks, helmets |
| alien 116, after, riding shut | no | 660 | 857 | 1082 | 892 | 970 | 1149 | tusks, armoured cars |
| alien 163, hands and coal, before | no | 416 | no | 639 | 862 | 932 | 1472 | steel rifles |
| alien 163, after | no | 416 | 738 | 639 | 844 | 930 | 1264 | steel rifles |

One seed's year is one draw, so read across seeds. Next levers: a mount drawn as its own beast (a battle still draws a
horse under a rider of any beast), beasts deciding draught, bodies deciding the pace of crafts, steam on wood.

## Steps

Each step ships something you can watch on the phone. Each changes history, for the worlds it opens, so each
needs the seed list run once, in the background.

| Step | What it does | What you see | Changes history on |
|---|---|---|---|
| F1 Arms on every world | Long blades and guns by function, for every kind of world and body: what holds an edge, what makes a charge, what a barrel and a shot are made of. Range and power from the charge, the air and the pull. A people of the water get their own: sound and long darts, because water stops a ball | Vale 471 fights with long blades, then guns, then automatic fire. Battles, the town at war and each arm's page show them, and say why | Carbon, ammonia and methane worlds; water peoples |
| F2 Heat, not fire | `fire: true` replaced by the temperature each step needs. Burning is one means of heat; mirrors, the ground's heat, joined acetylene and the electric arc are others, each reaching its own temperature | Pottery, metal and glass arrive on no-fire worlds by their own means, in their own order. Most of the 39 steps now shut on vale 471 open or get a page saying what stops them | The same worlds |
| F3 No more lists by kind | The rows and gates written for one kind become functions asked of matter, so any world meeting them finds them. Kinds become descriptions, not gates. Worlds between the kinds can exist | New paths nobody wrote: a sulfur world without metal, a thick-aired world that flies early, a low-pull world building high | All alien worlds, not Earth |
| F4 Rocky worlds differ | The same reading on rocky alien worlds: no ore means no bronze age, and a long blade of flakes on a spine instead; beasts decide mounts; bodies decide tools | Alien rocky worlds stop retracing Earth's order | Rocky alien worlds, not Earth |
| F5 The tree of what can be done | The tech page shows functions, this world's means for each, the figures, and what shuts the rest. Compare two worlds side by side | Open any world and read why it went its way | Nothing: it shows what is there |

## F5, as built (2026-11-06)

A world now says what it can do, and why. On any world's page, the age's chip and 🪜 open **What can be done here**. It leads with what's odd about this world, as facts with what each shuts: on `vale 471`, "Its air holds no free oxygen: nothing burns. That shuts digging coal, the steam engine and drilling for oil and 4 more steps." Then seven functions: holding an edge, heat and how high it goes, a charge, throwing things far, moving under its own power, flight, and talking at a distance. Each says what this world has reached, what could come next, and what never will, with the figures and the year: "Stops at 3,000 °C: the electric arc, since year 665", "Never burning a fuel". `first light` says "Nothing about it is odd". **Beside another** sets any world next to it, by a chip or a typed seed, in two columns that fit a phone, with why they part on top. A world's facts need no simulated years, so any seed text works.

- **Whether and why are one reading.** `rules/can.ts` holds `stepStop`, `openSteps` and `whyShut`, so they can't disagree: `affordsPrinciple` is now `bodyStop`'s yes or no, and `openTo` in `host/can.ts` is `openSteps`.
- **A land's lack is not a world's.** It reads "Not as its lands stand" where a land lacks something, "Never" where the world does. A line's colour says had, could be, or never.
- **It only reads.** No state, no events, no version bump. The eight fixtures are unchanged and every hash is the same before and after.

Tally, 65 worlds (the 22 of the list, 3 of Earth, 40 more; 12 with no people): 47 different sentences for what is shut and 107 for what is odd, none on every world, and none where whether and why disagree. The commonest is "No coal lies within reach of its people's lands", on 17 of 65. History agrees with the reading: at 1500 on `vale 471`, `gale 710`, `kestrel 557`, `quill 742` and `first light`, no step is known that the reading from first lands calls shut. Opening costs 20 to 24 ms, nothing until opened; another world's column about 0.5 s once, and the last six are kept.

Limits, stated: ▶ films from a line are cut, a line opens its thing's page. `shutWhy` and `shutBecause` keep their own words on principle pages and the picker, read from the same conditions but not yet from `stopWords`. Edge figures for water metals (75%, 90%) are estimates the page doesn't mark yet. "Talking at a distance" read current and orbit until Signals gave it steps of its own. `kestrel 557`, `quill 742` and year 40 were read by the rule's words and tally, not as shots of their own pages.

## Signals, as built (2026-11-12)

Asked 2026-11-11: "the utility of phones and laptops and information age", and "the whole world should technically be explored before they reach space". Two functions, each a ladder read from what a land knows, and each rung from what its world allows.

**Carrying a word far and fast.** Nine steps, appended last to the tree (`SIGNAL_TREE` in `rules/principles.ts`, so every land's draws are as they were): the telegraph (current and writing, and a conductor to carry it), the telephone (the telegraph and works), radio (the telephone and philosophy, on land and shore) or sound through the deep (the telephone and mathematics, for a water people), computing (the telephone and electronics), sets carried by hand (radio or sound, and electronics), the solid switch (computing, and a switch in a pure crystal: `switch-in-crystal` in `rules/properties.ts`, silicon from a rock of silicon and carbon, germanium, or gallium with arsenic), networks (the solid switch and the telephone), and machines in the pocket (networks and hand sets). A world with no pure crystal stops at valves and wire; a world with no current has none of it. Before the wire, a word goes by a runner or swimmer (40 km a day), a rider (100), the currents (120, under water), a ship (150), relays on post roads (300) or the mail train (800), each from what a land knows (`WORD_WAYS` in `rules/signals.ts`).

**What it does is one number a land.** Each step adds to a land's `signal` effect; its connectivity is that, at most 0.95 (`connectivityOf`). It is read where history already read distance and delay, and each reading is exactly what it was at 0:

- *Prices meet.* Between two markets, at the lesser of their connectivities `c`, traders move 0.25 × (1 + 2c) of a spare, are 2 × (1 + 2c) as keen on a margin, and the way costs 1 − 0.3c of what it did (`trade` in `sim/economy/systems.ts`).
- *Information work.* 0.45c of a land's dealings are information work, and that work multiplies what its carriers move by 1 + 2 × that share.
- *Hosts keep in step.* A host's supply far from its seat is steadied by 1 − 0.6c (`sim/war/war.ts`).
- *Reach and learning.* The telegraph and networks each add a step of a realm's reach; every step lifts learning (the web most, 0.4).

Never a device, a person or a message. On the pages: a land's Economy tab has **Signals** (how long a word takes over 1,000 km and by what, how much is on the line, its markets, its information work, its hosts afield); each step's page says what it does and what it changes; **What can be done here** has the ladder "Talking at a distance" from a runner to a machine in every pocket, with "Came by" and each rung's year, and the mind's ladder takes computing and the solid switch. A world past networks reaches an **Information** age (📱), beside the others: Earth came to it after orbit, a world may come to it before.

**Seeing a world whole.** What a people knows of its world's surface is a pure reading of what its lands know (`host/known.ts`): from every peopled land and every land that knows anything, two steps on foot; from the coast, as far at sea as its ships go (`SEA_STEPS`), and two steps inland where they land; a water people sees the shores; flyers see what they can fly over and back; a rocket sees its horizon from 150 km (√(2rh), 1,380 km over Earth); and from orbit, everything. So the map is fully known by orbit as a consequence of seeing from it, not a year. The Knowledge lens darkens what isn't known and says how much is; **What can be done here** has the ladder "Seeing its world whole" and how much is known.

**Drawn cheaply, with the batches there are.** A town of a land with the telegraph has poles at its blocks' corners with the wire slung between them; with radio, a mast with a red light over its square; with computing, networks and machines in the pocket, its windows' light goes from warm toward the cold of screens at night (0.12, 0.4, 0.6 of the way); and with hand sets or machines in the pocket some of its grown people carry a phone (4% and 35%).

**Measured** (`tools/signals-probe.ts`, against 062f4a27, its base):

On `first light` (Earth) the steps come in Earth's order: the telegraph in 804, the telephone 879, radio 920, a first orbit 921, computing 948, sets carried by hand 954, the solid switch 979, networks 1003 (the Information age) and machines in the pocket 1038. Against its base:

| | base | with signals |
|---|---|---|
| first orbit | 961 | 921 |
| Other worlds | 1139 | 1094 |
| realms at 1200 (greatest, in lands) | 175 (37) | 165 (37) |
| wars by 1200 / by 1500 | 7,968 / 10,217 | 7,549 / 9,507 |
| people at 1500 | 1.94 billion | 1.89 billion |
| grain spread between neighbours at 1000 / 1200 / 1500 | 0.070 / 0.068 / 0.023 | 0.064 / 0.066 / 0.029 |
| known before its first orbit | (no reading) | 78% of its surface, 69% of its land; at orbit, all |

On seven other worlds (alien 16, 47, 67, 75, 94, 132 and `north 155`), every one came to the whole ladder: the telegraph from 710 to 1016, networks from 948 to 1448, the pocket from 981 to 1570. Before its first orbit a world knew 32% (alien 67) to 78% (Earth) of its surface, 26% to 69% of its land, the last of it seen by rocket; at orbit, all of it. A land on the web is at 0.95: a word goes 1,000 km in a second, and 43% of its dealings are information work. Until a world's first telegraph its people, realms and wars are exactly as they were. After it, on Earth wars are fewer (9,507 against 10,217 by 1500); on `north 155` wars are fewer too (657 against 760 by 1800); on alien 132 it goes both ways (its greatest realm 6 lands against 11 at 900, 7 against 3 at 1300; wars 3,488 against 3,356 by 1500). Prices between neighbouring lands meet only a little: the grain spread at 1000 is 0.103 against 0.117 on alien 132, 0.125 against 0.143 on `north 155`, 0.064 against 0.070 on Earth, and later it is as often wider as narrower, since a neighbour's price is set by its own harvest more than by the margin.

**Year cost.** Back to back on the same cores, a run of Earth to 1200 took within 4% of its base's time at every century but one, where it was 13% faster; the unpinned runs swing ±50% on this machine with whatever else runs, and the probe's own readings each five years are in them. `loreYear` reads a land's knowledge once a year instead of once a step's need.

**The oracle's eight are unchanged**, every hash as it was: a land that knows no signal step reads exactly as before.

Limits, stated: phones are drawn in towns, not in the far view's crowds. Known land isn't yet a reason to settle it. No world of 160 alien seeds lacked a pure crystal (silicon is common in rock), so the stop at valves is shown by a test, not a world. A water people's sound through the deep was not reached by year 1800 on the water worlds probed (alien 29 had only writing by then; kestrel 557 no current), so it too is shown by its test. Gate 6's save budget was not run. Gate 109 (`tools/signals-gate.ts`) checks it all on alien 132 at 430 × 932 by touch.

## Order

F1 goes next, alongside L1 and L2 of lives-plan.md, since those change only pages and the map. F2 follows it.
F1 to F3 come before Phase 69 (peoples at their own pace) and Phase 70 (wars of conquest on native worlds),
because the natives in those scenes fight with what this plan gives them.

## What stays fixed

Earth's history. Rules stay pure tables and functions, and no random draws are added. Physics breaks only where
a universe's laws openly say so. Every means has a page and a why. Star Wars is the level, not the content. The
figures come from real chemistry and materials, and a page says plainly where a figure is an estimate.
