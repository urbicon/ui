<script lang="ts">
  import { Button, InfoCircleIcon, Tooltip } from '@urbicon-ui/blocks';

  interface Props {
    /** Definition shown in the tooltip. */
    text: string;
    /** The term being explained. It becomes the trigger's aria-label ("Explanation: HeizKV § 7"). */
    term: string;
    /** 'warning' or 'danger' for legally or safety-relevant hints. */
    intent?: 'neutral' | 'warning' | 'danger';
  }

  let { text, term, intent = 'neutral' }: Props = $props();
</script>

<Tooltip label={text} {intent}>
  <Button size="2xs" variant="ghost" aria-label="Explanation: {term}">
    <InfoCircleIcon class="h-3.5 w-3.5" />
  </Button>
</Tooltip>
