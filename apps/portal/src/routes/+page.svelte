<script lang="ts">
  import { ProceduralAvatar, RarityBadge } from '@glazebot/shared-ui';

  // Demo character data for the component showcase
  const demoCharacters = [
    { name: 'Jinx McFlare', rarity: 'legendary' as const, seed: 'jinx-abc', description: 'Explosive hype caster who loses it during clutch plays. Screams at headshots.' },
    { name: 'Coach Stonewall', rarity: 'epic' as const, seed: 'coach-xyz', description: 'Tactical analyst. Breaks down every play like it\'s a championship final.' },
    { name: 'Pixel Pete', rarity: 'rare' as const, seed: 'pixel-123', description: 'Retro-gaming nerd who compares everything to classic titles from the 90s.' },
    { name: 'Chill Karen', rarity: 'common' as const, seed: 'karen-456', description: 'Surprisingly wholesome. Encourages you even when you\'re getting destroyed.' },
    { name: 'Hex', rarity: 'epic' as const, seed: 'hex-789', description: 'Dark humor, sarcastic quips. Roasts your gameplay but you love it.' },
    { name: 'Sunny Blaze', rarity: 'rare' as const, seed: 'sunny-012', description: 'Pure positivity. Finds the silver lining in every death and missed shot.' },
  ];

  const recentActivity = [
    { action: 'Opened a booster pack', time: '2 hours ago', detail: 'Got a Legendary!' },
    { action: 'Completed a session', time: '5 hours ago', detail: '47 min on Valorant' },
    { action: 'Added to party', time: '1 day ago', detail: 'Jinx McFlare joined Squad Alpha' },
    { action: 'Opened a booster pack', time: '1 day ago', detail: '2 Rares, 1 Common' },
    { action: 'Created a party', time: '2 days ago', detail: 'Squad Alpha' },
  ];

  let activeBtn = $state('primary');
</script>

<div class="home">
  <!-- Header -->
  <div class="page-header">
    <h1 class="page-title">Dashboard</h1>
    <p class="page-subtitle">Component playground — experimenting with styles</p>
  </div>

  <!-- Stats Row -->
  <div class="stats-row">
    <div class="stat-card">
      <div class="stat-icon">🃏</div>
      <div class="stat-body">
        <span class="stat-value">24</span>
        <span class="stat-label">Characters</span>
      </div>
    </div>
    <div class="stat-card">
      <div class="stat-icon">📦</div>
      <div class="stat-body">
        <span class="stat-value">3</span>
        <span class="stat-label">Packs Today</span>
      </div>
    </div>
    <div class="stat-card">
      <div class="stat-icon">⭐</div>
      <div class="stat-body">
        <span class="stat-value">2</span>
        <span class="stat-label">Legendaries</span>
      </div>
    </div>
    <div class="stat-card">
      <div class="stat-icon">🎮</div>
      <div class="stat-body">
        <span class="stat-value">12h</span>
        <span class="stat-label">Watch Time</span>
      </div>
    </div>
  </div>

  <div class="two-col">
    <!-- Left: Character Cards -->
    <div class="section">
      <div class="section-header">
        <h2 class="section-title">Your Characters</h2>
        <button class="btn btn-ghost btn-sm">View All</button>
      </div>

      <div class="character-grid">
        {#each demoCharacters as char}
          <div class="char-card rarity-border-{char.rarity}">
            <div class="char-card-inner">
              <div class="char-card-top">
                <ProceduralAvatar seed={char.seed} rarity={char.rarity} size={56} />
                <div class="char-card-meta">
                  <span class="char-name">{char.name}</span>
                  <RarityBadge rarity={char.rarity} />
                </div>
              </div>
              <p class="char-desc">{char.description}</p>
              <div class="char-card-footer">
                <button class="btn btn-outline btn-xs">Details</button>
                <button class="btn btn-primary btn-xs">Add to Party</button>
              </div>
            </div>
          </div>
        {/each}
      </div>
    </div>

    <!-- Right: Activity + Buttons -->
    <div class="right-col">
      <!-- Activity List -->
      <div class="section">
        <div class="section-header">
          <h2 class="section-title">Recent Activity</h2>
        </div>
        <div class="activity-list">
          {#each recentActivity as item, i}
            <div class="activity-item" class:activity-last={i === recentActivity.length - 1}>
              <div class="activity-dot"></div>
              <div class="activity-body">
                <span class="activity-action">{item.action}</span>
                <span class="activity-detail">{item.detail}</span>
                <span class="activity-time">{item.time}</span>
              </div>
            </div>
          {/each}
        </div>
      </div>

      <!-- Button Showcase -->
      <div class="section">
        <div class="section-header">
          <h2 class="section-title">Buttons</h2>
        </div>
        <div class="button-grid">
          <button class="btn btn-primary" onclick={() => activeBtn = 'primary'}>Primary</button>
          <button class="btn btn-secondary">Secondary</button>
          <button class="btn btn-outline">Outline</button>
          <button class="btn btn-ghost">Ghost</button>
          <button class="btn btn-danger">Danger</button>
          <button class="btn btn-primary" disabled>Disabled</button>
        </div>
        <div class="button-grid" style="margin-top: 12px;">
          <button class="btn btn-primary btn-sm">Small</button>
          <button class="btn btn-primary">Medium</button>
          <button class="btn btn-primary btn-lg">Large</button>
        </div>
      </div>

      <!-- Playing Card Preview -->
      <div class="section">
        <div class="section-header">
          <h2 class="section-title">Card Backs</h2>
        </div>
        <div class="card-back-row">
          {#each ['common', 'rare', 'epic', 'legendary'] as rarity}
            <div class="playing-card playing-card-{rarity}">
              <div class="playing-card-inner">
                <div class="playing-card-pattern">
                  <div class="playing-card-emblem">G</div>
                </div>
                <div class="playing-card-edge"></div>
              </div>
              <span class="playing-card-label">{rarity}</span>
            </div>
          {/each}
        </div>
      </div>
    </div>
  </div>
</div>

<style>
  .home {
    padding: 32px;
    display: flex;
    flex-direction: column;
    gap: 24px;
    max-width: 1200px;
  }

  /* Header */
  .page-header {
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  .page-title {
    font-family: 'Michroma', sans-serif;
    font-size: 1.1rem;
    font-weight: 400;
    color: #c0c8d4;
    letter-spacing: 1px;
  }

  .page-subtitle {
    font-family: 'Michroma', sans-serif;
    font-size: 0.55rem;
    color: var(--color-text-muted);
    letter-spacing: 1.5px;
  }

  /* Stats row */
  .stats-row {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 12px;
  }

  .stat-card {
    display: flex;
    align-items: center;
    gap: 14px;
    padding: 16px 18px;
    background: rgba(10, 22, 42, 0.5);
    backdrop-filter: blur(12px);
    -webkit-backdrop-filter: blur(12px);
    border: 1px solid rgba(255, 255, 255, 0.06);
    border-radius: 10px;
    box-shadow:
      inset 0 1px 0 rgba(255, 255, 255, 0.03),
      0 1px 3px rgba(0, 0, 0, 0.4),
      0 4px 12px rgba(0, 0, 0, 0.2);
  }

  .stat-icon {
    font-size: 1.5rem;
    width: 40px;
    height: 40px;
    display: flex;
    align-items: center;
    justify-content: center;
    background: rgba(255, 255, 255, 0.03);
    border-radius: 8px;
    border: 1px solid var(--color-border-subtle);
  }

  .stat-body {
    display: flex;
    flex-direction: column;
  }

  .stat-body .stat-value {
    font-size: 1.25rem;
    font-weight: 700;
    color: var(--color-text-primary);
    line-height: 1.2;
  }

  .stat-body .stat-label {
    font-size: 0.75rem;
    color: var(--color-text-muted);
    font-weight: 500;
  }

  /* Two-column layout */
  .two-col {
    display: grid;
    grid-template-columns: 1fr 380px;
    gap: 24px;
    align-items: start;
  }

  .right-col {
    display: flex;
    flex-direction: column;
    gap: 24px;
  }

  /* Sections */
  .section {
    display: flex;
    flex-direction: column;
    gap: 14px;
  }

  .section-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
  }

  .section-title {
    font-size: 0.95rem;
    font-weight: 600;
    color: var(--color-text-primary);
    letter-spacing: -0.01em;
  }

  /* Character grid */
  .character-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(240px, 1fr));
    gap: 12px;
  }

  .char-card {
    background: rgba(10, 22, 42, 0.5);
    backdrop-filter: blur(12px);
    -webkit-backdrop-filter: blur(12px);
    border: 1px solid rgba(255, 255, 255, 0.06);
    border-radius: 10px;
    overflow: hidden;
    transition: all 0.2s ease;
    /* Skeuomorphic: layered shadow for depth */
    box-shadow:
      inset 0 1px 0 rgba(255, 255, 255, 0.03),
      0 1px 2px rgba(0, 0, 0, 0.3),
      0 4px 8px rgba(0, 0, 0, 0.15);
  }

  .char-card:hover {
    border-color: rgba(255, 255, 255, 0.1);
    transform: translateY(-1px);
    box-shadow:
      inset 0 1px 0 rgba(255, 255, 255, 0.04),
      0 2px 4px rgba(0, 0, 0, 0.4),
      0 8px 16px rgba(0, 0, 0, 0.25);
  }

  /* Subtle rarity left-border accent */
  .rarity-border-legendary { border-left: 2px solid var(--rarity-legendary); }
  .rarity-border-epic { border-left: 2px solid var(--rarity-epic); }
  .rarity-border-rare { border-left: 2px solid var(--rarity-rare); }
  .rarity-border-common { border-left: 2px solid var(--rarity-common); }

  .char-card-inner {
    padding: 14px;
    display: flex;
    flex-direction: column;
    gap: 10px;
  }

  .char-card-top {
    display: flex;
    gap: 12px;
    align-items: center;
  }

  .char-card-meta {
    display: flex;
    flex-direction: column;
    gap: 4px;
    min-width: 0;
  }

  .char-name {
    font-size: 0.9rem;
    font-weight: 600;
    color: var(--color-text-primary);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .char-desc {
    font-size: 0.8rem;
    color: var(--color-text-secondary);
    line-height: 1.4;
    display: -webkit-box;
    -webkit-line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
  }

  .char-card-footer {
    display: flex;
    gap: 8px;
    padding-top: 6px;
    border-top: 1px solid var(--color-border-subtle);
  }

  /* Buttons — shadcn-esque with skeuomorphic depth */
  .btn {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 6px;
    padding: 8px 16px;
    font-size: 0.85rem;
    font-weight: 500;
    font-family: inherit;
    border-radius: 7px;
    border: 1px solid transparent;
    cursor: pointer;
    transition: all 0.15s ease;
    white-space: nowrap;
    line-height: 1;
    color: var(--color-text-primary);
  }

  .btn:active:not(:disabled) {
    transform: translateY(0.5px);
  }

  .btn:disabled {
    opacity: 0.4;
    cursor: not-allowed;
  }

  .btn-primary {
    background: linear-gradient(180deg, #449999 0%, #327272 100%);
    border-color: rgba(59, 151, 151, 0.4);
    color: #fff;
    box-shadow:
      inset 0 1px 0 rgba(255, 255, 255, 0.12),
      0 1px 2px rgba(0, 0, 0, 0.3);
  }

  .btn-primary:hover:not(:disabled) {
    background: linear-gradient(180deg, #4daaaa 0%, #3a8484 100%);
    box-shadow:
      inset 0 1px 0 rgba(255, 255, 255, 0.15),
      0 2px 6px rgba(59, 151, 151, 0.3);
  }

  .btn-secondary {
    background: linear-gradient(180deg, var(--color-surface-overlay) 0%, var(--color-surface-raised) 100%);
    border-color: var(--color-border);
    box-shadow:
      inset 0 1px 0 rgba(255, 255, 255, 0.04),
      0 1px 2px rgba(0, 0, 0, 0.3);
  }

  .btn-secondary:hover:not(:disabled) {
    background: linear-gradient(180deg, #1e2740 0%, #1a2035 100%);
    border-color: rgba(255, 255, 255, 0.1);
  }

  .btn-outline {
    background: transparent;
    border-color: var(--color-border);
    color: var(--color-text-secondary);
  }

  .btn-outline:hover:not(:disabled) {
    background: rgba(255, 255, 255, 0.03);
    border-color: rgba(255, 255, 255, 0.12);
    color: var(--color-text-primary);
  }

  .btn-ghost {
    background: transparent;
    border-color: transparent;
    color: var(--color-text-secondary);
  }

  .btn-ghost:hover:not(:disabled) {
    background: rgba(255, 255, 255, 0.04);
    color: var(--color-text-primary);
  }

  .btn-danger {
    background: linear-gradient(180deg, #9b3030 0%, #7a2424 100%);
    border-color: rgba(200, 50, 50, 0.3);
    color: #fca5a5;
    box-shadow:
      inset 0 1px 0 rgba(255, 255, 255, 0.08),
      0 1px 2px rgba(0, 0, 0, 0.3);
  }

  .btn-danger:hover:not(:disabled) {
    background: linear-gradient(180deg, #b33636 0%, #8a2a2a 100%);
  }

  .btn-sm { padding: 5px 10px; font-size: 0.78rem; border-radius: 6px; }
  .btn-xs { padding: 4px 8px; font-size: 0.72rem; border-radius: 5px; }
  .btn-lg { padding: 11px 22px; font-size: 0.95rem; border-radius: 8px; }

  .button-grid {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
  }

  /* Activity list */
  .activity-list {
    display: flex;
    flex-direction: column;
    background: rgba(10, 22, 42, 0.5);
    backdrop-filter: blur(12px);
    -webkit-backdrop-filter: blur(12px);
    border: 1px solid rgba(255, 255, 255, 0.06);
    border-radius: 10px;
    overflow: hidden;
    box-shadow:
      inset 0 1px 0 rgba(255, 255, 255, 0.02),
      0 1px 3px rgba(0, 0, 0, 0.3);
  }

  .activity-item {
    display: flex;
    gap: 12px;
    padding: 12px 16px;
    align-items: flex-start;
    border-bottom: 1px solid var(--color-border-subtle);
    transition: background 0.15s;
  }

  .activity-item:hover {
    background: rgba(255, 255, 255, 0.015);
  }

  .activity-item.activity-last {
    border-bottom: none;
  }

  .activity-dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background: var(--color-teal);
    margin-top: 5px;
    flex-shrink: 0;
    box-shadow: 0 0 6px rgba(59, 151, 151, 0.4);
  }

  .activity-body {
    display: flex;
    flex-direction: column;
    gap: 2px;
    min-width: 0;
  }

  .activity-action {
    font-size: 0.85rem;
    font-weight: 500;
    color: var(--color-text-primary);
  }

  .activity-detail {
    font-size: 0.78rem;
    color: var(--color-text-secondary);
  }

  .activity-time {
    font-size: 0.72rem;
    color: var(--color-text-muted);
  }

  /* Playing card backs — skeuomorphic */
  .card-back-row {
    display: flex;
    gap: 12px;
  }

  .playing-card {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 8px;
  }

  .playing-card-inner {
    width: 72px;
    height: 100px;
    border-radius: 8px;
    position: relative;
    overflow: hidden;
    cursor: pointer;
    transition: all 0.2s ease;
    /* Skeuomorphic card: beveled edge, layered shadow */
    box-shadow:
      inset 0 1px 0 rgba(255, 255, 255, 0.08),
      inset 0 -1px 0 rgba(0, 0, 0, 0.3),
      0 2px 4px rgba(0, 0, 0, 0.4),
      0 6px 12px rgba(0, 0, 0, 0.2);
  }

  .playing-card-inner:hover {
    transform: translateY(-3px) rotateZ(-1deg);
    box-shadow:
      inset 0 1px 0 rgba(255, 255, 255, 0.1),
      inset 0 -1px 0 rgba(0, 0, 0, 0.3),
      0 4px 8px rgba(0, 0, 0, 0.5),
      0 12px 24px rgba(0, 0, 0, 0.3);
  }

  .playing-card-common .playing-card-inner {
    background: linear-gradient(145deg, #2a3040 0%, #1a2030 50%, #222838 100%);
    border: 1px solid rgba(160, 174, 192, 0.15);
  }

  .playing-card-rare .playing-card-inner {
    background: linear-gradient(145deg, #1a3535 0%, #0f2828 50%, #183030 100%);
    border: 1px solid rgba(59, 151, 151, 0.2);
  }

  .playing-card-epic .playing-card-inner {
    background: linear-gradient(145deg, #2a1a40 0%, #1f1030 50%, #281838 100%);
    border: 1px solid rgba(176, 106, 255, 0.2);
  }

  .playing-card-legendary .playing-card-inner {
    background: linear-gradient(145deg, #3a2a10 0%, #2a1e08 50%, #342510 100%);
    border: 1px solid rgba(255, 215, 0, 0.2);
  }

  .playing-card-pattern {
    position: absolute;
    inset: 6px;
    border: 1px solid rgba(255, 255, 255, 0.06);
    border-radius: 4px;
    display: flex;
    align-items: center;
    justify-content: center;
    /* Crosshatch texture via repeating gradient */
    background:
      repeating-linear-gradient(
        45deg,
        transparent,
        transparent 4px,
        rgba(255, 255, 255, 0.015) 4px,
        rgba(255, 255, 255, 0.015) 5px
      );
  }

  .playing-card-emblem {
    font-size: 1.6rem;
    font-weight: 800;
    opacity: 0.15;
    color: #fff;
    text-shadow: 0 1px 2px rgba(0, 0, 0, 0.5);
  }

  .playing-card-common .playing-card-emblem { color: var(--rarity-common); opacity: 0.2; }
  .playing-card-rare .playing-card-emblem { color: var(--rarity-rare); opacity: 0.25; }
  .playing-card-epic .playing-card-emblem { color: var(--rarity-epic); opacity: 0.3; }
  .playing-card-legendary .playing-card-emblem { color: var(--rarity-legendary); opacity: 0.35; }

  .playing-card-edge {
    position: absolute;
    inset: 0;
    border-radius: 8px;
    pointer-events: none;
    /* Highlight on top edge for 3D bevel */
    background: linear-gradient(180deg, rgba(255, 255, 255, 0.04) 0%, transparent 30%, transparent 90%, rgba(0, 0, 0, 0.1) 100%);
  }

  .playing-card-legendary .playing-card-inner:hover {
    box-shadow:
      inset 0 1px 0 rgba(255, 255, 255, 0.1),
      inset 0 -1px 0 rgba(0, 0, 0, 0.3),
      0 4px 8px rgba(0, 0, 0, 0.5),
      0 12px 24px rgba(0, 0, 0, 0.3),
      0 0 20px rgba(255, 215, 0, 0.15);
  }

  .playing-card-epic .playing-card-inner:hover {
    box-shadow:
      inset 0 1px 0 rgba(255, 255, 255, 0.1),
      inset 0 -1px 0 rgba(0, 0, 0, 0.3),
      0 4px 8px rgba(0, 0, 0, 0.5),
      0 12px 24px rgba(0, 0, 0, 0.3),
      0 0 16px rgba(176, 106, 255, 0.15);
  }

  .playing-card-label {
    font-size: 0.7rem;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    color: var(--color-text-muted);
  }
</style>
