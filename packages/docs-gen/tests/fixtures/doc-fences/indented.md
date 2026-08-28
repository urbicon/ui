# Indented fences

1. A fence inside a list item is indented, and its content is read de-indented:
   <!-- typecheck -->
   ```ts
   import { createInMemoryRepos } from '@urbicon-ui/auth/server/adapters/in-memory';
   export const repos = createInMemoryRepos();
   ```
2. The same, with an error on its second line:
   <!-- typecheck -->
   ```typescript
   export const answer = 42;
   export const wrong: number = 'forty-two';
   ```
