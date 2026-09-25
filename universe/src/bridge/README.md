# bridge

**Owns.** The protocol between the main thread and the simulation host: message types, the client, and the in-thread fallback transport.

**May import.** kernel. Other modules are reached only through their index.ts (tools/lint.ts enforces it).

**Invariants.**

- Messages carry commands in and snapshots, replies and notifications out. Nothing on the main thread can write authoritative state.
- Snapshots are designed for what is shown, and travel as transferable buffers (no SharedArrayBuffer: GitHub Pages cannot isolate).
