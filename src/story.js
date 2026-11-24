// Story mode: "Raju ki Kahani" — a village boy arrives in Mayanagri.
// Each chapter = cutscene + one of the missions. 18+ mode branches into the Bhau storyline.
const PAPPU = { id: 'pappu', arch: 'worker' };
const SHARMA = { id: 'sharma', arch: 'farmer' };
const AUNTY = { id: 'aunty', arch: 'woman2', female: true };
const PATIL = { id: 'patil', arch: 'swat' };
const BHAU = { id: 'bhau', arch: 'business' };

const COMMON = [
  { mission: 'auto', title: 'Naya Sheher', cast: [PAPPU], lines: [['narrator', 'c1_0'], ['pappu', 'c1_1'], ['player', 'c1_2'], ['pappu', 'c1_3']] },
  { mission: 'chai', title: 'Chai aur Chakkar', cast: [SHARMA], lines: [['sharma', 'c2_1'], ['player', 'c2_2'], ['sharma', 'c2_3']] },
  { mission: 'baraat', title: 'Shaadi ka Chakkar', cast: [AUNTY], lines: [['aunty', 'c3_1'], ['player', 'c3_2'], ['aunty', 'c3_3']] },
  { mission: 'bhaago', title: 'Pehli Galti', cast: [PAPPU], lines: [['pappu', 'c4_1'], ['player', 'c4_2'], ['pappu', 'c4_3']] },
  { mission: 'nakli', title: 'Inspector Patil', cast: [PATIL], lines: [['patil', 'c5_1'], ['player', 'c5_2'], ['patil', 'c5_3']] },
];
const NORMAL_END = [
  { mission: 'sprint', title: 'Mayanagri ka Raja', cast: [PAPPU], lines: [['pappu', 'c6_1'], ['player', 'c6_2'], ['pappu', 'c6_3']], outro: 'c6_end' },
];
const MATURE_END = [
  { mission: 'supari', title: '🔞 Bhau ka Bulawa', cast: [BHAU], lines: [['bhau', 'm6_1'], ['player', 'm6_2'], ['bhau', 'm6_3']] },
  { mission: 'turf', title: '🔞 Ilaaka', cast: [BHAU], lines: [['bhau', 'm7_1'], ['player', 'm7_2'], ['bhau', 'm7_3']] },
  { mission: 'heist', title: '🔞 Sabse Bada Daav', cast: [BHAU, PAPPU], lines: [['bhau', 'm8_1'], ['pappu', 'm8_2'], ['player', 'm8_3']], outro: 'm8_end' },
];

export function storyChapters(mature) {
  return COMMON.concat(mature ? MATURE_END : NORMAL_END);
}
