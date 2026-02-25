<script lang="ts">
  import { goto } from '$app/navigation';
  import { onMount } from 'svelte';

  // Dashboard redirects to packs by default
  onMount(() => {
    goto('/pack');
  });
</script>

<div class="redirect">
  <p>Redirecting...</p>
</div>

<style>
  .redirect {
    display: flex;
    align-items: center;
    justify-content: center;
    height: 100%;
    color: var(--color-text-muted);
  }
</style>
