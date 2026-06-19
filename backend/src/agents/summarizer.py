"""Summarizer agent: produces structured summaries from research findings."""

import json
import time
from dataclasses import asdict, dataclass
from typing import Any

from langchain_openai import ChatOpenAI
from langchain_core.messages import HumanMessage, SystemMessage

from ..logger import get_logger, log_agent_event
from .researcher import ResearchFindings


@dataclass
class Summary:
    """Structured summary output."""

    executive_summary: str
    key_points: list[str]
    gaps: list[str]

    def to_dict(self) -> dict[str, Any]:
        """Convert to a JSON-serializable dict."""
        return asdict(self)


class SummarizerAgent:
    """Agent that synthesizes research findings into a structured summary."""

    def __init__(self, model_name: str = "gpt-4o-mini") -> None:
        """Initialize the summarizer with an OpenAI chat model.

        Args:
            model_name: OpenAI model identifier.
        """
        self.llm = ChatOpenAI(model=model_name, temperature=0.2)
        self.logger = get_logger("summarizer")

    def run(self, research_findings: ResearchFindings) -> Summary:
        """Produce a structured summary from research findings.

        Args:
            research_findings: Output from the researcher agent.

        Returns:
            Summary with executive summary, key points, and gaps.
        """
        start = time.perf_counter()
        findings_text = "\n".join(f"- {f}" for f in research_findings.findings)
        prompt = (
            f"Topic: {research_findings.topic}\n\n"
            f"Research findings:\n{findings_text}\n\n"
            f"Sources consulted: {len(research_findings.sources)}\n\n"
            "Create a structured summary. Return ONLY valid JSON with keys:\n"
            '- "executive_summary": string (2-3 paragraphs)\n'
            '- "key_points": array of 4-6 strings\n'
            '- "gaps": array of 2-4 strings describing knowledge gaps'
        )
        messages = [
            SystemMessage(content="You are an expert research summarizer. Output valid JSON only."),
            HumanMessage(content=prompt),
        ]
        response = self.llm.invoke(messages)
        content = response.content if isinstance(response.content, str) else str(response.content)

        try:
            parsed = json.loads(content.strip())
            summary = Summary(
                executive_summary=str(parsed.get("executive_summary", content)),
                key_points=[str(p) for p in parsed.get("key_points", [])],
                gaps=[str(g) for g in parsed.get("gaps", [])],
            )
        except (json.JSONDecodeError, TypeError):
            summary = Summary(
                executive_summary=content[:1000],
                key_points=research_findings.findings[:5],
                gaps=["Further research needed on emerging developments."],
            )

        log_agent_event(
            self.logger,
            "LLM_CALL",
            prompt[:500],
            summary.executive_summary[:200],
            time.perf_counter() - start,
            {"key_points": len(summary.key_points), "gaps": len(summary.gaps)},
        )
        log_agent_event(
            self.logger,
            "COMPLETE",
            research_findings.topic,
            f"{len(summary.key_points)} key points",
            time.perf_counter() - start,
        )
        return summary
