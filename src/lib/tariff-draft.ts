/**
 * Whether an operator's typed tariff differs from what the store holds.
 *
 * It lives here rather than inside the workspace component so it can be tested
 * as a function. The first version of it was compared as strings inside the
 * component and its test asserted the exact expression that carried the bug, so
 * both agreed and both were wrong.
 *
 * The comparison is in sen, never in text. `(sen / 100).toFixed(2)` always
 * renders two decimals, so an operator who types `10` and saves it leaves a
 * draft of `"10"` against a server rendering of `"10.00"`. Compared as strings
 * that row is dirty forever: the unsaved-changes banner never clears, and every
 * reload keeps preferring a draft that already equals the stored value. The
 * save button compared in sen and was therefore correctly disabled, which is
 * what made the stuck banner look inexplicable.
 */

/** MYR ringgit text to integer sen. Not exact for absurd input; the caller checks. */
export const toSen = (ringgit: string) => Math.round(Number(ringgit) * 100);

/** Integer sen to the two-decimal ringgit text the inputs display. */
export const ringgitOf = (amountSen: number) => (amountSen / 100).toFixed(2);

/**
 * `undefined` means the operator has not typed anything, which is not dirty.
 * Unparseable text is dirty: it is something they typed that the store does not
 * hold, and it must not be silently treated as agreement with the server.
 */
export function isDraftDirty(draft: string | undefined, amountSen: number): boolean {
  if (draft === undefined) return false;
  const drafted = toSen(draft);
  if (!Number.isSafeInteger(drafted)) return true;
  return drafted !== amountSen;
}
