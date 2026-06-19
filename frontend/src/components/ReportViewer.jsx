import { useState, useCallback } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import {
  Download,
  Check,
  AlertTriangle,
  FileText,
  ListChecks,
  MessageSquare,
  Link2,
  BarChart2,
  Clock,
  BookOpen,
} from 'lucide-react';
import SourcesList from './SourcesList';
import CritiquePanel from './CritiquePanel';
import PipelineLogs from './PipelineLogs';

const TABS = [
  { id: 'report', label: 'Report', icon: FileText },
  { id: 'summary', label: 'Summary', icon: ListChecks },
  { id: 'critique', label: 'Critique', icon: MessageSquare },
  { id: 'sources', label: 'Sources', icon: Link2 },
  { id: 'stats', label: 'Stats', icon: BarChart2 },
];

/**
 * Tabbed results view for completed research pipeline.
 */
export default function ReportViewer({ pipelineState, onFollowupClick }) {
  const [activeTab, setActiveTab] = useState('report');

  const report = pipelineState?.report;
  const summary = pipelineState?.summary;
  const critique = pipelineState?.critique;
  const findings = pipelineState?.research_findings;
  const wordCount = report?.word_count || 0;
  const readTime = Math.max(1, Math.ceil(wordCount / 200));
  const sourceCount = findings?.sources?.length || 0;

  const handleDownload = useCallback(() => {
    if (!report?.markdown_content) return;
    const blob = new Blob([report.markdown_content], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${report.title?.replace(/\s+/g, '_') || 'report'}.md`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }, [report]);

  if (!pipelineState) {
    return (
      <div className="glass-card p-12 text-center text-text-muted">
        No results to display.
      </div>
    );
  }

  return (
    <div className="w-full space-y-6">
      {/* Tab bar */}
      <div
        className="flex flex-wrap gap-1 rounded-2xl border border-white/[0.06] bg-surface/60 p-1.5 backdrop-blur-sm"
        role="tablist"
        aria-label="Results tabs"
      >
        {TABS.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              role="tab"
              aria-selected={isActive}
              onClick={() => setActiveTab(tab.id)}
              className={`flex flex-1 items-center justify-center gap-2 rounded-xl px-3 py-2.5 text-sm font-medium transition-all duration-200 sm:flex-none sm:px-5 ${
                isActive
                  ? 'bg-gradient-to-r from-primary to-primary-dark text-white shadow-glow-sm'
                  : 'text-text-muted hover:bg-white/[0.04] hover:text-text-secondary'
              }`}
            >
              <Icon className="h-4 w-4" aria-hidden="true" />
              <span className="hidden sm:inline">{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* Report tab */}
      {activeTab === 'report' && (
        <div className="glass-card overflow-hidden animate-fade-in">
          <div className="border-b border-white/[0.06] bg-surface-elevated/50 px-6 py-5 md:px-8">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <div className="mb-2 flex items-center gap-2">
                  <BookOpen className="h-4 w-4 text-primary-light" aria-hidden="true" />
                  <span className="section-label">Final Report</span>
                </div>
                <h2 className="text-xl font-bold text-text-primary md:text-2xl">
                  {report?.title || 'Research Report'}
                </h2>
                <div className="mt-3 flex flex-wrap gap-2">
                  <span className="badge">{wordCount.toLocaleString()} words</span>
                  <span className="badge">
                    <Clock className="h-3 w-3" aria-hidden="true" />
                    ~{readTime} min read
                  </span>
                  <span className="badge">{sourceCount} sources cited</span>
                </div>
              </div>
              <button
                type="button"
                onClick={handleDownload}
                disabled={!report?.markdown_content}
                className="btn-primary"
                aria-label="Export report as markdown"
              >
                <Download className="h-4 w-4" aria-hidden="true" />
                Export .md
              </button>
            </div>
          </div>
          <div className="px-6 py-8 md:px-10 md:py-10">
            {report?.markdown_content ? (
              <article className="prose-report">
                <ReactMarkdown remarkPlugins={[remarkGfm]}>
                  {report.markdown_content}
                </ReactMarkdown>
              </article>
            ) : (
              <p className="text-text-muted">Report content unavailable.</p>
            )}
          </div>
        </div>
      )}

      {/* Summary tab */}
      {activeTab === 'summary' && (
        <div className="animate-fade-in space-y-5">
          {summary?.executive_summary ? (
            <div className="glass-card gradient-border overflow-hidden">
              <div className="border-b border-white/[0.06] bg-primary/5 px-6 py-3">
                <span className="section-label">Executive Summary</span>
              </div>
              <blockquote className="px-6 py-6">
                <p className="text-base leading-relaxed text-text-secondary">
                  {summary.executive_summary}
                </p>
              </blockquote>
            </div>
          ) : (
            <p className="text-text-muted">No executive summary available.</p>
          )}

          <div className="glass-card p-6">
            <div className="mb-5 flex items-center gap-2">
              <Check className="h-4 w-4 text-success" aria-hidden="true" />
              <h3 className="font-semibold text-text-primary">Key Points</h3>
            </div>
            <ul className="space-y-3" role="list">
              {(summary?.key_points || []).length === 0 ? (
                <li className="text-sm text-text-muted">None available.</li>
              ) : (
                summary.key_points.map((point, index) => (
                  <li
                    key={index}
                    className="flex gap-3 rounded-xl border border-white/[0.04] bg-white/[0.02] p-4 text-sm leading-relaxed text-text-secondary"
                  >
                    <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-success/15">
                      <Check className="h-3 w-3 text-success" aria-hidden="true" />
                    </span>
                    {point}
                  </li>
                ))
              )}
            </ul>
          </div>

          <div className="glass-card p-6">
            <div className="mb-5 flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-warning" aria-hidden="true" />
              <h3 className="font-semibold text-text-primary">Knowledge Gaps</h3>
            </div>
            <ul className="space-y-3" role="list">
              {(summary?.gaps || []).length === 0 ? (
                <li className="text-sm text-text-muted">None identified.</li>
              ) : (
                summary.gaps.map((gap, index) => (
                  <li
                    key={index}
                    className="flex gap-3 rounded-xl border border-warning/10 bg-warning/5 p-4 text-sm leading-relaxed text-text-secondary"
                  >
                    <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-warning" aria-hidden="true" />
                    {gap}
                  </li>
                ))
              )}
            </ul>
          </div>
        </div>
      )}

      {activeTab === 'critique' && (
        <div className="animate-fade-in">
          <CritiquePanel critique={critique} onFollowupClick={onFollowupClick} />
        </div>
      )}

      {activeTab === 'sources' && (
        <div className="animate-fade-in">
          <SourcesList sources={findings?.sources} />
        </div>
      )}

      {activeTab === 'stats' && (
        <div className="animate-fade-in space-y-5">
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="glass-card p-5 text-center">
              <p className="section-label mb-2">Total Duration</p>
              <p className="text-3xl font-bold gradient-text">
                {(pipelineState.total_duration || 0).toFixed(1)}s
              </p>
            </div>
            <div className="glass-card p-5 text-center">
              <p className="section-label mb-2">Sources Found</p>
              <p className="text-3xl font-bold text-text-primary">{sourceCount}</p>
            </div>
            <div className="glass-card p-5 text-center">
              <p className="section-label mb-2">Report Length</p>
              <p className="text-3xl font-bold text-text-primary">
                {wordCount.toLocaleString()}
                <span className="ml-1 text-base font-normal text-text-muted">words</span>
              </p>
            </div>
          </div>

          <div className="glass-card overflow-hidden">
            <div className="border-b border-white/[0.06] px-6 py-4">
              <span className="section-label">Agent Performance</span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-white/[0.06] bg-white/[0.02]">
                    <th className="px-6 py-3 font-medium text-text-muted">Agent</th>
                    <th className="px-6 py-3 font-medium text-text-muted">Duration</th>
                    <th className="px-6 py-3 font-medium text-text-muted">Status</th>
                    <th className="hidden px-6 py-3 font-medium text-text-muted sm:table-cell">
                      Share
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {['researcher', 'summarizer', 'critic', 'reporter'].map((agent) => {
                    const duration = pipelineState.agent_durations?.[agent];
                    const hasRun = duration != null;
                    const total = pipelineState.total_duration || 1;
                    const percent = hasRun ? (duration / total) * 100 : 0;
                    return (
                      <tr key={agent} className="border-b border-white/[0.04] last:border-0">
                        <td className="px-6 py-4 capitalize font-medium text-text-primary">
                          {agent}
                        </td>
                        <td className="px-6 py-4 font-mono text-text-secondary">
                          {hasRun ? `${duration.toFixed(1)}s` : '—'}
                        </td>
                        <td className="px-6 py-4">
                          <span
                            className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${
                              hasRun
                                ? 'bg-success/15 text-success'
                                : 'bg-white/[0.06] text-text-muted'
                            }`}
                          >
                            {hasRun ? 'Complete' : 'Skipped'}
                          </span>
                        </td>
                        <td className="hidden px-6 py-4 sm:table-cell">
                          <div className="flex items-center gap-3">
                            <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-white/[0.06]">
                              <div
                                className="h-full rounded-full bg-gradient-to-r from-primary to-primary-dark"
                                style={{ width: `${percent}%` }}
                              />
                            </div>
                            <span className="w-8 font-mono text-xs text-text-muted">
                              {hasRun ? `${percent.toFixed(0)}%` : '—'}
                            </span>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          <PipelineLogs />
        </div>
      )}
    </div>
  );
}
