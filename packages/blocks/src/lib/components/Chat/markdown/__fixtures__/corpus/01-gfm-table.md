# Comparing HTTP caching headers

Here is a quick reference for the three response headers you will reach for most
often. The **alignment** below is deliberate — numeric-ish columns are centered,
the directive column is left-aligned, and the "max age" column is right-aligned.

| Header          | Directive        |  Max age |
| :-------------- | :--------------: | -------: |
| Cache-Control   | `public`         |    3600s |
| Cache-Control   | `no-store`       |       0s |
| ETag            | *validator*      |      n/a |
| Expires         | absolute date    |  ~1 week |

A few things worth calling out:

- `Cache-Control` always wins over `Expires` when both are present.
- `no-store` is stronger than `no-cache`; the latter still lets a cache keep a
  copy, it just forces revalidation.
- An `ETag` pairs with `If-None-Match` for cheap `304 Not Modified` responses.

If you only remember one rule: set `Cache-Control: public, max-age=31536000,
immutable` on fingerprinted assets and you will rarely go wrong.
