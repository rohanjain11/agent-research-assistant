"""Web search tool using DuckDuckGo."""

import time
from typing import Any

from ddgs import DDGS
from langchain_core.tools import StructuredTool

from ..logger import get_logger, log_agent_event

_logger = get_logger("researcher")

DEFAULT_MAX_RETRIES = 3
DEFAULT_RETRY_DELAY = 1.5


def search_web(
    query: str,
    max_results: int = 5,
    max_retries: int = DEFAULT_MAX_RETRIES,
    retry_delay: float = DEFAULT_RETRY_DELAY,
) -> list[dict[str, str]]:
    """Search the web via DuckDuckGo with retries when results are empty.

    Args:
        query: Search query string.
        max_results: Maximum number of results to return per attempt.
        max_retries: Number of attempts before giving up.
        retry_delay: Base delay in seconds between retries (scaled by attempt).

    Returns:
        List of dicts with title, url, and snippet keys.
    """
    start = time.perf_counter()
    last_error: Exception | None = None

    for attempt in range(max_retries):
        try:
            raw_results = list(DDGS().text(query, max_results=max_results))

            results: list[dict[str, str]] = []
            for item in raw_results:
                results.append(
                    {
                        "title": item.get("title", ""),
                        "url": item.get("href", item.get("link", "")),
                        "snippet": item.get("body", item.get("snippet", "")),
                    }
                )

            if results:
                log_agent_event(
                    _logger,
                    "TOOL_CALL",
                    query,
                    f"{len(results)} results",
                    time.perf_counter() - start,
                    {
                        "tool": "web_search",
                        "max_results": max_results,
                        "result_count": len(results),
                        "attempt": attempt + 1,
                    },
                )
                return results

            if attempt < max_retries - 1:
                time.sleep(retry_delay * (attempt + 1))

        except Exception as exc:
            last_error = exc
            if attempt < max_retries - 1:
                time.sleep(retry_delay * (attempt + 1))
            else:
                log_agent_event(
                    _logger,
                    "ERROR",
                    query,
                    str(exc),
                    time.perf_counter() - start,
                    {"tool": "web_search", "attempt": attempt + 1},
                )
                raise

    log_agent_event(
        _logger,
        "TOOL_CALL",
        query,
        "0 results after retries",
        time.perf_counter() - start,
        {
            "tool": "web_search",
            "max_results": max_results,
            "result_count": 0,
            "attempts": max_retries,
            "error": str(last_error) if last_error else None,
        },
    )
    return []


def format_search_results(results: list[dict[str, str]]) -> str:
    """Format search results as a numbered string for LLM consumption.

    Args:
        results: List of search result dicts.

    Returns:
        Formatted multi-line string.
    """
    if not results:
        return "No search results found."

    lines: list[str] = []
    for index, result in enumerate(results, start=1):
        lines.append(f"{index}. {result.get('title', 'Untitled')}")
        lines.append(f"   URL: {result.get('url', '')}")
        lines.append(f"   {result.get('snippet', '')}")
        lines.append("")
    return "\n".join(lines).strip()


def _search_web_tool(query: str) -> str:
    """LangChain-compatible wrapper returning formatted search results."""
    results = search_web(query, max_results=5)
    return format_search_results(results)


SearchTool = StructuredTool.from_function(
    func=_search_web_tool,
    name="web_search",
    description="Search the web for information on a given query. Returns titles, URLs, and snippets.",
)
