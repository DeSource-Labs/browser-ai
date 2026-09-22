<script lang="ts">
  import { isAbortError } from '@desource/browser-ai';
  import { onDestroy } from 'svelte';
  import {
    createSvelteLanguageDetectorWorkflow,
    type LanguageDetectorResult,
    type LanguageDetectorRunOptions,
    type TextToolConfiguration
  } from './workflows.js';
  import { errorMessage } from './error-message.js';
  import TextTool from './TextTool.svelte';
  export let value = '';
  export let createOptions: Omit<LanguageDetectorCreateOptions, 'monitor' | 'signal'> = {};
  export let runOptions: LanguageDetectorRunOptions = {};
  export let autoInit = true;
  export let disabled = false;
  export let onValueChange: ((value: string) => void) | undefined = undefined;
  export let onResult: ((result: LanguageDetectorResult) => void) | undefined = undefined;
  export let onProgress: LanguageDetectorRunOptions['onProgress'] = undefined;
  export let onError: ((error: unknown) => void) | undefined = undefined;
  const api = createSvelteLanguageDetectorWorkflow();
  let state = api.coreState.getSnapshot();
  let error = '';
  const unsubscribe = api.coreState.subscribe(() => (state = api.coreState.getSnapshot()));
  onDestroy(() => {
    api.dispose();
    unsubscribe();
  });
  const checkAvailability = (options: object) => api.requestAvailability(options as LanguageDetectorCreateCoreOptions);
  const run = async (input: string, configuration: TextToolConfiguration) => {
    try {
      error = '';
      const options = {
        ...configuration.runOptions,
        createOptions: configuration.createOptions,
        onProgress: (progress: Parameters<NonNullable<LanguageDetectorRunOptions['onProgress']>>[0]) => {
          runOptions.onProgress?.(progress);
          onProgress?.(progress);
        }
      } as LanguageDetectorRunOptions;
      const result = await api.detectWithDetails(input, options);
      onResult?.(result);
    } catch (caught) {
      if (isAbortError(caught)) return;
      error = errorMessage(caught, 'Browser AI request failed.');
      onError?.(caught);
    }
  };
  $: output = state.results
    .map((item) => `${item.name} (${item.detectedLanguage}): ${Math.round(item.confidence * 100)}%`)
    .join('\n');
</script>

<TextTool
  kind="language-detector"
  title="Language detector"
  action="Detect"
  placeholder="Paste text to identify its language…"
  bind:value
  output={output || 'Language results will appear here.'}
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
  {error}
  {disabled}
  {onValueChange}
  onRun={run}
/>
