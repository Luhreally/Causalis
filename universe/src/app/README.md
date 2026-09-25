# app

**Owns.** Boot, device tier, settings, save and load screens, input routing; wires the host (worker or in-thread) to render and ui.

**May import.** kernel, bridge, view, render, ui, host. Other modules are reached only through their index.ts (tools/lint.ts enforces it).

**Invariants.**

- The device changes presentation budgets only, never the simulation.
