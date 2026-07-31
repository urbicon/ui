<script lang="ts">
  import { Button, Card, RadioGroup, RadioItem, Select } from '@urbicon-ui/blocks';
  import { SERVICES, STYLISTS } from '$lib/salon-tools';

  let service = $state('bleecker');
  let stylist = $state<string | null>('io');

  const chosen = $derived(SERVICES.find((s) => s.id === service));
</script>

<Card>
  {#snippet header()}
    <p class="text-sm font-semibold text-text-primary">Book a chair</p>
  {/snippet}

  <RadioGroup label="Service" bind:value={service} size="sm">
    {#each SERVICES as option (option.id)}
      <RadioItem value={option.id} label={option.label} description={option.price} />
    {/each}
  </RadioGroup>

  <div class="mt-4">
    <Select
      label="Chair"
      size="sm"
      options={STYLISTS.map((s) => ({ label: s.name, value: s.id }))}
      bind:value={stylist}
    />
  </div>

  <div class="mt-4 flex items-center justify-between gap-3">
    <span class="text-xs text-text-tertiary">{chosen?.price} · {chosen?.minutes} min</span>
    <Button intent="primary" size="sm">Reserve</Button>
  </div>
</Card>
