"""Structured logging module for agent invocations and tool calls."""

import json
import logging
import sys
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Optional

BACKEND_ROOT = Path(__file__).resolve().parent.parent
LOGS_DIR = BACKEND_ROOT / "logs"

_loggers: dict[str, logging.Logger] = {}


def get_logger(agent_name: str) -> logging.Logger:
    """Return a configured logger writing JSON lines to stdout and a per-agent log file.

    Args:
        agent_name: Identifier used for the logger name and log file.

    Returns:
        Configured logger instance for the given agent.
    """
    if agent_name in _loggers:
        return _loggers[agent_name]

    LOGS_DIR.mkdir(parents=True, exist_ok=True)

    logger = logging.getLogger(f"agent.{agent_name}")
    logger.setLevel(logging.INFO)
    logger.propagate = False

    if not logger.handlers:
        formatter = logging.Formatter("%(message)s")

        stdout_handler = logging.StreamHandler(sys.stdout)
        stdout_handler.setFormatter(formatter)
        logger.addHandler(stdout_handler)

        file_handler = logging.FileHandler(LOGS_DIR / f"{agent_name}.log")
        file_handler.setFormatter(formatter)
        logger.addHandler(file_handler)

    _loggers[agent_name] = logger
    return logger


def log_agent_event(
    logger: logging.Logger,
    event_type: str,
    input_text: str,
    output_text: str,
    duration_seconds: float,
    metadata: Optional[dict[str, Any]] = None,
) -> None:
    """Write a structured JSON log entry for an agent event.

    Args:
        logger: Logger instance from get_logger.
        event_type: One of TOOL_CALL, LLM_CALL, ERROR, or COMPLETE.
        input_text: Raw input text (truncated to 200 chars in log).
        output_text: Raw output text (truncated to 200 chars in log).
        duration_seconds: Elapsed time for the event in seconds.
        metadata: Optional additional context dict.
    """
    agent_name = logger.name.replace("agent.", "")
    entry = {
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "agent_name": agent_name,
        "event_type": event_type,
        "input_preview": (input_text or "")[:200],
        "output_preview": (output_text or "")[:200],
        "duration_seconds": round(duration_seconds, 3),
        "metadata": metadata or {},
    }
    logger.info(json.dumps(entry))
