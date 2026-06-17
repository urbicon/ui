export interface ValidationError {
  field: string;
  message: string;
}

// Discriminated union: narrowing on `success` makes `data` / `errors` present
// without a non-null assertion at the call site (`if (!input.success) … input.errors`
// then `input.data`). The `?: undefined` members keep the off-branch field
// inaccessible so a handler can't read `errors` on a success result.
export type ValidationResult<T> =
  | { success: true; data: T; errors?: undefined }
  | { success: false; data?: undefined; errors: ValidationError[] };

// Upper bounds keep unbounded attacker input out of expensive crypto (PBKDF2
// runs over the password on every login/reset) and storage. Generous enough
// not to reject real passphrases or addresses.
const MAX_EMAIL_LENGTH = 254; // RFC 5321 practical maximum
const MAX_NAME_LENGTH = 256;
const MAX_PASSWORD_LENGTH = 256; // ample for passphrases; bounds PBKDF2 cost per request
const MAX_TOKEN_LENGTH = 512;
// A TOTP code is 6 digits; a backup code is ~16 Base32 chars with separators.
// 64 is generous for both while keeping unbounded input out of the verify path.
const MAX_2FA_CODE_LENGTH = 64;

/**
 * Read and JSON-parse a request body without ever throwing. A malformed or
 * non-JSON body (wrong `Content-Type`, truncated payload, empty body, …) makes
 * `request.json()` throw a `SyntaxError`; left unhandled that surfaces as a 500
 * (and, depending on the adapter, a stack leak). Returning `{}` instead lets
 * the field validators below produce a clean, structured 400 — an attacker
 * can't turn a bad body into a server error. Mirrors the pattern the passkey
 * handlers already use inline.
 */
export async function readJsonBody(request: { json(): Promise<unknown> }): Promise<unknown> {
  try {
    return await request.json();
  } catch {
    return {};
  }
}

function isString(v: unknown): v is string {
  return typeof v === 'string';
}

function isNonEmpty(v: unknown): v is string {
  return isString(v) && v.trim().length > 0;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function isEmail(v: unknown): v is string {
  return isString(v) && v.length <= MAX_EMAIL_LENGTH && EMAIL_RE.test(v);
}

/** Build a "too long" validation error for a field, or null when within bounds. */
function tooLong(v: unknown, max: number, field: string): ValidationError | null {
  return isString(v) && v.length > max
    ? {
        field,
        message: `${field[0].toUpperCase()}${field.slice(1)} must be at most ${max} characters.`
      }
    : null;
}

export function validateLoginInput(
  body: unknown
): ValidationResult<{ email: string; password: string }> {
  const errors: ValidationError[] = [];
  const obj = body as Record<string, unknown>;

  if (!isEmail(obj?.email)) errors.push({ field: 'email', message: 'Valid email is required.' });
  if (!isNonEmpty(obj?.password))
    errors.push({ field: 'password', message: 'Password is required.' });
  // Reject an oversized password BEFORE the handler runs PBKDF2 over it.
  const pwLen = tooLong(obj?.password, MAX_PASSWORD_LENGTH, 'password');
  if (pwLen) errors.push(pwLen);

  if (errors.length > 0) return { success: false, errors };
  return {
    success: true,
    data: { email: (obj.email as string).trim().toLowerCase(), password: obj.password as string }
  };
}

export function validateRegisterInput(
  body: unknown
): ValidationResult<{ email: string; name: string; password: string }> {
  const errors: ValidationError[] = [];
  const obj = body as Record<string, unknown>;

  if (!isEmail(obj?.email)) errors.push({ field: 'email', message: 'Valid email is required.' });
  if (!isNonEmpty(obj?.name)) errors.push({ field: 'name', message: 'Name is required.' });
  if (!isNonEmpty(obj?.password))
    errors.push({ field: 'password', message: 'Password is required.' });
  const nameLen = tooLong(obj?.name, MAX_NAME_LENGTH, 'name');
  if (nameLen) errors.push(nameLen);
  const pwLen = tooLong(obj?.password, MAX_PASSWORD_LENGTH, 'password');
  if (pwLen) errors.push(pwLen);

  if (errors.length > 0) return { success: false, errors };
  return {
    success: true,
    data: {
      email: (obj.email as string).trim().toLowerCase(),
      name: (obj.name as string).trim(),
      password: obj.password as string
    }
  };
}

export function validateEmailInput(body: unknown): ValidationResult<{ email: string }> {
  const obj = body as Record<string, unknown>;
  if (!isEmail(obj?.email))
    return { success: false, errors: [{ field: 'email', message: 'Valid email is required.' }] };
  return { success: true, data: { email: (obj.email as string).trim().toLowerCase() } };
}

export function validateTokenInput(body: unknown): ValidationResult<{ token: string }> {
  const obj = body as Record<string, unknown>;
  if (!isNonEmpty(obj?.token))
    return { success: false, errors: [{ field: 'token', message: 'Token is required.' }] };
  const tokenLen = tooLong(obj?.token, MAX_TOKEN_LENGTH, 'token');
  if (tokenLen) return { success: false, errors: [tokenLen] };
  return { success: true, data: { token: obj.token as string } };
}

export function validateResetPasswordInput(
  body: unknown
): ValidationResult<{ token: string; password: string }> {
  const errors: ValidationError[] = [];
  const obj = body as Record<string, unknown>;

  if (!isNonEmpty(obj?.token)) errors.push({ field: 'token', message: 'Token is required.' });
  if (!isNonEmpty(obj?.password))
    errors.push({ field: 'password', message: 'Password is required.' });
  const tokenLen = tooLong(obj?.token, MAX_TOKEN_LENGTH, 'token');
  if (tokenLen) errors.push(tokenLen);
  const pwLen = tooLong(obj?.password, MAX_PASSWORD_LENGTH, 'password');
  if (pwLen) errors.push(pwLen);

  if (errors.length > 0) return { success: false, errors };
  return { success: true, data: { token: obj.token as string, password: obj.password as string } };
}

export function validateChangePasswordInput(
  body: unknown
): ValidationResult<{ currentPassword: string; newPassword: string }> {
  const errors: ValidationError[] = [];
  const obj = body as Record<string, unknown>;

  if (!isNonEmpty(obj?.currentPassword))
    errors.push({ field: 'currentPassword', message: 'Current password is required.' });
  if (!isNonEmpty(obj?.newPassword))
    errors.push({ field: 'newPassword', message: 'New password is required.' });
  // Bound both before the handler runs PBKDF2 over them (re-auth verify + the
  // new-hash derivation).
  const curLen = tooLong(obj?.currentPassword, MAX_PASSWORD_LENGTH, 'currentPassword');
  if (curLen) errors.push(curLen);
  const newLen = tooLong(obj?.newPassword, MAX_PASSWORD_LENGTH, 'newPassword');
  if (newLen) errors.push(newLen);

  if (errors.length > 0) return { success: false, errors };
  return {
    success: true,
    data: {
      currentPassword: obj.currentPassword as string,
      newPassword: obj.newPassword as string
    }
  };
}

export function validateChangeEmailInput(
  body: unknown
): ValidationResult<{ newEmail: string; currentPassword: string }> {
  const errors: ValidationError[] = [];
  const obj = body as Record<string, unknown>;

  if (!isEmail(obj?.newEmail))
    errors.push({ field: 'newEmail', message: 'A valid new email is required.' });
  if (!isNonEmpty(obj?.currentPassword))
    errors.push({ field: 'currentPassword', message: 'Current password is required.' });
  const curLen = tooLong(obj?.currentPassword, MAX_PASSWORD_LENGTH, 'currentPassword');
  if (curLen) errors.push(curLen);

  if (errors.length > 0) return { success: false, errors };
  return {
    success: true,
    data: {
      newEmail: (obj.newEmail as string).trim().toLowerCase(),
      currentPassword: obj.currentPassword as string
    }
  };
}

export function validateUpdateProfileInput(body: unknown): ValidationResult<{ name: string }> {
  const obj = body as Record<string, unknown>;
  if (!isNonEmpty(obj?.name))
    return { success: false, errors: [{ field: 'name', message: 'Name is required.' }] };
  const nameLen = tooLong(obj?.name, MAX_NAME_LENGTH, 'name');
  if (nameLen) return { success: false, errors: [nameLen] };
  return { success: true, data: { name: (obj.name as string).trim() } };
}

export function validateDeleteAccountInput(
  body: unknown
): ValidationResult<{ currentPassword: string }> {
  const obj = body as Record<string, unknown>;
  if (!isNonEmpty(obj?.currentPassword))
    return {
      success: false,
      errors: [{ field: 'currentPassword', message: 'Current password is required.' }]
    };
  const curLen = tooLong(obj?.currentPassword, MAX_PASSWORD_LENGTH, 'currentPassword');
  if (curLen) return { success: false, errors: [curLen] };
  return { success: true, data: { currentPassword: obj.currentPassword as string } };
}

/**
 * Validate a 2FA code submission (the `enable` and `verify` steps). The field is
 * a non-empty, length-bounded string — it may be a 6-digit TOTP code **or** a
 * formatted backup code, so the strict "6 digits" shape is intentionally NOT
 * enforced here; `verifyTotp` rejects a non-numeric/short TOTP and the backup
 * path hashes whatever is left. The bound just keeps unbounded input out of the
 * verify path.
 */
export function validateTotpInput(body: unknown): ValidationResult<{ code: string }> {
  const obj = body as Record<string, unknown>;
  if (!isNonEmpty(obj?.code))
    return { success: false, errors: [{ field: 'code', message: 'A code is required.' }] };
  const codeLen = tooLong(obj?.code, MAX_2FA_CODE_LENGTH, 'code');
  if (codeLen) return { success: false, errors: [codeLen] };
  return { success: true, data: { code: (obj.code as string).trim() } };
}

/**
 * Validate the disable-2FA submission. Re-auth is by current password (the
 * shared `verifyCurrentPassword` building block) — same shape as
 * delete-account — so turning the second factor off requires a fresh credential
 * confirmation, not just a live session.
 */
export function validateDisable2faInput(
  body: unknown
): ValidationResult<{ currentPassword: string }> {
  const obj = body as Record<string, unknown>;
  if (!isNonEmpty(obj?.currentPassword))
    return {
      success: false,
      errors: [{ field: 'currentPassword', message: 'Current password is required.' }]
    };
  const curLen = tooLong(obj?.currentPassword, MAX_PASSWORD_LENGTH, 'currentPassword');
  if (curLen) return { success: false, errors: [curLen] };
  return { success: true, data: { currentPassword: obj.currentPassword as string } };
}

export function validateInvitationInput(
  body: unknown,
  allowedRoles: readonly string[]
): ValidationResult<{ email: string; role: string; sendEmail: boolean }> {
  const errors: ValidationError[] = [];
  const obj = body as Record<string, unknown>;
  const role = obj?.role;

  if (!isEmail(obj?.email)) errors.push({ field: 'email', message: 'Valid email is required.' });
  // Validate the role against the caller-supplied allow-list, not just "is a
  // string": without it a crafted request could assign a higher-privileged
  // role than the UI offers (privilege escalation).
  if (!isString(role) || !allowedRoles.includes(role))
    errors.push({ field: 'role', message: 'A valid role is required.' });

  if (errors.length > 0) return { success: false, errors };
  return {
    success: true,
    data: {
      email: (obj.email as string).trim().toLowerCase(),
      role: role as string,
      sendEmail: obj.sendEmail === true
    }
  };
}
