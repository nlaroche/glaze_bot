"""Glaze Bot — AI Gaming Companion.

Entry point and orchestrator. Runs capture, mic, and LLM loops concurrently.
"""

import asyncio
import os
import random
import sys
import threading

from dotenv import load_dotenv

load_dotenv()

from brain import Brain
from capture import ScreenCapture
from mic import Mic
from ui_bridge import UiBridge, load_characters
from voice import Voice


class GlazeBot:
    def __init__(self):
        self.characters = load_characters()
        if not self.characters:
            print("No characters found in characters/ directory!")
            sys.exit(1)

        self.capture = ScreenCapture()
        self.brain = Brain()
        self.voice = Voice()

        self.running = True
        self._loop = None
        self.active_characters = list(self.characters)

        self.app_state = {
            "paused": True,
            "characters": self.characters,
            "active_characters": self.active_characters,
            "mic_mode": os.getenv("MIC_MODE", "always_on"),
            "interval": self.capture.interval,
            "brain": self.brain,
            "voice": self.voice,
            "capture": self.capture,
            "on_quit": self._request_quit,
            "on_force_comment": self._force_comment,
            "interaction_mode": True,
            "interaction_chance": 0.25,
            "min_gap": float(os.getenv("MIN_GAP", "30")),
            "game_hint": "",
            "ai_provider": self.brain.provider,
            "vision_model": self.brain.model,
            "capture_scale": self.capture.scale,
            "capture_quality": self.capture.quality,
            "capture_source_type": None,
            "capture_source_id": 0,
            "capture_source_name": "",
        }

        self.bridge = UiBridge(self.app_state)

        self.mic = Mic(
            self.voice,
            on_speech_done=self._force_comment,
            on_transcript=lambda text: self.bridge.log_player(text),
        )
        self.app_state["mic"] = self.mic
        self.app_state["mic_mode"] = self.mic.mode

        self.frame_queue = None
        self.force_event = None

    def _request_quit(self):
        self.running = False
        if self._loop:
            self._loop.call_soon_threadsafe(self._loop.stop)

    def _force_comment(self):
        if self.force_event:
            self.force_event.set()

    def _pick_character(self) -> dict | None:
        active = self.app_state["active_characters"]
        return random.choice(active) if active else None

    def _pick_reactor(self, exclude_name: str) -> dict | None:
        others = [c for c in self.app_state["active_characters"] if c["name"] != exclude_name]
        return random.choice(others) if others else None

    async def _drain_queue(self):
        while not self.frame_queue.empty():
            try:
                self.frame_queue.get_nowait()
            except asyncio.QueueEmpty:
                break

    async def _llm_loop(self):
        import time
        last_spoke_time = 0

        while self.running:
            if self.app_state["paused"]:
                await self._drain_queue()
                await asyncio.sleep(0.5)
                continue

            try:
                frame_b64 = await asyncio.wait_for(self.frame_queue.get(), timeout=2.0)
            except asyncio.TimeoutError:
                continue

            if self.app_state["paused"]:
                continue

            player_text = self.mic.get_transcript()
            min_gap = self.app_state.get("min_gap", 12)

            if player_text:
                print(f"[llm] Player said: {player_text.encode('ascii','ignore').decode()}", flush=True)
            else:
                if time.time() - last_spoke_time < min_gap:
                    continue

            char = self._pick_character()
            if not char:
                await asyncio.sleep(1)
                continue

            if self.app_state["paused"]:
                continue

            game_hint = self.app_state.get("game_hint", "")

            try:
                reply = await asyncio.get_event_loop().run_in_executor(
                    None, self.brain.chat, frame_b64, player_text, char, None, game_hint
                )
            except Exception as e:
                err = str(e).encode("ascii", "ignore").decode()
                print(f"[brain] API error: {err}", flush=True)
                await asyncio.sleep(2)
                continue

            if reply is None:
                continue

            if self.app_state["paused"]:
                continue

            last_spoke_time = time.time()
            char_name = char["name"]
            safe_reply = reply.encode("ascii", "ignore").decode()
            print(f"[{char_name}] {safe_reply}", flush=True)
            self.bridge.set_last_message(char_name, reply)

            await asyncio.get_event_loop().run_in_executor(
                None, self.voice.speak, reply, char.get("voice")
            )

            # Character interaction
            if (
                self.app_state.get("interaction_mode")
                and len(self.app_state["active_characters"]) > 1
                and random.random() < self.app_state.get("interaction_chance", 0.25)
                and not self.app_state["paused"]
            ):
                reactor = self._pick_reactor(char_name)
                if reactor:
                    try:
                        react_reply = await asyncio.get_event_loop().run_in_executor(
                            None, self.brain.chat, frame_b64, None, reactor,
                            {"name": char_name, "text": reply}, game_hint,
                        )
                    except Exception:
                        react_reply = None

                    if react_reply and not self.app_state["paused"]:
                        reactor_name = reactor["name"]
                        safe_react = react_reply.encode("ascii", "ignore").decode()
                        print(f"[{reactor_name}] {safe_react}", flush=True)
                        self.bridge.set_last_message(reactor_name, react_reply)
                        await asyncio.get_event_loop().run_in_executor(
                            None, self.voice.speak, react_reply, reactor.get("voice")
                        )
                        last_spoke_time = time.time()

    async def _run_async(self):
        self.frame_queue = asyncio.Queue(maxsize=2)
        self.force_event = asyncio.Event()

        capture_task = asyncio.create_task(self.capture.run(self.frame_queue, self.force_event))
        llm_task = asyncio.create_task(self._llm_loop())

        while self.running:
            for t in [capture_task, llm_task]:
                if t.done() and not t.cancelled():
                    exc = t.exception()
                    if exc:
                        print(f"[async] Task crashed: {exc}", flush=True)
                        import traceback
                        traceback.print_exception(type(exc), exc, exc.__traceback__)
            await asyncio.sleep(0.5)

        capture_task.cancel()
        llm_task.cancel()
        for task in [capture_task, llm_task]:
            try:
                await task
            except asyncio.CancelledError:
                pass

    def _async_thread(self):
        self._loop = asyncio.new_event_loop()
        asyncio.set_event_loop(self._loop)
        try:
            self._loop.run_until_complete(self._run_async())
        except Exception as e:
            print(f"[async] Error: {e}", flush=True)
        finally:
            self._loop.close()

    def run(self):
        import webview

        print("Glaze Bot starting...", flush=True)
        print(f"Characters: {len(self.characters)} loaded", flush=True)
        print(f"Model: {self.brain.model}", flush=True)
        print(f"Mic: {self.mic.mode}", flush=True)
        print(f"Interval: {self.capture.interval}s | Min gap: {self.app_state['min_gap']}s", flush=True)
        print(flush=True)

        self.mic.start()
        self.bridge.register_hotkeys()

        async_thread = threading.Thread(target=self._async_thread, daemon=True)
        async_thread.start()

        dev_ui = os.getenv("DEV_UI")
        url = "http://localhost:5173" if dev_ui else os.path.join(
            os.path.dirname(__file__), "ui", "dist", "index.html"
        )

        try:
            window = webview.create_window(
                "Glaze Bot", url=url, js_api=self.bridge,
                width=900, height=640, on_top=True, background_color="#1e1e2e",
            )
            self.bridge._window = window
            webview.start()
        except KeyboardInterrupt:
            pass
        finally:
            self.running = False
            self.mic.stop()
            self.capture.close()
            print("\nGlaze Bot stopped.", flush=True)


if __name__ == "__main__":
    bot = GlazeBot()
    bot.run()
