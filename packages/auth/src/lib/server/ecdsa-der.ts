// ECDSA signature format conversion — DER (ASN.1) → raw r‖s (IEEE P1363).
//
// The Web Crypto API speaks raw fixed-width r‖s for ECDSA verify/sign, while
// WebAuthn/FIDO2 authenticators and many ASN.1 toolchains emit DER
// (`SEQUENCE { INTEGER r, INTEGER s }`). Passing DER straight to
// `crypto.subtle.verify` makes every check return `false` — this is the
// conversion that bridges the two. Shared by passkey assertion verification
// (`verifyES256`) and VAPID JWT signing (`createVapidJwt`).

/**
 * Convert an ASN.1 DER-encoded ECDSA signature into the raw `r‖s` (IEEE P1363)
 * fixed-width form the Web Crypto API requires for `crypto.subtle.verify`.
 *
 * The passkey path feeds this **attacker-controlled** input, so the parser is
 * strict and bounds-checked end to end: it reads no byte without first proving
 * it is in range, validates every ASN.1 tag and length, rejects long-form
 * lengths (a conformant P-256 signature is always short-form), forbids trailing
 * bytes, and refuses any component that does not fit the curve's field width.
 * On any structural problem it throws — callers translate that into a *failed*
 * (not crashed) verification rather than a 500.
 *
 * For well-formed minimal DER (e.g. the output of `crypto.subtle.sign`) the
 * result is byte-identical to a naive parser, so it is a safe drop-in for the
 * trusted sign-side path too.
 *
 * @param der DER bytes: `0x30 len 0x02 rLen r 0x02 sLen s`.
 * @param componentSize Fixed width of each component in bytes (32 for P-256).
 * @returns `r‖s`, exactly `2 * componentSize` bytes, each component big-endian
 *   and left-padded with zeros.
 * @throws {Error} when `der` is not a structurally valid two-INTEGER DER
 *   sequence, or a component exceeds `componentSize` bytes.
 */
export function derToRawEcdsaSignature(der: Uint8Array, componentSize = 32): Uint8Array {
  let offset = 0;

  const readByte = (): number => {
    if (offset >= der.length) {
      throw new Error('Invalid ECDSA DER signature: unexpected end of input');
    }
    return der[offset++];
  };

  // SEQUENCE header.
  if (readByte() !== 0x30) {
    throw new Error('Invalid ECDSA DER signature: expected SEQUENCE');
  }
  const seqLen = readByte();
  // Every curve WebAuthn uses keeps the SEQUENCE body well under 128 bytes, so
  // the length is always DER short-form. A long-form length (high bit set) is
  // oversized/non-minimal and never produced by a conformant authenticator.
  if (seqLen & 0x80) {
    throw new Error('Invalid ECDSA DER signature: unsupported long-form length');
  }
  // The declared body must consume the rest of the buffer exactly — no bytes
  // appended after the structure, and none missing.
  if (seqLen !== der.length - offset) {
    throw new Error('Invalid ECDSA DER signature: declared length does not match input');
  }

  const readInteger = (): Uint8Array => {
    if (readByte() !== 0x02) {
      throw new Error('Invalid ECDSA DER signature: expected INTEGER');
    }
    const len = readByte();
    // Long-form / zero-length integers are impossible for a 32-byte component.
    if (len === 0 || len & 0x80) {
      throw new Error('Invalid ECDSA DER signature: invalid INTEGER length');
    }
    if (offset + len > der.length) {
      throw new Error('Invalid ECDSA DER signature: INTEGER runs past end of input');
    }
    let value = der.subarray(offset, offset + len);
    offset += len;
    // DER encodes r/s as a signed big-endian integer, so a value whose top bit
    // is set carries a leading 0x00 sign byte. Strip leading zeros (keeping at
    // least one byte) to recover the magnitude.
    let start = 0;
    while (start < value.length - 1 && value[start] === 0x00) start++;
    value = value.subarray(start);
    // A magnitude wider than the field is not a valid P-256 component — reject
    // rather than let it overflow the fixed-width slot below.
    if (value.length > componentSize) {
      throw new Error('Invalid ECDSA DER signature: component exceeds field width');
    }
    return value;
  };

  const r = readInteger();
  const s = readInteger();

  // The seqLen check already forbade trailing bytes, but assert full
  // consumption explicitly so the invariant is local and obvious.
  if (offset !== der.length) {
    throw new Error('Invalid ECDSA DER signature: trailing bytes after signature');
  }

  const raw = new Uint8Array(componentSize * 2);
  raw.set(r, componentSize - r.length);
  raw.set(s, componentSize * 2 - s.length);
  return raw;
}
