<script lang="ts">
  import type { EmoteBurstCommand, EmoteType } from '@glazebot/shared-types';
  import { onMount } from 'svelte';

  let { command }: { command: EmoteBurstCommand } = $props();

  const EMOTE_MAP: Record<EmoteType, string> = {
    heart: '\u2764\uFE0F',
    fire: '\uD83D\uDD25',
    skull: '\uD83D\uDC80',
    star: '\u2B50',
    laugh: '\uD83D\uDE02',
    cry: '\uD83D\uDE2D',
    rage: '\uD83D\uDE21',
    thumbsup: '\uD83D\uDC4D',
    thumbsdown: '\uD83D\uDC4E',
    sparkle: '\u2728',
  };

  let canvasEl: HTMLCanvasElement | undefined = $state();

  interface Particle {
    x: number;
    y: number;
    vx: number;
    vy: number;
    size: number;
    rotation: number;
    rotationSpeed: number;
    opacity: number;
    life: number;
    maxLife: number;
  }

  onMount(() => {
    if (!canvasEl) return;
    const ctx = canvasEl.getContext('2d');
    if (!ctx) return;

    const w = canvasEl.width = canvasEl.offsetWidth;
    const h = canvasEl.height = canvasEl.offsetHeight;

    const ox = command.origin.x * w;
    const oy = command.origin.y * h;
    const spread = command.spread * Math.min(w, h);
    const count = command.count || 10;
    const emoji = EMOTE_MAP[command.emote] || '\u2764\uFE0F';
    const duration = command.duration_ms || 4000;

    const particles: Particle[] = [];
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = (Math.random() * 0.5 + 0.5) * spread * 0.02;
      particles.push({
        x: ox,
        y: oy,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 1.5,
        size: 16 + Math.random() * 16,
        rotation: Math.random() * 360,
        rotationSpeed: (Math.random() - 0.5) * 6,
        opacity: 1,
        life: 0,
        maxLife: duration * 0.7 + Math.random() * duration * 0.3,
      });
    }

    let frame: number;
    let lastTime = performance.now();

    function animate(time: number) {
      const dt = time - lastTime;
      lastTime = time;

      ctx!.clearRect(0, 0, w, h);

      let alive = false;
      for (const p of particles) {
        p.life += dt;
        if (p.life >= p.maxLife) continue;
        alive = true;

        const progress = p.life / p.maxLife;
        p.x += p.vx;
        p.y += p.vy;
        p.vy += 0.03; // gravity
        p.rotation += p.rotationSpeed;
        p.opacity = 1 - progress;

        ctx!.save();
        ctx!.globalAlpha = p.opacity;
        ctx!.translate(p.x, p.y);
        ctx!.rotate((p.rotation * Math.PI) / 180);
        ctx!.font = `${p.size}px sans-serif`;
        ctx!.textAlign = 'center';
        ctx!.textBaseline = 'middle';
        ctx!.fillText(emoji, 0, 0);
        ctx!.restore();
      }

      if (alive) {
        frame = requestAnimationFrame(animate);
      }
    }

    frame = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(frame);
  });
</script>

<canvas bind:this={canvasEl} class="emote-canvas"></canvas>

<style>
  .emote-canvas {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    pointer-events: none;
  }
</style>
