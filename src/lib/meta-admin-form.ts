export type MetaAdminFormStateInput = {
  pixelId: string;
  savedPixelId: string;
  pixelValidForSave: boolean;
  pixelValidForTest: boolean;
  draftToken: string;
  tokenUsable: boolean;
  tokenRemovable: boolean;
  testCodeValid: boolean;
  clearToken: boolean;
  pending: boolean;
};

export function getMetaAdminFormState(input: MetaAdminFormStateInput) {
  const deletingToken = input.tokenRemovable && input.clearToken;
  const hasDraftToken = Boolean(input.draftToken);
  const dirty = input.pixelId !== input.savedPixelId || hasDraftToken || deletingToken;
  const tokenMode = deletingToken
    ? "delete"
    : hasDraftToken
      ? "draft"
      : input.tokenUsable
        ? "stored"
        : input.tokenRemovable
          ? "invalid"
          : "empty";

  return {
    deletingToken,
    dirty,
    tokenMode,
    canRevealToken: !input.pending && !deletingToken && hasDraftToken,
    canSave: !input.pending && dirty && input.pixelValidForSave,
    canTest: !input.pending
      && !deletingToken
      && input.pixelValidForTest
      && (hasDraftToken || input.tokenUsable)
      && input.testCodeValid,
  } as const;
}
