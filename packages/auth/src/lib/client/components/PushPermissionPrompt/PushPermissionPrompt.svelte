<script lang="ts">
  import { Alert, Button, Card } from '@urbicon-ui/blocks';
  import { subscribeToPush } from '../../utils/service-worker.js';
  import { useAuthLocale } from '../../../i18n/index.js';
  import { csrfFetch } from '../../csrf.js';
  import type { PushPermissionPromptProps } from './index.js';

  let {
    t: tProp,
    vapidPublicKey,
    subscriptionEndpoint = '/api/notifications/push-subscription',
    csrf,
    fetcher,
    onSubscribed,
    onDismissed,
    onUnavailable,
    unstyled = false,
    slotClasses = {},
    class: className
  }: PushPermissionPromptProps = $props();

  const authLocale = useAuthLocale();
  const t = $derived(tProp ?? authLocale());

  let visible = $state(true);
  let error = $state<string | null>(null);

  async function handleEnable() {
    error = null;
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
        subscriptionEndpoint,
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
      } else if (res.status === 409) {
        // Deterministic server refusals (endpoint owned by another account /
        // device limit reached) — "please try again" would loop forever.
        error = t.notifications.push.errorConflict;
      } else if (res.status === 429) {
        error = t.notifications.push.errorRateLimited;
      } else {
        error = t.notifications.push.error;
      }
    } catch (err) {
      // Network error etc. — keep the prompt open WITH feedback so the user
      // can retry or dismiss; closing silently would leave no trace that
      // enabling failed (this was the one component without an error path).
      console.error('[auth] push subscription request failed:', err);
      error = t.notifications.push.error;
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
    <div aria-live="polite" class={slotClasses.error}>
      {#if error}
        <div class={unstyled ? undefined : 'mt-2'}>
          <Alert intent="danger" size="sm" {unstyled}>{error}</Alert>
        </div>
      {/if}
    </div>
    <div
      class={unstyled
        ? slotClasses.actions
        : ['mt-3 flex gap-2', slotClasses.actions].filter(Boolean).join(' ')}
    >
      <Button variant="filled" intent="primary" size="sm" onclick={handleEnable} {unstyled}>
        {t.notifications.push.enable}
      </Button>
      <Button variant="ghost" intent="neutral" size="sm" onclick={handleDismiss} {unstyled}>
        {t.notifications.push.dismiss}
      </Button>
    </div>
  </Card>
{/if}
