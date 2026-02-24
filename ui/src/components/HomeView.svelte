<script lang="ts">
  import {
    paused, doPause, doForce, doQuit, logs, activeView,
    partyPanelOpen, characters, activeCharacters, toggleChar,
    savedParties, doSaveParty, doLoadParty, doDeleteParty,
    editingCharacter, openCharacterEditor,
    captureSourceType, captureSourceName, sourcePickerOpen,
  } from "../lib/stores";
  import { nameColor, nameInitials } from "../lib/colors";
  import PartyBar from "./PartyBar.svelte";
  import CharacterEditor from "./CharacterEditor.svelte";
  import SourcePicker from "./SourcePicker.svelte";
  import Tooltip from "./Tooltip.svelte";

  function handleResume() {
    if ($paused && $captureSourceType === null) {
      sourcePickerOpen.set(true);
    } else {
      doPause();
    }
  }

  let recentLogs = $derived($logs.slice(-8));

  function avatarPath(n: string) { return `./avatars/${n.toLowerCase().replace(/\s+/g, "_")}.png`; }
  let imgErr: Record<string, boolean> = $state({});

  let feedEl: HTMLDivElement;
  $effect(() => {
    recentLogs;
    if (feedEl) feedEl.scrollTop = feedEl.scrollHeight;
  });

  // Party panel state
  let search = $state("");
  let saving = $state(false);
  let partyName = $state("");
  let selectedParty = $state("");

  let filtered = $derived(
    search.trim()
      ? $characters.filter(c =>
          c.name.toLowerCase().includes(search.toLowerCase()) ||
          c.description.toLowerCase().includes(search.toLowerCase()))
      : $characters
  );

  function ini(n: string) { return n.split(" ").map(w => w[0]).join("").toUpperCase().slice(0, 2); }
  let panelImgErr: Record<string, boolean> = $state({});

  function handleSave() {
    if (partyName.trim()) { doSaveParty(partyName.trim()); partyName = ""; saving = false; }
  }

  let partyNames = $derived(Object.keys($savedParties));

  function handlePresetChange(e: Event) {
    const val = (e.target as HTMLSelectElement).value;
    selectedParty = val;
    if (val) doLoadParty(val);
  }

  function handleRenameParty() {
    if (!selectedParty) return;
    const newName = prompt("Rename party:", selectedParty);
    if (newName && newName.trim() && newName.trim() !== selectedParty) {
      // Save current active as new name, delete old
      doSaveParty(newName.trim());
      doDeleteParty(selectedParty);
      selectedParty = newName.trim();
    }
  }

  function handleDeleteParty() {
    if (!selectedParty) return;
    doDeleteParty(selectedParty);
    selectedParty = "";
  }
</script>

<div class="home-wrapper">
  <div class="home">
    <PartyBar />

    <div class="controls">
      <button class="btn source-btn" onclick={() => sourcePickerOpen.set(true)}>
        🖥 {$captureSourceName || "No Source"}
      </button>
      <button class="btn" class:resume={$paused} onclick={handleResume}>
        {$paused ? "▶ Resume" : "⏸ Pause"}
      </button>
      <button class="btn force" onclick={doForce}>💬 Force</button>
      <div class="spacer"></div>
      <div class="pill" class:paused={$paused}>
        <span class="dot"></span>
        {$paused ? "PAUSED" : "LIVE"}
      </div>
    </div>

    <div class="feed">
      <div class="feed-head">
        <span class="feed-title">Recent</span>
        <button class="view-all" onclick={() => activeView.set("log")}>View all →</button>
      </div>
      <div class="feed-list" bind:this={feedEl}>
        {#each recentLogs as entry, i (i)}
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
        {#if recentLogs.length === 0}
          <div class="empty">Waiting for activity...</div>
        {/if}
      </div>
    </div>
  </div>

  {#if $partyPanelOpen}
    <div class="party-panel">
      {#if $editingCharacter}
        <CharacterEditor />
      {:else}
        <div class="pp-header">
          <span class="pp-title">Party</span>
          <button class="pp-close" onclick={() => partyPanelOpen.set(false)}>×</button>
        </div>

        <input class="pp-search" placeholder="Search..." bind:value={search} />

        <div class="pp-list">
          {#each filtered as ch (ch.name)}
            {@const on = $activeCharacters.includes(ch.name)}
            <div class="pp-row" class:on>
              <button class="pp-char-btn" onclick={() => openCharacterEditor(ch.name)}>
                <div class="pp-av">
                  {#if !panelImgErr[ch.name]}
                    <img src={avatarPath(ch.name)} alt={ch.name} onerror={() => (panelImgErr[ch.name] = true)} />
                  {:else}
                    <span class="pp-ini">{ini(ch.name)}</span>
                  {/if}
                </div>
                <span class="pp-name">{ch.name}</span>
              </button>
              <button class="pp-badge" class:bon={on} onclick={() => toggleChar(ch.name)}>{on ? "IN" : "ADD"}</button>
            </div>
          {/each}
        </div>

        <div class="pp-bottom">
          {#if partyNames.length > 0}
            <div class="pp-presets-row">
              <select class="pp-select" value={selectedParty} onchange={handlePresetChange}>
                <option value="">Presets...</option>
                {#each partyNames as pn (pn)}
                  <option value={pn}>{pn}</option>
                {/each}
              </select>
              {#if selectedParty}
                <Tooltip text="Rename"><button class="pp-act" onclick={handleRenameParty}>&#9998;</button></Tooltip>
                <Tooltip text="Delete"><button class="pp-act pp-act-del" onclick={handleDeleteParty}>×</button></Tooltip>
              {/if}
            </div>
          {/if}
          {#if saving}
            <div class="pp-save-row">
              <input class="pp-sinput" placeholder="Name..." bind:value={partyName}
                onkeydown={(e) => { if (e.key === "Enter") handleSave(); }} />
              <button class="pp-sbtn" onclick={handleSave}>Save</button>
              <button class="pp-scancel" onclick={() => (saving = false)}>×</button>
            </div>
          {:else}
            <button class="pp-save-trigger" onclick={() => (saving = true)}>Save Party</button>
          {/if}
        </div>
      {/if}
    </div>
  {/if}

  {#if $sourcePickerOpen}
    <SourcePicker />
  {/if}
</div>

<style>
  .home-wrapper {
    display: flex;
    height: 100%;
    overflow: hidden;
  }

  .home {
    display: flex;
    flex-direction: column;
    height: 100%;
    overflow: hidden;
    flex: 1;
    min-width: 0;
  }

  .controls {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 12px 24px;
    border-bottom: 1px solid var(--ctp-surface0);
    flex-shrink: 0;
  }

  .btn {
    padding: 8px 18px;
    border-radius: 6px;
    border: 1px solid var(--ctp-surface0);
    background: var(--ctp-mantle);
    color: var(--ctp-text);
    font-size: 14px;
    font-weight: 600;
    cursor: pointer;
    font-family: inherit;
    transition: all 0.1s;
  }
  .btn:hover { background: var(--ctp-surface0); }
  .btn.source-btn {
    font-size: 12px;
    padding: 6px 12px;
    max-width: 160px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    border-color: var(--ctp-surface1);
    color: var(--ctp-overlay1);
  }
  .btn.source-btn:hover { border-color: var(--ctp-blue); color: var(--ctp-blue); }
  .btn.resume { background: var(--ctp-green); color: var(--ctp-base); border-color: var(--ctp-green); }
  .btn.force { border-color: var(--ctp-blue); color: var(--ctp-blue); }
  .btn.force:hover { background: rgba(137, 180, 250, 0.15); }

  .spacer { flex: 1; }

  .pill {
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: 12px;
    font-weight: 700;
    color: var(--ctp-green);
    letter-spacing: 1px;
    padding: 5px 14px;
    border-radius: 12px;
    background: rgba(166, 227, 161, 0.08);
    border: 1px solid rgba(166, 227, 161, 0.2);
  }
  .pill.paused {
    color: var(--ctp-yellow);
    background: rgba(249, 226, 175, 0.08);
    border-color: rgba(249, 226, 175, 0.2);
  }

  .dot {
    width: 7px;
    height: 7px;
    border-radius: 50%;
    background: var(--ctp-green);
    animation: blink 2s ease-in-out infinite;
  }
  .pill.paused .dot { background: var(--ctp-yellow); animation: none; }

  @keyframes blink {
    0%, 100% { opacity: 1; }
    50% { opacity: 0.3; }
  }

  .feed {
    flex: 1;
    display: flex;
    flex-direction: column;
    min-height: 0;
    padding: 0 24px 12px;
  }

  .feed-head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 14px 0 8px;
    flex-shrink: 0;
  }

  .feed-title {
    font-size: 13px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 1px;
    color: var(--ctp-overlay0);
  }

  .view-all {
    font-size: 13px;
    background: none;
    border: none;
    color: var(--ctp-blue);
    cursor: pointer;
    font-family: inherit;
    font-weight: 600;
  }
  .view-all:hover { text-decoration: underline; }

  .feed-list {
    flex: 1;
    overflow-y: auto;
    background: var(--ctp-crust);
    border-radius: 10px;
    padding: 12px;
    display: flex;
    flex-direction: column;
    gap: 8px;
    scrollbar-width: thin;
    scrollbar-color: var(--ctp-surface0) var(--ctp-crust);
  }

  .bubble-row {
    display: flex;
    gap: 10px;
    align-items: flex-start;
  }

  .bubble-av {
    width: 34px;
    height: 34px;
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
  .av-ini { font-size: 12px; font-weight: 800; }

  .bubble {
    background: var(--ctp-mantle);
    border-radius: 10px;
    border-top-left-radius: 2px;
    padding: 8px 12px;
    min-width: 0;
    flex: 1;
  }

  .bubble-name {
    display: block;
    font-size: 12px;
    font-weight: 800;
    margin-bottom: 2px;
    letter-spacing: 0.3px;
  }

  .bubble-text {
    display: block;
    font-size: 14px;
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

  /* Party side panel */
  .party-panel {
    width: 240px;
    flex-shrink: 0;
    display: flex;
    flex-direction: column;
    height: 100%;
    border-left: 1px solid var(--ctp-surface0);
    background: var(--ctp-base);
  }

  .pp-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 14px 14px 10px;
    flex-shrink: 0;
  }

  .pp-title {
    font-size: 14px;
    font-weight: 700;
    color: var(--ctp-text);
    text-transform: uppercase;
    letter-spacing: 1px;
  }

  .pp-close {
    background: none;
    border: none;
    color: var(--ctp-overlay0);
    font-size: 18px;
    cursor: pointer;
    padding: 0 4px;
    line-height: 1;
  }
  .pp-close:hover { color: var(--ctp-red); }

  .pp-search {
    margin: 0 14px 8px;
    background: var(--ctp-mantle);
    color: var(--ctp-text);
    border: 1px solid var(--ctp-surface0);
    border-radius: 5px;
    padding: 6px 10px;
    font-size: 13px;
    outline: none;
    font-family: inherit;
  }
  .pp-search:focus { border-color: var(--ctp-mauve); }
  .pp-search::placeholder { color: var(--ctp-surface1); }

  .pp-list {
    flex: 1;
    overflow-y: auto;
    padding: 0 10px;
    display: flex;
    flex-direction: column;
    gap: 3px;
    scrollbar-width: thin;
    scrollbar-color: var(--ctp-surface0) transparent;
  }

  .pp-row {
    display: flex;
    align-items: center;
    gap: 0;
    padding: 0;
    border: 1px solid transparent;
    border-radius: 6px;
    background: var(--ctp-mantle);
    width: 100%;
    transition: all 0.1s;
    flex-shrink: 0;
  }
  .pp-row:hover { border-color: var(--ctp-surface1); }
  .pp-row.on { border-color: rgba(137, 180, 250, 0.2); background: rgba(137, 180, 250, 0.04); }
  .pp-row:not(.on) { opacity: 0.55; }
  .pp-row:not(.on):hover { opacity: 0.85; }

  .pp-char-btn {
    display: flex;
    align-items: center;
    gap: 8px;
    flex: 1;
    min-width: 0;
    padding: 5px 0 5px 8px;
    background: none;
    border: none;
    cursor: pointer;
    text-align: left;
  }

  .pp-av {
    width: 28px;
    height: 28px;
    border-radius: 50%;
    overflow: hidden;
    background: var(--ctp-surface0);
    flex-shrink: 0;
    display: flex;
    align-items: center;
    justify-content: center;
  }
  .pp-av img { width: 100%; height: 100%; object-fit: cover; }
  .pp-ini { font-size: 11px; font-weight: 700; color: var(--ctp-blue); }

  .pp-name {
    flex: 1;
    font-size: 13px;
    font-weight: 600;
    color: var(--ctp-text);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    min-width: 0;
  }

  .pp-badge {
    font-size: 10px;
    font-weight: 700;
    padding: 2px 7px;
    margin-right: 8px;
    border-radius: 3px;
    background: var(--ctp-surface0);
    color: var(--ctp-surface1);
    letter-spacing: 0.5px;
    flex-shrink: 0;
    border: 1px solid transparent;
    cursor: pointer;
    font-family: inherit;
  }
  .pp-badge:hover { border-color: var(--ctp-surface2); }
  .pp-badge.bon { background: rgba(166, 227, 161, 0.1); color: var(--ctp-green); }
  .pp-badge.bon:hover { border-color: var(--ctp-green); }

  .pp-bottom {
    padding: 10px 14px;
    border-top: 1px solid var(--ctp-surface0);
    display: flex;
    flex-direction: column;
    gap: 6px;
    flex-shrink: 0;
  }

  .pp-presets-row {
    display: flex;
    align-items: center;
    gap: 4px;
  }

  .pp-select {
    flex: 1;
    min-width: 0;
    font-size: 12px;
    padding: 4px 6px;
    border-radius: 4px;
    border: 1px solid var(--ctp-surface1);
    background: var(--ctp-mantle);
    color: var(--ctp-mauve);
    font-family: inherit;
    font-weight: 600;
    cursor: pointer;
    outline: none;
  }
  .pp-select:focus { border-color: var(--ctp-mauve); }

  .pp-act {
    font-size: 14px;
    border: none;
    background: transparent;
    color: var(--ctp-overlay0);
    cursor: pointer;
    padding: 2px 4px;
    line-height: 1;
  }
  .pp-act:hover { color: var(--ctp-mauve); }
  .pp-act-del:hover { color: var(--ctp-red); }

  .pp-save-row { display: flex; gap: 4px; }
  .pp-sinput {
    flex: 1;
    background: var(--ctp-mantle);
    color: var(--ctp-text);
    border: 1px solid var(--ctp-surface1);
    border-radius: 4px;
    padding: 4px 8px;
    font-size: 12px;
    outline: none;
    font-family: inherit;
    min-width: 0;
  }
  .pp-sinput:focus { border-color: var(--ctp-mauve); }
  .pp-sbtn, .pp-scancel {
    font-size: 12px;
    padding: 4px 8px;
    border-radius: 4px;
    border: 1px solid var(--ctp-surface1);
    background: var(--ctp-mantle);
    cursor: pointer;
    font-family: inherit;
  }
  .pp-sbtn { color: var(--ctp-green); border-color: var(--ctp-green); }
  .pp-scancel { color: var(--ctp-surface1); }

  .pp-save-trigger {
    font-size: 12px;
    padding: 5px 10px;
    border-radius: 4px;
    border: 1px dashed var(--ctp-surface1);
    background: transparent;
    color: var(--ctp-overlay0);
    cursor: pointer;
    font-family: inherit;
    align-self: flex-start;
  }
  .pp-save-trigger:hover { border-color: var(--ctp-mauve); color: var(--ctp-mauve); }
</style>
