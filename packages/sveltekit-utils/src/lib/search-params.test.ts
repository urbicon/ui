/**
 * The pure core, against plain `URL`s — no `$app` alias in play, which is
 * what lets a consumer's `load` function or plain test call it.
 */
import { describe, expect, it } from 'vitest';
import { withSearchParams } from './search-params';

const at = (href: string) => new URL(href, 'https://x.test');

describe('withSearchParams', () => {
  it('sets a scalar in the slot of the key it replaces', () => {
    expect(withSearchParams(at('/films?a=1&page=3&b=2'), { page: '4' })).toBe(
      '/films?a=1&page=4&b=2'
    );
  });

  it('collapses repeated entries of a scalar-patched key into its first slot', () => {
    expect(withSearchParams(at('/films?tag=x&q=1&tag=y'), { tag: 'z' })).toBe('/films?tag=z&q=1');
  });

  it('puts the elements of an array in the slot of the key’s first occurrence', () => {
    expect(withSearchParams(at('/films?tag=x&q=1&tag=y'), { tag: ['a', 'b'] })).toBe(
      '/films?tag=a&tag=b&q=1'
    );
  });

  it('puts a key the url does not have yet at the end, in patch order', () => {
    expect(withSearchParams(at('/films?q=1'), { tag: ['a', 'b'], page: '2' })).toBe(
      '/films?q=1&tag=a&tag=b&page=2'
    );
  });

  it('returns the original address after changing a value and changing it back', () => {
    const original = '/films?sort=title&page=3&q=noir';
    const changed = withSearchParams(at(original), { sort: 'year' });
    expect(changed).toBe('/films?sort=year&page=3&q=noir');
    expect(withSearchParams(at(changed), { sort: 'title' })).toBe(original);
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

  it('puts all entries of a URLSearchParams patch in the key’s slot, so repeated keys survive', () => {
    const patch = new URLSearchParams([
      ['tag', 'a'],
      ['new', '1'],
      ['tag', 'b']
    ]);
    expect(withSearchParams(at('/films?tag=old&q=1'), patch)).toBe('/films?tag=a&tag=b&q=1&new=1');
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
