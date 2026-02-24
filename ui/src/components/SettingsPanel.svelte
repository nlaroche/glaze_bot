<script lang="ts">
  import {
    micMode, captureInterval, minGap,
    interactionMode, interactionChance,
    aiProvider, visionModel, captureScale, captureQuality, gameHint,
    doUpdateSettings, doQuit,
  } from "../lib/stores";

  function set(key: string, value: any) {
    doUpdateSettings({ [key]: value });
  }

  let modelInput = $visionModel;
  let hintInput = $gameHint;

  $: modelInput = $visionModel;
  $: hintInput = $gameHint;

  let modelTimer: any;
  function onModelInput(val: string) {
    modelInput = val;
    clearTimeout(modelTimer);
    modelTimer = setTimeout(() => set("vision_model", val), 600);
  }

  let hintTimer: any;
  function onHintInput(val: string) {
    hintInput = val;
    clearTimeout(hintTimer);
    hintTimer = setTimeout(() => set("game_hint", val), 600);
  }
</script>

<div class="page">
  <div class="page-head">
    <h2 class="page-title">Settings</h2>
  </div>

  <div class="form">
    <!-- AI Provider section -->
    <div class="section-header">AI</div>

    <div class="group">
      <label class="lbl">AI Provider</label>
      <div class="chips">
        {#each [["dashscope", "Dashscope"], ["anthropic", "Anthropic"]] as [val, label]}
          <button class="chip" class:active={$aiProvider === val}
            onclick={() => set("ai_provider", val)}>
            {label}
          </button>
        {/each}
      </div>
      <span class="hint">Dashscope uses Qwen VL models. Anthropic uses Claude models.</span>
    </div>

    <div class="group">
      <label class="lbl">Vision Model</label>
      <input class="text-input" type="text" value={modelInput}
        oninput={(e) => onModelInput((e.target as HTMLInputElement).value)} />
      <span class="hint">Model ID sent to the provider (e.g. qwen3-vl-flash, claude-haiku-4-5-20251001).</span>
    </div>

    <div class="group">
      <label class="lbl">Game Hint</label>
      <input class="text-input" type="text" value={hintInput}
        placeholder="e.g. Elden Ring, Valorant, Minecraft..."
        oninput={(e) => onHintInput((e.target as HTMLInputElement).value)} />
      <span class="hint">Tells the AI what game you're playing for better commentary.</span>
    </div>

    <!-- Capture section -->
    <div class="section-header">Capture</div>

    <div class="group">
      <label class="lbl">Capture Scale</label>
      <div class="slider-row">
        <input type="range" min="0.3" max="0.8" step="0.05" value={$captureScale}
          oninput={(e) => set("capture_scale", parseFloat((e.target as HTMLInputElement).value))} />
        <span class="val">{Math.round($captureScale * 100)}%</span>
      </div>
      <span class="hint">Resolution scale of screenshots. Higher = better quality, more tokens.</span>
    </div>

    <div class="group">
      <label class="lbl">Capture Quality</label>
      <div class="slider-row">
        <input type="range" min="30" max="95" step="5" value={$captureQuality}
          oninput={(e) => set("capture_quality", parseInt((e.target as HTMLInputElement).value))} />
        <span class="val">{$captureQuality}</span>
      </div>
      <span class="hint">JPEG compression quality. Higher = sharper images, larger payloads.</span>
    </div>

    <div class="group">
      <label class="lbl">Screen Capture Interval</label>
      <div class="slider-row">
        <input type="range" min="0.5" max="10" step="0.5" value={$captureInterval}
          oninput={(e) => set("interval", parseFloat((e.target as HTMLInputElement).value))} />
        <span class="val">{$captureInterval}s</span>
      </div>
      <span class="hint">How often the screen is captured for context.</span>
    </div>

    <!-- Behavior section -->
    <div class="section-header">Behavior</div>

    <div class="group">
      <label class="lbl">Talk Frequency</label>
      <div class="slider-row">
        <input type="range" min="10" max="120" step="5" value={$minGap}
          oninput={(e) => set("min_gap", parseFloat((e.target as HTMLInputElement).value))} />
        <span class="val">{$minGap}s</span>
      </div>
      <span class="hint">Minimum seconds between comments. Higher = less frequent.</span>
    </div>

    <div class="group">
      <label class="lbl">Microphone Mode</label>
      <div class="chips">
        {#each ["always_on", "push_to_talk", "off"] as mode}
          <button class="chip" class:active={$micMode === mode}
            onclick={() => set("mic_mode", mode)}>
            {mode.replace(/_/g, " ")}
          </button>
        {/each}
      </div>
    </div>

    <div class="group">
      <label class="lbl">Character Banter</label>
      <div class="toggle-row">
        <button class="chip" class:active={$interactionMode}
          onclick={() => set("interaction_mode", !$interactionMode)}>
          {$interactionMode ? "On" : "Off"}
        </button>
        {#if $interactionMode}
          <span class="sub-lbl">Chance:</span>
          <div class="chips">
            {#each [0.1, 0.25, 0.5, 0.75] as ch}
              <button class="chip small" class:active={$interactionChance === ch}
                onclick={() => set("interaction_chance", ch)}>
                {Math.round(ch * 100)}%
              </button>
            {/each}
          </div>
        {/if}
      </div>
      <span class="hint">Characters talk to each other between your comments.</span>
    </div>
  </div>

  <div class="footer">
    <button class="quit-btn" onclick={doQuit}>Quit Glaze Bot</button>
  </div>
</div>

<style>
  .page {
    display: flex;
    flex-direction: column;
    height: 100%;
    overflow: hidden;
  }

  .page-head {
    padding: 20px 24px 12px;
    flex-shrink: 0;
  }

  .page-title {
    font-size: 18px;
    font-weight: 700;
    color: var(--ctp-text);
  }

  .form {
    flex: 1;
    overflow-y: auto;
    padding: 8px 24px;
    display: flex;
    flex-direction: column;
    gap: 28px;
    scrollbar-width: thin;
    scrollbar-color: var(--ctp-surface0) transparent;
  }

  .section-header {
    font-size: 11px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    color: var(--ctp-mauve);
    margin-bottom: -16px;
  }

  .group {}

  .lbl {
    display: block;
    font-size: 14px;
    color: var(--ctp-subtext0);
    font-weight: 600;
    margin-bottom: 10px;
  }

  .hint {
    font-size: 12px;
    color: var(--ctp-surface2);
    margin-top: 6px;
    display: block;
  }

  .slider-row {
    display: flex;
    align-items: center;
    gap: 14px;
  }

  .slider-row input[type="range"] {
    flex: 1;
    accent-color: var(--ctp-mauve);
    height: 6px;
  }

  .val {
    font-size: 16px;
    font-weight: 700;
    color: var(--ctp-mauve);
    min-width: 44px;
    text-align: right;
    font-family: "Consolas", monospace;
  }

  .chips {
    display: flex;
    gap: 8px;
    flex-wrap: wrap;
  }

  .chip {
    font-size: 13px;
    padding: 7px 16px;
    border-radius: 6px;
    border: 1px solid var(--ctp-surface0);
    background: var(--ctp-mantle);
    color: var(--ctp-surface2);
    cursor: pointer;
    font-family: inherit;
    font-weight: 600;
    transition: all 0.1s;
  }
  .chip.active {
    background: rgba(203, 166, 247, 0.1);
    color: var(--ctp-mauve);
    border-color: var(--ctp-mauve);
  }
  .chip.small { padding: 5px 12px; font-size: 12px; }

  .text-input {
    width: 100%;
    padding: 8px 12px;
    border-radius: 6px;
    border: 1px solid var(--ctp-surface0);
    background: var(--ctp-mantle);
    color: var(--ctp-text);
    font-size: 13px;
    font-family: "Consolas", monospace;
    outline: none;
    box-sizing: border-box;
  }
  .text-input:focus {
    border-color: var(--ctp-mauve);
  }
  .text-input::placeholder {
    color: var(--ctp-surface2);
  }

  .toggle-row {
    display: flex;
    align-items: center;
    gap: 12px;
    flex-wrap: wrap;
  }

  .sub-lbl {
    font-size: 12px;
    color: var(--ctp-surface2);
  }

  .footer {
    padding: 16px 24px;
    border-top: 1px solid var(--ctp-surface0);
    flex-shrink: 0;
  }

  .quit-btn {
    padding: 8px 18px;
    border-radius: 6px;
    border: 1px solid var(--ctp-red);
    background: transparent;
    color: var(--ctp-red);
    font-size: 13px;
    font-weight: 600;
    cursor: pointer;
    font-family: inherit;
  }
  .quit-btn:hover { background: rgba(243, 139, 168, 0.1); }
</style>
