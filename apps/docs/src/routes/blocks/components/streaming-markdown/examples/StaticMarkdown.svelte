<script lang="ts">
  import { StreamingMarkdown } from '@urbicon-ui/blocks';

  // A settled answer (streaming={false}): GFM tables and task lists render the
  // same whether the text arrived all at once or chunk by chunk.
  const content = `## Release checklist

| Step     | Owner    | Status  |
| -------- | -------- | ------- |
| Freeze   | Platform | Done    |
| Sign-off | QA       | Pending |

Remaining work:

- [x] Bump the version
- [x] Regenerate the docs
- [ ] Publish the tag
`;
</script>

<StreamingMarkdown {content} headingLevelStart={3} />
