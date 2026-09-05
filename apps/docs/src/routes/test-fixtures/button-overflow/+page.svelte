<script lang="ts">
  // Playwright fixture for e2e/button-overflow.spec.ts: a button's box holds its
  // label, and a label the box cannot hold truncates only where the consumer
  // asks for it. Every probe sits in a flex row narrower than its label. Not
  // part of the docs nav.
  import { Button, SearchIcon } from '@urbicon-ui/blocks';
</script>

<div class="bg-surface-base min-h-screen p-6" data-testid="button-overflow-fixtures">
  <h1 class="text-text-primary mb-6 text-xl font-bold">Button overflow fixtures</h1>

  <!-- A button the consumer lets shrink, with no side padding: the first glyph
       sits exactly on the box edge. -->
  <div class="mb-6 flex w-32">
    <Button data-probe="glyph" variant="text" class="min-w-0 px-0">Interaktionsmodell</Button>
  </div>

  <!-- Opt-in truncation: the button may shrink, the consumer's block clips. -->
  <div class="mb-6 flex w-40">
    <Button data-probe="truncate-child" class="min-w-0">
      <span class="block truncate">Interaktionsmodell und Verlauf</span>
    </Button>
  </div>

  <!-- Its twin without the ellipsis: the same clip, cut flat. -->
  <div class="mb-6 flex w-40">
    <Button data-probe="truncate-child-clip" class="min-w-0">
      <span class="block overflow-hidden [text-overflow:clip] whitespace-nowrap"
        >Interaktionsmodell und Verlauf</span
      >
    </Button>
  </div>

  <!-- An icon in a box narrower than icon + padding. -->
  <div class="mb-6">
    <Button data-probe="icon" size="sm" class="w-8" aria-label="Search">
      <SearchIcon class="h-4 w-4" />
    </Button>
  </div>

  <!-- A row that asks the button to shrink below its label. It must not. -->
  <div class="mb-6 flex w-56 items-center justify-between gap-2">
    <span class="text-text-secondary text-sm">Two nights, one guest, breakfast included</span>
    <Button data-probe="row" intent="primary">Book these nights</Button>
  </div>
</div>
