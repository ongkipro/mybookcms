import assert from "node:assert/strict";
import test from "node:test";
import { myrMajorFromSen } from "./ads-signal-policy.ts";

test("advertising values convert integer sen to MYR major units", () => {
  assert.equal(myrMajorFromSen(4690), 46.9);
  assert.equal(myrMajorFromSen(0), 0);
});
