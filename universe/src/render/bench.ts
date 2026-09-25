// The instancing benchmark (?bench=N): N capsules in four instanced batches, all
// moving every frame (so both the CPU matrix upload and the GPU draw are
// measured). Reports frames per second after a warm-up. The phone floor's budget
// is 5,000 visible instances at 60 fps.
import { InstancedBatch, capsuleMesh } from "./batch.ts";
import type { Stage } from "./stage.ts";

export type BenchResult = {
  readonly instances: number;
  readonly fps: number;
  readonly frameMs: number;
  readonly frames: number;
};

export function runBench(stage: Stage, instances: number, seconds = 5): Promise<BenchResult> {
  const mesh = capsuleMesh(stage, 0.08, 0.36),
    colors = [
      [0.88, 0.63, 0.28],
      [0.2, 0.62, 0.6],
      [0.62, 0.38, 0.66],
      [0.8, 0.8, 0.82],
    ] as const,
    per = Math.ceil(instances / colors.length),
    batches = colors.map((c) => new InstancedBatch(stage, mesh, c, per)),
    side = Math.ceil(Math.sqrt(instances)),
    spacing = 0.28;
  let time = 0,
    frames = 0,
    measured = 0;
  return new Promise((resolve) => {
    const stop = stage.onUpdate((dt) => {
      time += dt;
      batches.forEach((batch, b) => {
        const count = Math.min(per, instances - b * per);
        batch.set(count, (i, out) => {
          const n = b * per + i,
            gx = n % side,
            gz = Math.floor(n / side);
          out[0] = (gx - side / 2) * spacing;
          out[1] = 0.3 + 0.08 * Math.sin(time * 3 + n * 0.37);
          out[2] = (gz - side / 2) * spacing;
          out[3] = out[4] = out[5] = 1;
          out[6] = time + n;
        });
      });
      if (time > 1) {
        frames++;
        measured += dt;
      }
      if (measured >= seconds) {
        stop();
        resolve({ instances, fps: frames / measured, frameMs: (measured * 1000) / frames, frames });
      }
    });
  });
}
