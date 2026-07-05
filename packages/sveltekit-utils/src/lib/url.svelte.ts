import { goto } from '$app/navigation';
import { page } from '$app/state';

export type UrlArrayStrategy = 'repeat' | 'csv';

export type UrlParamOptions<T> = {
  parse: (sp: URLSearchParams) => T | null | undefined;
  serialize: (value: T) => URLSearchParams;
  initial: T;
  replaceState?: boolean;
};

// Local imperative use of URLSearchParams — not reactive state — so the
// SvelteURLSearchParams wrapper is unnecessary here. Likewise for `goto`:
// we pass constructed relative paths, not resolved route ids; callers of
// this helper are free to call `resolve()` at their composition point.
export function updateUrlSearchParams(
  next: URLSearchParams | Record<string, string | string[]>,
  opts?: { replaceState?: boolean; keepPath?: boolean }
) {
  const base = new URLSearchParams(page.url.searchParams);

  if (next instanceof URLSearchParams) {
    for (const [k] of next) base.delete(k);
    for (const [k, v] of next) base.append(k, v);
  } else {
    for (const [key, val] of Object.entries(next)) {
      base.delete(key);
      if (Array.isArray(val)) {
        for (const v of val) base.append(key, v);
      } else if (val != null) {
        base.set(key, String(val));
      }
    }
  }

  const q = base.toString();
  const path = opts?.keepPath ? page.url.pathname : '/';
  goto(q ? `${path}?${q}` : path, {
    replaceState: opts?.replaceState ?? true,
    noScroll: true,
    keepFocus: true
  });
}

// `key` is unused here — `options.parse`/`options.serialize` already close over
// it (see useUrlArrayParam) — but kept for signature parity with useUrlParam.
export function createUrlParam<T>(_key: string, options: UrlParamOptions<T>) {
  const get = (sp: URLSearchParams) => options.parse(sp) ?? options.initial;
  function setValue(next: T) {
    const current = new URLSearchParams(page.url.searchParams);
    const nextSp = options.serialize(next);
    for (const [k] of nextSp) current.delete(k);
    for (const [k, v] of nextSp) current.append(k, v);
    const q = current.toString();
    goto(q ? `?${q}` : '/', {
      replaceState: options.replaceState ?? true,
      noScroll: true,
      keepFocus: true
    });
  }
  return { get, set: setValue } as const;
}

export function useUrlParam<T>(key: string, options: UrlParamOptions<T>) {
  const { get, set } = createUrlParam<T>(key, options);
  const getBound = () => get(page.url.searchParams);
  return [getBound, set] as const;
}

export function useUrlArrayParam(
  key: string,
  opts: {
    initial: string[];
    strategy?: UrlArrayStrategy;
    delimiter?: string;
  }
) {
  const strategy = opts.strategy ?? 'repeat';
  const delimiter = opts.delimiter ?? ',';

  const parse = (sp: URLSearchParams): string[] => {
    if (strategy === 'repeat') return sp.getAll(key);
    const raw = sp.get(key);
    return raw ? raw.split(delimiter).filter(Boolean) : [];
  };

  const serialize = (values: string[]): URLSearchParams => {
    const sp = new URLSearchParams();
    if (strategy === 'repeat') {
      for (const v of values) sp.append(key, v);
    } else {
      if (values.length) sp.set(key, values.join(delimiter));
    }
    return sp;
  };

  return useUrlParam<string[]>(key, { parse, serialize, initial: opts.initial });
}
