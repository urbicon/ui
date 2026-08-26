# Red fixture

Every marked fence below is wrong in a way `tsc` sees; the unmarked one is
wrong too and must stay invisible.

<!-- typecheck -->
```ts
import type { RefreshTokenRepository } from '@urbicon-ui/auth/server';

export const repo: RefreshTokenRepository = {
  async create() {
    throw new Error('one of nine');
  }
};
```

A `$env/static/private` import of `env` — the module has no such export.

<!-- typecheck -->
```ts
import { env } from '$env/static/private';

export const appUrl = env.PUBLIC_APP_URL;
```

A config key that does not exist.

<!-- typecheck -->
```typescript
import { createAuthDeps } from '@urbicon-ui/auth/server';
import { createInMemoryRepos } from '@urbicon-ui/auth/server/adapters/in-memory';
import { createConsoleEmailTransport } from '@urbicon-ui/auth/server/email/console';

export const authDeps = createAuthDeps({
  config: {
    jwt: { secret: 'dev-secret' },
    appUrl: 'http://localhost:5173',
    lockout: { maxAttempts: 5, durationMs: 15 }
  },
  repos: createInMemoryRepos(),
  email: createConsoleEmailTransport()
});
```

Unmarked, so not compiled:

```ts
const unchecked: number = 'a string';
```
