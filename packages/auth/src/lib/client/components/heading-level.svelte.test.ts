// @vitest-environment jsdom
import type { Component } from 'svelte';
import { describe, expect, it } from 'vitest';
import type { AuthUser } from '../../types.js';
import { fetcherReturning, mounter, settle } from './__fixtures__/fetcher.js';
import AccountSettings from './AccountSettings/AccountSettings.svelte';
import ForgotPasswordPage from './ForgotPasswordPage/ForgotPasswordPage.svelte';
import InvitationManager from './InvitationManager/InvitationManager.svelte';
import LoginPage from './LoginPage/LoginPage.svelte';
import NotificationCenter from './NotificationCenter/NotificationCenter.svelte';
import PasskeyManager from './PasskeyManager/PasskeyManager.svelte';
import RegisterPage from './RegisterPage/RegisterPage.svelte';
import ResetPasswordPage from './ResetPasswordPage/ResetPasswordPage.svelte';
import SessionManager from './SessionManager/SessionManager.svelte';
import TwoFactorManager from './TwoFactorManager/TwoFactorManager.svelte';
import VerifyEmailPage from './VerifyEmailPage/VerifyEmailPage.svelte';

// Every component that renders a heading takes its rank from `headingLevel`,
// and its section headings sit one below — so a page embedding one keeps its
// own outline: no second `h1`, no skipped rank.

const user = {
  id: 'u1',
  email: 'a@example.com',
  name: 'Ada',
  role: 'USER',
  emailVerified: true,
  totpEnabled: true
} as AuthUser;

type AnyComponent = Component<any>;

/** Each subject, its default title rank, and the least it needs to render its headings. */
const SUBJECTS: Array<[name: string, component: AnyComponent, rank: number, props: object]> = [
  ['LoginPage', LoginPage, 1, {}],
  ['RegisterPage', RegisterPage, 1, {}],
  ['ForgotPasswordPage', ForgotPasswordPage, 1, {}],
  ['ResetPasswordPage', ResetPasswordPage, 1, { token: 't' }],
  ['VerifyEmailPage', VerifyEmailPage, 1, { token: 't' }],
  ['SessionManager', SessionManager, 2, {}],
  ['PasskeyManager', PasskeyManager, 2, {}],
  ['NotificationCenter', NotificationCenter, 2, { notifications: [] }],
  ['InvitationManager', InvitationManager, 2, { roles: [{ value: 'USER', label: 'User' }] }],
  ['AccountSettings', AccountSettings, 2, { user }],
  ['TwoFactorManager', TwoFactorManager, 2, { user }]
];

const render = mounter();

async function ranks(component: AnyComponent, props: object): Promise<number[]> {
  // A fetcher that never answers keeps every component in the state it mounts in.
  render(component, { fetcher: fetcherReturning(), ...props });
  await settle();
  return [...document.body.querySelectorAll('h1, h2, h3, h4, h5, h6')].map((h) =>
    Number(h.tagName[1])
  );
}

describe('headingLevel', () => {
  it.each(SUBJECTS)(
    '%s renders its title at the default rank',
    async (_, component, rank, props) => {
      const [title, ...sections] = await ranks(component, props);

      expect(title).toBe(rank);
      for (const section of sections) expect(section).toBe(rank + 1);
    }
  );

  it.each(SUBJECTS)('%s moves title and sections together', async (_, component, rank, props) => {
    const [title, ...sections] = await ranks(component, { ...props, headingLevel: rank + 2 });

    expect(title).toBe(rank + 2);
    for (const section of sections) expect(section).toBe(rank + 3);
  });

  it('section headings stay headings at the clamp', async () => {
    const all = await ranks(AccountSettings, { user, headingLevel: 6 });

    expect(all.length).toBeGreaterThan(1);
    expect(all.every((rank) => rank === 6)).toBe(true);
  });
});
