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
bash $SCRATCH/suite-check.sh log 110
```

The expected count is the number of `"ok": true` lines, currently **110**. It
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

**The pre-ship road is frozen (section 17).** The launch lists of section 17
are the baseline, and `tests/baseline-smoke.cjs` holds the world hash of
battery causal-origin after eight years: any change to what runs before the
ship moves that hash and every launch year with it, because the sim is
deterministic chaos. A new lever runs behind the ship (gated on
`shipHasLeft()`) unless it is meant to change the roads; if it is, run the
launch sweep on both sizes (`scratchpad/sweep-run.sh`, eleven seeds, 26
presses), record the new lists in the handoff and the new hash in the test,
in the same commit. A change that only renders, or only runs behind the
ship, leaves the hash as it is.

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

The launch probes and sweeps of sections 11 to 17 live in `scripts/` and the
scratchpad, and are the ones to reach for now:

| probe | what it answers |
| --- | --- |
| `scripts/food-launch-probe.cjs <seed> <size> <complexity> <presses>` | press to a ship; one JSON row per press with the shortfall, the launch site and its blockers |
| `scripts/transit-probe.cjs <seed:size:cx> <year> <extraPresses>` | the arc behind the ship: people, births, deaths, starved, strain, per year and town |
| `scripts/site-probe.cjs <seed:size:cx> <year>` | what a launch site waits for: the step, the facility, the unfinished with their hands |
| `scripts/order-probe.cjs <seed:size:cx> <year> [place]` | a town's open orders, scores, wants and sources, crews and plots |
| `scripts/current-probe.cjs <seed:size:cx> <year>` | every town's stage shortfall, road to electricity, plans, and where a hall or clinic could stand |
| `scripts/blocks-probe.cjs <seed:size:cx> <year>` | every town's skyline: crafts, foundry ledger, block plots, and each unfinished block's want, hands and plot |
| `scripts/hydrology-probe.cjs <seed> <size> <cx> <years>` | the water, heat, nutrient and gas ledgers a year at a time |
| `$SCRATCH/sweep-run.sh <tag>` / `sweep30-run.sh <tag>` / `arcs-run.sh <tag>` | the launch sweep on both sizes, the thirty battery seeds, the arcs behind the ship |

**The press budget is forty since round nine.** A press stops at every
milestone, and a world learning its late crafts stops one press a craft: at
twenty-six presses variety-22 ran out at year 163 and variety-19 at 130 with
their gates still open, and read as stalls when they were slow. A "none" is a
"none" only at forty presses; the sweeps of section 17 and before were run at
twenty-six and say so.

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

### 15. The sky over the home world: the famine behind the ship is the strained sky, not the people (2026-09-15, later; battery and phone only)

The round was asked for in order: a floor under the cradle from what the
fields carry, a fair order of eating on a lean world, and the reading of the
three phone worlds that die before a ship. The first was built three ways,
measured, and rejected; the second is shipped; the third was read, and the
reading turned the round: the famine that has ended every measured home
world behind its ship is not the people outgrowing their fields. It is the
sky. Battery causal-origin starves between years 92 and 100 whether it
holds 64, 67, 74, 96 or 116 people at the time, on the oldest arc of section
10 and on every lever since. An event at a time is not a population level,
and no cradle lever can touch it.

**Item 1, room from what the fields carry: built three ways, rejected.**
The first ledger asked every eight ticks whether a town's store above the
seed reserve held six a head; the daily draw and the meals empty a fed
town's store by design, so it read every town as short and ship-c lost its
growth, 72 at year 106 against 90. The second wrote at the daily draw
whether the ration had half a meal a head to spare, remembered over eight
days; the same. The third was the ledger the item asked for: every crop
reaped into a town's store booked to its year, room six plus one for every
sixty the last year brought in, and a world-level fallback when a town
stood over its own cap. Measured on battery through year 98 against the
same code with the lever off: causal-origin born 39 against 46, 77 people
against 75, and 11 at year 126 either way; ship-c 95 at year 102 against 85
(98 on the shipped code) with 49 born against 50. The lever cut births on
the world it was meant to save and did not move the famine by a year. It is
reverted: 132 stands as it was at a23f72d. The premise in the item, that the
room cap "lets 110 people stand on 25 farms", is contradicted by the arcs:
the 64 people of the section 10 arc starved in the same decade.

**Item 2, the order of eating: the daily meal quota, kept (3833751).** A
person simulated at the far tier's stride of eight eats once a call and is
called once for everyone else's eight ticks, so the first at the store ate
for eight before the second was asked, and the store-drain probe read a
famine town's day of bread, 192, gone in one tick to two mouths. Each
person may now take one gut's worth, twenty-four, from the stores by meals
in a day of thirty-two ticks (`hearthHideAbove`, 133): what is above the
eater's quota, and the seed reserve under it, is hidden from the meal while
it is eaten and put back after. The drain probe at year 104 reads eight of
thirteen members fed at the same hall where two of sixteen were, the day's
bread over nine people; behind-the-ship arcs on battery ship-c stand at 90
at year 127 against 60 with nineteen starved without it. The same commit
fixes `hearthSpareFood`, which refused the meal at home whenever the spare
store was under the seed reserve itself, because the reserve was already
hidden while the meal was eaten. The alternative in the item, the daily
draw every eight ticks at a quarter ration, was not needed.

**Item 3, the three phone worlds.** Phone ship-c peaks at 133 in year 83
and falls to 40 by 114, ninety-three of 158 deaths by starvation; variety-3
peaks at 95 in year 69, 14 by 95, then 65 by 125, eighty-three of 117 by
starvation; variety-8 peaks at 113 in year 85 and falls to 52 of war and
old age, fifty old, twenty-six starved, some forty-six in war. The first
two are the overshoot famine this section names. The pre-ship room floor
the item asked about (the third ledger with its switch on before the ship,
`SPARE=1`) was measured and cost every launch it touched: battery
causal-origin no ship by year 124 against 58, battery ship-c year 89 with
51 against 67 with 81, phone causal-origin 49 people at year 85 against a
launch at 91 with 136, phone ship-c a launch at 82 with 33, variety-3 no
ship. It is not shipped, and the switch is gone with the ledger.

**What kills causal-origin in year 92: the sky.** Section 91 lays a strain
on the sky for every town that knows mechanization, combustion or
electricity, 0.02, 0.03 and 0.03 a year, decaying by a hundredth and a half
a year with a cap of three. Battery causal-origin's six towns reach a
strain of 1.29 at the launch and the cap in year 76; ship-c's 0.96 and the
cap in year 88. At the cap `strainedWeatherRoll` forces a Drought or Heat
Wave in half of all years (min(0.5, strain x 0.2)), and a spell lasts the
whole year, because the weather is rolled once every 256 ticks and a year is
256 ticks: on causal-origin eleven forced spells in the twenty-four years
from 76 to 100, six dry years in a row from 77 to 82. A dry year lifts the
land's water into the air (one drought year moved 80,000 of 480,000 into
`W.reservoirs.atmosphericSolvent`, which stood at 412,000 in year 83),
kills plants where the ground reads under moisture 15 (19) and fails crops
under 8 (86): the land's mean moisture fell from 44 at the launch to 20 to
30, the plants standing on it from 154,000 to 102,000, and `tileFood` is
plant order times organic, so the hungry seek food and find none. The
famine probe at year 101 read 5,792 feeding calls at Flintholl for 375
meals, 167 of 197 hungry samples "seeking food"; the hungry-town probe at
year 100 read twelve of seventeen members at hunger 92 to 100 with energy 3
to 38 at the hall, eight of them on a war campaign. The forage column that
read the tiles' organic as stable through the famine was reading dead
matter. Ship-c has four times the plants (448,000) and the same fall
(294,000 by year 98, moisture 31 to 13, three land tiles in four under 16),
and starves the same way thirty years later: ten starved in the 120s and
fourteen in the 130s on the shipped code. A/B on `transit-probe` with the
forced spells switched off (`OFF=sky`): over the whole road, causal-origin
stands at 117 people in year 107 with nobody starved against 20 in year 117;
with the switch gated behind the ship so the launch is the same (84 at year
58), 124 in year 110 with one starved against 59. The cause is settled.

**Why relief never worked, and the fix (1a3d232, cea9769, edab634, and the
gate).** A town with all three crafts lays 0.08 a year; Stewardship eased
0.02 and Ecological Engineering 0.05, 0.07 together, so six tended towns
still laid 0.06 a year and sat at the cap for ever, and only Fusion in every
town could have brought a sky back. Four changes, each measured on the way,
because each one alone was not enough, and then a gate.

Ecological Engineering eases 0.12 behind the ship (91). At 0.08 a tended
town offset only itself and the world needed five of six tended; at 0.12 a
tended town takes 0.06 a year off the sky and four of six clear it.
Measured at 0.08 on battery causal-origin: the strain fell from 1.29 to 1.18
by year 67 and climbed back to the cap by 94, and the famine came as before
(36 people at 110), because combustion and current spread to the villages
by teaching (30f) faster than the craft did.

Behind the ship the continuing effort aims at the sky (120): from the
strain at which the sky can force a spell, 0.3 (`STRAIN_FORCING`, the
roll's own floor, now named), the inquiry leads with Planetary Stewardship,
Ecological Engineering and then Fusion; a sky craft is not done when one
town knows it but when every straining town does, or the sky has cleared;
each push researches at a straining town that lacks it; and once one town
knows a sky craft a push carries it to a straining town that lacks it and
holds the craft's priors and its facility, as a sister town of its polity
would teach it (30f), knowledge moving and matter not. Leading only from a
heavy sky, one, let ship-c's first twelve-year press chase refrigeration
while its sky climbed from 0.96 to 1.73. Stewardship is first because it is
the prior Ecological Engineering needs, and the town probe read the two
cities holding it at the launch and none of the three villages that had
taken engines by teaching, so the craft that eases the sky reached the
cities and no further.

Industry strains the sky where it runs, behind the ship (91,
`industrialTown`): a town lays its part, and eases it, only while it has a
finished factory and knows an engine craft. A village of four that had taken
engines, combustion and current by teaching laid 0.08 a year like the city
and could take no relief, because Stewardship is practised at an archive and
the craft that eases the sky at a hall, and it had neither: on battery
ship-c the effort pushed Stewardship at such villages for fourteen years
while the sky climbed from 0.96 to 1.78. The works foul the sky; the works
run cleaner where the town knows the crafts.

The gate. Both the eased constant and the factory rule change the launch
road when they run before the ship, since the strain passes 0.3 and the
first forced spells fall before any ship, so each was swept on the eleven
seeds at 26 presses. At 0.08 ungated, battery launched the same nine of
eleven as section 14, causal-origin 58 (84), ship-b 90 (75), ship-c 67
(83), variety-2 90 (63) against 100, variety-3 76 (62), variety-5 89 (75),
variety-6 115 (83), variety-7 113 (56), variety-8 113 (76), variety-1 and -4
collapsing as before. The factory rule ungated launched eight: causal-origin
58 (79), ship-b 90 (75), ship-c 68 (82), variety-2 91 (74), variety-3 117
(46) against 76, variety-5 90 (80), variety-6 118 (77), variety-8 106 (71),
and variety-7 no ship by year 194 at 26 presses. Fewer droughts before the
ship reshuffle the marginal roads, and a lost launch is not noise. So the
sky before the ship is as it was, on the road the sweeps of section 14
verified, and behind the ship the ledger is tended: the factory rule and the
0.12 apply from the launch (`skyTended`, 91). This is the rule the round
before used for the 41 and 42a caps, which ungated cost the launch the same
way. Verified on the gated code: causal-origin launches in year 58 and reads 84
people at the first press behind it, ship-c 67 and 83, variety-7 113 and
56, variety-3 76 and 62, each the figure of section 14 to the person, so
the battery list of nine and the phone list of eight stand without another
sweep.

Tests: the afternoon smoke requires the ledger before the ship to read as it
did (a town that knows engines lays 0.08, tended 0.01), and behind the ship
a town that knows engines but has no factory to lay nothing, a factory town
to lay 0.08, and a tended factory town to fall below zero and clear its sky;
the continuing smoke requires a heavy sky to put Stewardship, Ecological
Engineering and Fusion first in that order, the craft not done while a
straining town lacks it, the push aimed at that town, a push to carry the
craft to a straining twin town with a factory, the priors and a hall without
moving matter, a sky at 0.35 to lead with the sky crafts, and a clear sky
not to.

**Measured on the shipped code (9c89061), seventy voyage years on battery,
`transit-probe`.** Ship-c: 83 at the launch, 104 at year 124, sixty-four
born and fifty-nine dead, nobody starved, the strain 0.89 at its highest and
zero from year 88, one forced spell behind the ship (the code before this
round: 71 at 134 with twenty-four starved, ten in the 120s and fourteen in
the 130s, seventeen forced spells). Causal-origin: 84 at the launch, 122 at
year 79, 115 at 99, 104 at 110 and 54 at 125; ninety-two born and 143 dead,
forty-six of them starved, none before year 92 and thirty-seven of them
after 110; the strain zero from year 76 and two forced spells behind the
ship, both in its first years (the code before: 59 at 110 and 17 at 126,
fifty-six starved, twenty-five forced spells). The forced spells are gone
and ship-c is fed to the horizon measured; causal-origin's famine comes
twenty years later and half as deep, and it still comes, under a clear sky.
The land dries on its own: causal-origin's mean moisture from 44 at the
launch to 22 by year 110 and its plants from 154,000 to 89,000, ship-c's
from 31 to 12 with the plants from 448,000 to 189,000 and three land tiles
in four under the 16 that photosynthesis needs, on the natural weather
alone, a drought in about one year in eight and a heat wave in one in five,
each a whole year. The sky's forced spells were the trigger; the land drying
under the natural sky is what remains, and where its water goes, the air,
the lakes, the fields' irrigation, is the next probe.



**The launch figures carry a burst, and the levers are gated.** Every arc of
sections 13 and 14 reads causal-origin at 84 people at the launch, and every
arc with a cradle switch off at 78 to 81; that looked like a lever running
before the ship. A per-press read shows the same road in all of them: 78
people at the press before the launch, and the six more born in the ticks
between the ship's leaving and the press's stop sixteen ticks later, when
the cradle's room opens the density gate to a town that had waited years.
Nine launches with one switch off each (field, draw, cradle, match,
roomhunger, reach2, reunite, quota, sky) all launch in year 58, and only
the three cradle switches change the count at the stop. The third ledger's
78 at the launch was the same burst refused. Read a launch population from
the press before the milestone, or read the burst as the first of the
cradle's births.

**Two soldiers hold the world's food.** The hoard probe at year 100 reads
three people holding 20,324 of some 31,500 units of food and energy in 73
guts and bodies, a campaigner of Flintholl with 4,631 in the gut and 10,003
in the body and a guard with 3,470, against stores of 225, 117 and 69. The
41 and 42a caps on provisioning are behind the ship; these are legacies of
the uncapped road before it, and they are not the famine (the stores are
empty because the land is), but a campaigner home with more than a full gut
could unload it to the store. Open.

**Probes.** `transit-probe` prints the sky each year (strain, forced spells
so far, the share of the year's ticks in a Drought or Heat Wave) and the
land (mean moisture over land tiles, the share under 16, plants, water,
the water in the air), and `OFF=sky` gates the forced roll behind the ship;
`famine-probe` takes a seed spec and `YEAR=<n>`. Scratchpad only:
`hoard-probe`, `known-at-launch`, `press-people`, `sweep-run.sh`.

**Still open.** The land dries under the natural sky, above: a hydrology
ledger by year (land water, lake water, the air, what irrigation lifts
from the shore) is the probe to write, and the balance of rain against
evaporation the constant to read before any lever. The continuing crafts take twelve years each on
causal-origin (refrigeration 59 to 71, hydroponics to 83, antibiotics to
95, global networks to 116), each a horizon; a sky craft at that pace
arrives after the land has dried. The phone worlds that die before a ship
build strain on more towns and should be read with the sky columns before
any other lever is tried on them. The war takes eight of Flintholl's
seventeen in the famine year. The hoards above.

### 16. Where the water goes: the sky breathes and the living loop returns what it drinks (2026-09-15, latest; battery and phone only)

The round was asked for as "do all this, fix all the remaining issues": the
open items of section 15. The land drying under the natural sky came first,
because the reading of section 15 had already shown it was what remained
after the forced spells were gone, and the other items followed it: the
continuing crafts' twelve-year pace, the three phone worlds that die before
a ship, the soldiers' hoards, and the war in the famine year.

**The ledger.** `scripts/hydrology-probe.cjs <seed> <size> <complexity>
<years>` generates a world and steps it a year at a time, summing every pool
the solvent can sit in (the land tiles, the lake tiles, the matter above what
their depth accounts for, the air, bodies and guts, stores, walls, roads,
cohorts), the year's flows (the air's change under each weather, so a rain
year's delivery and a dry year's lift are read apart; every balanced
reaction's net take of solvent, and its unit count), what irrigation carried,
and the land as the transit probe reads it. `OFF=breath` turns the breathing
sky off. Two facts came out of it that nothing else had shown.

**Nothing made water, and the sky had none to give.** Photosynthesis took two
solvent for every two organic it made; respiration turned energy and oxidant
into waste and gas; decomposition and mineralization drank a solvent each;
no reaction in the table returned any. Battery causal-origin's water fell by
twenty-one thousand a year, 7,741 thousand at year one to 5,870 thousand at
110; ship-c's by twenty-two thousand, 3,217 thousand to 1,229. The land paid
first: causal-origin's mean moisture 54 to 31 and its plants 511 thousand to
67; ship-c's moisture 56 to 20, three land tiles in five under the 16
photosynthesis needs, its plants 524 thousand to 185. And the rain had
nothing to carry: evaporation took depth and matter from a tile only while it
stood above its natural waterline, so a lake at its level gave the air
nothing and neither did wet ground; the air was filled by droughts alone.
Causal-origin's air read 953 thousand at the start, 12 thousand by year six
after three wet years had laid it on the ground, and near nothing for a
hundred years after; ship-c's read zero from year ten, and each rain year of
the century after delivered nothing (the probe's air column: "Rain": 0).
Section 15's forced spells were the trigger of the famine behind the ship;
this is why the land never recovered between them, before the ship as well
as after, on every size.

**The living loop returns what it drinks (02).** Photosynthesis now takes one
solvent, a nutrient and two gas and gives two organic, an energy and an
oxidant (chemosynthesis follows it); mineralization takes oxidant, not
solvent, and gives back a nutrient, a solvent and a gas for two waste;
decomposition takes oxidant, not solvent, and returns a solvent with the
nutrient and gas. Respiration is as it was, energy and oxidant to waste and
gas, and that is not an oversight: the waste a body breathes out is excreted where it stands
and mineralizes there, and it is the only path that fertilizes the ground
where the animals and the people feed. Two organic eaten, their two energies
respired and the two waste mineralized return the solvent and the gas their
making took, and a gas and a nutrient over; two organic rotted return the
solvent, the nutrient and the oxidant. Every species in these
reactions shares one composition, so the balance the world checks at
creation (06) holds, and photosynthesis asks the sun for 11.92 against 11.76
before. Two drafts were measured and rejected on the way. The first kept two
solvent a unit and gave two oxidant: the water still fell ten thousand a
year, because from year eighteen respiration runs about as many units a
year as photosynthesis, eight thousand of each on battery causal-origin, not
twice as many. The second had respiration exhale solvent instead of waste:
it levelled the water and opened the ground, since with no waste to
mineralize nothing returned nutrient to the tiles the herds and the towns
graze; the land tiles under the fertility of 10 that photosynthesis needs
went from 11 of causal-origin's 1,389 to 724 in twenty-eight years, the
plants fell as before under a wet sky, and the world reached no ship by year
100 where it had at 58. The census that found it is in the ledger now: mean
fertility, the count of land tiles failing each of photosynthesis' gates
(moisture, fertility, heat, cold, flood, gas, nutrient), the tile energy the
forage is worth, the nutrient held in bodies, and the mean land temperature.

**The land cools to its climate (17).** The same census, run on the code
before this round, read the mean land temperature of battery causal-origin
at 19 degrees in year one and 24 by year 18, a third of a degree a year, and
the fertility gate closing on 409 of 1,389 tiles by year 18 as well: both
drifts are older than this round. A drought warmed every tile by two tenths
a pass and a heat wave by one, a fire by six for every packet burned, and
nothing ever cooled them; the seasons (46) swing about the mean and the
diffusion (08) only spreads what is there. At that pace the warm tiles pass
the 48 degrees photosynthesis allows within the century, and the "thermal
destruction" deaths of every late game were this heat. Every tile now keeps
the climate it was made with (`climateBase`, written beside the temperature
in both generators of 06; a world saved before this takes the climate it has
when next stepped) and each pass draws its temperature back toward that
climate plus the season's swing by a twentieth of the excess, at least a
tenth: a heat-wave year stands about two degrees over the mean, a drought
four, a burned tile cools once the fire is out, and the heat is booked as
dissipated. Measured: causal-origin's mean land temperature reads 17.8 to 19.0 degrees
in every decade to year 90 (36.2 by year 60 before), ship-c's 15.9 to 16.0,
and no land tile passes 48.

**The body passes its surplus nutrient to the ground (21).** With the water
level and the land cool, the plants still thinned the same way on both codes,
and the census said why: a meal took eight nutrient a stride from the tile
(performFeeding), the gut passed it to the body at six a call, and the body
kept every unit until it died, as nothing below excreted nutrient the way it
excretes water and waste. Living bodies on battery causal-origin held 38
thousand nutrient in year one and 653 thousand by year sixty, all of it
drawn from the tiles the herds and the towns feed on, and the land tiles
under the fertility of 10 that photosynthesis needs went from 12 of 1,389 to
665 while the plants fell from 511 thousand to 146. What a body holds above
its reserve (240 for a person, 120 for a beast) is now passed where it
stands, six a call as the gut fills it: the manure of the herd and the town
is the fertility of the ground they stand on. Measured: living bodies hold 12 to 35 thousand nutrient through the century
(653 thousand by year 60 before), the tiles under the fertility gate number
0 to 17 through year 60 (665 before), mean fertility 40 to 44 (22), and the
plants stand where they fell before. Late in the century the count climbs
again, 173 tiles at year 90 on causal-origin and 211 at 110 on ship-c, with
the tile nutrient easing five thousand a year: the price of the gas, below.

**Tried and rejected: litter rots (19).** With water, heat and nutrient
mended the world greened and, greening, locked its carbon: causal-origin's
tile organic climbed from 1,215 thousand to 2,125 thousand by year 100 and
its gas fell from 1,681 thousand to 377; ship-c's gas to 124 by year 110.
Photosynthesis takes two gas a unit. A rot of the litter above a floor of 600
organic a tile, a unit asked for every 500 above it at each pass of the plant
update by the decomposition of 02, levelled the gas (1,686 thousand to 1,184
by year 110 on causal-origin, with mineralization's gas) and halved the
standing plants: 291 thousand at year 80 against 572 without it, tile organic
927 thousand at year 60 against 1,840. The civilization slowed with its
forage and its materials: the same road to Ore Reduction at year 41 on both,
then Waterworks at 57 against 45, and the ship at year 104 with 56 people
against year 63. The rot is out; the gas is carried by mineralization and
respiration instead (next), and what the greening world locks in its litter
it locks slowly.

**The gas (02).** Photosynthesis takes two gas a unit; respiration gives one
back for each energy burned and mineralization one for two waste. With
mineralization giving its two nutrient and no gas, the ledger read the gas
falling thirteen thousand a year on both worlds (ten with the litter rotting,
above), to nothing within a century and a half, so it gives one nutrient, one
solvent and one gas instead: the nutrient it no
longer gives the ground was over-returned once the bodies passed theirs (21),
the tile nutrient rising two and a half thousand a year on both worlds. Measured with mineralization giving its gas: causal-origin's gas reads 1,681
thousand at the start and 973 at year 90, eight thousand a year against
thirteen (and against a rise of seven a year before this round, when nothing
grew); ship-c's 1,600 thousand to 637 at 110. At that pace the gas lasts
two centuries, and what the greening world locks in its standing litter
(tile organic 1,215 thousand to 1,897 on causal-origin, 1,151 to 2,278 on
ship-c) is where the carbon and the nutrient go. See the open items.

**The sky breathes (17).** In weather that is not rain or drought, a lake or
sea tile above freezing gives the air a hundredth of the matter above what
its depth accounts for each pass, twice in a heat wave: the floor irrigation
respects, so a lake keeps its level; and wet ground above fifty moisture
gives one a pass, and one more for every ten above, twice in a heat wave,
so the land cannot flood without end. The rain then has something to carry;
what it lays on the land came from the lakes and goes back to them. Matter
moves through `takeTileMatter` into the air reservoir; none is made.
`tests/water-smoke.cjs` (in the fast chain) holds the loop's balance and the
breath's rules.

**Measured with the ledger on battery, 110 years of plain ticks, on the shipped
code (3912cf3; the ledger is bit-identical on a86fa5f, d5f8a5f and 3912cf3,
which differ only in what a press does).** Causal-origin's water stands at 7,753 thousand in year one and
7,193 thousand at 90, six thousand a year against twenty-one; its land holds
1,213 thousand at 90 against 678 at the start, its mean moisture reads 67 to
97 through the century (54 at the start, 31 at 110 before), no land tile is
under the 16 that photosynthesis needs in any year read, the air carries
half a million to a million and a rain year lays 150 to 300 thousand on the
ground where it laid nothing. Its plants: 511 thousand at the start, 311 at
year 20, 347 at 90, against 90 at 90 before. Ship-c: 3,228 thousand of water
to 2,502 at year 110 against 1,229; moisture 66 to 77 against 20; plants 515
thousand at 110 against 185. Ship-c's lake had 715 thousand above its depth
and the wetting land took most of it by year 40; from there the rain is what
the wet ground and the lake's remainder breathe, a hundred to two hundred
thousand a year, and the land holds. No matter is made or lost: the audit is
nought in every year of every ledger.

**The effort turns to the next craft within the press (131).** A transit
press does not stop at a craft, and the objective was set once when the press
began (79), so a craft learned in the second year of a twelve-year press left
the effort pushing a done stage for ten: on the section 15 arc every
continuing craft arrived exactly a horizon apart, Stewardship at 71,
Hydroponics at 83, Antibiotics at 95, whatever year each was actually
reached. Now at each intervention, if the objective is a craft the world has
reached, the effort turns to the first objective not yet reached. `OFF=turn`
on the transit probe restores the old press; the probe's yearly line now
carries `known[...]`, the continuing crafts the world holds, so the year each
arrives is read directly. Measured on the causal-origin arc: the ship leaves in year 74; by 80 the
straining towns know Stewardship, Ecological Engineering and Fusion, by 86
Refrigeration and Hydroponics, by 92 Antibiotics, Global Networks and
Composites, by 98 Gene Therapy, Artificial Minds and the first two frontier
crafts: twelve crafts in twenty-four years where each took a horizon. On
ship-c (ship in 79) every continuing craft is known by 115.

**A hoard comes home to the hall (133).** Before the ship a fighter drew a
full ration at every order and a guard's orders are renewed again and again
(42a), so section 15's hungry-town probe read three people holding 20,324 of
the world's 31,500 food-energy at year 100. The caps of 41 and 42a stop the
drawing behind the ship; they did not empty what was drawn before it. Behind
the ship a person within the hall's reach with more than eight days' meals
in the gut (192) puts what is above two days' (48) back in the town's store,
where the daily draw shares it out. A forager home from a rich tile carries a
day or two, never eight, so this is the hoards alone. `OFF=unload` on the
transit probe; `ALIFE_HEARTH_DEBUG.unload(id)` and the `unloaded` count.
Measured with the hoard probe on battery causal-origin at year 100 on the
shipped code, three ships away: 14,664 organic returned to the stores over
the arc, the whole world's guts hold 984 across 75 people and the largest
holds 18, against 30,638 with one gut of 9,993 on a road where no ship had
left, and the 20,324 in three people of section 15.

**Behind the ship, on the shipped code, sixty and seventy voyage years on
battery, `transit-probe`.** Causal-origin: 72 at the launch in year 74, 81
at 79, 78 at 89, 73 at 99, 80 at 109, 102 at 119, 113 at 129 and 114 at year
134; eighty-nine born, fifty-five dead, **nobody starved** and nobody burned
in sixty years; the strain 2.42 at its highest and nought from year 86, two
forced spells behind the ship; its plants 321 thousand at the launch and 475
at 132, its moisture 92, and a colony founded (section 15 measured 104 at 110
and 54 at 125 with forty-six starved, on a launch at 58). Ship-c: 62 at the
launch in year 79, 78 at 89, 85 at 109, 110 at 129 and 126 at year 147; a
hundred and sixteen born, seventy-two dead, four of them starved (three in
the 100s, one in the 110s); the strain 1.43 at the launch and nought from 91,
one forced spell behind; plants 490 thousand to 675, and a colony founded
(section 15: 104 at 124, none starved, from a launch at 67). War deaths fall
in a few of causal-origin's voyage years, one to three a year, as before.

**The three phone worlds that died before a ship.** Read with the transit
probe from year 31 on the press road, to year 110, on the shipped code. Phone
ship-c, which starved from year 31 and peaked at 133 in year 83 before dying,
holds 71 to 82 people through year 66 with two starved in forty years, thins
to 39 by year 86 under a sky it strains itself (0.5 in year 86, 1.9 with four
forced spells by 101: before the ship the ledger of section 15 is as it was,
and on phone the villages that take engines by teaching strain it), and
sends its first ship in year 106 with 50 people at home, 53 by 110. Phone
variety-3, which fell to 14 by year 99, stands at 128 in year 72 when its
first ship leaves and has a colony founded and a second ship under way by
106, at 135 people, its land at moisture 99. Phone variety-8, which lived to
103 and no ship, sends its first in year 89 at 124 and its second by 108, at
134 people; its land reads moisture 85 to 94 the whole way and its plants
climb from 919 thousand to 1,286. All three were the empty sky: on the code
before, phone ship-c's air read zero from year ten and every rain year of the
century delivered nothing.

**Launch sweeps on the shipped code (3912cf3), eleven seeds, 26 presses, the
launch site read honestly (114).** Every change of this round runs before the
ship as well as after, so every road moved, and this list replaces section
14's. Battery launches **11 of 11** (9 before): causal-origin y74 (71 people
at the press before; 58 and 78 before this round), ship-b 111 (68; 90),
ship-c 79 (62; 67), variety-1 77 (68; collapsed before), variety-2 87 (76;
100), variety-3 110 (78; 76), variety-4 91 (71; collapsed before), variety-5
70 (71; 89), variety-6 121 (73; 117), variety-7 114 (78; 113), variety-8 82
(72; 113). Six worlds leave earlier or where none left, five later; none
dies. The transit probe's arcs above leave in the same years, 74 and 79, as
the sweep now reads the site without choosing it.
Phone launches **11 of 11** (8 before): causal-origin y73 (135 people at the
press before; 91 and 136 before this round), ship-b 65 (135; 79), ship-c 106
(50; collapsed before), variety-1 97 (139; 90), variety-2 85 (134; 78),
variety-3 72 (126; collapsed), variety-4 73 (81; 84), variety-5 83 (134;
57), variety-6 141 (75; 149), variety-7 64 (140; 78), variety-8 89 (126;
collapsed). Before the carry of 79 the same sweep read causal-origin at 267
and variety-2 with no ship by 221, when a halving of its people halted the
press; that stall is the two paragraphs that follow. Section 14's 91 and 78
were read with the probe choosing the site.

**The pull of the city follows the launch site (108).** The first phone sweep
on this round's code launched ten worlds of eleven and put two far out:
causal-origin in year 201 and variety-2 not by 298, alive at 101 people.
Both were the same thing. The launch site of 114 sticks to a town, and the
pull of the city (108) followed size: on phone causal-origin the site,
Lakehaven, held 61 people in year 73 with the world's skyline built and no
launch tower or Starflight yet; the pull took its polity's villagers to
Fenspire once Fenspire was the larger, 29 to 67 while Lakehaven emptied to
11, the press ran five whole horizons on a site that could neither build nor
learn, and the ship left in year 201 from a third town that had grown to the
city gate. Once the world has chosen the place a ship would leave from, that
place is now the pull of its polity while it is a city with a hall, whatever
its size; the largest town otherwise, as before. Measured: it did not mend the stall. With the pull following the site,
phone causal-origin's Lakehaven still fell from 61 to 12 while Fenspire
grew, so the drain is not the pull (deaths of a founding generation, and
households leaving for a fed store, are the other movers), and the site
held the same two blockers, no launch tower and no Starflight, from year 73
to 265, with 20 to 40 people; the ship left in 267 from a third town. On
the battery roads the change is idle where the site and the hub already
agreed (every battery launch year stands but variety-6, 130 to 121, and
variety-7, 109 to 114). What the site waits for is read with
`scripts/site-probe.cjs <seed:size:complexity> <year>`, below.


**A craft the world holds is carried where its facility will not rise (79).**
The site probe named the stall. On phone causal-origin at year 100 the site
knew Astronomy, the next step on the road to Starflight was Mechanization,
its forge was never built, and its progress stood at 57 of 60: the push
raises a craft to ninety-five hundredths of its threshold and no further,
the town does the rest with the facility the craft wants, and where the
facility never rises the craft never comes, though four other towns of the
world knew it. On phone variety-2 the site stood at 53 of 56 on Astronomy
with its observatory planned, stocked and unworked for thirty years, while
two towns of the world, one of its own polity, knew the craft. Sister towns
of a polity teach each other (30f) and the effort carries the sky crafts
town to town (120); now, once a step has been pushed twenty-four times with
its facility still wanting, the effort carries that step from any town that
knows it, with a TechAdvanceEvent that says so: knowledge moves, matter does
not, and a craft nobody knows is still the town's own to reach.
`scripts/site-probe.cjs <seed:size:complexity> <year>` reads a site's step,
facility, unfinished buildings and their wants, store, research progress
and the world's wants. Measured with the site probe on the shipped code: at year 100 phone
causal-origin's site knows Astronomy and Starflight (progress 109 of 90),
holds a launch tower, and a ship has already left it, the effort pushing
Gene Therapy; at year 110 phone variety-2's site knows both (136 of 90),
holds a tower, and a ship has left it too, its observatory still planned,
stocked and unworked. In the sweep below the two leave in years 73 and 85, with 135 and 134
people at home. The battery roads are bit-identical
with the carry: it never fires where nothing stalls.


**The war in the famine year.** Section 15 saw a war take eight of
Flintholl's seventeen in the year it starved. Read across the whole arcs,
war deaths run one to three a year on causal-origin from year 70 on and one
or two on ship-c, with or without famine; the eight were one year's battle
in a war of the ordinary kind, not a rule that sends a starving town to
fight. Nothing was changed for it; the arcs above say what the wars cost
under the new sky.

**Still open.** A planned building that is stocked and never worked: phone
variety-2's observatory stood at its second stage with its materials and no
hands from year 80 to 110 while the town had fifty to sixty people and its
farm had four hands; the carry went round it, but the labour pool's reason
for never sending anyone is unread (an unreachable plot, or a priority that
never comes up, are the two candidates; 137 gives up a field the town
cannot walk to, and no rule does the same for a building). The gas eases
eight thousand a year on both battery worlds
(two centuries at that pace) and the tile nutrient five thousand late in the
century, with the fertility gate closing on 173 tiles by year 90 on
causal-origin: the carbon and the nutrient of the greening world lie in its
standing litter, which nothing rots since the ground decomposer was
rejected; a rot that spares the towns' reach and the fields is the honest
next lever, and mineralization's second nutrient could come back with it.
Ship-c's lake has no water above its depth from year 40, so its rain is
what the wet ground breathes and its land eases from 77 to 66 by year 110;
the sea's own body is not touched, and could be, slowly. Before the ship the
sky is still the sky of section 15, and on phone the villages strain it: phone
ship-c halved between years 42 and 86 under it; the sky fix is gated behind
the ship and would need its own sweep to come forward. The predators die
out by year 50 on battery causal-origin on every code, an old finding: the
rescue refugia are spent once the people pass two hundred. The launch roads
moved with the chemistry, as every pre-ship change moves them: the sweep
above is the new baseline, and section 14's is history. The war is as it was.

### 17. The baseline: the road is frozen, the sky comes forward, and a plan nobody can fill is set aside (2026-09-16; battery and phone only)

The round was asked for in order: declare section 16's lists the baseline
and freeze the pre-ship physics; fix the one defect that could still stall a
world, the stocked building that never gets hands; bring the sky fix forward
of the ship, with a sweep; widen the evidence to thirty battery seeds. The
order was kept, except that the two pre-ship changes were made before the
baseline hash was recorded, since each would have moved it.

**The freeze.** The sim is deterministic chaos: any change to what runs
before the ship moves every launch year, and section 14's lists were history
the day section 16's chemistry landed. So the launch lists are now guarded by
`tests/baseline-smoke.cjs` (`npm run test:baseline`, in the fast chain):
battery causal-origin, lean, generated and stepped eight years, its
`worldHash()` compared with the recorded one and its matter audited. The hash
recorded is the one after the two changes below, `7a2d4ecb`, 25 people at
year eight. A lever that runs behind `shipHasLeft()`, or only renders, leaves
it as it is; a lever meant to change the roads fails it, and the rule in
"Working rules" says what that costs: the sweep on both sizes, the new lists
in this file and the new hash in the test, in the same commit. Eight years
was chosen because the hash is a guard, not a measurement, and the test takes
a minute and a half; it catches what changes from generation on, and it has
a limit found the same day: a rule that fires only in a grown town leaves it
as it is (the open-ground reach below did not move it), so the sweep is the
measurement and the hash is the tripwire for the common case.

**The stocked building nobody worked.** Section 16 left it open: phone
variety-2's Spapaikhsai, the launch site, held its observatory stocked at its
second stage with no hands from year 80 to 110, at fifty to sixty people,
while its farm had four. The site probe's list of the unfinished at year 110
said what the labour saw: `observatory s2 stocked hands0`, `monument s0
wants 2 Glydurox hands0`, `farm s2 stocked hands4`, `market s1 wants 11
Caedur-Ate hands0`, `office s2 stocked hands0`. The labour works this way
(30c, 30d): `selectWorkOrder` gives a worker the single open order that scores
highest for them, `order.priority × 18 + the policy × 12 − distance × 2`,
founding orders 96 more; `performCivilLabor` then looks for that order's
missing material in the hand, in the stores when it is a store-drawn kind, and
on the ground within reach by `findResourceTile`; and when none of those had
it, the worker did stockpile labour and came back to the same order next
tick. The monument, planned at the effort's priority, scored highest for
every worker of the town; its Glydurox lay nowhere they could reach; so every
worker of Spapaikhsai went to the stockpile for thirty years, and the
observatory, the office and the market behind it were never chosen. It was
never a matter of reach or of hands: the town had both. Section 13's waiting
field was the same shape with a farm; 137 mended that one by rank, and this
round mends the general case at the source.

**The rule.** A plan whose want has no source in the hand, the store or the
ground is set aside: `order.blockedUntil = W.tick + LABOR_BLOCK_TICKS` (256
ticks, a year) in the branch that used to fall to stockpile labour, and
`selectWorkOrder` skips an order whose `blockedUntil` is ahead of the tick.
The worker still does stockpile labour that tick, and takes the next plan the
next; the set-aside plan comes back when its year is up, in case the material
has come in by trade, prospecting or a store-drawn craft. `LABOR_BLOCKED.count`
counts the set-asides. `tests/labor-smoke.cjs` (`npm run test:labor`) plans a
monument wanting glass, which lies on no ground, and a stocked shelter in the
civic fixture, and asserts the four things: the glass plan scores highest, one
tick of the labour body sets it aside a year, the next pick is another plan
and the stocked one when it is the next, and the plan comes back when its
year is up. `scripts/order-probe.cjs <seed:size:complexity> <year> [place]`
presses a world to a year and reads, for a place, every open order with its
score for six of the town's workers, what it wants and whether the want is in
the hand, the store or the ground, how long it is set aside, its hands, and
which order each worker would take, and for each plan its crew (task, phase,
distance from the face, stuck ticks, a blocked route) and its plot (distance
from the hall, work done, reachable). On phone variety-2 at year 95 under this
rule the town had 29 people, at war (its sampled workers raiding, assaulting,
fighting), 69 set-asides so far, and every open order with a source; the road
had moved with the sky, and the observatory of section 16 was not on it. The
rule's proof is the test and the count; the worlds it changed are in the sweep
below.

**The world that flew a century late.** The sweep with the sky forward flew
twenty-one of twenty-two worlds on their old years and battery variety-3 at
207 where it had flown at 110; the sky-only run never flew it. The site
probe read its launch site, Tratritrop, at years 120 and 150: starflight
studied to 85.5 of 90, the launch tower planned, stocked by the effort and at
its second stage, five hands and then sixteen, and not one unit of work laid
in forty years. The order probe at year 115, with its new columns for the
crew of each plan and the plot's distance from the hall, said why: the plot
lay at the map's edge thirty tiles from the hall, where the open ground of
128 had put it when the town was full (fifteen blocks, six tenements, four
walls), and a worker's town is theirs only within twenty-eight tiles of its
hall (30c, `nearestWorkPlace`). Thirteen of thirty-two people were "moving to
the Launch tower work face", standing three to five tiles from it; each lost
the order two tiles short, turned home, took it again inside the
twenty-eighth tile, and walked out again. The rings of the open ground are
counted the chessboard way, so its twenty-sixth ring can lie thirty-six tiles
off as the walker walks. The world flew when two blocks fell and freed a plot
in town. Chaos put variety-3 on this road under the new sky; the defect was
there for any world whose city fills before its tower is planned.

**The rule.** The open ground offers nothing farther than
`OPEN_GROUND_WORK_REACH` (26) tiles as the crow flies, two inside the labour
reach, so a hand at the face is still in its town's employ; and once every 32
ticks a town looks over its unstarted plans (`openGroundResite`) and lays out
again, where its own siting puts it now, any whose plot lies past the reach,
the stocked material moving with the plan; a plan with work in it is left
where it stands. `OPEN_GROUND.resited` and `.unsited` count them. The labour
test asserts that the open ground offers no plot past the reach and that a
foundation laid thirty-one tiles out is laid out again six tiles out. On
battery variety-3 under the mend the site had no open order at all at year
115, and the world flew at 117 (110 in section 16, 207 before the mend);
battery variety-1 moved from 65 to 60 and phone variety-7 from 72 to 74;
every other year on both sizes stood where it was, so the mend fired where it
was needed and nowhere else.

**The sky before the ship.** Section 15's sky fix (the ledger's strain no
longer forcing dry years) was gated behind the ship because bringing it
forward would move the roads; section 16 then gave the world a real water
cycle, the land cooling to its climate (17) and the sky breathing, so the
strain the afternoon ledger accumulated stood for a drying the physics no
longer produced. `skyTended()` (91) now returns true on every world: the
ledger still counts the industrial towns and the strain, the ideologies still
answer it, but the ledger holds only the industrial towns (a finished factory
and an engine craft) before the ship as well, and eases at the tended rate, so
a village no longer strains its own sky; a forced spell still comes when
factories strain it. The afternoon test was rewritten for it: the ledger rises
on completing a factory, the strain and its climate event come, the tending
eases them, and it no longer pushes an ascension to open the gate. Measured
alone on the battery sweep (the first column of the lists below): ten of
eleven on their old years and variety-3 lost, the road read above. On the
phone arcs behind the ship it did what section 15 hoped: ship-c, which held
53 people at year 110 under six forced spells and a strain of 2.07, held 61
under none and a strain of 0.51; variety-8 held 147 with one starved where it
had held 134 with eighteen; variety-3 137 with four where it had 134 with
eight.

**The sweep, both sizes, 22 of 22.** Eleven seeds, 26 presses, lean, run
three times: with the sky forward alone (battery only), with the set-aside
plans added, and with the open-ground reach added, which is the shipped code;
section 16's year in brackets. Battery: causal-origin 74 / 72 / 72 (74),
ship-b 110 / 110 / 110 (111), ship-c 79 / 80 / 80 (79), variety-1 76 / 65 /
60 (77), variety-2 92 / 84 / 84 (87), variety-3 none by 226 / 207 / 117
(110), variety-4 97 / 83 / 83 (91), variety-5 70 / 72 / 72 (70), variety-6
119 / 120 / 120 (121), variety-7 102 / 109 / 109 (114), variety-8 81 / 82 /
82 (82). Phone, with the set-aside plans / the shipped code (section 16):
causal-origin 75 / 75 (73), ship-b 66 / 66 (65), ship-c 89 /
89 (106), variety-1 77 / 77 (97), variety-2 76 / 76 (85),
variety-3 64 / 64 (72), variety-4 73 / 73 (73), variety-5 73 / 73 (83),
variety-6 124 / 124 (141), variety-7 72 / 74 (64), variety-8 83 /
83 (89). The shipped code's lists are the baseline; section 16's are
history.

**The arcs behind the ship** (the transit probe: battery to year 70 and forty
presses on, phone to year 90; section 16 in brackets). Battery causal-origin
flies at 73 and holds 123 people at year 140, nobody starved (114 at 134,
none); ship-c flies at 73 and holds 146 at 147, nobody starved (126 at 147,
four). Phone ship-c flies at 71 and holds 144 at year 114 with 23 starved,
where it held 53 with 36 starved (and 61 with 36 under the sky alone); phone
variety-3 flies at 41 and holds 142 at 108 with four starved (134, eight);
phone variety-8 flies at 56 and holds 199 at 110 with 30 starved (134, 18),
its hunger in the eighties and nineties as its people doubled. Strain peaks
between 0.4 and 0.8 on every arc and ends at nought; one forced spell behind
the ship where section 16 saw three to six. The plants grow on every arc.

**Thirty battery seeds, first run.** `scratchpad/sweep30-run.sh r8 11`: the
eleven seeds above and variety-9 to variety-27, battery, lean, 26 presses
each, on the code deployed at 2226efe. Twenty-five of thirty flew:
causal-origin 72, ship-b 110, ship-c 80, variety-1 60, variety-2 84, variety-3
117, variety-4 83, variety-5 72, variety-6 120, variety-7 109, variety-8 82,
variety-10 124, variety-11 71, variety-12 94, variety-13 79, variety-16 143,
variety-17 191, variety-18 124, variety-20 89, variety-22 172, variety-23 86,
variety-24 88, variety-25 71, variety-26 98, variety-27 252. The middle of the
twenty-five is year 88; twenty-one fly by 125, and four fly late, at 143, 172,
191 and 252. Five did not fly in 26 presses, and the last press of each says
why, read from the launch record the probe keeps: variety-14 died (37 people
halved to 18 and to 9 by year 319, its site a town of one); variety-15 stayed
small (28 people in two towns of 12 and 9 at year 311, one city where the
gate wants two); variety-21 is slow (80 people at 206, still short of the
second city, current in a second town, and its seventeen blocks); variety-9
stood at year 148 with 82 people, its site knowing starflight with its tower
up, the world short of its second city and of current in a second town; and
variety-19 the same at 170 with 70 people. The first three are the world: a
battery map of seventy-two by forty-four does not always carry two cities.
The last two were asked for as the next work.

**The two that stood at the gate.** `scripts/current-probe.cjs
<seed:size:complexity> <year>` presses a world to a year and reads every
living town: its people, stage and stage shortfall, its road to electricity
step by step (progress, threshold, priors known, the facility and whether it
stands, the research materials in the samples and the store), its unfinished
plans with their hands, and where a hall, a clinic, a workshop or a forge
could stand by the town's own siting and on the open ground; the press's
target and its pushes beside them. On variety-19 at year 130 the target was
"cities" with 114 pushes since year 101, and the second town, Dyliqi (23
people, civic, 28 buildings, stability 0.58, a forge standing), lacked one
thing to be a city, a Catalytic clinic, and had no plan open at all: the
push for a second city (`modernPush("cities")`) asked it for a clinic every
128 ticks and `planBuilding` handed back nothing, because the townscape's
civic ring and the base siting were both built over and the open ground of
128 was kept for blocks and edge buildings; its people stood idle. On
variety-9 at year 120 the target was "cities" with 85 pushes since 98, and
the second town, Vouloshyo (11 people, civic, stability 0.45), had its clinic
planned at year 98, stocked, at its second stage, 4.5 tiles from the hall,
with every one of six sampled workers choosing it (scores 171 to 182 against
113 for the next plan) and none on it, four crafting a build tool and one
travelling: the plot's `reachable` column read false, the hall's flood not
reaching it, and the townscape checks reachability only for blocks. Two
faces of one fault: a town that cannot hold a structure in its quarters, or
cannot walk to where it put one, and a press that plans and stocks and waits.

**The rule.** In 128, a plot the hall cannot walk to is no plot for any
structure, and a town that cannot site a structure in its quarters stands it
on the open ground within the labour reach, as the blocks and the edge
buildings already did (`OPEN_GROUND_OWN_SITING` keeps fields, pasture, walls,
docks and waterworks on their own siting, each bound to its ground);
`OPEN_GROUND.spilled` counts them. The town's look over its unstarted plans
(`openGroundResite`) now also lays out again a plan whose plot the hall cannot
reach, and lands every re-sited plan on ground it can. The labour test asserts
that the open ground offers a clinic a plot within reach, that a sited clinic
is reachable, and that a foundation set in deep water within reach is laid out
again on walkable ground. The eight-year hash did not move (no town fills its
quarters in eight years). Variety-9 flew at 154 under it, its second town
becoming a city and taking current by 146; variety-19 did not, and the probe
run again, with new columns for the hall's walkable flood and what rejects
each candidate tile, read why.

**The wall of fields.** On variety-19's new road the second-city candidate at
year 130 was Wiliiakhhya, nineteen people and a village wanting a Civic hall,
and the ground its hall could be reached from was two tiles: six fields stood
on the eight tiles round the town's centre. A field is a solid body three
tiles square (42e) that nobody steps on, so the flood of 128 stopped at the
first hedge; of the 2,800 tiles within twenty-six of the centre, 1,405 lay
off the map, 792 were built on, 314 were water or rock, 167 stood past ground
the flood did not reach, and none was left. The other candidates were no
better: Yats, five people in twenty-five buildings on a pocket of 103 walkable
tiles, all of them built on. The effort's push for a second city asked
Wiliiakhhya for a hall every 128 ticks and was handed nothing, and it never
tried another town.

**The rule (138).** A field has a gate: a person walks across a field as
across any ground (the cliff rule of 96 still holds), a herd or a hunter still
does not, and the flood of 128 walks the same way (`movementTileBlocked` and
`constrainDevelopedMovement` overridden for people on a field's nine tiles).
The push for a second city (`modernPush("cities")`) now tries the towns in
order of size and works on the first where it can plan or supply anything the
stage still wants, passing over a town where every want is unplannable.
`FIELD_GATES.crossed` and `.passedOver` count them.

**The gate alone starved the phone worlds.** Measured first without more, on
the arcs behind the ship: phone variety-8 buried 63 in its sixties, 58 of them
starved, where the code before had buried seven; phone variety-3 buried 76 in
its eighties and nineties, 50 starved, where it had buried 25; battery
causal-origin held 89 people at year 131 where it had held 123 at 140. The
same decades came out to the person on a second press schedule (`88 2` against
`90 0`), so it was the road and not the press. The cause was the appetite: a
hungry person's search for food scores the tiles in reach by `tileFood`, the
standing crops are the richest tiles a town has, and with the hedge open the
hungry walked onto the fields and ate the crop as forage before it ripened.
Now a standing field holds no food to a person's appetite (`tileFood` for
"omnivore" reads nought on a farm's nine tiles), so nobody seeks the crops and
nobody eats them; a grazer reads a field as before and cannot enter it anyway.
The labour test raises a field in its fixture and asserts a person's step onto
it lands, a grazer's is blocked, the field reads as no food to a person and as
food to a grazer, and a person fed on the field takes nothing from its tile.
The movement rule acts from the first year, so the eight-year hash moved,
`7a2d4ecb` to `6d96cf30`, and is recorded with the sweep below. Variety-19 flies at 102 under it,
current in its second town at 97 where it had stood at the gate to 170;
variety-9 at 84.

**The sweep again, both sizes, 22 of 22.** Eleven seeds, 26 presses, lean, on
the code with the civic open ground, the field gates and the grazing guard;
this section's first baseline in brackets. Battery: causal-origin 64 (72),
ship-b 119 (110), ship-c 74 (80), variety-1 64 (60), variety-2 60 (84),
variety-3 141 (117), variety-4 80 (83), variety-5 74 (72), variety-6 105
(120), variety-7 86 (109), variety-8 72 (82). Phone: causal-origin 78 (75),
ship-b 63 (66), ship-c 83 (89), variety-1 60 (77), variety-2 59 (76),
variety-3 66 (64), variety-4 84 (73), variety-5 65 (73), variety-6 77 (124),
variety-7 64 (74), variety-8 74 (83). Every year moved, as a movement rule
moves every road; these lists are the baseline now, with the hash `6d96cf30`.
The arcs behind the ship: battery causal-origin flies at 97 and holds 117
people at year 119, ship-c at 77 and 192 at 142, phone ship-c at 72 and 153 at
110, phone variety-3 at 38 and 155 at 106, all four with nobody starved; phone
variety-8 at 61 and 273 at 105 with six starved. The gate alone had starved
variety-3 and variety-8; with the field no food to a person's appetite they
hold more people than under any code before, and the phone worlds' hunger
noted as open above is gone from these arcs.

**Thirty battery seeds, second run.** `scratchpad/sweep30-run.sh r8g 11` on the
shipped code (2f0bc03 and after). Twenty-six of thirty flew: causal-origin 64,
ship-b 119, ship-c 74, variety-1 64, variety-2 60, variety-3 141, variety-4 80,
variety-5 74, variety-6 105, variety-7 86, variety-8 72, variety-9 69,
variety-10 85, variety-11 69, variety-12 63, variety-13 74, variety-14 145,
variety-15 107, variety-16 66, variety-17 112, variety-21 318, variety-23 68,
variety-24 87, variety-25 61, variety-26 65, variety-27 67. The middle of the
twenty-six is year 74 where the first run's middle was 88; twenty-two fly by
125 where twenty-one did; variety-14, which died in the first run, flies at
145, variety-15, which stayed too small, at 107, and variety-21, which was
slow, at 318. Four did not fly in 26 presses, and they are not the four of the
first run, since a movement rule moves every road: variety-18 died (nine
people at year 584); variety-20 stands at 227 with 64 people and its skyline
of fourteen blocks short; variety-22 at 203 with 68 people, short of the
second city, of current in a second town and of a road; and variety-19's
twenty-six presses ran out at year 130, so many late crafts stopping them,
with 49 people and the same three wants, and forty presses ran to year 466
with 70 people and the same three wants; the paragraph after this one reads
why and mends it. Two of the four are the
world again, one too small to fill fourteen blocks and one that died; the
other two are the second-town road, which the mends above shortened for many
seeds and not for every seed. So the honest answer to "stable across seeds"
on battery-saver, lean, today: seven worlds in eight fly, most of them between
years 60 and 90; about one in fifteen is too small or dies; and about one in
fifteen stands at the modern gate past year 200 for want of a second city or
its skyline, where the next round's work is.

**A town with no room makes room.** The thirty seeds run again on the field
gates flew twenty-six (below), and variety-19, which the gate alone had flown
at 102, stood at the modern gate on its new road: forty presses ran to year
466 with seventy people and the same three wants, a second city, current in
a second town, a road. The second-town probe at year 200 read the candidate,
Yats, thirty-seven people in twenty-eight buildings wanting a Civic hall, on
a walkable pocket of 113 tiles every one of them built on or water or rock,
with 193 clear tiles beyond that nobody there could walk to; its own siting
and the open ground both handed back nothing, the push for a second city
passed it over and found no other town, and the world stood. Now a town that
cannot site a hall or a clinic its stage wants anywhere it can reach pulls
down a lesser building for the ground (`makeRoomFor`, 138): a monument first,
then a totem, a shrine, a wall, a second stockpile; the building falls the way
a building falls (`collapseBuilding`), its matter kept as rubble, and the
salvage that clears rubble when a plot is missing is queued for it; one at a
time, the next only when the last is cleared, and never a house, a field, a
workshop or a hall. `FIELD_GATES.pulledDown` counts them. The labour test
raises a monument in its fixture, asks for room for a hall, and asserts the
monument is ruined with its matter kept and a salvage order open, and that
nothing else falls while the rubble lies. The rule fires only where a stage
building can stand nowhere, so the eight-year hash stays `6d96cf30`.
Variety-19 under it:
its second city and current in a second town come by year 206, where forty
presses before had left it short of both at 466; at 254 it waits on the last
want, a paved road or rail between its two towns, and no road link exists
between them, which is the next reading.

**The sweep, both sizes, on the shipped code.** Eleven seeds, 26 presses, lean,
with the room-making: the same twenty-two years to the year as the sweep
above, since the rule fired in none of the twenty-two worlds; those lists and
the hash `6d96cf30` are the baseline.

**The road the ground allows.** Variety-19 under the room-making had its
second city and its current by year 206 and stood on the modern world's last
want, a paved road or rail between two towns, to year 466. A road probe at
year 210 (`scratchpad/road-probe.cjs`: the towns with their places, and for
every pair the distance and the land corridor under the first town's flag,
under none, and the sea corridor) read the two towns: Yats at the map's
western edge (1, 34), Tsyaiakhhya thirty-seven tiles east (38, 32), both
knowing Road Building, no link begun, and between them no corridor of any
kind: the enclave Yats stands in is walled by water and rock on every side,
so the road of 88 and the ferry of 136 could never join them, and the effort
asked for the road for ever with everything else done. Now, when no two
living towns can be joined by any corridor within a road's reach, the road is
not wanted and the gate closes on everything else (`modernLink` in 138,
`modernTownsJoinable` read once a tick at most); with fewer than two towns the
road is still wanted, and the gate's other wants say why. The labour test
asserts a lone town is neither joinable nor linked. The rule fires only at the
modern gate, so the eight-year hash stays `6d96cf30`. Variety-19 under it:
it flies at 84, its second city at 77 and current in its second town at 83,
where it had stood at the gate to 466.

**The sweep, both sizes, with the road waived where the ground forbids it.**
Eleven seeds, 26 presses, lean: the same twenty-two years to the year as the
two sweeps above, the waiver firing in none of the twenty-two worlds, and the
arcs behind the ship the same; those lists and the hash `6d96cf30` are the
baseline.

**Thirty battery seeds, fourth run.** `scratchpad/sweep30-run.sh r8i 11` on
the shipped code (1c23f9b and after), the session restarting twice under it
and six seeds run again to the same protocol. Twenty-six of thirty flew:
causal-origin 64, ship-b 119, ship-c 74, variety-1 64, variety-2 60, variety-3
141, variety-4 80, variety-5 74, variety-6 105, variety-7 86, variety-8 72,
variety-9 69, variety-10 85, variety-11 69, variety-12 63, variety-13 74,
variety-14 145, variety-15 111, variety-16 66, variety-17 112, variety-19 84,
variety-23 68, variety-24 87, variety-25 59, variety-26 65, variety-27 67. The
middle of the twenty-six is year 74 (88 in the first run); twenty-three fly
by 125 (twenty-one); the two that stood at the gate when this was asked,
variety-9 and variety-19, fly at 69 and 84, and variety-14 and variety-15,
which died or stayed too small in the first run, at 145 and 111. Four did not
fly in 26 presses: variety-18 died (nine people at year 584); variety-20
stands at 227 with 64 people and fourteen blocks short of its skyline;
variety-21 at 445 with 69 people, short of its skyline and its apartment
blocks (it flew at 318 in the second run, a movement rule having moved its
road); and variety-22's presses ran out at 163 with 76 people, short of the
second city, of current in a second town and of a road. Two are the world,
one too small to fill its skyline and one that died; two are the second-town
road and the skyline, where the next round's work is. So the honest answer to
"stable across seeds" on battery-saver, lean, on the shipped code: seven
worlds in eight fly, most of them between years 60 and 90; about one in
fifteen is too small or dies; and about one in fifteen stands at the modern
gate past year 150 for want of a second city or its skyline.

**Still open.** The labour reach is a literal twenty-eight in 30c's
`nearestWorkPlace`, and the open ground now keeps two inside it; any other
siting that reaches farther than the hands do would stall the same way, and
the re-siting above would catch it only for an unstarted plan. The eight-year
hash guards what changes from generation on and not a rule that first fires
in a grown town; a longer window would cost the fast suite minutes, so the
sweep stays the measurement. On the shipped code's arcs nobody starves on
four of the five worlds and six starve on phone variety-8, which doubles to
273 people by year 105; the hunger the earlier arcs showed (30 on variety-8,
23 on ship-c) belonged to the road before the field gates. The gas and the
tile nutrient ease as in section 16 (the litter holds the carbon; the rot was
rejected there). The predators die out by year 50 on battery causal-origin.
The war is as it was. Ship-c's lake has no water above its depth from year
40.

### 18. The press budget and the skyline the ground allows (2026-09-17; battery and phone only)

The round was asked for in two parts, the second first: raise the press
budget before believing a "none", and probe the skyline stall of the two
battery worlds that stood short of their blocks, mend it, sweep both sizes.

**Forty presses.** A press stops at every milestone, and a world learning its
late crafts stops one press a craft, so at twenty-six presses variety-22 ran
out at year 163 and variety-19 at 130 with their gates open, and read as
stalls when they were slow. `scratchpad/sweep-run.sh` and `sweep30-run.sh`
run forty presses now, and the measuring section says so; the lists of
section 17 and before were run at twenty-six. On the shipped code before this
round's mend, forty presses gave: variety-22 no ship by year 409 with 73
people, short of a second city, current in a second town and a road;
variety-20 no ship by 289 with 83 people and fourteen blocks short, the run
cut at thirty-three presses; variety-21 no ship by 277, cut at nineteen. So
variety-22 was a stall and not a slow world, and the other two were stalls
of their own kind, read below.

**The skyline stall.** `scripts/blocks-probe.cjs <seed:size:complexity>
<year>` presses a world to a year and reads every living town: its people,
stage and whether it is a city, the crafts a block wants, the blocks finished
by kind, the foundry's ledger for metal, catalyst and ceramic, where a tower,
a tenement and a factory could stand by its own siting and on the open ground
and, where neither finds one, what rejects each candidate tile by kind (water,
natural water, fire, a feature by type), and every unfinished block with its
want and where the want is, its hands, its order's priority and its plot. On
variety-20 at year 150 the target had been "skyline" for 377 pushes since year
55: three cities of 29, 32 and 11 people with five blocks, five apartment
blocks and five factories among them against a want of fourteen, every craft
known, the foundry short of nothing, and no city able to site a tower, a
tenement or a factory anywhere it could reach. Of the tiles within twenty-six
of the three towns, 991, 1,106 and 962 were water, 851, 789 and 599 were
built on, 20, 108 and none stood past ground the town could not cross, and
none was left; the forest, which the living grove walks onto open ground,
took only 13 to 23 tiles a town. The towns stand on a coast that is nine
tenths sea within reach, every dry tile they can walk to carries a building,
and the effort pushed the skyline for a hundred years at towns that had
nowhere to put it. Variety-21 at 150 read the same for its one city (36
people, two blocks, no plot for any kind) with its two villages of 10 and 14
unable to become the second city, one of them on a two-tile flood.

**The rule (138).** A world asks of itself only what its ground allows, as
the road rule of section 17. When no city can site another block of a kind,
the want for that kind is what stands and what is already planned
(`modernSkylineWanted`, `modernHomesWanted`); where any city has room the want
is the seed's, so a world with ground is still asked for its skyline. The
room (`modernCityRoomFor`) is a function of the buildings that stand, are
planned or lie in ruin, and of the ground, which drifts by the year; it is
kept beside the world, keyed on those counts and the year, so reading it
writes nothing to the world (a first cut kept it on `W.civilization` and the
plain-words test caught the gate's reasons changing the world hash) and a
saved game reads the same answer for the same buildings. `FIELD_GATES
.skylineBounded` and `.homesBounded` count the reads the bound held. The
labour test asserts the wants never fall below one and that a city with room
is asked the floor. The rule fires only at the modern gate, so the eight-year
hash stays `6d96cf30`. The three worlds under both bounds:
variety-20 flies at 76, where forty presses before the bound had left it
fourteen blocks short at year 289; variety-22 at 123, where they had left it
at 409; variety-21 came within one apartment block of the gate at 181 and
then died, eleven people and no town by 735, a world's end and not the
gate's.

**The towns the world has.** Variety-22 stood at the gate from year 110 to
409, forty presses and all (the control run at forty presses on the code
before this round), for a second city, current in a second town and a road.
`current-probe` at year 200 read one living town in the world: the launch
site, Nga-pruap, twenty-three people in eighty buildings, city, current and
every craft known, and fifty people more in no town at all (the launch record
counts 73 people and 20 in towns); the push for a second city had no town to
work on and passed over nothing for three hundred pushes. A world of one town
is now asked one city and current in one town (`modernCitiesWanted`,
`modernElectricWanted` bounded by the living towns, 138), and no road (the
fewer-than-two-towns case of `modernLink`, which section 17 had left wanted);
the people the gate wants in towns, its skyline, its works and the ship's own
city are asked as before. The labour test asserts a lone town is asked one
city, current in one town and no road. Why the world has one town is the
next reading: fifty people in bands and camps and a hub of twenty-three
below the settler line.

**The sweep, both sizes, at forty presses.** Eleven seeds, lean, on the
shipped code: the same twenty-two years to the year as section 17's baseline
(battery causal-origin 64, ship-b 119, ship-c 74, variety-1 64, variety-2 60,
variety-3 141, variety-4 80, variety-5 74, variety-6 105, variety-7 86,
variety-8 72; phone 78, 63, 83, 60, 59, 66, 84, 65, 77, 64, 74), neither
bound firing on those seeds, the arcs behind the ship the same, and the hash
`6d96cf30`; those lists stand as the baseline at forty presses.

**Thirty battery seeds at forty presses.** Running on the shipped code as this
was written (`scratchpad/sweep30-run.sh r9d 11`); recorded in the commit that
follows this one.

**Still open.** Why variety-22 is a world of one town: seventy-three people
and twenty in the town, the rest in bands and camps that never became a
settlement while the hub sat below the settler line; the founding rules (30a
camps, `SETTLER_MIN_POP`, the pull of the city of 108) are the next reading.
The bounds above let a small coast or a lone city fly with the skyline it has;
a world with ground is still asked the seed's skyline, and the thirty seeds
below say how often each case comes. The thirty-seed evidence is battery
only; thirty phone seeds are still to run. Variety-21 died with one apartment
block to go: a planned block counts toward the bounded want, and a world that
falls before it is built falls; whether a plan nobody can build should hold
the gate is a question for the thirty seeds. The war, the predators
dying out by year 50, and the gas easing are as they were in section 16.

## The recent commits, newest first

```
87ba118  The skyline the ground allows, and the towns the world has: a gate asks for no block the cities have nowhere to put, and of one town asks one city
1c23f9b  A world asks of itself only what its ground allows: no road is wanted where no two towns can be joined
2c1d1be  A town with no room makes room: a monument comes down for the hall a second city wants
2f0bc03  A field has a gate: a townsperson crosses it, a herd does not, and the effort builds its second city where there is room
43685d8  A second town's clinic stands on the open ground when its quarters are full or cut off, so the world gets its second city
c0a8a67  The pre-ship road is frozen: a baseline hash guards the launch lists
8c1f3c9  A plot the hands cannot work is no plot: the open ground stays within the labour reach, and a far foundation is laid out again
67d7e50  A plan whose want has no source is set aside for a year, and the next plan is taken
9657892  The sky is tended before the ship
3912cf3  A craft the world holds is carried where its facility will not rise, and a probe reads what a launch site waits for
d5f8a5f  The pull of the city follows the place a ship would leave from
a86fa5f  The litter does not rot: the ground decomposer halved the plants and put the ship back forty years
b4fec9c  Reading the launch blockers no longer chooses the launch site
e57e898  Behind the ship a hoard in the gut comes home to the hall
c4b9080  Behind the ship the effort turns to the next craft within the press
09b4ec2  The land stops drifting: the living loop returns its water, the sky breathes, the land cools to its climate, bodies pass their surplus nutrient to the ground, and litter rots
c624dec  Probes: a hydrology ledger by year, and the transit probe reads the crafts the world holds
9c89061  Before the ship the sky is as it was; behind it the ledger is tended
edab634  Industry strains the sky where it runs, and the effort tends the sky from the first spell it can force
cea9769  A tended town offsets more than itself, and the effort carries the sky crafts town to town
1a3d232  The sky can clear, and behind the ship the effort tends it
8094ba6  Transit probe: the land each year, and the sky switch gated behind the ship
39f39b4  Probes: the famine probe takes a seed and steps to a year; the transit probe reads the sky
3833751  Behind the ship a day's meals from the store are one gut's worth a person
5ebc8bc  Record the round that fixed the rest: the cradle, the seed, the mouths, the ration, and what is still open
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
