import { test } from "node:test";
import assert from "node:assert/strict";
import { internalSolids, injurySolids } from "../../src/ui/anatomy.ts";
import { APE_FRAME, NO_LOOK, type Block } from "../../src/bridge/index.ts";
type Body = Extract<Block, { type: "body" }>;
const body: Body = {
  type: "body",
  person: {
    kind: "person",
    ref: "folk:test",
    age: 32,
    span: 70,
    occupation: 0,
    child: false,
    era: "metal",
    body: null,
    look: NO_LOOK,
  },
  members: APE_FRAME.members.map((member) => ({
    member,
    words: APE_FRAME.words[member]!,
    state: "whole",
  })),
};
test("organs and skeleton are distinct geometry; healthy records do not invent open wounds", () => {
  const organs = internalSolids(body, false),
    bones = internalSolids(body, true);
  const red = (s: (typeof organs)[number]) => s.color[0] > 0.5 && s.color[1] < 0.5;
  assert.ok(organs.filter(red).length > 10);
  assert.equal(bones.filter(red).length, 0);
  assert.ok(bones.length > 20);
  assert.deepEqual(injurySolids(body), []);
  assert.ok(
    [...organs, ...bones].every(
      (s) => s.sx > 0 && s.sy > 0 && s.sz > 0 && Number.isFinite(s.x + s.y + s.z),
    ),
  );
});
test("missing heads remove the skull and brain, and wounds gain actual flesh/bone surfaces", () => {
  const injured: Body = {
    ...body,
    person: { ...body.person, look: { ...NO_LOOK, lost: ["head"] } },
    members: body.members.map((m) => (m.member === "head" ? { ...m, state: "lost" } : m)),
  };
  const top = (pieces: ReturnType<typeof internalSolids>) =>
    Math.max(...pieces.map((s) => s.y + s.sy / 2));
  assert.ok(top(internalSolids(injured, false)) < top(internalSolids(body, false)) - 0.04);
  assert.ok(injurySolids(injured).length > injurySolids(injured, false).length);
  assert.equal(body.members.find((m) => m.member === "head")!.state, "whole");
});
