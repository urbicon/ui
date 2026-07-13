<script lang="ts">
  // E2E fixture for the Dialog/Drawer modal-promotion guard (e2e/overlay-modal.spec.ts):
  // triggers open a structured Dialog (with a nested ConfirmDialog) and a Drawer so the
  // spec can assert :modal top-layer promotion, initial focus, ESC close, and focus
  // restore. The static token-probe section at the bottom feeds e2e/token-smoke.spec.ts —
  // deliberately no global transition-kill style here, the smoke test reads computed
  // transition durations off these probes.
  import { Button, Card, ConfirmDialog, Dialog, Drawer, Input } from '@urbicon-ui/blocks';

  let dialogOpen = $state(false);
  let drawerOpen = $state(false);
  let confirmOpen = $state(false);
  let confirmedCount = $state(0);
</script>

<svelte:head>
  <title>Overlay Modal Test Fixtures</title>
</svelte:head>

<div class="bg-surface-base min-h-screen p-8" data-testid="dialog-fixtures">
  <h1 class="text-text-primary mb-6 text-xl font-bold">Overlay modal fixtures</h1>

  <div class="flex gap-4">
    <Button data-testid="dialog-trigger" onclick={() => (dialogOpen = true)}>Open dialog</Button>
    <Button data-testid="drawer-trigger" onclick={() => (drawerOpen = true)}>Open drawer</Button>
  </div>

  <Dialog bind:open={dialogOpen} title="Fixture dialog" data-testid="dialog-el">
    <p class="text-text-secondary mb-4 text-sm">Dialog body content.</p>
    <Input placeholder="Type here" data-testid="dialog-input" />
    <Button
      data-testid="nested-trigger"
      variant="outlined"
      class="mt-4"
      onclick={() => (confirmOpen = true)}
    >
      Delete item
    </Button>
    {#snippet footer()}
      <Button variant="ghost" data-testid="dialog-close" onclick={() => (dialogOpen = false)}>
        Close
      </Button>
    {/snippet}
  </Dialog>

  <ConfirmDialog
    bind:open={confirmOpen}
    title="Delete item?"
    description="This action cannot be undone."
    intent="danger"
    onConfirm={() => {
      confirmedCount += 1;
    }}
  />

  <Drawer bind:open={drawerOpen} title="Fixture drawer" data-testid="drawer-el">
    <p class="text-text-secondary mb-4 text-sm">Drawer body content.</p>
    <Button data-testid="drawer-inner-button">Drawer action</Button>
  </Drawer>

  <output class="text-text-secondary mt-6 block text-sm" data-testid="confirm-count">
    {confirmedCount}
  </output>

  <!-- Static token probes for e2e/token-smoke.spec.ts: an elevated Card consumes the
       shadow + tier-radius + motion token families; the Button consumes commit radius
       and the fast duration token. -->
  <section data-testid="token-probe" class="mt-12 max-w-sm space-y-4">
    <Card variant="elevated" padding="md" data-testid="probe-card">
      <p class="text-text-primary text-sm">Elevated card probe.</p>
    </Card>
    <Button data-testid="probe-button">Probe button</Button>
  </section>
</div>
