# view

**Owns.** Pure view-spec builders: simulation facts to VisualSpec, PageSpec and ChartSpec.

**May import.** kernel, rules, bridge. Other modules are reached only through their index.ts (tools/lint.ts enforces it).

**Invariants.**

- Pure: the same facts give the same spec. No PlayCanvas, no DOM.
