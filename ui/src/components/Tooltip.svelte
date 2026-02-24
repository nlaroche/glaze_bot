<script lang="ts">
  interface Props {
    text: string;
    avatar?: string;
    initials?: string;
    position?: "top" | "bottom";
    children: any;
  }

  let { text, avatar, initials, position = "top", children }: Props = $props();

  let show = $state(false);
  let timer: any = null;
  let wrapEl: HTMLDivElement | undefined = $state();
  let tipX = $state(0);
  let tipY = $state(0);

  function updatePosition() {
    if (!wrapEl) return;
    const rect = wrapEl.getBoundingClientRect();
    tipX = rect.left + rect.width / 2;
    tipY = position === "bottom" ? rect.bottom + 8 : rect.top - 8;
  }

  function onEnter() {
    timer = setTimeout(() => {
      updatePosition();
      show = true;
    }, 300);
  }
  function onLeave() {
    clearTimeout(timer);
    show = false;
  }
</script>

<!-- svelte-ignore a11y_no_static_element_interactions -->
<div class="tooltip-wrap" bind:this={wrapEl} onmouseenter={onEnter} onmouseleave={onLeave}>
  {@render children()}
  {#if show}
    <div
      class="tip"
      class:above={position === "top"}
      class:below={position === "bottom"}
      style="left: {tipX}px; top: {tipY}px;"
    >
      {#if avatar || initials}
        <div class="tip-av">
          {#if avatar}
            <img src={avatar} alt="" />
          {:else}
            <span class="tip-ini">{initials}</span>
          {/if}
        </div>
      {/if}
      <span class="tip-text">{text}</span>
    </div>
  {/if}
</div>

<style>
  .tooltip-wrap {
    position: relative;
    display: inline-flex;
  }

  .tip {
    position: fixed;
    transform: translateX(-50%);
    z-index: 9999;
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 8px 14px;
    border-radius: 8px;
    background: var(--ctp-mantle);
    color: var(--ctp-text);
    border: 1px solid var(--ctp-surface0);
    box-shadow: 0 4px 16px rgba(0, 0, 0, 0.35);
    font-size: 14px;
    font-weight: 600;
    white-space: nowrap;
    pointer-events: none;
    animation: tipIn 150ms ease forwards;
  }

  .tip.above {
    transform: translateX(-50%) translateY(-100%);
  }

  @keyframes tipIn {
    from {
      opacity: 0;
      transform: translateX(-50%) translateY(4px);
    }
    to {
      opacity: 1;
      transform: translateX(-50%) translateY(0);
    }
  }

  .tip.above {
    animation-name: tipInUp;
  }
  @keyframes tipInUp {
    from {
      opacity: 0;
      transform: translateX(-50%) translateY(calc(-100% + 4px));
    }
    to {
      opacity: 1;
      transform: translateX(-50%) translateY(-100%);
    }
  }

  .tip.below {
    animation-name: tipInDown;
  }
  @keyframes tipInDown {
    from {
      opacity: 0;
      transform: translateX(-50%) translateY(-4px);
    }
    to {
      opacity: 1;
      transform: translateX(-50%) translateY(0);
    }
  }

  .tip-av {
    width: 48px;
    height: 48px;
    border-radius: 50%;
    overflow: hidden;
    background: var(--ctp-surface0);
    flex-shrink: 0;
    display: flex;
    align-items: center;
    justify-content: center;
  }
  .tip-av img {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }
  .tip-ini {
    font-size: 16px;
    font-weight: 800;
    color: var(--ctp-blue);
  }

  .tip-text {
    line-height: 1.3;
  }
</style>
