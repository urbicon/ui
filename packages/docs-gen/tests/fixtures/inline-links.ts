/** Fixture: `{@link …}` inside prop descriptions. */
export interface InlineLinksProps {
  /** Debounce applied to the query, in ms. */
  debounceMs?: number;

  /** Server-side search, debounced by {@link debounceMs} on each change. */
  queryFn?: () => void;

  /** Pair with {@link InlineLinksProps.debounceMs} for a controlled setup. */
  qualified?: string;

  /** See {@link https://example.test/docs the upstream note} for details. */
  withDisplayText?: string;

  /** Mirrors {@link InlineLinksProps#queryFn}. */
  memberName?: string;
}
