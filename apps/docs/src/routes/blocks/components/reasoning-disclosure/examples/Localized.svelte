<script lang="ts">
  import { ReasoningDisclosure, type ChatReasoningPart } from '@urbicon-ui/blocks';

  const reasoning: ChatReasoningPart = {
    type: 'reasoning',
    durationMs: 3000,
    text: 'Kurz abgewogen: `Toast` fuer die Bestaetigung, kein `Dialog` — die Aktion ist nicht destruktiv.'
  };

  // formatDuration receives whole seconds; thinkingLabel / reasoningLabel cover
  // the streaming and no-duration cases. Together they fully localize the header.
  const formatDuration = (s: number) => `${s} Sekunden nachgedacht`;
</script>

<ReasoningDisclosure
  {reasoning}
  {formatDuration}
  thinkingLabel="Denke nach"
  reasoningLabel="Überlegung"
/>
