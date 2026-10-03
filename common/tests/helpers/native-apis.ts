import { vi, type Mock } from 'vitest';
import { failingTextStream, textStream } from './streams';

interface PromptApiMock extends EventTarget {
  contextUsage: number;
  contextWindow: number;
  prompt: Mock;
  promptStreaming: Mock;
  append: Mock;
  measureContextUsage: Mock;
  clone: Mock;
  destroy: Mock;
}

interface TextApiMock {
  inputQuota: number;
  measureInputUsage: Mock;
  summarize: Mock;
  summarizeStreaming: Mock;
  write: Mock;
  writeStreaming: Mock;
  rewrite: Mock;
  rewriteStreaming: Mock;
  translate: Mock;
  translateStreaming: Mock;
  detect: Mock;
  proofread: Mock;
  destroy: Mock;
}

export const installPromptApi = ({
  output = 'Native answer',
  chunks = ['Native ', 'answer'],
  failure
}: {
  output?: string;
  chunks?: string[];
  failure?: unknown;
} = {}): { native: PromptApiMock; create: Mock } => {
  const native = Object.assign(new EventTarget(), {
    contextUsage: 2,
    contextWindow: 128,
    prompt: failure ? vi.fn().mockRejectedValue(failure) : vi.fn().mockResolvedValue(output),
    promptStreaming: vi.fn().mockReturnValue(failure ? failingTextStream(failure) : textStream(...chunks)),
    append: vi.fn(),
    measureContextUsage: vi.fn().mockResolvedValue(1),
    clone: vi.fn(),
    destroy: vi.fn()
  });
  const create = vi.fn().mockResolvedValue(native);
  vi.stubGlobal('LanguageModel', { availability: vi.fn().mockResolvedValue('available'), create });
  return { native, create };
};

export const installTextApi = (
  name: string,
  overrides: Record<string, unknown> = {}
): { native: TextApiMock; create: Mock; availability: Mock } => {
  const native = {
    inputQuota: 1024,
    measureInputUsage: vi.fn().mockResolvedValue(5),
    summarize: vi.fn().mockResolvedValue('Short summary'),
    summarizeStreaming: vi.fn().mockReturnValue(textStream('Short ', 'summary')),
    write: vi.fn().mockResolvedValue('Draft'),
    writeStreaming: vi.fn().mockReturnValue(textStream('Generated ', 'draft')),
    rewrite: vi.fn().mockResolvedValue('Rewrite'),
    rewriteStreaming: vi.fn().mockReturnValue(textStream('Clear ', 'rewrite')),
    translate: vi.fn().mockResolvedValue('Bonjour'),
    translateStreaming: vi.fn().mockReturnValue(textStream('Bon', 'jour')),
    detect: vi.fn().mockResolvedValue([{ detectedLanguage: 'en', confidence: 0.96 }]),
    proofread: vi.fn().mockResolvedValue({ correctedInput: 'Correct text.', corrections: [] }),
    destroy: vi.fn(),
    ...overrides
  };
  const create = vi.fn().mockResolvedValue(native);
  const availability = vi.fn().mockResolvedValue('available');
  vi.stubGlobal(name, { availability, create });
  return { native, create, availability };
};
