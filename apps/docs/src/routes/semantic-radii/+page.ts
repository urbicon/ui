import { redirect } from '@sveltejs/kit';
import { resolve } from '$app/paths';

// The former internal tier-radius design study fully duplicated the published
// tier-system deep dive (launch triage: DISABLE). Permanent redirect keeps any
// stray links working. See docs/internal/DOCS-PAGE-TRIAGE-2026-07.md.
export function load(): never {
  redirect(308, resolve('/customization/tier-system'));
}
