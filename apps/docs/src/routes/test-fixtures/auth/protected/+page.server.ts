import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types.js';

export const load: PageServerLoad = async ({ locals }) => {
  const user = (locals as Record<string, unknown>).user;
  if (!user) {
    throw redirect(302, '/test-fixtures/auth/login');
  }
  return { user: user as { email: string; name: string } };
};
