// Minimal CBOR decoder for WebAuthn attestation objects.
// Supports: unsigned integers, negative integers, byte strings, text strings,
// arrays, maps, booleans, null, undefined, simple values, floats.
// Does NOT support: tags, indefinite-length items (not used in WebAuthn).

export type CborValue =
  | number
  | bigint
  | string
  | Uint8Array
  | boolean
  | null
  | undefined
  | CborValue[]
  | Map<CborValue, CborValue>;

interface DecodeResult {
  value: CborValue;
  offset: number;
}

export function decodeCbor(data: Uint8Array): CborValue {
  const result = decodeItem(data, 0);
  return result.value;
}

export function decodeCborMultiple(data: Uint8Array): CborValue[] {
  const results: CborValue[] = [];
  let offset = 0;
  while (offset < data.length) {
    const result = decodeItem(data, offset);
    results.push(result.value);
    offset = result.offset;
  }
  return results;
}

function decodeItem(data: Uint8Array, offset: number): DecodeResult {
  if (offset >= data.length) throw new Error('CBOR: unexpected end of data');

  const initial = data[offset];
  const majorType = initial >> 5;
  const additionalInfo = initial & 0x1f;

  switch (majorType) {
    case 0: // Unsigned integer
      return decodeUnsigned(data, offset);
    case 1: // Negative integer
      return decodeNegative(data, offset);
    case 2: // Byte string
      return decodeByteString(data, offset);
    case 3: // Text string
      return decodeTextString(data, offset);
    case 4: // Array
      return decodeArray(data, offset);
    case 5: // Map
      return decodeMap(data, offset);
    case 7: // Simple/float
      return decodeSimpleOrFloat(data, offset, additionalInfo);
    default:
      throw new Error(`CBOR: unsupported major type ${majorType}`);
  }
}

function readArgument(
  data: Uint8Array,
  offset: number
): { value: number | bigint; newOffset: number } {
  const additionalInfo = data[offset] & 0x1f;
  offset++;

  if (additionalInfo < 24) {
    return { value: additionalInfo, newOffset: offset };
  }

  const view = new DataView(data.buffer, data.byteOffset, data.byteLength);

  switch (additionalInfo) {
    case 24:
      return { value: data[offset], newOffset: offset + 1 };
    case 25:
      return { value: view.getUint16(offset, false), newOffset: offset + 2 };
    case 26:
      return { value: view.getUint32(offset, false), newOffset: offset + 4 };
    case 27: {
      const hi = view.getUint32(offset, false);
      const lo = view.getUint32(offset + 4, false);
      if (hi === 0) return { value: lo, newOffset: offset + 8 };
      return { value: BigInt(hi) * BigInt(0x100000000) + BigInt(lo), newOffset: offset + 8 };
    }
    default:
      throw new Error(`CBOR: unsupported additional info ${additionalInfo}`);
  }
}

function decodeUnsigned(data: Uint8Array, offset: number): DecodeResult {
  const { value, newOffset } = readArgument(data, offset);
  return { value: typeof value === 'bigint' ? value : Number(value), offset: newOffset };
}

function decodeNegative(data: Uint8Array, offset: number): DecodeResult {
  const { value, newOffset } = readArgument(data, offset);
  if (typeof value === 'bigint') {
    return { value: -BigInt(1) - value, offset: newOffset };
  }
  return { value: -1 - Number(value), offset: newOffset };
}

// Resolve a CBOR length/count argument to a safe non-negative array index.
// A `bigint` here means the blob declared a length ≥ 2^32 — far beyond any
// WebAuthn structure and a sign of a malformed/hostile payload — so reject it
// rather than risk a precision-losing `Number()` cast driving an allocation or
// loop bound. (Integer *values* may legitimately be bigint; only lengths are
// passed through here.)
function toLength(value: number | bigint): number {
  if (typeof value === 'bigint') {
    throw new Error('CBOR: length exceeds supported range');
  }
  return value;
}

function decodeByteString(data: Uint8Array, offset: number): DecodeResult {
  const { value: length, newOffset } = readArgument(data, offset);
  const len = toLength(length);
  // `Uint8Array.slice` silently returns a SHORT array when the range runs past
  // the buffer, so a forged over-long length would yield truncated bytes that
  // pass as valid. Reject explicitly instead.
  if (newOffset + len > data.length) {
    throw new Error('CBOR: byte string length exceeds available data');
  }
  const bytes = data.slice(newOffset, newOffset + len);
  return { value: bytes, offset: newOffset + len };
}

function decodeTextString(data: Uint8Array, offset: number): DecodeResult {
  const { value: length, newOffset } = readArgument(data, offset);
  const len = toLength(length);
  if (newOffset + len > data.length) {
    throw new Error('CBOR: text string length exceeds available data');
  }
  const bytes = data.slice(newOffset, newOffset + len);
  const text = new TextDecoder().decode(bytes);
  return { value: text, offset: newOffset + len };
}

function decodeArray(data: Uint8Array, offset: number): DecodeResult {
  const { value: count, newOffset } = readArgument(data, offset);
  const len = toLength(count);
  const arr: CborValue[] = [];
  let currentOffset = newOffset;

  for (let i = 0; i < len; i++) {
    const item = decodeItem(data, currentOffset);
    arr.push(item.value);
    currentOffset = item.offset;
  }

  return { value: arr, offset: currentOffset };
}

function decodeMap(data: Uint8Array, offset: number): DecodeResult {
  const { value: count, newOffset } = readArgument(data, offset);
  const len = toLength(count);
  const map = new Map<CborValue, CborValue>();
  let currentOffset = newOffset;

  for (let i = 0; i < len; i++) {
    const key = decodeItem(data, currentOffset);
    const val = decodeItem(data, key.offset);
    map.set(key.value, val.value);
    currentOffset = val.offset;
  }

  return { value: map, offset: currentOffset };
}

function decodeSimpleOrFloat(
  data: Uint8Array,
  offset: number,
  additionalInfo: number
): DecodeResult {
  switch (additionalInfo) {
    case 20:
      return { value: false, offset: offset + 1 };
    case 21:
      return { value: true, offset: offset + 1 };
    case 22:
      return { value: null, offset: offset + 1 };
    case 23:
      return { value: undefined, offset: offset + 1 };
    case 25: {
      // Half-precision float (IEEE 754)
      const view = new DataView(data.buffer, data.byteOffset, data.byteLength);
      const half = view.getUint16(offset + 1, false);
      const value = decodeHalfFloat(half);
      return { value, offset: offset + 3 };
    }
    case 26: {
      const view = new DataView(data.buffer, data.byteOffset, data.byteLength);
      return { value: view.getFloat32(offset + 1, false), offset: offset + 5 };
    }
    case 27: {
      const view = new DataView(data.buffer, data.byteOffset, data.byteLength);
      return { value: view.getFloat64(offset + 1, false), offset: offset + 9 };
    }
    default:
      if (additionalInfo < 24) {
        return { value: additionalInfo, offset: offset + 1 };
      }
      throw new Error(`CBOR: unsupported simple value ${additionalInfo}`);
  }
}

function decodeHalfFloat(half: number): number {
  const sign = (half >> 15) & 1;
  const exp = (half >> 10) & 0x1f;
  const mant = half & 0x3ff;

  if (exp === 0) {
    return (sign ? -1 : 1) * 2 ** -14 * (mant / 1024);
  }
  if (exp === 0x1f) {
    return mant === 0 ? (sign ? -Infinity : Infinity) : NaN;
  }
  return (sign ? -1 : 1) * 2 ** (exp - 15) * (1 + mant / 1024);
}
