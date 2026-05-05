<template>
  <div class="translator">
    <div class="translator__workspace">
      <section class="translator__pane translator__pane--input" aria-label="Translator source input">
        <div class="translator__toolbar">
          <div class="translator__toolbar-main">
            <span class="translator__label">Source</span>
            <span class="translator__config">{{ sourceLanguageLabel }} to {{ targetLanguageLabel }}</span>
          </div>

          <div class="translator__toolbar-actions">
            <span
              class="translator__status"
              :class="{
                'translator__status--available': availability === 'available',
                'translator__status--downloadable': availability === 'downloadable',
                'translator__status--downloading': availability === 'downloading',
                'translator__status--unavailable': availability === 'unavailable'
              }"
            >
              <span class="translator__status-dot"></span>
              {{ operationalStatusLabel }}
            </span>

            <details class="translator__settings">
              <summary>Settings</summary>

              <div class="translator__settings-panel">
                <div class="translator__toggles">
                  <label class="translator__toggle">
                    <input v-model="stripHtmlInput" type="checkbox" :disabled="isBusy" />
                    <span>Strip HTML</span>
                  </label>

                  <label class="translator__toggle">
                    <input v-model="chunkLargeInput" type="checkbox" :disabled="isBusy" />
                    <span>Auto chunk long text</span>
                  </label>

                  <label class="translator__toggle">
                    <input v-model="streamOutput" type="checkbox" :disabled="isBusy" />
                    <span>Stream output</span>
                  </label>
                </div>
              </div>
            </details>
          </div>
        </div>

        <div class="translator__language-bar">
          <label>
            <span>From</span>
            <select v-model="selectedSourceLanguage" :disabled="isBusy">
              <option
                v-for="language in normalizedLanguageOptions"
                :key="language.code"
                :value="language.code"
              >
                {{ language.name }}
              </option>
            </select>
          </label>

          <button type="button" :disabled="isBusy" @click="swapLanguages">
            Swap
          </button>

          <label>
            <span>To</span>
            <select v-model="selectedTargetLanguage" :disabled="isBusy">
              <option
                v-for="language in normalizedLanguageOptions"
                :key="language.code"
                :value="language.code"
              >
                {{ language.name }}
              </option>
            </select>
          </label>
        </div>

        <div class="translator__editor">
          <textarea
            v-model="sourceText"
            :disabled="disabled || isBusy"
            :placeholder="placeholder"
          ></textarea>
        </div>

        <div
          v-if="isBusy"
          class="translator__progress"
          role="status"
          aria-live="polite"
        >
          <span :style="{ width: `${progressPercent}%` }"></span>
        </div>

        <p v-if="errorMessage" class="translator__error" role="alert">
          {{ errorMessage }}
        </p>

        <div class="translator__footer">
          <div class="translator__meta">
            <span>{{ inputUsageLabel }} / {{ inputQuotaLabel }} tokens | {{ sourceText.length }} chars</span>
            <span v-if="progressLabel">{{ progressLabel }}</span>
            <span v-if="lastResult?.chunked">Chunked</span>
            <span v-if="lastResult?.bypassed">Same language</span>
            <span v-if="downloadProgress > 0 && downloadProgress < 100">
              Downloading {{ downloadProgress }}%
            </span>
          </div>

          <button type="button" :disabled="!canTranslate" @click="handleTranslate">
            {{ isBusy ? 'Translating' : 'Translate' }}
          </button>
        </div>
      </section>

      <section class="translator__pane translator__pane--output" aria-live="polite">
        <div class="translator__toolbar">
          <div class="translator__toolbar-main">
            <span class="translator__label">{{ targetLanguageLabel }}</span>
            <span class="translator__config">{{ outputMetaLabel }}</span>
          </div>

          <button
            v-if="translatedText"
            class="translator__ghost-button"
            type="button"
            @click="copyTranslation"
          >
            Copy
          </button>
        </div>

        <div class="translator__output">
          <pre v-if="translatedText">{{ translatedText }}</pre>
          <p v-else>{{ emptyOutputMessage }}</p>
        </div>
      </section>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import {
  TRANSLATOR_LANGUAGE_OPTIONS,
  getTranslatorLanguageName,
  useTranslator,
  type TranslatorCreate,
  type TranslatorLanguageOption,
  type TranslatorProgressState,
  type TranslatorResult
} from '../composables/useTranslator';

interface Props {
  modelValue?: string;
  placeholder?: string;
  emptyOutputMessage?: string;
  sourceLanguage?: string;
  targetLanguage?: string;
  languageOptions?: TranslatorLanguageOption[];
  autoInit?: boolean;
  autoCreate?: boolean;
  stripHtml?: boolean;
  chunking?: 'auto' | 'never';
  stream?: boolean;
  disabled?: boolean;
}

const props = withDefaults(defineProps<Props>(), {
  modelValue: '',
  placeholder: 'Paste text to translate locally...',
  emptyOutputMessage: 'Translation will appear here.',
  sourceLanguage: 'en',
  targetLanguage: 'es',
  languageOptions: undefined,
  autoInit: true,
  autoCreate: true,
  stripHtml: true,
  chunking: 'auto',
  stream: true,
  disabled: false
});

const emit = defineEmits<{
  'update:modelValue': [value: string];
  'availability-change': [availability: Availability];
  'progress': [state: TranslatorProgressState];
  'translate': [result: TranslatorResult];
  'error': [error: unknown];
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
  translateWithDetails,
  translateStreamingToText,
  dispose
} = useTranslator({
  sourceLanguage: props.sourceLanguage,
  targetLanguage: props.targetLanguage
});

const sourceText = ref(props.modelValue);
const translatedText = ref('');
const errorMessage = ref('');
const selectedSourceLanguage = ref(props.sourceLanguage);
const selectedTargetLanguage = ref(props.targetLanguage);
const stripHtmlInput = ref(props.stripHtml);
const streamOutput = ref(props.stream);
const chunkLargeInput = ref(props.chunking === 'auto');

const normalizedLanguageOptions = computed(() => {
  return props.languageOptions?.length ? props.languageOptions : TRANSLATOR_LANGUAGE_OPTIONS;
});

const sourceLanguageLabel = computed(() => getTranslatorLanguageName(selectedSourceLanguage.value));
const targetLanguageLabel = computed(() => getTranslatorLanguageName(selectedTargetLanguage.value));

const createOptions = computed<TranslatorCreate>(() => ({
  sourceLanguage: selectedSourceLanguage.value,
  targetLanguage: selectedTargetLanguage.value
}));

const operationalStatusLabel = computed(() => {
  if (downloadProgress.value > 0 && downloadProgress.value < 100) {
    return `${downloadProgress.value}%`;
  }
  if (availability.value === 'available') return 'Local AI ready';
  if (availability.value === 'downloadable') return 'Language pack';
  if (availability.value === 'downloading') return 'Downloading';
  if (availability.value === 'unavailable') return 'Unavailable';
  return 'Checking';
});

const outputMetaLabel = computed(() => {
  if (!translatedText.value) return `${sourceLanguageLabel.value} to ${targetLanguageLabel.value}`;
  return `${translatedText.value.length.toLocaleString()} chars`;
});

const isBusy = computed(() => props.disabled || isProcessing.value);

const canTranslate = computed(() => {
  return !props.disabled
    && !isProcessing.value
    && availability.value !== 'unavailable'
    && sourceText.value.trim().length > 0;
});

const inputUsageLabel = computed(() => inputUsage.value ?? '-');
const inputQuotaLabel = computed(() => inputQuota.value ?? '-');

const progressLabel = computed(() => {
  const state = progressState.value;
  if (state.phase === 'measuring') return 'Measuring input';
  if (state.phase === 'chunking') return 'Preparing chunks';
  if (state.phase === 'translating') {
    if (state.totalChunks > 1) {
      return `Translating ${state.currentChunk} / ${state.totalChunks}`;
    }
    return streamOutput.value ? 'Streaming translation' : 'Translating text';
  }
  return '';
});

const progressPercent = computed(() => {
  const state = progressState.value;
  if (state.phase === 'measuring') return 18;
  if (state.phase === 'chunking') return 34;
  if (state.phase === 'translating' && state.totalChunks > 0) {
    return Math.max(44, Math.round((state.processedChunks / state.totalChunks) * 88));
  }
  if (state.phase === 'translating') return 68;
  return state.phase === 'ready' ? 100 : 8;
});

const handleTranslate = async () => {
  if (!canTranslate.value) return;

  try {
    translatedText.value = '';
    errorMessage.value = '';

    const options = {
      createOptions: createOptions.value,
      autoCreate: props.autoCreate,
      stripHtml: stripHtmlInput.value,
      chunking: chunkLargeInput.value ? 'auto' as const : 'never' as const,
      onProgress: (state: TranslatorProgressState) => emit('progress', state)
    };

    if (streamOutput.value) {
      await translateStreamingToText(
        sourceText.value,
        options,
        (_chunk, accumulated) => {
          translatedText.value = accumulated;
        }
      );
      translatedText.value = lastResult.value?.translation || translatedText.value;
      if (lastResult.value) {
        emit('translate', lastResult.value);
      }
      return;
    }

    const result = await translateWithDetails(sourceText.value, options);
    translatedText.value = result.translation;
    emit('translate', result);
  } catch (error) {
    errorMessage.value = error instanceof Error
      ? error.message
      : 'Unable to translate this input.';
    emit('error', error);
  }
};

const copyTranslation = async () => {
  if (!translatedText.value || typeof navigator === 'undefined') return;
  await navigator.clipboard?.writeText(translatedText.value);
};

const swapLanguages = () => {
  const nextSource = selectedTargetLanguage.value;
  selectedTargetLanguage.value = selectedSourceLanguage.value;
  selectedSourceLanguage.value = nextSource;

  if (translatedText.value) {
    sourceText.value = translatedText.value;
    translatedText.value = '';
  }
};

watch(sourceText, (value) => {
  emit('update:modelValue', value);
});

watch(() => props.modelValue, (value) => {
  if (value !== sourceText.value) {
    sourceText.value = value;
  }
});

watch(() => props.sourceLanguage, (value) => {
  selectedSourceLanguage.value = value;
});

watch(() => props.targetLanguage, (value) => {
  selectedTargetLanguage.value = value;
});

watch(availability, (value) => {
  if (value) {
    emit('availability-change', value);
  }
}, { immediate: true });

watch(createOptions, async (options) => {
  if (!props.autoInit) return;
  await requestAvailability(options);
}, { deep: true });

onMounted(async () => {
  if (!props.autoInit) return;
  await requestAvailability(createOptions.value);
});

onBeforeUnmount(() => {
  dispose();
});
</script>

<style scoped>
.translator {
  width: 100%;
  height: 100%;
  min-height: 0;
  box-sizing: border-box;
  padding: 0.5rem;
  color: var(--color-primary, #fff);
  pointer-events: all;
}

.translator__workspace {
  height: 100%;
  min-height: 0;
  display: grid;
  grid-template-columns: minmax(0, 1.05fr) minmax(320px, 0.95fr);
  gap: 0.75rem;
}

.translator__pane {
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

.translator__toolbar,
.translator__toolbar-main,
.translator__toolbar-actions,
.translator__footer,
.translator__meta,
.translator__toggles,
.translator__toggle,
.translator__language-bar {
  display: flex;
  align-items: center;
  min-width: 0;
}

.translator__toolbar,
.translator__footer {
  justify-content: space-between;
  gap: 0.75rem;
  padding: 0.75rem;
  border-bottom: 1px solid rgba(255, 255, 255, 0.09);
}

.translator__footer {
  border-top: 1px solid rgba(255, 255, 255, 0.09);
  border-bottom: none;
  background: rgba(5, 7, 12, 0.42);
}

.translator__toolbar-main {
  flex-direction: column;
  align-items: flex-start;
  gap: 0.18rem;
}

.translator__toolbar-actions {
  justify-content: flex-end;
  gap: 0.5rem;
  flex-shrink: 0;
}

.translator__label {
  color: var(--color-primary, #fff);
  font-size: 0.86rem;
  font-weight: 800;
  line-height: 1.15;
}

.translator__config,
.translator__meta {
  color: var(--color-secondary, rgba(255, 255, 255, 0.62));
  font-size: 0.74rem;
  line-height: 1.3;
}

.translator__config {
  max-width: min(48vw, 520px);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.translator__status,
.translator__ghost-button,
.translator__settings summary,
.translator__footer button,
.translator__language-bar button {
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

.translator__status {
  gap: 0.38rem;
  border: 1px solid rgba(120, 120, 120, 0.32);
  background: rgba(255, 255, 255, 0.06);
  color: rgba(255, 255, 255, 0.72);
}

.translator__status-dot {
  width: 0.44rem;
  height: 0.44rem;
  border-radius: 999px;
  background: currentColor;
  box-shadow: 0 0 0.75rem currentColor;
}

.translator__status--available {
  background: rgba(34, 197, 94, 0.15);
  color: rgba(134, 239, 172, 1);
  border-color: rgba(34, 197, 94, 0.3);
}

.translator__status--downloadable {
  background: rgba(59, 130, 246, 0.15);
  color: rgba(147, 197, 253, 1);
  border-color: rgba(59, 130, 246, 0.3);
}

.translator__status--downloading {
  background: rgba(251, 146, 60, 0.15);
  color: rgba(254, 215, 170, 1);
  border-color: rgba(251, 146, 60, 0.3);
}

.translator__status--unavailable {
  background: rgba(239, 68, 68, 0.15);
  color: rgba(252, 165, 165, 1);
  border-color: rgba(239, 68, 68, 0.3);
}

.translator__settings {
  position: relative;
  flex-shrink: 0;
}

.translator__settings summary,
.translator__ghost-button,
.translator__language-bar button {
  border: 1px solid rgba(255, 255, 255, 0.14);
  background: rgba(255, 255, 255, 0.08);
  color: var(--color-primary, #fff);
  cursor: pointer;
  list-style: none;
}

.translator__settings summary::-webkit-details-marker {
  display: none;
}

.translator__settings[open] summary {
  background: rgba(147, 197, 253, 0.14);
  border-color: rgba(147, 197, 253, 0.3);
}

.translator__settings-panel {
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

.translator__toggles {
  flex-wrap: wrap;
  gap: 0.55rem;
}

.translator__toggle {
  min-height: 2rem;
  flex: 1 1 150px;
  gap: 0.48rem;
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 0.7rem;
  padding: 0 0.58rem;
  background: rgba(255, 255, 255, 0.05);
  color: var(--color-secondary, rgba(255, 255, 255, 0.64));
  font-size: 0.74rem;
  font-weight: 750;
}

.translator__language-bar {
  gap: 0.65rem;
  padding: 0.75rem;
  border-bottom: 1px solid rgba(255, 255, 255, 0.09);
  background: rgba(5, 7, 12, 0.26);
}

.translator__language-bar label {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 0.3rem;
  color: var(--color-secondary, rgba(255, 255, 255, 0.64));
  font-size: 0.72rem;
  font-weight: 750;
}

.translator__language-bar select,
.translator__editor textarea {
  width: 100%;
  border: 1px solid rgba(120, 120, 120, 0.26);
  border-radius: 0.75rem;
  background: rgba(20, 20, 20, 0.45);
  color: var(--color-primary, #fff);
  font: inherit;
  outline: none;
}

.translator__language-bar select {
  min-height: 2.3rem;
  padding: 0 0.65rem;
}

.translator__language-bar select:focus,
.translator__editor textarea:focus {
  border-color: rgba(147, 197, 253, 0.46);
  box-shadow: 0 0 0 3px rgba(147, 197, 253, 0.12);
}

.translator__editor {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
  padding: 0.75rem;
}

.translator__editor > textarea {
  flex: 1;
  min-height: 260px;
  resize: none;
  padding: 0.9rem;
  line-height: 1.5;
}

.translator__meta {
  flex-wrap: wrap;
  gap: 0.35rem 0.65rem;
  min-width: 0;
}

.translator__progress {
  height: 4px;
  overflow: hidden;
  background: rgba(255, 255, 255, 0.12);
}

.translator__progress span {
  display: block;
  height: 100%;
  border-radius: inherit;
  background: rgba(147, 197, 253, 0.9);
  transition: width 0.2s ease;
}

.translator__error {
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

.translator__footer button {
  flex-shrink: 0;
  border: 1px solid rgba(255, 255, 255, 0.16);
  background: linear-gradient(180deg, rgba(255, 255, 255, 0.18), rgba(255, 255, 255, 0.09));
  color: var(--color-primary, #fff);
  font-weight: 800;
  cursor: pointer;
}

.translator__footer button:disabled,
.translator__editor textarea:disabled,
.translator__language-bar select:disabled,
.translator__language-bar button:disabled,
.translator__toggle input:disabled {
  cursor: not-allowed;
  opacity: 0.58;
}

.translator__output {
  flex: 1;
  min-height: 0;
  overflow: auto;
  padding: 0.85rem;
}

.translator__output pre,
.translator__output p {
  margin: 0;
  white-space: pre-wrap;
  color: var(--color-primary, #fff);
  font: inherit;
  line-height: 1.5;
}

.translator__output p {
  color: var(--color-secondary, rgba(255, 255, 255, 0.62));
}

@media (max-width: 980px) {
  .translator__workspace {
    grid-template-columns: 1fr;
  }

  .translator__pane--output {
    min-height: 280px;
  }
}

@media (max-width: 700px) {
  .translator {
    padding: 0.35rem;
  }

  .translator__toolbar,
  .translator__footer,
  .translator__language-bar {
    align-items: stretch;
    flex-direction: column;
  }

  .translator__toolbar-actions {
    justify-content: space-between;
  }

  .translator__config {
    max-width: 100%;
  }

  .translator__settings {
    position: static;
  }

  .translator__settings-panel {
    right: auto;
    left: 0.35rem;
    width: calc(100vw - 1.4rem);
  }

  .translator__editor > textarea {
    min-height: 220px;
  }
}
</style>
