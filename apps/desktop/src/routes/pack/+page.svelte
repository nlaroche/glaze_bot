<script lang="ts">
  import { PackOpener } from '@glazebot/shared-ui';
  import type { GachaCharacter, CharacterRarity } from '@glazebot/shared-types';
  import { openBoosterPack } from '@glazebot/supabase-client';

  let error = $state('');
  let collectionComplete = $state(false);
  let demoMode = $state(false);

  const rarities: CharacterRarity[] = ['common', 'rare', 'epic', 'legendary'];

  function makeMockCharacter(index: number): GachaCharacter {
    const rarity = rarities[Math.floor(Math.random() * rarities.length)];
    const names = ['Pixel', 'Neon', 'Blitz', 'Surge', 'Echo', 'Drift', 'Glitch', 'Flux'];
    const name = names[Math.floor(Math.random() * names.length)];
    return {
      id: `demo-${Date.now()}-${index}`,
      user_id: 'demo',
      name: `${name} ${rarity[0].toUpperCase()}${rarity.slice(1)}`,
      description: `A ${rarity} demo character for testing animations.`,
      backstory: 'Born in the demo realm.',
      system_prompt: 'You are a demo character.',
      rarity,
      avatar_seed: `demo-${index}`,
      is_active: true,
      is_default: false,
      created_at: new Date().toISOString(),
    };
  }

  async function handleRequestOpen(): Promise<{ characters: GachaCharacter[]; images: Record<string, string> }> {
    if (demoMode) {
      await new Promise(r => setTimeout(r, 800 + Math.random() * 600));
      return {
        characters: [makeMockCharacter(0), makeMockCharacter(1), makeMockCharacter(2)],
        images: {},
      };
    }

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

  <label class="demo-toggle">
    <input type="checkbox" bind:checked={demoMode} />
    Demo mode
  </label>
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

  .demo-toggle {
    position: absolute;
    bottom: 16px;
    right: 16px;
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: 0.75rem;
    color: rgba(255, 255, 255, 0.35);
    cursor: pointer;
    user-select: none;
  }

  .demo-toggle input {
    accent-color: var(--color-pink, #FDB5CE);
  }
</style>
