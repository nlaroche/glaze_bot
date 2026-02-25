<script lang="ts">
  import { goto } from '$app/navigation';
  import { signInWithGoogle, sendMagicLink } from '@glazebot/supabase-client';
  import { getAuthState } from '$lib/stores/auth.svelte';

  const auth = getAuthState();

  let email: string = $state('');
  let loading: boolean = $state(false);
  let error: string = $state('');
  let sent: boolean = $state(false);

  // If already authenticated, redirect
  $effect(() => {
    if (!auth.loading && auth.isAuthenticated) {
      goto('/pack');
    }
  });

  // With implicit flow, supabase-js auto-detects tokens in the URL hash on redirect
  const redirectUrl = typeof window !== 'undefined'
    ? window.location.origin
    : '';

  async function handleGoogle() {
    error = '';
    loading = true;
    try {
      const { error: oauthErr } = await signInWithGoogle(redirectUrl);
      if (oauthErr) error = oauthErr.message;
    } catch (e) {
      error = e instanceof Error ? e.message : 'Google sign-in failed';
    } finally {
      loading = false;
    }
  }

  async function handleMagicLink() {
    if (!email.trim()) return;
    error = '';
    loading = true;
    try {
      await sendMagicLink(email.trim(), redirectUrl);
      sent = true;
    } catch (e) {
      error = e instanceof Error ? e.message : 'Failed to send link';
    } finally {
      loading = false;
    }
  }
</script>

<div class="login-page">
  <div class="login-card glass-panel">
    <h1>GlazeBot</h1>
    <p class="subtitle">Sign in to your portal</p>

    {#if sent}
      <div class="sent-state" data-testid="magic-link-sent">
        <p class="sent-icon">✉</p>
        <p class="sent-msg">Check your email</p>
        <p class="sent-detail">We sent a sign-in link to <strong>{email}</strong></p>
        <button class="btn-secondary" onclick={() => { sent = false; error = ''; }} data-testid="back-to-email">
          Use a different email
        </button>
      </div>
    {:else}
      <button class="google-btn" onclick={handleGoogle} disabled={loading} data-testid="google-sign-in-btn">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
          <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/>
          <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
          <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
          <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
        </svg>
        Continue with Google
      </button>

      <div class="divider"><span>or</span></div>

      <form onsubmit={(e) => { e.preventDefault(); handleMagicLink(); }}>
        <input
          type="email"
          placeholder="Enter your email"
          bind:value={email}
          disabled={loading}
          data-testid="login-email"
        />
        <button type="submit" class="btn-primary" disabled={loading || !email.trim()} data-testid="send-magic-link-btn">
          {loading ? 'Sending...' : 'Send Magic Link'}
        </button>
      </form>
    {/if}

    {#if error}
      <p class="error" data-testid="login-error">{error}</p>
    {/if}
  </div>
</div>

<style>
  .login-page {
    display: flex;
    align-items: center;
    justify-content: center;
    min-height: 100vh;
  }

  .login-card {
    width: 400px;
    padding: 40px 32px;
    border-radius: 16px;
    text-align: center;
  }

  h1 {
    font-size: 2rem;
    color: var(--color-pink);
    margin-bottom: 4px;
  }

  .subtitle {
    color: var(--color-text-muted);
    margin-bottom: 24px;
    font-size: 0.9rem;
  }

  .google-btn {
    width: 100%;
    padding: 12px;
    border: 1px solid var(--glass-border);
    border-radius: 8px;
    background: rgba(255, 255, 255, 0.05);
    color: var(--color-text-primary);
    font-size: 0.95rem;
    font-weight: 600;
    cursor: pointer;
    font-family: inherit;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 10px;
    transition: all 0.2s;
  }

  .google-btn:hover:not(:disabled) {
    background: rgba(255, 255, 255, 0.08);
    border-color: rgba(255, 255, 255, 0.15);
  }

  .google-btn:disabled { opacity: 0.5; cursor: not-allowed; }

  .divider {
    display: flex;
    align-items: center;
    gap: 12px;
    margin: 20px 0;
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

  form {
    display: flex;
    flex-direction: column;
    gap: 12px;
  }

  input {
    padding: 12px 16px;
    background: rgba(255, 255, 255, 0.05);
    border: 1px solid var(--glass-border);
    border-radius: 8px;
    color: var(--color-text-primary);
    font-size: 0.95rem;
    font-family: inherit;
    outline: none;
    text-align: center;
  }

  input:focus { border-color: var(--color-teal); }
  input::placeholder { color: var(--color-text-muted); }

  .btn-primary {
    padding: 12px;
    border: none;
    border-radius: 8px;
    background: var(--color-teal);
    color: white;
    font-size: 0.95rem;
    font-weight: 600;
    cursor: pointer;
    font-family: inherit;
    transition: background 0.2s;
  }

  .btn-primary:hover:not(:disabled) { background: #4ab0b0; }
  .btn-primary:disabled { opacity: 0.5; cursor: not-allowed; }

  .btn-secondary {
    padding: 10px;
    border: 1px solid var(--glass-border);
    border-radius: 8px;
    background: none;
    color: var(--color-text-secondary);
    cursor: pointer;
    font-family: inherit;
    font-size: 0.85rem;
  }

  .btn-secondary:hover { color: var(--color-text-primary); }

  .sent-state {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 8px;
  }

  .sent-icon {
    font-size: 2.5rem;
    margin-bottom: 4px;
  }

  .sent-msg {
    font-size: 1.1rem;
    font-weight: 600;
    color: var(--color-text-primary);
  }

  .sent-detail {
    color: var(--color-text-secondary);
    font-size: 0.85rem;
    margin-bottom: 8px;
  }

  .error {
    color: #f87171;
    font-size: 0.85rem;
    margin-top: 8px;
  }
</style>
