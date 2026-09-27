# Causalis — Universe Architecture Plan

*2026-09-25 · planning document, no implementation · written against commit 0f09fcd*

This document plans the architecture for the observatory-first, deterministic,
multi-scale causal universe described in the design brief. It was written
after reading the current repository (185 sections, the kernel, the save
system, the event log, cohorts, world generation, space, rendering, tests and
HANDOFF.md). Every claim about the current code cites a section and line so it
can be checked.

Section numbers 1–40 follow the brief's planning task. The phased roadmap is
Part VII and the requested deliverables A–O are Part VIII.

**Decisions taken (2026-09-25)**

| Question | Decision | Where it shapes the plan |
|---|---|---|
| Classic's future | **Frozen.** Built beside, not developed further | §0.4, §40 |
| Faster-than-light travel | **No. Sublight only**; communication at light speed | §26, §27 |
| What is the player | **God and observer.** No player civilization | §3.1 |
| Is observation an act | **No, never.** The microscope *watches* a shadow of history; only the god's *hand* (a logged act) makes a place authoritative | §8, §9 |

---

## Part 0 — Where the project actually stands, and the verdict

### 0.1 What exists (measured)

| Fact | Value | Where |
|---|---|---|
| Game code | **87,015 lines in 185 sections**, one closure | `src/game/sections`, `scripts/compose-runtime.cjs:19-25` |
| Rough split | ~71k simulation, ~12.5k Canvas drawing, ~3.5k DOM UI | line classification by `ctx.`/DOM calls |
| Scale | one tile map, 72×44 (battery) to 300×180 (vast) | `01-configuration.js:21-28` |
| Time | 256 ticks per year, integer tick | `01:10` |
| People | full agents capped at 250 × (1…2.2 by map area); overflow folded into cohorts | `01:30-38`, `68:87-93` |
| Cost | ~0.2 ms per person per tick; battery fixture 7.5 ms/tick, phone 16 ms (p99 88) | `150:8-10`, HANDOFF §37 |
| Randomness | stateless keyed hashing, `counterRand(tag, tick, id, purpose, attempt)`, 106 sites; no `Math.random` | `04:44-59` |
| Species | fixed kinds (herbivore, predator, person); 13 fixed-function scalar genes | `01:68-77`, `10:14-56` |
| Body plans | exist **only in the renderer** (32c derives topology from genes) | `32c:21-141` |
| Technology | ~104 hand-authored crafts behind prerequisites, stockpiles, facilities, observed events | `02:554`, `30a:22`, `87:73`, `106:73-815`, `30f:169-291` |
| Space | 6–9 star records, statistical colonies, a star `seed` field nothing reads | `85:50-82`, `107:72-236` |
| Planet | none above the map; climate from normalized map x/y; sea level is a quantile of the whole map | `06:1336-1350`, `06:1376-1418` |
| Events | `emitEvent` with `causes` (ids) + `evidence` (prose); cap 4,200 | `15:4-34`, `01:11` |
| Saves | shallow copy of all of `W` as JSON; 8.9 MB at year 66 (battery); no compression | `05:403-421`, HANDOFF:957 |
| Rendering | Canvas 2D only; 1,519 `ctx.` calls in 30 sections; render reads `W` directly | `32:4`, `32b:2097-2198` |
| Worker | measured and rejected: render + panels read 9.6 of 11.4 MB of `W`; cloning it costs 64 ms | HANDOFF:4426-4433 |

### 0.2 What is genuinely good and must survive

- **Keyed, stateless randomness.** `counterRand` is already the right design
  for order-independent sampling. The new kernel generalizes it rather than
  replacing it.
- **Determinism discipline.** No `Math.random`, a whole-world hash, a refactor
  oracle with checkpoint hashes, save-continuation tests, and a culture of
  A/B probes on 11+ seeds.
- **Explicit ordering.** The tick registry (`16:19-55`) with registration
  order as part of the world, `eventText` and `pageBlock` registries. Order
  keys become literal in the new scheduler.
- **Conservation as an audited invariant** (`auditMatter().delta === 0`).
- **Plain-words narration** (129) and the observatory's product ambition
  (Legends, lenses, trends, why-trees).
- **The tuned knowledge.** Months of measured behaviour (famine cycles,
  concerted effort, launch roads, food levers) are calibration targets for
  the new systems even where the code is not reused.

### 0.3 What conflicts with the brief (the problems, stated plainly)

1. **The 100k budget is already 87% spent on one scale.** Everything above
   the map (planet, star system, galaxy, interstellar polities) is either
   absent or a thin statistical layer. Adding 13k lines to this closure
   cannot produce the "complete shape" of the vision.
2. **Every system assumes one world at maximum detail.** 98 loops over
   `W.activeIds` in 53 files; labour is per agent every tick (~44–50% of the
   tick); population is capped by *agent count*, not by an attention budget.
   There is no representation for a billion people, only a cap and an
   overflow cohort.
3. **Identity is not stable across detail levels.** `materializeCohort` mints
   a fresh id, gives the cohort-mean genome and the youngest age bin's
   midpoint (`12:288-343`); the folded person survives only as a pruned
   `historicalIdentities` record. The brief needs the opposite: a person
   resolved on demand must have *always* existed.
4. **Observation already changes history.** `bankDormantFounder` refuses to
   bank the followed or selected creature (`20:256`); a follow-interrupt
   breaks out of the life loop so the rest of that tick's lives do not run
   (`20:630`); phones default to "lean" complexity, which changes the number
   of full agents per town (28 vs 40, `150:54`, `44:489`). Same seed, same
   commands, different history depending on what you look at and what
   device you use.
5. **Most recorded causes are guesses.** Of 254 `emitEvent` calls, 102 cite
   `W.lastEventByType.X` — the newest event of that type *anywhere in the
   world* — and 36 cite "the last event on this tile". The why-tree the
   player sees is often false. Causes are not in the world hash, so bad
   provenance is never detected. Much state changes with no cause at all
   (research progress, relation edges, the causal push).
6. **Inputs are not all commands.** The Causal skip's push adds materials,
   bumps research and halves birth cooldowns (`79:21-202`) and is not in the
   command log; the skip's stop point depends on the wall clock and the
   user's cancel. A "seed + ruleset + commands" save cannot exist until every
   input is a logged command.
7. **Render and simulation are fused.** One closure, 711 function-reassignment
   overrides, 22 sections that both register tick systems and draw, sim code
   that calls `refreshUI`/`showEnding`, render code that writes `W`
   (`peekPhenotype`, `normalizeCivilizationAuthority` from `refreshUI`). This
   is why the Worker was rejected, and it is why PlayCanvas cannot be dropped
   in underneath.
8. **Cross-device determinism is unguarded.** 464 transcendental `Math.*`
   calls (`sin`, `cos`, `exp`, `pow`, `log`, `atan2`…), 30 of them in world
   generation. V8 (Chrome, Node) and JavaScriptCore (Safari, iOS) do not
   promise identical last bits for these. Today saves carry the whole world,
   so it has not bitten. The moment planets and galaxies are *regenerated
   from seed* instead of saved, an iPhone and a desktop will disagree.
9. **Conservation is defined at tile-chemistry resolution** (32 species ×
   Uint16 per tile). That cannot scale to planets. Conservation has to be
   redefined per scale.

### 0.4 The verdict

**Keep the discipline, replace the backbone.** The recommendation is a
strangler migration:

- The current game is frozen as **Causalis Classic**. It keeps building,
  testing and deploying unchanged (at `/classic/` once the new app takes the
  root URL).
- A new TypeScript application, **Causalis Universe**, is built beside it with
  the kernel, the scale hierarchy, the Causal Field, the worker boundary and
  a PlayCanvas renderer designed in from the start.
- Classic is a **quarry, not a foundation**: its rules, tuning constants,
  event vocabulary, narration and observatory ideas are *ported deliberately*
  into the new modules. Its local agent simulation becomes the model for the
  new **active window** engine (the microscope), rewritten species-generic
  and data-oriented.

Hosting the old closure inside the new architecture was considered and
rejected: it would import its single global `W`, its interleaved DOM code, its
fixed three kinds, its unstable identities and its override chains into the
foundation you are trying to fix. The one place it is worth doing is an
*optional* Phase 0 spike (run Classic in a worker behind a DOM shim and stream
a snapshot to a PlayCanvas renderer) to measure snapshot size and iPhone
render cost on real data before committing to the renderer design.

**Decided 2026-09-25: Classic is frozen.** It is not developed further, and
its known defects (below) are designed out of Universe rather than patched.

### 0.5 Contradictions inside the brief, and how this plan resolves them

| Tension | Resolution |
|---|---|
| "Detail is resolution-dependent" **and** "rendering must not change results" **and** "same seed + commands = same history" | Split **authority** (who computes the truth) from **detail** (how much of the truth has been resolved for viewing). Observation may raise detail, never authority. The microscope *watches* a shadow copy whose irreversible outcomes come from history; only the god's *hand* (a logged act) makes a place authoritative, with a budget identical on every device. §8, §9 |
| The brief's levels 0–5 mix fidelity and information | Levels 0–4 are information depth; level 5 is a simulation mode. They become two orthogonal axes. §8 |
| Lazy people must be exactly conserved **and** order-independent **and** cheap | These three cannot all hold when individuals move between cells stochastically (the *conservation trilemma*, §10). The plan keeps exactness and cheapness, and makes the order-dependence harmless by keeping observed facts out of the simulation's inputs. |
| "Frame rate must not change outcomes" **and** fast-forwarding a watched region | Speed never changes authority. A watched window is presentation, so fast-forward simply suspends it. A place under the god's hand is computed at its fidelity no matter how fast you ask for time; to go faster you lift the hand (a logged act). §7 |
| "Procedural technology, not a tech tree" **and** "mechanically grounded" | Pure combinatorial invention produces noise. Author a compact grammar of *principles*; generate their *realizations* per civilization. §22 |
| "Billions of inhabitants" **and** "inspect any person" **and** "saves stay small" | People below observation are counts. A person gains identity when first resolved, and only then costs storage (~100–300 bytes). §9, §14 |
| `Event { … causes, effects … }` | Store causes on the effect only. A stored `effects` list doubles every edge and drifts out of sync; the forward index is built lazily. §12 |
| "The Causal Field" as one mechanism | It is four cooperating parts — fact store, cause ledger, macro history, observer ledger — plus an explainer. The name is kept as the product concept. §11 |

---

## Part I — Philosophy, ownership, boundaries

### 1. Overall architectural philosophy

1. **One universe, many authorities.** There is one causal state space. Each
   region of it is computed by the cheapest authority that preserves the
   facts the rest of the universe depends on: *latent* (pure generator
   output), *aggregate* (stocks and flows), *tracked* (compact explicit
   records) or *active* (agents under the microscope).
2. **Grammars over catalogs.** Bodies, cultures, institutions, technologies
   and designs are compositions of a small set of primitives plus constraints.
   A new thing is new data, not new code.
3. **Mechanisms in code, parameters in data.** Data never grows an expression
   language. If a rule needs logic, it is a named TypeScript function referenced
   from data.
4. **Pure where possible, owned where not.** Generators, resolvers,
   explainers and view-spec builders are pure functions. Mutable state has
   exactly one owning system, which writes it only in its commit phase.
5. **Causes are recorded at the point of decision, not guessed afterwards.**
   A system that changes important state states *why*, in typed references,
   when it makes the change.
6. **Observation is read-only.** The observatory, the renderer and the camera
   cannot change the authoritative future. This is tested, not assumed.
7. **Breadth first, then depth.** Every phase extends the pipeline end to end
   before any single layer is deepened. Classic grew to 87k lines at one
   scale; the new architecture must not repeat that.
8. **Budgets are architecture.** Every layer has explicit memory, time and
   storage budgets, and the device changes only presentation budgets.

### 2. Major package / module boundaries

One TypeScript package, with folders as modules. Each module exposes a public
`index.ts`; imports across modules go only through it, and the dependency
direction is enforced by lint (dependency-cruiser or eslint-plugin-boundaries).
A monorepo with workspaces was considered; for a one-person, AI-assisted
codebase, folder modules with enforced boundaries give the same isolation with
less tooling.

```
kernel      ids, rng, dmath, time, scheduler, stores, ledgers, hashing, serialization
  ↑
rules       data tables, schemas, generation priors (Earth prior), balance constants
  ↑
gen         pure generators: galaxy, star, planet, geology, climate, deep-time life,
            species, cultures, languages, names, region refinement
  ↑
sim         authoritative systems by domain: planet, ecology, population, economy,
            polity, culture, tech, design, conflict, space, acts, microscope
  ↑
causal      cause ledger, decision records, history retention, macro history,
            observer ledger, resolvers, explainer
  ↑
host        the sim host: command intake, tick driver, snapshots, queries (runs in the worker)
  ↑ (messages only)
bridge      protocol types + client (main thread) + in-thread fallback transport
  ↑
view        pure view-spec builders: sim facts → VisualSpec / PageSpec / ChartSpec
  ↑
render      PlayCanvas adapter: VisualSpec → meshes, instancing, cameras, LOD
ui          observatory DOM: pages, instruments, navigation, text
app         boot, device tier, settings, save UI, input routing
tools       oracle, probes, determinism runner, perf, codemods (never shipped)
```

Rules the lint enforces:

- `kernel` imports nothing.
- `gen`, `sim`, `causal` never import `bridge`, `view`, `render`, `ui`, `app`,
  never touch `window`, `document`, `performance`, `Date`, `Intl`.
- `render` and `ui` never import `sim` or `causal` — they see only `bridge`
  types and `view` specs.
- `view` is pure and imports only `bridge` types and `rules`.

### 3. Authoritative simulation ownership

- One `Universe` object, owned by the sim host, lives in the worker.
- Every piece of authoritative state has **one owning system**, declared in a
  registry (`owner: "population"`). Other systems read it through the owner's
  exported read views. Writes happen only in the owner's commit phase (§7).
- **The only inputs are commands.** Divine acts, laying and lifting the hand
  (§9), time-control boundaries and save-point markers all enter one command
  queue and are stamped with the tick at which they apply.
- **The only outputs are snapshots, query replies and notifications.** None
  of them can be used to write back.
- Anything a system needs from the UI (like "the player is following X") is
  either a command (if it should matter) or not available (if it should not).

### 3.1 The player: god and observer

Decided 2026-09-25. There is no player civilization; every polity is run by
the simulation. The player holds two roles and moves between them freely.

- **Observer.** Navigate, inspect, resolve, follow, watch through the
  microscope, set watches ("tell me when this city starves"), bookmark,
  time-lapse, compare. None of it is a command, and all of it is pure
  (invariant 2).
- **God.** Divine acts, each a logged command stamped with its tick. Acts are
  a grammar, not a list: *target scale* (person, household, place, province,
  planet, star system) × *domain* (weather and climate, fertility and harvest,
  disease and health, matter and terrain, knowledge and inspiration, omen and
  belief, fortune) × *sign and magnitude* × *duration*. An act works through
  the owning system's ordinary inputs — a rate on a province's harvest, a
  field change on a planet cell, a knowledge grant to a settlement, an omen
  event the belief system reads — so its consequences are the simulation's
  own, not scripted.
- **Acts are causes.** An act is a `CauseRef` of kind `command` with role
  `agent`, and the explainer shows it like any other cause: "the famine of
  1204 ← the drought ← *your withholding of the rain over Tolvey*".
- **Civilizations can notice.** Visible acts emit omen events that the belief
  system (§19) reads, so real divine acts can found cults, reform faiths, or be
  blamed for disasters. (Classic's divine acts, 54, and faith, 71, already
  point this way.)
- **Pure runs are canonical.** A universe with an empty command log is its
  seed's canonical history: two people with the same seed who never act see
  the same universe, whatever they look at. The first act forks it, and the
  save header records the fork tick. Seeds become shareable.
- **Classic's Causal skip** splits into a pure *advisor* (what the world is
  working toward and what it lacks) and explicit acts ("gift", "inspire") that
  are logged like any other. Its unlogged pushes (`79:21-202`) are not ported.
- Whether the god has limits — unlimited, a power budget, or power drawn from
  belief — is open (O-13).

---

## Part II — The kernel and the Causal Field

### 4. ECS versus specialized data structures

No generic ECS library. Each authority tier gets the structure that suits its
access pattern.

| Data | Structure | Why |
|---|---|---|
| Active-window agents (microscope) | Struct-of-arrays component columns (typed arrays) over dense handles; sparse sets for optional components | Thousands of homogeneous entities iterated every step. Classic keeps one JS object per component per entity (`06:750-764`), which costs GC churn and cache misses. |
| Aggregate cells (population, ecology, economy) | Dense tensors: `cell × category` in `Int32Array`/`Float64Array`, one table per domain | Updated in bulk on cadences; trivially hashable and serializable. |
| Tracked records (notables, firms, armies, ships, cities) | Record tables (plain objects are fine at ≤50k) keyed by `Ref` | Few, heterogeneous, slow cadence. |
| Planet surface | Icosahedral geodesic grid (level 6 ≈ 40,962 cells), cell fields in typed arrays, CSR neighbour lists | Even cells, no pole distortion, one indexing scheme for climate, ecology and provinces. |
| Active-window terrain | Chunked tile fields (32×32 chunks, dirty flags) | Streaming to the renderer by chunk; mirrors Classic's tile columns. |
| Transport, trade, supply, star lanes | CSR graphs for static topology; edge attribute arrays; small adjacency maps for dynamic edges | Flow solvers iterate edges. |
| Relationships, genealogy | Adjacency maps on refs, only among resolved/tracked people | O(n²) is only affordable among the few. |
| Technology | Principle graph (static DAG from data) + per-civ capability vectors | Requirement checks are vector comparisons. |
| History | Append-only columnar event chunks (per era × region block), tombstones, summaries | Paged from IndexedDB; the whole past is never resident. |
| Galaxy | Hierarchical procedural index: disk sectors → star slots computed from hash | Untouched stars cost zero bytes. |

### 5. Stable entity identity

A `Ref` is `(kind, a, b)`: a kind tag plus two integers. At API boundaries it
is the string `"per:4821:17"`; inside hot structures it is interned to a dense
per-session `u32` handle (handles are never saved; refs are).

There are two classes of identity, and the distinction is the most important
rule in this section:

- **Structural refs** are *computed from origin*: star = (sector, slot);
  planet = (star, orbit index); surface cell = (planet, cell index); clade =
  (planet, clade path); an observed person = (observer ledger, sequence).
  Anything that can be generated or resolved lazily has a structural ref,
  because its identity must not depend on when or whether it was looked at.
- **Minted refs** come from per-kind counters and are created *only* by the
  authoritative simulation, in deterministic order: a settlement founded, a
  polity formed, an army raised, a ship built, a war declared, an event
  emitted.

Invariants:

1. **Resolvers, generators, the observatory and the renderer never mint.**
   (Classic's `genomeFrom` hashes `W.nextEntityId` into lineage ids; any code
   that read it during observation would shift every later id.)
2. Refs are never reused. Removal leaves a tombstone kind.
3. Cross-references are refs, never object pointers. A dangling-ref audit
   runs in tests (Classic's `removeEntity` does not clean partner, relation
   or unit references, `09:10-17`).
4. Hash-derived ids are allowed only with a stored origin that is checked on
   materialization (64-bit hashes; collision = hard error in tests).

### 6. Deterministic RNG architecture

Keep Classic's model — **randomness is a pure function of a key** — and
formalize it.

```
draw(stream, subject, time, purpose, n) -> uint32
  = mix64( seed, rulesetSalt[stream], subject.a, subject.b, time, purpose, n )
```

- **Universe seed**: a 64-bit value from the player's seed text.
- **Streams**: a registry of literal stream tags (`"pop.death"`,
  `"gen.plates"`, `"war.combat"`), each with a salt. A lint check rejects a
  duplicate tag. A salt changes only when that stream's semantics change,
  which keeps unrelated streams stable across ruleset versions.
- **Entity-derived**: the subject is the ref the draw is about.
- **Event-derived**: the subject is the event ref (all draws inside resolving
  a battle key on the battle).
- **Time-derived**: the tick or the cadence period index.
- **Local generators**: a short-lived xorshift/PCG seeded from one `draw` is
  allowed inside a single function call (like Classic's `makeRng`). It is
  never stored, never shared between entities, and never outlives the call.
- **Order-independent sampling primitives** in the kernel:
  - *select k of n*: take the k smallest `draw(subject_i)` (ranked keys).
  - *weighted choice*: exponential keys `−log(u)/w` (with `dmath.log`).
  - *Bernoulli with rate p*: `draw < p·2³²`.
  - *keyed permutation of [0, N)*: a 4-round Feistel network with
    cycle-walking, O(1) per lookup, no storage.
  - *integer apportionment*: largest-remainder with keyed tie-breaks
    (splitting 1,000 people into occupations sums exactly to 1,000).
- The hash is 64-bit (two 32-bit lanes with `Math.imul`), because 32-bit keys
  collide once the universe holds more than ~10⁵ keyed things.

**Deterministic math (`dmath`).** JavaScript gives bit-identical results
across engines for `+ − × ÷`, `Math.sqrt`, `Math.fround`, `Math.imul`,
`floor/ceil/round/trunc/abs/min/max/sign`, integer bit operations, `toFixed`,
`parseFloat` and number-to-string. It does **not** for `sin cos tan asin acos
atan atan2 exp expm1 log log1p log2 log10 pow cbrt hypot sinh cosh tanh`.
`dmath` implements those with fixed polynomial/rational approximations built
only from the exact operations, verified by golden vectors. A lint rule
forbids the native ones in `kernel/gen/sim/causal`. The renderer may use
native `Math` freely.

*Measured 2026-09-25 (milestone 2):* 240,000 native `Math` results (sin, cos,
tan, exp, log, atan, pow, cbrt, sinh, tanh, expm1, log1p) compared with Node's:
Chromium 153 differed on 21,179, WebKit 26.6 on 26,646 and Firefox 155 on
11,694. The 2,031 `dmath` golden vectors are identical on all four.

Other determinism traps the lint and code review must catch:

- `Array.prototype.sort` without a comparator (sorts as strings) or with an
  inconsistent comparator (NaN, non-transitive). Sort with total-order
  comparators, ties broken by ref.
- `localeCompare`, `Intl`, `Date`, `performance.now`, `WeakMap`/`WeakRef`
  keyed sim state (GC-dependent — Classic had one, `LABOUR_PLANNED`, fixed
  2026-09-23), `crypto.getRandomValues`.
- Float accumulation order: sums over sets are taken in canonical ref order.
  Conserved quantities are integers.
- Hashing serialized objects: key order is insertion order, so hash by a
  canonical walker (as `worldHash` does), never by `JSON.stringify`.
- Memo caches whose eviction depends on memory or timing must be pure: a hit
  and a miss return the same value.

**The guarantee we can realistically make** (put this in the README):

> Bit-identical authoritative history across V8 (Chrome, Edge, Node),
> JavaScriptCore (Safari, iOS) and SpiderMonkey (Firefox), for the same seed,
> ruleset and command log, verified in CI by comparing checkpoint hash chains
> on all three engines. Presentation (rendering, animation, audio, layout) is
> not covered and may differ by device.

### 7. Simulation scheduling and clocks

**Time.** Two clocks:

- `SimTime`: integer game seconds since the start of the simulated era (2⁵³ s
  ≈ 285 million years; plenty).
- `DeepTime`: integer years, used only by the generators for prehistory
  (planet formation, evolution). Prehistory is *generated*, not ticked.

Each authority declares its own step length in `SimTime`. Classic's tick is
1/256 of a year (~34 hours); the new active window will likely step at an
hour or less, with presentation interpolation for motion.

**Structure.** One deterministic driver with three mechanisms:

1. **Phased steps.** A step runs a fixed list of phases with literal order
   keys (`"040.population"`, `"060.economy"`), keeping Classic's lesson that
   order is part of the world — but written down, not implied by manifest
   position.
2. **Cadenced systems.** A system declares `every` (period in SimTime) and a
   **stagger** keyed by ref: settlement *s* runs its monthly update at
   `period·k + hash(s) mod period`. The load spreads evenly and the choice of
   day is a pure function of identity, never of array position.
3. **A timed event queue** for things that happen at a moment: an army
   arrives, a ship docks, a harvest ripens, a treaty expires. Total order:
   `(time, orderKey, subjectRef, sequence)`.
4. **Analytic systems** are not scheduled at all: orbital positions (Kepler),
   stellar luminosity over time, seasonal insolation are functions of time.

**Compute-then-commit.** Aggregate systems read state *t*, compute deltas
into buffers, then commit. Within a phase, iteration order cannot matter.
That makes systems independent to add, opens parallel/WASM paths later, and
avoids Classic's "swapping two systems moves the hash within 128 ticks".
The active window may use sequential (Gauss–Seidel) updates internally, in
canonical handle order, because agents interacting within a step is the point
of the microscope.

**Illustrative cadences** (tuned by profiling, not decreed):

| System | Cadence |
|---|---|
| Active-window agents | every active step (≈1 game hour), sliced across frames |
| Household economy, needs (aggregate) | daily |
| Markets, prices, trade flows | daily (regional), weekly (interregional) |
| Demography (births, deaths, ageing, migration) | monthly flows, yearly ageing |
| Ecology (guild populations) | seasonal |
| Culture drift, belief | yearly + event-driven |
| Politics, diplomacy | monthly + event-driven |
| Technology / knowledge | monthly + event-driven |
| Conflict operations | daily during wars; engagements event-driven |
| Climate anomalies | yearly |
| Geology | event-driven (eruptions, quakes), otherwise analytic |
| Stellar evolution, orbits | analytic |

**Speed and fidelity.** The player chooses speed; speed never changes
authority. A *watched* window is presentation (§9), so fast-forward simply
suspends it and re-materializes it when time slows. A place under the god's
*hand* is computed at its fidelity no matter how fast you ask for time; if the
device cannot keep up, time runs as fast as the device computes it, and the UI
offers to lift the hand (a logged act). A phone computes the same future more
slowly, as the brief requires. Classic's sliced tick
(`16:67-123`) is the right mechanism for keeping frames alive in-thread and
carries over.

### 8. Multi-resolution simulation

The brief's levels 0–5 mix two different things: *how the truth is computed*
and *how much of it has been written down*. They become two axes.

**Axis A — authority tier (how the truth is computed; decided by simulation state and commands):**

| Tier | Name | What it is | Examples |
|---|---|---|---|
| A0 | Latent | Pure generator output; no state | untouched stars, never-visited planets, prehistory |
| A1 | Aggregate | Stocks and flows over cells | population by province × class × age band; guild biomass; sector output; forces |
| A2 | Tracked | Compact explicit records, slow cadence, members of A1 cells | rulers, generals, dynasties, firms, cities, armies, fleets, ships |
| A3 | Active | The microscope under the god's hand: agents, tiles, local physics | the district or village the god has laid a hand on |

**Axis D — detail depth (what has been resolved for viewing; pure):**

| Depth | Contents |
|---|---|
| D0 | statistics only |
| D1 | identity: name, sex, age, birthplace, appearance seed, parents (as refs) |
| D2 | social: household, occupation, employer, wealth band, memberships |
| D3 | personal: personality, skills, beliefs, health, important possessions |
| D4 | biography: life events with causes, memories, relationships over time |

**The rules that make this consistent:**

1. Observation (zooming, selecting, following, opening pages, the camera's
   area of interest, *watching* through the microscope) raises **D**, never
   **A**.
2. **A** changes only by simulation rules (a person becomes a ruler, a
   company becomes large, a battle becomes historic) or by a logged command
   (the god's hand on a place, a divine act on a person).
3. The **A3 budget is a ruleset constant** — one hand window of ≤2,000 agents
   and ≤128×128 tiles — identical on every device and sized so the phone floor
   runs it at 1× speed. The *watch* window's budget is a presentation budget
   and may differ by device, because nothing it computes is history.
4. **Promotion** A1→A2 and **demotion** A2→A1 are deterministic sim events
   with causes. **Laying** the hand (A1→A3) and **lifting** it (A3→A1) are
   commands with a reconciliation step (§9). Watching is neither.

### 9. Aggregation and materialization

Three transitions, each with a contract.

**Promotion (A1 → A2).** A sim rule needs an individual (a new polity needs
a ruler; a war needs a general; an invention needs an inventor). The system
*collapses* one member from the cell's latent pool (§14) with sim-owned draws,
claims its slot in the cell's budget, and creates a tracked record. The
record's facts are sim facts: they can influence the future.

**Demotion (A2 → A1).** A tracked record that no longer matters (a retired
general, a failed firm) is folded back: its counts return to the cell,
its biography is kept only if something important references it (§32), and
its ref becomes a tombstone that still answers "who was this".

**The microscope has two modes, and they run the same engine.**

**Watch (a shadow window) — pure observation, the default.**

1. Opening the microscope over a district, a village or a battlefield
   collapses its resident households through the observer ledger (§14) and
   copies its stocks, buildings and terrain from the authoritative state.
   Terrain is refined from the planet cell (§24).
2. The active-window engine runs on this **shadow copy**: people walk, work,
   eat, talk and trade, as in Classic.
3. **Irreversible outcomes are imported, not produced.** Births, deaths,
   migrations, foundings, destruction and discoveries happen in the shadow
   only when the authoritative history records them, applied to the watched
   people with their own keyed draws (§14, *later*). The shadow's own
   attempts at irreversible outcomes are suppressed.
4. At each aggregate period boundary the shadow re-syncs to the authoritative
   state (counts, stocks, buildings). Nothing flows back. The shadow's
   moment-to-moment incidents are visual and never enter the chronicle.
5. The shadow's size is a presentation budget: a phone may watch a smaller
   window than a desktop.
6. Fast-forward suspends the shadow; it is re-materialized when time slows.

**Hand (an authoritative window) — a divine act.**

1. A logged command ("lay a hand on this place") makes the window
   authoritative from its stamped tick. The shadow's watched people are
   promoted into sim facts at that moment; because the observer ledger is
   part of the save, replay reproduces it. If nothing was being watched, the
   residents are collapsed with sim-owned draws instead.
2. Stocks, buildings and fields are materialized from the window's share of
   the aggregate stocks — integer apportionment, exact.
3. While the hand rests, the window's A1 cells are computed **bottom-up** from
   its agents, its irreversible outcomes are produced locally and become
   history, and flows across the window edge (commuters, trade, migrants) are
   boundary flows with the surrounding A1 cells.
4. Local acts that should have emergent local consequences (a fire in a
   street, a blessed field, a plague in one house) need the hand; acts on a
   province or a planet (a drought, a good year, a comet) act on the
   aggregate directly.
5. The budget is the ruleset constant of §8: one hand at a time, identical on
   every device.

**Lifting the hand (A3 → A1), a command** (or automatic by a fixed rule, e.g.
after N years without acts there — also logged):

1. Fold agents back into cells by category (exact counts).
2. Agents who became notable are promoted to A2 instead of folded.
3. Stocks and buildings return to aggregate stocks (exact).
4. The window's deviations from generation (buildings, roads, fields,
   terrain changes) are kept as **deviation records**, so watching the place
   again later reproduces it.
5. Reconciliation test: laying and lifting the hand with no time passing
   returns every aggregate to its exact prior value.

### 10. Statistical conservation during materialization

**The conservation trilemma.** When individuals move between cells over time
by stochastic flows, you cannot have all three of:

- **exact** conservation (the materialized members of a cell never exceed its
  counts, per category),
- **order-independence** (a person's resolved facts do not depend on who was
  resolved before them), and
- **O(1)** resolution cost (no need to simulate or rank everyone).

Exact + order-independent needs everyone simulated (Classic). Order-independent
+ O(1) gives only *expected* consistency (Bernoulli draws per person, drifting
from the counts). The plan chooses **exact + O(1)**, and neutralizes the
order-dependence by rule: **observed facts are never inputs to the
authoritative simulation** unless a command promotes them (§14). The macro
history is then observer-independent; only *which* specific latent people
the player has met depends on viewing order, and once met they are fixed.

**The budget ledger.** Every A1 cell carries, per category, the count *n*
(authoritative) and the claimed count *m* (materialized + stubs). A resolver
samples from the unclaimed remainder `(n_k − m_k)/(N − M)`, then claims. It is
therefore impossible to materialize a 411th farmer from 410 farmers.

Claims exist for every conserved dimension:

| Dimension | Claimed against |
|---|---|
| Occupation, class, culture | the person's current cell × category counts |
| Household | the cell's household-composition table (a household is resolved whole) |
| Birth | the birth ledger `B(province, year)` — no more materialized births than recorded |
| Death | the death ledger `D(province, year, age band)` |
| Migration | the recorded flow `F(from, to, period)` (a past migration claims one unit of it and inherits its causes) |
| Parents, siblings | stubs claimed in the parental cohort cell; later resolutions draw from existing unrealized stubs first, with probability proportional to their share of the remaining pool, so a sibling is found rather than duplicated |

When the macro simulation later changes a cell that has claimed members, the
claimed people's fates are drawn from the same rates with their own keyed
draws, and the latent remainder absorbs the difference. If a tiny cell makes
that impossible (the claimed deaths exceed the recorded deaths), the recorded
count is raised to match: **an individual fact outranks a statistic**, and the
correction is logged as a deviation.

**Integer apportionment everywhere.** Splitting any integer total into
categories uses largest-remainder with keyed tie-breaks. Floats are for rates
and prices, never for things that are counted.

### 11. The Causal Field

The Causal Field is the product concept: *a deterministic, constraint-preserving
universe where most detail is latent and every committed fact can be explained.*
Architecturally it is four stores and one engine.

```
                ┌──────────────────────── Causal Field ─────────────────────────┐
  seed ──► gen ─┤  FACT STORE         what is true now                          │
  rules ────────┤    generated  = pure f(seed, ref)          — never stored     │
  commands ─► sim ─► simulated = owned state                 — stored           │
                │    derived    = pure f(stored state)       — cached           │
                │  CAUSE LEDGER       why it became true                        │
                │    events, decision records, typed cause refs               │
                │  MACRO HISTORY      what was true then                        │
                │    per-province time series + birth/death/flow ledgers      │
                │  OBSERVER LEDGER    what has been resolved for viewing        │
                │    collapsed people/households, claims, pinned facts        │
                └──────────────────────────────┬────────────────────────────────┘
                                               ▼
                               EXPLAINER  why(ref, aspect, at)
```

- **Fact store.** Every fact type declares its class: *generated* (never
  stored; e.g. a star's mass), *simulated* (owned state), *derived* (cached
  pure function of stored state). A *deviation* is a simulated overwrite of a
  generated fact (a mined-out deposit, a terraformed climate cell), and only
  deviations are saved for generated content.
- **Cause ledger.** Events and decision records with typed cause references
  (§12).
- **Macro history.** Compact per-province time series and ledgers (§15). It is
  the substrate that lets past detail be reconstructed.
- **Observer ledger.** Everything collapsed for viewing (§14): the people and
  households the player has met, their pinned facts, and their claims.
- **Explainer.** Answers backward queries (§13).

### 12. Causal provenance

**A cause reference is typed:**

```ts
type CauseRef = {
  ref: Ref;                 // event | decision | fact | flow | generator | command
  role: "trigger" | "enabler" | "pressure" | "constraint" | "agent";
  weight: number;           // share of the decision, 0..1 (top contributors only)
};
```

**A decision record** is written whenever a rule makes an important choice:

```ts
type DecisionRecord = {
  id: Ref; t: SimTime; rule: RuleId;           // e.g. "polity.declareWar"
  subject: Ref; outcome: number | Ref;
  factors: { input: RuleInput; value: number; contribution: number; source: CauseRef }[]; // top ≤6
  threshold: number;
};
```

- Rules that can produce important outcomes are written as **pure functions of
  an explicit input object**, so the explainer can re-run them. The factor
  breakdown is computed at decision time (it is the rule's own arithmetic)
  and the top contributors become the event's `causes`.
- Each input carries its own source (`claim on deposit D` → the fact ref of
  deposit D; `grievance` → the event that created it). This is how a
  cross-domain chain forms without anyone "linking" domains by hand.
- **Flows carry causes.** A migration flow `F(Q→X, 1845, 3,000)` carries the
  decision that caused it (war W displaced Q). A person who later resolves as
  one of those migrants inherits that cause.
- **Generated facts carry generator provenance**: the generator id and its
  inputs (deposit D formed by *arc magmatism* at the subduction boundary
  between plates 3 and 7, 180 My ago). The explainer re-runs the generator in
  trace mode to expand it.
- **Budget:** at most 6 causes per record; decision records only for
  importance ≥ 2; unimportant choices record nothing and are explained by
  reconstruction, marked as such.
- **Causes are hashed.** Unlike Classic, provenance is part of the checkpoint
  hash, so a change that breaks it is caught.

**Porting note.** Classic's 102 `lastEventByType` citations and 36 tile-index
citations must not be ported. Each becomes either a decision record or no
cause at all.

### 13. Backward causal querying

```ts
why(ref: Ref, aspect?: AspectId, at?: SimTime): Explanation
type Explanation = {
  claim: TextSpec;                  // "Mira is a mill hand in Tolvey"
  basis: "recorded" | "reconstructed" | "generated";
  causes: { edge: CauseRef; next: () => Explanation }[];   // lazily expanded
};
```

- `aspect` selects which fact of the thing is being questioned (occupation,
  location, wealth, belief…). Each fact type registers an explainer for its
  aspects.
- **Recorded**: read the cause refs of the event or decision that last set it.
- **Reconstructed**: re-run the rule with inputs rebuilt from the macro
  history at time *t* (e.g. "why did this province grow?" → the flow and
  birth ledgers of that decade).
- **Generated**: re-run the generator in trace mode.
- Traversal is lazy and paged, and cannot loop because every cause is earlier
  than its effect (or the same time with a lower order key — Classic's
  `x < id` rule, kept).
- **Forward ("what did this cause?")** uses a bounded reverse index kept for
  important events, and otherwise a time-windowed scan of the event store.
- **North-star test.** An automated test generates a universe, resolves a
  random unimportant citizen of a mature civilization at D4, and walks `why`
  from one of their memories until it reaches a generated planetary fact. It
  asserts that the chain crosses at least four domains, and that every hop is
  *recorded* or *generated* (not reconstructed guesswork) for importance ≥ 3.

### 14. Lazy causal detail generation

```ts
resolve(ref: Ref, depth: Depth, at: SimTime): FactSet
```

**Collapse.** A latent person has no identity. Clicking "a mill hand in the
Tolvey crowd" asks the observer ledger to *collapse* one member of that cell.
The result is a structural ref `(observer, sequence)` with facts that are
from then on permanent. The past is generated **backward, conditioned on the
macro history**, and every step claims from a ledger:

```
collapse(cell C at time t):
  1  household ← sample household type from C's composition table; claim it
  2  for each member: sex, age ← sample from C's unclaimed age × sex counts; claim
  3  occupation, class, culture ← sample from unclaimed category counts; claim
  4  birth: choose birth province/year by backward sampling over the flows into C
         and the birth ledger B(p, y); claim one birth; if the path crosses a
         recorded flow F, claim one unit of F and attach F's causes
  5  parents: search existing unrealized stubs in the parental cohort cell first
         (prob ∝ stubs / remaining pool), else create stubs; claim
  6  names, appearance: pure f(ref, culture, language) — cheap, regenerable
  7  store pinned facts (D1–D2 ≈ 100 bytes) in the observer ledger
deepen(person, D3/D4):
  8  personality, skills, beliefs ← f(ref keys, culture, class, life events)
  9  biography: walk the person's years; at each year sample events from the
         macro history of their province (war, famine, epidemic, boom) with
         rates from the record; each sampled life event cites the macro event
  10 memories: pick formative events by salience (age at event × severity ×
         closeness); a memory cites its event
  11 pin D3–D4 facts (≈ 200–300 bytes more)
```

- **Consistency with committed history** holds because every sampled fact is
  conditioned on the recorded ledgers and claims against them. A resolved
  person can never have been born in a province with no births that year, have
  migrated along a flow that did not exist, or be the 3,001st of 3,000 refugees.
- **Stability.** Pinned facts never change except through simulation events
  that apply to them (a later plague in their province is drawn for them from
  the recorded rates with their own keyed draws — lazily, when the player next
  looks).
- **Why pin at all, if resolution is deterministic?** Three reasons: the
  ruleset may change between versions (pinned facts protect what the player
  has already seen); the history they were conditioned on may be compacted
  later; and claims must persist to keep the budget exact.
- **Observer facts are not sim facts.** Pinned people live in the observer
  ledger. The simulation never reads them — so meeting people cannot change
  the future — until a command promotes them (the god's hand on their
  district, a divine act on them).
- **Sim-driven collapse** (promotion to A2 for a ruler or inventor) uses
  its own sim-owned stream and claims first; it never picks a person out of the
  observer ledger.

### 15. Population representation

**A1 population cells** (per province, per species):

- counts by `sex × age band (≈10) × class/occupation (≈8–12) × culture (≤8 per province)`,
  stored sparse (most combinations are empty),
- household-composition table (household types × counts),
- rates this period (fertility, mortality by age band, migration propensity),
- the tracked A2 members who belong to the cell (they are counted in it).

**Macro history ledgers** (what lazy resolution is conditioned on):

- `B(province, year)` births; `D(province, year, age band)` deaths;
- `F(from, to, period)` migration flows with composition and cause refs;
- per-province yearly summary: counts by class and culture, output, prices,
  control (which polity), notable events.
- **Budget**: ~50 bytes per province-year after varint compression. A planet
  of 1,024 provinces over 1,000 years ≈ 50 MB raw — too much to keep resident,
  so history is **chunked by (province block × century)** in IndexedDB and
  paged in on demand; deep past is kept at decade resolution (≈ 5 MB).

**Flows.** Births, deaths, ageing, occupational change and migration are
integer flows between cells each period, apportioned exactly, caused by
decisions and pressures (food, wages, war, persecution, opportunity), and
recorded with causes.

**Species-general.** Nothing in the population model assumes humans: life
history (maturity, fertility window, litter size, lifespan) comes from the
species' biology (§17); "sex" is the species' reproductive-role count
(possibly one, possibly three); a colonial species' "individual" may be a
colony.

### 16. Household and relationship representation

- **Aggregate**: households exist as composition tables per cell (types by
  size and structure — nuclear, extended, communal, single — the types
  themselves derived from the culture's kinship rules).
- **Resolved**: a household is collapsed whole (§14). Members, relationships
  inside the household and the home are pinned together.
- **Relationships outside the household** are created only between resolved
  or tracked people, stored as typed edges (`kin`, `spouse`, `friend`,
  `rival`, `employer`, `patron`) with the event that created them.
- **Genealogy** is a graph of parent/child refs; ancestors beyond what has
  been resolved are *stubs* in parental cohort cells, deepened only when
  opened. A family tree is therefore infinite in principle and costs only
  what has been viewed.
- **Dynasties and houses** (Classic 65) are A2 records with lineage refs; the
  members that matter are tracked, the rest are cohort stubs.

---

## Part III — Domain models

Each domain is described by: its primitives, its authority tiers, what feeds
it and what it feeds. The unifying trick is that downstream systems read
**derived capability vectors**, never raw generator structures, so a new body
plan or a new material automatically changes what is possible downstream.

### 17. Procedural biology

**Smallest useful body-plan grammar** (a data-defined tree, not molecular
biology):

- *Chemistry basis* (from the planet): solvent (water / ammonia / hydrocarbon),
  energy source (photo / chemo / hetero), viable temperature band.
- *Body*: symmetry (radial / bilateral / asymmetric), segment count, support
  (hydrostatic / exoskeleton / endoskeleton), size class (log₁₀ mass).
- *Appendage groups*: `{count, role: locomotion | manipulation | sensing | feeding | defence, joints, reach}`.
- *Locomotion mode*: swim / walk / climb / fly / burrow / sessile.
- *Senses*: weights and ranges over light, sound, chemical, pressure,
  electric, magnetic.
- *Physiology*: respiration medium (gills / lungs / diffusion),
  thermoregulation (ecto / endo), metabolic rate, diet (trophic range).
- *Reproduction*: role count, r/K position, brood size, parental care,
  development (direct / larval), lifespan, maturity.
- *Neural architecture*: centralized / distributed / colonial, neural mass.
- *Sociality*: solitary / pair / group / eusocial / hive; communication
  channel and bandwidth.

**Physical constraints** apply at generation: square–cube scaling from
gravity limits size and limb thickness; atmosphere density gates flight;
medium gates senses (no long-range vision in murky water) and respiration.

**The affordance vector** is derived from the phenotype and is what the rest
of the universe reads:

`manipulation dexterity, tool precision, fire access (air medium × oxidizing
atmosphere × manipulators × fuel), load, endurance, climate range, diet
breadth, food need, sleep need, lifespan, group size ceiling (neural mass ×
sociality), communication bandwidth, personhood unit (individual / colony /
hive), gravity tolerance, pressure tolerance, radiation tolerance`

Examples of consequences produced by construction, not by special cases:

- aquatic species → no fire access → smelting principles unsatisfiable →
  metallurgy must come through a different realization (hydrothermal vents,
  electrochemistry) → later and different industrialization;
- high gravity → heavier structures, lower buildings, costlier launches (the
  rocket equation reads the planet's surface gravity and radius);
- colonial personhood → the population model's "individual" is the colony →
  government's citizenship slot, warfare's unit of loss and the observatory's
  "person page" all change meaning together.

**Tiers.** A0/A1: species are parameter vectors and clades; only the active
window has individual genomes and phenotypes (Classic's 13-gene model is the
starting point for the within-species variation there).

**Visuals.** The same plan generates the body mesh (§28), which is the
reverse of Classic, where body plans exist only in the renderer (`32c:21-141`)
and have no mechanical effect.

### 18. Procedural ecology

- **Deep time (generated, A0):** from abiogenesis likelihood (planet
  chemistry, energy, water) the generator produces a clade history in
  steps of ~10 My: radiations into niches, extinctions tied to planetary
  events (impacts, volcanism, glaciations, oxygenation), and — under the
  right conditions — a clade that crosses the intelligence threshold
  (manipulation × neural mass × sociality × communication). The output is a
  species list with body plans, niches, ranges, and an evolutionary tree
  whose branch points are events the explainer can cite ("this trait arose
  after the Great Cooling, 41 My ago").
- **Sim era (A1):** per planet cell, a guild model — producers (biomass from
  climate NPP), grazers, predators, decomposers — each guild shared by the
  species present, logistic growth plus Lotka–Volterra coupling, seasonal
  cadence. Human (or alien) land use, hunting, domestication and pollution
  are flows into it.
- **Domestication** is a trait test on species (docility, herd structure,
  growth rate, diet) and a precondition for agricultural principles.
- **Microscope:** individual plants and animals as Classic has them, seeded
  from the guild state; under the hand they are folded back when it lifts, in
  a watched window they are simply discarded.

### 19. Procedural society and culture

- **Culture** = a value vector (~12 axes: kinship strength, hierarchy,
  collectivism, ritualism, openness, martial honour, work ethic, time
  orientation, purity, individual autonomy, reciprocity, attitude to
  outsiders) + a **kinship system** (descent, residence, marriage form,
  inheritance) + a set of **practices** (taboos, rites, dress, food) +
  **language** + **material style** parameters.
- Generated from the founding species' affordances and environment (scarcity
  → reciprocity, isolation → ritualism, river agriculture → hierarchy), then
  evolves: drift (keyed), selection by conditions, diffusion along trade and
  migration edges weighted by contact, and events (war trauma → martial
  honour; plague → purity).
- **Divergence**: when two populations of one culture have distance in value
  space above a threshold and low contact for long enough, a new culture is
  minted with a cause (isolation of the colony, communication lag). This one
  rule produces both regional dialects and interstellar cultural drift.
- **Belief systems** are compositions: cosmology elements (sky, sea, earth,
  ancestors, abstract principle, none) chosen from environment and history,
  moral emphases taken from the culture vector, organization form (none /
  shamanic / priestly / church / state cult), and **founding events** (a
  disaster, a hero, a comet — or a real divine act seen as an omen, §3.1)
  cited as causes.
- **Language**: phoneme inventory constrained by the communication channel
  and sense weights (a species that talks by colour does not get consonants);
  naming grammar per culture. Classic's languages (48) are the starting code.

### 20. Economy and production

- **Commodities**: 24–40 abstract goods defined in data (grain, protein, fibre,
  timber, stone, clay, ores by class, metals by class, fuel, chemicals,
  tools, machinery, textiles, consumer goods, electronics, munitions,
  vehicles, construction, services, knowledge…). Species needs map biology
  onto a basket of these.
- **Recipes** come from technology realizations (§22): inputs, labour class,
  capital, energy, output. Different civilizations therefore have different
  recipes for the same good.
- **Actors**: settlement sectors (A1) and households by class (A1), notable
  firms and institutions (A2).
- **Markets** per market area (a province or a city), price adjusted each day
  by excess demand with damping; money appears as an institution (barter →
  commodity money → credit → fiat), and until then "price" is a value signal.
- **Trade** on the transport graph: goods move from low to high price when the
  difference exceeds the transport cost; flow ∝ difference, capped by edge
  capacity; solved as a few damped iterations per period, in canonical
  edge order.
- **Transport modes** (foot, pack animal, cart, river, sea, rail, road, air,
  orbital) come from principles; each sets cost per ton-km, speed and
  capacity of edges. A rail realization lowers edge costs → price
  convergence → specialization → migration toward jobs → housing demand.
- **Cities** (§14 of the brief): a settlement grows by jobs, housing and
  access. Inside a city, a coarse **district grid** (8×8 to 16×16 blocks)
  carries land use (housing density, commerce, industry, civic, farm) that
  follows land value = accessibility + amenities − nuisance. The rail line
  raises access in the districts it touches, and industry and housing follow.
  That reproduces the brief's rail → industry → migration → neighbourhood
  chain with a few hundred lines. The active window renders one district with
  the full townscape.
- **Conservation**: goods are integer stocks; production, consumption,
  trade and loss are flows that balance per market per period.

### 21. Government and politics

- **Polity** = an **institution composition** (the brief's slots: authority
  source, decision topology, representation, succession, administration,
  property regime, taxation, citizenship, enforcement, military organization)
  + a **power distribution** among interest groups.
- **Interest groups** are derived, not authored: they come from classes,
  organizations, the military, clergy, merchants, and — for alien species —
  whatever the population model's categories are. Each has preferences over
  slot values and policies derived from its material interest and culture.
- **Decisions** (laws, taxes, war, treaties) weigh preferences by power.
  The result is a decision record (§12), so "why did this government form"
  and "why did it declare war" have recorded factor breakdowns.
- **Regime change**: when formal power (the slots) diverges from real power
  (arms, wealth, numbers, legitimacy) beyond a threshold, reform, coup,
  revolution or secession happens; the winners' preferred slot values form
  the new composition. Familiar forms (monarchy, republic, theocracy) are
  regions of this space; unfamiliar but consistent ones appear on alien seeds.
- **Diplomacy**: a relations graph whose opinion is a sum of *typed,
  sourced* components (border friction from province P, trade dependence on
  good G, grievance from event E), plus treaties as typed agreements. This
  replaces Classic's scalar pressure and makes war aims explainable.
- **Rebellion**: provinces with low legitimacy, identity distance from rulers
  and grievances raise rebel forces through the same conflict model.

### 22. Procedural technology and invention

A fully generative invention system (combine any primitives, see what works)
produces nonsense or needs a physics engine. A hand-written tree is what the
brief rejects. The middle path:

- **Principles** (authored data, ~150–200 entries): lever, wheel, fired
  ceramics, smelting, alloying, rotary power, heat engine, electromagnetism,
  chemical synthesis, semiconductors, reaction propulsion, fission, … Each
  declares **requirements** over capability dimensions and knowledge domains,
  the **needs** it answers, and the **capability effects** it grants.
- **Capabilities** are a per-civilization numeric vector: max process
  temperature, precision (tolerance), power per capita, energy density of
  storage, material strength per class, information bandwidth, computation,
  transport cost, medical capacity, etc.
- **Knowledge** accumulates per domain (mechanics, materials, chemistry,
  life, energy, information, astronomy…) from observation (a volcanic
  homeland yields materials knowledge), practice, need, institutions
  (research capacity) and contact.
- **Invention** happens when requirements are met, at a rate ∝ need ×
  research capacity × knowledge surplus, with keyed draws — and it is a
  decision record: "invented because the salt trade needed preservation
  (need 0.6), fired ceramics known (enabler), river clay (constraint met)".
- **Realization** is the procedural part: a principle is instantiated for
  this civilization from its materials, biology and environment. *Rotary
  power* becomes a water wheel, a windmill or an animal gin; *energy storage*
  follows the planet's biochemistry; *reaction propulsion* is sized by the
  planet's gravity. Recipes and designs use realizations.
- Different civilizations reach different solutions because needs,
  materials and biology differ, and the *order* of invention differs because
  needs differ.
- Classic's ~104 crafts map onto principles and realizations as calibration
  for the Earth seed.

**Design grammar (shared).** Weapons, armour, vehicles, buildings, ships and
spacecraft are one kernel: a **Design** is a set of components by role
(structure, power, propulsion, payload, protection, sensors, control, life
support, habitation), each a realization with parameters; performance comes
from scaling laws (mass budget, power, thrust-to-weight, Δv by the rocket
equation, range, cost). A **doctrine** (weights over performance axes) picks
designs by greedy construction — no combinatorial search. This is the
"one weapon grammar" the brief asks for, generalized to everything built.

### 23. Warfare

- **Force** = count × design per unit type, + morale, experience, supply
  state, commander (A2), doctrine.
- **One conflict kernel, three graphs**: the same operational model runs on
  the province graph (planetary), the orbital graph (interplanetary) and the
  star graph (interstellar), with edge travel times from transport and
  propulsion capabilities.
- **Engagements**: daily Lanchester-style attrition with modifiers from design
  performance (range, protection, mobility, sensors), terrain, fortification,
  doctrine and morale. Casualties are integer flows into the population's
  death ledger with the battle as cause — soldiers come from population cells
  and die back into them.
- **Supply**: flows from depots along the graph; attrition when cut.
- **Occupation**: control share per province; **blockade** cuts trade edges;
  **invasion** is movement onto a contested node; **rebellion** raises forces
  through §21.
- **Strategy**: war aims are the decision record's factors (the claim on a
  deposit); targets are chosen by value / cost; peace when war-weariness or
  aims resolve.
- **Individuals**: generals, heroes and notable soldiers are promoted to A2
  when they matter. A battle may run at A3 (Classic's anatomical combat is
  the model) *only under the god's hand*. In a watched window the battle's
  outcome — casualties, the winner, the ground held — is imported from the
  aggregate engagement, and the shadow plays out a fight consistent with it
  (presentation only).

### 24. Planetary simulation

- **Star**: mass → luminosity, temperature, lifetime, habitable zone
  (main-sequence relations, analytic in time); activity events.
- **System formation**: disk parameters → planets (orbits, masses,
  compositions: rocky / icy / gaseous), moons, belts.
- **Planet**: radius from mass and composition; gravity; escape velocity;
  rotation; axial tilt; atmosphere by outgassing and retention; surface
  temperature by energy balance with greenhouse; hydrosphere.
- **Geology** on the icosahedral grid: plate seeds grown by keyed Voronoi,
  velocities, boundary classes (convergent, divergent, transform) →
  mountains, rifts, trenches, island arcs, hotspots; a few erosion passes.
- **Deposits** are functions of geological context and age: arc magmatism
  (copper, gold), old cratons (iron), sedimentary basins with buried biomass
  from the ecology's history (coal, oil), placers downstream. Each deposit
  stores its **generator provenance** — the last link of the brief's
  person → … → geology chain.
- **Hydrology**: flow directions, accumulation → rivers and lakes.
- **Climate**: latitude insolation with tilt → seasonal temperature;
  circulation cell count from rotation rate; prevailing winds; moisture
  transport and orographic rain → precipitation; biome classification.
  In the sim era, a global energy balance plus per-cell anomalies
  (volcanic winters, industrial warming) at yearly cadence.
- **Region refinement**: opening the microscope over a planet cell block
  produces a tile map constrained by the parent — mean elevation, sea level, moisture,
  deposits — plus local noise. Classic's world generator is the starting
  point, but its whole-map normalizations (`06:1376-1418`), edge falloff and
  normalized-coordinate climate (`06:1300-1350`) must be replaced by parent
  constraints, or a region's sea level will disagree with its planet's.

### 25. Spaceflight and colonization

- **Launch economics from physics**: Δv to orbit from surface gravity, radius
  and atmosphere; the rocket equation with the propulsion realization's
  exhaust velocity gives payload fraction and cost per kilogram to orbit.
  High-gravity worlds get spaceflight later and use it differently.
- **Orbital mechanics**: Kepler positions, Hohmann estimates for transfer
  Δv and time, launch windows as analytic functions. No n-body integration.
- **Orbital infrastructure**: stations, depots, shipyards and elevators as
  A2 records with Designs.
- **Colonies**: settlements on other bodies with A1 cells; habitability is
  the colonists' affordance vector against the body (gravity, pressure,
  temperature, radiation, atmosphere) → life-support recipes and costs.
- **Migration between worlds**: flows with ship capacity and cost.
- **Terraforming / adaptation**: long flows that change a body's parameters,
  or biological adaptation of colonists (a divergence of the species' body
  plan parameters, an event with causes).
- **Interplanetary economy and politics** reuse §20–§23 on the orbital graph.

### 26. Interstellar civilization representation

- **Travel is sublight** (decided 2026-09-25). Cruise speed is a capability
  of the propulsion realization — on the order of 0.01 c for early fusion
  drives, up to 0.2–0.3 c for beamed sails or antimatter — and communication
  travels at light speed. Time dilation is ignored below 0.3 c (γ < 1.05).
  No faster-than-light principle exists in the 100k ruleset.
- **Why sublight suits this game.** The player is a god and an observer, not
  a 4X ruler: centuries-long expansion is something to watch, and it makes
  the late game grounded in the same physics as the launch economics (§25).
- **Communication lag drives divergence.** Administrative reach decays with
  round-trip time; a colony's culture drifts (§19), its interest groups
  diverge, and secession pressure rises — the same regime-change rule as
  §21. Independence is emergent, not scripted. A colony 12 light-years out
  hears its capital's orders 12 years late.
- **Interstellar polity** = a graph of system holdings, each an A1
  economy/population aggregate with A2 fleets and leaders.
- **Interstellar economy**: mostly information, rare goods and people;
  bulk goods rarely cross stars unless propulsion makes them cheap.
- **Interstellar war**: fleets as Designs on the star graph. Campaigns take
  decades; a fleet sails on intelligence that is years old when it leaves and
  older when it arrives, so surprise is real and each system's own industry
  decides its defence. War aims are long-lived and often outlive the
  government that declared them — the decision record keeps why.

### 27. Procedural galaxy representation

- Galaxy parameters from the seed (disk radius, arms, bulge); a density
  function over the disk.
- **Sectors**: a 2-D disk grid with height; star count per sector ~ Poisson
  (density × volume) using keyed draws; star *k* in sector *s* is
  `gen(seed, s, k)`. Untouched stars cost zero bytes.
- **The playable cluster.** Simulating every civilization in a galaxy is
  infeasible. The simulated neighbourhood is bounded — roughly 500–5,000
  systems around the origin world, which at the Sun's neighbourhood density is
  a sphere of about 40–65 light-years, crossed by sublight ships in decades to
  centuries — containing ≤ 8–20 simulated civilizations at A1. The rest of the
  galaxy is A0 (it can be looked at, not lived in). The bound is a ruleset
  constant (O-5). The generator places the cluster's other civilizations
  within sublight reach as a prior, so contact within a few centuries of
  interstellar flight is possible but never guaranteed.
- Other civilizations in the cluster are generated at universe creation
  (their deep-time histories are A0 until contact or observation), then
  simulated at A1 from their emergence.
- Classic's 6–9 star records and statistical colonies (`85`, `107`) are the
  seed of the colony model, not of the galaxy.

### 28. Procedural visual generation

Every visible thing goes through a pure **view-spec** builder:
`sim facts → VisualSpec` (a data description: parts, proportions, materials,
colours, style parameters). The renderer turns specs into meshes and caches
by spec hash. One spec, many presentations:

| Source | Spec | Presentations |
|---|---|---|
| Species body plan + individual variation | skeleton tree of segments/appendages, coverings, palette | desktop mesh (skinned), phone mesh (fewer segments), distant impostor, map glyph |
| Building: function + materials + culture style + tech | massing rules (footprint, storeys, roof by climate, openings by thermoregulation) | full mesh, merged block, district texture, map icon |
| Vehicle / spacecraft Design | components laid out by role (engines aft, radiators by power, habitats by crew, armour by doctrine) | mesh, silhouette, fleet icon |
| Planet fields | height, biome, ice, clouds, lights | GPU-generated globe textures by LOD |
| Terrain tile chunks | height + surface class | chunk meshes |

Classic's architecture, creature and planet drawers (32b, 32c, 32e, 123)
contain real form-follows-function knowledge; that logic is ported into spec
builders, the Canvas drawing is not.

Art direction matters for feasibility: a **stylized, low-poly,
flat-shaded-with-good-light** look is achievable procedurally on phones;
photorealism is not (O-11).

---

## Part IV — Presentation, worker, observatory

### 29. PlayCanvas integration boundary

- **Engine-only**, from npm, built by Vite. **Not the PlayCanvas Editor.**
  Nearly every scene is generated from simulation data, so the Editor's
  cloud project would be a second source of truth outside git with little to
  author. (This is also why the PlayCanvas *Editor* MCP server, which only
  talks to cloud Editor projects, has nothing to inspect here — see the
  note at the end.)
- The `render` module owns every `pc.Entity`. It maps **view keys** (a ref + a
  presentation role) to pooled entities; entities exist only for things
  currently presented. The sim never sees a PlayCanvas object.
- **Instancing** for crowds, trees, buildings, ships; merged static batches
  for district blocks; chunked terrain meshes; GPU-generated planet textures.
- **Camera stack per scale**: galaxy, system, orbit, globe, region, city,
  street, interior, each with its own controller and a continuous zoom
  hand-off (the observatory's navigation drives it).
- **Map lenses** become shader overlays on terrain/globe (data texture +
  ramp), not per-tile fills (Classic draws per-tile `fillStyle`, `32:100-159`).
- **Picking** by GPU ID buffer or ray against coarse proxies, returning view
  keys → refs.
- WebGL2 baseline; WebGPU when available and tested; handle context loss
  (iOS drops contexts under memory pressure).
- **DOM stays DOM**: observatory pages, tables and text are HTML (accessible,
  cheap, and Classic's UI knowledge ports). Charts are a small canvas/SVG
  component.

### 30. Web Worker architecture

- The sim host runs in a dedicated Worker. The main thread runs render, UI
  and input.
- **No SharedArrayBuffer.** GitHub Pages cannot send the COOP/COEP headers
  that cross-origin isolation requires. All transfer uses `postMessage` with
  **transferable ArrayBuffers**. (A service-worker isolation shim exists but
  is fragile on iOS; do not depend on it.)
- **Protocol**:
  - main → worker: `command` (stamped), `setInterest` (the camera's scale and
    area — presentation only), `query` (id, request), `subscribe`
    (a panel's live metric, rate-limited), `control` (speed, pause).
  - worker → main: `frame` (presentation snapshot for the current interest,
    typed arrays, ≤ 256 KB, ≤ 10 per second), `reply`, `notify`
    (events worth an alert), `status` (tick, speed achieved, budgets).
- **Snapshots are designed, not cloned.** This is the fix for Classic's
  measured failure (cloning `W` is 64 ms; render read 9.6 of 11.4 MB). A
  frame contains only what the current view presents: visible agents'
  handles, positions, facings, poses, actions; building instance lists by
  chunk; dirty terrain chunks; field textures when they change. The main
  thread interpolates between frames at display rate.
- **Interest purity test**: the checkpoint hash chain must be identical for
  any sequence of `setInterest`, `query` and `subscribe` messages.
- **In-thread fallback**: the same protocol over a synchronous transport, for
  debugging and for devices where the worker is unavailable. Classic's sliced
  tick is the in-thread pacing model.
- Queries are answered between steps, against a consistent state; replies
  carry the tick they describe.

### 31. Observatory architecture

The observatory is the product's main instrument, not a debug panel.

- **Everything is a node.** Every ref has a **page** composed from registered
  **blocks** (Classic's `pageBlock` registry, generalized to every kind) and a
  set of **typed links** (located-in, member-of, employed-by, owned-by,
  caused-by, descended-from, trades-with, fought-in, formed-from…).
- **Navigation** is a stack with breadcrumbs across scales —
  galaxy → system → planet → region → city → district → building → household
  → person — and the camera follows the stack.
- **"Why?" on every value.** Any number or statement on any page opens
  `why(ref, aspect)`; the explanation renders as an expandable tree, with
  each node itself a page link. This is how the brief's chain (person → job
  → employer → industry → trade route → conflict → war → deposit → geology)
  is walked.
- **Instruments**: map lenses per scale; time-series charts from the macro
  history; family trees (lazy); causal graph view; flow views (trade,
  migration, supply) as Sankey-like diagrams; comparison tables (Classic's
  polities-compared); the chronicle; the field guide for species.
- **Observer tools** (the observer's half of the player, §3.1): follow a life
  or a lineage across scales; watches that raise an alert when a condition
  holds ("this city starves", "this dynasty loses its throne"); bookmarks;
  time-lapse of any lens; a *what did my acts do?* view that lists every
  divine act with its downstream consequences through the forward index.
- **The god's toolbox** sits beside the instruments: pick a scale and a
  target, pick a domain, sign and magnitude, see what the act will touch
  before confirming. Every act appears afterwards in the chronicle and in
  the why-trees it caused.
- **Queries go to the worker** and are cached per tick on the main thread.
  Pages subscribe to what they show; nothing polls the world.
- Classic's lessons carry over: panels must not rebuild under the pointer;
  expanded sections persist; text is plain words (129), not engine words.

---

## Part V — History, saves, rules

### 32. History and event representation

```ts
type Event = {
  id: Ref;                  // minted, monotonic
  t: SimTime; type: EventType; importance: 0..7;
  subjects: Ref[];          // ≤ 4
  place: Ref;               // province / settlement / body / system
  causes: CauseRef[];       // ≤ 6, earlier than this event
  data: EventPayload;       // typed per event type (schema in rules)
};
```

Text is produced at view time from templates (Classic's `eventText`
registry); events never store sentences.

**Retention tiers:**

| Tier | Kept | Examples |
|---|---|---|
| T0 ephemeral | never stored; counted into period summaries | a step's micro-actions in the active window |
| T1 log | rolling window (e.g. last 20 game years, paged) | ordinary births, trades, minor quarrels |
| T2 chronicle | forever | wars, foundings, inventions, regime changes, notable lives |
| T3 referenced | forever while referenced | any event cited by a T2 event, a decision record, a pinned fact or a tracked biography |
| Summaries | forever | per (place × decade): counts by type + top events |
| Tombstones | forever | id, t, type, place, subjects — enough to render "an event that has been forgotten" (Classic's tombstones keep none of these) |

- **Mark-and-sweep retention**: roots are T2 events, decision records, the
  observer ledger and tracked biographies; anything reachable is kept, the
  rest of T1 folds into summaries when it ages out.
- **Hindsight importance**: when a major event cites a minor one as a cause,
  the minor one is promoted and pinned. History discovers its significance
  after the fact, which is exactly how the observatory should feel.
- **Budget**: chronicle growth per planet ≲ 100k events per 1,000 years;
  chunks by (era × region block) in IndexedDB; resident only when viewed.

### 33. Save and replay architecture

A save is a container of versioned chunks:

```
header      format version, ruleset id (code hash + data hash), seed,
            created, play time, lineage (ruleset changes over the save's life)
commands    the full command log since tick 0
snapshot    latest authoritative state (typed arrays + records), gzip
snapshot-1  previous snapshot (recovery)
deviations  overwrites of generated facts (terrain, deposits, planet params)
observer    the observer ledger (collapsed people, pinned facts, claims)
history     chronicle, summaries, decision records, macro-history chunks
checksums   per chunk
```

- **Load path = latest valid snapshot**, not replay. Replaying centuries from
  the seed is a verification tool and a rewind feature, not how you load.
- **Replay** = seed + ruleset + commands (+ the observer ledger, for the
  commands that promote observed people) → the same checkpoint hash chain.
  Runs in CI and on demand ("verify this save").
- **Compression**: `CompressionStream("gzip")` is native in Chrome and in
  Safari 16.4+. Classic writes uncompressed JSON (8.9 MB at year 66).
- **Schema evolution**: each chunk has a schema version and a chain of
  up-migrations; CI loads a library of golden old saves on every build.
  Classic's `migrateSave` has no transforms and relies on 37 wrapped
  `restoreWorldDefaults` backfills and a waived hash check — do not repeat.
- **Ruleset changes**: an old save loaded by a new ruleset migrates its
  snapshot and continues; the future diverges (unavoidable), the past is
  protected by stored history and pinned facts; the header's lineage records
  "ruleset changed at t". Replay is valid within each lineage segment.
- **Corruption**: write to the alternate slot, verify checksums, then swap;
  keep the last good; on load failure fall back to snapshot-1 + commands.
- **Size target**: ≤ 25 MB compressed for a full run from the first
  settlements to interstellar war (sublight makes the interstellar era long;
  the deep past is kept at decade resolution); ≤ 3 MB for the Phase 1 slice
  at 200 years.
- **Export/import to a file** is required, not optional: Safari may evict
  script-written storage for a site not used in 7 days of browsing; call
  `navigator.storage.persist()` and offer export.

### 34. Data-driven rules architecture

- **Data** (typed TS/JSON tables validated by schema at build): commodities,
  principles, capability dimensions, body-plan primitives and constraints,
  design components, institution slots and values, interest-group templates,
  culture axes, event types with payload schemas and text templates, balance
  constants, **generation priors**.
- **Code**: every mechanism (flows, markets, combat, resolution, collapse).
  Data references code by named function ids; no expression language in data.
- **Ruleset id** = hash(code build) ⊕ hash(data). Every save and every CI
  checkpoint names its ruleset.
- **Priors** are how the Earth reference works without `if (seed == EARTH)`:
  the `earthlike` prior biases star mass toward 1 M☉, a rocky planet in the
  habitable zone at ~1 g with a large moon, plate tectonics, ~70% ocean,
  carbon–water chemistry, bilateral vertebrate-like clades, an intelligent
  species with two manipulators, endothermy, two sexes, K-strategy,
  vocal communication and ~150-person groups. The same generators run with
  the `open` prior for alien seeds.
- **The canonical Earth seed is found, not written**: search seeds under the
  `earthlike` prior offline, score them against calibration bands (ocean
  fraction, mean temperature, tectonic regime, biome mix, emergence of a
  tool-using species, agriculture before year N, industrialization before
  year M), and record the winning seed number in data. Calibration tests
  keep it inside the bands as the ruleset evolves.

---

## Part VI — Engineering

### 35. Testing

Keep Classic's culture (golden oracle, save continuation, parallel runner,
probes on many seeds) and add the tests this architecture specifically needs.

| Kind | What it proves |
|---|---|
| Kernel unit tests | RNG distributions; `dmath` golden vectors and error bounds; Feistel permutation is a bijection; apportionment sums exactly; scheduler total order |
| **Observation purity** | checkpoint hashes identical under any random sequence of queries, page opens, `resolve` calls, `setInterest` moves, subscriptions and watched windows (a century of watching a town leaves the hash chain unchanged) |
| **Pure-run canon** | two runs of one seed with empty command logs and different observation scripts produce the same chain |
| **Conservation property tests** | collapse people from a cell in 1,000 random orders: never exceeds counts; sums exact; ledgers balance; siblings found, not duplicated |
| **Reconciliation** | laying and lifting the hand with no time passing restores every aggregate exactly; after N years under the hand, aggregates stay within stated tolerance of an untouched run; a watched shadow never produces an irreversible outcome the history lacks |
| Replay | seed + ruleset + commands → identical hash chain |
| Save continuation | load a snapshot and continue N steps = the uninterrupted run, bit for bit (Classic's restored saves diverged within one tick until 2026-09-23) |
| Golden oracle per scale | fixture universes with checkpoint hashes at intervals, per domain sub-hash |
| **Calibration** | Earth seed stays inside its bands; alien priors produce distinct distributions |
| **Diversity** | across 100 seeds: count of distinct government compositions, invention orders, body plans, transport realizations — mechanically different, not cosmetic |
| **North-star scenario** | citizen → memory → migration → war → economic conflict → deposit → geology, recorded hops, ≥ 4 domains (§13) |
| Performance budgets | step time, snapshot bytes, heap, save size on reference fixtures, as failing tests |
| Cross-engine | the oracle on V8, JavaScriptCore and SpiderMonkey (§36) |

Test fixtures are built with typed builders, not string-embedded scripts
(74% of Classic's test logic lives in `String.raw` fixture strings, which no
type checker or linter sees).

### 36. Determinism validation

- **Hash chain**: at every checkpoint (e.g. each game year), a hash per
  domain (population, economy, polity, conflict, ecology, causal, active
  window). A divergence names its domain immediately.
- **Divergence bisector**: given two runs, find the first differing
  checkpoint, then the first differing step, then the first differing key
  (Classic's save-diff probe, generalized).
- **Cross-engine CI**: Node (V8) on every push; Playwright with WebKit and
  Firefox nightly on longer runs. A mismatch blocks the release.
- **Lint** (§6): native transcendental math, `Date`, `performance`, `Intl`,
  `localeCompare`, `Math.random`, `crypto`, weak collections and DOM globals
  are forbidden in `kernel/gen/sim/causal`; stream tags must be unique;
  comparators must be total.
- **Sliced-step test**: stepping in slices of any size gives the same hash as
  whole steps (Classic proves this for its sliced tick; keep it).

### 37. Performance and profiling

**Reference devices**: a mid-range iPhone (e.g. iPhone 12/13 class) as the
floor; a mid-range laptop as the desktop reference.

| Budget | Phone floor | Desktop |
|---|---|---|
| Main thread per frame | ≤ 12 ms (render ≤ 8, UI ≤ 3, bridge ≤ 1) | ≤ 8 ms |
| Hand-window step (≤ 2,000 agents) | ≤ 8 ms, sliced | same result, faster |
| Watched (shadow) window | sized to the device | sized to the device |
| Aggregate year, one planet | ≤ 1 s of worker time | ≤ 0.3 s |
| Snapshot | ≤ 256 KB per frame, ≤ 10 frames/s | same |
| Heap (sim) | ≤ 150 MB | ≤ 600 MB |
| GPU + render heap | ≤ 150 MB | device-dependent |
| Visible instances | ≤ 5,000, ≤ 150 draw calls | ≤ 30,000 |
| Tracked (A2) records | ≤ 50,000 | same (ruleset constant) |
| Observer ledger | ≤ 50,000 people | same |
| Planet generation | ≤ 3 s with progress | ≤ 1 s |
| Region refinement | ≤ 300 ms | ≤ 100 ms |
| Resolve a person to D4 | ≤ 2 ms | ≤ 0.5 ms |
| Save (compressed) | ≤ 25 MB for a full run | same |

Note the rows marked *same*: those are **ruleset constants**, not device
settings. The device changes only rendering and caching budgets.

**Profiling**: a per-system step profiler (Classic's `ALIFE_TICK_DEBUG`, kept),
a heap census per module, a snapshot-bytes meter, and perf CI on the
reference fixtures. Profile in the real engine, never through `vm` contexts
(Classic measured a 2× distortion from `vm.createContext`).

### 38. Mobile constraints

- iOS Safari kills tabs under memory pressure without warning: stay inside
  the heap budgets, release GPU resources for off-screen scales, handle
  WebGL context loss.
- No SharedArrayBuffer (GitHub Pages cannot send COOP/COEP); therefore no
  WASM threads either.
- Background tabs throttle timers and workers: the sim pauses when hidden.
- Storage may be evicted after 7 days without use: persist + file export.
- Thermal throttling: adaptive *render* quality (resolution scale, LOD
  distances, effects), never adaptive simulation.
- Touch-first observatory: Classic's phone dock, drawer and one-hand
  navigation are the starting point.
- **Do not repeat Classic's violation**: phones default to "lean"
  complexity, which changes agent budgets and therefore history (`44:489`,
  `150:54`). In the new app, complexity presets do not exist as a device
  default; world size is a universe setting chosen by the player; the hand
  window's budget is a ruleset constant; only the watched shadow shrinks on a
  phone.

### 39. Conditions that would justify Rust/WASM

Introduce WASM for a kernel only when **all** hold:

1. Profiling on the phone floor shows the kernel takes > 25% of its tier's
   budget after typed-array, allocation-free optimization in TypeScript.
2. The kernel has a narrow typed-array interface (fields in, fields out) and
   a stable design.
3. A prototype shows ≥ 2.5× speedup on iPhone Safari (JavaScriptCore's JIT
   narrows the gap more than people expect for numeric loops).
4. Determinism is preserved: the kernel moves *entirely* (no computing the
   same thing in both), `dmath` is ported bit-exact against the golden
   vectors, no relaxed-SIMD, no threads.

Likely candidates, in order: climate/hydrology solvers, trade-flow iteration
on large graphs, pathfinding for the active window, many-engagement combat.
Never candidates: rules, generators with lots of branching, anything that
changes weekly.

### 40. Repository structure

```
/                          Classic stays where it is during the migration
  src/game/sections/…      Classic (frozen, 2026-09-25)
  scripts/ tests/          Classic tooling
  universe/                the new application
    package.json           TypeScript, Vite, PlayCanvas, Vitest, Playwright
    src/
      kernel/  rules/  gen/  sim/  causal/  host/
      bridge/  view/  render/  ui/  app/
    data/                  rule tables, priors, text templates
    tests/                 unit, property, scenario, oracle, perf
    tools/                 probes, determinism runner, bisector
    docs/                  module contracts (one README per module), ADRs
  docs/architecture/       this plan
  .github/workflows/       Classic CI + Universe CI (+ nightly cross-engine)
```

- Pages serves Classic at the root and Universe at `/universe/` until
  Universe surpasses Classic; then Classic moves to `/classic/`.
- Leaving Classic's paths untouched means none of its 60+ scripts, 110+ smoke
  tests, probes or the deploy chain have to change.
- Every module has a README contract: what it owns, what it exports, its
  invariants, its budgets. Future AI sessions read the contract before
  editing the module; the contract is part of review.

**AI-maintainability rules for the new code** (each learned from Classic):

- No function reassignment (Classic has 711 `x = function` overrides and 47
  dead reassignments). Extension is by registries with literal order keys.
- No duplicate top-level names (modules make this impossible).
- No `typeof fn === "function"` feature switches (in Classic a misspelled name
  is a silently disabled feature).
- No magic constants in systems; named constants live in `rules`.
- No system reads another system's state except through its exported views.
- A change that is meant to leave the world alone must pass the oracle
  unchanged; a change meant to alter it states the expected direction and is
  measured on the seed sweep (Classic's A/B culture, kept).

---

## Part VII — Roadmap

Each phase extends the pipeline end to end before any layer is deepened.
Line counts are cumulative estimates for the Universe app's game code
(tests and tools excluded).

### Phase 0 — Architecture skeleton (≈ 12k lines)

- **Adds**: `universe/` app, CI, lint boundaries and determinism lint; kernel
  (refs, RNG, `dmath`, time, scheduler with phases/cadences/event queue,
  compute-then-commit stores, hash chain); command log; cause ledger, event
  log and decision records; save container with gzip, versioned chunks and
  snapshot ring; worker host + bridge + in-thread fallback; PlayCanvas shell
  with camera stack, instanced layers, view keys and LOD manager; observatory
  shell with page/block/link registries and navigation stack.
  *Optional spike*: Classic in a worker behind a DOM shim, streaming a real
  snapshot to the PlayCanvas shell, to measure snapshot size and iPhone
  frame cost on real data.
- **Still abstracted**: all domains (a toy "counter world" exercises the
  kernel).
- **Architectural risks**: over-engineering the kernel before a domain uses
  it; `dmath` accuracy vs speed; protocol churn.
- **Performance risks**: PlayCanvas instancing and memory on the phone floor
  (measure with 10k synthetic instances).
- **Done when**: the toy world runs in the worker, renders in PlayCanvas on an
  iPhone at 60 fps, saves/loads/continues bit-exact, replays from its command
  log, and produces the same hash chain on V8, JavaScriptCore and
  SpiderMonkey; observation-purity test passes.
- **Proves**: the determinism, persistence and presentation boundaries are
  real before any content depends on them.

### Phase 1 — Local causal vertical slice (≈ 30k)

- **Adds**: star + one planet under the `earthlike` prior (icosahedral grid,
  plates, elevation, hydrology, climate, biomes, deposits with provenance);
  region refinement; one species (human-like, from the biology grammar's
  data, but only one); A1 population with ledgers, households and flows;
  settlements; jobs; a simple economy (≈ 12 goods, markets, trade on the
  region graph); macro history; observer ledger and person resolution to D4;
  the explainer with recorded, reconstructed and generated bases; observatory
  v1 (planet → region → settlement → household → person, "why?" on values,
  charts); the microscope v1 over one village (watch mode as a shadow with
  imported outcomes; the hand as a logged act; agents with needs, work and
  homes; reconciliation); the first divine acts (rain, drought, blessing,
  plague) as commands that appear as causes.
- **Still abstracted**: polities (one proto-state), culture (one), tech
  (a handful of principles), no war, no space, ecology as a biomass field.
- **Architectural risks**: the collapse algorithm (§14) and reconciliation
  (§9) are novel — the phase exists to test them; resolver output that
  reads as random rather than as a life.
- **Performance risks**: macro-history size; resolve latency; active-window
  step cost in TypeScript vs Classic's measured 0.2 ms/person.
- **Done when**: a 200-year run on the phone floor inside budgets; clicking
  any villager resolves a biography whose migration cites a recorded flow
  and whose flow cites a decision; conservation property tests pass on 1,000
  random click orders; a century of watching leaves the hash chain unchanged;
  laying and lifting the hand is exact; a drought act shows up in the why-tree
  of the famine it causes; save ≤ 3 MB.
- **Proves**: lazy materialization with conservation and provenance works,
  the microscope can sit on top of aggregates without changing them, and the
  god's acts are ordinary causes.
- **At the gate (measured 2026-09-25, milestones 11–15):** every "done when"
  holds as a test. The reference slice ("first light", 300 years: farming,
  villages, trade, metalworking, a market town) runs in about 0.75 s in Node
  (budget 6 s; slowest year 47 ms, when a province's first village refines its
  region), saves in 0.15 MB compressed (bar 3 MB), and on a 4×-slowed CPU with the
  simulation on the page's own thread still simulates 49 years a second on
  average and never under 10 (the world's pace is one); in a worker the page
  keeps 17 ms median frames under software GL. A grown citizen's memory walks
  across at least four domains to the star (`tests/causal/north-star.test.ts`);
  conservation holds over 1,000 random click orders; a century of watching
  leaves the hash chain unchanged; laying and lifting the hand is exact; a
  withheld rain shows in the why of the famines it causes; the slice with acts,
  the hand and a save continued through text is bit-exact on V8,
  JavaScriptCore and SpiderMonkey (`npm run engines`, suite "slice"); pure runs
  are unchanged by every feature added (only a new store's domain joins the
  checkpoint). Not yet measured: a real iPhone (`/universe/?bench=5000`,
  rotation) — the proxy stands in until then.

### Phase 2 — Regional civilization (≈ 45k)

- **Adds**: many settlements and provinces; polities with institution
  compositions and interest groups; culture vectors, drift, divergence;
  belief systems; language and naming; diplomacy with sourced opinion;
  technology v1 (principles, capabilities, knowledge, realizations — ~60
  principles); design grammar v1 (tools, weapons, buildings); conflict v1 on
  the province graph (forces, engagements, supply, occupation, rebellion);
  city district grid with land use; history retention with hindsight
  importance; the divine-act grammar at person, place and province scale,
  with omens the belief system reads; observer watches and alerts.
- **Still abstracted**: planet-wide climate change; other species' cultures;
  industrial economy depth; space.
- **Architectural risks**: decision records that are too thin to explain,
  or too fat to store; interest-group politics collapsing to one outcome;
  the design grammar leaking special cases.
- **Performance risks**: trade and supply iterations on dense graphs;
  chronicle growth.
- **Done when**: over 500 years on 11 seeds, polities form, split and fight
  wars whose `why` chains reach economic and geographic facts; ≥ 4 distinct
  government compositions appear across seeds; a rail-like realization
  visibly reshapes a city's districts.
- **Proves**: society, economy, politics and war emerge from one causal
  state and can be explained.

### Phase 3 — Planetary procedural civilization (≈ 60k)

- **Adds**: the whole planet at A1 (≈ 1,000 provinces); deep-time
  prehistory producing the biosphere and the emergence of the intelligent
  species; ecology guilds with human impact; industrialization (energy
  principles, factories, fuels, pollution, climate anomalies); multiple
  cultures and states planet-wide; macro-history paging.
- **Still abstracted**: alien biology in play (Earth prior only); space.
- **Architectural risks**: prehistory generation that does not explain the
  present (deposits must come from the history that made them);
  planet-scale flows destabilizing.
- **Performance risks**: one aggregate year of 1,000 provinces within ≤ 1 s
  on the phone; history storage.
- **Done when**: the Earth seed produces agriculture, states and
  industrialization within its calibration bands; coal and oil exist where
  the biosphere's history put buried biomass; the north-star test passes on
  the Earth seed.
- **Proves**: the pipeline from seed to industrial planet is one system.

### Phase 4 — Full procedural biology and technology integration (≈ 72k)

- **Adds**: the full body-plan grammar and affordance vector; alien priors;
  species-general population, needs, settlements and warfare; technology
  realizations driven by biology and materials (the aquatic-metallurgy case);
  procedural creature, building and vehicle specs at all LODs; a
  species-generic active-window engine.
- **Still abstracted**: space.
- **Architectural risks**: hidden human assumptions surfacing everywhere
  (the diversity tests exist for this); grammars producing noise instead
  of meaningful difference.
- **Performance risks**: procedural mesh generation and caching on phones.
- **Done when**: across 100 open-prior seeds, the diversity tests show
  mechanically distinct outcomes (body plans → settlement form → invention
  order → military composition), and a non-bilateral, non-land species
  reaches industry by a different path.
- **Proves**: form follows simulated function.

### Phase 5 — Spaceflight and planetary colonization (≈ 84k)

- **Adds**: full star systems (bodies, orbits, analytic positions); launch
  economics from physics; spacecraft through the design grammar; orbital
  infrastructure; colonies with habitability from affordances; interplanetary
  migration, trade, politics and war on the orbital graph; terraforming and
  adaptation.
- **Still abstracted**: interstellar travel and other civilizations.
- **Architectural risks**: the orbital graph and conflict kernel reuse
  failing and needing a special path; colonies needing a second population
  model.
- **Performance risks**: several bodies at A1 simultaneously.
- **Done when**: a civilization reaches orbit at a time set by its gravity
  well and propulsion, colonizes a second body, and that colony diverges
  culturally and politically through the ordinary rules.
- **Proves**: the same systems work off-world.

### Phase 6 — Interstellar civilizations and warfare (≈ 95k)

- **Adds**: the procedural galaxy and playable cluster; sublight
  interstellar travel with light-speed communication; lag-driven divergence
  and secession; other civilizations in the cluster from their own deep time;
  contact; interstellar polities, economy and war on the star graph; divine
  acts at planet and star-system scale.
- **Still abstracted**: everything beyond the cluster (A0 only).
- **Architectural risks**: the number of simultaneously simulated
  civilizations; save growth over millennia.
- **Performance risks**: tens of planets at A1 within the phone budget —
  may require coarser cadences for distant holdings (a ruleset constant,
  not a device setting).
- **Done when**: within about two thousand game years of its first launch, a
  run from a single world reaches interstellar colonies, at least one
  lag-driven secession, contact with another civilization, and an
  interstellar war whose `why` chain reaches back to planetary facts; within
  the save and heap budgets; and at galaxy scale time runs at centuries per
  minute on the phone floor, because nothing is under the hand.
- **Proves**: the whole pipeline.

### Phase 7 — The ~100k complete first version (≈ 100k)

- **Adds**: no new layers. Integration, calibration, observatory
  completeness (every page, every instrument, every "why?"), onboarding,
  mobile polish, save migrations, performance to budget, the Earth seed tuned.
- **Done when**: the brief's §29 journey can be performed end to end by a
  player on an iPhone: generate → discover an alien planet → examine its
  ecosystem and species → a civilization → its technology → a city → an
  unimportant citizen → a formative memory → migration → war → economic
  conflict → deposit → geology → back out → spaceflight → colony → divergence
  → new states → interplanetary or interstellar war.
- **Proves**: the product vision exists in its complete shape.

---

## Part VIII — Deliverables

### A. Architecture diagram

```
 ┌──────────────────────────── MAIN THREAD ────────────────────────────┐
 │  app (boot, device tier, settings, save UI, input)                  │
 │   ├─ ui: OBSERVATORY (pages, links, why-trees, instruments, text)   │
 │   └─ render: PLAYCANVAS (view keys → pooled entities, instancing,   │
 │        LOD, camera stack galaxy→interior, shader lenses, picking)   │
 │            ▲ VisualSpec / PageSpec (pure view builders)             │
 │   bridge client: commands ▼  interest ▼  queries ▼  subscriptions ▼ │
 └──────────────────────────────┬──────────────────────────────────────┘
          postMessage + transferable ArrayBuffers (no SAB)
 ┌──────────────────────────────┴───────────── WORKER ─────────────────┐
 │  host: command queue (stamped) · step driver · snapshot builder ·   │
 │        query server                                                 │
 │  ┌───────────────────────── CAUSAL FIELD ────────────────────────┐  │
 │  │ FACT STORE      A0 latent (gen) · A1 aggregate · A2 tracked · │  │
 │  │                 A3 hand window · deviations                   │  │
 │  │ CAUSE LEDGER    events · decision records · typed causes      │  │
 │  │ MACRO HISTORY   province series · birth/death/flow ledgers    │  │
 │  │ OBSERVER LEDGER collapsed people · pinned facts · claims      │  │
 │  │ EXPLAINER       why(ref, aspect, at) · resolve(ref, depth, at)│  │
 │  └───────────────────────────────────────────────────────────────┘  │
 │  sim: planet · ecology · population · economy · polity · culture ·  │
 │       tech/design · conflict · space · acts · microscope            │
 │       (watched shadows run here too, as presentation only)          │
 │  gen: galaxy · star · planet · geology · climate · deep-time life · │
 │       species · culture · language · region refinement              │
 │  rules (data, priors) · kernel (refs, rng, dmath, time, scheduler)  │
 └──────────────────────────────┬──────────────────────────────────────┘
                     IndexedDB: save chunks, history chunks
```

### B. The ten most important architectural invariants

1. **Same seed + ruleset + command log ⇒ the same checkpoint hash chain, on
   every engine.**
2. **Observation is pure.** Queries, resolution, watching through the
   microscope, the camera, the renderer and the device cannot change the
   authoritative future. A seed with no acts has one canonical history.
   Tested by hash.
3. **Only commands are inputs.** Every divine act, and the hand itself, is a
   stamped, logged command, and every act is a cause in the ledger.
4. **Authority is decided by simulation state and commands, never by the
   camera, the speed or the device.** Fidelity budgets are ruleset constants.
5. **Randomness is a pure function of a key**; no stored or shared streams;
   no native transcendental math in simulation code.
6. **Identity is structural for anything lazily resolvable and minted only by
   the authoritative simulation** for everything else.
7. **Counted things are integers and are conserved per scale**: claims never
   exceed counts; flows balance; materialization and folding are exact.
8. **Every important change records its causes at the point of decision** as
   typed references to earlier things; nothing is cited by "latest of type".
9. **Every piece of state has one owner** that writes it only in its commit
   phase; within a phase, order cannot matter.
10. **Resolved facts never change except by simulation events that apply to
    them.**

### C. Recommended module / repository structure

See §2 (modules and dependency direction) and §40 (repository). In short:
`universe/src/{kernel, rules, gen, sim, causal, host, bridge, view, render,
ui, app}` with lint-enforced direction, Classic left in place and frozen.

### D. Deterministic RNG strategy

`draw(stream, subject, time, purpose, n)` = 64-bit keyed hash of the universe
seed, a per-stream salt from a registry of literal tags, the subject ref, the
time or period index, the purpose and a draw index. Order-independent
primitives in the kernel (ranked-key selection, exponential-key weighted
choice, keyed Bernoulli, Feistel permutation, keyed apportionment).
Short-lived local generators seeded from one draw are allowed inside a call
and never stored. `dmath` replaces every non-exact `Math` function in
simulation code. Cross-engine CI proves it. (§6)

### E. Simulation-resolution model

Two axes. **Authority** A0 latent → A1 aggregate → A2 tracked → A3 active,
changed only by sim rules or commands, with ruleset-constant budgets.
**Detail** D0 statistics → D1 identity → D2 social → D3 personal → D4
biography, raised by observation through pure, claim-respecting resolution.
Promotion and demotion are events with causes. The microscope *watches* a
shadow copy whose irreversible outcomes are imported from history (pure,
sized to the device); the god's *hand* makes one window authoritative (a
logged act, ruleset budget) with exact reconciliation when it lifts. (§8, §9)

### F. The Causal Field model

Four stores and one engine: a **fact store** (generated / simulated / derived,
with deviations), a **cause ledger** (events and decision records with typed,
weighted cause refs), a **macro history** (province time series and
birth/death/flow ledgers), an **observer ledger** (collapsed people, pinned
facts, claims), and the **explainer** (`why` with recorded, reconstructed and
generated bases; `resolve` conditioned on history). (§11–§14)

### G. The lazy-materialization algorithm (conceptual)

```
collapse(cell C, t):                     // "show me someone in this crowd"
  household ← sample from C.households − claimed; claim
  for member in household:
    (sex, age, class, culture) ← sample from C.counts − claimed; claim
    birthplace, birth year ← backward-sample over flows into C and B(p, y);
                              claim a birth; claim a unit of each crossed flow,
                              inherit its causes
    parents ← reuse an unrealized stub in the parental cell with probability
              stubs / remaining pool, else create stubs; claim
    name, looks ← pure f(ref, culture, language)
  pin D1–D2 facts in the observer ledger

deepen(person, depth):                   // "tell me their life"
  for each year of life:
    sample life events from the recorded history of the province they were in
    (rates from the ledgers; each event cites the macro event it came from)
  personality, skills, beliefs ← f(keys, culture, class, life events)
  memories ← most salient events; each memory cites its event
  pin D3–D4 facts

later(person, now):                      // "what happened to them since?"
  apply recorded period rates (deaths, moves, jobs) with the person's own keys;
  the latent remainder absorbs the difference; tiny-cell conflicts raise the
  recorded count (individual facts outrank statistics) and log a deviation

promote(person) only by a command (the hand on their place, a divine act on
them) or a sim rule — never by looking.
```

### H. The procedural-generation pipeline

| Step | Module | Tier | Output that later steps read |
|---|---|---|---|
| Seed | kernel | — | 64-bit universe seed, priors choice |
| Galaxy | gen/galaxy | A0 | density, sectors, star slots, playable cluster |
| Star system | gen/star | A0 | star mass/luminosity/HZ, bodies and orbits |
| Planet | gen/planet | A0 | mass, radius, g, atmosphere, rotation, tilt, temperature |
| Geology | gen/geology | A0 + deviations | plates, elevation, volcanism, deposits with provenance |
| Climate | gen/climate → sim/planet | A0 → A1 | temperature, precipitation, biomes; anomalies over time |
| Life & ecosystems | gen/life (deep time) → sim/ecology | A0 → A1 | clades, species, niches, guild biomass; buried biomass → fuels |
| Species | gen/life | A0 | body plans, affordance vectors |
| Intelligent species | gen/life | A0 → A1 | the first people: population cells, life history |
| People | sim/population + causal/observer | A1 (+A2, A3, observed) | counts, flows, ledgers; resolved lives |
| Settlements & cities | sim/economy | A1 + A2 | places, districts, land use |
| Civilizations | sim/culture + sim/polity | A1 + A2 | cultures, beliefs, languages, polities |
| Economies | sim/economy | A1 | goods, recipes, markets, trade, transport |
| Governments | sim/polity | A1 + A2 | institution compositions, interest groups, decisions |
| Technologies | sim/tech | A1 | knowledge, capabilities, principles, realizations |
| Conflict | sim/conflict | A1 + A2 (+A3) | forces, wars, occupation, rebellion |
| Industrialization | sim/tech + economy | A1 | energy, factories, pollution, climate anomalies |
| Spaceflight | sim/space | A1 + A2 | launch economics, craft designs, orbital infrastructure |
| Colonization | sim/space + population | A1 + A2 | colonies, interplanetary flows |
| Interstellar | sim/space + culture + polity | A1 + A2 | travel, lag, divergence, contact, new states |
| Interstellar war | sim/conflict on the star graph | A1 + A2 | fleets, campaigns, occupation of systems |

### I. The first 15 implementation milestones (dependency order)

1. **Split**: `universe/` app skeleton beside a frozen Classic; CI with
   module-boundary lint and determinism lint; Pages at `/universe/`.
2. **Kernel randomness and math**: refs, 64-bit keyed draw, stream registry,
   sampling primitives, `dmath` with golden vectors; cross-engine CI (Node,
   Playwright WebKit, Firefox).
3. **Time and scheduler**: SimTime, phases with literal order keys,
   staggered cadences, timed event queue, compute-then-commit stores,
   per-domain hash chain, oracle.
4. **Commands and causes**: command log; event log; typed cause refs;
   decision records; the `why` API skeleton; retention with tombstones.
5. **Saves**: chunked container, gzip, schema versions and migration chain,
   snapshot ring, replay verifier, export/import.
6. **Worker boundary**: host, protocol, snapshot builder, query server,
   in-thread fallback; observation-purity and interest-purity tests.
7. **PlayCanvas shell**: camera stack, view keys, instanced layers, LOD
   manager, picking; 10k-instance benchmark on the phone floor.
8. **Planet generator v1** under the `earthlike` prior: grid, plates,
   elevation, hydrology, climate, biomes, deposits with provenance; globe view.
9. **Region refinement**: parent-constrained tile maps; region view.
10. **Population A1**: cells, households, flows, birth/death/flow ledgers
    with causes, settlements, macro history paging.
11. **Observer ledger and resolution**: collapse, deepen, later; person and
    household pages to D4; conservation property tests.
12. **Economy v1**: goods, recipes, jobs, markets, trade on the region graph,
    settlement growth, decision records for migration.
13. **Observatory v1**: navigation planet → person, "why?" on every value,
    charts from the macro history; the north-star scenario test on the slice.
14. **Microscope v1 and first acts**: the watched shadow with imported
    outcomes; the hand and its lifting as commands; agents with needs, work
    and homes; reconciliation and watch-purity tests; the first divine acts as
    commands that appear in why-trees.
15. **Slice gate**: 200 years on the phone floor within budgets; save,
    continue and replay bit-exact on three engines. End of Phase 1.

### I.2 Phase 2 milestones (planned 2026-09-25, after the slice gate)

16. **Peopling the land**: foraging bands bud off into empty land long before
    hunger drives them (the wave of advance), farming spreads by learning and by
    farmers' own moves; dozens of provinces within the chronicle's first
    centuries; the per-year cost stays flat per province.
17. **Culture and language**: culture vectors per province that drift and
    diverge with distance and isolation; a phonology per culture so names drift
    apart; the explainer says why two peoples differ.
18. **Polities v1**: chiefdoms gather provinces around market towns; institution
    compositions (who leads, who counsels, what law) and interest groups with
    sourced demands; splits and successions as decisions.
19. **Belief**: belief systems that read the world — disasters, plenty, the
    god's acts as omens — found cults, reform, and are blamed.
20. **Technology v1**: ~60 principles, knowledge that diffuses along roads and
    kin, realizations through the design grammar (tools, weapons, buildings).
21. **Diplomacy**: opinion between polities from sourced causes (borders,
    trade, faith, grievance), pacts and their breaking.
22. **Conflict v1**: forces from people and technology, war decisions whose
    factors reach economy and geography, engagements, supply, occupation,
    rebellion, peace.
23. **Cities**: the district grid with land use; a rail-like realization that
    reshapes a city's districts.
24. **Acts and watches**: the divine-act grammar at person and place scale,
    omens the belief system reads; observer watches and alerts; hindsight
    importance in history retention.
25. **Phase 2 gate**: 500 years on 11 seeds — polities form, split and fight
    wars whose why-chains reach economic and geographic facts; four or more
    distinct government compositions. Run by `npm run gate:2`
    (tools/phase2-gate.ts, one process per seed) and in CI.

Phase 2 closed at `6fc5186`; two pieces of its milestones that had been thinned
when first built followed: interest groups with sourced demands (the tithe and
war declarations read them) and the design grammar v1 (houses and hosts
realized from principles and materials; hosts' performance is what armies
fight with).

### I.3 Phase 3 milestones (planned 2026-09-26, after the Phase 2 gate)

26. **Deep time**: the planet's history in ages — sea level, warmth,
    glaciations, great volcanism and impacts — with every cell's past latitude
    from its plate's rotation; swamp forests on warm, wet, low land and plankton
    in warm shallow seas, buried in subsiding basins, are where coal and oil lie
    now; each deposit cites the age that made it.
27. **The biosphere and its clades**: clade radiations and extinctions tied to
    the ages' events; the present biosphere as guilds per cell (producers,
    grazers, browsers, predators) and the species that fill them; the
    intelligent species' emergence (where, when and why there) sets the cradle;
    domesticable herd beasts and seed grasses set where herding and sowing can
    be found.
28. **Ecology with human impact**: guild stocks per peopled land with growth and
    coupling; hunting, herding, clearing for fields and fuel draw them down;
    megafauna losses, deforestation and worn soils enter history as causes.
29. **The whole planet peopled**: prehistory spreads bands over every reachable
    continent (land bridges, coastal and island crossings), ≈ 1,000 peopled
    lands within the chronicle's first centuries; the globe, the chronicle and
    the inspector hold up at that scale.
30. **Macro-history paging**: lands far from the observer's interest step
    coarsely with the same expected flows and refine when looked at; a year of
    the whole planet within budget on the phone proxy; history storage bounded.
31. **Many peoples, many states**: language and culture families across
    continents; empires held by writing, clerks and roads; sea routes and
    overseas contact; war and diplomacy across seas.
32. **Energy and industry**: principles toward coal mining, the steam engine,
    factories, railways, electricity and oil, each needing its resource from
    deep time; capabilities (power per person, process heat); machines and
    factories through the design grammar; an industrial economy.
33. **Pollution and a changing climate**: burning puts carbon in the air; a
    planet-wide warming shifts temperature and rain; smoke harms health; each
    with its causes in history.
34. **Calibration**: bands on the Earth seed for when sowing, the first states,
    writing, iron and industry arrive and how many people the planet holds;
    a report tool and tuning within the bands.
35. **Phase 3 gate**: on the Earth seed, agriculture, states and industry
    within their bands; coal and oil only where the biosphere's history buried
    biomass; the north-star test on the Earth seed; a year of the whole planet
    within budget.

Order, as built: 26 and 27 first; then 29 and 30 before 28. Once the cradle is
where the people arose and taming and sowing wait on what lives there, a peopled
area of four steps around a tropical cradle rarely reaches copper-bearing
mountains or herd beasts, so the whole planet peopled (and paged, to stay within
budget) comes before the ecology.

29–30, as built: people live in provinces of a frequency-20 grid (4,002 over the
planet, ~1,200 on land), each gathering the fine cells nearest it
(`gen/provinces.ts`); the simulation runs on that province world unchanged, the
globe and regions on the fine one. The chronicle opens with bands over every land
joined to the cradle (and across a single province of sea), some 550 lands on the
Earth seed. Paging is by a land's own state, never by where anyone looks: a quiet
land's births and deaths are reckoned once a year. Villages are sited on a small
per-land site map, so the simulation never refines a full region. History is held
for living memory (120 years of births, deaths and moves; summaries yearly for a
century, then one year in ten); ended wars and realms and every design are folded
into rolling digests. The life table was recalibrated to pre-modern rates (about
0.3% a year at plenty). A year of the planet costs 0.38 s on average and 0.65 s at
the 99th percentile on the phone proxy (4× slower).

28, as built: each peopled land keeps three living stocks against what they were
before anyone took from them (`sim/ecology/ecology.ts`): the wild (game and wild
food), the forest (against the land's first cover) and the soil. Foragers taking
more than three-fifths of what the wild yields thin it; fields take the wild's
ground and clear the forest at once; farming wears the soil unless fields are
rested in turn or dunged; each heals as the pressure eases. The year's forage is
scaled by the wild and its grain by the soil, migration weighs lands as they stand,
and a land stripped of its forest has no wood to build with. Wild thinned, forest
cleared and soil worn enter history once (again only after recovery), citing the
knowledge that brought the pressure; a land hunted at over a third of its wild's
yield loses its great beasts, each loss an event of its own. With time compressed as
the chronicle compresses it, the life table grows about 0.75% a year at plenty.
Keeping the planet within budget as it fills: history's compaction walks only what
joined the chronicle since the last reckoning (what the chronicle reaches is kept
for ever, so that set only grows); large random counts (births, comings of age,
movers) are drawn whole as binomials instead of one by one; settlements fold their
unchanging facts into a digest. A year costs 0.43 s on average and 0.72 s at the
99th percentile on the phone proxy, with some ten million people by year 300.

31, as built: the bands' ways and speech drift along the paths they took (each land's
from the land its bands came from), so kin peoples live near each other and speak
alike (`sim/culture/languages.ts`). At the opening a land speaks the language whose
standard its speech is most like (72 in a hundred or more), else a daughter language
of its own; the first people's daughters begin families (18 on the Earth seed, some
105 languages). Through the chronicle a language's standard is the speech its lands
share, weighted by their people; a land drifted below 62 in a hundred goes over to a
nearer neighbouring language or becomes a language of its own (a decision: how far
it drifted, the distance, a road to its kin, a realm between), taking like
neighbours with it; a land goes over to the speech most of its neighbours speak
when theirs is nearer its own; a land ruled from a seat of another speech takes it
up in time, the sooner with roads and writing, keeping a few of its old sounds; a
language no one speaks dies; families meeting for the first time meet in history.
Ships open the sea (`sim/economy/sea.ts`): sails cross two provinces of sea, planked
ships four, the stars' courses eight; coasts in reach trade (a quarter of the land
haul, plus landing), each first voyage an event citing the craft that made it;
diplomacy meets across the sea through that trade; realms rule across it (a
crossing counts as two steps) and fight for lands their traders have reached,
landing at six-tenths of their strength; paved roads, like writing and clerks, let a
seat rule a step further. The tongues lens colours lands by language, hues by
family. A year costs 0.43 s on average and 0.68 s at the 99th percentile on the
phone proxy.

32, as built: coal lies wherever deep time buried enough swamp forest, oil enough
plankton (`SEAM`, `seamRef` in `gen/homeworld.ts`: a named field, else the age that
laid it). Nine principles follow iron and steel: digging coal (found only near a
seam), gears and clocks, the steam engine, the factory, railways, steamships (the sea
crossed sixteen provinces out), electricity, drilling for oil (only near a field) and
the oil engine; `power` and `industry` are their effects. Coal, oil and machines are
goods: coal is dug and oil drawn from a land's own seam, machines made in works from
tools and coal; where it is cold, those who know coal burn it for warmth; a land's
works burn fuel in proportion to its crafters and its industry, and what they get
drives them (up to two and a half times the crafts); machines, worn like tools, raise
what farmers, herders and crafters make by half. Fuel and machines are made only
while the stock is under three years of their use. A land's first coal, oil and
machines are events whose why walks back to the knowledge and to the age that buried
the fuel. Power per person (their own strength, beasts, mills, and each unit of fuel
burned) is a fact of every land. The design grammar gains the works a land's crafts
are done in and what drives them (workshops worked by hand to steel-framed halls run
by electric motors). Industry arrives only as the lore reaches steel and banking —
after the chronicle's fifth century on the Earth seed; M34 calibrates when. A year
costs 0.45 s on average and 0.79 s at the 99th percentile on the phone proxy.

33, as built: the air (`sim/climate/air.ts`) holds carbon, 280 parts in a million
before anyone burned or cleared. Each year every land's burned coal and oil (last
year's ledger) and every land's cleared forest (from the ecology, regrowth taking
some back) add to it, and the land and sea take back two percent a year of what is
over the old measure (a slow release is mostly taken up within decades). The world
warms toward three degrees for each doubling, a twenty-fifth of the way each year. Rain moves with the warming (the subtropics and
dry lands drier, the high latitudes and wet lands wetter, 6% a degree), hot fields
yield 5% less a degree and cold ones 3% more; smoke from the fuel a land burns for
each person (over three years) raises its deaths by up to three-tenths. Each half
degree is an event citing the lands that burned and cleared most (their works, mines
and clearings); a land whose rain has moved a tenth, and a land whose air grew foul,
are events citing the warming and the works; a drought in a land grown drier cites
the drying. A unit of fuel (four kilowatts for a year) puts 2.4e-9 parts in a million
in the air, Earth's rate; clearing some 5e-6 a square kilometre. The bar shows the
warming and the carbon once there is any; the inspector shows a land's smoke and its
rain moved.

34, as built: `npm run calibrate` (`tools/calibration.ts`, bands in
`tools/calibration-bands.ts`) runs the Earth seed nine centuries and reports the year
each turning point first comes and, each century, people, realms, wars, tongues,
famines, secessions and the air, each against its band. On the Earth seed: sowing in
year 16, the first realm (a chiefdom) in 20, writing 76, iron 266, coal dug (for
warmth) 315, the steam engine 665, the first factory 760, electricity 828; 10.6
million people at year 300, 141 million at 600, some 900 million at 900; about 50
realms standing at 500, five wars a realm a century (most a season's campaign for one
land), a hundred tongues. The tuning it took: the carbon of fuel set to Earth's rate
and the sink to decades (a runaway to thousands of ppm had followed); war declared
half as readily; a famine is a month under seven-tenths fed (a people at the edge of
their land's yield is hungry most years, not starving); and the demographic
transition — a people's fertility falls by up to a third as power per person rises
from a quarter to two and a quarter kilowatts, about replacement at industry's lower
deaths — without which the industrial boom overshot into a ninth-century collapse.
The warmth of the chronicle comes mostly from clearing, peaking near 0.7 °C.

35, as built: `npm run gate:3` (`tools/phase3-gate.ts`, in CI) runs the Earth seed
nine centuries and fails unless every turning point and number stands in its band;
every first mine and well lies on a seam deep time buried and cites its field or age
(231 of them); sixteen grown citizens met at year 900 each walk from a memory across
four or more domains to the star with every hop that mattered on the record (the walk
is `src/causal/north-star.ts`, shared with the north-star test); no year of the whole
planet takes over 0.6 s at full speed (1.2 s on CI; the phone proxy holds its own
budget); and the save stays under 16 MB. What the gate found and was mended: a famine
without a dry year cited only its land — it now cites the farming that let a people
outgrow their land, and worn soil, thinned game or a drier sky where they pressed;
the peopled world kept every event of weight 3 or more for ever, so history grew with
every dry year — the chronicle is now weight 4 and all it cites, ordinary events stay
while young or held by a store, and the tombstones of what was forgotten stay two
centuries (the summaries keep their count). The save at year 900 is 14 MB (5 MB at
300), bounded by the living-memory windows and growing with how busy the world is, not
with its age. **Phase 3 closed.**

### I.4 Phase 4 milestones (planned 2026-09-26, after the Phase 3 gate)

Phase 4's "done when" (Part VII): across 100 open-prior seeds the diversity tests
show mechanically distinct outcomes — body plans to settlement form to invention
order to military composition — and a non-bilateral, non-land species reaches
industry by a different path. The Earth seed keeps its calibration throughout: the
upright ape's derivations must give back the numbers Phase 3 tuned.

36. **The body-plan grammar**: the lineage that rises to thought is any of the
    biosphere's, not only an upright ape — its medium (land, shore or water), its
    symmetry, size, manipulators, senses, skin, metabolism, diet, how it bears young,
    its span of life and its sociality, each drawn from its lineage and its cradle and
    explained by them; an affordance vector derived by laws (dexterity, strength,
    endurance, whether it can kindle fire, sight, cold and heat tolerance, speed on
    land and in water).
37. **Life history from the body**: the life table (bands, fertility, mortality,
    coming of age, appetite) derived from size, bearing and span; the upright ape's
    derivation is today's humanlike table; every system reads the people's own.
38. **Habitat and needs by species**: where a people can live (land, shore, shallow
    sea) and what it eats by its diet; the province world holds sea provinces for a
    people of the water; capacity, migration and settlement over its own medium.
39. **Technology by biology and materials**: principles gain the affordances they
    need and the realizations a body allows — a people without fire comes to metal
    another way (the aquatic-metallurgy case: vents, shells, electrochemistry), so
    invention order follows the body and the medium.
40. **Settlement form from the body**: houses, works and cities through the design
    grammar with roles and materials of the people's medium (reefs grown, burrows,
    nests, towers) and a doctrine from their body.
41. **Military composition from the body**: hosts from the body's own weapons and
    guards and what can be tamed in its medium; war's strength follows.
42. **Procedural creature, building and vehicle specs**: the body plan as a visual
    spec at every level of detail (the crowd's figures, the microscope's), buildings
    and vehicles from their design parts; the renderer draws any people.
43. **A species-generic active window**: the hand and the microscope for any body
    plan (households, lifespans, childhood, movement).
44. **Diversity tests**: a hundred open-prior seeds — their peoples' body plans,
    settlement forms, invention orders and hosts compared; a report tool.
45. **Phase 4 gate**: distinct outcomes across a hundred seeds; a non-bilateral,
    non-land people reaching industry by another path; the Earth seed within its
    bands; budgets hold.

36, as built: `rules/bodies.ts` holds eight clades — upright apes, feathered
striders, scaled crawlers, six-limbed burrowers, trunked giants, shaggy climbers,
many-armed swimmers, shelled shore-walkers — each a body (medium, symmetry, size,
manipulators and how many, senses, skin, blood, diet, bearing, young, span, social)
and a fit to a world's cradle warmth and rain, pull and seas, with its reason in
words. Under the Earthlike prior the people are always the upright apes, Earth's own
numbers; on an open world the clade the world favours rises (a keyed draw weighted by
fit, among the media a people can yet live in — land until M38), its body grown by
the world's pull (heavier worlds, smaller bodies) and chance. Affordances follow by
laws (`affordancesOf`): handling, strength by size, endurance by blood, fire only out
of the water and with handling enough, sight, cold and heat by skin and blood, speed
on land and in water, fecundity by clutch and bearing. The people's why tells where
they arose, why their clade rose there, and their body (`life.people`, which replaces
`life.apes`). Across forty open worlds six clades rose; nine had no land for a cradle.

37, as built: `lifeHistoryOf(body)` (`rules/species.ts`) stretches the upright apes'
table to the body's span — bands, coming of age and yearly rates alike — multiplies
fertility by the body's fecundity and makes the first years the more perilous in
proportion (solved under the model's own ageing, so a people renews itself as the apes
do for a life as long: burrowers of 33 years grow twice as fast), and sets appetite by
size to the three-quarters, halved for cold blood. A worker gathers, sows and herds in
proportion to its appetite (a giant's day's grazing is a giant's meal), and the first
bands are as many as the wild feeds by their appetite. The table lives on the
population context (`ctx.life`, `lifeOf(world)`); births, deaths, ageing, coming of
age, work, the host, rulers' deaths, households, biographies and the microscope all
read it, and food needs are mouths, not heads. The canonical ape's derivation is
Earth's table itself: the Earth seed's history is bit-identical. Open worlds of six
clades each keep a living, growing people.

38, as built: a people lives in its body's medium. Capacity takes the medium
(`capacity(w, cell, medium)`): the warm shallow shelf feeds a people of the water as
richly as a tropical forest (its farms are beds of weed and shell), the open ocean not
at all; a people of the shore lives on coasts, land and shelf both; `livable` says
where each can live. The prehistory spreads a people over its own medium (a land people
crosses a strait, a people of the water a reach of barren sea or a neck of land), the
first bands are as many as the wild feeds by their appetite, migration goes to places
of the medium (a people of the water swims a reach of deep sea to the next shelf), and
villages rise where the medium allows — good land; the shallows, the shallower and
nearer the shore the better; the tide's edge. A people of the water comes to sowing by
the beds of its shelf, not by a wild grain. The biosphere finds a cradle for each medium
(mild land; a warm reef shelf by a coast; warm coast) and weighs each clade by its own
medium's cradle, so sea and shore peoples rise on open worlds (on alien 55, a shelf
people of 3.4 million sows its beds and raises 6,000 villages in its first fifty years).
Making strange bodies live honestly took three fixes to the life table's reckoning, each
visible only for them: a year's chance of dying compounds over the months
(`deathWithin`); the young born through a year reckoned at once die by the chance spread
over the year (`diedInBirthYear`); and the first years' peril is solved against the
simulation's own yearly reckoning (`growthOf`), so every people grows at the apes' pace
for its span; the young of a fecund body eat a share of an adult's (`young`, food in
`mouths`). Earth's apes moved by a hair (the Earth seed stays in every band).

39, as built: a principle says what it asks of a body (`BodyNeeds`: fire; the media it
serves) and a people's lore opens only what its body allows (`affordsPrinciple`) — no
kilns, smelting or burned fuel without fire; no wheels, sails, ploughs, bows, milk herds
or tanned hides in the water. The sea has its own road, closed to the land: metal from
the vents (hot springs where plates meet or a plume rises, their chimneys crusted with
metal — to a people of the water, its copper and its metalworking), vessels of shell,
reefs grown into walls, riding the currents, parting and refining metals with currents,
mills turned by the tides, works driven by currents, the vents' heat and electricity
under the sea. Power from tides, currents and vents is `renewable`: it drives works
without fuel. Machines are made in current-driven works from tools alone, and the works
grammar gains tide turbines and vent engines. On alien 55 the shelf people come to vent
metal, shell and reefs in their first century and to electrochemistry in their second,
never to bronze, the wheel or the sail; taught the sea's road, they make machines with
no fuel burned, and the why of their first machines cites their works. Earth's apes are
untouched.

40, as built: the design grammar gains the sea's materials (coral of warm reefs, shell,
kelp of cooler shelves), two house axes (living together; living up off the ground) and
realizations for particular bodies (`fits`): reefs grown into walls, stacked shell,
kelp canopies, houses open to the water above, warrens and shell towers for a people of
the water; burrows under mounds of earth for diggers; hives for small bodies that live
as one; raised nests for the feathered; platforms in the trees for four-handed climbers;
great halls with high doors for giants. A place gives its people what its medium gives
(`landMaterials`: the shelf's for a sea people, the land's and the tide's for a shore
people), and the house doctrine reads the body — cold blood seeks warmth, a warm coat
shade, a big body room, a social one company, a climber height; under the water no rain
is shed nor sun shaded. On their worlds the sea people live in shell warrens under kelp,
crawlers and shore-walkers in burrows, burrowers in hives, giants in great halls; the
apes' houses are unchanged.

41, as built: a host is made of what its people's bodies are and can wield. The grammar
has the body's own weapons and guard (a `body` material always at hand): claws,
mandibles, tusks and trunks, grasping arms; a shell or scales that are their own armour;
and for a people of the water, darts and plates of shell and a host that swims. A
realization is either for particular bodies alone (`fits`) or asks something of any body
that would use it (`asks`): a spear a grip, an axe or sword a deft hand, a horse or
chariot a body small enough to carry. A host's materials are its medium's (shell, stone
and coral under the sea), and its strength is borne by bodies as strong as they are
(war's strength times the body's strength: a giant's host weighs many apes'). Clawed
crawlers' realms fight with claws and their own scales, burrowers with mandibles and
their own shells, giants with tusks and trunks, the sea people with grasping arms,
swimming; the apes' hosts are unchanged.

42, as built: the village plan carries the people's body, and `figureOf` (a pure view
function) makes it a figure of a few upright parts that the microscope instances part by
part, per colour group: upright apes one standing body as ever; a mantle over a ring of
eight arms for the many-armed swimmers; a low shell on six legs with mandibles for
burrowers; a flat shell on legs with a claw either side for shore-walkers; a long low
body on four legs with a tail for crawlers; an egg of a body on two long legs for
striders; a great body on four legs with a hanging trunk for giants (drawn bigger by the
cube root of their weight); a standing body with arms for climbers. The house look
follows the new designs: shell towers three times as tall, warrens and burrows low and
wide, hives and mounds domed, nests and tree platforms raised, great halls long, reef
houses open to the water above. A sea people's village lies on the blue of the sea
floor, its warrens under kelp. (Entering a village now hides the globe whichever way
the view came.) Vehicles are not yet drawn: their design kind comes with the ships and
spacecraft of Phase 5.

43, as built: the hand and the microscope were already reckoned by each people's life
table (its bands, adulthood, fertility and monthly deaths); what was left of the ape
were the households the observer meets and the pace and old age of the microscope.
Households now follow the body, every factor exactly one for upright apes (Earth's
households, the golden vectors and the oracle unchanged): the years between spouses,
parents and elders stretch with the span; spawners seldom pair (one in ten) and raise
few (0.3 of an ape's children), live-bearers of twins and clutch-layers more (by their
young at a birth, up to two and two and a half times); a people who live as one (social
0.9 and above) keep two or three grown kin under the head's roof, a new role. Over sixty
homes at year 120: apes 3.7 to a home, spawners 1.8, clutch-layers 5, hives 6 to 8.
In the microscope each people walks at its own pace (apes 1.25 m/s; striders 2, swimmers
1.4, giants 1, crawlers 0.9, shelled bodies 0.75), so its day's walks take as long, and
the old keep near home from sixty-two in an ape's seventy years, as late in any span.

44, as built (in part): `tools/diversity.ts` (`npm run diversity`; `[seeds] [years]
[--out file] [--lanes n]`) runs open-prior worlds, each in its own process, and says of
each what came of it — the people's body and medium, how many they grew to, the order
they found things in, their houses, their hosts' arms, the first power they came to (and
whether without fuel), and an outcome in a word (lifeless, died out, foragers, farmers,
realms, industry) — then the spread across them all. Its first passes found three
defects, mended here:

- Seventeen of the first hundred open worlds raise no people at all, and building one
  threw (the app too, opened on such a seed). Such a world is now a world to watch: its
  seas, weather and wild with no one in it; its time turns and its globe is drawn (the
  app check opens one in every engine).
- Short-lived peoples outbred the chronicle into billions (a shore people 1.8 billion by
  year 300, against Earth's 10 million). Two causes: each people was set to grow at the
  apes' pace times seventy over its span, and hunger, cold, plague and medicine
  multiplied the yearly chance of death — herb-lore at seven-tenths turned a spawning
  people's 99.2 per cent loss of its young into 69, thirty-nine times the survivors. Now
  every people at plenty grows at the apes' pace, and conditions scale the hazard
  (`riskUnder`: the chance of living the year raised to the power, the same as before
  for a small chance). Short-lived worlds grow about twice over a century, as Earth
  does; Earth's own history moved slightly (the oracle re-recorded) and stays within
  every band, the Phase 3 gate passing.
- Peoples of worlds where no grass bears seed never farmed. Where none grows, gardens
  of the land's own roots and fruit are found (at a quarter of the grain's chance, as
  taro, yam and manioc were tended), and the god's inspiration grants them. Those who
  still never farm live on worlds of tundra alone, where nothing can be sown.

Over three centuries, a hundred worlds: 17 lifeless, 19 foragers (all on frozen worlds),
64 with realms; eight clades and three media among the peoples; 79 distinct orders of
their first eight finds; eight house forms (warrens, tree houses, hives, long houses,
great halls, courts, nests, round huts) and seven arms (spears, claws, tusks, grasping
arms, mandibles, axes, swords); the most people any world holds 193 million, the median
1.8 million. The nine-century report, where industry would show, is still to run: twelve
lanes at 1.5 GB each ran the machine out of memory, and the tool now allows 3.5 GB a
world (or `--lanes n`).

### I.5 Phase 5 milestones (planned 2026-09-26, after the Phase 4 gate)

Phase 5's "done when" (Part VII): a civilization reaches orbit at a time set by its
gravity well and propulsion, colonizes a second body, and that colony diverges
culturally and politically through the ordinary rules. The chronicle runs past its
ninth century for this; Earth's bands up to 900 years stay as they are, and the
home world's history is untouched by the sky being there (the system is generated,
not ticked, until someone flies).

46. **The star system**: the home star's other planets and moons from the seed and
    the prior — rocky worlds inside the frost line, giants and ice giants beyond it,
    moons about them and about the home world — each with its orbit (Kepler elements),
    mass, radius, surface gravity, escape speed, air (pressure and kind), temperature,
    water (none, ice, seas) and radiation, by textbook relations, every fact
    explainable; analytic positions at any time. Earthlike prior: a system like the
    Sun's (a large moon, a small cold red world, a hot shrouded one, giants). The
    observatory's system view: orbits and bodies moving, a page for each body.
47. **The sky's principles**: the tree past power — rocketry, guidance, orbital flight,
    life support, stations, transfer flight, habitats, and the nuclear drive — each
    with what it needs of the body and the medium (a people of the water reaches
    rocketry by electrochemistry: propellant parted from the sea).
48. **Launch economics from physics**: speed to orbit from the home world's gravity,
    radius and air; the rocket equation with the propulsion's exhaust speed gives the
    payload fraction and the cost of a tonne to orbit; heavy worlds fly later or not
    until a better drive; launchers through the design grammar (stages, propulsion,
    structure, payload).
49. **First orbit**: a realm launches when it knows orbital flight, has the industry
    and the wealth for the cost the physics sets, and a reason (rivalry, prestige,
    knowledge); the first satellite and the first crew, each an event whose why
    reaches the gravity well, the propulsion and the realm; stations as records with
    designs.
50. **The orbital graph**: Hohmann transfers (speed and time) between bodies, launch
    windows from synodic periods, all analytic; which bodies a realm can reach with
    the drive it has; the same edges carry ships, goods, people and fleets.
51. **Habitability and life support**: each body against the colonists' own body —
    gravity, pressure, temperature, radiation, air and medium (a people of the water
    needs seas or ice to melt) — gives what a colony must build to live there and at
    what cost; domes, pressurized halls and flooded vaults through the design grammar.
52. **Colonies**: a realm founds a colony on a body it can reach and afford; the colony
    is a land of the ordinary kind on another world — its people counted, fed, born
    and dying by the same rules, its market, ways, tongue and faith carried from home
    and drifting — so no second population model; migration between worlds as flows
    with ship capacity and cost.
53. **Divergence and independence**: the colony's ways drift (distance and the lag of
    word from home weigh as a sea does), its interest groups follow its own economy,
    and the ordinary rules of grievance and secession make it a realm of its own when
    they do; trade and war on the orbital graph by the same kernels.
54. **Watching the sky**: the observatory follows it all — the system view with ships
    in flight and colonies marked, launch and colony pages, the why of a colony's
    independence back to the home world's gravity and the colony's own ground; the
    microscope on a colony's halls.
55. **Phase 5 gate**: on the Earth seed and on open worlds, a realm reaches orbit at a
    time its gravity and drive explain, a second body is colonized, and the colony
    diverges in ways and politics through the ordinary rules; heavier worlds reach
    orbit later; budgets hold with more than one world peopled.

46, as built: `gen/system.ts` makes the home star's other planets and moons on a
stream of its own (`gen.system`), so the home world and its history are untouched (the
oracle unchanged). The Earthlike prior's template gives a Sun-like family — a small
scorched world (126 °C, a trace of air), a shrouded one (460 °C under 74 bar), the home
world third with one great moon (a month round, airless, 53 times the home world's
radiation), a small cold red world (−62 °C, 0.03 bar, ice), two gas giants and two of
ice with their moons; the open prior draws inner and outer worlds spaced outward from the
home world, rock inside the frost line (2.7 AU × √L), gas giants just beyond it, ice
giants farther. Each body's numbers come from textbook laws: Kepler's third for its
year, gravity and escape speed from mass and radius, an air held only if the escape
speed is six times the air's thermal speed at its warmth, its pressure the weight of its
volatiles' column (their square times the square of the pull), about 33° of greenhouse
warmth a bar (less than in step), seas or ice by warmth and air, radiation by the light
received and the air above; every body carries its reasons in words. `rules/orbits.ts`
holds Kepler's equation for all layers (gen places bodies, the view draws them, M50's
transfers will read it). The observatory: "The sky" on the world's bar opens the
system view (a month a second, the star's page listing its worlds, a page for each body
with its orbit, ground and why; distances drawn by their square root so the scorched
world and the ice giants share a phone screen). The systems are part of the engines'
agreement vectors.

47–51, as built: nine principles past power (electronics, rocketry, guidance, orbital
flight, life support, stations, transfer flight, habitats, the nuclear drive), reached by
the land's electricity or the sea's (`needsMet`: a need "a|b" is met by either).
`rules/launch.ts`: the speed to orbit from a world's pull, radius and air (9.4 km/s from
the home world; 13.5 from a 1.6 g world); the rocket equation over one to four stages;
engines — powder (2.2 km/s of exhaust), oil (3.1), water parted by current (4.3, a
people of the water's own), the atom (8.5) — and frames; the cheapest launcher a people's
knowledge allows, or none that lifts a two-hundredth of its mass (a heavy world's first
engines cannot reach orbit at any price). `sim/space` (M49): a realm whose seat knows
orbital flight sends up its first satellite, crew and station when its machines bear the
cost (the physics' price times 600 machines, from the realm's lands) and it has reason (a
rival there first, a war); each first an event whose why names the world's pull and the
engine. On the Earth seed: orbital flight found in year 1021, the first satellites in
1044, the first crew in 1076, the first station in 1145, habitats found in 1175.
`rules/orbits.ts` (M50): Hohmann transfers about the star or the home world, the burns to
leave and enter low orbits (with each world's pull), landing (aided by air), synodic
windows — the great moon 5.4 km/s and five days away, always open; the red world 3.7 km/s
to leave, 274 days, a window every 800 days; `delivered` prices a tonne set down on
another body (oil engines reach the great moon, not the giants' moons). Each body's page
shows its speed to orbit and its way from the home world. `rules/habitat.ts` (M51): a
body against the colonists' own body — air made, pressure halls or hulls, heating or
cooling by how the body bears cold and heat, burial against radiation, water melted,
flooded vaults for a people of the water, a pull too weak or strong — each a yearly
upkeep in machines a settler; past ten, not settled.

52–53, as built: colonies are lands of the ordinary kind (no second population model).
The province world holds three sites of sealed halls on every body with ground, after the
planet's own lands — each per-land array's tail holds the halls' inside (warm, watered,
the "sealed halls" biome, farmed under roofs, no wild), the sites neighbours only of their
body's others, far off the sphere; the planet's loops and count are untouched (Earth's
history unchanged). A share of every settler's work keeps the halls alive (the habitat
upkeep as hands taken from the fields). A realm with a station that knows habitats and
transfer flight sets five hundred settlers from its most crowded land down on the
cheapest body its people can live on and its drive can reach, paid in machines: the flow
recorded as a migration (the observer's conservation holds), the land in the realm,
carrying the seat's knowledge, its land's ways, tongue, goods and a year of food; its why
names the body and the way. Across space a realm's reach counts the crossing by how long
it takes (`spaceSteps`: the home world's moon a step, the red world four, the giants'
moons six to ten), so a colony is not cut off by the next secession at home; word comes
late, so grievance rises by the crossing; the halls press their people's ways each year
(kin and thrift up, tradition and openness down, citing the founding), and while ruled
from home the colony hears the seat's ways faintly (1 / steps). The ordinary rules do
the rest: on the Earth seed the first colony comes in year 1229 on the great moon, and
by 1400 a dozen colonies on the moons and the red world, the far ones broken away by
grievance or at a ruler's death, the great moon's lasting longest.

54, as built: the observatory follows the sky. `space.state` (host) gives each realm's
firsts and every colony — its body and site, people, hunger, who rules it and who founded
it, and its founding event. The system view rings each settled body, and draws the
satellites and stations of the realms about the home world; the star's page lists who is
in the sky and when they got there, a body's page its halls (and its moons'), and a
colony's page its people, how they fare, who rules them, and the why of its founding.
On the Earth seed at year 1260 the page shows a dozen realms in the sky, satellites from
1045, crews and stations, and the first colonies.

The Phase 4 gate, run on all hundred worlds for nine centuries, found the budgets short
where the diversity held: its timings were taken on a loaded machine (alien 55's slowest
year, alone, is 316 ms against its bound of 627), but some saves were over. A people of
short lives kept every ruler's succession for ever (each cited the one before: 61,620 on
alien 55 against Earth's 2,351) and a hundred and twenty years of births, deaths and moves
though none of its living were born so long ago. Now a succession stands on its realm and
is kept while a ruler, a split or a grievance cites it (a change of ruler at a followed
land's seat is still its news), and living memory runs as long as the people's oldest
can live (`livingMemory`: the apes' 120 years exactly): alien 55's save from 19.2 MB to
13.2, Earth's history kept a little lighter, its dynamics unchanged.

45, as built: the Phase 4 gate passes. A hundred open worlds, nine centuries each: eight
body plans among the peoples, in all three media; four ways the worlds end (17 lifeless,
17 foragers, 58 with realms, 8 industrial); 71 distinct orders of the first eight finds;
eight house forms, five arms; a people of the water — radial swimmers — coming to power by
tide mills, without fuel, in year 467 (alien 41); none growing faster than 2.41-fold a
century; every save within its bound; the Earth seed within its bands (the Phase 3 gate).
A world's slowest year is judged alone on the machine, as a phone would run it (worlds run
four abreast share the machine and slow one another by about 1.7×): the four that were over
side by side were within alone — alien 41 459 ms (bound 663), alien 51 1,280 (1,666),
alien 13 1,550 (2,296), alien 61 1,652 (2,758).
### I.6 Phase 6 milestones (planned 2026-09-26, during the Phase 5 gate)

Phase 6's "done when" (Part VII): within about two thousand game years of its first
launch, a run from a single world reaches interstellar colonies, at least one lag-driven
secession, contact with another civilization, and an interstellar war whose `why` chain
reaches back to planetary facts; within the save and heap budgets; and at galaxy scale
time runs at centuries per minute on the phone floor. Travel is sublight; word travels at
the speed of light; nothing is under the hand out there.

56. **The galaxy and the cluster**: galaxy parameters from the seed (disk, arms, bulge);
    sectors with stars by keyed draws (a star is `gen(seed, sector, k)`, untouched stars
    cost nothing); the playable cluster of the few thousand systems within some fifty
    light-years of home, each star's own system generated when first needed (the same
    generator as the home system's, under the open prior); the galaxy and cluster views.
57. **Drives for the dark between stars**: principles past the nuclear drive — fusion
    (a hundredth of light's speed), beamed sails, antimatter (a quarter) — and starships
    through the design grammar: a cruise speed from the rocket equation at the drive's
    exhaust, a crew asleep or born on the way; which stars a realm can reach in a life.
58. **Voyages on the star graph**: a realm with a drive and a reason sends a ship to the
    nearest system with a body its people can live on; the ship is a record in flight
    for decades; word of it travels back at light's speed; arrival is an event whose why
    reaches the drive, the distance and the home world.
59. **Colonies among the stars**: the arrival founds a colony on the target system's
    body, a land of the ordinary kind (offworld sites taken, as the ship arrives, from a
    pool the province world keeps for other stars' bodies; the site's body read from that
    star's generated system); the colony's people, knowledge, ways and tongue as in M52.
60. **The lag of light**: a realm's reach over its star-holdings counts years of light;
    orders are years old when they arrive; grievance, divergence and secession follow the
    ordinary rules with the lag as their distance; a colony twelve light-years out hears
    its capital twelve years late.
61. **Other civilizations**: the cluster's other peopled worlds, from their own deep time
    (their stars' ages, their planets' biospheres); each an aggregate civilization at A1
    (people, knowledge, realms, drives) advancing by the same laws in aggregate, never a
    second full planet sim; their signals leave them at light's speed once they have
    electronics.
62. **Contact**: a people hears another's signals, or a ship arrives in an inhabited
    system; first contact as an event whose why reaches both worlds; relations on the star
    graph by the diplomacy rules (reputation, pacts, rivalry), each side knowing the other
    only as its light-old news.
63. **Interstellar polities and trade**: holdings across stars as realms of the ordinary
    kind; trade in what is worth carrying across light-years — knowledge, rare goods,
    people; tribute that takes decades to arrive.
64. **Interstellar war**: fleets through the design grammar, campaigns of decades on the
    star graph, sailing on intelligence years old and arriving to what has changed; each
    system's industry its own defence; war aims that outlive the governments that set
    them — the one conflict kernel on its third graph.
65. **Phase 6 gate**: from the Earth seed, within two thousand years of first launch:
    interstellar colonies, a lag-driven secession, contact, an interstellar war whose why
    reaches planetary facts; budgets hold; galaxy-scale time at centuries a minute on the
    phone floor; divine acts at planet and star-system scale.

56–64, as built (a first pass; the gate's numbers follow when it has run): `gen/galaxy.ts`
— the galaxy's disk, arms and home from the seed; ten-light-year sectors whose stars are
drawn where they lie (a keyed Poisson of the density there; masses by the two-law initial
mass function; the dead as white dwarfs), home still `star:0:0`; the cluster of some two
thousand stars within fifty light-years (the Earth seed's: 2,047, three in four red
dwarfs, the nearest at 2.9 light-years) and each star's worlds drawn on their own stream
(7,562 about the Earth seed's cluster, 421 with seas). The observatory: "The stars" from
the system view — the cluster in 3-D, a page for the stars and one for each star with its
worlds. `rules/starships.ts`: drives for the dark between stars (fusion at about a
twentieth of light's speed, beamed sails, antimatter near a third), the crossing's years,
and the longest crossing a people will ask of its own (a sleeping crew's, or a lifetime).
Voyages (`sim/space/voyages.ts`, `stars.ts`): a realm with a station, habitats and a drive
sends a ship to the nearest star with a world its people could live on; the ship is a
land of the ordinary kind (one of 36 sites the province world keeps), its people living
aboard for the crossing, then halls on that world; ruled across light-years (`lightSteps`)
it hears its capital years late, and the ordinary rules of grievance and secession follow.
Other civilizations (`gen/civilizations.ts`): a few of the cluster's worlds with seas bear
peoples of their own (the Earth seed's cluster: six, thirty to fifty light-years out),
followed in aggregate — their chronicle's start and pace against ours, when they came to
electronics, orbit (later on a heavier world) and the stars. Contact (`contact.ts`): their
signals, once they have electronics, reach home at light's speed and are heard by a realm
that can listen; the why reaches their world. War between the stars (`starwar.ts`): a
realm with a star drive and a cause — a colony among the stars broken away, or another
starfaring people heard — declares on news years old; its fleet sails for decades and
fights on arrival; the declaration's why cites the realm's own reach into the sky (and so
the home world's pull) and the hearing of the other people. Great acts (`acts/great.ts`):
the god warms or cools a whole world for up to a century (the climate reads it as
warming), or makes a star flare or calm (every land under its light finds death likelier
or rarer). Gates: `npm run gate:5` (Earth to 1400 with a light and a heavy sea world; CI
runs Earth to its first satellite) and `npm run gate:6` (Earth two thousand years past its
first launch).

### I.7 Phase 7 milestones (planned 2026-09-26, with the Phase 5 and 6 gates running)

Phase 7's "done when" (Part VII): the brief's §29 journey can be performed end to end by
a player on an iPhone — generate → discover an alien planet → examine its ecosystem and
species → a civilization → its technology → a city → an unimportant citizen → a formative
memory → migration → war → economic conflict → deposit → geology → back out →
spaceflight → colony → divergence → new states → interplanetary or interstellar war. No
new layers: every page, instrument and why the journey passes through, whole and quick on
the phone.

66. **The journey, walked by a machine**: a Playwright walk of the §29 journey at the
    phone's viewport in WebKit, each step a check that its page opens, says what it is
    and answers "why?"; the steps the observatory cannot yet take listed, and taken in
    turn by the milestones below.
67. **The living world's pages**: a species' page (its lineage, niche, where it lives and
    why, what it is to the people — tamed, sown, hunted); the world's ecosystem lens.
68. **A civilization's pages**: a realm's page (its lands, rulers, institutions, wars,
    pacts, and why it is so), and a people's technology — what it knows, in what order,
    and why each was found or learned.
69. **Economic conflict**: disputes of trade — embargoes, tolls, rivalry over a market —
    as events of the ordinary rules, with their pages and whys; the economy's lens.
70. **From a place down into the ground**: a deposit's page (what it is, which deep age
    laid it, the plate it lies on), a plate's page, the ages of the world's deep past.
71. **Onboarding**: the first run — a universe to choose (Earth, an alien world, the
    sandbox, a seed), a short guided walk of the observatory, help where it is needed.
72. **Saves that last**: saves kept in the browser's store, autosave, loading any save of
    an older ruleset (history kept, the future by the new rules), and a save's page.
73. **The phone's budgets**: frames, memory and time at the phone floor — the galaxy's
    time at centuries a minute, every scale's first frame within a second, the heap held.
74. **The Earth seed tuned to its end**: the calibration past nine centuries — the space
    age, colonies, the stars — each turning point in a band, and the chronicle's words
    read through for sense.
75. **Phase 7 gate**: the journey walked end to end on an iPhone viewport in WebKit, every
    step answered with its why, within the phone's budgets; the first version complete.

The art track (decided 2026-09-26, question 11: low-poly, procedural, the look of an
early-2000s computer game), beside 66–74 and before the gate's final pass:

- **A1 The look**: one palette and light for every scale — flat, vertex-coloured
  facets under a hard key light and a soft fill, fog to a gradient sky; the interface's
  panels bevelled and glossy in the manner of the era, still readable on a phone.
- **A2 Bodies**: each species' figure built from its body plan (limbs, heads, skin, size,
  medium), with a simple walk and idle, and clothing or tools by what its people know.
- **A3 Places**: houses by the realized building design, fields, trees, roads and walls
  in villages and cities, instanced within the phone's budget.
- **A4 The world from above**: the globe and region faceted and textured by biome, water
  with a lit surface, an atmosphere's rim, and day and night.

66–74, as built so far: `tools/journey.ts` walks the §29 journey in WebKit at a phone's
viewport — an open world three centuries on (planet, sky, a species, a realm, what they
know, a town, a citizen, a memory, a move, a war, trade, a deposit and the ground beneath
it) and the Earth seed in its space age (the sky, a colony, its drift, a state of its own,
a war out there) — each step opening its page and asking why, and reports what is missing.
The living world: every wild lineage in a place opens its why; a "Life" lens greens the
lands where most kinds of beast live. Economic conflict: war shuts the trade between the
warring realms' lands (an embargo, told once, its why the war). The chronicle can be asked
for kinds of event at any importance. A first visit is welcomed (Earth, a world never
seen, the sandbox; how to watch); a world is saved and loaded from the world's line, and
kept on its own every five minutes (the in-thread host keeps saves too). The calibration
has bands for the space age (the first satellite 950–1150, the first colony 1150–1350, the
first ship to a star 1250–1800), checked by runs that long.

The pages (M67, M68, M70): a land's lines open pages of their own over the inspector, with
the way back — a wild lineage (what it is, the age it arose in, the lands it lives in, where
the people sow it, herd it or hunted it out), a realm (its lands and people, its rulers and
those before, what its seat knows in the order it came to know it, its wars and the trade
they shut, its neighbours), a deposit (what laid it, the plate it lies on and the one it met,
the age that buried it), a plate (its crust, drift, ores and the plates it meets) and the
world's deep ages. Each is a pure read (a test holds the world's hashes unchanged by
asking). Saves (M72): the saves page lists every save the browser keeps (its world, year,
size, and whether it was carried to newer rules), loads one (another world's in its own
page, by `?load=`), keeps a copy as a file and opens one; a save of older rules loads though
the stores changed (a retired store is let go, a new one starts afresh). Onboarding (M71):
after the welcome, a guided walk in the bar shows one thing at a time — tap a land, ask why,
a lens, closer or out to the sky — moving on as the viewer does it; Help walks it again.

The long run's budgets (M73, for the Phase 6 gate's 3100 years): a hungry land's births and
deaths are reckoned by the quarter (a fed land's by the year, a land under an act or the
hand by the month), each land keeping the last month it has been reckoned through so no
month is counted twice or missed when the hand lifts; a land's yearly lines are kept by the
century past a thousand years, and past a century without their trades; and ancestry fades
as the chronicle does — past the first step of aging, an event below what its age asks is
kept only as a direct cause of something kept that has not faded (its why opens one step;
beyond it the past is forgotten into the summaries).

The Earth seed tuned (M74, first pass): a land's births and deaths were reckoned for the
year ahead in the year's first month, at that month's hunger — the month just after the
year's imports and tribute land — so a land fed one month and starving eleven was
reckoned as fed, and grew to eight times what fed it (at year 3000 a land of 3.5 million
ate a ninth of its need). Each land now counts every month's shortfall and fed-squared,
and is reckoned after the months, by them: since a death's chance compounds by the sum
of the months' pressures, the months at once are the months one by one. With it the
demographic transition is the fuller one of the world we know (TRANSITION 0.6: five
children a woman fall to two as power makes a people wealthy). The calibration keeps its
bands to year 1400 (the satellite 999, the first colony 1192); the world settles near half
a billion from year 1000, its famines the droughts of lands at their limit (some thirty a
year).

The look (A1, A4 begun): the interface is navy glass framed in chrome bevels, with glossy
buttons, title bars, a chrome logotype and Verdana; the page paints the backdrop behind a
clear canvas — a starfield in space, the bright gradient sky of the era on the ground,
with haze toward the horizon — and in space the key light keeps to the viewer's upper
left. The globe is faceted (each triangle flat, coloured by the most of its three cells)
in a saturated palette under a glossy sea, with a blue glow at its rim. `tools/look.ts`
takes the look at a phone's size. Bodies (A2): an upright ape is a small figure of the era's games — a
body in its clothes, bare arms and head, legs in darker cloth — whose arms and legs
swing as it walks, and every people's legs step in turn; what they wear follows how far
their land has come (hides, undyed cloth, dyed cloth, the engines' dark coats, the modern
world's bright colours). Places (A3): trees stand about a village as its land grows them,
clear of its fields, road, pasture and water; homes have doors; walls, roofs and ground
are bright. The land from above (A4): the region is faceted like the globe, its relief
stood up (nine times), under a glossy sea; a village keeps the hour — the sun climbs from
the east and sets in the west, dawn and dusk in the era's sunset gradient, night dark and
starry. The Phase 7 gate (`npm run gate:7`) walks the journey and holds the phone's
budgets: each scale's first frame within a second on the phone floor, and the heap.

The phone's budgets (M73), measured by the gate: a first descent to a land took 230 ms
here (a second on the phone floor) and later ones 23 ms — the first was the shaders
compiling, and more, fog is a shader's define, so turning it on at the ground had every
material compiled afresh. The fog now stays on at every scale (pushed out of reach in
space); the region's and a village's shaders are drawn once, a speck before the camera,
while the world is made; a land looked at has its region readied before "Look closer";
a view just asked for is drawn before the world steps on; and the host's background work
waits while the viewer is asking. First frames now (WebKit, this machine): a land 63 ms,
a village 47, the star's worlds 37, the stars 30; the heap after three centuries seen at
every scale, 148 MB. The Phase 7 gate passes: the journey's nineteen steps, each with its
why, within the budgets; and the Phase 5 and 6 gates pass after the reckoning fix (the
3100-year save 15.5 MB, time at some 139 years a minute on the phone floor). On a phone's
screen: every window can be folded to its title bar (the fold beside the close box; it
unfolds when given something new), and the camera frames its subject below the bar that
covers the top of the screen; a star wears a corona and the orbits the HUD's cyan (one
glow module draws the globe's rim of air and the star's light).

The chronicle read through for sense (M74), every kind of event at year 1600: no claim
shows a raw ref (a test holds it); numbers carry their separators; halls "were" first
lived in; a land that breaks away "went its own way"; a friendship breaks over a thing, not
a clause (the famine term is "the hunger of X for their stores"); a star is named by its
light ("a red dwarf 2.9 light-years out"); round and long houses say so first; works halls
leave no dangling comma. And what reading found in the world itself: a land rose against
the realm it already belonged to (a rebellion now needs another realm to return to); sealed
halls on other worlds had droughts and hunted-out game (they have no weather and no wild);
and a ship between the stars ran its works on coal, then on wind and water (sealed lands
now burn no coal or oil, and have a drive of their own: electric motors on the atom's
power, when they know habitats and the atom).

More of the look: a region's woods — on each land tile, by how wooded its biome is, a
low-poly crown (pines in the north and the hills, round crowns elsewhere), thinned alike
to a cap of four thousand, sized to the tiles; the stars of the cluster glow in their own
light; on a phone the subject is framed between the bar and the sheet, and the sheet keeps
to the lower part of the screen. The globe wears clouds under the Land lens (none over what
another lens paints). A city's quarters hold what they are for: markets their stalls
under striped awnings, workshops their sheds and chimneys, the temple a stepped pile with
a gilded crown, the crowded quarters homes two storeys high; a city is seen from further
off, its haze as far. CI walks the journey (universe-journey). The economy's lens (M69): "Trade" lights each
land by the goods it moved in and out in its last year, on a log scale from a trickle to a
great market; lands without trade are greyed.

### I.8 Phase 8 milestones (planned 2026-09-27, at the user's asking)

The user, on their iPhone 15 Plus: "graphic and processing settings where the higher,
more depth version shows more animations and details and deeper procedural gen in
models, tools, chemistry, characters and buildings, neighbouring planets, and me being
able to go on the full galaxy and click and view another planet in depth, and the
creatures should mine and carry stuff and you can see it all … targeting the best for
an iPhone 15 Plus … and there's no predators and prey and everything that should be in
the default world." Phase 8's "done when": the world shows what it holds — wildlife
hunting and fleeing, herds in their pastures, people carrying what they work, miners at
their mines — at a depth each device can hold; any world of the galaxy can be visited
in depth; and none of it moves the history (detail is presentation and the microscope's
shadow only; the invariants of §2 hold, and the oracle is unmoved by any setting).

76. **Quality you choose**: a settings window (Low, Balanced, High, Ultra, and Auto, which
    starts from the device and steps up or down by the frames it holds) setting the
    drawing's budgets — pixels, shadows, clouds and glows, how many figures and animals,
    how finely bodies, homes, tools and trees are built — and the microscope's depth (how
    many families are met). The iPhone 15 Plus's default is the highest that holds sixty
    frames; the rest follows from it.
77. **Predators and prey**: the living world's hunters as a stock beside their game in
    each land (they rise with the game and fall without it, take a share of the wild and
    of the herds, and are driven out by a people who hunt them), with events and whys;
    and the wild itself seen — herds of grazers on the open land, browsers in the woods,
    great beasts, hunters stalking and running down their prey, fish in the waters, birds
    in the air — a watched shadow drawn from the land's own lineages and stocks.
78. **Work you can see**: people carry what they work — tools out, sheaves, sacks, fish,
    ore and goods back; miners at a land's mine (a headframe, a cart, a pit or a well by
    its age); carriers and pack beasts on the road; herds in their pastures; smoke from
    hearths and works.
79. **Deeper making**: bodies, homes, tools and trees built more finely as the setting
    allows — faces and hands, windows and chimneys, porches and fences by era; tools by
    what they are for and what they are made of; materials with their own sheen (the
    metals bright, the woods matte), and what each is made of told (bronze of copper and
    tin, steel of iron and carbon).
80. **The whole galaxy**: a scale beyond the cluster — the galaxy's disk, its arms and its
    bulge drawn from the galaxy's generator, the home cluster within it; any star of it
    opened (its worlds, on demand from its place) — scenery, as §M keeps it, but scenery
    that can be looked at closely.
81. **Worlds in depth**: any world — the home system's planets and moons, another star's
    worlds, another people's home — generated whole on demand from what is known of it
    (its mass, orbit, warmth, air and seas): its plates, relief, climate, waters, deep
    ages and (where its conditions allow) its life and lineages, seen as a globe with its
    lenses and pages; a gas giant's banded clouds; where another people lives, their
    presence. Pure and cached: looking at a world never makes it part of history.
82. **Phase 8 gate**: every setting holds its budgets on the phone floor; the default
    world shows predators and prey, herds, work and carrying; a world of another star is
    visited and its life examined; the oracle is the same at every setting.

76, as built: Settings (from the world's line) offers Auto, Low, Balanced, High and Ultra.
Each sets the drawing's budgets — pixel ratio, the sun's shadows over a village (and their
map), clouds and glows, figures, the region's and a village's trees, wild beasts to come,
how finely things are built — and the microscope's depth (the families met: 5, 8, 10, 14).
Auto starts a phone at High and a desktop at Ultra and steps down while the slower frames
of a window run past 22 ms (a display past sixty frames may step it up again); a machine
driving the page draws at High, fixed. The choice is kept in the browser. A review of the
session's changes found nine faults, all mended: going back from a page left the land's
inspector blank; a plague or the hand laid late in a stretch of months pressed on the
whole stretch (the month's full pressure — hunger, sickness, a star's flare — is now summed
month by month, and the hand's people die over the stretch too); the village leaked its
instance buffers on every rebuild; folded windows unfolded as the sky redrew them; the
observatory's polls held back the host's background work; a land's region was readied
before its facts; the "boxes" were four-sided cylinders turned a quarter, so everything
not square was a rhombus — boxes are boxes now, and square homes wear gable roofs; the
worker could start a second loop; and an old event kept only shallowly was not walked
again when hindsight raised it (a world saved and loaded could keep a history the running
one did not — a test holds them the same).

77, as built. *The hunters.* Hunters ranged only where they first arose (the default world
had its hunters on 24 of 650 lands with game): a hunting lineage now crosses the land joined
to its own within a wider warmth (its tolerance and 14 °C) and lives wherever game lives
there (495 of 650). Each land keeps its hunting lineage and a stock of them beside its game:
they grow toward as many as the wild keeps, a few wander in where the game is, and they
fall under a people who hunt them and guard their flocks (the guard is the hunting take and
twice the herders' share); pressed below a tithe they are driven out (`ecology.hunters-gone`)
and while they are many among the flocks they take a share of them — 8 in a hundred a year
at their full number, off the herders' meat — told once as `ecology.flocks-taken` (eased,
it may be told again). *Beasts to tame.* The default world had no beast that could be tamed
anywhere: its tame grazers had died in the ages' great deaths, so its people never kept
herds. Under the Earthlike prior, as its apes always rise, its people's own country (the
land nearest the cradle, a twentieth of the world) holds one: the herd-living grazer nearest
the cradle can be tamed, or, where none lives there, one arose there in the last age; eight
Earthlike seeds out of eight now herd within their first century (first light: 352 lands by
year 100). A herder's memory of taking up the work now leads to the taming as it came to
their land (it had led to the bare land), and a herder's why names the herding, as a
farmer's names the sowing. The oracle moved (the planet and ecology domains); calibration
is unmoved (every milestone year the same as before; the late famines of the eighth and
ninth centuries are older than this and stand as they were). *The wild seen.* A village's
plan says what lives about it — each lineage with how much of it stands, its flocks and
their herders, and whether its hunters raid them — and the microscope draws it, box-built
and as much larger than life as its people: grazers in herds and browsers at the wood's
edge between the homes and the wild's edge (brought in from 900 m to just past the fields),
great beasts in their few, the flocks in a pasture kept off the road, birds wheeling on
beating wings, fish leaping. Fifteen kinds of beast by the word each lineage is named for
(sheep, goat, ox, buffalo, horse, camel, deer, elk, tapir, tusker, woolly giant, sloth, cat,
bear, wolf), coats by its colour word (spots and stripes where it is spotted or brindled),
built more finely at each setting (muzzles, tails and horns; hooves, manes and markings;
ears). A band of hunters prowls, creeps up crouching, runs at its herd — or at the flocks,
where the land's hunters raid them — and rests; the herd lifts its heads, bunches, flees in
a cloud of dust and drifts back to its grazing. It all moves by the screen's clock, a pure
function of the plan and the moment, so it looks the same at any speed and never touches
what happens; a tap on a beast tells its lineage, what it is doing and its why, and the
land's page names its hunters, how few they are and what they take. Each lineage is three
instanced batches whatever its number; every setting holds sixty frames in a village with
the CPU slowed four times (30, 91, 150 and 208 animals from Low to Ultra).

78, as built. Each leg of a person's day carries what the leg is for: a farmer walks out
with a tool, works with it in hand and walks back with it — or with a sheaf when the fields
are reaped; a herder's staff; a forager's basket, or, by the water, a rod out and the catch
back; a trader's pack on the road, a sack from the market; a child sent to the well, a
bucket; and in a land that digs, half its crafters walk to the mine with picks and back
with ore. Each thing is a box or two in its own material (a batch each: wood, the tool's
head, straw, cloth, wicker, the catch, the ore, leather, water), and a tool's head is of
what the land works — stone, then bronze, iron, steel. The land's works stand on the open
ground furthest from its fields, road and pasture (a city's road runs through it both
ways; a test caught the mine on it): a pit with its windlass where it smelts copper, a coal
pit, a shaft under an iron headframe with its engine house, chimney and a cart running the
track to the spoil heap once it has engines, a stepped quarry where it builds in stone, an
oil derrick, a factory with its sawtooth roofs and chimneys by the road. The road carries
the land's traffic at its own pace — porters, pack beasts with their panniers where the
flocks are of horses, oxen, buffalo, camels or tuskers, carts with their drivers in the
engines' age, lorries in the modern world — and a tap on a beast at work says so. Hearths
smoke, more at the hours they cook (translucent puffs from the watched homes first, as many
as the setting draws), and works' chimneys smoke black always. All of it is presentation:
the routine and the traffic are pure functions of the plan and the clock, and the works are
where the land's own market says it digs, drills and makes. The phone budgets, measured
again: a village's first frame had come to take 845 ms in WebKit (3.4 s on the phone floor)
— three shaders compiled on it, since M76 turned the sun's shadows on over villages and the
start-up warming never drew with those shadows. The warming now draws its specks once with
the sun casting shadows exactly as over a village (and the smoke's clear boxes among them),
so no shader is made on entering one: 79 ms, and the Phase 7 gate passes again (heap 167 MB).

79, as built. The upright figure is built more finely at each setting: hands at the arms'
ends and shoes at the legs' (Balanced), swinging with them about the same shoulder and hip;
hair and eyes (High), each person's own hair kept by who they are and grey late in their
people's span; a belt (Ultra). (Other peoples keep their own shapes.) Homes gain windows
either side of the door and on the side walls and a chimney once there is a hearth to draw
(Balanced), a porch over the door on two posts (High), a fence about a watched home's yard
(Ultra); the windows' glass glows with lamplight from dusk to dawn (its glow never quite
out, so the one shader warmed at the start serves all day), and hearth smoke rises from the
chimney tops. What a person carries is told in the inspector with what it is made of — a
stone tool knapped from flint, a bronze one of copper and tin, iron smelted with coke,
steel of iron and a little carbon; a load of coal, the buried forests of the deep ages —
and each material keeps its own sheen (metal heads bright, the catch wet, cloth matte).
The species pages (after M77) say each lineage's place among the living: what a hunter
hunts and in how many lands they meet, what hunts a grazer, and where a hunter takes from
the people's flocks.

80, as built. Out from the stars around, "The galaxy ›": the galaxy drawn from its own
numbers — a bulge of old yellow stars, a thin disk thinning outward by its scale length,
young blue stars crowding its spiral arms — as one mesh of glowing specks (6,000 at Low to
50,000 at Ultra, one draw call, its shader warmed at the start), home ringed. A tap anywhere
finds the real stars there, drawn from the galaxy's own sectors as the cluster's are (the
brightest dozen, named in plain words: a red dwarf, a yellow star, a white dwarf); each
star's page lists its worlds, and any of them can be gone to (81). A sector's id reads back
only within some five thousand light-years of home (its coding runs out), so a star found
farther out carries its sector's cube in its name. Scenery that can be looked at closely:
nothing here enters history (a test holds every domain unchanged).

81, as built. Any world — the home star's other planets and moons ("Go to" on a world's
page in the sky), or any world of any star — is made whole on demand from what is known of
it: plates and relief from its mass, a climate from its warmth, tilt and day, craters where
no thick air wore them away (sixty on the airless, twenty under a thin air), seas where its
water lies liquid, ice in its lowlands and about its poles (the caps wider the colder it
is), a giant's banded clouds (warm creams and browns, cold blues) and its storm; bare
ground coloured by its warmth and air — scorched grey-brown rock, baked yellow under a
crushing air, rust and ochre, a moon's greys — lighter on the heights and darker in its
craters' floors; a glow about the rim only where there is air enough to glow, clouds only
where the air carries them. A world with seas about a star old enough is alive, its lands
green by warmth and rain (forest, grass, desert, taiga, tundra); where one of the cluster's
other peoples arose, its page says who they are, when they come (or came) to electronics,
to orbit and to the stars, and whether home has heard them, and once they have electronics
their cities' lights show along their coasts. Tap the ground: its cover, warmth and height
there. Keyed on the home world's digest and the body, so the same body is always the same
world; made in 35–85 ms on a coarser grid (10,242 cells), a few kept at once; looking never
touches history.

82, as built: `npm run gate:8` (tools/phase8-gate.ts), at an iPhone 15 Plus's size. Every
setting holds the phone floor: entering a village makes no frame longer than 244 ms on the
floor (WebKit; Low 244, Balanced 164, High 228, Ultra 240), and watching one with the CPU
slowed four times its slower frames (p90) stay at 19–20 ms at Low, Balanced and High and
29 ms at Ultra (32, 93, 153 and 211 animals) — measured on this machine's own integrated GPU (Chromium over ANGLE and
Direct3D 11, weaker than the phone's), since headless Chromium otherwise draws in software
and a slowed CPU then slows its "GPU" too (171 ms at High, which says nothing of a phone).
The default world shows what it holds: hunters on all 415 of its peopled lands with game at
year 300, a village's flock in its pasture with hunters about, a land digging ore, a hunt run
within two minutes of watching, 23 people carrying at a morning hour. Another people's world
is visited, alive and its people told. And the history is the same at every setting: 121
checkpoints of a world run in the page at Low and at Ultra match. Mended on the way: the
start-up warming drew only with the village's shadows, so every shadowless scale compiled its
shaders on first entry — a land's first frame 155–250 ms, the sky's up to 449 ms; it now
draws both ways (a land 94 ms, the sky 63 ms in WebKit), and the sky's self-lit shaders
(lines and spheres) are warmed too. CI runs the gate's world checks (`--no-budgets`) beside
the journey; its budgets need a GPU and run locally. **Phase 8 closes.**

### I.9 Phase 9 milestones (planned 2026-09-27, at the user's asking)

The user: "animated and visualized battles, marching armies or fleets on land and in star
wars, farming, fighting, building — everything they do should be able to be seen … I even
wanna see them socialize with emojis. Also basic physics: they shouldn't be phasing through
walls … make everything seamless from zoom in to all the way out, from person to galaxy
(a loading screen only when a device needs it) … a mode where the game starts with the
emergence of the galaxy, then you choose your planet and see it evolve, primitive then
conscious life, and choose where to start … a microscopic view of the cells and
many-celled life, creatures emerging from it like Spore … a creature system like the
people's: each animal line a body plan (limbs, symmetry, skin, size, how it moves, what it
eats), evolved from its world's gravity, medium and climate; a real food web with several
levels; 3D models built from those parameters instead of 15 fixed shapes; names that come
from the body." Phase 9's "done when": every lineage of every world is a body of its own,
eaten and eating in a web of several levels, drawn from its plan and named for it; what the
people do — build, farm, fight, gather, talk — and their wars, marching and sailing, on
land, at sea and between the stars, is seen; a viewer can go from one person to the whole
galaxy and back without a seam where the device allows; and a world can be watched from
its galaxy's first light to its first people.

83. **Creature body plans**: each lineage a body — symmetry, segments, legs, fins, wings,
    skin, size, how it moves, what it eats — drawn in its age from its niche and its world's
    pull, seas, air and climate (heavier worlds squatter and many-legged, thin-aired worlds
    few fliers, cold worlds furred); names from the body; the Earthlike prior's lineages
    Earth's own (fur and hooves, feathers, scales, fins).
84. **The food web**: producers, grazers and browsers, seed-eaters, small hunters, apex
    hunters, scavengers and swimmers, each land's stocks tied level to level (each level's
    stock set by the one it eats, pressed by the one that eats it), the people's hunting,
    herding, farming and clearing pressing on it, with events and whys when a level fails.
85. **Creatures drawn from their plans**: the fixed shapes replaced by bodies built from the
    plan — segments, leg pairs, fins, wings, necks, tails, skins — each moving as it moves
    (walking, hopping, crawling, slithering, swimming, flying), finer by the setting.
86. **Everything they do**: building (sites, scaffolds, walls rising, builders), farming
    (hoeing, sowing, reaping), fighting (drills, brawls), gathering and talking with emoji
    moods from the world's own state, and bodies that go round walls and one another.
87. **Wars seen**: hosts marching between lands, battles joined where history fought them,
    fleets at sea, and fleets between the stars — all from the wars history records.
88. **One zoom**: person to galaxy and back as one continuous zoom — each scale fetched and
    readied ahead of the camera, a loading screen only where the device or the data would
    stutter.
89. **Genesis**: a way to begin — the galaxy's emergence, a star and a world chosen, the world
    forming, its deep ages, the microscopic dawn of life (cells, then cells together, then
    bodies), lineages arising age by age, the first people, and where to begin chosen.
90. **Phase 9 gate**.

83, as built. Every beast lineage has a body (rules/creatures.ts): symmetry, one to three
segments, 0–8 legs, fins, wings, covering (fur, wool, feathers, scales, shell, plates, slick),
weight, how it moves (walk, run, hop, crawl, slither, swim, fly), what it eats and its level
in the web of eating, neck, tail and what it grows (horns, antlers, tusks, a trunk, a hump, a
mane, a crest, spines, claws, a beak). A heavier pull shrinks bodies (weight by g^-0.75) and
spreads them over more legs; a thicker air bears more fliers; the cold furs them and the dry
heat plates and scales them. Under the Earthlike prior they are Earth's own — four legs, or
wings and two, or fins — and keep Earth's names, with bodies to match them (an ox its horns,
a horse its mane, a tusker its tusks and trunk); elsewhere each is named for its body (a
"red spined eight-strider", a "dun plumed four-wing", a "grey crested leaf-reacher"). Four
niches join the web — seed-eaters, swimmers (only by a river, a lake or a coast), small
hunters and scavengers — drawn age by age on streams of their own after the people, so every
lineage, the cradle and the people drawn before them are as they were (the oracle moved in
the planet domain alone; history is bit-identical); a small hunter or scavenger lives only
where its food lives, and one with nothing to eat anywhere died out. The species mask grew to
96 lineages (three words a cell). A lineage's why and page say its body and its place in the
web.

84, as built. Each peopled land's living world holds the web's levels beside its game,
forest, soil and hunters (sim/ecology): its small game, of the wild ground and — more
thickly — of the fields' grain; its small hunters, which follow the small game and give way
to the farmers and herders who guard their grain and young stock; its scavengers, which live
on the hunters' kills and the herds' own dead; the life of its waters, where it has a river,
a lake or a coast. Each level is set by what it eats and pressed by what eats it, and grows
past what it was where what eats it is thinned or gone: a land whose hunters were driven off
keeps more game (to a fifth more), and that game browses the woods' saplings, so the forest
comes back slower; a land whose small hunters were driven off breeds small game past what
its fields keep, and the small game eats the grain (up to six in a hundred of it); waters
fished hard give less of the wild's food until they are let be. Each turn is history with
its why — the game multiplying, the grain eaten, the fish grown few, a small hunter driven
out, the scavengers leaving with the kills — and the land's page tells it; a village's
beasts are as many as their level stands. Measured on the Earth seed: the web barely moves
while people are few; by year 700, 362 lands have driven out their hunters, 300 have fished
their waters down and 69 lose grain to the small game; the calibration's every band holds
(135M people at year 600 against 134M before). A city test that weighed paved against
unpaved towns on different headings was replaced by each paved town weighed against itself.

85, as built. The fifteen fixed beast shapes are gone: every creature is built of boxes from
its lineage's body (view/creature.ts) — a chest and a haunch (a row of segments for a
many-legged body; a slitherer's segments narrowing to the tail and waving as it goes; a
fish's body tapering to a sweeping tail fin, with a dorsal fin), legs in pairs jointed at the
knee with the foot tucked back as it swings (a crawler's up from its side to the knee and
down to the ground, spider-wise, swept fore and aft in a wave), wings of two parts each that
beat (the outer bending further) or are held out to glide, fins, a tail hanging, fanned or
held out to balance, a neck and head bowed to its food, and what it grows (horns, antlers,
tusks, a trunk, a hump, a mane, a crest, spines, a beak), with hooves, ears, eyes, a tail's
tuft and its coat's marks at the finer settings (at most 48 parts, and a known most of each
tone, so batches are sized). A walking hunter is built stocky (a bear walks); Earth's
lineages take the shapes their names say (a tapir's short neck, a cat's long tail). Every
level of the web is seen about a village: herds on the open ground and at the wood's edge,
small game at the fields' edges, the hunters' round (prowl, stalk, run, rest), the small
hunters after the small game, the scavengers watching the hunt from off its side and coming
in to feed where the hunters killed once they have gone, the land's fliers wheeling low over
the fields and its scavenging fliers high over the hunts, its swimmers leaping in its water —
each lineage the land's own, none an ornament (a land with no fliers has no birds). The
ground is solid (view/ground.ts): the water and the homes are circles a walker is kept out
of, to the nearest edge (a smooth step round, never a jump), a herd is laid out a body and a
half apart and pushed apart where two would stand in one another, herds are placed clear of
the water, and the host turns a village's pasture from the lake it would lie in. Found and
mended on the way: a shared mesh destroyed with the last batch of a layer that rebuilds
(the year turning, a setting changed) crashed the frame in its shadow pass — shared meshes
are now held (render/batch.ts keptMesh). The oracle moved in the planet domain alone.

86, as built. What a village's people do is seen, and comes from the world's own state.
The host gives each village's plan how it lives now (host/village.ts lifeNow): how well its
land was fed and whether it grows, its realm at war, its grievance against its rulers (held
at one near revolt), its faith, what it talks of — the pressing first (hunger, war,
grievance, a death, the hunters at the flocks, the grain eaten, the fish few, drought, a
newborn, what was learned, the building, the faith, the market) and small talk last — the
next home rising where the next would stand, as far built as the families it will house have
come, and the watched households mourning or with a newborn. Each person is at something
(view/village.ts tasks): the fields sown in spring, hoed through the summer and reaped at
harvest; crafters (and a farmer or two) out with beams to the rising walls; the pick at the
mine, the hammer at the workshop, the rod by the water, the basket in the wild, the herd, the
market's haggling; the evening in rings of talk about the square, each facing its ring's
middle — where grievance runs high, two of the first ring come to blows — and, while the realm
is at war, the young drilling in ranks with spears on open ground past the homes. Each task
moves the limbs its own way (view/motion.ts: the hoe raised in both hands and brought down,
the sickle swept low, seed cast by one hand, the hammer's blows, the spear thrust with a step,
fists and a shuffle, hands in talk). What each says is shown in a sign over their head (a
second label layer): the rings turn over the village's own topics, the most pressing most
often, a mourning family's grief and a newborn's household among them; at work, now and then,
what they are at; the hungry and the worn out say so. The site is drawn: its footing, its
walls rising, the scaffold and planks about them, the timber waiting, its roof going on at
the last. Bodies keep to the ground: every walk goes round the homes, the water and the rising
walls, turning beside each (view/ground.ts route), every place a person stands still is
clear of every wall, doorsteps turn to a clear side, and the push out of a wall is repeated
where homes stand so close that out of one is into the next. Found and mended: a person's
days were kept by names a re-read plan shares, so a plan re-read with a new site or a war kept
the old days; they are kept by the plan now. The signs' colour font is readied at the start,
so its first drawing does not stall a frame on entering a village. The Phase 4 gate's named
sea people (alien 65) comes to power on current mills in year 954 since the web of eating
changed its history; its CI run goes to 1200 years (it stops at power).

87, as built. The wars history records are seen at every scale. On the globe (host "wars.map",
view/war.ts, render/wars.ts): each war still fought sends its host from the attacker's land
nearest what it wants toward it — a banner-bearer and three behind, little soldiers with
heads under their realm's flag, taking ship (a hull and a sail) wherever the way crosses sea,
the way sampled once a year over the fine grid (walked neighbour to neighbour) at the
ground's height — the defenders' standards stand at what they hold, and where a battle was
fought this year or the last two, crossed blades over a flare that pulses, the larger the
more fell, dimmer as the years pass; tokens stand upright on the globe (InstancedBatch
setBasis: up and ahead per instance). In a village whose land history fought over this year
or last (the plan's life.battle, from the war's own battle record), the two hosts come on in
their realms' colours — the attackers by the road, the defenders out past the homes — close,
fight at the line with spear and fist, fall (as large a share as fell, the beaten two in
three of them, lying on their backs with their spears dropped), and the beaten fall back; the
round plays over by the screen's clock, never among the homes, and the villagers talk of
war. Between the stars: each fleet of war crosses the chart from home toward its enemy's star
(another people's, or a colony broken away) as a red wedge of three, and the star its battle
was fought at is ringed in fire for thirty years. The globe turns to any spot for the look
tools (faceSpot).

88, as built. One zoom from a person to the galaxy and back. A zoom pushed on past a scale's
nearest or farthest view gathers, and once it has gone a third again past the edge it goes
through (view/zoom.ts zoomStep, in the orbit rig): out from a village to its land (low over
the village), the world (turned to that land), its sky (close on the home world, the view
following it round its orbit while near and easing onto the star as it draws back), the
stars about it (among the nearest) and the galaxy (home ringed in its arm); in again from
the galaxy to the stars, the sky, the world, the land under the middle of the screen and the
village nearest it. At a scale's edge a hint says where the zoom goes on to. The next scale
out is readied ahead as the view nears the far edge of the world, its sky or the stars
(fetched and built, one scale only, never nearer in where the land and the village are
drawn); a quick fade covers each swap, and a word ("Readying the sky…") shows only while a
scale is still being readied — at once, on a phone, for the heavy ones. Found on the way: a
readying that built the sky and the stars from the land's view (whose everyday distance is
near its far edge) stalled the frame on entering a village; it readies only the next scale
out now, from the world outward. And WebKit here stalls about one village entry in eight for half a
second, at any setting and on builds from before Phase 9 as well (Chromium never does): the
Phase 8 gate's entry budget is judged by the middle of three entries now, the worst told.

### J. Allocation of ~100k lines

| Module | Lines | Notes |
|---|---:|---|
| kernel (refs, rng, dmath, time, scheduler, stores, hashing, serialization) | 6,000 | must be right first |
| rules (data tables, schemas, priors, text templates) | 4,000 | data counts |
| gen: galaxy, star, planet, geology, climate, hydrology, region refinement | 8,000 | |
| life: biology grammar, deep-time evolution, species, ecology | 7,000 | |
| population, households, ledgers | 7,000 | includes observer ledger and resolvers |
| culture, belief, language, naming | 3,500 | port 48/50/71 ideas |
| economy, logistics, cities/districts | 7,000 | |
| polity, government, diplomacy, rebellion | 4,500 | |
| technology, knowledge, design grammar | 6,000 | one grammar for everything built |
| conflict (one kernel, three graphs) | 4,500 | |
| space and interstellar (sublight) | 4,000 | no jump network; physics does the work |
| microscope (one engine, watch and hand modes) | 8,000 | shallower than Classic at first |
| divine acts and observer tools | 1,500 | acts work through owners' inputs, so they stay small |
| causality: provenance, explainer, narrative text | 5,000 | |
| history retention and summaries | 2,000 | |
| save, replay, migrations | 2,000 | |
| worker host and bridge | 2,000 | |
| view-spec builders (procedural visuals) | 4,000 | |
| PlayCanvas renderer, cameras, LOD, shaders | 6,500 | |
| observatory UI (no civilization-management screens) | 6,500 | |
| app shell | 1,000 | |
| **Total** | **100,000** | tests and tools extra (expect 30–40k) |

For comparison: Classic spends ~71k lines on the simulation of one map. The
Universe allocates 8k to the microscope and ~60k to everything above it.
That ratio is the architectural point.

### K. The five highest-risk technical problems

1. **Collapse with conservation and provenance** (§10, §14): backward
   sampling over ledgers, claims, sibling reuse, later-life updates. Novel,
   subtle, and the heart of the product. Phase 1 exists to de-risk it.
2. **The seam between the microscope and the aggregate** (§9): a watched
   shadow that re-syncs to history without visible jumps and never shows an
   irreversible outcome history lacks; a hand that lays and lifts without
   discontinuity (people, stocks, buildings, terrain) or drift over repeated
   visits. The shadow is only convincing if the microscope and the aggregate
   are calibrated to agree.
3. **Explanations that are true and readable** across domains without
   storing everything: decision records thin enough to afford, rich enough
   to explain; reconstruction honest about being reconstruction.
4. **Cross-engine determinism for years of development**: `dmath` accuracy
   and speed, lint coverage, and the discipline of running three engines in
   CI before anything is trusted.
5. **Phone memory and bandwidth**: PlayCanvas + worker snapshots + paged
   history + planet textures inside ~300 MB on the phone floor.

### L. The five mistakes most likely to kill the project

1. **Depth before breadth.** Deepening the village for another year before
   the planet, the state and the ship exist. Classic already did this once.
2. **Letting the camera, the speed or the device touch the authoritative
   state.** One "just skip the followed entity" (as `20:256` does today)
   and determinism, saves and replay are all compromised.
3. **Unstructured causality.** Prose evidence and "latest event of this type"
   citations make the observatory a confident liar, which is worse than no
   observatory.
4. **Shared mutable state with implied order** — a new global `W`, function
   overrides, systems reaching into each other — amplified by AI-generated
   code that extends by layering corrections.
5. **Catalogs disguised as grammars, or grammars without calibration.**
   Either 100 government subclasses behind a "composition" facade, or an open
   grammar that produces meaningless noise because nothing measures whether
   different seeds are *mechanically* different.

### M. What should intentionally stay simplified in the 100k version

- Traffic: flows on graphs and district accessibility, no vehicles routed
  outside the microscope.
- Biology: body-plan grammar and affordances; no biochemistry beyond the
  planet's solvent/energy basis; individual genomes only in the microscope.
- Psychology outside the microscope: trait vectors and life events.
- Combat: Lanchester-style engagements; no individual soldiers outside the
  microscope.
- Orbits: Kepler + Hohmann estimates; no n-body.
- Climate: energy balance + circulation cells + anomalies; no fluid dynamics.
- Tectonics: generated once with event-driven activity; no continuous drift.
- Language: phonology and naming; no grammar or translation.
- Economics: partial-equilibrium markets and a treasury/loan system; no
  financial markets.
- AI: utility-based decisions; no planning search.
- Ship and weapon design: component grammar and scaling laws; no physics
  simulation of designs.
- The galaxy: one playable cluster; everything else is scenery.

### N. Abstractions that must be right from the beginning

1. The **ref** scheme and the structural-vs-minted rule.
2. The **keyed draw**, stream registry and `dmath`.
3. **Time** representation, the scheduler's ordering semantics and
   compute-then-commit.
4. The **authority/detail split** and the purity of observation.
5. **Command** format and stamping (everything is a command).
6. **Cause references and decision records** (format, budget, hashing).
7. **Integer conservation, the budget ledger and claims.**
8. The **worker protocol** and snapshot contract.
9. The **save container** (chunks, versions, ruleset id, lineage).
10. The **module dependency direction** and ownership registry.

Everything else — every domain model, every grammar, the renderer's look —
can be rewritten later if these hold.

### O. Open questions that need your decision

**Decided 2026-09-25**

1. **Classic's future** — frozen; Universe is built beside it.
2. **Faster-than-light travel** — no; sublight with light-speed
   communication (§26), chosen because lag-driven divergence suits a god and
   observer and keeps the late game on the same physics as the launch.
3. **What is the player** — a god and an observer; no player civilization
   (§3.1).
4. **Is observation an act** — no, never. The microscope watches a shadow of
   history; the god's hand is the act (§9). This also settles question 10:
   watching never slows fast-forward.

**Decided 2026-09-26**

11. **Art direction** — stylized low-poly, procedural, in the look of an
    early-2000s (Y2K) computer game: flat and vertex-coloured shading under a hard
    key light, chunky silhouettes, saturated palettes, gradient skies, and bevelled,
    glossy panels for the interface. Done as an art track beside Phase 7's UI and
    UX milestones, before the Phase 7 gate's final pass (§I.7).

**Still open**

5. **How big is the playable galaxy?** The plan assumes a cluster of
   500–5,000 systems (about 40–65 light-years) with ≤ 20 simulated
   civilizations.
6. **Where does play begin?** At planet formation (prehistory watched in
   fast time), at the first people (prehistory generated), or selectable?
7. **How alien by default?** Should random seeds lean toward relatable
   (bilateral, land-dwelling) intelligent species, or be fully open?
8. **Old saves under new rules.** Is "continue under the new rules, history
   protected, future diverges" acceptable, or must a save always run under the
   ruleset that created it (which means keeping old builds deployed)?
9. **Is there an ending or a goal?** Classic's arc ended at the ship. For a
   god and observer an open-ended universe with optional "chapters" (first
   city, first flight, first contact) is the natural default.
10. *(Settled by 4.)*
11. *(Decided 2026-09-26: see above.)*
12. **Multiplayer, ever?** The plan does not assume it; lockstep multiplayer
    would add constraints on command timing. Sharing seeds and pure runs
    works without it.
13. **Does the god have limits?** Unlimited acts; a power budget that
    refills with time; or power drawn from the belief of the peoples who
    worship you (which ties the god to §19 and makes omens matter). The
    command format supports all three.

---

## Appendix — What Classic contributes, section by section

| Classic | Becomes | How |
|---|---|---|
| 04 `counterRand`, `hashParts`, `worldHash` | kernel/rng, hashing | design kept, widened to 64-bit, stream registry |
| 16 tick registry, sliced tick | kernel/scheduler, host pacing | order keys made literal; slices kept |
| 15 `eventText`, 129 plain words, 47 legends, `pageBlock` | causal/narrative, ui/observatory | registries and text ported; causes not ported |
| 12 cohorts, 150 townsfolk ledger, 127 many hands | sim/population (A1) | replaced by cells + ledgers; the ledger idea survives |
| 30a–30f society, 25 construction, 86/116/118 farming | sim/active + sim/economy rules | rules and tuning ported to the microscope and to recipes |
| 42a–42e conflict, 143 war strategy | sim/conflict + active combat | capability ideas and ladder ported; anatomy only in the microscope |
| 06 world generation, 17 substrate | gen/region refinement, active terrain | parent-constrained; whole-map normalizations removed |
| 10 genome, 32c creature plans | gen/life, view specs | body plans move from the renderer into biology |
| 02/30a/87/106 ~104 crafts | rules/principles | mapped to principles and realizations as Earth calibration |
| 48 languages, 50 belief, 71 faith, 26 culture | sim/culture | vectors and composition, sources ported |
| 56 diplomacy, 90 statecraft, 64 politics, 100 blocs | sim/polity | opinion made typed and sourced |
| 85 orbit, 107 galaxy, 114 modern, 110 skystars | sim/space | colony model seeds; galaxy replaced |
| 31 god tools, 54 divine acts | sim/acts | each tool becomes a (scale × domain × magnitude) act that works through an owner's inputs |
| 79 causal push, 159–160 skip digest and next goal | ui advisor + sim/acts | the advisor ported; the unlogged push becomes explicit, logged acts |
| 139 follow, 49 observatory alerts | ui observer tools | follow, watches and alerts — pure |
| 32b–32i, 92, 96, 103, 123 drawing | view specs (logic) / render (new) | form rules ported; Canvas code not |
| 34, 44, 49, 139, 140, 142, 144, 156–165 UI | ui/observatory | UX lessons and layouts ported |
| scripts/refactor-oracle, probes, test runner | universe/tools, tests | method kept |
| Measured behaviour (famine cycles, launch roads, food levers) | calibration targets | recorded in memory and HANDOFF |

---

### Note on the PlayCanvas MCP

The PlayCanvas **Editor** MCP server (`@playcanvas/editor-mcp-server`) drives
a project open in PlayCanvas's cloud Editor through its built-in MCP
connection; it cannot see an engine-only npm project. Causalis has no
PlayCanvas project today, and this plan recommends engine-only integration,
so the MCP has nothing to inspect yet. If you later want the Editor for
authored pieces (shader tests, UI mock scenes), it installs with
`claude mcp add playcanvas -- npx -y @playcanvas/editor-mcp-server`, then open
the project in the Editor, press its MCP button and **Connect** (Node 22.18+,
default port 52000), and restart Claude Code so the tools load.
