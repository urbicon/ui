import { redirect } from '@sveltejs/kit';

// Breadcrumb intermediate level "blocks / primitives / …" — there is no
// dedicated overview page; the bento overview under /blocks covers both groups.
export const load = () => {
  redirect(308, '/blocks');
};
