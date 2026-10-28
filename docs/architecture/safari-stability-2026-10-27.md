# Safari stability pass, 2026-10-27

The reported device is an iPhone 15 Plus using Safari at
<https://luhreally.github.io/Causalis/universe/>. This pass stabilizes the existing
game. It does not integrate the staged Phase 58 names, Phase 61 possession expansion,
or Phase 62 brushes. Those Claude scratch trees remain untouched.

The base is `958e14d`, including the completed K3 history performance fix and the
inspector button fix. GitHub's `ci-check` run for that commit passed; the live
`main` branch was still `84c7bdb` when checked.

## Changes

- Applied Claude's completed T1 town rendering patch from its scratch directory.
  Matching body parts share draw calls; distant poses are reused while positions
  stay current; collision and daily-walk lookups do less repeated work. Its new
  tests check the old and new results against each other.
- Phone graphics starts at Balanced, including before the first scene is drawn.
  Phone Auto stays at Balanced or below, rather than climbing into an unverified
  memory budget. Explicit quality choices remain available; desktop Auto is unchanged.
- Phone multisample smoothing defaults off. With it on, Windows WebKit returned
  graphics errors and a transparent scene, on both the live build and this branch.
  With it off, the sandbox's pixels are opaque and error-free. This also avoids the
  extra multisample colour and depth buffers on the phone. `?aa=1` remains available.
- Save after the first picture, every minute, and when switching away. Background
  simulation pauses and resumes through the clock's existing holds.
- Once a save commits, replace the current address's `load` parameter so a refresh
  or a discarded Safari tab resumes that save. Manual saves and loads do this too.
- Automatic checkpoints share a single in-flight write. IndexedDB writes resolve
  only on transaction completion; opening failures have rejection handlers.
  Unavailable storage is shown in the game, with the file-export route explained.
- A failed requested load shows a recovery link to saved worlds. It no longer
  silently replaces the world with its opening year.
- Hold time and save on graphics context loss. Let PlayCanvas restore its resources,
  resume at Low, and restart Auto's measurements after restoration.
- A pinch, twist, or drag returning to its starting point cannot become a selection.
  Cancellation and lost capture clear the touch's tracking.

Existing saves and the two-slot fallback format are unchanged. Browser storage is
still local to the device. An abrupt OS termination may prevent the final
background save, so recovery uses the most recent completed checkpoint. The tests
below use desktop browser engines; this pass does not claim a physical iPhone
memory-pressure test.

Windows WebKit also leaves the town transparent at High, even with smoothing off;
Balanced visibly renders its ground, homes and people. This behavior also occurs
with the live build and is not claimed fixed at every explicit quality setting.
The phone's automatic ceiling avoids that path. Screenshots and diagnostic logs
are kept in `C:/Users/danie/Causalis-work/measurements/safari-stability` and
`universe/stability-visual*.log`.

## Verification

From `p12/universe`:

```text
npm run typecheck
npm run lint
npm run build
node --test --test-concurrency=4 "tests/{*.test.ts,!(perf)/**/*.test.ts}"
node --test --test-concurrency=1 "tests/perf/**/*.test.ts"
node tools/oracle.ts
node tools/app-check.ts
node tools/stability-check.ts --shots C:/Users/danie/Causalis-work/measurements/safari-stability
node tools/phase60-gate.ts --webkit --shots C:/Users/danie/Causalis-work/measurements/safari-stability
```

The stability check exercises both WebKit and Chromium at 430×932, DPR 3:
actual rendered pixels, background checkpoints, reload recovery, the minute timer, two-finger and single
touches, missing saves, aborted real IndexedDB transactions, and refused storage.
Chromium also loses and restores a real WebGL context without reloading the world.
The existing app check exercises worker and inline simulation, three browser
engines, navigation between scales, saves, the title screen, and the sandbox.

The eight oracle fixtures remain unchanged. The WebKit possession gate passes,
including rotation, simultaneous controls, crafting, conversation, release, and
replaying the resulting save to the same world. Detailed local logs are
`universe/stability-*.log` (ignored by Git).

Results: 1,492 full-suite tests passed, the added device-tier test passed separately,
and all seven performance tests passed. The final focused run passed all 17 tests.
Type checking, architecture lint, production build, all three engines' app checks,
and the WebKit/Chromium stability checks passed. The latter is also added to the
existing CI browser job.
