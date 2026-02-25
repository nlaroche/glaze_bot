export type Rarity = 'common' | 'rare' | 'epic' | 'legendary';

export interface ShowcaseCharacter {
  name: string;
  description: string;
  quote: string;
  rarity: Rarity;
  avatar: string;
}

// Hero floating cards (3 featured characters)
export const heroCharacters: ShowcaseCharacter[] = [
  {
    name: 'Hype',
    description: 'Deranged esports commentator',
    quote: 'ABSOLUTELY DISGUSTING play, someone call the authorities!',
    rarity: 'legendary',
    avatar: '/avatars/hype.png',
  },
  {
    name: 'Sage',
    description: 'Calm tactical advisor',
    quote: 'Patience. Let them make the first mistake.',
    rarity: 'epic',
    avatar: '/avatars/sage.png',
  },
  {
    name: 'Jinx',
    description: 'Chaotic gremlin who roots for disaster',
    quote: 'Yes yes yes, everything is on fire, this is BEAUTIFUL!',
    rarity: 'rare',
    avatar: '/avatars/jinx.png',
  },
];

// Card showcase (one per rarity tier)
export const rarityShowcase: ShowcaseCharacter[] = [
  {
    name: 'Grandma Dot',
    description: 'Wholesome confused grandma',
    quote: 'Is that your friend or are you shooting him?',
    rarity: 'common',
    avatar: '/avatars/grandma_dot.png',
  },
  {
    name: 'Vex',
    description: 'In-world rogue companion',
    quote: 'Dibs on whatever they drop. Non-negotiable.',
    rarity: 'rare',
    avatar: '/avatars/vex.png',
  },
  {
    name: 'The Narrator',
    description: 'Darkest Dungeon-style narrator',
    quote: 'Ruin has come to this place, carried on the wings of hubris.',
    rarity: 'epic',
    avatar: '/avatars/the_narrator.png',
  },
  {
    name: 'Hype',
    description: 'Deranged esports commentator',
    quote: 'THE COMEBACK ARC BEGINS!',
    rarity: 'legendary',
    avatar: '/avatars/hype.png',
  },
];

// Party demo (3 characters)
export const partyDemo: ShowcaseCharacter[] = [
  {
    name: 'Coach Brick',
    description: 'Screaming old-school sports coach',
    quote: 'HUSTLE! My grandmother moves faster!',
    rarity: 'rare',
    avatar: '/avatars/coach_brick.png',
  },
  {
    name: 'Sage',
    description: 'Calm tactical advisor',
    quote: 'There\'s your window, go now.',
    rarity: 'epic',
    avatar: '/avatars/sage.png',
  },
  {
    name: 'Jinx',
    description: 'Chaotic gremlin',
    quote: 'Do it again but WORSE!',
    rarity: 'rare',
    avatar: '/avatars/jinx.png',
  },
];

// Character grid (8 characters with hover quotes)
export const characterGrid: ShowcaseCharacter[] = [
  {
    name: 'Hype',
    description: 'Deranged esports commentator',
    quote: 'Oh we are COOKING now, the kitchen is ON FIRE!',
    rarity: 'legendary',
    avatar: '/avatars/hype.png',
  },
  {
    name: 'Sage',
    description: 'Calm tactical advisor',
    quote: 'Good trade. You came out ahead on that one.',
    rarity: 'epic',
    avatar: '/avatars/sage.png',
  },
  {
    name: 'Jinx',
    description: 'Chaotic gremlin',
    quote: 'Jump off that. You will not. Prove me wrong.',
    rarity: 'rare',
    avatar: '/avatars/jinx.png',
  },
  {
    name: 'The Narrator',
    description: 'Gothic narrator',
    quote: 'How quickly the tide turns.',
    rarity: 'epic',
    avatar: '/avatars/the_narrator.png',
  },
  {
    name: 'Vex',
    description: 'In-world rogue companion',
    quote: 'Cool, cool, love walking into an ambush.',
    rarity: 'rare',
    avatar: '/avatars/vex.png',
  },
  {
    name: 'Mort',
    description: 'Depressed existentialist',
    quote: 'You won. Temporarily. Everything is temporary.',
    rarity: 'common',
    avatar: '/avatars/mort.png',
  },
  {
    name: 'Grandma Dot',
    description: 'Wholesome confused grandma',
    quote: 'This Nintendo has such nice colors!',
    rarity: 'common',
    avatar: '/avatars/grandma_dot.png',
  },
  {
    name: 'Coach Brick',
    description: 'Screaming sports coach',
    quote: 'What in the HELL was that?!',
    rarity: 'rare',
    avatar: '/avatars/coach_brick.png',
  },
];
