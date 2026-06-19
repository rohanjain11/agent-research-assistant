# ResearchAgent — Multi-Agent Research Assistant

A production-style multi-agent research system where four specialized AI agents collaborate end-to-end to investigate a topic, critique the output, and produce a structured markdown report — with full observability at every step.

Built for portfolio and interview demos. Designed to show real agentic patterns: tool use, vector retrieval, structured logging, graceful failure, and a polished dark-themed React frontend with glass-morphism UI and live SSE progress streaming.

---

## Live Demo

| | URL |
|---|-----|
| **Frontend** (GitHub Pages) | [rohanjain11.github.io/agent-research-assistant](https://rohanjain11.github.io/agent-research-assistant/) |
| **Backend API** (Render) | [agent-research-assistant-api.onrender.com](https://agent-research-assistant-api.onrender.com) |
| **Health check** | […/health](https://agent-research-assistant-api.onrender.com/health) |

> **Note:** Render free tier sleeps after ~15 min idle. The first request after sleep may take 30–60s to wake the backend.

**Example topics to try:** Future of quantum computing · Climate change mitigation strategies · Large language model alignment

---

## What It Does

Given a research topic (e.g. *"Climate change mitigation strategies"*), the pipeline:

1. **Researcher** — generates search queries, searches the web, stores snippets in ChromaDB, retrieves the most relevant chunks, and extracts structured findings
2. **Summarizer** — produces an executive summary, key points, and knowledge gaps
3. **Critic** — reviews strengths, weaknesses, missing angles, and suggested follow-ups
4. **Reporter** — writes a final markdown report and saves it to `backend/artifacts/`

Every LLM call and tool invocation is logged as structured JSON. The frontend streams live agent progress via Server-Sent Events.

---

## Architecture

```
User Query (React UI)
        │
        ▼
   FastAPI + SSE
        │
        ▼
┌─────────────┐    ┌─────────────┐    ┌─────────────┐    ┌─────────────┐
│ Researcher  │───▶│ Summarizer  │───▶│   Critic    │───▶│  Reporter   │
│ Web search  │    │  LLM synth  │    │  LLM review │    │ MD report   │
│ + ChromaDB  │    │             │    │             │    │ + artifacts │
└─────────────┘    └─────────────┘    └─────────────┘    └─────────────┘
       │                  │                  │                  │
       └──────────────────┴──────────────────┴──────────────────┘
                         Structured JSON Logs
                    backend/logs/{agent}.log
```

**Production topology:**

```
GitHub Pages (React)          Render (FastAPI)
rohanjain11.github.io/   →    agent-research-assistant-api.onrender.com
agent-research-assistant/          │
                                   POST /research?stream=true (SSE)
                                   GET  /health, /logs/{agent}, /artifacts
```

---

## Features

### Backend
- **4-agent sequential pipeline** orchestrated with per-agent timing and error handling
- **Web search** via DuckDuckGo (`ddgs` library, free, no API key)
- **Local vector store** — ChromaDB with built-in embeddings (all-MiniLM-L6-v2, no API cost)
- **Structured JSON logging** — every `LLM_CALL`, `TOOL_CALL`, `COMPLETE`, and `ERROR` event logged to stdout and per-agent log files
- **SSE streaming** — real-time agent progress pushed to the frontend
- **Quality safeguards:**
  - Search retries (3 attempts with backoff) when results are empty
  - Relevance filtering — blocks junk domains (e.g. `climate.com`) and scores results by topic keyword overlap
  - Fail loudly — pipeline stops with a clear error if sources are insufficient, instead of hallucinating a report

### Frontend
- **Dark glass-morphism UI** — ambient grid background, floating gradient orbs, frosted cards with inner glow (Linear / Vercel aesthetic)
- **Landing page** — agent pipeline visual, tech stack badge, feature cards, example topic pills
- **Search bar** — focus glow, search icon, gradient submit button with loading state
- **Live pipeline view** — animated agent cards with descriptions, shimmer progress bar, macOS-style terminal log stream
- **Tabbed results** — icon tabs for Report · Summary · Critique · Sources · Stats
- **Report viewer** — styled markdown prose, word count / read time badges, one-click **Export .md**
- **Summary & critique panels** — color-coded cards for key points, gaps, strengths, weaknesses, and follow-up query pills
- **Stats dashboard** — agent duration table, inline bar charts, per-agent JSON log viewer with event badges (LLM / TOOL / DONE / ERR)
- **Motion & polish** — fade-in / slide-up animations, sticky blurred navbar, responsive layout (desktop + tablet)
- **Typography** — Inter (UI) + JetBrains Mono (logs/terminal)

---

## UI Overview

The frontend is a single-page React app with three states:

| State | What you see |
|-------|----------------|
| **Idle** | Hero headline, 4-agent pipeline diagram, search bar, example topics, feature cards |
| **Running** | Live agent status cards, progress bar, terminal event stream |
| **Complete** | Results header with stats badges, tabbed report/summary/critique/sources/stats |

Design tokens live in `frontend/tailwind.config.js` and shared utilities in `frontend/src/index.css` (`glass-card`, `gradient-text`, `btn-primary`, etc.).

---

## Tech Stack

| Layer | Technologies |
|-------|-------------|
| **Backend** | Python 3.10+, LangChain, OpenAI (`gpt-4o-mini`), ChromaDB, FastAPI, `ddgs`, python-dotenv |
| **Frontend** | React 18, Vite, Tailwind CSS, react-markdown, remark-gfm, lucide-react, Inter + JetBrains Mono |
| **Search** | DuckDuckGo via `ddgs` (free) |
| **Embeddings** | ChromaDB built-in, runs locally (free) |
| **Deployment** | GitHub Pages (frontend) · Render (backend) |

---

## Quick Start

### Prerequisites

- Python 3.10+
- Node.js 18+
- OpenAI API key

### 1. Clone and configure

```bash
git clone https://github.com/rohanjain11/agent-research-assistant.git
cd agent-research-assistant/backend
cp .env.example .env
```

Edit `backend/.env` and set your key:

```
OPENAI_API_KEY=sk-your-key-here
```

> **Do not commit `.env`** — it is gitignored. Only `.env.example` belongs in version control.

### 2. Start the backend

```bash
cd backend
pip install -r requirements.txt
uvicorn src.api:app --reload --port 8847
```

Verify: [http://localhost:8847/health](http://localhost:8847/health) → `{"status":"ok"}`

### 3. Start the frontend

In a second terminal:

```bash
cd frontend
npm install
npm run dev
```

Open [http://localhost:5173](http://localhost:5173)

### 4. Run a query

1. Enter a topic or click an example pill on the landing page
2. Click **Research**
3. Watch the 4 agent cards update in real time with a live terminal log (~30 seconds)
4. Browse results across **Report**, **Summary**, **Critique**, **Sources**, and **Stats** tabs
5. Click **Export .md** to download the report, or click a follow-up query pill to research further

---

## API Reference

| Environment | Base URL |
|-------------|----------|
| **Local dev** | `/api/*` → `http://localhost:8847/*` (Vite dev-server) |
| **Production** | `https://agent-research-assistant-api.onrender.com` (set via `VITE_API_BASE` at build time) |

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/health` | Health check and agent list |
| `POST` | `/research?stream=true` | Run full pipeline, stream SSE progress events |
| `POST` | `/research` | Run full pipeline, return JSON `PipelineState` |
| `GET` | `/logs/{agent_name}` | Last 50 structured log entries (`researcher`, `summarizer`, `critic`, `reporter`) |
| `GET` | `/artifacts` | List generated report files with size and timestamp |

### SSE event format

```
data: {"agent": "researcher", "status": "running", "duration": 0}

data: {"agent": "researcher", "status": "complete", "duration": 6.1}

data: {"type": "complete", "state": { ...full PipelineState... }}
```

---

## Project Structure

```
agent-research-assistant/
├── backend/
│   ├── src/
│   │   ├── agents/
│   │   │   ├── researcher.py    # Web search + ChromaDB + finding extraction
│   │   │   ├── summarizer.py    # Executive summary synthesis
│   │   │   ├── critic.py        # Critical review
│   │   │   └── reporter.py      # Final markdown report
│   │   ├── tools/
│   │   │   ├── search_tool.py   # DuckDuckGo search with retries
│   │   │   └── vector_store.py  # ChromaDB persistent store
│   │   ├── orchestrator.py      # Pipeline coordination + timing
│   │   ├── logger.py            # Structured JSON logging
│   │   └── api.py               # FastAPI + SSE streaming
│   ├── logs/                    # Per-agent JSON logs (gitignored)
│   ├── chroma_db/               # Vector store data (gitignored)
│   ├── artifacts/               # Generated .md reports (gitignored)
│   ├── requirements.txt
│   └── .env.example
├── frontend/
│   ├── src/
│   │   ├── api.js                    # apiUrl() — dev vs production base URL
│   │   ├── components/
│   │   │   ├── SearchBar.jsx         # Hero search with focus glow
│   │   │   ├── PipelineProgress.jsx  # Live agent cards + terminal stream
│   │   │   ├── AgentStatusCard.jsx   # Individual agent status
│   │   │   ├── ReportViewer.jsx      # Tabbed results layout
│   │   │   ├── CritiquePanel.jsx     # Strengths / weaknesses / gaps
│   │   │   ├── SourcesList.jsx       # Numbered source cards
│   │   │   └── PipelineLogs.jsx      # Per-agent JSON log viewer
│   │   ├── App.jsx                   # IDLE / RUNNING / COMPLETE states
│   │   ├── index.css                 # Glass cards, prose, terminal styles
│   │   └── main.jsx
│   ├── tailwind.config.js            # Colors, animations, design tokens
│   ├── vite.config.js                # Proxies /api → localhost:8847
│   └── package.json
├── .github/workflows/
│   └── deploy-pages.yml              # GitHub Pages CI (Node 24)
├── render.yaml                       # Render Blueprint for backend
├── .gitignore
└── README.md
```

---

## Observability

Every agent writes structured JSON log lines to both **stdout** and `backend/logs/{agent_name}.log`.

Example log entry:

```json
{
  "timestamp": "2026-06-19T02:29:41.686375+00:00",
  "agent_name": "researcher",
  "event_type": "COMPLETE",
  "input_preview": "Climate change mitigation strategies",
  "output_preview": "7 findings, 5 sources",
  "duration_seconds": 6.027,
  "metadata": {"raw_chunk_count": 5, "relevant_result_count": 5}
}
```

View logs via API:

```bash
# Local
curl http://localhost:8847/logs/researcher | python3 -m json.tool

# Production
curl https://agent-research-assistant-api.onrender.com/logs/researcher | python3 -m json.tool
```

Or in the UI: **Stats** tab → per-agent log viewer with color-coded event badges.

---

## Cost

A full pipeline run uses **`gpt-4o-mini`** (~6–8 LLM calls) and typically costs **under $0.05** per query.

| Component | Cost |
|-----------|------|
| OpenAI (`gpt-4o-mini`) | ~$0.01–0.05 per run |
| ChromaDB embeddings | Free (local) |
| DuckDuckGo search | Free |
| Render (free tier) | $0 (cold starts after idle) |
| GitHub Pages | Free |

---

## Troubleshooting

### Port already in use

```bash
# Find what's using the port
lsof -i :8847

# Kill it, then restart
uvicorn src.api:app --reload --port 8847
```

If 8847 is taken, pick another port and update `frontend/vite.config.js` dev-server target to match.

### `OPENAI_API_KEY is not set`

Copy and fill in your env file:

```bash
cd backend
cp .env.example .env
# Edit .env — key must start with sk-
```

Restart the backend after editing.

### Research fails with "Insufficient evidence"

This is intentional. The pipeline refuses to generate a report when:
- Fewer than 2 relevant sources are found
- Fewer than 3 relevant search results pass the filter
- Fewer than 3 supported findings can be extracted

**Fix:** Retry the query, rephrase the topic, or wait a moment (DuckDuckGo may rate-limit rapid searches).

### First run is slow

ChromaDB downloads an embedding model (~79 MB) on first use. Subsequent runs are faster.

### Backend not reachable from frontend

**Local:** Confirm both servers are running and the Vite dev-server in `frontend/vite.config.js` points to the same port as uvicorn (default: **8847**).

**Production (GitHub Pages):** Confirm the GitHub Actions variable `VITE_API_BASE` is set to your Render URL, then re-run the Pages deploy workflow so the frontend is rebuilt with the correct API base.

### GitHub Pages site loads but research fails

1. Check [backend /health](https://agent-research-assistant-api.onrender.com/health) — if it times out, the Render service may be waking from sleep (wait ~60s and retry)
2. Confirm `VITE_API_BASE` is set in GitHub → **Settings** → **Secrets and variables** → **Actions** → **Variables**
3. Confirm Render has `CORS_ORIGINS=https://rohanjain11.github.io`
4. Re-run **Deploy frontend to GitHub Pages** after changing `VITE_API_BASE`

---

## Deployment

| Service | Host | Status | Config |
|---------|------|--------|--------|
| **Frontend** | [GitHub Pages](https://rohanjain11.github.io/agent-research-assistant/) | live | `.github/workflows/deploy-pages.yml` |
| **Backend** | [Render](https://agent-research-assistant-api.onrender.com) | live | [`render.yaml`](render.yaml) |

### GitHub Pages (frontend)

GitHub Pages hosts static files only. The workflow in `.github/workflows/deploy-pages.yml` builds with `BASE_PATH=/agent-research-assistant/` and deploys on every push to `main`.

**One-time setup:**

1. Repo → **Settings** → **Pages** → set source to **GitHub Actions**
2. Push to `main` — workflow runs automatically

**Required for live API calls:**

| GitHub Actions variable | Value |
|-------------------------|-------|
| `VITE_API_BASE` | `https://agent-research-assistant-api.onrender.com` |

After changing this variable, re-run **Actions** → **Deploy frontend to GitHub Pages** → **Run workflow**.

### Render (backend)

Deploy via **New** → **Blueprint** → select `rohanjain11/agent-research-assistant`, then set `OPENAI_API_KEY` when prompted.

**Environment variables (set in Render):**

| Key | Value |
|-----|-------|
| `OPENAI_API_KEY` | your OpenAI key (`sk-...`) — secret |
| `CORS_ORIGINS` | `https://rohanjain11.github.io` |
| `PYTHON_VERSION` | `3.12.0` |

**Manual deploy alternative** — **New** → **Web Service** with root directory `backend`, build `pip install -r requirements.txt`, start `uvicorn src.api:app --host 0.0.0.0 --port $PORT`.

**Production notes:**

- **Cold starts:** Free tier sleeps after ~15 min idle; first request may take 30–60s
- **First research run:** ChromaDB downloads an embedding model (~79 MB) on first boot
- **Ephemeral disk:** logs, ChromaDB, and artifacts reset on redeploy

### Local development

| Service | URL |
|---------|-----|
| Frontend | http://localhost:5173 |
| Backend | http://localhost:8847 |
| API proxy | `/api/*` → backend (via Vite) |

---

## License

MIT — use freely for learning, portfolios, and interviews.
