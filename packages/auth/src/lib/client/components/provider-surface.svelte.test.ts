// @vitest-environment jsdom
import { flushSync, mount, tick, unmount } from 'svelte';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { AuthUser } from '../../types.js';
import ProviderHarness from './__fixtures__/ProviderHarness.svelte';
import AccountSettings from './AccountSettings/AccountSettings.svelte';
import ForgotPasswordPage from './ForgotPasswordPage/ForgotPasswordPage.svelte';
import InvitationManager from './InvitationManager/InvitationManager.svelte';
import LoginPage from './LoginPage/LoginPage.svelte';
import NotificationBadge from './NotificationBadge/NotificationBadge.svelte';
import NotificationCenter from './NotificationCenter/NotificationCenter.svelte';
import PasskeyManager from './PasskeyManager/PasskeyManager.svelte';
import PushPermissionPrompt from './PushPermissionPrompt/PushPermissionPrompt.svelte';
import RegisterPage from './RegisterPage/RegisterPage.svelte';
import ResetPasswordPage from './ResetPasswordPage/ResetPasswordPage.svelte';
import SessionManager from './SessionManager/SessionManager.svelte';
import TwoFactorManager from './TwoFactorManager/TwoFactorManager.svelte';
import VerifyEmailPage from './VerifyEmailPage/VerifyEmailPage.svelte';

// Both halves of the provider contract, for every component that has one.
//
// The preset key is a string each component hands to `resolveAuthSlotClasses`,
// and it is the name a consumer registers under. Nothing derives it — a
// component cannot read its own name at runtime once a bundler has renamed the
// chunk — so it is thirteen hand-written strings, and a typo is silent: the
// preset simply does not resolve. Driving all thirteen through a real provider
// is what makes that loud, and it is the same run that proves a provider-wide
// `unstyled` reaches this package's own classes and not just the blocks
// primitives inside.

const user = {
  id: 'u1',
  email: 'a@example.com',
  name: 'Ada',
  role: 'USER',
  emailVerified: true
} as AuthUser;

const ok = (async () =>
  new Response('{}', {
    status: 200,
    headers: { 'Content-Type': 'application/json' }
  })) as unknown as typeof globalThis.fetch;

/** Every exported component that renders markup, with the least it needs to render it. */
const SUBJECTS: Array<[name: string, component: unknown, props: Record<string, unknown>]> = [
  ['AccountSettings', AccountSettings, { user, fetcher: ok }],
  ['ForgotPasswordPage', ForgotPasswordPage, { fetcher: ok }],
  [
    'InvitationManager',
    InvitationManager,
    { roles: [{ value: 'USER', label: 'User' }], fetcher: ok }
  ],
  ['LoginPage', LoginPage, { fetcher: ok }],
  ['NotificationBadge', NotificationBadge, { count: 1 }],
  ['NotificationCenter', NotificationCenter, { notifications: [] }],
  ['PasskeyManager', PasskeyManager, { fetcher: ok }],
  ['PushPermissionPrompt', PushPermissionPrompt, { vapidPublicKey: 'BKey' }],
  ['RegisterPage', RegisterPage, { fetcher: ok }],
  ['ResetPasswordPage', ResetPasswordPage, { token: 't', fetcher: ok }],
  ['SessionManager', SessionManager, { fetcher: ok }],
  ['TwoFactorManager', TwoFactorManager, { user, fetcher: ok }],
  ['VerifyEmailPage', VerifyEmailPage, { token: 't', fetcher: ok }]
];

// Matches no Tailwind utility, so the bucket-conflict resolver in
// `resolveSlotClasses` cannot drop it.
const MARK = 'qa-root-mark';

let dispose: (() => void) | undefined;

afterEach(reset);

async function renderUnderProvider(
  name: string,
  component: unknown,
  props: Record<string, unknown>,
  unstyled: boolean
) {
  const instance = mount(ProviderHarness, {
    target: document.body,
    props: {
      component,
      componentProps: props,
      presets: { [name]: { branded: { slotClasses: { root: MARK } } } },
      unstyled
    } as never
  });
  dispose = () => unmount(instance);
  flushSync();
  await new Promise((resolve) => setTimeout(resolve, 0));
  await tick();
}

const marked = () => document.body.querySelector(`.${MARK}`);

/** What the marked root carries beyond the marker and blocks' own token hooks. */
const ownClasses = () =>
  (marked()?.className ?? '')
    .split(/\s+/)
    .filter((cls) => cls && cls !== MARK && !cls.startsWith('blocks-'));

function reset() {
  dispose?.();
  dispose = undefined;
  document.body.replaceChildren();
}

describe('provider surface', () => {
  it.each(SUBJECTS)(
    '%s resolves a preset registered under its own name',
    async (name, c, props) => {
      await renderUnderProvider(name, c, { ...props, preset: 'branded' }, false);
      expect(marked()).toBeTruthy();
    }
  );

  // NotificationBadge is excluded here and measured on its own below: it adds no
  // class of its own, so `unstyled` has nothing to strip there and the assertion
  // would hold no matter what this package did.
  it.each(SUBJECTS.filter(([name]) => name !== 'NotificationBadge'))(
    '%s strips its own classes under <BlocksProvider unstyled>',
    async (name, c, props) => {
      await renderUnderProvider(name, c, { ...props, preset: 'branded' }, false);
      // Positive control for this row: with no defaults on the root there would
      // be nothing for the second half to prove.
      expect(ownClasses().length).toBeGreaterThan(0);
      reset();

      await renderUnderProvider(name, c, { ...props, preset: 'branded' }, true);
      // `unstyled` drops the component's default classes and keeps the slot
      // override, so nothing of this package's own may survive. A `blocks-*`
      // token hook is not one of ours: blocks emits those outside its own
      // unstyled branch on purpose (Badge.svelte builds `blocks-intent-${intent}`
      // unconditionally). Honouring `unstyled` only as a prop leaves auth's
      // utilities here while every blocks primitive inside is already bare.
      expect(ownClasses()).toEqual([]);
    }
  );

  it('NotificationBadge leaves the stripping to the Badge it renders', async () => {
    await renderUnderProvider(
      'NotificationBadge',
      NotificationBadge,
      { count: 1, preset: 'branded' },
      true
    );
    // It adds no class of its own — `slotClasses.root` goes straight onto the
    // Badge — so a bare result here is blocks honouring the provider, not this
    // package doing anything. That is why it sits outside the row above, which
    // it would pass either way.
    expect(ownClasses()).toEqual([]);
  });

  it('leaves an unregistered preset name to the provider warning, not a crash', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    await renderUnderProvider(
      'PasskeyManager',
      PasskeyManager,
      { fetcher: ok, preset: 'absent' },
      false
    );
    expect(document.body.textContent).toContain('Passkeys');
    warn.mockRestore();
  });
});
