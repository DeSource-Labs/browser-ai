import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  createLanguageDetectorWorkflow,
  createProofreaderWorkflow,
  createRewriterWorkflow,
  createSummarizerWorkflow,
  createTranslatorWorkflow,
  createWriterWorkflow
} from '../../src/workflows';
import {
  getTextToolSettings,
  parseToolSetting,
  resolveTextToolOptions,
  type TextToolKind,
  type ToolSetting
} from '../../src/workflows/tool-settings';

type ResolvedOptions = ReturnType<typeof resolveTextToolOptions>;

const workflowCases = [
  {
    kind: 'summarizer',
    native: 'Summarizer',
    edits: { type: 'headline', length: 'long', context: 'Keep dates' },
    nativeOptions: { type: 'headline', length: 'long', format: 'markdown', preference: 'auto' },
    build() {
      const api = createSummarizerWorkflow();
      return {
        dispose: api.dispose,
        run: (input: string, options: ResolvedOptions) =>
          api.summarizeWithDetails(input, { ...options.runOptions, createOptions: options.createOptions })
      };
    }
  },
  {
    kind: 'writer',
    native: 'Writer',
    edits: { tone: 'formal', context: 'Keep dates', fitStrategy: 'error' },
    nativeOptions: { tone: 'formal', length: 'medium', format: 'markdown' },
    build() {
      const api = createWriterWorkflow();
      return {
        dispose: api.dispose,
        run: (input: string, options: ResolvedOptions) =>
          api.writeWithDetails(input, { ...options.runOptions, createOptions: options.createOptions })
      };
    }
  },
  {
    kind: 'rewriter',
    native: 'Rewriter',
    edits: { tone: 'more-casual', length: 'shorter', format: 'plain-text' },
    nativeOptions: { tone: 'more-casual', length: 'shorter', format: 'plain-text' },
    build() {
      const api = createRewriterWorkflow();
      return {
        dispose: api.dispose,
        run: (input: string, options: ResolvedOptions) =>
          api.rewriteWithDetails(input, { ...options.runOptions, createOptions: options.createOptions })
      };
    }
  },
  {
    kind: 'translator',
    native: 'Translator',
    edits: { sourceLanguage: 'de', targetLanguage: 'fr' },
    nativeOptions: { sourceLanguage: 'de', targetLanguage: 'fr' },
    build() {
      const api = createTranslatorWorkflow();
      return {
        dispose: api.dispose,
        run: (input: string, options: ResolvedOptions) =>
          api.translateWithDetails(input, {
            ...options.runOptions,
            createOptions: {
              sourceLanguage: String(options.createOptions.sourceLanguage),
              targetLanguage: String(options.createOptions.targetLanguage)
            }
          })
      };
    }
  },
  {
    kind: 'language-detector',
    native: 'LanguageDetector',
    edits: { expectedInputLanguages: ' en, fr, ', minConfidence: '0.7', maxResults: '3', largeInputStrategy: 'sample' },
    nativeOptions: { expectedInputLanguages: ['en', 'fr'] },
    build() {
      const api = createLanguageDetectorWorkflow();
      return {
        dispose: api.dispose,
        run: (input: string, options: ResolvedOptions) =>
          api.detectWithDetails(input, { ...options.runOptions, createOptions: options.createOptions })
      };
    }
  },
  {
    kind: 'proofreader',
    native: 'Proofreader',
    edits: {
      expectedInputLanguages: ' en, fr, ',
      includeCorrectionTypes: 'true',
      includeCorrectionExplanations: 'true',
      correctionExplanationLanguage: 'fr',
      maxChunkCharacters: '4000',
      largeInputStrategy: 'never'
    },
    nativeOptions: {
      expectedInputLanguages: ['en', 'fr'],
      includeCorrectionTypes: true,
      includeCorrectionExplanations: true,
      correctionExplanationLanguage: 'fr'
    },
    build() {
      const api = createProofreaderWorkflow();
      return {
        dispose: api.dispose,
        run: (input: string, options: ResolvedOptions) =>
          api.proofreadWithDetails(input, { ...options.runOptions, createOptions: options.createOptions })
      };
    }
  }
] satisfies Array<{
  kind: TextToolKind;
  native: string;
  edits: Record<string, string>;
  nativeOptions: object;
  build(): { dispose(): void; run(input: string, options: ResolvedOptions): Promise<unknown> };
}>;

afterEach(() => vi.unstubAllGlobals());

describe.each(workflowCases)('$kind UI settings', ({ kind, native, edits, nativeOptions, build }) => {
  it('passes edited settings through the shared workflow to the native API', async () => {
    const generate = vi.fn(async (_input: string, _options: { signal: AbortSignal; context?: string }) => {
      if (kind === 'language-detector') return [{ detectedLanguage: 'en', confidence: 0.98 }];
      if (kind === 'proofreader') return { correctedInput: 'Edited', corrections: [] };
      return 'Edited';
    });
    const model = {
      inputQuota: 1000,
      measureInputUsage: vi.fn(async () => 5),
      summarize: generate,
      write: generate,
      rewrite: generate,
      translate: generate,
      detect: generate,
      proofread: generate,
      destroy: vi.fn()
    };
    const create = vi.fn(async (options: object) => Object.assign(model, options));
    vi.stubGlobal(native, { availability: async () => 'available', create });
    const options = resolveTextToolOptions(kind);
    for (const [key, raw] of Object.entries({ ...edits, stripHtml: false })) {
      const setting = getTextToolSettings(kind).find((candidate) => candidate.key === key)!;
      const target = setting.target === 'create' ? options.createOptions : options.runOptions;
      target[key] = parseToolSetting(setting, raw);
    }
    const api = build();
    try {
      const result = await api.run('<p>Example</p>', options);
      expect(create).toHaveBeenCalledExactlyOnceWith(expect.objectContaining(nativeOptions));
      expect(generate).toHaveBeenCalledExactlyOnceWith(
        '<p>Example</p>',
        expect.objectContaining({ signal: expect.any(AbortSignal) })
      );
      if (kind === 'summarizer' || kind === 'writer') {
        expect(generate.mock.calls[0]?.[1]).toMatchObject({ context: 'Keep dates' });
      }
      if (kind === 'language-detector') expect(result).toMatchObject({ minConfidence: 0.7, maxResults: 3 });
      if (kind === 'translator')
        expect(result).toMatchObject({ sourceLanguage: 'de', targetLanguage: 'fr', bypassed: false });
      if (kind === 'proofreader')
        expect(result).toMatchObject({
          includeCorrectionTypes: true,
          includeCorrectionExplanations: true,
          correctionExplanationLanguage: 'fr'
        });
    } finally {
      api.dispose();
    }
    expect(model.destroy).toHaveBeenCalledOnce();
  });
});

const settingFor = (kind: TextToolKind, key: string) =>
  getTextToolSettings(kind).find((setting) => setting.key === key)!;

describe('form value normalization', () => {
  it.each([
    [true, true],
    [false, false],
    ['true', true],
    ['on', true],
    ['false', false],
    ['', false]
  ] as const)('converts checkbox value %s to %s', (raw, expected) => {
    expect(parseToolSetting(settingFor('writer', 'stripHtml'), raw)).toBe(expected);
  });

  it('trims comma-separated language hints and removes empty entries', () => {
    const setting = settingFor('language-detector', 'expectedInputLanguages');
    expect(parseToolSetting(setting, ' en, , fr, zh-Hant ')).toEqual(['en', 'fr', 'zh-Hant']);
    expect(parseToolSetting(setting, ' , ')).toEqual([]);
    expect(parseToolSetting(setting, false)).toEqual([]);
  });

  it.each(['', ' ', 'invalid', 'NaN', 'Infinity', '-Infinity', false] as const)(
    'uses the numeric default for invalid input %s',
    (raw) => {
      expect(parseToolSetting(settingFor('language-detector', 'minConfidence'), raw)).toBe(0.42);
    }
  );

  it('clamps numeric boundaries without rounding valid fractional input to the HTML step', () => {
    const setting = settingFor('language-detector', 'minConfidence');
    expect(parseToolSetting(setting, '-2')).toBe(0);
    expect(parseToolSetting(setting, '2')).toBe(0.95);
    expect(parseToolSetting(setting, '0.333')).toBe(0.333);
    expect(parseToolSetting(settingFor('proofreader', 'maxChunkCharacters'), '12000')).toBe(12000);
    expect(parseToolSetting(settingFor('language-detector', 'maxResults'), '8')).toBe(8);
  });

  it.each([NaN, 'invalid'])('keeps numbers finite even with an invalid custom default: %s', (defaultValue) => {
    const setting: ToolSetting = { key: 'custom', label: 'Custom', target: 'run', type: 'number', defaultValue };
    expect(parseToolSetting(setting, 'invalid')).toBe(0);
  });

  it('preserves text exactly for context and string selects', () => {
    expect(parseToolSetting(settingFor('writer', 'context'), '  Keep \n whitespace  ')).toBe('  Keep \n whitespace  ');
    expect(parseToolSetting(settingFor('rewriter', 'tone'), 'more-formal')).toBe('more-formal');
  });
});

it('preserves caller options and callbacks without sharing mutable default language arrays', () => {
  const onProgress = vi.fn();
  const createOptions = Object.freeze({ expectedInputLanguages: ['fr'], customOption: 'kept' });
  const runOptions = Object.freeze({ stripHtml: false, onProgress, autoCreate: false });
  const resolved = resolveTextToolOptions('language-detector', createOptions, runOptions);
  expect(resolved.createOptions).toMatchObject(createOptions);
  expect(resolved.runOptions).toMatchObject(runOptions);
  expect(resolved.runOptions.onProgress).toBe(onProgress);
  expect(onProgress).not.toHaveBeenCalled();
  const first = resolveTextToolOptions('language-detector');
  (first.createOptions.expectedInputLanguages as string[]).push('de');
  expect(resolveTextToolOptions('language-detector').createOptions.expectedInputLanguages).toEqual([]);
  expect(settingFor('language-detector', 'expectedInputLanguages').defaultValue).toEqual([]);
});

it('reuses cached translator descriptors and the same option list for both selectors', () => {
  const first = getTextToolSettings('translator');
  expect(getTextToolSettings('translator')).toBe(first);
  const source = settingFor('translator', 'sourceLanguage');
  const target = settingFor('translator', 'targetLanguage');
  expect(source.options).toBe(target.options);
  expect(source.options).toContainEqual({ value: 'fr', label: 'French' });
  expect(source.options?.some(({ value }) => value === source.defaultValue)).toBe(true);
  expect(target.options?.some(({ value }) => value === target.defaultValue)).toBe(true);
});
