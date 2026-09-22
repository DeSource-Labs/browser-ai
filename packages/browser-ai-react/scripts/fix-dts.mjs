import { readFile, writeFile } from 'node:fs/promises';

const declaration = new URL('../dist/index.d.ts', import.meta.url);
const source = await readFile(declaration, 'utf8');

await writeFile(declaration, source.replace("import './style.scss';\n", ''));
