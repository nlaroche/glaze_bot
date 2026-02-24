"""Floating control window + global hotkeys."""

import json
import os
import threading
import tkinter as tk
from tkinter import ttk, scrolledtext
from pathlib import Path

import keyboard


def load_characters() -> list[dict]:
    """Load all character JSON files from characters/ directory."""
    chars = []
    char_dir = Path(__file__).parent / "characters"
    if char_dir.exists():
        for f in sorted(char_dir.glob("*.json")):
            try:
                with open(f) as fh:
                    chars.append(json.load(fh))
            except Exception as e:
                print(f"[ui] Failed to load {f}: {e}")
    return chars


class TrayApp:
    def __init__(self, app_state: dict):
        self.state = app_state
        self._root = None
        self._char_var = None
        self._mic_var = None
        self._interval_var = None
        self._cost_var = None
        self._status_var = None
        self._log_text = None
        self._max_log_lines = 50

    def _toggle_pause(self, *_):
        self.state["paused"] = not self.state["paused"]
        self._update_status()

    def _set_character(self, *_):
        name = self._char_var.get()
        for c in self.state["characters"]:
            if c["name"] == name:
                self.state["character"] = c
                if self.state.get("brain"):
                    self.state["brain"].set_character(c["system_prompt"])
                if self.state.get("voice"):
                    self.state["voice"].set_voice(c["voice"])
                self._log(f"Switched to {name}")
                break

    def _set_mic(self, *_):
        mode = self._mic_var.get()
        self.state["mic_mode"] = mode
        mic = self.state.get("mic")
        if mic:
            mic.mode = mode
        self._log(f"Mic: {mode}")

    def _set_interval(self, *_):
        val = float(self._interval_var.get().split("s")[0])
        self.state["interval"] = val
        capture = self.state.get("capture")
        if capture:
            capture.interval = val
        self._log(f"Interval: {val}s")

    def _force_comment(self):
        cb = self.state.get("on_force_comment")
        if cb:
            cb()
        self._log("Forced comment")

    def _quit(self):
        on_quit = self.state.get("on_quit")
        if on_quit:
            on_quit()
        if self._root:
            self._root.destroy()

    def _cycle_mic(self):
        modes = ["always_on", "push_to_talk", "off"]
        cur = self.state["mic_mode"]
        idx = (modes.index(cur) + 1) % len(modes)
        self.state["mic_mode"] = modes[idx]
        mic = self.state.get("mic")
        if mic:
            mic.mode = modes[idx]
        if self._mic_var and self._root:
            self._root.after(0, lambda: self._mic_var.set(modes[idx]))
        self._log(f"Mic: {modes[idx]}")

    def _next_character(self):
        chars = self.state["characters"]
        if not chars:
            return
        cur_name = self.state["character"]["name"]
        names = [c["name"] for c in chars]
        idx = (names.index(cur_name) + 1) % len(chars)
        self.state["character"] = chars[idx]
        if self.state.get("brain"):
            self.state["brain"].set_character(chars[idx]["system_prompt"])
        if self.state.get("voice"):
            self.state["voice"].set_voice(chars[idx]["voice"])
        if self._char_var and self._root:
            self._root.after(0, lambda: self._char_var.set(chars[idx]["name"]))
        self._log(f"Switched to {chars[idx]['name']}")

    def _update_status(self):
        if not self._status_var:
            return
        if self.state["paused"]:
            self._status_var.set("PAUSED")
        else:
            self._status_var.set("ACTIVE")

    def _log(self, text: str):
        """Add a line to the log. Thread-safe."""
        if not self._log_text or not self._root:
            return
        # Safe for Windows console
        safe = text.encode("ascii", "replace").decode()

        def _append():
            self._log_text.configure(state="normal")
            self._log_text.insert("end", safe + "\n")
            # Trim old lines
            lines = int(self._log_text.index("end-1c").split(".")[0])
            if lines > self._max_log_lines:
                self._log_text.delete("1.0", f"{lines - self._max_log_lines}.0")
            self._log_text.see("end")
            self._log_text.configure(state="disabled")

        self._root.after(0, _append)

    def update_cost(self):
        """Called periodically to refresh cost display."""
        if not self._root:
            return
        brain = self.state.get("brain")
        if brain:
            self._cost_var.set(f"${brain.estimated_cost():.4f} | {brain.total_calls} calls")
        self._root.after(3000, self.update_cost)

    def set_last_message(self, name: str, text: str):
        """Log a bot message."""
        self._log(f"[{name}] {text}")

    def log_player(self, text: str):
        """Log what the player said."""
        self._log(f"[You] {text}")

    def log_system(self, text: str):
        """Log a system message."""
        self._log(f"[sys] {text}")

    def _register_hotkeys(self):
        ptt_key = os.getenv("PTT_KEY", "v")
        keyboard.on_press_key("f7", lambda _: self._cycle_mic(), suppress=False)
        keyboard.on_press_key("f8", lambda _: self._toggle_pause(), suppress=False)
        keyboard.on_press_key("f9", lambda _: self._next_character(), suppress=False)
        keyboard.on_press_key("f10", lambda _: self._force_comment(), suppress=False)
        keyboard.on_press_key("f12", lambda _: self._quit(), suppress=False)

        mic = self.state.get("mic")
        if mic:
            keyboard.on_press_key(ptt_key, lambda _: mic.set_ptt(True), suppress=False)
            keyboard.on_release_key(ptt_key, lambda _: mic.set_ptt(False), suppress=False)

    def run(self):
        """Build and run the control window (blocking)."""
        self._register_hotkeys()

        root = tk.Tk()
        self._root = root
        root.title("Glaze Bot")
        root.attributes("-topmost", True)
        root.resizable(True, True)
        root.geometry("420x500")
        root.protocol("WM_DELETE_WINDOW", self._quit)

        # Dark theme
        bg = "#1e1e2e"
        fg = "#cdd6f4"
        accent = "#89b4fa"
        log_bg = "#11111b"
        log_fg = "#a6adc8"
        root.configure(bg=bg)

        style = ttk.Style()
        style.theme_use("clam")
        style.configure("TLabel", background=bg, foreground=fg, font=("Segoe UI", 10))
        style.configure("TButton", font=("Segoe UI", 9))
        style.configure("TCombobox", font=("Segoe UI", 10))
        style.configure("Header.TLabel", background=bg, foreground=accent, font=("Segoe UI", 14, "bold"))
        style.configure("Status.TLabel", background=bg, foreground="#a6e3a1", font=("Segoe UI", 10, "bold"))
        style.configure("Cost.TLabel", background=bg, foreground="#f9e2af", font=("Segoe UI", 9))
        style.configure("Hint.TLabel", background=bg, foreground="#585b70", font=("Segoe UI", 8))

        pad = {"padx": 8, "pady": 3}

        # Header row
        header_frame = tk.Frame(root, bg=bg)
        header_frame.pack(fill="x", padx=8, pady=(8, 4))
        ttk.Label(header_frame, text="Glaze Bot", style="Header.TLabel").pack(side="left")
        self._status_var = tk.StringVar(value="ACTIVE")
        ttk.Label(header_frame, textvariable=self._status_var, style="Status.TLabel").pack(side="right")

        # Controls frame
        ctrl = tk.Frame(root, bg=bg)
        ctrl.pack(fill="x", padx=8, pady=4)

        # Character
        ttk.Label(ctrl, text="Character:").grid(row=0, column=0, sticky="w", **pad)
        char_names = [c["name"] for c in self.state["characters"]]
        self._char_var = tk.StringVar(value=self.state["character"]["name"])
        char_combo = ttk.Combobox(ctrl, textvariable=self._char_var, values=char_names, state="readonly", width=16)
        char_combo.grid(row=0, column=1, sticky="ew", **pad)
        char_combo.bind("<<ComboboxSelected>>", self._set_character)

        # Mic mode
        ttk.Label(ctrl, text="Mic:").grid(row=1, column=0, sticky="w", **pad)
        self._mic_var = tk.StringVar(value=self.state["mic_mode"])
        mic_combo = ttk.Combobox(ctrl, textvariable=self._mic_var, values=["always_on", "push_to_talk", "off"], state="readonly", width=16)
        mic_combo.grid(row=1, column=1, sticky="ew", **pad)
        mic_combo.bind("<<ComboboxSelected>>", self._set_mic)

        # Interval
        ttk.Label(ctrl, text="Interval:").grid(row=2, column=0, sticky="w", **pad)
        intervals = ["1.0s", "1.5s", "3.0s", "5.0s"]
        self._interval_var = tk.StringVar(value=f"{self.state['interval']}s")
        int_combo = ttk.Combobox(ctrl, textvariable=self._interval_var, values=intervals, state="readonly", width=16)
        int_combo.grid(row=2, column=1, sticky="ew", **pad)
        int_combo.bind("<<ComboboxSelected>>", self._set_interval)

        ctrl.columnconfigure(1, weight=1)

        # Cost + buttons row
        action_frame = tk.Frame(root, bg=bg)
        action_frame.pack(fill="x", padx=8, pady=4)
        self._cost_var = tk.StringVar(value="$0.0000 | 0 calls")
        ttk.Label(action_frame, textvariable=self._cost_var, style="Cost.TLabel").pack(side="left")
        ttk.Button(action_frame, text="Quit", command=self._quit).pack(side="right", padx=2)
        ttk.Button(action_frame, text="Force", command=self._force_comment).pack(side="right", padx=2)
        ttk.Button(action_frame, text="Pause", command=self._toggle_pause).pack(side="right", padx=2)

        # Log area
        log_frame = tk.Frame(root, bg=bg)
        log_frame.pack(fill="both", expand=True, padx=8, pady=(4, 4))

        self._log_text = scrolledtext.ScrolledText(
            log_frame,
            bg=log_bg,
            fg=log_fg,
            font=("Consolas", 9),
            wrap="word",
            state="disabled",
            borderwidth=1,
            relief="solid",
            insertbackground=fg,
        )
        self._log_text.pack(fill="both", expand=True)

        # Hotkey hints
        ttk.Label(root, text="F7:Mic  F8:Pause  F9:Char  F10:Force  F12:Quit  V:PTT", style="Hint.TLabel").pack(pady=(0, 6))

        # Init log
        self._log("Glaze Bot started")
        self._log(f"Character: {self.state['character']['name']}")
        self._log(f"Mic: {self.state['mic_mode']}")

        # Start cost updater
        self.update_cost()

        root.mainloop()

    def stop(self):
        if self._root:
            try:
                self._root.destroy()
            except Exception:
                pass
