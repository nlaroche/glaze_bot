<script lang="ts">
  import { PackOpener } from '@glazebot/shared-ui';
  import type { GachaCharacter } from '@glazebot/shared-types';

  const demoCharacters: GachaCharacter[] = [
    {
      id: 'demo-common',
      user_id: 'demo',
      name: 'Snapjaw',
      description: '"The mic was already on when I sat down. I haven\'t left since."',
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
      name: 'Chad Worthington III',
      description: '"I didn\'t choose the analyst desk. The analyst desk chose me, and then I sued it."',
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
      name: 'Blobsworth',
      description: '"They gave me a desk. I gave them content. We are not the same."',
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
      name: 'Grug the Famished',
      description: '"First I finish the pasta. Then I finish the game. Then I finish you."',
      backstory: '',
      system_prompt: '',
      personality: { energy: 70, positivity: 40, formality: 50, talkativeness: 75, attitude: 85, humor: 90 },
      rarity: 'legendary',
      avatar_seed: 'demo-legendary-vex',
      created_at: '',
    },
  ];

  const demoImages: Record<string, string> = {
    'demo-common': '/testCharacter1.png',
    'demo-rare': '/testCharacter2.png',
    'demo-epic': '/testCharacter3.png',
    'demo-legendary': '/testCharacter4.png',
  };
</script>

<div class="page">
  <PackOpener characters={demoCharacters} images={demoImages} />
</div>

<style>
  .page {
    display: flex;
    align-items: center;
    justify-content: center;
    height: 100%;
    padding: 24px;
  }
</style>
