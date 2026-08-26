// Guards the two properties that make `conformance-core` worth having as a
// separate module. Both fail silently otherwise: the vitest suite in
// conformance.test.ts stays green whether or not the core imports a runner,
// and whether or not an injected runner is actually the one asserting.

import { readFile } from 'node:fs/promises';
import { describe, expect, it } from 'vitest';
import {
  type ConformanceCapabilities,
  type ConformanceCheck,
  type ConformanceRunner,
  conformanceChecks,
  describeRepositoryConformance,
  setConformanceRunner,
  summarizeConformanceRun
} from './conformance-core.js';
import { createInMemoryRepos } from './in-memory.js';

const ALL_CAPS: Required<ConformanceCapabilities> = {
  refreshToken: true,
  passkey: true,
  notification: true,
  pushSubscription: true,
  notificationPreference: true,
  backupCode: true,
  federatedAccount: true
};

describe('conformance-core', () => {
  it('rejects mutation of conformanceChecks, down to a check’s run', () => {
    // Exported, and one array backs every run in the process, so a push into
    // it — or a swapped `run` on an entry — would reach every suite registered
    // afterwards. A shallow freeze stops only the first.
    expect(() =>
      (conformanceChecks as ConformanceCheck[]).push({
        name: 'smuggled',
        requires: [],
        run: async () => {}
      })
    ).toThrow(TypeError);
    expect(conformanceChecks.length).toBeGreaterThan(0);
    expect(() => {
      (conformanceChecks[0] as { run: ConformanceCheck['run'] }).run = async () => {};
    }).toThrow(TypeError);
  });

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

  it('states in the suite title how much of the suite a capability list leaves out', () => {
    // The five capabilities the AUTH.md copy-paste block used to declare. An
    // undeclared repository turns its checks into it.skip, so the run reports
    // success either way — the title is where the omission becomes readable.
    const harness = {
      role: 'USER',
      capabilities: {
        refreshToken: true,
        passkey: true,
        notification: true,
        pushSubscription: true,
        notificationPreference: true
      },
      setup: () => createInMemoryRepos()
    };
    const titles: string[] = [];
    const ran: string[] = [];
    const skipped: string[] = [];
    const fake: ConformanceRunner = {
      describe: (name, fn) => {
        titles.push(name);
        fn();
      },
      it: Object.assign((name: string) => ran.push(name), {
        skip: (name: string) => skipped.push(name)
      }) as unknown as ConformanceRunner['it'],
      expect: (actual: unknown, message?: string) => expect(actual, message)
    };

    try {
      describeRepositoryConformance('partial', harness, { runner: fake });
      const summary = summarizeConformanceRun(harness);

      // Derived from the same plan the registration used, so the printed
      // numbers cannot drift from what actually ran.
      expect(ran, 'the title counts the checks that registered').toHaveLength(summary.running);
      expect(skipped, 'and the ones that did not').toHaveLength(summary.total - summary.running);
      expect(summary.undeclared, 'the two repositories the block omitted').toEqual([
        'backupCode',
        'federatedAccount'
      ]);
      expect(titles[0]).toBe(
        `adapter conformance: partial · ${summary.running}/${summary.total} checks · ` +
          `${summary.skippedUndeclared} skipped — undeclared: backupCode, federatedAccount`
      );
      expect(summary.skippedUndeclared, 'the skipped checks are not zero').toBeGreaterThan(0);
    } finally {
      setConformanceRunner({ describe, it, expect });
    }
  });

  it('separates a deliberate only/skip from an undeclared repository', () => {
    const harness = { role: 'USER', capabilities: ALL_CAPS, setup: () => createInMemoryRepos() };
    const summary = summarizeConformanceRun(harness, {
      skip: ['user.delete removes the user row']
    });
    expect(summary.undeclared, 'nothing is undeclared here').toEqual([]);
    expect(summary.skippedUndeclared).toBe(0);
    expect(summary.skippedByOption, 'the consumer’s own choice is counted apart').toBe(1);
    expect(summary.running).toBe(summary.total - 1);
  });
});
