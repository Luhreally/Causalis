# Causalis Universe

A deterministic, observatory-first universe: from a seed to stars, planets,
life, peoples, cities, states, technology, war, spaceflight and interstellar
civilization — one causal state you can watch, question and touch as a god.

The architecture is `../docs/architecture/universe-architecture.md`. Read it
before changing a module, and read the module's own `src/<module>/README.md`
contract.

## Running

```
npm install
npm run dev          # the app at http://localhost:5173
npm run check        # typecheck + architecture lints + tests
npm run build        # dist/, served at /Causalis/universe/ on GitHub Pages
```

Tests and tools are TypeScript run directly by Node 24 (type stripping), so
code uses only erasable syntax (no enums, namespaces or parameter properties)
and relative imports name their `.ts` file.

## Modules

`src/` holds eleven modules. Each is imported only through its `index.ts`, in
one direction:

```
kernel ← rules ← gen ← sim ← causal ← host        (the worker side)
kernel ← bridge ← view ← render, ui ← app         (the page side; app may start host)
```

`tools/lint.ts` enforces the directions and, for `kernel`, `rules`, `gen`,
`sim` and `causal`, the determinism rules: no engine-dependent `Math`, no
clocks, platform, locale or weak collections, no comparator-less sorts.

## The invariants that matter most

1. Same seed + ruleset + command log ⇒ the same history, on every engine.
2. Looking never changes history: queries, resolution, the camera and the
   microscope's watched shadow are pure.
3. Only commands are inputs; every divine act is logged and is a cause.
4. Randomness is a pure function of a key.
5. Counted things are integers and are conserved.
