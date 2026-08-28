/**
 * Mock backends for the auth live previews.
 *
 * The static docs site has no auth backend, so components that fetch on mount
 * (PasskeyManager, InvitationManager, VerifyEmailPage) would permanently render
 * their error state. These factories return stateful `fetch`-compatible mocks
 * that are wired into the previews via the components' `fetcher` prop.
 *
 * The displayed code snippets (`Basic.svelte?raw`) intentionally keep showing
 * the real server-backed usage — only the rendered preview is mocked (see the
 * `BasicDemo.svelte` wrappers next to each example).
 */

import type { AuthUser } from '@urbicon-ui/auth';

const DAY = 24 * 60 * 60 * 1000;
const LATENCY_MS = 350;
const TOTP_CODE_RE = /^\d{6}$/;

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' }
  });
}

function latency(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, LATENCY_MS));
}

function requestUrl(input: RequestInfo | URL): string {
  if (typeof input === 'string') return input;
  if (input instanceof URL) return input.href;
  return input.url;
}

function parseBody(init?: RequestInit): Record<string, unknown> {
  try {
    return JSON.parse(typeof init?.body === 'string' ? init.body : '{}');
  } catch {
    return {};
  }
}

/** Shared signed-in user for the account/2FA previews (no real backend). */
export const demoAuthUser: AuthUser = {
  id: 'demo-user',
  email: 'sam@example.com',
  name: 'Sam Rivera',
  role: 'USER',
  emailVerified: true,
  totpEnabled: false
};

/**
 * Simulates the `createPasskeyHandlers` endpoints: a pre-filled passkey list and working
 * deletes. Registration is deliberately answered with a clear demo notice —
 * triggering real WebAuthn prompts from a docs page would register a useless
 * credential in the visitor's authenticator.
 */
export function createPasskeyDemoFetcher(): typeof globalThis.fetch {
  let passkeys = [
    {
      credentialId: 'demo-macbook-touch-id',
      name: 'MacBook Touch ID',
      createdAt: new Date(Date.now() - 92 * DAY).toISOString(),
      lastUsedAt: new Date(Date.now() - 1 * DAY).toISOString(),
      aaguid: 'demo'
    },
    {
      credentialId: 'demo-iphone-face-id',
      name: 'iPhone Face ID',
      createdAt: new Date(Date.now() - 30 * DAY).toISOString(),
      lastUsedAt: null,
      aaguid: 'demo'
    }
  ];

  return async (input, init) => {
    const url = requestUrl(input);
    const method = (init?.method ?? 'GET').toUpperCase();
    await latency();

    if (url.endsWith('/list')) {
      return json({ passkeys });
    }
    if (url.endsWith('/registration-options')) {
      return json(
        { error: 'Demo preview — registering a passkey requires the real server handlers.' },
        503
      );
    }
    if (method === 'DELETE') {
      const credentialId = decodeURIComponent(url.split('/').pop() ?? '');
      passkeys = passkeys.filter((p) => p.credentialId !== credentialId);
      return json({ success: true });
    }
    return json({ error: 'Not found' }, 404);
  };
}

/**
 * Simulates the invitation endpoints: a pre-filled list, working creates
 * (parsed from the POST body) and deletes.
 */
export function createInvitationDemoFetcher(): typeof globalThis.fetch {
  let nextId = 3;
  let invitations = [
    {
      id: 'demo-1',
      email: 'sam@example.com',
      role: 'ADMIN',
      usedAt: new Date(Date.now() - 5 * DAY).toISOString(),
      createdAt: new Date(Date.now() - 12 * DAY).toISOString()
    },
    {
      id: 'demo-2',
      email: 'alex@example.com',
      role: 'USER',
      usedAt: null,
      createdAt: new Date(Date.now() - 2 * DAY).toISOString()
    }
  ];

  return async (input, init) => {
    const url = requestUrl(input);
    const method = (init?.method ?? 'GET').toUpperCase();
    await latency();

    if (method === 'GET') {
      return json({ invitations });
    }
    if (method === 'POST') {
      const body = JSON.parse(typeof init?.body === 'string' ? init.body : '{}');
      invitations = [
        {
          id: `demo-${nextId++}`,
          email: body.email ?? 'invitee@example.com',
          role: body.role ?? 'USER',
          usedAt: null,
          createdAt: new Date().toISOString()
        },
        ...invitations
      ];
      return json({ success: true });
    }
    if (method === 'DELETE') {
      const id = url.split('/').pop() ?? '';
      invitations = invitations.filter((inv) => inv.id !== id);
      return json({ success: true });
    }
    return json({ error: 'Not found' }, 404);
  };
}

/** Lets the VerifyEmailPage preview resolve to its success state. */
export function createVerifyEmailDemoFetcher(): typeof globalThis.fetch {
  return async () => {
    await latency();
    return json({ success: true });
  };
}

/**
 * Simulates the account endpoints (`/api/auth/account`): a profile rename that
 * round-trips the new name, always-success (enumeration-safe) email/password
 * changes, and a delete that explains it needs the real handlers — actually
 * deleting from a docs preview would be a confusing dead end.
 */
export function createAccountDemoFetcher(): typeof globalThis.fetch {
  let profile: AuthUser = { ...demoAuthUser };

  return async (input, init) => {
    const url = requestUrl(input);
    const method = (init?.method ?? 'GET').toUpperCase();
    await latency();

    if (method === 'POST' && url.endsWith('/profile')) {
      const body = parseBody(init);
      if (typeof body.name === 'string' && body.name.trim()) {
        profile = { ...profile, name: body.name.trim() };
      }
      return json({ success: true, user: profile });
    }
    if (method === 'POST' && url.endsWith('/change-email')) {
      return json({ success: true });
    }
    if (method === 'POST' && url.endsWith('/change-password')) {
      return json({ success: true });
    }
    if (method === 'POST' && url.endsWith('/delete')) {
      return json(
        { error: 'Demo preview — deleting an account requires the real server handlers.' },
        503
      );
    }
    return json({ error: 'Not found' }, 404);
  };
}

/**
 * Simulates the session endpoints (`/api/auth/sessions`): a pre-filled list
 * with one "this device" row, working single-revokes and "sign out others".
 */
export function createSessionDemoFetcher(): typeof globalThis.fetch {
  let sessions = [
    {
      id: 'demo-current',
      userAgent:
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
      ip: null as string | null,
      lastActive: new Date(Date.now() - 2 * 60 * 1000).toISOString(),
      current: true
    },
    {
      id: 'demo-iphone',
      userAgent:
        'Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Mobile/15E148 Safari/604.1',
      ip: '203.0.113.7' as string | null,
      lastActive: new Date(Date.now() - 2 * DAY).toISOString(),
      current: false
    },
    {
      id: 'demo-firefox',
      userAgent: 'Mozilla/5.0 (X11; Linux x86_64; rv:124.0) Gecko/20100101 Firefox/124.0',
      ip: '198.51.100.23' as string | null,
      lastActive: new Date(Date.now() - 9 * DAY).toISOString(),
      current: false
    }
  ];

  return async (input, init) => {
    const url = requestUrl(input);
    const method = (init?.method ?? 'GET').toUpperCase();
    await latency();

    if (method === 'POST' && url.endsWith('/revoke-others')) {
      sessions = sessions.filter((s) => s.current);
      return json({ success: true });
    }
    if (method === 'POST' && url.endsWith('/revoke')) {
      const { id } = parseBody(init);
      sessions = sessions.filter((s) => s.id !== id);
      return json({ success: true });
    }
    if (method === 'GET') {
      return json({ available: true, sessions });
    }
    return json({ error: 'Not found' }, 404);
  };
}

/**
 * Simulates the 2FA endpoints (`/api/auth/account/2fa`): setup returns a fixed
 * demo secret + otpauth URI, enable accepts any 6-digit code and returns backup
 * codes, disable always succeeds. No real TOTP verification happens.
 */
export function createTwoFactorDemoFetcher(): typeof globalThis.fetch {
  const secret = 'JBSWY3DPEHPK3PXP';
  const otpauthUri =
    'otpauth://totp/Urbicon%20UI:sam@example.com?secret=JBSWY3DPEHPK3PXP&issuer=Urbicon%20UI&algorithm=SHA1&digits=6&period=30';

  return async (input, init) => {
    const url = requestUrl(input);
    await latency();

    if (url.endsWith('/setup')) {
      return json({ secret, otpauthUri });
    }
    if (url.endsWith('/enable')) {
      const { code } = parseBody(init);
      if (typeof code !== 'string' || !TOTP_CODE_RE.test(code)) {
        return json({ error: 'Enter the 6-digit code from your authenticator app.' }, 400);
      }
      return json({
        success: true,
        backupCodes: [
          '4F9K-2QP7',
          '8M3X-7HD2',
          'A1B2-C3D4',
          '9Z8Y-7X6W',
          'QWER-1234',
          'ASDF-5678',
          'ZXCV-9012',
          'POIU-3456'
        ]
      });
    }
    if (url.endsWith('/disable')) {
      return json({ success: true });
    }
    return json({ error: 'Not found' }, 404);
  };
}
