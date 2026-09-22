<template>
  <TextTool
    v-model="sourceText"
    :output="lastResult?.detectedLanguage ?? ''"
    input-label="Input"
    output-label="Detected language"
    action-label="Detect"
    busy-action-label="Detecting"
    :placeholder="placeholder"
    :empty-output-message="emptyOutputMessage"
    :settings-summary="expectedLanguagesLabel"
    :input-meta="inputMeta"
    :output-meta="resultMetaLabel"
    :availability="availability"
    :download-progress="downloadProgress"
    :busy="api.isProcessing.value"
    :disabled="disabled"
    :can-run="canDetect"
    :progress-percent="progressPercent"
    :error-message="errorMessage"
    @interrupt="api.interrupt()"
    @run="handleDetect"
  >
    <template #settings>
      <div class="writing-tool__settings-grid">
        <label
          >Expected languages<input v-model="expectedLanguagesText" :disabled="isBusy" placeholder="en, fr, de"
        /></label>
        <label
          >Confidence<input
            v-model.number="minimumConfidence"
            :disabled="isBusy"
            type="range"
            min="0"
            max="0.95"
            step="0.01"
        /></label>
        <label
          >Results<select v-model.number="maximumResults" :disabled="isBusy">
            <option :value="3">Top 3</option>
            <option :value="5">Top 5</option>
            <option :value="8">Top 8</option>
            <option :value="12">Top 12</option>
          </select></label
        >
        <label
          >Long input<select v-model="largeInputMode" :disabled="isBusy">
            <option value="chunk">Chunk and merge</option>
            <option value="sample">Sample</option>
            <option value="never">Native only</option>
          </select></label
        >
      </div>
      <div class="writing-tool__toggles">
        <label class="writing-tool__toggle"
          ><input v-model="stripHtmlInput" type="checkbox" :disabled="isBusy" />Strip HTML</label
        >
      </div>
    </template>

    <template #meta>
      <span>{{ Math.round(minimumConfidence * 100) }}% threshold</span>
      <span v-if="progressLabel">{{ progressLabel }}</span>
      <span v-if="lastResult?.chunked">Chunked</span>
      <span v-if="lastResult?.sampled">Sampled</span>
    </template>

    <template #output-actions>
      <button v-if="lastResult" class="writing-tool__ghost-button" type="button" @click="copyTopLanguage">
        Copy code
      </button>
    </template>

    <template #output>
      <div v-if="lastResult" class="browser-ai-language-result">
        <div class="browser-ai-language-result__hero">
          <span>{{ lastResult.detectedLanguage }}</span>
          <div>
            <strong>{{ lastResult.name }}</strong
            ><small>{{ Math.round(lastResult.confidence * 100) }}% confidence</small>
          </div>
        </div>
        <ol class="browser-ai-language-result__ranked">
          <li v-for="result in results" :key="result.detectedLanguage">
            <span>{{ result.name }}</span
            ><strong>{{ result.detectedLanguage }}</strong
            ><em>{{ Math.round(result.confidence * 100) }}%</em>
            <i :style="{ width: `${Math.round(result.confidence * 100)}%` }"></i>
          </li>
        </ol>
      </div>
      <p v-else>{{ emptyOutputMessage }}</p>
    </template>
  </TextTool>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import {
  getLanguageDetectorLanguageName,
  useLanguageDetector,
  type LanguageDetectorCreate,
  type LanguageDetectorLargeInputStrategy,
  type LanguageDetectorProgressState,
  type LanguageDetectorResult
} from '../composables/useLanguageDetector';
import { useSyncedString } from '../composables/useSyncedString';
import { useToolLifecycle } from '../composables/useToolLifecycle';
import { copyText, formatTokenCount } from '../utils/display';
import TextTool from './TextTool.vue';

interface Props {
  modelValue?: string;
  placeholder?: string;
  emptyOutputMessage?: string;
  expectedInputLanguages?: string[];
  autoInit?: boolean;
  autoCreate?: boolean;
  stripHtml?: boolean;
  largeInputStrategy?: LanguageDetectorLargeInputStrategy;
  minConfidence?: number;
  maxResults?: number;
  disabled?: boolean;
}

const props = withDefaults(defineProps<Props>(), {
  modelValue: '',
  placeholder: 'Paste text to identify its language locally...',
  emptyOutputMessage: 'Language results will appear here.',
  expectedInputLanguages: undefined,
  autoInit: true,
  autoCreate: true,
  stripHtml: true,
  largeInputStrategy: 'chunk',
  minConfidence: 0.42,
  maxResults: 6,
  disabled: false
});

const emit = defineEmits<{
  'update:modelValue': [value: string];
  'availability-change': [availability: Availability];
  progress: [state: LanguageDetectorProgressState];
  detect: [result: LanguageDetectorResult];
  error: [error: unknown];
}>();

const api = useLanguageDetector({ expectedInputLanguages: props.expectedInputLanguages ?? [] });
const sourceText = useSyncedString(
  () => props.modelValue,
  (value) => emit('update:modelValue', value)
);
const errorMessage = ref('');
const expectedLanguagesText = ref((props.expectedInputLanguages ?? []).join(', '));
const stripHtmlInput = ref(props.stripHtml);
const largeInputMode = ref(props.largeInputStrategy);
const minimumConfidence = ref(props.minConfidence);
const maximumResults = ref(props.maxResults);

const parsedExpectedInputLanguages = computed(() =>
  expectedLanguagesText.value
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean)
);
const createOptions = computed<LanguageDetectorCreate>(() => ({
  expectedInputLanguages: parsedExpectedInputLanguages.value
}));
const expectedLanguagesLabel = computed(() =>
  parsedExpectedInputLanguages.value.length
    ? parsedExpectedInputLanguages.value.map(getLanguageDetectorLanguageName).join(', ')
    : 'All detectable languages'
);
const isBusy = computed(() => props.disabled || api.isProcessing.value);
const canDetect = computed(
  () => !isBusy.value && api.availability.value !== 'unavailable' && Boolean(sourceText.value.trim())
);
const inputMeta = computed(
  () =>
    `${formatTokenCount(api.inputUsage.value)} / ${formatTokenCount(api.inputQuota.value)} tokens | ${sourceText.value.length} chars`
);
const resultMetaLabel = computed(() => {
  const result = api.lastResult.value;
  if (!result) return 'Ranked confidence results';
  if (result.chunked) return `${result.chunks.length} chunks analyzed`;
  if (result.sampled) return 'Representative sample analyzed';
  return `${result.results.length} candidates`;
});
const progressLabel = computed(() => {
  const state = api.progressState.value;
  if (state.phase === 'measuring') return 'Measuring input';
  if (state.phase === 'chunking') return 'Preparing chunks';
  if (state.phase === 'detecting')
    return state.totalChunks > 1 ? `Detecting ${state.currentChunk} / ${state.totalChunks}` : 'Detecting language';
  return '';
});
const progressPercent = computed(() => {
  const state = api.progressState.value;
  if (state.phase === 'measuring') return 18;
  if (state.phase === 'chunking') return 38;
  if (state.phase === 'detecting')
    return state.totalChunks > 0 ? Math.max(48, Math.round((state.processedChunks / state.totalChunks) * 92)) : 68;
  return state.phase === 'ready' ? 100 : 8;
});

const handleDetect = async () => {
  if (!canDetect.value) return;
  try {
    errorMessage.value = '';
    const result = await api.detectWithDetails(sourceText.value, {
      createOptions: createOptions.value,
      autoCreate: props.autoCreate,
      stripHtml: stripHtmlInput.value,
      largeInputStrategy: largeInputMode.value,
      minConfidence: minimumConfidence.value,
      maxResults: maximumResults.value,
      onProgress: (state) => emit('progress', state)
    });
    emit('detect', result);
  } catch (error) {
    errorMessage.value = error instanceof Error ? error.message : 'Unable to detect this input language.';
    emit('error', error);
  }
};
const copyTopLanguage = () => copyText(api.lastResult.value?.detectedLanguage ?? '');

watch(
  () => props.expectedInputLanguages,
  (value) => {
    expectedLanguagesText.value = (value ?? []).join(', ');
  }
);
useToolLifecycle({
  availability: api.availability,
  createOptions,
  autoInit: () => props.autoInit,
  requestAvailability: api.requestAvailability,
  dispose: api.dispose,
  onAvailability: (value) => emit('availability-change', value)
});

const { availability, downloadProgress, results, lastResult } = api;
</script>
