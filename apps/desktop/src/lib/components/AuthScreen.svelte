<script lang="ts">
  import { getGoogleOAuthUrl, exchangeCodeForSession, signInWithEmailOtp, verifyEmailOtp } from '@glazebot/supabase-client';
  import { invoke } from '@tauri-apps/api/core';
  import { open } from '@tauri-apps/plugin-shell';

  let email = $state('');
  let otpCode = $state('');
  let otpSent = $state(false);
  let error = $state('');
  let loading = $state(false);

  async function handleGoogle() {
    error = '';
    loading = true;
    try {
      // 1. Start temp localhost server, get port
      const port: number = await invoke('start_oauth_server');
      // 2. Get OAuth URL with redirect to localhost server
      const { data, error: oauthErr } = await getGoogleOAuthUrl(`http://localhost:${port}`);
      if (oauthErr || !data?.url) {
        error = oauthErr?.message ?? 'Failed to get OAuth URL';
        loading = false;
        return;
      }
      // 3. Open system browser
      await open(data.url);
      // 4. Wait for callback
      const callbackUrl: string = await invoke('wait_for_oauth_callback');
      // 5. Extract code and exchange for session
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
  <div class="auth-card">
    <h1 class="title">GLAZEBOT</h1>
    <p class="subtitle">Sign in to continue</p>

    <button class="google-btn" onclick={handleGoogle} disabled={loading}>
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
  }

  .auth-card {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 16px;
    padding: 48px 40px;
    border-radius: 16px;
    border: 1px solid var(--glass-border);
    backdrop-filter: blur(var(--glass-blur));
    -webkit-backdrop-filter: blur(var(--glass-blur));
    min-width: 360px;
    max-width: 400px;
  }

  .title {
    font-size: 2rem;
    font-weight: 900;
    color: var(--color-pink);
    letter-spacing: 0.1em;
    margin-bottom: 0;
  }

  .subtitle {
    color: var(--color-text-secondary);
    font-size: 0.9rem;
    margin-bottom: 8px;
  }

  .google-btn {
    width: 100%;
    padding: 12px;
    border: none;
    border-radius: 8px;
    background: var(--color-teal);
    color: white;
    font-family: 'Satoshi', sans-serif;
    font-size: 0.95rem;
    font-weight: 700;
    cursor: pointer;
    transition: opacity 0.15s;
  }

  .google-btn:hover:not(:disabled) {
    opacity: 0.85;
  }

  .google-btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .divider {
    display: flex;
    align-items: center;
    width: 100%;
    gap: 12px;
    color: var(--color-text-muted);
    font-size: 0.8rem;
  }

  .divider::before,
  .divider::after {
    content: '';
    flex: 1;
    height: 1px;
    background: var(--glass-border);
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
    border: 1px solid var(--glass-border);
    border-radius: 8px;
    background: rgba(255, 255, 255, 0.05);
    color: var(--color-text-primary);
    font-family: 'Satoshi', sans-serif;
    font-size: 0.9rem;
    outline: none;
    transition: border-color 0.15s;
  }

  input:focus {
    border-color: var(--color-teal);
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
