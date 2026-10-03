import { access, readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

interface FrameworkSpecification {
  name: string;
  component: (name: string) => string;
  service: (name: string) => string;
  barrel: string;
  componentBarrel?: string;
  serviceBarrel?: string;
  componentExport: (name: string) => string;
  serviceExport: (name: string) => string;
}

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

const kebab = (value: string) => value.replaceAll(/([a-z0-9])([A-Z])/g, '$1-$2').toLowerCase();
const lowerFirst = (value: string) => value[0].toLowerCase() + value.slice(1);
const specifications: FrameworkSpecification[] = [
  {
    name: 'Vue',
    component: (name) => `packages/vue/src/components/${name}.vue`,
    service: (name) => `packages/vue/src/composables/use${name}.ts`,
    barrel: 'packages/vue/src/index.ts',
    componentExport: (name) => `default as ${name}`,
    serviceExport: (name) => `use${name}`
  },
  {
    name: 'React',
    component: (name) => `packages/react/src/components/${name}.tsx`,
    service: (name) => `packages/react/src/hooks/use${name}.ts`,
    barrel: 'packages/react/src/index.ts',
    componentBarrel: 'packages/react/src/components.tsx',
    serviceBarrel: 'packages/react/src/hooks.ts',
    componentExport: (name) => `components/${name}.js`,
    serviceExport: (name) => `hooks/use${name}.js`
  },
  {
    name: 'Svelte',
    component: (name) => `packages/svelte/src/lib/${name}.svelte`,
    service: (name) => `packages/svelte/src/lib/controllers/create${name}.ts`,
    barrel: 'packages/svelte/src/lib/index.ts',
    serviceBarrel: 'packages/svelte/src/lib/controllers.ts',
    componentExport: (name) => `default as ${name}`,
    serviceExport: (name) => `controllers/create${name}.js`
  },
  {
    name: 'Angular',
    component: (name) => `packages/angular/src/lib/${kebab(name)}.component.ts`,
    service: (name) => `packages/angular/src/lib/controllers/create-angular-${kebab(name)}.ts`,
    barrel: 'packages/angular/src/public-api.ts',
    serviceBarrel: 'packages/angular/src/lib/controller.ts',
    componentExport: (name) => `${kebab(name)}.component`,
    serviceExport: (name) => `create-angular-${kebab(name)}`
  }
];

const exists = async (framework: string, kind: 'component' | 'service', name: string, path: string) => {
  try {
    await access(`${root}/${path}`);
  } catch {
    return `${framework}: missing ${kind} ${name} (${path})`;
  }
};

const frameworkFailures = await Promise.all(
  specifications.map(async (specification) => {
    const fileFailures = await Promise.all([
      ...components.map((name) => exists(specification.name, 'component', name, specification.component(name))),
      ...services.map((name) => exists(specification.name, 'service', name, specification.service(name)))
    ]);
    const failures = fileFailures.filter((failure) => failure !== undefined);

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
    return failures;
  })
);

const failures = frameworkFailures.flat();
if (failures.length) {
  const details = failures.map((failure) => `- ${failure}`).join('\n');
  throw new Error(`Framework parity check failed:\n${details}`);
}

console.log(`Framework parity: ${components.length} components and ${services.length} services across 4 packages.`);
