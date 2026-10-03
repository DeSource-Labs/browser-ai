import { readdir, readFile, writeFile } from 'node:fs/promises';

const outputDirectory = new URL('../dist/', import.meta.url);
const entries = await readdir(outputDirectory);

for (const entry of entries) {
  if (!entry.endsWith('.d.ts')) continue;
  const declaration = new URL(entry, outputDirectory);
  let source = await readFile(declaration, 'utf8');
  source = source.replace("import './style.scss';\n", '');
  source = source.replaceAll(/(from\s+['"]\.\/[^'"]+\.svelte)(['"])/g, '$1.js$2');
  await writeFile(declaration, source);
}

const entrypoint = new URL('index.js', outputDirectory);
const source = await readFile(entrypoint, 'utf8');
await writeFile(entrypoint, source.replace("import './style.scss';", ''));
