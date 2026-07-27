import { error } from '@sveltejs/kit';
import { getSession } from '$lib/server/registry';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = ({ params }) => {
  const session = getSession(params.id);
  if (!session) error(404, `Keine Sitzung ${params.id}`);
  return { session: session.state };
};
