/** `_meta.ui.csp` as the host reads it off the wire — nothing about it is trusted. */
export interface HostCsp {
  connectDomains?: unknown;
  resourceDomains?: unknown;
  frameDomains?: unknown;
  baseUriDomains?: unknown;
}

/**
 * An entry that could end a CSP directive or smuggle in a keyword is dropped
 * (`;`, whitespace, quotes). The spec does not say so in words, but "MUST NOT
 * allow undeclared domains" would otherwise mean that an entry
 * `x; script-src *` allows everything.
 */
function domains(list: unknown): string {
  if (!Array.isArray(list)) return '';
  return list.filter((d) => typeof d === 'string' && d !== '' && !/[;\s'"]/.test(d)).join(' ');
}

/**
 * The CSP of a view from its `_meta.ui.csp`, line by line the construction
 * of the spec (`apps.mdx` → "Security Implications" → "CSP Construction from
 * Metadata"), plus `report-uri`, so that every violation arrives even where
 * the console does not report it. Without `csp`, the spec's "Restrictive
 * Default" from "Host Behavior".
 */
export function buildCsp(csp: HostCsp | null | undefined, reportUri: string): string {
  const report = `report-uri ${reportUri}`;
  if (!csp) {
    return [
      "default-src 'none'",
      "script-src 'self' 'unsafe-inline'",
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data:",
      "media-src 'self' data:",
      "connect-src 'none'",
      report
    ].join('; ');
  }
  const resources = domains(csp.resourceDomains);
  return [
    "default-src 'none'",
    `script-src 'self' 'unsafe-inline' ${resources}`.trim(),
    `style-src 'self' 'unsafe-inline' ${resources}`.trim(),
    `connect-src 'self' ${domains(csp.connectDomains)}`.trim(),
    `img-src 'self' data: ${resources}`.trim(),
    `font-src 'self' ${resources}`.trim(),
    `media-src 'self' data: ${resources}`.trim(),
    `frame-src ${domains(csp.frameDomains) || "'none'"}`,
    "object-src 'none'",
    `base-uri ${domains(csp.baseUriDomains) || "'self'"}`,
    report
  ].join('; ');
}
