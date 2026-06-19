"""Researcher agent: searches the web, stores findings, and extracts structured data."""

import json
import re
import time
import uuid
from dataclasses import asdict, dataclass
from typing import Any
from urllib.parse import urlparse

from langchain_openai import ChatOpenAI
from langchain_core.messages import HumanMessage, SystemMessage

from ..logger import get_logger, log_agent_event
from ..tools.search_tool import format_search_results, search_web
from ..tools.vector_store import add_documents, clear_collection, get_or_create_collection, query_similar

COLLECTION_NAME = "research_chunks"
MIN_RELEVANT_RESULTS = 3
MIN_RELEVANT_SOURCES = 2

STOPWORDS = {
    "a", "an", "the", "and", "or", "of", "in", "on", "for", "to", "with", "by",
    "is", "are", "was", "were", "be", "been", "being", "have", "has", "had",
    "do", "does", "did", "will", "would", "could", "should", "may", "might",
    "that", "this", "these", "those", "it", "its", "at", "from", "as", "about",
}

# Domains that often appear for ambiguous topics but are not substantive research sources.
BLOCKED_DOMAINS = {
    "climate.com",
    "weatherspark.com",
    "usclimatedata.com",
    "weather.com",
    "accuweather.com",
}

# Wikipedia paths that define generic concepts rather than the research topic.
BLOCKED_WIKIPEDIA_SUFFIXES = {
    "/wiki/climate",
    "/wiki/weather",
}


class InsufficientEvidenceError(Exception):
    """Raised when search results are too sparse or irrelevant to research a topic."""


@dataclass
class ResearchFindings:
    """Structured output from the researcher agent."""

    topic: str
    findings: list[str]
    sources: list[str]
    raw_chunk_count: int

    def to_dict(self) -> dict[str, Any]:
        """Convert to a JSON-serializable dict."""
        return asdict(self)


class ResearcherAgent:
    """Agent that searches the web and extracts structured research findings."""

    def __init__(self, model_name: str = "gpt-4o-mini") -> None:
        """Initialize the researcher with an OpenAI chat model.

        Args:
            model_name: OpenAI model identifier.
        """
        self.llm = ChatOpenAI(model=model_name, temperature=0.3)
        self.logger = get_logger("researcher")

    @staticmethod
    def _topic_keywords(topic: str) -> list[str]:
        """Extract significant keywords from a research topic.

        Args:
            topic: Research topic string.

        Returns:
            List of lowercase keyword tokens.
        """
        tokens = re.findall(r"[a-z0-9]+", topic.lower())
        return [token for token in tokens if len(token) > 2 and token not in STOPWORDS]

    @staticmethod
    def _normalize_domain(url: str) -> str:
        """Return the hostname for a URL without a leading www prefix.

        Args:
            url: Source URL.

        Returns:
            Normalized domain or empty string.
        """
        try:
            hostname = urlparse(url).netloc.lower()
        except ValueError:
            return ""
        return hostname.removeprefix("www.")

    @classmethod
    def _is_blocked_source(cls, url: str) -> bool:
        """Return True if a URL belongs to a known irrelevant domain or path.

        Args:
            url: Source URL.

        Returns:
            True when the source should be excluded.
        """
        domain = cls._normalize_domain(url)
        if domain in BLOCKED_DOMAINS:
            return True

        lowered_url = url.lower()
        if "wikipedia.org" in lowered_url:
            path = urlparse(url).path.lower()
            if path in BLOCKED_WIKIPEDIA_SUFFIXES:
                return True

        return False

    @classmethod
    def _relevance_score(cls, result: dict[str, str], keywords: list[str]) -> int:
        """Score how closely a search result matches the research topic.

        Args:
            result: Search result dict.
            keywords: Topic keywords.

        Returns:
            Integer relevance score (higher is better).
        """
        if not keywords:
            return 0

        title = result.get("title", "").lower()
        snippet = result.get("snippet", "").lower()
        combined = f"{title} {snippet}"
        score = 0

        for keyword in keywords:
            if keyword in title:
                score += 2
            elif keyword in combined:
                score += 1

        return score

    @classmethod
    def _is_relevant_result(cls, result: dict[str, str], keywords: list[str]) -> bool:
        """Determine whether a search result is relevant to the topic.

        Args:
            result: Search result dict.
            keywords: Topic keywords.

        Returns:
            True if the result passes relevance and blocklist checks.
        """
        url = result.get("url", "")
        if not url or cls._is_blocked_source(url):
            return False

        min_score = min(3, max(2, len(keywords)))
        return cls._relevance_score(result, keywords) >= min_score

    @staticmethod
    def _dedupe_results(results: list[dict[str, str]]) -> list[dict[str, str]]:
        """Remove duplicate search results by URL.

        Args:
            results: Raw search results.

        Returns:
            Deduplicated results preserving first-seen order.
        """
        seen: set[str] = set()
        unique: list[dict[str, str]] = []
        for result in results:
            url = result.get("url", "").strip()
            if not url or url in seen:
                continue
            seen.add(url)
            unique.append(result)
        return unique

    def _build_fallback_queries(self, topic: str, primary_queries: list[str]) -> list[str]:
        """Build additional search queries when primary queries underperform.

        Args:
            topic: Research topic.
            primary_queries: Queries already planned by the LLM.

        Returns:
            Ordered unique query list including fallbacks.
        """
        fallbacks = [
            topic,
            f"{topic} policy solutions",
            f"{topic} IPCC report",
            f"{topic} scientific research",
            f'"{topic}"',
        ]
        ordered: list[str] = []
        seen: set[str] = set()
        for query in [*primary_queries, *fallbacks]:
            normalized = query.strip().lower()
            if normalized and normalized not in seen:
                seen.add(normalized)
                ordered.append(query.strip())
        return ordered

    def _generate_search_queries(self, topic: str) -> list[str]:
        """Use LLM to generate three targeted search queries.

        Args:
            topic: Research topic.

        Returns:
            List of three search query strings.
        """
        start = time.perf_counter()
        prompt = (
            f"Generate exactly 3 diverse, targeted web search queries to research this topic:\n"
            f'"{topic}"\n\n'
            "Focus on authoritative sources (research, policy, science).\n"
            "Return ONLY a JSON array of 3 strings, no other text."
        )
        messages = [
            SystemMessage(content="You are a research query planner. Output valid JSON only."),
            HumanMessage(content=prompt),
        ]
        response = self.llm.invoke(messages)
        content = response.content if isinstance(response.content, str) else str(response.content)

        try:
            queries = json.loads(content.strip())
            if not isinstance(queries, list):
                raise ValueError("Expected JSON array")
            queries = [str(q) for q in queries[:3]]
        except (json.JSONDecodeError, ValueError):
            queries = [
                f"{topic} overview",
                f"{topic} latest developments",
                f"{topic} key challenges",
            ]

        while len(queries) < 3:
            queries.append(f"{topic} research {len(queries) + 1}")

        log_agent_event(
            self.logger,
            "LLM_CALL",
            prompt,
            json.dumps(queries),
            time.perf_counter() - start,
            {"step": "generate_search_queries"},
        )
        return queries[:3]

    def _extract_findings(self, topic: str, context: str) -> list[str]:
        """Extract structured findings from retrieved context via LLM.

        Args:
            topic: Research topic.
            context: Concatenated relevant chunks.

        Returns:
            List of finding strings.
        """
        start = time.perf_counter()
        prompt = (
            f"Topic: {topic}\n\n"
            f"Context from web search:\n{context}\n\n"
            "Extract 5-8 key research findings as concise bullet points.\n"
            "Rules:\n"
            "- Only include findings directly supported by the context.\n"
            "- Do not infer or invent information not present in the context.\n"
            "- If the context is off-topic or insufficient, return an empty JSON array [].\n"
            "Return ONLY a JSON array of strings."
        )
        messages = [
            SystemMessage(
                content=(
                    "You are a rigorous research analyst. "
                    "Never hallucinate. Output valid JSON only."
                )
            ),
            HumanMessage(content=prompt),
        ]
        response = self.llm.invoke(messages)
        content = response.content if isinstance(response.content, str) else str(response.content)
        content = content.strip()
        if content.startswith("```"):
            content = re.sub(r"^```(?:json)?\n?", "", content)
            content = re.sub(r"\n?```$", "", content)

        try:
            findings = json.loads(content.strip())
            if isinstance(findings, list):
                findings = [str(f).strip() for f in findings if str(f).strip()]
            else:
                findings = []
        except json.JSONDecodeError:
            findings = [
                line.strip("- •").strip()
                for line in content.split("\n")
                if line.strip() and not line.strip().startswith("[")
            ][:8]

        log_agent_event(
            self.logger,
            "LLM_CALL",
            prompt[:500],
            json.dumps(findings[:3]),
            time.perf_counter() - start,
            {"step": "extract_findings", "finding_count": len(findings)},
        )
        return findings

    def _validate_evidence(
        self,
        topic: str,
        relevant_results: list[dict[str, str]],
        findings: list[str],
        queries_attempted: int,
    ) -> None:
        """Fail loudly when there is not enough evidence to research a topic.

        Args:
            topic: Research topic.
            relevant_results: Filtered relevant search results.
            findings: Extracted findings from LLM.
            queries_attempted: Number of search queries attempted.

        Raises:
            InsufficientEvidenceError: When evidence thresholds are not met.
        """
        source_count = len({r.get("url", "") for r in relevant_results if r.get("url")})

        if source_count < MIN_RELEVANT_SOURCES:
            raise InsufficientEvidenceError(
                f"Insufficient evidence for topic '{topic}'. "
                f"Only {source_count} relevant source(s) found after "
                f"{queries_attempted} search queries (minimum: {MIN_RELEVANT_SOURCES}). "
                "Search results were empty, irrelevant, or blocked. "
                "Try again later or rephrase the topic."
            )

        if len(relevant_results) < MIN_RELEVANT_RESULTS:
            raise InsufficientEvidenceError(
                f"Insufficient evidence for topic '{topic}'. "
                f"Only {len(relevant_results)} relevant result(s) found "
                f"(minimum: {MIN_RELEVANT_RESULTS}). "
                "Try again later or rephrase the topic."
            )

        if len(findings) < 3:
            raise InsufficientEvidenceError(
                f"Insufficient evidence for topic '{topic}'. "
                f"Only {len(findings)} supported finding(s) could be extracted from "
                f"{source_count} source(s). The retrieved content may be off-topic. "
                "Try again later or rephrase the topic."
            )

    def run(self, topic: str) -> ResearchFindings:
        """Execute the full research pipeline for a topic.

        Args:
            topic: Research topic to investigate.

        Returns:
            ResearchFindings with extracted data and sources.

        Raises:
            InsufficientEvidenceError: When search results are too sparse or irrelevant.
        """
        start = time.perf_counter()
        clear_collection(COLLECTION_NAME)
        collection = get_or_create_collection(COLLECTION_NAME)

        keywords = self._topic_keywords(topic)
        primary_queries = self._generate_search_queries(topic)
        all_queries = self._build_fallback_queries(topic, primary_queries)

        raw_results: list[dict[str, str]] = []
        for query in all_queries:
            results = search_web(query, max_results=5)
            raw_results.extend(results)
            time.sleep(0.5)

            relevant_so_far = [
                r for r in self._dedupe_results(raw_results) if self._is_relevant_result(r, keywords)
            ]
            if len(relevant_so_far) >= MIN_RELEVANT_RESULTS:
                break

        deduped_raw = self._dedupe_results(raw_results)
        relevant_results = [r for r in deduped_raw if self._is_relevant_result(r, keywords)]

        log_agent_event(
            self.logger,
            "TOOL_CALL",
            topic,
            f"{len(relevant_results)}/{len(deduped_raw)} relevant results",
            time.perf_counter() - start,
            {
                "step": "relevance_filter",
                "queries_attempted": len(all_queries),
                "raw_result_count": len(deduped_raw),
                "relevant_result_count": len(relevant_results),
            },
        )

        sources: set[str] = set()
        chunk_count = 0
        texts: list[str] = []
        metadatas: list[dict[str, str]] = []
        ids: list[str] = []

        for result in relevant_results:
            url = result.get("url", "")
            if url:
                sources.add(url)
            chunk_text = (
                f"Title: {result.get('title', '')}\n"
                f"URL: {url}\n"
                f"Snippet: {result.get('snippet', '')}"
            )
            texts.append(chunk_text)
            metadatas.append({"url": url, "title": result.get("title", ""), "query": topic})
            ids.append(str(uuid.uuid4()))

        if texts:
            add_documents(collection, texts, metadatas, ids)
            chunk_count = len(texts)

        similar = query_similar(collection, topic, n_results=8)
        documents = similar.get("documents", [[]])[0]
        context = (
            "\n\n---\n\n".join(documents)
            if documents
            else format_search_results(relevant_results[:10])
        )

        findings = self._extract_findings(topic, context)
        self._validate_evidence(topic, relevant_results, findings, len(all_queries))

        result = ResearchFindings(
            topic=topic,
            findings=findings,
            sources=sorted(sources),
            raw_chunk_count=chunk_count,
        )

        log_agent_event(
            self.logger,
            "COMPLETE",
            topic,
            f"{len(findings)} findings, {len(sources)} sources",
            time.perf_counter() - start,
            {"raw_chunk_count": chunk_count, "relevant_result_count": len(relevant_results)},
        )
        return result
