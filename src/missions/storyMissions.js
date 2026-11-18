// The story of CALDERA BAY: 8 jobs for Rook, a fixer rebuilding her crew after
// the Volcano Boys pushed her out. All names, places and people are invented.
// Stage kinds: goto | drive | kill | collect | escape | talk | race.
export const STORY_MISSIONS = [
  {
    id: 'm1', chapter: 'CHAPTER 1', title: 'Black Sand Arrival',
    brief: 'You wash up on Caldera Bay with $250 and a name to clear. Rook wants a word at the Night Market.',
    giver: 'Rook', payout: 200,
    intro: [
      { speaker: 'Rook', text: 'So the mainland finally spat you out. Good. I need hands I can trust.', color: '#ff2e88' },
      { speaker: 'You', text: 'Trust costs money, Rook.', color: '#e74c3c' },
      { speaker: 'Rook', text: 'Then earn it. Meet me at the Night Market — and stay off the main roads.', color: '#ff2e88' },
    ],
    stages: [
      { kind: 'goto', at: [-20, -20], label: 'Night Market', text: 'Meet Rook at the Night Market' },
      { kind: 'talk', at: [-20, -20], text: 'Talk to Rook (press E)' },
    ],
  },
  {
    id: 'm2', chapter: 'CHAPTER 2', title: 'The Marina Job',
    brief: 'A collector left his sports car at the Marina. Borrow it. Permanently. Then lose the heat.',
    giver: 'Rook', payout: 500,
    intro: [
      { speaker: 'Rook', text: 'A Vantara Stradale sits at the Marina, keys in it. Bring it to the garage on Foundry Row.', color: '#ff2e88' },
      { speaker: 'You', text: 'And the cops?', color: '#e74c3c' },
      { speaker: 'Rook', text: 'That is the other half of the job.', color: '#ff2e88' },
    ],
    stages: [
      { kind: 'drive', at: [160, 20], label: 'Marina Bay', text: 'Steal the Stradale at the Marina (press E by the car)', spawnCar: { kind: 'sports', color: 0xffd700 } },
      { kind: 'drive', at: [-160, 0], label: 'Foundry Row', text: 'Deliver the car to the Foundry garage', timer: 150, wanted: 2 },
      { kind: 'escape', text: 'Lose the wanted level', timer: 120 },
    ],
  },
  {
    id: 'm3', chapter: 'CHAPTER 3', title: 'Volcano Run',
    brief: 'Rook needs a package over the Causeway before the Volcano Boys lock the bridges down.',
    giver: 'Rook', payout: 600,
    intro: [
      { speaker: 'Rook', text: 'Package. Causeway South. Ninety seconds. The bridges close when the boys wake up.', color: '#ff2e88' },
    ],
    stages: [
      { kind: 'goto', at: [0, 0], label: 'Night Market', text: 'Pick up the package at the Night Market' },
      { kind: 'drive', at: [0, 200], label: 'Causeway Bridge', text: 'Cross the Causeway Bridge', timer: 90 },
      { kind: 'drive', at: [-160, 200], label: 'Black Sand Beach', text: 'Drop the package at the beach shack', timer: 90 },
    ],
  },
  {
    id: 'm4', chapter: 'CHAPTER 4', title: 'Warehouse Heat',
    brief: 'The Volcano Boys store their take in a Foundry warehouse. Take it back — loudly.',
    giver: 'Rook', payout: 800,
    intro: [
      { speaker: 'Rook', text: 'Four of their boys guard the warehouse on Foundry Row. Walk in like you own it.', color: '#ff2e88' },
      { speaker: 'You', text: 'I do own it. As of tonight.', color: '#e74c3c' },
    ],
    stages: [
      { kind: 'goto', at: [-160, -40], label: 'Old Foundry', text: 'Reach the Foundry warehouse' },
      { kind: 'kill', at: [-160, -40], count: 4, text: 'Clear the warehouse guards (0/4)', spawnEnemies: 4 },
      { kind: 'collect', at: [-160, -40], count: 3, text: 'Grab the three cash crates (0/3)' },
      { kind: 'escape', text: 'Lose the wanted level', timer: 150 },
    ],
  },
  {
    id: 'm5', chapter: 'CHAPTER 5', title: 'Night Market Run',
    brief: 'Three drops, three corners of the market, one very impatient buyer.',
    giver: 'Deli', payout: 700,
    intro: [
      { speaker: 'Deli', text: 'Three envelopes, three stalls, no questions. The buyer pays double if you are fast.', color: '#ffe600' },
    ],
    stages: [
      { kind: 'goto', at: [-40, -40], label: 'Night Market', text: 'Drop 1: the lantern stall' },
      { kind: 'goto', at: [40, -40], label: 'Night Market', text: 'Drop 2: the fish stall' },
      { kind: 'goto', at: [0, 40], label: 'Night Market', text: 'Drop 3: the flower stall' },
      { kind: 'drive', at: [-160, -160], label: 'Caldera Heights', text: 'Collect payment at the Heights villa', timer: 180 },
    ],
  },
  {
    id: 'm6', chapter: 'CHAPTER 6', title: 'The Airstrip Deal',
    brief: 'A buyer lands at the Airstrip at dusk. The Volcano Boys plan to crash the deal. Be faster.',
    giver: 'Rook', payout: 1000,
    intro: [
      { speaker: 'Rook', text: 'The buyer lands at 18:00. Their boys will be there. So will you — first.', color: '#ff2e88' },
    ],
    stages: [
      { kind: 'drive', at: [160, -160], label: 'Airstrip Flats', text: 'Reach the Airstrip', timer: 150 },
      { kind: 'kill', at: [160, -160], count: 5, text: 'Hold the runway — stop the ambush (0/5)', spawnEnemies: 5 },
      { kind: 'drive', at: [200, 20], label: 'Marina Pier', text: 'Escort the buyer to the Marina Pier', timer: 180, wanted: 3 },
    ],
  },
  {
    id: 'm7', chapter: 'CHAPTER 7', title: 'Downtown Takedown',
    brief: 'The Volcano Boys run downtown from the Ember Spire. Rook wants their ledger — and their exit blocked.',
    giver: 'Rook', payout: 1200,
    intro: [
      { speaker: 'Rook', text: 'Their ledger is in the Spire, top floor. Get it, and the city is ours by morning.', color: '#ff2e88' },
    ],
    stages: [
      { kind: 'goto', at: [0, -160], label: 'Ember Spire', text: 'Reach the Ember Spire' },
      { kind: 'kill', at: [0, -160], count: 6, text: 'Clear the Spire lobby (0/6)', spawnEnemies: 6 },
      { kind: 'collect', at: [0, -160], count: 1, text: 'Take the ledger' },
      { kind: 'drive', at: [-20, -20], label: 'Night Market', text: 'Bring the ledger to Rook', timer: 150, wanted: 4 },
    ],
  },
  {
    id: 'm8', chapter: 'CHAPTER 8', title: 'Caldera Finale',
    brief: 'The Volcano Boys make their last stand at the crater. End it — and drive out of the smoke a legend.',
    giver: 'Rook', payout: 2000,
    intro: [
      { speaker: 'Rook', text: 'Everything they have is at the crater. Everything we have is you. Go.', color: '#ff2e88' },
      { speaker: 'You', text: 'Tell the city my name when it is over.', color: '#e74c3c' },
    ],
    stages: [
      { kind: 'drive', at: [-150, -150], label: 'Mount Caldera', text: 'Reach the crater', timer: 180 },
      { kind: 'kill', at: [-150, -150], count: 8, text: 'Break the last stand (0/8)', spawnEnemies: 8 },
      { kind: 'drive', at: [0, 200], label: 'Causeway Bridge', text: 'Escape across the Causeway', timer: 150, wanted: 5 },
      { kind: 'escape', text: 'Lose the heat — become a legend', timer: 180 },
    ],
  },
];

export function missionById(id) {
  return STORY_MISSIONS.find((m) => m.id === id);
}

export function nextMission(doneIds) {
  return STORY_MISSIONS.find((m) => !doneIds.includes(m.id)) || null;
}
