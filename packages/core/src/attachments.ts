export type BrowserAiAttachmentKind = 'audio' | 'image' | 'text';

export interface BrowserAiAttachment {
  id?: string;
  name?: string;
  type?: string;
  kind?: BrowserAiAttachmentKind;
  value: Blob | ImageBitmapSource | AudioBuffer | BufferSource | string;
}

export interface ReadTextSourceOptions {
  maxBytes?: number;
  encoding?: string;
}

export interface BuildPromptOptions {
  emptyText?: string;
  maxTextFileBytes?: number;
}

export const TEXT_FILE_ACCEPT = '.txt,.md,.markdown,.json,.jsonl,.csv,.tsv,.html,.xml,text/*,application/json';
export const PROMPT_FILE_ACCEPT = `image/*,audio/*,${TEXT_FILE_ACCEPT}`;

const DEFAULT_MAX_TEXT_FILE_BYTES = 2 * 1024 * 1024;
const TEXT_MIME_PATTERN = /^(?:text\/[^;\s]+|application\/(?:json|ld\+json|xml|xhtml\+xml|javascript|csv))(?:\s*;|$)/i;
const TEXT_FILE_EXTENSION = /\.(?:txt|md|markdown|jsonl?|csv|tsv|html|xml)$/i;

const isBlob = (value: unknown): value is Blob => typeof Blob !== 'undefined' && value instanceof Blob;
const isAudioBuffer = (value: unknown): value is AudioBuffer =>
  typeof AudioBuffer !== 'undefined' && value instanceof AudioBuffer;
const isArrayBuffer = (value: unknown): value is ArrayBuffer =>
  value instanceof ArrayBuffer || Object.prototype.toString.call(value) === '[object ArrayBuffer]';
const isBufferSource = (value: unknown): value is BufferSource => isArrayBuffer(value) || ArrayBuffer.isView(value);
const getFileName = (value: unknown): string | undefined =>
  typeof File !== 'undefined' && value instanceof File ? value.name : undefined;

export const inferAttachmentKind = (attachment: BrowserAiAttachment): BrowserAiAttachmentKind => {
  if (attachment.kind) return attachment.kind;
  const mime = attachment.type || (isBlob(attachment.value) ? attachment.value.type : '');
  if (mime.startsWith('image/')) return 'image';
  if (mime.startsWith('audio/') || isAudioBuffer(attachment.value)) return 'audio';
  if (typeof attachment.value === 'string' || TEXT_MIME_PATTERN.test(mime)) return 'text';
  if (!mime && TEXT_FILE_EXTENSION.test(getFileName(attachment.value) ?? attachment.name ?? '')) return 'text';
  throw new TypeError(`Unsupported attachment type${mime ? `: ${mime}` : ''}.`);
};

export const readTextSource = async (
  source: Blob | BufferSource | string,
  options: ReadTextSourceOptions = {}
): Promise<string> => {
  if (typeof source === 'string') return source;
  const maxBytes = options.maxBytes ?? DEFAULT_MAX_TEXT_FILE_BYTES;
  const bytes = isBlob(source) ? source.size : isArrayBuffer(source) ? source.byteLength : source.byteLength;

  if (bytes > maxBytes) {
    throw new RangeError(`Text attachment exceeds the ${maxBytes}-byte limit.`);
  }

  if (isBlob(source) && options.encoding === undefined) return source.text();
  const input = isBlob(source) ? await source.arrayBuffer() : source;
  const view = isArrayBuffer(input)
    ? new Uint8Array(input)
    : new Uint8Array(input.buffer, input.byteOffset, input.byteLength);
  return new TextDecoder(options.encoding ?? 'utf-8', { fatal: false }).decode(view);
};

export const getExpectedInputTypes = (attachments: readonly BrowserAiAttachment[]) => {
  const types = new Set<LanguageModelMessageType>(['text']);
  attachments.forEach((attachment) => types.add(inferAttachmentKind(attachment)));
  return Array.from(types);
};

export const mergeExpectedInputs = (
  expectedInputs: LanguageModelCreateCoreOptions['expectedInputs'],
  attachments: readonly BrowserAiAttachment[]
) => {
  const next = [...(expectedInputs ?? [])];
  for (const type of getExpectedInputTypes(attachments)) {
    if (!next.some((item) => item.type === type)) next.push({ type });
  }
  return next;
};

export const buildPrompt = async (
  text: string,
  attachments: readonly BrowserAiAttachment[] = [],
  options: BuildPromptOptions = {}
): Promise<LanguageModelPrompt> => {
  if (attachments.length === 0) return text;

  const content: LanguageModelMessageContent[] = [
    { type: 'text', value: text.trim() || options.emptyText || 'Describe the attached content.' }
  ];

  for (const attachment of attachments) {
    const kind = inferAttachmentKind(attachment);
    if (kind === 'text') {
      const source = attachment.value;
      if (typeof source !== 'string' && !isBlob(source) && !isBufferSource(source)) {
        throw new TypeError('Text attachments must contain a string, Blob, or BufferSource.');
      }
      const value = await readTextSource(source, { maxBytes: options.maxTextFileBytes });
      const label = (attachment.name ?? getFileName(source))?.trim();
      content.push({ type: 'text', value: label ? `File: ${label}\n\n${value}` : value });
      continue;
    }

    content.push({ type: kind, value: attachment.value as LanguageModelMessageValue });
  }

  return [{ role: 'user', content }];
};
