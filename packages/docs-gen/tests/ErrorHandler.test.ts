import { describe, expect, it } from 'vitest';
import {
  createError,
  createWarning,
  ErrorHandler,
  PipelineException
} from '../src/core/pipeline/ErrorHandler';

describe('ErrorHandler', () => {
  it('starts with empty state', () => {
    const handler = new ErrorHandler();
    const summary = handler.getSummary();

    expect(summary.totalErrors).toBe(0);
    expect(summary.totalWarnings).toBe(0);
    expect(summary.hasBlockingErrors).toBe(false);
  });

  it('reports and tracks errors', () => {
    const handler = new ErrorHandler();
    handler.reportError(createError('test_error', 'Something went wrong', { recoverable: true }));

    const summary = handler.getSummary();
    expect(summary.totalErrors).toBe(1);
    expect(summary.recoverableErrors).toBe(1);
  });

  it('reports and tracks warnings', () => {
    const handler = new ErrorHandler();
    handler.reportWarning(createWarning('test_warning', 'Minor issue'));

    const summary = handler.getSummary();
    expect(summary.totalWarnings).toBe(1);
    expect(summary.totalErrors).toBe(0);
  });

  it('tracks errors by type and phase', () => {
    const handler = new ErrorHandler();
    handler.reportError(
      createError('parse_error', 'Parse failed', { phase: 'extraction', recoverable: true })
    );
    handler.reportError(
      createError('parse_error', 'Parse failed 2', { phase: 'extraction', recoverable: true })
    );
    handler.reportError(
      createError('io_error', 'File missing', { phase: 'discovery', recoverable: true })
    );

    const summary = handler.getSummary();
    expect(summary.errorsByType.parse_error).toBe(2);
    expect(summary.errorsByType.io_error).toBe(1);
    expect(summary.errorsByPhase.extraction).toBe(2);
    expect(summary.errorsByPhase.discovery).toBe(1);
  });

  it('throws PipelineException in failFast mode', () => {
    const handler = new ErrorHandler({ failFast: true });

    expect(() =>
      handler.reportError(createError('critical', 'Boom', { recoverable: false }))
    ).toThrow(PipelineException);
  });

  it('throws when max errors exceeded', () => {
    const handler = new ErrorHandler({ maxErrors: 2 });

    handler.reportError(createError('e1', 'Error 1', { recoverable: true }));

    expect(() => handler.reportError(createError('e2', 'Error 2', { recoverable: true }))).toThrow(
      'Maximum error count exceeded'
    );
  });

  it('detects blocking errors', () => {
    const handler = new ErrorHandler();
    handler.reportError(createError('fatal', 'Critical failure', { recoverable: false }));

    expect(handler.canContinue()).toBe(false);
    expect(handler.getSummary().hasBlockingErrors).toBe(true);
  });

  it('allows continuation with only recoverable errors', () => {
    const handler = new ErrorHandler();
    handler.reportError(createError('minor', 'Recoverable', { recoverable: true }));

    expect(handler.canContinue()).toBe(true);
  });

  it('resets state completely', () => {
    const handler = new ErrorHandler();
    handler.reportError(createError('err', 'Error', { recoverable: true }));
    handler.reportWarning(createWarning('warn', 'Warning'));
    handler.reset();

    const summary = handler.getSummary();
    expect(summary.totalErrors).toBe(0);
    expect(summary.totalWarnings).toBe(0);
  });

  it('generates a readable report', () => {
    const handler = new ErrorHandler();
    handler.reportError(
      createError('parse_error', 'Failed to parse Button', {
        phase: 'extraction',
        component: 'Button',
        recoverable: true
      })
    );

    const report = handler.generateReport();
    expect(report).toContain('Error Report');
    expect(report).toContain('parse_error');
    expect(report).toContain('Button');
  });

  it('generates clean report when no errors', () => {
    const handler = new ErrorHandler();
    const report = handler.generateReport();

    expect(report).toContain('No errors or warnings');
  });

  it('handles extraction errors', () => {
    const handler = new ErrorHandler();
    handler.handleExtractionError(
      { type: 'parse', message: 'Cannot parse props' },
      { name: 'Button' } as unknown as Parameters<typeof handleError>[0],
      'extraction'
    );

    const summary = handler.getSummary();
    expect(summary.totalErrors).toBe(1);
    expect(summary.errorsByComponent.Button).toBe(1);
  });

  it('handles extraction warnings', () => {
    const handler = new ErrorHandler();
    handler.handleExtractionWarning(
      { type: 'missing', message: 'No docs found', suggestion: 'Add docs.svelte' },
      { name: 'Card' } as unknown as Parameters<typeof handleError>[0],
      'extraction'
    );

    const summary = handler.getSummary();
    expect(summary.totalWarnings).toBe(1);
  });

  it('manages context for error reporting', async () => {
    const handler = new ErrorHandler();

    await handler.withContext({ phase: 'discovery', packageName: 'blocks' }, async () => {
      handler.reportError(createError('test', 'In context', { recoverable: true }));
    });

    const summary = handler.getSummary();
    expect(summary.totalErrors).toBe(1);
  });

  it('attemptRecovery always returns false', async () => {
    const handler = new ErrorHandler();
    const error = createError('test', 'Some error', { recoverable: true });
    const recovered = await handler.attemptRecovery(error);

    expect(recovered).toBe(false);
  });
});
