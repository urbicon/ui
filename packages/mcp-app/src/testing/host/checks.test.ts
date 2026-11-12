import { describe, expect, it } from 'vitest';
import { refusedUrls } from './checks.ts';

/** Chromium's console line for a blocked image, as the test host records it. */
const refusal = (url: string): string =>
  `[error] Loading the image '${url}' violates the following Content Security Policy directive: "img-src 'self' data: http://127.0.0.1:56562". The action has been blocked.`;

describe('refusedUrls', () => {
  it('reads the URL a refusal names, not the origins of the policy it quotes', () => {
    expect(refusedUrls(refusal('https://example.com/probe.png')).map(String)).toEqual([
      'https://example.com/probe.png'
    ]);
  });

  it('knows a host by its name, not by where the name stands in the URL', () => {
    expect(
      refusedUrls(refusal('https://evil.test/?example.com')).map((url) => url.hostname)
    ).toEqual(['evil.test']);
  });

  it('reads nothing from a line that refuses nothing', () => {
    expect(refusedUrls("[log] the view loaded 'https://example.com/probe.png' itself")).toEqual([]);
  });
});
