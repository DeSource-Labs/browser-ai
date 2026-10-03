<script lang="ts">
  import { isAbortError } from '@desource/browser-ai';
  import { onDestroy } from 'svelte';
  import {
    createSvelteSummarizerWorkflow,
    type SummarizerResult,
    type SummarizerRunOptions,
    type TextToolConfiguration
  } from './workflows.js';
  import { errorMessage } from './error-message.js';
  import TextTool from './TextTool.svelte';
  import MarkdownRenderer from './MarkdownRenderer.svelte';
  export let value = '';
  export let createOptions: Omit<SummarizerCreateOptions, 'monitor' | 'signal'> = {};
  export let runOptions: SummarizerRunOptions = {};
  export let autoInit = true;
  export let disabled = false;
  export let onValueChange: ((value: string) => void) | undefined = undefined;
  export let onResult: ((result: SummarizerResult) => void) | undefined = undefined;
  export let onProgress: SummarizerRunOptions['onProgress'] = undefined;
  export let onError: ((error: unknown) => void) | undefined = undefined;
  const api = createSvelteSummarizerWorkflow();
  let state = api.coreState.getSnapshot();
  let error = '';
  const unsubscribe = api.coreState.subscribe(() => (state = api.coreState.getSnapshot()));
  onDestroy(() => {
    api.dispose();
    unsubscribe();
  });
  const checkAvailability = (options: object) => api.requestAvailability(options as SummarizerCreateCoreOptions);
  const run = async (input: string, configuration: TextToolConfiguration) => {
    try {
      error = '';
      const options = {
        ...configuration.runOptions,
        createOptions: configuration.createOptions,
        onProgress: (progress: Parameters<NonNullable<SummarizerRunOptions['onProgress']>>[0]) => {
          runOptions.onProgress?.(progress);
          onProgress?.(progress);
        }
      } as SummarizerRunOptions;
      const result = await api.summarizeWithDetails(input, options);
      onResult?.(result);
    } catch (caught) {
      if (isAbortError(caught)) return;
      error = errorMessage(caught, 'Browser AI request failed.');
      onError?.(caught);
    }
  };
  $: output = state.output;
</script>

<TextTool
  kind="summarizer"
  title="Summarizer"
  action="Summarize"
  placeholder="Paste an article, notes, or transcript…"
  bind:value
  output={output || 'Summary output will appear here.'}
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
      <pre>{output || 'Summary output will appear here.'}</pre>
    {:else}
      <MarkdownRenderer content={output || 'Summary output will appear here.'} />
    {/if}
  </svelte:fragment>
</TextTool>
