# Handoff

> **September 9, 2026 checkpoint:** Read [the current continuation notes](docs/CITY-CHECKPOINT.md) first. This branch now contains unfinished city/progression work. The older launch table below describes the baseline, not this checkpoint. Known collapse regressions and a long-run matter failure remain; do not deploy this as a validated balance fix.

For an agent picking this up cold. Read this before touching anything. It is
about how to work on Causalis without breaking it, and what is currently true
about the part of it under active work.

## What this is

Causalis is a deterministic artificial-life god game. Chemistry becomes life,
life becomes culture, culture becomes history, and every flame, lineage, city
and war shares one conserved world. It is a Vite app deployed to GitHub Pages
at <https://luhreally.github.io/Causalis/>.

Three invariants hold everywhere and are not negotiable:

- **Render code never writes `W`.** Drawing reads the world; it never changes
  it. Several tests assert this by hashing the world across a render.
- **Matter is conserved.** Anything created by a player action is booked
  through `causalPushInput` so the audit balances. `auditMatter().delta` must
  stay 0.
- **The simulation is deterministic.** Same seed, same ticks, same world.

## How the code is laid out

`src/game/sections/*.js` are numbered sections composed, in the order given by
`src/game/manifest.json`, into **one shared closure**. That has two
consequences you must hold in your head:

- Later sections extend earlier ones by **override chains**:
  `const base = fn; fn = function (...) { ... base(...) ... }`. This is the
  idiom for changing behaviour. Add a new section rather than editing an old
  one where you can.
- **Duplicate top-level identifiers silently override each other.** Two
  sections declaring the same `const` is a real bug that no test may catch.
  There is a `dupscan.cjs` in the scratchpad for this.

Every system also carries a `window.ALIFE_*_DEBUG` surface. Use it. It is how
the tests and every probe reach inside the closure.

## Working rules — read these, they will save you an hour

**Never edit the source tree in `C:\Users\danie\OneDrive\Documents\Causal sim`.**
Windows Controlled Folder Access blocks writes there. It is a mirror used only
for deploying. Do all work in the clone:

```
/c/Users/danie/Causalis-work/repo        branch: visuals
```

**Run the fast suite before every commit and never edit source while it runs.**

```
npm run test:fast > log 2>&1
bash $SCRATCH/suite-check.sh log 94
```

The expected count is the number of `"ok": true` lines, currently **94**. It
changes only when you add a test file. A green suite is necessary and not
sufficient — see "Pitfalls".

**Deploy** by fast-forwarding the mirror and pushing:

```
cd "/c/Users/danie/OneDrive/Documents/Causal sim"
git fetch -q /c/Users/danie/Causalis-work/repo visuals
git merge -q --ff-only FETCH_HEAD
git push -q origin codex/graphics-finished:main
```

The Pages workflow finishes in about **30 seconds**, not minutes. Verify with
the API rather than guessing:

```
curl -s "https://api.github.com/repos/Luhreally/Causalis/actions/runs?per_page=3"
```

and confirm the change is really live by grepping the served bundle for a
marker the commit introduced. A test-only commit produces a byte-identical
bundle, so its asset hash will not change.

**Each change wants:** a numbered section or an override in one, a
`window.ALIFE_*_DEBUG` entry, a `tests/*-smoke.cjs` assertion chained into
`npm run test:fast`, and a README paragraph in the project's voice.

## Measuring

Balance work here cannot be judged by reading code. There is a probe toolkit in
the session scratchpad (`$SCRATCH`), each a small Node script that loads the
composed runtime in a VM and reaches into the closure:

| probe | what it answers |
| --- | --- |
| `skip-probe-lean.cjs <seed> <size> <complexity> <maxSkips>` | press Causal skip until a ship leaves; one JSON row per press |
| `lean-diag.cjs` | the same, plus deaths by cause, hunger, and famine per press |
| `lean-why.cjs` | per-town food, store, hungry share, fields, stores |
| `concert-check.cjs` | the concerted-effort level held vs currently needed, per decade |
| `haste-check.cjs` | histogram of the birth haste across everyone alive |
| `road-why.cjs` | who knows road building, town distances, why no link |
| `plain-run.cjs` | a world with no skips at all, as a control |
| `shot.cjs <out.png> "<setup js>" "" <url>` | headless Chrome against the live site; prints the setup's return value |

Run them with `SCRATCH` and `CAUSALIS_ROOT` set. **Set the environment per
command** — `cd x && export … && node a & node b &` leaves the second command
without either, which fails in a way that looks like an empty result.

A run to a launch takes 10–25 minutes of wall clock. Run several seeds in
parallel; the machine has 32 cores.

## Pitfalls that have actually bitten

- **A green smoke test is not evidence a change fires.** Twice a suite-clean,
  test-covered change turned out to be a no-op on generated worlds, because the
  fixture builds exactly the shape the assertion needs and real worlds fail the
  precondition. Probe a generated world and print the change's own return value
  before you believe it.
- **Bit-identical A/B rows mean the change did not fire**, not that the seed is
  deterministic. Diff the logs field by field before concluding anything.
- **The simulation is chaotic.** One seed's before/after is weak evidence in
  either direction. Judge across at least three seeds.
- **Verify patch anchors.** A heredoc patch whose assertion fails leaves the
  file untouched, and a commit can then ship only a README sentence describing
  code that does not exist. `grep -c` the new identifier after patching and
  check `git show --stat` before believing a commit.
- **Write files with `newline="\n"`** on Windows or a whole file rewrites as
  CRLF and `git diff --stat` shows thousands of changed lines.
- **`prettier` is not installed** in the work clone. Format by hand in its
  style.
- **Give Python Windows paths.** A heredoc patch with
  `p = "/c/Users/danie/..."` printed success and changed nothing; the file was
  untouched and `git status` clean. Use `C:/Users/danie/...`. The same applies
  to `$PWD` inside a Python string from Git Bash. Always `grep` the file
  afterwards — this cost two wasted measurement runs in one sitting.

## Where the work stands

The current push has been about the Causal skip: the player presses it, the
world runs toward the next milestone under a concerted effort, and eventually a
ship leaves for the stars. The goal is that a ship actually launches, on every
world size, including the ones a phone would pick.

Measured end to end, current `main`:

| world | result |
| --- | --- |
| standard 180×110 | not yet measured |
| small 120×72, `ship-b` | ship at year 86 |
| small 120×72, `ship-c` | ship at year 80 |
| small 120×72, `causal-origin` | no ship; starves from year 122 |
| phone 96×58 lean | ship at year 104 |
| battery 72×44 lean, `causal-origin` | ship at year 117 |
| battery 72×44 lean, `ship-b` | no ship; collapses |
| battery 72×44 lean, `ship-c` | no ship; clears the modern gate at year 98 and dies before Starflight |

"Low battery mode" means two settings in the create-world form: the world size
`battery` (72×44) or `phone` (96×58), and `complexity: "lean"`.
`MOBILE_WORLD_DEFAULTS` in `44-mobile-runtime.js` is phone + lean + low quality
+ no labels. Lean only coarse-grains people more than five tiles from a
settlement, and compensates their stride, so townspeople behave identically —
it is not a factor in any of the above.

### What a modern world asks, and why it scales

A world only sends a ship once it looks like one that could: cities at the
urban stage, current in some towns, tower blocks, working factories, a road,
and people living in towns. Those counts were written for a standard map and
did not scale, while every other gate in the game does. They now all fall with
the map's **area** and hold at a floor that keeps each one's meaning.

| size | cities | current in | blocks | apartments | factories | people |
| --- | --- | --- | --- | --- | --- | --- |
| battery | 2 | 2 | 16 | 6 | 1 | 20 |
| phone | 2 | 2 | 16 | 6 | 1 | 28 |
| small | 2 | 2 | 16 | 6 | 1 | 44 |
| standard and above | 2 | 3 | 28 | 12 | 2 | 100 |

The block and apartment counts are then swayed by the seed, up to a fifth
either way and fixed for that world, so one world asks nineteen blocks where
another asks fourteen. `causal-origin` sits near the middle at 0.99. Read the
whole set, sway included, with `window.ALIFE_MODERN_DEBUG.wants()`.

**A downtown was impossible before 2026-09-09 and the reason was mechanical,
not numerical.** `modernSite` returns the first *unfinished* building of a
type, so the skyline stage's loop supplied the same block once per block it
still wanted. With the requirement set to forty, worlds raised two. Only after
`modernRaise` was added — work every unfinished block, plan another when they
all stand — did the same world raise forty in one press. If a count-based
requirement is not being met, check whether the mechanism can produce more than
one of the thing per press before touching the number.

The people floor is not a number of its own: it is two cities' worth at that
world's own urban gate (`urbanGate().local` from `84-horizons.js`). Read the
whole set with `window.ALIFE_MODERN_DEBUG.wants()`.

### Open problems, with what is already known

**0. The matter drift is fixed (2026-09-10).** Kept for the method. On a
collapsing world one tick lost 23,613, and a second world lost 10,948. The
probe narrowed it to a single rare record: a *common* species whose 16-bit
column was saturated, with the remainder held in the tile's overflow record,
and the record deleted in the tick an organism was born on that tile — the
birth took seventy-three from the column and the record went with them.
`setTileMatterAmount` dropped the record whenever the new value fitted the
column, which is right for a caller that means the total and wrong for one that
read only the column. No caller was ever named; instead the loss was made
impossible. The remainder now folds back into the column as far as it fits and
the rest stays on record. Every caller that reads the total is unaffected,
because their value is above the ceiling and takes the earlier branch.
Verified: zero drift across fifty-three presses on the four worlds that used to
lose matter.

**The method is the reusable part.** `matter-leak-probe` runs coarsely to the
press before the drift, then audits every tick, and reports which part of the
ledger moved and what stands on the tile a record vanished from. That took the
search from "a tick divisible by thirty-two with a solstice in it" to one tile
and one species in two runs. Note that wrapping a runtime function to catch a
caller *perturbs the run* — `overflow-catch-probe` diverged from the world it
was meant to observe and never reached the drift. Prefer observation to
instrumentation here.

**0b. Old note, superseded.** On a collapsing world,
`causal-origin` battery at year 188, one tick lost 23,613. `matter-leak-probe`
narrowed it to a single rare record — tile 326, species 2, a *common* species
whose 16-bit column was saturated with 23,611 held in the overflow record, and
the record was deleted. `setTileMatterAmount` drops that record when the new
value fits the column, which is right for a caller setting a total and wrong
for one that read only the column. Every caller found so far reads through
`tileMatterAmount`, which includes the overflow, so the guilty one has not been
identified. `scripts/overflow-catch-probe.cjs` wraps the setter and records the
stack of any call that would drop a non-empty record; it found nothing on the
current source because the world it needs no longer collapses. Run it on a
world that does.

**1. Worlds overshoot and starve — the cause was found on 2026-09-09.**
`settlementFood` counts fourteen for every completed farm, so a town scored
well on fields it had not harvested. Measured: Maatsutsea, seven people, score
72.6, six units in the larder; Armuuni, score 19.5, four units, two thirds
hungry. The town read rich, so no relief came and the granary let its people
hurry another child at five times the pace while they starved beside their own
fields. `foodOutlook` now judges lean and famine on `settlementLarder` — what
is stored plus what grows within reach — and keeps the old score as what the
land could yield. This is also why the earlier ration experiments backfired:
they raised the score without reaching a mouth.

Measured after, with the downtown requirement in place: **phone launches at
year 109 with eighteen blocks and seven apartment blocks**, battery `ship-b` at
143 with twenty-three and eight, small `ship-b` peaks at 200 people where it
peaked at 148. Battery `causal-origin` and `ship-c` still do not launch. Two of
five, up from one of five.

**1b. What remains of the overshoot.** This is the big one and it is upstream of
almost everything else. `updateConcertedEffortState` in `41-implicit-society.js`
raises the concerted effort to level 2 whenever any settlement has
`settlementFood(s) < 8` **or `settlementWater(s) < 8`**. The water term pins it
on permanently, because towns simply do not stockpile water — measured on
causal-origin at year 60 with no skips, the largest town held **zero** stored
water while its food was abundant, and five to seven of eight towns sat under
the line across a 120-year run. `concertedIntensity()` is then 3, and
`concertedBirthHaste` returns 5, so every fed person's next child comes five
times faster, from the first decades, forever. Populations run past what the
fields carry and then starve.

Two attempts to curb it were measured and **both made things worse**:

- Feeding every *lean* town instead of two in *famine* (`ab8fa05`, reverted in
  `f06f3ae`): `ship-c` went from a ship at year 79 to halving at 145.
- Raising `HASTE_FOOD` in `82-granary.js` from `LEAN_FOOD * 2` to `* 4`:
  `ship-c` halved at year 70, down to nine people by the sixth press.

The lesson: **the fast growth is load-bearing.** It is what gets these worlds
to the modern gate at all. Do not tighten it without replacing the growth it
provides. Note also that `makeCausalSkipState` pins the level to at least 2 for
a skip's whole duration, so fixing the water trigger alone will not change
anything during skips.

**2. A one-town polity could never build a road — fixed in `28966fe`.** Kept
here because the shape recurs. `roadPassFor` in `88-roads.js` returns at once
unless a faction holds two or more towns, and `chooseRoadPair` only pairs towns
under the same flag. On `ship-c` battery at year 98 there were four towns in
four separate factions, one town each, every pair 21–51 tiles apart and well
inside `ROAD_LINK_REACH` of 64, one of them knowing the craft, and none of them
able to pave anything. The world stood one line short of its ship for ten
presses. `modernRoadBetweenStrangers` now starts and paves a link between the
nearest reachable pair when no polity has two towns. After it, `ship-c` builds
its road and clears the whole modern gate at year 98 — and then dies of problem
1 before it reaches Starflight and a tower.

**The general lesson from that one:** a requirement can be unreachable in
principle rather than merely hard, and the shortfall list will not tell you
which. When a stage stalls for many presses, probe the mechanism that satisfies
it and check its preconditions, rather than pushing harder at it.

**3. The downtown costs slow worlds their ship.** `ship-c` on battery launched
at year 102 with the old two-block bar and now dies at 164 short of fourteen
blocks. `ship-b` on battery launched at 116 with twenty-four blocks and ten
apartment blocks, then reached Cold Stores, Hydroponics and a colony. The
difference between those two seeds is time, and the thing eating it is problem
1. Do not lower the downtown to paper over that.

**4. `causal-origin` on small regressed.** It shipped at year 104 before the
food work and now reaches the road and three tower blocks by year 135 before
halving. Two of three small seeds went the other way, so the net is positive,
but this seed wants its own diagnosis.

## What the city has, after 2026-09-10

- **A downtown before the ship.** Sixteen blocks and six apartment blocks on
  the small maps, twenty-eight and twelve on standard, swayed per seed. The
  enabling fix was `modernRaise`: `modernSite` returns the first *unfinished*
  building, so the old loop supplied one block per city per press however many
  the skyline wanted.
- **Cars built for their ground.** Proportions come from the terrain genome —
  `roughness` from ridge weight, `openness` from continent scale, `chill` from
  base temperature. Broken country shortens and raises a car, plains lengthen
  it, cold fits smaller glass, wet seals the cabin.
- **Mountains and leaves that do not repeat.** Crown, ridge lean, shoulder,
  bite and strata count are continuous per seed inside the family the seed
  picked; so are leaf spread, rise, tilt, bough droop and canopy lift. Earth
  keeps its own grammar. `scripts/seed-variety-probe.cjs` counts how many seeds
  share a shape.
- **Families that follow the beds.** A grown child used to leave home the
  moment its town learned masonry. Now the household is the whole line under
  one roof until the city has current and beds to spare, and only then narrows
  to a couple and their dependent children.

- **A street that is walked on.** `124-sidewalks` builds the paved tiles into a
  graph — nodes and eight-way edges — rebuilt when the paving changes, at most
  once a tick, and refreshed every sixty-four ticks besides, because road tiles
  can be laid without a link. `sidewalkRoute(a, b)` walks the pavement or says
  there is none, and `directionScore` gives a person on foot a bonus of 5.5 for
  a paved step. `122-public-streets` reads the tread already written to each
  tile, so a busy verge is walked pale and broad and a busy lane is darkened by
  what runs on it.
- **A world's beasts share a dialect.** Segment, spine and eye biases and the
  chance of a frill, a shell or a glow lean a whole biosphere, with a favoured
  tail and head. Each creature still rolls against it, so a world of shells
  keeps a few bare backs. Earth is untouched.
- **Flats that look lived in.** A block's cutaway was a coloured lozenge with
  one divider line. It is a floor plan now: partitions with doorways, a bed and
  a table in each unit, grey where nobody has moved in, and the household's own
  rug or bookshelf beside it. The floor label no longer writes itself across
  every neighbouring block.

- **A town with a plan of its own.** `125-zoning` divides the ground round a
  town into quarters — civic square, commercial frontage, residential ring, a
  works quarter, the fields — with the direction of each taken from the town's
  architecture and its seed. What it builds comes from what it is short of
  (beds, work, trade), and the place page shows all three demands. A cottage in
  a dense core is bought out for a block, one plot at a time, and a flat's price
  follows the demand for it, so owner-occupancy falls as a city modernises.
  Measured on `causal-origin`: apartment blocks 0 to 13, buy-outs 0 to 14,
  owner-occupancy 0.74 to 0.44, matter conserved at every press.

  **Read this before touching it.** The plan places nothing. `92-townscape`
  already lays a town out — the square, the lanes, a ring target per use, works
  to leeward — and 125 only offers a preference into 92's scoring, deliberately
  weaker than one ring step (92 scores three a ring; the bias tops out under
  one). Two things bit hard when it was stronger. Set as large as a ring step it
  dragged a hall from four tiles out to five, because a sector preference beat
  the ring that makes a hall central; and a use whose quarter here disagreed
  with 92's ring there — a hearth called civic by 125 and industrial by 92 — was
  pulled onto the square and pushed the hall out of its own town. `ZONE_OF_TYPE`
  must agree with 92's `zoneOf`, and anything 92 sites specially (the dock on
  its water, the observatory at the edge) is left out of the table entirely.
  Zoning also plans nothing until a town's hall stands: planning to demand in a
  hamlet filled the middle before the hall was ever sited.

**Still wanted, in the order I would take them:** the two battery seeds that
still do not launch (see problem 4 below, which is now the whole of it); people
inside the blocks in a cutaway — `occupiedRooms` reads 0 because
`personFitsInterior` only lets a resident in when they are resting or tired,
so a daytime cutaway is a furnished but empty building; and the floor plan is
drawn axis-aligned over an isometric footprint, which reads as a section rather
than as part of the scene.

### 4. The battery seeds do not launch, and the reason is now food, not access

Two faults were found and fixed on the way here, and both changed the picture.

**Tools were making matter from nothing.** A tool's head and its binding can be
the same compound, and then it costs four units of it, not two. The guard asked
for two twice over the one slot and the withdrawal took two twice, so a crafter
holding two or three wrapped their own `Uint16Array` and 65,536 units appeared.
Caught at tick 448 on a battery world, two tools in one tick: entity materials
rose by 65,516 while every other ledger moved by tens. Thirty years of that
world now audit at delta zero. **This matters for reading the old numbers:** the
sixteen- and twenty-block downtowns that battery worlds used to raise were built
partly out of matter that should not have existed. With conservation honest,
those worlds are poorer, and they raise a downtown later or not at all. Do not
compare a post-fix run against a pre-fix one and call it a regression.

**People carried their food and starved on it.** Foraging puts food straight in
the gut; gathering puts it in a pocket, and nothing ever moved it between them.
Measured on battery `causal-origin`: Flinthollow, twenty-five people, three
hundred and nine units in the store, seven farms, twenty-four of the twenty-five
carrying food, eighty-four in a hundred hungry. Fixed in `117-granary-call` by
letting a properly hungry person eat their own pack. After: carrying falls from
24 of 25 to 5 of 28, the store draws down from 309 to 24, and a second town
stands where there was one.

The gate is at hunger 70, not at the hungry mark of 60, and the difference is
load-bearing: at 45 a peckish gatherer ate their haul on the way home and never
stocked the granary, and `diplomacy-smoke` failed because a fixture world that
had always raised two towns raised one. If you move this constant, run the whole
suite, not the city tests.

**What is left is carrying capacity.** Flinthollow holds forty-eight people on
seven farms on a 72x44 map and sits at hunger 0.6 to 1.0 for ten presses before
it dies; the survivors found new towns and do it again. Access is fixed; the
land does not feed that many mouths in one place. The lever is most likely how
many people one town may hold on a small map — `PLACE_PEOPLE_PER_TOWN`, the
urban pull in `108-urban`, and the farm cap — not more relief. Measured runs:
`scripts/continuing-city-probe.cjs causal-origin battery lean 30` and the same
for `ship-c`. Both conserve matter throughout and neither launches.

**A note on measuring here.** The machine is suspended between tool calls, so a
probe launched in the background gets almost no CPU while you wait on a timer.
Run the wait in the foreground — a bounded `while` loop that polls the log —
or the run will still be at press 2 an hour later.

### 5. Where every world actually stops, measured 2026-09-11

No size launches. Every size builds a downtown. Measured post-conservation-fix,
`continuing-city-probe`, lean profile:

| size | seed | outcome |
|---|---|---|
| battery 72x44 | causal-origin | 18 blocks, no ship, 15 people by y371 |
| battery 72x44 | ship-c | 14 blocks + 5 apartments, no ship, 8 people |
| phone 96x58 | causal-origin | 16 blocks, no ship, 16 people by y301 |
| small 120x72 | causal-origin | 15 blocks + 16 apartments, collapses y184 |
| small 120x72 | ship-b | **19 blocks by y182, shortfall down to two** |
| small 120x72 | ship-c | 153 to 62 people, no blocks |

**The gates oscillate, and that is the whole failure.** `ship-b` on small is the
closest anything has come. At press 18 its shortfall was *19 tower blocks, a
paved road*; at press 19 it had built the nineteen blocks and its shortfall was
*2 cities at the urban stage, a paved road*. It has met every condition at some
point and never all at once, because building the skyline costs the city that
builds it enough people to drop back below the urban stage.

**Do not "fix" this by latching the gate.** 114 already latches which milestones
have been *reported* (`causalReached`, so a stage reached twice is not news
twice), and that is as far as latching should go. `modernShortfall` is a live
check on purpose: a starship wants a living industrial society at the moment it
leaves, and a latched gate would let a dying world of eleven people launch one.
The society has to actually hold together. That is a balance problem.

**What the balance problem is.** On `ship-b` small at press 10 the world births
170 and the recorded deaths are 50, while the population falls from 112 to 70 —
so the real deaths are nearer 210 and most are never written to
`historicalIdentities`, which only keeps the notable. Do not measure mortality
from that store; take the population before and after the press. The churn is
enormous: a world of a hundred people births and buries two hundred in thirteen
years. Among recorded deaths the largest cause is `accumulated repair failure`
(old age), not starvation and not war, and towns are lost while well fed —
Zephyrhollow was ruined holding 294 of food for two people.

Two experiments are already on the reverted list (see problem 1): feeding every
lean town, and `HASTE_FOOD` at four times `LEAN_FOOD`. Both made it worse. The
untried lever is the other end — how many people one town may hold on a given
map (`PLACE_PEOPLE_PER_TOWN`, the urban pull in 108, the farm cap in 109) —
rather than more relief.

### 6. A third conservation leak, small and diffuse (open)

`causal-origin` small, press 16, **tick 47671**, delta **-4**. Nothing like the
first two: the buckets move together — reservoirs +533, tile chemistry -882,
rare records -18, entities +363 — and the only rare record that loses anything
unmatched is `950:17` (a rare species, -16, no column). The 902:2 record loses 2
and its column gains 2, which is correct. A leak of four units against flows of
hundreds reads as a rounding error in whatever moved that water, not as a
structural fault. `matter-leak-probe causal-origin small lean 15 17` reproduces
it and prints the bucket movement.

### 7. The road to a launch, as far as it got (2026-09-11)

Four faults were found and fixed in a row, each one uncovering the next. The
order matters, because each looked like the whole problem until it was measured.

**A town's population was whoever stood near it.** `settlementPopulation`
counted anyone within seven tiles of the centre — a snapshot of the square, not
a population. Willowwatch read 22 people at one press, 12 at the next, 11 at
the one after, while the number who actually *lived* there went 40, 42, 42.
Eighty-three call sites read that number, including `cityStage`, so the launch
site flickered in and out of being a city between presses and could never hold
its stage long enough to fly. It now counts the people who live there wherever
they are standing, plus anyone nearby who lives nowhere else. A camp, which has
no residents yet, reads exactly as before.

**A world would not let a town grow into a city.** It allowed one place per
fourteen people; spread evenly that is towns of fourteen, and the modern stage
wants cities of whatever `urbanGate` calls urban — twenty-two on a small map.
The divisor is now whichever is larger. Towns went from eight to six and from
almost none above eighteen to one or two at nineteen to thirty.

**The city starves, and the young die first.** Collected a year at a time —
the event log prunes at 4,200 and `historicalIdentities` keeps only the notable,
so it recorded one death in four — the largest cause is `chemical energy
depletion` at nine, thirteen, sixteen, nineteen, twenty-six and thirty-one years
old. Old age is the other half, at seventy-five to ninety, as it should be.

**But the world is not short of food.** Over the same forty years Mosshollow
went 61 to 24 people at hunger 0.76 rising to 0.92, while Willowwatch
thirty-seven tiles off sat on a food score of 817 to 895 with nobody hungry.
That is why the farms-per-head curve is flat (see `carrying-probe`): production
was never the binding thing. Two reasons it could not move, both fixed: a store
counted as feeding a town at a flat twelve units however many mouths it had,
and food could not cross a flag — at year 114 the world had fragmented into
seven towns under six flags and every fed town in reach belonged to somebody
else. Merely hungry, a man keeps to his own people; starving (hunger 80), he
goes where the food is, and a town at war with him is still closed.

**What is left is the ground.** A town's food score is dominated by forage on
the tiles around it, not by its farms or its stores. Willowwatch is rich because
its ground is; Mosshollow is poor because sixty people stripped theirs over
forty years and it does not grow back fast enough. Neither farms nor the granary
call bridges that, and it is the honest next question.

**The stage list and the ship disagreed about *where*.** `starflight` was done
when any town knew the craft and `tower` when any town had one, while
`launchShip` wants both in the one place it leaves from. A village learns the
craft, another raises the tower, both stages report done, and the city that must
fly has neither — measured, the site held `tower=0 sf=false` while the world
announced both. Both stages are now judged at `modernLaunchSite()`.

**Two counters to distrust.** `GRANARY_CALL.arrivals` was declared and never
written to, so it read zero however far anyone walked; ninety-six thousand steps
against zero arrivals reads as a broken mechanism and was taken for one before
being checked. It is wired up now. And `grep -c '"ok": false'` exits 1 when it
finds nothing, so `echo "... $?"` after it reports a failure on a clean suite.

**Probes added this pass**, all read-only: `city-killer-probe` (deaths by cause
and age, a year at a time, beside each town's food and hunger),
`hunger-call-probe` (asks `granaryCallPlace` why it refuses, per person, with
every town's distance, flag and hostility), `carrying-probe` (hunger against
fields per head, bucketed across every town in the world), `city-death-probe`,
and `modernLaunchBlockers` on the modern debug surface, which names which of
`launchShip`'s five conditions refused instead of returning a bare null.

**Where it stands.** A world now holds a stable city, clears every condition of
the modern stage — shortfall empty for three presses running — completes its
launch tower and understands Starflight. No ship has left yet. The last
measured run collapses around year 130 from the starvation above, which is the
remaining thing between here and a launch.

### 8. A ship leaves (2026-09-12)

`causal-origin`, small, lean, `scripts/food-launch-probe.cjs`:

    p18  y110  176 people  22 blocks  4 works   a completed Launch tower
    p19  y113  174 people  22 blocks  4 works   Starflight
    p20  y113  174 people  22 blocks  4 works   THE FIRST SHIP AWAY

A living world behind it: 174 people, **every one of them living in a town**,
twenty-two tower blocks, eight apartment blocks, four factories, and matter
conserved at every press of the run. The blocker after the launch reads "a ship
already left here this generation", which is the right reason for a city not to
send a second one immediately.

The granary counters, which used to read zero, now read like a working society:
1,321 arrivals, 750 topped-up meals, 915 meals out of a pack, 5 taken under
another polity's flag.

**What finally did it**, in the order the faults were found — no single one of
these was enough on its own:

1. A town's population counted who stood near it, not who lived there, so the
   launch site flickered in and out of city stage (problem 7).
2. A world allowed one place per fourteen people and so could never grow a city
   of twenty-two (problem 7).
3. `performFeeding` returned as soon as forage gave anything, so one packet off
   stripped ground suppressed eighteen in the granary the eater stood on.
4. A starving visitor could be called across a border and then refused the meal.
5. A supplied project kept its old work priority, so a stocked factory stood
   untouched for decades while towers took every builder.
6. `starflight` and `tower` were satisfied by any town in the world while
   `launchShip` wants them at the site; so were the skyline and the factory that
   section 110 asks of the launching city.

**A second world launched**, and not the Earth-modelled one: `variety-5`,
small, lean, at year 125 — eighteen blocks at press 15, its launch tower at
16, Starflight at 17, the ship away at 18, with 143 people all living in towns
and nineteen blocks, ten apartment blocks and four factories standing. Same
shape as the first: the whole modern society, then the ship.

**Not yet general.** Of six worlds measured on this code, two launch:

| size | seed | outcome |
|---|---|---|
| small | causal-origin | **ship away y113**, 174 people |
| small | variety-5 | **ship away y125**, 143 people |
| small | ship-b | 19 blocks by y148, then down to 9 people by y421 |
| small | ship-c | 12 blocks, peak 124 people, down to 53 by y121 |
| phone | causal-origin | 7 blocks, peak 119 people, down to 57 by y119 |
| battery | causal-origin | dies out, "no town at all" by y506 |

The four failures all have the same shape: the world raises a real downtown and
then starves, later than it used to but for the same reason. The ground is the
thing left (problem 7, last paragraph) — a town's food is dominated by forage on
its own tiles, and a town that has stripped them starves whatever its granary
holds. A launch is now a question of whether a world survives long enough, not
of whether it can reach the gate.

## The recent commits, newest first

```
64f45a9  Finish the meal the call started, and give the ship's own city its works
122e6c7  Write down the road to a launch, and the two counters that lied
573cc62  Ask for Starflight and a tower where the ship is, not anywhere in the world
95cadab  Find what kills the city: it starves beside its neighbour's full fields
07c0f80  Count the people who live in a town, not the ones standing in its square
3a12a8a  Never spread a world thinner than the size it calls a city
4c9712f  Measure where every world stops, and say why the gate cannot be latched
fe598d7  Give a town a plan, and let the city buy its cottages out
a03fe36  Furnish the flats: a floor of a block is a floor of homes
db5d3a8  Stop tools making matter, and let a hungry man eat what he is carrying
bc67f98  Let a street show what it carries
6e0bf23  Pave a street worth walking, give a world its own beasts, and send the hungry where the food is
f08f188  Teach the craft to the place that will use it
2c4e3f5  Hold the place the ship leaves from still
b090940  Let the effort send the ship it built
adcf810  Ask a world for what a world its size can hold
f06f3ae  Take the bread back to famine: feeding lean towns starved them
487e0e4  Stop the skip only on news
da29345  Scale that gate by the land, not by the edge
3496214  Scale the people a modern world needs to the map
877adab  Give the ship one place to leave from
81d6b71  Carry bread to a starving town, and finish what is half raised
```

Commit messages here carry the measurement that justified the change, and the
ones that record a reverted experiment are as useful as the rest. Read them
before re-treading ground.

## A note on bisecting a layout change

Zoning cost four rounds of guessing before it was measured, and the measuring
took minutes where the guessing took an hour. When a change to how a town is
laid out breaks a test somewhere else, do not reason about the scores. Put a
`if (true) return 0;` at the top of each effect in turn — the placement bias,
the demand planning, the redevelopment — and run the one failing test. Confirm
first that the test passes with the section unregistered from the manifest, so
you know the section is responsible at all, then bisect. Twice the answer was
the opposite of what the arithmetic suggested: turning the bias off made the
hall *worse*, because the effects interact.

## House style

The README and the code comments are written in a particular voice: plain
words, concrete nouns, the reason before the mechanism. "The road got its stone,
and every town in famine now gets its bread the same way." Match it. Explain in
a comment *why* a thing is the way it is, especially when the reason is a
measurement, and put the number in.
