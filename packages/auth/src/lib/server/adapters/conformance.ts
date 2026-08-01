/**
 * The adapter conformance suite, wired to vitest.
 *
 * This is the entry to import when your tests run under vitest — it registers
 * the runner and re-exports everything from the runner-agnostic core, so
 * nothing about its usage changes.
 *
 * Under a different runner (`bun:test`, jest) import
 * `@urbicon-ui/auth/server/adapters/conformance-core` instead and pass
 * `{ runner: { describe, it, expect } }`; that module imports no runner of its
 * own, so it resolves anywhere.
 */
import { describe, expect, it } from 'vitest';
import { setConformanceRunner } from './conformance-core.js';

setConformanceRunner({ describe, it, expect });

export * from './conformance-core.js';
