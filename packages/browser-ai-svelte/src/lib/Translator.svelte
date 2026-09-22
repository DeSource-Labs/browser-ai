<script lang="ts">
  import { isAbortError } from '@desource/browser-ai';
  import { onDestroy } from 'svelte';
  import {
    createSvelteTranslatorWorkflow,
    type TranslatorResult,
    type TranslatorRunOptions,
    type TextToolConfiguration
  } from './workflows.js';
  import { errorMessage } from './error-message.js';
  import TextTool from './TextTool.svelte';
  export let value = '';
  export let createOptions: Partial<Omit<TranslatorCreateOptions, 'monitor' | 'signal'>> = {};
  export let runOptions: TranslatorRunOptions = {};
  export let autoInit = true;
  export let autoTranslate = true;
  export let debounceMs = 650;
  export let disabled = false;
  export let sourceLanguage = 'en';
  export let targetLanguage = 'es';
  export let onValueChange: ((value: string) => void) | undefined = undefined;
  export let onResult: ((result: TranslatorResult) => void) | undefined = undefined;
  export let onProgress: TranslatorRunOptions['onProgress'] = undefined;
  export let onError: ((error: unknown) => void) | undefined = undefined;
  const api = createSvelteTranslatorWorkflow({ sourceLanguage, targetLanguage, ...createOptions });
  let state = api.coreState.getSnapshot();
  let error = '';
  const unsubscribe = api.coreState.subscribe(() => (state = api.coreState.getSnapshot()));
  onDestroy(() => {
    api.dispose();
    unsubscribe();
  });
  const checkAvailability = (options: object) => api.requestAvailability(options as TranslatorCreateCoreOptions);
  const run = async (input: string, configuration: TextToolConfiguration) => {
    try {
      error = '';
      const options = {
        ...configuration.runOptions,
        createOptions: configuration.createOptions,
        onProgress: (progress: Parameters<NonNullable<TranslatorRunOptions['onProgress']>>[0]) => {
          runOptions.onProgress?.(progress);
          onProgress?.(progress);
        }
      } as TranslatorRunOptions;
      await api.translateStreamingToText(input, options);
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
  kind="translator"
  autoRun={autoTranslate}
  autoRunDelay={debounceMs}
  onPrepare={(configuration) => api.create(configuration.createOptions as unknown as TranslatorCreateCoreOptions)}
  title="Translator"
  action="Translate"
  placeholder="Paste text to translate locally…"
  bind:value
  output={output || 'Translation will appear here.'}
  outputText={output}
  availability={state.availability}
  processing={state.processing}
  downloadProgress={state.downloadProgress}
  inputUsage={state.inputUsage}
  inputQuota={state.inputQuota}
  progressState={state.progressState}
  createOptions={{ sourceLanguage, targetLanguage, ...createOptions }}
  {runOptions}
  onCheckAvailability={autoInit ? checkAvailability : undefined}
  onInterrupt={api.interrupt}
  renderMarkdown={false}
  {error}
  {disabled}
  {onValueChange}
  onRun={run}
/>
