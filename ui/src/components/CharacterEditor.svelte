<script lang="ts">
  import {
    editingCharacter, characterPersonality,
    closeCharacterEditor, saveCharacterPersonality, resetCharacterPersonality,
  } from "../lib/stores";

  const sliders = [
    { key: "energy", low: "Calm", high: "Hyped" },
    { key: "positivity", low: "Cynical", high: "Optimistic" },
    { key: "formality", low: "Casual", high: "Formal" },
    { key: "talkativeness", low: "Terse", high: "Chatty" },
    { key: "attitude", low: "Hostile", high: "Friendly" },
    { key: "humor", low: "Serious", high: "Silly" },
  ] as const;

  function set(key: string, val: number) {
    characterPersonality.update(p => ({ ...p, [key]: val }));
  }

  async function handleSave() {
    await saveCharacterPersonality();
    closeCharacterEditor();
  }
</script>

<div class="ce">
  <div class="ce-header">
    <button class="ce-back" onclick={closeCharacterEditor}>← Back</button>
    <span class="ce-name">{$editingCharacter}</span>
  </div>

  <div class="ce-sliders">
    {#each sliders as s (s.key)}
      {@const val = $characterPersonality[s.key as keyof typeof $characterPersonality]}
      <div class="ce-trait">
        <div class="ce-labels">
          <span class="ce-lo">{s.low}</span>
          <span class="ce-val">{val}</span>
          <span class="ce-hi">{s.high}</span>
        </div>
        <input type="range" min="0" max="100" value={val}
          oninput={(e) => set(s.key, parseInt((e.target as HTMLInputElement).value))} />
      </div>
    {/each}
  </div>

  <div class="ce-actions">
    <button class="ce-btn ce-reset" onclick={resetCharacterPersonality}>Reset</button>
    <button class="ce-btn ce-save" onclick={handleSave}>Save</button>
  </div>
</div>

<style>
  .ce {
    display: flex;
    flex-direction: column;
    height: 100%;
  }

  .ce-header {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 14px 14px 10px;
    flex-shrink: 0;
  }

  .ce-back {
    background: none;
    border: none;
    color: var(--ctp-blue);
    font-size: 13px;
    font-weight: 600;
    cursor: pointer;
    padding: 0;
    font-family: inherit;
  }
  .ce-back:hover { text-decoration: underline; }

  .ce-name {
    font-size: 14px;
    font-weight: 700;
    color: var(--ctp-text);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .ce-sliders {
    flex: 1;
    overflow-y: auto;
    padding: 4px 14px;
    display: flex;
    flex-direction: column;
    gap: 12px;
    scrollbar-width: thin;
    scrollbar-color: var(--ctp-surface0) transparent;
  }

  .ce-trait {
    display: flex;
    flex-direction: column;
    gap: 3px;
  }

  .ce-labels {
    display: flex;
    justify-content: space-between;
    align-items: center;
    font-size: 11px;
    color: var(--ctp-overlay0);
  }

  .ce-lo, .ce-hi {
    font-weight: 600;
    min-width: 0;
  }

  .ce-val {
    font-size: 10px;
    color: var(--ctp-surface2);
    font-weight: 700;
  }

  .ce-trait input[type="range"] {
    -webkit-appearance: none;
    appearance: none;
    width: 100%;
    height: 6px;
    border-radius: 3px;
    background: var(--ctp-surface0);
    outline: none;
    cursor: pointer;
  }

  .ce-trait input[type="range"]::-webkit-slider-thumb {
    -webkit-appearance: none;
    appearance: none;
    width: 14px;
    height: 14px;
    border-radius: 50%;
    background: var(--ctp-mauve);
    border: 2px solid var(--ctp-base);
    cursor: pointer;
  }

  .ce-trait input[type="range"]::-moz-range-thumb {
    width: 14px;
    height: 14px;
    border-radius: 50%;
    background: var(--ctp-mauve);
    border: 2px solid var(--ctp-base);
    cursor: pointer;
  }

  .ce-actions {
    display: flex;
    gap: 6px;
    padding: 10px 14px;
    border-top: 1px solid var(--ctp-surface0);
    flex-shrink: 0;
  }

  .ce-btn {
    flex: 1;
    padding: 6px 10px;
    border-radius: 5px;
    border: 1px solid var(--ctp-surface1);
    background: var(--ctp-mantle);
    font-size: 12px;
    font-weight: 600;
    cursor: pointer;
    font-family: inherit;
  }

  .ce-reset {
    color: var(--ctp-overlay0);
  }
  .ce-reset:hover { border-color: var(--ctp-overlay0); }

  .ce-save {
    color: var(--ctp-green);
    border-color: var(--ctp-green);
  }
  .ce-save:hover { background: rgba(166, 227, 161, 0.1); }
</style>
