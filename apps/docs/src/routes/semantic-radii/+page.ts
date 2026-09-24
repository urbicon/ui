import { redirect } from '@sveltejs/kit';
import { resolve } from '$app/paths';

// The former internal tier-radius design study fully duplicated the published
// tier-system deep dive. Permanent redirect keeps any stray links working.
export function load(): never {
  redirect(308, resolve('/customization/tier-system'));
}
