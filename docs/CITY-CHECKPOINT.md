# City and continuing-world checkpoint — September 9, 2026

This is an unfinished development checkpoint for another agent, requested by
the user. Do not read passing smoke tests as proof that the balance is fixed.
Nothing from this checkpoint has been pushed or deployed.

## Start here

Work in `C:/Users/danie/Causalis-work/repo`, branch `visuals`. The OneDrive
`Causal sim` directory is the deployment mirror, not the working directory.
Read root `HANDOFF.md` for invariants, tools, and expensive past mistakes.
The baseline before this work is commit `1d79a93`; a detached baseline worktree
exists at `C:/Users/danie/Causalis-work/baseline`. Preserve unrelated changes.

The user's requested direction is an automatic, observable city simulation:
population that does not overshoot and die, effective causal skip, technology
after Starflight, varied cars and creatures, realistic streets and transit,
households, ownership and rent, decorated interiors, and convincing skylines.
Worlds should differ substantially by seed; `causal-origin` stays Earth-like.
This checkpoint adds foundations for those requests, not a completed Cities:
Skylines-scale simulation. The immediate request was to save and hand off work.

## What the code now contains

- `120-continuing-world.js`: preserves early accelerated births, then limits
  their haste in mature cities when stores cannot support it. Famine relief
  for cities tops up organic stock to seed reserve plus twelve packets per
  person, books the input, and suppresses accelerated births for 256 ticks.
  Skip milestones continue into existing refrigeration, hydroponics,
  antibiotics, networks, materials, genetics, AI and frontier technologies.
  Research uses actual prerequisites and facilities, including relief during
  inquiry pushes. Debug counters prove whether pacing and research fire.
- `121-lived-in-city.js`: persistent resident addresses and household IDs,
  housing capacity, ownership, inheritance, rents, and municipal apartments.
  Later households separate adults from dependent children. Residents spend
  actual fiber and pigment on persistent decor held in building composition.
  Towers and tenements now support interiors, with a floor selector, actual
  residents, beds and decor. Building and person inspectors expose tenure.
  **Latest revision:** wages distribute the existing public-works hiring
  expenditure to adult workers, rather than debiting blanket annual wages.
- `122-public-streets.js`: funded bus/tram routes over actual completed links,
  waiting, boarding, passenger movement and alighting. Vehicle metal is held
  in the audited roads ledger. War or broken infrastructure suspends service.
  Paved streets show curbs, crossings and verges. These are not yet a separate
  sidewalk path graph, a traffic simulation, or privately owned cars.
- `123-world-signatures.js`: deterministic car silhouettes, cabins and wheels;
  seeded skyline setbacks, crowns and facades; houses; creature proportions
  and patterns; non-Earth tree and mountain forms. Earth retains its natural
  tree/mountain grammar. Latest Earth building palette uses natural tones.
  Residential floor counts follow capacity rather than current population.
- `41-implicit-society.js`: six causal intervention sites now deposit tile
  matter synchronously and book only the accepted amount. Previously they
  queued deposits but booked input immediately, so a stopped skip could have
  a negative audit delta. This was reproduced on unchanged baseline (-190).
  This changes simulation timing and therefore trajectories; do not treat it
  as an observationally neutral accounting-only patch.
- `32d-spatial-rendering.js`: cutaway labels obey the labels toggle and need
  greater zoom, reducing the clutter seen in the browser check.

New sections are in the manifest. README describes them. New tests and the
VM measurement harness are in the repository rather than only temp files.

## Evidence and what it does NOT establish

Raw logs are committed under `docs/measurements/city-checkpoint/`. They belong
to intermediate variants, **not the final combined checkpoint source**.
The relief experiment files retain local-path runner details for provenance;
use the repository probe for new runs, not those old machine-specific runners.

| Variant/log prefix | Observation |
| --- | --- |
| `control40-*` | Baseline: battery origin launches at 117; b and c fail. |
| `balanced-*` | First full city build with synchronous deposits, before relief and corrected payroll: battery b launches and learns refrigeration/hydroponics; origin and c collapse. Audits remain zero in these runs. |
| `relief-*` | Runtime-injected relief and temporary birth brake, retaining the earlier blanket payroll: b launches, reaches a colony and refrigeration/hydroponics; c launches by 97 and reaches antibiotics, but halves to 21 people by year 131; origin still loses all towns. All recorded audits zero. |
| `small-ship-b` | Earlier full build, before relief/payroll corrections: audit **-1047** at press 15, year 128. Probe deliberately aborts. Cause is unresolved. |
| `small-ship-c` | Same earlier build: no launch by press 32/year 431, only 14 people. Regression against old handoff baseline. |
| `small-causal-origin` | Same earlier build: manually stopped at press 17/year 111; no ship yet. |
| `phone-origin` | Same earlier build: manually stopped after press 29/year 351; towns gone, no ship. Regression against baseline. |

The final combined source additionally integrates relief into inquiry and
corrects the payroll drain. **It has not had a fresh three-seed long-run
battery/phone/small comparison.** Do that before balance claims or deployment.
Earlier birth-only pacing did not fire on battery b at all; its identical
rows were not positive evidence. Counters distinguish no-ops from changes.

Generated-world evidence confirmed one origin route with twelve completed
journeys and a phone route with one. Many seeds had no routes; do not claim
universal service. Synthetic tests separately exercise boarding and alighting.

Browser checks rendered native vehicle/skyline/tree atlases for origin and b
and an actual oblique tower cutaway. Render-only world hashes matched with
no changed components. PNGs are at
`C:/Users/danie/Causalis-work/measurements/{design-origin,design-ship-b,interior-city}.png`.
The latest palette, label threshold and floor-button interaction still need
a fresh visual pass; the previous screenshot had cluttered labels.

## Verification and next work

`npm run test:continuing-city` checks housing capacity/unique and stable
addresses, material and coin conservation in accounts, decor, interior
assignment, read-only rendering, snapshot round-trip, genuine research,
immediate causal input accounting, ruined-home release, actual transit, and
seed reproducibility/variation. It passed after the latest edits. It does
**not yet directly exercise the revised public-works wage distribution**.

The full fast suite had passed all 94 success reports on the earlier build.
The final suite and build also passed on this checkpoint; see the validation
record below. Smoke fixtures do not supersede the long-run failures.

1. Diagnose the -1047 small b matter loss with per-tick audits/checkpoints.
   A possible lead, not a diagnosis: ruin/teardown paths in `105-ruins.js` and
   `30a-*` remove composition then deposit it without necessarily preserving
   unaccepted overflow. Decoration now exercises that ledger. Do not paper
   over audit drift by changing the baseline or input counters.
2. Add a targeted real-hiring payroll conservation test. The original blanket
   annual payroll could drain the treasury used by grain/public works. Its
   replacement is unmeasured at world scale.
3. Run the exact committed source across origin, b and c on battery, then
   phone and small, against the baseline. Retain failures and counters.
4. Diagnose food access rather than only raising stocks: `settlementFood`
   counts completed farms as food, even when nobody harvests. Logs show high
   food scores with hungry share 1. Rations are proximity-limited. The old
   `settlementPopulation` is also proximity-based; the new housing census
   uses registered residents, so the two can differ. Do not silently replace
   one with the other without measurement.
5. Recheck floor navigation and latest visuals in the browser. Then refine
   city realism and seed variation with evidence, without claiming a complete
   traffic/property/family simulation already exists.

Reproduce a generated-world run from the working repository:

```powershell
node scripts/continuing-city-probe.cjs causal-origin battery lean 40
node scripts/continuing-city-probe.cjs ship-b battery lean 40
node scripts/continuing-city-probe.cjs ship-c battery lean 40
npm run test:continuing-city
npm run test:fast
npm run build
```

The probe starts with thirty plain years, then presses skip; it throws on
nonzero matter and stops after six rows containing a launched ship. It has
no persistent checkpoints yet. Add those if needed to locate a late failure.
`scripts/runtime-probe.cjs` supports `CAUSALIS_ROOT` for a baseline checkout.
Do not run many expensive probes together unnecessarily. Superseded small
origin and phone probes were stopped during handoff; dev Vite may remain on
localhost:5173. There are no delegated agents or pending external actions.

## Final checkpoint validation

- Final source: npm run test:fast exited 0, with exactly 94 success reports.
- npm run build exited 0. Vite warned about the large bundle (1.56 MB JS).
- git diff --cached --check passed.
- No simulation source changed during or after that final suite.
- These passes do not resolve the long-run failures above.
- The full final suite output is saved alongside the measurement logs as suite-handoff.log.
