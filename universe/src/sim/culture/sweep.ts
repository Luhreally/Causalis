// The culture sweep (2026-11-16), installed together: its stores (sim/culture/rows.ts) and its systems, each in its own year's
// place: what a town draws (141), a faith's houses (176), who a land counts its own (177), its works (178), what a seat tells (186), and higher learning (157).
import type { World } from "../../kernel/index.ts";
import type { PopulationContext } from "../population/systems.ts";
import { installUrban } from "../population/urban.ts";
import { installTemples } from "../belief/temple.ts";
import { installVoice } from "../order/voice.ts";
import { installFolk } from "./folk.ts";
import { installArt } from "./art.ts";
import { registerCultureRows } from "./rows.ts";
import { installAcademies } from "../lore/academy.ts";

/** Teach a peopled world the culture sweep's systems. */
export function installCultureSweep(world: World, ctx: () => PopulationContext): void {
  registerCultureRows(world);
  installUrban(world, ctx);
  installTemples(world, ctx);
  installFolk(world, ctx);
  installArt(world, ctx);
  installVoice(world, ctx);
  installAcademies(world, ctx);
}
