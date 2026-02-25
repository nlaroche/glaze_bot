<script lang="ts">
  import { CharacterCard } from '@glazebot/shared-ui';
  import type { GachaCharacter } from '@glazebot/shared-types';

  const demoCharacters: GachaCharacter[] = [
    {
      id: 'demo-common',
      user_id: 'demo',
      name: 'Rookie Rex',
      description: 'A laid-back commentator who keeps things chill. Gives simple callouts and relaxed vibes.',
      backstory: '',
      system_prompt: '',
      personality: { energy: 35, positivity: 60, formality: 30, talkativeness: 45, attitude: 40, humor: 55 },
      rarity: 'common',
      avatar_seed: 'demo-common-rex',
      created_at: '',
    },
    {
      id: 'demo-rare',
      user_id: 'demo',
      name: 'Sage Whisper',
      description: 'Analytical mind with a calm voice. Breaks down plays and spots patterns others miss.',
      backstory: '',
      system_prompt: '',
      personality: { energy: 45, positivity: 70, formality: 65, talkativeness: 55, attitude: 30, humor: 40 },
      rarity: 'rare',
      avatar_seed: 'demo-rare-sage',
      created_at: '',
    },
    {
      id: 'demo-epic',
      user_id: 'demo',
      name: 'Neon Blitz',
      description: 'High-octane hype machine who turns every play into a highlight reel moment.',
      backstory: '',
      system_prompt: '',
      personality: { energy: 90, positivity: 80, formality: 20, talkativeness: 85, attitude: 60, humor: 75 },
      rarity: 'epic',
      avatar_seed: 'demo-epic-neon',
      created_at: '',
    },
    {
      id: 'demo-legendary',
      user_id: 'demo',
      name: 'Oracle Vex',
      description: 'Legendary strategist with a sarcastic edge. Predicts plays before they happen and roasts bad ones.',
      backstory: '',
      system_prompt: '',
      personality: { energy: 70, positivity: 40, formality: 50, talkativeness: 75, attitude: 85, humor: 90 },
      rarity: 'legendary',
      avatar_seed: 'demo-legendary-vex',
      created_at: '',
    },
  ];

  let flippedStates = $state<Record<string, boolean>>({
    'demo-common': true,
    'demo-rare': true,
    'demo-epic': true,
    'demo-legendary': true,
  });

  function toggleFlip(id: string) {
    flippedStates[id] = !flippedStates[id];
  }
</script>

<h1>GlazeBot</h1>
<p class="subtitle">Your AI gaming companion</p>

<section>
  <h2>Characters</h2>
  <div class="card-showcase">
    {#each demoCharacters as char (char.id)}
      <CharacterCard
        character={char}
        flipped={flippedStates[char.id]}
        onflip={() => toggleFlip(char.id)}
      />
    {/each}
  </div>
</section>

<style>
  h1 {
    font-size: 2rem;
    color: var(--color-pink);
    margin-bottom: 4px;
  }

  .subtitle {
    color: var(--color-text-secondary);
    margin-bottom: 32px;
  }

  h2 {
    font-size: 1.25rem;
    color: var(--color-text-primary);
    margin-bottom: 16px;
  }

  .card-showcase {
    display: flex;
    gap: 24px;
    flex-wrap: wrap;
  }
</style>
