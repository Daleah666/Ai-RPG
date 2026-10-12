# subliminals/

Source of truth for all subliminal .txt files. Written by the daily planner bot and the maker bot. One file per day, named YYYY-MM-DD_Theme.txt.

See skills/daily-subliminal-planner-bot.md and skills/subliminal-maker-bot.md.

## Background player

Two local players read a folder of MindZoom `.txt` files and flash one line at a time. They start stopped. Press Play when you want them on. Lines that start with `#` are headers and are skipped.

- Browser: open `background-player.html`, choose the folder, press Play. A folder picker works best in Chrome or Edge.
- Desktop: `python3 subliminals/play_background.py --dir /path/to/your/folder`

Speeds:

- Subliminal flash: line shows for a short moment, then the screen goes blank.
- Soft background: the default. Easier to leave running.
- Readable: long enough to read each line.

Shuffle starts on. The desktop window has a "stay on top" checkbox that starts off. A browser page cannot force itself above other windows.

The players do not include any affirmation text. Keep the library in the folder you choose. A line or filename is skipped when it matches a small safety list (high school, childhood, underage, and similar words).
