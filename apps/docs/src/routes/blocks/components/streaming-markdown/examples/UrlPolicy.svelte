<script lang="ts">
  import { StreamingMarkdown } from '@urbicon-ui/blocks';

  // Untrusted model output. The strict-by-default URL policy neutralizes every
  // hostile shape without any extra configuration.
  const content = `A [normal link](https://ui.urbicon.de) renders as a real link.

A [scheme-smuggled link](javascript:alert(1)) becomes inert text with a dotted
underline — the URL never reaches the DOM.

External images are blocked and shown as an alt-text chip:
![remote tracker](https://evil.example/track.gif)

Raw HTML stays literal text, never parsed: <img src=x onerror="alert(1)">`;
</script>

<StreamingMarkdown {content} headingLevelStart={3} />
