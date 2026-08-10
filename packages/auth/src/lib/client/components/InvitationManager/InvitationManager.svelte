<script lang="ts">
  import { Badge, Button, Checkbox, Input, Select, Separator, Spinner } from '@urbicon-ui/blocks';
  import FormErrorAlert from '../_shared/FormErrorAlert.svelte';
  import { onMount, untrack } from 'svelte';
  import { mergeAuthLocale, useAuthLocale } from '../../../i18n/index.js';
  import { csrfFetch } from '../../csrf.js';
  import type { InvitationManagerProps } from './index.js';
  import { errorTextFromBody, getJson } from '../../utils/http.js';
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
    apiPath = '/api/invitations',
    csrf,
    fetcher,
    unstyled = false,
    slotClasses = {},
    class: className
  }: InvitationManagerProps = $props();

  const authLocale = useAuthLocale();
  const t = $derived(mergeAuthLocale(authLocale(), tProp));

  let invitations = $state<InvitationItem[]>([]);
  let email = $state('');
  // Seed the dropdown with the first role once; `roles` is a static prop, so we
  // untrack the read to make "initial value only" explicit (state_referenced_locally).
  let role = $state(untrack(() => roles[0]?.value ?? ''));
  let sendEmail = $state(true);
  let error = $state('');
  let loading = $state(true);
  let submitting = $state(false);
  // The invite URL comes back from the 201 and is shown until the next submit.
  // It carries the one-time token, so this is the only moment it exists outside
  // the recipient's mailbox — `list()` cannot return it, because the server
  // stores only the hash (#68).
  let lastInvite = $state<{ email: string; url: string; emailed: boolean } | null>(null);
  let copied = $state(false);

  async function copyInviteUrl() {
    if (!lastInvite) return;
    try {
      await navigator.clipboard.writeText(lastInvite.url);
      copied = true;
      setTimeout(() => {
        copied = false;
      }, 2000);
    } catch {
      // Clipboard access can be denied outright (permissions, insecure origin).
      // The URL is on screen and selectable either way, so this is not an error
      // state — it just means the button did nothing.
      copied = false;
    }
  }

  async function loadInvitations() {
    loading = true;
    try {
      const { ok, data } = await getJson(apiPath, { fetcher });
      if (!ok) {
        // A 401/500 must not render as "no invitations yet".
        error = errorTextFromBody(data, t);
        return;
      }
      invitations = (data.invitations as InvitationItem[] | undefined) ?? [];
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
        apiPath,
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
      const created = (await res.json().catch(() => ({}))) as {
        inviteUrl?: string;
        emailSent?: boolean;
      };
      if (created.inviteUrl) {
        lastInvite = { email, url: created.inviteUrl, emailed: created.emailSent === true };
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
      const res = await csrfFetch(
        `${apiPath}/${encodeURIComponent(id)}`,
        { method: 'DELETE' },
        csrf,
        fetcher
      );
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

  {#if lastInvite}
    <!--
      Shown once, right after creating. The link carries the invitation's
      one-time token and the server keeps only its hash, so re-reading the list
      can never produce it again — leaving this row is the only chance to hand
      the invitation over without a mail transport (#68).
    -->
    <div
      class={cls(
        'border-border-subtle bg-surface-subtle flex flex-col gap-2 rounded-lg border px-4 py-3',
        slotClasses.inviteLink
      )}
    >
      <p class={cls('text-text-secondary text-sm')}>
        {lastInvite.emailed
          ? t.invitations.linkSentAndCopyable.replace('{email}', lastInvite.email)
          : t.invitations.linkNotSent.replace('{email}', lastInvite.email)}
      </p>
      <div class={cls('flex items-center gap-2')}>
        <code
          class={cls(
            'bg-surface-base border-border-subtle text-text-primary min-w-0 flex-1 truncate rounded border px-2 py-1 font-mono text-xs'
          )}>{lastInvite.url}</code
        >
        <Button
          type="button"
          variant="outlined"
          intent="neutral"
          size="sm"
          onclick={copyInviteUrl}
          {unstyled}
        >
          {copied ? t.invitations.linkCopied : t.invitations.linkCopy}
        </Button>
      </div>
      <p class={cls('text-text-tertiary text-xs')}>
        {t.invitations.linkTrustNote}
      </p>
    </div>
  {/if}

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
