<template>
  <div class="webmcp-demo">
    <div class="webmcp-demo__content">
      <header class="webmcp-demo__header">
        <div>
          <p class="webmcp-demo__eyebrow">Chrome 149+ origin trial / local flag</p>
          <h2>Agent-ready tools, visible in the page</h2>
        </div>
        <span
          ref="statusElement"
          class="webmcp-demo__status"
          :class="browserSupported ? 'webmcp-demo__status--ready' : ''"
        >
          {{ supportLabel }}
        </span>
      </header>

      <p class="webmcp-demo__intro">
        This page registers two imperative tools and one declarative form. Tool calls update the same UI the user sees.
      </p>

      <div v-if="hasMounted && !isSupported" class="webmcp-demo__notice" role="status">
        Enable <code>#enable-webmcp-testing</code>, use a secure origin, and allow the <code>tools</code> permissions
        policy.
      </div>
      <div v-if="demoError" class="webmcp-demo__notice" role="alert">
        {{ demoError }}
      </div>

      <div class="webmcp-demo__grid">
        <section class="webmcp-demo__panel">
          <div class="webmcp-demo__panel-heading">
            <div>
              <span>Imperative API</span>
              <strong>{{ visibleRegisteredTools.length }} registered</strong>
            </div>
            <button type="button" :disabled="!browserSupported || isProcessing" @click="toggleTools">
              {{ visibleRegisteredTools.length ? 'Unregister' : 'Register' }}
            </button>
          </div>

          <label for="webmcp-message">Shared demo state</label>
          <input id="webmcp-message" v-model="message" type="text" />
          <p class="webmcp-demo__result">{{ lastAction }}</p>

          <ul>
            <li v-for="tool in visibleRegisteredTools" :key="tool.name">
              <code>{{ tool.name }}</code>
              <span>{{ tool.description }}</span>
            </li>
          </ul>
        </section>

        <section class="webmcp-demo__panel">
          <div class="webmcp-demo__panel-heading">
            <div>
              <span>Declarative API</span>
              <strong>Annotated HTML form</strong>
            </div>
          </div>

          <form v-bind="formAttributes" @submit="handleFormSubmit">
            <label for="webmcp-note">Note for the page</label>
            <input id="webmcp-note" v-model="formMessage" v-bind="fieldAttributes" name="note" required type="text" />
            <button type="submit">Apply note</button>
          </form>
          <p class="webmcp-demo__result">{{ agentEvent }}</p>
        </section>
      </div>

      <footer class="webmcp-demo__footer">
        <span>Discoverable tools: {{ discoveredTools.length }}</span>
        <button type="button" :disabled="!browserSupported || isProcessing" @click="refreshDemoTools">
          Refresh discovery
        </button>
      </footer>
    </div>
  </div>
</template>

<script setup lang="ts">
import {
  createWebMcpFieldAttributes,
  createWebMcpFormAttributes,
  useWebMcp,
  type WebMcpTool,
  type WebMcpToolInput
} from '@desource/browser-ai-vue';

type AgentSubmitEvent = SubmitEvent & {
  agentInvoked?: boolean;
  respondWith?: (response: Promise<unknown>) => void;
};

type ToolLifecycleEvent = Event & { toolName?: string };

const message = ref('Browser AI Kit is ready.');
const formMessage = ref('Ready for an agent-assisted workflow.');
const lastAction = ref('Change the field yourself or call set_demo_message from an agent.');
const agentEvent = ref('The form works for people and agents.');
const demoError = ref('');

const {
  support,
  isSupported,
  isProcessing,
  registeredTools,
  discoveredTools,
  refreshSupport,
  registerTools,
  unregisterAll,
  refreshTools
} = useWebMcp();
const statusElement = ref<HTMLElement | null>(null);
const hasMounted = ref(false);
const browserSupported = computed(() => hasMounted.value && isSupported.value);
const supportLabel = computed(() => {
  if (!hasMounted.value) return 'Checking support';
  return isSupported.value ? 'Supported' : support.value.reason;
});
const visibleRegisteredTools = computed<WebMcpTool[]>(() => registeredTools.value);

const formAttributes = createWebMcpFormAttributes({
  name: 'apply_demo_note',
  description: 'Apply a short note to the visible Browser AI Kit WebMCP demo.',
  autoSubmit: true
});
const fieldAttributes = createWebMcpFieldAttributes('The short note to display in the shared WebMCP demo state.');

const registerDemoTools = async () => {
  if (!isSupported.value || registeredTools.value.length) return;

  demoError.value = '';
  try {
    await registerTools([
      {
        name: 'get_demo_state',
        description: 'Read the current message shown in the Browser AI Kit WebMCP demo.',
        inputSchema: { type: 'object', properties: {} },
        annotations: { readOnlyHint: true },
        execute: () => ({ message: message.value })
      },
      {
        name: 'set_demo_message',
        description: 'Set the short message shown in the visible Browser AI Kit WebMCP demo.',
        inputSchema: {
          type: 'object',
          properties: {
            message: {
              type: 'string',
              description: 'A concise message to display in the demo.'
            }
          },
          required: ['message']
        },
        annotations: { readOnlyHint: false, untrustedContentHint: true },
        execute: (input: WebMcpToolInput) => {
          const nextMessage = typeof input.message === 'string' ? input.message.trim() : '';
          if (!nextMessage) throw new TypeError('message must be a non-empty string.');
          message.value = nextMessage.slice(0, 240);
          lastAction.value = 'The set_demo_message tool updated the visible page state.';
          return { applied: true, message: message.value };
        }
      }
    ]);
    await refreshTools();
  } catch (error) {
    demoError.value = error instanceof Error ? error.message : 'WebMCP registration failed.';
  }
};

const refreshDemoTools = async () => {
  demoError.value = '';
  try {
    await refreshTools();
  } catch (error) {
    demoError.value = error instanceof Error ? error.message : 'WebMCP discovery failed.';
  }
};

const toggleTools = async () => {
  if (registeredTools.value.length) {
    unregisterAll();
    await refreshDemoTools();
    return;
  }
  await registerDemoTools();
};

const handleFormSubmit = (rawEvent: Event) => {
  const event = rawEvent as AgentSubmitEvent;
  event.preventDefault();
  const note = formMessage.value.trim();
  if (!note) {
    if (event.agentInvoked) {
      event.respondWith?.(Promise.reject(new TypeError('note must be a non-empty string.')));
    }
    return;
  }

  message.value = note.slice(0, 240);
  agentEvent.value = event.agentInvoked
    ? 'An agent submitted the declarative tool and updated the page.'
    : 'You submitted the same form directly.';
  if (event.agentInvoked) {
    event.respondWith?.(Promise.resolve({ applied: true, message: message.value }));
  }
};

const handleToolActivated = (event: Event) => {
  const toolEvent = event as ToolLifecycleEvent;
  agentEvent.value = `Agent activated ${toolEvent.toolName ?? 'a declarative tool'}.`;
};

const handleToolCancel = (event: Event) => {
  const toolEvent = event as ToolLifecycleEvent;
  agentEvent.value = `Agent cancelled ${toolEvent.toolName ?? 'the declarative tool'}.`;
};

onMounted(async () => {
  hasMounted.value = true;
  window.addEventListener('toolactivated', handleToolActivated);
  window.addEventListener('toolcancel', handleToolCancel);
  const currentSupport = refreshSupport();
  statusElement.value?.classList.toggle('webmcp-demo__status--ready', currentSupport.supported);
  await registerDemoTools();
});

onBeforeUnmount(() => {
  window.removeEventListener('toolactivated', handleToolActivated);
  window.removeEventListener('toolcancel', handleToolCancel);
});
</script>

<style scoped>
.webmcp-demo {
  width: 100%;
  height: auto;
  min-height: 0;
}

.webmcp-demo__content {
  display: flex;
  flex-direction: column;
  gap: 1rem;
  height: auto;
  min-height: 0;
  padding: clamp(1rem, 2vw, 1.5rem);
  color: var(--color-primary);
}

.webmcp-demo__header,
.webmcp-demo__panel-heading,
.webmcp-demo__footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
}

.webmcp-demo__header h2,
.webmcp-demo__header p,
.webmcp-demo__intro,
.webmcp-demo__result {
  margin: 0;
}

.webmcp-demo__eyebrow {
  color: var(--color-secondary);
  font-size: 0.75rem;
  font-weight: 800;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.webmcp-demo__status {
  padding: 0.4rem 0.7rem;
  border: 1px solid rgba(248, 113, 113, 0.45);
  border-radius: 999px;
  color: #fecaca;
  background: rgba(127, 29, 29, 0.3);
}

.webmcp-demo__status--ready {
  border-color: rgba(74, 222, 128, 0.4);
  color: #bbf7d0;
  background: rgba(20, 83, 45, 0.3);
}

.webmcp-demo__notice,
.webmcp-demo__panel {
  border: 1px solid rgba(255, 255, 255, 0.12);
  border-radius: 1rem;
  background: rgba(7, 10, 18, 0.62);
}

.webmcp-demo__notice {
  padding: 0.8rem 1rem;
}

.webmcp-demo__grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 1rem;
  min-height: 0;
}

.webmcp-demo__panel {
  display: flex;
  flex-direction: column;
  gap: 0.8rem;
  min-width: 0;
  padding: 1rem;
}

.webmcp-demo__panel-heading div {
  display: grid;
  gap: 0.2rem;
}

.webmcp-demo__panel-heading span,
.webmcp-demo__result,
.webmcp-demo__footer {
  color: var(--color-secondary);
  font-size: 0.85rem;
}

.webmcp-demo__panel input {
  width: 100%;
  padding: 0.7rem 0.8rem;
  border: 1px solid rgba(255, 255, 255, 0.18);
  border-radius: 0.65rem;
  color: inherit;
  background: rgba(255, 255, 255, 0.06);
}

.webmcp-demo__panel button,
.webmcp-demo__footer button {
  padding: 0.6rem 0.8rem;
  border: 1px solid rgba(255, 255, 255, 0.2);
  border-radius: 0.65rem;
  color: inherit;
  cursor: pointer;
  background: rgba(255, 255, 255, 0.08);
}

.webmcp-demo__panel button:disabled,
.webmcp-demo__footer button:disabled {
  cursor: not-allowed;
  opacity: 0.5;
}

.webmcp-demo__panel form {
  display: grid;
  gap: 0.7rem;
}

.webmcp-demo__panel ul {
  display: grid;
  gap: 0.55rem;
  margin: 0;
  padding: 0;
  list-style: none;
}

.webmcp-demo__panel li {
  display: grid;
  gap: 0.15rem;
}

.webmcp-demo__panel li span {
  color: var(--color-secondary);
  font-size: 0.8rem;
}

@media (max-width: 760px) {
  .webmcp-demo {
    width: 100%;
    overflow: visible;
  }

  .webmcp-demo__grid {
    grid-template-columns: 1fr;
  }
}
</style>
