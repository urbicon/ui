// @vitest-environment jsdom
import { screen } from '@testing-library/dom';
import userEvent from '@testing-library/user-event';
import { type ComponentProps, tick } from 'svelte';
import { describe, expect, it, vi } from 'vitest';
import { MAX_DISPLAY_NAME_LENGTH } from '../../../display-name.js';
import { fetcherReturning, jsonResponse, mounter, settle } from '../__fixtures__/fetcher.js';
import ProviderHarness from '../__fixtures__/ProviderHarness.svelte';
import type { PasskeyManagerProps } from './index.js';
import PasskeyManager from './PasskeyManager.svelte';

// Mounts the real component and drives it through its injected `fetcher`; see
// the sibling InvitationManager suite for why this needs both jsdom knobs.
//
// The WebAuthn call itself is out of reach here — jsdom ships no
// `navigator.credentials` and no authenticator — so the register path is
// covered where it is decidable: the cancel branch, which is the one the user
// reaches by pressing Escape on the platform prompt.

const passkey = (over: Record<string, unknown> = {}) => ({
  credentialId: 'c1',
  name: 'MacBook',
  createdAt: '2026-01-01T00:00:00.000Z',
  lastUsedAt: null,
  aaguid: '00000000-0000-0000-0000-000000000000',
  ...over
});

const mountInBody = mounter();
const render = (props: Partial<PasskeyManagerProps> = {}) =>
  mountInBody(PasskeyManager, props as PasskeyManagerProps);

describe('PasskeyManager (component)', () => {
  it('loads the list on mount and renders one row per passkey', async () => {
    render({ fetcher: fetcherReturning(jsonResponse(200, { passkeys: [passkey()] })) });
    await settle();

    expect(screen.getByText('MacBook')).toBeTruthy();
    expect(screen.queryByText('No passkeys registered.')).toBeNull();
  });

  it('renders the error, not the empty state, when the load fails', async () => {
    render({ fetcher: fetcherReturning(jsonResponse(401, { code: 'unauthorized' })) });
    await settle();

    // "No passkeys registered." next to a 401 would invite the user to add a
    // key they may already have.
    expect(screen.queryByText('No passkeys registered.')).toBeNull();
    expect(screen.getByRole('alert')).toBeTruthy();
  });

  it('never leaves the list region blank and silent after a failed load', async () => {
    Object.defineProperty(navigator, 'credentials', {
      configurable: true,
      value: { create: vi.fn(async () => null) }
    });
    let releaseOptions: ((res: Response) => void) | undefined;
    const fetcher = vi
      .fn()
      .mockImplementationOnce(async () => jsonResponse(401, { code: 'unauthorized' }))
      .mockImplementationOnce(() => new Promise<Response>((r) => (releaseOptions = r)));
    render({ fetcher: fetcher as unknown as typeof globalThis.fetch });
    await settle();

    expect(screen.queryByRole('alert')).toBeTruthy();
    expect(screen.queryByText('No passkeys registered.')).toBeNull();

    await userEvent.click(screen.getByRole('button', { name: 'Add passkey' }));
    await tick();

    // The window this covers is the long one: the platform prompt can stand open
    // for seconds. Clearing the *action* error must not silence the load failure
    // that still owns the region.
    expect(screen.queryByRole('alert')).toBeTruthy();
    expect(screen.queryByText('No passkeys registered.')).toBeNull();

    releaseOptions?.(jsonResponse(500, {}));
    await settle();
  });

  it('keeps a later error from blanking the list region', async () => {
    render({
      fetcher: fetcherReturning(
        jsonResponse(200, { passkeys: [passkey()] }),
        jsonResponse(500, { code: 'server_error' })
      )
    });
    await settle();

    await userEvent.click(screen.getByRole('button', { name: /Delete — MacBook/ }));
    await settle();

    // A failed delete is not a failed load: the rows on screen are still valid.
    expect(screen.getByText('MacBook')).toBeTruthy();
    expect(screen.getByRole('alert')).toBeTruthy();
  });

  it('drops the passkey once the server confirms the delete', async () => {
    render({
      fetcher: fetcherReturning(jsonResponse(200, { passkeys: [passkey()] }), jsonResponse(200, {}))
    });
    await settle();

    await userEvent.click(screen.getByRole('button', { name: /Delete — MacBook/ }));
    await settle();

    expect(screen.queryByText('MacBook')).toBeNull();
    expect(screen.getByText('No passkeys registered.')).toBeTruthy();
  });

  it.each([
    ['null', null],
    ['an array', []]
  ])(
    'reports a refusal whose JSON body is %s as the generic error, not as a network failure',
    async (_, body) => {
      render({
        fetcher: fetcherReturning(
          jsonResponse(200, { passkeys: [passkey()] }),
          jsonResponse(500, body)
        )
      });
      await settle();

      await userEvent.click(screen.getByRole('button', { name: /Delete — MacBook/ }));
      await settle();

      // The server answered; a body that is valid JSON but not an object must
      // not be reported as "check your connection".
      expect(screen.getByRole('alert').textContent).toContain('An error occurred');
    }
  );

  it('reports a cancelled platform prompt and re-enables the add button', async () => {
    Object.defineProperty(navigator, 'credentials', {
      configurable: true,
      value: {
        create: vi.fn(async () => {
          throw new DOMException('cancelled', 'NotAllowedError');
        })
      }
    });

    render({
      fetcher: fetcherReturning(
        jsonResponse(200, { passkeys: [] }),
        jsonResponse(200, { options: { challenge: 'AA', user: { id: 'AA' } } })
      )
    });
    await settle();

    await userEvent.click(screen.getByRole('button', { name: 'Add passkey' }));
    await settle();

    expect(screen.getByRole('alert').textContent).toContain('The passkey prompt was cancelled.');
    // `registering` must be cleared on the failure path too — a stuck busy flag
    // would leave the only way to add a passkey permanently disabled.
    expect(screen.getByRole('button', { name: 'Add passkey' }).hasAttribute('disabled')).toBe(
      false
    );
  });

  it('resolves provider defaults, then the preset, then the instance slotClasses', async () => {
    mountInBody(ProviderHarness, {
      component: PasskeyManager,
      componentProps: {
        preset: 'branded',
        slotClasses: { empty: 'qa-instance' },
        fetcher: fetcherReturning(jsonResponse(200, { passkeys: [] }))
      },
      defaults: { PasskeyManager: { slotClasses: { empty: 'qa-defaults' } } },
      presets: { PasskeyManager: { branded: { slotClasses: { empty: 'qa-preset' } } } }
    } as ComponentProps<typeof ProviderHarness>);
    await settle();

    // All three sources contribute. The markers deliberately match no Tailwind
    // utility: `resolveSlotClasses` drops an earlier class when a later one
    // occupies the same bucket, and a `from-*` triple (the first attempt) is one
    // bucket — the gradient colour stop — so only the last would have survived.
    const empty = screen.getByText('No passkeys registered.').className;
    expect(empty).toContain('qa-defaults');
    expect(empty).toContain('qa-preset');
    expect(empty).toContain('qa-instance');
    expect(empty.indexOf('qa-defaults')).toBeLessThan(empty.indexOf('qa-preset'));
    expect(empty.indexOf('qa-preset')).toBeLessThan(empty.indexOf('qa-instance'));
  });

  it('renders standalone, with no provider mounted', async () => {
    render({
      fetcher: fetcherReturning(jsonResponse(200, { passkeys: [] })),
      slotClasses: { empty: 'instance-empty' }
    });
    await settle();

    // `getBlocksConfig()` is optional context: without a provider the cascade
    // must degrade to the instance classes rather than throw.
    expect(screen.getByText('No passkeys registered.').className).toContain('instance-empty');
  });
});

describe('PasskeyManager — inline rename', () => {
  const openRename = async () => {
    await userEvent.click(screen.getByRole('button', { name: /Rename — MacBook/ }));
    await settle();
  };

  const field = () => screen.getByRole('textbox', { name: 'Passkey name' }) as HTMLInputElement;

  it('opens the field on the row, seeded with the stored name and focused', async () => {
    render({ fetcher: fetcherReturning(jsonResponse(200, { passkeys: [passkey()] })) });
    await settle();
    await openRename();

    expect(field().value).toBe('MacBook');
    // Focus has to land in the field: the control that opened it is gone, so
    // without this the keyboard user is dropped at the top of the document.
    expect(document.activeElement).toBe(field());
    // The whole name is selected, so typing replaces rather than appends.
    expect([field().selectionStart, field().selectionEnd]).toEqual([0, 'MacBook'.length]);
  });

  it.each([
    ['Escape', async () => await userEvent.keyboard('{Escape}')],
    [
      'the Cancel button',
      async () => await userEvent.click(screen.getByRole('button', { name: 'Cancel' }))
    ]
  ])('restores the stored name and returns focus to the trigger on %s', async (_label, dismiss) => {
    const fetcher = fetcherReturning(jsonResponse(200, { passkeys: [passkey()] }));
    render({ fetcher });
    await settle();
    await openRename();
    await userEvent.clear(field());
    await userEvent.type(field(), 'Discarded');

    await dismiss();
    await settle();

    expect(screen.getByText('MacBook')).toBeTruthy();
    expect(screen.queryByRole('textbox', { name: 'Passkey name' })).toBeNull();
    // Focus must come back to where it was, not to <body>.
    expect(document.activeElement).toBe(screen.getByRole('button', { name: /Rename — MacBook/ }));
    // A dismissed form sends nothing: only the initial list load happened.
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it('PATCHes the row and renders the name the server stored, not the draft', async () => {
    const fetcher = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse(200, { passkeys: [passkey()] }))
      .mockResolvedValueOnce(
        // The server trims; the panel must show what came back.
        jsonResponse(200, { passkey: passkey({ name: 'Work laptop' }) })
      );
    render({ fetcher: fetcher as unknown as typeof globalThis.fetch });
    await settle();
    await openRename();
    await userEvent.clear(field());
    await userEvent.type(field(), '  Work laptop  ');
    await userEvent.click(screen.getByRole('button', { name: 'Save' }));
    await settle();

    const [url, init] = fetcher.mock.calls[1];
    expect(url).toBe('/api/auth/passkey/c1');
    expect(init.method).toBe('PATCH');
    expect(JSON.parse(init.body)).toEqual({ name: '  Work laptop  ' });

    expect(screen.getByText('Work laptop')).toBeTruthy();
    expect(screen.queryByText('  Work laptop  ')).toBeNull();
    expect(screen.queryByRole('textbox', { name: 'Passkey name' })).toBeNull();
  });

  it('announces the rename and puts focus back on the trigger', async () => {
    render({
      fetcher: fetcherReturning(
        jsonResponse(200, { passkeys: [passkey()] }),
        jsonResponse(200, { passkey: passkey({ name: 'Work laptop' }) })
      )
    });
    await settle();
    await openRename();
    await userEvent.click(screen.getByRole('button', { name: 'Save' }));
    await settle();

    // The row's text changes silently for a screen reader; the panel's live
    // region is what reports it. `FormErrorAlert` renders success through the
    // same `Alert`, which carries `role="alert"` for every intent.
    expect(screen.getByRole('alert').textContent).toContain('Passkey renamed.');
    expect(document.activeElement).toBe(
      screen.getByRole('button', { name: /Rename — Work laptop/ })
    );
  });

  it('keeps the form open with the draft when the server refuses', async () => {
    render({
      fetcher: fetcherReturning(
        jsonResponse(200, { passkeys: [passkey()] }),
        jsonResponse(400, { code: 'validation_error', error: 'Name is required.' })
      )
    });
    await settle();
    await openRename();
    await userEvent.clear(field());
    await userEvent.type(field(), 'x');
    await userEvent.click(screen.getByRole('button', { name: 'Save' }));
    await settle();

    expect(screen.getByRole('alert').textContent).toContain('Name is required.');
    // Still editing: the user has to be able to correct the name in place.
    expect(field().value).toBe('x');
    // And the row keeps the name the server still holds.
    expect(screen.queryByText('x', { selector: 'span' })).toBeNull();
  });

  it('reports a rename whose request never reached a server', async () => {
    render({
      fetcher: fetcherReturning(
        jsonResponse(200, { passkeys: [passkey()] }),
        new TypeError('Failed to fetch')
      )
    });
    await settle();
    await openRename();
    await userEvent.click(screen.getByRole('button', { name: 'Save' }));
    await settle();

    expect(screen.getByRole('alert').textContent).toContain('Network error');
  });

  it('re-reads the list when a 2xx carries no row', async () => {
    const fetcher = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse(200, { passkeys: [passkey()] }))
      .mockResolvedValueOnce(jsonResponse(200, {}))
      .mockResolvedValueOnce(jsonResponse(200, { passkeys: [passkey({ name: 'From the list' })] }));
    render({ fetcher: fetcher as unknown as typeof globalThis.fetch });
    await settle();
    await openRename();
    await userEvent.click(screen.getByRole('button', { name: 'Save' }));
    await settle();

    // A success that does not say what was stored must not be answered with
    // the draft — the list is the authority.
    expect(fetcher).toHaveBeenCalledTimes(3);
    expect(screen.getByText('From the list')).toBeTruthy();
  });

  it('clears a stale success line when the next action starts', async () => {
    render({
      fetcher: fetcherReturning(
        jsonResponse(200, { passkeys: [passkey()] }),
        jsonResponse(200, { passkey: passkey({ name: 'Renamed' }) })
      )
    });
    await settle();
    await openRename();
    await userEvent.click(screen.getByRole('button', { name: 'Save' }));
    await settle();
    expect(screen.getByRole('alert').textContent).toContain('Passkey renamed.');

    await userEvent.click(screen.getByRole('button', { name: /Rename — Renamed/ }));
    await settle();
    // "Passkey renamed." next to a form that has not been submitted yet would
    // report a write that has not happened.
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('resolves the rename slots through the provider cascade', async () => {
    mountInBody(ProviderHarness, {
      component: PasskeyManager,
      componentProps: {
        slotClasses: { renameForm: 'qa-form', renameField: 'qa-field' },
        fetcher: fetcherReturning(jsonResponse(200, { passkeys: [passkey()] }))
      },
      defaults: { PasskeyManager: { slotClasses: { renameForm: 'qa-defaults' } } }
    } as ComponentProps<typeof ProviderHarness>);
    await settle();
    await openRename();

    const form = document.querySelector('form') as HTMLFormElement;
    expect(form.className).toContain('qa-defaults');
    expect(form.className).toContain('qa-form');
    expect(document.querySelector('.qa-field')).toBeTruthy();
  });

  it('drops the default classes under unstyled while keeping the slot overrides', async () => {
    render({
      unstyled: true,
      slotClasses: { renameForm: 'only-mine' },
      fetcher: fetcherReturning(jsonResponse(200, { passkeys: [passkey()] }))
    });
    await settle();
    await openRename();

    const form = document.querySelector('form') as HTMLFormElement;
    expect(form.className).toBe('only-mine');
  });
});

describe('PasskeyManager — the rename form does not leak events to its surroundings', () => {
  const openRename = async () => {
    await userEvent.click(screen.getByRole('button', { name: /Rename — MacBook/ }));
    await settle();
  };

  // The panel is documented as mountable inside a Dialog, which closes on
  // Escape. The listener used to sit on the field, so one Tab put focus on Save
  // and from there Escape passed straight through: the dialog closed with the
  // rename form still open inside it.
  it('cancels on Escape pressed from the Save button, without the key escaping the form', async () => {
    const onDocumentKeydown = vi.fn();
    document.addEventListener('keydown', onDocumentKeydown);
    try {
      render({ fetcher: fetcherReturning(jsonResponse(200, { passkeys: [passkey()] })) });
      await settle();
      await openRename();

      screen.getByRole('button', { name: 'Save' }).focus();
      await userEvent.keyboard('{Escape}');
      await settle();

      expect(screen.queryByRole('textbox', { name: 'Passkey name' })).toBeNull();
      expect(screen.getByText('MacBook')).toBeTruthy();
      // Nothing above the form sees the key — a surrounding dialog stays open.
      expect(onDocumentKeydown).not.toHaveBeenCalled();
    } finally {
      document.removeEventListener('keydown', onDocumentKeydown);
    }
  });

  // A consumer's settings page may wrap the panel in a form of its own. Without
  // stopPropagation the rename fires that form's submit handler on every save.
  it('does not let its submit reach a form wrapped around the panel', async () => {
    const onDocumentSubmit = vi.fn();
    document.addEventListener('submit', onDocumentSubmit);
    try {
      render({
        fetcher: fetcherReturning(
          jsonResponse(200, { passkeys: [passkey()] }),
          jsonResponse(200, { passkey: passkey({ name: 'Renamed' }) })
        )
      });
      await settle();
      await openRename();
      await userEvent.click(screen.getByRole('button', { name: 'Save' }));
      await settle();

      expect(screen.getByText('Renamed')).toBeTruthy();
      expect(onDocumentSubmit).not.toHaveBeenCalled();
    } finally {
      document.removeEventListener('submit', onDocumentSubmit);
    }
  });

  // Removes the only client-reachable refusal — and with it the one place a
  // German page rendered the server's English "Name is required." verbatim,
  // because `errorMessageFromCode` prefers the server prose for
  // `validation_error`.
  it('offers no Save while the draft is blank', async () => {
    const fetcher = fetcherReturning(jsonResponse(200, { passkeys: [passkey()] }));
    render({ fetcher });
    await settle();
    await openRename();

    const field = screen.getByRole('textbox', { name: 'Passkey name' }) as HTMLInputElement;
    await userEvent.clear(field);
    await settle();
    const save = screen.getByRole('button', { name: 'Save' });
    expect(save.hasAttribute('disabled')).toBe(true);

    await userEvent.click(save);
    await settle();
    // Only the initial list load — nothing was sent.
    expect(fetcher).toHaveBeenCalledTimes(1);

    await userEvent.type(field, 'Named again');
    await settle();
    expect(screen.getByRole('button', { name: 'Save' }).hasAttribute('disabled')).toBe(false);
  });

  it('bounds the field at the same number the server refuses past', async () => {
    render({ fetcher: fetcherReturning(jsonResponse(200, { passkeys: [passkey()] })) });
    await settle();
    await openRename();

    const field = screen.getByRole('textbox', { name: 'Passkey name' }) as HTMLInputElement;
    // Read off the shared constant, not a literal: the point is that the field
    // and `validateDisplayName` cannot be given different numbers.
    expect(field.getAttribute('maxlength')).toBe(String(MAX_DISPLAY_NAME_LENGTH));
  });
});
