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

## Order

F1 goes next, alongside L1 and L2 of lives-plan.md, since those change only pages and the map. F2 follows it.
F1 to F3 come before Phase 69 (peoples at their own pace) and Phase 70 (wars of conquest on native worlds),
because the natives in those scenes fight with what this plan gives them.

## What stays fixed

Earth's history. Rules stay pure tables and functions, and no random draws are added. Physics breaks only where
a universe's laws openly say so. Every means has a page and a why. Star Wars is the level, not the content. The
figures come from real chemistry and materials, and a page says plainly where a figure is an estimate.
