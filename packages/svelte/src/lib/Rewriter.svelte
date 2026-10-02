<script lang="ts">
  import { isAbortError } from '@desource/browser-ai';
  import { onDestroy } from 'svelte';
  import {
    createSvelteRewriterWorkflow,
    type RewriterResult,
    type RewriterRunOptions,
    type TextToolConfiguration
  } from './workflows.js';
  import { errorMessage } from './error-message.js';
  import TextTool from './TextTool.svelte';
  import MarkdownRenderer from './MarkdownRenderer.svelte';
  export let value = '';
  export let createOptions: Omit<RewriterCreateOptions, 'monitor' | 'signal'> = {};
  export let runOptions: RewriterRunOptions = {};
  export let autoInit = true;
  export let disabled = false;
  export let onValueChange: ((value: string) => void) | undefined = undefined;
  export let onResult: ((result: RewriterResult) => void) | undefined = undefined;
  export let onProgress: RewriterRunOptions['onProgress'] = undefined;
  export let onError: ((error: unknown) => void) | undefined = undefined;
  const api = createSvelteRewriterWorkflow();
  let state = api.coreState.getSnapshot();
  let error = '';
  const unsubscribe = api.coreState.subscribe(() => (state = api.coreState.getSnapshot()));
  onDestroy(() => {
    api.dispose();
    unsubscribe();
  });
  const checkAvailability = (options: object) => api.requestAvailability(options as RewriterCreateCoreOptions);
  const run = async (input: string, configuration: TextToolConfiguration) => {
    try {
      error = '';
      const options = {
        ...configuration.runOptions,
        createOptions: configuration.createOptions,
        onProgress: (progress: Parameters<NonNullable<RewriterRunOptions['onProgress']>>[0]) => {
          runOptions.onProgress?.(progress);
          onProgress?.(progress);
        }
      } as RewriterRunOptions;
      await api.rewriteStreamingToText(input, options);
      const result = api.coreState.getSnapshot().lastResult;
      if (result) onResult?.(result);
    } catch (caught) {
      if (isAbortError(caught)) return;
      error = errorMessage(caught, 'Browser AI request failed.');
      onError?.(caught);
    }
  };
  $: output = state.output;
</script>

<TextTool
  kind="rewriter"
  title="Rewriter"
  action="Rewrite"
  placeholder="Paste text to rewrite…"
  bind:value
  output={output || 'Rewritten text will appear here.'}
  outputText={output}
  availability={state.availability}
  processing={state.processing}
  downloadProgress={state.downloadProgress}
  inputUsage={state.inputUsage}
  inputQuota={state.inputQuota}
  progressState={state.progressState}
  {createOptions}
  {runOptions}
  onCheckAvailability={autoInit ? checkAvailability : undefined}
  onInterrupt={api.interrupt}
  renderMarkdown={true}
  {error}
  {disabled}
  {onValueChange}
  onRun={run}
>
  <svelte:fragment slot="output" let:configuration>
    {#if configuration.createOptions.format === 'plain-text'}
      <pre>{output || 'Rewritten text will appear here.'}</pre>
    {:else}
      <MarkdownRenderer content={output || 'Rewritten text will appear here.'} />
    {/if}
  </svelte:fragment>
</TextTool>
