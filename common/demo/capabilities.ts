export interface DemoWebMcpTool<Input extends Record<string, unknown> = Record<string, unknown>> {
  name: string;
  title: string;
  description: string;
  inputSchema: object;
  annotations: { readOnlyHint?: boolean; untrustedContentHint?: boolean };
  validateInput(input: unknown): input is Input;
  execute(input: Input, options: { signal: AbortSignal }): unknown | Promise<unknown>;
}

export const BUILT_IN_AI_GLOBALS = [
  'LanguageModel',
  'Summarizer',
  'Writer',
  'Rewriter',
  'Translator',
  'LanguageDetector',
  'Proofreader'
] as const;

export type BuiltInAiGlobal = (typeof BUILT_IN_AI_GLOBALS)[number];

export type DemoCapability = {
  name: BuiltInAiGlobal | 'WebMCP';
  availability: Availability | 'supported' | 'unsupported';
};

type AvailabilityConstructor = {
  availability(options?: object): Promise<Availability>;
};

const DEMO_AVAILABILITY_OPTIONS: Partial<Record<BuiltInAiGlobal, object>> = {
  Translator: { sourceLanguage: 'en', targetLanguage: 'fr' }
};

const inspectAvailability = async (constructor: AvailabilityConstructor, name: BuiltInAiGlobal) => {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race<Availability>([
      constructor.availability(DEMO_AVAILABILITY_OPTIONS[name]),
      new Promise<Availability>((resolve) => {
        timer = setTimeout(() => resolve('unavailable'), 10_000);
      })
    ]);
  } catch {
    return 'unavailable';
  } finally {
    if (timer) clearTimeout(timer);
  }
};

export async function inspectDemoCapabilities(): Promise<DemoCapability[]> {
  const root = globalThis as Record<string, unknown>;
  const capabilities = await Promise.all(
    BUILT_IN_AI_GLOBALS.map(async (name): Promise<DemoCapability> => {
      const constructor = root[name] as AvailabilityConstructor | undefined;
      if (typeof constructor?.availability !== 'function') return { name, availability: 'unavailable' };
      return { name, availability: await inspectAvailability(constructor, name) };
    })
  );

  return [
    ...capabilities,
    {
      name: 'WebMCP',
      availability:
        typeof document !== 'undefined' && 'modelContext' in document && document.modelContext
          ? 'supported'
          : 'unsupported'
    }
  ];
}

export interface DemoTask {
  id: string;
  title: string;
  priority: 'low' | 'medium' | 'high';
  createdBy: 'person' | 'agent';
}

export interface CreateDemoTaskInput extends Record<string, unknown> {
  title: string;
  priority?: DemoTask['priority'];
}

const isCreateDemoTaskInput = (input: unknown): input is CreateDemoTaskInput => {
  if (!input || typeof input !== 'object' || Array.isArray(input)) return false;
  const value = input as Record<string, unknown>;
  return (
    typeof value.title === 'string' &&
    value.title.trim().length > 0 &&
    (value.priority === undefined || ['low', 'medium', 'high'].includes(String(value.priority)))
  );
};

export function createDemoTaskTool(
  framework: string,
  createTask: (task: DemoTask) => void
): DemoWebMcpTool<CreateDemoTaskInput> {
  const normalizedFramework = framework.toLowerCase().replace(/[^a-z0-9]+/g, '_');
  return {
    name: `create_${normalizedFramework}_demo_task`,
    title: `Create a task in the ${framework} demo`,
    description:
      `Create a visible task in the ${framework} Browser AI demo. ` +
      'Use this only when the user explicitly asks to add a task.',
    annotations: { readOnlyHint: false },
    inputSchema: {
      type: 'object',
      properties: {
        title: { type: 'string', minLength: 1, maxLength: 120 },
        priority: { type: 'string', enum: ['low', 'medium', 'high'] }
      },
      required: ['title'],
      additionalProperties: false
    },
    validateInput: isCreateDemoTaskInput,
    execute(input, { signal }) {
      if (signal.aborted) throw signal.reason;
      const task: DemoTask = {
        id: typeof crypto?.randomUUID === 'function' ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`,
        title: input.title.trim().slice(0, 120),
        priority: input.priority ?? 'medium',
        createdBy: 'agent'
      };
      createTask(task);
      return { created: true, task };
    }
  };
}

export function createPersonTask(title: string, priority: DemoTask['priority']): DemoTask {
  return {
    id: typeof crypto?.randomUUID === 'function' ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`,
    title: title.trim().slice(0, 120),
    priority,
    createdBy: 'person'
  };
}

/** Exercise the public adapter, including Chrome-version input compatibility. */
export async function executeDemoTaskTool<Tool extends { name: string }>(
  framework: string,
  client: { refreshTools(): Promise<Tool[]>; executeTool(tool: Tool, input: Record<string, unknown>): Promise<unknown> }
) {
  const tools = await client.refreshTools();
  const name = `create_${framework.toLowerCase()}_demo_task`;
  const tool = tools.find((candidate) => candidate.name === name);
  if (!tool) throw new Error(`Could not discover ${name}.`);
  return client.executeTool(tool, { title: 'Created through WebMCP', priority: 'high' });
}
