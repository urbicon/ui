/**
 * `wireProblem` against the schemas — the oracle is the SDK, so the controls
 * here pin what it says about known-good and known-bad messages, not what
 * this package would like it to say.
 */
import { describe, expect, test } from 'vitest';
import { wireProblem } from './wire.ts';

describe('wireProblem', () => {
  test('positive control: the spec text’s ui/message fails, with Claude’s sentence', () => {
    expect(
      wireProblem({
        jsonrpc: '2.0',
        id: 1,
        method: 'ui/message',
        params: { role: 'user', content: { type: 'text', text: 'x' } }
      })
    ).toBe(
      'Invalid params for ui/message: content: Invalid input: expected array, received object'
    );
  });

  test('the SDK’s form of ui/message passes', () => {
    expect(
      wireProblem({
        jsonrpc: '2.0',
        id: 1,
        method: 'ui/message',
        params: { role: 'user', content: [{ type: 'text', text: 'x' }] }
      })
    ).toBeNull();
  });

  test('requests and notifications by their schemas — ext-apps and SDK', () => {
    expect(wireProblem({ jsonrpc: '2.0', method: 'ui/notifications/initialized' })).toBeNull();
    expect(
      wireProblem({
        jsonrpc: '2.0',
        method: 'ui/notifications/size-changed',
        params: { width: 'wide', height: 1 }
      })
    ).toBe(
      'Invalid params for ui/notifications/size-changed: width: Invalid input: expected number, received string'
    );
    expect(
      wireProblem({ jsonrpc: '2.0', id: 2, method: 'tools/call', params: { name: 'x' } })
    ).toBeNull();
    expect(wireProblem({ jsonrpc: '2.0', id: 2, method: 'tools/call', params: {} })).toMatch(
      /^Invalid params for tools\/call: name: /
    );
  });

  test('a method no schema knows is a finding, not a pass', () => {
    expect(wireProblem({ jsonrpc: '2.0', id: 3, method: 'ui/made-up' })).toBe(
      'no schema knows the request ui/made-up'
    );
    expect(wireProblem({ jsonrpc: '2.0', method: 'ui/notifications/made-up' })).toBe(
      'no schema knows the notification ui/notifications/made-up'
    );
  });

  test('the envelope is checked before the params', () => {
    expect(wireProblem({ jsonrpc: '1.0', id: 4, method: 'ping' })).toMatch(/^ping: jsonrpc: /);
    expect(wireProblem('ping')).toBe('not a JSON-RPC message');
    expect(wireProblem(null)).toBe('not a JSON-RPC message');
  });

  test('an answer is checked against the result of the request it answers', () => {
    expect(wireProblem({ jsonrpc: '2.0', id: 5, result: {} }, 'ping')).toBeNull();
    expect(
      wireProblem({ jsonrpc: '2.0', id: 5, result: {} }, 'ui/update-model-context')
    ).toBeNull();
    expect(wireProblem({ jsonrpc: '2.0', id: 5, result: {} })).toBe('response without a request');
    expect(wireProblem({ jsonrpc: '2.0', id: 5, result: {} }, 'ui/made-up')).toBe(
      'no schema knows the result of ui/made-up'
    );
    expect(
      wireProblem({ jsonrpc: '2.0', id: 6, result: { contents: 'html' } }, 'resources/read')
    ).toMatch(/^Invalid result for resources\/read: contents: /);
  });

  test('an error answer by the error envelope', () => {
    expect(
      wireProblem({ jsonrpc: '2.0', id: 7, error: { code: -32601, message: 'no' } })
    ).toBeNull();
    expect(wireProblem({ jsonrpc: '2.0', id: 7, error: { code: 'x', message: 'no' } })).toMatch(
      /^Error response: error\.code: /
    );
  });
});
