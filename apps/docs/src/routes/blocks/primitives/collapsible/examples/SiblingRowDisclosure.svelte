<script lang="ts">
  import { ChevronDownIcon, useDisclosure } from '@urbicon-ui/blocks';

  let open = $state(false);
  const propsId = $props.id();

  const detail = useDisclosure(() => ({
    open,
    triggerId: `entry-${propsId}-trigger`,
    contentId: `entry-${propsId}-detail`,
    onOpenChange: (next) => (open = next)
  }));
</script>

<div class="border-border-subtle grid w-full max-w-md grid-cols-[1fr_auto] gap-x-3 border-b py-2">
  <span class="text-text-primary self-center text-sm">Rebuild the deployment pipeline</span>

  <button
    {...detail.triggerProps}
    type="button"
    onclick={detail.toggle}
    class="text-text-tertiary hover:text-text-primary focus-visible:ring-primary/50 rounded-sm p-1 focus-visible:ring-2 focus-visible:outline-none"
  >
    <ChevronDownIcon size={16} class={detail.open ? 'rotate-180' : ''} />
    <span class="sr-only">{detail.open ? 'Hide' : 'Show'} details</span>
  </button>

  <!-- The revealed region is a SIBLING row spanning both columns, not a child
       of the trigger's cell. It stays mounted so the height can animate, which
       is what makes contentProps.inert load-bearing. -->
  <div
    {...detail.contentProps}
    class="col-span-2 grid overflow-hidden transition-[grid-template-rows] duration-[var(--blocks-collapse-duration)]"
    style:grid-template-rows={detail.open ? '1fr' : '0fr'}
  >
    <p class="text-text-secondary overflow-hidden text-sm">
      Three stages, two of them cacheable. Because the detail is its own row, the trigger cell keeps
      its size and the table columns stay aligned down the whole list.
    </p>
  </div>
</div>
