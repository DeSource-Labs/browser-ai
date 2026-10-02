<template>
  <TextTool
    v-model="sourceText"
    :output="summary"
    input-label="Source"
    output-label="Summary"
    action-label="Summarize"
    busy-action-label="Summarizing"
    :placeholder="placeholder"
    :empty-output-message="emptyOutputMessage"
    :settings-summary="settingsSummary"
    :input-meta="inputMeta"
    :output-meta="outputMeta"
    :availability="availability"
    :download-progress="downloadProgress"
    :busy="api.isProcessing.value"
    :disabled="disabled"
    :can-run="canSummarize"
    :progress-percent="progressPercent"
    :error-message="errorMessage"
    :render-markdown="renderMarkdown && selectedFormat === 'markdown'"
    @interrupt="api.interrupt()"
    @run="handleSummarize"
  >
    <template #settings>
      <div class="writing-tool__settings-grid">
        <label
          >Type<select v-model="selectedType" :disabled="isBusy">
            <option value="key-points">Key points</option>
            <option value="tldr">TL;DR</option>
            <option value="teaser">Teaser</option>
            <option value="headline">Headline</option>
          </select></label
        >
        <label
          >Length<select v-model="selectedLength" :disabled="isBusy">
            <option value="short">Short</option>
            <option value="medium">Medium</option>
            <option value="long">Long</option>
          </select></label
        >
        <label
          >Format<select v-model="selectedFormat" :disabled="isBusy">
            <option value="markdown">Markdown</option>
            <option value="plain-text">Plain text</option>
          </select></label
        >
        <label
          >Preference<select v-model="selectedPreference" :disabled="isBusy">
            <option value="auto">Auto</option>
            <option value="speed">Speed</option>
            <option value="capability">Capability</option>
          </select></label
        >
      </div>
      <div class="writing-tool__toggles">
        <label class="writing-tool__toggle"
          ><input v-model="stripHtmlInput" type="checkbox" :disabled="isBusy" />Strip HTML</label
        >
        <label class="writing-tool__toggle"
          ><input v-model="showContext" type="checkbox" :disabled="isBusy" />Additional context</label
        >
      </div>
    </template>

    <template v-if="showContext" #input-after>
      <label class="writing-tool__context">
        <span>Additional context</span>
        <textarea
          v-model="summaryContext"
          :disabled="disabled || isBusy"
          :placeholder="contextPlaceholder"
          rows="3"
        ></textarea>
      </label>
    </template>

    <template #meta>
      <span v-if="progressLabel">{{ progressLabel }}</span>
      <span v-if="lastResult?.chunked">Chunked</span>
    </template>
  </TextTool>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import {
  useSummarizer,
  type SummarizerCreate,
  type SummarizerProgressState,
  type SummarizerResult
} from '../composables/useSummarizer';
import { useSyncedString } from '../composables/useSyncedString';
import { useToolLifecycle } from '../composables/useToolLifecycle';
import { formatTokenCount } from '../utils/display';
import TextTool from './TextTool.vue';

interface Props {
  modelValue?: string;
  placeholder?: string;
  contextPlaceholder?: string;
  emptyOutputMessage?: string;
  type?: SummarizerType;
  format?: SummarizerFormat;
  length?: SummarizerLength;
  preference?: PerformancePreference;
  sharedContext?: string;
  context?: string;
  outputLanguage?: string;
  expectedInputLanguages?: string[];
  expectedContextLanguages?: string[];
  autoInit?: boolean;
  autoCreate?: boolean;
  stripHtml?: boolean;
  renderMarkdown?: boolean;
  disabled?: boolean;
}

const props = withDefaults(defineProps<Props>(), {
  modelValue: '',
  placeholder: 'Paste a long article, notes, or conversation to summarize...',
  contextPlaceholder: 'Optional context for the summary',
  emptyOutputMessage: 'Summary output will appear here.',
  type: 'key-points',
  format: 'markdown',
  length: 'medium',
  preference: 'auto',
  sharedContext: '',
  context: '',
  outputLanguage: '',
  expectedInputLanguages: undefined,
  expectedContextLanguages: undefined,
  autoInit: true,
  autoCreate: true,
  stripHtml: true,
  renderMarkdown: true,
  disabled: false
});

const emit = defineEmits<{
  'update:modelValue': [value: string];
  'availability-change': [availability: Availability];
  progress: [state: SummarizerProgressState];
  summary: [result: SummarizerResult];
  error: [error: unknown];
}>();

const api = useSummarizer();
const sourceText = useSyncedString(
  () => props.modelValue,
  (value) => emit('update:modelValue', value)
);
const summary = ref('');
const errorMessage = ref('');
const summaryContext = ref(props.context);
const showContext = ref(Boolean(props.context));
const stripHtmlInput = ref(props.stripHtml);
const selectedType = ref<SummarizerType>(props.type);
const selectedFormat = ref<SummarizerFormat>(props.format);
const selectedLength = ref<SummarizerLength>(props.length);
const selectedPreference = ref<PerformancePreference>(props.preference);

const labels = {
  type: { 'key-points': 'Key points', tldr: 'TL;DR', teaser: 'Teaser', headline: 'Headline' },
  length: { short: 'Short', medium: 'Medium', long: 'Long' },
  format: { markdown: 'Markdown', 'plain-text': 'Plain text' },
  preference: { auto: 'Auto', speed: 'Speed', capability: 'Capability' }
} as const;

const createOptions = computed<SummarizerCreate>(() => ({
  type: selectedType.value,
  format: selectedFormat.value,
  length: selectedLength.value,
  preference: selectedPreference.value,
  sharedContext: props.sharedContext || undefined,
  outputLanguage: props.outputLanguage || undefined,
  expectedInputLanguages: props.expectedInputLanguages,
  expectedContextLanguages: props.expectedContextLanguages
}));
const coreOptions = computed<SummarizerCreateCoreOptions>(() => {
  const { sharedContext: _sharedContext, ...core } = createOptions.value;
  return core;
});
const settingsSummary = computed(() =>
  [
    labels.type[selectedType.value],
    labels.length[selectedLength.value],
    labels.format[selectedFormat.value],
    labels.preference[selectedPreference.value]
  ].join(' / ')
);
const isBusy = computed(() => props.disabled || api.isProcessing.value);
const canSummarize = computed(
  () => !isBusy.value && api.availability.value !== 'unavailable' && Boolean(sourceText.value.trim())
);
const inputMeta = computed(
  () =>
    `${formatTokenCount(api.inputUsage.value)} / ${formatTokenCount(api.inputQuota.value)} tokens | ${sourceText.value.length} chars`
);
const outputMeta = computed(() =>
  summary.value ? `${summary.value.length.toLocaleString()} chars` : labels.format[selectedFormat.value]
);
const progressLabel = computed(() => {
  const state = api.progressState.value;
  if (state.phase === 'chunking') return 'Preparing chunks';
  if (state.phase === 'summarizing' && state.totalChunks > 1)
    return `Summarizing ${state.currentChunk} / ${state.totalChunks}`;
  if (state.phase === 'rolling-up') return 'Combining chunk summaries';
  if (state.phase === 'measuring') return 'Measuring input';
  return '';
});
const progressPercent = computed(() => {
  const state = api.progressState.value;
  if (state.phase === 'measuring') return 18;
  if (state.phase === 'chunking') return 32;
  if (state.phase === 'rolling-up') return 86;
  if (state.phase === 'summarizing')
    return state.totalChunks <= 1
      ? 64
      : Math.min(82, 35 + Math.round((state.processedChunks / state.totalChunks) * 45));
  return state.phase === 'ready' ? 100 : 8;
});

const handleSummarize = async () => {
  if (!canSummarize.value) return;
  try {
    summary.value = '';
    errorMessage.value = '';
    const result = await api.summarizeWithDetails(sourceText.value, {
      createOptions: createOptions.value,
      autoCreate: props.autoCreate,
      context: showContext.value ? summaryContext.value || undefined : undefined,
      stripHtml: stripHtmlInput.value,
      onProgress: (state) => emit('progress', state)
    });
    summary.value = result.summary;
    emit('summary', result);
  } catch (error) {
    errorMessage.value = error instanceof Error ? error.message : 'Unable to summarize this input.';
    emit('error', error);
  }
};

watch(
  () => props.context,
  (value) => {
    summaryContext.value = value;
    if (value) showContext.value = true;
  }
);

useToolLifecycle({
  availability: api.availability,
  createOptions: coreOptions,
  autoInit: () => props.autoInit,
  requestAvailability: api.requestAvailability,
  dispose: api.dispose,
  onAvailability: (value) => emit('availability-change', value)
});

const { availability, downloadProgress, lastResult } = api;
</script>
