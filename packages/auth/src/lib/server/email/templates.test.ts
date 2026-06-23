import { describe, expect, it } from 'vitest';
import { de } from '../../i18n/de.js';
import { en } from '../../i18n/en.js';
import {
  applyFromName,
  buildChangeEmail,
  buildChangeEmailNotice,
  buildInvitationEmail,
  buildPasswordResetEmail,
  buildVerificationEmail,
  escapeHtml
} from './templates.js';

describe('escapeHtml', () => {
  it('escapes the five breaking characters', () => {
    expect(escapeHtml(`<a href="x">&'`)).toBe('&lt;a href=&quot;x&quot;&gt;&amp;&#39;');
  });
});

describe('applyFromName', () => {
  it('folds a display name into a bare address', () => {
    expect(applyFromName('auth@acme.test', 'Acme')).toBe('Acme <auth@acme.test>');
  });
  it('leaves an already-named from untouched', () => {
    expect(applyFromName('Acme <auth@acme.test>', 'Other')).toBe('Acme <auth@acme.test>');
  });
  it('returns the from unchanged when no name is given', () => {
    expect(applyFromName('auth@acme.test', undefined)).toBe('auth@acme.test');
  });
  it('returns undefined when from is unset (transport default)', () => {
    expect(applyFromName(undefined, 'Acme')).toBeUndefined();
  });
});

const ctx = { name: 'Aya', url: 'https://app.test/verify?token=abc', appName: 'Cookery' };

describe('default mail builders', () => {
  it('verification mail interpolates name + appName and ships html + text', () => {
    const mail = buildVerificationEmail(ctx, en);
    expect(mail.subject).toBe('Verify your email — Cookery');
    expect(mail.html).toContain('Welcome, Aya!');
    expect(mail.html).toContain(ctx.url);
    // Plain-text part is real, non-empty, and carries the link.
    expect(mail.text).toContain('Welcome, Aya!');
    expect(mail.text).toContain(ctx.url);
    expect(mail.text.length).toBeGreaterThan(0);
    // No leftover placeholders.
    expect(mail.html).not.toContain('{appName}');
    expect(mail.text).not.toContain('{name}');
  });

  it('localizes to German when the de bundle is passed', () => {
    const mail = buildVerificationEmail(ctx, de);
    expect(mail.subject).toBe('Bestätige deine E-Mail — Cookery');
    expect(mail.html).toContain('Willkommen, Aya!');
  });

  it('password-reset mail carries the reset link in html and text', () => {
    const mail = buildPasswordResetEmail(ctx, en);
    expect(mail.subject).toMatch(/reset/i);
    expect(mail.html).toContain(ctx.url);
    expect(mail.text).toContain(ctx.url);
  });

  it('invitation mail interpolates appName (no name needed)', () => {
    const mail = buildInvitationEmail({ url: ctx.url, appName: 'Cookery' }, en);
    expect(mail.subject).toContain('Cookery');
    expect(mail.html).toContain(ctx.url);
    expect(mail.text).toContain(ctx.url);
  });

  it('change-email confirmation carries the confirm link', () => {
    const mail = buildChangeEmail(ctx, en);
    expect(mail.html).toContain(ctx.url);
    expect(mail.text).toContain(ctx.url);
  });

  it('change-email notice has no CTA link but names the pending address', () => {
    const mail = buildChangeEmailNotice(
      { name: 'Aya', appName: 'Cookery', newEmail: 'new@acme.test' },
      en
    );
    expect(mail.html).toContain('new@acme.test');
    expect(mail.text).toContain('new@acme.test');
    // Notice-only: no button/link.
    expect(mail.html).not.toContain('<a ');
  });

  it('escapes interpolated values to prevent HTML injection in the name', () => {
    const mail = buildVerificationEmail({ ...ctx, name: '<script>x</script>' }, en);
    expect(mail.html).not.toContain('<script>x</script>');
    expect(mail.html).toContain('&lt;script&gt;');
  });
});
