import type { AuthLocale } from '../../i18n/keys.js';

/**
 * The shape every auth mail builder (default or consumer-supplied hook) returns.
 * `text` is always present so each mail ships a real `text/plain` alternative
 * alongside the HTML — better deliverability and a graceful fallback in clients
 * that don't render HTML.
 */
export interface BuiltEmail {
  subject: string;
  html: string;
  text: string;
}

/**
 * Minimal HTML escape for interpolating untrusted strings (display name,
 * URLs containing user-controlled segments) into email bodies. Covers the
 * five characters that materially break out of attribute or text contexts;
 * sufficient for use inside a quoted attribute or as inline text.
 */
export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/** Substitute `{name}` / `{appName}` / `{email}` placeholders in a locale string. */
function interpolate(template: string, vars: Record<string, string>): string {
  return template.replace(/\{(\w+)\}/g, (match, key) => vars[key] ?? match);
}

/**
 * Combine a bare `from` address with an optional display name into the RFC-5322
 * `"Name <addr>"` form. A no-op when `from` already carries a name, when no name
 * is given, or when `from` is unset (transport default applies).
 */
export function applyFromName(
  from: string | undefined,
  fromName: string | undefined
): string | undefined {
  if (!from || !fromName) return from;
  if (from.includes('<')) return from; // already "Name <addr>"
  return `${fromName} <${from}>`;
}

interface RenderParams {
  heading: string;
  /** One or more body paragraphs (plain text; escaped + wrapped for HTML). */
  body: string[];
  /** Call-to-action button. Omit for a notice-only mail. */
  cta?: { label: string; url: string };
  /** Muted footer line (e.g. "if you didn't request this…"). */
  ignore?: string;
}

/**
 * Render a simple, semantic, inline-styled HTML email plus a matching
 * `text/plain` body from the same content. Deliberately minimal — one heading,
 * paragraphs, an optional button, a muted footer — so it renders predictably
 * across email clients without a heavy framework.
 */
function render(params: RenderParams): { html: string; text: string } {
  const { heading, body, cta, ignore } = params;

  const paragraphsHtml = body
    .map(
      (p) =>
        `<p style="margin: 0 0 16px; color: #333; font-size: 15px; line-height: 1.5;">${escapeHtml(p)}</p>`
    )
    .join('\n        ');

  const ctaHtml = cta
    ? `<p style="text-align: center; margin: 24px 0;">
          <a href="${escapeHtml(cta.url)}" style="display: inline-block; padding: 12px 24px; background: #171717; color: #fff; border-radius: 6px; text-decoration: none; font-size: 15px;">${escapeHtml(cta.label)}</a>
        </p>`
    : '';

  const ignoreHtml = ignore
    ? `<p style="margin: 16px 0 0; color: #888; font-size: 13px; line-height: 1.5;">${escapeHtml(ignore)}</p>`
    : '';

  const html = `<div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 480px; margin: 0 auto; padding: 24px;">
        <h1 style="margin: 0 0 16px; color: #171717; font-size: 20px;">${escapeHtml(heading)}</h1>
        ${paragraphsHtml}
        ${ctaHtml}
        ${ignoreHtml}
      </div>`;

  // Plain-text counterpart: heading, paragraphs, the CTA as a bare URL, footer.
  const textParts = [heading, '', ...body];
  if (cta) textParts.push('', `${cta.label}: ${cta.url}`);
  if (ignore) textParts.push('', ignore);
  const text = textParts.join('\n');

  return { html, text };
}

/** Context shared by the link-bearing default builders. */
export interface MailContext {
  name: string;
  url: string;
  appName: string;
}

export function buildVerificationEmail(ctx: MailContext, t: AuthLocale): BuiltEmail {
  const c = t.auth.emails.verification;
  const vars = { name: ctx.name, appName: ctx.appName };
  const { html, text } = render({
    heading: interpolate(c.heading, vars),
    body: [interpolate(c.body, vars)],
    cta: { label: c.cta, url: ctx.url },
    ignore: c.ignore
  });
  return { subject: interpolate(c.subject, vars), html, text };
}

export function buildPasswordResetEmail(ctx: MailContext, t: AuthLocale): BuiltEmail {
  const c = t.auth.emails.passwordReset;
  const vars = { name: ctx.name, appName: ctx.appName };
  const { html, text } = render({
    heading: interpolate(c.heading, vars),
    body: [interpolate(c.body, vars)],
    cta: { label: c.cta, url: ctx.url },
    ignore: c.ignore
  });
  return { subject: interpolate(c.subject, vars), html, text };
}

export function buildInvitationEmail(
  ctx: { url: string; appName: string },
  t: AuthLocale
): BuiltEmail {
  const c = t.auth.emails.invitation;
  const vars = { appName: ctx.appName };
  const { html, text } = render({
    heading: interpolate(c.heading, vars),
    body: [interpolate(c.body, vars)],
    cta: { label: c.cta, url: ctx.url },
    ignore: c.ignore
  });
  return { subject: interpolate(c.subject, vars), html, text };
}

export function buildChangeEmail(ctx: MailContext, t: AuthLocale): BuiltEmail {
  const c = t.auth.emails.changeEmail;
  const vars = { name: ctx.name, appName: ctx.appName };
  const { html, text } = render({
    heading: interpolate(c.heading, vars),
    body: [interpolate(c.body, vars)],
    cta: { label: c.cta, url: ctx.url },
    ignore: c.ignore
  });
  return { subject: interpolate(c.subject, vars), html, text };
}

export function buildChangeEmailNotice(
  ctx: { name: string; appName: string; newEmail: string },
  t: AuthLocale
): BuiltEmail {
  const c = t.auth.emails.changeEmailNotice;
  const vars = { name: ctx.name, appName: ctx.appName, email: ctx.newEmail };
  const { html, text } = render({
    heading: interpolate(c.heading, vars),
    body: [interpolate(c.body, vars)],
    ignore: c.ignore
  });
  return { subject: interpolate(c.subject, vars), html, text };
}
