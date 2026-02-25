<script lang="ts">
  import { getGoogleOAuthUrl, exchangeCodeForSession, signInWithEmailOtp, verifyEmailOtp } from '@glazebot/supabase-client';
  import { invoke } from '@tauri-apps/api/core';
  import { open } from '@tauri-apps/plugin-shell';

  let email = $state('');
  let otpCode = $state('');
  let otpSent = $state(false);
  let error = $state('');
  let loading = $state(false);

  // Collage cards — hand-picked for visual variety
  const collageCards = [
    { src: '/avatars/hype.webp',       x: -4,  y: 6,   size: 140, rot: -8,   opacity: 0.45, blur: 1,   glow: 'epic' },
    { src: '/avatars/sage.webp',       x: 78,  y: 3,   size: 130, rot: 6,    opacity: 0.4,  blur: 1.5, glow: 'rare' },
    { src: '/avatars/jinx.webp',       x: -2,  y: 52,  size: 120, rot: -12,  opacity: 0.35, blur: 2,   glow: 'legendary' },
    { src: '/avatars/dj_blaze.webp',   x: 80,  y: 48,  size: 125, rot: 10,   opacity: 0.4,  blur: 1,   glow: 'epic' },
    { src: '/avatars/vex.webp',        x: 82,  y: 78,  size: 110, rot: 8,    opacity: 0.35, blur: 2,   glow: 'rare' },
    { src: '/avatars/captain_obvious.webp', x: 2, y: 80, size: 105, rot: -5, opacity: 0.3,  blur: 2.5, glow: 'common' },
    { src: '/avatars/sir_reginald.webp', x: 22, y: -3,  size: 95,  rot: 4,   opacity: 0.25, blur: 3,   glow: 'rare' },
    { src: '/avatars/conspiracy_carl.webp', x: 58, y: 82, size: 100, rot: -7, opacity: 0.28, blur: 2.5, glow: 'common' },
  ];

  const glowColors: Record<string, string> = {
    common:    'rgba(160, 174, 192, 0.3)',
    rare:      'rgba(59, 151, 151, 0.5)',
    epic:      'rgba(176, 106, 255, 0.5)',
    legendary: 'rgba(255, 215, 0, 0.5)',
  };

  async function handleGoogle() {
    error = '';
    loading = true;
    try {
      const port: number = await invoke('start_oauth_server');
      const { data, error: oauthErr } = await getGoogleOAuthUrl(`http://localhost:${port}`);
      if (oauthErr || !data?.url) {
        error = oauthErr?.message ?? 'Failed to get OAuth URL';
        loading = false;
        return;
      }
      await open(data.url);
      const callbackUrl: string = await invoke('wait_for_oauth_callback');
      const code = new URL(callbackUrl).searchParams.get('code');
      if (!code) {
        error = 'No authorization code received';
        loading = false;
        return;
      }
      const { error: exchangeErr } = await exchangeCodeForSession(code);
      if (exchangeErr) error = exchangeErr.message;
    } catch (e) {
      console.error('OAuth error:', e);
      error = e instanceof Error ? e.message : String(e);
    }
    loading = false;
  }

  async function handleSendOtp() {
    if (!email.trim()) return;
    error = '';
    loading = true;
    const { error: err } = await signInWithEmailOtp(email.trim());
    if (err) {
      error = err.message;
    } else {
      otpSent = true;
    }
    loading = false;
  }

  async function handleVerifyOtp() {
    if (otpCode.length !== 6) return;
    error = '';
    loading = true;
    const { error: err } = await verifyEmailOtp(email.trim(), otpCode);
    if (err) error = err.message;
    loading = false;
  }
</script>

<div class="auth-screen">
  <!-- Floating character collage -->
  <div class="collage">
    {#each collageCards as card, i}
      <div
        class="collage-card"
        style="
          left: {card.x}%;
          top: {card.y}%;
          width: {card.size}px;
          height: {card.size}px;
          transform: rotate({card.rot}deg);
          opacity: {card.opacity};
          filter: blur({card.blur}px);
          box-shadow: 0 0 20px {glowColors[card.glow]}, 0 0 40px {glowColors[card.glow]};
          animation-delay: {i * 0.8}s;
        "
      >
        <img src={card.src} alt="" draggable="false" />
      </div>
    {/each}

    <!-- Decorative booster pack silhouette -->
    <div class="pack-deco">
      <div class="pack-body">
        <span class="pack-label-top">GLAZE</span>
        <span class="pack-label-bot">BOOST</span>
        <div class="pack-foil"></div>
      </div>
    </div>
  </div>

  <!-- Login card -->
  <div class="auth-card">
    <div class="brand">
      <h1 class="title">GlazeBot</h1>
      <p class="tagline">// AI-Powered Commentary Engine</p>
    </div>

    <button class="google-btn" onclick={handleGoogle} disabled={loading}>
      <svg class="google-icon" viewBox="0 0 24 24" width="18" height="18">
        <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/>
        <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
        <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18A10.96 10.96 0 0 0 1 12c0 1.77.42 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05"/>
        <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
      </svg>
      Continue with Google
    </button>

    <div class="divider">
      <span>or</span>
    </div>

    {#if !otpSent}
      <div class="email-form">
        <input
          type="email"
          placeholder="Email address"
          bind:value={email}
          disabled={loading}
          onkeydown={(e) => e.key === 'Enter' && handleSendOtp()}
        />
        <button class="send-btn" onclick={handleSendOtp} disabled={loading || !email.trim()}>
          Send Code
        </button>
      </div>
    {:else}
      <div class="otp-form">
        <p class="otp-hint">Enter the 6-digit code sent to <strong>{email}</strong></p>
        <input
          type="text"
          placeholder="000000"
          maxlength="6"
          bind:value={otpCode}
          disabled={loading}
          onkeydown={(e) => e.key === 'Enter' && handleVerifyOtp()}
          class="otp-input"
        />
        <button class="verify-btn" onclick={handleVerifyOtp} disabled={loading || otpCode.length !== 6}>
          Verify
        </button>
        <button class="back-btn" onclick={() => { otpSent = false; otpCode = ''; error = ''; }}>
          Use a different email
        </button>
      </div>
    {/if}

    {#if error}
      <p class="error">{error}</p>
    {/if}
  </div>
</div>

<style>
  .auth-screen {
    display: flex;
    align-items: center;
    justify-content: center;
    flex: 1;
    width: 100%;
    overflow: hidden;
    position: relative;
  }

  /* ---- Floating collage ---- */
  .collage {
    position: absolute;
    inset: 0;
    pointer-events: none;
    overflow: hidden;
  }

  .collage-card {
    position: absolute;
    border-radius: 12px;
    overflow: hidden;
    animation: collage-float 8s ease-in-out infinite alternate;
  }

  .collage-card img {
    width: 100%;
    height: 100%;
    object-fit: cover;
    display: block;
    border-radius: 12px;
  }

  @keyframes collage-float {
    0% { translate: 0 0; }
    100% { translate: 0 -8px; }
  }

  /* ---- Decorative booster pack ---- */
  .pack-deco {
    position: absolute;
    left: 38%;
    top: 72%;
    transform: rotate(15deg);
    opacity: 0.15;
    filter: blur(1px);
    animation: collage-float 10s 2s ease-in-out infinite alternate;
  }

  .pack-body {
    width: 80px;
    height: 120px;
    border-radius: 8px;
    background: linear-gradient(160deg, rgba(176, 106, 255, 0.4) 0%, rgba(10, 14, 24, 0.6) 50%, rgba(59, 151, 151, 0.3) 100%);
    border: 1px solid rgba(255, 255, 255, 0.1);
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 2px;
    position: relative;
    overflow: hidden;
  }

  .pack-label-top {
    font-family: 'Michroma', sans-serif;
    font-size: 10px;
    color: rgba(253, 181, 206, 0.7);
    letter-spacing: 3px;
    z-index: 1;
  }

  .pack-label-bot {
    font-family: 'Michroma', sans-serif;
    font-size: 8px;
    color: rgba(59, 151, 151, 0.6);
    letter-spacing: 2px;
    z-index: 1;
  }

  .pack-foil {
    position: absolute;
    inset: 0;
    background: conic-gradient(
      from 0deg,
      transparent 0deg,
      rgba(255, 255, 255, 0.05) 60deg,
      transparent 120deg,
      rgba(255, 255, 255, 0.03) 240deg,
      transparent 360deg
    );
    animation: foil-spin 12s linear infinite;
  }

  @keyframes foil-spin {
    0% { transform: rotate(0deg) scale(1.5); }
    100% { transform: rotate(360deg) scale(1.5); }
  }

  /* ---- Auth card ---- */
  .auth-card {
    position: relative;
    z-index: 2;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 16px;
    padding: 44px 40px 36px;
    border-radius: 16px;
    background: rgba(8, 14, 28, 0.82);
    border: 1px solid rgba(255, 255, 255, 0.07);
    backdrop-filter: blur(20px);
    -webkit-backdrop-filter: blur(20px);
    min-width: 360px;
    max-width: 400px;
    box-shadow:
      0 0 60px rgba(59, 151, 151, 0.06),
      0 8px 32px rgba(0, 0, 0, 0.4);
  }

  /* ---- Brand ---- */
  .brand {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 6px;
    margin-bottom: 8px;
  }

  .title {
    font-family: 'Michroma', sans-serif;
    font-size: 1.6rem;
    font-weight: 400;
    color: #c8d0dc;
    letter-spacing: 2px;
    margin: 0;
  }

  .tagline {
    font-family: 'Michroma', sans-serif;
    font-size: 0.55rem;
    font-weight: 400;
    color: var(--color-text-muted);
    letter-spacing: 1.5px;
    margin: 0;
  }

  /* ---- Buttons ---- */
  .google-btn {
    width: 100%;
    padding: 11px 16px;
    border: 1px solid rgba(255, 255, 255, 0.08);
    border-radius: 8px;
    background: rgba(255, 255, 255, 0.04);
    color: var(--color-text-primary);
    font-family: 'Satoshi', sans-serif;
    font-size: 0.9rem;
    font-weight: 600;
    cursor: pointer;
    transition: background 0.15s, border-color 0.15s;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 10px;
  }

  .google-btn:hover:not(:disabled) {
    background: rgba(255, 255, 255, 0.08);
    border-color: rgba(255, 255, 255, 0.14);
  }

  .google-btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .google-icon {
    flex-shrink: 0;
  }

  .divider {
    display: flex;
    align-items: center;
    width: 100%;
    gap: 12px;
    color: var(--color-text-muted);
    font-size: 0.75rem;
  }

  .divider::before,
  .divider::after {
    content: '';
    flex: 1;
    height: 1px;
    background: rgba(255, 255, 255, 0.06);
  }

  .email-form,
  .otp-form {
    display: flex;
    flex-direction: column;
    gap: 10px;
    width: 100%;
  }

  input {
    width: 100%;
    padding: 10px 14px;
    border: 1px solid rgba(255, 255, 255, 0.07);
    border-radius: 8px;
    background: rgba(255, 255, 255, 0.04);
    color: var(--color-text-primary);
    font-family: 'Satoshi', sans-serif;
    font-size: 0.9rem;
    outline: none;
    transition: border-color 0.15s, background 0.15s;
  }

  input:focus {
    border-color: var(--color-teal);
    background: rgba(59, 151, 151, 0.05);
  }

  input::placeholder {
    color: var(--color-text-muted);
  }

  .otp-input {
    text-align: center;
    font-size: 1.5rem;
    letter-spacing: 0.5em;
    font-weight: 700;
  }

  .otp-hint {
    font-size: 0.85rem;
    color: var(--color-text-secondary);
    text-align: center;
  }

  .send-btn,
  .verify-btn {
    padding: 10px;
    border: none;
    border-radius: 8px;
    background: var(--color-teal);
    color: white;
    font-family: 'Satoshi', sans-serif;
    font-size: 0.9rem;
    font-weight: 700;
    cursor: pointer;
    transition: opacity 0.15s;
  }

  .send-btn:hover:not(:disabled),
  .verify-btn:hover:not(:disabled) {
    opacity: 0.85;
  }

  .send-btn:disabled,
  .verify-btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .back-btn {
    background: none;
    border: none;
    color: var(--color-text-muted);
    font-family: 'Satoshi', sans-serif;
    font-size: 0.8rem;
    cursor: pointer;
    text-decoration: underline;
    transition: color 0.15s;
  }

  .back-btn:hover {
    color: var(--color-text-secondary);
  }

  .error {
    color: #f87171;
    font-size: 0.85rem;
    text-align: center;
  }
</style>
