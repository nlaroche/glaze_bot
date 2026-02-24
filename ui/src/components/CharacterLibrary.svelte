<script lang="ts">
  import {
    characters, activeCharacters, toggleChar,
    savedParties, doSaveParty, doLoadParty, doDeleteParty,
  } from "../lib/stores";

  let search = $state("");
  let saving = $state(false);
  let partyName = $state("");

  let filtered = $derived(
    search.trim()
      ? $characters.filter(c =>
          c.name.toLowerCase().includes(search.toLowerCase()) ||
          c.description.toLowerCase().includes(search.toLowerCase()))
      : $characters
  );

  function avatarPath(n: string) { return `./avatars/${n.toLowerCase().replace(/\s+/g, "_")}.png`; }
  let imgErr: Record<string, boolean> = $state({});
  function ini(n: string) { return n.split(" ").map(w => w[0]).join("").toUpperCase().slice(0, 2); }

  function handleSave() {
    if (partyName.trim()) { doSaveParty(partyName.trim()); partyName = ""; saving = false; }
  }

  let partyNames = $derived(Object.keys($savedParties));
</script>

<div class="page">
  <div class="page-head">
    <h2 class="page-title">Characters</h2>
    <input class="search" placeholder="Search characters..." bind:value={search} />
  </div>

  <div class="grid">
    {#each filtered as ch (ch.name)}
      {@const on = $activeCharacters.includes(ch.name)}
      <button class="row" class:on onclick={() => toggleChar(ch.name)}>
        <div class="rav">
          {#if !imgErr[ch.name]}
            <img src={avatarPath(ch.name)} alt={ch.name} onerror={() => (imgErr[ch.name] = true)} />
          {:else}
            <span class="rini">{ini(ch.name)}</span>
          {/if}
        </div>
        <div class="rinfo">
          <span class="rname">{ch.name}</span>
          <span class="rdesc">{ch.description}</span>
        </div>
        <span class="badge" class:bon={on}>{on ? "IN" : "ADD"}</span>
      </button>
    {/each}
  </div>

  <div class="party-mgr">
    {#if partyNames.length > 0}
      <div class="presets">
        <span class="presets-label">Presets:</span>
        {#each partyNames as pn (pn)}
          <button class="preset" onclick={() => doLoadParty(pn)}>{pn}</button>
          <button class="pdel" onclick={() => doDeleteParty(pn)}>×</button>
        {/each}
      </div>
    {/if}
    {#if saving}
      <div class="save-row">
        <input class="sinput" placeholder="Party name..." bind:value={partyName}
          onkeydown={(e) => { if (e.key === "Enter") handleSave(); }} />
        <button class="sbtn" onclick={handleSave}>Save</button>
        <button class="scancel" onclick={() => (saving = false)}>×</button>
      </div>
    {:else}
      <button class="save-trigger" onclick={() => (saving = true)}>Save Current Party</button>
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

  .page-head {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 16px 24px 12px;
    flex-shrink: 0;
  }

  .page-title {
    font-size: 18px;
    font-weight: 700;
    color: var(--ctp-text);
    white-space: nowrap;
  }

  .search {
    flex: 1;
    background: var(--ctp-mantle);
    color: var(--ctp-text);
    border: 1px solid var(--ctp-surface0);
    border-radius: 6px;
    padding: 8px 14px;
    font-size: 14px;
    outline: none;
    font-family: inherit;
  }
  .search:focus { border-color: var(--ctp-mauve); }
  .search::placeholder { color: var(--ctp-surface1); }

  .grid {
    flex: 1;
    overflow-y: auto;
    padding: 0 24px;
    display: flex;
    flex-direction: column;
    gap: 5px;
    scrollbar-width: thin;
    scrollbar-color: var(--ctp-surface0) transparent;
  }
  .grid::-webkit-scrollbar { width: 5px; }
  .grid::-webkit-scrollbar-thumb { background: var(--ctp-surface0); border-radius: 3px; }

  .row {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 8px 12px;
    border: 1px solid transparent;
    border-radius: 8px;
    background: var(--ctp-mantle);
    cursor: pointer;
    text-align: left;
    width: 100%;
    transition: all 0.1s;
    flex-shrink: 0;
  }
  .row:hover { border-color: var(--ctp-surface1); }
  .row.on { border-color: rgba(137, 180, 250, 0.2); background: rgba(137, 180, 250, 0.04); }
  .row:not(.on) { opacity: 0.55; }
  .row:not(.on):hover { opacity: 0.85; }

  .rav {
    width: 36px;
    height: 36px;
    border-radius: 50%;
    overflow: hidden;
    background: var(--ctp-surface0);
    flex-shrink: 0;
    display: flex;
    align-items: center;
    justify-content: center;
  }
  .rav img { width: 100%; height: 100%; object-fit: cover; }
  .rini { font-size: 13px; font-weight: 700; color: var(--ctp-blue); }

  .rinfo { flex: 1; min-width: 0; }
  .rname { font-size: 14px; font-weight: 600; color: var(--ctp-text); display: block; }
  .rdesc {
    font-size: 13px;
    color: var(--ctp-overlay0);
    display: block;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .badge {
    font-size: 11px;
    font-weight: 700;
    padding: 3px 10px;
    border-radius: 4px;
    background: var(--ctp-surface0);
    color: var(--ctp-surface1);
    letter-spacing: 0.5px;
  }
  .badge.bon { background: rgba(166, 227, 161, 0.1); color: var(--ctp-green); }

  .party-mgr {
    padding: 14px 24px 14px;
    display: flex;
    flex-direction: column;
    gap: 8px;
    border-top: 1px solid var(--ctp-surface0);
    flex-shrink: 0;
  }

  .presets {
    display: flex;
    gap: 6px;
    flex-wrap: wrap;
    align-items: center;
  }

  .presets-label {
    font-size: 12px;
    color: var(--ctp-overlay0);
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }

  .preset {
    font-size: 12px;
    padding: 4px 12px;
    border-radius: 5px;
    border: 1px solid var(--ctp-surface1);
    background: var(--ctp-mantle);
    color: var(--ctp-mauve);
    cursor: pointer;
    font-family: inherit;
    font-weight: 600;
  }
  .preset:hover { background: rgba(203, 166, 247, 0.1); border-color: var(--ctp-mauve); }

  .pdel {
    font-size: 12px;
    border: none;
    background: transparent;
    color: var(--ctp-surface1);
    cursor: pointer;
    padding: 0 2px;
  }
  .pdel:hover { color: var(--ctp-red); }

  .save-row { display: flex; gap: 6px; }
  .sinput {
    flex: 1;
    background: var(--ctp-mantle);
    color: var(--ctp-text);
    border: 1px solid var(--ctp-surface1);
    border-radius: 5px;
    padding: 5px 10px;
    font-size: 13px;
    outline: none;
    font-family: inherit;
  }
  .sinput:focus { border-color: var(--ctp-mauve); }
  .sbtn, .scancel {
    font-size: 13px;
    padding: 5px 12px;
    border-radius: 5px;
    border: 1px solid var(--ctp-surface1);
    background: var(--ctp-mantle);
    cursor: pointer;
    font-family: inherit;
  }
  .sbtn { color: var(--ctp-green); border-color: var(--ctp-green); }
  .scancel { color: var(--ctp-surface1); }

  .save-trigger {
    font-size: 13px;
    padding: 6px 14px;
    border-radius: 5px;
    border: 1px dashed var(--ctp-surface1);
    background: transparent;
    color: var(--ctp-overlay0);
    cursor: pointer;
    font-family: inherit;
    align-self: flex-start;
  }
  .save-trigger:hover { border-color: var(--ctp-mauve); color: var(--ctp-mauve); }
</style>
