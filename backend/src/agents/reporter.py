"""Reporter agent: produces final markdown research reports."""

import re
import time
from dataclasses import asdict, dataclass
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from langchain_openai import ChatOpenAI
from langchain_core.messages import HumanMessage, SystemMessage

from ..logger import BACKEND_ROOT, get_logger, log_agent_event
from .critic import Critique
from .researcher import ResearchFindings
from .summarizer import Summary

ARTIFACTS_DIR = BACKEND_ROOT / "artifacts"


@dataclass
class Report:
    """Final report output."""

    title: str
    markdown_content: str
    filepath: str
    word_count: int

    def to_dict(self) -> dict[str, Any]:
        """Convert to a JSON-serializable dict."""
        return asdict(self)


class ReporterAgent:
    """Agent that writes the final structured markdown research report."""

    def __init__(self, model_name: str = "gpt-4o-mini") -> None:
        """Initialize the reporter with an OpenAI chat model.

        Args:
            model_name: OpenAI model identifier.
        """
        self.llm = ChatOpenAI(model=model_name, temperature=0.3)
        self.logger = get_logger("reporter")

    @staticmethod
    def _slugify(topic: str) -> str:
        """Convert a topic string to a filesystem-safe slug.

        Args:
            topic: Raw topic string.

        Returns:
            Lowercase hyphenated slug.
        """
        slug = re.sub(r"[^\w\s-]", "", topic.lower())
        slug = re.sub(r"[\s_]+", "-", slug).strip("-")
        return slug[:60] or "research"

    def run(
        self,
        topic: str,
        research_findings: ResearchFindings,
        summary: Summary,
        critique: Critique,
    ) -> Report:
        """Write the final markdown report and save to artifacts/.

        Args:
            topic: Research topic.
            research_findings: Raw findings from researcher.
            summary: Structured summary.
            critique: Critical review.

        Returns:
            Report with title, content, filepath, and word count.
        """
        start = time.perf_counter()
        findings_text = "\n".join(f"- {f}" for f in research_findings.findings)
        sources_text = "\n".join(f"- {url}" for url in research_findings.sources)
        strengths_text = "\n".join(f"- {s}" for s in critique.strengths)
        weaknesses_text = "\n".join(f"- {w}" for w in critique.weaknesses)
        gaps_text = "\n".join(f"- {g}" for g in summary.gaps + critique.missing_angles)

        prompt = (
            f"Write a comprehensive research report in Markdown for the topic: {topic}\n\n"
            f"Executive Summary source:\n{summary.executive_summary}\n\n"
            f"Key Findings:\n{findings_text}\n\n"
            f"Critical Analysis — Strengths:\n{strengths_text}\n"
            f"Weaknesses:\n{weaknesses_text}\n\n"
            f"Gaps and Future Research:\n{gaps_text}\n\n"
            f"Sources:\n{sources_text}\n\n"
            "Structure the report with these sections:\n"
            "# Title\n"
            "## Executive Summary\n"
            "## Key Findings\n"
            "## Critical Analysis\n"
            "## Gaps and Future Research\n"
            "## Sources\n\n"
            "Return ONLY the markdown content, no code fences."
        )
        messages = [
            SystemMessage(content="You are a professional research report writer."),
            HumanMessage(content=prompt),
        ]
        response = self.llm.invoke(messages)
        markdown_content = response.content if isinstance(response.content, str) else str(response.content)
        markdown_content = markdown_content.strip()
        if markdown_content.startswith("```"):
            markdown_content = re.sub(r"^```(?:markdown)?\n?", "", markdown_content)
            markdown_content = re.sub(r"\n?```$", "", markdown_content)

        title_match = re.search(r"^#\s+(.+)$", markdown_content, re.MULTILINE)
        title = title_match.group(1).strip() if title_match else f"Research Report: {topic}"

        ARTIFACTS_DIR.mkdir(parents=True, exist_ok=True)
        timestamp = datetime.now(timezone.utc).strftime("%Y%m%d_%H%M%S")
        filename = f"{self._slugify(topic)}_{timestamp}.md"
        filepath = ARTIFACTS_DIR / filename
        filepath.write_text(markdown_content, encoding="utf-8")

        word_count = len(markdown_content.split())

        log_agent_event(
            self.logger,
            "LLM_CALL",
            prompt[:500],
            markdown_content[:200],
            time.perf_counter() - start,
            {"word_count": word_count},
        )
        log_agent_event(
            self.logger,
            "COMPLETE",
            topic,
            f"Report saved: {filename}",
            time.perf_counter() - start,
            {"filepath": str(filepath), "word_count": word_count},
        )

        return Report(
            title=title,
            markdown_content=markdown_content,
            filepath=str(filepath),
            word_count=word_count,
        )
