# rules

**Owns.** Data tables and their schemas: commodities, principles, body-plan primitives, design components, institution slots, event types and text templates, balance constants, generation priors (earthlike, open).

**May import.** kernel. Other modules are reached only through their index.ts (tools/lint.ts enforces it).

**Invariants.**

- Parameters, not mechanisms: data never grows an expression language; logic is a named function referenced by id.
- Every table is validated when the ruleset is built; the ruleset id hashes code and data.
