/** The shared table: what the host derives is what the server checks. */
import { describe, expect, test } from 'vitest';
import {
  decodeHeaderValue,
  encodeHeaderValue,
  MCP_PROTOCOL_VERSION,
  requestHeaders
} from './mcp.ts';

describe('header values', () => {
  test.each(['show_note', 'ui://notes/note/0123456789ab', 'a b'])(
    '%s travels as it is',
    (value) => {
      expect(encodeHeaderValue(value)).toBe(value);
      expect(decodeHeaderValue(value)).toBe(value);
    }
  );

  test.each(['größe', ' leading', 'trailing ', 'tab\there', 'line\nbreak', '名前', ''])(
    '%j travels as sentinel and comes back',
    (value) => {
      const encoded = encodeHeaderValue(value);
      expect(encoded).toMatch(/^=\?base64\?[A-Za-z0-9+/]*={0,2}\?=$/);
      expect(decodeHeaderValue(encoded)).toBe(value);
    }
  );

  test('whitespace around a value is not part of it', () => {
    expect(decodeHeaderValue('  tools/call \t')).toBe('tools/call');
  });

  test('a sentinel that is no base64 or no UTF-8 says nothing', () => {
    expect(decodeHeaderValue('=?base64?!!!?=')).toBeUndefined();
    expect(decodeHeaderValue(`=?base64?${btoa('\xff')}?=`)).toBeUndefined();
  });
});

describe('requestHeaders', () => {
  test('the version and the method always, the name where the method has one', () => {
    expect(requestHeaders('tools/list', {})).toEqual({
      'mcp-protocol-version': MCP_PROTOCOL_VERSION,
      'mcp-method': 'tools/list'
    });
    expect(requestHeaders('tools/call', { name: 'größe' })['mcp-name']).toBe(
      encodeHeaderValue('größe')
    );
    expect(requestHeaders('resources/read', { uri: 'ui://a/b' })['mcp-name']).toBe('ui://a/b');
    expect(requestHeaders('prompts/get', { name: 'p' })['mcp-name']).toBe('p');
  });

  test('no name header where the body has no string to mirror', () => {
    expect('mcp-name' in requestHeaders('tools/call', {})).toBe(false);
    expect('mcp-name' in requestHeaders('tools/call', { name: 5 })).toBe(false);
    expect('mcp-name' in requestHeaders('tools/call', undefined)).toBe(false);
  });
});
