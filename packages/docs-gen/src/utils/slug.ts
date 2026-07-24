/**
 * Single source of truth for the PascalCase → kebab-case component slug.
 *
 * Every artifact the pipeline writes is keyed by this slug — the doc route
 * directory, the per-component `api.ts`, the `_catalog.json` entry, the
 * `llm.txt` asset path and the MCP catalog entry. They used to be four
 * independent copies of the same regex, which is exactly how they drifted;
 * import this instead of re-deriving it.
 */

/**
 * Convert a PascalCase component name to its kebab-case doc slug.
 *
 * Two boundaries have to be split, in this order:
 *
 * 1. **Acronym run → word** (`\p{Lu}+` followed by `\p{Lu}\p{Ll}`): the final
 *    capital of a run of capitals belongs to the *next* word, so `QRCode`
 *    splits as `QR|Code`, `IOStream` as `IO|Stream`, `HTTPSProxy` as
 *    `HTTPS|Proxy`. Without this pass the run has no lower→upper boundary at
 *    all and `QRCode` collapses to `qrcode`.
 * 2. **Word → capital** (lowercase/digit followed by a capital): the classic
 *    `PinInput` → `Pin|Input`, `A2UIView` → `A2|UI-View`.
 *
 * A trailing acronym has no following lowercase and therefore stays whole
 * (`ChartAPI` → `chart-api`). Whitespace and underscores collapse to a single
 * hyphen; the result is lowercased.
 *
 * @example
 * toSlug('Button')      // 'button'
 * toSlug('DatePicker')  // 'date-picker'
 * toSlug('QRCode')      // 'qr-code'
 * toSlug('HTTPSProxy')  // 'https-proxy'
 * toSlug('A2UIView')    // 'a2-ui-view'
 */
export function toSlug(input: string): string {
  return input
    .replace(/(\p{Lu}+)(\p{Lu}\p{Ll})/gu, '$1-$2')
    .replace(/([\p{Ll}\p{N}])(\p{Lu})/gu, '$1-$2')
    .replace(/[\s_]+/g, '-')
    .toLowerCase();
}
