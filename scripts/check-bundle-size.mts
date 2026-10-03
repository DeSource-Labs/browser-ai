import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { gzipSync } from 'node:zlib';
import { build } from 'vite';

type PackageExport = string | { [condition: string]: PackageExport | undefined } | null;

interface PackageManifest {
  name: string;
  exports?: Record<string, PackageExport>;
  module?: string;
}

const root = fileURLToPath(new URL('..', import.meta.url));
const svelteRequire = createRequire(resolve(root, 'packages/svelte/package.json'));
const { compile } = svelteRequire('svelte/compiler');
const angularRequire = createRequire(resolve(root, 'packages/angular/package.json'));
const compilerPath = angularRequire.resolve('@angular/compiler-cli');
const { NodeJSFileSystem, ConsoleLogger, LogLevel } = await import(compilerPath);
const { createEs2015LinkerPlugin } = await import(angularRequire.resolve('@angular/compiler-cli/linker/babel'));
const { transformAsync } = createRequire(compilerPath)('@babel/core');
const { transform: optimizeAngular } = angularRequire(
  resolve(dirname(angularRequire.resolve('@angular/build')), 'tools/oxc/oxc-transform.js')
);

// These are consumer bundles: include our complete runtime, exclude framework
// runtimes supplied by the application, and gzip the minified JavaScript.
// Limits leave room for small fixes while rejecting accidental UI/runtime imports.
const specifications = [
  ['core', 'createPromptApi', 5000],
  ['core', 'createWebMcp', 5000],
  ['vue', 'usePromptApi', 10000],
  ['vue', 'useWebMcp', 5000],
  ['react', 'usePromptApi', 5000],
  ['react', 'useWebMcp', 5000],
  ['svelte', 'createPromptApi', 5000],
  ['svelte', 'createWebMcp', 5000],
  ['angular', 'createAngularPromptApi', 5000],
  ['angular', 'createAngularWebMcp', 5000]
] as const;

const resolveExport = (value: PackageExport | undefined): string | undefined => {
  if (typeof value === 'string') return value;
  for (const condition of ['import', 'svelte', 'default']) {
    const target = value?.[condition] && resolveExport(value[condition]);
    if (target) return target;
  }
  return undefined;
};

const external = (id: string) => /^(?:vue|react|react-dom|svelte|tslib)(?:\/|$)/.test(id) || id.startsWith('@angular/');

const bundleChecks = specifications.map(async ([directory, exported, limit]) => {
  const failures: string[] = [];
  const packageDirectory = resolve(root, 'packages', directory);
  const manifestPath = resolve(packageDirectory, directory === 'angular' ? 'dist/package.json' : 'package.json');
  const manifest: PackageManifest = JSON.parse(await readFile(manifestPath, 'utf8'));
  const target = resolveExport(manifest.exports?.[directory === 'angular' ? './controllers' : '.']) ?? manifest.module;
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
          if (id === packageEntry && directory === 'angular') {
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
  const outputs = (Array.isArray(result) ? result : [result]).flatMap((item) => {
    if (!('output' in item)) throw new Error('Bundle size checks require a completed build.');
    return item.output;
  });
  const chunks = outputs.filter((item) => item.type === 'chunk');
  const code = chunks.map((item) => item.code).join('\n');
  const bytes = gzipSync(code).length;
  const label = `${manifest.name} ${exported}`;
  const message = `${label}: ${bytes} B gzip (limit ${limit} B)`;
  if (bytes > limit) failures.push(`${label}: ${bytes} B exceeds ${limit} B gzip.`);
  if (code.includes('markdown-it')) failures.push(`${label}: retains the Markdown renderer dependency.`);
  const retainedMarkdown = chunks
    .flatMap((chunk) => Object.entries(chunk.modules))
    .some(([id, module]) => /[/\\]node_modules[/\\]markdown-it[/\\]/.test(id) && module.renderedLength > 0);
  if (retainedMarkdown) failures.push(`${label}: retains bundled Markdown parser code.`);
  if (/(?:chat-history|chat-message__|prompt-api__|writing-tool__|browser-ai-markdown)/.test(code)) {
    failures.push(`${label}: retains unrelated component code.`);
  }
  return { message, failures };
});

// Styles are an explicit component import. Keep obsolete component layouts from
// accumulating in every framework's published stylesheet.
const styleChecks = ['vue', 'react', 'svelte', 'angular'].map(async (framework) => {
  const failures: string[] = [];
  const file = resolve(root, `packages/${framework}/dist/browser-ai-${framework}.css`);
  const css = await readFile(file, 'utf8');
  const bytes = gzipSync(css).length;
  const limit = 6000;
  const message = `@desource/browser-ai-${framework} styles: ${bytes} B gzip (limit ${limit} B)`;
  if (bytes > limit) failures.push(`${framework} styles: ${bytes} B exceeds ${limit} B gzip.`);
  if (/\.(?:language-detector|proofreader|summarizer|translator)(?:__|\s*\{)/.test(css)) {
    failures.push(`${framework} styles: retains obsolete tool layouts.`);
  }
  return { message, failures };
});

const results = await Promise.all([...bundleChecks, ...styleChecks]);
for (const result of results) {
  console.log(result.message);
}

const failures = results.flatMap((result) => result.failures);
if (failures.length) {
  const details = failures.map((failure) => `- ${failure}`).join('\n');
  throw new Error(`Bundle checks failed:\n${details}`);
}
