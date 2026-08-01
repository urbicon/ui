// Guards the two properties that make `conformance-core` worth having as a
// separate module. Both fail silently otherwise: the vitest suite in
// conformance.test.ts stays green whether or not the core imports a runner,
// and whether or not an injected runner is actually the one asserting.

import { readFile } from 'node:fs/promises';
import { describe, expect, it } from 'vitest';
import {
  type ConformanceRunner,
  describeRepositoryConformance,
  setConformanceRunner
} from './conformance-core.js';
import { createInMemoryRepos } from './in-memory.js';

const ALL_CAPS = {
  refreshToken: true,
  passkey: true,
  notification: true,
  pushSubscription: true,
  notificationPreference: true,
  backupCode: true,
  federatedAccount: true
} as const;

describe('conformance-core', () => {
  it('imports no test runner, so a consumer on bun:test or jest can load it', async () => {
    const source = await readFile(new URL('./conformance-core.ts', import.meta.url), 'utf8');
    // Statements only — the doc comment names `bun:test` in its usage example.
    const runnerImports =
      source.match(
        /^\s*(?:import|export)\b[^\n]*['"](?:vitest|bun:test|jest|node:test)['"]|import\(['"](?:vitest|bun:test|jest|node:test)['"]/gm
      ) ?? [];
    expect(runnerImports, 'the core must resolve without any runner installed').toEqual([]);
  });

  it('registers and asserts through the injected runner, not a bundled one', async () => {
    const registered: { name: string; fn: () => Promise<void> | void }[] = [];
    let expectCalls = 0;
    const fake: ConformanceRunner = {
      describe: (_name, fn) => fn(),
      it: Object.assign(
        (name: string, fn: () => Promise<void> | void) => registered.push({ name, fn }),
        { skip: () => {} }
      ) as ConformanceRunner['it'],
      expect: (actual: unknown, message?: string) => {
        expectCalls++;
        return expect(actual, message);
      }
    };

    try {
      describeRepositoryConformance(
        'injected-runner',
        { role: 'USER', capabilities: ALL_CAPS, setup: () => createInMemoryRepos() },
        { runner: fake }
      );

      expect(registered.length, 'every check registers through the injected it()').toBeGreaterThan(
        0
      );
      await registered[0]?.fn();
      expect(expectCalls, 'assertions run through the injected expect()').toBeGreaterThan(0);
    } finally {
      // The active runner is module-global, so leaving the fake in place would
      // reroute any later check in this process.
      setConformanceRunner({ describe, it, expect });
    }
  });
});
