<script lang="ts">
  import type { GachaCharacter, Personality } from '@glazebot/shared-types';
  import ProceduralAvatar from './ProceduralAvatar.svelte';
  import RarityBadge from './RarityBadge.svelte';

  interface Props {
    character: GachaCharacter;
    onclose: () => void;
    onaddtoparty?: (character: GachaCharacter) => void;
  }

  let { character, onclose, onaddtoparty }: Props = $props();

  const traits = ['energy', 'positivity', 'formality', 'talkativeness', 'attitude', 'humor'] as const;

  function traitValue(p: Personality | undefined, t: keyof Personality): number {
    return p?.[t] ?? 50;
  }

  const traitLabels: Record<string, string> = {
    energy: 'Energy',
    positivity: 'Positivity',
    formality: 'Formality',
    talkativeness: 'Talkativeness',
    attitude: 'Attitude',
    humor: 'Humor',
  };
</script>

<!-- svelte-ignore a11y_click_events_have_key_events -->
<!-- svelte-ignore a11y_no_static_element_interactions -->
<div class="overlay" onclick={onclose} data-testid="character-detail-overlay">
  <div class="modal rarity-{character.rarity}" onclick={(e) => e.stopPropagation()} data-testid="character-detail-modal" data-character-id={character.id}>
    <button class="close-btn" onclick={onclose} data-testid="close-detail">&times;</button>

    <div class="header">
      <ProceduralAvatar seed={character.avatar_seed} rarity={character.rarity} size={100} />
      <div class="header-info">
        <h2 data-testid="detail-character-name">{character.name}</h2>
        <RarityBadge rarity={character.rarity} />
        {#if character.voice_name}
          <p class="voice">Voice: {character.voice_name}</p>
        {/if}
      </div>
    </div>

    <p class="description" data-testid="detail-description">{character.description}</p>

    {#if character.backstory}
      <div class="section">
        <h3>Backstory</h3>
        <p data-testid="detail-backstory">{character.backstory}</p>
      </div>
    {/if}

    <div class="section">
      <h3>Personality</h3>
      <div class="trait-grid" data-testid="detail-traits">
        {#each traits as trait}
          <div class="trait" data-testid="trait-{trait}">
            <div class="trait-header">
              <span class="trait-name">{traitLabels[trait]}</span>
              <span class="trait-value">{traitValue(character.personality, trait)}</span>
            </div>
            <div class="trait-bar">
              <div
                class="trait-fill rarity-{character.rarity}"
                style="width: {traitValue(character.personality, trait)}%"
              ></div>
            </div>
          </div>
        {/each}
      </div>
    </div>

    {#if onaddtoparty}
      <button class="party-btn" onclick={() => onaddtoparty?.(character)} data-testid="add-to-party-btn">
        Add to Party
      </button>
    {/if}
  </div>
</div>

<style>
  .overlay {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.6);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 100;
    backdrop-filter: blur(4px);
  }

  .modal {
    background: var(--color-navy);
    border: 1px solid var(--glass-border);
    border-radius: 16px;
    padding: var(--space-6);
    max-width: 480px;
    width: 90%;
    max-height: 80vh;
    overflow-y: auto;
    position: relative;
  }

  .modal.rarity-epic { box-shadow: var(--glow-epic); }
  .modal.rarity-legendary { box-shadow: var(--glow-legendary); }

  .close-btn {
    position: absolute;
    top: var(--space-3);
    right: var(--space-3);
    background: none;
    border: none;
    color: var(--color-text-muted);
    font-size: 1.5rem;
    cursor: pointer;
    padding: var(--space-1);
    line-height: 1;
  }

  .close-btn:hover { color: var(--color-text-primary); }

  .header {
    display: flex;
    gap: var(--space-4);
    align-items: center;
    margin-bottom: var(--space-4);
  }

  .header-info {
    display: flex;
    flex-direction: column;
    gap: var(--space-1);
  }

  .header-info h2 {
    font-size: 1.3rem;
    margin: 0;
  }

  .voice {
    font-size: var(--font-brand-md);
    color: var(--color-text-muted);
  }

  .description {
    color: var(--color-text-secondary);
    font-size: var(--font-base);
    line-height: 1.5;
    margin-bottom: var(--space-4);
  }

  .section {
    margin-bottom: var(--space-4);
  }

  .section h3 {
    font-size: var(--font-base);
    color: var(--color-text-muted);
    margin-bottom: var(--space-2);
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }

  .section p {
    color: var(--color-text-secondary);
    font-size: var(--font-sm);
    line-height: 1.5;
  }

  .trait-grid {
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
  }

  .trait-header {
    display: flex;
    justify-content: space-between;
    margin-bottom: var(--space-0-5);
  }

  .trait-name {
    font-size: var(--font-brand-md);
    color: var(--color-text-secondary);
  }

  .trait-value {
    font-size: var(--font-brand-md);
    color: var(--color-text-muted);
  }

  .trait-bar {
    height: 6px;
    background: var(--white-a8);
    border-radius: var(--radius-xs);
    overflow: hidden;
  }

  .trait-fill {
    height: 100%;
    border-radius: var(--radius-xs);
    transition: width 0.5s ease-out;
  }

  .trait-fill.rarity-common { background: var(--rarity-common); }
  .trait-fill.rarity-rare { background: var(--rarity-rare); }
  .trait-fill.rarity-epic { background: var(--rarity-epic); }
  .trait-fill.rarity-legendary { background: var(--rarity-legendary); }

  .party-btn {
    width: 100%;
    padding: var(--space-2-5);
    border: none;
    border-radius: var(--radius-lg);
    background: var(--color-teal);
    color: white;
    font-size: var(--font-base);
    font-weight: 600;
    cursor: pointer;
    font-family: inherit;
    transition: background var(--transition-slow);
  }

  .party-btn:hover { background: #4ab0b0; }
</style>
