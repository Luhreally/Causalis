# render

**Owns.** The PlayCanvas adapter: view keys to pooled entities, instancing, level of detail, the camera stack, shader lenses and picking.

**May import.** kernel, bridge, view (and the playcanvas package). Other modules are reached only through their index.ts (tools/lint.ts enforces it).

**Invariants.**

- Owns every PlayCanvas object; the simulation never sees one.
- Entities exist only for what is presented now.
