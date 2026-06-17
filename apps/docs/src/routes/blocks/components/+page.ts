import { redirect } from '@sveltejs/kit';

// Breadcrumb intermediate level "blocks / components / …" — there is no
// dedicated overview page; the bento overview under /blocks covers both groups.
export const load = () => {
  redirect(308, '/blocks');
};
