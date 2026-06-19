"""Critic agent: reviews research findings and summary critically."""

import json
import time
from dataclasses import asdict, dataclass
from typing import Any

from langchain_openai import ChatOpenAI
from langchain_core.messages import HumanMessage, SystemMessage

from ..logger import get_logger, log_agent_event
from .researcher import ResearchFindings
from .summarizer import Summary


@dataclass
class Critique:
    """Structured critique output."""

    strengths: list[str]
    weaknesses: list[str]
    missing_angles: list[str]
    suggested_followups: list[str]

    def to_dict(self) -> dict[str, Any]:
        """Convert to a JSON-serializable dict."""
        return asdict(self)


class CriticAgent:
    """Agent that critically reviews research findings and summaries."""

    def __init__(self, model_name: str = "gpt-4o-mini") -> None:
        """Initialize the critic with an OpenAI chat model.

        Args:
            model_name: OpenAI model identifier.
        """
        self.llm = ChatOpenAI(model=model_name, temperature=0.4)
        self.logger = get_logger("critic")

    def run(self, topic: str, research_findings: ResearchFindings, summary: Summary) -> Critique:
        """Review findings and summary as a critical reviewer.

        Args:
            topic: Original research topic.
            research_findings: Raw research output.
            summary: Summarized research output.

        Returns:
            Critique with strengths, weaknesses, missing angles, and follow-ups.
        """
        start = time.perf_counter()
        findings_text = "\n".join(f"- {f}" for f in research_findings.findings)
        key_points_text = "\n".join(f"- {p}" for p in summary.key_points)

        prompt = (
            f"Topic: {topic}\n\n"
            f"Research findings:\n{findings_text}\n\n"
            f"Executive summary:\n{summary.executive_summary}\n\n"
            f"Key points:\n{key_points_text}\n\n"
            "As a critical reviewer, analyze this research. Return ONLY valid JSON with keys:\n"
            '- "strengths": array of 3-5 strings\n'
            '- "weaknesses": array of 3-5 strings\n'
            '- "missing_angles": array of 2-4 strings\n'
            '- "suggested_followups": array of 3-5 research query strings'
        )
        messages = [
            SystemMessage(
                content="You are a rigorous academic peer reviewer. Be constructive but critical. "
                "Output valid JSON only."
            ),
            HumanMessage(content=prompt),
        ]
        response = self.llm.invoke(messages)
        content = response.content if isinstance(response.content, str) else str(response.content)

        try:
            parsed = json.loads(content.strip())
            critique = Critique(
                strengths=[str(s) for s in parsed.get("strengths", [])],
                weaknesses=[str(w) for w in parsed.get("weaknesses", [])],
                missing_angles=[str(m) for m in parsed.get("missing_angles", [])],
                suggested_followups=[str(f) for f in parsed.get("suggested_followups", [])],
            )
        except (json.JSONDecodeError, TypeError):
            critique = Critique(
                strengths=["Comprehensive initial coverage of the topic."],
                weaknesses=["Limited depth due to web search constraints."],
                missing_angles=["Primary source verification needed."],
                suggested_followups=[f"Deeper analysis of {topic}"],
            )

        log_agent_event(
            self.logger,
            "LLM_CALL",
            prompt[:500],
            json.dumps(critique.strengths[:2]),
            time.perf_counter() - start,
            {"step": "critique"},
        )
        log_agent_event(
            self.logger,
            "COMPLETE",
            topic,
            f"{len(critique.strengths)} strengths, {len(critique.weaknesses)} weaknesses",
            time.perf_counter() - start,
        )
        return critique
