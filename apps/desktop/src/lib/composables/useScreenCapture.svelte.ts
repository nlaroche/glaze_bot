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

  function closePicker() {
    pickerOpen = false;
  }

  async function stopSharing() {
    if (session.isRunning) {
      onStop();
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
