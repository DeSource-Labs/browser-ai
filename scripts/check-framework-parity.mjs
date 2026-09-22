import { access, readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const components = [
  'ChatHistory',
  'ChatSidebar',
  'LanguageDetector',
  'MarkdownRenderer',
  'PromptApi',
  'PromptInput',
  'Proofreader',
  'Rewriter',
  'Summarizer',
  'Translator',
  'Writer'
];
const services = [
  'LanguageDetector',
  'PromptApi',
  'Proofreader',
  'Rewriter',
  'Summarizer',
  'Translator',
  'WebMcp',
  'Writer'
];

const kebab = (value) => value.replaceAll(/([a-z0-9])([A-Z])/g, '$1-$2').toLowerCase();
const lowerFirst = (value) => value[0].toLowerCase() + value.slice(1);
const specifications = [
  {
    name: 'Vue',
    component: (name) => `packages/browser-ai-vue/src/components/${name}.vue`,
    service: (name) => `packages/browser-ai-vue/src/composables/use${name}.ts`,
    barrel: 'packages/browser-ai-vue/src/index.ts',
    componentExport: (name) => `default as ${name}`,
    serviceExport: (name) => `use${name}`
  },
  {
    name: 'React',
    component: (name) => `packages/browser-ai-react/src/components/${name}.tsx`,
    service: (name) => `packages/browser-ai-react/src/hooks/use${name}.ts`,
    barrel: 'packages/browser-ai-react/src/index.ts',
    componentBarrel: 'packages/browser-ai-react/src/components.tsx',
    serviceBarrel: 'packages/browser-ai-react/src/hooks.ts',
    componentExport: (name) => `components/${name}.js`,
    serviceExport: (name) => `hooks/use${name}.js`
  },
  {
    name: 'Svelte',
    component: (name) => `packages/browser-ai-svelte/src/lib/${name}.svelte`,
    service: (name) => `packages/browser-ai-svelte/src/lib/controllers/create${name}.ts`,
    barrel: 'packages/browser-ai-svelte/src/lib/index.ts',
    serviceBarrel: 'packages/browser-ai-svelte/src/lib/controllers.ts',
    componentExport: (name) => `default as ${name}`,
    serviceExport: (name) => `controllers/create${name}.js`
  },
  {
    name: 'Angular',
    component: (name) => `packages/browser-ai-angular/src/lib/${kebab(name)}.component.ts`,
    service: (name) => `packages/browser-ai-angular/src/lib/controllers/create-angular-${kebab(name)}.ts`,
    barrel: 'packages/browser-ai-angular/src/public-api.ts',
    serviceBarrel: 'packages/browser-ai-angular/src/lib/controller.ts',
    componentExport: (name) => `${kebab(name)}.component`,
    serviceExport: (name) => `create-angular-${kebab(name)}`
  }
];

const failures = [];
const exists = async (framework, kind, name, path) => {
  try {
    await access(`${root}/${path}`);
  } catch {
    failures.push(`${framework}: missing ${kind} ${name} (${path})`);
  }
};

for (const specification of specifications) {
  await Promise.all([
    ...components.map((name) => exists(specification.name, 'component', name, specification.component(name))),
    ...services.map((name) => exists(specification.name, 'service', name, specification.service(name)))
  ]);

  const componentBarrelPath = specification.componentBarrel ?? specification.barrel;
  const serviceBarrelPath = specification.serviceBarrel ?? specification.barrel;
  const [componentBarrel, serviceBarrel] = await Promise.all([
    readFile(`${root}/${componentBarrelPath}`, 'utf8'),
    readFile(`${root}/${serviceBarrelPath}`, 'utf8')
  ]);
  for (const name of components) {
    if (!componentBarrel.includes(specification.componentExport(name))) {
      failures.push(`${specification.name}: ${name} is not exported from ${componentBarrelPath}`);
    }
  }
  for (const name of services) {
    if (!serviceBarrel.includes(specification.serviceExport(name))) {
      failures.push(`${specification.name}: ${lowerFirst(name)} service is not exported from ${serviceBarrelPath}`);
    }
  }
}

if (failures.length) {
  throw new Error(`Framework parity check failed:\n${failures.map((failure) => `- ${failure}`).join('\n')}`);
}

console.log(`Framework parity: ${components.length} components and ${services.length} services across 4 packages.`);
