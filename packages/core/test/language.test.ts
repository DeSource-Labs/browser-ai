import { afterEach, describe, expect, it, vi } from 'vitest';
import { createLanguageDetector, createProofreader } from '../src';
import { deferred, flushPromises } from './helpers';

afterEach(() => vi.unstubAllGlobals());

const detectionResults: LanguageDetectionResult[] = [
  { detectedLanguage: 'en', confidence: 0.92 },
  { detectedLanguage: 'fr', confidence: 0.08 }
];

const detectorInstance = () => ({
  inputQuota: 1024,
  expectedInputLanguages: ['en'],
  detect: vi.fn().mockResolvedValue(detectionResults),
  measureInputUsage: vi.fn().mockResolvedValue(8),
  destroy: vi.fn()
});

const proofreadResult: ProofreadResult = {
  correctedInput: 'This is correct.',
  corrections: [{ startIndex: 0, endIndex: 4, correction: 'This', types: ['capitalization'] }]
};

const proofreaderInstance = () => ({
  includeCorrectionTypes: true,
  includeCorrectionExplanations: false,
  expectedInputLanguages: ['en'],
  proofread: vi.fn().mockResolvedValue(proofreadResult),
  destroy: vi.fn()
});

describe('language detector', () => {
  it('creates, detects, measures, and exposes quota state', async () => {
    const native = detectorInstance();
    const availability = vi.fn().mockResolvedValue('available');
    const create = vi.fn().mockResolvedValue(native);
    vi.stubGlobal('LanguageDetector', { availability, create });
    const controller = createLanguageDetector({ expectedInputLanguages: ['en', 'fr'] });

    await expect(controller.init({ expectedInputLanguages: ['en'] })).resolves.toBe('available');
    await expect(controller.detect('Hello')).resolves.toEqual(detectionResults);
    await expect(controller.measureInputUsage('Hello')).resolves.toBe(8);
    expect(availability).toHaveBeenCalledWith({ expectedInputLanguages: ['en', 'fr'] });
    expect(create.mock.calls[0]?.[0]).toMatchObject({
      expectedInputLanguages: ['en', 'fr'],
      signal: expect.any(AbortSignal),
      monitor: expect.any(Function)
    });
    expect(native.detect).toHaveBeenCalledWith('Hello', expect.objectContaining({ signal: expect.any(AbortSignal) }));
    expect(controller.state.getSnapshot()).toMatchObject({
      results: detectionResults,
      inputUsage: 8,
      inputQuota: 1024,
      processing: ''
    });
  });

  it('records failures and protects latest detection state', async () => {
    const native = detectorInstance();
    const old = deferred<LanguageDetectionResult[]>();
    const staleFailure = deferred<LanguageDetectionResult[]>();
    native.detect
      .mockReturnValueOnce(old.promise)
      .mockResolvedValueOnce([{ detectedLanguage: 'de', confidence: 1 }])
      .mockReturnValueOnce(staleFailure.promise)
      .mockResolvedValueOnce([{ detectedLanguage: 'es', confidence: 1 }]);
    native.measureInputUsage.mockRejectedValueOnce(new Error('measure failed'));
    vi.stubGlobal('LanguageDetector', {
      availability: vi.fn().mockResolvedValue('available'),
      create: vi.fn().mockResolvedValue(native)
    });
    const controller = createLanguageDetector();
    await controller.create();
    const stale = controller.detect('old');
    await flushPromises();
    await controller.detect('new');
    old.resolve(detectionResults);
    await stale;
    expect(controller.state.getSnapshot().results).toEqual([{ detectedLanguage: 'de', confidence: 1 }]);

    const failing = controller.detect('stale failure');
    await flushPromises();
    await controller.detect('latest');
    staleFailure.reject(new Error('stale detect failure'));
    await expect(failing).rejects.toThrow('stale detect failure');
    expect(controller.state.getSnapshot()).toMatchObject({
      results: [{ detectedLanguage: 'es', confidence: 1 }],
      error: null,
      processing: ''
    });

    await expect(controller.measureInputUsage('input')).rejects.toThrow('measure failed');
    expect(controller.state.getSnapshot().error).toEqual(new Error('measure failed'));
  });

  it('ignores stale measurement success, failure, and finalization', async () => {
    const native = detectorInstance();
    const staleSuccess = deferred<number>();
    const staleFailure = deferred<number>();
    native.measureInputUsage
      .mockReturnValueOnce(staleSuccess.promise)
      .mockResolvedValueOnce(3)
      .mockReturnValueOnce(staleFailure.promise)
      .mockResolvedValueOnce(4);
    vi.stubGlobal('LanguageDetector', {
      availability: vi.fn().mockResolvedValue('available'),
      create: vi.fn().mockResolvedValue(native)
    });
    const controller = createLanguageDetector();
    await controller.create();

    const first = controller.measureInputUsage('stale success');
    await flushPromises();
    await controller.measureInputUsage('latest success');
    staleSuccess.resolve(99);
    await first;
    expect(controller.state.getSnapshot().inputUsage).toBe(3);

    const failing = controller.measureInputUsage('stale failure');
    await flushPromises();
    await controller.measureInputUsage('latest again');
    staleFailure.reject(new Error('stale measure failure'));
    await expect(failing).rejects.toThrow('stale measure failure');
    expect(controller.state.getSnapshot()).toMatchObject({ inputUsage: 4, error: null, processing: '' });
  });

  it('destroys and disposes local operations and state', async () => {
    const native = detectorInstance();
    native.detect.mockRejectedValueOnce(new Error('detect failed'));
    vi.stubGlobal('LanguageDetector', {
      availability: vi.fn().mockResolvedValue('available'),
      create: vi.fn().mockResolvedValue(native)
    });
    const controller = createLanguageDetector();
    await expect(controller.detect('bad')).rejects.toThrow('detect failed');
    expect(controller.state.getSnapshot().error).toEqual(new Error('detect failed'));
    controller.interrupt();
    controller.destroy();
    expect(native.destroy).toHaveBeenCalledOnce();
    expect(controller.state.getSnapshot()).toMatchObject({ instance: null, inputUsage: null, inputQuota: null });
    controller.dispose();
    expect(controller.state.getSnapshot()).toMatchObject({ availability: null, results: [], processing: '' });
  });
});

describe('proofreader', () => {
  it('creates and proofreads with the current native surface', async () => {
    const native = proofreaderInstance();
    const availability = vi.fn().mockResolvedValue('available');
    const create = vi.fn().mockResolvedValue(native);
    vi.stubGlobal('Proofreader', { availability, create });
    const controller = createProofreader({ includeCorrectionTypes: true, expectedInputLanguages: ['en'] });

    await expect(controller.proofread('this is correct.')).resolves.toEqual(proofreadResult);
    expect(availability).toHaveBeenCalledWith({ includeCorrectionTypes: true, expectedInputLanguages: ['en'] });
    expect(native.proofread).toHaveBeenCalledWith(
      'this is correct.',
      expect.objectContaining({ signal: expect.any(AbortSignal) })
    );
    expect(controller.state.getSnapshot()).toMatchObject({ result: proofreadResult, processing: '' });
  });

  it('records errors, ignores stale results, and resets lifecycle state', async () => {
    const native = proofreaderInstance();
    const staleResult = deferred<ProofreadResult>();
    const staleFailure = deferred<ProofreadResult>();
    native.proofread
      .mockReturnValueOnce(staleResult.promise)
      .mockResolvedValueOnce({ correctedInput: 'new', corrections: [] })
      .mockReturnValueOnce(staleFailure.promise)
      .mockResolvedValueOnce({ correctedInput: 'latest', corrections: [] })
      .mockRejectedValueOnce(new Error('proofread failed'));
    vi.stubGlobal('Proofreader', {
      availability: vi.fn().mockResolvedValue('available'),
      create: vi.fn().mockResolvedValue(native)
    });
    const controller = createProofreader();
    await controller.create();
    const stale = controller.proofread('old');
    await flushPromises();
    await controller.proofread('new');
    staleResult.resolve(proofreadResult);
    await stale;
    expect(controller.state.getSnapshot().result).toEqual({ correctedInput: 'new', corrections: [] });

    const failing = controller.proofread('stale failure');
    await flushPromises();
    await controller.proofread('latest');
    staleFailure.reject(new Error('stale proofread failure'));
    await expect(failing).rejects.toThrow('stale proofread failure');
    expect(controller.state.getSnapshot()).toMatchObject({
      result: { correctedInput: 'latest', corrections: [] },
      error: null,
      processing: ''
    });

    await expect(controller.proofread('bad')).rejects.toThrow('proofread failed');
    expect(controller.state.getSnapshot().error).toEqual(new Error('proofread failed'));
    controller.destroy();
    expect(native.destroy).toHaveBeenCalledOnce();
    expect(controller.state.getSnapshot().result).toBeNull();
    controller.interrupt();
    controller.dispose();
    expect(controller.state.getSnapshot()).toMatchObject({ instance: null, availability: null, result: null });
  });
});
