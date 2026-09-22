import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { getLanguageDetectorLanguageName, createLanguageDetectorWorkflow } from '../../src/workflows';
import { emitDownloadProgress } from '../workflow-helpers';

class FakeLanguageDetector {
  static availabilityStatus: Availability = 'available';
  static availability = vi.fn(async () => FakeLanguageDetector.availabilityStatus);
  static create = vi.fn(async (options: LanguageDetectorCreateOptions) => {
    emitDownloadProgress(options);
    return new FakeLanguageDetector(options.expectedInputLanguages ?? []);
  });
  static measureError: unknown;
  static measureErrorAfter = Number.POSITIVE_INFINITY;
  static detectErrorInput = '';
  static detectResults: LanguageDetectionResult[] = [
    { detectedLanguage: 'es', confidence: 0.82 },
    { detectedLanguage: 'en', confidence: 0.12 }
  ];

  readonly inputQuota = 100;
  destroyed = false;
  measureCalls = 0;
  measureInputUsage = vi.fn(async (input: string, options?: LanguageDetectorDetectOptions) => {
    this.measureCalls += 1;
    if (FakeLanguageDetector.measureError && this.measureCalls >= FakeLanguageDetector.measureErrorAfter) {
      throw FakeLanguageDetector.measureError;
    }
    if (options?.signal?.aborted) throw options.signal.reason;
    return input.length;
  });
  detect = vi.fn(async (input: string) => {
    if (input === FakeLanguageDetector.detectErrorInput) throw new Error('detection failed');
    return FakeLanguageDetector.detectResults;
  });

  constructor(readonly expectedInputLanguages: readonly string[]) {}

  destroy() {
    this.destroyed = true;
  }
}

describe('createLanguageDetectorWorkflow', () => {
  beforeEach(() => {
    FakeLanguageDetector.availabilityStatus = 'available';
    FakeLanguageDetector.availability.mockClear();
    FakeLanguageDetector.create.mockClear();
    FakeLanguageDetector.measureError = undefined;
    FakeLanguageDetector.measureErrorAfter = Number.POSITIVE_INFINITY;
    FakeLanguageDetector.detectErrorInput = '';
    FakeLanguageDetector.detectResults = [
      { detectedLanguage: 'es', confidence: 0.82 },
      { detectedLanguage: 'en', confidence: 0.12 }
    ];
    vi.stubGlobal('LanguageDetector', FakeLanguageDetector);
  });

  afterEach(() => vi.unstubAllGlobals());

  it('resolves known, unknown, Intl, and invalid language names', () => {
    expect(getLanguageDetectorLanguageName('und')).toBe('Unknown');
    expect(getLanguageDetectorLanguageName('ES')).toBe('Spanish');
    expect(getLanguageDetectorLanguageName('cy')).toMatch(/Welsh|cy/);
    const original = Intl.DisplayNames;
    vi.stubGlobal('Intl', {
      ...Intl,
      DisplayNames: class {
        constructor() {
          throw new Error('unsupported');
        }
      }
    });
    expect(getLanguageDetectorLanguageName('xx-invalid')).toBe('xx-invalid');
    vi.stubGlobal('Intl', { ...Intl, DisplayNames: original });
  });

  it('normalizes expected languages and manages lifecycle state', async () => {
    const api = createLanguageDetectorWorkflow({ expectedInputLanguages: [' es ', 'ES', '', 'en'] });
    expect(api.state.getSnapshot().inputQuotaAvailable).toBeNull();
    expect(api.state.getSnapshot().topResult).toBeNull();
    await expect(api.requestAvailability()).resolves.toBe('available');
    await expect(api.init({ expectedInputLanguages: ['fr'] })).resolves.toBe('available');
    const instance = (await api.create({
      expectedInputLanguages: [' es ', 'ES', 'en']
    })) as unknown as FakeLanguageDetector;
    expect(instance.expectedInputLanguages).toEqual(['es', 'en']);
    expect(api.state.getSnapshot().detector).toBe(instance);
    expect(api.state.getSnapshot().isReady).toBe(true);
    expect(api.state.getSnapshot().downloadProgress).toBe(100);
    api.destroy();
    expect((instance as unknown as FakeLanguageDetector).destroyed).toBe(true);
    api.dispose();
    expect(api.state.getSnapshot().createOptions.expectedInputLanguages).toEqual(['es', 'en']);
  });

  it('reports unsupported and unavailable constructors', async () => {
    vi.stubGlobal('LanguageDetector', undefined);
    const unsupported = createLanguageDetectorWorkflow();
    await expect(unsupported.checkAvailability()).resolves.toBe('unavailable');
    await expect(unsupported.init()).rejects.toThrow('unavailable');
    await expect(unsupported.create()).rejects.toThrow('not available in this browser context');

    vi.stubGlobal('LanguageDetector', FakeLanguageDetector);
    FakeLanguageDetector.availabilityStatus = 'unavailable';
    await expect(createLanguageDetectorWorkflow().create()).rejects.toThrow('unavailable with the provided options');
  });

  it('measures input and detects ranked normalized results', async () => {
    FakeLanguageDetector.detectResults = [
      { detectedLanguage: 'es', confidence: 1.2 },
      { detectedLanguage: 'es', confidence: 0.4 },
      { detectedLanguage: 'en', confidence: -1 },
      { detectedLanguage: '', confidence: Number.NaN }
    ];
    const api = createLanguageDetectorWorkflow();
    await expect(api.measureInputUsage(' <b>Hola</b> ', { stripHtml: true })).resolves.toBe(4);
    expect(api.state.getSnapshot().inputQuotaAvailable).toBe(96);
    const progress = vi.fn();
    const result = await api.detectWithDetails(' Hola ', {
      minConfidence: Number.NaN,
      maxResults: Number.NaN,
      onProgress: progress,
      largeInputStrategy: 'never'
    });
    expect(result).toMatchObject({ detectedLanguage: 'es', confidence: 1, name: 'Spanish', chunked: false });
    expect(result.results.map((item) => item.detectedLanguage)).toContain('und');
    expect(api.state.getSnapshot().topResult).toMatchObject({ detectedLanguage: 'es' });
    expect(api.state.getSnapshot().results).toEqual(result.results);
    expect(progress).toHaveBeenLastCalledWith(expect.objectContaining({ phase: 'ready' }));
    await expect(api.detect('again', { autoCreate: false, minConfidence: -2, maxResults: 50 })).resolves.toBe('es');
  });

  it('reports unknown when no known result reaches confidence', async () => {
    FakeLanguageDetector.detectResults = [{ detectedLanguage: 'fr', confidence: 0.1 }];
    const api = createLanguageDetectorWorkflow();
    const result = await api.detectWithDetails('ambiguous', { minConfidence: 0.9, maxResults: 0 });
    expect(result).toMatchObject({ detectedLanguage: 'und', isUnknown: true, maxResults: 1 });
    expect(result.results).toHaveLength(1);
  });

  it('samples large input and avoids needless sampling for short high-usage input', async () => {
    const api = createLanguageDetectorWorkflow();
    const longInput = 'language signal '.repeat(120);
    const sampled = await api.detectWithDetails(longInput, {
      largeInputStrategy: 'sample',
      chunkBudgetRatio: 0.2
    });
    expect(sampled.sampled).toBe(true);
    expect(sampled.analyzedInput.length).toBeLessThan(longInput.length);

    const instance = api.state.getSnapshot().detector as unknown as FakeLanguageDetector;
    instance.measureInputUsage.mockResolvedValueOnce(500);
    const short = await api.detectWithDetails('short input', { largeInputStrategy: 'sample' });
    expect(short.sampled).toBe(false);
    expect(short.analyzedInput).toBe('short input');
  });

  it('chunks and aggregates weighted language results', async () => {
    const input = Array.from({ length: 14 }, (_, index) => `Bloque ${index} ${'texto '.repeat(9)}`).join('\n\n');
    const api = createLanguageDetectorWorkflow();
    const result = await api.detectWithDetails(input, { largeInputStrategy: 'chunk', chunkBudgetRatio: 0 });
    expect(result.chunked).toBe(true);
    expect(result.chunks.length).toBeGreaterThan(1);
    expect(result.detectedLanguage).toBe('es');
    expect(result.chunks.every((chunk) => chunk.weight > 0)).toBe(true);

    const instance = api.state.getSnapshot().detector as unknown as FakeLanguageDetector;
    instance.measureCalls = 0;
    FakeLanguageDetector.measureError = new Error('chunk measurement failed');
    FakeLanguageDetector.measureErrorAfter = 2;
    const fallbackWeights = await api.detectWithDetails(input, { largeInputStrategy: 'chunk', chunkBudgetRatio: 0.4 });
    expect(fallbackWeights.chunks.some((chunk) => chunk.usage === null)).toBe(true);
  });

  it('handles measurement failures, aborts, and detection errors', async () => {
    const api = createLanguageDetectorWorkflow();
    FakeLanguageDetector.measureError = new Error('measurement failed');
    FakeLanguageDetector.measureErrorAfter = 1;
    await expect(api.detectWithDetails('input')).resolves.toMatchObject({ inputUsage: null, chunked: false });

    const instance = api.state.getSnapshot().detector as unknown as FakeLanguageDetector;
    instance.measureCalls = 0;
    FakeLanguageDetector.measureError = new DOMException('stopped', 'AbortError');
    await expect(api.detectWithDetails('input')).rejects.toMatchObject({ name: 'AbortError' });

    FakeLanguageDetector.measureError = undefined;
    FakeLanguageDetector.detectErrorInput = 'bad';
    await expect(api.detectWithDetails('bad')).rejects.toThrow('detection failed');
    expect(api.state.getSnapshot().error).toBeInstanceOf(Error);
    expect(api.state.getSnapshot().progressState.phase).toBe('error');
  });

  it('reuses equivalent configurations and requires creation when disabled', async () => {
    const api = createLanguageDetectorWorkflow({ expectedInputLanguages: ['en', 'es'] });
    await api.create();
    await api.detect('one', { createOptions: { expectedInputLanguages: ['ES', 'EN'] } });
    expect(FakeLanguageDetector.create).toHaveBeenCalledTimes(1);
    await api.detect('two', { createOptions: { expectedInputLanguages: ['fr'] } });
    expect(FakeLanguageDetector.create).toHaveBeenCalledTimes(2);

    const fresh = createLanguageDetectorWorkflow();
    await expect(fresh.detect('input', { autoCreate: false })).rejects.toThrow('not initialized');
  });

  it('runs batches with per-item language constraints and error policy', async () => {
    const api = createLanguageDetectorWorkflow();
    FakeLanguageDetector.detectErrorInput = 'bad';
    const batch = await api.detectMany(
      [
        { input: '<b>hola</b>', stripHtml: true, expectedInputLanguages: ['es'] },
        { input: 'bad' },
        { input: 'hello', expectedInputLanguages: ['en'] }
      ],
      { continueOnError: true, createOptions: { expectedInputLanguages: ['fr'] } }
    );
    expect(batch.results[0]?.expectedInputLanguages).toEqual(['es']);
    expect(batch.results[1]).toBeNull();
    expect(batch.results[2]?.expectedInputLanguages).toEqual(['en']);
    expect(batch.failures).toHaveLength(1);
    await expect(api.detectMany([{ input: 'bad' }])).rejects.toThrow('detection failed');
  });

  it('interrupts pending measurement and restores idle processing', async () => {
    const api = createLanguageDetectorWorkflow();
    const instance = (await api.create()) as unknown as FakeLanguageDetector;
    instance.measureInputUsage.mockImplementationOnce(
      (_input, options) =>
        new Promise((_resolve, reject) =>
          options?.signal?.addEventListener('abort', () => reject(options.signal?.reason), { once: true })
        )
    );
    const pending = api.measureInputUsage('pending');
    await vi.waitFor(() => expect(api.state.getSnapshot().isProcessing).toBe(true));
    api.interrupt();
    await expect(pending).rejects.toMatchObject({ name: 'AbortError' });
    expect(api.state.getSnapshot().processing).toBe('');
    expect(api.state.getSnapshot().availability).toBe('available');
    expect(api.state.getSnapshot().inputUsage).toBeNull();
    expect(api.state.getSnapshot().inputQuota).toBe(100);
  });
});
