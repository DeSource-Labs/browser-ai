import { type FormEvent, useEffect, useState } from 'react';
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

const sampleMessages: ChatMessage[] = [
  { id: 'message-1', role: 'assistant', content: 'Everything here renders **locally**.', timestamp: Date.now() }
];
const sampleChats: ChatSidebarItem[] = [
  { id: 'demo-chat', title: 'Launch plan', preview: 'Private browser AI', updatedAt: Date.now() }
];
const formAttributes = createWebMcpFormAttributes({
  name: 'create_react_demo_task_form',
  description: 'Create a task in the visible React Browser AI demo task list.'
});
const titleAttributes = createWebMcpFieldAttributes('Short title for the task to create.');
const priorityAttributes = createWebMcpFieldAttributes('Priority for the new task.');

export function App() {
  const [capabilities, setCapabilities] = useState<DemoCapability[]>([]);
  const [texts, setTexts] = useState({
    summarizer: 'Chrome can run compact language models directly in the browser. Data stays on the device.',
    writer: 'Write a two-sentence launch note for a private, on-device writing assistant.',
    rewriter: 'This browser AI library is very easy and useful for developers.',
    translator: 'Private AI can run directly in your browser.',
    detector: 'Bonjour, comment allez-vous aujourd’hui?',
    proofreader: 'This sentence have two mistake.'
  });
  const [primitiveDraft, setPrimitiveDraft] = useState('');
  const [tasks, setTasks] = useState<DemoTask[]>([
    { id: 'seed-task', title: 'Review the multimodal Prompt API demo', priority: 'high', createdBy: 'person' }
  ]);
  const [newTaskTitle, setNewTaskTitle] = useState('');
  const [newTaskPriority, setNewTaskPriority] = useState<DemoTask['priority']>('medium');
  const [taskToolRegistered, setTaskToolRegistered] = useState(false);
  const [webMcpError, setWebMcpError] = useState('');
  const webMcp = useWebMcp();
  const refreshSupport = webMcp.refreshSupport;

  useEffect(() => {
    void inspectDemoCapabilities().then(setCapabilities);
    refreshSupport();
  }, [refreshSupport]);

  const updateText = (name: keyof typeof texts) => (value: string) =>
    setTexts((current) => ({ ...current, [name]: value }));
  const registerTaskTool = async () => {
    if (!webMcp.support.supported || taskToolRegistered) return;
    setWebMcpError('');
    try {
      await webMcp.registerTool(createDemoTaskTool('React', (task) => setTasks((current) => [...current, task])));
      setTaskToolRegistered(true);
    } catch (error) {
      setWebMcpError(error instanceof Error ? error.message : 'WebMCP registration failed.');
    }
  };
  const executeTaskTool = () =>
    executeDemoTaskTool('React', webMcp).catch((error) =>
      setWebMcpError(error instanceof Error ? error.message : 'Tool execution failed.')
    );
  const unregisterTaskTool = () => {
    webMcp.unregisterTool('create_react_demo_task');
    setTaskToolRegistered(false);
  };
  const addPersonTask = (event: FormEvent) => {
    event.preventDefault();
    if (!newTaskTitle.trim()) return;
    setTasks((current) => [...current, createPersonTask(newTaskTitle, newTaskPriority)]);
    setNewTaskTitle('');
  };

  return (
    <main className="demo-shell">
      <header className="demo-hero">
        <p className="demo-kicker" data-testid="framework">
          React
        </p>
        <h1>Chrome AI, without the framework glue.</h1>
        <p>
          The complete React component and hook surface: Prompt API chat, six writing tools, multimodal attachments, and
          WebMCP.
        </p>
      </header>

      <section className="demo-capabilities" data-testid="api-capabilities" aria-label="Browser capabilities">
        {capabilities.map((capability) => (
          <div className="demo-capability" key={capability.name}>
            <span>{capability.name}</span>
            <strong>{capability.availability}</strong>
          </div>
        ))}
      </section>

      <div className="demo-grid">
        <section className="demo-card demo-card--prompt" data-component="PromptApi">
          <header>
            <h2>PromptApi</h2>
            <code>{'<PromptApi />'}</code>
          </header>
          <PromptApi />
        </section>
        <section className="demo-card demo-card--tool" data-component="Summarizer">
          <header>
            <h2>Summarizer</h2>
            <code>{'<Summarizer />'}</code>
          </header>
          <Summarizer value={texts.summarizer} onValueChange={updateText('summarizer')} />
        </section>
        <section className="demo-card demo-card--tool" data-component="Writer">
          <header>
            <h2>Writer</h2>
            <code>{'<Writer />'}</code>
          </header>
          <Writer value={texts.writer} onValueChange={updateText('writer')} />
        </section>
        <section className="demo-card demo-card--tool" data-component="Rewriter">
          <header>
            <h2>Rewriter</h2>
            <code>{'<Rewriter />'}</code>
          </header>
          <Rewriter value={texts.rewriter} onValueChange={updateText('rewriter')} />
        </section>
        <section className="demo-card demo-card--tool" data-component="Translator">
          <header>
            <h2>Translator</h2>
            <code>{'<Translator />'}</code>
          </header>
          <Translator
            sourceLanguage="en"
            targetLanguage="fr"
            value={texts.translator}
            onValueChange={updateText('translator')}
          />
        </section>
        <section className="demo-card demo-card--tool" data-component="LanguageDetector">
          <header>
            <h2>LanguageDetector</h2>
            <code>{'<LanguageDetector />'}</code>
          </header>
          <LanguageDetector value={texts.detector} onValueChange={updateText('detector')} />
        </section>
        <section className="demo-card demo-card--tool" data-component="Proofreader">
          <header>
            <h2>Proofreader</h2>
            <code>{'<Proofreader />'}</code>
          </header>
          <Proofreader value={texts.proofreader} onValueChange={updateText('proofreader')} />
        </section>

        <div className="demo-primitives">
          <section className="demo-card" data-component="ChatHistory">
            <header>
              <h2>ChatHistory</h2>
              <code>{'<ChatHistory />'}</code>
            </header>
            <ChatHistory messages={sampleMessages} />
          </section>
          <section className="demo-card" data-component="ChatSidebar">
            <header>
              <h2>ChatSidebar</h2>
              <code>{'<ChatSidebar />'}</code>
            </header>
            <ChatSidebar chats={sampleChats} activeChatId="demo-chat" />
          </section>
          <section className="demo-card" data-component="PromptInput">
            <header>
              <h2>PromptInput</h2>
              <code>{'<PromptInput />'}</code>
            </header>
            <PromptInput
              value={primitiveDraft}
              allowAttachments
              allowVoice
              onChange={setPrimitiveDraft}
              onSend={() => setPrimitiveDraft('')}
            />
          </section>
          <section className="demo-card" data-component="MarkdownRenderer">
            <header>
              <h2>MarkdownRenderer</h2>
              <code>{'<MarkdownRenderer />'}</code>
            </header>
            <MarkdownRenderer content={'### Safe Markdown\n\nRendered locally with **HTML disabled**.'} />
          </section>
        </div>

        <section className="demo-webmcp" data-testid="webmcp-demo">
          <div>
            <p className="demo-kicker">WebMCP in a real interface</p>
            <h2>Let an agent create a visible task—with validation and user-controlled registration.</h2>
            <p>
              The imperative tool mutates this list. The declarative form exposes the same action to a supporting agent.
            </p>
          </div>
          <p className="demo-webmcp__status" data-testid="webmcp-support">
            {webMcp.support.reason}
          </p>
          <div className="demo-webmcp__actions">
            <button
              type="button"
              disabled={!webMcp.support.supported}
              data-testid="register-webmcp"
              onClick={() => void registerTaskTool()}
            >
              {taskToolRegistered ? 'Tool registered' : 'Register task tool'}
            </button>
            <button
              type="button"
              disabled={!taskToolRegistered}
              data-testid="execute-webmcp"
              onClick={() => void executeTaskTool()}
            >
              Run task tool
            </button>
            <button type="button" disabled={!taskToolRegistered} onClick={unregisterTaskTool}>
              Unregister
            </button>
          </div>
          <form className="demo-task-form" {...formAttributes} data-testid="webmcp-form" onSubmit={addPersonTask}>
            <input
              {...titleAttributes}
              name="title"
              required
              maxLength={120}
              placeholder="Ship the framework adapters"
              value={newTaskTitle}
              onChange={(event) => setNewTaskTitle(event.currentTarget.value)}
            />
            <select
              {...priorityAttributes}
              name="priority"
              value={newTaskPriority}
              onChange={(event) => setNewTaskPriority(event.currentTarget.value as DemoTask['priority'])}
            >
              <option value="low">Low</option>
              <option value="medium">Medium</option>
              <option value="high">High</option>
            </select>
            <button type="submit">Add task</button>
          </form>
          <ul className="demo-task-list" data-testid="task-list">
            {tasks.map((task) => (
              <li key={task.id}>
                <span>{task.title}</span>
                <span>
                  {task.priority} · {task.createdBy}
                </span>
              </li>
            ))}
          </ul>
          {webMcpError && (
            <p className="demo-error" role="alert">
              {webMcpError}
            </p>
          )}
        </section>
      </div>
    </main>
  );
}
