// The Dealer's line bank: gameplay-only, PG-13, no personal insults.
export const LINES = {
  start: [
    "Welcome back to my table. Sit. Suffer.",
    "Ah, a fresh victim. I mean player.",
    "Let's see how long you last this time.",
    "House rules: I pick every fourth piece. Good luck.",
    "I shuffled the deck myself. Lovingly.",
  ],
  aiPick: [
    "Oh, you wanted the long one? Adorable.",
    "I picked this one just for you.",
    "Hand-selected. Artisanal misery.",
    "Here. Enjoy that corner.",
    "Special delivery from management.",
    "I looked at your stack and laughed. Then I chose this.",
    "Fit that, genius.",
    "This one has your name on it. In red ink.",
    "Ooh, this will be awkward for you.",
    "I call this one: regret.",
    "My gift to you. No receipt.",
    "The house always picks. The house picked this.",
  ],
  playerClear: [
    "Fine. One layer. Don't get used to it.",
    "Lucky. Very lucky.",
    "I let you have that one.",
    "Okay, that was almost competent.",
    "Enjoy it. It won't last.",
    "A clear? Who taught you that?",
    "Hmph. Beginner's luck lasts this long?",
    "Cute. Do it again, I dare you.",
  ],
  spiteClear: [
    "You used MY piece? That's just rude.",
    "No. No no no. That was supposed to hurt.",
    "Put that back. That was mine.",
  ],
  nearDeath: [
    "Getting a little crowded up there, hmm?",
    "I can see the top from here. Can you?",
    "Tick tock. The ceiling is lovely this time of year.",
    "Breathe. Or don't. Your call.",
    "So close to the end. I'm almost sad. Almost.",
    "I'll let you live. For now.",
  ],
  vetoSuccess: [
    "You read me? Nobody reads me.",
    "Lucky guess. Totally a guess.",
    "Ugh. Fine. Have a boring piece.",
    "Stop looking at my face like that.",
    "I wasn't bluffing. Okay I was.",
  ],
  vetoFail: [
    "Wrong! I was just stretching.",
    "Ha! That was a fake. Pay up.",
    "Calling bluffs is hard, isn't it?",
    "Nope. That's a rage pip for me.",
  ],
  stun: [
    "Ow! My mask! My beautiful mask!",
    "Everything is spinning. Did you do that?",
    "Unfair! I demand a referee!",
    "I see three of you. All of you are annoying.",
    "Ten minutes in the penalty box. Thirty seconds. Whatever.",
  ],
  stunEnd: [
    "I'm back. And I remember everything.",
    "Recess is over.",
  ],
  rageReady: [
    "Don't you dare throw that at me.",
    "Put the angry cube down. Let's talk.",
  ],
  gameOver: [
    "And the tower falls. Beautiful.",
    "Game over. Same time tomorrow?",
    "I'd say good game, but I'm not a liar.",
    "Another one for my collection.",
    "You lasted longer than I expected. Slightly.",
    "Don't worry, the stack wanted to fall.",
  ],
  win: [
    "Eight minutes? Fine. You win. I'm going to sulk now.",
    "This never happened. Understood?",
  ],
  memory: [
    "Last time the {piece} finished you. I remember.",
    "Your best is {best}. Let's keep it that way.",
  ],
};
export function pick(event, rng=Math.random, vars={}) {
  const bank = LINES[event]; if (!bank) return null;
  return bank[Math.floor(rng()*bank.length)].replace(/\{(\w+)\}/g,(_,k)=>vars[k]??'');
}
export const lineCount = () => Object.values(LINES).reduce((s,a)=>s+a.length,0);
