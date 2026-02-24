<script lang="ts">
  import { cost, activeCharacters } from "../lib/stores";
</script>

<div class="bar">
  <span class="cost">${$cost.cost.toFixed(4)}</span>
  <span class="sep">&middot;</span>
  <span class="calls">{$cost.calls} calls</span>
  <span class="sep">&middot;</span>
  <span class="active">{$activeCharacters.length} voices</span>
  <span class="keys">F7:Mic F8:Pause F10:Force F12:Quit V:PTT</span>
</div>

<style>
  .bar {
    display: flex; align-items: center; gap: 8px;
    padding: 8px 24px; flex-shrink: 0;
    background: var(--ctp-crust);
    border-top: 1px solid rgba(137, 180, 250, 0.1);
    font-size: 13px;
  }
  .cost { color: var(--ctp-yellow); font-weight: 600; font-family: "Consolas", monospace; }
  .sep { color: var(--ctp-surface0); }
  .calls { color: var(--ctp-subtext0); }
  .active { color: var(--ctp-green); }
  .keys {
    margin-left: auto; color: var(--ctp-surface2); font-size: 12px;
    font-family: "Consolas", monospace;
  }
</style>
