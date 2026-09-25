# kernel

**Owns.** References (Ref), keyed randomness and its stream registry, deterministic math (dmath), time, the scheduler, state stores, the event log, cause references and decision records, hashing and serialization.

**May import.** nothing. Other modules are reached only through their index.ts (tools/lint.ts enforces it).

**Invariants.**

- Pure and deterministic: no clock, platform, locale or garbage-collection dependence (the determinism lint enforces it).
- Randomness is a pure function of a key; nothing stores or shares a random stream.
- No domain knowledge: the kernel never names a person, a planet or a war.
