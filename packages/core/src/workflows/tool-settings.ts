import { TRANSLATOR_LANGUAGE_OPTIONS } from './translator.js';

export type TextToolKind = 'summarizer' | 'writer' | 'rewriter' | 'translator' | 'language-detector' | 'proofreader';

export interface ToolSetting {
  readonly key: string;
  readonly label: string;
  readonly target: 'create' | 'run';
  readonly type: 'select' | 'checkbox' | 'textarea' | 'number' | 'languages';
  readonly defaultValue: string | number | boolean | readonly string[];
  readonly options?: readonly { value: string; label: string }[];
  readonly min?: number;
  readonly max?: number;
  readonly step?: number;
}

export interface TextToolConfiguration {
  createOptions: Record<string, unknown>;
  runOptions: Record<string, unknown>;
}

const select = (
  key: string,
  label: string,
  defaultValue: string | number,
  options: readonly (readonly [string, string])[],
  target: ToolSetting['target'] = 'create'
): ToolSetting => ({
  key,
  label,
  target,
  type: 'select',
  defaultValue,
  options: options.map(([value, label]) => ({ value, label }))
});

const stripHtml: ToolSetting = {
  key: 'stripHtml',
  label: 'Strip HTML',
  target: 'run',
  type: 'checkbox',
  defaultValue: true
};
const context: ToolSetting = {
  key: 'context',
  label: 'Additional context',
  target: 'run',
  type: 'textarea',
  defaultValue: ''
};
const expectedLanguages: ToolSetting = {
  key: 'expectedInputLanguages',
  label: 'Expected languages',
  target: 'create',
  type: 'languages',
  defaultValue: []
};
const format = select('format', 'Format', 'markdown', [
  ['markdown', 'Markdown'],
  ['plain-text', 'Plain text']
]);
const length = select('length', 'Length', 'medium', [
  ['short', 'Short'],
  ['medium', 'Medium'],
  ['long', 'Long']
]);
const fitStrategy = select(
  'fitStrategy',
  'Context fit',
  'truncate-context',
  [
    ['truncate-context', 'Fit context'],
    ['error', 'Require full context']
  ],
  'run'
);

const settings: Record<Exclude<TextToolKind, 'translator'>, readonly ToolSetting[]> = {
  summarizer: [
    select('type', 'Type', 'key-points', [
      ['key-points', 'Key points'],
      ['tldr', 'TL;DR'],
      ['teaser', 'Teaser'],
      ['headline', 'Headline']
    ]),
    length,
    format,
    select('preference', 'Preference', 'auto', [
      ['auto', 'Auto'],
      ['speed', 'Speed'],
      ['capability', 'Capability']
    ]),
    context,
    stripHtml
  ],
  writer: [
    select('tone', 'Tone', 'neutral', [
      ['neutral', 'Neutral'],
      ['formal', 'Formal'],
      ['casual', 'Casual']
    ]),
    length,
    format,
    context,
    fitStrategy,
    stripHtml
  ],
  rewriter: [
    select('tone', 'Tone', 'as-is', [
      ['as-is', 'Keep tone'],
      ['more-formal', 'More formal'],
      ['more-casual', 'More casual']
    ]),
    select('length', 'Length', 'as-is', [
      ['as-is', 'Keep length'],
      ['shorter', 'Shorter'],
      ['longer', 'Longer']
    ]),
    select('format', 'Format', 'as-is', [
      ['as-is', 'Keep format'],
      ['markdown', 'Markdown'],
      ['plain-text', 'Plain text']
    ]),
    { ...context, label: 'Rewrite guidance' },
    fitStrategy,
    stripHtml
  ],
  'language-detector': [
    expectedLanguages,
    {
      key: 'minConfidence',
      label: 'Confidence',
      target: 'run',
      type: 'number',
      defaultValue: 0.42,
      min: 0,
      max: 0.95,
      step: 0.01
    },
    select(
      'maxResults',
      'Results',
      6,
      [
        ['3', 'Top 3'],
        ['5', 'Top 5'],
        ['6', 'Top 6'],
        ['8', 'Top 8'],
        ['12', 'Top 12']
      ],
      'run'
    ),
    select(
      'largeInputStrategy',
      'Long input',
      'chunk',
      [
        ['chunk', 'Chunk and merge'],
        ['sample', 'Sample'],
        ['never', 'Native only']
      ],
      'run'
    ),
    stripHtml
  ],
  proofreader: [
    expectedLanguages,
    select(
      'largeInputStrategy',
      'Long input',
      'auto',
      [
        ['auto', 'Split when needed'],
        ['never', 'Native only']
      ],
      'run'
    ),
    select(
      'maxChunkCharacters',
      'Chunk size',
      8000,
      [
        ['4000', '4k chars'],
        ['8000', '8k chars'],
        ['12000', '12k chars'],
        ['16000', '16k chars']
      ],
      'run'
    ),
    {
      key: 'includeCorrectionTypes',
      label: 'Correction types',
      target: 'create',
      type: 'checkbox',
      defaultValue: false
    },
    {
      key: 'includeCorrectionExplanations',
      label: 'Explanations',
      target: 'create',
      type: 'checkbox',
      defaultValue: false
    },
    {
      key: 'correctionExplanationLanguage',
      label: 'Explanation language',
      target: 'create',
      type: 'textarea',
      defaultValue: 'en'
    },
    stripHtml
  ]
};

let translatorSettings: readonly ToolSetting[] | undefined;

/** Shared UI descriptors; callers should treat the returned records as immutable. */
export const getTextToolSettings = (kind: TextToolKind): readonly ToolSetting[] => {
  if (kind !== 'translator') return settings[kind];
  if (!translatorSettings) {
    const options = TRANSLATOR_LANGUAGE_OPTIONS.map(({ code, name }) => ({ value: code, label: name }));
    translatorSettings = [
      { key: 'sourceLanguage', label: 'From', target: 'create', type: 'select', defaultValue: 'en', options },
      { key: 'targetLanguage', label: 'To', target: 'create', type: 'select', defaultValue: 'es', options },
      stripHtml
    ];
  }
  return translatorSettings;
};

/** Combine UI defaults with caller options without changing caller-owned records. */
export const resolveTextToolOptions = (
  kind: TextToolKind,
  createOptions: object = {},
  runOptions: object = {}
): TextToolConfiguration => {
  const resolved = { createOptions: {} as Record<string, unknown>, runOptions: {} as Record<string, unknown> };
  for (const setting of getTextToolSettings(kind)) {
    const target = setting.target === 'create' ? resolved.createOptions : resolved.runOptions;
    target[setting.key] = Array.isArray(setting.defaultValue) ? [...setting.defaultValue] : setting.defaultValue;
  }
  Object.assign(resolved.createOptions, createOptions);
  Object.assign(resolved.runOptions, runOptions);
  return resolved;
};

/** Normalize form values; step is an input hint, not a rounding rule. */
export const parseToolSetting = (setting: ToolSetting, raw: string | boolean): ToolSetting['defaultValue'] => {
  if (setting.type === 'checkbox') return raw === true || raw === 'true' || raw === 'on';
  if (setting.type === 'languages')
    return typeof raw === 'string'
      ? raw
          .split(',')
          .map((value) => value.trim())
          .filter(Boolean)
      : [];
  if (setting.type === 'number' || typeof setting.defaultValue === 'number') {
    const parsed = typeof raw === 'string' && raw.trim() ? Number(raw) : NaN;
    const fallback =
      typeof setting.defaultValue === 'number' && Number.isFinite(setting.defaultValue) ? setting.defaultValue : 0;
    const value = Number.isFinite(parsed) ? parsed : fallback;
    return Math.min(setting.max ?? Infinity, Math.max(setting.min ?? -Infinity, value));
  }
  return raw;
};
