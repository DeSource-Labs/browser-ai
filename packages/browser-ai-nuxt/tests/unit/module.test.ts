import { beforeEach, describe, expect, it, vi } from 'vitest';

const { addComponentMock, addImportsMock } = vi.hoisted(() => ({
  addComponentMock: vi.fn(),
  addImportsMock: vi.fn()
}));

vi.mock('@nuxt/kit', () => ({
  defineNuxtModule: (definition: unknown) => definition,
  addComponent: addComponentMock,
  addImports: addImportsMock
}));

import module, { type ModuleOptions } from '../../src/module';

type Hook = (payload: { references: Array<{ types: string }> }) => void;

const createNuxt = () => {
  const hooks: Record<string, Hook> = {};
  return {
    hooks,
    nuxt: {
      options: { css: [] as string[] },
      hook: vi.fn((name: string, callback: Hook) => (hooks[name] = callback))
    }
  };
};

const setup = async (options: ModuleOptions) => {
  const { nuxt, hooks } = createNuxt();
  await (module as unknown as { setup(options: ModuleOptions, nuxt: typeof nuxt): Promise<void> }).setup(options, nuxt);
  return { nuxt, hooks };
};

beforeEach(() => vi.clearAllMocks());

describe('Nuxt module contract', () => {
  it('declares its defaults and supported Nuxt range', () => {
    const definition = module as unknown as {
      meta: { name: string; compatibility: { nuxt: string } };
      defaults: Required<ModuleOptions>;
    };
    expect(definition.meta).toMatchObject({ name: 'browserAi', compatibility: { nuxt: '>=3.17.0' } });
    expect(definition.defaults).toEqual({ css: true, component: true, helpers: true });
  });

  it('registers framework imports, client components, CSS, and package types', async () => {
    const { nuxt, hooks } = await setup({ css: true, component: true, helpers: true });
    expect(addImportsMock).toHaveBeenCalledOnce();
    const imports = addImportsMock.mock.calls[0]?.[0] as Array<{ name: string; from: string; type?: boolean }>;
    const names = imports.map(({ name }) => name);
    expect(new Set(names).size).toBe(names.length);
    expect(names).toEqual(
      expect.arrayContaining([
        'usePromptApi',
        'useSummarizer',
        'useWriter',
        'useRewriter',
        'useTranslator',
        'useLanguageDetector',
        'useProofreader',
        'useWebMcp',
        'WebMcpTool',
        'LLMPrompt'
      ])
    );
    expect(imports.every(({ from }) => from === '@desource/browser-ai-vue')).toBe(true);
    expect(imports.find(({ name }) => name === 'WebMcpTool')?.type).toBe(true);
    expect(imports.find(({ name }) => name === 'usePromptApi')?.type).toBeUndefined();

    expect(addComponentMock).toHaveBeenCalledTimes(19);
    const components = addComponentMock.mock.calls.map(([definition]) => definition as Record<string, unknown>);
    expect(components).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ name: 'PromptApi', export: 'PromptApi' }),
        expect.objectContaining({ name: 'BrowserAiPromptApi', export: 'PromptApi' }),
        expect.objectContaining({ name: 'BrowserAiPromptInput', export: 'PromptInput' })
      ])
    );
    expect(components.every(({ mode, filePath }) => mode === 'client' && filePath === '@desource/browser-ai-vue')).toBe(
      true
    );
    expect(nuxt.options.css).toEqual(['@desource/browser-ai-vue/assets/lib.css']);

    const references: Array<{ types: string }> = [];
    hooks['prepare:types']?.({ references });
    expect(references).toContainEqual({ types: '@desource/browser-ai-nuxt' });
  });

  it('skips every optional integration when disabled', async () => {
    const { nuxt, hooks } = await setup({ css: false, component: false, helpers: false });
    expect(addImportsMock).not.toHaveBeenCalled();
    expect(addComponentMock).not.toHaveBeenCalled();
    expect(nuxt.options.css).toEqual([]);

    const references: Array<{ types: string }> = [];
    hooks['prepare:types']?.({ references });
    expect(references).toContainEqual({ types: '@desource/browser-ai-nuxt' });
  });
});
