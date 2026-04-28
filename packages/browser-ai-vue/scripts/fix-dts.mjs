import { readdirSync, readFileSync, writeFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const typesDir = join(__dirname, '../dist/types');
const reference = '/// <reference types="@types/dom-chromium-ai" />\n';
const chromiumAiTypeNames = [
  'Availability',
  'LanguageModel',
  'LanguageModelCreate',
  'LanguageModelMessage',
  'LanguageModelPrompt',
  'LanguageModelSystemMessage',
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
  if (content.startsWith(reference)) continue;
  if (!chromiumAiTypeNames.some((typeName) => content.includes(typeName))) continue;

  content = reference + content;
  writeFileSync(path, content, 'utf-8');
}
