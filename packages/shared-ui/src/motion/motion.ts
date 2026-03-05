import {
  applyMotion,
  buildMotionKeyframes,
  DEFAULT_ANIMATIONS,
  type AnimationsConfig,
  type MotionType,
} from '@glazebot/shared-types';

// ── Module-level feel store ──────────────────────────────────────────

let globalFeel: AnimationsConfig = DEFAULT_ANIMATIONS;

/** Call once on app startup after loading config from Supabase. */
export function setGlobalFeel(feel: AnimationsConfig): void {
  globalFeel = feel;
}

/** Returns the current global feel. */
export function getGlobalFeel(): AnimationsConfig {
  return globalFeel;
}

// ── Svelte action ────────────────────────────────────────────────────

export type MotionParams =
  | MotionType
  | { type: MotionType; delay?: number; fast?: boolean };

function resolveParams(params: MotionParams): { type: MotionType; delay: number; fast: boolean } {
  if (typeof params === 'string') return { type: params, delay: 0, fast: false };
  return { type: params.type, delay: params.delay ?? 0, fast: params.fast ?? false };
}

/**
 * Svelte action: `use:motion={'pop'}` or `use:motion={{ type: 'pop', fast: true }}`
 *
 * Plays an entrance animation on mount using the global feel.
 * `fast: true` — zero anticipation, 40% duration. Use for UI chrome (menus, tooltips, dialogs).
 */
export function motion(node: HTMLElement, params: MotionParams) {
  let { type, delay, fast } = resolveParams(params);
  let timer: ReturnType<typeof setTimeout> | undefined;
  let anim: Animation | undefined;

  function play() {
    const feel = fast
      ? { ...globalFeel, anticipation: 0, speed: Math.min(globalFeel.speed, 300) }
      : globalFeel;

    function run() {
      anim = applyMotion(node, type, feel);
      // After entrance finishes, cancel the WAAPI fill so CSS transitions
      // (e.g. exit opacity) can take effect again.
      anim.onfinish = () => { anim!.cancel(); };
    }

    if (delay > 0) {
      timer = setTimeout(run, delay);
    } else {
      run();
    }
  }

  play();

  return {
    update(newParams: MotionParams) {
      const resolved = resolveParams(newParams);
      type = resolved.type;
      delay = resolved.delay;
      fast = resolved.fast;
      if (timer) clearTimeout(timer);
      if (anim) anim.cancel();
      play();
    },
    destroy() {
      if (timer) clearTimeout(timer);
      if (anim) anim.cancel();
    },
  };
}

// ── Exit helper ──────────────────────────────────────────────────────

/**
 * Play a motion in reverse (exit animation).
 * Await the returned promise before removing the element from the DOM.
 */
export function playMotionOut(
  node: HTMLElement,
  type: MotionType,
  feel?: AnimationsConfig,
): Promise<void> {
  const f = feel ?? globalFeel;
  const keyframes = buildMotionKeyframes(type, f);
  const reversed = [...keyframes].reverse();
  const anim = node.animate(reversed, {
    duration: f.speed * 0.6, // exits are snappier
    easing: 'linear',
    fill: 'forwards',
  });
  return anim.finished.then(() => {});
}
