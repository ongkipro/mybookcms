import assert from "node:assert/strict";
import test from "node:test";
import { getMetaAdminFormState } from "./meta-admin-form.ts";

const base = {
  pixelId: "123456789012345",
  savedPixelId: "123456789012345",
  pixelValidForSave: true,
  pixelValidForTest: true,
  draftToken: "",
  tokenUsable: false,
  tokenRemovable: false,
  testCodeValid: false,
  clearToken: false,
  pending: false,
};

test("Meta form actions follow empty, stored, draft, and deletion token states", () => {
  assert.deepEqual(getMetaAdminFormState(base), {
    deletingToken: false,
    dirty: false,
    tokenMode: "empty",
    canRevealToken: false,
    canSave: false,
    canTest: false,
  });

  assert.equal(getMetaAdminFormState({ ...base, tokenUsable: true, tokenRemovable: true, testCodeValid: true }).canTest, true);
  const draft = getMetaAdminFormState({ ...base, draftToken: "new-token", testCodeValid: true });
  assert.equal(draft.tokenMode, "draft");
  assert.equal(draft.canRevealToken, true);
  assert.equal(draft.canSave, true);
  assert.equal(draft.canTest, true);

  const deletion = getMetaAdminFormState({ ...base, tokenUsable: true, tokenRemovable: true, clearToken: true, testCodeValid: true });
  assert.equal(deletion.tokenMode, "delete");
  assert.equal(deletion.canSave, true);
  assert.equal(deletion.canTest, false);

  const invalid = getMetaAdminFormState({ ...base, tokenRemovable: true, testCodeValid: true });
  assert.equal(invalid.tokenMode, "invalid");
  assert.equal(invalid.canTest, false);
  assert.equal(getMetaAdminFormState({ ...base, tokenUsable: true, tokenRemovable: false, clearToken: true }).dirty, false);
});

test("pending or invalid identifiers keep Meta actions disabled", () => {
  assert.equal(getMetaAdminFormState({ ...base, draftToken: "new-token", pixelValidForSave: false }).canSave, false);
  assert.equal(getMetaAdminFormState({ ...base, tokenUsable: true, tokenRemovable: true, testCodeValid: true, pending: true }).canTest, false);
});
