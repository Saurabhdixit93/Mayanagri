"""Generate neural voice-over MP3s for every line in src/data/voice_lines.json.

Usage:
    python3 -m venv .venv-tools && .venv-tools/bin/pip install edge-tts
    .venv-tools/bin/python scripts/gen_voices.py          # only missing / changed lines
    .venv-tools/bin/python scripts/gen_voices.py --force  # regenerate everything

Uses Microsoft Edge's online neural voices through the free `edge-tts` package.
"""
import asyncio
import hashlib
import json
import sys
from pathlib import Path

import edge_tts

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / "src" / "data" / "voice_lines.json"
OUT = ROOT / "public" / "voices"
STAMP = OUT / ".hashes.json"


async def render(line, spk, sem, hashes, force):
    out = OUT / f"{line['id']}.mp3"
    h = hashlib.sha1(json.dumps([line["say"], spk], sort_keys=True).encode()).hexdigest()
    if not force and out.exists() and hashes.get(line["id"]) == h:
        return "skip"
    async with sem:
        for attempt in range(3):
            try:
                comm = edge_tts.Communicate(line["say"], spk["voice"], rate=spk.get("rate", "+0%"), pitch=spk.get("pitch", "+0Hz"))
                await comm.save(str(out))
                hashes[line["id"]] = h
                return "ok"
            except Exception as e:  # network hiccups
                if attempt == 2:
                    print(f"FAILED {line['id']}: {e}")
                    return "fail"
                await asyncio.sleep(1.5)


async def main():
    force = "--force" in sys.argv
    data = json.loads(SRC.read_text())
    OUT.mkdir(parents=True, exist_ok=True)
    hashes = json.loads(STAMP.read_text()) if STAMP.exists() else {}
    sem = asyncio.Semaphore(6)
    results = await asyncio.gather(*[render(l, data["speakers"][l["spk"]], sem, hashes, force) for l in data["lines"]])
    STAMP.write_text(json.dumps(hashes, indent=1))
    print({r: results.count(r) for r in set(results)})


asyncio.run(main())
