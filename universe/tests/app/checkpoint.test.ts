import { test } from "node:test";
import assert from "node:assert/strict";
import { Checkpoint } from "../../src/app/checkpoint.ts";

test("a committed edit queues a fresh snapshot after an older checkpoint", async () => {
  let finish: () => void = () => {},
    value = 0;
  const kept: number[] = [];
  const c = new Checkpoint(
    () => {
      kept.push(value);
      return new Promise<void>((resolve) => {
        finish = resolve;
      });
    },
    () => {},
  );
  const old = c.save();
  await Promise.resolve();
  value = 1;
  const fresh = c.save(true);
  finish();
  await old;
  await Promise.resolve();
  await Promise.resolve();
  assert.deepEqual(kept, [0, 1]);
  finish();
  assert.equal(await fresh, true);
});

test("overlapping checkpoints share one snapshot until the write commits", async () => {
  let finish: () => void = () => {};
  let copies = 0;
  const reports: unknown[] = [];
  const checkpoint = new Checkpoint(
    () => {
      copies++;
      return new Promise<void>((resolve) => (finish = resolve));
    },
    (error) => reports.push(error),
  );
  const first = checkpoint.save();
  assert.equal(checkpoint.save(), first);
  await Promise.resolve();
  assert.equal(copies, 1);
  assert.deepEqual(reports, [], "not reported saved while storage is still writing");
  finish();
  assert.equal(await first, true);
  assert.deepEqual(reports, [null]);
  const next = checkpoint.save();
  await Promise.resolve();
  assert.equal(copies, 2);
  finish();
  assert.equal(await next, true);
});

test("a refused checkpoint is reported and can be retried, including a synchronous failure", async () => {
  const failure = new Error("quota exceeded");
  let fail = true;
  const reports: unknown[] = [];
  const checkpoint = new Checkpoint(
    () => {
      if (fail) throw failure;
      return Promise.resolve();
    },
    (error) => reports.push(error),
  );
  assert.equal(await checkpoint.save(), false);
  assert.deepEqual(reports, [failure]);
  fail = false;
  assert.equal(await checkpoint.save(), true);
  assert.deepEqual(reports, [failure, null]);
});
