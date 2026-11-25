import { test } from "node:test";
import assert from "node:assert/strict";
import { VETERANS, veteransGrievance, veteransSkilled } from "../../src/rules/index.ts";

// Veterans come home (rules/veterans.ts): with what they learned, and with what they are owed.

test("those who served as long as a prentice does come home with a craft; a short war teaches few", () => {
  assert.equal(veteransSkilled(900, VETERANS.prentice), 900);
  assert.equal(veteransSkilled(900, 1), 300);
  assert.equal(veteransSkilled(900, 20), 900);
  assert.equal(veteransSkilled(0, 5), 0);
});

test("paid, they aggrieve no one; unpaid, by their share of the workers, what they are owed and how long they served", () => {
  assert.equal(veteransGrievance(5000, 100_000, 0, 4), 0);
  const some = veteransGrievance(5000, 100_000, 0.5, 4);
  assert.ok(some > 0);
  assert.ok(veteransGrievance(5000, 100_000, 1, 4) > some);
  assert.ok(veteransGrievance(10_000, 100_000, 0.5, 4) > some);
  assert.ok(veteransGrievance(5000, 100_000, 0.5, 1) < some);
  assert.equal(veteransGrievance(90_000, 100_000, 1, 9), VETERANS.most);
});
