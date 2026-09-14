"""
A hearing's audio to SRT with faster-whisper (MIT; Whisper weights MIT), on
the worker box's CPU. autoclip is handed the SRT with --srt, so its own
Whisper runtime is never installed and the model is GovBlock's choice:
medium.en by default, which reads names, bill numbers and figures far better
than autoclip's default of base.

    python3 transcribe.py hearing.mp4 hearing.srt [--model medium.en]
"""

import argparse
import os
import time

from faster_whisper import WhisperModel


def stamp(seconds):
    ms = int(round(seconds * 1000))
    h, ms = divmod(ms, 3_600_000)
    m, ms = divmod(ms, 60_000)
    s, ms = divmod(ms, 1000)
    return f"{h:02d}:{m:02d}:{s:02d},{ms:03d}"


def main():
    p = argparse.ArgumentParser()
    p.add_argument("video")
    p.add_argument("srt")
    p.add_argument("--model", default=os.getenv("WHISPER_MODEL", "medium.en"))
    a = p.parse_args()

    started = time.time()
    model = WhisperModel(a.model, device="cpu", compute_type="int8", cpu_threads=os.cpu_count() or 8)
    segments, info = model.transcribe(a.video, language="en", vad_filter=True, beam_size=5, condition_on_previous_text=False)
    print(f"transcribing {info.duration:.0f} s of audio with {a.model}", flush=True)
    n = 0
    with open(a.srt, "w", encoding="utf-8") as out:
        for seg in segments:
            text = seg.text.strip()
            if not text:
                continue
            n += 1
            out.write(f"{n}\n{stamp(seg.start)} --> {stamp(seg.end)}\n{text}\n\n")
            if n % 200 == 0:
                print(f"  {n} cues, at {stamp(seg.end)}, {time.time() - started:.0f} s elapsed", flush=True)
    print(f"wrote {n} cues to {a.srt} in {time.time() - started:.0f} s", flush=True)


if __name__ == "__main__":
    main()
