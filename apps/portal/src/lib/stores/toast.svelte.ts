// ─── Toast Notification Store ───────────────────────────────────────
// Svelte 5 runes-based. Call toast.success/error/info from anywhere.

export interface Toast {
  id: number;
  type: 'success' | 'error' | 'info';
  message: string;
  duration: number;
  dismissing: boolean;
}

let nextId = 0;
let toasts = $state<Toast[]>([]);

function add(type: Toast['type'], message: string, duration = 3000) {
  const id = nextId++;
  toasts.push({ id, type, message, duration, dismissing: false });
  if (duration > 0) {
    setTimeout(() => dismiss(id), duration);
  }
}

function dismiss(id: number) {
  const t = toasts.find((t) => t.id === id);
  if (!t || t.dismissing) return;
  t.dismissing = true;
  // Wait for exit animation before removing
  setTimeout(() => {
    toasts = toasts.filter((t) => t.id !== id);
  }, 300);
}

export const toast = {
  success: (msg: string, duration?: number) => add('success', msg, duration),
  error: (msg: string, duration?: number) => add('error', msg, duration ?? 5000),
  info: (msg: string, duration?: number) => add('info', msg, duration),
  dismiss,
  get items() {
    return toasts;
  },
};
