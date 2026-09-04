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
  // An emptied field is dirty even against a stored zero. `Number("")` is 0, so
  // a value comparison alone calls a cleared input identical to a RM 0.00 rate —
  // the same shape of mistake as comparing "10" to "10.00", just the other way
  // round. Clearing a field is something the operator did and should be told
  // about, and there is nothing to save until they type a number.
  if (draft.trim() === "") return true;
  const drafted = toSen(draft);
  if (!Number.isSafeInteger(drafted)) return true;
  return drafted !== amountSen;
}

/**
 * Whether a draft is a value the store may actually be given.
 *
 * Separate from `isDraftDirty` because the two answer different questions and
 * had been conflated. An emptied field is a change worth warning about, but it
 * is not an amount: `Number("")` is `0`, so a save guarded only by "is this a
 * safe non-negative integer" would quietly write RM 0.00 from an empty box and
 * make that band's shipping free. It must be dirty and unsavable at once.
 */
export function isDraftSavable(draft: string | undefined, amountSen: number): boolean {
  if (draft === undefined || draft.trim() === "") return false;
  const drafted = toSen(draft);
  return Number.isSafeInteger(drafted) && drafted >= 0 && drafted !== amountSen;
}
