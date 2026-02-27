<script lang="ts">
  import { CharacterCardRow, ContextMenu, CardViewer, ScreenPicker } from '@glazebot/shared-ui';
  import type { CaptureSource } from '@glazebot/shared-ui';
  import type { GachaCharacter } from '@glazebot/shared-types';
  import { getCollection, getCharacter } from '@glazebot/supabase-client';
  import { getAuthState } from '$lib/stores/auth.svelte';
  import {
    getSessionStore,
    setPartySlot,
    setActiveShare,
    setRunning,
    setPaused,
    setOverlayOn,
    clearChatLog,
    getActiveParty,
    initChatHistory,
    startNewSession,
    viewSession,
    returnToLive,
    removeSession,
    refreshSessions,
    setRecording,
    showSttBubble,
    sendUserMessage,
  } from '$lib/stores/session.svelte';
  import {
    getDebugStore,
    logDebug,
  } from '$lib/stores/debug.svelte';
  import type { ChatSession } from '$lib/stores/chatHistory';

  const auth = getAuthState();
  const session = getSessionStore();
  const debug = getDebugStore();

  // Character data from Supabase (cheap to re-fetch, not session-critical)
  let allCharacters = $state<GachaCharacter[]>([]);
  let loadingChars = $state(true);

  // Collection = all characters not in party
  let collection = $derived(
    allCharacters.filter((c) => !session.partySlots.some((s) => s?.id === c.id))
  );

  let searchQuery = $state('');
  let filteredCollection = $derived(
    searchQuery
      ? collection.filter((c) => c.name.toLowerCase().includes(searchQuery.toLowerCase()))
      : collection
  );

  // History panel state
  let historyOpen = $state(false);

  // Initialize chat history on mount
  $effect(() => {
    initChatHistory();
  });

  // Load characters from Supabase when authenticated
  $effect(() => {
    if (auth.isAuthenticated && !auth.loading) {
      loadCharacters();
    }
  });

  async function loadCharacters() {
    loadingChars = true;
    try {
      allCharacters = await getCollection();
    } catch (e) {
      console.error('Failed to load characters:', e);
      allCharacters = [];
    }
    loadingChars = false;
  }

  function removeFromParty(index: number) {
    setPartySlot(index, null);
    if (session.overlayOn) emitPartyToOverlay();
  }

  function addToParty(char: GachaCharacter) {
    const emptyIndex = session.partySlots.findIndex((s) => s === null);
    if (emptyIndex !== -1) {
      setPartySlot(emptyIndex, char);
      if (session.overlayOn) emitPartyToOverlay();
    }
  }

  // Drag-and-drop
  let dragOverPartySlot = $state<number | null>(null);
  let dragOverCollection = $state(false);

  function findCharById(id: string): GachaCharacter | undefined {
    return allCharacters.find((c) => c.id === id);
  }

  function handlePartySlotDrop(e: DragEvent, slotIndex: number) {
    e.preventDefault();
    dragOverPartySlot = null;
    const charId = e.dataTransfer?.getData('text/plain');
    if (!charId) return;
    const char = findCharById(charId);
    if (!char) return;

    const oldSlot = session.partySlots.findIndex((s) => s?.id === charId);
    if (oldSlot !== -1) setPartySlot(oldSlot, null);

    const displaced = session.partySlots[slotIndex];
    setPartySlot(slotIndex, char);
    if (displaced && oldSlot !== -1) {
      setPartySlot(oldSlot, displaced);
    }
  }

  function handleCollectionDrop(e: DragEvent) {
    e.preventDefault();
    dragOverCollection = false;
    const charId = e.dataTransfer?.getData('text/plain');
    if (!charId) return;
    const slotIndex = session.partySlots.findIndex((s) => s?.id === charId);
    if (slotIndex !== -1) setPartySlot(slotIndex, null);
  }

  // Chat log element for auto-scroll
  let chatLogEl: HTMLDivElement | undefined = $state();

  // Auto-scroll chat log (only when viewing live)
  $effect(() => {
    void session.chatLog.length;
    if (chatLogEl && !session.isViewingHistory) {
      requestAnimationFrame(() => {
        chatLogEl!.scrollTop = chatLogEl!.scrollHeight;
      });
    }
  });

  // Screen sharing state (local UI state — picker doesn't need to survive navigation)
  let pickerOpen = $state(false);
  let pickerInitialTab = $state<'screen' | 'app'>('screen');
  let captureSources = $state<CaptureSource[]>([]);
  let loadingSources = $state(false);

  async function openPicker(tab: 'screen' | 'app') {
    pickerInitialTab = tab;
    loadingSources = true;
    pickerOpen = true;
    try {
      const { invoke } = await import('@tauri-apps/api/core');
      const sources: any[] = await invoke('list_sources');
      captureSources = sources.map((s) => ({
        id: s.id,
        name: s.name,
        type: s.source_type === 'monitor' ? 'screen' as const : 'window' as const,
        thumbnail: s.thumbnail ?? undefined,
      }));
    } catch (e) {
      console.error('Failed to list sources:', e);
      captureSources = [];
    }
    loadingSources = false;
  }

  function handleSourceSelect(source: CaptureSource) {
    setActiveShare(source);
    pickerOpen = false;
  }

  async function stopSharing() {
    if (session.isRunning) {
      handleStop();
    }
    // Hide overlay window when share stops — but preserve the preference
    try {
      const { invoke } = await import('@tauri-apps/api/core');
      await invoke('hide_overlay');
    } catch (e) {
      console.error('Failed to hide overlay:', e);
    }
    setActiveShare(null);
  }

  // Commentary controls
  let canStart = $derived(!!session.activeShare && session.partySlots.some((s) => s !== null) && !session.isRunning);

  async function handleStart() {
    if (!session.activeShare) return;
    const party = getActiveParty();
    if (party.length === 0) return;

    // Re-fetch characters from DB to pick up any changes (e.g. voice reassignment)
    const freshParty = await Promise.all(
      party.map(async (c) => {
        try {
          const fresh = await getCharacter(c.id);
          // Update the party slot with fresh data
          const idx = session.partySlots.findIndex((s) => s?.id === c.id);
          if (idx !== -1) setPartySlot(idx, fresh);
          return fresh;
        } catch {
          return c; // fallback to cached if fetch fails
        }
      })
    );

    setRunning(true);
    setPaused(false);
    const partyNames = freshParty.map((c) => c.name);
    await startNewSession(partyNames);
    await session.engine.start(session.activeShare.id, freshParty);

    // Init speech (whisper model + VAD if always-on)
    await initSpeech();

    // Auto-show overlay if preference is ON
    if (session.overlayOn) {
      try {
        const { invoke } = await import('@tauri-apps/api/core');
        await invoke('show_overlay');
        const { getCurrentWebview } = await import('@tauri-apps/api/webview');
        const webview = getCurrentWebview();
        await new Promise<void>((resolve) => {
          const timeout = setTimeout(() => {
            console.warn('[main] Overlay ready timeout, proceeding anyway');
            resolve();
          }, 5000);
          webview.listen('overlay-ready', () => {
            clearTimeout(timeout);
            resolve();
          });
        });
        await emitPartyToOverlay();
      } catch (e) {
        console.error('Failed to auto-show overlay:', e);
      }
    }
  }

  function handlePauseResume() {
    if (session.isPaused) {
      setPaused(false);
      session.engine.resume();
    } else {
      setPaused(true);
      session.engine.pause();
    }
  }

  function handleStop() {
    setRunning(false);
    setPaused(false);
    session.engine.stop();
    cleanupSpeech();
    // Refresh sessions list so the just-finished session shows updated message count
    refreshSessions();
  }

  // Keep engine party in sync
  $effect(() => {
    const party = session.partySlots.filter((s): s is GachaCharacter => s !== null);
    session.engine.updateParty(party);
  });

  async function emitPartyToOverlay() {
    try {
      const { emitTo } = await import('@tauri-apps/api/event');
      const activeMembers = session.partySlots
        .filter((s): s is GachaCharacter => s !== null)
        .map((c) => ({ id: c.id, name: c.name, rarity: c.rarity, image: c.avatar_url }));
      await emitTo('overlay', 'party-updated', { members: activeMembers });
    } catch (e) {
      console.error('Failed to emit party:', e);
    }
  }

  async function toggleOverlay() {
    setOverlayOn(!session.overlayOn);

    // Only show/hide the overlay window if screen share is active
    if (!session.activeShare) return;

    try {
      const { invoke } = await import('@tauri-apps/api/core');
      if (session.overlayOn) {
        await invoke('show_overlay');
        const { getCurrentWebview } = await import('@tauri-apps/api/webview');
        const webview = getCurrentWebview();
        await new Promise<void>((resolve) => {
          const timeout = setTimeout(() => {
            console.warn('[main] Overlay ready timeout, proceeding anyway');
            resolve();
          }, 5000);
          webview.listen('overlay-ready', () => {
            clearTimeout(timeout);
            resolve();
          });
        });
        await emitPartyToOverlay();
      } else {
        await invoke('hide_overlay');
      }
    } catch (e) {
      console.error('Overlay toggle failed:', e);
    }
  }

  // Context menu state
  let contextMenu = $state<{ x: number; y: number; character: GachaCharacter; inPartySlot?: number } | null>(null);

  function openContextMenu(e: MouseEvent, char: GachaCharacter, partySlot?: number) {
    contextMenu = { x: e.clientX, y: e.clientY, character: char, inPartySlot: partySlot };
  }

  // Card viewer state
  let viewerCharacter = $state<GachaCharacter | null>(null);

  const rarityNameColor: Record<string, string> = {
    common: 'var(--rarity-common)',
    rare: 'var(--rarity-rare)',
    epic: 'var(--rarity-epic)',
    legendary: 'var(--rarity-legendary)',
  };

  // ── History helpers ──

  function groupSessionsByDate(sessions: ChatSession[]): { label: string; sessions: ChatSession[] }[] {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    const weekAgo = new Date(today);
    weekAgo.setDate(weekAgo.getDate() - 7);

    const groups: { label: string; sessions: ChatSession[] }[] = [
      { label: 'Today', sessions: [] },
      { label: 'Yesterday', sessions: [] },
      { label: 'Last 7 Days', sessions: [] },
      { label: 'Older', sessions: [] },
    ];

    for (const s of sessions) {
      const d = new Date(s.startedAt);
      if (d >= today) {
        groups[0].sessions.push(s);
      } else if (d >= yesterday) {
        groups[1].sessions.push(s);
      } else if (d >= weekAgo) {
        groups[2].sessions.push(s);
      } else {
        groups[3].sessions.push(s);
      }
    }

    return groups.filter((g) => g.sessions.length > 0);
  }

  function formatSessionTime(iso: string): string {
    return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }

  let groupedSessions = $derived(groupSessionsByDate(session.historySessions));

  function handleViewSession(sessionId: string) {
    viewSession(sessionId);
  }

  function handleReturnToLive() {
    returnToLive();
  }

  function handleDeleteSession(e: MouseEvent, sessionId: string) {
    e.stopPropagation();
    removeSession(sessionId);
  }

  // ── Text input ──
  let userInput = $state('');

  function handleSendText() {
    if (!userInput.trim() || !session.isRunning) return;
    sendUserMessage(userInput.trim());
    userInput = '';
  }

  function handleInputKeydown(e: KeyboardEvent) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendText();
    }
  }

  // ── Push-to-Talk ──
  let pttActive = $state(false);

  $effect(() => {
    if (debug.speechMode !== 'push-to-talk' || !session.isRunning) return;

    function onKeyDown(e: KeyboardEvent) {
      if (e.code !== debug.pttKey || e.repeat || pttActive) return;
      pttActive = true;
      setRecording(true);
      logDebug('stt-request', { mode: 'ptt', key: e.code });
      import('@tauri-apps/api/core').then(({ invoke }) => {
        invoke('start_recording').catch((err: unknown) => {
          console.error('Failed to start recording:', err);
          pttActive = false;
          setRecording(false);
        });
      });
    }

    function onKeyUp(e: KeyboardEvent) {
      if (e.code !== debug.pttKey || !pttActive) return;
      pttActive = false;
      setRecording(false);
      import('@tauri-apps/api/core').then(({ invoke }) => {
        invoke<string>('stop_recording').then((text) => {
          if (text && text.trim()) {
            logDebug('stt-response', { mode: 'ptt', text });
            showSttBubble(text.trim());
            sendUserMessage(text.trim());
          }
        }).catch((err: unknown) => {
          console.error('Failed to stop recording:', err);
        });
      });
    }

    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);

    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
    };
  });

  // ── Always-on VAD STT listener ──
  $effect(() => {
    if (debug.speechMode !== 'always-on' || !session.isRunning) return;

    let unlisten: (() => void) | undefined;

    import('@tauri-apps/api/webview').then(({ getCurrentWebview }) => {
      getCurrentWebview().listen<string>('stt-result', (event) => {
        const text = event.payload;
        if (text && text.trim()) {
          logDebug('stt-response', { mode: 'always-on', text });
          showSttBubble(text.trim());
          sendUserMessage(text.trim());
        }
      }).then((fn) => { unlisten = fn; });
    });

    return () => {
      unlisten?.();
    };
  });

  // ── Whisper + VAD lifecycle ──
  async function initSpeech() {
    if (debug.speechMode === 'off') return;
    try {
      const { invoke } = await import('@tauri-apps/api/core');
      await invoke('init_whisper');

      if (debug.speechMode === 'always-on') {
        await invoke('set_vad_config', { threshold: debug.vadThreshold, silenceMs: debug.vadSilenceMs });
        await invoke('start_vad');
      }
    } catch (e) {
      console.error('Failed to init speech:', e);
    }
  }

  async function cleanupSpeech() {
    try {
      const { invoke } = await import('@tauri-apps/api/core');
      await invoke('stop_vad');
    } catch {
      // Ignore — may not have been started
    }
  }
</script>

<div class="home">
  <!-- History sidebar -->
  <aside class="history-panel" class:history-open={historyOpen}>
    <button class="history-toggle" onclick={() => { historyOpen = !historyOpen; }} title={historyOpen ? 'Close history' : 'Open history'}>
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
        <circle cx="8" cy="8" r="6" />
        <polyline points="8,4 8,8 11,10" />
      </svg>
    </button>

    {#if historyOpen}
      <div class="history-content">
        <div class="history-header">
          <h2>Sessions</h2>
        </div>

        {#if session.isViewingHistory}
          <button class="back-to-live" onclick={handleReturnToLive}>
            <span class="live-dot"></span>
            Back to Live
          </button>
        {/if}

        <div class="history-list">
          {#if groupedSessions.length === 0}
            <p class="history-empty">No past sessions yet.</p>
          {:else}
            {#each groupedSessions as group}
              <div class="history-group">
                <span class="history-group-label">{group.label}</span>
                {#each group.sessions as sess (sess.id)}
                  <button
                    class="history-item"
                    class:history-item-active={session.viewingSessionId === sess.id}
                    class:history-item-current={session.currentSessionId === sess.id}
                    onclick={() => handleViewSession(sess.id)}
                  >
                    <div class="history-item-top">
                      <span class="history-item-time">{formatSessionTime(sess.startedAt)}</span>
                      <span class="history-item-count">{sess.messageCount} msg{sess.messageCount !== 1 ? 's' : ''}</span>
                    </div>
                    <div class="history-item-party">
                      {sess.partyNames.join(', ')}
                    </div>
                    {#if session.currentSessionId !== sess.id}
                      <button class="history-item-delete" onclick={(e) => handleDeleteSession(e, sess.id)} title="Delete session">&times;</button>
                    {/if}
                  </button>
                {/each}
              </div>
            {/each}
          {/if}
        </div>
      </div>
    {/if}
  </aside>

  <!-- Left / Center area -->
  <div class="main-area">
    <!-- Commentary Log -->
    <div class="chat-section-header">
      <h2>
        {#if session.isViewingHistory}
          Viewing Past Session
        {:else}
          Chat History
        {/if}
      </h2>
      {#if session.isViewingHistory}
        <button class="back-btn" onclick={handleReturnToLive}>Back to Live</button>
      {/if}
    </div>
    <div class="chat-log" bind:this={chatLogEl}>
      {#if session.chatLog.length === 0}
        <div class="chat-empty">
          {#if session.isViewingHistory}
            <p>This session has no messages.</p>
          {:else if !auth.isAuthenticated}
            <p>Sign in to start commentary.</p>
          {:else if loadingChars}
            <p>Loading characters...</p>
          {:else if allCharacters.length === 0}
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
              <p class="msg-text">{msg.text}</p>
            </div>
          </div>
        {/each}
      {/if}
    </div>

    <!-- Text input bar (shown when running and not viewing history) -->
    {#if session.isRunning && !session.isViewingHistory}
      <div class="input-bar">
        {#if session.sttBubbleText}
          <div class="stt-bubble">
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><circle cx="6" cy="6" r="5" stroke="var(--color-teal)" stroke-width="1.5"/><path d="M6 3v3l2 1" stroke="var(--color-teal)" stroke-width="1.2" stroke-linecap="round"/></svg>
            <span>{session.sttBubbleText}</span>
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
            placeholder="Type a message..."
            bind:value={userInput}
            onkeydown={handleInputKeydown}
          />
          <button class="send-btn" onclick={handleSendText} disabled={!userInput.trim()}>
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M2 8l10-5-3 5 3 5z" fill="currentColor"/></svg>
          </button>
        </div>
      </div>
    {/if}

    <!-- Controls Bar (hidden when viewing history) -->
    {#if !session.isViewingHistory}
      <div class="controls-bar">
        <!-- Capture group / Active share -->
        <div class="ctrl-group">
          <span class="ctrl-label">Capture</span>
          {#if session.activeShare}
            <div class="share-inline">
              <div class="share-pulse"></div>
              <span class="share-name" title={session.activeShare.name}>{session.activeShare.name}</span>
              <button class="share-x" onclick={stopSharing} title="Stop sharing">&times;</button>
            </div>
          {:else}
            <div class="ctrl-group-buttons">
              <button class="ctrl-btn capture" onclick={() => openPicker('screen')}>
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><rect x="2" y="3" width="12" height="10" rx="1.5" stroke="currentColor" stroke-width="1.5"/><circle cx="8" cy="8" r="2" stroke="currentColor" stroke-width="1.5"/></svg>
                Screen
              </button>
              <button class="ctrl-btn capture" onclick={() => openPicker('app')}>
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><rect x="3" y="2" width="10" height="12" rx="1.5" stroke="currentColor" stroke-width="1.5"/><path d="M6 5h4M6 8h4M6 11h2" stroke="currentColor" stroke-width="1.2" stroke-linecap="round"/></svg>
                App
              </button>
            </div>
          {/if}
        </div>

        <div class="ctrl-divider"></div>

        <!-- Playback group -->
        <div class="ctrl-group">
          <span class="ctrl-label">Commentary</span>
          <div class="ctrl-group-buttons">
            <button class="ctrl-btn start" disabled={!canStart} onclick={handleStart}>>
              <svg width="14" height="14" viewBox="0 0 14 14" fill="currentColor"><polygon points="3,1 12,7 3,13"/></svg>
              Start
            </button>
            <button class="ctrl-btn" disabled={!session.isRunning} onclick={handlePauseResume}>
              {#if session.isPaused}
                <svg width="14" height="14" viewBox="0 0 14 14" fill="currentColor"><polygon points="3,1 12,7 3,13"/></svg>
                Resume
              {:else}
                <svg width="14" height="14" viewBox="0 0 14 14" fill="currentColor"><rect x="2" y="1" width="3.5" height="12" rx="1"/><rect x="8.5" y="1" width="3.5" height="12" rx="1"/></svg>
                Pause
              {/if}
            </button>
            <button class="ctrl-btn stop" disabled={!session.isRunning} onclick={handleStop}>
              <svg width="14" height="14" viewBox="0 0 14 14" fill="currentColor"><rect x="2" y="2" width="10" height="10" rx="1.5"/></svg>
              Stop
            </button>
          </div>
        </div>

        <div class="ctrl-divider"></div>

        <!-- Overlay toggle — toggles preference anytime, shows/hides window only during screen share -->
        <div class="ctrl-group">
          <span class="ctrl-label">Overlay</span>
          <button
            class="toggle"
            class:toggle-on={session.overlayOn}
            onclick={toggleOverlay}
            aria-pressed={session.overlayOn}
            title={session.activeShare ? '' : 'Overlay will appear when screen sharing starts'}
          >
            <span class="toggle-knob"></span>
          </button>
        </div>
      </div>
    {/if}
  </div>

  <!-- Right Panel -->
  <aside class="right-panel">
    <div class="panel-section party-section">
      <div class="panel-header">
        <h2>Active Party</h2>
        <div class="party-actions">
          <button class="small-btn">Save</button>
          <button class="small-btn">Load</button>
        </div>
      </div>
      <div class="party-slots">
        {#each session.partySlots as slot, i}
          <div
            class="drop-zone"
            class:drop-active={dragOverPartySlot === i}
            ondragover={(e) => { e.preventDefault(); dragOverPartySlot = i; }}
            ondragleave={() => { if (dragOverPartySlot === i) dragOverPartySlot = null; }}
            ondrop={(e) => handlePartySlotDrop(e, i)}
          >
            {#if slot}
              <CharacterCardRow
                character={slot}
                image={slot.avatar_url}
                draggable={true}
                onremove={() => removeFromParty(i)}
                oncontextmenu={(e) => openContextMenu(e, slot, i)}
              />
            {:else}
              <div class="empty-slot">
                <span class="plus">+</span>
                <span class="empty-label">Drag character here</span>
              </div>
            {/if}
          </div>
        {/each}
      </div>
    </div>

    <div class="panel-divider"></div>

    <div class="panel-section collection-section">
      <div class="panel-header">
        <h2>Collection</h2>
      </div>
      <input
        class="search-input"
        type="text"
        placeholder="Search characters..."
        bind:value={searchQuery}
      />
      <div
        class="collection-list"
        class:drop-active={dragOverCollection}
        ondragover={(e) => { e.preventDefault(); dragOverCollection = true; }}
        ondragleave={() => { dragOverCollection = false; }}
        ondrop={handleCollectionDrop}
      >
        {#if loadingChars}
          <p class="empty-msg">Loading characters...</p>
        {:else}
          {#each filteredCollection as char (char.id)}
            <CharacterCardRow
              character={char}
              image={char.avatar_url}
              draggable={true}
              onclick={() => addToParty(char)}
              oncontextmenu={(e) => openContextMenu(e, char)}
            />
          {:else}
            <p class="empty-msg">
              {#if allCharacters.length === 0}
                No characters yet.
              {:else if searchQuery}
                No matches found.
              {:else}
                All characters are in your party!
              {/if}
            </p>
          {/each}
        {/if}
      </div>
    </div>
  </aside>
</div>

{#if contextMenu}
  <ContextMenu
    x={contextMenu.x}
    y={contextMenu.y}
    onclose={() => { contextMenu = null; }}
    items={[
      {
        label: 'View Card',
        icon: '🃏',
        onclick: () => { viewerCharacter = contextMenu!.character; },
      },
      ...(contextMenu.inPartySlot !== undefined
        ? [
            { label: '', icon: '', onclick: () => {}, separator: true },
            {
              label: 'Remove from Party',
              icon: '✕',
              onclick: () => { removeFromParty(contextMenu!.inPartySlot!); },
            },
          ]
        : []),
    ]}
  />
{/if}

<CardViewer
  character={viewerCharacter}
  image={viewerCharacter?.avatar_url}
  onclose={() => { viewerCharacter = null; }}
/>

<ScreenPicker
  open={pickerOpen}
  initialTab={pickerInitialTab}
  sources={captureSources}
  loading={loadingSources}
  onselect={handleSourceSelect}
  onclose={() => { pickerOpen = false; }}
/>

<style>
  .home {
    display: flex;
    height: 100%;
    gap: 0;
    overflow: hidden;
  }

  /* ── History sidebar ── */
  .history-panel {
    display: flex;
    flex-direction: column;
    width: 40px;
    flex-shrink: 0;
    border-right: 1px solid var(--white-a6);
    background: var(--black-a10);
    transition: width 0.2s ease;
    overflow: hidden;
  }

  .history-panel.history-open {
    width: 240px;
  }

  .history-toggle {
    width: 100%;
    padding: var(--space-3) var(--space-2-5);
    border: none;
    background: none;
    color: var(--color-text-muted, #6B7788);
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
    transition: color var(--transition-base), background var(--transition-base);
  }

  .history-toggle:hover {
    color: var(--color-text-primary, #e2e8f0);
    background: var(--white-a4);
  }

  .history-open .history-toggle {
    justify-content: flex-start;
    padding-left: var(--space-3);
  }

  .history-content {
    flex: 1;
    display: flex;
    flex-direction: column;
    overflow: hidden;
    padding: 0 var(--space-2) var(--space-2);
  }

  .history-header {
    padding: var(--space-1) var(--space-1) var(--space-2);
  }

  .history-header h2 {
    font-size: var(--font-xs);
    text-transform: uppercase;
    letter-spacing: 1.5px;
    color: var(--color-text-muted, #6B7788);
    margin: 0;
    font-weight: 600;
  }

  .back-to-live {
    display: flex;
    align-items: center;
    gap: var(--space-1-5);
    padding: var(--space-1-5) var(--space-2);
    border-radius: var(--radius-md);
    border: 1px solid rgba(91, 202, 122, 0.25);
    background: rgba(91, 202, 122, 0.08);
    color: var(--color-start, #5BCA7A);
    font-size: var(--font-xs);
    cursor: pointer;
    margin-bottom: var(--space-2);
    transition: background var(--transition-base);
    width: 100%;
  }

  .back-to-live:hover {
    background: rgba(91, 202, 122, 0.15);
  }

  .live-dot {
    width: 6px;
    height: 6px;
    border-radius: var(--radius-full);
    background: var(--color-start, #5BCA7A);
    animation: pulse 2s ease-in-out infinite;
    flex-shrink: 0;
  }

  .history-list {
    flex: 1;
    overflow-y: auto;
    display: flex;
    flex-direction: column;
    gap: var(--space-1);
  }

  .history-empty {
    font-size: var(--font-brand-md);
    color: var(--color-text-muted, #6B7788);
    text-align: center;
    padding: var(--space-4) 0;
    margin: 0;
  }

  .history-group {
    display: flex;
    flex-direction: column;
    gap: var(--space-0-5);
  }

  .history-group-label {
    font-size: var(--font-micro);
    text-transform: uppercase;
    letter-spacing: 1px;
    color: var(--color-text-muted, #6B7788);
    font-weight: 600;
    padding: var(--space-1-5) var(--space-1) var(--space-0-5);
  }

  .history-item {
    position: relative;
    display: flex;
    flex-direction: column;
    gap: 2px;
    padding: var(--space-1-5) var(--space-2);
    border-radius: var(--radius-md);
    border: 1px solid transparent;
    background: none;
    color: var(--color-text-primary, #d0d6e0);
    cursor: pointer;
    text-align: left;
    transition: background var(--transition-base), border-color var(--transition-base);
    width: 100%;
  }

  .history-item:hover {
    background: var(--white-a4);
    border-color: var(--white-a6);
  }

  .history-item-active {
    background: var(--white-a6);
    border-color: var(--white-a10);
  }

  .history-item-current {
    border-color: rgba(91, 202, 122, 0.2);
  }

  .history-item-top {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--space-1);
  }

  .history-item-time {
    font-size: var(--font-xs);
    color: var(--color-text-primary, #d0d6e0);
    font-weight: 500;
  }

  .history-item-count {
    font-size: var(--font-micro);
    color: var(--color-text-muted, #6B7788);
  }

  .history-item-party {
    font-size: var(--font-xs);
    color: var(--color-text-muted, #6B7788);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .history-item-delete {
    position: absolute;
    top: 4px;
    right: 4px;
    width: 16px;
    height: 16px;
    border-radius: var(--radius-sm);
    border: none;
    background: none;
    color: var(--color-text-muted, #6B7788);
    font-size: var(--font-base);
    cursor: pointer;
    display: none;
    align-items: center;
    justify-content: center;
    padding: 0;
    line-height: 1;
    transition: color var(--transition-base), background var(--transition-base);
  }

  .history-item:hover .history-item-delete {
    display: flex;
  }

  .history-item-delete:hover {
    color: var(--color-stop, #FF6B6B);
    background: rgba(255, 107, 107, 0.15);
  }

  /* ── Main area (left/center) ── */
  .main-area {
    flex: 1;
    display: flex;
    flex-direction: column;
    min-width: 0;
    overflow: hidden;
  }

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

  .back-btn {
    padding: 3px var(--space-2-5);
    border-radius: var(--radius-md);
    border: 1px solid rgba(91, 202, 122, 0.25);
    background: rgba(91, 202, 122, 0.08);
    color: var(--color-start, #5BCA7A);
    font-size: var(--font-xs);
    cursor: pointer;
    transition: background var(--transition-base);
  }

  .back-btn:hover {
    background: rgba(91, 202, 122, 0.15);
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
    font-size: var(--font-xs);
    color: var(--color-text-muted, #6b7688);
  }

  .msg-text {
    margin: 3px 0 0;
    font-size: var(--font-md);
    color: var(--color-text-primary, #d0d6e0);
    line-height: 1.45;
    user-select: text;
    -webkit-user-select: text;
  }

  /* ── Inline share indicator ── */
  .share-inline {
    display: flex;
    align-items: center;
    gap: var(--space-1-5);
    padding: 5px var(--space-2-5);
    border-radius: var(--radius-md);
    background: var(--teal-a8);
    border: 1px solid var(--teal-a20);
    max-width: 180px;
  }

  .share-pulse {
    width: 7px;
    height: 7px;
    border-radius: var(--radius-full);
    background: var(--color-teal);
    box-shadow: 0 0 5px rgba(59, 151, 151, 0.6);
    animation: pulse 2s ease-in-out infinite;
    flex-shrink: 0;
  }

  @keyframes pulse {
    0%, 100% { opacity: 1; }
    50% { opacity: 0.4; }
  }

  .share-name {
    flex: 1;
    font-size: var(--font-xs);
    color: var(--color-light-teal);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .share-x {
    width: 18px;
    height: 18px;
    border-radius: var(--radius-sm);
    border: none;
    background: rgba(255, 80, 80, 0.15);
    color: var(--color-stop);
    font-size: var(--font-base);
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 0;
    line-height: 1;
    flex-shrink: 0;
    transition: background var(--transition-base);
  }

  .share-x:hover {
    background: rgba(255, 80, 80, 0.3);
  }

  /* ── Controls bar ── */
  .controls-bar {
    flex-shrink: 0;
    padding: var(--space-2-5) var(--space-5) var(--space-3-5);
    border-top: 1px solid var(--white-a6);
    display: flex;
    align-items: flex-end;
    gap: var(--space-4);
    background: var(--black-a15);
  }

  .ctrl-group {
    display: flex;
    flex-direction: column;
    gap: 5px;
  }

  .ctrl-label {
    font-size: var(--font-micro);
    text-transform: uppercase;
    letter-spacing: 1.2px;
    color: var(--color-text-muted, #6B7788);
    font-weight: 600;
  }

  .ctrl-group-buttons {
    display: flex;
    gap: var(--space-1);
  }

  .ctrl-divider {
    width: 1px;
    height: 36px;
    background: var(--white-a8);
    flex-shrink: 0;
    align-self: flex-end;
  }

  .ctrl-btn {
    display: flex;
    align-items: center;
    gap: var(--space-1-5);
    padding: var(--space-1-5) var(--space-3);
    border-radius: var(--radius-md);
    border: 1px solid var(--white-a8);
    background: var(--white-a4);
    color: var(--color-text-secondary, #8a94a6);
    font-size: var(--font-xs);
    cursor: pointer;
    transition: background var(--transition-base), color var(--transition-base), border-color var(--transition-base);
    white-space: nowrap;
  }

  .ctrl-btn:hover:not(:disabled) {
    background: var(--white-a8);
    color: var(--color-text-primary, #e2e8f0);
  }

  .ctrl-btn:disabled {
    opacity: 0.35;
    cursor: not-allowed;
  }

  .ctrl-btn.capture {
    color: var(--rarity-rare, #3B9797);
    border-color: var(--teal-a20);
  }

  .ctrl-btn.capture:hover:not(:disabled) {
    background: var(--teal-a10);
    border-color: rgba(59, 151, 151, 0.35);
  }

  .ctrl-btn.start {
    color: var(--color-start);
    border-color: rgba(91, 202, 122, 0.2);
  }

  .ctrl-btn.start:hover:not(:disabled) {
    background: rgba(91, 202, 122, 0.1);
    border-color: rgba(91, 202, 122, 0.35);
  }

  .ctrl-btn.stop {
    color: var(--color-stop);
    border-color: rgba(255, 107, 107, 0.2);
  }

  .ctrl-btn.stop:hover:not(:disabled) {
    background: rgba(255, 107, 107, 0.1);
    border-color: rgba(255, 107, 107, 0.35);
  }

  /* ── Toggle switch ── */
  .toggle {
    position: relative;
    width: 40px;
    height: 22px;
    border-radius: 11px;
    border: 1px solid var(--white-a10);
    background: var(--white-a6);
    cursor: pointer;
    padding: 0;
    transition: background var(--transition-slow), border-color var(--transition-slow);
  }

  .toggle-knob {
    position: absolute;
    top: 2px;
    left: 2px;
    width: 16px;
    height: 16px;
    border-radius: var(--radius-full);
    background: var(--color-text-muted, #6B7788);
    transition: transform var(--transition-slow), background var(--transition-slow);
  }

  .toggle.toggle-on {
    background: rgba(176, 106, 255, 0.2);
    border-color: rgba(176, 106, 255, 0.4);
  }

  .toggle.toggle-on .toggle-knob {
    transform: translateX(18px);
    background: var(--rarity-epic, #B06AFF);
  }

  /* ── Right panel ── */
  .right-panel {
    width: 280px;
    flex-shrink: 0;
    display: flex;
    flex-direction: column;
    border-left: 1px solid var(--white-a6);
    background: var(--black-a10);
    overflow: hidden;
  }

  .panel-section {
    padding: var(--space-3-5) var(--space-3);
  }

  .panel-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: var(--space-2-5);
  }

  .panel-header h2 {
    font-size: var(--font-xs);
    text-transform: uppercase;
    letter-spacing: 1.5px;
    color: var(--color-text-muted, #6B7788);
    margin: 0;
    font-weight: 600;
  }

  .party-actions {
    display: flex;
    gap: var(--space-1);
  }

  .small-btn {
    padding: 3px var(--space-2);
    border-radius: var(--radius-sm);
    border: 1px solid var(--white-a8);
    background: var(--white-a4);
    color: var(--color-text-muted, #6B7788);
    font-size: var(--font-brand-sm);
    cursor: pointer;
    transition: background var(--transition-base);
  }

  .small-btn:hover {
    background: var(--white-a8);
    color: var(--color-text-secondary, #8a94a6);
  }

  .party-slots {
    display: flex;
    flex-direction: column;
    gap: var(--space-1-5);
  }

  .drop-zone {
    border-radius: var(--radius-xl);
    border: 1.5px solid transparent;
    transition: border-color var(--transition-base), background var(--transition-base);
  }

  .drop-zone.drop-active {
    border-color: var(--teal-a50);
    background: var(--teal-a5);
  }

  .empty-slot {
    display: flex;
    align-items: center;
    gap: var(--space-2-5);
    padding: var(--space-2-5);
    border-radius: var(--radius-lg);
    border: 1px dashed var(--white-a10);
    background: transparent;
    transition: background var(--transition-base), border-color var(--transition-base);
    min-height: 56px;
    color: var(--color-text-muted, #6B7788);
  }

  .drop-zone.drop-active .empty-slot {
    border-color: var(--teal-a40);
    background: var(--teal-a5);
  }

  .plus {
    width: 28px;
    height: 28px;
    border-radius: var(--radius-full);
    border: 1px dashed var(--white-a15);
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: var(--font-lg);
    flex-shrink: 0;
  }

  .empty-label {
    font-size: var(--font-brand-md);
  }

  .panel-divider {
    height: 1px;
    background: var(--white-a6);
    margin: 0 var(--space-3);
  }

  .collection-section {
    flex: 1;
    display: flex;
    flex-direction: column;
    overflow: hidden;
  }

  .search-input {
    width: 100%;
    padding: var(--space-1-5) var(--space-2-5);
    border-radius: var(--radius-md);
    border: 1px solid var(--white-a8);
    background: var(--white-a4);
    color: var(--color-text-primary, #e2e8f0);
    font-size: var(--font-brand-md);
    outline: none;
    margin-bottom: var(--space-2);
    box-sizing: border-box;
    transition: border-color var(--transition-base);
  }

  .search-input::placeholder {
    color: var(--color-text-muted, #6B7788);
  }

  .search-input:focus {
    border-color: var(--white-a20);
  }

  .collection-list {
    flex: 1;
    overflow-y: auto;
    display: flex;
    flex-direction: column;
    gap: var(--space-1);
    border-radius: var(--radius-lg);
    border: 1.5px solid transparent;
    transition: border-color var(--transition-base), background var(--transition-base);
    padding: var(--space-0-5);
  }

  .collection-list.drop-active {
    border-color: var(--teal-a40);
    background: rgba(59, 151, 151, 0.03);
  }

  .collection-list :global(.card-row) {
    opacity: 0.5;
    filter: brightness(0.8);
    transition: opacity var(--transition-slow), filter var(--transition-slow), transform var(--transition-slow), box-shadow var(--transition-slow);
  }

  .collection-list :global(.card-row:hover) {
    opacity: 1;
    filter: brightness(1);
  }

  .empty-msg {
    font-size: var(--font-brand-md);
    color: var(--color-text-muted, #6B7788);
    text-align: center;
    padding: var(--space-4) 0;
    margin: 0;
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

  /* ── Text input bar ── */
  .input-bar {
    flex-shrink: 0;
    padding: var(--space-2) var(--space-5);
    position: relative;
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
    border-color: rgba(59, 151, 151, 0.4);
  }

  .send-btn:disabled {
    opacity: 0.3;
    cursor: not-allowed;
  }
</style>
