<script lang="ts">
  import {
    Badge,
    Button,
    Card,
    CheckIcon,
    CloseIcon,
    SegmentGroup,
    SegmentItem,
    Separator,
    Tooltip
  } from '@urbicon-ui/blocks';
  import { CodeExample, Note, NoteList, Section } from '@urbicon-ui/docs';
  import { recipeMeta } from './meta';
  import RecipeShell from '../RecipeShell.svelte';

  let billing = $state<'monthly' | 'annual'>('annual');
  let annual = $derived(billing === 'annual');

  // Both prices are hand-picked data: annual is not monthly × 0.8, so nothing
  // computes a discount, and the Save-20% badge on the toggle is copy.
  const plans = [
    {
      name: 'Starter',
      description: 'Perfect for individuals and small projects.',
      priceMonthly: 9,
      priceAnnual: 7,
      highlighted: false,
      features: [
        { text: '5 projects', included: true },
        { text: '10 GB storage', included: true },
        { text: 'Basic analytics', included: true },
        { text: 'Email support', included: true },
        { text: 'Custom domains', included: false },
        { text: 'Team collaboration', included: false },
        { text: 'Priority support', included: false }
      ]
    },
    {
      name: 'Professional',
      description: 'Best for growing teams and businesses.',
      priceMonthly: 29,
      priceAnnual: 24,
      highlighted: true,
      features: [
        { text: 'Unlimited projects', included: true },
        { text: '100 GB storage', included: true },
        { text: 'Advanced analytics', included: true },
        { text: 'Priority email support', included: true },
        { text: 'Custom domains', included: true },
        { text: 'Team collaboration (up to 10)', included: true },
        { text: 'Priority support', included: false }
      ]
    },
    {
      name: 'Enterprise',
      description: 'For large organizations with advanced needs.',
      priceMonthly: 79,
      priceAnnual: 66,
      highlighted: false,
      features: [
        { text: 'Unlimited projects', included: true },
        { text: 'Unlimited storage', included: true },
        { text: 'Enterprise analytics', included: true },
        { text: 'Dedicated support', included: true },
        { text: 'Custom domains', included: true },
        { text: 'Unlimited team members', included: true },
        { text: 'Priority support + SLA', included: true }
      ]
    }
  ];

  const recipeCode = `<\script lang="ts">
  import {
    Badge,
    Button,
    Card,
    CheckIcon,
    CloseIcon,
    SegmentGroup,
    SegmentItem,
    Separator,
    Tooltip
  } from '@urbicon-ui/blocks';

  let billing = $state<'monthly' | 'annual'>('annual');
  let annual = $derived(billing === 'annual');

  // Both prices are hand-picked data: annual is not monthly × 0.8, so nothing
  // computes a discount, and the Save-20% badge on the toggle is copy.
  const plans = [
    {
      name: 'Starter',
      description: 'Perfect for individuals and small projects.',
      priceMonthly: 9,
      priceAnnual: 7,
      highlighted: false,
      features: [
        { text: '5 projects', included: true },
        { text: '10 GB storage', included: true },
        { text: 'Basic analytics', included: true },
        { text: 'Email support', included: true },
        { text: 'Custom domains', included: false },
        { text: 'Team collaboration', included: false },
        { text: 'Priority support', included: false }
      ]
    },
    {
      name: 'Professional',
      description: 'Best for growing teams and businesses.',
      priceMonthly: 29,
      priceAnnual: 24,
      highlighted: true,
      features: [
        { text: 'Unlimited projects', included: true },
        { text: '100 GB storage', included: true },
        { text: 'Advanced analytics', included: true },
        { text: 'Priority email support', included: true },
        { text: 'Custom domains', included: true },
        { text: 'Team collaboration (up to 10)', included: true },
        { text: 'Priority support', included: false }
      ]
    },
    {
      name: 'Enterprise',
      description: 'For large organizations with advanced needs.',
      priceMonthly: 79,
      priceAnnual: 66,
      highlighted: false,
      features: [
        { text: 'Unlimited projects', included: true },
        { text: 'Unlimited storage', included: true },
        { text: 'Enterprise analytics', included: true },
        { text: 'Dedicated support', included: true },
        { text: 'Custom domains', included: true },
        { text: 'Unlimited team members', included: true },
        { text: 'Priority support + SLA', included: true }
      ]
    }
  ];
<\/script>

<div class="w-full">
  <div class="mb-10 text-center">
    <h2 class="text-text-primary mb-2 text-2xl font-bold">Simple, transparent pricing</h2>
    <p class="text-text-secondary mb-6">
      Choose the plan that fits your needs. Upgrade or downgrade anytime.
    </p>

    <SegmentGroup bind:value={billing} size="sm">
      <SegmentItem value="monthly">Monthly</SegmentItem>
      <SegmentItem value="annual">
        Annual
        <Badge variant="soft" intent="success" size="sm" class="ml-1">Save 20%</Badge>
      </SegmentItem>
    </SegmentGroup>
  </div>

  <div class="grid grid-cols-1 items-start gap-6 md:grid-cols-3">
    {#each plans as plan (plan.name)}
      <Card variant={plan.highlighted ? 'elevated' : 'quiet'}>
        <div class="flex items-center justify-between gap-2">
          <h3 class="text-text-primary text-lg font-semibold">{plan.name}</h3>
          {#if plan.highlighted}
            <Badge intent="primary" size="sm">Most popular</Badge>
          {/if}
        </div>
        <p class="text-text-tertiary mt-1 text-sm">{plan.description}</p>

        <div class="my-6">
          <div class="flex items-baseline gap-1">
            <span class="text-text-primary text-4xl font-bold">
              \${annual ? plan.priceAnnual : plan.priceMonthly}
            </span>
            <span class="text-text-tertiary text-sm">/month</span>
          </div>
          {#if annual}
            <p class="text-text-tertiary mt-1 text-xs">Billed \${plan.priceAnnual * 12}/year</p>
          {/if}
        </div>

        <Button
          intent={plan.highlighted ? 'primary' : 'neutral'}
          variant={plan.highlighted ? 'filled' : 'outlined'}
          class="w-full"
        >
          Get started
        </Button>

        <Separator class="my-6" />

        <ul class="space-y-3">
          {#each plan.features as feature (feature.text)}
            <li
              class="flex items-start gap-2 text-sm {feature.included
                ? 'text-text-secondary'
                : 'text-text-disabled'}"
            >
              {#if feature.included}
                <CheckIcon size={16} class="text-success mt-0.5" />
                {feature.text}
              {:else}
                <CloseIcon size={16} class="mt-0.5" />
                <Tooltip label="Available on higher-tier plans">
                  <span>{feature.text}</span>
                </Tooltip>
              {/if}
            </li>
          {/each}
        </ul>
      </Card>
    {/each}
  </div>
</div>`;
</script>

<RecipeShell meta={recipeMeta}>
  <Section id="preview" title="Live preview" titleHidden>
    <CodeExample
      title="PricingPage.svelte"
      description="Switch billing to `Monthly` and every price follows; hover a greyed-out feature for its tooltip."
      code={recipeCode}
      language="svelte"
      headingLevel={2}
    >
      <div class="w-full">
        <div class="mb-10 text-center">
          <h2 class="text-text-primary mb-2 text-2xl font-bold">Simple, transparent pricing</h2>
          <p class="text-text-secondary mb-6">
            Choose the plan that fits your needs. Upgrade or downgrade anytime.
          </p>

          <SegmentGroup bind:value={billing} size="sm">
            <SegmentItem value="monthly">Monthly</SegmentItem>
            <SegmentItem value="annual">
              Annual
              <Badge variant="soft" intent="success" size="sm" class="ml-1">Save 20%</Badge>
            </SegmentItem>
          </SegmentGroup>
        </div>

        <div class="grid grid-cols-1 items-start gap-6 md:grid-cols-3">
          {#each plans as plan (plan.name)}
            <Card variant={plan.highlighted ? 'elevated' : 'quiet'}>
              <div class="flex items-center justify-between gap-2">
                <h3 class="text-text-primary text-lg font-semibold">{plan.name}</h3>
                {#if plan.highlighted}
                  <Badge intent="primary" size="sm">Most popular</Badge>
                {/if}
              </div>
              <p class="text-text-tertiary mt-1 text-sm">{plan.description}</p>

              <div class="my-6">
                <div class="flex items-baseline gap-1">
                  <span class="text-text-primary text-4xl font-bold">
                    ${annual ? plan.priceAnnual : plan.priceMonthly}
                  </span>
                  <span class="text-text-tertiary text-sm">/month</span>
                </div>
                {#if annual}
                  <p class="text-text-tertiary mt-1 text-xs">
                    Billed ${plan.priceAnnual * 12}/year
                  </p>
                {/if}
              </div>

              <Button
                intent={plan.highlighted ? 'primary' : 'neutral'}
                variant={plan.highlighted ? 'filled' : 'outlined'}
                class="w-full"
              >
                Get started
              </Button>

              <Separator class="my-6" />

              <ul class="space-y-3">
                {#each plan.features as feature (feature.text)}
                  <li
                    class="flex items-start gap-2 text-sm {feature.included
                      ? 'text-text-secondary'
                      : 'text-text-disabled'}"
                  >
                    {#if feature.included}
                      <CheckIcon size={16} class="text-success mt-0.5" />
                      {feature.text}
                    {:else}
                      <CloseIcon size={16} class="mt-0.5" />
                      <Tooltip label="Available on higher-tier plans">
                        <span>{feature.text}</span>
                      </Tooltip>
                    {/if}
                  </li>
                {/each}
              </ul>
            </Card>
          {/each}
        </div>
      </div>
    </CodeExample>
  </Section>

  <Section id="decisions" title="Two decisions">
    <NoteList>
      <Note title="The recommended plan lifts, the rest recede">
        <p>
          One plan is recommended, so one card is
          <code class="text-text-primary">variant="elevated"</code>: the shadow puts it in front,
          the same cue every lifted panel in this library uses. The other plans recede as
          <code class="text-text-primary">variant="quiet"</code> instead of standing behind borders, and
          the colour arrives through the badge and the only filled primary button. A ring, a scale-up
          or a primary border would say the same thing again, louder, and the recommended card would stop
          reading as one of the family.
        </p>
      </Note>
      <Note title="Both prices are data, the badge is copy">
        <p>
          Each plan names <code class="text-text-primary">priceMonthly</code> and
          <code class="text-text-primary">priceAnnual</code>; nothing computes one from the other.
          Hand-picked price points do not land on one shared percentage (7 from 9 is 22% off, 66
          from 79 is 16%), so the Save 20% badge is copy: re-read it when the numbers change. The
          one derived figure is the billed-per-year line,
          <code class="text-text-primary">priceAnnual * 12</code>.
        </p>
      </Note>
    </NoteList>
  </Section>
</RecipeShell>
