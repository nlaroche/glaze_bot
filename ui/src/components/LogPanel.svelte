<script lang="ts">
  import { logs } from "../lib/stores";
  import { nameColor, nameInitials } from "../lib/colors";

  let el: HTMLDivElement;
  $effect(() => {
    $logs;
    if (el) el.scrollTop = el.scrollHeight;
  });

  function avatarPath(n: string) { return `./avatars/${n.toLowerCase().replace(/\s+/g, "_")}.png`; }
  let imgErr: Record<string, boolean> = $state({});
</script>

<div class="page">
  <div class="log-head">
    <h2 class="log-title">Activity Log</h2>
    <span class="log-count">{$logs.length}</span>
  </div>
  <div class="log-scroll" bind:this={el}>
    {#each $logs as entry, i (i)}
      {@const color = nameColor(entry.source)}
      {@const isSystem = entry.source === "sys"}
      {#if isSystem}
        <div class="sys-msg">{entry.text}</div>
      {:else}
        <div class="bubble-row">
          <div class="bubble-av" style="border-color: {color}">
            {#if entry.source !== "You" && !imgErr[entry.source]}
              <img src={avatarPath(entry.source)} alt={entry.source}
                onerror={() => (imgErr[entry.source] = true)} />
            {:else}
              <span class="av-ini" style="color: {color}">{nameInitials(entry.source)}</span>
            {/if}
          </div>
          <div class="bubble">
            <span class="bubble-name" style="color: {color}">{entry.source}</span>
            <span class="bubble-text">{entry.text}</span>
          </div>
        </div>
      {/if}
    {/each}
    {#if $logs.length === 0}
      <div class="empty">Waiting for activity...</div>
    {/if}
  </div>
</div>

<style>
  .page {
    display: flex;
    flex-direction: column;
    height: 100%;
    overflow: hidden;
  }

  .log-head {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 20px 24px 10px;
    flex-shrink: 0;
  }

  .log-title {
    font-size: 18px;
    font-weight: 700;
    color: var(--ctp-text);
  }

  .log-count {
    font-size: 12px;
    background: var(--ctp-surface0);
    color: var(--ctp-surface2);
    padding: 2px 10px;
    border-radius: 10px;
  }

  .log-scroll {
    flex: 1;
    overflow-y: auto;
    padding: 12px;
    margin: 0 24px 12px;
    background: var(--ctp-crust);
    border-radius: 10px;
    display: flex;
    flex-direction: column;
    gap: 8px;
    scrollbar-width: thin;
    scrollbar-color: var(--ctp-surface0) var(--ctp-crust);
  }
  .log-scroll::-webkit-scrollbar { width: 5px; }
  .log-scroll::-webkit-scrollbar-track { background: var(--ctp-crust); }
  .log-scroll::-webkit-scrollbar-thumb { background: var(--ctp-surface0); border-radius: 3px; }

  .bubble-row {
    display: flex;
    gap: 10px;
    align-items: flex-start;
  }

  .bubble-av {
    width: 32px;
    height: 32px;
    border-radius: 50%;
    overflow: hidden;
    background: var(--ctp-base);
    flex-shrink: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    border: 2px solid;
  }
  .bubble-av img { width: 100%; height: 100%; object-fit: cover; }
  .av-ini { font-size: 11px; font-weight: 800; }

  .bubble {
    background: var(--ctp-mantle);
    border-radius: 10px;
    border-top-left-radius: 2px;
    padding: 7px 12px;
    min-width: 0;
    flex: 1;
  }

  .bubble-name {
    display: block;
    font-size: 11px;
    font-weight: 800;
    margin-bottom: 2px;
    letter-spacing: 0.3px;
  }

  .bubble-text {
    display: block;
    font-size: 13px;
    line-height: 1.5;
    color: var(--ctp-text);
    word-wrap: break-word;
  }

  .sys-msg {
    font-size: 12px;
    color: var(--ctp-surface2);
    font-style: italic;
    text-align: center;
    padding: 4px 0;
  }

  .empty {
    color: var(--ctp-surface1);
    font-style: italic;
    text-align: center;
    padding: 32px;
    font-size: 14px;
  }
</style>
