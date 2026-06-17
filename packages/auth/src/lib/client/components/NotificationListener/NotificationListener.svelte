<script lang="ts">
  import { onMount } from 'svelte';
  import type { NotificationListenerProps } from './index.js';

  let {
    basePath = '/api/notifications/stream',
    maxReconnectAttempts = 5,
    onNotification,
    onError,
    onReconnect
  }: NotificationListenerProps = $props();

  onMount(() => {
    let eventSource: EventSource | null = null;
    let reconnectAttempts = 0;
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
    let disposed = false;

    function connect() {
      if (disposed) return;

      eventSource = new EventSource(basePath);

      eventSource.onopen = () => {
        reconnectAttempts = 0;
      };

      eventSource.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (data.type === 'notification' && data.notification) {
            onNotification?.(data.notification);
          }
        } catch {
          // Ignore malformed data
        }
      };

      eventSource.onerror = (event) => {
        onError?.(event);
        eventSource?.close();
        eventSource = null;

        if (disposed) return;

        if (reconnectAttempts < maxReconnectAttempts) {
          reconnectAttempts++;
          const delay = Math.min(1000 * Math.pow(2, reconnectAttempts - 1), 30000);
          onReconnect?.(reconnectAttempts);
          reconnectTimer = setTimeout(connect, delay);
        }
      };
    }

    connect();

    return () => {
      disposed = true;
      eventSource?.close();
      if (reconnectTimer) clearTimeout(reconnectTimer);
    };
  });
</script>
