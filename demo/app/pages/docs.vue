<template>
  <div class="docs-page">
    <MarketingNav />

    <header class="docs-hero">
      <div class="docs-hero__orbit" aria-hidden="true"><i /><i /><i /></div>
      <p class="docs-kicker">Browser AI Kit documentation</p>
      <h1>Build the local AI feature<br />users expect.</h1>
      <p>
        Start with a complete interface or compose your own. The same typed lifecycle handles readiness, downloads,
        streaming, long input, context, cancellation, and cleanup.
      </p>
      <div class="docs-hero__actions">
        <a class="docs-button docs-button--primary" href="#install">
          <span>Install the kit</span>
        </a>
        <NuxtLink class="docs-button" to="/#apis">Open live examples</NuxtLink>
      </div>
    </header>

    <main class="docs-layout">
      <aside class="docs-sidebar" aria-label="Documentation sections">
        <span>On this page</span>
        <nav>
          <a href="#overview">Overview</a>
          <a href="#install">Install</a>
          <a href="#vue">Vue</a>
          <a href="#nuxt">Nuxt</a>
          <a href="#frameworks">React, Svelte, Angular, core</a>
          <a href="#lifecycle">Browser lifecycle</a>
          <a href="#apis">API directory</a>
          <a href="#webmcp">WebMCP</a>
          <a href="#privacy">Privacy and fallback</a>
          <a href="#faq">FAQ</a>
        </nav>
        <a class="docs-sidebar__github" :href="Links.coreRepo" target="_blank" rel="noopener noreferrer">
          Read source on GitHub →
        </a>
      </aside>

      <article class="docs-content">
        <section id="overview" class="doc-section doc-intro">
          <p class="docs-kicker">Overview</p>
          <h2>Chrome provides the model.<br />The kit provides the product layer.</h2>
          <p>
            Browser AI Kit wraps Chrome's built-in AI APIs in framework-native state and optional interfaces. It does
            not proxy prompts through a server or flatten every capability into one generic abstraction. Prompt,
            Summarizer, Writer, Rewriter, Translator, Language Detector, Proofreader, and WebMCP keep their distinct
            strengths.
          </p>
          <div class="callout callout--note">
            <span aria-hidden="true">i</span>
            <p>
              The library is production-oriented; the browser APIs are still evolving. Always keep an unsupported state
              and a non-AI path for essential work.
            </p>
          </div>
          <div class="principle-grid">
            <div v-for="item in principles" :key="item.title">
              <span>{{ item.icon }}</span>
              <h3>{{ item.title }}</h3>
              <p>{{ item.body }}</p>
            </div>
          </div>
        </section>

        <section id="install" class="doc-section">
          <p class="docs-kicker">Installation</p>
          <h2>Choose the framework boundary.</h2>
          <p>
            Six packages expose one runtime behavior contract. Each adapter maps it to native framework lifecycle and
            state primitives; Nuxt adds client-safe auto-imports around Vue.
          </p>
          <div class="install-grid">
            <div v-for="item in packageItems" :key="item.id" class="install-card">
              <div>
                <span class="install-card__mark">{{ item.mark }}</span>
                <span class="status-chip">Available</span>
              </div>
              <h3>{{ item.name }}</h3>
              <p>{{ item.description }}</p>
              <CodeBlock label="Terminal" :code="item.command" />
              <a :href="item.href" target="_blank" rel="noopener noreferrer">Package guide →</a>
            </div>
          </div>
          <div class="roadmap-note">
            <strong>One browser runtime; native framework ergonomics.</strong>
            The 11 public components and eight headless APIs are checked for parity across Vue, React, Svelte, and
            Angular. Shared contract tests keep markup and behavior aligned without proxying browser-owned model
            objects.
            <a
              href="https://github.com/DeSource-Labs/browser-ai/blob/main/docs/framework-roadmap.md"
              target="_blank"
              rel="noopener noreferrer"
            >
              Read the framework contract →
            </a>
          </div>
        </section>

        <section id="vue" class="doc-section">
          <p class="docs-kicker">Vue quick start</p>
          <h2>Use the full interface.</h2>
          <p>
            Import the stylesheet once, then render a component. The Prompt API interface includes saved chats,
            streaming, attachments supported by Chrome, stop controls, download UX, and context recovery.
          </p>
          <CodeBlock label="PromptExperience.vue" :code="vueComponentCode" />

          <h3 class="doc-subheading">Or own every pixel.</h3>
          <p>
            Composables expose reactive state and direct operations. A native session lives in a shallow ref, avoiding
            expensive traversal while the rest of your UI updates.
          </p>
          <CodeBlock label="LocalPrompt.vue" :code="vueComposableCode" />
        </section>

        <section id="nuxt" class="doc-section">
          <p class="docs-kicker">Nuxt quick start</p>
          <h2>One module, no browser globals on the server.</h2>
          <p>
            Components are registered in client mode. Composables, helpers, language options, and public types are
            auto-imported.
          </p>
          <CodeBlock label="nuxt.config.ts" :code="nuxtCode" />
          <div class="option-table" role="table" aria-label="Nuxt module options">
            <div class="option-table__head" role="row">
              <span role="columnheader">Option</span>
              <span role="columnheader">Default</span>
              <span role="columnheader">Purpose</span>
            </div>
            <div v-for="item in nuxtOptions" :key="item.name" role="row">
              <code role="cell">{{ item.name }}</code>
              <span role="cell">{{ item.default }}</span>
              <span role="cell">{{ item.purpose }}</span>
            </div>
          </div>
        </section>

        <section id="frameworks" class="doc-section">
          <p class="docs-kicker">Every framework package</p>
          <h2>Keep the browser behavior. Choose the state model.</h2>
          <p>
            React uses hooks backed by <code>useSyncExternalStore</code>. Svelte exposes readable stores and controller
            factories. Angular provides signal controllers, standalone components, and <code>BrowserAiService</code>.
            The core package works in vanilla TypeScript and is the only place browser lifecycle logic is implemented.
          </p>
          <div class="api-doc-grid">
            <CodeBlock label="React" :code="reactCode" />
            <CodeBlock label="Svelte" :code="svelteCode" />
            <CodeBlock label="Angular" :code="angularCode" />
            <CodeBlock label="TypeScript core" :code="coreCode" />
          </div>
        </section>

        <section id="lifecycle" class="doc-section">
          <p class="docs-kicker">Browser lifecycle</p>
          <h2>Availability is part of the interface.</h2>
          <p>
            Chrome decides whether a capability is ready, needs local resources, is already downloading, or is
            unavailable on the current profile. Check again when the feature starts; model state can change.
          </p>
          <div class="state-grid">
            <div v-for="state in availabilityStates" :key="state.name">
              <span :class="`state-dot state-dot--${state.name}`" />
              <code>{{ state.name }}</code>
              <p>{{ state.action }}</p>
            </div>
          </div>
          <div class="callout callout--warning">
            <span aria-hidden="true">!</span>
            <p>
              When an API is <code>downloadable</code>, call <code>create()</code> from a genuine click or keyboard
              action. Programmatic clicks and page-load effects do not satisfy Chrome's activation requirement.
            </p>
          </div>

          <h3 class="doc-subheading">Long work stays measurable and cancellable.</h3>
          <p>
            Specialized composables measure the browser's real quota and apply a strategy that fits the task: recursive
            summary rollups, ordered translation chunks, optional-context fitting, confidence merging, or normalized
            proofreader ranges.
          </p>
          <CodeBlock label="Summarizer example" :code="longInputCode" />
        </section>

        <section id="apis" class="doc-section">
          <p class="docs-kicker">API directory</p>
          <h2>Start from the outcome you need.</h2>
          <div class="api-doc-grid">
            <NuxtLink v-for="item in ToolItems" :key="item.id" :to="item.href">
              <span>{{ apiMarks[item.id] }}</span>
              <div>
                <h3>{{ item.name }}</h3>
                <p>{{ item.description }}</p>
              </div>
              <b aria-hidden="true">→</b>
            </NuxtLink>
          </div>
          <p class="docs-caption">
            Every example calls the native API in this browser profile. No demo response is mocked and no hosted model
            is used as a fallback.
          </p>
        </section>

        <section id="webmcp" class="doc-section">
          <p class="docs-kicker">WebMCP</p>
          <h2>Make your application legible to browser agents.</h2>
          <p>
            Register imperative tools, annotate existing forms, discover tools, execute them manually during
            development, and observe lifecycle changes through one composable.
          </p>
          <CodeBlock label="CartTools.vue" :code="webMcpCode" />
          <div class="callout callout--warning">
            <span aria-hidden="true">!</span>
            <p>
              Schemas guide the caller; they do not authorize it. Validate every input and re-check authentication and
              authorization inside
              <code>execute</code>.
            </p>
          </div>
          <h3 class="doc-subheading">Production headers</h3>
          <CodeBlock label="HTTP response" :code="'Origin-Agent-Cluster: ?1\nPermissions-Policy: tools=(self)'" />
          <p class="docs-caption">
            WebMCP is experimental and currently requires Chrome's testing flag or origin-trial availability.
            <a
              href="https://github.com/DeSource-Labs/browser-ai/blob/main/docs/webmcp.md"
              target="_blank"
              rel="noopener noreferrer"
            >
              Read the complete security and deployment guide →
            </a>
          </p>
        </section>

        <section id="privacy" class="doc-section">
          <p class="docs-kicker">Privacy and fallback</p>
          <h2>Be precise about where data goes.</h2>
          <p>
            Browser AI Kit does not send prompts, outputs, or telemetry to DeSource Labs. Built-in model execution
            remains inside Chrome, which owns the model files and resource lifecycle.
          </p>
          <div class="privacy-flow" aria-label="Local inference data flow">
            <span>Your interface</span>
            <b>→</b>
            <span>Browser AI Kit</span>
            <b>→</b>
            <span>Chrome model</span>
          </div>
          <p>
            Your own application code, extensions, monitoring software, and WebMCP tools can still transmit information.
            Audit those paths and never put secrets in client-side prompts or tool descriptions.
          </p>
          <p>
            If local AI is unavailable, keep the manual workflow, explain how to retry, or offer a hosted model only
            after disclosing that content will leave the device. Do not silently cross that privacy boundary.
          </p>
        </section>

        <section id="faq" class="doc-section">
          <p class="docs-kicker">Frequently asked questions</p>
          <h2>Before you ship.</h2>
          <div class="faq-list">
            <details v-for="item in faq" :key="item.question">
              <summary>{{ item.question }}<span aria-hidden="true">+</span></summary>
              <p>{{ item.answer }}</p>
            </details>
          </div>
        </section>

        <section class="docs-next">
          <p class="docs-kicker">Next step</p>
          <h2>Run the real API.</h2>
          <p>
            The example directory detects capabilities in this Chrome profile and lets you test every available surface.
          </p>
          <NuxtLink class="docs-button docs-button--primary" to="/#apis"> Open interactive examples → </NuxtLink>
        </section>
      </article>
    </main>

    <Footer />
  </div>
</template>

<script setup lang="ts">
import type { Tool } from '~~/shared/types';

useSeoMeta({
  title: 'Documentation — Browser AI Kit',
  description:
    'Install and ship Chrome built-in AI in Vue, Nuxt, React, Svelte, Angular, or TypeScript with production lifecycle, multimodal Prompt API, long-input, and WebMCP guidance.'
});

useHead({
  script: [{ src: '/marketing.js', defer: true }]
});

const principles = [
  {
    icon: '⌁',
    title: 'On-device by design',
    body: 'No package-owned inference endpoint, credentials, or usage meter.'
  },
  {
    icon: '↯',
    title: 'Fast framework state',
    body: 'Native sessions stay outside deep reactive proxies and are reused across compatible requests.'
  },
  {
    icon: '◇',
    title: 'Composable by default',
    body: 'Use the interface, the headless state, or direct native-shaped operations.'
  }
];

const packageItems = [
  {
    id: 'typescript',
    mark: 'TS',
    name: 'TypeScript core',
    description: 'Tree-shakeable browser lifecycle and WebMCP controllers.',
    command: NpmCommands.typescript!,
    href: DocLinks.typescript
  },
  {
    id: 'vue',
    mark: 'V',
    name: 'Vue',
    description: 'Components and composables for Vue 3.4.33 or newer.',
    command: NpmCommands.vue!,
    href: DocLinks.vue
  },
  {
    id: 'nuxt',
    mark: 'N',
    name: 'Nuxt',
    description: 'Auto-imports, client components, and SSR-safe defaults.',
    command: NpmCommands.nuxt!,
    href: DocLinks.nuxt
  },
  {
    id: 'react',
    mark: 'R',
    name: 'React',
    description: 'Hooks and accessible components for React 18.3 and 19.',
    command: NpmCommands.react!,
    href: DocLinks.react
  },
  {
    id: 'svelte',
    mark: 'S',
    name: 'Svelte',
    description: 'Readable controllers and components for Svelte 5.',
    command: NpmCommands.svelte!,
    href: DocLinks.svelte
  },
  {
    id: 'angular',
    mark: 'A',
    name: 'Angular',
    description: 'Signals, services, and standalone components for Angular 22.1.7+.',
    command: NpmCommands.angular!,
    href: DocLinks.angular
  }
];

const vueComponentCode = `<script setup lang="ts">
import { PromptApi } from "@desource/browser-ai-vue";
import "@desource/browser-ai-vue/assets/lib.css";
<${'/'}script>

<template>
  <PromptApi
    context-strategy="summarize"
    context-summary-mode="cache-first"
  />
</template>`;

const vueComposableCode = `<script setup lang="ts">
import { ref } from "vue";
import { usePromptApi } from "@desource/browser-ai-vue";

const ai = usePromptApi(); // Disposed with this component's effect scope.
const answer = ref("");
async function ask() {
  await ai.init({
    expectedInputs: [{ type: "text", languages: ["en"] }],
    expectedOutputs: [{ type: "text", languages: ["en"] }],
  });
  await ai.create(); // User action permits a required model download.
  answer.value = await ai.prompt("Explain local AI.");
}
<${'/'}script>

<template>
  <button @click="ask">Explain local AI</button>
  <p>{{ answer }}</p>
</template>`;

const nuxtCode = `export default defineNuxtConfig({
  modules: ["@desource/browser-ai-nuxt"],
  browserAi: {
    css: true,
    component: true,
    helpers: true,
  },
});`;

const reactCode = `import { PromptApi } from "@desource/browser-ai-react";
import "@desource/browser-ai-react/assets/lib.css";

export function Assistant() {
  return <PromptApi allowAttachments />;
}`;

const svelteCode = `<script lang="ts">
  import { PromptApi } from "@desource/browser-ai-svelte";
  import "@desource/browser-ai-svelte/assets/lib.css";
<${'/'}script>

<PromptApi allowAttachments />`;

const angularCode = `import { Component } from "@angular/core";
import { BrowserAiPromptApiComponent } from "@desource/browser-ai-angular";

@Component({
  selector: "app-assistant",
  standalone: true,
  imports: [BrowserAiPromptApiComponent],
  template: '<browser-ai-prompt-api />',
})
export class AssistantComponent {}`;

const coreCode = `import { createPromptApi } from "@desource/browser-ai";

// Call from a button handler when a model download may be needed.
async function ask() {
  const prompt = createPromptApi();
  try {
    return await prompt.prompt("Explain local AI in one sentence.");
  } finally {
    prompt.dispose();
  }
}`;

const longInputCode = `const summarizer = useSummarizer();

const result = await summarizer.summarizeWithDetails(article, {
  createOptions: {
    type: "key-points",
    format: "markdown",
    length: "medium",
  },
  context: "Focus on decisions, owners, and unresolved risks.",
});`;

const webMcpCode = `<script setup lang="ts">
import { onMounted } from "vue";
import { useWebMcp } from "@desource/browser-ai-vue";

const props = defineProps<{ total: number; currency: string }>();
const webMcp = useWebMcp(); // Unregisters tools with the component scope.
onMounted(async () => {
  await webMcp.registerTool({
    name: "get_cart_total",
    description: "Return the displayed cart total without changing it.",
    inputSchema: { type: "object", properties: {}, additionalProperties: false },
    annotations: { readOnlyHint: true },
    execute: async () => ({ total: props.total, currency: props.currency }),
  });
});
<${'/'}script>`;

const nuxtOptions = [
  { name: 'css', default: 'true', purpose: 'Include the component stylesheet' },
  { name: 'component', default: 'true', purpose: 'Register client components' },
  {
    name: 'helpers',
    default: 'true',
    purpose: 'Auto-import helpers and types'
  }
];

const availabilityStates = [
  { name: 'available', action: 'Enable the action and prepare a session.' },
  {
    name: 'downloadable',
    action: 'Explain the local download and wait for a user action.'
  },
  { name: 'downloading', action: 'Show progress and keep the page active.' },
  {
    name: 'unavailable',
    action: 'Keep the essential workflow usable without AI.'
  }
];

const apiMarks: Record<Tool, string> = {
  'prompt-api': 'P',
  summarizer: 'S',
  writer: 'W',
  rewriter: 'R',
  translator: 'T',
  'language-detector': 'L',
  proofreader: 'Pr',
  webmcp: 'M'
};

const faq = [
  {
    question: 'Does Browser AI Kit work in every browser?',
    answer:
      "No. It intentionally targets Chrome's built-in AI surfaces. Support also varies by Chrome version, platform, device, region, language, profile policy, and model state."
  },
  {
    question: 'Does it cost anything per request?',
    answer:
      "The kit has no request fee and uses no DeSource Labs inference service. Local inference still consumes the user's device resources, and your own hosting or optional cloud fallback may have costs."
  },
  {
    question: 'Will it work offline?',
    answer:
      'A ready local model can run without an inference network request, but Chrome may need network access to install or update the model or a language pack. Chrome can also remove resources under storage pressure.'
  },
  {
    question: 'Can I replace the provided interface?',
    answer:
      'Yes. Components are optional. Every capability has a Vue composable, React hook, Svelte controller, Angular signal controller or service method, and a framework-neutral core factory.'
  },
  {
    question: "Is it production-ready if Chrome's APIs are experimental?",
    answer:
      'The library handles production concerns and is tested against the documented and verified runtime surface. Your product must still feature-detect, present an unsupported state, and accept that browser behavior can evolve.'
  },
  {
    question: 'Is the native browser API a better choice?',
    answer:
      'For a small one-off call, it can be. The kit is valuable when download UX, streaming, long inputs, persisted context, cancellation, SSR, cleanup, or several APIs would otherwise be rebuilt in your application.'
  }
];
</script>

<style scoped>
.docs-page {
  min-height: 100svh;
}

.docs-hero,
.docs-layout {
  width: min(1180px, calc(100% - 2rem));
  margin-inline: auto;
}

.docs-hero {
  position: relative;
  padding: clamp(4.5rem, 8vw, 7rem) 0 clamp(3.25rem, 5vw, 4.75rem);
  text-align: center;
}

.docs-hero::before {
  position: absolute;
  inset: 1rem 4% 0;
  content: '';
  z-index: -1;
  pointer-events: none;
  opacity: 0.65;
  background: radial-gradient(circle, rgba(255, 255, 255, 0.16) 1px, transparent 1px);
  background-size: 30px 30px;
  mask-image: radial-gradient(ellipse at center, #000 0%, transparent 68%);
}

.docs-hero__orbit {
  position: absolute;
  inset: 0;
  z-index: -1;
  pointer-events: none;
  display: grid;
  place-items: center;
}

.docs-hero__orbit i {
  position: absolute;
  width: min(720px, 78vw);
  aspect-ratio: 2.6;
  border: 1px solid rgba(167, 139, 250, 0.11);
  border-radius: 50%;
  transform: rotate(-7deg);
  animation: docs-orbit 14s ease-in-out infinite alternate;
}

.docs-hero__orbit i:nth-child(2) {
  width: min(560px, 66vw);
  border-color: rgba(94, 234, 212, 0.09);
  animation-delay: -5s;
  animation-duration: 18s;
}

.docs-hero__orbit i:nth-child(3) {
  width: min(400px, 54vw);
  border-color: rgba(255, 255, 255, 0.07);
  animation-delay: -9s;
  animation-duration: 22s;
}

.docs-kicker {
  color: #a99cff;
  font-size: 0.72rem;
  font-weight: 800;
  letter-spacing: 0.12em;
  text-transform: uppercase;
}

.docs-hero .docs-kicker {
  width: fit-content;
  margin-inline: auto;
  padding: 0.45rem 0.65rem;
  border: 1px solid rgba(167, 139, 250, 0.18);
  border-radius: 999px;
  background: rgba(124, 92, 228, 0.07);
}

.docs-hero h1 {
  margin-top: 1rem;
  color: #fff;
  font-size: clamp(3rem, 7vw, 6rem);
  font-weight: 710;
  line-height: 1;
  letter-spacing: -0.06em;
}

.docs-hero > p:not(.docs-kicker) {
  max-width: 680px;
  margin: 1.5rem auto 0;
  color: rgba(234, 238, 250, 0.58);
  font-size: clamp(1rem, 2vw, 1.15rem);
  line-height: 1.7;
}

.docs-hero__actions {
  margin-top: 2rem;
  display: flex;
  justify-content: center;
  flex-wrap: wrap;
  gap: 0.75rem;
}

.docs-button {
  min-height: 3rem;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 0.68rem 1rem;
  color: rgba(255, 255, 255, 0.82);
  border: 1px solid rgba(255, 255, 255, 0.14);
  border-radius: 0.78rem;
  background: rgba(255, 255, 255, 0.045);
  font-size: 0.82rem;
  font-weight: 800;
}

.docs-button--primary {
  color: #fff;
  border-color: transparent;
  background: linear-gradient(135deg, #7659e6, #5275df);
  box-shadow: 0 14px 34px rgba(91, 91, 223, 0.22);
}

.docs-layout {
  display: grid;
  grid-template-columns: 220px minmax(0, 780px);
  justify-content: space-between;
  gap: clamp(3rem, 8vw, 8rem);
}

.docs-sidebar {
  position: sticky;
  top: 6.5rem;
  height: fit-content;
  padding: 1rem;
  color: rgba(255, 255, 255, 0.64);
  border: 1px solid rgba(255, 255, 255, 0.09);
  border-radius: 0.9rem;
  background: rgba(7, 10, 22, 0.58);
  font-size: 0.74rem;
}

.docs-sidebar > span {
  color: rgba(255, 255, 255, 0.62);
  font-size: 0.6rem;
  font-weight: 800;
  letter-spacing: 0.1em;
  text-transform: uppercase;
}

.docs-sidebar nav {
  margin-top: 0.75rem;
  display: flex;
  flex-direction: column;
}

.docs-sidebar nav a {
  padding: 0.48rem 0;
  transition: color 140ms ease;
}

.docs-sidebar nav a:hover,
.docs-sidebar nav a:focus-visible {
  color: #fff;
}

.docs-sidebar__github {
  margin-top: 0.9rem;
  padding-top: 0.9rem;
  display: block;
  color: #b8a9ff;
  border-top: 1px solid rgba(255, 255, 255, 0.08);
  font-weight: 700;
}

.docs-content {
  min-width: 0;
}

.doc-section {
  padding: 0 0 clamp(3.5rem, 6vw, 5rem);
  scroll-margin-top: 7rem;
  content-visibility: auto;
  contain-intrinsic-size: auto 1000px;
}

.doc-section + .doc-section {
  padding-top: clamp(3.5rem, 6vw, 5rem);
  border-top: 1px solid rgba(255, 255, 255, 0.08);
}

.doc-section h2,
.docs-next h2 {
  margin-top: 0.8rem;
  color: #fff;
  font-size: clamp(2.2rem, 5vw, 3.8rem);
  font-weight: 680;
  line-height: 1.08;
  letter-spacing: -0.05em;
}

.doc-section > p:not(.docs-kicker, .docs-caption),
.docs-next > p:not(.docs-kicker) {
  margin-top: 1.15rem;
  color: rgba(233, 237, 249, 0.57);
  font-size: 0.98rem;
  line-height: 1.78;
}

.doc-subheading {
  margin-top: 2.75rem;
  color: rgba(255, 255, 255, 0.9);
  font-size: 1.4rem;
  letter-spacing: -0.025em;
}

.doc-section :deep(.code-block) {
  margin-top: 1.5rem;
}

.callout {
  margin-top: 1.5rem;
  padding: 1rem;
  display: grid;
  grid-template-columns: auto 1fr;
  gap: 0.8rem;
  border: 1px solid rgba(126, 105, 228, 0.17);
  border-radius: 0.85rem;
  background: rgba(117, 88, 218, 0.07);
}

.callout > span {
  width: 1.5rem;
  height: 1.5rem;
  display: grid;
  place-items: center;
  color: #c4b5fd;
  border: 1px solid rgba(196, 181, 253, 0.18);
  border-radius: 50%;
  font-family: ui-monospace, monospace;
  font-size: 0.72rem;
  font-weight: 800;
}

.callout p {
  color: rgba(235, 238, 250, 0.62);
  font-size: 0.8rem;
  line-height: 1.65;
}

.callout code,
.option-table code {
  color: #c4b5fd;
  font-family: ui-monospace, monospace;
}

.callout--warning {
  border-color: rgba(251, 191, 36, 0.16);
  background: rgba(251, 191, 36, 0.045);
}

.callout--warning > span {
  color: #fde68a;
  border-color: rgba(251, 191, 36, 0.18);
}

.principle-grid {
  margin-top: 2rem;
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 0.8rem;
}

.principle-grid > div {
  min-height: 165px;
  padding: 1rem;
  display: flex;
  flex-direction: column;
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 0.8rem;
  background: rgba(255, 255, 255, 0.025);
  transition:
    transform 180ms ease,
    border-color 180ms ease,
    background-color 180ms ease;
}

.principle-grid > div:hover {
  transform: translateY(-2px);
  border-color: rgba(167, 139, 250, 0.2);
  background: rgba(255, 255, 255, 0.04);
}

.principle-grid > div > span {
  color: #a99cff;
  font-size: 1.2rem;
}

.principle-grid h3 {
  margin-top: auto;
  color: rgba(255, 255, 255, 0.85);
  font-size: 0.92rem;
}

.principle-grid p,
.install-card p,
.roadmap-note,
.docs-caption {
  color: rgba(255, 255, 255, 0.64);
  font-size: 0.75rem;
  line-height: 1.6;
}

.principle-grid p,
.install-card p {
  margin-top: 0.5rem;
}

.install-grid {
  margin-top: 2rem;
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 0.9rem;
}

.install-card {
  padding: 1.1rem;
  border: 1px solid rgba(255, 255, 255, 0.09);
  border-radius: 1rem;
  background: rgba(7, 10, 22, 0.6);
}

.install-card > div:first-child {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.install-card__mark {
  width: 2.5rem;
  height: 2.5rem;
  display: grid;
  place-items: center;
  color: #fff;
  border: 1px solid rgba(255, 255, 255, 0.12);
  border-radius: 0.72rem;
  background: linear-gradient(145deg, rgba(122, 92, 230, 0.4), rgba(67, 127, 206, 0.15));
  font-size: 0.8rem;
  font-weight: 850;
}

.status-chip {
  padding: 0.3rem 0.5rem;
  color: #86efac;
  border: 1px solid rgba(34, 197, 94, 0.14);
  border-radius: 999px;
  background: rgba(34, 197, 94, 0.06);
  font-size: 0.58rem;
  font-weight: 800;
  letter-spacing: 0.06em;
  text-transform: uppercase;
}

.install-card h3 {
  margin-top: 1.2rem;
  color: #fff;
  font-size: 1.15rem;
}

.install-card :deep(.code-block) {
  margin-top: 1rem;
}

.install-card :deep(pre) {
  padding: 0.8rem;
  font-size: 0.65rem;
}

.install-card > a,
.roadmap-note a,
.docs-caption a {
  margin-top: 1rem;
  display: inline-block;
  color: #b8a9ff;
  font-weight: 700;
}

.roadmap-note {
  margin-top: 0.9rem;
  padding: 1rem;
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 0.8rem;
  background: rgba(255, 255, 255, 0.02);
}

.roadmap-note strong {
  display: block;
  color: rgba(255, 255, 255, 0.76);
  font-size: 0.8rem;
}

.option-table {
  margin-top: 1.5rem;
  overflow: hidden;
  border: 1px solid rgba(255, 255, 255, 0.09);
  border-radius: 0.85rem;
  font-size: 0.74rem;
}

.option-table > div {
  min-height: 3.2rem;
  padding: 0.7rem 0.9rem;
  display: grid;
  grid-template-columns: 0.55fr 0.35fr 1.1fr;
  gap: 0.7rem;
  align-items: center;
  color: rgba(255, 255, 255, 0.52);
  border-bottom: 1px solid rgba(255, 255, 255, 0.07);
}

.option-table > div:last-child {
  border-bottom: 0;
}

.option-table__head {
  color: rgba(255, 255, 255, 0.64) !important;
  background: rgba(255, 255, 255, 0.025);
  font-size: 0.6rem;
  font-weight: 800;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.state-grid {
  margin-top: 2rem;
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 0.7rem;
}

.state-grid > div {
  min-height: 120px;
  padding: 1rem;
  display: grid;
  grid-template-columns: auto 1fr;
  align-content: start;
  gap: 0.65rem;
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 0.8rem;
  background: rgba(255, 255, 255, 0.02);
}

.state-grid code {
  color: rgba(255, 255, 255, 0.76);
  font-size: 0.76rem;
}

.state-grid p {
  grid-column: 2;
  color: rgba(255, 255, 255, 0.64);
  font-size: 0.72rem;
  line-height: 1.55;
}

.state-dot {
  width: 0.48rem;
  height: 0.48rem;
  margin-top: 0.22rem;
  border-radius: 50%;
  background: #94a3b8;
  box-shadow: 0 0 0 4px rgba(148, 163, 184, 0.08);
}

.state-dot--available {
  background: #4ade80;
}

.state-dot--downloadable {
  background: #60a5fa;
}

.state-dot--downloading {
  background: #fb923c;
}

.state-dot--unavailable {
  background: #f87171;
}

.api-doc-grid {
  margin-top: 2rem;
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 0.7rem;
}

.api-doc-grid > a {
  min-height: 145px;
  padding: 1rem;
  display: grid;
  grid-template-columns: auto 1fr auto;
  gap: 0.8rem;
  align-items: start;
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 0.8rem;
  background: rgba(255, 255, 255, 0.02);
  transition:
    transform 160ms ease,
    border-color 160ms ease,
    background-color 160ms ease;
}

.api-doc-grid > a:hover,
.api-doc-grid > a:focus-visible {
  transform: translateY(-2px);
  border-color: rgba(167, 139, 250, 0.22);
  background: rgba(255, 255, 255, 0.04);
}

.api-doc-grid > a > span {
  width: 2rem;
  height: 2rem;
  display: grid;
  place-items: center;
  color: #c4b5fd;
  border: 1px solid rgba(167, 139, 250, 0.16);
  border-radius: 0.55rem;
  background: rgba(124, 92, 228, 0.08);
  font-size: 0.68rem;
  font-weight: 800;
}

.api-doc-grid h3 {
  color: rgba(255, 255, 255, 0.84);
  font-size: 0.86rem;
}

.api-doc-grid p {
  margin-top: 0.4rem;
  color: rgba(255, 255, 255, 0.64);
  font-size: 0.7rem;
  line-height: 1.5;
}

.api-doc-grid b {
  color: rgba(255, 255, 255, 0.56);
  font-weight: 400;
}

.docs-caption {
  margin-top: 1rem;
}

.privacy-flow {
  margin-top: 1.7rem;
  padding: 1rem;
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.6rem;
  border: 1px solid rgba(94, 234, 212, 0.12);
  border-radius: 0.8rem;
  background: rgba(45, 212, 191, 0.035);
}

.privacy-flow span {
  padding: 0.45rem 0.6rem;
  color: rgba(255, 255, 255, 0.68);
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 0.5rem;
  background: rgba(255, 255, 255, 0.025);
  font-family: ui-monospace, monospace;
  font-size: 0.67rem;
}

.privacy-flow b {
  color: rgba(94, 234, 212, 0.45);
}

.faq-list {
  margin-top: 2rem;
}

.faq-list details {
  border-bottom: 1px solid rgba(255, 255, 255, 0.09);
}

.faq-list summary {
  min-height: 4.2rem;
  padding: 1rem 0;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  color: rgba(255, 255, 255, 0.8);
  cursor: pointer;
  font-size: 0.9rem;
  font-weight: 650;
  list-style: none;
}

.faq-list summary::-webkit-details-marker {
  display: none;
}

.faq-list summary span {
  color: rgba(255, 255, 255, 0.58);
  font-size: 1.2rem;
  transition: transform 160ms ease;
}

.faq-list details[open] summary span {
  transform: rotate(45deg);
}

.faq-list details p {
  max-width: 690px;
  padding: 0 2rem 1.2rem 0;
  color: rgba(255, 255, 255, 0.64);
  font-size: 0.8rem;
  line-height: 1.7;
}

.docs-next {
  position: relative;
  overflow: hidden;
  margin-bottom: clamp(4.5rem, 8vw, 7rem);
  padding: clamp(2rem, 5vw, 3.75rem);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 1.2rem;
  background: radial-gradient(circle at 100% 0, rgba(118, 89, 230, 0.16), transparent 45%), rgba(7, 10, 22, 0.7);
}

.docs-next::after {
  position: absolute;
  width: 260px;
  height: 260px;
  right: -100px;
  bottom: -150px;
  content: '';
  pointer-events: none;
  border: 1px solid rgba(167, 139, 250, 0.17);
  border-radius: 50%;
  box-shadow:
    0 0 0 42px rgba(167, 139, 250, 0.025),
    0 0 0 86px rgba(94, 234, 212, 0.018);
  animation: docs-orbit 12s ease-in-out infinite alternate-reverse;
}

@keyframes docs-orbit {
  from {
    transform: rotate(-7deg) scale(0.97);
    opacity: 0.48;
  }

  to {
    transform: rotate(7deg) scale(1.03);
    opacity: 1;
  }
}

@keyframes docs-reveal {
  from {
    translate: 0 22px;
  }

  to {
    translate: 0 0;
  }
}

@supports (animation-timeline: view()) {
  .principle-grid > div,
  .install-card,
  .state-grid > div,
  .api-doc-grid > a,
  .docs-next {
    animation: docs-reveal linear both;
    animation-timeline: view();
    animation-range: entry 5% cover 22%;
  }
}

.docs-next .docs-button {
  margin-top: 1.5rem;
}

@media (max-width: 880px) {
  .docs-layout {
    grid-template-columns: 1fr;
  }

  .docs-sidebar {
    display: none;
  }

  .docs-content {
    width: min(780px, 100%);
    margin-inline: auto;
  }
}

@media (max-width: 640px) {
  .docs-hero,
  .docs-layout {
    width: min(100% - 1.25rem, 1180px);
  }

  .docs-hero {
    padding-top: 5rem;
  }

  .docs-hero__actions,
  .docs-hero__actions .docs-button {
    width: 100%;
  }

  .principle-grid,
  .install-grid,
  .state-grid,
  .api-doc-grid {
    grid-template-columns: 1fr;
  }

  .principle-grid > div {
    min-height: 160px;
  }

  .option-table > div {
    grid-template-columns: 0.55fr 0.35fr 0.85fr;
    font-size: 0.65rem;
  }
}

@media (prefers-reduced-motion: reduce) {
  .docs-hero__orbit i,
  .docs-next::after,
  .principle-grid > div,
  .install-card,
  .state-grid > div,
  .api-doc-grid > a,
  .docs-next {
    animation: none;
  }
}
</style>
