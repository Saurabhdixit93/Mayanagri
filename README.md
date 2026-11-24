# Mayanagri: Bharat Streets 🛺

An original open-world, third-person driving/crime-caper game set in a fictional
Mumbai-style Indian city. Runs in the browser (Three.js + Vite), no assets to download.

## Run

```bash
npm install
npm run dev        # http://localhost:5173
npm run build      # static build in dist/ (deploy anywhere)
```

## What's in it

- **City (procedural, 1.2 km²)**: Purana Bazaar with shop signs (Hindi + English), Tower Heights,
  Chawl Colony with blue tarps, Marine Promenade + beach + Arabian Sea, Mandir Chowk, Darwaza Plaza,
  Gully Cricket Maidan with a banyan tree, Local Station with a local train (people hanging out of the doors),
  water tanks on every roof, "Thookna Mana Hai" walls, potholes, zebra crossings, day/night cycle.
- **Traffic drives on the LEFT**: auto rickshaws, kaali-peeli taxis, hatchbacks, city buses,
  "Horn OK Please" trucks with musical horns, thumper bikes, police jeeps. Blocked drivers honk
  non-stop, then squeeze through anyway. Traffic waits for the train at level crossings.
- **Cows** wander and sit on the road. They are immovable. They do not care about your horn.
- **Pedestrians** in shirts, kurtas and sarees; knock them over and witnesses call the cops.
- **Wanted system (5 stars)**: police jeeps chase and box you in. Stop near them → *PAKDE GAYE!*
  (busted, fine, respawn at the thana). Health 0 → *KHATAM!* (respawn at Sarkari Hospital).
- **11 missions** (yellow markers, press E): Chai Tapri Express, Auto Wala Duty (passenger fares),
  Dabbawala Run (bike), Police Se Bhaago (escape 3 stars), Shaadi Mein Late (race the dulha to the hall),
  Gully Cricket Six (find the ball on foot), BEST-Wala Bus Duty (stop at every bus stop),
  Nakli Maal Racket (ram 3 fake-goods trucks in a police jeep), Prasad Run (bazaar stalls → mandir),
  Horn OK Please (honk at traffic in a truck, then deliver), Marine Drive Sprint (90 km/h on the sea-face).
- **Pickups**: ₹ cash and 🥟 samosas (health). Money is saved in localStorage.
- **Audio, all synthesised live**: per-vehicle horns, engine putt-putt, two-tone siren, crash, moo,
  train horn, city ambience with distant honking, and 3 procedural radio stations
  (Dhol Dhamaka FM, Raag Rasta with tanpura/sitar/tabla, Retro Filmi).
- **Meme voices**: Hinglish lines spoken by your OS Hindi TTS voice with subtitles
  ("Arre bhai bhai bhai!", "Mamu aa gaye, bhaago!", "Ekdum jhakaas!"...), plus a 1-9 soundboard.
- **Your own meme clips**: drop files into `public/sounds/` and list them in `manifest.json`
  — see [public/sounds/README.md](public/sounds/README.md). No copyrighted clips are shipped.

## Controls

| Key | Action |
| --- | --- |
| WASD / arrows | walk / drive |
| Mouse (click to lock, or drag) | look |
| Shift | sprint |
| Space | jump / handbrake |
| F | enter / exit / hijack vehicle |
| H | horn |
| E | start mission at marker |
| R | radio station |
| 1-9, B | soundboard, show board |
| M | big map |
| C | camera distance |
| P / Esc | pause |
| N | mute |


## v4: Boats & the Arabian Sea

- **Drivable boats** with water handling (drift, carving turns, planing) that ride the visible waves:
  Koli Fishing Boat, Speedboat, Jet Ski, Coast Guard Boat and the Mayanagri Ferry (runs jetty ⇄ island).
  Fishing boats, speedboats and a jet ski roam the sea; free rides are moored at **Koliwada Jetty**.
- **Koliwada** fishing village on the beach: beached boats, bombil drying racks, nets, a long walkable jetty.
- **Kila Island** offshore: ruined fort, red-and-white lighthouse with a rotating beam at night, a dock,
  and a one-time hidden treasure (₹5,000). Plus an anchored cargo ship, MV Desi Dhow.
- **Swimming**: walk off the beach or jetty into the sea; climb back onto the jetty, island or dock.
- **Cars sink** if you drive into the sea — you bail out and swim.
- **Coast Guard**: wanted at sea brings police boats (they shoot in 18+ mode) and the helicopter.
- **Sea missions**: Machhli Express (haul nets with the fishing boat), Arabian Sea Regatta (speedboat buoy race
  around the island), and 🔞 Samundari Smuggling (ship → island fort under Coast Guard fire).
- Sea ambience near the shore, outboard/speedboat engine sounds, wake & spray, buoys, sea on the minimap and big map.

## v3: Story mode, new vehicles, stunts

- **Story: "Raju ki Kahani"** — follow the gold ★ marker. Each chapter opens with an in-engine cutscene
  (letterbox, animated actors, crane / over-the-shoulder shots, fully voiced Hindi dialogue; Enter/Space skips).
  Normal mode: 6 chapters ending in the sea-face race. 18+ mode branches into Bhau's gang storyline
  (Supari → Gang War → Bank Heist). Ending narration + credits. Progress is saved.
- **New vehicles**: Family Scooter (often with the whole family riding), Tractor, Chhota Hathi tempo,
  Ambassador (white ones are "neta ji" cars with the red beacon), E-Rickshaw, and the Bijli GT supercar (180 km/h).
- **Stunts**: real airtime physics, landing damage, rooftop landings, stunt cash for every jump, and
  6 **unique stunt jumps** (cyan diamonds) with a slow-motion cinematic camera: Beach Uchhal, Sea-face Rail Jump,
  Maidan Over the Road, Darwaza ke Beech Se (through the arch), Local Train Leap, Mandir Chowk Hop.
  A Bijli GT is parked at the south end of the beach.

## v2: GTA-style update

- **Animated 3D people & cars**: CC0 Quaternius models (poly.pizza) with walk / run / punch / shoot / death
  animations; cars, taxis and police cars are real 3D models. Autos, buses, Indian trucks and bikes stay custom.
- **Neural voice-over**: 89 voiced lines (Hindi + Indian-English) generated with Microsoft Edge neural voices
  (`hi-IN-Madhur/Swara`, `en-IN-Prabhat/Neerja`) via the free `edge-tts` tool, with different voices for
  the player, pedestrians, auto-wala, aunty, police, gangsters, radio DJs and news. Radio ducks while people talk.
- **18+ mode** (opt-in checkbox on the start screen): guns (Desi Katta, Dunali shotgun, AK), blood, lethal
  run-overs, uncensored Hinglish gaali, armed police, and 4 gangster missions (Supari, Bank Heist,
  Chawl Gang War, Smuggling). Normal mode keeps fists/lathi, lathi-charging cops and clean lines.
- **Combat**: over-the-shoulder aim with crosshair, hitscan shooting with headshots, melee, ammo, weapon cycling.
- **Police escalation**: cops on foot (lathi, or guns in 18+), police helicopter with searchlight at 4+ stars.
- **Jugaad Garage** 🔵 (repair + lose wanted level if unseen), **Hathiyar Bhandar** 🔴 (armour, weapons, ammo).
- **Monsoon rain** with thunder, wet streets, fog; **first-person view** (V); health regen; armour.
- **Cheats** (just type them): `JUGAAD`, `PAISA`, `MAMU`, `HATHIYAR`, `BARISH`, `TAMASHA`.
- Radio DJ/news breaks while driving.

### Extra controls

| Key | Action |
| --- | --- |
| Right mouse / Z | aim |
| Left mouse (pointer locked) / Ctrl / X | fire / punch |
| Q / Tab / mouse wheel | switch weapon |
| V | first-person view |

### Regenerating voices

```bash
python3 -m venv .venv-tools && .venv-tools/bin/pip install edge-tts
.venv-tools/bin/python scripts/gen_voices.py        # edit src/data/voice_lines.json first
```

`edge-tts` uses Microsoft's online Edge read-aloud service (unofficial, free). Check Microsoft's terms
before shipping the generated audio commercially.

### Credits

- Characters, cars: **Quaternius** (CC0) via poly.pizza. Files in `public/models/`.
- Voices: Microsoft Edge neural TTS via `edge-tts`.

## Code map

- `src/config.js` – world grid, districts
- `src/city.js` – procedural city, colliders, train, ground/minimap texture
- `src/models.js` – low-poly people, cows, vehicles, text signs
- `src/vehicles.js` – vehicle physics + left-hand traffic AI
- `src/people.js` – pedestrians and cows
- `src/audio.js` – synth SFX, radio, TTS voices, custom sound pack loader
- `src/lines.js` – voice lines + soundboard
- `src/missions.js` – mission definitions
- `src/hud.js` – HUD, minimap, big map
- `src/main.js` – game loop, player, police, missions, camera
- `src/assets.js` – glTF loading, skinned-mesh merging, car instancing
- `src/combat.js` / `src/player_combat.js` – weapons, armed NPCs, helicopter, hitscan, blood
- `src/systems.js` – cops on foot, garage, gun shop, cheats, regen, radio DJ
- `src/weather.js` – monsoon rain + thunder
- `src/cutscene.js` + `src/story.js` – cutscene engine and story chapters
- `src/stunts.js` – ramps, airtime/rooftop physics, unique stunt jumps
- `src/sea.js` – waves, jetty, Koliwada, Kila island, cargo ship, sea collisions
- `src/voice.js` + `src/data/voice_lines.json` – neural voice-over bank
