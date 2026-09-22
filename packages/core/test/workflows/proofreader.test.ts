import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { getProofreaderLanguageName, createProofreaderWorkflow } from '../../src/workflows';
import { emitDownloadProgress } from '../workflow-helpers';

class FakeProofreader {
  static availabilityStatus: Availability = 'available';
  static availability = vi.fn(async () => FakeProofreader.availabilityStatus);
  static create = vi.fn(async (options: ProofreaderCreateOptions) => {
    emitDownloadProgress(options);
    return new FakeProofreader(options);
  });
  static omitQuota = false;
  static omitMeasure = false;
  static measureError: unknown;
  static proofreadErrorInput = '';
  static customCorrections: ProofreadCorrection[] | undefined;

  inputQuota?: number = 100;
  measureInputUsage?: (input: string, options?: ProofreaderProofreadOptions) => Promise<number>;
  destroyed = false;
  readonly expectedInputLanguages: readonly string[];
  readonly includeCorrectionTypes: boolean;
  readonly includeCorrectionExplanations: boolean;
  readonly correctionExplanationLanguage?: string;

  constructor(options: ProofreaderCreateOptions) {
    this.expectedInputLanguages = options.expectedInputLanguages ?? [];
    this.includeCorrectionTypes = Boolean(options.includeCorrectionTypes);
    this.includeCorrectionExplanations = Boolean(options.includeCorrectionExplanations);
    this.correctionExplanationLanguage = options.correctionExplanationLanguage;
    if (FakeProofreader.omitQuota) this.inputQuota = undefined;
    if (!FakeProofreader.omitMeasure) {
      this.measureInputUsage = vi.fn(async (input: string, runOptions?: ProofreaderProofreadOptions) => {
        if (FakeProofreader.measureError) throw FakeProofreader.measureError;
        if (runOptions?.signal?.aborted) throw runOptions.signal.reason;
        return input.length;
      });
    }
  }

  proofread = vi.fn(async (input: string) => {
    if (input === FakeProofreader.proofreadErrorInput) throw new Error('proofreading failed');
    const corrections =
      FakeProofreader.customCorrections ??
      (() => {
        const index = input.indexOf('teh');
        return index < 0
          ? []
          : [
              {
                startIndex: index,
                endIndex: index + 3,
                correction: 'the',
                types: ['spelling'] as CorrectionType[],
                explanation: 'Spelling correction.'
              }
            ];
      })();
    let correctedInput = input;
    for (const correction of [...corrections].reverse()) {
      correctedInput = `${correctedInput.slice(0, correction.startIndex)}${correction.correction}${correctedInput.slice(correction.endIndex)}`;
    }
    return { correctedInput, corrections };
  });

  destroy() {
    this.destroyed = true;
  }
}

describe('createProofreaderWorkflow', () => {
  beforeEach(() => {
    FakeProofreader.availabilityStatus = 'available';
    FakeProofreader.availability.mockClear();
    FakeProofreader.create.mockClear();
    FakeProofreader.omitQuota = false;
    FakeProofreader.omitMeasure = false;
    FakeProofreader.measureError = undefined;
    FakeProofreader.proofreadErrorInput = '';
    FakeProofreader.customCorrections = undefined;
    vi.stubGlobal('Proofreader', FakeProofreader);
  });

  afterEach(() => vi.unstubAllGlobals());

  it('shares language labels and normalizes model options through lifecycle', async () => {
    expect(getProofreaderLanguageName('fr')).toBe('French');
    const defaults = {
      expectedInputLanguages: [' en ', 'EN', '', 'fr'],
      includeCorrectionTypes: true,
      includeCorrectionExplanations: true,
      correctionExplanationLanguage: ' en '
    };
    const api = createProofreaderWorkflow(defaults);
    expect(api.state.getSnapshot().inputQuotaAvailable).toBeNull();
    expect(api.state.getSnapshot().hasCorrections).toBe(false);
    await expect(api.requestAvailability()).resolves.toBe('available');
    await expect(api.init()).resolves.toBe('available');
    const instance = (await api.create(defaults)) as unknown as FakeProofreader;
    expect(instance.expectedInputLanguages).toEqual(['en', 'fr']);
    expect(instance.correctionExplanationLanguage).toBe('en');
    expect(api.state.getSnapshot().proofreader).toBe(instance);
    expect(api.state.getSnapshot().isReady).toBe(true);
    api.destroy();
    expect((instance as unknown as FakeProofreader).destroyed).toBe(true);
    api.dispose();
    expect(api.state.getSnapshot().createOptions.expectedInputLanguages).toEqual(['en', 'fr']);
  });

  it('drops explanation language when explanations are disabled or blank', async () => {
    const api = createProofreaderWorkflow();
    const first = await api.create({ includeCorrectionExplanations: false, correctionExplanationLanguage: 'fr' });
    expect(first.correctionExplanationLanguage).toBeUndefined();
    const second = await api.create({ includeCorrectionExplanations: true, correctionExplanationLanguage: '   ' });
    expect(second.correctionExplanationLanguage).toBeUndefined();
  });

  it('reports unsupported and unavailable constructors', async () => {
    vi.stubGlobal('Proofreader', undefined);
    const unsupported = createProofreaderWorkflow();
    await expect(unsupported.checkAvailability()).resolves.toBe('unavailable');
    await expect(unsupported.init()).rejects.toThrow('unavailable');
    await expect(unsupported.create()).rejects.toThrow('not available in this browser context');

    vi.stubGlobal('Proofreader', FakeProofreader);
    FakeProofreader.availabilityStatus = 'unavailable';
    await expect(createProofreaderWorkflow().create()).rejects.toThrow('unavailable with the provided options');
  });

  it('measures, proofreads, normalizes corrections, and creates display segments', async () => {
    const api = createProofreaderWorkflow({
      expectedInputLanguages: ['en'],
      includeCorrectionTypes: true,
      includeCorrectionExplanations: true,
      correctionExplanationLanguage: 'en'
    });
    await expect(api.measureInputUsage(' <b>Fix teh text.</b> ', { stripHtml: true })).resolves.toBe(13);
    expect(api.state.getSnapshot().inputQuotaAvailable).toBe(87);
    const progress = vi.fn();
    const result = await api.proofreadWithDetails(' Please fix teh text. ', { onProgress: progress });
    expect(result).toMatchObject({ correctedInput: 'Please fix the text.', chunked: false, hasCorrections: true });
    expect(result.corrections[0]).toMatchObject({ original: 'teh', correction: 'the', index: 0 });
    expect(api.state.getSnapshot().hasCorrections).toBe(true);
    expect(api.state.getSnapshot().corrections).toEqual(result.corrections);
    expect(api.state.getSnapshot().output).toBe(result.correctedInput);
    expect(api.state.getSnapshot().lastResult).toEqual(result);
    const segments = api.createProofreadTextSegments(result.input, result.corrections);
    expect(segments).toHaveLength(3);
    expect(segments[1]).toMatchObject({ text: 'teh', correctedText: 'the' });
    expect(progress).toHaveBeenLastCalledWith(expect.objectContaining({ phase: 'ready' }));
    await expect(api.proofread('clean', { autoCreate: false })).resolves.toBe('clean');
  });

  it('clamps malformed correction metadata and handles boundary-only segments', async () => {
    FakeProofreader.customCorrections = [
      { startIndex: -3, endIndex: -1, correction: 'A' },
      { startIndex: 2, endIndex: 99, correction: 'Z', types: [] }
    ];
    const api = createProofreaderWorkflow();
    const result = await api.proofreadWithDetails('abcd', { largeInputStrategy: 'never' });
    expect(result.corrections[0]).toMatchObject({
      startIndex: 0,
      endIndex: 0,
      original: '',
      types: [],
      explanation: ''
    });
    expect(result.corrections[1].endIndex).toBe(4);
    const segments = api.createProofreadTextSegments(result.input, result.corrections);
    expect(segments[0].correction).toBeDefined();
    expect(segments[segments.length - 1]?.correction).toBeDefined();
  });

  it('chunks by measured usage and offsets corrections across chunks', async () => {
    const input = Array.from({ length: 18 }, (_, index) => `Sentence ${index} has teh typo. ${'word '.repeat(7)}`).join(
      ' '
    );
    const api = createProofreaderWorkflow();
    const result = await api.proofreadWithDetails(input, { chunkBudgetRatio: 0, maxChunkCharacters: 2_000 });
    expect(result.chunked).toBe(true);
    expect(result.chunks.length).toBeGreaterThan(1);
    expect(result.corrections.length).toBe(result.chunks.length);
    expect(result.corrections.every((correction, index) => correction.index === index)).toBe(true);
    expect(result.correctedInput.match(/the typo/g)).toHaveLength(result.chunks.length);
  });

  it('chunks by character limits using paragraph, sentence, word, and hard boundaries', async () => {
    FakeProofreader.omitQuota = true;
    FakeProofreader.omitMeasure = true;
    const api = createProofreaderWorkflow();
    const inputs = [
      `${'a'.repeat(350)}\n\n${'b'.repeat(350)}`,
      `${'a'.repeat(350)}. ${'b'.repeat(350)}`,
      `${'a'.repeat(350)} ${'b'.repeat(350)}`,
      'x'.repeat(1_300)
    ];
    for (const input of inputs) {
      const result = await api.proofreadWithDetails(input, { maxChunkCharacters: 600, chunkBudgetRatio: Number.NaN });
      expect(result.chunked).toBe(true);
      expect(result.inputQuota).toBeNull();
      expect(result.inputUsage).toBeNull();
      expect(result.chunks.length).toBeGreaterThan(1);
    }
    await expect(api.measureInputUsage('input', { autoCreate: false })).resolves.toBeNull();
  });

  it('supports explicit no-chunk behavior and clamps very high ratios', async () => {
    const api = createProofreaderWorkflow();
    const input = 'teh '.repeat(300);
    const direct = await api.proofreadWithDetails(input, {
      largeInputStrategy: 'never',
      chunkBudgetRatio: 2,
      maxChunkCharacters: Number.NaN
    });
    expect(direct.chunked).toBe(false);
  });

  it('tolerates unavailable measurement, propagates aborts, and records native errors', async () => {
    const api = createProofreaderWorkflow();
    FakeProofreader.measureError = new Error('measurement failed');
    await expect(api.proofreadWithDetails('clean')).resolves.toMatchObject({ inputUsage: null });

    FakeProofreader.measureError = new DOMException('stopped', 'AbortError');
    await expect(api.proofreadWithDetails('clean')).rejects.toMatchObject({ name: 'AbortError' });

    FakeProofreader.measureError = undefined;
    FakeProofreader.proofreadErrorInput = 'bad';
    await expect(api.proofreadWithDetails('bad')).rejects.toThrow('proofreading failed');
    expect(api.state.getSnapshot().error).toBeInstanceOf(Error);
    expect(api.state.getSnapshot().progressState.phase).toBe('error');
  });

  it('reuses equivalent configurations and requires explicit creation when disabled', async () => {
    const api = createProofreaderWorkflow({ expectedInputLanguages: ['en'], includeCorrectionTypes: true });
    await api.create();
    await api.proofread('one', { createOptions: { expectedInputLanguages: ['EN'], includeCorrectionTypes: true } });
    expect(FakeProofreader.create).toHaveBeenCalledTimes(1);
    await api.proofread('two', { createOptions: { expectedInputLanguages: ['fr'], includeCorrectionTypes: true } });
    expect(FakeProofreader.create).toHaveBeenCalledTimes(2);
    await expect(createProofreaderWorkflow().proofread('input', { autoCreate: false })).rejects.toThrow(
      'not initialized'
    );
  });

  it('runs batches with overrides, continuation, and fail-fast behavior', async () => {
    const api = createProofreaderWorkflow();
    FakeProofreader.proofreadErrorInput = 'bad';
    const batch = await api.proofreadMany(
      [
        { input: '<b>teh</b>', stripHtml: true, expectedInputLanguages: ['en'] },
        { input: 'bad' },
        { input: 'clean', expectedInputLanguages: ['fr'] }
      ],
      { continueOnError: true }
    );
    expect(batch.results[0]?.expectedInputLanguages).toEqual(['en']);
    expect(batch.results[1]).toBeNull();
    expect(batch.results[2]?.expectedInputLanguages).toEqual(['fr']);
    expect(batch.failures).toHaveLength(1);
    await expect(api.proofreadMany([{ input: 'bad' }])).rejects.toThrow('proofreading failed');
  });

  it('interrupts pending measurement and exposes computed state', async () => {
    const api = createProofreaderWorkflow();
    const instance = (await api.create()) as unknown as FakeProofreader;
    const measure = instance.measureInputUsage as ReturnType<typeof vi.fn>;
    measure.mockImplementationOnce(
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
