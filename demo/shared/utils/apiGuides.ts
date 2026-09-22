import type { ApiGuide, Tool } from '../types';

const vueComponent = (name: string, body: string, props = '') => `<script setup lang="ts">
import { ref } from "vue";
import { ${name} } from "@desource/browser-ai-vue";
import "@desource/browser-ai-vue/assets/lib.css";

${body}
</script>

<template>
  <${name}${props} />
</template>`;

const vueWorkflow = (
  composable: string,
  input: string,
  action: string,
  run: string,
  options = ''
) => `<script setup lang="ts">
import { ref } from "vue";
import { ${composable} } from "@desource/browser-ai-vue";

const input = ref(${JSON.stringify(input)});
const output = ref("");
const error = ref("");
// Creating the composable in setup also registers session cleanup.
const ai = ${composable}(${options});
const { isProcessing, interrupt } = ai;

async function run() {
  if (isProcessing.value) return;
  output.value = "";
  error.value = "";
  try {
${run
  .split('\n')
  .map((line) => `    ${line}`)
  .join('\n')}
  } catch (cause) {
    if (cause instanceof DOMException && cause.name === "AbortError") return;
    error.value = cause instanceof Error ? cause.message : String(cause);
  }
}
</script>

<template>
  <textarea v-model="input" aria-label="Source text" />
  <button :disabled="isProcessing || !input.trim()" @click="run">${action}</button>
  <button :disabled="!isProcessing" @click="interrupt">Stop</button>
  <p v-if="error" role="alert">{{ error }}</p>
  <pre>{{ output }}</pre>
</template>`;

export const ApiGuides: Record<Tool, ApiGuide> = {
  'prompt-api': {
    id: 'prompt-api',
    title: 'Prompt API',
    description:
      'Stream private chats, render Markdown, return schema-constrained JSON, and keep long sessions useful.',
    eyebrow: 'Private chat · streaming · long context',
    workspace: 'chat',
    examples: [
      {
        label: 'Vue component',
        title: 'Ship the complete chat experience',
        description:
          'Persistence, streaming, session restoration, Markdown and context compaction are already wired together.',
        code: vueComponent(
          'PromptApi',
          `const starterMessages = [{
  id: "welcome",
  role: "assistant" as const,
  content: "## Ready\\nAsk me anything about this page."
}];`,
          `
    :initial-messages="starterMessages"
    system-prompt="Answer clearly and use Markdown."
    @prompt-complete="({ response }) => console.log(response)"`
        )
      },
      {
        label: 'Vue composable',
        title: 'Build a completely custom interface',
        description:
          'Use the browser lifecycle directly while keeping availability, cancellation and session cleanup reactive.',
        code: vueWorkflow(
          'usePromptApi',
          'Explain local AI in one sentence.',
          'Send',
          `if (!ai.isReady.value) await ai.create();
const reader = ai.promptStreaming(input.value).getReader();
try {
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    output.value += value;
  }
} finally {
  await reader.cancel().catch(() => undefined);
  reader.releaseLock();
}
`
        )
      }
    ]
  },
  summarizer: {
    id: 'summarizer',
    title: 'Summarizer API',
    description:
      'Turn long content into useful summaries with quota-aware chunking, streamed progress, and Markdown output.',
    eyebrow: 'Long input · chunking · structured formats',
    workspace: 'tool',
    mobileWorkspaceHeight: 740,
    examples: [
      {
        label: 'Vue component',
        title: 'Add a production summary workspace',
        description: 'Users can choose type, length, format and context without extra settings UI.',
        code: vueComponent(
          'Summarizer',
          'const article = ref("Paste the article here...");',
          ` v-model="article" type="key-points" format="markdown"`
        )
      },
      {
        label: 'Vue composable',
        title: 'Summarize inside your own workflow',
        description: 'The detailed result records token use, chunking and the final roll-up.',
        code: vueWorkflow(
          'useSummarizer',
          'The team shipped offline search. Next week, we will improve keyboard navigation.',
          'Summarize',
          `if (!ai.isReady.value) {
  await ai.create({ type: "key-points", format: "markdown", length: "medium" });
}
const result = await ai.summarizeWithDetails(input.value, {
  autoCreate: false,
  onProgress: state => console.log(state.phase)
});
output.value = result.summary;`
        )
      }
    ]
  },
  writer: {
    id: 'writer',
    title: 'Writer API',
    description: 'Draft useful copy in the requested tone, format, and length while keeping source context on-device.',
    eyebrow: 'Streaming drafts · tone · context fitting',
    workspace: 'tool',
    mobileWorkspaceHeight: 740,
    examples: [
      {
        label: 'Vue component',
        title: 'Give users a focused writing studio',
        description: 'The ready-made editor covers streaming, context limits, settings and Markdown preview.',
        code: vueComponent(
          'Writer',
          'const task = ref("Write a concise release announcement.");',
          ` v-model="task" tone="neutral" format="markdown"`
        )
      },
      {
        label: 'Vue composable',
        title: 'Generate text from any product surface',
        description: 'Use detailed results when analytics or fitted-context metadata matters.',
        code: vueWorkflow(
          'useWriter',
          'Draft a launch email for our offline search feature.',
          'Write',
          `if (!ai.isReady.value) {
  await ai.create({ tone: "neutral", format: "markdown", length: "medium" });
}
const result = await ai.writeWithDetails(input.value, {
  autoCreate: false,
  context: "Audience: Vue developers",
  fitStrategy: "truncate-context"
});
output.value = result.text;`
        )
      }
    ]
  },
  rewriter: {
    id: 'rewriter',
    title: 'Rewriter API',
    description: 'Transform existing text while preserving intent, formatting and local-only processing.',
    eyebrow: 'Tone shifts · length control · streaming',
    workspace: 'tool',
    mobileWorkspaceHeight: 740,
    examples: [
      {
        label: 'Vue component',
        title: 'Add a side-by-side rewrite experience',
        description: 'Input controls, live progress, copy actions and rendered Markdown are included.',
        code: vueComponent(
          'Rewriter',
          'const source = ref("This paragraph needs to be clearer.");',
          ` v-model="source" tone="more-formal" length="shorter"`
        )
      },
      {
        label: 'Vue composable',
        title: 'Rewrite from your own editor',
        description: 'Keep native options familiar while adding cancellation and quota-aware context fitting.',
        code: vueWorkflow(
          'useRewriter',
          'Our new search feature works without a network connection.',
          'Rewrite',
          `if (!ai.isReady.value) {
  await ai.create({ tone: "more-formal", length: "shorter", format: "markdown" });
}
const result = await ai.rewriteWithDetails(input.value, {
  autoCreate: false,
  context: "Keep product names unchanged."
});
output.value = result.text;`
        )
      }
    ]
  },
  translator: {
    id: 'translator',
    title: 'Translator API',
    description:
      'Translate supported language pairs with downloadable local packs, long-input handling, and Markdown preservation.',
    eyebrow: 'Local language packs · auto translate · chunking',
    workspace: 'tool',
    mobileWorkspaceHeight: 885,
    examples: [
      {
        label: 'Vue component',
        title: 'Add a complete translation workspace',
        description: 'Language-pair setup, downloads, swapping, debouncing and copy actions are included.',
        code: vueComponent(
          'Translator',
          'const source = ref("Private AI, directly in your browser.");',
          `
    v-model="source"
    source-language="en"
    target-language="fr"`
        )
      },
      {
        label: 'Vue composable',
        title: 'Translate inside any custom UI',
        description: 'Create a language pair from a user action, reuse it, and translate long text in ordered chunks.',
        code: vueWorkflow(
          'useTranslator',
          'Your changes are saved on this device.',
          'Translate',
          `if (!ai.isReady.value) await ai.create();
const result = await ai.translateWithDetails(input.value, { autoCreate: false, chunking: "auto" });
output.value = result.translation;`,
          '{ sourceLanguage: "en", targetLanguage: "fr" }'
        )
      }
    ]
  },
  'language-detector': {
    id: 'language-detector',
    title: 'Language Detector API',
    description:
      'Rank likely languages with confidence scores and merge results across text larger than one model window.',
    eyebrow: 'Confidence ranking · long input · local detection',
    workspace: 'tool',
    mobileWorkspaceHeight: 780,
    examples: [
      {
        label: 'Vue component',
        title: 'Add an inspectable detection workspace',
        description: 'Expected-language hints, minimum confidence and long-input strategies are user-configurable.',
        code: vueComponent(
          'LanguageDetector',
          'const text = ref("Bonjour tout le monde");',
          ` v-model="text" :max-results="3" :min-confidence="0.1"`
        )
      },
      {
        label: 'Vue composable',
        title: 'Route content by detected language',
        description: 'Receive normalized, ranked results even when the input needs multiple local passes.',
        code: vueWorkflow(
          'useLanguageDetector',
          'Bonjour tout le monde',
          'Detect language',
          `if (!ai.isReady.value) await ai.create();
const result = await ai.detectWithDetails(input.value, {
  autoCreate: false,
  largeInputStrategy: "chunk",
  maxResults: 3,
  minConfidence: 0.1
});
output.value = JSON.stringify(result.results, null, 2);`
        )
      }
    ]
  },
  proofreader: {
    id: 'proofreader',
    title: 'Proofreader API',
    description:
      'Correct grammar, spelling, and punctuation with inspectable ranges, optional explanations, and Markdown preview.',
    eyebrow: 'Edit ranges · explanations · long documents',
    workspace: 'tool',
    mobileWorkspaceHeight: 820,
    examples: [
      {
        label: 'Vue component',
        title: 'Add an explainable proofreading workspace',
        description: 'Show corrected text alongside every native correction range and explanation.',
        code: vueComponent(
          'Proofreader',
          'const text = ref("This sentence have a mistake.");',
          `
    v-model="text"
    :include-correction-types="true"
    :include-correction-explanations="true"`
        )
      },
      {
        label: 'Vue composable',
        title: 'Apply corrections in your own editor',
        description: 'Normalized ranges make highlighting and selective acceptance straightforward.',
        code: vueWorkflow(
          'useProofreader',
          'This sentence have a mistake.',
          'Proofread',
          `if (!ai.isReady.value) await ai.create({ expectedInputLanguages: ["en"] });
const result = await ai.proofreadWithDetails(input.value, {
  autoCreate: false,
  largeInputStrategy: "auto"
});
output.value = result.correctedInput;
console.log(result.corrections);`
        )
      }
    ]
  },
  webmcp: {
    id: 'webmcp',
    title: 'WebMCP',
    description:
      'Publish app capabilities that compatible browser agents can discover and call through visible, user-controlled UI.',
    eyebrow: 'Imperative tools · declarative forms · lifecycle safe',
    workspace: 'webmcp',
    mobileWorkspaceHeight: 870,
    examples: [
      {
        label: 'Imperative tools',
        title: 'Register typed tools with Vue lifecycle cleanup',
        description: 'Registration, execution state, discovery and unregistration stay reactive.',
        code: `<script setup lang="ts">
import { onMounted, ref } from "vue";
import { useWebMcp } from "@desource/browser-ai-vue";

const props = defineProps<{ total: number; currency: string }>();
const error = ref("");
// Tools are removed automatically when this component unmounts.
const { registerTool, registeredTools } = useWebMcp();

onMounted(() => {
  void registerTool({
    name: "get_cart_total",
    description: "Return the current visible cart total.",
    inputSchema: { type: "object", properties: {} },
    annotations: { readOnlyHint: true },
    execute: () => ({ total: props.total, currency: props.currency })
  }).catch(cause => {
    error.value = cause instanceof Error ? cause.message : String(cause);
  });
});
</script>

<template>
  <p v-if="error" role="alert">{{ error }}</p>
  <p v-else>{{ registeredTools.length }} cart tool registered</p>
</template>`
      },
      {
        label: 'Declarative tools',
        title: 'Make an existing form agent-accessible',
        description: 'Pass your authenticated ticket action. People and agents submit through the same form handler.',
        code: `<script setup lang="ts">
import { ref } from "vue";
import {
  createWebMcpFieldAttributes,
  createWebMcpFormAttributes
} from "@desource/browser-ai-vue";

const props = defineProps<{
  createTicket: (subject: string) => Promise<{ id: string }>;
}>();
const status = ref("");
const tool = createWebMcpFormAttributes({
  name: "create_support_ticket",
  description: "Create a support ticket from the visible form.",
  autoSubmit: true
});

const subject = createWebMcpFieldAttributes("Short ticket subject");

function submit(rawEvent: Event) {
  const event = rawEvent as SubmitEvent & {
    agentInvoked?: boolean;
    respondWith?: (response: Promise<unknown>) => void;
  };
  event.preventDefault();
  const form = event.currentTarget as HTMLFormElement;
  const value = String(new FormData(form).get("subject") ?? "").trim();
  const response = Promise.resolve().then(() => {
    if (!value) throw new Error("Enter a ticket subject.");
    return props.createTicket(value);
  });
  if (event.agentInvoked) event.respondWith?.(response);
  void response.then(
    ticket => { status.value = "Created ticket " + ticket.id; },
    error => { status.value = error instanceof Error ? error.message : String(error); }
  );
}
</script>

<template>
  <form v-bind="tool" @submit="submit">
    <input name="subject" v-bind="subject" required />
    <button type="submit">Create ticket</button>
  </form>
  <p role="status">{{ status }}</p>
</template>`
      }
    ]
  }
};
