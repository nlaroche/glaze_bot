<script lang="ts">
  import type { GachaCharacter } from '@glazebot/shared-types';
  import ProceduralAvatar from './ProceduralAvatar.svelte';

  interface Props {
    character: GachaCharacter;
    image?: string;
    onclick?: () => void;
    onremove?: () => void;
    active?: boolean;
    draggable?: boolean;
    ondragstart?: (e: DragEvent) => void;
    ondragend?: (e: DragEvent) => void;
    oncontextmenu?: (e: MouseEvent) => void;
  }

  let { character, image, onclick, onremove, active = false, draggable = false, ondragstart, ondragend, oncontextmenu }: Props = $props();

  const rarityColors: Record<string, string> = {
    common: 'var(--rarity-common)',
    rare: 'var(--rarity-rare)',
    epic: 'var(--rarity-epic)',
    legendary: 'var(--rarity-legendary)',
  };

  // Rarity base tints for the right-side fade
  const rarityBg: Record<string, string> = {
    common: '160, 174, 192',
    rare: '59, 151, 151',
    epic: '176, 106, 255',
    legendary: '255, 215, 0',
  };

  let dragging = $state(false);

  function handleDragStart(e: DragEvent) {
    dragging = true;
    e.dataTransfer!.effectAllowed = 'move';
    e.dataTransfer!.setData('text/plain', character.id);
    ondragstart?.(e);
  }

  function handleDragEnd(e: DragEvent) {
    dragging = false;
    ondragend?.(e);
  }
</script>

<div
  class="card-row rarity-{character.rarity}"
  class:clickable={!!onclick}
  class:dragging
  class:is-draggable={draggable}
  onclick={onclick}
  role={onclick ? 'button' : undefined}
  tabindex={onclick ? 0 : undefined}
  onkeydown={(e) => {
    if (onclick && (e.key === 'Enter' || e.key === ' ')) {
      e.preventDefault();
      onclick();
    }
  }}
  draggable={draggable ? 'true' : undefined}
  ondragstart={draggable ? handleDragStart : undefined}
  ondragend={draggable ? handleDragEnd : undefined}
  oncontextmenu={oncontextmenu ? (e) => { e.preventDefault(); oncontextmenu!(e); } : undefined}
  data-testid="character-card-row"
  data-character-id={character.id}
  style="--rarity-rgb: {rarityBg[character.rarity]}"
>
  <!-- Blurred character art background -->
  {#if image}
    <div class="bg-art">
      <img src={image} alt="" />
    </div>
  {/if}
  <!-- Gradient: dark on left, fades to rarity tint on right -->
  <div class="bg-fade"></div>

  <div class="content">
    <div class="avatar-ring" style="--ring-color: {rarityColors[character.rarity]}">
      {#if image}
        <img src={image} alt={character.name} class="avatar-img" />
      {:else}
        <div class="avatar-wrapper">
          <ProceduralAvatar seed={character.avatar_seed} rarity={character.rarity} size={44} />
        </div>
      {/if}
    </div>

    <div class="info">
      <span class="name">{character.name}</span>
      <span class="desc">{character.tagline || character.description}</span>
    </div>

    {#if onremove}
      <button
        class="action-btn"
        onclick={(e) => { e.stopPropagation(); onremove!(); }}
        title="Remove"
        data-testid="card-row-remove"
      >
        &times;
      </button>
    {/if}
  </div>
</div>

<style>
  .card-row {
    position: relative;
    border-radius: var(--radius-xl);
    overflow: hidden;
    min-height: 56px;
    background: rgba(10, 14, 24, 0.9);
    transition: transform var(--transition-slow) ease, box-shadow var(--transition-slow) ease;
    /* Bevel border like the cards */
    border: 1.5px solid;
    border-color:
      var(--white-a12)
      var(--white-a6)
      var(--black-a25)
      var(--white-a6);
    box-shadow:
      0 1px 3px var(--black-a30),
      inset 0 1px 0 var(--white-a5);
  }

  .card-row.rarity-rare {
    border-color:
      var(--teal-a25)
      var(--teal-a12)
      var(--black-a30)
      var(--teal-a12);
  }

  .card-row.rarity-epic {
    border-color:
      var(--epic-a30)
      var(--epic-a12)
      var(--black-a30)
      var(--epic-a12);
  }

  .card-row.rarity-legendary {
    border-color:
      var(--gold-a25)
      var(--gold-a15)
      var(--black-a30)
      var(--gold-a15);
  }

  .card-row.clickable {
    cursor: pointer;
  }

  /* Z-lift on hover */
  .card-row:hover {
    transform: translateY(-2px);
    box-shadow:
      0 4px 12px var(--black-a40),
      0 2px 4px var(--black-a30),
      inset 0 1px 0 var(--white-a6);
  }

  .card-row.rarity-rare:hover {
    box-shadow:
      0 4px 14px var(--teal-a15),
      0 2px 4px var(--black-a30),
      inset 0 1px 0 var(--white-a6);
  }

  .card-row.rarity-epic:hover {
    box-shadow:
      0 4px 14px var(--epic-a15),
      0 2px 4px var(--black-a30),
      inset 0 1px 0 var(--white-a6);
  }

  .card-row.rarity-legendary:hover {
    box-shadow:
      0 4px 14px var(--gold-a15),
      0 2px 4px var(--black-a30),
      inset 0 1px 0 var(--white-a6);
  }

  .card-row.dragging {
    opacity: 0.4;
    transform: scale(0.95);
  }

  /* Blurred art behind the row */
  .bg-art {
    position: absolute;
    inset: -10px;
    z-index: 0;
    overflow: hidden;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .bg-art img {
    width: 100%;
    height: 100%;
    object-fit: cover;
    image-rendering: pixelated;
    filter: blur(8px) brightness(0.4) saturate(1.4);
    transform: scale(1.3);
  }

  /* Gradient: solid dark on left, fading to rarity-tinted color on right */
  .bg-fade {
    position: absolute;
    inset: 0;
    z-index: 1;
    background: linear-gradient(
      to right,
      rgba(10, 14, 24, 0.95) 0%,
      rgba(10, 14, 24, 0.75) 35%,
      rgba(var(--rarity-rgb), 0.08) 70%,
      rgba(var(--rarity-rgb), 0.15) 100%
    );
  }

  .content {
    position: relative;
    z-index: 2;
    display: flex;
    align-items: center;
    gap: var(--space-2-5);
    padding: var(--space-1-5) var(--space-2-5);
  }

  .avatar-ring {
    width: 44px;
    height: 44px;
    flex-shrink: 0;
    border-radius: 50%;
    border: 2px solid var(--ring-color, var(--white-a10));
    overflow: hidden;
    display: flex;
    align-items: center;
    justify-content: center;
    background: var(--black-a40);
  }

  .avatar-img {
    width: 100%;
    height: 100%;
    object-fit: cover;
    image-rendering: pixelated;
  }

  .avatar-wrapper {
    width: 44px;
    height: 44px;
    overflow: hidden;
  }

  .avatar-wrapper :global(.avatar) {
    border: none !important;
    border-radius: 0 !important;
    box-shadow: none !important;
  }

  .info {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: var(--space-0-5);
  }

  .name {
    font-size: var(--font-base);
    font-weight: 600;
    color: var(--color-text-primary, #e2e8f0);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    text-shadow: 0 1px 3px rgba(0, 0, 0, 0.6);
  }

  .desc {
    font-size: var(--font-xs);
    color: var(--color-text-secondary, #b0b8c8);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    font-style: italic;
    text-shadow: 0 1px 2px rgba(0, 0, 0, 0.5);
  }

  .action-btn {
    flex-shrink: 0;
    width: 28px;
    height: 28px;
    border-radius: var(--radius-md);
    border: 1px solid var(--white-a8);
    background: var(--black-a30);
    color: var(--color-text-muted, #5a6474);
    font-size: var(--font-xl);
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: background var(--transition-base), color var(--transition-base);
    padding: var(--space-0);
    line-height: 1;
  }

  .action-btn:hover {
    background: rgba(255, 80, 80, 0.2);
    color: #ff6b6b;
    border-color: rgba(255, 80, 80, 0.3);
  }
</style>
