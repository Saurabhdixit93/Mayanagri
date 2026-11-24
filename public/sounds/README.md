# Custom meme sound pack

The game ships with **no copyrighted audio**. Every horn, engine, siren, radio song and
voice line is generated live (WebAudio synth + your OS Hindi text-to-speech voice).

To use your own meme clips (that you have the right to use):

1. Copy the files into this folder, e.g. `public/sounds/bhai.mp3`.
2. List them in `manifest.json`:

```json
{
  "events": {
    "crash": ["bhai.mp3", "another.mp3"],
    "wanted": ["police_aa_gayi.mp3"],
    "missionDone": ["party.mp3"]
  },
  "soundboard": [
    { "key": "1", "file": "bhai.mp3", "label": "Bhai bhai" },
    { "key": "2", "file": "party.mp3", "label": "Party" }
  ]
}
```

3. Reload the page. A listed event plays a random clip from its list instead of the TTS line.
   Soundboard keys 1-9 play your clips (press **B** in game to see the board).

Event names: `crash`, `crash_sfx` (replaces the crash bang), `hitPed`, `hijack`, `wanted`,
`moreWanted`, `lostWanted`, `busted`, `dead`, `missionDone`, `missionFail`, `cow`, `blocked`,
`money`, `pickup`, `train`, `welcome`, `passenger`.
