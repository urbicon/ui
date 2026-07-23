import type { MarkdownUrlPolicy } from './types';

/**
 * URL policy enforcement (decision A4 — strict by default).
 *
 * LLM output is untrusted input: prompt-injected markdown links/images are a
 * proven data-exfiltration channel (query-param payloads to attacker hosts)
 * even without any script execution. Policy therefore runs on every URL the
 * parser emits, and blocked URLs never reach the produced node tree — a
 * blocked link/image carries `blocked: true` and an empty href/src.
 *
 * Checks run against the *normalized* absolute URL (WHATWG `URL`), so scheme
 * tricks (`JaVaScRiPt:`, embedded tabs/newlines, `https:\\host`, `/../`
 * path escapes against a prefix) are neutralized before matching.
 */

export const DEFAULT_LINK_PROTOCOLS = ['http:', 'https:', 'mailto:', 'tel:'];

/** Placeholder base — only used to detect whether a URL is relative. */
const RELATIVE_PROBE_BASE = 'https://relative-probe.invalid/';

/**
 * Strip ASCII tab/newline/CR and C0 controls anywhere in the string (the URL
 * standard removes tab/NL/CR during parsing, so leaving them in would let
 * `java\tscript:` sneak past a naive scheme check while browsers still
 * execute it) and trim outer whitespace.
 */
function cleanRawUrl(raw: string): string {
  let out = '';
  for (const ch of raw.trim()) {
    const code = ch.charCodeAt(0);
    if (code > 0x1f) out += ch;
  }
  return out;
}

type Resolved =
  | { absolute: true; url: URL }
  | { absolute: false; cleaned: string }
  | { invalid: true };

function resolve(raw: string): Resolved & { invalid?: boolean } {
  const cleaned = cleanRawUrl(raw);
  if (cleaned.length === 0) return { invalid: true } as const;
  // Protocol-relative URLs (`//host/…`) are absolute in effect; resolving
  // them against the probe base would otherwise mislabel them as relative.
  const protocolRelative = cleaned.startsWith('//');
  try {
    const url = new URL(protocolRelative ? `https:${cleaned}` : cleaned);
    return { absolute: true, url };
  } catch {
    // Not parseable standalone → candidate for a relative reference.
  }
  try {
    new URL(cleaned, RELATIVE_PROBE_BASE);
    return { absolute: false, cleaned };
  } catch {
    return { invalid: true } as const;
  }
}

export type UrlCheck = { ok: true; href: string } | { ok: false };

const BLOCKED: UrlCheck = { ok: false };

/**
 * Check a link destination. Relative references are always allowed; absolute
 * URLs must carry an allowed protocol.
 */
export function checkLinkUrl(raw: string, policy: MarkdownUrlPolicy | undefined): UrlCheck {
  const resolved = resolve(raw);
  if ('invalid' in resolved && resolved.invalid) return blocked('link', raw, policy);
  if (!resolved.absolute) return { ok: true, href: resolved.cleaned };
  const allowed = (policy?.allowedLinkProtocols ?? DEFAULT_LINK_PROTOCOLS).map((p) =>
    p.toLowerCase()
  );
  if (allowed.includes(resolved.url.protocol)) return { ok: true, href: resolved.url.href };
  return blocked('link', raw, policy);
}

/**
 * Check an image source. Relative references are allowed (same-origin is not
 * an exfiltration sink); absolute URLs must match an allowlisted prefix on
 * the normalized href. The default empty allowlist blocks every external
 * image — the CamoLeak lesson, and the posture ChatGPT/Copilot converged on.
 */
export function checkImageUrl(raw: string, policy: MarkdownUrlPolicy | undefined): UrlCheck {
  const resolved = resolve(raw);
  if ('invalid' in resolved && resolved.invalid) return blocked('image', raw, policy);
  if (!resolved.absolute) return { ok: true, href: resolved.cleaned };
  const prefixes = policy?.allowedImagePrefixes ?? [];
  const href = resolved.url.href;
  for (const prefix of prefixes) {
    if (href.startsWith(normalizePrefix(prefix))) return { ok: true, href };
  }
  return blocked('image', raw, policy);
}

/**
 * Normalize an allowlist prefix the same way hrefs are normalized (lowercased
 * scheme/host, resolved path) so `HTTPS://Example.com/img/` still matches.
 * A bare-origin prefix gains its trailing slash (`https://cdn.example.com` →
 * `…com/`), which pins it to that origin — without it, `startsWith` would
 * also match `https://cdn.example.com.evil.com/…`. Prefixes that are not
 * full URLs (e.g. `data:`) are kept verbatim.
 */
function normalizePrefix(prefix: string): string {
  try {
    return new URL(prefix).href;
  } catch {
    return prefix;
  }
}

function blocked(
  kind: 'link' | 'image',
  raw: string,
  policy: MarkdownUrlPolicy | undefined
): UrlCheck {
  policy?.onBlocked?.(kind, raw);
  return BLOCKED;
}
