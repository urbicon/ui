<script lang="ts">
  import { Button, Card, RadioGroup, RadioItem, Select } from '@urbicon-ui/blocks';
  import { HOUSES, ROOM_TYPES, type HotelHouse } from '$lib/hotel-tools';

  let room = $state('garden');
  let house = $state<string | null>('cala');

  const chosen = $derived(ROOM_TYPES.find((r) => r.id === room));
  const mapHouses = (h: HotelHouse) => ({ label: `${h.name} — ${h.place}`, value: h.id });
</script>

<Card>
  {#snippet header()}
    <p class="text-text-primary text-sm font-semibold">Book a stay</p>
  {/snippet}

  <RadioGroup label="Room" bind:value={room} size="sm">
    {#each ROOM_TYPES as option (option.id)}
      <RadioItem value={option.id} label={option.label} description={`€${option.price} a night`} />
    {/each}
  </RadioGroup>

  <div class="mt-4">
    <Select label="House" size="sm" options={HOUSES.map(mapHouses)} bind:value={house} />
  </div>

  <div class="mt-4 flex items-center justify-between gap-3">
    <span class="text-text-tertiary text-xs">
      €{chosen?.price} a night · breakfast till noon
    </span>
    <Button intent="primary" size="sm">Reserve</Button>
  </div>
</Card>
