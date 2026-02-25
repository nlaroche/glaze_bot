<script lang="ts">
  import type { GachaCharacter } from '@glazebot/shared-types';
  import ProceduralAvatar from './ProceduralAvatar.svelte';
  import RarityBadge from './RarityBadge.svelte';

  interface Props {
    character: GachaCharacter;
    flipped?: boolean;
    onflip?: () => void;
    onclick?: () => void;
  }

  let { character, flipped = false, onflip, onclick }: Props = $props();

  import type { Personality } from '@glazebot/shared-types';

  const traits = ['energy', 'positivity', 'formality', 'talkativeness', 'attitude', 'humor'] as const;

  function traitValue(p: Personality | undefined, t: keyof Personality): number {
    return p?.[t] ?? 50;
  }

  function handleClick() {
    if (onflip) onflip();
    if (onclick) onclick();
  }
</script>

<button class="card rarity-{character.rarity}" class:flipped onclick={handleClick} data-testid="character-card" data-character-id={character.id} data-rarity={character.rarity}>
  <div class="card-inner">
    <!-- Back face (hidden until flipped) -->
    <div class="card-back">
      <div class="card-back-pattern">
        <div class="logo">?</div>
      </div>
    </div>
    <!-- Front face -->
    <div class="card-front">
      <div class="card-header">
        <ProceduralAvatar seed={character.avatar_seed} rarity={character.rarity} size={64} />
        <div class="card-info">
          <h3 class="name" data-testid="character-name">{character.name}</h3>
          <RarityBadge rarity={character.rarity} />
        </div>
      </div>
      <p class="description">{character.description}</p>
      <div class="stats">
        {#each traits as trait}
          <div class="stat-row">
            <span class="stat-label">{trait.slice(0, 3).toUpperCase()}</span>
            <div class="stat-bar">
              <div
                class="stat-fill rarity-{character.rarity}"
                style="width: {traitValue(character.personality, trait)}%"
              ></div>
            </div>
            <span class="stat-value">{traitValue(character.personality, trait)}</span>
          </div>
        {/each}
      </div>
    </div>
  </div>
</button>

<style>
  .card {
    width: 220px;
    height: 320px;
    perspective: 800px;
    cursor: pointer;
    background: none;
    border: none;
    padding: 0;
    color: inherit;
    font: inherit;
  }

  .card-inner {
    position: relative;
    width: 100%;
    height: 100%;
    transform-style: preserve-3d;
    transition: transform 0.6s cubic-bezier(0.4, 0, 0.2, 1);
  }

  .card.flipped .card-inner {
    transform: rotateY(180deg);
  }

  .card-front, .card-back {
    position: absolute;
    inset: 0;
    backface-visibility: hidden;
    border-radius: 12px;
    overflow: hidden;
  }

  .card-front {
    transform: rotateY(180deg);
    background: var(--glass-bg);
    border: 1px solid var(--glass-border);
    padding: 12px;
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .card-back {
    background: linear-gradient(135deg, var(--color-navy), #1a3a5c);
    border: 1px solid var(--glass-border);
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .card-back-pattern {
    width: 80%;
    height: 80%;
    border: 2px solid rgba(255, 255, 255, 0.1);
    border-radius: 8px;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .logo {
    font-size: 3rem;
    color: var(--color-text-muted);
    font-weight: 700;
  }

  /* Rarity glows */
  .card.rarity-epic .card-front {
    box-shadow: var(--glow-epic);
  }

  .card.rarity-legendary .card-front {
    box-shadow: var(--glow-legendary);
  }

  .card-header {
    display: flex;
    gap: 8px;
    align-items: center;
  }

  .card-info {
    display: flex;
    flex-direction: column;
    gap: 4px;
    min-width: 0;
  }

  .name {
    font-size: 0.9rem;
    font-weight: 700;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    margin: 0;
  }

  .description {
    font-size: 0.7rem;
    color: var(--color-text-secondary);
    line-height: 1.3;
    overflow: hidden;
    display: -webkit-box;
    -webkit-line-clamp: 2;
    -webkit-box-orient: vertical;
    margin: 0;
  }

  .stats {
    display: flex;
    flex-direction: column;
    gap: 3px;
    margin-top: auto;
  }

  .stat-row {
    display: flex;
    align-items: center;
    gap: 4px;
  }

  .stat-label {
    font-size: 0.6rem;
    font-weight: 600;
    color: var(--color-text-muted);
    width: 28px;
    flex-shrink: 0;
  }

  .stat-bar {
    flex: 1;
    height: 4px;
    background: rgba(255, 255, 255, 0.08);
    border-radius: 2px;
    overflow: hidden;
  }

  .stat-fill {
    height: 100%;
    border-radius: 2px;
    transition: width 0.5s ease-out;
  }

  .stat-fill.rarity-common { background: var(--rarity-common); }
  .stat-fill.rarity-rare { background: var(--rarity-rare); }
  .stat-fill.rarity-epic { background: var(--rarity-epic); }
  .stat-fill.rarity-legendary { background: var(--rarity-legendary); }

  .stat-value {
    font-size: 0.6rem;
    color: var(--color-text-muted);
    width: 20px;
    text-align: right;
    flex-shrink: 0;
  }
</style>
