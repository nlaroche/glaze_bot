import type { GachaCharacter } from '@glazebot/shared-types';
import { getCharacter } from '@glazebot/supabase-client';
import {
  setRunning,
  setPaused,
  setOverlayOn,
  getActiveParty,
  setPartySlot,
  setRecording,
  showSttBubble,
  sendUserMessage,
  addChatEntry,
} from '$lib/stores/session.svelte';
import { logDebug } from '$lib/stores/debug.svelte';

interface UseCommentaryControlsOptions {
  session: {
    engine: { start: (id: string, party: GachaCharacter[]) => Promise<void>; stop: () => void; pause: () => void; resume: () => void; updateParty: (party: GachaCharacter[]) => void };
    partySlots: (GachaCharacter | null)[];
    activeShare: { id: string; name: string } | null;
    isRunning: boolean;
    isPaused: boolean;
    overlayOn: boolean;
  };
  debug: {
    speechMode: 'off' | 'push-to-talk' | 'always-on';
    pttKey: string;
    vadThreshold: number;
    vadSilenceMs: number;
  };
}

export function useCommentaryControls({ session, debug }: UseCommentaryControlsOptions) {
  let pttActive = $state(false);

  let canStart = $derived(!!session.activeShare && session.partySlots.some((s) => s !== null) && !session.isRunning);

  // Keep engine party in sync
  $effect(() => {
    const party = session.partySlots.filter((s): s is GachaCharacter => s !== null);
    session.engine.updateParty(party);
  });

  // ── Push-to-Talk (global — works even when game has focus) ──
  $effect(() => {
    if (debug.speechMode !== 'push-to-talk') return;

    let unlistenPress: (() => void) | undefined;
    let unlistenRelease: (() => void) | undefined;

    (async () => {
      const { invoke } = await import('@tauri-apps/api/core');
      const { listen } = await import('@tauri-apps/api/event');

      await invoke('start_ptt_listener', { keyCode: debug.pttKey });

      unlistenPress = await listen('ptt-pressed', () => {
        if (pttActive || !session.isRunning) return;
        pttActive = true;
        setRecording(true);
        logDebug('stt-request', { mode: 'ptt', key: debug.pttKey });
        invoke('start_recording').catch((err: unknown) => {
          console.error('Failed to start recording:', err);
          pttActive = false;
          setRecording(false);
        });
      });

      unlistenRelease = await listen('ptt-released', () => {
        if (!pttActive) return;
        pttActive = false;
        setRecording(false);
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
    })();

    return () => {
      unlistenPress?.();
      unlistenRelease?.();
      import('@tauri-apps/api/core').then(({ invoke }) => {
        invoke('stop_ptt_listener').catch(() => {});
      });
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

  // ── Fullscreen warning listener ──
  $effect(() => {
    if (!session.isRunning) return;

    let unlisten: (() => void) | undefined;
    import('@tauri-apps/api/event').then(({ listen }) => {
      listen('overlay-fullscreen-warning', () => {
        addChatEntry({
          id: `${Date.now()}-system`,
          characterId: 'system',
          name: 'System',
          rarity: 'common',
          text: "Your game appears to be in exclusive fullscreen. The overlay may not be visible — try switching to Borderless Windowed in your game's video settings.",
          time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          timestamp: new Date().toISOString(),
        });
      }).then((fn) => { unlisten = fn; });
    });

    return () => { unlisten?.(); };
  });

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

  async function waitForOverlayReady() {
    const { emitTo } = await import('@tauri-apps/api/event');
    const { invoke } = await import('@tauri-apps/api/core');
    const { getCurrentWebview } = await import('@tauri-apps/api/webview');

    await invoke('show_overlay');
    await emitTo('overlay', 'overlay-reset', {});

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
  }

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

  async function handleStart() {
    if (!session.activeShare) return;
    const party = getActiveParty();
    if (party.length === 0) return;

    // Re-fetch characters from DB to pick up any changes (e.g. voice reassignment)
    const freshParty = await Promise.all(
      party.map(async (c) => {
        try {
          const fresh = await getCharacter(c.id);
          const idx = session.partySlots.findIndex((s) => s?.id === c.id);
          if (idx !== -1) setPartySlot(idx, fresh);
          return fresh;
        } catch {
          return c;
        }
      })
    );

    setRunning(true);
    setPaused(false);
    await session.engine.start(session.activeShare.id, freshParty);

    await initSpeech();

    if (session.overlayOn) {
      try {
        await waitForOverlayReady();
        await emitPartyToOverlay();
      } catch (e) {
        console.error('Failed to auto-show overlay:', e);
      }
    }

    // Start z-order guard to keep overlay above fullscreen games
    import('@tauri-apps/api/core').then(({ invoke }) => {
      invoke('start_overlay_guard').catch(() => {});
    });
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
    import('@tauri-apps/api/core').then(({ invoke }) => {
      invoke('stop_overlay_guard').catch(() => {});
    });
  }

  async function toggleOverlay() {
    setOverlayOn(!session.overlayOn);

    if (!session.activeShare) return;

    try {
      const { invoke } = await import('@tauri-apps/api/core');
      if (session.overlayOn) {
        await waitForOverlayReady();
        await emitPartyToOverlay();
      } else {
        await invoke('hide_overlay');
      }
    } catch (e) {
      console.error('Overlay toggle failed:', e);
    }
  }

  return {
    get canStart() { return canStart; },
    get pttActive() { return pttActive; },
    handleStart,
    handleStop,
    handlePauseResume,
    toggleOverlay,
    emitPartyToOverlay,
  };
}
