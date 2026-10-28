# Interrupted universe work completed, 2026-10-27

This continues the Safari/save stability work in `d3403b4`, using the preserved
Claude Phase 58 and Phase 61 scratch trees. Their original staging directories
were not edited. Phase 59 (invented elements) remains a later, optional feature;
it was a plan rather than unfinished implementation.

## Player changes

- Materials have names in each culture's language, with inherited roots and
  loanwords tied to surviving trade/teaching records. The inspector can switch
  between those names and real material names, and remembers the choice. The
  chemistry, formulas, and explanations remain available.
- A soldier in a battle, a flock animal, a wild beast, and a creature in the
  meadow can be possessed. Their local actions and lasting consequences use
  commands and are saved/replayed. Existing townsman possession remains available.
- Combat has more severing, blood trails, flying parts, tissue and bone. Their
  counts are bounded and their motion is derived from the hit and time. Full,
  Less, and None also apply to fights changed by possession.
- Character Body tabs open on a large figure with rotation, enlargement,
  equipment/anatomy modes, wound marks, and selectable body parts. Soldiers' armor
  and weapons come from their recorded battle design, with its year shown.
  Civilian pages explicitly say when no armor is recorded. Possession's actual
  blows replace the original battle outcome in the body's inspection.
- Brushes raise/lower ground, add/drain water, seed suitable native life, place
  ore, strike lightning on empty or occupied ground, and claim land for a realm.
  These affect globe cells, including when used from a region, camp, or town;
  they are not a separate town-scale voxel editor. A capital is protected from
  accidental reassignment; the existing union power handles whole realms.

## Persistence and touch

Generated terrain retains its original digest/random keys. Sparse surface
deviations and stroke events are stored separately; only edited worlds hash the
new fields. Touched provinces are refreshed and surface-dependent caches use a
content key. Extra ore has stable indices so a later stroke cannot rename an
existing mine. Loading an older snapshot restores the original arrays exactly.

A stroke has at most 64 sampled centers and 512 affected cells, with radius
0–3 and strength 1–4. One pointer paints; a second cancels the uncommitted stroke
and takes the camera. Gentle strokes wait two seconds for Undo, while strokes
that threaten people or homes require Apply. Pointer cancellation, hiding the
page, and leaving the tool cancel pending work. WebKit's completed-touch capture
release is handled without discarding the stroke. Controls reserve their space
so Undo does not move away under the thumb.

After a committed stroke, a fresh checkpoint is queued behind any older save
already in flight. Saving failure is reported instead of claiming success.
Terrain rebuilds release their previous mesh/material allocations.

## Checks and limits

- TypeScript and architecture lint.
- Simulation tests for terrain, water, life, ore, ownership, confirmation,
  save/load, old snapshots, cache isolation, and replay.
- All eight oracle histories retain their recorded hashes.
- Phase 58 and 62 browser gates in WebKit and Chromium at 430×932, DPR 3.
- Possession gate in phone-sized WebKit, including combat and both kinds of beast.
- Body-preview pixel checks and controls in WebKit and Chromium.
- Existing background/periodic saving, storage abort/refusal, touch navigation,
  reload recovery, and Chromium graphics-context recovery checks.

These are desktop browser-engine checks, not a physical iPhone 15 Plus test.
Windows WebKit has a pre-existing blank-render issue in some detailed battle
fixtures; its batch assertions alone are not proof of visible battle pixels.
The body inspector uses a 2D canvas and its visible output is verified in both
engines. The phone's automatic rendering ceiling remains Balanced.
