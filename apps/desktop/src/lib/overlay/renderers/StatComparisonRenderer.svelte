<script lang="ts">
  import type { StatComparisonCommand } from '@glazebot/shared-types';

  let { command }: { command: StatComparisonCommand } = $props();

  let positionStyle = $derived(anchorToCSS(command.position || 'top-right'));

  function anchorToCSS(anchor: string): string {
    const map: Record<string, string> = {
      'top-left': 'top: 5%; left: 5%;',
      'top-center': 'top: 5%; left: 50%; transform: translateX(-50%);',
      'top-right': 'top: 5%; right: 5%;',
      'center-left': 'top: 50%; left: 5%; transform: translateY(-50%);',
      'center': 'top: 50%; left: 50%; transform: translate(-50%, -50%);',
      'center-right': 'top: 50%; right: 5%; transform: translateY(-50%);',
      'bottom-left': 'bottom: 5%; left: 5%;',
      'bottom-center': 'bottom: 5%; left: 50%; transform: translateX(-50%);',
      'bottom-right': 'bottom: 5%; right: 5%;',
    };
    return map[anchor] || map['top-right'];
  }

  // Merge all stat labels from both sides
  let allStats = $derived(() => {
    const labels = new Set<string>();
    for (const s of command.left.stats) labels.add(s.label);
    for (const s of command.right.stats) labels.add(s.label);
    return [...labels];
  });

  function getStat(side: typeof command.left, label: string) {
    return side.stats.find((s) => s.label === label);
  }

  function barWidth(value: number, max?: number): number {
    const m = max || 100;
    return Math.min(100, Math.max(0, (value / m) * 100));
  }
</script>

<div class="stat-panel" style={positionStyle}>
  <div class="stat-title">{command.title}</div>
  <div class="stat-header">
    <span class="side-name left">{command.left.name}</span>
    <span class="side-name right">{command.right.name}</span>
  </div>
  {#each allStats() as label}
    {@const leftStat = getStat(command.left, label)}
    {@const rightStat = getStat(command.right, label)}
    <div class="stat-row">
      <div class="stat-label">{label}</div>
      <div class="stat-bars">
        <div class="bar-container left">
          <div class="bar left-bar" style="width: {barWidth(leftStat?.value ?? 0, leftStat?.max)}%"></div>
          <span class="bar-value">{leftStat?.value ?? '—'}</span>
        </div>
        <div class="bar-container right">
          <div class="bar right-bar" style="width: {barWidth(rightStat?.value ?? 0, rightStat?.max)}%"></div>
          <span class="bar-value">{rightStat?.value ?? '—'}</span>
        </div>
      </div>
    </div>
  {/each}
</div>

<style>
  .stat-panel {
    position: absolute;
    background: rgba(10, 14, 24, 0.92);
    border: 1px solid rgba(255, 255, 255, 0.15);
    border-radius: 12px;
    padding: 16px;
    min-width: 280px;
    max-width: 400px;
    animation: panel-slide-in 0.4s ease-out;
    font-family: system-ui, sans-serif;
  }
  .stat-title {
    font-size: 16px;
    font-weight: 700;
    color: rgba(255, 255, 255, 0.95);
    margin-bottom: 12px;
    text-align: center;
  }
  .stat-header {
    display: flex;
    justify-content: space-between;
    margin-bottom: 8px;
  }
  .side-name {
    font-size: 13px;
    font-weight: 600;
    color: rgba(255, 255, 255, 0.7);
  }
  .side-name.left { color: #4FC3F7; }
  .side-name.right { color: #FF7043; }
  .stat-row {
    margin-bottom: 6px;
  }
  .stat-label {
    font-size: 11px;
    color: rgba(255, 255, 255, 0.5);
    margin-bottom: 2px;
  }
  .stat-bars {
    display: flex;
    gap: 4px;
  }
  .bar-container {
    flex: 1;
    height: 18px;
    background: rgba(255, 255, 255, 0.08);
    border-radius: 4px;
    position: relative;
    overflow: hidden;
  }
  .bar {
    height: 100%;
    border-radius: 4px;
    transition: width 0.5s ease-out;
  }
  .left-bar { background: #4FC3F7; }
  .right-bar { background: #FF7043; }
  .bar-value {
    position: absolute;
    right: 6px;
    top: 50%;
    transform: translateY(-50%);
    font-size: 11px;
    font-weight: 600;
    color: rgba(255, 255, 255, 0.9);
    text-shadow: 0 1px 2px rgba(0, 0, 0, 0.5);
  }
  @keyframes panel-slide-in {
    from { opacity: 0; transform: translateY(-10px); }
    to { opacity: 1; transform: translateY(0); }
  }
</style>
