<script lang="ts">
  import { PackOpener } from '@glazebot/shared-ui';
  import type { GachaCharacter } from '@glazebot/shared-types';
  import { openBoosterPack } from '@glazebot/supabase-client';

  let error = $state('');
  let collectionComplete = $state(false);

  async function handleRequestOpen(): Promise<{ characters: GachaCharacter[]; images: Record<string, string> }> {
    error = '';
    const result = await openBoosterPack();

    if ('collection_complete' in result && result.collection_complete) {
      collectionComplete = true;
      return { characters: [], images: {} };
    }

    const images: Record<string, string> = {};
    for (const c of result.characters) {
      if (c.avatar_url) {
        images[c.id] = c.avatar_url;
      }
    }

    return { characters: result.characters, images };
  }
</script>

<div class="page">
  {#if collectionComplete}
    <div class="complete-state">
      <h2>Collection Complete!</h2>
      <p>You've collected every character. Check your collection!</p>
    </div>
  {:else}
    <PackOpener onrequestopen={handleRequestOpen} />
  {/if}

  {#if error}
    <div class="error-toast">{error}</div>
  {/if}
</div>

<style>
  .page {
    display: flex;
    align-items: center;
    justify-content: center;
    height: 100%;
    padding: 24px;
    position: relative;
  }

  .complete-state {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 8px;
    color: var(--color-text-primary, #e2e8f0);
    text-align: center;
  }

  .complete-state h2 {
    font-size: 1.6rem;
    color: var(--color-pink, #FDB5CE);
    margin: 0;
  }

  .complete-state p {
    color: var(--color-text-secondary, rgba(255, 255, 255, 0.55));
    margin: 0;
  }

  .error-toast {
    position: absolute;
    bottom: 24px;
    left: 50%;
    transform: translateX(-50%);
    background: var(--error-a15);
    border: 1px solid var(--error-a20);
    color: var(--color-error);
    padding: 8px 16px;
    border-radius: 8px;
    font-size: 0.9rem;
  }
</style>
