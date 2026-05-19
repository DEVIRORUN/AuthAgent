"""
Console logging helpers for AuthAgent runtime visibility.
"""

import logging
import os
import sys
from typing import Any


def _log_level() -> int:
    level_name = os.getenv("LOG_LEVEL", "INFO").upper()
    return getattr(logging, level_name, logging.INFO)


def get_logger(name: str = "authagent") -> logging.Logger:
    logger = logging.getLogger(name)
    logger.setLevel(_log_level())
    logger.propagate = False

    if not logger.handlers:
        handler = logging.StreamHandler(sys.stdout)
        handler.setFormatter(logging.Formatter(
            "%(asctime)s | %(levelname)-7s | %(name)s | %(message)s",
            datefmt="%H:%M:%S",
        ))
        logger.addHandler(handler)

    return logger


def log_event(event: dict[str, Any]) -> None:
    logger = get_logger("authagent.events")
    event_type = event.get("type", "event")
    agent = event.get("agent", "system")
    title = event.get("title", "")
    content = str(event.get("content", "")).replace("\n", " ")
    if len(content) > 180:
        content = f"{content[:177]}..."

    logger.info("[%s] %s - %s%s", event_type, agent, title, f" | {content}" if content else "")
