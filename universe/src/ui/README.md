# ui

**Owns.** The observatory: pages built from blocks, typed links and navigation, why-trees, instruments, the god's toolbox, plain-words text.

**May import.** kernel, bridge, view. Other modules are reached only through their index.ts (tools/lint.ts enforces it).

**Invariants.**

- Reads through queries and subscriptions; acts only through commands.
- Panels never rebuild under the pointer; opened sections stay open.
