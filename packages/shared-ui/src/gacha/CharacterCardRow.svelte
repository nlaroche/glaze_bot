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
      <span class="desc">{character.description}</span>
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
    border-radius: 10px;
    overflow: hidden;
    min-height: 56px;
    background: rgba(10, 14, 24, 0.9);
    transition: transform 0.2s ease, box-shadow 0.2s ease;
    /* Bevel border like the cards */
    border: 1.5px solid;
    border-color:
      rgba(255, 255, 255, 0.12)
      rgba(255, 255, 255, 0.06)
      rgba(0, 0, 0, 0.25)
      rgba(255, 255, 255, 0.06);
    box-shadow:
      0 1px 3px rgba(0, 0, 0, 0.3),
      inset 0 1px 0 rgba(255, 255, 255, 0.05);
  }

  .card-row.rarity-rare {
    border-color:
      rgba(59, 151, 151, 0.25)
      rgba(59, 151, 151, 0.12)
      rgba(0, 0, 0, 0.3)
      rgba(59, 151, 151, 0.12);
  }

  .card-row.rarity-epic {
    border-color:
      rgba(176, 106, 255, 0.25)
      rgba(176, 106, 255, 0.12)
      rgba(0, 0, 0, 0.3)
      rgba(176, 106, 255, 0.12);
  }

  .card-row.rarity-legendary {
    border-color:
      rgba(255, 215, 0, 0.3)
      rgba(255, 215, 0, 0.15)
      rgba(0, 0, 0, 0.3)
      rgba(255, 215, 0, 0.15);
  }

  .card-row.clickable {
    cursor: pointer;
  }

  /* Z-lift on hover */
  .card-row:hover {
    transform: translateY(-2px);
    box-shadow:
      0 4px 12px rgba(0, 0, 0, 0.4),
      0 2px 4px rgba(0, 0, 0, 0.3),
      inset 0 1px 0 rgba(255, 255, 255, 0.06);
  }

  .card-row.rarity-rare:hover {
    box-shadow:
      0 4px 14px rgba(59, 151, 151, 0.15),
      0 2px 4px rgba(0, 0, 0, 0.3),
      inset 0 1px 0 rgba(255, 255, 255, 0.06);
  }

  .card-row.rarity-epic:hover {
    box-shadow:
      0 4px 14px rgba(176, 106, 255, 0.15),
      0 2px 4px rgba(0, 0, 0, 0.3),
      inset 0 1px 0 rgba(255, 255, 255, 0.06);
  }

  .card-row.rarity-legendary:hover {
    box-shadow:
      0 4px 14px rgba(255, 215, 0, 0.15),
      0 2px 4px rgba(0, 0, 0, 0.3),
      inset 0 1px 0 rgba(255, 255, 255, 0.06);
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
    gap: 10px;
    padding: 6px 10px;
  }

  .avatar-ring {
    width: 44px;
    height: 44px;
    flex-shrink: 0;
    border-radius: 50%;
    border: 2px solid var(--ring-color, rgba(255,255,255,0.1));
    overflow: hidden;
    display: flex;
    align-items: center;
    justify-content: center;
    background: rgba(0, 0, 0, 0.4);
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
    gap: 2px;
  }

  .name {
    font-size: 0.9rem;
    font-weight: 600;
    color: var(--color-text-primary, #e2e8f0);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    text-shadow: 0 1px 3px rgba(0, 0, 0, 0.6);
  }

  .desc {
    font-size: 0.75rem;
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
    border-radius: 6px;
    border: 1px solid rgba(255, 255, 255, 0.08);
    background: rgba(0, 0, 0, 0.3);
    color: var(--color-text-muted, #5a6474);
    font-size: 1.1rem;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: background 0.15s, color 0.15s;
    padding: 0;
    line-height: 1;
  }

  .action-btn:hover {
    background: rgba(255, 80, 80, 0.2);
    color: #ff6b6b;
    border-color: rgba(255, 80, 80, 0.3);
  }
</style>
