<script lang="ts">
  // Auth will be wired up here
</script>

<main>
  <h1>GlazeBot Portal</h1>
  <p>Sign in to manage your characters and settings.</p>
  <button>Sign in with Discord</button>
</main>

<style>
  main {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    min-height: 100vh;
    font-family: system-ui, sans-serif;
    background: #1a1a2e;
    color: #e0e0e0;
    text-align: center;
  }

  button {
    margin-top: 1rem;
    padding: 0.75rem 1.5rem;
    background: #5865f2;
    color: white;
    border: none;
    border-radius: 0.5rem;
    font-size: 1rem;
    cursor: pointer;
  }

  button:hover {
    background: #4752c4;
  }
</style>
