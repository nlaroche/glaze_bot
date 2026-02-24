"""Screen capture with change detection and source selection."""

import asyncio
import base64
import ctypes
import io
import os

import mss
import numpy as np
from PIL import Image


class ScreenCapture:
    def __init__(self):
        self.scale = float(os.getenv("CAPTURE_SCALE", "0.5"))
        self.quality = int(os.getenv("CAPTURE_QUALITY", "70"))
        self.interval = float(os.getenv("CAPTURE_INTERVAL", "1.5"))
        self.change_threshold = float(os.getenv("CHANGE_THRESHOLD", "0.03"))

        # Source selection
        self.source_type = None   # "monitor" | "window" | None
        self.source_id = 0        # monitor index or HWND
        self.source_name = ""

        self._last_sent_array = None
        self._sct = None
        self._thread_id = None

    def set_source(self, source_type, source_id, source_name):
        """Set the capture source and reset change detection."""
        self.source_type = source_type
        self.source_id = source_id
        self.source_name = source_name
        self._last_sent_array = None
        print(f"[capture] Source set: {source_type} / {source_name} (id={source_id})", flush=True)

    def _ensure_mss(self):
        """Ensure mss instance exists for the current thread."""
        import threading
        current = threading.current_thread().ident
        if self._sct is None or self._thread_id != current:
            if self._sct is not None:
                self._sct.close()
            self._sct = mss.mss()
            self._thread_id = current

    @staticmethod
    def list_monitors() -> list[dict]:
        """Enumerate monitors with base64 thumbnails (160x90)."""
        results = []
        try:
            with mss.mss() as sct:
                for i, mon in enumerate(sct.monitors):
                    if i == 0:
                        continue  # skip "all monitors" composite
                    try:
                        raw = sct.grab(mon)
                        img = Image.frombytes("RGB", (raw.width, raw.height), raw.rgb)
                        img.thumbnail((160, 90), Image.LANCZOS)
                        buf = io.BytesIO()
                        img.save(buf, format="JPEG", quality=60)
                        thumb = base64.b64encode(buf.getvalue()).decode("utf-8")
                    except Exception:
                        thumb = ""
                    results.append({
                        "type": "monitor",
                        "id": i,
                        "name": f"Monitor {i} ({mon['width']}x{mon['height']})",
                        "thumbnail": thumb,
                    })
        except Exception as e:
            print(f"[capture] Error listing monitors: {e}", flush=True)
        return results

    @staticmethod
    def list_windows() -> list[dict]:
        """Enumerate visible, non-minimized windows with thumbnails."""
        results = []
        try:
            import win32gui
            import win32con
            import win32ui

            def _enum_callback(hwnd, _):
                if not win32gui.IsWindowVisible(hwnd):
                    return
                if win32gui.IsIconic(hwnd):
                    return
                title = win32gui.GetWindowText(hwnd)
                if not title or "Glaze Bot" in title:
                    return
                try:
                    rect = win32gui.GetWindowRect(hwnd)
                    w = rect[2] - rect[0]
                    h = rect[3] - rect[1]
                    if w < 100 or h < 100:
                        return
                except Exception:
                    return

                # Generate thumbnail via PrintWindow
                thumb = ""
                try:
                    hwnd_dc = win32gui.GetWindowDC(hwnd)
                    mfc_dc = win32ui.CreateDCFromHandle(hwnd_dc)
                    save_dc = mfc_dc.CreateCompatibleDC()
                    bmp = win32ui.CreateBitmap()
                    bmp.CreateCompatibleBitmap(mfc_dc, w, h)
                    save_dc.SelectObject(bmp)
                    # PW_RENDERFULLCONTENT = 2 for better capture on newer Windows
                    ctypes.windll.user32.PrintWindow(hwnd, save_dc.GetSafeHdc(), 2)
                    bmp_info = bmp.GetInfo()
                    bmp_bits = bmp.GetBitmapBits(True)
                    img = Image.frombuffer(
                        "RGBX", (bmp_info["bmWidth"], bmp_info["bmHeight"]),
                        bmp_bits, "raw", "BGRX", 0, 1
                    ).convert("RGB")
                    img.thumbnail((160, 90), Image.LANCZOS)
                    buf = io.BytesIO()
                    img.save(buf, format="JPEG", quality=60)
                    thumb = base64.b64encode(buf.getvalue()).decode("utf-8")
                    # Cleanup
                    win32gui.DeleteObject(bmp.GetHandle())
                    save_dc.DeleteDC()
                    mfc_dc.DeleteDC()
                    win32gui.ReleaseDC(hwnd, hwnd_dc)
                except Exception:
                    pass

                results.append({
                    "type": "window",
                    "id": hwnd,
                    "name": title[:80],
                    "thumbnail": thumb,
                })

            win32gui.EnumWindows(_enum_callback, None)
        except Exception as e:
            print(f"[capture] Error listing windows: {e}", flush=True)
        return results

    def _grab_monitor(self) -> tuple[Image.Image, np.ndarray] | None:
        """Grab a specific monitor by index."""
        self._ensure_mss()
        monitors = self._sct.monitors
        idx = self.source_id
        if idx < 0 or idx >= len(monitors):
            idx = min(self.source_id, len(monitors) - 1)
        monitor = monitors[idx]
        raw = self._sct.grab(monitor)
        img = Image.frombytes("RGB", (raw.width, raw.height), raw.rgb)
        new_w = int(img.width * self.scale)
        new_h = int(img.height * self.scale)
        img = img.resize((new_w, new_h), Image.LANCZOS)
        arr = np.array(img, dtype=np.float32)
        return img, arr

    def _grab_window(self) -> tuple[Image.Image, np.ndarray] | None:
        """Grab a specific window by HWND using PrintWindow."""
        import win32gui
        import win32ui

        hwnd = self.source_id
        if not win32gui.IsWindow(hwnd):
            return None
        if win32gui.IsIconic(hwnd):
            return None

        try:
            rect = win32gui.GetWindowRect(hwnd)
            w = rect[2] - rect[0]
            h = rect[3] - rect[1]
            if w < 1 or h < 1:
                return None

            hwnd_dc = win32gui.GetWindowDC(hwnd)
            mfc_dc = win32ui.CreateDCFromHandle(hwnd_dc)
            save_dc = mfc_dc.CreateCompatibleDC()
            bmp = win32ui.CreateBitmap()
            bmp.CreateCompatibleBitmap(mfc_dc, w, h)
            save_dc.SelectObject(bmp)
            ctypes.windll.user32.PrintWindow(hwnd, save_dc.GetSafeHdc(), 2)

            bmp_info = bmp.GetInfo()
            bmp_bits = bmp.GetBitmapBits(True)
            img = Image.frombuffer(
                "RGBX", (bmp_info["bmWidth"], bmp_info["bmHeight"]),
                bmp_bits, "raw", "BGRX", 0, 1
            ).convert("RGB")

            win32gui.DeleteObject(bmp.GetHandle())
            save_dc.DeleteDC()
            mfc_dc.DeleteDC()
            win32gui.ReleaseDC(hwnd, hwnd_dc)

            new_w = int(img.width * self.scale)
            new_h = int(img.height * self.scale)
            img = img.resize((new_w, new_h), Image.LANCZOS)
            arr = np.array(img, dtype=np.float32)
            return img, arr
        except Exception as e:
            print(f"[capture] Window grab error: {e}", flush=True)
            return None

    def grab_frame(self) -> tuple[Image.Image | None, np.ndarray | None]:
        """Grab a screenshot based on source_type."""
        if self.source_type == "monitor":
            return self._grab_monitor()
        elif self.source_type == "window":
            result = self._grab_window()
            return result if result else (None, None)
        else:
            return (None, None)

    def has_changed(self, current_array: np.ndarray) -> bool:
        """Compare current frame against last sent frame."""
        if self._last_sent_array is None:
            return True
        diff = np.abs(current_array - self._last_sent_array)
        changed_pixels = np.mean(diff > 30)
        return changed_pixels >= self.change_threshold

    def mark_sent(self, array: np.ndarray):
        """Record this frame as the last one sent to the API."""
        self._last_sent_array = array.copy()

    def frame_to_base64(self, img: Image.Image) -> str:
        """Compress image to JPEG and return base64 string."""
        buf = io.BytesIO()
        img.save(buf, format="JPEG", quality=self.quality)
        return base64.b64encode(buf.getvalue()).decode("utf-8")

    async def run(self, frame_queue: asyncio.Queue, force_event: asyncio.Event):
        """Capture loop: grab frames, check for changes, queue them."""
        while True:
            try:
                img, arr = self.grab_frame()

                if img is None or arr is None:
                    await asyncio.sleep(self.interval)
                    continue

                force = force_event.is_set()

                if force or self.has_changed(arr):
                    b64 = self.frame_to_base64(img)
                    self.mark_sent(arr)
                    force_event.clear()

                    if frame_queue.full():
                        try:
                            frame_queue.get_nowait()
                        except asyncio.QueueEmpty:
                            pass
                    await frame_queue.put(b64)
            except Exception as e:
                print(f"[capture] Error: {e}", flush=True)

            await asyncio.sleep(self.interval)

    def close(self):
        if self._sct:
            try:
                self._sct.close()
            except (AttributeError, OSError):
                pass
            self._sct = None
