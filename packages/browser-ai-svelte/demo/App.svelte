<script lang="ts">
  import { onDestroy, onMount } from 'svelte';
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
    createWebMcp,
    createWebMcpFieldAttributes,
    createWebMcpFormAttributes,
    type ChatMessage,
    type ChatSidebarItem
  } from '../src/lib';
  import {
    createDemoTaskTool,
    executeDemoTaskTool,
    createPersonTask,
    inspectDemoCapabilities,
    type DemoCapability,
    type DemoTask
  } from '../../../common/demo/capabilities';

  let capabilities: DemoCapability[] = [];
  let summarizerText = 'Chrome can run compact language models directly in the browser. Data stays on the device.';
  let writerText = 'Write a two-sentence launch note for a private, on-device writing assistant.';
  let rewriterText = 'This browser AI library is very easy and useful for developers.';
  let translatorText = 'Private AI can run directly in your browser.';
  let detectorText = 'Bonjour, comment allez-vous aujourd’hui?';
  let proofreaderText = 'This sentence have two mistake.';
  let primitiveDraft = '';
  const sampleMessages: ChatMessage[] = [
    { id: 'message-1', role: 'assistant', content: 'Everything here renders **locally**.', timestamp: Date.now() }
  ];
  const sampleChats: ChatSidebarItem[] = [
    { id: 'demo-chat', title: 'Launch plan', preview: 'Private browser AI', updatedAt: Date.now() }
  ];

  const webMcp = createWebMcp();
  let webState = webMcp.coreState.getSnapshot();
  const unsubscribe = webMcp.coreState.subscribe(() => (webState = webMcp.coreState.getSnapshot()));
  let tasks: DemoTask[] = [
    { id: 'seed-task', title: 'Review the multimodal Prompt API demo', priority: 'high', createdBy: 'person' }
  ];
  let newTaskTitle = '';
  let newTaskPriority: DemoTask['priority'] = 'medium';
  let taskToolRegistered = false;
  let webMcpError = '';
  const formAttributes = createWebMcpFormAttributes({
    name: 'create_svelte_demo_task_form',
    description: 'Create a task in the visible Svelte Browser AI demo task list.'
  });
  const titleAttributes = createWebMcpFieldAttributes('Short title for the task to create.');
  const priorityAttributes = createWebMcpFieldAttributes('Priority for the new task.');

  const registerTaskTool = async () => {
    if (!webState.support.supported || taskToolRegistered) return;
    webMcpError = '';
    try {
      await webMcp.registerTool(createDemoTaskTool('Svelte', (task) => (tasks = [...tasks, task])));
      taskToolRegistered = true;
    } catch (error) {
      webMcpError = error instanceof Error ? error.message : 'WebMCP registration failed.';
    }
  };
  const executeTaskTool = () =>
    executeDemoTaskTool('Svelte', webMcp).catch((error) => {
      webMcpError = error instanceof Error ? error.message : 'Tool execution failed.';
    });
  const unregisterTaskTool = () => {
    webMcp.unregisterTool('create_svelte_demo_task');
    taskToolRegistered = false;
  };
  const addPersonTask = () => {
    if (!newTaskTitle.trim()) return;
    tasks = [...tasks, createPersonTask(newTaskTitle, newTaskPriority)];
    newTaskTitle = '';
  };

  onMount(async () => {
    capabilities = await inspectDemoCapabilities();
    webMcp.refreshSupport();
  });
  onDestroy(() => {
    unsubscribe();
    webMcp.dispose();
  });
</script>

<main class="demo-shell">
  <header class="demo-hero">
    <p class="demo-kicker" data-testid="framework">Svelte</p>
    <h1>Chrome AI, without the framework glue.</h1>
    <p>
      The complete Svelte component and controller surface: Prompt API chat, six writing tools, multimodal attachments,
      and WebMCP.
    </p>
  </header>

  <section class="demo-capabilities" data-testid="api-capabilities" aria-label="Browser capabilities">
    {#each capabilities as capability (capability.name)}
      <div class="demo-capability"><span>{capability.name}</span><strong>{capability.availability}</strong></div>
    {/each}
  </section>

  <div class="demo-grid">
    <section class="demo-card demo-card--prompt" data-component="PromptApi">
      <header>
        <h2>PromptApi</h2>
        <code>&lt;PromptApi /&gt;</code>
      </header>
      <PromptApi />
    </section>
    <section class="demo-card demo-card--tool" data-component="Summarizer">
      <header>
        <h2>Summarizer</h2>
        <code>&lt;Summarizer /&gt;</code>
      </header>
      <Summarizer bind:value={summarizerText} />
    </section>
    <section class="demo-card demo-card--tool" data-component="Writer">
      <header>
        <h2>Writer</h2>
        <code>&lt;Writer /&gt;</code>
      </header>
      <Writer bind:value={writerText} />
    </section>
    <section class="demo-card demo-card--tool" data-component="Rewriter">
      <header>
        <h2>Rewriter</h2>
        <code>&lt;Rewriter /&gt;</code>
      </header>
      <Rewriter bind:value={rewriterText} />
    </section>
    <section class="demo-card demo-card--tool" data-component="Translator">
      <header>
        <h2>Translator</h2>
        <code>&lt;Translator /&gt;</code>
      </header>
      <Translator bind:value={translatorText} sourceLanguage="en" targetLanguage="fr" />
    </section>
    <section class="demo-card demo-card--tool" data-component="LanguageDetector">
      <header>
        <h2>LanguageDetector</h2>
        <code>&lt;LanguageDetector /&gt;</code>
      </header>
      <LanguageDetector bind:value={detectorText} />
    </section>
    <section class="demo-card demo-card--tool" data-component="Proofreader">
      <header>
        <h2>Proofreader</h2>
        <code>&lt;Proofreader /&gt;</code>
      </header>
      <Proofreader bind:value={proofreaderText} />
    </section>

    <div class="demo-primitives">
      <section class="demo-card" data-component="ChatHistory">
        <header>
          <h2>ChatHistory</h2>
          <code>&lt;ChatHistory /&gt;</code>
        </header>
        <ChatHistory messages={sampleMessages} />
      </section>
      <section class="demo-card" data-component="ChatSidebar">
        <header>
          <h2>ChatSidebar</h2>
          <code>&lt;ChatSidebar /&gt;</code>
        </header>
        <ChatSidebar chats={sampleChats} activeChatId="demo-chat" />
      </section>
      <section class="demo-card" data-component="PromptInput">
        <header>
          <h2>PromptInput</h2>
          <code>&lt;PromptInput /&gt;</code>
        </header>
        <PromptInput bind:value={primitiveDraft} allowAttachments allowVoice onSend={() => (primitiveDraft = '')} />
      </section>
      <section class="demo-card" data-component="MarkdownRenderer">
        <header>
          <h2>MarkdownRenderer</h2>
          <code>&lt;MarkdownRenderer /&gt;</code>
        </header>
        <MarkdownRenderer content="### Safe Markdown&#10;&#10;Rendered locally with **HTML disabled**." />
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
      <p class="demo-webmcp__status" data-testid="webmcp-support">{webState.support.reason}</p>
      <div class="demo-webmcp__actions">
        <button
          type="button"
          disabled={!webState.support.supported}
          data-testid="register-webmcp"
          on:click={registerTaskTool}>{taskToolRegistered ? 'Tool registered' : 'Register task tool'}</button
        >
        <button type="button" disabled={!taskToolRegistered} on:click={unregisterTaskTool}>Unregister</button>
        <button type="button" disabled={!taskToolRegistered} data-testid="execute-webmcp" on:click={executeTaskTool}
          >Run task tool</button
        >
      </div>
      <form
        class="demo-task-form"
        {...formAttributes}
        data-testid="webmcp-form"
        on:submit|preventDefault={addPersonTask}
      >
        <input
          {...titleAttributes}
          bind:value={newTaskTitle}
          name="title"
          required
          maxlength="120"
          placeholder="Ship the framework adapters"
        />
        <select {...priorityAttributes} bind:value={newTaskPriority} name="priority"
          ><option value="low">Low</option><option value="medium">Medium</option><option value="high">High</option
          ></select
        >
        <button type="submit">Add task</button>
      </form>
      <ul class="demo-task-list" data-testid="task-list">
        {#each tasks as task (task.id)}<li>
            <span>{task.title}</span><span>{task.priority} · {task.createdBy}</span>
          </li>{/each}
      </ul>
      {#if webMcpError}<p class="demo-error" role="alert">{webMcpError}</p>{/if}
    </section>
  </div>
</main>
