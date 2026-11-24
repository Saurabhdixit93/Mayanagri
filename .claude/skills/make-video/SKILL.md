---
name: make-video
description: Produce "Under The Screen" YouTube videos end to end (script, fact check, animation, voice, music, captions, thumbnail, upload kit) from the content calendar or from a topic the user gives. Use for "make today's videos", "daily run", "make a short about X", "make a video on X", or the scheduled daily task.
---

# Make Under The Screen videos

Channel: **Under The Screen**, handle **@UnderTheScreenHQ** (always write the handle exactly like this, with HQ, in on-screen text, descriptions and pills). Faceless animated explainers on how everyday tech works, in English, for viewers in the US, UK, Canada and Australia. The creator lives in India, so all times are IST.

Everything lives in `youtube_channel/`:
- `calendar.json`: what to publish and when (`status`: todo, made, uploaded)
- `engine/`: the renderer. `engine/make.sh <dir> preview|full` runs the pipeline. `engine/TEMPLATES.md` is the scene reference: **read it before writing a script.**
- `videos/<publish-date>-<long|short>-<slug>/`: one folder per video (`script.json` → `out/`)
- `video01/`: the first video, made before the engine. Use it as the quality reference.

## 0. Decide what to make
- **Daily run** (no topic given): today = `date +%F`. Make every calendar item with `status: "todo"` where
  - `type: "short"` and `publish == today`, plus any short with `publish < today` that is still todo
  - `type: "long"` and `publish == tomorrow` (long videos are made a day early so there's time to review)
- **Topic given** ("make a short about X"): make that one. Add it to the calendar on the next free date, or the date the user names.
- If fewer than 7 todo items remain, extend the calendar 2 weeks with new topics in the same niche. Keep the rhythm of long videos on Wed and Sat plus 1 Short a day, and make most Shorts come from the long videos.

## 1. Write the script (`script.json`)
Research first. Use WebSearch to check **every number and surprising claim**. Prefer conservative, rounded figures ("over 500 cables", "about a tenth of a second"). Never invent statistics. If something can't be verified, cut it.

**Short** (`format: "short"`): 70–110 spoken words, 25–45 seconds, 4–6 scenes.
- First sentence = the hook: a surprising claim, under 2 seconds to say.
- One idea only. Every 4–7 seconds something new appears on screen.
- `headline`: 3–7 words + 1 emoji, the same promise as the hook.
- End with a line that loops back into the start, or "Follow for more …" (a `bigtext` pill scene).
- Don't use `step`, `chapter`, `title`, `recap` or `outro`.

**Long** (`format: "long"`): 1,200–1,500 spoken words, **8–10 minutes** (8+ minutes unlocks mid-roll ads), 14–24 scenes.
- Hook (0–20 s): a `browser`, `bigtext` or `burst` scene with a concrete "you" moment plus a promise.
- `title` scene: the headline, the number of steps, and an open loop ("stick around for step 4, because…").
- Body: 4–7 steps. The first scene of each step has `step`, `stepIntro: true` and a `chapter`. Change visuals every 15–25 seconds: alternate templates and don't use the same template twice in a row.
- A pattern interrupt every 60–90 seconds (a surprising fact via `stat` or `bigtext` slam).
- `recap` scene, then an `outro` that teases the **next long video in the calendar**.
- `thumb`: line1 + line2 together max 5 words, an emoji, and two side emojis. Use curiosity, not lies.
- Speakable text only: write numbers as words when they're cues, no URLs read aloud, no emoji in `text`.

Quality and policy (YouTube "inauthentic content" rules): every video must teach something specific and correct. Don't reuse old scripts. Vary the seed, the hook style and the templates. No misleading titles or thumbnails. Never imitate real people or brands' logos.

## 2. Preview and fix
```bash
youtube_channel/engine/make.sh youtube_channel/videos/<dir> preview
```
- Fix any `MISSING CUES` printed (the cue word isn't in that scene's text).
- **Read `out/preview_sheet.png`** (2 frames per scene, in order). Check for overlapping or cut-off text, empty-looking scenes, and content hidden behind captions. Fix `data` (shorter labels, fewer items) and preview again. Repeat until it's clean.

## 3. Full render
```bash
youtube_channel/engine/make.sh youtube_channel/videos/<dir> full
```
Run it in the background for long videos (about 15 minutes). Output: `out/<dir>.mp4`, `out/captions_en.srt`, `out/chapters.txt`, and `out/thumbnail_1280x720.png` for long videos. Read the thumbnail and one or two frames from the MP4 to confirm.

## 4. Upload kit (`out/UPLOAD.md`)
- Title: max 60 characters, curiosity plus a clear topic. Shorts end with `#shorts`.
- Description: 2–3 line hook, chapters (long: paste `out/chapters.txt`), a comment question, "New explainers every Wed & Sat, subscribe @UnderTheScreenHQ", and 3 hashtags.
- Tags: 10–15 search phrases.
- Settings: Not made for kids · Altered/synthetic content **No** (animation + narration) · Category Science & Technology · English · subtitles = `captions_en.srt` (long).
- **Schedule:** long videos **8:30 PM IST** on the publish date, Shorts **9:30 PM IST** (from 14 Mar to 6 Nov use 7:30 PM and 8:30 PM IST, because of US daylight saving).
- Pinned comment (a question or quiz). For Shorts, a "Related video" suggestion (the matching long video).

## 5. Book-keeping
- Set the calendar item to `"status": "made", "dir": "<dir>"`.
- Rewrite `youtube_channel/TODAY.md`: a table of everything ready but not yet uploaded (publish date, time IST, type, title, path to MP4 and UPLOAD.md), newest first.
- If PushNotification is available, send one short line: "🎬 Ready: <titles>. Upload by <time> IST."

## Notes
- Voice: free Edge neural voice (`en-US-AndrewNeural`). Before the channel applies for monetization, switch to a commercially licensed voice (ElevenLabs paid plan or the creator's own recording). Set `"voice"` in script.json, or replace `engine/tts.py`.
- Uploading stays manual. The YouTube API only allows public uploads from audited apps, and a 5-minute human check before each upload protects the channel.
- If TTS fails with "No audio was received", just re-run `make.sh`. It retries and reuses finished clips.
