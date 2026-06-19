import { ExternalLink, Globe } from 'lucide-react';

/**
 * Reusable sources list with compact and full layout modes.
 */
export default function SourcesList({ sources, compact = false }) {
  if (!sources || sources.length === 0) {
    return (
      <div className="glass-card p-12 text-center text-text-muted">
        No sources available.
      </div>
    );
  }

  return (
    <ul className={compact ? 'space-y-2' : 'space-y-3'} role="list">
      {sources.map((url, index) => {
        let hostname = url;
        let displayPath = url;
        try {
          const parsed = new URL(url);
          hostname = parsed.hostname.replace(/^www\./, '');
          displayPath = parsed.pathname.length > 1 ? parsed.pathname : '/';
        } catch {
          /* keep raw url */
        }

        return (
          <li
            key={`${url}-${index}`}
            className={`group glass-card-hover flex items-center gap-4 ${compact ? 'p-3' : 'p-4'}`}
          >
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 ring-1 ring-primary/20 transition-all group-hover:bg-primary/20">
              <span className="text-xs font-bold text-primary-light">
                {index + 1}
              </span>
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <Globe className="h-3.5 w-3.5 shrink-0 text-text-muted" aria-hidden="true" />
                <p className="truncate text-sm font-medium text-text-primary">{hostname}</p>
              </div>
              <p className="truncate text-xs text-text-muted">{displayPath}</p>
            </div>
            <a
              href={url}
              target="_blank"
              rel="noopener noreferrer"
              className="btn-ghost shrink-0 py-1.5 text-xs"
              aria-label={`Open source ${hostname}`}
            >
              Open
              <ExternalLink className="h-3 w-3" aria-hidden="true" />
            </a>
          </li>
        );
      })}
    </ul>
  );
}
