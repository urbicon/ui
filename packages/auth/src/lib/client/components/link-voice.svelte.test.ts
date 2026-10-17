// @vitest-environment jsdom
import { screen } from '@testing-library/dom';
import userEvent from '@testing-library/user-event';
import { linkVariants } from '@urbicon-ui/blocks';
import { flushSync, mount, unmount } from 'svelte';
import { afterEach, describe, expect, it } from 'vitest';
import { DEFAULT_PASSWORD_POLICY } from '../../password-policy.js';
import { fetcherAnswering, settle } from './__fixtures__/fetcher.js';
import ProviderHarness from './__fixtures__/ProviderHarness.svelte';
import ForgotPasswordPage from './ForgotPasswordPage/ForgotPasswordPage.svelte';
import LoginPage from './LoginPage/LoginPage.svelte';
import RegisterPage from './RegisterPage/RegisterPage.svelte';
import ResetPasswordPage from './ResetPasswordPage/ResetPasswordPage.svelte';

// Every link an auth page draws by default speaks blocks' `inline` link voice —
// link ink AND an underline at rest — so the library has one link look. For the
// two that end a sentence (Login › create account, Register › sign in) it is
// also what WCAG 1.4.1 asks: colour alone is what axe reports as
// `link-in-text-block`.

const INLINE = linkVariants({ variant: 'inline' }).base().split(/\s+/);

type Site = {
  component: unknown;
  props: Record<string, unknown>;
  link: string;
  /** Whether `slotClasses.links` lands on the anchor itself or on the block around it. */
  slotOnAnchor: boolean;
  /** Whatever has to happen before the link is drawn. */
  reach?: () => Promise<void>;
};

const SITES: Array<[string, Site]> = [
  [
    'LoginPage › forgot password',
    { component: LoginPage, props: {}, link: 'Forgot password?', slotOnAnchor: false }
  ],
  [
    'LoginPage › create account',
    { component: LoginPage, props: {}, link: 'Create account', slotOnAnchor: false }
  ],
  [
    'RegisterPage › sign in',
    {
      component: RegisterPage,
      props: { passwordPolicy: DEFAULT_PASSWORD_POLICY },
      link: 'Sign in',
      slotOnAnchor: false
    }
  ],
  [
    'ForgotPasswordPage › back to sign in',
    { component: ForgotPasswordPage, props: {}, link: 'Back to sign in', slotOnAnchor: true }
  ],
  [
    'ResetPasswordPage › sign in',
    {
      component: ResetPasswordPage,
      props: { token: 't', passwordPolicy: DEFAULT_PASSWORD_POLICY },
      link: 'Sign in',
      slotOnAnchor: true,
      // The link only appears once the new password is set.
      reach: async () => {
        await userEvent.type(screen.getByLabelText('New password'), 'hunter2hunter2');
        await userEvent.type(screen.getByLabelText('Confirm new password'), 'hunter2hunter2');
        await userEvent.click(screen.getByRole('button', { name: 'Reset password' }));
        await settle();
      }
    }
  ]
];

let dispose: (() => void) | undefined;

afterEach(() => {
  dispose?.();
  dispose = undefined;
  document.body.replaceChildren();
});

async function renderLink(
  site: Site,
  extra: Record<string, unknown> = {},
  defaults: Record<string, unknown> = {}
): Promise<HTMLAnchorElement> {
  const instance = mount(ProviderHarness, {
    target: document.body,
    props: {
      component: site.component,
      componentProps: { fetcher: fetcherAnswering(200, {}), ...site.props, ...extra },
      defaults
    } as never
  });
  dispose = () => unmount(instance);
  flushSync();
  await settle();
  await site.reach?.();
  return screen.getByRole('link', { name: site.link }) as HTMLAnchorElement;
}

const classesOf = (el: Element) => el.className.split(/\s+/).filter(Boolean);

describe('auth link voice', () => {
  it.each(SITES)('%s is underlined at rest, in blocks’ inline voice', async (_, site) => {
    const link = await renderLink(site);
    const classes = classesOf(link);

    expect(classes).toContain('underline');
    expect(classes).not.toContain('hover:underline');
    // Derived from blocks rather than re-typed here. Where layout classes join
    // it (`text-sm` beside `text-text-link`), the merge must drop none of it.
    expect(classes).toEqual(expect.arrayContaining(INLINE));
  });

  it.each(SITES)(
    '%s keeps its underline when the provider defaults Link to standalone',
    async (_, site) => {
      // A provider `props` default reaches only a Link that names no variant
      // of its own — these sites name theirs, so a theme that turns Link
      // `standalone` cannot strip the underline from a link in a sentence.
      const link = await renderLink(site, {}, { Link: { props: { variant: 'standalone' } } });
      const classes = classesOf(link);

      expect(classes).toContain('underline');
      expect(classes).not.toContain('no-underline');
    }
  );

  it.each(SITES)('%s still takes slotClasses.links', async (_, site) => {
    const link = await renderLink(site, {
      slotClasses: { links: 'qa-links text-text-primary' }
    });

    expect(link.closest('.qa-links')).toBeTruthy();
    if (site.slotOnAnchor) {
      // The consumer's colour wins the bucket over the link ink it replaces.
      expect(classesOf(link)).toContain('text-text-primary');
      expect(classesOf(link)).not.toContain('text-text-link');
    }
  });

  it.each(SITES)('%s draws nothing of its own under unstyled', async (_, site) => {
    const link = await renderLink(site, { unstyled: true, slotClasses: { links: 'qa-links' } });

    expect(classesOf(link)).toEqual(site.slotOnAnchor ? ['qa-links'] : []);
  });
});
