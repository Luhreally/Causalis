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
11. **Art direction.** Stylized low-poly (recommended for procedural and
    phone budgets) or something heavier?
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
