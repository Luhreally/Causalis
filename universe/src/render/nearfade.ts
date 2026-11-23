// A figure's material that can fade out by degrees (2026-11-23: those standing near the eye behind one possessed, or between
// it and him, fade out over a band as they come near, never popping out). An instance's opacity rides in its matrix's last
// corner (1: whole, the corner as any matrix has it; 0: gone), put back to 1 before the matrix is used; a fragment is kept or
// not by a fixed ordered pattern (a screen door, Bayer 8x8) as that opacity falls, so the parts stay opaque and need no
// sorting, and its shadow fades with it. Whole (1), nothing is dropped: a figure out of a possession is drawn as ever.
import * as pc from "playcanvas";
import { flatMaterial, type Rgb } from "./stage.ts";

const NEAR_FADE_VS = `
attribute vec4 instance_line1;
attribute vec4 instance_line2;
attribute vec4 instance_line3;
attribute vec4 instance_line4;
varying float vNearAlpha;
mat4 getModelMatrix() {
	vNearAlpha = instance_line4.w;
	return matrix_model * mat4(instance_line1, instance_line2, instance_line3, vec4(instance_line4.xyz, 1.0));
}
`;
const NEAR_FADE_OPACITY_PS = `
uniform float material_opacity;
uniform float material_alphaDitherScale;
varying float vNearAlpha;
void getOpacity() {
	dAlpha = material_opacity * clamp(vNearAlpha, 0.0, 1.0);
}
`;

/** A figure's flat colour (stage.ts flatMaterial) whose instances each carry their opacity in their matrix's last corner. */
export function nearFadeMaterial(color: Rgb): pc.StandardMaterial {
  return fading(flatMaterial(color));
}

/**
 * An opaque instanced material (its own sheen and colour kept) made to fade so, instance by instance: for what a layer
 * already made, a battle's arms and its men's parts (render/battle.ts).
 */
export function fading(m: pc.StandardMaterial): pc.StandardMaterial {
  const chunks = m.getShaderChunks(pc.SHADERLANGUAGE_GLSL);
  chunks.set("transformInstancingVS", NEAR_FADE_VS);
  chunks.set("opacityPS", NEAR_FADE_OPACITY_PS);
  m.shaderChunksVersion = pc.CHUNKAPI_2_8;
  m.setAttribute("instance_line1", pc.SEMANTIC_ATTR11);
  m.setAttribute("instance_line2", pc.SEMANTIC_ATTR12);
  m.setAttribute("instance_line3", pc.SEMANTIC_ATTR14);
  m.setAttribute("instance_line4", pc.SEMANTIC_ATTR15);
  m.opacityDither = pc.DITHER_BAYER8;
  m.opacityShadowDither = pc.DITHER_BAYER8;
  m.update();
  return m;
}
