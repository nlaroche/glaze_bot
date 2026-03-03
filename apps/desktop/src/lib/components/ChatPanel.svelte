<script lang="ts">
  import { getAuthState } from '$lib/stores/auth.svelte';
  import { getSessionStore, getActiveParty, sendUserMessage } from '$lib/stores/session.svelte';
  import { getDebugStore } from '$lib/stores/debug.svelte';
  import { getCollectionStore } from '$lib/stores/collection.svelte';

  const auth = getAuthState();
  const session = getSessionStore();
  const debug = getDebugStore();
  const chars = getCollectionStore();

  const rarityNameColor: Record<string, string> = {
    common: 'var(--rarity-common)',
    rare: 'var(--rarity-rare)',
    epic: 'var(--rarity-epic)',
    legendary: 'var(--rarity-legendary)',
  };

  // Chat log element for auto-scroll
  let chatLogEl: HTMLDivElement | undefined = $state();

  // Auto-scroll chat log
  $effect(() => {
    void session.chatLog.length;
    if (chatLogEl) {
      requestAnimationFrame(() => {
        chatLogEl!.scrollTop = chatLogEl!.scrollHeight;
      });
    }
  });

  // ── Text input ──
  let userInput = $state('');
  let chatInputEl = $state<HTMLInputElement | null>(null);

  let hasParty = $derived(session.partySlots.some((s) => s !== null));

  // ── @mention autocomplete ──
  let mentionQuery = $state<string | null>(null);
  let mentionIndex = $state(0);
  let mentionStartPos = $state(0);

  let mentionCandidates = $derived.by(() => {
    if (mentionQuery === null) return [];
    const q = mentionQuery.toLowerCase();
    const party = getActiveParty();
    if (!q) return party;
    return party.filter((c) => c.name.toLowerCase().includes(q));
  });

  /** Render @mentions in message text with cyan highlight */
  function renderMentions(text: string): string {
    const escaped = text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
    const party = getActiveParty();
    if (party.length === 0) return escaped;
    const names = party
      .map((c) => c.name)
      .sort((a, b) => b.length - a.length)
      .map((n) => n.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
    const pattern = new RegExp(`@(${names.join('|')})`, 'gi');
    return escaped.replace(pattern, '<span class="mention-highlight">@$1</span>');
  }

  function checkMention() {
    if (!chatInputEl) return;
    const val = userInput;
    const cursor = chatInputEl.selectionStart ?? val.length;
    const before = val.slice(0, cursor);
    const atIdx = before.lastIndexOf('@');
    if (atIdx === -1 || (atIdx > 0 && before[atIdx - 1] !== ' ')) {
      mentionQuery = null;
      return;
    }
    const query = before.slice(atIdx + 1);
    if (query.includes(' ')) {
      mentionQuery = null;
      return;
    }
    mentionQuery = query;
    mentionStartPos = atIdx;
    mentionIndex = 0;
  }

  function insertMention(charName: string) {
    const cursor = chatInputEl?.selectionStart ?? userInput.length;
    const before = userInput.slice(0, mentionStartPos);
    const after = userInput.slice(cursor);
    userInput = `${before}@${charName} ${after}`;
    mentionQuery = null;
    setTimeout(() => {
      if (chatInputEl) {
        chatInputEl.focus();
        const pos = before.length + charName.length + 2;
        chatInputEl.setSelectionRange(pos, pos);
      }
    }, 0);
  }

  function handleSendText() {
    if (!userInput.trim() || !hasParty) return;
    sendUserMessage(userInput.trim());
    userInput = '';
    mentionQuery = null;
  }

  function handleInputKeydown(e: KeyboardEvent) {
    const candidates = mentionCandidates;
    if (mentionQuery !== null && candidates.length > 0) {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        mentionIndex = (mentionIndex + 1) % candidates.length;
        return;
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        mentionIndex = (mentionIndex - 1 + candidates.length) % candidates.length;
        return;
      }
      if (e.key === 'Tab' || e.key === 'Enter') {
        e.preventDefault();
        insertMention(candidates[mentionIndex].name);
        return;
      }
      if (e.key === 'Escape') {
        e.preventDefault();
        mentionQuery = null;
        return;
      }
    }
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendText();
    }
  }
</script>

<!-- Commentary Log -->
<div class="chat-section-header">
  <h2>Chat History</h2>
</div>
<div class="chat-log" bind:this={chatLogEl}>
  {#if session.chatLog.length === 0}
    <div class="chat-empty">
      {#if !auth.isAuthenticated}
        <p>Sign in to start commentary.</p>
      {:else if chars.loading}
        <p>Loading characters...</p>
      {:else if chars.allCharacters.length === 0}
        <p>No characters yet. Open some booster packs first!</p>
      {:else if !session.activeShare}
        <p>Select a screen or app to capture.</p>
      {:else if !session.partySlots.some((s) => s !== null)}
        <p>Add at least one character to your party.</p>
      {:else}
        <p>Hit Start to begin commentary.</p>
      {/if}
    </div>
  {:else}
    {#each session.chatLog as msg (msg.id)}
      <div class="chat-msg" class:chat-msg-user={msg.isUserMessage}>
        <div class="msg-avatar" style="border-color: {msg.isUserMessage ? 'var(--color-teal)' : rarityNameColor[msg.rarity]}">
          {#if msg.image}
            <img src={msg.image} alt="" />
          {:else}
            <span class="msg-avatar-fallback">{msg.name[0]}</span>
          {/if}
        </div>
        <div class="msg-body">
          <div class="msg-header">
            <span class="msg-name" style="color: {msg.isUserMessage ? 'var(--color-teal)' : rarityNameColor[msg.rarity]}">{msg.name}</span>
            <span class="msg-time">{msg.time}</span>
          </div>
          <p class="msg-text">{@html renderMentions(msg.text)}</p>
        </div>
      </div>
    {/each}
  {/if}
</div>

<!-- Error banner (shows when there are recent errors) -->
{#if debug.errorCount > 0}
  <button class="error-banner" onclick={() => import('$app/navigation').then(m => m.goto('/settings'))}>
    <span class="error-banner-dot"></span>
    <span>{debug.errorCount} error{debug.errorCount > 1 ? 's' : ''} — click to view in Settings</span>
  </button>
{/if}

<!-- Text input bar (always visible, disabled when not running) -->
<div class="input-bar" class:input-bar-disabled={!hasParty}>
    {#if session.sttBubbleText}
      <div class="stt-bubble">
        <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><circle cx="6" cy="6" r="5" stroke="var(--color-teal)" stroke-width="1.5"/><path d="M6 3v3l2 1" stroke="var(--color-teal)" stroke-width="1.2" stroke-linecap="round"/></svg>
        <span>{session.sttBubbleText}</span>
      </div>
    {/if}
    <!-- @mention autocomplete dropdown -->
    {#if mentionQuery !== null && mentionCandidates.length > 0}
      <div class="mention-dropdown">
        {#each mentionCandidates as char, i (char.id)}
          <button
            class="mention-option"
            class:mention-option-active={i === mentionIndex}
            onmousedown={(e) => { e.preventDefault(); insertMention(char.name); }}
            onmouseenter={() => mentionIndex = i}
          >
            <span class="mention-avatar" style="border-color: {rarityNameColor[char.rarity]}">
              {#if char.avatar_url}
                <img src={char.avatar_url} alt="" />
              {:else}
                {char.name[0]}
              {/if}
            </span>
            <span class="mention-name" style="color: {rarityNameColor[char.rarity]}">{char.name}</span>
          </button>
        {/each}
      </div>
    {/if}
    <div class="input-row">
      {#if session.isRecording}
        <div class="recording-indicator">
          <span class="recording-dot"></span>
          <span>Listening...</span>
        </div>
      {/if}
      <input
        class="chat-input"
        type="text"
        placeholder={hasParty ? "Type @ to mention a character..." : "Add a character to chat..."}
        bind:value={userInput}
        bind:this={chatInputEl}
        oninput={checkMention}
        onkeydown={handleInputKeydown}
        disabled={!hasParty}
      />
      <button class="send-btn" onclick={handleSendText} disabled={!hasParty || !userInput.trim()}>
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M2 8l10-5-3 5 3 5z" fill="currentColor"/></svg>
      </button>
    </div>
  </div>

<style>
  .chat-section-header {
    padding: var(--space-3-5) var(--space-5) var(--space-2);
    flex-shrink: 0;
    display: flex;
    align-items: center;
    justify-content: space-between;
  }

  .chat-section-header h2 {
    font-size: var(--font-xs);
    text-transform: uppercase;
    letter-spacing: 1.5px;
    color: var(--color-text-muted, #6B7788);
    margin: 0;
    font-weight: 600;
  }

  /* ── Chat log ── */
  .chat-log {
    flex: 1;
    overflow-y: auto;
    padding: 0 var(--space-5) var(--space-3);
    display: flex;
    flex-direction: column;
    gap: var(--space-0-5);
  }

  .chat-empty {
    flex: 1;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .chat-empty p {
    color: var(--color-text-muted, #6B7788);
    font-size: var(--font-base);
  }

  .chat-msg {
    display: flex;
    gap: var(--space-2-5);
    padding: var(--space-2) var(--space-2-5);
    border-radius: var(--radius-md);
    transition: background 0.1s;
  }

  .chat-msg:hover {
    background: var(--white-a3);
  }

  .msg-avatar {
    width: 36px;
    height: 36px;
    flex-shrink: 0;
    border-radius: var(--radius-full);
    border: 2px solid var(--white-a10);
    overflow: hidden;
    background: var(--black-a30);
    display: flex;
    align-items: center;
    justify-content: center;
    margin-top: var(--space-0-5);
  }

  .msg-avatar img {
    width: 100%;
    height: 100%;
    object-fit: cover;
    image-rendering: pixelated;
  }

  .msg-avatar-fallback {
    font-size: var(--font-base);
    color: var(--color-text-muted, #6B7788);
    font-weight: 600;
  }

  .msg-body {
    flex: 1;
    min-width: 0;
  }

  .msg-header {
    display: flex;
    align-items: baseline;
    gap: var(--space-2);
  }

  .msg-name {
    font-size: var(--font-md);
    font-weight: 600;
  }

  .msg-time {
    font-size: var(--font-sm);
    color: var(--color-text-secondary, #8b95a8);
  }

  .msg-text {
    margin: 3px 0 0;
    font-size: var(--font-md);
    color: var(--color-text-primary, #d0d6e0);
    line-height: 1.45;
    user-select: text;
    -webkit-user-select: text;
  }

  .msg-text :global(.mention-highlight) {
    color: var(--color-teal, #3ecfcf);
    font-weight: 600;
  }

  /* ── User messages ── */
  .chat-msg-user {
    flex-direction: row-reverse;
  }

  .chat-msg-user .msg-body {
    text-align: right;
  }

  .chat-msg-user .msg-header {
    flex-direction: row-reverse;
  }

  /* ── Error banner ── */
  .error-banner {
    display: flex;
    align-items: center;
    gap: var(--space-2);
    padding: var(--space-1-5) var(--space-4);
    margin: 0 var(--space-4) var(--space-1);
    border-radius: var(--radius-md);
    background: rgba(239, 68, 68, 0.12);
    border: 1px solid rgba(239, 68, 68, 0.25);
    color: #f87171;
    font-size: var(--font-sm);
    font-family: inherit;
    cursor: pointer;
    transition: background 150ms ease;
  }

  .error-banner:hover {
    background: rgba(239, 68, 68, 0.2);
  }

  .error-banner-dot {
    width: 6px;
    height: 6px;
    border-radius: 50%;
    background: #ef4444;
    flex-shrink: 0;
    animation: error-pulse 2s ease-in-out infinite;
  }

  @keyframes error-pulse {
    0%, 100% { opacity: 1; }
    50% { opacity: 0.4; }
  }

  /* ── Text input bar ── */
  .input-bar {
    flex-shrink: 0;
    padding: var(--space-2) var(--space-5);
    position: relative;
  }

  .input-bar-disabled {
    opacity: 0.45;
    pointer-events: none;
  }

  .stt-bubble {
    display: flex;
    align-items: center;
    gap: var(--space-1-5);
    padding: var(--space-1) var(--space-2-5);
    margin-bottom: var(--space-1-5);
    border-radius: var(--radius-md);
    background: var(--teal-a8);
    border: 1px solid var(--teal-a20);
    font-size: var(--font-sm);
    color: var(--color-light-teal);
    animation: stt-fade 0.2s ease-in;
  }

  @keyframes stt-fade {
    from { opacity: 0; transform: translateY(4px); }
    to { opacity: 1; transform: translateY(0); }
  }

  /* ── @mention dropdown ── */
  .mention-dropdown {
    position: absolute;
    bottom: 100%;
    left: var(--space-5);
    right: var(--space-5);
    margin-bottom: var(--space-1);
    background: var(--color-surface-2, #1a2035);
    border: 1px solid var(--white-a10);
    border-radius: var(--radius-lg);
    padding: var(--space-1);
    display: flex;
    flex-direction: column;
    gap: 2px;
    box-shadow: 0 -4px 16px var(--black-a40);
    z-index: 10;
    animation: mention-slide 0.15s ease-out;
  }

  @keyframes mention-slide {
    from { opacity: 0; transform: translateY(4px); }
    to { opacity: 1; transform: translateY(0); }
  }

  .mention-option {
    display: flex;
    align-items: center;
    gap: var(--space-2);
    padding: var(--space-1-5) var(--space-2);
    border: none;
    border-radius: var(--radius-md);
    background: transparent;
    cursor: pointer;
    transition: background var(--transition-fast);
  }

  .mention-option:hover,
  .mention-option-active {
    background: var(--white-a8);
  }

  .mention-avatar {
    width: 24px;
    height: 24px;
    border-radius: var(--radius-full);
    border: 2px solid;
    overflow: hidden;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: var(--font-xs);
    color: var(--color-text-primary);
    background: var(--white-a4);
    flex-shrink: 0;
  }

  .mention-avatar img {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }

  .mention-name {
    font-size: var(--font-base);
    font-weight: 600;
  }

  .input-row {
    display: flex;
    align-items: center;
    gap: var(--space-1-5);
  }

  .recording-indicator {
    display: flex;
    align-items: center;
    gap: var(--space-1);
    padding: 0 var(--space-2);
    font-size: var(--font-sm);
    color: var(--color-stop, #FF6B6B);
    flex-shrink: 0;
  }

  .recording-dot {
    width: 8px;
    height: 8px;
    border-radius: var(--radius-full);
    background: var(--color-stop, #FF6B6B);
    animation: pulse 1s ease-in-out infinite;
  }

  @keyframes pulse {
    0%, 100% { opacity: 1; }
    50% { opacity: 0.4; }
  }

  .chat-input {
    flex: 1;
    padding: var(--space-2) var(--space-3);
    border-radius: var(--radius-lg);
    border: 1px solid var(--white-a10);
    background: var(--white-a4);
    color: var(--color-text-primary, #e2e8f0);
    font-size: var(--font-base);
    font-family: inherit;
    outline: none;
    transition: border-color var(--transition-base), background var(--transition-base);
  }

  .chat-input::placeholder {
    color: var(--color-text-muted, #6B7788);
  }

  .chat-input:focus {
    border-color: var(--white-a20);
    background: var(--white-a6);
  }

  .send-btn {
    width: 36px;
    height: 36px;
    border-radius: var(--radius-full);
    border: 1px solid var(--teal-a20);
    background: var(--teal-a8);
    color: var(--color-teal);
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
    transition: background var(--transition-base), border-color var(--transition-base);
  }

  .send-btn:hover:not(:disabled) {
    background: var(--teal-a20);
    border-color: var(--teal-a40);
  }

  .send-btn:disabled {
    opacity: 0.3;
    cursor: not-allowed;
  }
</style>
