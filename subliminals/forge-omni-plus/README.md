# Forge Omni Plus

Subliminal Forge (Oct) and Subliminal Forge Omni (Nov) merged into one page.

- Live artifact: https://claude.ai/artifact/5aCzEw6Czgh3dTEyEanv87
- Originals (left untouched): Forge https://claude.ai/artifact/AQVkf2oF7NWqWhtWML3h4D · Omni https://claude.ai/artifact/1d4uFwqckawuYiR9ooLweS

## What's in it

- **Omni, unchanged:** Lines (with `@layer` and `@set` tags), packs and looks, Messages chat, sound, saved tracks, playlist, Map + Hypno, WAV export, the `window.SubliminalOmni` API.
- **Visuals tab (from Forge):** image-folder programs as slideshow, cards or quick flash, captions from your Omni lines or your own list, a weekly or by-date schedule, "now and then" bursts, Auto mode, full screen, an optional spoken phrase now and then, and an editable "AI instructions for visuals" with Make AI do it.
- **Nova (from Forge):** a draggable companion with chat, saved notes and a custom image and persona. Nova's tools call Omni's API, so she can edit the track (through Omni's own AI), add lines, play and stop the audio and the visuals, and switch views.

## Files

- `originals/forge.html`, `originals/omni.html`: the two source artifacts as published.
- `plus/`: the add-on (head.js, visual-port.js, tail.js, the markup and the CSS).
- `build.py`: writes `index.html` = Omni + the add-on. Omni's own code is never edited.

Rebuild with `python3 build.py`, then republish `index.html` to the artifact URL above.
