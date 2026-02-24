<script lang="ts">
  import { activeCharacters, characters, speaking, toggleChar, partyPanelOpen, openCharacterEditor, closeCharacterEditor } from "../lib/stores";
  import Tooltip from "./Tooltip.svelte";

  function avatarPath(n: string) { return `./avatars/${n.toLowerCase().replace(/\s+/g, "_")}.png`; }
  let imgErr: Record<string, boolean> = $state({});
  function ini(n: string) { return n.split(" ").map(w => w[0]).join("").toUpperCase().slice(0, 2); }
  function getChar(n: string) { return $characters.find(c => c.name === n); }

  function handleHeadClick(name: string) {
    partyPanelOpen.set(true);
    openCharacterEditor(name);
  }
</script>

<div class="party">
  <div class="heads">
    {#each $activeCharacters as name (name)}
      {@const isTalking = $speaking === name}
      {@const ch = getChar(name)}
      <Tooltip text={ch?.description || name} avatar={!imgErr[name] ? avatarPath(name) : undefined} initials={imgErr[name] ? ini(name) : undefined} position="bottom">
        <div class="head" class:talking={isTalking} onclick={() => handleHeadClick(name)} role="button" tabindex="0" onkeydown={(e) => { if (e.key === 'Enter') handleHeadClick(name); }}>
          <div class="ring" class:pulse={isTalking}>
            <div class="av">
              {#if !imgErr[name]}
                <img src={avatarPath(name)} alt={name} onerror={() => (imgErr[name] = true)} />
              {:else}
                <span class="ini">{ini(name)}</span>
              {/if}
            </div>
          </div>
          <span class="hname" class:glow={isTalking}>{name}</span>
          {#if isTalking}
            <div class="dots"><span></span><span></span><span></span></div>
          {/if}
        </div>
      </Tooltip>
    {/each}
    <Tooltip text="Edit party" position="bottom">
      <button class="add-btn" class:active={$partyPanelOpen} onclick={() => { closeCharacterEditor(); partyPanelOpen.update(v => !v); }}>
        +
      </button>
    </Tooltip>
  </div>
</div>

<style>
  .party { padding: 16px 24px 12px; }

  .heads {
    display: flex; gap: 12px; flex-wrap: wrap; align-items: flex-start;
  }

  .head {
    display: flex; flex-direction: column; align-items: center;
    gap: 4px; min-width: 64px; position: relative;
    cursor: pointer;
  }

  .ring {
    width: 50px; height: 50px; border-radius: 50%; padding: 2px;
    background: linear-gradient(135deg, var(--ctp-blue), var(--ctp-mauve));
    transition: box-shadow 0.3s, transform 0.15s;
  }

  .head:hover .ring:not(.pulse) {
    transform: scale(1.08);
  }

  .ring.pulse {
    animation: glow 1s ease-in-out infinite;
    box-shadow: 0 0 14px rgba(137, 180, 250, 0.6);
  }

  @keyframes glow {
    0%, 100% { box-shadow: 0 0 6px rgba(137, 180, 250, 0.3); }
    50% { box-shadow: 0 0 18px rgba(137, 180, 250, 0.7), 0 0 30px rgba(203, 166, 247, 0.3); }
  }

  .av {
    width: 100%; height: 100%; border-radius: 50%; overflow: hidden;
    background: var(--ctp-base); display: flex; align-items: center; justify-content: center;
  }
  .av img { width: 100%; height: 100%; object-fit: cover; }
  .ini { font-size: 15px; font-weight: 700; color: var(--ctp-blue); }

  .hname {
    font-size: 12px; font-weight: 600; color: var(--ctp-overlay0);
    max-width: 68px; text-align: center; overflow: hidden;
    text-overflow: ellipsis; white-space: nowrap;
  }
  .hname.glow { color: var(--ctp-blue); }

  .dots {
    display: flex; gap: 3px; position: absolute; bottom: 14px;
  }
  .dots span {
    width: 4px; height: 4px; border-radius: 50%;
    background: var(--ctp-blue); animation: bounce 1.2s ease-in-out infinite;
  }
  .dots span:nth-child(2) { animation-delay: 0.15s; }
  .dots span:nth-child(3) { animation-delay: 0.3s; }
  @keyframes bounce {
    0%, 80%, 100% { transform: scale(0.5); opacity: 0.3; }
    40% { transform: scale(1); opacity: 1; }
  }

  .add-btn {
    width: 50px; height: 50px; border-radius: 50%;
    border: 2px dashed var(--ctp-surface1); background: transparent;
    color: var(--ctp-overlay0); font-size: 22px; cursor: pointer;
    transition: all 0.15s; display: flex; align-items: center;
    justify-content: center; flex-shrink: 0; margin-top: 0;
  }
  .add-btn:hover { border-color: var(--ctp-mauve); color: var(--ctp-mauve); }
  .add-btn.active { border-color: var(--ctp-mauve); color: var(--ctp-mauve); border-style: solid; background: rgba(203, 166, 247, 0.1); }
</style>
