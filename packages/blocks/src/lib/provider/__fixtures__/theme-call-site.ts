/**
 * Attributes a style prop sets only when the call site writes it — the theme
 * value paints the same look and leaves the attribute at the component's own
 * default. Both theme sweeps compare markup with these attributes taken out;
 * the jsdom sweep also requires that they do differ for some value, so an entry
 * whose attribute stops depending on the call site is stale.
 */
export const CALL_SITE_ATTRIBUTES: Record<
  string,
  Record<string, { attribute: string; why: string }>
> = {
  Alert: {
    intent: {
      attribute: 'role',
      why: 'the urgency (`role="alert"` interrupts) follows the instance intent alone'
    }
  }
};

/** `html` without the named attribute, wherever it appears. */
export function withoutAttribute(html: string, attribute: string | undefined): string {
  return attribute ? html.replace(new RegExp(`\\s${attribute}="[^"]*"`, 'g'), '') : html;
}
