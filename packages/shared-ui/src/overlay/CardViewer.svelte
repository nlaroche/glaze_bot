<script lang="ts">
  import type { GachaCharacter, Personality } from '@glazebot/shared-types';
  import Spotlight from './Spotlight.svelte';
  import CharacterCard from '../gacha/CharacterCard.svelte';
  import RarityBadge from '../gacha/RarityBadge.svelte';
  import { onMount } from 'svelte';

  interface Props {
    character: GachaCharacter | null;
    image?: string;
    onclose: () => void;
  }

  let { character, image, onclose }: Props = $props();

  const open = $derived(character !== null);

  // Staggered reveal
  let showInfo = $state(false);
  let showTraits = $state(false);

  $effect(() => {
    if (open) {
      showInfo = false;
      showTraits = false;
      const t1 = setTimeout(() => { showInfo = true; }, 150);
      const t2 = setTimeout(() => { showTraits = true; }, 400);
      return () => { clearTimeout(t1); clearTimeout(t2); };
    } else {
      showInfo = false;
      showTraits = false;
    }
  });

  // Tagline audio playback
  let audioEl: HTMLAudioElement | null = $state(null);
  let isPlaying = $state(false);

  function toggleTaglineAudio() {
    if (!character?.tagline_url) return;

    if (isPlaying && audioEl) {
      audioEl.pause();
      audioEl.currentTime = 0;
      isPlaying = false;
      return;
    }

    audioEl = new Audio(character.tagline_url);
    audioEl.onended = () => { isPlaying = false; };
    audioEl.onerror = () => { isPlaying = false; };
    audioEl.play();
    isPlaying = true;
  }

  // Stop audio when closing
  $effect(() => {
    if (!open && audioEl) {
      audioEl.pause();
      audioEl = null;
      isPlaying = false;
    }
  });

  // Personality traits config
  const traitKeys = ['energy', 'positivity', 'formality', 'talkativeness', 'attitude', 'humor'] as const;
  const traitLabels: Record<typeof traitKeys[number], string> = {
    energy: 'Energy',
    positivity: 'Positivity',
    formality: 'Formality',
    talkativeness: 'Talkativeness',
    attitude: 'Attitude',
    humor: 'Humor',
  };

  function traitStars(p: Personality | undefined, key: keyof Personality): number {
    const val = p?.[key] ?? 50;
    return Math.max(1, Math.min(4, Math.round(val / 25)));
  }

  const rarityColor: Record<string, string> = {
    common: 'var(--rarity-common)',
    rare: 'var(--rarity-rare)',
    epic: 'var(--rarity-epic)',
    legendary: 'var(--rarity-legendary)',
  };
</script>

<Spotlight {open} {onclose}>
  {#if character}
    <div class="viewer-layout">
      <!-- Left: Card (scaled up) -->
      <div class="viewer-card" class:show={showInfo}>
        <div class="card-scale-wrapper">
          <CharacterCard
            {character}
            flipped={true}
            {image}
          />
        </div>
      </div>

      <!-- Right: Info panel -->
      <div class="info-panel" class:show={showInfo}>
        <!-- Name + Rarity badge -->
        <div class="info-header">
          <div class="name-block">
            <h2 class="char-name" style="color: {rarityColor[character.rarity]}">{character.name}</h2>
            <RarityBadge rarity={character.rarity} />
          </div>
        </div>

        <!-- Tagline with play button -->
        {#if character.tagline}
          <div class="tagline-row">
            <p class="tagline">"{character.tagline}"</p>
            {#if character.tagline_url}
              <button
                class="play-btn rarity-{character.rarity}"
                class:playing={isPlaying}
                onclick={toggleTaglineAudio}
                title={isPlaying ? 'Stop' : 'Play tagline'}
              >
                {#if isPlaying}
                  <svg width="20" height="20" viewBox="0 0 16 16" fill="currentColor">
                    <rect x="3" y="3" width="4" height="10" rx="1" />
                    <rect x="9" y="3" width="4" height="10" rx="1" />
                  </svg>
                {:else}
                  <svg width="20" height="20" viewBox="0 0 16 16" fill="currentColor">
                    <polygon points="4,2 14,8 4,14" />
                  </svg>
                {/if}
              </button>
            {/if}
          </div>
        {/if}

        <!-- Scrollable content area -->
        <div class="info-scroll">
          <!-- Description -->
          {#if character.description}
            <div class="info-section">
              <h3 class="section-label">Description</h3>
              <p class="section-text">{character.description}</p>
            </div>
          {/if}

          <!-- Backstory -->
          {#if character.backstory}
            <div class="info-section">
              <h3 class="section-label">Backstory</h3>
              <p class="section-text backstory-text">{character.backstory}</p>
            </div>
          {/if}

          <!-- Personality Traits — Star System -->
          {#if character.personality}
            <div class="info-section">
              <h3 class="section-label">Personality</h3>
              <div class="traits">
                {#each traitKeys as key, i}
                  <div class="trait" style="transition-delay: {showTraits ? i * 60 : 0}ms;" class:show={showTraits}>
                    <span class="trait-label">{traitLabels[key]}</span>
                    <div class="stars">
                      {#each Array(4) as _, s}
                        <svg
                          class="star"
                          class:filled={s < traitStars(character.personality, key)}
                          width="18"
                          height="18"
                          viewBox="0 0 24 24"
                          style="--star-color: {rarityColor[character.rarity]}"
                        >
                          <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
                        </svg>
                      {/each}
                    </div>
                  </div>
                {/each}
              </div>
            </div>
          {/if}
        </div>
      </div>
    </div>
  {/if}
</Spotlight>

<style>
  .viewer-layout {
    display: flex;
    align-items: center;
    gap: 10rem;
    max-height: 85vh;
    pointer-events: auto;
  }

  /* ── Card side (scaled up) ── */
  .viewer-card {
    flex-shrink: 0;
    transform: translateX(-40px);
    opacity: 0;
    transition: transform 0.5s cubic-bezier(0.34, 1.56, 0.64, 1), opacity 0.4s ease;
  }

  .viewer-card.show {
    transform: translateX(0);
    opacity: 1;
  }

  .card-scale-wrapper {
    transform: scale(1.25);
    transform-origin: center center;
  }

  /* ── Info panel ── */
  .info-panel {
    width: 400px;
    display: flex;
    flex-direction: column;
    gap: var(--space-4, 1rem);
    max-height: 85vh;
    transform: translateX(30px);
    opacity: 0;
    transition: transform 0.5s cubic-bezier(0.34, 1.56, 0.64, 1) 0.1s, opacity 0.4s ease 0.1s;
  }

  .info-panel.show {
    transform: translateX(0);
    opacity: 1;
  }

  /* ── Header ── */
  .info-header {
    display: flex;
    flex-direction: column;
    gap: var(--space-2, 0.5rem);
  }

  .name-block {
    display: flex;
    align-items: center;
    gap: var(--space-3, 0.75rem);
  }

  .char-name {
    font-family: var(--font-brand, 'Plus Jakarta Sans', sans-serif);
    font-size: 2rem;
    font-weight: 800;
    margin: 0;
    letter-spacing: -0.02em;
    text-shadow: 0 2px 12px rgba(0, 0, 0, 0.5);
  }

  /* ── Tagline ── */
  .tagline-row {
    display: flex;
    align-items: center;
    gap: var(--space-3, 0.75rem);
  }

  .tagline {
    font-size: var(--font-lg, 1.05rem);
    color: var(--color-text-primary, #e2e8f0);
    font-style: italic;
    margin: 0;
    line-height: 1.5;
    flex: 1;
  }

  .play-btn {
    flex-shrink: 0;
    width: 42px;
    height: 42px;
    border-radius: var(--radius-full, 50%);
    border: 2px solid;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: transform 0.2s, box-shadow 0.2s, background 0.2s;
  }

  .play-btn.rarity-common {
    background: rgba(160, 174, 192, 0.15);
    border-color: rgba(160, 174, 192, 0.4);
    color: var(--rarity-common, #A0AEC0);
  }
  .play-btn.rarity-common:hover {
    background: rgba(160, 174, 192, 0.3);
    box-shadow: 0 0 14px rgba(160, 174, 192, 0.3);
    transform: scale(1.12);
  }

  .play-btn.rarity-rare {
    background: rgba(59, 151, 151, 0.15);
    border-color: rgba(59, 151, 151, 0.4);
    color: var(--rarity-rare, #3B9797);
  }
  .play-btn.rarity-rare:hover {
    background: rgba(59, 151, 151, 0.3);
    box-shadow: 0 0 14px rgba(59, 151, 151, 0.3);
    transform: scale(1.12);
  }

  .play-btn.rarity-epic {
    background: rgba(176, 106, 255, 0.15);
    border-color: rgba(176, 106, 255, 0.4);
    color: var(--rarity-epic, #B06AFF);
  }
  .play-btn.rarity-epic:hover {
    background: rgba(176, 106, 255, 0.3);
    box-shadow: 0 0 14px rgba(176, 106, 255, 0.3);
    transform: scale(1.12);
  }

  .play-btn.rarity-legendary {
    background: rgba(255, 215, 0, 0.15);
    border-color: rgba(255, 215, 0, 0.4);
    color: var(--rarity-legendary, #FFD700);
  }
  .play-btn.rarity-legendary:hover {
    background: rgba(255, 215, 0, 0.3);
    box-shadow: 0 0 14px rgba(255, 215, 0, 0.3);
    transform: scale(1.12);
  }

  .play-btn.playing {
    animation: pulse-glow 1.5s ease-in-out infinite;
  }

  @keyframes pulse-glow {
    0%, 100% { box-shadow: 0 0 8px rgba(176, 106, 255, 0.2); }
    50% { box-shadow: 0 0 20px rgba(176, 106, 255, 0.5); }
  }

  /* ── Scrollable content ── */
  .info-scroll {
    flex: 1;
    overflow-y: auto;
    display: flex;
    flex-direction: column;
    gap: var(--space-4, 1rem);
    padding-right: var(--space-2, 0.5rem);
    max-height: calc(85vh - 140px);
  }

  .info-scroll::-webkit-scrollbar {
    width: 4px;
  }

  .info-scroll::-webkit-scrollbar-thumb {
    background: var(--white-a10, rgba(255,255,255,0.1));
    border-radius: 2px;
  }

  .info-section {
    display: flex;
    flex-direction: column;
    gap: var(--space-1-5, 0.375rem);
  }

  .section-label {
    font-size: var(--font-sm, 0.8rem);
    text-transform: uppercase;
    letter-spacing: 1.5px;
    color: var(--color-text-secondary, #8793A6);
    font-weight: 600;
    margin: 0;
  }

  .section-text {
    font-size: 1rem;
    color: var(--color-text-primary, #e2e8f0);
    line-height: 1.7;
    margin: 0;
  }

  .backstory-text {
    display: -webkit-box;
    -webkit-line-clamp: 6;
    line-clamp: 6;
    -webkit-box-orient: vertical;
    overflow: hidden;
  }

  /* ── Star ratings ── */
  .traits {
    display: flex;
    flex-direction: column;
    gap: var(--space-2, 0.5rem);
  }

  .trait {
    display: flex;
    align-items: center;
    gap: var(--space-3, 0.75rem);
    opacity: 0;
    transform: translateY(6px);
    transition: opacity 0.35s ease, transform 0.35s ease;
  }

  .trait.show {
    opacity: 1;
    transform: translateY(0);
  }

  .trait-label {
    width: 110px;
    font-size: var(--font-base, 0.875rem);
    color: var(--color-text-primary, #e2e8f0);
    font-weight: 500;
    flex-shrink: 0;
  }

  .stars {
    display: flex;
    gap: 4px;
  }

  .star {
    fill: rgba(255, 255, 255, 0.12);
    stroke: rgba(255, 255, 255, 0.25);
    stroke-width: 1;
    transition: fill 0.3s ease, filter 0.3s ease, stroke 0.3s ease;
  }

  .star.filled {
    fill: #FFD700;
    stroke: #FFD700;
    filter: drop-shadow(0 0 5px rgba(255, 215, 0, 0.4));
  }
</style>
