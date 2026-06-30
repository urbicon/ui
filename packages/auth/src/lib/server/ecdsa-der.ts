// ECDSA signature format conversion — DER (ASN.1) → raw r‖s (IEEE P1363).
//
// The Web Crypto API speaks raw fixed-width r‖s for ECDSA verify, while
// WebAuthn/FIDO2 authenticators emit DER (`SEQUENCE { INTEGER r, INTEGER s }`).
// Passing DER straight to `crypto.subtle.verify` makes every check return
// `false` — this is the conversion that bridges the two. Used by passkey
// assertion verification (`verifyES256`).
//
// Scoped to P-256 (ES256), the only ECDSA curve this package verifies: each
// component is 32 bytes and a conformant signature is always DER short-form.

/** Field width of a single P-256 (ES256) signature component, in bytes. */
const P256_COMPONENT_BYTES = 32;

/**
 * Convert an ASN.1 DER-encoded P-256 ECDSA signature into the raw `r‖s`
 * (IEEE P1363) fixed-width form the Web Crypto API requires for
 * `crypto.subtle.verify`: 64 bytes, each component big-endian and left-padded
 * with zeros.
 *
 * The passkey path feeds this **attacker-controlled** input, so the parser is
 * strict and bounds-checked end to end: it reads no byte without first proving
 * it is in range, validates every ASN.1 tag and length, rejects long-form
 * lengths (a conformant P-256 signature is always short-form), forbids trailing
 * bytes, and refuses any component wider than the 32-byte field. On any
 * structural problem it throws — callers translate that into a *failed* (not
 * crashed) verification rather than a 500.
 *
 * Leading-zero handling is deliberately lenient: it strips DER sign/padding
 * bytes to recover each component's magnitude, so a non-minimal encoding still
 * maps to the correct (r, s). For well-formed *minimal* DER (e.g. the output of
 * `crypto.subtle.sign`) the result is byte-identical to a naive parser.
 *
 * @param der DER bytes: `0x30 len 0x02 rLen r 0x02 sLen s`.
 * @returns `r‖s`, exactly 64 bytes.
 * @throws {Error} when `der` is not a structurally valid two-INTEGER DER
 *   sequence, or a component exceeds the 32-byte field width.
 */
export function derToRawEcdsaSignature(der: Uint8Array): Uint8Array {
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
  // A P-256 signature's SEQUENCE body is at most ~70 bytes, so its length is
  // always DER short-form. A long-form length (high bit set) is oversized /
  // non-minimal and never produced by a conformant authenticator.
  if (seqLen & 0x80) {
    throw new Error('Invalid ECDSA DER signature: unsupported long-form length');
  }
  // The declared body must consume the rest of the buffer exactly — this
  // rejects both a truncated buffer and bytes appended after the structure.
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
    if (value.length > P256_COMPONENT_BYTES) {
      throw new Error('Invalid ECDSA DER signature: component exceeds field width');
    }
    return value;
  };

  const r = readInteger();
  const s = readInteger();

  // r and s are bounded by seqLen, but a SEQUENCE whose declared length is
  // consumed by a *third* element (or stray bytes) after s still passes the
  // seqLen check above — this full-consumption assert is what rejects it.
  if (offset !== der.length) {
    throw new Error('Invalid ECDSA DER signature: trailing bytes after signature');
  }

  const raw = new Uint8Array(P256_COMPONENT_BYTES * 2);
  raw.set(r, P256_COMPONENT_BYTES - r.length);
  raw.set(s, P256_COMPONENT_BYTES * 2 - s.length);
  return raw;
}
