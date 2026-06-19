import { useState, useEffect, useCallback } from 'react';
import { Terminal } from 'lucide-react';
import { apiUrl } from '../api';

const AGENTS = ['researcher', 'summarizer', 'critic', 'reporter'];

const EVENT_STYLES = {
  LLM_CALL: { badge: 'bg-primary/15 text-primary-light', label: 'LLM' },
  TOOL_CALL: { badge: 'bg-warning/15 text-warning', label: 'TOOL' },
  COMPLETE: { badge: 'bg-success/15 text-success', label: 'DONE' },
  ERROR: { badge: 'bg-error/15 text-error', label: 'ERR' },
};

/**
 * Structured JSON logs viewer with per-agent tabs.
 */
export default function PipelineLogs() {
  const [activeAgent, setActiveAgent] = useState('researcher');
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const fetchLogs = useCallback(async (agentName) => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(apiUrl(`/logs/${agentName}`));
      if (!response.ok) {
        throw new Error(`Failed to fetch logs (${response.status})`);
      }
      const data = await response.json();
      setEntries(data.entries || []);
    } catch (err) {
      setError(err.message);
      setEntries([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchLogs(activeAgent);
  }, [activeAgent, fetchLogs]);

  return (
    <div className="terminal-window">
      <div className="terminal-header">
        <span className="terminal-dot bg-error/80" />
        <span className="terminal-dot bg-warning/80" />
        <span className="terminal-dot bg-success/80" />
        <Terminal className="ml-1 h-3.5 w-3.5 text-text-muted" aria-hidden="true" />
        <span className="font-mono text-xs text-text-muted">agent-logs.json</span>
      </div>

      <div className="flex flex-wrap gap-1 border-b border-white/[0.06] p-2" role="tablist">
        {AGENTS.map((agent) => (
          <button
            key={agent}
            role="tab"
            aria-selected={activeAgent === agent}
            onClick={() => setActiveAgent(agent)}
            className={`rounded-lg px-3 py-1.5 text-xs font-medium capitalize transition-all duration-200 ${
              activeAgent === agent
                ? 'bg-primary/20 text-primary-light ring-1 ring-primary/30'
                : 'text-text-muted hover:bg-white/[0.04] hover:text-text-secondary'
            }`}
          >
            {agent}
          </button>
        ))}
      </div>

      <div
        className="scrollbar-thin max-h-72 overflow-y-auto p-4 font-mono text-xs"
        aria-live="polite"
        aria-label={`${activeAgent} agent logs`}
      >
        {loading && (
          <p className="text-text-muted">
            <span className="text-primary">$</span> loading logs...
          </p>
        )}
        {error && <p className="text-error">{error}</p>}
        {!loading && !error && entries.length === 0 && (
          <p className="text-text-muted">No log entries yet.</p>
        )}
        {!loading &&
          !error &&
          entries.map((entry, index) => {
            const style = EVENT_STYLES[entry.event_type] || {
              badge: 'bg-white/[0.06] text-text-secondary',
              label: entry.event_type,
            };
            const time = entry.timestamp
              ? new Date(entry.timestamp).toLocaleTimeString()
              : '';
            return (
              <div
                key={index}
                className="mb-3 rounded-lg border border-white/[0.04] bg-white/[0.02] p-3 last:mb-0"
              >
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-text-muted">{time}</span>
                  <span className={`rounded px-1.5 py-0.5 text-[10px] font-bold ${style.badge}`}>
                    {style.label}
                  </span>
                  <span className="text-text-muted">{entry.duration_seconds}s</span>
                </div>
                {entry.input_preview && (
                  <p className="mt-2 text-text-muted">
                    <span className="text-primary/70">in </span>
                    {entry.input_preview}
                  </p>
                )}
                {entry.output_preview && (
                  <p className="mt-1 text-text-secondary">
                    <span className="text-success/70">out </span>
                    {entry.output_preview}
                  </p>
                )}
              </div>
            );
          })}
      </div>
    </div>
  );
}
