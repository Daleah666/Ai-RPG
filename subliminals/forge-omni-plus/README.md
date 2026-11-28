# Forge Omni Plus

Subliminal Forge (Oct) and Subliminal Forge Omni (Nov) merged into one page.

- Live artifact: https://claude.ai/artifact/5aCzEw6Czgh3dTEyEanv87
- Originals (left untouched): Forge https://claude.ai/artifact/AQVkf2oF7NWqWhtWML3h4D · Omni https://claude.ai/artifact/1d4uFwqckawuYiR9ooLweS

## What's in it

- **Omni, unchanged:** Lines (with `@layer` and `@set` tags), packs and looks, Messages chat, sound, saved tracks, playlist, Map + Hypno, WAV export, the `window.SubliminalOmni` API.
- **Visuals tab (from Forge):** image-folder programs as slideshow, cards or quick flash, captions from your Omni lines or your own list, a weekly or by-date schedule, "now and then" bursts, Auto mode, full screen, an optional spoken phrase now and then, and an editable "AI instructions for visuals" with Make AI do it.
- **Nova (from Forge):** a draggable companion with chat, saved notes and a custom image and persona. Nova's tools call Omni's API, so she can edit the track (through Omni's own AI), add lines, play and stop the audio and the visuals, and switch views.

## Also

- **On the side / Pop out**: visuals keep flashing in a small corner window, or a floating window over other apps.
- **Play with the audio** and **one-click packs** (Feminine, Bimbo, Trance, Submission).
- **Images are remembered** on this computer (IndexedDB), so folders survive a reload.
- **Keys**: V visuals on/off, S side window, F full screen; Omni's own keys still work.

## Nova

- Her portrait is Bambi's expression set from desktop-companion (`characters/companion/`), copied and shrunk to `nova/*.webp`. The originals are untouched.
- She sits in a side panel on a slow hypno spiral: breathing and swaying at rest, cycling expressions while she talks, a thinking face while she waits. Tap her for a reaction.
- Optional: "Read her replies out loud" in her settings.
- Her tools reach the whole studio: lines (via Omni's AI), look, volume, session length, packs, saved tracks, playlist, WAV save, visual programs, Auto mode, play-with-audio, the side window and the views. She picks her own face with `set_expression`.
- Publish the `nova/` folder with the page (`files`), next to `index.html`.

## Nova's brain (she keeps getting better)

The 🧠 tab in Nova's window holds what she knows about you. It lives in this browser.

- **She learns as you chat.** Tell her a preference, a goal or a word you love or hate, and she keeps it with `remember`. Nothing to set up.
- **She learns from what you do.** She counts the packs you pick, when and how long you play, the visual programs you run and when you turn on max strength.
- **She reads your other agents.**
  - *Front Stage*: open the studio from the 🌀 Forge tab on your new tab and she reads the girl on stage there (her card, her memories, and your plans if you let her see them). She can `ask_agent` her a question and `tell_agent` her a note, which lands in that girl's memories.
  - *Project notes*: on the claude.ai page, press **Read** and she reads the `forge-brain/` folder of the "subliminal" project. Any Claude thread can leave her a note there. Her chat also gets the project file tools.
  - *Anything else*: paste what Grok, ChatGPT or Cursor said into **Absorb** and she keeps only what's about you.
- **She thinks it over.** **Reflect now** rewrites her summary of you and drops repeats. She also does it by herself after a chat once 8 new things have piled up. The visuals AI reads that summary too.

You can pin, forget or teach her facts by hand on the same tab.

## 🌙 Tonight's sub

The moon tab in Nova's window. Every evening (after 19:00 by default, you can change the hour) Nova makes a sub just for tonight from her brain: a name, why she picked it, the look, the length, lines for all three layers, phrases for the visuals and a short spoken script.

- **▶ Play tonight** loads it into the studio and plays it. **Load only** loads without playing.
- **🌀 Trance with Nova** is hands-free: a full-screen spiral, Nova's voice talks you down (induction and deepener), the sub plays underneath, she says an affirmation about every 45 seconds, and she wakes you up at the end. Esc, Space or **Wake me up** brings you out any time.
- **💖 More like this** teaches her your taste and makes a sister sub right away. **🙅 Less like this** steers her away.
- **🔥 Streak and XP.** Playing tonight's sub for a few minutes keeps your streak. Nights in a row give more XP, and XP levels you up.

On Front Stage the 🌀 Forge tab glows gold and says *Tonight's sub* when one is waiting.

## 🔞 Adult mode

Off by default, a switch in Nova's ⚙ settings (or 🔌 on Front Stage). For adults only. When it's on, the 🔞 Adult pack shows up and Nova and tonight's sub may write explicit lines between consenting adults. Nothing about race or ethnicity, ever. How far it goes depends on the brain: Claude often declines explicit lines, and Nova says so in one plain line instead of going quiet. A local model through Front Stage (Ollama, LM Studio or your own server) usually won't decline.

## When something fails

Nova and every AI button now show the actual reason (a bad key, a timeout, Claude declining, a server that's down) instead of going silent.

## Inside Front Stage

`python3 build.py --ext ../../../desktop-companion/front-stage/forge` writes a copy for the Front Stage extension. Chrome extension pages can't run inline scripts or load from a CDN, so that copy splits each script into its own file and takes sam-js from `vendor/`. Front Stage hands the studio its brain through `window.__hubClaude`, the same line My Hub uses, so Omni needed no changes.

## Files

- `originals/forge.html`, `originals/omni.html`: the two source artifacts as published.
- `plus/`: the add-on (head.js, visual-port.js, brain.js, tonight.js, tail.js, the markup and the CSS).
- `vendor/samjs.min.js`: sam-js 0.3.1 from npm, for the extension copy only.
- `build.py`: writes `index.html` = Omni + the add-on. Omni's own code is never edited.

Rebuild with `python3 build.py`, then republish `index.html` to the artifact URL above.
