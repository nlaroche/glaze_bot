import type { CaptureSource } from '@glazebot/shared-ui';
import { setActiveShare } from '$lib/stores/session.svelte';

interface UseScreenCaptureOptions {
  session: { activeShare: CaptureSource | null; isRunning: boolean };
  onStop: () => void;
}

export function useScreenCapture({ session, onStop }: UseScreenCaptureOptions) {
  let pickerOpen = $state(false);
  let pickerInitialTab = $state<'screen' | 'app'>('screen');
  let captureSources = $state<CaptureSource[]>([]);
  let loadingSources = $state(false);
  let thumbnailAbort: AbortController | null = null;

  async function openPicker(tab: 'screen' | 'app') {
    pickerInitialTab = tab;
    pickerOpen = true;

    // Cancel any in-flight thumbnail fetches from a previous open
    thumbnailAbort?.abort();
    thumbnailAbort = new AbortController();
    const signal = thumbnailAbort.signal;

    try {
      const { invoke } = await import('@tauri-apps/api/core');

      // Phase 1: instant — names only, no screenshots
      loadingSources = true;
      const sources: any[] = await invoke('list_sources_fast');
      captureSources = sources.map((s) => ({
        id: s.id,
        name: s.name,
        type: s.source_type === 'monitor' ? 'screen' as const : 'window' as const,
        thumbnail: undefined,
      }));
      loadingSources = false;

      // Phase 2: lazy — fetch thumbnails one at a time in the background
      // Prioritize the currently active tab so visible cards load first
      const activeType = tab === 'screen' ? 'screen' : 'window';
      const sorted = [
        ...captureSources.filter(s => s.type === activeType),
        ...captureSources.filter(s => s.type !== activeType),
      ];

      for (const source of sorted) {
        if (signal.aborted) break;
        try {
          const thumb: string | null = await invoke('get_source_thumbnail', { sourceId: source.id });
          if (signal.aborted) break;
          if (thumb) {
            captureSources = captureSources.map(s =>
              s.id === source.id ? { ...s, thumbnail: thumb } : s
            );
          }
        } catch {
          // Skip failed thumbnails silently
        }
      }
    } catch (e) {
      console.error('Failed to list sources:', e);
      captureSources = [];
      loadingSources = false;
    }
  }

  function handleSourceSelect(source: CaptureSource) {
    setActiveShare(source);
    pickerOpen = false;
  }

  function closePicker() {
    pickerOpen = false;
    thumbnailAbort?.abort();
  }

  async function stopSharing() {
    if (session.isRunning) {
      onStop();
    }
    try {
      const { invoke } = await import('@tauri-apps/api/core');
      await invoke('hide_overlay');
    } catch (e) {
      console.error('Failed to hide overlay:', e);
    }
    setActiveShare(null);
  }

  return {
    get pickerOpen() { return pickerOpen; },
    set pickerOpen(v: boolean) { pickerOpen = v; },
    get pickerInitialTab() { return pickerInitialTab; },
    get captureSources() { return captureSources; },
    get loadingSources() { return loadingSources; },
    openPicker,
    closePicker,
    handleSourceSelect,
    stopSharing,
  };
}
