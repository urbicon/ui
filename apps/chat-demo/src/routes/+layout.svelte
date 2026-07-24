<script lang="ts">
  import '../app.css';

  let { children } = $props();
</script>

<div class="flex h-dvh flex-col bg-surface-base text-text-primary">
  {@render children()}
</div>
