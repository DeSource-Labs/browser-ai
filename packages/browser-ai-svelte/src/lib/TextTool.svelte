<script lang="ts">
  import { onDestroy, onMount } from 'svelte';
  import { readTextSource, TEXT_FILE_ACCEPT } from '@desource/browser-ai';
  import {
    createAutoRun,
    getTextToolSettings,
    parseToolSetting,
    resolveTextToolOptions,
    type NormalizedProofreadCorrection,
    type TextToolConfiguration,
    type TextToolKind,
    type ToolSetting
  } from '@desource/browser-ai/workflows';
  import { errorMessage } from './error-message.js';

  export let title: string;
  export let action: string;
  export let placeholder: string;
  export let kind: TextToolKind | undefined = undefined;
  export let value = '';
  export let output = '';
  export let outputText: string | undefined = undefined;
  export let renderMarkdown = true;
  export let corrections: readonly NormalizedProofreadCorrection[] = [];
  export let availability: Availability | null = null;
  export let processing = '';
  export let downloadProgress = 0;
  export let inputUsage: number | null | undefined = undefined;
  export let inputQuota: number | null | undefined = undefined;
  export let progressState: { phase: string; processedChunks?: number; totalChunks?: number } | undefined = undefined;
  export let createOptions: object = {};
  export let runOptions: object = {};
  export let error = '';
  export let disabled = false;
  export let onValueChange: ((value: string) => void) | undefined = undefined;
  export let onRun: (value: string, configuration: TextToolConfiguration) => Promise<void> = async () => undefined;
  export let onCheckAvailability: ((options: object) => Promise<Availability>) | undefined = undefined;
  export let onInterrupt: (() => void) | undefined = undefined;

  export let autoRun = false;
  export let autoRunDelay = 650;
  export let onPrepare: ((configuration: TextToolConfiguration) => Promise<unknown>) | undefined = undefined;
  let autoEnabled = autoRun;
  $: autoEnabled = autoRun;
  const runner = createAutoRun(
    (input, options) => {
      localError = '';
      return onRun(input, options);
    },
    (caught) => {
      localError = errorMessage(caught, 'Could not complete the request.');
    }
  );
  let mounted = false;
  let fileRequest = 0;
  let availabilityRequest = 0;
  let runRequest = 0;
  let copyRequest = 0;
  let localError = '';
  let availabilityError = '';
  let copied = false;
  let previousOutput = '';
  let submitting = false;
  let selection: TextToolConfiguration & { key: string } = { key: '', createOptions: {}, runOptions: {} };

  $: busy = Boolean(processing) || submitting;
  $: if (disabled || busy) invalidateFiles();
  $: optionKey = JSON.stringify([kind, createOptions, runOptions]);
  $: if (selection.key !== optionKey) selection = { key: optionKey, createOptions: {}, runOptions: {} };
  $: baseline = kind
    ? resolveTextToolOptions(kind, createOptions, runOptions)
    : { createOptions: { ...createOptions }, runOptions: { ...runOptions } };
  $: configuration = {
    createOptions: { ...baseline.createOptions, ...selection.createOptions },
    runOptions: { ...baseline.runOptions, ...selection.runOptions }
  } satisfies TextToolConfiguration;
  $: if (mounted)
    runner.update({
      input: value,
      configuration,
      enabled: kind === 'translator' && autoEnabled,
      available: availability,
      busy,
      disabled,
      delayMs: autoRunDelay
    });
  $: fields = kind ? getTextToolSettings(kind) : [];
  $: availabilityKey = JSON.stringify(configuration.createOptions);
  $: if (mounted) checkAvailability(onCheckAvailability, availabilityKey);
  $: copyText = outputText ?? output;
  $: if (copyText !== previousOutput) {
    previousOutput = copyText;
    copied = false;
    copyRequest += 1;
  }

  onMount(() => {
    mounted = true;
  });
  onDestroy(() => {
    mounted = false;
    runner.dispose();
    fileRequest += 1;
    availabilityRequest += 1;
    runRequest += 1;
    copyRequest += 1;
  });

  async function checkAvailability(check: typeof onCheckAvailability, key: string) {
    const request = ++availabilityRequest;
    availabilityError = '';
    if (!check) return;
    try {
      await check(JSON.parse(key));
    } catch (caught) {
      if (mounted && request === availabilityRequest && check === onCheckAvailability && key === availabilityKey) {
        availabilityError = errorMessage(caught, 'Could not check availability.');
      }
    }
  }

  function invalidateFiles() {
    fileRequest += 1;
  }

  function settingValue(field: ToolSetting, options: TextToolConfiguration) {
    const values = field.target === 'create' ? options.createOptions : options.runOptions;
    return values[field.key] ?? field.defaultValue;
  }

  function changeSetting(field: ToolSetting, raw: string | boolean) {
    if (disabled || busy) return;
    const group = field.target === 'create' ? 'createOptions' : 'runOptions';
    selection = { ...selection, [group]: { ...selection[group], [field.key]: parseToolSetting(field, raw) } };
  }

  const filesChanged = async (event: Event) => {
    const target = event.currentTarget as HTMLInputElement;
    const request = ++fileRequest;
    try {
      if (disabled || busy) return;
      const blocks = await Promise.all(Array.from(target.files ?? []).map((file) => readTextSource(file)));
      if (!mounted || request !== fileRequest || disabled || busy) return;
      value = [value, ...blocks].filter(Boolean).join('\n\n');
      onValueChange?.(value);
      localError = '';
    } catch (caught) {
      if (mounted && request === fileRequest && !disabled && !busy)
        localError = errorMessage(caught, 'Could not read file.');
    } finally {
      target.value = '';
    }
  };

  const interrupt = () => {
    runner.stop();
    runRequest += 1;
    submitting = false;
    onInterrupt?.();
  };

  const submit = async () => {
    const input = value.trim();
    if (!input || busy || disabled) return;
    const request = ++runRequest;
    submitting = true;
    localError = '';
    try {
      await runner.runNow(input, configuration);
    } catch (caught) {
      if (mounted && request === runRequest) localError = errorMessage(caught, 'Could not complete the request.');
    } finally {
      if (mounted && request === runRequest) submitting = false;
    }
  };

  const swap = () => {
    runner.stop();
    selection = {
      key: optionKey,
      createOptions: {
        ...configuration.createOptions,
        sourceLanguage: configuration.createOptions.targetLanguage,
        targetLanguage: configuration.createOptions.sourceLanguage
      },
      runOptions: configuration.runOptions
    };
  };
  const prepare = async () => {
    try {
      localError = '';
      await onPrepare?.(configuration);
    } catch (caught) {
      localError = errorMessage(caught, 'Could not prepare the language pair.');
    }
  };

  const copy = async () => {
    if (disabled || busy || !copyText) return;
    const request = ++copyRequest;
    const text = copyText;
    try {
      await navigator.clipboard.writeText(text);
      if (mounted && request === copyRequest && copyText === text) copied = true;
    } catch (caught) {
      if (mounted && request === copyRequest && copyText === text)
        localError = errorMessage(caught, 'Could not copy the result.');
    }
  };
</script>

<form class="writing-tool" on:submit|preventDefault={submit}>
  <div class="writing-tool__toolbar">
    <div class="writing-tool__toolbar-main">
      <strong>{title}</strong><span class="writing-tool__status">{availability ?? 'checking'}</span>
    </div>
  </div>
  <div class="writing-tool__workspace">
    <section class="writing-tool__pane writing-tool__editor">
      <textarea bind:value {placeholder} disabled={disabled || busy} on:input={() => onValueChange?.(value)}></textarea>
      <label class="writing-tool__ghost-button">
        Add text files<input
          hidden
          type="file"
          multiple
          accept={TEXT_FILE_ACCEPT}
          disabled={disabled || busy}
          on:change={filesChanged}
        />
      </label>
      {#if kind === 'translator'}<div class="writing-tool__language-actions">
          <label><input type="checkbox" bind:checked={autoEnabled} disabled={disabled || busy} />Auto translate</label>
          <button type="button" disabled={disabled || busy} on:click={swap}>Swap languages</button>
          {#if onPrepare && availability === 'downloadable'}<button
              type="button"
              disabled={disabled || busy}
              on:click={prepare}>Download pack</button
            >{/if}
        </div>{/if}
      {#if fields.length}
        <details class="writing-tool__settings">
          <summary>Settings</summary>
          <div class="writing-tool__settings-grid">
            {#each fields as field (`${field.target}.${field.key}`)}
              {@const selected = settingValue(field, configuration)}
              <label>
                {field.label}
                {#if field.type === 'select'}
                  <select
                    disabled={disabled || busy}
                    value={String(selected)}
                    on:change={(event) => changeSetting(field, event.currentTarget.value)}
                  >
                    {#each field.options ?? [] as option (option.value)}<option value={option.value}
                        >{option.label}</option
                      >{/each}
                  </select>
                {:else if field.type === 'checkbox'}
                  <input
                    type="checkbox"
                    disabled={disabled || busy}
                    checked={Boolean(selected)}
                    on:change={(event) => changeSetting(field, event.currentTarget.checked)}
                  />
                {:else if field.type === 'textarea'}
                  <textarea
                    disabled={disabled || busy}
                    value={String(selected)}
                    on:input={(event) => changeSetting(field, event.currentTarget.value)}></textarea>
                {:else}
                  <input
                    type={field.type === 'number' ? 'number' : 'text'}
                    disabled={disabled || busy}
                    min={field.min}
                    max={field.max}
                    step={field.step}
                    value={Array.isArray(selected) ? selected.join(', ') : String(selected)}
                    on:input={(event) => changeSetting(field, event.currentTarget.value)}
                  />
                {/if}
              </label>
            {/each}
          </div>
        </details>
      {/if}
    </section>
    <section class="writing-tool__pane writing-tool__pane--output">
      <div class="writing-tool__output">
        <slot name="output" {configuration} {renderMarkdown}><pre>{output}</pre></slot>
      </div>
      {#if corrections.length}
        <ul class="proofreader-tool__corrections" aria-label="Corrections">
          {#each corrections as correction, index (index)}
            <li>
              <del>{correction.original}</del> <ins>{correction.correction}</ins>
              {#if correction.types.length}<span> {correction.types.join(', ')}</span>{/if}
              {#if correction.explanation}<p>{correction.explanation}</p>{/if}
            </li>
          {/each}
        </ul>
      {/if}
      {#if copyText}<button type="button" disabled={disabled || busy} on:click={copy}
          >{copied ? 'Copied' : 'Copy output'}</button
        >{/if}
    </section>
  </div>
  {#if error || localError || availabilityError}<p class="writing-tool__error" role="alert">
      {error || localError || availabilityError}
    </p>{/if}
  <footer class="writing-tool__footer">
    <span>{inputUsage ?? '—'} / {inputQuota ?? '—'} tokens</span>
    {#if busy}
      <span role="status">
        {progressState?.phase ?? processing}
        {#if downloadProgress > 0 && downloadProgress < 100}
          {Math.round(downloadProgress)}%{/if}
        {#if progressState?.totalChunks}
          {progressState.processedChunks ?? 0}/{progressState.totalChunks}{/if}
      </span>
      {#if onInterrupt}<button type="button" {disabled} on:click={interrupt}>Stop</button>{/if}
    {/if}
    <button type="submit" data-browser-ai-action="run" disabled={disabled || busy || !value.trim()}>
      {busy ? 'Working…' : availability === 'downloadable' ? `Download & ${action.toLowerCase()}` : action}
    </button>
  </footer>
</form>
