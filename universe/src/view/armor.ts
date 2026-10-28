export type ArmorPanel = { x: number; y: number; z: number; w: number; h: number; d: number };
const panel = (x: number, y: number, z: number, w: number, h: number, d: number): ArmorPanel => ({
  x,
  y,
  z,
  w,
  h,
  d,
});
const SHOULDERS = [panel(-0.62, 0.35, 0, 0.3, 0.26, 1.12), panel(0.62, 0.35, 0, 0.3, 0.26, 1.12)];
const PLATE = [
  panel(0, 0, 0, 1.12, 1.05, 1.16),
  ...SHOULDERS,
  panel(0, -0.43, 0.1, 1.14, 0.12, 1.2),
];
const LINKS = [
  panel(0, 0, 0, 1.1, 1.08, 1.13),
  ...SHOULDERS,
  ...[0.27, 0, -0.27].map((y) => panel(0, y, 0.6, 1.04, 0.08, 0.09)),
];
const HIDE = [
  panel(0, 0, 0, 1.09, 1.04, 1.12),
  panel(0, -0.3, 0.59, 1.1, 0.09, 0.08),
  panel(0, 0.28, 0.59, 1.1, 0.09, 0.08),
];
/** Normalized armor shells over the torso; no armor is invented for shield-only or unarmored hosts. */
export function armorPanels(guard: string): readonly ArmorPanel[] {
  return guard === "plate"
    ? PLATE
    : guard === "scale" || guard === "mail"
      ? LINKS
      : guard === "leather"
        ? HIDE
        : [];
}
export function armorColor(guard: string, kit: string): readonly [number, number, number] {
  if (guard === "leather") return [0.36, 0.19, 0.09];
  if (/bronze|copper/i.test(kit) || (guard === "scale" && !/iron|steel/i.test(kit)))
    return [0.72, 0.49, 0.23];
  return guard === "mail" ? [0.43, 0.48, 0.54] : [0.65, 0.71, 0.78];
}
/** Surface reached by a recorded wound, including the armor covering that point. */
export function armorDepth(guard: string, u: number, v: number, face: number): number {
  return armorPanels(guard).reduce(
    (d, p) =>
      Math.abs(u - p.x) <= p.w / 2 && Math.abs(v - p.y) <= p.h / 2
        ? Math.max(d, p.z * face + p.d / 2)
        : d,
    0.5,
  );
}
