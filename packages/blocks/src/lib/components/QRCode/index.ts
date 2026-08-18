import type { QRCodeSlots, QRCodeVariants } from './qr-code.variants';

/**
 * @summary Any text or link as a code a phone can read.
 * @description Renders any text or URL as a scannable QR code. The output is a
 * self-contained SVG with no runtime dependency: the encoder (`encodeQr`,
 * exported alongside) covers numeric, alphanumeric and byte modes across all 40
 * versions and the four error-correction levels. Pass an `otpauth://` URI here
 * for 2FA enrolment instead of wiring an external QR library into
 * `TwoFactorManager`'s `qr` snippet.
 *
 * @tag display
 * @related PinInput
 *
 * @example
 * ```svelte
 * <QRCode value="https://ui.urbicon.de" size={180} frame="card" />
 * ```
 *
 * @example Encoding a 2FA otpauth URI with high error correction
 * ```svelte
 * <QRCode value={otpauthUri} errorCorrection="H" size={200} frame="card" />
 * ```
 */
export interface QRCodeProps extends QRCodeVariants {
  /** The data to encode — text, a URL, an `otpauth://` URI, etc. */
  value: string;
  /**
   * Error-correction level: higher levels survive more damage/occlusion at the
   * cost of a denser (larger) code. L≈7%, M≈15%, Q≈25%, H≈30%. @default 'M'
   * @summary How much damage the code survives — higher levels cost density.
   */
  errorCorrection?: 'L' | 'M' | 'Q' | 'H';
  /** Rendered edge length in pixels (the code is square). @default 160 */
  size?: number;
  /** Width of the mandatory light border, in modules. The spec requires ≥4. @default 4 */
  quietZone?: number;
  /**
   * Colour of the dark modules — any CSS colour. Defaults to `currentColor` so
   * the code inherits the surrounding text colour. For reliable scanning keep a
   * high-contrast dark-on-light pairing (see `frame="card"`).
   * @default 'currentColor'
   */
  foreground?: string;
  /** Background fill — any CSS colour. @default 'transparent' */
  background?: string;
  /** Lower bound on the QR version (1–40) to force a minimum size. */
  minVersion?: number;
  /** Upper bound on the QR version (1–40). Data that does not fit calls `onError` and renders the fallback instead of encoding. */
  maxVersion?: number;

  /** Called when the data cannot be encoded (e.g. too long for `maxVersion`). */
  onError?: (error: Error) => void;

  /** Extra classes merged onto the root wrapper. */
  class?: string;
  /** Remove all default tv() classes — only user-provided classes apply. */
  unstyled?: boolean;
  /**
   * Per-slot class overrides merged with tv() styles. Slots: root (what `class`
   * also targets) | svg | fallback.
   */
  slotClasses?: Partial<Record<QRCodeSlots, string>>;
  /** Apply a named preset registered via `<BlocksProvider presets={{ QRCode: {...} }}>`. */
  preset?: string;

  /**
   * Accessible name announced for the code. Defaults to a localized "QR code".
   * Avoid echoing sensitive payloads (e.g. a 2FA secret) into this label.
   */
  'aria-label'?: string;
  /** Root id. */
  id?: string;
}

export { default as QRCode } from './QRCode.svelte';
export { type QRCodeVariants, qrCodeVariants } from './qr-code.variants';
export { encodeQr, type QrEcl } from './qr-encode';
