<script lang="ts">
  import SeoMeta from '$lib/SeoMeta.svelte';
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
  import { CodeExample, Section } from '@urbicon-ui/docs';
  import { recipeMeta } from './meta';
  import RecipeHeader from '../RecipeHeader.svelte';
  import RecipeFeatures from '../RecipeFeatures.svelte';

  const { features } = recipeMeta;

  let billing = $state<'monthly' | 'annual'>('annual');
  let annual = $derived(billing === 'annual');

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

  const recipeCode =
    `<script lang="ts">
  import { Card, Badge, Button, Separator, SegmentGroup, SegmentItem, Tooltip } from '@urbicon-ui/blocks';

  let billing = $state<'monthly' | 'annual'>('annual');
  let annual = $derived(billing === 'annual');

  const plans = [
    {
      name: 'Starter', priceMonthly: 9, priceAnnual: 7, highlighted: false,
      description: 'Perfect for individuals and small projects.',
      features: [
        { text: '5 projects', included: true },
        { text: '10 GB storage', included: true },
        { text: 'Basic analytics', included: true },
        { text: 'Email support', included: true },
        { text: 'Custom domains', included: false },
        { text: 'Team collaboration', included: false }
      ]
    },
    {
      name: 'Professional', priceMonthly: 29, priceAnnual: 24, highlighted: true,
      description: 'Best for growing teams and businesses.',
      features: [
        { text: 'Unlimited projects', included: true },
        { text: '100 GB storage', included: true },
        { text: 'Advanced analytics', included: true },
        { text: 'Priority email support', included: true },
        { text: 'Custom domains', included: true },
        { text: 'Team collaboration (up to 10)', included: true }
      ]
    },
    {
      name: 'Enterprise', priceMonthly: 79, priceAnnual: 66, highlighted: false,
      description: 'For large organizations with advanced needs.',
      features: [
        { text: 'Unlimited projects', included: true },
        { text: 'Unlimited storage', included: true },
        { text: 'Enterprise analytics', included: true },
        { text: 'Dedicated support', included: true },
        { text: 'Custom domains', included: true },
        { text: 'Unlimited team members', included: true }
      ]
    }
  ];
</scr` +
    `ipt>

<div class="text-center mb-10">
  <h3 class="text-2xl font-bold text-text-primary mb-2">Simple, transparent pricing</h3>
  <p class="text-text-secondary mb-6">Choose the plan that fits your needs.</p>

  <SegmentGroup bind:value={billing} size="sm">
    <SegmentItem value="monthly">Monthly</SegmentItem>
    <SegmentItem value="annual">
      Annual
      <Badge variant="soft" intent="success" size="sm" class="ml-1">Save 20%</Badge>
    </SegmentItem>
  </SegmentGroup>
</div>

<div class="grid grid-cols-1 md:grid-cols-3 gap-6 items-start">
  {#each plans as plan (plan.name)}
    <Card class="relative overflow-hidden transition-shadow {plan.highlighted
      ? 'border-primary ring-1 ring-primary/20 scale-[1.02] shadow-lg'
      : 'hover:shadow-md'}">
      {#if plan.highlighted}
        <div class="bg-primary px-4 py-1.5 text-center text-xs font-semibold text-text-on-primary">
          Most Popular
        </div>
      {/if}
      <div class="p-6">
        <h4 class="text-lg font-semibold text-text-primary">{plan.name}</h4>
        <p class="text-sm text-text-tertiary mt-1">{plan.description}</p>
        <div class="my-6">
          <span class="text-4xl font-bold text-text-primary">
            \${annual ? plan.priceAnnual : plan.priceMonthly}
          </span>
          <span class="text-sm text-text-tertiary">/month</span>
          {#if annual}
            <p class="text-xs text-text-quaternary mt-1">Billed \${plan.priceAnnual * 12}/year</p>
          {/if}
        </div>
        <Button intent={plan.highlighted ? 'primary' : 'neutral'}
          variant={plan.highlighted ? 'filled' : 'outlined'} class="w-full">
          Get started
        </Button>
        <Separator class="my-6" />
        <ul class="space-y-3">
          {#each plan.features as feature (feature.text)}
            <li class="flex items-start gap-2 text-sm {feature.included
              ? 'text-text-secondary' : 'text-text-disabled'}">
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
      </div>
    </Card>
  {/each}
</div>`;
</script>

<SeoMeta title="Pricing Cards Recipe" description={recipeMeta.description} />

<div class="mx-auto max-w-6xl px-6 py-12">
  <RecipeHeader meta={recipeMeta} />

  <div class="grid grid-cols-1 gap-10 xl:grid-cols-3">
    <!-- Live Preview (2 cols) -->
    <div class="xl:col-span-2">
      <Section id="preview" title="Live Preview">
        <div
          class="border-border-subtle bg-surface-base mt-4 rounded-xl border p-8 shadow-[var(--blocks-shadow-md)]"
        >
          <!-- Header -->
          <div class="mb-10 text-center">
            <p class="text-text-primary mb-2 text-2xl font-bold">Simple, transparent pricing</p>
            <p class="text-text-secondary mb-6">
              Choose the plan that fits your needs. Upgrade or downgrade anytime.
            </p>

            <!-- Billing Toggle -->
            <SegmentGroup bind:value={billing} size="sm">
              <SegmentItem value="monthly">Monthly</SegmentItem>
              <SegmentItem value="annual">
                Annual
                <Badge variant="soft" intent="success" size="sm" class="ml-1">Save 20%</Badge>
              </SegmentItem>
            </SegmentGroup>
          </div>

          <!-- Plans Grid -->
          <div class="grid grid-cols-1 items-start gap-6 md:grid-cols-3">
            {#each plans as plan (plan.name)}
              <Card
                class="border-border-subtle relative overflow-hidden transition-shadow duration-[var(--blocks-duration-fast)] {plan.highlighted
                  ? 'border-primary ring-primary/20 scale-[1.02] shadow-[var(--blocks-shadow-lg)] ring-1'
                  : 'hover:border-border-emphasis hover:shadow-[var(--blocks-shadow-md)]'}"
              >
                {#if plan.highlighted}
                  <div
                    class="bg-primary text-text-on-primary px-4 py-1.5 text-center text-xs font-semibold"
                  >
                    Most Popular
                  </div>
                {/if}

                <div class="p-6">
                  <p class="text-text-primary text-lg font-semibold">{plan.name}</p>
                  <p class="text-text-tertiary mt-1 text-sm">{plan.description}</p>

                  <div class="my-6">
                    <div class="flex items-baseline gap-1">
                      <span class="text-text-primary text-4xl font-bold">
                        ${annual ? plan.priceAnnual : plan.priceMonthly}
                      </span>
                      <span class="text-text-tertiary text-sm">/month</span>
                    </div>
                    {#if annual}
                      <p class="text-text-quaternary mt-1 text-xs">
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
                </div>
              </Card>
            {/each}
          </div>
        </div>
      </Section>
    </div>

    <!-- Sidebar -->
    <div class="space-y-8">
      <Section id="features" title="Key Features">
        <RecipeFeatures {features} />
      </Section>
    </div>
  </div>

  <!-- Source Code -->
  <Section id="code" title="Code" class="mt-12">
    <CodeExample title="Pricing Cards Recipe" code={recipeCode} language="svelte" preview={false} />
  </Section>
</div>
