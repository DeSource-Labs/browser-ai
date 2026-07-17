<template>
  <div class="language-detector">
    <div class="language-detector__workspace">
      <section
        class="language-detector__pane language-detector__pane--input"
        aria-label="Language detector input"
      >
        <div class="language-detector__toolbar">
          <div class="language-detector__toolbar-main">
            <span class="language-detector__label">Input</span>
            <span class="language-detector__config">{{
              expectedLanguagesLabel
            }}</span>
          </div>

          <div class="language-detector__toolbar-actions">
            <span
              class="language-detector__status"
              :class="{
                'language-detector__status--available':
                  availability === 'available',
                'language-detector__status--downloadable':
                  availability === 'downloadable',
                'language-detector__status--downloading':
                  availability === 'downloading',
                'language-detector__status--unavailable':
                  availability === 'unavailable',
              }"
            >
              <span class="language-detector__status-dot"></span>
              {{ operationalStatusLabel }}
            </span>

            <details class="language-detector__settings">
              <summary>Settings</summary>

              <div class="language-detector__settings-panel">
                <label
                  class="language-detector__field language-detector__field--wide"
                >
                  <span>Expected languages</span>
                  <input
                    v-model="expectedLanguagesText"
                    :disabled="isBusy"
                    placeholder="en, fr, de"
                  />
                </label>

                <label class="language-detector__field">
                  <span>Confidence</span>
                  <input
                    v-model.number="minimumConfidence"
                    :disabled="isBusy"
                    type="range"
                    min="0"
                    max="0.95"
                    step="0.01"
                  />
                </label>

                <label class="language-detector__field">
                  <span>Results</span>
                  <select v-model.number="maximumResults" :disabled="isBusy">
                    <option :value="3">Top 3</option>
                    <option :value="5">Top 5</option>
                    <option :value="8">Top 8</option>
                    <option :value="12">Top 12</option>
                  </select>
                </label>

                <label class="language-detector__field">
                  <span>Long input</span>
                  <select v-model="largeInputMode" :disabled="isBusy">
                    <option value="chunk">Chunk and merge</option>
                    <option value="sample">Sample</option>
                    <option value="never">Native only</option>
                  </select>
                </label>

                <label class="language-detector__toggle">
                  <input
                    v-model="stripHtmlInput"
                    type="checkbox"
                    :disabled="isBusy"
                  />
                  <span>Strip HTML</span>
                </label>
              </div>
            </details>
          </div>
        </div>

        <div class="language-detector__editor">
          <textarea
            v-model="sourceText"
            :disabled="disabled || isBusy"
            :placeholder="placeholder"
          ></textarea>
        </div>

        <div
          v-if="isBusy"
          class="language-detector__progress"
          role="status"
          aria-live="polite"
        >
          <span :style="{ width: `${progressPercent}%` }"></span>
        </div>

        <p v-if="errorMessage" class="language-detector__error" role="alert">
          {{ errorMessage }}
        </p>

        <div class="language-detector__footer">
          <div class="language-detector__meta">
            <span
              >{{ inputUsageLabel }} / {{ inputQuotaLabel }} tokens |
              {{ sourceText.length }} chars</span
            >
            <span>{{ Math.round(minimumConfidence * 100) }}% threshold</span>
            <span v-if="progressLabel">{{ progressLabel }}</span>
            <span v-if="lastResult?.chunked">Chunked</span>
            <span v-if="lastResult?.sampled">Sampled</span>
            <span v-if="downloadProgress > 0 && downloadProgress < 100">
              Downloading {{ downloadProgress }}%
            </span>
          </div>

          <button type="button" :disabled="!canDetect" @click="handleDetect">
            {{ isBusy ? "Detecting" : "Detect" }}
          </button>
        </div>
      </section>

      <section
        class="language-detector__pane language-detector__pane--output"
        aria-live="polite"
      >
        <div class="language-detector__toolbar">
          <div class="language-detector__toolbar-main">
            <span class="language-detector__label">Detected language</span>
            <span class="language-detector__config">{{ resultMetaLabel }}</span>
          </div>

          <button
            v-if="lastResult?.detectedLanguage"
            class="language-detector__ghost-button"
            type="button"
            @click="copyTopLanguage"
          >
            Copy code
          </button>
        </div>

        <div class="language-detector__result">
          <div v-if="lastResult" class="language-detector__hero">
            <span class="language-detector__hero-code">{{
              lastResult.detectedLanguage
            }}</span>
            <div>
              <strong>{{ lastResult.name }}</strong>
              <span
                >{{ Math.round(lastResult.confidence * 100) }}% confidence</span
              >
            </div>
          </div>

          <div v-if="displayedResults.length" class="language-detector__ranked">
            <div
              v-for="result in displayedResults"
              :key="result.detectedLanguage"
              class="language-detector__rank"
            >
              <div class="language-detector__rank-row">
                <span>{{ result.name }}</span>
                <strong>{{ result.detectedLanguage }}</strong>
                <em>{{ Math.round(result.confidence * 100) }}%</em>
              </div>
              <div class="language-detector__bar">
                <span
                  :style="{ width: `${Math.round(result.confidence * 100)}%` }"
                ></span>
              </div>
            </div>
          </div>

          <p v-else>{{ emptyOutputMessage }}</p>
        </div>
      </section>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from "vue";
import {
  getLanguageDetectorLanguageName,
  useLanguageDetector,
  type LanguageDetectorCreate,
  type LanguageDetectorLargeInputStrategy,
  type LanguageDetectorProgressState,
  type LanguageDetectorResult,
} from "../composables/useLanguageDetector";

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
  modelValue: "",
  placeholder: "Paste text to identify its language locally...",
  emptyOutputMessage: "Language results will appear here.",
  expectedInputLanguages: undefined,
  autoInit: true,
  autoCreate: true,
  stripHtml: true,
  largeInputStrategy: "chunk",
  minConfidence: 0.42,
  maxResults: 6,
  disabled: false,
});

const emit = defineEmits<{
  "update:modelValue": [value: string];
  "availability-change": [availability: Availability];
  progress: [state: LanguageDetectorProgressState];
  detect: [result: LanguageDetectorResult];
  error: [error: unknown];
}>();

const {
  availability,
  downloadProgress,
  inputUsage,
  inputQuota,
  progressState,
  results,
  lastResult,
  isProcessing,
  requestAvailability,
  detectWithDetails,
  dispose,
} = useLanguageDetector({
  expectedInputLanguages: props.expectedInputLanguages ?? [],
});

const sourceText = ref(props.modelValue);
const errorMessage = ref("");
const expectedLanguagesText = ref(
  (props.expectedInputLanguages ?? []).join(", "),
);
const stripHtmlInput = ref(props.stripHtml);
const largeInputMode = ref<LanguageDetectorLargeInputStrategy>(
  props.largeInputStrategy,
);
const minimumConfidence = ref(props.minConfidence);
const maximumResults = ref(props.maxResults);

const parsedExpectedInputLanguages = computed(() => {
  return expectedLanguagesText.value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
});

const createOptions = computed<LanguageDetectorCreate>(() => ({
  expectedInputLanguages: parsedExpectedInputLanguages.value,
}));

const expectedLanguagesLabel = computed(() => {
  if (parsedExpectedInputLanguages.value.length === 0) {
    return "All detectable languages";
  }

  return parsedExpectedInputLanguages.value
    .map((language) => getLanguageDetectorLanguageName(language))
    .join(", ");
});

const operationalStatusLabel = computed(() => {
  if (downloadProgress.value > 0 && downloadProgress.value < 100) {
    return `${downloadProgress.value}%`;
  }
  if (availability.value === "available") return "Local detector ready";
  if (availability.value === "downloadable") return "Detector model";
  if (availability.value === "downloading") return "Downloading";
  if (availability.value === "unavailable") return "Unavailable";
  return "Checking";
});

const isBusy = computed(() => props.disabled || isProcessing.value);

const canDetect = computed(() => {
  return (
    !props.disabled &&
    !isProcessing.value &&
    availability.value !== "unavailable" &&
    sourceText.value.trim().length > 0
  );
});

const displayedResults = computed(() => results.value);
const formatTokenCount = (value: number | null) => {
  if (value == null) return "-";
  if (!Number.isFinite(value)) return "unlimited";
  return value.toLocaleString();
};

const inputUsageLabel = computed(() => formatTokenCount(inputUsage.value));
const inputQuotaLabel = computed(() => formatTokenCount(inputQuota.value));

const resultMetaLabel = computed(() => {
  if (!lastResult.value) return "Ranked confidence results";
  if (lastResult.value.chunked)
    return `${lastResult.value.chunks.length} chunks analyzed`;
  if (lastResult.value.sampled) return "Representative sample analyzed";
  return `${lastResult.value.results.length} candidates`;
});

const progressLabel = computed(() => {
  const state = progressState.value;
  if (state.phase === "measuring") return "Measuring input";
  if (state.phase === "chunking") return "Preparing chunks";
  if (state.phase === "detecting") {
    if (state.totalChunks > 1) {
      return `Detecting ${state.currentChunk} / ${state.totalChunks}`;
    }
    return "Detecting language";
  }
  return "";
});

const progressPercent = computed(() => {
  const state = progressState.value;
  if (state.phase === "measuring") return 18;
  if (state.phase === "chunking") return 38;
  if (state.phase === "detecting" && state.totalChunks > 0) {
    return Math.max(
      48,
      Math.round((state.processedChunks / state.totalChunks) * 92),
    );
  }
  if (state.phase === "detecting") return 68;
  return state.phase === "ready" ? 100 : 8;
});

const handleDetect = async () => {
  if (!canDetect.value) return;

  try {
    errorMessage.value = "";

    const result = await detectWithDetails(sourceText.value, {
      createOptions: createOptions.value,
      autoCreate: props.autoCreate,
      stripHtml: stripHtmlInput.value,
      largeInputStrategy: largeInputMode.value,
      minConfidence: minimumConfidence.value,
      maxResults: maximumResults.value,
      onProgress: (state) => emit("progress", state),
    });

    emit("detect", result);
  } catch (error) {
    errorMessage.value =
      error instanceof Error
        ? error.message
        : "Unable to detect this input language.";
    emit("error", error);
  }
};

const copyTopLanguage = async () => {
  const language = lastResult.value?.detectedLanguage;
  if (!language || typeof navigator === "undefined") return;
  await navigator.clipboard?.writeText(language);
};

watch(sourceText, (value) => {
  emit("update:modelValue", value);
});

watch(
  () => props.modelValue,
  (value) => {
    if (value !== sourceText.value) {
      sourceText.value = value;
    }
  },
);

watch(
  () => props.expectedInputLanguages,
  (value) => {
    expectedLanguagesText.value = (value ?? []).join(", ");
  },
);

watch(
  availability,
  (value) => {
    if (value) {
      emit("availability-change", value);
    }
  },
  { immediate: true },
);

watch(
  createOptions,
  async (options) => {
    if (!props.autoInit) return;
    await requestAvailability(options);
  },
  { deep: true },
);

onMounted(async () => {
  if (!props.autoInit) return;
  await requestAvailability(createOptions.value);
});

onBeforeUnmount(() => {
  dispose();
});
</script>

<style scoped>
.language-detector {
  width: 100%;
  height: 100%;
  min-height: 0;
  box-sizing: border-box;
  padding: 0.5rem;
  color: var(--color-primary, #fff);
  pointer-events: all;
}

.language-detector__workspace {
  height: 100%;
  min-height: 0;
  display: grid;
  grid-template-columns: minmax(0, 1.05fr) minmax(320px, 0.95fr);
  gap: 0.75rem;
}

.language-detector__pane {
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

.language-detector__toolbar,
.language-detector__toolbar-main,
.language-detector__toolbar-actions,
.language-detector__footer,
.language-detector__meta,
.language-detector__toggle,
.language-detector__hero,
.language-detector__rank-row {
  display: flex;
  align-items: center;
  min-width: 0;
}

.language-detector__toolbar,
.language-detector__footer {
  justify-content: space-between;
  gap: 0.75rem;
  padding: 0.75rem;
  border-bottom: 1px solid rgba(255, 255, 255, 0.09);
}

.language-detector__footer {
  border-top: 1px solid rgba(255, 255, 255, 0.09);
  border-bottom: none;
  background: rgba(5, 7, 12, 0.42);
}

.language-detector__toolbar-main {
  flex-direction: column;
  align-items: flex-start;
  gap: 0.18rem;
}

.language-detector__toolbar-actions {
  justify-content: flex-end;
  gap: 0.5rem;
  flex-shrink: 0;
}

.language-detector__label {
  color: var(--color-primary, #fff);
  font-size: 0.86rem;
  font-weight: 800;
  line-height: 1.15;
}

.language-detector__config,
.language-detector__meta {
  color: var(--color-secondary, rgba(255, 255, 255, 0.62));
  font-size: 0.74rem;
  line-height: 1.3;
}

.language-detector__config {
  max-width: min(48vw, 520px);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.language-detector__status,
.language-detector__ghost-button,
.language-detector__settings summary,
.language-detector__footer button {
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

.language-detector__status {
  gap: 0.38rem;
  border: 1px solid rgba(120, 120, 120, 0.32);
  background: rgba(255, 255, 255, 0.06);
  color: rgba(255, 255, 255, 0.72);
}

.language-detector__status-dot {
  width: 0.44rem;
  height: 0.44rem;
  border-radius: 999px;
  background: currentColor;
  box-shadow: 0 0 0.75rem currentColor;
}

.language-detector__status--available {
  background: rgba(34, 197, 94, 0.15);
  color: rgba(134, 239, 172, 1);
  border-color: rgba(34, 197, 94, 0.3);
}

.language-detector__status--downloadable {
  background: rgba(59, 130, 246, 0.15);
  color: rgba(147, 197, 253, 1);
  border-color: rgba(59, 130, 246, 0.3);
}

.language-detector__status--downloading {
  background: rgba(251, 146, 60, 0.15);
  color: rgba(254, 215, 170, 1);
  border-color: rgba(251, 146, 60, 0.3);
}

.language-detector__status--unavailable {
  background: rgba(239, 68, 68, 0.15);
  color: rgba(252, 165, 165, 1);
  border-color: rgba(239, 68, 68, 0.3);
}

.language-detector__settings {
  position: relative;
  flex-shrink: 0;
}

.language-detector__settings summary,
.language-detector__ghost-button {
  border: 1px solid rgba(255, 255, 255, 0.14);
  background: rgba(255, 255, 255, 0.08);
  color: var(--color-primary, #fff);
  cursor: pointer;
  list-style: none;
}

.language-detector__settings summary::-webkit-details-marker {
  display: none;
}

.language-detector__settings[open] summary {
  background: rgba(147, 197, 253, 0.14);
  border-color: rgba(147, 197, 253, 0.3);
}

.language-detector__settings-panel {
  position: absolute;
  top: calc(100% + 0.45rem);
  right: 0;
  z-index: 5;
  width: min(460px, calc(100vw - 2rem));
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 0.7rem;
  border: 1px solid rgba(255, 255, 255, 0.16);
  border-radius: 0.9rem;
  padding: 0.8rem;
  background: rgba(12, 14, 24, 0.96);
  box-shadow: 0 1.5rem 4rem rgba(0, 0, 0, 0.46);
  backdrop-filter: blur(18px);
}

.language-detector__field,
.language-detector__toggle {
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
  color: var(--color-secondary, rgba(255, 255, 255, 0.64));
  font-size: 0.72rem;
  font-weight: 750;
}

.language-detector__field--wide {
  grid-column: 1 / -1;
}

.language-detector__field input,
.language-detector__field select,
.language-detector__editor textarea {
  width: 100%;
  border: 1px solid rgba(120, 120, 120, 0.26);
  border-radius: 0.75rem;
  background: rgba(20, 20, 20, 0.45);
  color: var(--color-primary, #fff);
  font: inherit;
  outline: none;
}

.language-detector__field input:not([type="range"]),
.language-detector__field select {
  min-height: 2.3rem;
  padding: 0 0.65rem;
}

.language-detector__field input:focus,
.language-detector__field select:focus,
.language-detector__editor textarea:focus {
  border-color: rgba(147, 197, 253, 0.46);
  box-shadow: 0 0 0 3px rgba(147, 197, 253, 0.12);
}

.language-detector__toggle {
  min-height: 2.3rem;
  flex-direction: row;
  align-items: center;
  gap: 0.48rem;
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 0.7rem;
  padding: 0 0.58rem;
  background: rgba(255, 255, 255, 0.05);
}

.language-detector__editor {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
  padding: 0.75rem;
}

.language-detector__editor > textarea {
  flex: 1;
  min-height: 340px;
  resize: none;
  padding: 0.9rem;
  line-height: 1.5;
}

.language-detector__meta {
  flex-wrap: wrap;
  gap: 0.35rem 0.65rem;
  min-width: 0;
}

.language-detector__progress {
  height: 4px;
  overflow: hidden;
  background: rgba(255, 255, 255, 0.12);
}

.language-detector__progress span {
  display: block;
  height: 100%;
  border-radius: inherit;
  background: rgba(147, 197, 253, 0.9);
  transition: width 0.2s ease;
}

.language-detector__error {
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

.language-detector__footer button {
  flex-shrink: 0;
  border: 1px solid rgba(255, 255, 255, 0.16);
  background: linear-gradient(
    180deg,
    rgba(255, 255, 255, 0.18),
    rgba(255, 255, 255, 0.09)
  );
  color: var(--color-primary, #fff);
  font-weight: 800;
  cursor: pointer;
}

.language-detector__footer button:disabled,
.language-detector__editor textarea:disabled,
.language-detector__field input:disabled,
.language-detector__field select:disabled,
.language-detector__toggle input:disabled {
  cursor: not-allowed;
  opacity: 0.58;
}

.language-detector__result {
  flex: 1;
  min-height: 0;
  overflow: auto;
  display: flex;
  flex-direction: column;
  gap: 0.8rem;
  padding: 0.85rem;
}

.language-detector__result p {
  margin: 0;
  color: var(--color-secondary, rgba(255, 255, 255, 0.62));
  line-height: 1.5;
}

.language-detector__hero {
  gap: 0.75rem;
  border: 1px solid rgba(147, 197, 253, 0.2);
  border-radius: 0.8rem;
  padding: 0.85rem;
  background: rgba(59, 130, 246, 0.09);
}

.language-detector__hero-code {
  min-width: 4.2rem;
  min-height: 3.3rem;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: 0.75rem;
  background: rgba(255, 255, 255, 0.1);
  color: var(--color-primary, #fff);
  font-size: 1.35rem;
  font-weight: 850;
}

.language-detector__hero div {
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 0.18rem;
}

.language-detector__hero strong {
  color: var(--color-primary, #fff);
  font-size: 1.05rem;
}

.language-detector__hero span:not(.language-detector__hero-code) {
  color: var(--color-secondary, rgba(255, 255, 255, 0.62));
  font-size: 0.82rem;
}

.language-detector__ranked {
  display: flex;
  flex-direction: column;
  gap: 0.65rem;
}

.language-detector__rank {
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 0.7rem;
  padding: 0.65rem;
  background: rgba(255, 255, 255, 0.045);
}

.language-detector__rank-row {
  gap: 0.5rem;
  justify-content: space-between;
  color: var(--color-primary, #fff);
  font-size: 0.82rem;
}

.language-detector__rank-row span {
  min-width: 0;
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-weight: 750;
}

.language-detector__rank-row strong,
.language-detector__rank-row em {
  flex-shrink: 0;
  color: var(--color-secondary, rgba(255, 255, 255, 0.64));
  font-size: 0.75rem;
  font-style: normal;
}

.language-detector__bar {
  height: 0.34rem;
  margin-top: 0.5rem;
  overflow: hidden;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.1);
}

.language-detector__bar span {
  display: block;
  height: 100%;
  border-radius: inherit;
  background: rgba(147, 197, 253, 0.88);
}

@media (max-width: 980px) {
  .language-detector__workspace {
    grid-template-columns: 1fr;
  }

  .language-detector__pane--output {
    min-height: 280px;
  }
}

@media (max-width: 700px) {
  .language-detector {
    padding: 0.35rem;
  }

  .language-detector__toolbar,
  .language-detector__footer {
    align-items: stretch;
    flex-direction: column;
  }

  .language-detector__toolbar-actions {
    justify-content: space-between;
  }

  .language-detector__config {
    max-width: 100%;
  }

  .language-detector__settings {
    position: static;
  }

  .language-detector__settings-panel {
    right: auto;
    left: 0.35rem;
    grid-template-columns: 1fr;
    width: calc(100vw - 1.4rem);
  }

  .language-detector__editor > textarea {
    min-height: 260px;
  }
}
</style>
