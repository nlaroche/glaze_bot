<script lang="ts">
  import { getCurrentWindow } from '@tauri-apps/api/window';

  const appWindow = getCurrentWindow();

  function minimize() {
    appWindow.minimize();
  }

  async function toggleMaximize() {
    appWindow.toggleMaximize();
  }

  function close() {
    appWindow.close();
  }
</script>

<header data-tauri-drag-region>
  <span class="title" data-tauri-drag-region>GLAZEBOT</span>
  <div class="controls">
    <button onclick={minimize} aria-label="Minimize">
      <svg width="12" height="12" viewBox="0 0 12 12">
        <rect x="1" y="5.5" width="10" height="1" fill="currentColor" />
      </svg>
    </button>
    <button onclick={toggleMaximize} aria-label="Maximize">
      <svg width="12" height="12" viewBox="0 0 12 12">
        <rect x="1.5" y="1.5" width="9" height="9" fill="none" stroke="currentColor" stroke-width="1" />
      </svg>
    </button>
    <button class="close-btn" onclick={close} aria-label="Close">
      <svg width="12" height="12" viewBox="0 0 12 12">
        <line x1="2" y1="2" x2="10" y2="10" stroke="currentColor" stroke-width="1.2" />
        <line x1="10" y1="2" x2="2" y2="10" stroke="currentColor" stroke-width="1.2" />
      </svg>
    </button>
  </div>
</header>

<style>
  header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    height: var(--titlebar-height);
    padding: 0 12px;
    background: var(--color-chrome);
    -webkit-app-region: drag;
  }

  .title {
    font-size: 13px;
    font-weight: 700;
    color: var(--color-pink);
    letter-spacing: 2px;
  }

  .controls {
    display: flex;
    gap: 2px;
    -webkit-app-region: no-drag;
  }

  button {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 36px;
    height: var(--titlebar-height);
    border: none;
    background: transparent;
    color: var(--color-text-secondary);
    cursor: pointer;
    transition: background 0.15s, color 0.15s;
  }

  button:hover {
    background: rgba(255, 255, 255, 0.08);
    color: var(--color-text-primary);
  }

  .close-btn:hover {
    background: #e81123;
    color: white;
  }
</style>
