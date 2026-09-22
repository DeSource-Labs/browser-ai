import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  assertJsonSchema,
  buildMeasuredTextChunks,
  buildPrompt,
  createTextChunk,
  getExpectedInputTypes,
  inferAttachmentKind,
  joinTextBlocks,
  mergeExpectedInputs,
  normalizeTextInput,
  readTextSource,
  splitTextIntoSegments,
  stripHtmlForText,
  validateJsonSchema,
  type BrowserAiAttachment
} from '../src';

afterEach(() => vi.unstubAllGlobals());

describe('attachments', () => {
  it('infers explicit, MIME, string, and audio-buffer kinds', () => {
    class FakeAudioBuffer {}
    vi.stubGlobal('AudioBuffer', FakeAudioBuffer);
    expect(inferAttachmentKind({ kind: 'image', value: 'image-id' })).toBe('image');
    expect(inferAttachmentKind({ value: new Blob([], { type: 'image/png' }) })).toBe('image');
    expect(inferAttachmentKind({ value: new Blob([], { type: 'audio/wav' }) })).toBe('audio');
    expect(inferAttachmentKind({ value: new FakeAudioBuffer() as AudioBuffer })).toBe('audio');
    expect(inferAttachmentKind({ value: 'notes' })).toBe('text');
    expect(inferAttachmentKind({ value: new Blob([], { type: 'application/json' }) })).toBe('text');
    expect(() => inferAttachmentKind({ value: new ArrayBuffer(2) })).toThrow('Unsupported attachment type');
    expect(() => inferAttachmentKind({ value: new Blob([], { type: 'application/octet-stream' }) })).toThrow(
      'application/octet-stream'
    );
  });

  it('reads bounded text from every supported source', async () => {
    await expect(readTextSource('plain')).resolves.toBe('plain');
    await expect(readTextSource(new Blob(['blob text'], { type: 'text/plain' }))).resolves.toBe('blob text');
    const bytes = new TextEncoder().encode('typed bytes');
    await expect(readTextSource(bytes.buffer)).resolves.toBe('typed bytes');
    await expect(readTextSource(bytes.subarray(6))).resolves.toBe('bytes');
    await expect(readTextSource(new Blob(['large']), { maxBytes: 2 })).rejects.toThrow('2-byte limit');
  });

  it('infers accepted text filenames only when MIME is absent', () => {
    for (const extension of ['txt', 'md', 'markdown', 'json', 'jsonl', 'csv', 'tsv', 'html', 'xml']) {
      expect(inferAttachmentKind({ value: new File(['content'], `notes.${extension.toUpperCase()}`) })).toBe('text');
    }
    expect(inferAttachmentKind({ name: 'notes.md', value: new Blob(['notes']) })).toBe('text');
    expect(() => inferAttachmentKind({ value: new File(['binary'], 'notes.bin') })).toThrow(
      'Unsupported attachment type'
    );
    expect(() =>
      inferAttachmentKind({ value: new File(['binary'], 'notes.md', { type: 'application/octet-stream' }) })
    ).toThrow('application/octet-stream');
    expect(() => inferAttachmentKind({ type: 'application/jsonfoo', name: 'notes.json', value: new Blob() })).toThrow(
      'application/jsonfoo'
    );
    expect(inferAttachmentKind({ type: 'application/json; charset=utf-8', value: new Blob(['{}']) })).toBe('text');
  });

  it('honors explicit encodings for blobs and checks their byte limit before decoding', async () => {
    const bytes = new Uint8Array([0xe9]);
    const options = { encoding: 'windows-1252' };
    await expect(readTextSource(bytes, options)).resolves.toBe('é');
    await expect(readTextSource(new Blob([bytes]), options)).resolves.toBe('é');
    await expect(readTextSource(new File([bytes], 'notes.txt'), options)).resolves.toBe('é');
    await expect(readTextSource(new Blob([bytes]), { ...options, maxBytes: 0 })).rejects.toThrow('0-byte limit');
  });

  it('labels native files by filename unless an explicit attachment name is provided', async () => {
    const file = new File(['notes'], 'notes.md');
    await expect(buildPrompt('Read', [{ value: file }, { value: file, name: '  Custom label  ' }])).resolves.toEqual([
      {
        role: 'user',
        content: [
          { type: 'text', value: 'Read' },
          { type: 'text', value: 'File: notes.md\n\nnotes' },
          { type: 'text', value: 'File: Custom label\n\nnotes' }
        ]
      }
    ]);
  });

  it('derives and merges expected modalities without duplicates', () => {
    const attachments: BrowserAiAttachment[] = [
      { kind: 'image', value: new Blob() },
      { kind: 'image', value: new Blob() },
      { kind: 'audio', value: new Uint8Array([1]) },
      { value: 'text' }
    ];
    expect(getExpectedInputTypes(attachments)).toEqual(['text', 'image', 'audio']);
    expect(mergeExpectedInputs([{ type: 'image' }], attachments)).toEqual([
      { type: 'image' },
      { type: 'text' },
      { type: 'audio' }
    ]);
  });

  it('builds native multimodal prompts and labels text files', async () => {
    await expect(buildPrompt('hello')).resolves.toBe('hello');
    await expect(buildPrompt('', [{ value: 'unlabelled text' }])).resolves.toEqual([
      {
        role: 'user',
        content: [
          { type: 'text', value: 'Describe the attached content.' },
          { type: 'text', value: 'unlabelled text' }
        ]
      }
    ]);
    const image = new Blob(['image'], { type: 'image/png' });
    const audio = new Uint8Array([1, 2]);
    const prompt = await buildPrompt(
      '  ',
      [
        { name: 'facts.txt', value: new Blob(['alpha'], { type: 'text/plain' }) },
        { kind: 'text', name: 'bytes.txt', value: new TextEncoder().encode('beta') },
        { kind: 'image', value: image },
        { kind: 'audio', value: audio }
      ],
      { emptyText: 'Inspect these files.' }
    );
    expect(prompt).toEqual([
      {
        role: 'user',
        content: [
          { type: 'text', value: 'Inspect these files.' },
          { type: 'text', value: 'File: facts.txt\n\nalpha' },
          { type: 'text', value: 'File: bytes.txt\n\nbeta' },
          { type: 'image', value: image },
          { type: 'audio', value: audio }
        ]
      }
    ]);
    await expect(buildPrompt('', [{ kind: 'text', value: {} as ImageBitmap }])).rejects.toThrow(
      'Text attachments must contain'
    );
  });
});

describe('text planning', () => {
  it('normalizes input and strips HTML in browser and server contexts', () => {
    expect(normalizeTextInput('  a\u00a0 \r\n\t\n\n\n b  ')).toBe('a\n\n b');
    expect(stripHtmlForText('<p>Hello <strong>world</strong></p><p>Again</p>')).toBe('Hello worldAgain');
    expect(stripHtmlForText('already plain')).toBe('already plain');
    vi.stubGlobal('document', undefined);
    expect(stripHtmlForText('<p>Hello <b>world</b></p>')).toBe('Hello world');
  });

  it('tracks normalized offsets across repeated and long paragraphs', () => {
    const repeated = splitTextIntoSegments('same\n\nsame');
    expect(repeated).toEqual([
      { text: 'same', start: 0, end: 4 },
      { text: 'same', start: 6, end: 10 }
    ]);
    const first = `${'A'.repeat(650)}.`;
    const second = `${'B'.repeat(650)}!`;
    const long = `${first}  ${second}`;
    expect(splitTextIntoSegments(long)).toEqual([
      { text: first, start: 0, end: first.length },
      { text: second, start: first.length + 2, end: long.length }
    ]);
    expect(splitTextIntoSegments('   ')).toEqual([]);
  });

  it('creates trimmed chunks and joins blocks', () => {
    expect(createTextChunk('  hello  ', 3, 10)).toEqual({ text: 'hello', index: 3, start: 12, end: 17 });
    expect(createTextChunk('   ', 0, 5)).toEqual({ text: '', index: 0, start: 5, end: 5 });
    expect(createTextChunk('hello', 1, 4, 20).end).toBe(20);
    expect(joinTextBlocks('', 'next')).toBe('next');
    expect(joinTextBlocks('current', 'next')).toBe('current\n\nnext');
  });

  it('packs measured segments and preserves source spans', async () => {
    const progress = vi.fn();
    const input = 'First paragraph.\n\nSecond paragraph.';
    const chunks = await buildMeasuredTextChunks({
      input,
      budget: 100,
      measure: async (text) => text.length,
      startIndex: 4,
      onProgress: progress
    });
    expect(chunks).toEqual([{ text: input, index: 4, start: 0, end: input.length }]);
    expect(progress).toHaveBeenCalledTimes(2);
  });

  it('handles empty plans and prefers natural whitespace for large splits', async () => {
    await expect(buildMeasuredTextChunks({ input: '   ', budget: 10, measure: async () => 0 })).resolves.toEqual([]);
    const input = `${'word '.repeat(90).trim()}. ${'tail '.repeat(90).trim()}!`;
    const chunks = await buildMeasuredTextChunks({ input, budget: 400, measure: async (text) => text.length });
    expect(chunks.length).toBeGreaterThan(1);
    expect(chunks[0]?.text.endsWith('word')).toBe(true);
    expect(chunks.map(({ text }) => text).join(' ')).toContain('tail tail');
  });

  it('flushes current content before splitting an oversized next segment', async () => {
    const input = `short\n\n${'word '.repeat(80).trim()}`;
    const chunks = await buildMeasuredTextChunks({ input, budget: 40, measure: async (text) => text.length });
    expect(chunks[0]).toMatchObject({ text: 'short', start: 0, end: 5 });
    expect(chunks.length).toBeGreaterThan(2);
    expect(chunks.map(({ text }) => text).join(' ')).toContain('word word');
    chunks.forEach((chunk) => expect(chunk.text.length).toBeLessThanOrEqual(40));
    expect(chunks[chunks.length - 1]?.end).toBe(input.length);
  });

  it('starts a fresh chunk when the combined text is too large but the next segment fits', async () => {
    const chunks = await buildMeasuredTextChunks({
      input: '123456\n\nabcdef',
      budget: 10,
      measure: async (text) => text.length
    });
    expect(chunks).toEqual([
      { text: '123456', index: 0, start: 0, end: 6 },
      { text: 'abcdef', index: 1, start: 8, end: 14 }
    ]);
  });

  it('falls back to bounded slices when one character exceeds the measured budget', async () => {
    const input = 'x'.repeat(1300);
    const chunks = await buildMeasuredTextChunks({ input, budget: 0, measure: async () => 1 });
    expect(chunks.map(({ text }) => text.length)).toEqual([1200, 100]);
  });
});

describe('JSON schema validation', () => {
  const schema = {
    type: 'object',
    required: ['name', 'count', 'items'],
    properties: {
      name: { type: 'string', minLength: 2, maxLength: 4, pattern: '^[a-z]+$' },
      count: { type: 'integer', minimum: 1, maximum: 3 },
      items: { type: 'array', minItems: 1, maxItems: 2, items: { type: ['string', 'null'] } },
      mode: { enum: ['safe'], const: 'safe' },
      enabled: { type: 'boolean' }
    },
    additionalProperties: false
  };

  it('accepts matching nested values', () => {
    expect(
      validateJsonSchema({ name: 'alex', count: 2, items: ['a', null], mode: 'safe', enabled: true }, schema)
    ).toEqual({
      valid: true,
      errors: []
    });
    expect(validateJsonSchema('anything', [] as unknown as object)).toEqual({ valid: true, errors: [] });
  });

  it('reports type, property, range, shape, and format failures', () => {
    const result = validateJsonSchema({ name: 'A', count: 4.5, items: [], mode: 'unsafe', extra: true }, schema);
    expect(result.valid).toBe(false);
    expect(result.errors.join(' ')).toContain('$.name must contain at least 2');
    expect(result.errors.join(' ')).toContain('$.name has an invalid format');
    expect(result.errors.join(' ')).toContain('$.count must be integer');
    expect(result.errors.join(' ')).toContain('$.items must contain at least 1');
    expect(result.errors.join(' ')).toContain('$.mode must match one');
    expect(result.errors.join(' ')).toContain('$.mode must match the constant');
    expect(result.errors.join(' ')).toContain('$.extra is not allowed');
    expect(() => assertJsonSchema({}, schema, 'Tool input')).toThrow('Tool input failed schema validation');
  });

  it('handles numeric, length, invalid-pattern, and primitive branches', () => {
    expect(validateJsonSchema('abcde', { type: 'string', maxLength: 3 }).valid).toBe(false);
    expect(validateJsonSchema('abc', { type: 'string', pattern: '[' }).errors[0]).toContain('invalid schema pattern');
    expect(validateJsonSchema(0, { type: 'number', minimum: 1 }).valid).toBe(false);
    expect(validateJsonSchema(4, { type: 'number', maximum: 3 }).valid).toBe(false);
    expect(validateJsonSchema([1, 2, 3], { type: 'array', maxItems: 2 }).valid).toBe(false);
    expect(validateJsonSchema(null, { type: 'null' }).valid).toBe(true);
    expect(validateJsonSchema(false, { type: 'boolean' }).valid).toBe(true);
  });

  it('supports allOf, anyOf, oneOf, deep enum, and ignored unknown types', () => {
    expect(validateJsonSchema(2, { allOf: [{ type: 'number', minimum: 1 }, null, { maximum: 3 }] }).valid).toBe(true);
    expect(validateJsonSchema('x', { anyOf: [{ type: 'number' }, { const: 'x' }] }).valid).toBe(true);
    expect(validateJsonSchema('x', { anyOf: [{ type: 'number' }] }).valid).toBe(false);
    expect(validateJsonSchema(2, { oneOf: [{ type: 'number' }, { const: 2 }] }).valid).toBe(false);
    expect(validateJsonSchema('x', { oneOf: [{ type: 'string' }, { type: 'number' }] }).valid).toBe(true);
    expect(validateJsonSchema({ a: 1 }, { enum: [{ a: 1 }] }).valid).toBe(true);
    expect(validateJsonSchema('x', { type: 'future-type' }).valid).toBe(true);
  });
});
