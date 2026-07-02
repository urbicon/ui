/**
 * base64url ↔ ArrayBuffer codecs for the browser WebAuthn API: challenges and
 * credential ids arrive base64url-encoded from the server and must become
 * ArrayBuffers for `navigator.credentials`, and the credential payloads go
 * back the other way. One copy — LoginPage and PasskeyManager each carried a
 * verbatim clone (review R14).
 */

/** base64url (padded or not) → ArrayBuffer. */
export function base64UrlToBuffer(b64url: string): ArrayBuffer {
  const padding = '='.repeat((4 - (b64url.length % 4)) % 4);
  const base64 = (b64url + padding).replace(/-/g, '+').replace(/_/g, '/');
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes.buffer as ArrayBuffer;
}

/** ArrayBuffer → unpadded base64url. */
export function bufferToBase64Url(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
