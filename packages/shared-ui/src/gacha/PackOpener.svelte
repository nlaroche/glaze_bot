<script lang="ts">
  import type { GachaCharacter } from '@glazebot/shared-types';
  import { openBoosterPack, getDailyPacksRemaining } from '@glazebot/supabase-client';
  import CharacterCard from './CharacterCard.svelte';

  type Phase = 'idle' | 'shake' | 'burst' | 'reveal' | 'done';

  let phase: Phase = $state('idle');
  let characters: GachaCharacter[] = $state([]);
  let flippedCards: boolean[] = $state([false, false, false]);
  let cardVisible: boolean[] = $state([false, false, false]);
  let packsRemaining: number = $state(-1);
  let resetsAt: string = $state('');
  let error: string = $state('');
  let loading: boolean = $state(false);
  let particles: { id: number; rarity: string; x: number; y: number; dx: number; dy: number; delay: number }[] = $state([]);
  let legendaryFlash: boolean = $state(false);
  let screenShake: boolean = $state(false);

  let particleIdCounter = 0;

  $effect(() => {
    loadPackStatus();
  });

  async function loadPackStatus() {
    try {
      const status = await getDailyPacksRemaining();
      packsRemaining = status.remaining;
      resetsAt = status.resets_at;
    } catch (e) {
      // If the API isn't set up yet, default to allowing packs
      console.warn('Failed to load pack status:', e);
      packsRemaining = 3;
    }
  }

  async function openPack() {
    if (loading || phase !== 'idle') return;
    error = '';
    loading = true;

    // Shake phase
    phase = 'shake';
    await wait(800);

    // Burst phase
    phase = 'burst';
    await wait(400);

    try {
      const result = await openBoosterPack();
      characters = result.characters;
      packsRemaining = result.packs_remaining;
      resetsAt = result.resets_at;

      // Reveal phase — staggered card entry
      phase = 'reveal';
      flippedCards = [false, false, false];
      cardVisible = [false, false, false];

      for (let i = 0; i < characters.length; i++) {
        await wait(200);
        cardVisible[i] = true;
      }

      phase = 'done';
    } catch (e) {
      phase = 'idle';
      error = e instanceof Error ? e.message : 'Failed to open pack';
    } finally {
      loading = false;
    }
  }

  function flipCard(index: number) {
    if (flippedCards[index]) return;
    flippedCards[index] = true;

    const char = characters[index];
    if (!char) return;

    spawnParticles(char.rarity, index);

    if (char.rarity === 'legendary') {
      legendaryFlash = true;
      screenShake = true;
      setTimeout(() => { legendaryFlash = false; }, 400);
      setTimeout(() => { screenShake = false; }, 300);
    }
  }

  function spawnParticles(rarity: string, cardIndex: number) {
    const counts: Record<string, number> = { common: 6, rare: 12, epic: 18, legendary: 30 };
    const count = counts[rarity] ?? 6;
    const newParticles: typeof particles = [];

    for (let i = 0; i < count; i++) {
      newParticles.push({
        id: particleIdCounter++,
        rarity,
        x: (cardIndex + 0.5) * (100 / characters.length),
        y: 50,
        dx: (Math.random() - 0.5) * 200,
        dy: (Math.random() - 0.5) * 200,
        delay: Math.random() * 0.2,
      });
    }

    particles = [...particles, ...newParticles];
    setTimeout(() => {
      particles = particles.filter(p => !newParticles.includes(p));
    }, 1200);
  }

  function resetToIdle() {
    phase = 'idle';
    characters = [];
    flippedCards = [false, false, false];
    cardVisible = [false, false, false];
    particles = [];
  }

  function formatResetTime(): string {
    if (!resetsAt) return '';
    const reset = new Date(resetsAt);
    const now = new Date();
    const diff = reset.getTime() - now.getTime();
    if (diff <= 0) return 'now';
    const hours = Math.floor(diff / 3600000);
    const minutes = Math.floor((diff % 3600000) / 60000);
    return `${hours}h ${minutes}m`;
  }

  function wait(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
</script>

<div class="pack-opener" class:screen-shake={screenShake} data-testid="pack-opener" data-phase={phase}>
  {#if legendaryFlash}
    <div class="legendary-flash" data-testid="legendary-flash"></div>
  {/if}

  <!-- Particles layer -->
  <div class="particles">
    {#each particles as p (p.id)}
      <div
        class="particle particle-{p.rarity}"
        data-testid="particle"
        style="
          left: {p.x}%;
          top: {p.y}%;
          --dx: {p.dx}px;
          --dy: {p.dy}px;
          --delay: {p.delay}s;
        "
      ></div>
    {/each}
  </div>

  {#if phase === 'idle'}
    <div class="idle-state">
      <div class="pack-icon" class:pulse={packsRemaining > 0}>
        <svg width="80" height="80" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
          <rect x="3" y="8" width="18" height="13" rx="2" />
          <path d="M12 8V3" />
          <path d="M8 3h8" />
          <path d="M12 8l-4 4h8l-4-4z" />
        </svg>
      </div>

      {#if packsRemaining > 0}
        <button class="open-btn" onclick={openPack} disabled={loading} data-testid="open-pack-btn">
          Open Pack
        </button>
        <p class="pack-count" data-testid="packs-remaining">{packsRemaining} pack{packsRemaining !== 1 ? 's' : ''} remaining today</p>
      {:else if packsRemaining === 0}
        <p class="limit-msg" data-testid="daily-limit-msg">Daily limit reached</p>
        <p class="reset-time" data-testid="reset-time">Resets in {formatResetTime()}</p>
      {:else}
        <p class="loading-msg">Loading...</p>
      {/if}

      {#if error}
        <p class="error" data-testid="pack-error">{error}</p>
      {/if}
    </div>

  {:else if phase === 'shake'}
    <div class="pack-icon shaking">
      <svg width="100" height="100" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
        <rect x="3" y="8" width="18" height="13" rx="2" />
        <path d="M12 8V3" />
        <path d="M8 3h8" />
        <path d="M12 8l-4 4h8l-4-4z" />
      </svg>
    </div>

  {:else if phase === 'burst'}
    <div class="burst-overlay" data-testid="burst-overlay"></div>

  {:else}
    <!-- reveal / done -->
    <div class="cards-container" data-testid="cards-container">
      {#each characters as char, i}
        <div class="card-slot" class:visible={cardVisible[i]} data-testid="card-slot">
          <CharacterCard character={char} flipped={flippedCards[i]} onflip={() => flipCard(i)} />
        </div>
      {/each}
    </div>

    {#if phase === 'done' && flippedCards.every(Boolean)}
      <button class="open-btn continue-btn" onclick={resetToIdle} data-testid="continue-btn">
        {packsRemaining > 0 ? 'Open Another' : 'Done'}
      </button>
    {/if}
  {/if}
</div>

<style>
  .pack-opener {
    position: relative;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    min-height: 500px;
    gap: 16px;
    overflow: hidden;
  }

  /* Screen shake for legendary */
  .screen-shake {
    animation: screenShake 0.3s ease-out;
  }

  @keyframes screenShake {
    0%, 100% { transform: translate(0, 0); }
    10% { transform: translate(2px, -2px); }
    20% { transform: translate(-2px, 2px); }
    30% { transform: translate(2px, 2px); }
    40% { transform: translate(-2px, -2px); }
    50% { transform: translate(2px, -2px); }
    60% { transform: translate(-2px, 2px); }
    70% { transform: translate(2px, 2px); }
    80% { transform: translate(-2px, -2px); }
    90% { transform: translate(2px, -2px); }
  }

  /* Legendary flash */
  .legendary-flash {
    position: absolute;
    inset: 0;
    background: radial-gradient(circle, rgba(255, 215, 0, 0.4), transparent 70%);
    z-index: 10;
    animation: flash 0.4s ease-out forwards;
    pointer-events: none;
  }

  @keyframes flash {
    0% { opacity: 1; }
    100% { opacity: 0; }
  }

  /* Particles */
  .particles {
    position: absolute;
    inset: 0;
    pointer-events: none;
    z-index: 5;
  }

  .particle {
    position: absolute;
    width: 6px;
    height: 6px;
    border-radius: 50%;
    animation: particleFly 1s var(--delay) ease-out forwards;
    opacity: 0;
  }

  .particle-common { background: var(--rarity-common); }
  .particle-rare { background: var(--rarity-rare); }
  .particle-epic { background: var(--rarity-epic); }
  .particle-legendary { background: var(--rarity-legendary); box-shadow: 0 0 6px var(--rarity-legendary); }

  @keyframes particleFly {
    0% { transform: translate(0, 0) scale(1); opacity: 1; }
    100% { transform: translate(var(--dx), var(--dy)) scale(0); opacity: 0; }
  }

  /* Idle state */
  .idle-state {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 16px;
  }

  .pack-icon {
    color: var(--color-text-muted);
    transition: color 0.3s;
  }

  .pack-icon.pulse {
    color: var(--color-pink);
    animation: pulse 2s ease-in-out infinite;
  }

  @keyframes pulse {
    0%, 100% { transform: scale(1); filter: drop-shadow(0 0 8px rgba(253, 181, 206, 0.3)); }
    50% { transform: scale(1.05); filter: drop-shadow(0 0 16px rgba(253, 181, 206, 0.5)); }
  }

  .open-btn {
    padding: 12px 32px;
    border: none;
    border-radius: 8px;
    background: var(--color-teal);
    color: white;
    font-size: 1rem;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.2s;
    font-family: inherit;
  }

  .open-btn:hover:not(:disabled) {
    background: #4ab0b0;
    transform: translateY(-1px);
  }

  .open-btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .continue-btn {
    margin-top: 16px;
  }

  .pack-count {
    color: var(--color-text-secondary);
    font-size: 0.85rem;
  }

  .limit-msg {
    color: var(--color-pink);
    font-size: 1.1rem;
    font-weight: 600;
  }

  .reset-time {
    color: var(--color-text-muted);
    font-size: 0.85rem;
  }

  .loading-msg {
    color: var(--color-text-muted);
  }

  .error {
    color: #f87171;
    font-size: 0.85rem;
  }

  /* Shake animation */
  .shaking {
    animation: shake 0.8s cubic-bezier(0.36, 0.07, 0.19, 0.97) forwards;
    color: var(--color-pink);
  }

  @keyframes shake {
    0% { transform: rotate(0deg); }
    10% { transform: rotate(-3deg); }
    20% { transform: rotate(3deg); }
    30% { transform: rotate(-5deg); }
    40% { transform: rotate(5deg); }
    50% { transform: rotate(-8deg); }
    60% { transform: rotate(8deg); }
    70% { transform: rotate(-10deg); }
    80% { transform: rotate(10deg); }
    90% { transform: rotate(-5deg); }
    100% { transform: rotate(0deg) scale(1.1); }
  }

  /* Burst overlay */
  .burst-overlay {
    position: absolute;
    inset: 0;
    background: radial-gradient(circle, rgba(255, 255, 255, 0.8), transparent 70%);
    animation: burst 0.4s ease-out forwards;
  }

  @keyframes burst {
    0% { opacity: 0; transform: scale(0.5); }
    50% { opacity: 1; }
    100% { opacity: 0; transform: scale(2); }
  }

  /* Cards container */
  .cards-container {
    display: flex;
    gap: 16px;
    justify-content: center;
    align-items: center;
  }

  .card-slot {
    opacity: 0;
    transform: translateY(120%) scale(0.6, 0.4);
  }

  .card-slot.visible {
    animation: cardEntry 0.6s cubic-bezier(0.175, 0.885, 0.32, 1.275) forwards;
  }

  @keyframes cardEntry {
    0% { opacity: 0; transform: translateY(120%) scale(0.6, 0.4); }
    40% { opacity: 1; transform: translateY(20%) scale(0.9, 1.1); }
    70% { transform: translateY(-5%) scale(1.02, 0.98); }
    100% { opacity: 1; transform: translateY(0) scale(1, 1); }
  }
</style>
