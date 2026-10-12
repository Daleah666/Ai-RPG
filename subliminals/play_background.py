#!/usr/bin/env python3
"""Flash MindZoom affirmation lines in a small window.

Point it at a folder of .txt files. Lines that start with # are headers
and are skipped. The window stays stopped until you press Play.

This file does not contain affirmation text. You choose the folder.
"""

from __future__ import annotations

import argparse
import random
import re
import sys
from pathlib import Path

BLOCKED = re.compile(
    r"high\s*school|highschool|childhood|underage|preteen|jailbait|\bloli\b|\bshota\b",
    re.IGNORECASE,
)

SPEEDS = {
    "flash": (90, 260),
    "soft": (700, 500),
    "read": (2200, 300),
}


def load_folder(folder: Path) -> tuple[list[tuple[str, str]], int]:
    """Return (filename, line) pairs and a count of skipped lines or files."""
    items: list[tuple[str, str]] = []
    skipped = 0
    if not folder.is_dir():
        return items, skipped
    files = sorted(p for p in folder.rglob("*.txt") if p.is_file())
    for path in files:
        if BLOCKED.search(path.name) or BLOCKED.search(str(path)):
            skipped += 1
            continue
        try:
            text = path.read_text(encoding="utf-8", errors="replace")
        except OSError:
            skipped += 1
            continue
        count = 0
        for raw in text.splitlines():
            line = raw.strip()
            if not line or line.startswith("#"):
                continue
            if BLOCKED.search(line):
                skipped += 1
                continue
            items.append((path.name, line))
            count += 1
        if count == 0:
            continue
    return items, skipped


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="Play a folder of MindZoom .txt files.")
    parser.add_argument(
        "--dir",
        dest="folder",
        default="",
        help="Folder of .txt files. If omitted, use Choose folder in the window.",
    )
    parser.add_argument(
        "--speed",
        choices=tuple(SPEEDS),
        default="soft",
        help="Starting speed. Default is soft.",
    )
    args = parser.parse_args(argv)

    try:
        import tkinter as tk
        from tkinter import filedialog
    except ImportError:
        print("This player needs tkinter, which ships with most Python installs.", file=sys.stderr)
        return 1

    root = tk.Tk()
    root.title("MindZoom background")
    root.geometry("720x280")
    root.configure(bg="#050505")

    items: list[tuple[str, str]] = []
    order: list[int] = []
    cursor = {"i": 0}
    playing = {"on": False}
    timer = {"id": None}

    line_var = tk.StringVar(value="Choose a folder, then press Play.")
    status_var = tk.StringVar(value="no folder yet")
    speed_var = tk.StringVar(value=args.speed)
    file_var = tk.StringVar(value="all")
    shuffle_var = tk.BooleanVar(value=True)
    top_var = tk.BooleanVar(value=False)

    stage = tk.Label(
        root,
        textvariable=line_var,
        bg="#050505",
        fg="#f4f4f4",
        font=("Georgia", 22),
        wraplength=640,
        justify="center",
    )
    stage.pack(expand=True, fill="both", padx=24, pady=24)

    bar = tk.Frame(root, bg="#141414")
    bar.pack(fill="x")

    file_menu = tk.OptionMenu(bar, file_var, "all")
    file_menu.configure(bg="#222222", fg="#ffffff", highlightthickness=0)

    def pool() -> list[tuple[str, str]]:
        pick = file_var.get()
        if pick == "all":
            return items
        return [item for item in items if item[0] == pick]

    def rebuild() -> None:
        current = pool()
        order.clear()
        order.extend(range(len(current)))
        if shuffle_var.get():
            random.shuffle(order)
        cursor["i"] = 0

    def cancel_timer() -> None:
        if timer["id"] is not None:
            root.after_cancel(timer["id"])
            timer["id"] = None

    def stop() -> None:
        playing["on"] = False
        cancel_timer()
        if items:
            line_var.set("Stopped.")
            status_var.set("stopped")
        else:
            line_var.set("Choose a folder, then press Play.")
            status_var.set("no folder yet")

    def show_next() -> None:
        if not playing["on"]:
            return
        current = pool()
        if not current:
            stop()
            line_var.set("That folder has no affirmation lines.")
            return
        if not order or cursor["i"] >= len(order):
            rebuild()
        name, line = current[order[cursor["i"]]]
        cursor["i"] += 1
        line_var.set(line)
        status_var.set(name)
        on_ms, off_ms = SPEEDS[speed_var.get()]

        def blank() -> None:
            if not playing["on"]:
                return
            line_var.set("")
            timer["id"] = root.after(off_ms, show_next)

        timer["id"] = root.after(on_ms, blank)

    def play() -> None:
        if not items:
            line_var.set("Choose the folder first.")
            return
        if playing["on"]:
            return
        playing["on"] = True
        rebuild()
        show_next()

    def refresh_files() -> None:
        menu = file_menu["menu"]
        menu.delete(0, "end")
        names = ["all"]
        seen = []
        for name, _line in items:
            if name not in seen:
                seen.append(name)
        names.extend(seen)
        for name in names:
            menu.add_command(label=name, command=lambda value=name: file_var.set(value))
        file_var.set("all")

    def use_folder(folder: Path) -> None:
        nonlocal items
        loaded, skipped = load_folder(folder)
        items = loaded
        refresh_files()
        skip_note = f", {skipped} skipped" if skipped else ""
        file_count = len({name for name, _line in items})
        status_var.set(f"{file_count} files, {len(items)} lines{skip_note}")
        line_var.set("Ready. Press Play." if items else "No text lines found in that folder.")
        if playing["on"]:
            rebuild()

    def choose() -> None:
        picked = filedialog.askdirectory(title="Choose the MindZoom folder")
        if picked:
            use_folder(Path(picked))

    def on_top() -> None:
        root.attributes("-topmost", bool(top_var.get()))

    def on_filter_change(*_args) -> None:
        if playing["on"]:
            rebuild()

    tk.Button(bar, text="Choose folder", command=choose, bg="#222222", fg="#ffffff").pack(side="left", padx=4, pady=8)
    tk.Button(bar, text="Play", command=play, bg="#1d4d32", fg="#ffffff").pack(side="left", padx=4, pady=8)
    tk.Button(bar, text="Stop", command=stop, bg="#6b1d1d", fg="#ffffff").pack(side="left", padx=4, pady=8)
    tk.Label(bar, text="Speed", bg="#141414", fg="#ffffff").pack(side="left", padx=(8, 2))
    speed_menu = tk.OptionMenu(bar, speed_var, *SPEEDS.keys())
    speed_menu.configure(bg="#222222", fg="#ffffff", highlightthickness=0)
    speed_menu.pack(side="left", padx=4, pady=8)
    tk.Label(bar, text="File", bg="#141414", fg="#ffffff").pack(side="left", padx=(8, 2))
    file_menu.pack(side="left", padx=4, pady=8)
    tk.Checkbutton(
        bar,
        text="Shuffle",
        variable=shuffle_var,
        bg="#141414",
        fg="#ffffff",
        selectcolor="#222222",
        command=lambda: on_filter_change(),
    ).pack(side="left", padx=4)
    tk.Checkbutton(
        bar,
        text="Stay on top",
        variable=top_var,
        bg="#141414",
        fg="#ffffff",
        selectcolor="#222222",
        command=on_top,
    ).pack(side="left", padx=4)
    tk.Label(bar, textvariable=status_var, bg="#141414", fg="#cccccc").pack(side="right", padx=8)

    file_var.trace_add("write", on_filter_change)

    if args.folder:
        use_folder(Path(args.folder))

    root.mainloop()
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
