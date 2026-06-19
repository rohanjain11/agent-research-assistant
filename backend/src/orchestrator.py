"""Pipeline orchestrator coordinating all research agents."""

import time
from dataclasses import dataclass, field
from typing import Any, Callable, Optional

from .agents.critic import CriticAgent, Critique
from .agents.reporter import Report, ReporterAgent
from .agents.researcher import ResearchFindings, ResearcherAgent
from .agents.summarizer import SummarizerAgent, Summary

ProgressCallback = Callable[[str, str, float], None]


@dataclass
class PipelineState:
    """Full state of a research pipeline run."""

    topic: str
    research_findings: Optional[ResearchFindings] = None
    summary: Optional[Summary] = None
    critique: Optional[Critique] = None
    report: Optional[Report] = None
    total_duration: float = 0.0
    agent_durations: dict[str, float] = field(default_factory=dict)
    status: str = "RUNNING"
    error: Optional[str] = None

    def to_dict(self) -> dict[str, Any]:
        """Convert pipeline state to a JSON-serializable dict."""
        return {
            "topic": self.topic,
            "research_findings": self.research_findings.to_dict() if self.research_findings else None,
            "summary": self.summary.to_dict() if self.summary else None,
            "critique": self.critique.to_dict() if self.critique else None,
            "report": self.report.to_dict() if self.report else None,
            "total_duration": round(self.total_duration, 3),
            "agent_durations": {k: round(v, 3) for k, v in self.agent_durations.items()},
            "status": self.status,
            "error": self.error,
        }


class AgentOrchestrator:
    """Runs the Researcher → Summarizer → Critic → Reporter pipeline sequentially."""

    AGENT_NAMES = ("researcher", "summarizer", "critic", "reporter")

    def __init__(self) -> None:
        """Initialize all pipeline agents."""
        self.researcher = ResearcherAgent()
        self.summarizer = SummarizerAgent()
        self.critic = CriticAgent()
        self.reporter = ReporterAgent()

    def run(
        self,
        topic: str,
        on_progress: Optional[ProgressCallback] = None,
    ) -> PipelineState:
        """Execute the full research pipeline for a topic.

        Args:
            topic: Research topic string.
            on_progress: Optional callback invoked as (agent_name, status, duration).

        Returns:
            PipelineState with all outputs or partial state on failure.
        """
        pipeline_start = time.perf_counter()
        state = PipelineState(topic=topic)

        def emit(agent: str, status: str, duration: float = 0.0) -> None:
            if on_progress:
                on_progress(agent, status, duration)

        try:
            emit("researcher", "running")
            agent_start = time.perf_counter()
            state.research_findings = self.researcher.run(topic)
            duration = time.perf_counter() - agent_start
            state.agent_durations["researcher"] = duration
            emit("researcher", "complete", duration)

            emit("summarizer", "running")
            agent_start = time.perf_counter()
            state.summary = self.summarizer.run(state.research_findings)
            duration = time.perf_counter() - agent_start
            state.agent_durations["summarizer"] = duration
            emit("summarizer", "complete", duration)

            emit("critic", "running")
            agent_start = time.perf_counter()
            state.critique = self.critic.run(topic, state.research_findings, state.summary)
            duration = time.perf_counter() - agent_start
            state.agent_durations["critic"] = duration
            emit("critic", "complete", duration)

            emit("reporter", "running")
            agent_start = time.perf_counter()
            state.report = self.reporter.run(
                topic, state.research_findings, state.summary, state.critique
            )
            duration = time.perf_counter() - agent_start
            state.agent_durations["reporter"] = duration
            emit("reporter", "complete", duration)

            state.status = "COMPLETE"
        except Exception as exc:
            state.status = "FAILED"
            state.error = str(exc)
            failed_agent = self._detect_failed_agent(state)
            if failed_agent:
                emit(failed_agent, "error", state.agent_durations.get(failed_agent, 0.0))

        state.total_duration = time.perf_counter() - pipeline_start
        return state

    @staticmethod
    def _detect_failed_agent(state: PipelineState) -> Optional[str]:
        """Determine which agent likely failed based on partial state.

        Args:
            state: Current pipeline state.

        Returns:
            Agent name string or None.
        """
        if state.report is not None:
            return None
        if state.critique is not None:
            return "reporter"
        if state.summary is not None:
            return "critic"
        if state.research_findings is not None:
            return "summarizer"
        return "researcher"

    def get_pipeline_summary(self, state: PipelineState) -> dict[str, Any]:
        """Return a human-readable pipeline summary dict.

        Args:
            state: Completed or failed pipeline state.

        Returns:
            Summary dict with topic, status, durations, and counts.
        """
        source_count = len(state.research_findings.sources) if state.research_findings else 0
        word_count = state.report.word_count if state.report else 0

        return {
            "topic": state.topic,
            "status": state.status,
            "total_duration": round(state.total_duration, 2),
            "agent_durations": {k: round(v, 2) for k, v in state.agent_durations.items()},
            "report_word_count": word_count,
            "source_count": source_count,
            "error": state.error,
        }
