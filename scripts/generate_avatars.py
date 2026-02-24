"""Generate AI avatar images for all characters using DashScope image models.

Uses the same DASHSCOPE_API_KEY that powers the vision model — no extra keys needed.
Uses the DashScope native async API with qwen-image-plus.
"""

import json
import os
import sys
import time
from pathlib import Path

import requests
from dotenv import load_dotenv

load_dotenv()

CHAR_DIR = Path(__file__).parent.parent / "characters"
OUTPUT_DIR = Path(__file__).parent.parent / "ui" / "public" / "avatars"

API_BASE = "https://dashscope-intl.aliyuncs.com/api/v1"
SUBMIT_URL = f"{API_BASE}/services/aigc/text2image/image-synthesis"
TASK_URL = f"{API_BASE}/tasks"


def slug(name: str) -> str:
    return name.lower().replace(" ", "_")


def build_prompt(char: dict) -> str:
    name = char["name"]
    desc = char.get("description", "")
    return (
        f"Stylized cartoon portrait of a character called '{name}': {desc}. "
        f"Vibrant colors, dark moody background, bust shot facing forward, "
        f"expressive face, consistent illustration style, avatar icon. "
        f"No text, no watermark, no frame."
    )


def submit_task(api_key: str, prompt: str) -> str | None:
    """Submit an image generation task. Returns task_id or None."""
    headers = {
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json",
        "X-DashScope-Async": "enable",
    }
    payload = {
        "model": "qwen-image-plus",
        "input": {"prompt": prompt},
        "parameters": {"n": 1, "size": "512*512"},
    }
    resp = requests.post(SUBMIT_URL, json=payload, headers=headers, timeout=30)
    data = resp.json()

    if "output" in data and "task_id" in data["output"]:
        return data["output"]["task_id"]

    print(f"    Submit error: {data}")
    return None


def poll_task(api_key: str, task_id: str, max_wait: int = 120) -> str | None:
    """Poll for task completion. Returns image URL or None."""
    headers = {"Authorization": f"Bearer {api_key}"}
    url = f"{TASK_URL}/{task_id}"

    for _ in range(max_wait // 2):
        resp = requests.get(url, headers=headers, timeout=30)
        data = resp.json()
        status = data.get("output", {}).get("task_status", "")

        if status == "SUCCEEDED":
            results = data["output"].get("results", [])
            if results:
                return results[0].get("url")
            return None
        elif status in ("FAILED", "CANCELED"):
            msg = data.get("output", {}).get("message", "unknown")
            print(f"    Task {status}: {msg}")
            return None

        time.sleep(2)

    print(f"    Task timed out after {max_wait}s")
    return None


def generate_avatar(api_key: str, char: dict) -> bool:
    """Generate an avatar for one character. Returns True on success."""
    name = char["name"]
    out_path = OUTPUT_DIR / f"{slug(name)}.png"

    if out_path.exists():
        print(f"  [skip] {name} — already exists")
        return True

    prompt = build_prompt(char)
    print(f"  [gen] {name}...")

    task_id = submit_task(api_key, prompt)
    if not task_id:
        return False

    print(f"    Task {task_id}, polling...")
    image_url = poll_task(api_key, task_id)
    if not image_url:
        return False

    # Download and save
    img_data = requests.get(image_url, timeout=60).content
    out_path.write_bytes(img_data)
    print(f"  [ok] {name} -> {out_path}")
    return True


def main():
    api_key = os.getenv("DASHSCOPE_API_KEY")
    if not api_key:
        print("Error: DASHSCOPE_API_KEY not set in .env")
        sys.exit(1)

    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

    # Load all characters
    chars = []
    for f in sorted(CHAR_DIR.glob("*.json")):
        with open(f) as fh:
            chars.append(json.load(fh))

    print(f"Found {len(chars)} characters")
    print(f"Output: {OUTPUT_DIR}")
    print(f"Model: qwen-image-plus (DashScope)")
    print()

    success = 0
    skipped = 0
    failed = 0

    for char in chars:
        out_path = OUTPUT_DIR / f"{slug(char['name'])}.png"
        if out_path.exists():
            skipped += 1
            print(f"  [skip] {char['name']}")
            continue

        if generate_avatar(api_key, char):
            success += 1
        else:
            failed += 1

    print()
    print(f"Done: {success} generated, {skipped} skipped, {failed} failed")


if __name__ == "__main__":
    main()
