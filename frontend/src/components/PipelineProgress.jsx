import { useEffect, useRef } from 'react';
import { Search, FileText, MessageSquare, FileOutput, Activity } from 'lucide-react';
import AgentStatusCard from './AgentStatusCard';

const AGENTS = [
  { key: 'researcher', label: 'Researcher', icon: Search },
  { key: 'summarizer', label: 'Summarizer', icon: FileText },
  { key: 'critic', label: 'Critic', icon: MessageSquare },
  { key: 'reporter', label: 'Reporter', icon: FileOutput },
];

const LOG_COLORS = {
  running: 'text-primary-light',
  complete: 'text-success',
  error: 'text-error',
};

/**
 * Full pipeline progress view with agent cards and live log stream.
 */
export default function PipelineProgress({ agentStatuses, logLines, topic }) {
  const logRef = useRef(null);
  const completedCount = AGENTS.filter(
    (agent) => agentStatuses[agent.key]?.status === 'complete',
  ).length;
  const runningAgent = AGENTS.find((a) => agentStatuses[a.key]?.status === 'running');
  const progressPercent = (completedCount / AGENTS.length) * 100;
  const estimatedRemaining = Math.max(0, Math.round((4 - completedCount) * 7.5));

  useEffect(() => {
    if (logRef.current) {
      logRef.current.scrollTop = logRef.current.scrollHeight;
    }
  }, [logLines]);

  return (
    <div className="w-full animate-fade-in space-y-8">
      <div className="text-center">
        <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/10 px-4 py-1.5 text-xs font-medium text-primary-light">
          <Activity className="h-3.5 w-3.5 animate-pulse" aria-hidden="true" />
          Pipeline active
        </div>
        <h2 className="text-2xl font-bold tracking-tight md:text-3xl">
          <span className="gradient-text">Running Research Pipeline</span>
        </h2>
        {topic && (
          <p className="mt-2 text-sm text-text-muted">
            Researching: <span className="text-text-secondary">{topic}</span>
          </p>
        )}
      </div>

      <div className="space-y-3">
        {AGENTS.map((agent, index) => (
          <AgentStatusCard
            key={agent.key}
            name={agent.key}
            icon={agent.icon}
            status={agentStatuses[agent.key]?.status || 'waiting'}
            duration={agentStatuses[agent.key]?.duration}
            index={index}
          />
        ))}
      </div>

      <div className="glass-card space-y-3 p-5">
        <div className="flex items-center justify-between text-sm">
          <span className="text-text-secondary">
            <span className="font-semibold text-text-primary">{completedCount}</span>
            <span className="text-text-muted"> / {AGENTS.length} agents complete</span>
          </span>
          {completedCount < 4 && (
            <span className="text-text-muted">~{estimatedRemaining}s remaining</span>
          )}
        </div>
        <div className="relative h-2 overflow-hidden rounded-full bg-white/[0.06]">
          <div
            className="absolute inset-y-0 left-0 rounded-full bg-gradient-to-r from-primary via-primary-light to-primary-dark transition-all duration-700 ease-out"
            style={{ width: `${progressPercent}%` }}
            role="progressbar"
            aria-valuenow={completedCount}
            aria-valuemin={0}
            aria-valuemax={AGENTS.length}
          />
          {progressPercent > 0 && progressPercent < 100 && (
            <div
              className="absolute inset-y-0 rounded-full bg-white/20 animate-shimmer"
              style={{
                width: `${progressPercent}%`,
                backgroundSize: '200% 100%',
                backgroundImage: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.15), transparent)',
              }}
            />
          )}
        </div>
        {runningAgent && (
          <p className="text-xs text-text-muted">
            Currently: <span className="text-primary-light">{runningAgent.label}</span>
          </p>
        )}
      </div>

      <div className="terminal-window">
        <div className="terminal-header">
          <span className="terminal-dot bg-error/80" />
          <span className="terminal-dot bg-warning/80" />
          <span className="terminal-dot bg-success/80" />
          <span className="ml-2 font-mono text-xs text-text-muted">pipeline-events.stream</span>
        </div>
        <div
          ref={logRef}
          className="scrollbar-thin h-52 overflow-y-auto p-4 font-mono text-xs leading-relaxed md:h-60"
          aria-live="polite"
          aria-label="Pipeline log stream"
        >
          {logLines.length === 0 ? (
            <p className="text-text-muted">
              <span className="text-primary">$</span> waiting for agent events...
            </p>
          ) : (
            logLines.map((line, index) => {
              const statusMatch = line.match(/\] (running|complete|error)/);
              const status = statusMatch?.[1] || 'running';
              return (
                <div
                  key={index}
                  className="mb-1.5 animate-fade-in opacity-90"
                  style={{ animationDelay: `${index * 30}ms` }}
                >
                  <span className="text-text-muted">{String(index + 1).padStart(2, '0')}</span>
                  <span className="mx-2 text-primary">▸</span>
                  <span className={LOG_COLORS[status] || 'text-text-secondary'}>{line}</span>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
