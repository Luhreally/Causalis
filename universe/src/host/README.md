# host

**Owns.** The simulation host that runs in the worker: command intake and stamping, the step driver and its pacing, the snapshot builder, the query server.

**May import.** kernel, rules, gen, sim, causal, bridge. Other modules are reached only through their index.ts (tools/lint.ts enforces it).

**Invariants.**

- Pacing may read the clock; results may not depend on it (stepping in slices of any size gives the same history).
- Interest, queries and subscriptions never change the history (the observation-purity test).
