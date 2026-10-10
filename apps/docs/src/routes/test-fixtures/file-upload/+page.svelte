<script lang="ts">
  // E2E fixture for e2e/file-upload.spec.ts: FileUploads inside the scrollers a consumer puts
  // them in — a plain `overflow-auto` box that is not positioned, the same with `unstyled`, and
  // a Dialog body — each far enough down that focusing the upload has to scroll. The anchor
  // before each one is where the spec starts tabbing; the page spacer gives the page room to
  // jump, so a scroll that lands on the wrong box shows. Focus centres the 1px input at the
  // dropzone's top edge, so a box must be at least twice the dropzone's height to show all of it.
  import { Button, Dialog, FileUpload, FormField } from '@urbicon-ui/blocks';

  let dialogOpen = $state(false);
</script>

<svelte:head>
  <title>FileUpload Test Fixtures</title>
</svelte:head>

{#snippet upload(testid: string, unstyled = false)}
  <FormField label="Document" helper="PDF only">
    {#snippet children({ id, describedBy, invalid })}
      <FileUpload
        {id}
        {unstyled}
        data-testid={testid}
        aria-describedby={describedBy}
        aria-invalid={invalid || undefined}
      />
    {/snippet}
  </FormField>
{/snippet}

<div class="bg-surface-base p-8" data-testid="file-upload-fixtures">
  <h1 class="text-text-primary mb-6 text-xl font-bold">FileUpload fixtures</h1>

  <div class="max-w-md space-y-8">
    <section>
      <button type="button" data-anchor="in-scroller">anchor</button>
      <div data-testid="scroller-in-scroller" class="h-100 overflow-auto border">
        <div class="h-300"></div>
        {@render upload('in-scroller')}
      </div>
    </section>

    <section>
      <button type="button" data-anchor="in-scroller-unstyled">anchor</button>
      <div data-testid="scroller-in-scroller-unstyled" class="h-100 overflow-auto border">
        <div class="h-300"></div>
        {@render upload('in-scroller-unstyled', true)}
      </div>
    </section>

    <section>
      <Button data-testid="dialog-trigger" onclick={() => (dialogOpen = true)}>Open dialog</Button>
      <Dialog bind:open={dialogOpen} title="Upload">
        <button type="button" data-anchor="in-dialog">anchor</button>
        <div class="h-300"></div>
        {@render upload('in-dialog')}
      </Dialog>
    </section>
  </div>

  <div class="h-750"></div>
</div>
