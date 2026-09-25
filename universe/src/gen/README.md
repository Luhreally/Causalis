# gen

**Owns.** Pure generators: galaxy, star systems, planets, geology, climate, hydrology, deep-time life and species, cultures, languages, names, region refinement.

**May import.** kernel, rules. Other modules are reached only through their index.ts (tools/lint.ts enforces it).

**Invariants.**

- A generator is a pure function of the seed and the thing's structural reference.
- Every generated fact can explain itself: generators record the rule and inputs that produced it.
- Generators never mint references.
