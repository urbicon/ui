/**
 * Attributes a style prop sets only when the call site writes it: the theme
 * value paints the same look and leaves the attribute at what the component
 * renders with no value at all. Alert's `intent` is the one today — a theme
 * colours an alert, but `role="alert"` interrupts a screen reader, so only the
 * instance decides it.
 *
 * Both theme sweeps compare markup with the attribute taken out. The jsdom
 * sweep also asserts the half that makes the exception safe — the theme mount
 * carries the attribute exactly as the plain mount does, for every value — and
 * fails an entry whose attribute no longer differs from the call site's.
 *
 * Only the first element carrying the attribute is touched, which is the
 * component's root for Alert. Stripped page-wide, a role any descendant sets
 * would drop out of the comparison as well.
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

const pattern = (attribute: string) => new RegExp(`\\s${attribute}="([^"]*)"`);

/** `html` without the first occurrence of the attribute. */
export function withoutAttribute(html: string, attribute: string | undefined): string {
  return attribute ? html.replace(pattern(attribute), '') : html;
}

/** The value of the attribute's first occurrence in `html`, or `null`. */
export function firstAttribute(html: string, attribute: string): string | null {
  return html.match(pattern(attribute))?.[1] ?? null;
}
