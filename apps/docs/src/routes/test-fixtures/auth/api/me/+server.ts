import { createMeHandler } from '@urbicon-ui/auth/server';
import { testAuthDeps } from '$lib/server/test-auth.js';

export const { GET } = createMeHandler(testAuthDeps);
