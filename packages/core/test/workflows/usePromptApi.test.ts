import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createPromptWorkflow } from '../../src/workflows';

class FakeLanguageModel extends EventTarget {
  static availabilityOptions: LanguageModelCreateCoreOptions[] = [];
  static createOptions: LanguageModelCreateOptions[] = [];

  static async availability(options: LanguageModelCreateCoreOptions = {}) {
    this.availabilityOptions.push(options);
    return 'available' as const;
  }

  static async create(options: LanguageModelCreateOptions = {}) {
    this.createOptions.push(options);
    return new FakeLanguageModel();
  }

  readonly contextWindow = 4096;
  contextUsage = 12;
  readonly temperature = 0.8;
  readonly topK = 3;
  destroyed = false;

  async prompt(_input: LanguageModelPrompt, options?: LanguageModelPromptOptions) {
    if (options?.responseConstraint) return '{"ready":true}';
    return 'response';
  }

  promptStreaming() {
    return new ReadableStream<string>({
      start(controller) {
        controller.enqueue('one');
        controller.enqueue('two');
        controller.close();
      }
    });
  }

  async append() {}

  async measureContextUsage() {
    return 42;
  }

  async clone(options: LanguageModelCloneOptions = {}) {
    expect(options.signal).toBeInstanceOf(AbortSignal);
    return new FakeLanguageModel();
  }

  destroy() {
    this.destroyed = true;
  }
}

describe('createPromptWorkflow', () => {
  beforeEach(() => {
    FakeLanguageModel.availabilityOptions = [];
    FakeLanguageModel.createOptions = [];
    vi.stubGlobal('LanguageModel', FakeLanguageModel);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('keeps samplingMode mutually exclusive with raw sampling parameters', async () => {
    const ai = createPromptWorkflow();
    await ai.init({ samplingMode: 'balanced' });
    await ai.create({ topK: 2, temperature: 0.4 });

    expect(FakeLanguageModel.createOptions.at(-1)).toMatchObject({
      topK: 2,
      temperature: 0.4
    });
    expect(FakeLanguageModel.createOptions.at(-1)).not.toHaveProperty('samplingMode');

    ai.dispose();
  });

  it('lets a create-time sampling mode replace raw defaults', async () => {
    const ai = createPromptWorkflow();
    await ai.init({ topK: 2, temperature: 0.4 });
    await ai.create({ samplingMode: 'creative' });

    expect(FakeLanguageModel.createOptions.at(-1)).toMatchObject({
      samplingMode: 'creative'
    });
    expect(FakeLanguageModel.createOptions.at(-1)).not.toHaveProperty('topK');
    expect(FakeLanguageModel.createOptions.at(-1)).not.toHaveProperty('temperature');

    ai.dispose();
  });

  it('keeps native sessions shallow and supports structured output and cloning', async () => {
    const ai = createPromptWorkflow();
    await ai.create();

    await expect(
      ai.promptJson<{ ready: boolean }>('Status?', {
        responseConstraint: {
          type: 'object',
          properties: { ready: { type: 'boolean' } },
          required: ['ready']
        }
      })
    ).resolves.toEqual({ ready: true });

    const clonedSession = await ai.clone();
    expect(clonedSession).toBeInstanceOf(FakeLanguageModel);
    clonedSession.destroy();
    ai.dispose();
  });

  it('forwards native streaming chunks and clears processing state', async () => {
    const ai = createPromptWorkflow();
    await ai.create();

    const chunks: string[] = [];
    for await (const chunk of ai.promptStreaming('Stream')) {
      chunks.push(chunk);
    }

    expect(chunks).toEqual(['one', 'two']);
    expect(ai.state.getSnapshot().isProcessing).toBe(false);
    ai.dispose();
  });
});
