export class WebAuthnError extends Error {
  // Forward ErrorOptions so callers can chain a `cause` — e.g. wrapping a raw
  // DER-parse error while keeping a clean client-facing message. The handler
  // returns only `message`, so the cause never leaks but stays diagnosable.
  constructor(message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = 'WebAuthnError';
  }
}
