<script lang="ts">
  import { onMount } from 'svelte';
  import VisualRenderer from '$lib/overlay/VisualRenderer.svelte';
  import { pushVisuals } from '$lib/overlay/primitiveRegistry';

  interface Bubble {
    id: number;
    name: string;
    rarity: string;
    text: string;
    image?: string;
    visible: boolean;
    exiting: boolean;
    displayedText: string;
    charIndex: number;
    typingDone: boolean;
    holdUntil: number;
  }

  const rarityColors: Record<string, string> = {
    common: '#A0AEC0',
    rare: '#3B9797',
    epic: '#B06AFF',
    legendary: '#FFD700',
  };

  let bubbles: Bubble[] = $state([]);
  let tick = $state(0);
  let masterRunning = false;
  let masterInterval: ReturnType<typeof setInterval> | null = null;
  let hasReceivedMessage = $state(false);

  function addBubble(name: string, rarity: string, text: string, image?: string) {
    const id = Date.now() + Math.random();
    bubbles = [...bubbles, {
      id, name, rarity, text, image,
      visible: true,
      exiting: false,
      displayedText: '',
      charIndex: 0,
      typingDone: false,
      holdUntil: 0,
    }];
    tick++;
    hasReceivedMessage = true;
    ensureMasterLoop();
  }

  let dismissRequested = $state(false);

  function requestDismiss() {
    // Dismiss after 1s delay so the bubble lingers briefly after audio ends
    setTimeout(() => { dismissRequested = true; }, 1000);
  }

  function ensureMasterLoop() {
    if (masterRunning) return;
    masterRunning = true;
    masterInterval = setInterval(() => {
      let changed = false;
      const now = Date.now();

      for (const b of bubbles) {
        if (!b.typingDone) {
          if (b.charIndex <= b.text.length) {
            b.displayedText = b.text.slice(0, b.charIndex);
            b.charIndex++;
            changed = true;
          } else {
            b.typingDone = true;
            // No fixed holdUntil — wait for dismiss signal
            b.holdUntil = 0;
            changed = true;
          }
        } else if (!b.exiting && dismissRequested) {
          b.exiting = true;
          b.visible = false;
          b.holdUntil = now + 500;
          dismissRequested = false;
          changed = true;
        } else if (b.exiting && now >= b.holdUntil) {
          b.holdUntil = -1;
          changed = true;
        }
      }

      const before = bubbles.length;
      bubbles = bubbles.filter(b => b.holdUntil !== -1);
      if (bubbles.length !== before) changed = true;

      if (changed) tick++;

      if (bubbles.length === 0 && masterInterval) {
        clearInterval(masterInterval);
        masterRunning = false;
        masterInterval = null;
      }
    }, 35);
  }

  onMount(() => {
    // Tauri event listeners for real messages from main window
    (async () => {
      try {
        const { getCurrentWebview } = await import('@tauri-apps/api/webview');
        const { emitTo } = await import('@tauri-apps/api/event');
        const webview = getCurrentWebview();

        await webview.listen('chat-message', (event: any) => {
          const p = event.payload;
          addBubble(p.name, p.rarity, p.text, p.image);
          if (p.visuals?.length) {
            pushVisuals(p.visuals);
          }
        });

        await webview.listen('chat-dismiss', () => {
          requestDismiss();
        });

        await webview.listen('party-updated', () => {});

        await emitTo('main', 'overlay-ready', {});
      } catch (_) {}
    })();

    return () => {
      if (masterInterval) clearInterval(masterInterval);
    };
  });

  let visibleBubbles = $derived((() => { void tick; return bubbles; })());
</script>

<div class="overlay-root">
  <VisualRenderer />
  <div class="bubble-container">
    {#if !hasReceivedMessage && bubbles.length === 0}
      <div class="waiting-indicator">
        <span class="waiting-dot"></span>
        <span class="waiting-text">Waiting for commentary...</span>
      </div>
    {/if}
    {#each visibleBubbles as msg (msg.id)}
      {@const opacity = msg.visible && !msg.exiting ? 1 : 0}
      {@const tx = msg.visible && !msg.exiting ? 0 : msg.exiting ? 80 : 80}
      <div
        class="bubble-wrapper"
        style="opacity: {opacity}; transform: translateX({tx}px);"
      >
        <div class="speech-bubble">
          {#if msg.image}
            <div class="bubble-bg" style="background-image: url('{msg.image}');"></div>
          {/if}
          <div class="bubble-content">
            <div class="bubble-text-area">
              <span class="bubble-name" style="color: {rarityColors[msg.rarity] ?? '#fff'}">{msg.name}</span>
              <p class="bubble-text">
                <span class="fulltext" style="background-size: {msg.typingDone ? 100 : (msg.charIndex / msg.text.length) * 100}% 100%;">{msg.text}</span>
              </p>
            </div>
            <div class="character-avatar" style="border-color: {rarityColors[msg.rarity] ?? '#fff'}; box-shadow: 0 0 16px {rarityColors[msg.rarity] ?? '#fff'}44;">
              {#if msg.image}
                <img src={msg.image} alt={msg.name} />
              {:else}
                <span class="avatar-letter" style="color: {rarityColors[msg.rarity] ?? '#fff'}">{msg.name[0]}</span>
              {/if}
            </div>
          </div>
        </div>
      </div>
    {/each}
  </div>
</div>

<svelte:head>
  <style>
    html, body {
      background: transparent !important;
      overflow: hidden !important;
    }
  </style>
</svelte:head>

<style>
  .overlay-root {
    position: fixed;
    inset: 0;
    pointer-events: none;
    overflow: hidden;
    font-family: system-ui, sans-serif;
  }

  .bubble-container {
    position: absolute;
    bottom: var(--space-10);
    right: var(--space-10);
    display: flex;
    flex-direction: column;
    gap: var(--space-3);
    max-width: 560px;
    align-items: flex-end;
  }

  .waiting-indicator {
    display: flex;
    align-items: center;
    gap: var(--space-2);
    padding: var(--space-2-5) var(--space-4);
    background: var(--navy-a70);
    border: 1px solid var(--white-a8);
    border-radius: var(--radius-2xl);
    opacity: 0.6;
  }

  .waiting-dot {
    width: 6px;
    height: 6px;
    border-radius: var(--radius-full);
    background: rgba(255, 255, 255, 0.4);
    animation: pulse-wait 2s ease-in-out infinite;
  }

  @keyframes pulse-wait {
    0%, 100% { opacity: 1; }
    50% { opacity: 0.3; }
  }

  .waiting-text {
    font-size: var(--font-base);
    color: rgba(255, 255, 255, 0.5);
  }

  .bubble-wrapper {
    display: flex;
    align-items: flex-end;
    transition: opacity 0.4s ease, transform 0.4s cubic-bezier(0.34, 1.56, 0.64, 1);
  }

  .speech-bubble {
    position: relative;
    background: rgba(10, 14, 24, 0.92);
    border: 1px solid var(--white-a12);
    border-radius: 16px;
    padding: var(--space-4) var(--space-5);
    box-shadow: 0 6px 24px var(--black-a50);
    max-width: 520px;
    overflow: hidden;
  }

  .bubble-bg {
    position: absolute;
    inset: 0;
    background-size: cover;
    background-position: right center;
    filter: blur(24px) saturate(1.3);
    opacity: 0.35;
    mask-image: linear-gradient(to right, transparent 0%, transparent 60%, rgba(0,0,0,0.6) 80%, rgba(0,0,0,1) 100%);
    -webkit-mask-image: linear-gradient(to right, transparent 0%, transparent 60%, rgba(0,0,0,0.6) 80%, rgba(0,0,0,1) 100%);
    pointer-events: none;
  }

  .bubble-content {
    position: relative;
    z-index: 1;
    display: flex;
    align-items: center;
    gap: var(--space-4);
  }

  .bubble-text-area {
    flex: 1;
    min-width: 0;
  }

  .character-avatar {
    width: 72px;
    height: 72px;
    border-radius: var(--radius-full);
    border: 3px solid;
    overflow: hidden;
    flex-shrink: 0;
    background: rgba(10, 14, 24, 0.95);
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .character-avatar img {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }

  .avatar-letter {
    font-size: 1.6rem;
    font-weight: 700;
  }

  .bubble-name {
    font-size: var(--font-md);
    font-weight: 700;
    display: block;
    margin-bottom: var(--space-1);
    letter-spacing: 0.02em;
  }

  .bubble-text {
    margin: 0;
    font-size: var(--font-xl);
    line-height: 1.45;
    word-wrap: break-word;
  }

  .fulltext {
    color: transparent;
    background-image: linear-gradient(to right, rgba(255, 255, 255, 0.92) 100%, transparent 100%);
    background-repeat: no-repeat;
    background-position: left;
    -webkit-background-clip: text;
    background-clip: text;
  }

</style>
