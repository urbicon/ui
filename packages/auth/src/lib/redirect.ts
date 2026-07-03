/**
 * Validate a post-login redirect target against open redirects. Accepts only
 * an internal absolute path (`/…`) and returns `fallback` for anything else:
 * absolute/protocol-relative URLs (`https://evil.test`, `//evil.test`), the
 * backslash variant browsers normalize into one (`/\evil.test`), or an
 * empty/missing value.
 *
 * The auth handle appends the originally requested path to its login redirect
 * as `?redirectTo=…` (GET navigations only). This helper is the mandatory
 * gate between that query param — attacker-writable, like any URL — and a
 * `goto()`:
 *
 * ```svelte
 * <LoginPage onSuccess={() =>
 *   goto(sanitizeRedirect(page.url.searchParams.get('redirectTo'), '/dashboard'))
 * } />
 * ```
 *
 * Environment-free (no SvelteKit imports), so it works in components, load
 * functions and form actions alike.
 */
export function sanitizeRedirect(candidate: string | null | undefined, fallback: string): string {
  if (!candidate) return fallback;
  // Internal absolute paths only: exactly one leading '/'. '//host' is
  // protocol-relative (external), and browsers normalize '/\host' into it.
  if (!candidate.startsWith('/') || candidate.startsWith('//') || candidate.startsWith('/\\')) {
    return fallback;
  }
  // Belt and braces: resolve against a sentinel origin — anything that
  // escapes it (embedded scheme, whitespace-smuggled '//' the parser strips
  // into an authority, credentials trick, unparseable input) is rejected
  // rather than partially sanitized.
  try {
    const sentinel = 'http://sanitize-redirect.internal';
    const parsed = new URL(candidate, sentinel);
    if (parsed.origin !== sentinel) return fallback;
    // Dot-segment normalization can re-form a protocol-relative URL out of an
    // internal-looking input: '/..//evil.test' passes the raw-prefix gate but
    // normalizes to the pathname '//evil.test', which a browser navigation
    // resolves to https://evil.test. Reject the NORMALIZED output too, not
    // just the raw input (silent-failure review, package 6).
    if (parsed.pathname.startsWith('//')) return fallback;
    return parsed.pathname + parsed.search + parsed.hash;
  } catch {
    return fallback;
  }
}
