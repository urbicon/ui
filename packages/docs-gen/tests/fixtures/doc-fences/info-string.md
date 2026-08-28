# Info string

The language is the first word of the info string; a title after it is still a ts fence.

<!-- typecheck -->
```ts title="src/lib/server/cron.ts"
import { createCronRunner } from '@urbicon-ui/sveltekit-utils/cron';

export const cron = createCronRunner({ secret: 42, jobs: [] });
```
