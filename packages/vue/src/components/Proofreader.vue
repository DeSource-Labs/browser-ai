<template>
  <TextTool
    v-model="sourceText"
    :output="lastResult?.correctedInput ?? ''"
    input-label="Draft"
    output-label="Corrected text"
    action-label="Proofread"
    busy-action-label="Checking"
    :placeholder="placeholder"
    :empty-output-message="emptyOutputMessage"
    :settings-summary="expectedLanguagesLabel"
    :input-meta="`${sourceText.length.toLocaleString()} chars`"
    :output-meta="resultMetaLabel"
    :availability="availability"
    :download-progress="downloadProgress"
    :busy="api.isProcessing.value"
    :disabled="disabled"
    :can-run="canProofread"
    :progress-percent="progressPercent"
    :error-message="errorMessage"
    @interrupt="api.interrupt()"
    @run="handleProofread"
  >
    <template #settings>
      <div class="writing-tool__settings-grid">
        <label
          >Expected languages<input v-model="expectedLanguagesText" :disabled="isBusy" placeholder="en, fr, de"
        /></label>
        <label
          >Long input<select v-model="largeInputMode" :disabled="isBusy">
            <option value="auto">Split when needed</option>
            <option value="never">Native only</option>
          </select></label
        >
        <label
          >Chunk size<select v-model.number="chunkCharacterLimit" :disabled="isBusy">
            <option :value="4000">4k chars</option>
            <option :value="8000">8k chars</option>
            <option :value="12000">12k chars</option>
            <option :value="16000">16k chars</option>
          </select></label
        >
        <label
          >Explanation language<input
            v-model="explanationLanguage"
            :disabled="isBusy || !includeExplanations"
            placeholder="en"
        /></label>
      </div>
      <div class="writing-tool__toggles">
        <label class="writing-tool__toggle"
          ><input v-model="stripHtmlInput" type="checkbox" :disabled="isBusy" />Strip HTML</label
        >
        <label class="writing-tool__toggle"
          ><input v-model="includeTypes" type="checkbox" :disabled="isBusy" />Correction types</label
        >
        <label class="writing-tool__toggle"
          ><input v-model="includeExplanations" type="checkbox" :disabled="isBusy" />Explanations</label
        >
      </div>
    </template>

    <template #meta>
      <span>{{ correctionCountLabel }}</span>
      <span v-if="progressLabel">{{ progressLabel }}</span>
      <span v-if="lastResult?.chunked">Chunked</span>
    </template>

    <template #output-actions>
      <button
        v-if="lastResult"
        class="writing-tool__ghost-button"
        type="button"
        @click="copyText(lastResult.correctedInput)"
      >
        Copy
      </button>
    </template>

    <template #output>
      <MarkdownRenderer v-if="lastResult && renderMarkdown" :content="lastResult.correctedInput" />
      <div v-else-if="lastResult" class="browser-ai-proofreader-result">
        <div class="browser-ai-proofreader-result__text">
          <template v-if="corrections.length">
            <template v-for="(segment, index) in correctedSegments" :key="index">
              <mark v-if="segment.correction" :title="correctionTitle(segment.correction)">{{
                segment.correctedText
              }}</mark>
              <span v-else>{{ segment.text }}</span>
            </template>
          </template>
          <span v-else>{{ lastResult.correctedInput }}</span>
        </div>
        <ol v-if="corrections.length" class="browser-ai-proofreader-result__corrections">
          <li
            v-for="correction in corrections"
            :key="`${correction.startIndex}-${correction.endIndex}-${correction.index}`"
          >
            <div>
              <del>{{ correction.original }}</del
              ><strong>{{ correction.correction }}</strong>
            </div>
            <small v-if="correction.types.length">{{ correction.types.join(', ') }}</small>
            <p v-if="correction.explanation">{{ correction.explanation }}</p>
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
  getProofreaderLanguageName,
  useProofreader,
  type NormalizedProofreadCorrection,
  type ProofreaderCreate,
  type ProofreaderLargeInputStrategy,
  type ProofreaderProgressState,
  type ProofreaderResult
} from '../composables/useProofreader';
import { useSyncedString } from '../composables/useSyncedString';
import { useToolLifecycle } from '../composables/useToolLifecycle';
import { copyText } from '../utils/display';
import MarkdownRenderer from './MarkdownRenderer.vue';
import TextTool from './TextTool.vue';

interface Props {
  modelValue?: string;
  placeholder?: string;
  emptyOutputMessage?: string;
  expectedInputLanguages?: string[];
  includeCorrectionTypes?: boolean;
  includeCorrectionExplanations?: boolean;
  correctionExplanationLanguage?: string;
  autoInit?: boolean;
  autoCreate?: boolean;
  stripHtml?: boolean;
  largeInputStrategy?: ProofreaderLargeInputStrategy;
  maxChunkCharacters?: number;
  renderMarkdown?: boolean;
  disabled?: boolean;
}

const props = withDefaults(defineProps<Props>(), {
  modelValue: '',
  placeholder: 'Paste text to check grammar, spelling, and punctuation locally...',
  emptyOutputMessage: 'Corrected output will appear here.',
  expectedInputLanguages: undefined,
  includeCorrectionTypes: false,
  includeCorrectionExplanations: false,
  correctionExplanationLanguage: 'en',
  autoInit: true,
  autoCreate: true,
  stripHtml: true,
  largeInputStrategy: 'auto',
  maxChunkCharacters: 8000,
  renderMarkdown: false,
  disabled: false
});

const emit = defineEmits<{
  'update:modelValue': [value: string];
  'availability-change': [availability: Availability];
  progress: [state: ProofreaderProgressState];
  proofread: [result: ProofreaderResult];
  error: [error: unknown];
}>();

const api = useProofreader({
  expectedInputLanguages: props.expectedInputLanguages ?? [],
  includeCorrectionTypes: props.includeCorrectionTypes,
  includeCorrectionExplanations: props.includeCorrectionExplanations,
  correctionExplanationLanguage: props.correctionExplanationLanguage
});
const sourceText = useSyncedString(
  () => props.modelValue,
  (value) => emit('update:modelValue', value)
);
const errorMessage = ref('');
const expectedLanguagesText = ref((props.expectedInputLanguages ?? []).join(', '));
const includeTypes = ref(props.includeCorrectionTypes);
const includeExplanations = ref(props.includeCorrectionExplanations);
const explanationLanguage = ref(props.correctionExplanationLanguage);
const stripHtmlInput = ref(props.stripHtml);
const largeInputMode = ref(props.largeInputStrategy);
const chunkCharacterLimit = ref(props.maxChunkCharacters);

const parsedExpectedInputLanguages = computed(() =>
  expectedLanguagesText.value
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean)
);
const createOptions = computed<ProofreaderCreate>(() => ({
  expectedInputLanguages: parsedExpectedInputLanguages.value,
  includeCorrectionTypes: includeTypes.value,
  includeCorrectionExplanations: includeExplanations.value,
  correctionExplanationLanguage: includeExplanations.value ? explanationLanguage.value : undefined
}));
const expectedLanguagesLabel = computed(() =>
  parsedExpectedInputLanguages.value.length
    ? parsedExpectedInputLanguages.value.map(getProofreaderLanguageName).join(', ')
    : 'Any supported language'
);
const isBusy = computed(() => props.disabled || api.isProcessing.value);
const canProofread = computed(
  () => !isBusy.value && api.availability.value !== 'unavailable' && Boolean(sourceText.value.trim())
);
const correctionCountLabel = computed(
  () => `${api.corrections.value.length} correction${api.corrections.value.length === 1 ? '' : 's'}`
);
const resultMetaLabel = computed(() => {
  const result = api.lastResult.value;
  if (!result) return 'Corrections and final text';
  if (!result.hasCorrections) return 'No changes suggested';
  if (result.chunked) return `${result.chunks.length} chunks checked`;
  return correctionCountLabel.value;
});
const progressLabel = computed(() => {
  const state = api.progressState.value;
  if (state.phase === 'measuring') return 'Preparing input';
  if (state.phase === 'chunking') return 'Splitting long text';
  if (state.phase === 'proofreading')
    return state.totalChunks > 1 ? `Checking ${state.currentChunk} / ${state.totalChunks}` : 'Checking text';
  return '';
});
const progressPercent = computed(() => {
  const state = api.progressState.value;
  if (state.phase === 'measuring') return 18;
  if (state.phase === 'chunking') return 35;
  if (state.phase === 'proofreading')
    return state.totalChunks > 0 ? Math.max(48, Math.round((state.processedChunks / state.totalChunks) * 92)) : 68;
  return state.phase === 'ready' ? 100 : 8;
});
const correctedSegments = computed(() => {
  const result = api.lastResult.value;
  return result ? api.createProofreadTextSegments(result.input, result.corrections) : [];
});
const correctionTitle = (correction: NormalizedProofreadCorrection) =>
  [
    `Replace "${correction.original}" with "${correction.correction}"`,
    correction.types.join(', '),
    correction.explanation
  ]
    .filter(Boolean)
    .join('\n');

const handleProofread = async () => {
  if (!canProofread.value) return;
  try {
    errorMessage.value = '';
    const result = await api.proofreadWithDetails(sourceText.value, {
      createOptions: createOptions.value,
      autoCreate: props.autoCreate,
      stripHtml: stripHtmlInput.value,
      largeInputStrategy: largeInputMode.value,
      maxChunkCharacters: chunkCharacterLimit.value,
      onProgress: (state) => emit('progress', state)
    });
    emit('proofread', result);
  } catch (error) {
    errorMessage.value = error instanceof Error ? error.message : 'Unable to proofread this input.';
    emit('error', error);
  }
};

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

const { availability, downloadProgress, corrections, lastResult } = api;
</script>
