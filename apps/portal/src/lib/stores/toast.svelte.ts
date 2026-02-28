// ─── Toast Notification Store ───────────────────────────────────────
// Svelte 5 runes-based. Call toast.success/error/info from anywhere.

export interface Toast {
  id: number;
  type: 'success' | 'error' | 'info';
  message: string;
  duration: number;
}

let nextId = 0;
let toasts = $state<Toast[]>([]);

function add(type: Toast['type'], message: string, duration = 3000) {
  const id = nextId++;
  toasts.push({ id, type, message, duration });
  if (duration > 0) {
    setTimeout(() => dismiss(id), duration);
  }
}

function dismiss(id: number) {
  toasts = toasts.filter((t) => t.id !== id);
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
