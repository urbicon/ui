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
  There is nothing to render here: the listener is headless. In your app,
  <code>onNotification</code> fires on each message from the stream, and the connection reconnects on
  drop with exponential backoff (1s–30s, up to 5 attempts).
</Alert>
