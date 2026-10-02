import { readFile, writeFile } from 'node:fs/promises';

interface Manifest {
  version?: string;
  dependencies?: Record<string, string>;
  exports?: Record<string, unknown>;
  publishConfig?: Record<string, unknown>;
  style?: string;
  files?: string[];
}

const readManifest = async (url: URL) => JSON.parse(await readFile(url, 'utf8')) as Manifest;
const outputUrl = new URL('../dist/package.json', import.meta.url);
const output = await readManifest(outputUrl);
const core = await readManifest(new URL('../../core/package.json', import.meta.url));

if (output.dependencies?.['@desource/browser-ai']?.startsWith('workspace:')) {
  if (!core.version) throw new Error('Core package version is missing.');
  output.dependencies['@desource/browser-ai'] = core.version;
}
if (output.publishConfig) {
  delete output.publishConfig.directory;
  if (!Object.keys(output.publishConfig).length) delete output.publishConfig;
}
delete output.files;
output.style = './browser-ai-angular.css';
output.exports = {
  ...output.exports,
  './assets/lib.css': './browser-ai-angular.css',
  './browser-ai-angular.css': './browser-ai-angular.css'
};

await writeFile(outputUrl, `${JSON.stringify(output, undefined, 2)}\n`);
