<script lang="ts">
  import { onMount } from 'svelte';
  import { getCollection, getDailyPacksRemaining } from '@glazebot/supabase-client';

  let characterCount = $state(0);
  let legendaryCount = $state(0);
  let packsRemaining = $state(0);
  let packsResetAt = $state('');
  let loading = $state(true);

  let resetLabel = $derived.by(() => {
    if (packsRemaining >= 3) return 'All available';
    if (!packsResetAt) return '—';
    const diff = new Date(packsResetAt).getTime() - Date.now();
    if (diff <= 0) return 'Ready!';
    const h = Math.floor(diff / 3_600_000);
    const m = Math.floor((diff % 3_600_000) / 60_000);
    return h > 0 ? `${h}h ${m}m` : `${m}m`;
  });

  onMount(() => {
    Promise.all([getCollection(), getDailyPacksRemaining()])
      .then(([collection, packs]) => {
        characterCount = collection.length;
        legendaryCount = collection.filter(c => c.rarity === 'legendary').length;
        packsRemaining = packs.remaining;
        packsResetAt = packs.resets_at;
      })
      .catch(() => {})
      .finally(() => { loading = false; });

    const timer = setInterval(() => {
      packsResetAt = packsResetAt;
    }, 60_000);
    return () => clearInterval(timer);
  });
</script>

<div class="home">
  <div class="page-header">
    <h1 class="page-title">Welcome back</h1>
    <p class="page-subtitle">Here's what's happening with your GlazeBot</p>
  </div>

  <!-- ── Stats Row ── -->
  <div class="stats-row">
    <div class="stat-card">
      <div class="stat-icon stat-icon-teal">
        <svg width="22" height="22" viewBox="0 0 22 22" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="3" y="3" width="16" height="16" rx="3"/><path d="M8 8h6M8 11h6M8 14h3"/></svg>
      </div>
      <div class="stat-body">
        <span class="stat-value">{loading ? '—' : characterCount}</span>
        <span class="stat-label">Characters Collected</span>
      </div>
    </div>
    <div class="stat-card">
      <div class="stat-icon stat-icon-epic">
        <svg width="22" height="22" viewBox="0 0 22 22" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="5" y="2" width="12" height="18" rx="2"/><path d="M5 7h12M5 15h12"/></svg>
      </div>
      <div class="stat-body">
        <span class="stat-value">{loading ? '—' : packsRemaining}</span>
        <span class="stat-label">Packs Available</span>
      </div>
    </div>
    <div class="stat-card">
      <div class="stat-icon stat-icon-pink">
        <svg width="22" height="22" viewBox="0 0 22 22" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="11" cy="11" r="8"/><polyline points="11,7 11,11 14,13"/></svg>
      </div>
      <div class="stat-body">
        <span class="stat-value">{loading ? '—' : resetLabel}</span>
        <span class="stat-label">Next Pack Reset</span>
      </div>
    </div>
  </div>

  <!-- ── Download Section ── -->
  <div class="download-card">
    <h2 class="download-heading">Get the Desktop App</h2>
    <p class="download-desc">
      Download GlazeBot to start watching your characters commentate your gameplay live.
      Screen share your game, pick your party, and let them do the rest.
    </p>
    <div class="download-buttons">
      <div class="download-btn-wrap">
        <button class="download-btn" disabled>
          <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor"><path d="M0 3.5h11.5V0L0 1.75V3.5zm0 9.5l11.5 1.75V11H0v2zm12.5 2L24 17V11H12.5v4zm0-15V7.5H24V1.75L12.5 0z"/></svg>
          <span>Windows</span>
        </button>
        <span class="download-soon">Coming soon</span>
      </div>
      <div class="download-btn-wrap">
        <button class="download-btn" disabled>
          <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor"><path d="M18.7 12.5c0-3 2.5-4.5 2.6-4.6-1.4-2.1-3.6-2.3-4.4-2.4-1.9-.2-3.7 1.1-4.6 1.1-.9 0-2.4-1.1-4-1.1-2 0-3.9 1.2-4.9 3.1-2.1 3.7-.5 9.1 1.5 12.1 1 1.5 2.2 3.1 3.8 3 1.5-.1 2.1-1 3.9-1s2.3 1 3.9.9c1.6 0 2.7-1.5 3.7-2.9 1.2-1.7 1.7-3.3 1.7-3.4 0-.1-3.2-1.2-3.2-4.8zM15.4 3.5c.8-1 1.4-2.5 1.3-3.9-1.2.1-2.7.8-3.6 1.9-.8.9-1.4 2.4-1.3 3.7 1.4.1 2.8-.7 3.6-1.7z"/></svg>
          <span>macOS</span>
        </button>
        <span class="download-soon">Coming soon</span>
      </div>
    </div>
  </div>
</div>

<style>
  .home {
    padding: var(--space-8) var(--space-8) var(--space-12);
    display: flex;
    flex-direction: column;
    gap: var(--space-7);
    max-width: 1100px;
    margin: 0 auto;
    width: 100%;
  }

  /* ── Page Header ── */
  .page-header {
    display: flex;
    flex-direction: column;
    align-items: center;
    text-align: center;
    gap: var(--space-2);
    padding: var(--space-4) 0;
  }

  .page-title {
    font-family: var(--font-brand);
    font-size: var(--font-4xl);
    font-weight: 400;
    color: var(--color-pink);
    letter-spacing: 1px;
  }

  .page-subtitle {
    font-size: var(--font-md);
    color: var(--color-text-primary);
    margin: 0;
  }

  /* ── Stats Row ── */
  .stats-row {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: var(--space-5);
  }

  .stat-card {
    display: flex;
    align-items: center;
    gap: var(--space-4);
    padding: var(--space-5) var(--space-6);
    background: var(--color-surface-raised);
    border: 1px solid var(--color-border);
    border-radius: var(--panel-radius);
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
    font-size: var(--font-base);
    color: var(--color-text-secondary);
    font-weight: 500;
  }

  /* ── Download Card ── */
  .download-card {
    border: 1px solid transparent;
    border-radius: var(--panel-radius);
    padding: var(--space-8) var(--space-8);
    display: flex;
    flex-direction: column;
    align-items: center;
    text-align: center;
    gap: var(--space-4);
    background:
      linear-gradient(var(--color-surface-raised), var(--color-surface-raised)) padding-box,
      linear-gradient(135deg, var(--color-teal), var(--rarity-epic), var(--color-pink)) border-box;
  }

  .download-heading {
    font-family: var(--font-brand);
    font-size: var(--font-3xl);
    font-weight: 400;
    color: var(--color-text-primary);
    letter-spacing: 0.5px;
    margin: 0;
  }

  .download-desc {
    font-size: var(--font-base);
    color: var(--color-text-primary);
    line-height: 1.6;
    margin: 0;
    max-width: 520px;
  }

  .download-buttons {
    display: flex;
    justify-content: center;
    gap: var(--space-5);
    padding-top: var(--space-3);
  }

  .download-btn-wrap {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: var(--space-2);
  }

  .download-btn {
    display: flex;
    align-items: center;
    gap: var(--space-3);
    padding: var(--space-3-5) var(--space-6);
    font-size: var(--font-md);
    font-weight: 500;
    font-family: inherit;
    color: var(--color-text-primary);
    background: var(--color-surface-overlay);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-lg);
    cursor: default;
    opacity: 0.55;
  }

  .download-soon {
    font-size: var(--font-base);
    color: var(--color-text-secondary);
    font-weight: 400;
  }
</style>
