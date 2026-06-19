import { CheckCircle, AlertTriangle, XCircle, Lightbulb } from 'lucide-react';

const DOT_COLORS = {
  Strengths: 'bg-success',
  Weaknesses: 'bg-error',
  'Missing Angles': 'bg-warning',
};

/**
 * Standalone three-column critique display.
 */
export default function CritiquePanel({ critique, onFollowupClick }) {
  if (!critique) {
    return (
      <div className="glass-card p-12 text-center text-text-muted">
        No critique available.
      </div>
    );
  }

  const columns = [
    {
      title: 'Strengths',
      items: critique.strengths || [],
      icon: CheckCircle,
      accent: 'success',
      headerBg: 'bg-success/10 border-success/20',
      iconClass: 'text-success',
      itemBg: 'bg-success/[0.04] border-success/10',
    },
    {
      title: 'Weaknesses',
      items: critique.weaknesses || [],
      icon: XCircle,
      accent: 'error',
      headerBg: 'bg-error/10 border-error/20',
      iconClass: 'text-error',
      itemBg: 'bg-error/[0.04] border-error/10',
    },
    {
      title: 'Missing Angles',
      items: critique.missing_angles || [],
      icon: AlertTriangle,
      accent: 'warning',
      headerBg: 'bg-warning/10 border-warning/20',
      iconClass: 'text-warning',
      itemBg: 'bg-warning/[0.04] border-warning/10',
    },
  ];

  return (
    <div className="space-y-6">
      <div className="grid gap-4 lg:grid-cols-3">
        {columns.map((column) => (
          <div key={column.title} className="glass-card overflow-hidden">
            <div
              className={`flex items-center gap-2.5 border-b px-5 py-4 ${column.headerBg}`}
            >
              <column.icon className={`h-4 w-4 ${column.iconClass}`} aria-hidden="true" />
              <h3 className="font-semibold text-text-primary">{column.title}</h3>
              <span className="ml-auto rounded-full bg-white/[0.08] px-2 py-0.5 text-xs text-text-muted">
                {column.items.length}
              </span>
            </div>
            <ul className="space-y-2 p-4" role="list">
              {column.items.length === 0 ? (
                <li className="px-2 py-3 text-sm text-text-muted">None identified.</li>
              ) : (
                column.items.map((item, index) => (
                  <li
                    key={index}
                    className={`flex gap-3 rounded-xl border p-3.5 text-sm leading-relaxed text-text-secondary ${column.itemBg}`}
                  >
                    <span
                      className={`mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full ${DOT_COLORS[column.title]}`}
                    />
                    {item}
                  </li>
                ))
              )}
            </ul>
          </div>
        ))}
      </div>

      {(critique.suggested_followups || []).length > 0 && (
        <div className="glass-card p-5">
          <div className="mb-4 flex items-center gap-2">
            <Lightbulb className="h-4 w-4 text-warning" aria-hidden="true" />
            <h4 className="font-semibold text-text-primary">Suggested follow-up queries</h4>
          </div>
          <div className="flex flex-wrap gap-2">
            {critique.suggested_followups.map((query, index) => (
              <button
                key={index}
                type="button"
                onClick={() => onFollowupClick?.(query)}
                className="rounded-full border border-border-light bg-surface-elevated px-4 py-2 text-sm text-text-secondary transition-all duration-200 hover:border-primary/40 hover:bg-primary/10 hover:text-primary-light"
                aria-label={`Research follow-up: ${query}`}
              >
                {query}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
