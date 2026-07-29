<!--
  Vorschau-sichere Fassung von `Basic.svelte`.

  `NotificationListener` ist headless — es rendert nichts und öffnet beim Mount
  einen SSE-Stream. Beides macht es als Bühne untauglich: Es gäbe nichts zu
  sehen, und eine Doku-Seite soll keine offene Verbindung gegen einen Endpunkt
  halten, den es hier nicht gibt. Also erklärt die Vorschau, was das Bauteil tut;
  wie man es aufruft, steht im Code-Panel daneben (`Basic.svelte`).
-->
<script lang="ts">
  import { Alert } from '@urbicon-ui/blocks';
</script>

<Alert intent="primary" size="sm">
  NotificationListener is a headless component with no visual output. It connects to an SSE stream
  and fires <code>onNotification</code> callbacks. Reconnects automatically with exponential backoff (1s–30s,
  max 5 attempts).
</Alert>
