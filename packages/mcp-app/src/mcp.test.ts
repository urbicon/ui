/** The shared table: what the host derives is what the server checks. */
import { describe, expect, test } from 'vitest';
import {
  CLIENT_CAPABILITIES_KEY,
  CLIENT_INFO_KEY,
  clientRequest,
  decodeHeaderValue,
  encodeHeaderValue,
  MCP_PROTOCOL_VERSION,
  PROTOCOL_VERSION_KEY,
  requestHeaders,
  UI_EXTENSION
} from './mcp.ts';
import { createDispatcher } from './server/dispatcher.ts';

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

describe('clientRequest', () => {
  const dispatcher = createDispatcher({
    serverInfo: { name: 's', version: '1' },
    tools: () => [{ name: 'größe', inputSchema: { type: 'object' } }],
    call: (name, args) => ({
      result: { content: [{ type: 'text', text: `${name} ${JSON.stringify(args)}` }] }
    })
  });

  test.each([
    ['tools/list', undefined],
    ['tools/call', { name: 'größe', arguments: { n: 1 } }],
    ['server/discover', undefined]
  ] as const)('the dispatcher takes %s as it comes', async (method, params) => {
    const response = await dispatcher.handle(clientRequest('http://s.test/mcp', method, params));
    expect(response.status).toBe(200);
    expect((await response.json()).result.resultType).toBe('complete');
  });

  test('the envelope joins a _meta of params, which keeps its keys; MCP Apps is declared', async () => {
    const request = clientRequest(
      'http://s.test/mcp',
      'tools/list',
      { _meta: { mine: 1 } },
      { id: 'x' }
    );
    const body = await request.json();
    expect(body.id).toBe('x');
    expect(body.params._meta).toEqual({
      mine: 1,
      [PROTOCOL_VERSION_KEY]: MCP_PROTOCOL_VERSION,
      [CLIENT_CAPABILITIES_KEY]: {
        extensions: { [UI_EXTENSION]: { mimeTypes: ['text/html;profile=mcp-app'] } }
      },
      [CLIENT_INFO_KEY]: { name: 'mcp-app-client', version: '1.0.0' }
    });
  });

  test('headers of the caller join the derived ones', () => {
    const request = clientRequest('http://s.test/mcp', 'tools/list', undefined, {
      headers: { authorization: 'Bearer t' }
    });
    expect(request.headers.get('authorization')).toBe('Bearer t');
    expect(request.headers.get('mcp-method')).toBe('tools/list');
  });
});
