<script lang="ts">
  import { isAbortError } from '@desource/browser-ai';
  import { onDestroy } from 'svelte';
  import {
    createSvelteProofreaderWorkflow,
    type ProofreaderResult,
    type ProofreaderRunOptions,
    type TextToolConfiguration
  } from './workflows.js';
  import { errorMessage } from './error-message.js';
  import TextTool from './TextTool.svelte';
  export let value = '';
  export let createOptions: Omit<ProofreaderCreateOptions, 'monitor' | 'signal'> = {};
  export let runOptions: ProofreaderRunOptions = {};
  export let autoInit = true;
  export let disabled = false;
  export let onValueChange: ((value: string) => void) | undefined = undefined;
  export let onResult: ((result: ProofreaderResult) => void) | undefined = undefined;
  export let onProgress: ProofreaderRunOptions['onProgress'] = undefined;
  export let onError: ((error: unknown) => void) | undefined = undefined;
  const api = createSvelteProofreaderWorkflow();
  let state = api.coreState.getSnapshot();
  let error = '';
  const unsubscribe = api.coreState.subscribe(() => (state = api.coreState.getSnapshot()));
  onDestroy(() => {
    api.dispose();
    unsubscribe();
  });
  const checkAvailability = (options: object) => api.requestAvailability(options as ProofreaderCreateCoreOptions);
  const run = async (input: string, configuration: TextToolConfiguration) => {
    try {
      error = '';
      const options = {
        ...configuration.runOptions,
        createOptions: configuration.createOptions,
        onProgress: (progress: Parameters<NonNullable<ProofreaderRunOptions['onProgress']>>[0]) => {
          runOptions.onProgress?.(progress);
          onProgress?.(progress);
        }
      } as ProofreaderRunOptions;
      const result = await api.proofreadWithDetails(input, options);
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
  kind="proofreader"
  title="Proofreader"
  action="Proofread"
  placeholder="Paste text to check grammar and spelling…"
  bind:value
  output={output || 'Corrected output will appear here.'}
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
  renderMarkdown={false}
  corrections={state.corrections}
  {error}
  {disabled}
  {onValueChange}
  onRun={run}
/>
