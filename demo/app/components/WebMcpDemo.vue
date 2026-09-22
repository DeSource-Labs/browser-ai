<template>
  <div class="webmcp-demo">
    <header class="webmcp-demo__hero">
      <div>
        <p class="webmcp-demo__eyebrow">Live WebMCP workspace</p>
        <h2>Plan a Lisbon workday with visible, callable tools.</h2>
        <p>
          A browser agent can search the visible catalog, change the shortlist, and prepare the same visit form a person
          uses. Every call has typed input, cancellation, validation, and visible feedback.
        </p>
      </div>
      <span class="webmcp-demo__status" :class="{ 'webmcp-demo__status--ready': browserSupported }">
        <i aria-hidden="true"></i>
        {{ supportLabel }}
      </span>
    </header>

    <div v-if="hasMounted && !isSupported" class="webmcp-demo__notice" role="status">
      Enable <code>#enable-webmcp-testing</code>, serve a secure origin, and allow the <code>tools</code> permissions
      policy. The catalog remains usable without WebMCP.
    </div>
    <div v-if="demoError" class="webmcp-demo__notice webmcp-demo__notice--error" role="alert">
      {{ demoError }}
    </div>

    <section class="webmcp-demo__prompts" aria-labelledby="agent-prompts-title">
      <div>
        <span class="webmcp-demo__step">01</span>
        <div>
          <strong id="agent-prompts-title">Try these with a compatible browser agent</strong>
          <p>The prompts require discovery, a structured tool call, a page mutation, and a follow-up tool.</p>
        </div>
      </div>
      <button v-for="prompt in agentPrompts" :key="prompt" type="button" @click="copyPrompt(prompt)">
        <span>{{ prompt }}</span>
        <b>{{ copiedPrompt === prompt ? 'Copied' : 'Copy' }}</b>
      </button>
    </section>

    <div class="webmcp-demo__layout">
      <main class="webmcp-demo__catalog">
        <div class="webmcp-demo__section-heading">
          <div>
            <span class="webmcp-demo__step">02</span>
            <div>
              <h3>Workspace catalog</h3>
              <p>Real page state returned by <code>search_lisbon_workspaces</code>.</p>
            </div>
          </div>
          <span>{{ workspaces.length }} places</span>
        </div>

        <div class="webmcp-demo__cards">
          <article v-for="workspace in workspaces" :key="workspace.id" class="workspace-card">
            <div class="workspace-card__top">
              <div>
                <span>{{ workspace.neighborhood }}</span>
                <h4>{{ workspace.name }}</h4>
              </div>
              <strong>€{{ workspace.dayPrice }}<small>/day</small></strong>
            </div>
            <p>{{ workspace.summary }}</p>
            <ul aria-label="Amenities">
              <li v-for="amenity in workspace.amenities" :key="amenity">{{ amenityLabels[amenity] }}</li>
            </ul>
            <button
              type="button"
              :class="{ 'workspace-card__button--selected': isShortlisted(workspace.id) }"
              @click="toggleShortlist(workspace.id, 'person')"
            >
              {{ isShortlisted(workspace.id) ? 'Remove from shortlist' : 'Add to shortlist' }}
            </button>
          </article>
        </div>
      </main>

      <aside class="webmcp-demo__agent-panel">
        <div class="webmcp-demo__section-heading">
          <div>
            <span class="webmcp-demo__step">03</span>
            <div>
              <h3>Agent surface</h3>
              <p>Tools appear and disappear with page state.</p>
            </div>
          </div>
          <button type="button" :disabled="!browserSupported || isProcessing" @click="toggleTools">
            {{ toolsEnabled ? 'Disable' : 'Enable' }}
          </button>
        </div>

        <div class="webmcp-demo__metrics">
          <div>
            <strong>{{ registeredTools.length }}</strong
            ><span>owned tools</span>
          </div>
          <div>
            <strong>{{ discoveredTools.length }}</strong
            ><span>discoverable</span>
          </div>
          <div>
            <strong>{{ shortlist.length }}</strong
            ><span>shortlisted</span>
          </div>
        </div>

        <ul class="webmcp-demo__tools">
          <li v-for="tool in registeredTools" :key="tool.name">
            <div>
              <code>{{ tool.name }}</code>
              <span>{{ tool.annotations?.readOnlyHint ? 'read only' : 'changes page' }}</span>
            </div>
            <p>{{ tool.description }}</p>
          </li>
        </ul>

        <div class="webmcp-demo__actions">
          <button type="button" :disabled="!browserSupported || isProcessing" @click="simulateAgentRun">
            {{ processing === 'executing' ? 'Running tool chain…' : 'Run discovery → tool chain' }}
          </button>
          <button type="button" :disabled="!browserSupported || isProcessing" @click="refreshDemoTools">
            Refresh discovery
          </button>
        </div>

        <div class="webmcp-demo__activity" aria-live="polite">
          <strong>Activity</strong>
          <ol>
            <li v-for="entry in activity" :key="entry.id">
              <time>{{ entry.time }}</time>
              <span>{{ entry.message }}</span>
            </li>
          </ol>
        </div>
      </aside>
    </div>

    <section class="webmcp-demo__visit">
      <div class="webmcp-demo__section-heading">
        <div>
          <span class="webmcp-demo__step">04</span>
          <div>
            <h3>Visit draft</h3>
            <p>A declarative tool made from ordinary, accessible HTML. It saves locally; it never books or pays.</p>
          </div>
        </div>
        <span v-if="visitDraft" class="webmcp-demo__saved">Draft saved</span>
      </div>

      <form v-bind="visitFormAttributes" @submit="handleVisitSubmit">
        <label>
          <span>Workspace</span>
          <select v-model="selectedWorkspaceId" v-bind="visitFieldAttributes.workspace" name="workspace_id" required>
            <option value="" disabled>Select a workspace</option>
            <option v-for="workspace in workspaces" :key="workspace.id" :value="workspace.id">
              {{ workspace.name }} — {{ workspace.neighborhood }}
            </option>
          </select>
        </label>
        <label>
          <span>Date</span>
          <input
            v-model="requestedDate"
            v-bind="visitFieldAttributes.date"
            name="date"
            :min="minimumDate"
            required
            type="date"
          />
        </label>
        <label>
          <span>People</span>
          <input
            v-model.number="attendeeCount"
            v-bind="visitFieldAttributes.attendees"
            name="attendee_count"
            min="1"
            max="12"
            required
            type="number"
          />
        </label>
        <label class="webmcp-demo__visit-notes">
          <span>Access or setup notes</span>
          <input
            v-model="visitNotes"
            v-bind="visitFieldAttributes.notes"
            maxlength="240"
            name="notes"
            placeholder="Optional: step-free access, monitor, quiet desk…"
            type="text"
          />
        </label>
        <button type="submit">Save visit draft</button>
        <button
          type="button"
          :disabled="!browserSupported || isProcessing || !selectedWorkspaceId"
          @click="simulateFormRun"
        >
          Save through WebMCP
        </button>
      </form>

      <p v-if="visitDraft" class="webmcp-demo__draft" role="status">
        <strong>{{ visitDraft.workspaceName }}</strong>
        <span
          >{{ visitDraft.date }} · {{ visitDraft.attendeeCount }}
          {{ visitDraft.attendeeCount === 1 ? 'person' : 'people' }}</span
        >
        <span v-if="visitDraft.notes">{{ visitDraft.notes }}</span>
        <small>{{
          visitDraft.agentInvoked ? 'Prepared by an agent through the form tool.' : 'Prepared directly in the page.'
        }}</small>
      </p>
    </section>
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

type Amenity = 'quiet-booths' | 'monitor' | 'terrace' | 'step-free' | 'meeting-room' | '24-7';

interface Workspace {
  id: string;
  name: string;
  neighborhood: 'Alcântara' | 'Baixa' | 'Príncipe Real' | 'Saldanha';
  dayPrice: number;
  amenities: Amenity[];
  summary: string;
}

type SearchInput = WebMcpToolInput & {
  neighborhood?: Workspace['neighborhood'];
  max_day_price?: number;
  required_amenities?: Amenity[];
};

type WorkspaceInput = WebMcpToolInput & { workspace_id: string };

interface VisitDraft {
  workspaceName: string;
  date: string;
  attendeeCount: number;
  notes: string;
  agentInvoked: boolean;
}

type AgentSubmitEvent = SubmitEvent & {
  agentInvoked?: boolean;
  respondWith?: (response: Promise<unknown>) => void;
};

type ToolLifecycleEvent = Event & {
  toolName?: string;
  detail?: { toolName?: string };
};

const workspaces: Workspace[] = [
  {
    id: 'river-foundry',
    name: 'River Foundry',
    neighborhood: 'Alcântara',
    dayPrice: 22,
    amenities: ['quiet-booths', 'monitor', 'step-free'],
    summary: 'A converted print workshop with focus booths and wide riverside tables.'
  },
  {
    id: 'lume-studio',
    name: 'Lume Studio',
    neighborhood: 'Príncipe Real',
    dayPrice: 28,
    amenities: ['terrace', 'meeting-room', 'monitor'],
    summary: 'Small design-led studio with a shaded terrace and bookable project room.'
  },
  {
    id: 'grid-saldanha',
    name: 'Grid Saldanha',
    neighborhood: 'Saldanha',
    dayPrice: 19,
    amenities: ['24-7', 'quiet-booths', 'meeting-room'],
    summary: 'Practical round-the-clock space close to the metro, built for focused days.'
  },
  {
    id: 'baixa-library',
    name: 'Baixa Library',
    neighborhood: 'Baixa',
    dayPrice: 24,
    amenities: ['step-free', 'terrace', 'quiet-booths'],
    summary: 'Calm reading-room atmosphere with natural light and a hidden courtyard.'
  }
];

const amenityLabels: Record<Amenity, string> = {
  'quiet-booths': 'Quiet booths',
  monitor: 'Monitor',
  terrace: 'Terrace',
  'step-free': 'Step-free',
  'meeting-room': 'Meeting room',
  '24-7': '24/7 access'
};

const agentPrompts = [
  'Find Lisbon workspaces under €25/day with quiet booths, then shortlist the cheapest.',
  'What is on my workspace shortlist? Prepare a two-person visit draft for tomorrow.'
];

const shortlist = ref<string[]>([]);
const selectedWorkspaceId = ref('');
const requestedDate = ref('');
const minimumDate = ref('');
const attendeeCount = ref(2);
const visitNotes = ref('');
const visitDraft = ref<VisitDraft | null>(null);
const copiedPrompt = ref('');
const demoError = ref('');
const hasMounted = ref(false);
const toolsEnabled = ref(false);
const activity = ref<Array<{ id: number; time: string; message: string }>>([]);
let activityId = 0;
let dynamicSync: Promise<void> = Promise.resolve();

const {
  support,
  isSupported,
  processing,
  isProcessing,
  registeredTools,
  discoveredTools,
  refreshSupport,
  registerTool,
  registerTools,
  unregisterTool,
  unregisterAll,
  refreshTools,
  executeTool
} = useWebMcp();

const browserSupported = computed(() => hasMounted.value && isSupported.value);
const supportLabel = computed(() => {
  if (!hasMounted.value) return 'Checking browser';
  return isSupported.value ? 'WebMCP ready' : support.value.reason.replaceAll('-', ' ');
});

const visitFormAttributes = createWebMcpFormAttributes({
  name: 'save_workspace_visit_draft',
  description: 'Save a local visit draft for one of the Lisbon workspaces visible on this page.',
  autoSubmit: true
});

const visitFieldAttributes = {
  workspace: createWebMcpFieldAttributes('The workspace ID selected from the visible catalog.'),
  date: createWebMcpFieldAttributes('The requested visit date in YYYY-MM-DD format.'),
  attendees: createWebMcpFieldAttributes('The number of people visiting, from 1 through 12.'),
  notes: createWebMcpFieldAttributes('Optional accessibility or desk setup needs, limited to 240 characters.')
};

const recordActivity = (message: string) => {
  const now = new Date();
  activity.value = [
    {
      id: ++activityId,
      time: now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
      message
    },
    ...activity.value
  ].slice(0, 7);
};

const reportError = (error: unknown, fallback: string) => {
  demoError.value = error instanceof Error ? error.message : fallback;
  recordActivity(demoError.value);
};

const throwIfCancelled = (signal: AbortSignal) => {
  if (signal.aborted) throw signal.reason ?? new DOMException('Tool execution was cancelled.', 'AbortError');
};

const findWorkspace = (id: string) => workspaces.find((workspace) => workspace.id === id);
const isShortlisted = (id: string) => shortlist.value.includes(id);

const addWorkspace = (id: string, actor: 'agent' | 'person') => {
  const workspace = findWorkspace(id);
  if (!workspace) throw new TypeError(`Unknown workspace ID: ${id}`);
  const alreadyShortlisted = isShortlisted(id);
  if (!alreadyShortlisted) shortlist.value = [...shortlist.value, id];
  selectedWorkspaceId.value ||= id;
  recordActivity(
    `${actor === 'agent' ? 'Agent' : 'You'} ${alreadyShortlisted ? 'kept' : 'added'} ${workspace.name} ${alreadyShortlisted ? 'on' : 'to'} the shortlist.`
  );
  return { added: !alreadyShortlisted, workspace, shortlist_count: shortlist.value.length };
};

const removeWorkspace = (id: string, actor: 'agent' | 'person') => {
  const workspace = findWorkspace(id);
  if (!workspace) throw new TypeError(`Unknown workspace ID: ${id}`);
  const removed = isShortlisted(id);
  shortlist.value = shortlist.value.filter((workspaceId) => workspaceId !== id);
  recordActivity(
    `${actor === 'agent' ? 'Agent' : 'You'} ${removed ? 'removed' : 'did not find'} ${workspace.name} ${removed ? 'from' : 'on'} the shortlist.`
  );
  return { removed, workspace_id: id, shortlist_count: shortlist.value.length };
};

const toggleShortlist = (id: string, actor: 'agent' | 'person') => {
  if (isShortlisted(id)) removeWorkspace(id, actor);
  else addWorkspace(id, actor);
};

const isSearchInput = (input: unknown): input is SearchInput => {
  if (!input || typeof input !== 'object' || Array.isArray(input)) return false;
  const value = input as WebMcpToolInput;
  const allowedNeighborhoods = workspaces.map(({ neighborhood }) => neighborhood);
  const allowedAmenities = Object.keys(amenityLabels);
  return (
    (value.neighborhood === undefined ||
      allowedNeighborhoods.includes(value.neighborhood as Workspace['neighborhood'])) &&
    (value.max_day_price === undefined || (typeof value.max_day_price === 'number' && value.max_day_price >= 0)) &&
    (value.required_amenities === undefined ||
      (Array.isArray(value.required_amenities) &&
        value.required_amenities.every((item) => allowedAmenities.includes(String(item)))))
  );
};

const isWorkspaceInput = (input: unknown): input is WorkspaceInput => {
  if (!input || typeof input !== 'object' || Array.isArray(input)) return false;
  return (
    typeof (input as WebMcpToolInput).workspace_id === 'string' &&
    Boolean(findWorkspace((input as WorkspaceInput).workspace_id))
  );
};

const workspaceIdSchema = {
  type: 'object',
  properties: {
    workspace_id: {
      type: 'string',
      description: 'A workspace ID returned by search_lisbon_workspaces.',
      enum: workspaces.map(({ id }) => id)
    }
  },
  required: ['workspace_id'],
  additionalProperties: false
};

const baseTools: WebMcpTool[] = [
  {
    name: 'search_lisbon_workspaces',
    title: 'Search Lisbon workspaces',
    description:
      'Search the workspace catalog visible on this page by neighborhood, day price, and required amenities.',
    inputSchema: {
      type: 'object',
      properties: {
        neighborhood: {
          type: 'string',
          enum: ['Alcântara', 'Baixa', 'Príncipe Real', 'Saldanha'],
          description: 'Optional Lisbon neighborhood.'
        },
        max_day_price: { type: 'number', minimum: 0, description: 'Optional maximum price in euros per day.' },
        required_amenities: {
          type: 'array',
          items: { type: 'string', enum: Object.keys(amenityLabels) },
          description: 'Amenities that every match must provide.'
        }
      },
      additionalProperties: false
    },
    annotations: { readOnlyHint: true },
    validateInput: isSearchInput,
    execute: (rawInput, { signal }) => {
      throwIfCancelled(signal);
      const input = rawInput as SearchInput;
      const matches = workspaces
        .filter((workspace) => !input.neighborhood || workspace.neighborhood === input.neighborhood)
        .filter((workspace) => input.max_day_price === undefined || workspace.dayPrice <= input.max_day_price)
        .filter((workspace) =>
          (input.required_amenities ?? []).every((amenity) => workspace.amenities.includes(amenity))
        )
        .map(({ id, name, neighborhood, dayPrice, amenities, summary }) => ({
          id,
          name,
          neighborhood,
          day_price_eur: dayPrice,
          amenities,
          summary
        }));
      recordActivity(
        `Agent searched the catalog and found ${matches.length} matching workspace${matches.length === 1 ? '' : 's'}.`
      );
      return { matches, total: matches.length, source: 'visible-page-catalog' };
    }
  },
  {
    name: 'shortlist_lisbon_workspace',
    title: 'Shortlist a Lisbon workspace',
    description: 'Add one workspace from the visible catalog to the page shortlist. This changes visible page state.',
    inputSchema: workspaceIdSchema,
    annotations: { readOnlyHint: false },
    validateInput: isWorkspaceInput,
    execute: (input, { signal }) => {
      throwIfCancelled(signal);
      return addWorkspace((input as WorkspaceInput).workspace_id, 'agent');
    }
  },
  {
    name: 'remove_lisbon_workspace_from_shortlist',
    title: 'Remove a shortlisted workspace',
    description: 'Remove one Lisbon workspace from the visible page shortlist.',
    inputSchema: workspaceIdSchema,
    annotations: { readOnlyHint: false },
    validateInput: isWorkspaceInput,
    execute: (input, { signal }) => {
      throwIfCancelled(signal);
      return removeWorkspace((input as WorkspaceInput).workspace_id, 'agent');
    }
  }
];

const dynamicTools = (): WebMcpTool[] => [
  {
    name: 'get_lisbon_workspace_shortlist',
    title: 'Get the current workspace shortlist',
    description:
      'Return the workspace shortlist currently visible on this page. Available only while the shortlist is not empty.',
    inputSchema: { type: 'object', properties: {}, additionalProperties: false },
    annotations: { readOnlyHint: true },
    execute: (_input, { signal }) => {
      throwIfCancelled(signal);
      const items = shortlist.value.flatMap((id) => {
        const workspace = findWorkspace(id);
        return workspace ? [{ id: workspace.id, name: workspace.name, day_price_eur: workspace.dayPrice }] : [];
      });
      recordActivity(`Agent read ${items.length} item${items.length === 1 ? '' : 's'} from the shortlist.`);
      return { items, total: items.length };
    }
  },
  {
    name: 'clear_lisbon_workspace_shortlist',
    title: 'Clear the workspace shortlist',
    description:
      'Remove every workspace from the visible page shortlist. Available only while the shortlist is not empty.',
    inputSchema: { type: 'object', properties: {}, additionalProperties: false },
    annotations: { readOnlyHint: false },
    execute: (_input, { signal }) => {
      throwIfCancelled(signal);
      const removed = shortlist.value.length;
      shortlist.value = [];
      recordActivity(`Agent cleared ${removed} workspace${removed === 1 ? '' : 's'} from the shortlist.`);
      return { cleared: true, removed };
    }
  }
];

const performDynamicToolSync = async () => {
  const dynamicNames = dynamicTools().map(({ name }) => name);
  if (!toolsEnabled.value || shortlist.value.length === 0) {
    dynamicNames.forEach(unregisterTool);
    return;
  }

  for (const tool of dynamicTools()) {
    if (!registeredTools.value.some(({ name }) => name === tool.name)) await registerTool(tool);
  }
};

const syncDynamicTools = () => {
  dynamicSync = dynamicSync.then(performDynamicToolSync).catch((error: unknown) => {
    reportError(error, 'Dynamic WebMCP tool registration failed.');
  });
  return dynamicSync;
};

const registerDemoTools = async () => {
  if (!isSupported.value) return;
  demoError.value = '';
  toolsEnabled.value = true;
  try {
    const missing = baseTools.filter((tool) => !registeredTools.value.some(({ name }) => name === tool.name));
    if (missing.length) await registerTools(missing);
    await syncDynamicTools();
    await refreshTools();
    recordActivity('WebMCP tools registered. The browser can now discover this page.');
  } catch (error) {
    reportError(error, 'WebMCP registration failed.');
  }
};

const refreshDemoTools = async () => {
  demoError.value = '';
  try {
    await refreshTools();
    recordActivity('Tool discovery refreshed.');
  } catch (error) {
    reportError(error, 'WebMCP discovery failed.');
  }
};

const toggleTools = async () => {
  if (toolsEnabled.value) {
    toolsEnabled.value = false;
    unregisterAll();
    await refreshDemoTools();
    recordActivity('Page-owned WebMCP tools unregistered.');
    return;
  }
  await registerDemoTools();
};

const simulateAgentRun = async () => {
  demoError.value = '';
  try {
    const tools = await refreshTools();
    const searchTool = tools.find(({ name }) => name === 'search_lisbon_workspaces');
    const shortlistTool = tools.find(({ name }) => name === 'shortlist_lisbon_workspace');
    if (!searchTool || !shortlistTool) throw new Error('Register the demo tools before running the tool chain.');

    const response = await executeTool(searchTool, {
      max_day_price: 25,
      required_amenities: ['quiet-booths']
    });
    if (response === null) throw new Error('The search tool navigated away before returning a result.');
    const result = JSON.parse(response) as { matches?: Array<{ id: string; day_price_eur: number }> } | null;
    const choice = result?.matches?.toSorted((left, right) => left.day_price_eur - right.day_price_eur)[0];
    if (!choice) throw new Error('The sample search returned no matching workspaces.');

    await executeTool(shortlistTool, { workspace_id: choice.id });
    await nextTick();
    await syncDynamicTools();
    const updatedTools = await refreshTools();
    const getShortlistTool = updatedTools.find(({ name }) => name === 'get_lisbon_workspace_shortlist');
    if (!getShortlistTool) throw new Error('The state-dependent shortlist tool was not registered.');
    await executeTool(getShortlistTool);
    recordActivity('Sample agent completed discovery → search → mutation → dynamic follow-up.');
  } catch (error) {
    reportError(error, 'The sample WebMCP tool chain failed.');
  }
};

const simulateFormRun = async () => {
  demoError.value = '';
  try {
    const tools = await refreshTools();
    const formTool = tools.find(({ name }) => name === 'save_workspace_visit_draft');
    if (!formTool) throw new Error('The browser has not exposed the visit form as a WebMCP tool.');
    await executeTool(formTool, {
      workspace_id: selectedWorkspaceId.value,
      date: requestedDate.value,
      attendee_count: attendeeCount.value,
      notes: visitNotes.value
    });
  } catch (error) {
    reportError(error, 'The declarative WebMCP form could not save the visit draft.');
  }
};

const copyPrompt = async (prompt: string) => {
  try {
    await navigator.clipboard.writeText(prompt);
    copiedPrompt.value = prompt;
    window.setTimeout(() => {
      if (copiedPrompt.value === prompt) copiedPrompt.value = '';
    }, 1800);
  } catch (error) {
    reportError(error, 'Could not copy the prompt.');
  }
};

const handleVisitSubmit = (rawEvent: Event) => {
  const event = rawEvent as AgentSubmitEvent;
  event.preventDefault();
  const form = event.currentTarget as HTMLFormElement;
  const formData = new FormData(form);
  const workspaceId = String(formData.get('workspace_id') ?? '');
  const workspace = findWorkspace(workspaceId);
  const date = String(formData.get('date') ?? '');
  const count = Number(formData.get('attendee_count'));
  const notes = String(formData.get('notes') ?? '')
    .trim()
    .slice(0, 240);

  const response = Promise.resolve().then(() => {
    if (!workspace) throw new TypeError('Choose a workspace from the visible catalog.');
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new TypeError('Choose a valid visit date.');
    if (!Number.isInteger(count) || count < 1 || count > 12) {
      throw new TypeError('Attendee count must be from 1 through 12.');
    }
    selectedWorkspaceId.value = workspaceId;
    requestedDate.value = date;
    attendeeCount.value = count;
    visitNotes.value = notes;
    visitDraft.value = {
      workspaceName: workspace.name,
      date,
      attendeeCount: count,
      notes,
      agentInvoked: Boolean(event.agentInvoked)
    };
    recordActivity(`${event.agentInvoked ? 'Agent' : 'You'} saved a local visit draft for ${workspace.name}.`);
    return { saved: true, workspace_id: workspaceId, date, attendee_count: count, notes };
  });

  void response.catch((error: unknown) => reportError(error, 'The visit draft could not be saved.'));
  if (event.agentInvoked) event.respondWith?.(response);
};

const eventToolName = (event: ToolLifecycleEvent) => event.toolName ?? event.detail?.toolName ?? 'the form tool';
const handleToolActivated = (event: Event) =>
  recordActivity(`Agent activated ${eventToolName(event as ToolLifecycleEvent)}.`);
const handleToolCancel = (event: Event) =>
  recordActivity(`Agent cancelled ${eventToolName(event as ToolLifecycleEvent)}.`);

watch(shortlist, () => void syncDynamicTools(), { deep: true });

onMounted(async () => {
  hasMounted.value = true;
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const localDate = (date: Date) =>
    `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
  minimumDate.value = localDate(new Date());
  requestedDate.value = localDate(tomorrow);
  window.addEventListener('toolactivated', handleToolActivated);
  window.addEventListener('toolcancel', handleToolCancel);
  refreshSupport();
  await registerDemoTools();
});

onBeforeUnmount(() => {
  toolsEnabled.value = false;
  window.removeEventListener('toolactivated', handleToolActivated);
  window.removeEventListener('toolcancel', handleToolCancel);
  unregisterAll();
});
</script>

<style scoped>
.webmcp-demo {
  display: grid;
  gap: 1rem;
  width: 100%;
  padding: clamp(1rem, 2.2vw, 1.6rem);
  color: var(--color-primary);
}

.webmcp-demo__hero,
.webmcp-demo__section-heading,
.webmcp-demo__section-heading > div,
.workspace-card__top,
.webmcp-demo__actions {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
}

.webmcp-demo__hero {
  align-items: flex-start;
  padding-bottom: 0.25rem;
}

.webmcp-demo__hero > div {
  max-width: 780px;
}

.webmcp-demo__hero h2,
.webmcp-demo__hero p,
.webmcp-demo__section-heading h3,
.webmcp-demo__section-heading p,
.workspace-card h4,
.workspace-card p,
.webmcp-demo__tools p,
.webmcp-demo__prompts p,
.webmcp-demo__draft {
  margin: 0;
}

.webmcp-demo__hero h2 {
  margin: 0.2rem 0 0.45rem;
  font-size: clamp(1.35rem, 2.5vw, 2.05rem);
  line-height: 1.1;
}

.webmcp-demo__hero > div > p:last-child,
.webmcp-demo__section-heading p,
.workspace-card p,
.webmcp-demo__tools p,
.webmcp-demo__prompts p,
.webmcp-demo__draft small {
  color: var(--color-secondary);
}

.webmcp-demo__eyebrow {
  color: #9fb4ff;
  font-size: 0.72rem;
  font-weight: 850;
  letter-spacing: 0.11em;
  text-transform: uppercase;
}

.webmcp-demo__status,
.webmcp-demo__saved {
  display: inline-flex;
  flex-shrink: 0;
  align-items: center;
  gap: 0.45rem;
  padding: 0.48rem 0.72rem;
  color: #fecaca;
  border: 1px solid rgba(248, 113, 113, 0.38);
  border-radius: 999px;
  background: rgba(127, 29, 29, 0.25);
  font-size: 0.75rem;
  font-weight: 750;
}

.webmcp-demo__status i {
  width: 0.45rem;
  height: 0.45rem;
  border-radius: 50%;
  background: currentColor;
  box-shadow: 0 0 0.55rem currentColor;
}

.webmcp-demo__status--ready,
.webmcp-demo__saved {
  color: #b8f8d1;
  border-color: rgba(74, 222, 128, 0.34);
  background: rgba(20, 83, 45, 0.27);
}

.webmcp-demo__notice,
.webmcp-demo__prompts,
.webmcp-demo__catalog,
.webmcp-demo__agent-panel,
.webmcp-demo__visit {
  border: 1px solid rgba(255, 255, 255, 0.11);
  border-radius: 1rem;
  background: rgba(7, 10, 18, 0.66);
}

.webmcp-demo__notice {
  padding: 0.8rem 1rem;
  color: #fde68a;
  border-color: rgba(250, 204, 21, 0.28);
}

.webmcp-demo__notice--error {
  color: #fecaca;
  border-color: rgba(248, 113, 113, 0.35);
}

.webmcp-demo__prompts,
.webmcp-demo__visit {
  padding: 1rem;
}

.webmcp-demo__prompts {
  display: grid;
  grid-template-columns: minmax(220px, 0.75fr) repeat(2, minmax(220px, 1fr));
  gap: 0.8rem;
  align-items: stretch;
}

.webmcp-demo__prompts > div,
.webmcp-demo__prompts button {
  display: flex;
  align-items: flex-start;
  gap: 0.75rem;
}

.webmcp-demo__prompts button {
  justify-content: space-between;
  padding: 0.75rem;
  color: inherit;
  text-align: left;
  border: 1px solid rgba(158, 179, 255, 0.2);
  border-radius: 0.75rem;
  background: rgba(93, 109, 184, 0.1);
  cursor: pointer;
}

.webmcp-demo__prompts button b {
  color: #b9c8ff;
  font-size: 0.7rem;
}

.webmcp-demo__step {
  display: grid;
  place-items: center;
  width: 1.75rem;
  height: 1.75rem;
  flex-shrink: 0;
  color: #b9c8ff;
  border: 1px solid rgba(158, 179, 255, 0.25);
  border-radius: 0.55rem;
  background: rgba(93, 109, 184, 0.12);
  font-size: 0.65rem;
  font-weight: 850;
}

.webmcp-demo__layout {
  display: grid;
  grid-template-columns: minmax(0, 1.65fr) minmax(280px, 0.85fr);
  gap: 1rem;
}

.webmcp-demo__catalog,
.webmcp-demo__agent-panel {
  min-width: 0;
  padding: 1rem;
}

.webmcp-demo__section-heading {
  align-items: flex-start;
  margin-bottom: 0.9rem;
}

.webmcp-demo__section-heading > div {
  align-items: flex-start;
  justify-content: flex-start;
}

.webmcp-demo__section-heading h3 {
  font-size: 1rem;
}

.webmcp-demo__section-heading p,
.webmcp-demo__section-heading > span {
  margin-top: 0.12rem;
  font-size: 0.76rem;
}

.webmcp-demo__section-heading > span {
  color: #b7c2e8;
  white-space: nowrap;
}

.webmcp-demo__section-heading button,
.webmcp-demo__actions button,
.webmcp-demo__visit button,
.workspace-card button {
  padding: 0.58rem 0.72rem;
  color: inherit;
  border: 1px solid rgba(255, 255, 255, 0.16);
  border-radius: 0.65rem;
  background: rgba(255, 255, 255, 0.07);
  cursor: pointer;
}

.webmcp-demo button:disabled {
  cursor: not-allowed;
  opacity: 0.45;
}

.webmcp-demo__cards {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 0.75rem;
}

.workspace-card {
  display: grid;
  gap: 0.65rem;
  min-width: 0;
  padding: 0.85rem;
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 0.8rem;
  background: rgba(255, 255, 255, 0.035);
}

.workspace-card__top {
  align-items: flex-start;
}

.workspace-card__top span {
  color: #9fb4ff;
  font-size: 0.67rem;
  font-weight: 750;
  text-transform: uppercase;
}

.workspace-card h4 {
  margin-top: 0.1rem;
  font-size: 0.98rem;
}

.workspace-card__top > strong {
  color: #d4fbdf;
  font-size: 1rem;
}

.workspace-card__top small {
  color: var(--color-secondary);
  font-size: 0.65rem;
  font-weight: 500;
}

.workspace-card p {
  min-height: 2.6em;
  font-size: 0.76rem;
  line-height: 1.4;
}

.workspace-card ul {
  display: flex;
  flex-wrap: wrap;
  gap: 0.35rem;
  margin: 0;
  padding: 0;
  list-style: none;
}

.workspace-card li {
  padding: 0.22rem 0.4rem;
  color: #c9d3f6;
  border-radius: 999px;
  background: rgba(147, 164, 221, 0.1);
  font-size: 0.65rem;
}

.workspace-card button {
  width: 100%;
  margin-top: auto;
}

.workspace-card__button--selected {
  color: #d4fbdf !important;
  border-color: rgba(74, 222, 128, 0.26) !important;
  background: rgba(20, 83, 45, 0.24) !important;
}

.webmcp-demo__metrics {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 0.45rem;
  margin-bottom: 0.75rem;
}

.webmcp-demo__metrics > div {
  display: grid;
  gap: 0.1rem;
  padding: 0.55rem;
  border: 1px solid rgba(255, 255, 255, 0.07);
  border-radius: 0.65rem;
  background: rgba(255, 255, 255, 0.03);
}

.webmcp-demo__metrics strong {
  font-size: 1.1rem;
}

.webmcp-demo__metrics span {
  color: var(--color-secondary);
  font-size: 0.62rem;
}

.webmcp-demo__tools {
  display: grid;
  gap: 0.45rem;
  max-height: 272px;
  margin: 0;
  padding: 0;
  overflow: auto;
  list-style: none;
}

.webmcp-demo__tools li {
  padding: 0.6rem;
  border-left: 2px solid rgba(143, 222, 210, 0.55);
  background: rgba(255, 255, 255, 0.025);
}

.webmcp-demo__tools li > div {
  display: flex;
  justify-content: space-between;
  gap: 0.5rem;
}

.webmcp-demo__tools code {
  overflow: hidden;
  color: #d8e0ff;
  font-size: 0.69rem;
  text-overflow: ellipsis;
}

.webmcp-demo__tools li span {
  flex-shrink: 0;
  color: #98ecd9;
  font-size: 0.58rem;
  text-transform: uppercase;
}

.webmcp-demo__tools p {
  margin-top: 0.22rem;
  font-size: 0.68rem;
  line-height: 1.35;
}

.webmcp-demo__actions {
  margin-top: 0.75rem;
}

.webmcp-demo__actions button:first-child {
  flex: 1;
  color: #dfe5ff;
  border-color: rgba(158, 179, 255, 0.25);
  background: rgba(93, 109, 184, 0.14);
}

.webmcp-demo__activity {
  margin-top: 0.9rem;
  padding-top: 0.75rem;
  border-top: 1px solid rgba(255, 255, 255, 0.08);
}

.webmcp-demo__activity > strong {
  font-size: 0.76rem;
}

.webmcp-demo__activity ol {
  display: grid;
  gap: 0.4rem;
  max-height: 134px;
  margin: 0.5rem 0 0;
  padding: 0;
  overflow: auto;
  list-style: none;
}

.webmcp-demo__activity li {
  display: grid;
  grid-template-columns: auto 1fr;
  gap: 0.45rem;
  color: var(--color-secondary);
  font-size: 0.65rem;
}

.webmcp-demo__activity time {
  color: #9fb4ff;
  font-variant-numeric: tabular-nums;
}

.webmcp-demo__visit form {
  display: grid;
  grid-template-columns: 1.25fr 0.8fr 0.55fr 1.5fr auto;
  gap: 0.65rem;
  align-items: end;
}

.webmcp-demo__visit label {
  display: grid;
  gap: 0.32rem;
  min-width: 0;
  color: #c9d3f6;
  font-size: 0.68rem;
}

.webmcp-demo__visit input,
.webmcp-demo__visit select {
  width: 100%;
  min-width: 0;
  height: 2.35rem;
  padding: 0.45rem 0.55rem;
  color: inherit;
  border: 1px solid rgba(255, 255, 255, 0.13);
  border-radius: 0.58rem;
  background: #101522;
  color-scheme: dark;
}

.webmcp-demo__visit form:tool-form-active {
  outline: 2px solid rgba(143, 222, 210, 0.7);
  outline-offset: 0.55rem;
}

.webmcp-demo__visit button:tool-submit-active {
  box-shadow: 0 0 0 3px rgba(143, 222, 210, 0.24);
}

.webmcp-demo__draft {
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  gap: 0.35rem 0.8rem;
  margin-top: 0.8rem;
  padding: 0.65rem 0.75rem;
  border-radius: 0.65rem;
  background: rgba(20, 83, 45, 0.18);
  font-size: 0.76rem;
}

.webmcp-demo__draft small {
  width: 100%;
}

@media (max-width: 1050px) {
  .webmcp-demo__prompts {
    grid-template-columns: 1fr 1fr;
  }

  .webmcp-demo__prompts > div {
    grid-column: 1 / -1;
  }

  .webmcp-demo__layout {
    grid-template-columns: 1fr;
  }

  .webmcp-demo__visit form {
    grid-template-columns: 1fr 1fr;
  }

  .webmcp-demo__visit-notes {
    grid-column: 1 / -1;
  }
}

@media (max-width: 650px) {
  .webmcp-demo__hero,
  .webmcp-demo__section-heading {
    flex-direction: column;
  }

  .webmcp-demo__prompts,
  .webmcp-demo__cards,
  .webmcp-demo__visit form {
    grid-template-columns: 1fr;
  }

  .webmcp-demo__visit-notes {
    grid-column: auto;
  }
}
</style>
