export type EditorStartupMilestone =
  | 'host-start'
  | 'worker-register-start'
  | 'worker-registered'
  | 'api-request'
  | 'api-ready'
  | 'frame-ready'
  | 'content-ready';

const PREFIX = 'document.editor.startup.';

/**
 * Stable startup marks used by local benchmarks and production diagnostics.
 * Duplicate lifecycle callbacks keep the first observation, so retries do not
 * rewrite the cold-start timeline.
 */
export function markEditorStartup(milestone: EditorStartupMilestone): void {
  if (typeof performance === 'undefined' || typeof performance.mark !== 'function') return;
  const name = `${PREFIX}${milestone}`;
  if (performance.getEntriesByName(name, 'mark').length) return;
  performance.mark(name);
  if (milestone === 'content-ready' && typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('document:startup-measured', { detail: readEditorStartupMetrics() }));
  }
}

export function readEditorStartupMetrics(): Record<string, number> {
  if (typeof performance === 'undefined') return {};
  const result: Record<string, number> = {};
  for (const entry of performance.getEntriesByType('mark')) {
    if (entry.name.startsWith(PREFIX)) result[entry.name.slice(PREFIX.length)] = Math.round(entry.startTime * 10) / 10;
  }
  return result;
}
