<script lang="ts">
  import { Badge, Button, Checkbox, Input, Select, Separator, Spinner } from '@urbicon-ui/blocks';
  import FormErrorAlert from '../_shared/FormErrorAlert.svelte';
  import { onMount, untrack } from 'svelte';
  import { mergeAuthLocale, useAuthLocale } from '../../../i18n/index.js';
  import { csrfFetch } from '../../csrf.js';
  import type { InvitationManagerProps } from './index.js';
  import { errorTextFromBody } from '../../utils/http.js';
  import { slotClass } from '../../utils/slot-class.js';

  interface InvitationItem {
    id: string;
    email: string;
    role: string;
    usedAt: string | null;
    createdAt: string;
  }

  let {
    t: tProp,
    roles,
    basePath = '/api/invitations',
    csrf,
    fetcher,
    unstyled = false,
    slotClasses = {},
    class: className
  }: InvitationManagerProps = $props();

  const authLocale = useAuthLocale();
  const t = $derived(mergeAuthLocale(authLocale(), tProp));

  // Wrapped so the default path calls the global fetch unbound-safe; a custom
  // fetcher (demo mock, test double, retry layer) takes precedence.
  const doFetch: typeof globalThis.fetch = (input, init) =>
    fetcher ? fetcher(input, init) : fetch(input, init);

  let invitations = $state<InvitationItem[]>([]);
  let email = $state('');
  // Seed the dropdown with the first role once; `roles` is a static prop, so we
  // untrack the read to make "initial value only" explicit (state_referenced_locally).
  let role = $state(untrack(() => roles[0]?.value ?? ''));
  let sendEmail = $state(true);
  let error = $state('');
  let loading = $state(true);
  let submitting = $state(false);

  async function loadInvitations() {
    loading = true;
    try {
      const res = await doFetch(basePath);
      if (!res.ok) {
        // A 401/500 must not render as "no invitations yet".
        error = t.common.error;
        return;
      }
      const data = await res.json();
      invitations = data.invitations ?? [];
    } catch {
      // Surface the failure instead of rendering the empty state, which is
      // indistinguishable from "no invitations yet".
      error = t.auth.errors.networkError;
    } finally {
      loading = false;
    }
  }

  async function handleSendInvitation(e: SubmitEvent) {
    e.preventDefault();
    error = '';
    submitting = true;

    try {
      const res = await csrfFetch(
        basePath,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, role, sendEmail })
        },
        csrf,
        fetcher
      );
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;
        error = errorTextFromBody(data, t);
        return;
      }
      email = '';
      await loadInvitations();
    } catch {
      error = t.auth.errors.networkError;
    } finally {
      submitting = false;
    }
  }

  async function deleteInvitation(id: string) {
    error = '';
    try {
      const res = await csrfFetch(`${basePath}/${id}`, { method: 'DELETE' }, csrf, fetcher);
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        error = errorTextFromBody(data, t);
        return;
      }
      // Drop it locally only once the server confirms — an unchecked optimistic
      // remove would hide a failed delete that still exists on the server.
      invitations = invitations.filter((inv) => inv.id !== id);
    } catch {
      error = t.auth.errors.networkError;
    }
  }

  // Fire-once load on mount — not an $effect: this must run exactly once, and
  // re-running on a reactive read would re-fetch the list needlessly.
  onMount(() => {
    loadInvitations();
  });

  // Styling helper: in `unstyled` mode only the slot override applies.
  const cls = (base: string, slot?: string) => slotClass(unstyled, base, slot);
</script>

<div class={cls('flex flex-col gap-6', [slotClasses.root, className].filter(Boolean).join(' '))}>
  <h2 class={cls('text-text-primary text-xl font-semibold', slotClasses.title)}>
    {t.invitations.title}
  </h2>

  <FormErrorAlert {error} {unstyled} class={slotClasses.error} />

  <form onsubmit={handleSendInvitation} class={cls('flex flex-col gap-4', slotClasses.form)}>
    <div class={cls('grid gap-3 sm:grid-cols-[1fr_auto]')}>
      <Input label={t.invitations.email} type="email" bind:value={email} required {unstyled} />
      <Select
        label={t.invitations.role}
        options={roles.map((r) => ({ value: r.value, label: r.label }))}
        bind:value={role}
        size="md"
        {unstyled}
        class={cls('sm:w-44')}
      />
    </div>

    <Checkbox bind:checked={sendEmail} label={t.invitations.sendEmail} {unstyled} />

    <Button
      type="submit"
      variant="filled"
      intent="primary"
      loading={submitting}
      disabled={submitting}
      {unstyled}
      class={cls('w-full sm:w-auto sm:self-start')}
    >
      {t.invitations.send}
    </Button>
  </form>

  <Separator {unstyled} />

  {#if loading}
    <div class={cls('flex justify-center py-4')}>
      <Spinner size="sm" {unstyled} />
    </div>
  {:else if invitations.length === 0}
    <p class={cls('text-text-tertiary py-4 text-center text-sm')}>
      {t.invitations.empty}
    </p>
  {:else}
    <ul class={cls('flex flex-col gap-2', slotClasses.list)}>
      {#each invitations as inv (inv.id)}
        <li
          class={cls(
            'bg-surface-subtle border-border-subtle flex items-center justify-between gap-3 rounded-lg border px-4 py-3',
            slotClasses.item
          )}
        >
          <div class={cls('flex min-w-0 flex-col gap-0.5')}>
            <span class={cls('text-text-primary truncate text-sm font-medium')}>{inv.email}</span>
            <span class={cls('text-text-tertiary text-xs')}>{inv.role}</span>
          </div>
          <div class={cls('flex shrink-0 items-center gap-3')}>
            <Badge intent={inv.usedAt ? 'neutral' : 'success'} variant="soft" size="sm" {unstyled}>
              {inv.usedAt ? t.invitations.registered : t.invitations.pending}
            </Badge>
            {#if !inv.usedAt}
              <Button
                variant="ghost"
                intent="danger"
                size="sm"
                onclick={() => deleteInvitation(inv.id)}
                aria-label={`${t.invitations.delete} — ${inv.email}`}
                {unstyled}
              >
                {t.invitations.delete}
              </Button>
            {/if}
          </div>
        </li>
      {/each}
    </ul>
  {/if}
</div>
