<script lang="ts">
  import { ReasoningDisclosure, type ChatReasoningPart } from '@urbicon-ui/blocks';

  // A finished reasoning trace. `durationMs` drives the "Thought for Xs" label;
  // the body stays collapsed by default so it never crowds the answer.
  const reasoning: ChatReasoningPart = {
    type: 'reasoning',
    durationMs: 4200,
    text: `The user is asking for a **date range**, so a single DatePicker will not do.

- \`DatePicker\` binds one \`Date\`.
- For two bounds I want the range preset, keeping one popover.

I'll suggest \`DatePicker\` with \`mode="range"\` and note the \`onValueChange\` shape.`
  };
</script>

<ReasoningDisclosure {reasoning} />
