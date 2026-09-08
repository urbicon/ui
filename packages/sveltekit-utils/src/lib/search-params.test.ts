/**
 * The pure core, against plain `URL`s — no `$app` alias in play, which is
 * what lets a consumer's `load` function or plain test call it.
 */
import { describe, expect, it } from 'vitest';
import { withSearchParams } from './search-params';

const at = (href: string) => new URL(href, 'https://x.test');

describe('withSearchParams', () => {
  it('sets a scalar: the key is cleared and re-applied behind the untouched params', () => {
    expect(withSearchParams(at('/films?a=1&page=3&b=2'), { page: '4' })).toBe(
      '/films?a=1&b=2&page=4'
    );
  });

  it('appends each element of an array, replacing every prior entry of that key', () => {
    expect(withSearchParams(at('/films?tag=x&q=1'), { tag: ['a', 'b'] })).toBe(
      '/films?q=1&tag=a&tag=b'
    );
  });

  it('removes the key for null and for undefined', () => {
    expect(withSearchParams(at('/films?sort=title&page=3'), { page: null })).toBe(
      '/films?sort=title'
    );
    expect(withSearchParams(at('/films?sort=title&page=3'), { page: undefined })).toBe(
      '/films?sort=title'
    );
  });

  it('preserves every key the patch does not name', () => {
    expect(withSearchParams(at('/users?q=ada&sort=name&dir=desc'), { page: '2' })).toBe(
      '/users?q=ada&sort=name&dir=desc&page=2'
    );
  });

  it('re-appends all entries of a URLSearchParams patch, so repeated keys survive', () => {
    const patch = new URLSearchParams([
      ['tag', 'a'],
      ['tag', 'b']
    ]);
    expect(withSearchParams(at('/films?tag=old&q=1'), patch)).toBe('/films?q=1&tag=a&tag=b');
  });

  it('keeps the key for an empty string and drops it for an empty array', () => {
    expect(withSearchParams(at('/f?a=1'), { a: '' })).toBe('/f?a=');
    expect(withSearchParams(at('/f?a=1'), { a: [] })).toBe('/f');
  });

  it('origin-qualifies a `//` pathname, which relative would name another host', () => {
    const doubled = new URL('http://app.test//films?page=1');
    expect(withSearchParams(doubled, { page: '2' })).toBe('http://app.test//films?page=2');
    expect(withSearchParams(doubled, { page: null })).toBe('http://app.test//films');
    // The bare form is what makes it necessary: it resolves off this host.
    expect(new URL('//films?page=2', 'http://app.test/current').href).toBe('http://films/?page=2');
  });

  it('returns the pathname alone once no param is left', () => {
    expect(withSearchParams(at('/films?page=2'), { page: null })).toBe('/films');
    expect(withSearchParams(at('/films'), {})).toBe('/films');
    expect(withSearchParams(at('/films'), new URLSearchParams())).toBe('/films');
  });

  it('does not carry the hash', () => {
    expect(withSearchParams(at('/films?x=1#top'), { y: '2' })).toBe('/films?x=1&y=2');
  });

  it('mutates neither the url nor the patch', () => {
    const url = at('/films?tag=old');
    const patch = new URLSearchParams([['tag', 'a']]);
    withSearchParams(url, patch);
    expect(url.search).toBe('?tag=old');
    expect(patch.toString()).toBe('tag=a');
  });
});
