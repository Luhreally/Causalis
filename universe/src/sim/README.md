# sim

**Owns.** The authoritative systems by domain: planet, ecology, population, economy, polity, culture, technology and design, conflict, space, divine acts, and the microscope.

**May import.** kernel, rules, gen. Other modules are reached only through their index.ts (tools/lint.ts enforces it).

**Invariants.**

- Every piece of state has one owning system, which writes it only in its commit phase.
- Important changes record their causes at the point of decision (typed CauseRefs, decision records).
- Counted things are integers and are conserved.
- The simulation never reads what the observer has resolved unless a command promoted it.
