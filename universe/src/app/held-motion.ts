import type { HeldBody } from "../bridge/index.ts";

/** Ease small host corrections without changing simulation positions or collisions. */
export function softenBodies(
  previous: readonly HeldBody[],
  next: readonly HeldBody[],
  dt: number,
): readonly HeldBody[] {
  const before = new Map(previous.map((b) => [b.id, b]));
  const weight = 1 - Math.exp(-Math.max(0, Math.min(0.1, dt)) / 0.055);
  return next.map((b) => {
    const p = before.get(b.id);
    if (
      !p ||
      b.doing === "dead" ||
      b.doing === "down" ||
      b.doing === "gone" ||
      Math.hypot(b.x - p.x, b.z - p.z) > 3
    )
      return b;
    const turn = Math.atan2(Math.sin(b.yaw - p.yaw), Math.cos(b.yaw - p.yaw));
    return {
      ...b,
      x: p.x + (b.x - p.x) * weight,
      z: p.z + (b.z - p.z) * weight,
      yaw: p.yaw + turn * weight,
    };
  });
}
