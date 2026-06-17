<script lang="ts">
  import { Alert } from '@urbicon-ui/blocks';
</script>

<Alert intent="primary" size="sm">
  NotificationListener is a headless component with no visual output. It connects to an SSE stream
  and fires <code>onNotification</code> callbacks. Reconnects automatically with exponential backoff (1s–30s,
  max 5 attempts).
</Alert>

<div class="mt-4 space-y-1">
  <p class="text-text-secondary text-sm">Typical usage:</p>
  <pre class="bg-surface-subtle text-text-primary rounded-md p-3 text-xs"><code
      >&lt;NotificationListener
  onNotification=&#123;(n) => store.add(n)&#125;
  onReconnect=&#123;(attempt) => console.log('Reconnecting...', attempt)&#125;
/&gt;</code
    ></pre>
</div>
