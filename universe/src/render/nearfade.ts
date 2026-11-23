// A figure's material that can fade out by degrees (2026-11-23: those standing near the eye behind one possessed, or between
// it and him, fade out over a band as they come near, never popping out). An instance's opacity rides in its matrix's last
// corner (1: whole, the corner as any matrix has it; 0: gone), put back to 1 before the matrix is used; a fragment is kept or
// not by a fixed ordered pattern (a screen door, Bayer 8x8) as that opacity falls, so the parts stay opaque and need no
// sorting, and its shadow fades with it. Whole (1), nothing is dropped: a figure out of a possession is drawn as ever.
import * as pc from "playcanvas";
import { flatMaterial, tonedMaterial, type Rgb } from "./stage.ts";

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
/** The same for a toned material (stage.ts tonedMaterial: each instance's colour in its matrix's last row's first three). */
const NEAR_FADE_TONE_VS = `
attribute vec4 instance_line1;
attribute vec4 instance_line2;
attribute vec4 instance_line3;
attribute vec4 instance_line4;
varying vec3 vTone;
varying float vNearAlpha;
mat4 getModelMatrix() {
	vTone = vec3(instance_line1.w, instance_line2.w, instance_line3.w);
	vNearAlpha = instance_line4.w;
	return matrix_model * mat4(vec4(instance_line1.xyz, 0.0), vec4(instance_line2.xyz, 0.0), vec4(instance_line3.xyz, 0.0), vec4(instance_line4.xyz, 1.0));
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

/**
 * A toned material (stage.ts tonedMaterial: what grows about a town, render/townflora.ts) that can fade so, instance by
 * instance, once its screen door is let in (ditherNear): till then drawn as any toned material is, with nothing dropped, so
 * a town's many trees seen from afar pay nothing for it.
 */
export function fadingToned(): pc.StandardMaterial {
  const m = tonedMaterial(),
    chunks = m.getShaderChunks(pc.SHADERLANGUAGE_GLSL);
  chunks.set("transformInstancingVS", NEAR_FADE_TONE_VS);
  chunks.set("opacityPS", NEAR_FADE_OPACITY_PS);
  m.update();
  return m;
}

/** A fading material's screen door let in (a possession's eye near it) or shut (whole again: nothing dropped, as ever). */
export function ditherNear(m: pc.StandardMaterial, on: boolean): void {
  const d = on ? pc.DITHER_BAYER8 : pc.DITHER_NONE;
  if (m.opacityDither === d) return;
  m.opacityDither = d;
  m.opacityShadowDither = d;
  m.update();
}
