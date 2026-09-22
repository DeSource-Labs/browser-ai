import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { $fetch, setup } from '@nuxt/test-utils/e2e';
import { describe, expect, it } from 'vitest';
import { getBuildDir, getFixtureRoot } from './utils';

await setup({ rootDir: getFixtureRoot('../fixtures/basic', import.meta.url) });

describe('Nuxt module: default fixture', () => {
  it('builds and serves an application using the module', async () => {
    expect(await $fetch('/')).toContain('browser-ai-nuxt:basic-ok');
  });

  it('generates composable, type, and component declarations', async () => {
    const buildDir = getBuildDir();
    const imports = await readFile(resolve(buildDir, 'imports.d.ts'), 'utf8');
    const components = await readFile(resolve(buildDir, 'components.d.ts'), 'utf8');
    expect(imports).toContain('usePromptApi');
    expect(imports).toContain('WebMcpTool');
    expect(components).toContain('BrowserAiPromptApi');
    expect(components).toContain('BrowserAiMarkdownRenderer');
  });
});
