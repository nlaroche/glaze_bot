<script lang="ts">
  import { ProceduralAvatar, RarityBadge } from '@glazebot/shared-ui';

  // Demo data
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
</script>

<div class="home">
  <!-- ── Page Header ── -->
  <div class="page-header">
    <h1 class="page-title">Dashboard</h1>
    <p class="page-subtitle">// Overview</p>
  </div>

  <!-- ── Stats Row ── -->
  <div class="stats-row">
    <div class="stat-card">
      <div class="stat-icon stat-icon-teal">
        <svg width="22" height="22" viewBox="0 0 22 22" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="3" y="3" width="16" height="16" rx="3"/><path d="M8 8h6M8 11h6M8 14h3"/></svg>
      </div>
      <div class="stat-body">
        <span class="stat-value">24</span>
        <span class="stat-label">Characters</span>
      </div>
    </div>
    <div class="stat-card">
      <div class="stat-icon stat-icon-epic">
        <svg width="22" height="22" viewBox="0 0 22 22" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="5" y="2" width="12" height="18" rx="2"/><path d="M5 7h12M5 15h12"/></svg>
      </div>
      <div class="stat-body">
        <span class="stat-value">3</span>
        <span class="stat-label">Packs Today</span>
      </div>
    </div>
    <div class="stat-card">
      <div class="stat-icon stat-icon-gold">
        <svg width="22" height="22" viewBox="0 0 22 22" fill="none" stroke="currentColor" stroke-width="1.5"><polygon points="11,2 13.5,8 20,8.5 15,13 16.5,20 11,16 5.5,20 7,13 2,8.5 8.5,8"/></svg>
      </div>
      <div class="stat-body">
        <span class="stat-value">2</span>
        <span class="stat-label">Legendaries</span>
      </div>
    </div>
    <div class="stat-card">
      <div class="stat-icon stat-icon-pink">
        <svg width="22" height="22" viewBox="0 0 22 22" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="11" cy="11" r="8"/><polyline points="11,7 11,11 14,13"/></svg>
      </div>
      <div class="stat-body">
        <span class="stat-value">12h</span>
        <span class="stat-label">Watch Time</span>
      </div>
    </div>
  </div>

  <!-- ── Two Column ── -->
  <div class="two-col">
    <!-- Left: Characters -->
    <div class="panel">
      <div class="panel-head">
        <h2 class="panel-title">Your Characters</h2>
        <button class="btn btn-ghost btn-sm">View All</button>
      </div>
      <div class="character-grid">
        {#each demoCharacters as char}
          <div class="char-card rarity-accent-{char.rarity}">
            <div class="char-top">
              <ProceduralAvatar seed={char.seed} rarity={char.rarity} size={48} />
              <div class="char-meta">
                <span class="char-name">{char.name}</span>
                <RarityBadge rarity={char.rarity} />
              </div>
            </div>
            <p class="char-desc">{char.description}</p>
            <div class="char-actions">
              <button class="btn btn-outline btn-xs">Details</button>
              <button class="btn btn-primary btn-xs">Add to Party</button>
            </div>
          </div>
        {/each}
      </div>
    </div>

    <!-- Right column -->
    <div class="right-col">
      <!-- Activity -->
      <div class="panel">
        <div class="panel-head">
          <h2 class="panel-title">Recent Activity</h2>
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

      <!-- Buttons -->
      <div class="panel">
        <div class="panel-head">
          <h2 class="panel-title">Buttons</h2>
        </div>
        <div class="button-row">
          <button class="btn btn-primary">Primary</button>
          <button class="btn btn-secondary">Secondary</button>
          <button class="btn btn-outline">Outline</button>
          <button class="btn btn-ghost">Ghost</button>
          <button class="btn btn-danger">Danger</button>
        </div>
        <div class="button-row">
          <button class="btn btn-primary btn-sm">Small</button>
          <button class="btn btn-primary">Medium</button>
          <button class="btn btn-primary btn-lg">Large</button>
          <button class="btn btn-primary" disabled>Disabled</button>
        </div>
      </div>

      <!-- Card Backs -->
      <div class="panel">
        <div class="panel-head">
          <h2 class="panel-title">Card Backs</h2>
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
    padding: var(--space-7) var(--space-8);
    display: flex;
    flex-direction: column;
    gap: var(--space-6);
    max-width: 1200px;
  }

  /* ── Page Header ── */
  .page-header {
    display: flex;
    flex-direction: column;
    gap: var(--space-1);
  }

  .page-title {
    font-family: var(--font-brand);
    font-size: var(--font-4xl);
    font-weight: 400;
    color: var(--color-pink);
    letter-spacing: 1px;
  }

  .page-subtitle {
    font-family: var(--font-brand);
    font-size: var(--font-xs);
    color: var(--color-text-muted);
    letter-spacing: 1.5px;
  }

  /* ── Stats Row ── */
  .stats-row {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: var(--space-3);
  }

  .stat-card {
    display: flex;
    align-items: center;
    gap: var(--space-3-5);
    padding: var(--space-4) var(--space-4);
    background: var(--panel-bg);
    border: 1px solid var(--panel-border);
    border-radius: var(--panel-radius);
    backdrop-filter: blur(var(--glass-blur));
    -webkit-backdrop-filter: blur(var(--glass-blur));
    box-shadow: var(--panel-shadow);
  }

  .stat-icon {
    width: 44px;
    height: 44px;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: var(--radius-lg);
    flex-shrink: 0;
  }

  .stat-icon-teal { background: var(--teal-a12); color: var(--color-teal); }
  .stat-icon-epic { background: var(--epic-a12); color: var(--rarity-epic); }
  .stat-icon-gold { background: var(--gold-a15); color: var(--rarity-legendary); }
  .stat-icon-pink { background: rgba(253, 181, 206, 0.1); color: var(--color-pink); }

  .stat-body {
    display: flex;
    flex-direction: column;
    gap: var(--space-0-5);
  }

  .stat-value {
    font-size: var(--font-2xl);
    font-weight: 600;
    color: var(--color-text-primary);
    line-height: 1.2;
    font-variant-numeric: tabular-nums;
  }

  .stat-label {
    font-size: var(--font-sm);
    color: var(--color-text-muted);
    font-weight: 500;
  }

  /* ── Two-Column Layout ── */
  .two-col {
    display: grid;
    grid-template-columns: 1fr 380px;
    gap: var(--space-6);
    align-items: start;
  }

  .right-col {
    display: flex;
    flex-direction: column;
    gap: var(--space-5);
  }

  /* ── Panels ── */
  .panel {
    background: var(--panel-bg);
    border: 1px solid var(--panel-border);
    border-radius: var(--panel-radius);
    padding: var(--space-5);
    display: flex;
    flex-direction: column;
    gap: var(--space-4);
  }

  .panel-head {
    display: flex;
    align-items: center;
    justify-content: space-between;
  }

  .panel-title {
    font-family: var(--font-brand);
    font-size: var(--font-sm);
    font-weight: 400;
    color: var(--color-text-secondary);
    text-transform: uppercase;
    letter-spacing: 1.5px;
    margin: 0;
  }

  /* ── Character Grid ── */
  .character-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
    gap: var(--space-3);
  }

  .char-card {
    background: var(--white-a2);
    border: 1px solid var(--white-a6);
    border-radius: var(--radius-xl);
    padding: var(--space-4);
    display: flex;
    flex-direction: column;
    gap: var(--space-3);
    transition: all var(--transition-slow) ease;
  }

  .char-card:hover {
    border-color: var(--white-a10);
    transform: translateY(-1px);
    box-shadow: 0 4px 16px var(--black-a25);
  }

  .rarity-accent-legendary { border-left: 2px solid var(--rarity-legendary); }
  .rarity-accent-epic { border-left: 2px solid var(--rarity-epic); }
  .rarity-accent-rare { border-left: 2px solid var(--rarity-rare); }
  .rarity-accent-common { border-left: 2px solid var(--rarity-common); }

  .char-top {
    display: flex;
    gap: var(--space-3);
    align-items: center;
  }

  .char-meta {
    display: flex;
    flex-direction: column;
    gap: var(--space-1);
    min-width: 0;
  }

  .char-name {
    font-size: var(--font-base);
    font-weight: 600;
    color: var(--color-text-primary);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .char-desc {
    font-size: var(--font-sm);
    color: var(--color-text-secondary);
    line-height: 1.5;
    display: -webkit-box;
    -webkit-line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
    margin: 0;
  }

  .char-actions {
    display: flex;
    gap: var(--space-2);
    padding-top: var(--space-2);
    border-top: 1px solid var(--color-border-subtle);
  }

  /* ── Buttons ── */
  .btn {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: var(--space-1-5);
    padding: var(--space-2) var(--space-4);
    font-size: var(--font-base);
    font-weight: 500;
    font-family: inherit;
    border-radius: var(--radius-lg);
    border: 1px solid transparent;
    cursor: pointer;
    transition: all var(--transition-base) ease;
    white-space: nowrap;
    line-height: 1;
    color: var(--color-text-primary);
  }

  .btn:active:not(:disabled) { transform: translateY(0.5px); }
  .btn:disabled { opacity: 0.4; cursor: not-allowed; }

  .btn-primary {
    background: linear-gradient(180deg, #449999 0%, #327272 100%);
    border-color: var(--teal-a40);
    color: #fff;
    box-shadow: inset 0 1px 0 var(--white-a12), 0 1px 2px var(--black-a30);
  }

  .btn-primary:hover:not(:disabled) {
    background: linear-gradient(180deg, #4daaaa 0%, #3a8484 100%);
    box-shadow: inset 0 1px 0 var(--white-a15), 0 2px 6px var(--teal-a30);
  }

  .btn-secondary {
    background: linear-gradient(180deg, var(--color-surface-overlay) 0%, var(--color-surface-raised) 100%);
    border-color: var(--color-border);
    box-shadow: inset 0 1px 0 var(--white-a4), 0 1px 2px var(--black-a30);
  }

  .btn-secondary:hover:not(:disabled) {
    background: linear-gradient(180deg, #1e2740 0%, #1a2035 100%);
    border-color: var(--white-a10);
  }

  .btn-outline {
    background: transparent;
    border-color: var(--white-a8);
    color: var(--color-text-secondary);
  }

  .btn-outline:hover:not(:disabled) {
    background: var(--white-a4);
    border-color: var(--white-a12);
    color: var(--color-text-primary);
  }

  .btn-ghost {
    background: transparent;
    border-color: transparent;
    color: var(--color-text-secondary);
  }

  .btn-ghost:hover:not(:disabled) {
    background: var(--white-a4);
    color: var(--color-text-primary);
  }

  .btn-danger {
    background: linear-gradient(180deg, #9b3030 0%, #7a2424 100%);
    border-color: rgba(200, 50, 50, 0.3);
    color: var(--color-error-soft);
    box-shadow: inset 0 1px 0 var(--white-a8), 0 1px 2px var(--black-a30);
  }

  .btn-danger:hover:not(:disabled) {
    background: linear-gradient(180deg, #b33636 0%, #8a2a2a 100%);
  }

  .btn-sm { padding: var(--space-1-5) var(--space-2-5); font-size: var(--font-xs); border-radius: var(--radius-md); }
  .btn-xs { padding: var(--space-1) var(--space-2); font-size: var(--font-xs); border-radius: var(--radius-md); }
  .btn-lg { padding: var(--space-2-5) var(--space-5); font-size: var(--font-md); border-radius: var(--radius-lg); }

  .button-row {
    display: flex;
    flex-wrap: wrap;
    gap: var(--space-2);
  }

  /* ── Activity List ── */
  .activity-list {
    display: flex;
    flex-direction: column;
  }

  .activity-item {
    display: flex;
    gap: var(--space-3);
    padding: var(--space-3) 0;
    align-items: flex-start;
    border-bottom: 1px solid var(--color-border-subtle);
  }

  .activity-item.activity-last {
    border-bottom: none;
    padding-bottom: 0;
  }

  .activity-dot {
    width: 8px;
    height: 8px;
    border-radius: var(--radius-full);
    background: var(--color-teal);
    margin-top: 6px;
    flex-shrink: 0;
    box-shadow: 0 0 6px var(--teal-a40);
  }

  .activity-body {
    display: flex;
    flex-direction: column;
    gap: var(--space-0-5);
    min-width: 0;
  }

  .activity-action {
    font-size: var(--font-base);
    font-weight: 500;
    color: var(--color-text-primary);
  }

  .activity-detail {
    font-size: var(--font-sm);
    color: var(--color-text-secondary);
  }

  .activity-time {
    font-size: var(--font-xs);
    color: var(--color-text-muted);
  }

  /* ── Playing Card Backs ── */
  .card-back-row {
    display: flex;
    gap: var(--space-3);
  }

  .playing-card {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: var(--space-2);
  }

  .playing-card-inner {
    width: 72px;
    height: 100px;
    border-radius: var(--radius-lg);
    position: relative;
    overflow: hidden;
    cursor: pointer;
    transition: all var(--transition-slow) ease;
    box-shadow:
      inset 0 1px 0 var(--white-a8),
      inset 0 -1px 0 var(--black-a30),
      0 2px 4px var(--black-a40),
      0 6px 12px var(--black-a20);
  }

  .playing-card-inner:hover {
    transform: translateY(-3px) rotateZ(-1deg);
    box-shadow:
      inset 0 1px 0 var(--white-a10),
      inset 0 -1px 0 var(--black-a30),
      0 4px 8px var(--black-a50),
      0 12px 24px var(--black-a30);
  }

  .playing-card-common .playing-card-inner {
    background: linear-gradient(145deg, #2a3040 0%, #1a2030 50%, #222838 100%);
    border: 1px solid rgba(160, 174, 192, 0.15);
  }

  .playing-card-rare .playing-card-inner {
    background: linear-gradient(145deg, #1a3535 0%, #0f2828 50%, #183030 100%);
    border: 1px solid var(--teal-a20);
  }

  .playing-card-epic .playing-card-inner {
    background: linear-gradient(145deg, #2a1a40 0%, #1f1030 50%, #281838 100%);
    border: 1px solid var(--epic-a20);
  }

  .playing-card-legendary .playing-card-inner {
    background: linear-gradient(145deg, #3a2a10 0%, #2a1e08 50%, #342510 100%);
    border: 1px solid var(--gold-a20);
  }

  .playing-card-pattern {
    position: absolute;
    inset: 6px;
    border: 1px solid var(--white-a6);
    border-radius: var(--radius-sm);
    display: flex;
    align-items: center;
    justify-content: center;
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
    font-family: var(--font-brand);
    font-size: var(--font-3xl);
    font-weight: 400;
    opacity: 0.15;
    color: #fff;
    text-shadow: 0 1px 2px var(--black-a50);
  }

  .playing-card-common .playing-card-emblem { color: var(--rarity-common); opacity: 0.2; }
  .playing-card-rare .playing-card-emblem { color: var(--rarity-rare); opacity: 0.25; }
  .playing-card-epic .playing-card-emblem { color: var(--rarity-epic); opacity: 0.3; }
  .playing-card-legendary .playing-card-emblem { color: var(--rarity-legendary); opacity: 0.35; }

  .playing-card-edge {
    position: absolute;
    inset: 0;
    border-radius: var(--radius-lg);
    pointer-events: none;
    background: linear-gradient(180deg, var(--white-a4) 0%, transparent 30%, transparent 90%, var(--black-a10) 100%);
  }

  .playing-card-legendary .playing-card-inner:hover {
    box-shadow:
      inset 0 1px 0 var(--white-a10),
      inset 0 -1px 0 var(--black-a30),
      0 4px 8px var(--black-a50),
      0 12px 24px var(--black-a30),
      0 0 20px var(--gold-a15);
  }

  .playing-card-epic .playing-card-inner:hover {
    box-shadow:
      inset 0 1px 0 var(--white-a10),
      inset 0 -1px 0 var(--black-a30),
      0 4px 8px var(--black-a50),
      0 12px 24px var(--black-a30),
      0 0 16px var(--epic-a15);
  }

  .playing-card-label {
    font-size: var(--font-xs);
    font-weight: 500;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    color: var(--color-text-muted);
  }
</style>
