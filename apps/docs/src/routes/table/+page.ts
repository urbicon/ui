import { redirect } from '@sveltejs/kit';
import { resolve } from '$app/paths';

// Every other package answers at its own root (/blocks, /auth, /i18n, /docs);
// the Table's overview is its component page, so /table forwards there instead
// of answering 404.
export function load(): never {
  redirect(308, resolve('/table/table'));
}
