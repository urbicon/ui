<!--
  The booking card the agent builds in the landing's Agents tile.

  This is the REAL file the replay's `urbicon validate` lines were recorded
  against (see $lib/landing/AgentReplay.svelte) — the tile reveals it step by
  step while the terminal replays the build. Salon data comes from
  $lib/salon-tools: the same services and stylists as tiles 01–03.
-->
<script lang="ts">
  import { Button, Card, RadioGroup, RadioItem, Select } from '@urbicon-ui/blocks';
  import { SERVICES, STYLISTS } from '$lib/salon-tools';

  /** How much of the card exists yet — the replay raises it as the agent works. */
  let { step = 3 }: { step?: number } = $props();

  let service = $state('bleecker');
  let stylist = $state<string | null>('io');

  const chosen = $derived(SERVICES.find((s) => s.id === service));
</script>

<Card>
  {#snippet header()}
    <p class="text-sm font-semibold text-text-primary">Book a chair</p>
  {/snippet}

  {#if step >= 1}
    <RadioGroup label="Service" bind:value={service} size="sm">
      {#each SERVICES as option (option.id)}
        <RadioItem value={option.id} label={option.label} description={option.price} />
      {/each}
    </RadioGroup>
  {/if}

  {#if step >= 2}
    <div class="mt-4">
      <Select
        label="Chair"
        size="sm"
        options={STYLISTS.map((s) => ({ label: s.name, value: s.id }))}
        bind:value={stylist}
      />
    </div>
  {/if}

  {#if step >= 3}
    <div class="mt-4 flex items-center justify-between gap-3">
      <span class="text-xs text-text-tertiary">{chosen?.price} · {chosen?.minutes} min</span>
      <Button intent="primary" size="sm">Reserve</Button>
    </div>
  {/if}
</Card>
