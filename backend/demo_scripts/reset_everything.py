"""Hard reset local data, clear media files, and re-seed demo data.

Run (from backend dir):
  python -m demo_scripts.reset_everything
"""

from __future__ import annotations

import argparse
import os
import shutil
import subprocess
import sys
from pathlib import Path


def _django_setup() -> None:
    os.environ.setdefault("DJANGO_SETTINGS_MODULE", "backend_project.settings")
    import django  # noqa: WPS433

    django.setup()


def _parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Flush DB, clear media, and seed demo data")
    parser.add_argument(
        "--yes",
        action="store_true",
        help="Skip interactive confirmation",
    )
    parser.add_argument(
        "--seed-args",
        nargs=argparse.REMAINDER,
        help="Additional args forwarded to demo_scripts.seed_demo_data",
    )
    return parser.parse_args()


def _confirm_or_exit(force_yes: bool) -> None:
    if force_yes:
        return

    print("WARNING: This will flush the entire database and delete all files in MEDIA_ROOT.")
    answer = input("Type 'RESET' to continue: ").strip()
    if answer != "RESET":
        raise SystemExit("Aborted. No changes were made.")


def _clear_media_root(media_root: Path) -> None:
    if not media_root.exists():
        return

    for entry in media_root.iterdir():
        if entry.is_dir():
            shutil.rmtree(entry)
        else:
            entry.unlink()


def _run(command: list[str], *, cwd: Path) -> None:
    subprocess.run(command, check=True, cwd=str(cwd))


def main() -> None:
    args = _parse_args()
    _confirm_or_exit(args.yes)
    backend_dir = Path(__file__).resolve().parents[1]

    _django_setup()
    from django.conf import settings

    media_root = Path(settings.MEDIA_ROOT)

    print("Flushing database...")
    _run([sys.executable, "manage.py", "flush", "--noinput"], cwd=backend_dir)

    print(f"Clearing media files in {media_root}...")
    _clear_media_root(media_root)

    seed_cmd = [sys.executable, "-m", "demo_scripts.seed_demo_data", "--reset"]
    if args.seed_args:
        seed_cmd.extend(args.seed_args)

    print("Running demo seed...")
    _run(seed_cmd, cwd=backend_dir)

    print("Reset complete.")


if __name__ == "__main__":
    main()
