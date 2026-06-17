import { createLoginHandler } from '@urbicon-ui/auth/server';
import { testAuthDeps } from '$lib/server/test-auth.js';

export const { POST } = createLoginHandler(testAuthDeps);
