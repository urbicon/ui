<script lang="ts">
  import type { SvelteDocsConfig } from '@urbicon-ui/shared-types';
  import { CodeExample, Section } from '@urbicon-ui/docs';
  import { Progress } from '@urbicon-ui/blocks';

  export const docsConfig: SvelteDocsConfig = {
    generation: {
      overview: { enabled: false },
      playground: {
        featured: ['intent', 'size', 'shape', 'showValue', 'striped', 'animated'],
        defaults: { intent: 'primary', size: 'md' },
        enabled: true,
        order: 1
      },
      variants: { enabled: false },
      examples: false,
      api: { showInheritance: true, enabled: true, order: 14 },
      usage: false
    },
    llm: {
      include: true,
      maxSections: 8,
      priority: ['overview', 'examples', 'real-world', 'patterns', 'variants', 'api'],
      excludeTypes: ['playground']
    },
    meta: { title: 'Progress Component', showToc: true }
  };
</script>

<!-- ─── Examples ─── -->

<Section marker="01" id="examples" title="Examples">
  <div class="space-y-8">
    <CodeExample
      title="Custom value format"
      description="Override the value display with `formatValue` — typical for step counters, storage limits, or units."
      isolate
      previewClass="flex flex-col gap-4 max-w-md w-full"
    >
      <Progress value={3} max={5} label="Steps" showValue formatValue={(v, m) => `${v} of ${m}`} />
      <Progress value={750} max={1000} label="Storage" showValue formatValue={(v) => `${v} MB`} />
    </CodeExample>

    <CodeExample
      title="Profile completion"
      description="Track multi-field completion with a value label that drives user action."
      isolate
      previewClass="flex justify-center max-w-md w-full mx-auto"
    >
      <div class="border-border-subtle bg-surface-elevated w-full space-y-3 rounded-2xl border p-5">
        <div class="flex items-center justify-between">
          <span class="text-text-primary text-sm font-medium">Complete your profile</span>
          <span class="text-text-tertiary text-xs">3 of 5 steps</span>
        </div>
        <Progress
          value={60}
          intent="success"
          size="sm"
          label="Profile completion"
          formatValue={() => '60%'}
        />
        <p class="text-text-tertiary text-xs">
          Add a profile photo and verify your email to finish.
        </p>
      </div>
    </CodeExample>
  </div>
</Section>

<!-- ─── Customization ─── -->

<Section marker="02" id="customization" title="Customization">
  <div class="space-y-8">
    <CodeExample
      title="Upload Progress"
      description="Progress bar in a realistic file upload context."
      isolate
      previewClass="flex justify-center max-w-md w-full mx-auto"
    >
      <div class="border-border-subtle bg-surface-elevated w-full space-y-3 rounded-2xl border p-5">
        <div class="flex items-center justify-between">
          <span class="text-text-primary text-sm font-medium">project-assets.zip</span>
          <span class="text-text-tertiary text-xs">12.4 MB / 18.6 MB</span>
        </div>
        <Progress value={67} intent="primary" size="sm" striped animated />
      </div>
    </CodeExample>

    <CodeExample title="Dashboard Stats" description="Circular progress for key metrics." isolate>
      <div class="flex gap-8">
        <div class="flex flex-col items-center gap-2">
          <Progress value={92} shape="circular" intent="success" showValue size="lg" />
          <span class="text-text-secondary text-xs font-medium">Uptime</span>
        </div>
        <div class="flex flex-col items-center gap-2">
          <Progress value={67} shape="circular" intent="warning" showValue size="lg" />
          <span class="text-text-secondary text-xs font-medium">CPU</span>
        </div>
        <div class="flex flex-col items-center gap-2">
          <Progress value={34} shape="circular" intent="primary" showValue size="lg" />
          <span class="text-text-secondary text-xs font-medium">Memory</span>
        </div>
      </div>
    </CodeExample>
  </div>
</Section>

<!-- ─── Accessibility ─── -->

<Section marker="03" id="accessibility" title="Accessibility">
  <div class="border-border-subtle bg-surface-elevated rounded-2xl border p-6">
    <div class="divide-border-subtle divide-y">
      <div class="pb-4">
        <h4 class="text-text-primary mb-1.5 text-sm font-semibold">ARIA Progressbar</h4>
        <p class="text-text-secondary text-sm leading-relaxed">
          Uses <code class="text-text-primary">role="progressbar"</code> with
          <code class="text-text-primary">aria-valuenow</code>,
          <code class="text-text-primary">aria-valuemin</code>, and
          <code class="text-text-primary">aria-valuemax</code>. In indeterminate mode,
          <code class="text-text-primary">aria-valuenow</code> is omitted to signal unknown progress.
        </p>
      </div>
      <div class="py-4">
        <h4 class="text-text-primary mb-1.5 text-sm font-semibold">Label</h4>
        <p class="text-text-secondary text-sm leading-relaxed">
          The <code class="text-text-primary">label</code> prop is set as
          <code class="text-text-primary">aria-label</code> on the progressbar element so screen readers
          announce the purpose of the indicator.
        </p>
      </div>
      <div class="pt-4">
        <h4 class="text-text-primary mb-1.5 text-sm font-semibold">Reduced Motion</h4>
        <p class="text-text-secondary text-sm leading-relaxed">
          Indeterminate animation, striped animation, and circular spin are all suppressed when
          <code class="text-text-primary">prefers-reduced-motion</code> is enabled. The progress indicator
          remains visible in a static state.
        </p>
      </div>
    </div>
  </div>
</Section>
