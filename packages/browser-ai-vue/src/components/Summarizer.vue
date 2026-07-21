<template>
  <div class="summarizer">
    <div class="summarizer__workspace">
      <section class="summarizer__pane summarizer__pane--input" aria-label="Summarizer source input">
        <div class="summarizer__toolbar">
          <div class="summarizer__toolbar-main">
            <span class="summarizer__label">Source</span>
            <span class="summarizer__config">{{ settingsSummary }}</span>
          </div>

          <div class="summarizer__toolbar-actions">
            <span
              class="summarizer__status"
              :class="{
                'summarizer__status--available': availability === 'available',
                'summarizer__status--downloadable': availability === 'downloadable',
                'summarizer__status--downloading': availability === 'downloading',
                'summarizer__status--unavailable': availability === 'unavailable'
              }"
            >
              <span class="summarizer__status-dot"></span>
              {{ operationalStatusLabel }}
            </span>

            <details class="summarizer__settings">
              <summary>Settings</summary>

              <div class="summarizer__settings-panel">
                <div class="summarizer__settings-grid">
                  <label>
                    Type
                    <select v-model="selectedType" :disabled="isBusy">
                      <option value="key-points">Key points</option>
                      <option value="tldr">TL;DR</option>
                      <option value="teaser">Teaser</option>
                      <option value="headline">Headline</option>
                    </select>
                  </label>

                  <label>
                    Length
                    <select v-model="selectedLength" :disabled="isBusy">
                      <option value="short">Short</option>
                      <option value="medium">Medium</option>
                      <option value="long">Long</option>
                    </select>
                  </label>

                  <label>
                    Format
                    <select v-model="selectedFormat" :disabled="isBusy">
                      <option value="markdown">Markdown</option>
                      <option value="plain-text">Plain text</option>
                    </select>
                  </label>

                  <label>
                    Preference
                    <select v-model="selectedPreference" :disabled="isBusy">
                      <option value="auto">Auto</option>
                      <option value="speed">Speed</option>
                      <option value="capability">Capability</option>
                    </select>
                  </label>
                </div>

                <div class="summarizer__toggles">
                  <label class="summarizer__toggle">
                    <input v-model="stripHtmlInput" type="checkbox" :disabled="isBusy" />
                    <span>Strip HTML</span>
                  </label>

                  <label class="summarizer__toggle">
                    <input v-model="showContext" type="checkbox" :disabled="isBusy" />
                    <span>Additional context</span>
                  </label>
                </div>
              </div>
            </details>
          </div>
        </div>

        <div class="summarizer__editor">
          <textarea v-model="sourceText" :disabled="disabled || isBusy" :placeholder="placeholder"></textarea>

          <label v-if="showContext" class="summarizer__context">
            <span>Additional context</span>
            <textarea
              v-model="summaryContext"
              :disabled="disabled || isBusy"
              :placeholder="contextPlaceholder"
              rows="3"
            ></textarea>
          </label>
        </div>

        <div v-if="isBusy" class="summarizer__progress" role="status" aria-live="polite">
          <span :style="{ width: `${progressPercent}%` }"></span>
        </div>

        <p v-if="errorMessage" class="summarizer__error" role="alert">
          {{ errorMessage }}
        </p>

        <div class="summarizer__footer">
          <div class="summarizer__meta">
            <span>{{ inputUsageLabel }} / {{ inputQuotaLabel }} tokens | {{ sourceText.length }} chars</span>
            <span v-if="progressLabel">{{ progressLabel }}</span>
            <span v-if="downloadProgress > 0 && downloadProgress < 100"> Downloading {{ downloadProgress }}% </span>
          </div>

          <button type="button" :disabled="!canSummarize" @click="handleSummarize">
            {{ isBusy ? 'Summarizing' : 'Summarize' }}
          </button>
        </div>
      </section>

      <section class="summarizer__pane summarizer__pane--output" aria-live="polite">
        <div class="summarizer__toolbar">
          <div class="summarizer__toolbar-main">
            <span class="summarizer__label">Summary</span>
            <span class="summarizer__config">{{ outputMetaLabel }}</span>
          </div>

          <span v-if="lastResult?.chunked" class="summarizer__badge">Chunked</span>
        </div>

        <div class="summarizer__output">
          <MarkdownRenderer v-if="summary && renderMarkdown && selectedFormat === 'markdown'" :content="summary" />
          <pre v-else-if="summary">{{ summary }}</pre>
          <p v-else>{{ emptyOutputMessage }}</p>
        </div>
      </section>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import {
  useSummarizer,
  type SummarizerCreate,
  type SummarizerProgressState,
  type SummarizerResult
} from '../composables/useSummarizer';
import { useSyncedString } from '../composables/useSyncedString';
import { formatAvailability, formatTokenCount } from '../utils/display';
import MarkdownRenderer from './MarkdownRenderer.vue';

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

const {
  availability,
  downloadProgress,
  inputUsage,
  inputQuota,
  progressState,
  lastResult,
  isProcessing,
  requestAvailability,
  summarizeWithDetails,
  dispose
} = useSummarizer();

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

const typeLabels: Record<SummarizerType, string> = {
  'key-points': 'Key points',
  tldr: 'TL;DR',
  teaser: 'Teaser',
  headline: 'Headline'
};

const lengthLabels: Record<SummarizerLength, string> = {
  short: 'Short',
  medium: 'Medium',
  long: 'Long'
};

const formatLabels: Record<SummarizerFormat, string> = {
  markdown: 'Markdown',
  'plain-text': 'Plain text'
};

const preferenceLabels: Record<PerformancePreference, string> = {
  auto: 'Auto',
  speed: 'Speed',
  capability: 'Capability'
};

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

const operationalStatusLabel = computed(() => {
  return formatAvailability(availability.value, downloadProgress.value);
});

const settingsSummary = computed(() => {
  return [
    typeLabels[selectedType.value],
    lengthLabels[selectedLength.value],
    formatLabels[selectedFormat.value],
    preferenceLabels[selectedPreference.value]
  ].join(' / ');
});

const outputMetaLabel = computed(() => {
  if (!summary.value) return formatLabels[selectedFormat.value];
  return `${summary.value.length.toLocaleString()} chars`;
});

const isBusy = computed(() => props.disabled || isProcessing.value);

const canSummarize = computed(() => {
  return (
    !props.disabled && !isProcessing.value && availability.value !== 'unavailable' && sourceText.value.trim().length > 0
  );
});

const inputUsageLabel = computed(() => formatTokenCount(inputUsage.value));
const inputQuotaLabel = computed(() => formatTokenCount(inputQuota.value));

const progressLabel = computed(() => {
  const state = progressState.value;
  if (state.phase === 'chunking') return 'Preparing chunks';
  if (state.phase === 'summarizing' && state.totalChunks > 1) {
    return `Summarizing ${state.currentChunk} / ${state.totalChunks}`;
  }
  if (state.phase === 'rolling-up') return 'Combining chunk summaries';
  if (state.phase === 'measuring') return 'Measuring input';
  return '';
});

const progressPercent = computed(() => {
  const state = progressState.value;
  if (state.phase === 'measuring') return 18;
  if (state.phase === 'chunking') return 32;
  if (state.phase === 'rolling-up') return 86;
  if (state.phase === 'summarizing') {
    if (state.totalChunks <= 1) return 64;
    return Math.min(82, 35 + Math.round((state.processedChunks / state.totalChunks) * 45));
  }
  return state.phase === 'ready' ? 100 : 8;
});

const handleSummarize = async () => {
  if (!canSummarize.value) return;

  try {
    summary.value = '';
    errorMessage.value = '';
    const result = await summarizeWithDetails(sourceText.value, {
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
    if (value) {
      showContext.value = true;
    }
  }
);

watch(
  availability,
  (value) => {
    if (value) {
      emit('availability-change', value);
    }
  },
  { immediate: true }
);

watch(
  coreOptions,
  async (options) => {
    if (!props.autoInit) return;
    await requestAvailability(options);
  },
  { deep: true }
);

onMounted(async () => {
  if (!props.autoInit) return;
  await requestAvailability(coreOptions.value);
});

onBeforeUnmount(() => {
  dispose();
});
</script>

<style scoped>
.summarizer {
  width: 100%;
  height: 100%;
  min-height: 0;
  box-sizing: border-box;
  padding: 0.5rem;
  color: var(--color-primary, #fff);
  pointer-events: all;
}

.summarizer__workspace {
  height: 100%;
  min-height: 0;
  display: grid;
  grid-template-columns: minmax(0, 1.12fr) minmax(320px, 0.88fr);
  gap: 0.75rem;
}

.summarizer__pane {
  min-width: 0;
  min-height: 0;
  display: flex;
  flex-direction: column;
  border: 1px solid rgba(255, 255, 255, 0.12);
  border-radius: 0.85rem;
  background: rgba(8, 10, 18, 0.46);
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.06);
  overflow: hidden;
}

.summarizer__pane--input {
  position: relative;
}

.summarizer__toolbar,
.summarizer__toolbar-main,
.summarizer__toolbar-actions,
.summarizer__footer,
.summarizer__meta,
.summarizer__toggles,
.summarizer__toggle {
  display: flex;
  align-items: center;
  min-width: 0;
}

.summarizer__toolbar,
.summarizer__footer {
  justify-content: space-between;
  gap: 0.75rem;
  padding: 0.75rem;
  border-bottom: 1px solid rgba(255, 255, 255, 0.09);
}

.summarizer__footer {
  border-top: 1px solid rgba(255, 255, 255, 0.09);
  border-bottom: none;
}

.summarizer__toolbar-main {
  flex-direction: column;
  align-items: flex-start;
  gap: 0.18rem;
}

.summarizer__toolbar-actions {
  justify-content: flex-end;
  gap: 0.5rem;
  flex-shrink: 0;
}

.summarizer__label {
  color: var(--color-primary, #fff);
  font-size: 0.86rem;
  font-weight: 800;
  line-height: 1.15;
}

.summarizer__config,
.summarizer__meta {
  color: var(--color-secondary, rgba(255, 255, 255, 0.62));
  font-size: 0.74rem;
  line-height: 1.3;
}

.summarizer__config {
  max-width: min(48vw, 520px);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.summarizer__status,
.summarizer__badge,
.summarizer__settings summary,
.summarizer__footer button {
  min-height: 2.05rem;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: 999px;
  padding: 0 0.68rem;
  font-size: 0.76rem;
  font-weight: 700;
  white-space: nowrap;
}

.summarizer__status,
.summarizer__badge {
  gap: 0.38rem;
  border: 1px solid rgba(120, 120, 120, 0.32);
  background: rgba(255, 255, 255, 0.06);
  color: rgba(255, 255, 255, 0.72);
}

.summarizer__status-dot {
  width: 0.44rem;
  height: 0.44rem;
  border-radius: 999px;
  background: currentColor;
  box-shadow: 0 0 0.75rem currentColor;
}

.summarizer__status--available {
  background: rgba(34, 197, 94, 0.15);
  color: rgba(134, 239, 172, 1);
  border-color: rgba(34, 197, 94, 0.3);
}

.summarizer__status--downloadable {
  background: rgba(59, 130, 246, 0.15);
  color: rgba(147, 197, 253, 1);
  border-color: rgba(59, 130, 246, 0.3);
}

.summarizer__status--downloading {
  background: rgba(251, 146, 60, 0.15);
  color: rgba(254, 215, 170, 1);
  border-color: rgba(251, 146, 60, 0.3);
}

.summarizer__status--unavailable {
  background: rgba(239, 68, 68, 0.15);
  color: rgba(252, 165, 165, 1);
  border-color: rgba(239, 68, 68, 0.3);
}

.summarizer__settings {
  position: relative;
  flex-shrink: 0;
}

.summarizer__settings summary {
  border: 1px solid rgba(255, 255, 255, 0.14);
  background: rgba(255, 255, 255, 0.08);
  color: var(--color-primary, #fff);
  cursor: pointer;
  list-style: none;
}

.summarizer__settings summary::-webkit-details-marker {
  display: none;
}

.summarizer__settings[open] summary {
  background: rgba(147, 197, 253, 0.14);
  border-color: rgba(147, 197, 253, 0.3);
}

.summarizer__settings-panel {
  position: absolute;
  top: calc(100% + 0.45rem);
  right: 0;
  z-index: 5;
  width: min(420px, calc(100vw - 2rem));
  border: 1px solid rgba(255, 255, 255, 0.16);
  border-radius: 0.9rem;
  padding: 0.8rem;
  background: rgba(12, 14, 24, 0.96);
  box-shadow: 0 1.5rem 4rem rgba(0, 0, 0, 0.46);
  backdrop-filter: blur(18px);
}

.summarizer__settings-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 0.7rem;
}

.summarizer__settings-grid label,
.summarizer__context,
.summarizer__toggle {
  color: var(--color-secondary, rgba(255, 255, 255, 0.64));
  font-size: 0.74rem;
  font-weight: 750;
}

.summarizer__settings-grid label,
.summarizer__context {
  display: flex;
  flex-direction: column;
  gap: 0.34rem;
}

.summarizer__settings-grid select,
.summarizer__editor textarea {
  width: 100%;
  border: 1px solid rgba(120, 120, 120, 0.26);
  border-radius: 0.75rem;
  background: rgba(20, 20, 20, 0.45);
  color: var(--color-primary, #fff);
  font: inherit;
  outline: none;
}

.summarizer__settings-grid select {
  min-height: 2.25rem;
  padding: 0 0.65rem;
}

.summarizer__settings-grid select:focus,
.summarizer__editor textarea:focus {
  border-color: rgba(147, 197, 253, 0.46);
  box-shadow: 0 0 0 3px rgba(147, 197, 253, 0.12);
}

.summarizer__toggles {
  flex-wrap: wrap;
  gap: 0.55rem;
  margin-top: 0.75rem;
}

.summarizer__toggle {
  min-height: 2rem;
  flex: 1 1 150px;
  gap: 0.48rem;
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 0.7rem;
  padding: 0 0.58rem;
  background: rgba(255, 255, 255, 0.05);
}

.summarizer__editor {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
  gap: 0.65rem;
  padding: 0.75rem;
}

.summarizer__editor > textarea {
  flex: 1;
  min-height: 260px;
  resize: none;
  padding: 0.9rem;
  line-height: 1.5;
}

.summarizer__context textarea {
  min-height: 5.4rem;
  max-height: 8rem;
  resize: vertical;
  padding: 0.7rem;
  line-height: 1.42;
}

.summarizer__meta {
  flex-wrap: wrap;
  gap: 0.35rem 0.65rem;
  min-width: 0;
}

.summarizer__progress {
  height: 4px;
  border-radius: 999px;
  overflow: hidden;
  background: rgba(255, 255, 255, 0.12);
}

.summarizer__progress span {
  display: block;
  height: 100%;
  border-radius: inherit;
  background: rgba(147, 197, 253, 0.9);
  transition: width 0.2s ease;
}

.summarizer__error {
  margin: 0;
  margin-inline: 0.75rem;
  border: 1px solid rgba(239, 68, 68, 0.28);
  border-radius: 0.65rem;
  padding: 0.6rem 0.7rem;
  background: rgba(239, 68, 68, 0.12);
  color: rgba(252, 165, 165, 1);
  font-size: 0.82rem;
  line-height: 1.35;
}

.summarizer__footer button {
  flex-shrink: 0;
  border: 1px solid rgba(255, 255, 255, 0.16);
  background: linear-gradient(180deg, rgba(255, 255, 255, 0.18), rgba(255, 255, 255, 0.09));
  color: var(--color-primary, #fff);
  font-weight: 800;
  cursor: pointer;
}

.summarizer__footer button:disabled,
.summarizer__editor textarea:disabled,
.summarizer__settings-grid select:disabled,
.summarizer__toggle input:disabled {
  cursor: not-allowed;
  opacity: 0.58;
}

.summarizer__output {
  flex: 1;
  min-height: 0;
  overflow: auto;
  display: flex;
  flex-direction: column;
  padding: 0.85rem;
  user-select: text;
}

.summarizer__output pre,
.summarizer__output p {
  margin: 0;
  white-space: pre-wrap;
  color: var(--color-primary, #fff);
  font: inherit;
  line-height: 1.5;
}

.summarizer__output p {
  color: var(--color-secondary, rgba(255, 255, 255, 0.62));
}

.summarizer__output p:only-child {
  flex: 1;
  min-height: 180px;
  display: grid;
  place-items: center;
  padding: 2rem;
  border: 1px dashed rgba(167, 139, 250, 0.16);
  border-radius: 0.75rem;
  background: radial-gradient(circle at center, rgba(124, 92, 228, 0.08), transparent 62%);
  text-align: center;
}

@media (max-width: 980px) {
  .summarizer__workspace {
    grid-template-columns: 1fr;
  }

  .summarizer__pane--output {
    min-height: 280px;
  }
}

@media (max-width: 700px) {
  .summarizer {
    padding: 0.35rem;
  }

  .summarizer__toolbar,
  .summarizer__footer {
    align-items: stretch;
    flex-direction: column;
  }

  .summarizer__toolbar-actions {
    justify-content: space-between;
  }

  .summarizer__config {
    max-width: 100%;
  }

  .summarizer__settings {
    position: static;
  }

  .summarizer__settings-panel {
    right: auto;
    left: 0.35rem;
    width: calc(100vw - 1.4rem);
  }

  .summarizer__settings-grid {
    grid-template-columns: 1fr;
  }

  .summarizer__editor > textarea {
    min-height: 220px;
  }
}
</style>
