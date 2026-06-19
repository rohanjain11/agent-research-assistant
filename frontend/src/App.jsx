import { useState, useCallback } from 'react';
import { Brain, RotateCcw, Search, FileText, MessageSquare, FileOutput, Zap, Shield, BarChart3, CheckCircle2 } from 'lucide-react';
import SearchBar from './components/SearchBar';
import PipelineProgress from './components/PipelineProgress';
import ReportViewer from './components/ReportViewer';
import { apiUrl } from './api';

const EXAMPLE_TOPICS = [
  'Future of quantum computing',
  'Climate change mitigation strategies',
  'Large language model alignment',
];

const AGENT_PIPELINE = [
  { icon: Search, label: 'Researcher', color: 'from-blue-500 to-indigo-500' },
  { icon: FileText, label: 'Summarizer', color: 'from-indigo-500 to-violet-500' },
  { icon: MessageSquare, label: 'Critic', color: 'from-violet-500 to-purple-500' },
  { icon: FileOutput, label: 'Reporter', color: 'from-purple-500 to-fuchsia-500' },
];

const FEATURES = [
  {
    icon: Zap,
    title: 'Real-time streaming',
    desc: 'Watch each agent complete live via SSE',
  },
  {
    icon: Shield,
    title: 'Quality safeguards',
    desc: 'Relevance filtering & fail-loud on bad data',
  },
  {
    icon: BarChart3,
    title: 'Full observability',
    desc: 'Structured JSON logs for every LLM & tool call',
  },
];

const INITIAL_AGENT_STATUSES = {
  researcher: { status: 'waiting', duration: null },
  summarizer: { status: 'waiting', duration: null },
  critic: { status: 'waiting', duration: null },
  reporter: { status: 'waiting', duration: null },
};

/**
 * Main application shell with IDLE, RUNNING, and COMPLETE states.
 */
export default function App() {
  const [appState, setAppState] = useState('IDLE');
  const [topic, setTopic] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [pipelineState, setPipelineState] = useState(null);
  const [agentStatuses, setAgentStatuses] = useState(INITIAL_AGENT_STATUSES);
  const [logLines, setLogLines] = useState([]);

  const resetPipeline = useCallback(() => {
    setAppState('IDLE');
    setLoading(false);
    setError(null);
    setPipelineState(null);
    setAgentStatuses(INITIAL_AGENT_STATUSES);
    setLogLines([]);
  }, []);

  const runResearch = useCallback(async (researchTopic) => {
    setAppState('RUNNING');
    setLoading(true);
    setError(null);
    setPipelineState(null);
    setAgentStatuses(INITIAL_AGENT_STATUSES);
    setLogLines([]);

    try {
      const response = await fetch(apiUrl('/research?stream=true'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ topic: researchTopic }),
      });

      if (!response.ok) {
        const detail = await response.text();
        throw new Error(detail || `Request failed (${response.status})`);
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const parts = buffer.split('\n\n');
        buffer = parts.pop() || '';

        for (const part of parts) {
          const line = part.trim();
          if (!line.startsWith('data:')) continue;

          const jsonStr = line.slice(5).trim();
          try {
            const event = JSON.parse(jsonStr);

            if (event.type === 'complete') {
              setPipelineState(event.state);
              if (event.state.status === 'FAILED') {
                setError(event.state.error || 'Pipeline failed');
                setAppState('RUNNING');
              } else {
                setAppState('COMPLETE');
              }
            } else if (event.type === 'error') {
              setError(event.message);
              setAppState('IDLE');
            } else if (event.agent) {
              setAgentStatuses((prev) => ({
                ...prev,
                [event.agent]: {
                  status: event.status,
                  duration: event.status === 'complete' ? event.duration : null,
                },
              }));
              setLogLines((prev) => [
                ...prev,
                `[${event.agent}] ${event.status}${event.duration ? ` (${event.duration}s)` : ''}`,
              ]);
            }
          } catch {
            /* skip malformed events */
          }
        }
      }
    } catch (err) {
      setError(err.message);
      setAppState('IDLE');
    } finally {
      setLoading(false);
    }
  }, []);

  const handleSubmit = useCallback(
    (researchTopic) => {
      setTopic(researchTopic);
      runResearch(researchTopic);
    },
    [runResearch],
  );

  const handleFollowup = useCallback(
    (query) => {
      setTopic(query);
      runResearch(query);
    },
    [runResearch],
  );

  return (
    <div className="relative min-h-screen overflow-hidden bg-background">
      {/* Ambient background */}
      <div className="pointer-events-none fixed inset-0 bg-grid-pattern bg-grid opacity-40" aria-hidden="true" />
      <div
        className="pointer-events-none fixed -left-40 top-0 h-[500px] w-[500px] rounded-full bg-primary/10 blur-[120px] animate-float"
        aria-hidden="true"
      />
      <div
        className="pointer-events-none fixed -right-40 bottom-0 h-[400px] w-[400px] rounded-full bg-primary-dark/10 blur-[100px] animate-float"
        style={{ animationDelay: '3s' }}
        aria-hidden="true"
      />

      {/* Nav */}
      <nav className="sticky top-0 z-50 border-b border-white/[0.06] bg-background/70 backdrop-blur-xl">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <button
            type="button"
            onClick={resetPipeline}
            className="flex items-center gap-3 transition-opacity hover:opacity-80"
            aria-label="Go to home"
          >
            <div className="relative flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-primary to-primary-dark shadow-glow-sm">
              <Brain className="h-5 w-5 text-white" aria-hidden="true" />
              <span className="absolute inset-0 animate-pulse-slow rounded-xl ring-1 ring-white/20" />
            </div>
            <div className="text-left">
              <span className="block text-base font-semibold text-text-primary">ResearchAgent</span>
              <span className="block text-[10px] font-medium uppercase tracking-widest text-text-muted">
                Multi-Agent System
              </span>
            </div>
          </button>
          <div className="flex items-center gap-3">
            {appState !== 'IDLE' && (
              <button type="button" onClick={resetPipeline} className="btn-ghost">
                <RotateCcw className="h-4 w-4" aria-hidden="true" />
                New Research
              </button>
            )}
          </div>
        </div>
      </nav>

      <main className="relative mx-auto max-w-6xl px-6 py-10 md:py-16">
        {appState === 'IDLE' && (
          <div className="mx-auto max-w-3xl">
            {/* Hero */}
            <div className="mb-12 space-y-6 text-center animate-fade-in">
              <div className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/10 px-4 py-1.5 text-xs font-medium text-primary-light">
                <span className="relative flex h-2 w-2">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary opacity-75" />
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-primary" />
                </span>
                LangChain · OpenAI · ChromaDB
              </div>
              <h1 className="text-4xl font-bold leading-tight tracking-tight md:text-6xl md:leading-tight">
                <span className="gradient-text">AI-Powered</span>
                <br />
                <span className="text-text-primary">Multi-Agent Research</span>
              </h1>
              <p className="mx-auto max-w-xl text-base leading-relaxed text-text-secondary md:text-lg">
                Four specialized agents search, summarize, critique, and report — with full
                observability at every step.
              </p>
            </div>

            {/* Agent pipeline visual */}
            <div className="mb-10 flex items-center justify-center gap-1 md:gap-2 animate-slide-up animate-delay-100">
              {AGENT_PIPELINE.map((agent, i) => (
                <div key={agent.label} className="flex items-center gap-1 md:gap-2">
                  <div className="flex flex-col items-center gap-2">
                    <div
                      className={`flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br ${agent.color} shadow-lg md:h-12 md:w-12`}
                    >
                      <agent.icon className="h-5 w-5 text-white" aria-hidden="true" />
                    </div>
                    <span className="hidden text-[10px] font-medium text-text-muted sm:block">
                      {agent.label}
                    </span>
                  </div>
                  {i < AGENT_PIPELINE.length - 1 && (
                    <div className="mb-4 h-px w-4 bg-gradient-to-r from-border-light to-transparent md:w-8" />
                  )}
                </div>
              ))}
            </div>

            {/* Search */}
            <div className="mb-8 animate-slide-up animate-delay-200">
              <SearchBar
                value={topic}
                onChange={setTopic}
                onSubmit={handleSubmit}
                loading={loading}
              />
            </div>

            {/* Example topics */}
            <div className="mb-12 flex flex-wrap justify-center gap-2 animate-slide-up animate-delay-300">
              <span className="w-full text-center text-xs text-text-muted mb-1">Try an example</span>
              {EXAMPLE_TOPICS.map((example) => (
                <button
                  key={example}
                  type="button"
                  onClick={() => setTopic(example)}
                  className="rounded-full border border-border-light bg-surface/60 px-4 py-2 text-sm text-text-secondary backdrop-blur-sm transition-all duration-200 hover:border-primary/40 hover:bg-primary/10 hover:text-primary-light"
                  aria-label={`Use example topic: ${example}`}
                >
                  {example}
                </button>
              ))}
            </div>

            {/* Feature cards */}
            <div className="grid gap-4 sm:grid-cols-3 animate-slide-up animate-delay-400">
              {FEATURES.map((feature) => (
                <div key={feature.title} className="glass-card-hover p-5 text-center">
                  <div className="mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10">
                    <feature.icon className="h-5 w-5 text-primary-light" aria-hidden="true" />
                  </div>
                  <p className="mb-1 text-sm font-semibold text-text-primary">{feature.title}</p>
                  <p className="text-xs leading-relaxed text-text-muted">{feature.desc}</p>
                </div>
              ))}
            </div>

            {error && (
              <div className="mt-8 rounded-2xl border border-error/30 bg-error/10 p-5 text-sm text-error animate-fade-in">
                <p className="font-semibold">Something went wrong</p>
                <p className="mt-1 text-error/80">{error}</p>
              </div>
            )}
          </div>
        )}

        {appState === 'RUNNING' && (
          <div className="mx-auto max-w-2xl space-y-6">
            <PipelineProgress
              agentStatuses={agentStatuses}
              logLines={logLines}
              topic={topic}
            />
            {error && (
              <div className="rounded-2xl border border-error/30 bg-error/10 p-5 animate-fade-in">
                <p className="font-semibold text-error">Research failed</p>
                <p className="mt-1 text-sm text-error/80">{error}</p>
                <button type="button" onClick={resetPipeline} className="btn-ghost mt-4 border-error/30 text-error hover:bg-error/10">
                  Try again
                </button>
              </div>
            )}
          </div>
        )}

        {appState === 'COMPLETE' && pipelineState && (
          <div className="animate-fade-in space-y-8">
            {/* Results header */}
            <div className="glass-card flex flex-wrap items-start justify-between gap-4 p-6">
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="h-5 w-5 text-success" aria-hidden="true" />
                  <span className="section-label">Research complete</span>
                </div>
                <h2 className="text-2xl font-bold text-text-primary md:text-3xl">
                  {pipelineState.topic}
                </h2>
                <div className="flex flex-wrap gap-2 pt-1">
                  <span className="badge">
                    {(pipelineState.total_duration || 0).toFixed(1)}s total
                  </span>
                  <span className="badge">
                    {pipelineState.research_findings?.sources?.length || 0} sources
                  </span>
                  <span className="badge">
                    {pipelineState.report?.word_count || 0} words
                  </span>
                </div>
              </div>
              <button type="button" onClick={resetPipeline} className="btn-ghost">
                <RotateCcw className="h-4 w-4" aria-hidden="true" />
                New Research
              </button>
            </div>

            <ReportViewer pipelineState={pipelineState} onFollowupClick={handleFollowup} />
          </div>
        )}
      </main>

      <footer className="relative border-t border-white/[0.04] py-6 text-center">
        <p className="text-xs text-text-muted">
          ResearchAgent · Multi-agent pipeline with structured observability
        </p>
      </footer>
    </div>
  );
}
