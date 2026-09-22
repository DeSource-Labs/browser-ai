import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { gzipSync } from 'node:zlib';
import { build } from 'vite';

const root = fileURLToPath(new URL('..', import.meta.url));
const svelteRequire = createRequire(resolve(root, 'packages/browser-ai-svelte/package.json'));
const { compile } = svelteRequire('svelte/compiler');
const angularRequire = createRequire(resolve(root, 'packages/browser-ai-angular/package.json'));
const compilerPath = angularRequire.resolve('@angular/compiler-cli');
const { NodeJSFileSystem, ConsoleLogger, LogLevel } = await import(compilerPath);
const { createEs2015LinkerPlugin } = await import(angularRequire.resolve('@angular/compiler-cli/linker/babel'));
const { transformAsync } = createRequire(compilerPath)('@babel/core');
const { transform: optimizeAngular } = angularRequire(
  resolve(dirname(angularRequire.resolve('@angular/build')), 'tools/babel/plugins/oxc-transform.js')
);

// These are consumer bundles: include our complete runtime, exclude framework
// runtimes supplied by the application, and gzip the minified JavaScript.
// Limits leave room for small fixes while rejecting accidental UI/runtime imports.
const specifications = [
  ['core', 'createPromptApi', 5000],
  ['core', 'createWebMcp', 5000],
  ['browser-ai-vue', 'usePromptApi', 10000],
  ['browser-ai-vue', 'useWebMcp', 5000],
  ['browser-ai-react', 'usePromptApi', 5000],
  ['browser-ai-react', 'useWebMcp', 5000],
  ['browser-ai-svelte', 'createPromptApi', 5000],
  ['browser-ai-svelte', 'createWebMcp', 5000],
  ['browser-ai-angular', 'createAngularPromptApi', 5000],
  ['browser-ai-angular', 'createAngularWebMcp', 5000]
];

const resolveExport = (value) => {
  if (typeof value === 'string') return value;
  for (const condition of ['import', 'svelte', 'default']) {
    const target = value?.[condition] && resolveExport(value[condition]);
    if (target) return target;
  }
  return undefined;
};

const external = (id) => /^(?:vue|react|react-dom|svelte|tslib)(?:\/|$)/.test(id) || id.startsWith('@angular/');
const failures = [];

for (const [directory, exported, limit] of specifications) {
  const packageDirectory = resolve(root, 'packages', directory);
  const manifestPath = resolve(
    packageDirectory,
    directory === 'browser-ai-angular' ? 'dist/package.json' : 'package.json'
  );
  const manifest = JSON.parse(await readFile(manifestPath, 'utf8'));
  const target =
    resolveExport(manifest.exports?.[directory === 'browser-ai-angular' ? './controllers' : '.']) ?? manifest.module;
  if (!target) throw new Error(`No ESM entry point found for ${manifest.name}.`);
  const packageEntry = resolve(dirname(manifestPath), target);
  const probeEntry = resolve(root, '__browser_ai_bundle_probe__.js');
  const result = await build({
    configFile: false,
    logLevel: 'silent',
    define: { ngDevMode: 'false', ngJitMode: 'false' },
    plugins: [
      {
        name: 'browser-ai-bundle-probe',
        resolveId(id) {
          if (id === probeEntry) return probeEntry;
        },
        load(id) {
          if (id === probeEntry) {
            return `import { ${exported} } from ${JSON.stringify(packageEntry)}; globalThis.browserAiBundleProbe = ${exported};`;
          }
        },
        async transform(code, id) {
          if (id.endsWith('.svelte')) {
            return compile(code, { filename: id, generate: 'client', css: 'external', dev: false }).js;
          }
          if (id === packageEntry && directory === 'browser-ai-angular') {
            const linked = await transformAsync(code, {
              filename: id,
              configFile: false,
              babelrc: false,
              plugins: [
                createEs2015LinkerPlugin({
                  fileSystem: new NodeJSFileSystem(),
                  logger: new ConsoleLogger(LogLevel.error)
                })
              ]
            });
            return optimizeAngular(id, linked.code, {
              sourcemap: false,
              sideEffects: false,
              jit: false,
              topLevelSafeMode: true
            });
          }
        }
      }
    ],
    build: {
      write: false,
      target: 'es2022',
      minify: true,
      copyPublicDir: false,
      lib: { entry: probeEntry, formats: ['es'] },
      rolldownOptions: { external, output: { minify: true } }
    }
  });
  const outputs = (Array.isArray(result) ? result : [result]).flatMap((item) => item.output);
  const chunks = outputs.filter((item) => item.type === 'chunk');
  const code = chunks.map((item) => item.code).join('\n');
  const bytes = gzipSync(code).length;
  const label = `${manifest.name} ${exported}`;
  console.log(`${label}: ${bytes} B gzip (limit ${limit} B)`);
  if (bytes > limit) failures.push(`${label}: ${bytes} B exceeds ${limit} B gzip.`);
  if (code.includes('markdown-it')) failures.push(`${label}: retains the Markdown renderer dependency.`);
  const retainedMarkdown = chunks
    .flatMap((chunk) => Object.entries(chunk.modules))
    .some(([id, module]) => /[/\\]node_modules[/\\]markdown-it[/\\]/.test(id) && module.renderedLength > 0);
  if (retainedMarkdown) failures.push(`${label}: retains bundled Markdown parser code.`);
  if (/(?:chat-history|chat-message__|prompt-api__|writing-tool__|browser-ai-markdown)/.test(code)) {
    failures.push(`${label}: retains unrelated component code.`);
  }
}

// Styles are an explicit component import. Keep obsolete component layouts from
// accumulating in every framework's published stylesheet.
for (const framework of ['vue', 'react', 'svelte', 'angular']) {
  const file = resolve(root, `packages/browser-ai-${framework}/dist/browser-ai-${framework}.css`);
  const css = await readFile(file, 'utf8');
  const bytes = gzipSync(css).length;
  const limit = 6000;
  console.log(`@desource/browser-ai-${framework} styles: ${bytes} B gzip (limit ${limit} B)`);
  if (bytes > limit) failures.push(`${framework} styles: ${bytes} B exceeds ${limit} B gzip.`);
  if (/\.(?:language-detector|proofreader|summarizer|translator)(?:__|\s*\{)/.test(css)) {
    failures.push(`${framework} styles: retains obsolete tool layouts.`);
  }
}

if (failures.length) throw new Error(`Bundle checks failed:\n${failures.map((failure) => `- ${failure}`).join('\n')}`);
