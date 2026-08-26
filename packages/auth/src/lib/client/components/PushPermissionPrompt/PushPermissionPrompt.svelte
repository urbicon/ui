<script lang="ts">
  import { Button, Card, getBlocksConfig } from '@urbicon-ui/blocks';
  import { subscribeToPush } from '../../utils/service-worker.js';
  import { mergeAuthLocale, useAuthLocale } from '../../../i18n/index.js';
  import { csrfFetch } from '../../csrf.js';
  import { parseJsonBody, wireError } from '../../utils/http.js';
  import { resolveAuthSlotClasses } from '../../utils/slot-class.js';
  import FormErrorAlert from '../_shared/FormErrorAlert.svelte';
  import type { PushPermissionPromptProps } from './index.js';

  let {
    t: tProp,
    vapidPublicKey,
    apiPath = '/api/notifications/push-subscription',
    csrf,
    fetcher,
    onSubscribed,
    onDismissed,
    onUnavailable,
    unstyled: unstyledProp = false,
    slotClasses: slotClassesProp = {},
    preset,
    class: className
  }: PushPermissionPromptProps = $props();

  const blocksConfig = getBlocksConfig();
  const unstyled = $derived(unstyledProp || blocksConfig?.unstyled || false);
  const slotClasses = $derived(
    resolveAuthSlotClasses(blocksConfig, 'PushPermissionPrompt', preset, slotClassesProp)
  );

  const authLocale = useAuthLocale();
  const t = $derived(mergeAuthLocale(authLocale(), tProp));

  let visible = $state(true);
  let error = $state<string | null>(null);
  // Enabling push is not idempotent: a second in-flight subscribe races the
  // first POST and can answer with the endpoint conflict the user never caused.
  // Expressed once, as the Enable button's `loading` — that renders the busy
  // state AND swallows the second click. The `if (busy) return` guard the sibling
  // pages carry would be dead weight here: theirs also catches Enter-to-submit on
  // a <form>, and this prompt has no form, so `onclick` is the only way in.
  let busy = $state(false);

  async function handleEnable() {
    error = null;
    busy = true;
    try {
      const result = await subscribeToPush(vapidPublicKey);

      if (result.status === 'denied' || result.status === 'unsupported') {
        // A declined permission (or a browser without push) is not a failure:
        // close, and tell the caller which it was so it can persist the outcome
        // instead of remounting the prompt on every visit.
        visible = false;
        onUnavailable?.(result.status);
        return;
      }
      if (result.status === 'error') {
        // Operational failure before the server was ever reached (malformed
        // VAPID key, no service worker, push service down). Keep the prompt
        // open with feedback — and give the developer the real error, which
        // the localized message intentionally hides from the user.
        console.error('[auth] enabling push failed before reaching the server:', result.error);
        error = t.notifications.push.error;
        return;
      }

      try {
        const res = await csrfFetch(
          apiPath,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ subscription: result.subscription.toJSON() })
          },
          csrf,
          fetcher
        );
        if (res.ok) {
          // Report success only once the server has actually stored the
          // subscription — firing the callback on a failed POST would mislead the
          // caller into thinking push delivery is set up.
          onSubscribed?.(result.subscription);
          visible = false;
        } else {
          // Deterministic refusals get precise messages via the machine code
          // ("please try again" would loop forever on a 409); everything else
          // keeps the generic retryable text.
          const { code } = wireError(await parseJsonBody(res));
          if (code === 'push_endpoint_conflict') {
            error = t.notifications.push.errorConflict;
          } else if (code === 'push_subscription_limit') {
            error = t.notifications.push.errorLimit;
          } else if (res.status === 429) {
            error = t.notifications.push.errorRateLimited;
          } else {
            error = t.notifications.push.error;
          }
        }
      } catch (err) {
        // Network error etc. — keep the prompt open WITH feedback so the user
        // can retry or dismiss; closing silently would leave no trace that
        // enabling failed (this was the one component without an error path).
        console.error('[auth] push subscription request failed:', err);
        error = t.notifications.push.error;
      }
    } finally {
      // Every branch above is one the user can retry from — the prompt stays
      // open unless it closed itself — so the flag has to clear on all of them.
      busy = false;
    }
  }

  function handleDismiss() {
    visible = false;
    onDismissed?.();
  }
</script>

{#if visible}
  <Card
    variant="quiet"
    padding="md"
    {unstyled}
    class={unstyled
      ? [slotClasses.root, className].filter(Boolean).join(' ')
      : ['border-border-subtle border', slotClasses.root, className].filter(Boolean).join(' ')}
  >
    <p
      class={unstyled
        ? slotClasses.text
        : ['text-text-secondary text-sm', slotClasses.text].filter(Boolean).join(' ')}
    >
      {t.notifications.push.prompt}
    </p>
    <FormErrorAlert
      error={error ?? ''}
      {unstyled}
      class={unstyled ? slotClasses.error : ['mt-2', slotClasses.error].filter(Boolean).join(' ')}
    />
    <div
      class={unstyled
        ? slotClasses.actions
        : ['mt-3 flex gap-2', slotClasses.actions].filter(Boolean).join(' ')}
    >
      <Button
        variant="filled"
        intent="primary"
        size="sm"
        loading={busy}
        onclick={handleEnable}
        {unstyled}
      >
        {t.notifications.push.enable}
      </Button>
      <Button variant="ghost" intent="neutral" size="sm" onclick={handleDismiss} {unstyled}>
        {t.notifications.push.dismiss}
      </Button>
    </div>
  </Card>
{/if}
