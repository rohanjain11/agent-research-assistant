import { Check, AlertCircle, Clock } from 'lucide-react';

const STATUS_CONFIG = {
  waiting: {
    iconBg: 'bg-white/[0.04]',
    ring: 'ring-white/[0.06]',
    text: 'text-text-muted',
    label: 'Waiting',
    card: 'opacity-60',
  },
  running: {
    iconBg: 'bg-primary/20',
    ring: 'ring-primary/30',
    text: 'text-primary-light',
    label: 'Running',
    card: 'border-primary/30 shadow-glow-sm',
  },
  complete: {
    iconBg: 'bg-success/15',
    ring: 'ring-success/25',
    text: 'text-success',
    label: 'Complete',
    card: 'border-success/20',
  },
  error: {
    iconBg: 'bg-error/15',
    ring: 'ring-error/25',
    text: 'text-error',
    label: 'Failed',
    card: 'border-error/30',
  },
};

const AGENT_DESCRIPTIONS = {
  researcher: 'Searching the web & extracting findings',
  summarizer: 'Synthesizing executive summary',
  critic: 'Reviewing quality & gaps',
  reporter: 'Writing final markdown report',
};

/**
 * Compact status card for a single pipeline agent.
 */
export default function AgentStatusCard({ name, icon: Icon, status, duration, index = 0 }) {
  const config = STATUS_CONFIG[status] || STATUS_CONFIG.waiting;
  const displayName = name.charAt(0).toUpperCase() + name.slice(1);
  const description = AGENT_DESCRIPTIONS[name] || '';

  return (
    <div
      className={`glass-card flex items-center gap-4 p-4 transition-all duration-500 animate-slide-up ${config.card}`}
      style={{ animationDelay: `${index * 80}ms` }}
      role="status"
      aria-label={`${displayName} agent ${config.label}`}
    >
      <div
        className={`relative flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ring-1 ${config.iconBg} ${config.ring} transition-all duration-300`}
      >
        {status === 'running' && (
          <span className="absolute inset-0 animate-ping rounded-xl bg-primary/20" aria-hidden="true" />
        )}
        <Icon className={`relative h-5 w-5 ${config.text}`} aria-hidden="true" />
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <p className="font-semibold text-text-primary">{displayName}</p>
          {status === 'complete' && (
            <Check className="h-3.5 w-3.5 text-success" aria-hidden="true" />
          )}
          {status === 'error' && (
            <AlertCircle className="h-3.5 w-3.5 text-error" aria-hidden="true" />
          )}
        </div>
        <p className="truncate text-xs text-text-muted">{description}</p>
      </div>

      <div className="flex shrink-0 flex-col items-end gap-1">
        <span className={`text-xs font-medium ${config.text}`}>{config.label}</span>
        {status === 'running' && (
          <span className="relative flex h-2 w-2" aria-hidden="true">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary opacity-75" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-primary" />
          </span>
        )}
        {status === 'complete' && duration != null && (
          <span className="flex items-center gap-1 font-mono text-xs text-success">
            <Clock className="h-3 w-3" aria-hidden="true" />
            {duration.toFixed(1)}s
          </span>
        )}
      </div>
    </div>
  );
}
