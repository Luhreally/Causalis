# causal

**Owns.** The Causal Field above the simulation: the observer ledger and its claims, resolvers (collapse, deepen, later), the macro history, history retention and summaries, and the explainer (why).

**May import.** kernel, rules, gen, sim. Other modules are reached only through their index.ts (tools/lint.ts enforces it).

**Invariants.**

- Resolution is pure with respect to the authoritative history: it writes only the observer ledger.
- Claims never exceed counts.
- Resolved facts never change except by simulation events that apply to them.
