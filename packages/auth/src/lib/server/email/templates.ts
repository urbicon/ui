export type TranslateFn = (key: string) => string;

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

export interface EmailTemplateConfig {
  appName: string;
  logoUrl?: string;
  primaryColor?: string;
  templates?: {
    verification?: (params: { name: string; url: string; t: TranslateFn }) => {
      subject: string;
      html: string;
    };
    passwordReset?: (params: { name: string; url: string; t: TranslateFn }) => {
      subject: string;
      html: string;
    };
  };
}

function defaultVerificationTemplate(params: { name: string; url: string; appName: string }) {
  const name = escapeHtml(params.name);
  const url = escapeHtml(params.url);
  const appName = escapeHtml(params.appName);
  return {
    subject: `Verify your email — ${params.appName}`,
    html: `
      <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto;">
        <h2>Welcome, ${name}!</h2>
        <p>Please verify your email address for ${appName} by clicking the button below:</p>
        <p style="text-align: center; margin: 24px 0;">
          <a href="${url}" style="display: inline-block; padding: 12px 24px; background: #171717; color: #fff; border-radius: 6px; text-decoration: none;">
            Verify Email
          </a>
        </p>
        <p style="color: #666; font-size: 14px;">If you didn't create an account, you can safely ignore this email.</p>
      </div>
    `
  };
}

function defaultPasswordResetTemplate(params: { name: string; url: string; appName: string }) {
  const name = escapeHtml(params.name);
  const url = escapeHtml(params.url);
  return {
    subject: `Reset your password — ${params.appName}`,
    html: `
      <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto;">
        <h2>Password Reset</h2>
        <p>Hi ${name}, click the button below to reset your password:</p>
        <p style="text-align: center; margin: 24px 0;">
          <a href="${url}" style="display: inline-block; padding: 12px 24px; background: #171717; color: #fff; border-radius: 6px; text-decoration: none;">
            Reset Password
          </a>
        </p>
        <p style="color: #666; font-size: 14px;">This link expires in 1 hour. If you didn't request this, you can safely ignore this email.</p>
      </div>
    `
  };
}

export function getVerificationEmail(
  params: { name: string; url: string },
  templateConfig?: EmailTemplateConfig,
  t?: TranslateFn
) {
  if (templateConfig?.templates?.verification && t) {
    return templateConfig.templates.verification({ ...params, t });
  }
  return defaultVerificationTemplate({ ...params, appName: templateConfig?.appName ?? 'App' });
}

export function getPasswordResetEmail(
  params: { name: string; url: string },
  templateConfig?: EmailTemplateConfig,
  t?: TranslateFn
) {
  if (templateConfig?.templates?.passwordReset && t) {
    return templateConfig.templates.passwordReset({ ...params, t });
  }
  return defaultPasswordResetTemplate({ ...params, appName: templateConfig?.appName ?? 'App' });
}
