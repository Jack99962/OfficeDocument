import { beforeEach, expect, it } from 'vitest';
import { markEditorStartup, readEditorStartupMetrics } from '../../lib/startup-performance';

beforeEach(() => performance.clearMarks());

it('records each startup milestone once', () => {
  markEditorStartup('host-start');
  markEditorStartup('host-start');
  markEditorStartup('api-request');
  const metrics = readEditorStartupMetrics();
  expect(metrics['host-start']).toBeTypeOf('number');
  expect(metrics['api-request']).toBeTypeOf('number');
  expect(performance.getEntriesByName('document.editor.startup.host-start')).toHaveLength(1);
});
