import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createSummarizerWorkflow } from '../../src/workflows';
import { emitDownloadProgress, failingTextStream, pendingTextStream, textStream } from '../workflow-helpers';

class FakeSummarizer {
  static availabilityStatus: Availability = 'available';
  static availability = vi.fn(async () => FakeSummarizer.availabilityStatus);
  static create = vi.fn(async (options: { monitor?: CreateMonitorCallback }) => {
    emitDownloadProgress(options, 1, 4);
    return new FakeSummarizer();
  });
  static measureError: unknown;
  static summarizeError: unknown;
  static preserveLength = false;
  static streamError: unknown;
  static pendingStream = false;

  readonly inputQuota = 100;
  destroyed = false;
  measureInputUsage = vi.fn(async (input: string, options?: { signal?: AbortSignal }) => {
    if (FakeSummarizer.measureError) throw FakeSummarizer.measureError;
    if (options?.signal?.aborted) throw options.signal.reason;
    return input.length;
  });
  summarize = vi.fn(async (input: string) => {
    if (FakeSummarizer.summarizeError) throw FakeSummarizer.summarizeError;
    return FakeSummarizer.preserveLength ? input : `summary:${input.slice(0, 12)}`;
  });
  summarizeStreaming = vi.fn(() => {
    if (FakeSummarizer.streamError) return failingTextStream(FakeSummarizer.streamError);
    if (FakeSummarizer.pendingStream) return pendingTextStream().stream;
    return textStream('local', ' summary');
  });
  destroy() {
    this.destroyed = true;
  }
}

describe('createSummarizerWorkflow', () => {
  beforeEach(() => {
    FakeSummarizer.availabilityStatus = 'available';
    FakeSummarizer.availability.mockClear();
    FakeSummarizer.create.mockClear();
    FakeSummarizer.measureError = undefined;
    FakeSummarizer.summarizeError = undefined;
    FakeSummarizer.preserveLength = false;
    FakeSummarizer.streamError = undefined;
    FakeSummarizer.pendingStream = false;
    vi.stubGlobal('Summarizer', FakeSummarizer);
  });

  afterEach(() => vi.unstubAllGlobals());

  it('checks availability and manages the complete model lifecycle', async () => {
    const api = createSummarizerWorkflow();
    expect(api.state.getSnapshot().inputQuotaAvailable).toBeNull();
    expect(api.state.getSnapshot().processing).toBe('');
    expect(api.state.getSnapshot().inputUsage).toBeNull();
    await expect(api.requestAvailability({ type: 'headline' })).resolves.toBe('available');
    await expect(api.init({ length: 'short' })).resolves.toBe('available');
    const instance = (await api.create({ sharedContext: 'context', type: 'key-points' })) as unknown as FakeSummarizer;
    expect(FakeSummarizer.availability).toHaveBeenLastCalledWith({ type: 'key-points' });
    expect(api.state.getSnapshot().summarizer).toBe(instance);
    expect(api.state.getSnapshot().downloadProgress).toBe(100);
    expect(api.state.getSnapshot().inputQuota).toBe(100);
    expect(api.state.getSnapshot().isReady).toBe(true);
    api.destroy();
    expect((instance as unknown as FakeSummarizer).destroyed).toBe(true);
    api.dispose();
    expect(api.state.getSnapshot().availability).toBeNull();
    expect(api.state.getSnapshot().progressState.phase).toBe('idle');
  });

  it('reports unsupported and unavailable states', async () => {
    vi.stubGlobal('Summarizer', undefined);
    const unsupported = createSummarizerWorkflow();
    await expect(unsupported.checkAvailability()).resolves.toBe('unavailable');
    await expect(unsupported.init()).rejects.toThrow('unavailable');
    await expect(unsupported.create()).rejects.toThrow('not available in this browser context');

    vi.stubGlobal('Summarizer', FakeSummarizer);
    FakeSummarizer.availabilityStatus = 'unavailable';
    await expect(createSummarizerWorkflow().create()).rejects.toThrow('unavailable with the provided options');
  });

  it('measures normalized input and summarizes a single request with details', async () => {
    const api = createSummarizerWorkflow();
    const progress = vi.fn();
    await expect(api.measureInputUsage(' <b>Hello</b>  world ', { stripHtml: true })).resolves.toBe(12);
    expect(api.state.getSnapshot().inputQuotaAvailable).toBe(88);

    const result = await api.summarizeWithDetails(' short input ', {
      context: 'article context',
      onProgress: progress
    });
    expect(result).toMatchObject({ input: 'short input', chunked: false, rollupRounds: 0 });
    expect(api.state.getSnapshot().output).toBe(result.summary);
    expect(api.state.getSnapshot().lastResult).toEqual(result);
    expect(progress).toHaveBeenLastCalledWith(expect.objectContaining({ phase: 'ready' }));
    await expect(api.summarize('again', { autoCreate: false })).resolves.toContain('summary:again');
  });

  it('chunks oversized input and rolls partial summaries up', async () => {
    FakeSummarizer.preserveLength = true;
    const api = createSummarizerWorkflow();
    const input = Array.from({ length: 18 }, (_, index) => `Paragraph ${index}: ${'detail '.repeat(8)}`).join('\n\n');
    const result = await api.summarizeWithDetails(input, {
      chunkBudgetRatio: 0.45,
      maxRollupRounds: 2
    });

    expect(result.chunked).toBe(true);
    expect(result.chunks.length).toBeGreaterThan(1);
    expect(result.rollupRounds).toBe(1);
    expect(api.state.getSnapshot().progressState).toMatchObject({ phase: 'ready', chunked: true });
    expect(result.chunks.every((chunk, index) => chunk.index === index && chunk.usage !== null)).toBe(true);
  });

  it('supports no-rollup and explicit no-chunk modes while clamping options', async () => {
    const api = createSummarizerWorkflow();
    const input = 'large '.repeat(50);
    const noRollup = await api.summarizeWithDetails(input, { chunkBudgetRatio: 0, maxRollupRounds: -2 });
    expect(noRollup.chunked).toBe(true);
    expect(noRollup.rollupRounds).toBe(0);

    const direct = await api.summarizeWithDetails(input, {
      chunkBudgetRatio: Number.NaN,
      chunking: 'never'
    });
    expect(direct.chunked).toBe(false);
    await expect(api.summarizeWithDetails(input, { chunkBudgetRatio: 2, chunking: 'never' })).resolves.toMatchObject({
      chunked: false
    });
  });

  it('falls back to direct summarization when measurement is unavailable and records native errors', async () => {
    const api = createSummarizerWorkflow();
    FakeSummarizer.measureError = new Error('measurement unavailable');
    const result = await api.summarizeWithDetails('input');
    expect(result.inputUsage).toBeNull();
    expect(result.chunked).toBe(false);

    FakeSummarizer.measureError = undefined;
    FakeSummarizer.summarizeError = new Error('summarize failed');
    await expect(api.summarizeWithDetails('input')).rejects.toThrow('summarize failed');
    expect(api.state.getSnapshot().error).toBeInstanceOf(Error);
    expect(api.state.getSnapshot().progressState.phase).toBe('error');
  });

  it('streams output, forwards chunks, propagates read errors, and cancels', async () => {
    const api = createSummarizerWorkflow();
    expect(() => api.summarizeStreaming('input')).toThrow('not initialized');
    await api.create();
    const onChunk = vi.fn();
    await expect(api.summarizeStreamingToText('<b>input</b>', { stripHtml: true }, onChunk)).resolves.toBe(
      'local summary'
    );
    expect(onChunk).toHaveBeenCalledTimes(2);
    expect(api.state.getSnapshot().isProcessing).toBe(false);

    FakeSummarizer.streamError = new Error('stream failed');
    await expect(api.summarizeStreamingToText('input')).rejects.toThrow('stream failed');
    expect(api.state.getSnapshot().error).toBeInstanceOf(Error);

    FakeSummarizer.streamError = undefined;
    FakeSummarizer.pendingStream = true;
    const stream = api.summarizeStreaming('pending');
    await stream.cancel('stop');
    expect(api.state.getSnapshot().isProcessing).toBe(false);
  });

  it('honors create options, explicit creation, and interruption', async () => {
    const api = createSummarizerWorkflow();
    await expect(api.summarize('input', { autoCreate: false })).rejects.toThrow('not initialized');
    await expect(api.summarize('input', { createOptions: { length: 'long' } })).resolves.toContain('summary');

    const instance = api.state.getSnapshot().summarizer as unknown as FakeSummarizer;
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

    FakeSummarizer.measureError = new DOMException('stopped', 'AbortError');
    await expect(api.summarizeWithDetails('aborted')).rejects.toMatchObject({ name: 'AbortError' });
  });
});
