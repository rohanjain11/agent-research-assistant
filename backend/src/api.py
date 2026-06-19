"""FastAPI backend for the multi-agent research assistant."""

import asyncio
import json
import os
import queue
import threading
from contextlib import asynccontextmanager
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field

from .logger import BACKEND_ROOT, LOGS_DIR
from .orchestrator import AgentOrchestrator, PipelineState
from .tools.vector_store import get_chroma_client

load_dotenv(BACKEND_ROOT / ".env")

ARTIFACTS_DIR = BACKEND_ROOT / "artifacts"
AGENT_NAMES = ["researcher", "summarizer", "critic", "reporter"]


def _cors_origins() -> list[str]:
    """Build allowed CORS origins from defaults and environment.

    Returns:
        List of allowed origin URLs for CORS middleware.
    """
    origins = [
        "http://localhost:5173",
        "http://127.0.0.1:5173",
    ]
    extra = os.getenv("CORS_ORIGINS", "")
    if extra:
        origins.extend(origin.strip() for origin in extra.split(",") if origin.strip())
    return origins


class ResearchRequest(BaseModel):
    """Request body for starting a research pipeline."""

    topic: str = Field(..., min_length=1, max_length=500)


def _validate_startup() -> None:
    """Confirm required environment and services are available.

    Raises:
        RuntimeError: If OPENAI_API_KEY is missing or ChromaDB is inaccessible.
    """
    api_key = os.getenv("OPENAI_API_KEY")
    if not api_key or api_key == "your_key_here":
        raise RuntimeError(
            "OPENAI_API_KEY is not set. Copy backend/.env.example to backend/.env "
            "and add your OpenAI API key."
        )
    try:
        get_chroma_client()
    except Exception as exc:
        raise RuntimeError(f"ChromaDB is not accessible: {exc}") from exc


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan handler for startup validation."""
    _validate_startup()
    LOGS_DIR.mkdir(parents=True, exist_ok=True)
    ARTIFACTS_DIR.mkdir(parents=True, exist_ok=True)
    yield


app = FastAPI(
    title="Research Agent API",
    description="Multi-agent research assistant pipeline",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=_cors_origins(),
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

orchestrator = AgentOrchestrator()


def _read_log_entries(agent_name: str, limit: int = 50) -> list[dict[str, Any]]:
    """Parse the last N JSON log entries for an agent.

    Args:
        agent_name: Agent log file name.
        limit: Maximum entries to return.

    Returns:
        List of parsed log entry dicts.
    """
    log_path = LOGS_DIR / f"{agent_name}.log"
    if not log_path.exists():
        return []

    entries: list[dict[str, Any]] = []
    with log_path.open("r", encoding="utf-8") as handle:
        for line in handle:
            line = line.strip()
            if not line:
                continue
            try:
                entries.append(json.loads(line))
            except json.JSONDecodeError:
                continue
    return entries[-limit:]


def _run_pipeline_with_events(
    topic: str,
    event_queue: queue.Queue,
) -> PipelineState:
    """Run pipeline in a thread, pushing SSE events to a queue.

    Args:
        topic: Research topic.
        event_queue: Thread-safe queue for SSE events.

    Returns:
        Final PipelineState.
    """

    def on_progress(agent: str, status: str, duration: float) -> None:
        event_queue.put({"agent": agent, "status": status, "duration": round(duration, 2)})

    state = orchestrator.run(topic, on_progress=on_progress)
    event_queue.put({"type": "complete", "state": state.to_dict()})
    return state


@app.get("/health")
async def health() -> dict[str, Any]:
    """Health check endpoint."""
    return {"status": "ok", "agents": AGENT_NAMES}


@app.post("/research")
async def research(
    request: ResearchRequest,
    stream: bool = Query(default=False, description="Enable SSE streaming"),
):
    """Run the full research pipeline.

    Args:
        request: Research topic request body.
        stream: If true, return Server-Sent Events stream.

    Returns:
        PipelineState JSON or SSE stream.
    """
    topic = request.topic.strip()
    if not topic:
        raise HTTPException(status_code=400, detail="Topic cannot be empty")

    if stream:

        async def event_generator():
            event_queue: queue.Queue = queue.Queue()
            loop = asyncio.get_event_loop()

            def run_in_thread():
                try:
                    _run_pipeline_with_events(topic, event_queue)
                except Exception as exc:
                    event_queue.put({"type": "error", "message": str(exc)})
                finally:
                    event_queue.put(None)

            thread = threading.Thread(target=run_in_thread, daemon=True)
            thread.start()

            while True:
                item = await loop.run_in_executor(None, event_queue.get)
                if item is None:
                    break
                yield f"data: {json.dumps(item)}\n\n"

            thread.join(timeout=1)

        return StreamingResponse(
            event_generator(),
            media_type="text/event-stream",
            headers={
                "Cache-Control": "no-cache",
                "Connection": "keep-alive",
                "X-Accel-Buffering": "no",
            },
        )

    try:
        state = orchestrator.run(topic)
        return state.to_dict()
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc


@app.get("/logs/{agent_name}")
async def get_agent_logs(agent_name: str) -> dict[str, Any]:
    """Return the last 50 parsed JSON log entries for an agent.

    Args:
        agent_name: One of researcher, summarizer, critic, reporter.

    Returns:
        Dict with agent name and log entries.
    """
    if agent_name not in AGENT_NAMES:
        raise HTTPException(status_code=404, detail=f"Unknown agent: {agent_name}")

    entries = _read_log_entries(agent_name)
    return {"agent": agent_name, "entries": entries, "count": len(entries)}


@app.get("/artifacts")
async def list_artifacts() -> dict[str, Any]:
    """List report files in the artifacts directory.

    Returns:
        Dict with artifact file metadata.
    """
    ARTIFACTS_DIR.mkdir(parents=True, exist_ok=True)
    artifacts: list[dict[str, Any]] = []

    for path in sorted(ARTIFACTS_DIR.glob("*.md"), key=lambda p: p.stat().st_mtime, reverse=True):
        stat = path.stat()
        artifacts.append(
            {
                "filename": path.name,
                "size_kb": round(stat.st_size / 1024, 2),
                "created_at": datetime.fromtimestamp(stat.st_mtime, tz=timezone.utc).isoformat(),
            }
        )

    return {"artifacts": artifacts, "count": len(artifacts)}
