import { redirect } from '@sveltejs/kit';

// Legacy slug. `QRCode` used to slugify to `qrcode` because docs-gen's kebab
// rule never split a run of capitals; it now resolves to `qr-code`. Keep the
// shipped URL alive — redirect-only routes carry no `+page.svelte` and so stay
// out of the sitemap glob.
export const load = () => {
  redirect(308, '/blocks/components/qr-code');
};
