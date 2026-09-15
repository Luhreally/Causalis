# Handoff

> **Where to start (2026-09-14):** sections 9 and 10 below are current — every
> measured world launches, the tools for reading the closure are in `scripts/`,
> and the open problems are named there. `docs/CITY-CHECKPOINT.md` is the
> September 9 checkpoint that preceded them and is kept as history.

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
- **A misspelled name is not a load error, it is a rule that never runs**, and
  behind `typeof x === "function"` it is a feature that is silently off.
  `scripts/lint-undefined.cjs` parses the composite and resolves every
  reference; it runs inside `npm run test:syntax`, so the fast suite fails on
  one. The day it was added it found two (a robber's kin check calling `isKin`,
  which never existed; an export line calling `worldAgeName`).

Three tools for reading the closure, all in `scripts/`:

- `node scripts/who-overrides.cjs <name>` prints a function's chain in manifest
  order — where it is declared, every `...Base` capture, every reassignment,
  and whether each reassignment calls a base or **REPLACES** everything before
  it. `--most` lists the deepest chains (`eventSentence` has 48 layers,
  `simTick` 31), `--dead` every reassignment that calls no base.
- `node scripts/linemap.cjs 75379` says which section and line a composite
  line is; pipe a stack trace through it to rewrite every frame. The test
  harness does this itself now: an uncaught error in any smoke test prints
  `section.js:line (index.inline.js:N)`.
- `scripts/lint-undefined.cjs --all` also lists the browser and language
  globals the runtime reads, which is the allowlist to extend if a new API
  is used.

**Matter leaves a tile and lands on one through two functions** in 13,
`takeTileMatter(tile, species, amount)` and `giveTileMatter(tile, species,
amount)`; both return what actually moved. They own the rule that a Uint16
column never wraps, that an excess past the cap goes on the overflow record
rather than being clamped away, and that a full column's record is drawn
first. Do not write `W.tiles.chem[sp][tile] -=` or `+=` in new code — the only
direct writes left are three snapshot restores after a birth.

The material society, once one file of five thousand lines (`30a`), is six
sections `30a`–`30f` (places, cognition, work, labour, production,
technology); the spatial rendering (`32d`, three thousand three hundred lines)
is six sections `32d`–`32i` (figures, architecture, interiors, the town,
conflict, the scene). Both were split along their own seams with the composed
runtime unchanged (`$SCRATCH/split-section.py` with a JSON of seams does it
and asserts byte identity).

`node scripts/who-overrides.cjs --dead` lists 47 reassignments that call no
captured base. Read them as *replacements*, not bugs: `counterRand` and
`hashParts` in 70 are bit-identical rewrites for speed; 96 replaces the path
search; 44 replaces desktop panels for the phone; 123 replaces the tower and
car drawers; `updateTechnology` (30f, twice), `updateSettlements` (30e),
`createCamp`/`createSettlement` (30a) and `updateCultivatedField(s)` (86) are
later rewrites that superseded earlier bodies in the same or an earlier file.
What is left behind each of those is the earlier body, now unreachable unless
some section captured it before the replacement — which is why nothing has
been deleted: a capture can keep an old body alive. Before deleting one, grep
for `= <name>;` captures above the replacing line.

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

The expected count is the number of `"ok": true` lines, currently **100**. It
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

Measured end to end: see **section 9** (every measured world launches; the
table there is the current one) and **section 10** (what follows the ship, on
battery and phone). The table that stood here — standard not yet measured,
battery dying by year 506 — was true on 2026-09-11 and is not any more.

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

### 9. Every measured world launches: battery at year 67, phone at 59, small at 64 (2026-09-14)

Measured with `scripts/food-launch-probe.cjs`, matter conserved at every press:

    causal-origin  small    p16 y62  a completed Launch tower   p17 y63 Starflight
                            p19 y72  16 tower blocks             p20 y72 THE FIRST SHIP AWAY
                            206 people, 16 blocks, 9 apartment blocks, 4 factories

    causal-origin  battery  p12 y61  16 tower blocks (2 cities and current still short)
                            p16 y67  a completed Launch tower, Starflight
                            p18 y67  THE FIRST SHIP AWAY — 61 people, 16 blocks, 6 apartment blocks, 2 factories

    causal-origin  phone    p16 y57  16 tower blocks   p17 y59 a completed Launch tower
                            p18 y59  Starflight        p19 y59 THE FIRST SHIP AWAY — 141 people, 17 blocks

    causal-origin  small    p16 y60  Starflight and the tower   p18 y64 16 tower blocks
                            p19 y64  THE FIRST SHIP AWAY — 192 people, 16 blocks, 6 apartment blocks

Those are the final figures on the last commit of this pass. The small world
launched at year 113 in section 8; the battery world had never held a city
past year 130; the phone world had never launched. On the way the same seed
launched at 115 on battery and 93 on small (the push memory, below, before the
siting fix), and the small first-ship figures in the earlier drafts of this
section — 72, then 93 — were the same code a commit or two apart: the year a
world launches moves by twenty either way between commits that change nothing
about its mechanism, because every change to any town's plan moves every
roll after it. Read a launch year as "launches" and a difference of a decade
as noise. What follows is what was found on the way, in the order it was
found, because the order is the point: nothing here was visible until the
thing before it was fixed.

**The objective was serial, and the buildings waited on the studies.** The
skip works one stage at a time in the order of the ages. On battery the
objective sat on Planetary Stewardship from year 88 to 126 — thirty-two
research pushes in the last eight years — while both cities knew electricity,
machines and masonry and held tower blocks at stage one, "needs 28 timber",
"needs 24 metal", for fifteen years. Nothing pushed them because the skyline
was not the objective. Section 127 raises the towers, blocks, works and road
in every city that knows the crafts beside whatever the objective is, and
studies the ship's groundwork at the launch site beside every building stage.
(`scripts/skyline-probe.cjs` shows the objective, the pushes and every
delivery a year at a time; `scripts/research-probe.cjs` shows, for a craft,
the step each town is on, its facility, its samples and its notes.)

**Rare inputs never reached the face.** Cloudwatch's archive read "needs 4
pigment" for nine years while the push fed the store four at a time: the
research reserve, the sample borrowing and the spill between them kept the
four from the site, and Governance waits on the archive, Stewardship on
Governance. From the third push a rare input is placed at the work face like a
common one (127).

**The floor of forty.** `sustainableSexualCapacity` is tiles × density × food
× crafts with a floor of forty; on 72 × 44 the product is twenty-five times
those factors, so the floor always won, and the world sat at 31–40 people
with births rationed above 31 and, by year 120, twenty-two adults in
thirty-three past the fertile window. It never starved; it aged out. The
floor now follows the fields — two people a finished farm over forty — and
is not lifted while more than a quarter of the townspeople are hungry (127).

**The crafts lift starves the world instead.** With waterworks, sanitation and
machines the formula's own lift took battery to a capacity of 94 and the world
to 89 people on ten fields that had fed 55 with nobody hungry; a quarter were
hungry by year 62 and all of them by 69. Conception waits on a quiet belly
(23), but the fed majority kept a starving world growing. While more than a
quarter of the townspeople are hungry the capacity now sits just under the
people there are (127). The world no longer crashes from 108 to 24; it holds
60–70. It still cannot feed a city of fifty on this map — see the end.

**Irrigation drank its shore dry.** With a reach of twelve, ten fields drew
two to five thousand a year from a shore holding 4,500 to spare; it was empty
by year 59 and the ground under the fields fell from moisture 30 to 12 by
67, harvests from fifteen a year to one, with the lake holding a million and a
half. Rain refills a tile at about fifty a year; a shore of a few hundred tiles
keeps ten fields, a few dozen does not. The reach is twenty-four (126).

**A full city has no plot for its launch tower.** This is why section 8's
world had *stopped* launching before this pass began (the L5 run on that code:
horizon at y98 and y122, a halving at y138). Starflight is studied at a launch
tower, the townscape sites one "at the edge" — ring outer+2, searched to
twelve tiles, every third row and column a lane, every tile within one of a
building refused — and Mosshollow at year 73 held 68 buildings, 26 of them
tool workshops. Two hundred and thirty-six candidate tiles, none clear; the
base siting found nothing either; the site's notes stood at 85.5 of 90 for
seventy years because the push plans the facility a study wants and was handed
an empty plan every time. Section 128 seeks a plot ring by ring beyond the
town's reach, lanes and all, when both sitings give up on an edge building
(`scripts/siting-probe.cjs` counts what refused each tile).

**Twenty-six workshops.** The zoning's industry demand adds 0.12 for every
site waiting on material, uncapped; an effort that plans eight towers at once
and supplies them a year later made the demand 1 for a year, and the answer to
industry demand was a workshop every time. The waiting term is capped at
three sites, a town has works enough at a workshop for every sixteen people
and a factory for every twenty-four, and past that the answer is nothing (125).

**A third conservation leak, found and closed.** −640 at tick 18847 on
battery. A common compound's overflow record in `rareChem` can stand under a
column that is no longer saturated, because extraction, growth and diffusion
write the column directly and `tileMatterAmount` reads the column alone while
it is under the cap. A caller that sets what it read plus a little past the
cap had never seen the record, and `setTileMatterAmount` wrote the overflow
over it: a nutrient tile at 65,532 with 641 on record was set to 65,536 and
kept 1. What the caller could not have read now stays (13). The camp-abandon
deposit clamped a record at 65,535 with `u16`; it adds now (25). The −3151 the
old code showed on small at year 145 was the same fault. The diffuse ±4 drift
of section 6 was not seen on any run of this pass.

**The site held an emptied city.** 114 holds the launch site until another
town is strictly better on its merits, and size is not one. Battery's site was
Kinhollow at nineteen people; by year 101 it held five, Willowwatch forty, and
Kinhollow's groundwork outscored Willowwatch's population. Being populous
enough for the gate is now a merit — more than groundwork and order, less than
a tower or the craft — so an emptied city yields and a town with the tower is
held whatever the other's size (127). On battery the site moved to Needlespire
at year 92 and the tower and Starflight followed within two years.

**Five hamlets of sixty-six.** A world founds a place for every fourteen
people and a town of twenty-four sends settlers; the city that held the site
went from 62 to 7 while the hamlets it seeded held their people half to all
hungry. Once the modern stages are sought the concerted effort founds no new
place (127).

**The urban stage was unscaled.** `settlementDevelopmentStage` called a town
urban at a hard twenty-four while 84's `metropolitan()` scales the gate with
the map (ten on battery), so battery could never hold two urban cities. It
asks `metropolitan()` now (30a).

**The effort forgot how long it had worked.** What stopped the battery world
on the run before last: from year 94 the site knew Starflight and kept
discovering a branch craft a press — Global Networks, Advanced Composites,
Thinking Machines, Materials Science, Deep Theory I–III — and every discovery
is a milestone that stops the press. A press releases its objective when it
ends and the next began the same objective at zero pushes, while a work face
is stocked only from the third, so the towers got a year of material per
press; seven blocks stood at seven from year 107 to 121 and the world starved
at 134. The count of pushes an objective has had is kept on the world by its
key and restored when the same objective is taken up again (127). With that,
the skyline went from seven blocks at year 76 to fourteen at 85 and the ship
left at 115.

**A full city had no plot for its blocks, and the plots it had could not be
walked to.** What stopped the phone world on the run before last, and slowed
every other. Lakeford at year fifty-six held eighty-eight buildings; two
hundred and fifty of the two hundred and fifty-two tiles the townscape
considered for a tower block were built on, so the effort's push planned
nothing there for fifty years, and the second city, with the crafts and
thirty people, never got a block either. And the two blocks that were
planned stood stocked at stage two with fifteen hands assigned and none
within a tile and a half of the face — every one "moving to the Tower block
work face", seven tiles off and stuck — because their plots lay past ground a
walker cannot cross: a builder walks one greedy step at a time round standing
buildings and never over a cliff (96). The open-ground siting (128) now
serves the tower, office, apartment block and factory as it serves the edge
buildings, and a plot is only a plot if the hall can reach it: the ground a
walker can reach from the hall is flooded once a tick per town, stepping the
way a walker steps, and both the townscape's plot and the open ground are
held to it. `scripts/hands-probe.cjs` reads, for every unfinished block at
the launch site, each assigned hand's task, phase, distance and stuck count.
With that the battery world's skyline went from seven blocks at year 76 to
sixteen at 61, and the ship left at 67 instead of 115.

**What is still thin on the battery world.** The towns are lean: the site held
47–72 people and the world sent its ship with 61, down from 76 at year 61;
Flinthollow with ten to twelve irrigated fields fed 55 with nobody hungry. The
famine brake stops births but does not feed the living, and 42d already
sends every fit hand to the fields every other labour tick, so the next thing
to measure, if a battery world is to hold past its ship, is why a lean city's
fallow fields go unsown (the field-yield probe showed sown 0–1 a year at
Flinthollow from year 61 to 65 with 200–600 organic in store).

Two counters to distrust, added to the list in section 7: `born` in
`scripts/city-killer-probe.cjs` counted every BirthEvent, animals included,
until this pass (it counts people now); and the `floor` the field-yield probe
prints reads 40 whenever the hungry share is over a quarter, which on a lean
world is most of the time.

**The six worlds of section 8, re-measured on this code** (`food-launch-probe`,
lean, matter conserved at every press of every run):

| size | seed | section 8 | now |
|---|---|---|---|
| small | causal-origin | ship away y113 | **ship away y64**, 192 people, 16 blocks |
| small | variety-5 | ship away y125 | **ship away y59**, 164 people, 18 blocks |
| small | ship-b | 19 blocks by y148, 9 people by y421 | **ship away y85**, 180 people, 21 blocks |
| small | ship-c | 12 blocks, 53 people by y121 | **ship away y122**, 89 people, 19 blocks |
| phone | causal-origin | 7 blocks, 57 people by y119 | **ship away y59**, 141 people, 17 blocks |
| battery | causal-origin | no town at all by y506 | **ship away y67**, 61 people, 16 blocks |

Six of six, every run with matter conserved at every press. The years are
those of the final code; a run on the code a commit earlier launched the same
seeds a decade or three later or earlier, as said above.

### 10. Past the ship, and what the world beneath it does (2026-09-14, battery and phone only)

Everything below is on `battery` and `phone`, lean — the profiles the game is
played on. Nothing here was measured on standard or larger.

**The arc past the ship works, mechanically.** `scripts/arc-probe.cjs` presses
on after the launch. Battery causal-origin: ship at year 67, bound for a star
23.5 light-years off; the voyage takes 47 years, and every press meanwhile
stops on a branch craft (Cold Stores, Hydroponics, Antibiotics, Global
Networks … Deep Theory III — sixteen presses to reach the colony, each with
something to show); the colony is founded at year 114 and the world's stage
turns interstellar; the colony grows to 349, founds daughters, and sends its
own ship onward at year 284. Phone: ship at 59, colony due at 106. Two things
did not happen. No colony declared independence in two hundred years: the
rule wants nine-tenths of the world's capacity held for sixty years fifteen
light-years out, with a chance in twenty a year, and hardships keep knocking
the population under the nine-tenths. And **the home world dies behind the
ship**: battery went from 46 people at the launch to 18 by year 130 and no
town at all by 154, four-fifths hungry on the way down. The epilogue (91)
records exactly that. Whether a world *should* survive its own ascent is a
design question the code does not answer yet; the mechanism is the lean-town
one below.

**The skip says what stops it (129).** The line a press ends on now carries
a reason a player can act on, read from the world without writing it: "16
tower blocks or offices (0 of 18 standing, 1 rising; the furthest along, at
Kwots Baerou, stocked, nobody is working on it)", "complete a Launch tower
(none is planned at X, which usually means no plot is free)", "20 people
living in towns (Needlespire is 7 in 10 hungry)", "develop Starflight (X is on
Computing, 0 of 78 notes, and has no archive to study it at)". It shows in the
world pane's progression card too, so nothing in it may write: the launch site
is read from the held id, not chosen.

**A launch is guarded in under a minute.** `tests/fixtures/launch-battery.json.gz`
is causal-origin battery lean archived at press 16 (year 66, the launch tower
just complete; 8.9 MB of archive, 1.1 MB gzipped), made by
`scripts/make-launch-fixture.cjs` through the game's own `snapshot()`.
`tests/launch-smoke.cjs` loads it the way the game loads a save — hash
checked — and presses: Starflight on the first press, the first ship away on
the second, matter conserved. It is in `test:fast`. When the launch chain
breaks again, this is what notices.

**Fields wanted a full seed.** `sowCultivatedField` refused unless the store
held one organic for every tile of the field; a lean town's store sits at the
granary's floor and the effort's ration is eaten within the season, so on
battery two hundred sowings a year were refused with twenty-four in the store
and seven to eleven fields fallow for up to six years (`scripts/sowing-probe.cjs`
counts what happens to every hand that reaches a field). A third of the tiles
seeded is a sowing now, and the transfer takes what the store has. Measured:
sowings went from 0–4 a year to 6–10, harvests to 224 a year, fields growing
7–10 of 10. Hunger at Flinthollow still ran 0.13–0.5: the fields are worked
now, and the town is still lean — that is the open problem, not the sowing.

**The granary counts seven tiles, and widening it collapsed the world.** 82's
`granaryResidents` is the town's people within seven tiles of the hall; a city
of 62 counted 3 to 8, and the hungry share, the birth brake, the famine
outlook and the call to the granary all read that handful. A section that
counted the whole town, the way `settlementPopulation` does, was measured and
**withdrawn**: the people far from the hall are the hungry ones (out at the
fields and the hunt), the share read 0.44 from year 33, every brake fired at
once, and the battery world never built a block. The seven-tile count is a
bias that happens to hold the world together. Any future change to it must be
measured on battery first; the sowing-probe and food-launch runs are the
measurement.

**Performance, measured for the first time.** `scripts/perf-probe.cjs` loads
the launch fixture and times ticks; `scripts/perf-summary.cjs` reads the V8
profile back by section and function. Battery at year 66 with 48 people runs
at **12.8 ms a tick** on the development machine, with three ticks of the 512
at 100–357 ms: those are `worldHash()`, which walks every array and every
event's text once a year and costs ~300 ms — 17 percent of all sampled time
in `feed`, `walk` and `hashString`. Behaviour and cognition (21, 30b, 62) are
the next 25 percent; `nearbyIds` alone is 7. The hash algorithm is written
into every save's integrity check, so it cannot be changed without a save
migration; hashing the event log by id rather than by text would remove most
of the stall and is the one clear candidate. There is no other quick win.

The full run of every seed and size above the phone is deliberately not
re-measured in this pass.

### 11. Why the home world dies behind the ship, and which levers cost the ship (2026-09-14, battery and phone only)

Measured with the probes under `scripts/` named below; every number is battery
72×44 lean unless it says phone. The launch guard (`test:launch`) held on both
fixtures through every change here.

**Almost nobody is born on a battery world, before the ship or after.**
`scripts/births-probe.cjs` wraps every road a person enters the world by. At
sixty to eighty people the coupling loop (76) bore nought to three children a
year; what read as growth was section 40's *wild kindling* — a band of eight
new founders every dozen years or so (`ensureParallelPeoples`), adopted by the
nearest town within fourteen tiles (86). Two births a year is replacement level
for sixty people who live seventy-five years, so the world holds until, behind
the ship, the founding cohort ages out together and nothing replaces it.
`scripts/houses-probe.cjs` reads the whole fertile generation a year at a time:
who is partnered and to whom (alive, corpse, gone), the first clause of
`canReproduce` that refuses each, and why the ready ones still did not couple.
Post-ship: forty in the fertile window, twenty to thirty refused by *hunger*,
eight to thirty-six by the tile-count *density* cap, and of the eight or so who
passed, most had nobody to lie with — a partner beyond the loop's four tiles, a
partner dead and never mourned (two or three every year), or nobody fertile
within two tiles.

**Hunger sits at fifty-five to seventy-five for life, by construction.**
Hunger is a hundred less a fifth of stored energy (10); a townsperson labours
until it passes sixty-eight (30d) and then takes one serving of eighteen (117),
which digests to a few points. `scripts/hunger-probe.cjs` histograms a town's
adults: on a fed year-thirty-five world a third sat between sixty and eighty
and none above; behind the ship a third sat above eighty. Every "hungry" bar at
sixty — `hungryShare` (82), `CONCEPTION_HUNGER` (23) — read half of a fed town
as hungry and the town as "lean" a quarter of the time. Both now stand at
seventy, the line the labour gate and the carried meal already use
(`GRANARY_HUNGRY`). The farm-labour fitness gate (42d) stood at fifty-six, so
almost nobody was ever fit to sow or reap; it stands at sixty-eight like every
other labour. `scripts/farmwatch-probe.cjs` had shown Zephyrford's seventh
field planned and unbuilt for eight years and ten to seventeen of twenty-six
fields fallow with seed in the store.

**A city's rations reached eight tiles; its people lived at twenty (133).**
`scripts/rations-probe.cjs` maps a town's people by distance from the hall.
Zephyrford: thirty-eight people, twenty-seven of them twelve to twenty tiles
out in the edge blocks, hunger seventy-two to ninety-eight, the store holding
a hundred and forty to three hundred and sixty-six; those within eight tiles of
Stonespire's hall ate there and drained it, and Stonespire's twenty went hungry
two years in three beside an empty store. `hearthReach(town)` is two tiles past
the farthest finished building, clamped eight to twenty-four, and
`homeRationPlace` feeds a resident anywhere within it. The same probe showed
`granaryResidents` (seven tiles) counting six of thirty-eight, so the hub read
"fed" and kept calling villagers in; counting residents within the reach makes
the reading honest and was measured (below) to cost the ship — it is not
shipped. `scripts/inflow-probe.cjs` showed where the hub's growth came from:
eight strangers at once, the kindled band, adopted in a famine.

**The soil is exhausted, and the goodness is in the streets.**
`scripts/soil-probe.cjs`: at year thirty a field tile held six hundred and
sixty nutrient; at a hundred, Zephyrford's fields held two hundred and eighty
and its streets eight hundred and fifty, Stonespire's three hundred and sixty
against a thousand. Fertility is a tenth of the nutrient (07) and plants grow
only above ten (19): both towns' fields sat at ten, six farms fed thirty-five
people nothing. Farming carries the nutrient into the granary, through the
people, and out where they stand. A muck section (nutrient and waste carted
from the richest town tiles back to the poorest fields, matter-conserving)
restored the fields to a fertility of thirty-five in two years and doubled the
harvest — and cost the ship on both seeds measured, because drawing on the
town's own ground strips the forage its people actually live on; the
bare-ground-only version did too. Withdrawn, with the finding kept here.

**What was shipped, and what was measured and withdrawn.** Every candidate
was A/B'd on the launch road with `scripts/food-balance-probe.cjs <seed>
battery lean 26`, which reports per press the people, farms, harvest, hungry
share, births and deaths, and takes `OFF=reach,hinter,adopt,mourn` to turn a
later section back to its captured base on the same seed. The simulation is
chaotic, so single seeds move launch years by ±20; what was judged is
"launches on all three seeds" and the post-ship count.

| set on causal-origin / ship-b / ship-c | launch year | notes |
| --- | --- | --- |
| hungry line 70, farm gate 68, mourning (base of this batch) | 63 / — / — | post-ship 47→80 people by y109, 2 ships |
| + rations by reach (133) | 74 / 120 / — | post-ship 48→63, 4 ships on causal-origin |
| + fields past the seventh tile, no strangers in a famine (135) | **58 / 90 / 67** | shipped set; ship-c 71 people at y113 with 2 ships |
| shipped set + partners lie together at home at night | 102 / none by 143 / 65 | withdrawn |
| shipped set + the single of a town court every sixteen ticks | 89 / 144 / 77 | withdrawn |
| shipped set + honest `granaryResidents` within reach | none by 290 / 97 / 69 | withdrawn |
| + a fed town below 6 + 4/farm bypasses the density cap | 85 / — / — | world to 127 people; withdrawn |
| + a full meal of three servings at home | none by 187 / — / — | drains the ORGANIC the blocks draw; ate the seed corn before it spared it |
| + muck, living or bare ground | none / none / — | strips forage |
| + widening the cottage belt with the field ring | none by 305 / — / — | sprawl; farms and pasture only now |

The withdrawn levers all did what they were meant to — more children, fuller
bellies, richer fields, wider towns — and each one grew the world before the
ship faster than the effort could carry it; the launch road is the tightest
constraint in the game and anything that adds mouths or draws on the store
before year seventy costs it. The things that helped fed the people the world
already had (the reach), stopped refusing the fed as hungry (the seventy
line), and let hands work (the gate).

**The sweeps, on the shipped set (8f8e661), eleven seeds each, 26 presses.**
Battery launches 8 of 11: causal-origin y58 (78 people at the launch), ship-b
90 (74), ship-c 67 (81), variety-2 90 (63), variety-5 89 (74), variety-6 115
(81), variety-7 113 (56), variety-8 113 (76); variety-1, -3 and -4 collapse.
The same code with the new sections turned off (`OFF=reach,hinter,adopt,mourn`)
launches 6 of 11 (causal-origin 87, ship-c 73, variety-5 80, variety-6 154,
variety-7 106, variety-8 78), so the sections earn two launches and four
earlier ones on the same code. Against a0624e3 (9 of 11: causal-origin 75,
ship-b 138, ship-c 93, variety-1 133, variety-2 82, variety-4 131, variety-5
93, variety-7 86, variety-8 82) the count is one lower and five seeds launch
earlier, five later — the chaos band — while the worlds at the launch are
larger and fed (56–81 people at hungry 0–0.1, against 40–65). Phone launches 7
of 11: causal-origin 91 (134 people), variety-1 90, variety-2 78, variety-4 84,
variety-5 57, variety-6 149, variety-7 96; ship-b sits at 115 people without a
ship at y119, ship-c and variety-3 collapse, and variety-8 stopped the probe at
press 10 on a **matter drift of 80** (below). a0624e3 launched 9 of 11 on phone.

**Behind the ship, on the shipped set** (`scripts/arc-probe.cjs`): ship-b
holds 55–81 people for eighty-five years after its launch at y90 (81 at y103,
70 at y157) before famine takes it at y166–177; ship-c holds 71–78 for sixty
years after y67 and falls from y130; causal-origin falls from 78 at y58 to 38
by y98. Longer than before on two seeds of three; not survival.

**A matter drift to chase (§6).** phone variety-8, year 71, ticks 18275–18297:
`scripts/matter-leak-probe.cjs variety-8 phone lean 10 11` shows the drift
arriving in steps of 8 and 16 with no events in the tick, each step a
rare-species record on an open tile near Mung-ngengua moving without a
matching gain — "Durcaeyl" (species 17, record only, column null) down 16
twice, and at tile 2265 species 3's record going 8→0 while its column went
65535→65519. The overflow-record and rare-record paths of 13 are where to
look; none of this batch's sections touches tile matter.

**Still open.** The home world still declines behind the ship: the founders
age out together, the fields are exhausted by then (the soil probe's numbers
above), and the pushes go to the crafts and the colony. The honest levers —
soil renewal that does not touch the forage, a post-ship push that plants and
sows, courtship that costs nothing before the ship — are the next work, and
the probes to judge them are under `scripts/` now. Judge any of them the way
this batch was judged: `food-balance-probe` with the change switched off on the
same seed, then the eleven-seed sweep on battery and phone, launches counted,
not years.

### 12. Behind the ship, a leak, and an island world (2026-09-14, later; battery and phone only)

Three follow-ups to §11, each measured before it was kept.

**The withdrawn levers run behind the ship, and not before (132, 133, 134).**
Every lever of §11 that grew the world before year seventy cost the ship, so
they run once a ship has left (`shipHasLeft`, read by all three sections):
partners at home lying together at night within eight tiles, the single of a
town courting, a fed town under the count of its fields passing the tile-count
capacity, the granary counting its residents within the town's reach, and the
muck of the town's bare ground going back to its exhausted fields (134,
recreated with the bare-ground rule). `scripts/postship-probe.cjs` on the
battery fixture: field fertility from twenty to thirty-five in two years,
courtships and room passes in the hundreds, births from nought to four a year
where there had been nought to one. And the seed corn is not a meal: the meal
at home took the store to nothing, and a famine town that has eaten its seed
lies fallow into the next famine (Zephyrford's store at nought for eight years
with three of six fields fallow); a store at or under its seed reserve feeds
nobody at home (133). `scripts/arc-probe.cjs` on three battery seeds with the
gated set showed the same post-ship trajectory as without it — the decline is
food, not births: fields exhausted, hands too hungry to labour, a seventh
field wanting sixteen of water for eight years — so the gated levers are kept
for what they do and not credited with survival.

**The matter drift was in the tile setter (13).** `setTileMatterAmount` kept
a rule for the caller who read a column under its cap, never saw the overflow
record, and set the column plus a little: the record folded back. At the cap
the caller had read column and record together and set the total, and folding
the record back made the units it consumed out of nothing. Found in three
steps, each a probe now under `scripts/`: `leak-who-probe` (which species'
world total moved and who gained it — herbivores, sixteen of a record-only
species at a time), `leak-net-probe` (each entity's total against the tiles
round it — the people "collecting by hand" gaining eight their tile never lost)
and `leak-trace-probe` (every helper call on the species with the record
before and after and the section frames above it — fibre curing on a saturated
organic tile with eight on record: 65,543 less eight set, eight kept). The
record is spent first when the column was at the cap; the cohort test asserts
it. phone variety-8 runs to year 99 at drift nought where it drifted eighty at
year 75.

**An island world lays no roads (136).** Phone ship-b stood from year 105 to
119 a single requirement short of its ship — "a paved road or rail between two
towns" — with a hundred and fifteen people, fed, a polity of three towns that
knew the craft twenty-two to forty-nine tiles apart, and not one road link in
the world: `scripts/road-probe.cjs` showed the pathfinder finding no land
between any two of them. When no land joins two towns the link takes the sea
road (59): paving already skips deep water and counts it as bridged, so the
shore tiles are paved and the crossing is left to the boats; the link and its
chronicle say so. Phone ship-b launches at year 79 over four ferried roads.

**The seed guard before the ship cost a launch, and was gated too.** Measured
with the probe's `OFF=seed` switch on battery causal-origin: the world that
launches at year 58 with the guard off did not launch with it on (forty people
at year 110). Before the ship the village stores sit under the reserve half the
time and nobody ate at home. It runs behind the ship like the rest. The ferry
had no effect on that seed's road before the ship (`OFF=ferry`: year 58 either
way).

**Sweeps on the final code (e6b4108), eleven seeds, 26 presses.** Battery
launches **9 of 11**: causal-origin y58 (78 people), ship-b 90 (75), ship-c 67
(81), variety-2 90 (63), variety-3 76 (62), variety-5 89 (74), variety-6 115
(82), variety-7 113 (56), variety-8 113 (76); variety-1 and -4 collapse. That
is the shipped set of §11 plus variety-3 (up from 8 of 11; a0624e3 had 9 of
11), and the years and counts are the same seed for seed, because everything
in this round runs behind the ship or fixes a rare tile. Phone launches **8 of
11**: causal-origin y88 (133), ship-b 65 (135), variety-1 76 (130), variety-3
90 (58), variety-4 97 (87), variety-5 64 (146), variety-7 78 (131), variety-8
71 (132); ship-c, variety-2 and variety-6 collapse. Up from 7 of 11 (§11);
a0624e3 had 9. The ferry gave ship-b (none by y119 → 65), variety-3 and
variety-8 their ships, and the leak fix let variety-8's probe finish at all.
The drift is nought in every one of the twenty-two runs.

**Still open.** Behind the ship the world declines on every battery seed
measured, later than it did but not held: the founders die together, and the
towns' fields, hands and stores are the constraint — a seventh field wanting
sixteen of water for eight years, hands too hungry to labour, a store eaten to
nothing. The gated levers move what they were built to move (fertility,
courtships, births) and do not change the outcome. The next honest lever is
labour in a famine town: the seventh field and its water, and hands fit to sow
at the hunger they actually have.

### 13. Inside the press behind the ship: the draw, the waiting field, the twelve-year voyage (2026-09-14, latest; battery and phone only)

Three items asked for in order, each measured on generated worlds with
`scripts/transit-probe.cjs <seed:size:complexity> <years> <presses>`, which
steps the voyage press a year at a time and reads births, deaths by cause,
every town's fields and store, the cradle's and the field's counters, and the
ships; `OFF=field,draw,cradle` turns a lever off for an A/B on the same seed.
Read A/B pairs by their thirty-year totals of births and deaths, not by a
year: the runs diverge by chaos from the first courtship.

**What the press delivers, and what it did not (item 1).** The effort feeds
the two hungriest famine towns at four a head and pushes their farms, every
128 ticks, for the whole voyage; nothing else reaches the home world. The
ration-why probe counted the hungry of Stonespire and Zephyrford failing the
meal at home four thousand times a year on a store that read twenty to three
hundred — the granary's daily draw (30e) had just emptied it to the seed
reserve into the guts of whoever stood within eight tiles of the hall, and a
city's residents twelve to twenty tiles out were never in the draw at all.
Behind the ship the draw now reaches the town's whole reach (133,
`hearthDraw`): on the battery fixture sixty people became a hundred and three
inside thirty voyage years, where the old code made eighty-two. The
hungry-town probe then found two of Flintholl's twelve at hunger ninety-eight
six tiles from a store of a hundred and fifty: `personIsHostileVisitor` refuses
the draw to any campaign-flagged member under another flag, and both had kept
the flag of a conquered polity. A member now takes the town's flag and eats.

**The field that waited (137, all behind the ship).** Zephyrford kept a
planned farm at stage nought for seven years wanting sixteen of water with
sixteen in its stores (builders fetch only the rare inputs from the stores);
Needleford at year fifty-nine held eleven fed people and a fully stocked farm,
and the stocked-farm probe read every one of them choosing the pushed tower
block: `selectWorkOrder` gives every hand the one top-scoring order, the
effort plans its blocks at priority nine (162 + policy) and a famine farm at
five (90 + 60), so the farm stood stocked and untouched for forty-five years.
Now, at each push, a farm two years planned has its missing common material
placed at the face (24 a push, the player's input); its order scores two
hundred above any other in its town; and a resident too hungry for the labour
pool but on their feet (68–92) carries its material from the town's stores and
works the face, within twelve tiles, never gathering. The first version let
hungry hands go gathering and walk to any site: on phone ship-c they walked
toward Ple Chyp's stocked farm a thousand ticks a year for twenty-five years
and built nothing, because the plot lay past ground a walker cannot cross —
the tower-block fault of 128 again. A plot the hall cannot reach
(`openGroundPlotReachable`) is now none of these; two years planned it falls to
rubble, and the next farm is sited on open ground the town can walk to.

**Measured (battery causal-origin and ship-c, 70 voyage years, A/B against
`OFF=field`).** The levers fire — supplied 3 to 45 a year, first place taken
hundreds to thousands of times, hands at the face — and the arc is within
chaos of the baseline: causal-origin 78 → 79 (y90) → 15 (y125) with the field
on, 78 → 70 (y90) → 10 (y126) with it off; ship-c 81 → 80 (y98) → 69 (y132)
on, 81 → 86 (y98) → 62 (y130) off. Births over y59–y90: 34 with the field on
against 22 off on causal-origin; deaths 46 against 42.

**Why the home world still dies, named.** `scripts/fertility-probe.cjs` on
battery causal-origin at year eighty: of seventy-five people, forty-four to
forty-seven are past the fertile window (0.68 of the lifespan), nine or ten are
children, five to eleven fail the cradle's room (its "fed" needs a larder of
ten, and a store drawn daily to the seed reserve rarely reads it), four to six
are in cooldown, and three to five are eligible — of whom none has an eligible
partner near. The cradle courts thirty-six to seventy-two pairs a year and one
or two couple: a bond (42b) needs trust over 0.57, affection over 0.6 and
attraction over 0.58 both ways; courtship moves trust and affection under one
per cent an update, and attraction is fixed. Old age takes one to three a
year; births are nought to three. The famine of the hundred-and-tens finishes
what the empty cradle began. The next honest lever is the cradle — bonds, and
room by the hungry share rather than the larder — not food or fields.

**The five worlds that die before any ship (item 2).** The food-balance probe
now prints every town's average field fertility. Phone variety-2 launches
(year 78, over the ferry of §12) and phone variety-6 launches at 149 after a
collapse to seventeen at 120; they are no longer on the list. Battery
variety-1 collapses at 113 with fertile fields (41–44) and nobody hungry;
battery variety-4 and phone ship-c have exhausted fields (8–18 in the big
towns). The muck gated on fertility rather than the ship (134,
`MUCK_POOR_FIELDS`, set with `MUCKFERT=15`) raised variety-4's fields from 8–18
to 15–25 and did not move its collapse (52 → 23 at year 106 either way, with
stores of a hundred to six hundred and a hungry share of nought); on phone
ship-c the big city's fields read 17–18 and the gate never opened; the fertile
control, battery causal-origin, still launches at 58. The switch stays at
nought. What kills them, by the transit probe's death causes over the whole
arc (year 34 to the collapse): battery variety-1 bore 55 and buried 108 — 50
of old age, 38 of starvation, the rest in war — peaking at 86 in year 71;
battery variety-4 bore 34 and buried 108 (56 old age, 24 starvation, 26 war),
peaking at 89 in year 57; phone variety-6 bore 44 and buried 117 (47 old age,
49 starvation, 21 war), peaking at 97 in year 82. Phone ship-c is the one
world that starves outright: 109 born, 178 dead, 110 of them of starvation,
from a peak of 133 in year 83 with a city of fifty-eight on eleven fields at
fertility 17 — the muck gate at 15 never opened for it. A second A/B at
MUCKFERT=20 opened it: the fields of Dzo Chy rose from 17 to 20–22 and the
world collapsed on the same road (peak 128 at year 85, 73 at 97, 34 at 116;
the baseline peaked at 132 at 84, 82 at 102, 40 at 114). The fields are not
what kills it either; the switch stays at nought. Everywhere else the
shape is the one behind the ship: the founders age out together and the
cradle does not refill, and the ship comes too late for what is left.

**The voyage press (item 3).** One press ran from year 59 to 104 on battery
causal-origin and came back to fifty-four people from seventy-eight with
nothing said of the years between. A voyage press now runs twelve years at
most, or to the arrival when that is nearer (131), and its result adds a line
after the ship's: "At home: 65 people in 6 towns; Flinthollow is 7 in 10
hungry." Nothing in the simulation changes; the same ticks run.

**Suite** at 107 (`test:waiting-field` added). Pre-ship code is untouched
except the muck switch at its default, so §12's launch sweeps stand.

### 14. "Fix the rest": the cradle, the seed, the mouths, and the ration (2026-09-15; battery and phone only)

Section 13 left the home world dying of an empty cradle. This round went down
that road and found four more doors behind it. Everything here runs behind
the ship (`shipHasLeft`), and every lever has a switch on `transit-probe`
(`OFF=match,roomhunger,reach2,reunite`) or `food-balance-probe`
(`OFF=militia,provision,gutcap,ration`). Read A/B pairs by decade totals of
births and deaths; single years are chaos.

**The cradle (132).** The fertility probe read the eligible adults'
partners: two of eleven already past the window the year after the match,
most of the rest more than twenty-four tiles off or under a different roof
(the urban pull moves one of a couple). Four rules: a pair the town has
courted twenty-four times, drawn to each other (attraction 0.3) and both with
years of the window ahead (under 0.6 of the lifespan), are bonded by the town
as a diplomatic marriage is; the later-born of a couple parted by the towns
takes the elder's home in the sweep that mourns the dead; partners lie
together at night within the town's reach (133's, up to twenty-four), not
eight tiles; and room is the hungry share alone, no larder. Measured, seventy
voyage years on battery against the same code with the levers off: ship-c 83
at the launch to 114 at year 125 (69 off), 75 born against 53; causal-origin
held ninety to year 95 (seventy-five off) and then starved on its fallow
fields. The fertility probe at year eighty on the new code: 92 people from
75, sixteen children from nine, eleven adults in the cooldown after a
conception.

**The seed (133, 137).** `scripts/fallow-probe.cjs` at year 94: Flintholl,
fifteen people, nine fields fallow for up to thirty-seven years, a store of
189 eaten to nought inside a day, thirty sowings tried by hungry hands and
every one refused for want of three seed. The seed guard chose whether the
meal at home was served; the meal itself (117), the emergency ration (30d)
and the conserved rations took whatever the store held. Behind the ship the
reserve is hidden from every meal while it is eaten and put back after, and at
each push a lean town has up to two long-fallow fields sown from the player's
input, the seed, nutrient and water going through the store into the ground.
The same probe on the new code: three fields ripe, two sown, one growing,
three lately reaped, nobody past hunger ninety-two where seven had been.

**The press with nothing to reach for (137).** After the colony is founded
and the last craft learned the concerted target is null, and with it the
bread, the farm pushes, the supply and the sowing all stop: on causal-origin
the pushes ended at year 105 and the world went from 85 to 29 by 114. With no
target, behind the ship, the press feeds the famine towns and tends the
fields at the same half-year beat. It fires (twice a year from 105) and the
world starved on the same road anyway, beside stores of a hundred to two
hundred: bread was not the shortfall.

**Hungry hands eat first (137).** Under the concerted effort the labour tick
handles every person every tick, and a person it handles skips the behaviour
step that would have fed them (21). The granary's hungry-hands rule and the
field's sent the hungry to the fields up to hunger ninety-two, so they sowed
and reaped beside a full store and starved at it. A person past seventy hunger
with a meal to be had at home is now not wanted at labour. Causal-origin held
106 to year 99 where it had held 84, with one death of starvation in forty
years; ship-c 108 at 119 where it had 93.

**Four mouths with no bottom (41, 42a, 30d, 117).** `hungry-town-probe` at
year 104: a militia guard of Flintholl with five thousand organic in his gut
and eleven thousand energy, drawing fifty-three a day. The militia's supply
(five a member a turn), the marcher's provisions (forty at every new war
order), the conserved rations (eighteen times the simulation stride, which is
eight on a lean world) and the meal at home were capped only at the
sixteen-bit ceiling. Behind the ship a militia member is supplied to a full
gut and no further, the marcher's ration tops the pack up to its limit, and a
meal fills a gut to two meals' worth. With the caps everywhere, battery
causal-origin stood one town at year 32 where it had three and reached no
ship by 95: the pre-ship road is sensitive to who eats what, so they are
gated like the rest, and the launch verification on the gated code is
bit-identical (causal-origin year 58 with 78, ship-c 67 with 81).

**The ration (133).** `scripts/store-drain-probe.cjs` wraps every function
the scheduler calls and books a town's store before and after each: at year
104 Flintholl's 177 became 9 in one tick of the artificial-life step, two
eaters at a stride of eight taking it while ten residents with empty guts
went without. The granary stretched the ration to eight a day in "famine",
which is read from the hungry share too, so a full store fed nobody; eight a
day is under what a working body burns. Behind the ship the ration is the
store above the seed reserve shared out equally, up to eighteen a head.
At one meal's worth the same probe named the eaters: of 192 gone in
one tick, eighty-one went to the seventeen people within sixteen tiles (a
member of the town, three campaigners), no beast was within sixteen tiles of
the hall (the herd rule of a0704ea, which lets a hungry town's herd graze,
was built on the wrong guess and is kept because it is right anyway), and the
rest went to the town's own members twelve to twenty-four tiles out at
their fields and blocks, whose meal at home reaches the whole town's reach.
Sixteen mouths at some thirteen a day want two hundred; the store took in
about that; twelve of them at the hall with empty guts got nothing until the
next draw. The famine at year 104 is scarcity first, and the order of
eating second.

**Measured on the final code (a23f72d), seventy voyage years on battery,
`transit-probe`.** Ship-c: 83 at the launch, 104 at year 125, seventy-three
born and sixty-five dead, one of them of starvation in fifty-seven years (the
code before this round: 69 at 132, five starved; the cradle alone: 114 at 125
and then 55 at 134 with fifty-one starved). Causal-origin: 84 at the launch,
116 at year 89 with nobody starved, and then the same famine as every
variant, 57 at 109 and 19 at 120 with forty-three starved (23 at 125 before
the round, 48 starved). The famine on causal-origin is moved later and
higher by the levers and not away: it comes when a hundred and ten people
stand on twenty-five farms.

**Launch sweeps on the final code, eleven seeds, 26 presses.** Battery
launches **9 of 11**, seed for seed and year for year the set of section 12:
causal-origin y58 (78), ship-b 90 (75), ship-c 67 (81), variety-2 100 (58),
variety-3 76 (63), variety-5 89 (74), variety-6 117 (79), variety-7 113 (56),
variety-8 113 (76); variety-1 and -4 collapse. Every lever of this round runs
behind the ship, and the battery road is bit-identical. Phone launches **8 of
11**, `food-launch-probe` and `food-balance-probe` agreeing to the year:
causal-origin y91 (136), ship-b 79 (136), variety-1 90 (133), variety-2 78
(136), variety-4 84 (111), variety-5 57 (141), variety-6 149 (34), variety-7
78 (136); ship-c, variety-3 and variety-8 collapse. That is not section 12's
phone list (variety-2 and -6 gained, variety-3 and -8 lost, several years
moved), and it is not this round's doing: the section 12 code itself
(a1ca367), re-run today with the same probe, gives variety-5 at 57 with 141,
and a six-commit bisect on variety-8 is bit-identical through year 75. The
section 12 phone list was of an earlier state of the code than the one it
names; this list is the one the shipped code makes.

**Still open.** Battery causal-origin still starves between years 100 and
110 on every variant: ninety people on twenty-five farms yielding some 128 a
farm-year, which feeds under two people a farm, and a room cap of six plus
four a farm that overshoots what the fields carry. The honest next levers are
the cap (people per farm from the measured yield, not four) and the far
tier's stride, which lets one eater take eight meals while the next in line
starves.

## The recent commits, newest first

```
a4fda1a  Behind the ship the ration is the store shared out equally, and a meal is two meals at most
3a636e3  Switches for the four store caps on the food-balance probe; a probe that attributes a store's day of outflow by scheduler phase
8f8b7cc  Behind the ship no mouth outgrows its gut, and a full store gives a full ration
a35358a  Behind the ship, hungry hands eat first
c28807e  The press tends the home world when it has nothing left to reach for
4d5b00a  A probe for why a hungry town's fields stand fallow
f4a32c8  Behind the ship the seed is kept from every mouth, and the press sows a lean town's fallow fields
eb61b7d  The fertility probe names the partner's gate, distance, roof and hour; switches for every cradle lever
cf16728  Behind the ship the town matches its courted singles, keeps a couple under one roof, and judges its room by the hungry share
8f91cec  Record the second muck A/B: a richer field does not save phone ship-c
8fa3a4f  Record the press behind the ship: the draw, the waiting field, the twelve-year voyage, and what kills the worlds that die before a ship
703f75c  A voyage press runs twelve years at most and says how the home world stands
a652fa7  The field that waited for water: supplied by the effort, first in every hand's choice, built by hungry hands, and given up when the town cannot walk to it
785df28  A switch for the muck before the ship, gated on the fields' fertility
9dd6e14  The daily draw reaches the whole town behind the ship, and the member the draw refused
bc97173  Probes for the press behind the ship: what the effort delivers, why a meal fails, where the store goes, who is fertile, why a stocked farm stands
a1ca367  Record the round behind the ship: the gated levers, the tile leak, and the island world's roads
e6b4108  Switches for the seed guard, the ferry, and the whole gate on both probes
63a44c6  Keep the seed corn from the meal only behind the ship
c79488a  Probes that name a leak's species, its calls, and its gainer; a road probe; a post-ship probe
45a4657  Let a road cross the water
55f051d  Behind the ship, the town bears its own children, carts its muck to the fields, counts its people honestly, and keeps its seed
187c129  Spend a saturated tile's overflow record when a caller sets the total under the cap
52ca235  Record why the home world dies behind the ship, and which levers cost the ship
64e20a7  Give the sweep probe the same switches as the food-balance probe
8f8e661  Let a grown town lay fields past the seventh tile, and let a starving town take in no strangers
2e61d1a  Mourn a partner who is dead or gone, and eat at home wherever the town reaches
51b8a87  Call a person hungry past seventy, not sixty, and fit for the fields at sixty-eight
62ebc48  Probes for who is born, who is hungry, where the rations reach, what the soil holds, and what the fields carry
a0624e3  Let the fertile window close at fifty-one, and brake births only at the famine line
b1ce206  Let a colony declare itself free within a game's length
9348c65  Run a press with the ship, and say where it is
9248a6d  Guard the phone launch as well
35ca5f9  Hash the world's records by what identifies them, not by their sentences
eac9de6  Split the spatial rendering in six along its own seams
15b3a12  Say what is stopping the skip, in plain words
df63e03  Guard the launch in under a minute
ee721f3  Sow with the seed there is
cb56d26  Probes for the arc past the ship, the sowing, a launch fixture, and the tick's cost
5f4ab61  Split the material society in six along its own seams
b4413b8  Move tile matter through two functions, so the conservation rule lives in one place
298fa92  Call the kin check and the age label that exist
1017ba0  Resolve every free reference in the composed runtime, and fail the suite on one that resolves to nothing
5abd0eb  Say which section a composite line is, and list a function's layers in order
58a12d3  Record that every measured world launches, and the ground the blocks stand on
2924fb7  Site the blocks of the modern world on ground the town can walk to
1c1a793  Re-measure the six worlds: five launch, the phone world starves
05318b2  Record the two launches, and what is still thin on the battery world
2628ac0  Let the effort resume an objective where the last press left it
fe82619  List the commits of the pass in the handoff
a145e2f  Write down the pass that took the small world to year 72 and the battery world to Starflight
5d23e24  Probes for the objective, the studies and the siting
9a497b8  Many hands: raise the city beside the study, and open ground for its tower
ca012e4  Bound the works a waiting site can ask for
ede899d  Reach a shore that can keep ten fields
00edde9  Keep the overflow record a column read alone could not see
43d721b  Call a town urban by the map's own gate
f551a1b  Reach the shore, and sip from all of it
3328fde  Make irrigation irrigate
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
