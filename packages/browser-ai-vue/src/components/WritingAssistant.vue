<template>
  <TextTool
    v-model="sourceText"
    :output="output"
    :input-label="inputLabel"
    :output-label="outputLabel"
    :action-label="actionLabel"
    :busy-action-label="busyActionLabel"
    :placeholder="placeholder"
    :empty-output-message="emptyOutputMessage"
    :settings-summary="settingsSummary"
    :input-meta="inputMeta"
    :output-meta="outputMeta"
    :availability="availability"
    :download-progress="downloadProgress"
    :busy="api.isProcessing.value"
    :disabled="disabled"
    :can-run="canRun"
    :progress-percent="progressPercent"
    :error-message="errorMessage"
    :render-markdown="renderMarkdown && selectedFormat === 'markdown'"
    copyable
    @interrupt="api.interrupt()"
    @run="run"
    @copy="copyText(output)"
  >
    <template #settings>
      <div class="writing-tool__settings-grid">
        <label
          >Tone<select v-model="selectedTone" :disabled="isBusy">
            <option v-for="option in toneOptions" :key="option.value" :value="option.value">{{ option.label }}</option>
          </select></label
        >
        <label
          >Length<select v-model="selectedLength" :disabled="isBusy">
            <option v-for="option in lengthOptions" :key="option.value" :value="option.value">
              {{ option.label }}
            </option>
          </select></label
        >
        <label
          >Format<select v-model="selectedFormat" :disabled="isBusy">
            <option v-for="option in formatOptions" :key="option.value" :value="option.value">
              {{ option.label }}
            </option>
          </select></label
        >
        <label
          >Context fit<select v-model="selectedFitStrategy" :disabled="isBusy">
            <option value="truncate-context">Fit context</option>
            <option value="error">Require full context</option>
          </select></label
        >
      </div>
      <div class="writing-tool__toggles">
        <label class="writing-tool__toggle"
          ><input v-model="stripHtmlInput" type="checkbox" :disabled="isBusy" />Strip HTML</label
        >
        <label class="writing-tool__toggle"
          ><input v-model="showContext" type="checkbox" :disabled="isBusy" />{{ contextToggleLabel }}</label
        >
        <label class="writing-tool__toggle"
          ><input v-model="streamOutput" type="checkbox" :disabled="isBusy" />Stream output</label
        >
      </div>
    </template>

    <template v-if="showContext" #input-after>
      <label class="writing-tool__context">
        <span>{{ contextToggleLabel }}</span>
        <textarea
          v-model="assistantContext"
          :disabled="disabled || isBusy"
          :placeholder="contextPlaceholder"
          rows="3"
        ></textarea>
      </label>
    </template>

    <template #meta>
      <span v-if="progressLabel">{{ progressLabel }}</span>
      <span v-if="lastResult?.fitted">Context fitted</span>
    </template>
  </TextTool>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import {
  useRewriter,
  type RewriterCreate,
  type RewriterFitStrategy,
  type RewriterProgressState,
  type RewriterResult
} from '../composables/useRewriter';
import { useSyncedString } from '../composables/useSyncedString';
import { useToolLifecycle } from '../composables/useToolLifecycle';
import {
  useWriter,
  type WriterCreate,
  type WriterFitStrategy,
  type WriterProgressState,
  type WriterResult
} from '../composables/useWriter';
import { copyText, formatTokenCount } from '../utils/display';
import TextTool from './TextTool.vue';

type Kind = 'writer' | 'rewriter';
type CreateOptions = WriterCreate | RewriterCreate;
type FitStrategy = WriterFitStrategy | RewriterFitStrategy;
type ProgressState = WriterProgressState | RewriterProgressState;
type Result = WriterResult | RewriterResult;
type SelectOption = { value: string; label: string };

interface Props {
  kind: Kind;
  modelValue: string;
  placeholder: string;
  contextPlaceholder: string;
  emptyOutputMessage: string;
  tone: WriterTone | RewriterTone;
  format: WriterFormat | RewriterFormat;
  length: WriterLength | RewriterLength;
  sharedContext: string;
  context: string;
  outputLanguage: string;
  expectedInputLanguages?: string[];
  expectedContextLanguages?: string[];
  autoInit: boolean;
  autoCreate: boolean;
  stripHtml: boolean;
  fitStrategy: FitStrategy;
  stream: boolean;
  renderMarkdown: boolean;
  disabled: boolean;
}

const props = defineProps<Props>();
const emit = defineEmits<{
  'update:modelValue': [value: string];
  'availability-change': [availability: Availability];
  progress: [state: ProgressState];
  result: [result: Result];
  error: [error: unknown];
}>();

const isWriter = props.kind === 'writer';
const api = isWriter ? useWriter() : useRewriter();
const sourceText = useSyncedString(
  () => props.modelValue,
  (value) => emit('update:modelValue', value)
);
const output = ref('');
const errorMessage = ref('');
const assistantContext = ref(props.context);
const showContext = ref(Boolean(props.context));
const stripHtmlInput = ref(props.stripHtml);
const streamOutput = ref(props.stream);
const selectedTone = ref(props.tone);
const selectedFormat = ref(props.format);
const selectedLength = ref(props.length);
const selectedFitStrategy = ref(props.fitStrategy);

const writerOptions = {
  tone: [
    { value: 'neutral', label: 'Neutral' },
    { value: 'formal', label: 'Formal' },
    { value: 'casual', label: 'Casual' }
  ],
  length: [
    { value: 'short', label: 'Short' },
    { value: 'medium', label: 'Medium' },
    { value: 'long', label: 'Long' }
  ],
  format: [
    { value: 'markdown', label: 'Markdown' },
    { value: 'plain-text', label: 'Plain text' }
  ]
} satisfies Record<string, SelectOption[]>;
const rewriterOptions = {
  tone: [
    { value: 'as-is', label: 'Keep tone' },
    { value: 'more-formal', label: 'More formal' },
    { value: 'more-casual', label: 'More casual' }
  ],
  length: [
    { value: 'as-is', label: 'Keep length' },
    { value: 'shorter', label: 'Shorter' },
    { value: 'longer', label: 'Longer' }
  ],
  format: [
    { value: 'as-is', label: 'Keep format' },
    { value: 'markdown', label: 'Markdown' },
    { value: 'plain-text', label: 'Plain text' }
  ]
} satisfies Record<string, SelectOption[]>;
const options = isWriter ? writerOptions : rewriterOptions;
const toneOptions = options.tone;
const lengthOptions = options.length;
const formatOptions = options.format;
const labelFor = (items: SelectOption[], value: string) => items.find((item) => item.value === value)?.label ?? value;

const inputLabel = isWriter ? 'Task' : 'Original';
const outputLabel = isWriter ? 'Draft' : 'Rewrite';
const actionLabel = isWriter ? 'Write' : 'Rewrite';
const busyActionLabel = isWriter ? 'Writing' : 'Rewriting';
const contextToggleLabel = isWriter ? 'Additional context' : 'Rewrite guidance';
const createOptions = computed<CreateOptions>(
  () =>
    ({
      tone: selectedTone.value,
      format: selectedFormat.value,
      length: selectedLength.value,
      sharedContext: props.sharedContext || undefined,
      outputLanguage: props.outputLanguage || undefined,
      expectedInputLanguages: props.expectedInputLanguages,
      expectedContextLanguages: props.expectedContextLanguages
    }) as CreateOptions
);
const coreOptions = computed(() => {
  const { sharedContext: _sharedContext, ...core } = createOptions.value;
  return core;
});
const settingsSummary = computed(() =>
  [
    labelFor(toneOptions, selectedTone.value),
    labelFor(lengthOptions, selectedLength.value),
    labelFor(formatOptions, selectedFormat.value),
    selectedFitStrategy.value === 'error' ? 'Full context' : 'Fit context'
  ].join(' / ')
);
const isBusy = computed(() => props.disabled || api.isProcessing.value);
const canRun = computed(
  () => !isBusy.value && api.availability.value !== 'unavailable' && Boolean(sourceText.value.trim())
);
const inputMeta = computed(
  () =>
    `${formatTokenCount(api.inputUsage.value)} / ${formatTokenCount(api.inputQuota.value)} tokens | ${sourceText.value.length} chars`
);
const outputMeta = computed(() =>
  output.value ? `${output.value.length.toLocaleString()} chars` : labelFor(formatOptions, selectedFormat.value)
);
const progressLabel = computed(() => {
  const phase = api.progressState.value.phase;
  if (phase === 'measuring') return 'Measuring input';
  if (phase === 'fitting-context') return 'Fitting context';
  if (phase === 'writing') return streamOutput.value ? 'Streaming draft' : 'Writing draft';
  if (phase === 'rewriting') return streamOutput.value ? 'Streaming rewrite' : 'Rewriting text';
  return '';
});
const progressPercent = computed(() => {
  const phase = api.progressState.value.phase;
  if (phase === 'measuring') return 18;
  if (phase === 'fitting-context') return 38;
  if (phase === 'writing' || phase === 'rewriting') return 68;
  return phase === 'ready' ? 100 : 8;
});

const run = async () => {
  if (!canRun.value) return;
  try {
    output.value = '';
    errorMessage.value = '';
    const runOptions = {
      createOptions: createOptions.value,
      autoCreate: props.autoCreate,
      context: showContext.value ? assistantContext.value || undefined : undefined,
      stripHtml: stripHtmlInput.value,
      fitStrategy: selectedFitStrategy.value,
      onProgress: (state: ProgressState) => emit('progress', state)
    };
    if (streamOutput.value) {
      if (isWriter) {
        await (api as ReturnType<typeof useWriter>).writeStreamingToText(
          sourceText.value,
          runOptions as Parameters<ReturnType<typeof useWriter>['writeStreamingToText']>[1],
          (_chunk, accumulated) => {
            output.value = accumulated;
          }
        );
      } else {
        await (api as ReturnType<typeof useRewriter>).rewriteStreamingToText(
          sourceText.value,
          runOptions as Parameters<ReturnType<typeof useRewriter>['rewriteStreamingToText']>[1],
          (_chunk, accumulated) => {
            output.value = accumulated;
          }
        );
      }
      const result = api.lastResult.value;
      output.value = result?.text || output.value;
      if (result) emit('result', result);
      return;
    }
    const result = isWriter
      ? await (api as ReturnType<typeof useWriter>).writeWithDetails(
          sourceText.value,
          runOptions as Parameters<ReturnType<typeof useWriter>['writeWithDetails']>[1]
        )
      : await (api as ReturnType<typeof useRewriter>).rewriteWithDetails(
          sourceText.value,
          runOptions as Parameters<ReturnType<typeof useRewriter>['rewriteWithDetails']>[1]
        );
    output.value = result.text;
    emit('result', result);
  } catch (error) {
    errorMessage.value =
      error instanceof Error ? error.message : `Unable to ${isWriter ? 'write from' : 'rewrite'} this input.`;
    emit('error', error);
  }
};

watch(
  () => props.context,
  (value) => {
    assistantContext.value = value;
    if (value) showContext.value = true;
  }
);

useToolLifecycle({
  availability: api.availability,
  createOptions: coreOptions,
  autoInit: () => props.autoInit,
  requestAvailability: (value) =>
    isWriter
      ? (api as ReturnType<typeof useWriter>).requestAvailability(value as WriterCreate)
      : (api as ReturnType<typeof useRewriter>).requestAvailability(value as RewriterCreate),
  dispose: api.dispose,
  onAvailability: (value) => emit('availability-change', value)
});

const { availability, downloadProgress, lastResult } = api;
</script>
