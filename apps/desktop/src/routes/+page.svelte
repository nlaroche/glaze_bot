<script lang="ts">
  import { onMount } from "svelte";

  let greeting = $state("Loading...");

  onMount(() => {
    greeting = "Welcome to GlazeBot";
  });
</script>

<main>
  <h1>{greeting}</h1>
  <p>Your AI gaming companion is ready.</p>
</main>

<style>
  main {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    height: 100vh;
    font-family: system-ui, sans-serif;
    background: #1a1a2e;
    color: #e0e0e0;
  }

  h1 {
    font-size: 2rem;
    margin-bottom: 0.5rem;
  }
</style>
