// Mission definitions. Each `build` returns steps + optional setup returning a cleanup.
import { shuffle, rand } from './utils.js';
import { JETTY, ISLAND, ISLAND_DOCK, KOLIWADA } from './sea.js';

const near = (pts, p, minD, maxD) => pts.filter((q) => {
  const d = Math.hypot(q.x - p.x, q.z - p.z);
  return d >= minD && d <= maxD;
});

export function missionDefs(city, corners) {
  const P = city.pois;
  return [
    {
      id: 'chai',
      title: 'Chai Tapri Express ☕',
      giver: { x: -89, z: -89 },
      intro: 'Garam chai thandi ho rahi hai! Deliver 4 cutting chai before time runs out.',
      time: 130,
      reward: 800,
      build(g) {
        const pts = shuffle(near(corners, this.giver, 60, 260)).slice(0, 4);
        return pts.map((p, i) => ({ x: p.x, z: p.z, text: `Deliver chai #${i + 1}`, done: 'Chai delivered! +₹50', bonus: 50 }));
      },
    },
    {
      id: 'auto',
      title: 'Auto Wala Duty 🛺',
      giver: P.autoStand,
      intro: 'Get in the auto rickshaw and drop 3 passengers. Meter se chalega!',
      time: 300,
      reward: 1200,
      vehicle: 'auto',
      build(g) {
        const steps = [];
        let from = this.giver;
        for (let i = 0; i < 3; i++) {
          const pick = shuffle(near(corners, from, 60, 200))[0];
          const drop = shuffle(near(corners, pick, 150, 380))[0];
          steps.push({ x: pick.x, z: pick.z, text: `Pick up passenger ${i + 1}`, require: 'auto', passenger: true, done: 'Passenger baith gaya!' });
          steps.push({ x: drop.x, z: drop.z, text: `Drop passenger ${i + 1}`, require: 'auto', done: 'Fare collected! +₹150', bonus: 150 });
          from = drop;
        }
        return steps;
      },
    },
    {
      id: 'dabba',
      title: 'Dabbawala Run 🍱',
      giver: P.station,
      intro: 'Pick up the tiffins and deliver them to Tower Heights offices on the bike. Lunch time is sacred!',
      time: 170,
      reward: 1000,
      vehicle: 'bike',
      build(g) {
        const offices = shuffle(P.offices.slice()).slice(0, 3);
        return offices.map((p, i) => ({ x: p.x, z: p.z, text: `Deliver dabba to office ${i + 1}`, done: 'Dabba delivered, sahi time pe!' }));
      },
    },
    {
      id: 'bhaago',
      title: 'Police Se Bhaago 🚔',
      giver: P.chawl,
      intro: 'Some fool blamed you for stealing a mango cart. 3 stars incoming — lose the police!',
      time: 200,
      reward: 1500,
      build(g) {
        return [{ evade: true, text: 'Lose the police (0 stars)', done: 'Escaped!' }];
      },
      start(g) { g.addWanted(3, true); },
    },
    {
      id: 'baraat',
      title: 'Shaadi Mein Late 💍',
      giver: P.mandir,
      intro: 'Dulha is late for his own wedding! Drive through the checkpoints to the Shaadi Hall at Darwaza Plaza.',
      time: 120,
      reward: 1300,
      vehicle: 'car',
      build(g) {
        const route = [];
        let from = this.giver;
        for (let i = 0; i < 4; i++) {
          const p = shuffle(near(corners, from, 90, 200).filter((q) => q.x < from.x + 40))[0] || shuffle(corners)[0];
          route.push({ x: p.x, z: p.z, text: `Checkpoint ${i + 1}/5`, require: 'any', done: 'Checkpoint!' });
          from = p;
        }
        route.push({ x: P.plaza.x, z: P.plaza.z, text: 'Reach the Shaadi Hall!', require: 'any', done: 'Dulha pahunch gaya!' });
        return route;
      },
    },
    {
      id: 'cricket',
      title: 'Gully Cricket Six 🏏',
      giver: { x: -389, z: 411 },
      intro: 'Bunty hit a massive six! Run and find the ball (on foot), then bring it back before the bowler goes home.',
      time: 75,
      reward: 600,
      build() {
        const g0 = this.giver;
        const spots = shuffle(near(corners, g0, 40, 140)).slice(0, 2);
        return [
          ...spots.map((p, i) => ({ x: p.x + rand(-2, 2), z: p.z + rand(-2, 2), text: i === 0 ? 'Find the ball 🏏' : 'Arre, it bounced again! Find it', require: 'foot', done: i === 0 ? 'Ball mila... nahi, ye nimbu hai!' : 'Ball mil gaya!' })),
          { x: g0.x, z: g0.z, text: 'Bring the ball back', require: 'foot', done: 'One tip one hand — OUT!' },
        ];
      },
    },
    {
      id: 'bus',
      title: 'BEST-Wala Bus Duty 🚌',
      giver: { x: -289, z: 89 },
      intro: 'The bus driver went for chai. Drive Route 21 and STOP at every bus stop.',
      time: 240,
      reward: 1400,
      vehicle: 'bus',
      build() {
        const steps = [];
        let from = this.giver;
        for (let i = 0; i < 4; i++) {
          const p = shuffle(near(corners, from, 110, 220))[0];
          steps.push({ x: p.x, z: p.z, text: `Bus stop ${i + 1}/4 — stop fully`, require: 'bus', stop: true, done: 'Sawaari chadh gayi! +₹100', bonus: 100 });
          from = p;
        }
        return steps;
      },
    },
    {
      id: 'nakli',
      title: 'Nakli Maal Racket 📦',
      giver: { x: 189, z: -111 },
      intro: 'Inspector saab needs help: 3 trucks full of fake "Adidaas" shoes are driving around. Ram them until they are wrecked!',
      time: 180,
      reward: 2000,
      vehicle: 'police',
      build(g) {
        return [0, 1, 2].map((i) => {
          const t = g.spawnTarget('truck', 60, 200, 70);
          return { target: t, startHp: 70, text: `Wreck fake-goods truck ${i + 1}/3`, done: 'Nakli maal zabt!', bonus: 200 };
        });
      },
      decorate(v, box) {
        v.mesh.userData.beacons.forEach((b) => (b.visible = true));
      },
    },
    {
      id: 'prasad',
      title: 'Prasad Run 🌼',
      giver: { x: 89, z: 411 },
      intro: 'Aunty ji needs flowers, coconut and laddoo for the puja. Collect from 3 bazaar stalls and come back to the mandir.',
      time: 150,
      reward: 900,
      build() {
        const items = ['🌼 Genda phool', '🥥 Nariyal', '🍬 Laddoo'];
        const stalls = shuffle(P.stalls.filter((s) => s.sign !== 'PHOOL MALA')).slice(0, 3);
        return [
          ...stalls.map((s, i) => ({ x: s.x, z: s.z, text: `Buy ${items[i]}`, done: `${items[i]} le liya!` })),
          { x: this.giver.x, z: this.giver.z, text: 'Back to Aunty ji at the mandir', done: 'Aunty ji khush! Laddoo bonus +₹100', bonus: 100 },
        ];
      },
    },
    {
      id: 'horn',
      title: 'Horn OK Please 📯',
      giver: { x: 389, z: 211 },
      intro: 'New truck horn installed! Test it on traffic (honk near 15 vehicles), then deliver the load to Purana Bazaar.',
      time: 150,
      reward: 1100,
      vehicle: 'truck',
      build() {
        return [
          { honk: 15, text: 'Honk near traffic (H)', require: 'truck', done: 'Horn ekdum perfect!' },
          { x: -50, z: -89, text: 'Deliver the load to Purana Bazaar', require: 'truck', stop: true, done: 'Maal pahunch gaya!' },
        ];
      },
    },
    {
      id: 'sprint',
      title: 'Marine Drive Sprint 🌊',
      giver: { x: -589, z: -311 },
      intro: 'Midnight dare from the college gang: hit 90 km/h on the sea-face road and touch both ends. Watch out for cows!',
      time: 75,
      reward: 1200,
      vehicle: 'bike',
      build() {
        return [
          { x: -595.5, z: -560, text: 'Go to the south end of the sea-face', require: 'any', done: 'Ready... GO!' },
          { speed: 90, text: 'Hit 90 km/h', require: 'any', done: 'Hawa se baatein!' },
          { x: -604.5, z: 560, text: 'Touch the north end', require: 'any', done: 'Dare complete!' },
        ];
      },
    },
    // ------------------------------------------------------------------
    // 18+ gangster missions (only offered when 18+ mode is on)
    // ------------------------------------------------------------------
    {
      id: 'supari',
      mature: true,
      title: '🔞 Supari: Chhota Chikna',
      giver: { x: -211, z: 111 },
      intro: 'Don Bhau wants Chhota Chikna gone. He hangs around Purana Bazaar with two bodyguards. Finish him and lose the cops.',
      time: 240,
      reward: 5000,
      build(g) {
        const spot = shuffle(corners.filter((c) => c.x > -200 && c.x < 0 && c.z > -200 && c.z < 0))[0] || corners[0];
        const target = g.spawnGoons([[spot.x, spot.z]], { kind: 'target', weapon: 'katta', alert: false })[0];
        g.spawnGoons([[spot.x + 3, spot.z + 2], [spot.x - 3, spot.z - 2]], { weapon: 'katta', alert: false });
        return [
          { kill: [target], text: 'Eliminate Chhota Chikna (white kurta)', done: 'Kaam tamaam.', onDone: (gg) => gg.addWanted(2) },
          { evade: true, text: 'Lose the cops', done: 'Clean job.' },
        ];
      },
    },
    {
      id: 'heist',
      mature: true,
      title: '🔞 Sahakari Bank Heist',
      giver: { x: 89, z: -411 },
      intro: 'The co-op bank vault is open today. Walk in, crack it, survive the heat, and bring the cash to the chawl hideout.',
      time: 360,
      reward: 9000,
      build(g) {
        const bank = { x: 11, z: -350 };
        g.addSign?.('SAHAKARI BANK ₹', '#0b6e4f', '#ffd60a', bank.x - 1.5, bank.z, 'bank');
        return [
          { x: bank.x, z: bank.z, text: 'Go into the Sahakari Bank (on foot)', require: 'foot', done: 'Andar aa gaye!' },
          { x: bank.x, z: bank.z, hold: 7, text: 'Crack the tijori — stay here', require: 'foot', onStart: (gg) => { gg.meme('heistAlarm', true); gg.addWanted(3); }, done: '₹ bag mil gaya! Ab bhaago!', onDone: (gg) => gg.addWanted(1) },
          { evade: true, text: 'Lose the cops (and the helicopter)', done: 'Escaped with the loot!' },
          { x: P.chawl.x, z: P.chawl.z, text: 'Bring the cash to the chawl hideout', done: 'Bhau khush!' },
        ];
      },
    },
    {
      id: 'turf',
      mature: true,
      title: '🔞 Gang War: Chawl Turf',
      giver: { x: 389, z: 289 },
      intro: 'A rival gang has moved into Chawl Colony. Clear them all out. They are armed.',
      time: 240,
      reward: 6000,
      build(g) {
        const pts = shuffle(corners.filter((c) => c.x > 300 && c.z > 300 && c.x < 600 && c.z < 600)).slice(0, 7).map((p) => [p.x + rand(-3, 3), p.z + rand(-3, 3)]);
        const goons = g.spawnGoons(pts, { weapon: 'mix', alert: false });
        return [{ kill: goons, text: 'Wipe out the rival gang', done: 'Ilaaka humara hai!' }];
      },
    },
    {
      id: 'smuggle',
      mature: true,
      title: '🔞 Aam ki Petiyan (Smuggling)',
      giver: { x: -589, z: 150 },
      intro: 'Mango crates on the sea-face. Don\'t ask what\'s inside. Drive the truck to the Tower Heights warehouse. Expect company.',
      time: 240,
      reward: 4500,
      vehicle: 'truck',
      build(g) {
        const wh = { x: 511, z: -489 };
        return [
          { x: this.giver.x, z: this.giver.z, text: 'Get in the smuggling truck', require: 'truck', done: 'Maal load ho gaya. Police ko khabar lag gayi!', onDone: (gg) => gg.addWanted(2) },
          { x: wh.x, z: wh.z, text: 'Deliver to the warehouse (stop there)', require: 'truck', stop: true, done: 'Maal pahunch gaya.' },
        ];
      },
    },
    // ------------------------------------------------------------------
    // Sea missions
    // ------------------------------------------------------------------
    {
      id: 'machhli',
      title: 'Machhli Express 🐟',
      giver: { x: KOLIWADA.x, z: KOLIWADA.z + 6 },
      intro: 'Koli tai needs her nets hauled in from the sea before the fish market closes. Take her boat.',
      time: 300,
      reward: 1600,
      vehicle: 'fishboat',
      spawnAt: { x: JETTY.x0 + 46, z: JETTY.z + 7.8, yaw: -Math.PI / 2 },
      build(g) {
        const nets = [0, 1, 2].map(() => g.sea.randomSeaPoint(JETTY.x0 - 260, JETTY.x0 - 40));
        return [
          ...nets.map((p, i) => ({ x: p.x, z: p.z, text: `Haul in net ${i + 1}/3 (stop at the buoy)`, require: 'boat', stop: true, done: 'Jaal bhar gaya! 🐟 +₹100', bonus: 100 })),
          { x: JETTY.x0 + 30, z: JETTY.z + 9, text: 'Bring the catch back to Koliwada jetty', require: 'boat', stop: true, done: 'Machhli bazaar pahunch gayi!' },
        ];
      },
    },
    {
      id: 'regatta',
      title: 'Arabian Sea Regatta ⛵',
      giver: { x: JETTY.x1 - 6, z: JETTY.z },
      intro: 'Speedboat race around Kila Island. Hit every buoy and beat the clock!',
      time: 130,
      reward: 2200,
      vehicle: 'speedboat',
      spawnAt: { x: JETTY.x0 + 20, z: JETTY.z - 6.6, yaw: -Math.PI / 2 },
      build() {
        const R = ISLAND.r + 32;
        const pts = [{ x: JETTY.x0 - 30, z: JETTY.z - 10 }];
        for (let i = 0; i <= 7; i++) {
          const a = -Math.PI * 0.35 + (i / 7) * Math.PI * 2 * -1 + Math.PI;
          pts.push({ x: ISLAND.x + Math.cos(a) * R, z: ISLAND.z + Math.sin(a) * R });
        }
        pts.push({ x: JETTY.x0 - 20, z: JETTY.z + 12 });
        return pts.map((p, i) => ({ x: p.x, z: p.z, text: i === pts.length - 1 ? 'Finish at the jetty!' : `Buoy ${i + 1}/${pts.length - 1}`, require: 'boat', done: i === pts.length - 1 ? 'Regatta jeet gaye!' : 'Buoy! ⛵' }));
      },
    },
    {
      id: 'samundar',
      mature: true,
      title: '🔞 Samundari Smuggling',
      giver: { x: JETTY.x1 - 14, z: JETTY.z },
      intro: 'A cargo ship is anchored offshore. Load the crates at its stern, outrun the Coast Guard, and stash the goods in Kila fort.',
      time: 360,
      reward: 7000,
      vehicle: 'speedboat',
      spawnAt: { x: JETTY.x0 + 20, z: JETTY.z - 6.6, yaw: -Math.PI / 2 },
      build(g) {
        const st = g.sea.shipStern;
        return [
          { x: st.x, z: st.z, text: 'Reach the cargo ship\'s stern', require: 'boat', done: 'Rassi pakad li!' },
          { x: st.x, z: st.z, hold: 5, text: 'Load the crates — hold position', require: 'boat', done: 'Petiyan load! Coast Guard aa rahi hai!', onDone: (gg) => gg.addWanted(3) },
          { x: ISLAND_DOCK.x + 10, z: ISLAND_DOCK.z, text: 'Run for Kila Island dock', require: 'boat', stop: true, done: 'Kinare pahunch gaye!' },
          { x: ISLAND.x + 6, z: ISLAND.z - 6, text: 'Stash the goods inside the fort (on foot)', require: 'foot', done: 'Maal chhup gaya.' },
          { evade: true, text: 'Lose the heat', done: 'Saaf bach gaye!' },
        ];
      },
    },
  ];
}
