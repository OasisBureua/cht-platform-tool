#!/usr/bin/env python3
"""ECS container health check: verify the worker supervisor process is running."""
import os
import sys


def supervisor_running() -> bool:
    for entry in os.listdir("/proc"):
        if not entry.isdigit():
            continue
        cmdline_path = f"/proc/{entry}/cmdline"
        try:
            with open(cmdline_path, "rb") as handle:
                cmd = handle.read().replace(b"\0", b" ").decode("latin-1")
            if "start_workers.py" in cmd:
                return True
        except OSError:
            continue
    return False


if __name__ == "__main__":
    sys.exit(0 if supervisor_running() else 1)
