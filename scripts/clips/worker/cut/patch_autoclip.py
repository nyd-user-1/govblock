"""
GovBlock's changes to an autoclip checkout (MIT, zhouxiaoka/autoclip at
aaf863b), applied by setup.sh. Two, both in backend/pipeline/quality.py:

1. Clip length. autoclip sizes clips by the source's length, and a video over
   thirty minutes gets two- to six-minute clips with a ninety-second floor.
   With GOVBLOCK_SHORTS set, every source gets short clips: 35 to 75 seconds,
   no shorter than 25 and cut at 90, and more of them the longer the hearing.
2. The duration hint appended to the outline and timeline prompts is in
   Chinese; it becomes English, with the same numbers.

Idempotent: a checkout already patched is left alone.

    python3 patch_autoclip.py ~/autoclip
"""

import sys
from pathlib import Path

MARK = "# govblock: shorts"

root = Path(sys.argv[1] if len(sys.argv) > 1 else ".").expanduser()
path = root / "backend/pipeline/quality.py"
src = path.read_text(encoding="utf-8")

if MARK in src:
    print(f"{path}: already patched")
    sys.exit(0)

profile_head = 'def profile_for(total_sec: float) -> DurationProfile:\n    """按总时长分档。数字是产品判断，不是实验结论——回归集起来后再调。"""\n    total_sec = max(0.0, float(total_sec))\n'
assert profile_head in src, "profile_for has changed upstream; re-read it before patching"
src = src.replace(
    profile_head,
    profile_head
    + f"""    {MARK}
    import os
    if os.getenv("GOVBLOCK_SHORTS"):
        hours = max(total_sec / 3600, 0.1)
        return DurationProfile(
            tier="short", total_sec=total_sec,
            min_clip_sec=25, target_clip_sec=(35, 75), max_clip_sec=90,
            topics_hint=(max(4, int(10 * hours)), max(8, int(20 * hours))), min_keep=3, max_clips=max(8, int(12 * hours)),
        )
""",
)

hint_start = src.index("    def prompt_hint(self) -> str:")
hint_end = src.index("    def to_dict(self)", hint_start)
src = (
    src[:hint_start]
    + '''    def prompt_hint(self) -> str:
        """Appended to the step 1 and step 2 prompts; overrides any length or count written above it."""
        lo, hi = self.target_clip_sec
        n_lo, n_hi = self.topics_hint
        minutes = f"{int(self.total_sec // 60)} min {int(self.total_sec % 60)} s"
        return (
            "\\n\\n---\\n\\n## Parameters for this video (these override every length and count above)\\n"
            f"- Video length: {minutes}\\n"
            "- The transcript arrives a part at a time; list only this part's exchanges that stand alone, usually one to three, never more than five, none overlapping\\n"
            f"- Each clip {int(lo)} to {int(hi)} seconds; never under {int(self.min_clip_sec)} seconds, never over {int(self.max_clip_sec)} seconds\\n"
            "- Start and end times must be cue boundaries, copied from the transcript's timestamps, never computed\\n"
        )

'''
    + src[hint_end:]
)

path.write_text(src, encoding="utf-8")
print(f"{path}: patched")
