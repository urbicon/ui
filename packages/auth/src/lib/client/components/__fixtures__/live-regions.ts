// Test fixture: the live-region shape `FormErrorAlert` renders, in one place.
// Every outcome in this package lands in one of its two persistent regions —
// the assertive `role="alert"` one for errors, the polite `role="status"` one
// for successes and pending content — so which component produced it does not
// change the query. Not part of the published package (package.json `files`
// excludes `__fixtures__`).

/** The persistent assertive region. Present and empty while there is no error. */
export const errorRegion = (scope: ParentNode = document.body): HTMLElement =>
  scope.querySelector('[role="alert"]') as HTMLElement;

/** The persistent polite region. Present and empty while there is nothing to say. */
export const statusRegion = (scope: ParentNode = document.body): HTMLElement =>
  scope.querySelector('[role="status"]') as HTMLElement;

/**
 * The `Alert` root inside the assertive region — the element a component's
 * `error` slot classes land on. The region itself carries none of them.
 */
export const errorMessage = (scope: ParentNode = document.body): HTMLElement =>
  errorRegion(scope).firstElementChild as HTMLElement;

/** The `Alert` root inside the polite region, carrying the `success` slot classes. */
export const successMessage = (scope: ParentNode = document.body): HTMLElement =>
  statusRegion(scope).firstElementChild as HTMLElement;

/**
 * Every live region from `node` up to the document root, `node` itself
 * included. The contract is exactly one: a live region nested inside another is
 * announced twice, or not at all, depending on the reader.
 */
export function liveRegionsAround(node: Element): HTMLElement[] {
  const regions: HTMLElement[] = [];
  for (let el: Element | null = node; el; el = el.parentElement) {
    const role = el.getAttribute('role');
    if (el.hasAttribute('aria-live') || role === 'alert' || role === 'status') {
      regions.push(el as HTMLElement);
    }
  }
  return regions;
}
