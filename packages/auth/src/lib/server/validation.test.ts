import { describe, expect, it } from 'vitest';
import {
  validateChangeEmailInput,
  validateChangePasswordInput,
  validateDeleteAccountInput,
  validateDisable2faInput,
  validateEmailInput,
  validateLoginInput,
  validateRegisterInput,
  validateResetPasswordInput,
  validateTokenInput,
  validateTotpInput,
  validateUpdateProfileInput
} from './validation.js';

describe('validateLoginInput', () => {
  it('should accept valid input', () => {
    const result = validateLoginInput({ email: 'test@test.com', password: 'secret' });
    expect(result.success).toBe(true);
    expect(result.data).toEqual({ email: 'test@test.com', password: 'secret' });
  });

  it('should normalize email to lowercase', () => {
    const result = validateLoginInput({ email: 'Test@Test.COM', password: 'x' });
    expect(result.data?.email).toBe('test@test.com');
  });

  it('should reject missing email', () => {
    const result = validateLoginInput({ password: 'secret' });
    expect(result.success).toBe(false);
    expect(result.errors?.[0].field).toBe('email');
  });

  it('should reject invalid email', () => {
    const result = validateLoginInput({ email: 'not-an-email', password: 'x' });
    expect(result.success).toBe(false);
  });

  it('should reject empty password', () => {
    const result = validateLoginInput({ email: 'a@b.c', password: '' });
    expect(result.success).toBe(false);
    expect(result.errors?.[0].field).toBe('password');
  });

  it('should reject null body', () => {
    const result = validateLoginInput(null);
    expect(result.success).toBe(false);
  });
});

describe('validateRegisterInput', () => {
  it('should accept valid input', () => {
    const result = validateRegisterInput({
      email: 'a@b.c',
      name: 'Test',
      password: 'pw',
      token: 'invite-token'
    });
    expect(result.success).toBe(true);
  });

  it('should collect multiple errors', () => {
    const result = validateRegisterInput({});
    expect(result.success).toBe(false);
    expect(result.errors?.length).toBe(4);
  });

  it('should trim name', () => {
    const result = validateRegisterInput({
      email: 'a@b.c',
      name: '  Test  ',
      password: 'x',
      token: 't'
    });
    expect(result.data?.name).toBe('Test');
  });

  it('rejects a request without an invitation token (#149)', () => {
    // The token is required, not optional: an optional one secures nothing,
    // because an attacker takes the path that does not ask for one.
    const result = validateRegisterInput({ email: 'a@b.c', name: 'Test', password: 'pw' });
    expect(result.success).toBe(false);
    expect(result.errors?.some((e) => e.field === 'token')).toBe(true);
  });

  it('trims the token', () => {
    const result = validateRegisterInput({
      email: 'a@b.c',
      name: 'Test',
      password: 'pw',
      token: '  invite-token  '
    });
    expect(result.data?.token).toBe('invite-token');
  });
});

describe('validateEmailInput', () => {
  it('should accept valid email', () => {
    expect(validateEmailInput({ email: 'x@y.z' }).success).toBe(true);
  });

  it('should reject missing email', () => {
    expect(validateEmailInput({}).success).toBe(false);
  });
});

describe('validateTokenInput', () => {
  it('should accept non-empty token', () => {
    expect(validateTokenInput({ token: 'abc123' }).success).toBe(true);
  });

  it('should reject empty token', () => {
    expect(validateTokenInput({ token: '' }).success).toBe(false);
  });
});

describe('validateResetPasswordInput', () => {
  it('should accept valid input', () => {
    expect(validateResetPasswordInput({ token: 'abc', password: 'new' }).success).toBe(true);
  });

  it('should reject missing fields', () => {
    const result = validateResetPasswordInput({});
    expect(result.success).toBe(false);
    expect(result.errors?.length).toBe(2);
  });
});

// Cluster E.1: cap input length so unbounded attacker input never reaches the
describe('validateChangePasswordInput', () => {
  it('accepts both passwords', () => {
    const r = validateChangePasswordInput({ currentPassword: 'old', newPassword: 'NewStrong1' });
    expect(r.success).toBe(true);
    expect(r.data).toEqual({ currentPassword: 'old', newPassword: 'NewStrong1' });
  });

  it('requires both fields', () => {
    expect(validateChangePasswordInput({ currentPassword: 'old' }).success).toBe(false);
    expect(validateChangePasswordInput({ newPassword: 'new' }).success).toBe(false);
  });

  it('bounds both passwords before any crypto runs', () => {
    const huge = 'a'.repeat(2000);
    expect(validateChangePasswordInput({ currentPassword: huge, newPassword: 'x' }).success).toBe(
      false
    );
    expect(validateChangePasswordInput({ currentPassword: 'x', newPassword: huge }).success).toBe(
      false
    );
  });
});

describe('validateChangeEmailInput', () => {
  it('lowercases the email and keeps the password', () => {
    const r = validateChangeEmailInput({ newEmail: 'NEW@Test.com', currentPassword: 'pw' });
    expect(r.success).toBe(true);
    expect(r.data).toEqual({ newEmail: 'new@test.com', currentPassword: 'pw' });
  });

  it('rejects a malformed email or a missing password', () => {
    expect(validateChangeEmailInput({ newEmail: 'nope', currentPassword: 'pw' }).success).toBe(
      false
    );
    expect(validateChangeEmailInput({ newEmail: 'a@b.com' }).success).toBe(false);
  });
});

describe('validateUpdateProfileInput', () => {
  it('trims and accepts a name', () => {
    const r = validateUpdateProfileInput({ name: '  Aya  ' });
    expect(r.success).toBe(true);
    expect(r.data).toEqual({ name: 'Aya' });
  });

  it('rejects an empty or oversized name', () => {
    expect(validateUpdateProfileInput({ name: '   ' }).success).toBe(false);
    expect(validateUpdateProfileInput({ name: 'a'.repeat(2000) }).success).toBe(false);
  });
});

describe('validateDeleteAccountInput', () => {
  it('requires the current password', () => {
    expect(validateDeleteAccountInput({}).success).toBe(false);
    expect(validateDeleteAccountInput({ currentPassword: 'pw' }).success).toBe(true);
  });
});

describe('validateTotpInput', () => {
  it('requires a non-empty code and trims it', () => {
    expect(validateTotpInput({}).success).toBe(false);
    expect(validateTotpInput({ code: '   ' }).success).toBe(false);
    const ok = validateTotpInput({ code: '  123456 ' });
    expect(ok.success).toBe(true);
    expect(ok.data?.code).toBe('123456');
  });

  it('accepts a formatted backup code (not just 6 digits)', () => {
    expect(validateTotpInput({ code: 'ABCD-EFGH-IJKL-MNOP' }).success).toBe(true);
  });

  it('rejects an oversized code', () => {
    expect(validateTotpInput({ code: 'a'.repeat(65) }).success).toBe(false);
  });
});

describe('validateDisable2faInput', () => {
  it('requires the current password', () => {
    expect(validateDisable2faInput({}).success).toBe(false);
    expect(validateDisable2faInput({ currentPassword: 'pw' }).success).toBe(true);
  });
});

// expensive PBKDF2 path (login/register/reset run it over the password).
describe('input length limits', () => {
  const huge = 'a'.repeat(2000);

  it('rejects an oversized password on login before any crypto runs', () => {
    const result = validateLoginInput({ email: 'a@b.com', password: huge });
    expect(result.success).toBe(false);
    expect(result.errors?.some((e) => e.field === 'password')).toBe(true);
  });

  it('accepts a long-but-reasonable passphrase (256 chars) and rejects beyond', () => {
    const passphrase = 'p'.repeat(256);
    expect(validateLoginInput({ email: 'a@b.com', password: passphrase }).success).toBe(true);
    expect(validateLoginInput({ email: 'a@b.com', password: `${passphrase}x` }).success).toBe(
      false
    );
  });

  it('rejects oversized password and name on register', () => {
    expect(validateRegisterInput({ email: 'a@b.com', name: 'N', password: huge }).success).toBe(
      false
    );
    expect(
      validateRegisterInput({ email: 'a@b.com', name: huge, password: 'okpassword' }).success
    ).toBe(false);
  });

  it('rejects an oversized email', () => {
    const longEmail = `${'a'.repeat(250)}@b.com`;
    expect(validateEmailInput({ email: longEmail }).success).toBe(false);
    expect(validateLoginInput({ email: longEmail, password: 'x' }).success).toBe(false);
  });

  it('rejects an oversized token on verify and reset', () => {
    expect(validateTokenInput({ token: 'a'.repeat(513) }).success).toBe(false);
    expect(
      validateResetPasswordInput({ token: 'a'.repeat(513), password: 'okpassword' }).success
    ).toBe(false);
  });
});
