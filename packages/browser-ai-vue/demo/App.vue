<template>
  <main class="demo-shell">
    <header class="demo-hero">
      <p class="demo-kicker" data-testid="framework">Vue</p>
      <h1>Chrome AI, without the framework glue.</h1>
      <p>
        The complete Vue component and composable surface: private Prompt API chat, six writing tools, multimodal
        attachments, and WebMCP tools that change visible page state.
      </p>
    </header>

    <section class="demo-capabilities" data-testid="api-capabilities" aria-label="Browser capabilities">
      <div v-for="capability in capabilities" :key="capability.name" class="demo-capability">
        <span>{{ capability.name }}</span
        ><strong>{{ capability.availability }}</strong>
      </div>
    </section>

    <div class="demo-grid">
      <section class="demo-card demo-card--prompt" data-component="PromptApi">
        <header>
          <h2>PromptApi</h2>
          <code>&lt;PromptApi /&gt;</code>
        </header>
        <PromptApi chat-key="vue-demo" />
      </section>

      <section class="demo-card demo-card--tool" data-component="Summarizer">
        <header>
          <h2>Summarizer</h2>
          <code>&lt;Summarizer v-model /&gt;</code>
        </header>
        <Summarizer v-model="texts.summarizer" />
      </section>
      <section class="demo-card demo-card--tool" data-component="Writer">
        <header>
          <h2>Writer</h2>
          <code>&lt;Writer v-model /&gt;</code>
        </header>
        <Writer v-model="texts.writer" />
      </section>
      <section class="demo-card demo-card--tool" data-component="Rewriter">
        <header>
          <h2>Rewriter</h2>
          <code>&lt;Rewriter v-model /&gt;</code>
        </header>
        <Rewriter v-model="texts.rewriter" />
      </section>
      <section class="demo-card demo-card--tool" data-component="Translator">
        <header>
          <h2>Translator</h2>
          <code>&lt;Translator source-language target-language /&gt;</code>
        </header>
        <Translator v-model="texts.translator" source-language="en" target-language="fr" />
      </section>
      <section class="demo-card demo-card--tool" data-component="LanguageDetector">
        <header>
          <h2>LanguageDetector</h2>
          <code>&lt;LanguageDetector v-model /&gt;</code>
        </header>
        <LanguageDetector v-model="texts.detector" />
      </section>
      <section class="demo-card demo-card--tool" data-component="Proofreader">
        <header>
          <h2>Proofreader</h2>
          <code>&lt;Proofreader v-model /&gt;</code>
        </header>
        <Proofreader v-model="texts.proofreader" />
      </section>

      <div class="demo-primitives">
        <section class="demo-card" data-component="ChatHistory">
          <header>
            <h2>ChatHistory</h2>
            <code>&lt;ChatHistory /&gt;</code>
          </header>
          <ChatHistory :messages="sampleMessages" />
        </section>
        <section class="demo-card" data-component="ChatSidebar">
          <header>
            <h2>ChatSidebar</h2>
            <code>&lt;ChatSidebar /&gt;</code>
          </header>
          <ChatSidebar :chats="sampleChats" active-chat-id="demo-chat" />
        </section>
        <section class="demo-card" data-component="PromptInput">
          <header>
            <h2>PromptInput</h2>
            <code>&lt;PromptInput v-model /&gt;</code>
          </header>
          <PromptInput
            v-model="primitiveDraft"
            v-model:attachments="primitiveAttachments"
            allow-attachments
            allow-voice
            @send="primitiveDraft = ''"
          />
        </section>
        <section class="demo-card" data-component="MarkdownRenderer">
          <header>
            <h2>MarkdownRenderer</h2>
            <code>&lt;MarkdownRenderer /&gt;</code>
          </header>
          <MarkdownRenderer content="### Safe Markdown\n\nRendered locally with **HTML disabled**." />
        </section>
      </div>

      <section class="demo-webmcp" data-testid="webmcp-demo">
        <div>
          <p class="demo-kicker">WebMCP in a real interface</p>
          <h2>Let an agent create a visible task—with validation and user-controlled registration.</h2>
          <p>
            The imperative tool mutates this list. The declarative form exposes the same action to a supporting agent.
          </p>
        </div>
        <p class="demo-webmcp__status" data-testid="webmcp-support">{{ support.reason }}</p>
        <div class="demo-webmcp__actions">
          <button type="button" :disabled="!support.supported" data-testid="register-webmcp" @click="registerTaskTool">
            {{ taskToolRegistered ? 'Tool registered' : 'Register task tool' }}
          </button>
          <button type="button" :disabled="!taskToolRegistered" data-testid="execute-webmcp" @click="executeTaskTool">
            Run task tool
          </button>
          <button type="button" :disabled="!taskToolRegistered" @click="unregisterTaskTool">Unregister</button>
        </div>
        <form class="demo-task-form" v-bind="formAttributes" data-testid="webmcp-form" @submit.prevent="addPersonTask">
          <input
            v-model="newTaskTitle"
            name="title"
            required
            maxlength="120"
            placeholder="Ship the framework adapters"
            v-bind="titleAttributes"
          />
          <select v-model="newTaskPriority" name="priority" v-bind="priorityAttributes">
            <option value="low">Low</option>
            <option value="medium">Medium</option>
            <option value="high">High</option>
          </select>
          <button type="submit">Add task</button>
        </form>
        <ul class="demo-task-list" data-testid="task-list">
          <li v-for="task in tasks" :key="task.id">
            <span>{{ task.title }}</span
            ><span>{{ task.priority }} · {{ task.createdBy }}</span>
          </li>
        </ul>
        <p v-if="webMcpError" class="demo-error" role="alert">{{ webMcpError }}</p>
      </section>
    </div>
  </main>
</template>

<script setup lang="ts">
import { onMounted, ref } from 'vue';
import {
  ChatHistory,
  ChatSidebar,
  LanguageDetector,
  MarkdownRenderer,
  PromptApi,
  PromptInput,
  Proofreader,
  Rewriter,
  Summarizer,
  Translator,
  Writer,
  createWebMcpFieldAttributes,
  createWebMcpFormAttributes,
  useWebMcp,
  type ChatMessage,
  type PromptAttachment,
  type ChatSidebarItem
} from '../src';
import {
  createDemoTaskTool,
  executeDemoTaskTool,
  createPersonTask,
  inspectDemoCapabilities,
  type DemoCapability,
  type DemoTask
} from '../../../common/demo/capabilities';

const capabilities = ref<DemoCapability[]>([]);
const texts = ref({
  summarizer: 'Chrome can run compact language models directly in the browser. Data stays on the device.',
  writer: 'Write a two-sentence launch note for a private, on-device writing assistant.',
  rewriter: 'This browser AI library is very easy and useful for developers.',
  translator: 'Private AI can run directly in your browser.',
  detector: 'Bonjour, comment allez-vous aujourd’hui?',
  proofreader: 'This sentence have two mistake.'
});
const primitiveDraft = ref('');
const primitiveAttachments = ref<PromptAttachment[]>([]);
const sampleMessages: ChatMessage[] = [
  { id: 'message-1', role: 'assistant', content: 'Everything here renders **locally**.', timestamp: Date.now() }
];
const sampleChats: ChatSidebarItem[] = [
  { id: 'demo-chat', title: 'Launch plan', preview: 'Private browser AI', updatedAt: Date.now() }
];

const webMcp = useWebMcp();
const support = webMcp.support;
const tasks = ref<DemoTask[]>([
  { id: 'seed-task', title: 'Review the multimodal Prompt API demo', priority: 'high', createdBy: 'person' }
]);
const newTaskTitle = ref('');
const newTaskPriority = ref<DemoTask['priority']>('medium');
const taskToolRegistered = ref(false);
const webMcpError = ref('');
const formAttributes = createWebMcpFormAttributes({
  name: 'create_vue_demo_task_form',
  description: 'Create a task in the visible Vue Browser AI demo task list.'
});
const titleAttributes = createWebMcpFieldAttributes('Short title for the task to create.');
const priorityAttributes = createWebMcpFieldAttributes('Priority for the new task.');

const registerTaskTool = async () => {
  if (!support.value.supported || taskToolRegistered.value) return;
  webMcpError.value = '';
  try {
    await webMcp.registerTool(createDemoTaskTool('Vue', (task) => tasks.value.push(task)));
    taskToolRegistered.value = true;
  } catch (error) {
    webMcpError.value = error instanceof Error ? error.message : 'WebMCP registration failed.';
  }
};
const executeTaskTool = () =>
  executeDemoTaskTool('Vue', webMcp).catch((error) => {
    webMcpError.value = error instanceof Error ? error.message : 'Tool execution failed.';
  });
const unregisterTaskTool = () => {
  webMcp.unregisterTool('create_vue_demo_task');
  taskToolRegistered.value = false;
};
const addPersonTask = () => {
  if (!newTaskTitle.value.trim()) return;
  tasks.value.push(createPersonTask(newTaskTitle.value, newTaskPriority.value));
  newTaskTitle.value = '';
};

onMounted(async () => {
  capabilities.value = await inspectDemoCapabilities();
  webMcp.refreshSupport();
  await registerTaskTool();
});
</script>
