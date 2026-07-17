import type { ApiGuide, Tool } from "../types";

const vueComponent = (
  name: string,
  body: string,
  props = "",
) => `<script setup lang="ts">
import { ref } from "vue";
import { ${name} } from "@desource/browser-ai-vue";
import "@desource/browser-ai-vue/assets/lib.css";

${body}
</script>

<template>
  <${name}${props} />
</template>`;

export const ApiGuides: Record<Tool, ApiGuide> = {
  "prompt-api": {
    title: "Prompt API",
    description:
      "Stream private chats, render Markdown, return schema-constrained JSON, and keep long sessions useful.",
    eyebrow: "Private chat · streaming · long context",
    workspace: "chat",
    examples: [
      {
        label: "Vue component",
        title: "Ship the complete chat experience",
        description:
          "Persistence, streaming, session restoration, Markdown and context compaction are already wired together.",
        code: vueComponent(
          "PromptApi",
          `const starterMessages = [{
  id: "welcome",
  role: "assistant" as const,
  content: "## Ready\nAsk me anything about this page."
}];`,
          `
    :initial-messages="starterMessages"
    system-prompt="Answer clearly and use Markdown."
    @prompt-complete="({ response }) => console.log(response)"`,
        ),
      },
      {
        label: "Vue composable",
        title: "Build a completely custom interface",
        description:
          "Use the browser lifecycle directly while keeping availability, cancellation and session cleanup reactive.",
        code: `<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from "vue";
import { usePromptApi } from "@desource/browser-ai-vue";

const input = ref("");
const output = ref("");
const { create, promptStreaming, interrupt, dispose, isReady } = usePromptApi();

onMounted(() => create());
onBeforeUnmount(dispose);

async function send() {
  output.value = "";
  const reader = promptStreaming(input.value).getReader();
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    output.value += value;
  }
}
</script>`,
      },
    ],
  },
  summarizer: {
    title: "Summarizer API",
    description:
      "Turn long content into useful summaries with quota-aware chunking, streamed progress, and Markdown output.",
    eyebrow: "Long input · chunking · structured formats",
    workspace: "tool",
    mobileWorkspaceHeight: 740,
    examples: [
      {
        label: "Vue component",
        title: "Add a production summary workspace",
        description:
          "Users can choose type, length, format and context without extra settings UI.",
        code: vueComponent(
          "Summarizer",
          'const article = ref("Paste the article here...");',
          ` v-model="article" type="key-points" format="markdown"`,
        ),
      },
      {
        label: "Vue composable",
        title: "Summarize inside your own workflow",
        description:
          "The detailed result records token use, chunking and the final roll-up.",
        code: `<script setup lang="ts">
import { useSummarizer } from "@desource/browser-ai-vue";

const { summarizeWithDetails, progressState } = useSummarizer();

const result = await summarizeWithDetails(longArticle, {
  createOptions: { type: "key-points", format: "markdown", length: "medium" },
  onProgress: state => console.log(state.phase)
});

console.log(result.summary, result.chunked);
</script>`,
      },
    ],
  },
  writer: {
    title: "Writer API",
    description:
      "Draft useful copy in the requested tone, format, and length while keeping source context on-device.",
    eyebrow: "Streaming drafts · tone · context fitting",
    workspace: "tool",
    mobileWorkspaceHeight: 740,
    examples: [
      {
        label: "Vue component",
        title: "Give users a focused writing studio",
        description:
          "The ready-made editor covers streaming, context limits, settings and Markdown preview.",
        code: vueComponent(
          "Writer",
          'const task = ref("Write a concise release announcement.");',
          ` v-model="task" tone="neutral" format="markdown"`,
        ),
      },
      {
        label: "Vue composable",
        title: "Generate text from any product surface",
        description:
          "Use detailed results when analytics or fitted-context metadata matters.",
        code: `<script setup lang="ts">
import { useWriter } from "@desource/browser-ai-vue";

const { writeWithDetails, isProcessing } = useWriter();

const result = await writeWithDetails("Draft a launch email", {
  createOptions: { tone: "neutral", format: "markdown", length: "medium" },
  context: "Audience: Vue developers",
  fitStrategy: "truncate-context"
});
</script>`,
      },
    ],
  },
  rewriter: {
    title: "Rewriter API",
    description:
      "Transform existing text while preserving intent, formatting and local-only processing.",
    eyebrow: "Tone shifts · length control · streaming",
    workspace: "tool",
    mobileWorkspaceHeight: 740,
    examples: [
      {
        label: "Vue component",
        title: "Add a side-by-side rewrite experience",
        description:
          "Input controls, live progress, copy actions and rendered Markdown are included.",
        code: vueComponent(
          "Rewriter",
          'const source = ref("This paragraph needs to be clearer.");',
          ` v-model="source" tone="more-formal" length="shorter"`,
        ),
      },
      {
        label: "Vue composable",
        title: "Rewrite from your own editor",
        description:
          "Keep native options familiar while adding cancellation and quota-aware context fitting.",
        code: `<script setup lang="ts">
import { useRewriter } from "@desource/browser-ai-vue";

const { rewriteWithDetails, interrupt } = useRewriter();

const result = await rewriteWithDetails(sourceText, {
  createOptions: { tone: "more-formal", length: "shorter", format: "markdown" },
  context: "Keep product names unchanged."
});
</script>`,
      },
    ],
  },
  translator: {
    title: "Translator API",
    description:
      "Translate supported language pairs with downloadable local packs, long-input handling, and Markdown preservation.",
    eyebrow: "Local language packs · auto translate · chunking",
    workspace: "tool",
    mobileWorkspaceHeight: 885,
    examples: [
      {
        label: "Vue component",
        title: "Add a complete translation workspace",
        description:
          "Language-pair setup, downloads, swapping, debouncing and copy actions are included.",
        code: vueComponent(
          "Translator",
          'const source = ref("Private AI, directly in your browser.");',
          `
    v-model="source"
    source-language="en"
    target-language="fr"`,
        ),
      },
      {
        label: "Vue composable",
        title: "Translate inside any custom UI",
        description:
          "Prepare a pair once, stream the result and expose download progress to your own interface.",
        code: `<script setup lang="ts">
import { useTranslator } from "@desource/browser-ai-vue";

const { create, translateWithDetails, downloadProgress } = useTranslator({
  sourceLanguage: "en",
  targetLanguage: "fr"
});

await create();
const result = await translateWithDetails(sourceText, { chunking: "auto" });
</script>`,
      },
    ],
  },
  "language-detector": {
    title: "Language Detector API",
    description:
      "Rank likely languages with confidence scores and merge results across text larger than one model window.",
    eyebrow: "Confidence ranking · long input · local detection",
    workspace: "tool",
    mobileWorkspaceHeight: 780,
    examples: [
      {
        label: "Vue component",
        title: "Add an inspectable detection workspace",
        description:
          "Expected-language hints, minimum confidence and long-input strategies are user-configurable.",
        code: vueComponent(
          "LanguageDetector",
          'const text = ref("Bonjour tout le monde");',
          ` v-model="text" :max-results="3" :min-confidence="0.1"`,
        ),
      },
      {
        label: "Vue composable",
        title: "Route content by detected language",
        description:
          "Receive normalized, ranked results even when the input needs multiple local passes.",
        code: `<script setup lang="ts">
import { useLanguageDetector } from "@desource/browser-ai-vue";

const { detectWithDetails } = useLanguageDetector();

const result = await detectWithDetails(documentText, {
  largeInputStrategy: "chunk",
  maxResults: 3,
  minConfidence: 0.1
});
</script>`,
      },
    ],
  },
  proofreader: {
    title: "Proofreader API",
    description:
      "Correct grammar, spelling, and punctuation with inspectable ranges, optional explanations, and Markdown preview.",
    eyebrow: "Edit ranges · explanations · long documents",
    workspace: "tool",
    mobileWorkspaceHeight: 820,
    examples: [
      {
        label: "Vue component",
        title: "Add an explainable proofreading workspace",
        description:
          "Show corrected text alongside every native correction range and explanation.",
        code: vueComponent(
          "Proofreader",
          'const text = ref("This sentence have a mistake.");',
          `
    v-model="text"
    :include-correction-types="true"
    :include-correction-explanations="true"`,
        ),
      },
      {
        label: "Vue composable",
        title: "Apply corrections in your own editor",
        description:
          "Normalized ranges make highlighting and selective acceptance straightforward.",
        code: `<script setup lang="ts">
import { useProofreader } from "@desource/browser-ai-vue";

const { proofreadWithDetails } = useProofreader();

const result = await proofreadWithDetails(sourceText, {
  createOptions: { expectedInputLanguages: ["en"] },
  largeInputStrategy: "auto"
});

console.log(result.correctedInput, result.corrections);
</script>`,
      },
    ],
  },
  webmcp: {
    title: "WebMCP",
    description:
      "Publish app capabilities that compatible browser agents can discover and call through visible, user-controlled UI.",
    eyebrow: "Imperative tools · declarative forms · lifecycle safe",
    workspace: "webmcp",
    mobileWorkspaceHeight: 870,
    examples: [
      {
        label: "Imperative tools",
        title: "Register typed tools with Vue lifecycle cleanup",
        description:
          "Registration, execution state, discovery and unregistration stay reactive.",
        code: `<script setup lang="ts">
import { onBeforeUnmount, onMounted } from "vue";
import { useWebMcp } from "@desource/browser-ai-vue";

const { registerTool, unregisterAll } = useWebMcp();

onMounted(() => registerTool({
  name: "get_cart_total",
  description: "Return the current visible cart total.",
  inputSchema: { type: "object", properties: {} },
  annotations: { readOnlyHint: true },
  execute: () => ({ total: 42, currency: "USD" })
}));

onBeforeUnmount(unregisterAll);
</script>`,
      },
      {
        label: "Declarative tools",
        title: "Make an existing form agent-accessible",
        description:
          "The same semantic form remains operable by people while becoming discoverable to agents.",
        code: `<script setup lang="ts">
import {
  createWebMcpFieldAttributes,
  createWebMcpFormAttributes
} from "@desource/browser-ai-vue";

const tool = createWebMcpFormAttributes({
  name: "create_support_ticket",
  description: "Create a support ticket from the visible form.",
  autoSubmit: true
});

const subject = createWebMcpFieldAttributes("Short ticket subject");
</script>

<template>
  <form v-bind="tool">
    <input name="subject" v-bind="subject" required />
    <button>Create ticket</button>
  </form>
</template>`,
      },
    ],
  },
};
