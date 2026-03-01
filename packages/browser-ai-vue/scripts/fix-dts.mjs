import { readFileSync, writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const dtsPath = join(__dirname, '../dist/types/composables/usePromptApi.d.ts');

// Read the generated declaration file
let content = readFileSync(dtsPath, 'utf-8');

// Prepend the triple-slash reference if not already present
const reference = '/// <reference types="@types/dom-chromium-ai" />\n';
if (!content.startsWith(reference)) {
  content = reference + content;
  writeFileSync(dtsPath, content, 'utf-8');
  console.log('✓ Added @types/dom-chromium-ai reference to usePromptApi.d.ts');
}
