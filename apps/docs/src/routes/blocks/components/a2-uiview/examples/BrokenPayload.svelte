<script lang="ts">
  import { A2UIView, A2UI_CATALOG_ID, type A2uiValidationIssue } from '@urbicon-ui/blocks';

  // Whitelist-only and fail-loud: a component outside the mapped subset never
  // reaches the DOM. `Video` is not in the basic subset, so it renders as a
  // visible fault chip in place of the node — and the same fault surfaces
  // through `onValidationError` as a spec-compatible issue a consumer can relay
  // back to the agent as an A2UI `error` message.
  const payload: unknown[] = [
    { version: 'v0.9.1', createSurface: { surfaceId: 'broken', catalogId: A2UI_CATALOG_ID } },
    {
      version: 'v0.9.1',
      updateComponents: {
        surfaceId: 'broken',
        components: [
          { id: 'root', component: 'Card', child: 'col' },
          { id: 'col', component: 'Column', children: ['heading', 'clip'] },
          { id: 'heading', component: 'Text', text: 'Product tour', variant: 'h4' },
          { id: 'clip', component: 'Video', url: 'https://example.com/tour.mp4' }
        ]
      }
    }
  ];

  let issues = $state<A2uiValidationIssue[]>([]);
</script>

<div class="space-y-3">
  <div class="mx-auto max-w-sm">
    <A2UIView {payload} onValidationError={(next) => (issues = next)} />
  </div>

  {#if issues.length}
    <ul class="text-text-secondary space-y-1 text-xs">
      {#each issues as issue (`${issue.code}-${issue.path ?? ''}-${issue.message}`)}
        <li>
          <span
            class={[
              'font-mono uppercase',
              issue.severity === 'error' ? 'text-danger' : 'text-warning'
            ]}>{issue.severity}</span
          >
          <span class="text-text-tertiary font-mono">{issue.code}</span> — {issue.message}
        </li>
      {/each}
    </ul>
  {/if}
</div>
