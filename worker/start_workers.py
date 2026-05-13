#!/usr/bin/env python3
"""
Worker supervisor — spawns consumer subprocesses and restarts them on crash
with exponential backoff. ECS restarts the whole container only when the
supervisor itself gives up (MAX_RESTARTS exhausted) or is stopped.
"""
import os
import re
import signal
import subprocess
import sys
import time

# Add worker directory to Python path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from dotenv import load_dotenv
from utils.logger import setup_logger
from services.database import test_connection

load_dotenv()

logger = setup_logger(__name__)

# ── Consumer definitions ───────────────────────────────────────────────────────
CONSUMERS = [
    ("Payment Consumer",        "consumers/payment_consumer.py"),
    ("Scheduled Jobs Consumer", "consumers/scheduled_consumer.py"),
    # Add new consumers here as they are implemented:
    # ("Email Consumer", "consumers/email_consumer.py"),
    # ("CME Consumer",   "consumers/cme_consumer.py"),
]

# ── Restart policy ────────────────────────────────────────────────────────────
MAX_RESTARTS = 10
# Backoff in seconds: 5s, 10s, 20s, 40s, 60s (capped)
RESTART_BACKOFF = [5, 10, 20, 40, 60, 60, 60, 60, 60, 60]
SUPERVISOR_POLL_INTERVAL = 5  # seconds between crash checks


def _mask_db_url(url: str) -> str:
    """Replace password in DATABASE_URL with *** for safe logging."""
    return re.sub(r"://([^:]+):([^@]+)@", r"://\1:***@", url)


def _start_process(name: str, script: str, env: dict, worker_dir: str) -> subprocess.Popen:
    p = subprocess.Popen(
        [sys.executable, script],
        env=env,
        cwd=worker_dir,
    )
    logger.info(f"Started {name} pid={p.pid}")
    return p


def run_supervised(worker_dir: str, env: dict):
    """
    Launch all consumers and supervise them. On crash, restart with exponential
    backoff up to MAX_RESTARTS. If a consumer exceeds MAX_RESTARTS, exit the
    supervisor so ECS can restart the container and alert on-call.
    """
    state: dict[str, dict] = {}

    for name, script in CONSUMERS:
        p = _start_process(name, script, env, worker_dir)
        state[name] = {"script": script, "proc": p, "restarts": 0}
        time.sleep(1)  # stagger startup

    logger.info(f"All {len(CONSUMERS)} consumer(s) running — supervisor active")

    while True:
        time.sleep(SUPERVISOR_POLL_INTERVAL)

        for name, s in state.items():
            p: subprocess.Popen = s["proc"]
            if p.poll() is None:
                continue  # still running

            exit_code = p.returncode
            restarts = s["restarts"]

            if restarts >= MAX_RESTARTS:
                logger.critical(
                    f"{name} has crashed {restarts} time(s) — giving up. "
                    f"Last exit code: {exit_code}. Exiting supervisor so ECS can restart."
                )
                # Terminate remaining processes cleanly
                for other_name, other_s in state.items():
                    if other_name != name and other_s["proc"].poll() is None:
                        other_s["proc"].terminate()
                sys.exit(1)

            backoff = RESTART_BACKOFF[min(restarts, len(RESTART_BACKOFF) - 1)]
            logger.error(
                f"{name} exited (code={exit_code}), restarting in {backoff}s "
                f"(attempt {restarts + 1}/{MAX_RESTARTS})"
            )
            time.sleep(backoff)

            new_p = _start_process(name, s["script"], env, worker_dir)
            s["proc"] = new_p
            s["restarts"] += 1


def signal_handler(sig, frame):
    logger.info("Shutdown signal received — terminating workers…")
    # Subprocesses are in the same process group; SIGTERM propagates automatically.
    sys.exit(0)


if __name__ == "__main__":
    signal.signal(signal.SIGINT, signal_handler)
    signal.signal(signal.SIGTERM, signal_handler)

    worker_dir = os.path.dirname(os.path.abspath(__file__))
    env = {**os.environ, "PYTHONPATH": worker_dir}

    db_url = os.getenv("DATABASE_URL", "Not configured")
    safe_db = _mask_db_url(db_url)

    logger.info("=" * 60)
    logger.info("CHT Platform Worker Service")
    logger.info("=" * 60)
    logger.info(f"Environment: {os.getenv('ENVIRONMENT', 'development')}")
    logger.info(f"Database:    {safe_db[:60]}…")
    logger.info(f"Consumers:   {[name for name, _ in CONSUMERS]}")
    logger.info("=" * 60)

    # Verify DB connectivity before spawning consumers
    logger.info("Testing database connection…")
    if not test_connection():
        logger.critical("Cannot start workers — database connection failed")
        sys.exit(1)

    run_supervised(worker_dir, env)
