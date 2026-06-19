import { Search, Loader2, Sparkles, ArrowRight } from 'lucide-react';
import { useCallback } from 'react';

/**
 * Polished search input with gradient submit button and focus glow.
 */
export default function SearchBar({ onSubmit, loading, value, onChange }) {
  const handleSubmit = useCallback(
    (event) => {
      event.preventDefault();
      if (!loading && value.trim()) {
        onSubmit(value.trim());
      }
    },
    [loading, onSubmit, value],
  );

  return (
    <div className="w-full animate-slide-up">
      <form onSubmit={handleSubmit} className="relative group">
        <div className="pointer-events-none absolute inset-0 rounded-2xl bg-gradient-to-r from-primary/20 via-primary-dark/10 to-transparent opacity-0 blur-xl transition-opacity duration-500 group-focus-within:opacity-100" />
        <div className="relative flex items-center">
          <Search
            className="pointer-events-none absolute left-5 h-5 w-5 text-text-muted transition-colors group-focus-within:text-primary"
            aria-hidden="true"
          />
          <input
            type="text"
            value={value}
            onChange={(event) => onChange(event.target.value)}
            disabled={loading}
            placeholder="What would you like to research?"
            aria-label="Research topic"
            className="w-full rounded-2xl border border-border-light bg-surface-elevated/80 py-4 pl-14 pr-40 text-base text-text-primary placeholder:text-text-muted shadow-inner-glow backdrop-blur-sm transition-all duration-300 focus:border-primary/50 focus:bg-surface-elevated focus:outline-none focus:ring-2 focus:ring-primary/20 disabled:cursor-not-allowed disabled:opacity-60 md:text-lg md:py-5"
          />
          <button
            type="submit"
            disabled={loading || !value.trim()}
            aria-label="Start research"
            className="btn-primary absolute right-2 top-1/2 -translate-y-1/2 px-6"
          >
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                Running
              </>
            ) : (
              <>
                Research
                <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </>
            )}
          </button>
        </div>
      </form>
      <div className="mt-4 flex items-center justify-center gap-2 text-sm text-text-muted">
        <Sparkles className="h-3.5 w-3.5 text-primary/70" aria-hidden="true" />
        <span>4 specialized agents · ~30 seconds · fully observable pipeline</span>
      </div>
    </div>
  );
}
