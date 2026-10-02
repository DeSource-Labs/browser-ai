import { readdirSync, readFileSync, rmSync, writeFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { rollup } from 'rollup';
import { dts } from 'rollup-plugin-dts';

const __dirname = dirname(fileURLToPath(import.meta.url));
const typesDir = join(__dirname, '../dist/types');
const chromiumAiReference = '/// <reference types="@types/dom-chromium-ai" />\n';
const webMcpReference = '/// <reference types="webmcp-types" />\n';
const chromiumAiTypeNames = [
  'Availability',
  'LanguageModel',
  'LanguageModelCreate',
  'LanguageModelMessage',
  'LanguageModelPrompt',
  'LanguageModelSystemMessage'
];

const walk = (dir) => {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    return entry.isDirectory() ? walk(path) : [path];
  });
};

for (const path of walk(typesDir)) {
  if (!path.endsWith('.d.ts')) continue;

  let content = readFileSync(path, 'utf-8');
  if (
    chromiumAiTypeNames.some((typeName) => content.includes(typeName)) &&
    !content.includes(chromiumAiReference.trim())
  ) {
    content = chromiumAiReference + content;
  }
  if (content.includes('WebMCP.') && !content.includes(webMcpReference.trim())) {
    content = webMcpReference + content;
  }
  writeFileSync(path, content, 'utf-8');
}

const entry = join(typesDir, 'index.d.ts');
writeFileSync(entry, readFileSync(entry, 'utf-8').replace("import './style.scss';\n", ''), 'utf-8');

const bundle = await rollup({
  input: entry,
  external: (id) => !id.startsWith('.') && !id.startsWith('/'),
  plugins: [dts({ respectExternal: true })]
});
await bundle.write({ file: entry, format: 'es' });
await bundle.close();

let bundled = readFileSync(entry, 'utf-8');
if (!bundled.includes(chromiumAiReference.trim())) bundled = chromiumAiReference + bundled;
if (!bundled.includes(webMcpReference.trim())) bundled = webMcpReference + bundled;
writeFileSync(entry, bundled, 'utf-8');
writeFileSync(join(typesDir, 'index.d.cts'), bundled, 'utf-8');

for (const item of readdirSync(typesDir, { withFileTypes: true })) {
  if (item.name === 'index.d.ts' || item.name === 'index.d.cts') continue;
  rmSync(join(typesDir, item.name), { recursive: true, force: true });
}
