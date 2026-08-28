# Green fixture

<!-- typecheck -->
```ts
import { createAuthDeps } from '@urbicon-ui/auth/server';
import { createInMemoryRepos } from '@urbicon-ui/auth/server/adapters/in-memory';
import { createConsoleEmailTransport } from '@urbicon-ui/auth/server/email/console';
import { JWT_SECRET } from '$env/static/private';
import { prisma } from './prisma';

export const authDeps = createAuthDeps({
  config: { jwt: { secret: JWT_SECRET }, appUrl: 'http://localhost:5173' },
  repos: createInMemoryRepos(),
  email: createConsoleEmailTransport()
});
export const db = prisma;
```
