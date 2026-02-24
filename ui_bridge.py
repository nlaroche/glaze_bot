"""Pywebview JS-Python bridge for the Svelte UI."""

import json
import os
import threading
import time
from pathlib import Path

import keyboard

PARTIES_FILE = Path(__file__).parent / "parties.json"
SETTINGS_FILE = Path(__file__).parent / "settings.json"

DEFAULT_SETTINGS = {
    "min_gap": 30,
    "interval": 1.5,
    "mic_mode": "always_on",
    "interaction_mode": True,
    "interaction_chance": 0.25,
    "ai_provider": "dashscope",
    "vision_model": "qwen3-vl-flash",
    "capture_scale": 0.5,
    "capture_quality": 70,
    "game_hint": "",
    "capture_source_type": None,
    "capture_source_id": 0,
    "capture_source_name": "",
}


def load_characters() -> list[dict]:
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


def _load_json(path: Path, default: dict) -> dict:
    if path.exists():
        try:
            with open(path) as f:
                return json.load(f)
        except Exception:
            pass
    return default


def _save_json(path: Path, data: dict):
    with open(path, "w") as f:
        json.dump(data, f, indent=2)


class UiBridge:
    def __init__(self, app_state: dict):
        self.state = app_state
        self._window = None
        self._log_buffer: list[dict] = []
        self._log_lock = threading.Lock()
        self._max_buffer = 200
        self._last_speaker = ""
        self._last_speaker_time = 0.0

        self._restore_settings()
        self._restore_last_party()

    def _restore_settings(self):
        saved = _load_json(SETTINGS_FILE, {})
        for key in DEFAULT_SETTINGS:
            if key in saved and key in self.state:
                self.state[key] = saved[key]
            elif key in saved:
                self.state[key] = saved[key]
        # Also apply to modules
        if "interval" in saved:
            cap = self.state.get("capture")
            if cap:
                cap.interval = saved["interval"]
            self.state["interval"] = saved["interval"]
        if "capture_scale" in saved:
            cap = self.state.get("capture")
            if cap:
                cap.scale = saved["capture_scale"]
            self.state["capture_scale"] = saved["capture_scale"]
        if "capture_quality" in saved:
            cap = self.state.get("capture")
            if cap:
                cap.quality = saved["capture_quality"]
            self.state["capture_quality"] = saved["capture_quality"]
        if "ai_provider" in saved:
            brain = self.state.get("brain")
            if brain:
                brain.provider = saved["ai_provider"]
            self.state["ai_provider"] = saved["ai_provider"]
        if "vision_model" in saved:
            brain = self.state.get("brain")
            if brain:
                brain.model = saved["vision_model"]
            self.state["vision_model"] = saved["vision_model"]
        # Restore capture source
        src_type = saved.get("capture_source_type")
        src_id = saved.get("capture_source_id", 0)
        src_name = saved.get("capture_source_name", "")
        if src_type == "window":
            # Validate HWND still exists
            try:
                import win32gui
                if not win32gui.IsWindow(src_id):
                    src_type = None
                    src_id = 0
                    src_name = ""
            except Exception:
                src_type = None
                src_id = 0
                src_name = ""
        if src_type:
            self.state["capture_source_type"] = src_type
            self.state["capture_source_id"] = src_id
            self.state["capture_source_name"] = src_name
            cap = self.state.get("capture")
            if cap:
                cap.set_source(src_type, src_id, src_name)

    def _restore_last_party(self):
        data = _load_json(PARTIES_FILE, {"parties": {}, "last_party": None})
        last = data.get("last_party")
        if last and last in data.get("parties", {}):
            entry = data["parties"][last]
            # Backward compat: old format is a plain list of names
            if isinstance(entry, list):
                names = entry
                personalities = {}
            else:
                names = entry.get("members", [])
                personalities = entry.get("personalities", {})
            restored = [c for c in self.state["characters"] if c["name"] in names]
            if restored:
                # Apply saved personalities
                for c in restored:
                    if c["name"] in personalities:
                        c["personality"] = personalities[c["name"]]
                self.state["active_characters"][:] = restored
                print(f"[ui] Restored party '{last}'", flush=True)

    def _persist_settings(self):
        _save_json(SETTINGS_FILE, {
            "min_gap": self.state.get("min_gap", 12),
            "interval": self.state.get("interval", 1.5),
            "mic_mode": self.state.get("mic_mode", "always_on"),
            "interaction_mode": self.state.get("interaction_mode", True),
            "interaction_chance": self.state.get("interaction_chance", 0.25),
            "ai_provider": self.state.get("ai_provider", "dashscope"),
            "vision_model": self.state.get("vision_model", "qwen3-vl-flash"),
            "capture_scale": self.state.get("capture_scale", 0.5),
            "capture_quality": self.state.get("capture_quality", 70),
            "game_hint": self.state.get("game_hint", ""),
            "capture_source_type": self.state.get("capture_source_type"),
            "capture_source_id": self.state.get("capture_source_id", 0),
            "capture_source_name": self.state.get("capture_source_name", ""),
        })

    # ── API ──

    def get_initial_state(self) -> dict:
        chars = [{"name": c["name"], "description": c.get("description", ""), "voice": c.get("voice", ""),
                  "personality": c.get("personality")}
                 for c in self.state["characters"]]
        active_names = [c["name"] for c in self.state["active_characters"]]
        return {
            "characters": chars,
            "active_characters": active_names,
            "paused": self.state["paused"],
            "mic_mode": self.state["mic_mode"],
            "interval": self.state["interval"],
            "interaction_mode": self.state.get("interaction_mode", True),
            "interaction_chance": self.state.get("interaction_chance", 0.25),
            "min_gap": self.state.get("min_gap", 12),
            "parties": _load_json(PARTIES_FILE, {}).get("parties", {}),
            "ai_provider": self.state.get("ai_provider", "dashscope"),
            "vision_model": self.state.get("vision_model", "qwen3-vl-flash"),
            "capture_scale": self.state.get("capture_scale", 0.5),
            "capture_quality": self.state.get("capture_quality", 70),
            "game_hint": self.state.get("game_hint", ""),
            "capture_source_type": self.state.get("capture_source_type"),
            "capture_source_name": self.state.get("capture_source_name", ""),
        }

    def get_character_details(self, name: str) -> dict:
        char = next((c for c in self.state["characters"] if c["name"] == name), None)
        if not char:
            return {"ok": False}
        return {
            "ok": True,
            "name": char["name"],
            "description": char.get("description", ""),
            "personality": char.get("personality"),
        }

    def update_character_personality(self, name: str, personality: dict) -> dict:
        char = next((c for c in self.state["characters"] if c["name"] == name), None)
        if not char:
            return {"ok": False}
        # Validate and clamp values
        valid_keys = {"energy", "positivity", "formality", "talkativeness", "attitude", "humor"}
        cleaned = {}
        for k in valid_keys:
            cleaned[k] = max(0, min(100, int(float(personality.get(k, 50)))))
        char["personality"] = cleaned
        # Persist to character JSON file
        char_dir = Path(__file__).parent / "characters"
        slug = name.lower().replace(" ", "_").replace("the_", "")
        for f in char_dir.glob("*.json"):
            try:
                with open(f) as fh:
                    data = json.load(fh)
                if data.get("name") == name:
                    data["personality"] = cleaned
                    _save_json(f, data)
                    break
            except Exception:
                continue
        self.push_log("sys", f"Updated {name}'s personality")
        return {"ok": True, "personality": cleaned}

    def toggle_character(self, name: str) -> dict:
        all_chars = self.state["characters"]
        active = self.state["active_characters"]
        char = next((c for c in all_chars if c["name"] == name), None)
        if not char:
            return {"ok": False}
        if char in active:
            if len(active) <= 1:
                return {"ok": False, "error": "Need at least one"}
            active.remove(char)
            self.push_log("sys", f"{name} removed")
        else:
            active.append(char)
            self.push_log("sys", f"{name} added")
        return {"ok": True, "active": [c["name"] for c in active]}

    def save_party(self, party_name: str) -> dict:
        active = self.state["active_characters"]
        names = [c["name"] for c in active]
        personalities = {}
        for c in active:
            if c.get("personality"):
                personalities[c["name"]] = c["personality"]
        data = _load_json(PARTIES_FILE, {"parties": {}, "last_party": None})
        data["parties"][party_name] = {"members": names, "personalities": personalities}
        data["last_party"] = party_name
        _save_json(PARTIES_FILE, data)
        self.push_log("sys", f"Saved party '{party_name}'")
        return {"ok": True, "parties": data["parties"]}

    def load_party(self, party_name: str) -> dict:
        data = _load_json(PARTIES_FILE, {"parties": {}, "last_party": None})
        entry = data.get("parties", {}).get(party_name)
        if not entry:
            return {"ok": False}
        # Backward compat: old format is a plain list
        if isinstance(entry, list):
            names = entry
            personalities = {}
        else:
            names = entry.get("members", [])
            personalities = entry.get("personalities", {})
        restored = [c for c in self.state["characters"] if c["name"] in names]
        if not restored:
            return {"ok": False}
        # Apply saved personalities onto in-memory character dicts
        for c in restored:
            if c["name"] in personalities:
                c["personality"] = personalities[c["name"]]
        self.state["active_characters"][:] = restored
        data["last_party"] = party_name
        _save_json(PARTIES_FILE, data)
        self.push_log("sys", f"Loaded party '{party_name}'")
        return {"ok": True, "active": [c["name"] for c in restored], "personalities": personalities}

    def delete_party(self, party_name: str) -> dict:
        data = _load_json(PARTIES_FILE, {"parties": {}, "last_party": None})
        data["parties"].pop(party_name, None)
        if data.get("last_party") == party_name:
            data["last_party"] = None
        _save_json(PARTIES_FILE, data)
        return {"ok": True, "parties": data["parties"]}

    def update_settings(self, settings: dict) -> dict:
        """Update multiple settings at once."""
        if "min_gap" in settings:
            self.state["min_gap"] = max(10, min(120, float(settings["min_gap"])))
        if "interval" in settings:
            val = max(0.5, min(10, float(settings["interval"])))
            self.state["interval"] = val
            cap = self.state.get("capture")
            if cap:
                cap.interval = val
        if "mic_mode" in settings and settings["mic_mode"] in ("always_on", "push_to_talk", "off"):
            self.state["mic_mode"] = settings["mic_mode"]
            mic = self.state.get("mic")
            if mic:
                mic.mode = settings["mic_mode"]
        if "interaction_mode" in settings:
            self.state["interaction_mode"] = bool(settings["interaction_mode"])
        if "interaction_chance" in settings:
            self.state["interaction_chance"] = max(0.0, min(1.0, float(settings["interaction_chance"])))
        if "ai_provider" in settings and settings["ai_provider"] in ("dashscope", "anthropic"):
            self.state["ai_provider"] = settings["ai_provider"]
            brain = self.state.get("brain")
            if brain:
                brain.provider = settings["ai_provider"]
        if "vision_model" in settings:
            self.state["vision_model"] = str(settings["vision_model"])
            brain = self.state.get("brain")
            if brain:
                brain.model = str(settings["vision_model"])
        if "capture_scale" in settings:
            val = max(0.3, min(0.8, float(settings["capture_scale"])))
            self.state["capture_scale"] = val
            cap = self.state.get("capture")
            if cap:
                cap.scale = val
        if "capture_quality" in settings:
            val = max(30, min(95, int(float(settings["capture_quality"]))))
            self.state["capture_quality"] = val
            cap = self.state.get("capture")
            if cap:
                cap.quality = val
        if "game_hint" in settings:
            self.state["game_hint"] = str(settings["game_hint"])
        self._persist_settings()
        self.push_log("sys", "Settings updated")
        return {"ok": True}

    def toggle_pause(self) -> dict:
        self.state["paused"] = not self.state["paused"]
        return {"paused": self.state["paused"]}

    def force_comment(self) -> dict:
        cb = self.state.get("on_force_comment")
        if cb:
            cb()
        return {"ok": True}

    def quit_app(self) -> dict:
        self._persist_settings()
        on_quit = self.state.get("on_quit")
        if on_quit:
            on_quit()
        if self._window:
            self._window.destroy()
        return {"ok": True}

    def get_cost(self) -> dict:
        brain = self.state.get("brain")
        if brain:
            return {"cost": round(brain.estimated_cost(), 6), "calls": brain.total_calls}
        return {"cost": 0, "calls": 0}

    def poll_state(self) -> dict:
        with self._log_lock:
            logs = self._log_buffer[:]
            self._log_buffer.clear()
        active_names = [c["name"] for c in self.state.get("active_characters", [])]
        speaker = self._last_speaker if time.time() - self._last_speaker_time < 3.0 else ""
        return {
            "logs": logs,
            "paused": self.state["paused"],
            "active_characters": active_names,
            "speaking": speaker,
            "min_gap": self.state.get("min_gap", 12),
            "interval": self.state.get("interval", 1.5),
            "mic_mode": self.state.get("mic_mode", "always_on"),
            "interaction_mode": self.state.get("interaction_mode", True),
            "interaction_chance": self.state.get("interaction_chance", 0.25),
            "ai_provider": self.state.get("ai_provider", "dashscope"),
            "vision_model": self.state.get("vision_model", "qwen3-vl-flash"),
            "capture_scale": self.state.get("capture_scale", 0.5),
            "capture_quality": self.state.get("capture_quality", 70),
            "game_hint": self.state.get("game_hint", ""),
            "capture_source_type": self.state.get("capture_source_type"),
            "capture_source_name": self.state.get("capture_source_name", ""),
        }

    def get_capture_sources(self) -> dict:
        """Return available monitors and windows for the source picker."""
        from capture import ScreenCapture
        monitors = ScreenCapture.list_monitors()
        windows = ScreenCapture.list_windows()
        return {"monitors": monitors, "windows": windows}

    def set_capture_source(self, source_type, source_id, source_name) -> dict:
        """Set the active capture source."""
        self.state["capture_source_type"] = source_type
        self.state["capture_source_id"] = source_id
        self.state["capture_source_name"] = source_name
        cap = self.state.get("capture")
        if cap:
            cap.set_source(source_type, source_id, source_name)
        self._persist_settings()
        self.push_log("sys", f"Capture source: {source_name}")
        return {"ok": True}

    # ── Internal ──

    def push_log(self, source: str, text: str):
        with self._log_lock:
            self._log_buffer.append({"source": source, "text": text})
            if len(self._log_buffer) > self._max_buffer:
                self._log_buffer = self._log_buffer[-self._max_buffer:]

    def set_last_message(self, name: str, text: str):
        self._last_speaker = name
        self._last_speaker_time = time.time()
        self.push_log(name, text)

    def log_player(self, text: str):
        self.push_log("You", text)

    # ── Hotkeys ──

    def _cycle_mic(self):
        modes = ["always_on", "push_to_talk", "off"]
        cur = self.state["mic_mode"]
        idx = (modes.index(cur) + 1) % len(modes)
        self.state["mic_mode"] = modes[idx]
        mic = self.state.get("mic")
        if mic:
            mic.mode = modes[idx]
        self.push_log("sys", f"Mic: {modes[idx]}")

    def _toggle_pause_hotkey(self):
        self.state["paused"] = not self.state["paused"]

    def _force_comment_hotkey(self):
        cb = self.state.get("on_force_comment")
        if cb:
            cb()

    def _quit_hotkey(self):
        self._persist_settings()
        on_quit = self.state.get("on_quit")
        if on_quit:
            on_quit()
        if self._window:
            self._window.destroy()

    def register_hotkeys(self):
        ptt_key = os.getenv("PTT_KEY", "v")
        keyboard.on_press_key("f7", lambda _: self._cycle_mic(), suppress=False)
        keyboard.on_press_key("f8", lambda _: self._toggle_pause_hotkey(), suppress=False)
        keyboard.on_press_key("f10", lambda _: self._force_comment_hotkey(), suppress=False)
        keyboard.on_press_key("f12", lambda _: self._quit_hotkey(), suppress=False)
        mic = self.state.get("mic")
        if mic:
            keyboard.on_press_key(ptt_key, lambda _: mic.set_ptt(True), suppress=False)
            keyboard.on_release_key(ptt_key, lambda _: mic.set_ptt(False), suppress=False)
