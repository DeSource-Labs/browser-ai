import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { $fetch, setup } from '@nuxt/test-utils/e2e';
import { describe, expect, it } from 'vitest';
import { getBuildDir, getFixtureRoot } from './utils';

await setup({ rootDir: getFixtureRoot('../fixtures/options-disabled', import.meta.url) });

describe('Nuxt module: disabled fixture', () => {
  it('builds and serves without optional integrations', async () => {
    expect(await $fetch('/')).toContain('browser-ai-nuxt:options-off-ok');
  });

  it('omits helper and component declarations', async () => {
    const buildDir = getBuildDir();
    const imports = await readFile(resolve(buildDir, 'imports.d.ts'), 'utf8');
    const components = await readFile(resolve(buildDir, 'components.d.ts'), 'utf8');
    expect(imports).not.toContain('usePromptApi');
    expect(imports).not.toContain('WebMcpTool');
    expect(components).not.toContain('BrowserAiPromptApi');
  });
});
