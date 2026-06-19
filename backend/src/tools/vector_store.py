"""ChromaDB local persistent vector store utilities."""

from pathlib import Path
from typing import Any, Optional

import chromadb
from chromadb.api.models.Collection import Collection

from ..logger import BACKEND_ROOT

CHROMA_DIR = BACKEND_ROOT / "chroma_db"

_client: Optional[chromadb.PersistentClient] = None


def get_chroma_client() -> chromadb.PersistentClient:
    """Return a persistent ChromaDB client pointing to chroma_db/.

    Returns:
        Persistent ChromaDB client instance.
    """
    global _client
    if _client is None:
        CHROMA_DIR.mkdir(parents=True, exist_ok=True)
        _client = chromadb.PersistentClient(path=str(CHROMA_DIR))
    return _client


def get_or_create_collection(collection_name: str) -> Collection:
    """Get or create a named ChromaDB collection.

    Args:
        collection_name: Name of the collection.

    Returns:
        ChromaDB Collection instance.
    """
    client = get_chroma_client()
    return client.get_or_create_collection(name=collection_name)


def add_documents(
    collection: Collection,
    texts: list[str],
    metadatas: list[dict[str, Any]],
    ids: list[str],
) -> None:
    """Upsert document chunks with metadata into a collection.

    Args:
        collection: Target ChromaDB collection.
        texts: Document text chunks.
        metadatas: Metadata dict per chunk.
        ids: Unique IDs per chunk.
    """
    if not texts:
        return
    collection.upsert(documents=texts, metadatas=metadatas, ids=ids)


def query_similar(
    collection: Collection,
    query_text: str,
    n_results: int = 3,
) -> dict[str, Any]:
    """Retrieve top-n similar chunks for a query using built-in embeddings.

    Args:
        collection: ChromaDB collection to query.
        query_text: Query string.
        n_results: Number of results to return.

    Returns:
        ChromaDB query result dict with documents, metadatas, and distances.
    """
    count = collection.count()
    if count == 0:
        return {"documents": [[]], "metadatas": [[]], "distances": [[]]}

    effective_n = min(n_results, count)
    return collection.query(query_texts=[query_text], n_results=effective_n)


def clear_collection(collection_name: str) -> None:
    """Clear all documents from a collection, recreating it if needed.

    Args:
        collection_name: Name of the collection to clear.
    """
    client = get_chroma_client()
    try:
        client.delete_collection(name=collection_name)
    except (ValueError, chromadb.errors.NotFoundError):
        pass
    client.get_or_create_collection(name=collection_name)
