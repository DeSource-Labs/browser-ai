<template>
  <div class="proofreader">
    <div class="proofreader__workspace">
      <section
        class="proofreader__pane proofreader__pane--input"
        aria-label="Proofreader input"
      >
        <div class="proofreader__toolbar">
          <div class="proofreader__toolbar-main">
            <span class="proofreader__label">Draft</span>
            <span class="proofreader__config">{{
              expectedLanguagesLabel
            }}</span>
          </div>

          <div class="proofreader__toolbar-actions">
            <span
              class="proofreader__status"
              :class="{
                'proofreader__status--available': availability === 'available',
                'proofreader__status--downloadable':
                  availability === 'downloadable',
                'proofreader__status--downloading':
                  availability === 'downloading',
                'proofreader__status--unavailable':
                  availability === 'unavailable',
              }"
            >
              <span class="proofreader__status-dot"></span>
              {{ operationalStatusLabel }}
            </span>

            <details class="proofreader__settings">
              <summary>Settings</summary>

              <div class="proofreader__settings-panel">
                <label class="proofreader__field proofreader__field--wide">
                  <span>Expected languages</span>
                  <input
                    v-model="expectedLanguagesText"
                    :disabled="isBusy"
                    placeholder="en, fr, de"
                  />
                </label>

                <label class="proofreader__field">
                  <span>Long input</span>
                  <select v-model="largeInputMode" :disabled="isBusy">
                    <option value="auto">Split when needed</option>
                    <option value="never">Native only</option>
                  </select>
                </label>

                <label class="proofreader__field">
                  <span>Chunk size</span>
                  <select
                    v-model.number="chunkCharacterLimit"
                    :disabled="isBusy"
                  >
                    <option :value="4000">4k chars</option>
                    <option :value="8000">8k chars</option>
                    <option :value="12000">12k chars</option>
                    <option :value="16000">16k chars</option>
                  </select>
                </label>

                <label class="proofreader__field">
                  <span>Explanation language</span>
                  <input
                    v-model="explanationLanguage"
                    :disabled="isBusy || !includeExplanations"
                    placeholder="en"
                  />
                </label>

                <div class="proofreader__toggles">
                  <label class="proofreader__toggle">
                    <input
                      v-model="stripHtmlInput"
                      type="checkbox"
                      :disabled="isBusy"
                    />
                    <span>Strip HTML</span>
                  </label>

                  <label class="proofreader__toggle">
                    <input
                      v-model="includeTypes"
                      type="checkbox"
                      :disabled="isBusy"
                    />
                    <span>Correction types</span>
                  </label>

                  <label class="proofreader__toggle">
                    <input
                      v-model="includeExplanations"
                      type="checkbox"
                      :disabled="isBusy"
                    />
                    <span>Explanations</span>
                  </label>
                </div>
              </div>
            </details>
          </div>
        </div>

        <div class="proofreader__editor">
          <textarea
            v-model="sourceText"
            :disabled="disabled || isBusy"
            :placeholder="placeholder"
          ></textarea>
        </div>

        <div
          v-if="isBusy"
          class="proofreader__progress"
          role="status"
          aria-live="polite"
        >
          <span :style="{ width: `${progressPercent}%` }"></span>
        </div>

        <p v-if="errorMessage" class="proofreader__error" role="alert">
          {{ errorMessage }}
        </p>

        <div class="proofreader__footer">
          <div class="proofreader__meta">
            <span>{{ sourceText.length.toLocaleString() }} chars</span>
            <span>{{ correctionCountLabel }}</span>
            <span v-if="progressLabel">{{ progressLabel }}</span>
            <span v-if="lastResult?.chunked">Chunked</span>
            <span v-if="downloadProgress > 0 && downloadProgress < 100">
              Downloading {{ downloadProgress }}%
            </span>
          </div>

          <button
            type="button"
            :disabled="!canProofread"
            @click="handleProofread"
          >
            {{ isBusy ? "Checking" : "Proofread" }}
          </button>
        </div>
      </section>

      <section
        class="proofreader__pane proofreader__pane--output"
        aria-live="polite"
      >
        <div class="proofreader__toolbar">
          <div class="proofreader__toolbar-main">
            <span class="proofreader__label">Corrected text</span>
            <span class="proofreader__config">{{ resultMetaLabel }}</span>
          </div>

          <button
            v-if="lastResult?.correctedInput"
            class="proofreader__ghost-button"
            type="button"
            @click="copyCorrectedText"
          >
            Copy
          </button>
        </div>

        <div class="proofreader__output">
          <div v-if="lastResult" class="proofreader__corrected">
            <template
              v-for="(segment, index) in correctedSegments"
              :key="index"
            >
              <span
                v-if="segment.correction"
                class="proofreader__segment proofreader__segment--correction"
                :title="getCorrectionTitle(segment.correction)"
              >
                {{ segment.correctedText }}
              </span>
              <span v-else>{{ segment.text }}</span>
            </template>
          </div>
          <p v-else>{{ emptyOutputMessage }}</p>

          <div v-if="corrections.length" class="proofreader__corrections">
            <article
              v-for="correction in corrections"
              :key="`${correction.startIndex}-${correction.endIndex}-${correction.index}`"
              class="proofreader__correction"
            >
              <div class="proofreader__correction-main">
                <span>{{ correction.original }}</span>
                <strong>{{ correction.correction }}</strong>
              </div>

              <div class="proofreader__correction-meta">
                <span v-if="correction.types.length">
                  {{ correction.types.join(", ") }}
                </span>
                <span
                  >{{ correction.startIndex }}-{{ correction.endIndex }}</span
                >
              </div>

              <p v-if="correction.explanation">
                {{ correction.explanation }}
              </p>
            </article>
          </div>
        </div>
      </section>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from "vue";
import {
  getProofreaderLanguageName,
  useProofreader,
  type NormalizedProofreadCorrection,
  type ProofreaderCreate,
  type ProofreaderLargeInputStrategy,
  type ProofreaderProgressState,
  type ProofreaderResult,
} from "../composables/useProofreader";

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
  disabled?: boolean;
}

const props = withDefaults(defineProps<Props>(), {
  modelValue: "",
  placeholder:
    "Paste text to check grammar, spelling, and punctuation locally...",
  emptyOutputMessage: "Corrected output will appear here.",
  expectedInputLanguages: undefined,
  includeCorrectionTypes: false,
  includeCorrectionExplanations: false,
  correctionExplanationLanguage: "en",
  autoInit: true,
  autoCreate: true,
  stripHtml: true,
  largeInputStrategy: "auto",
  maxChunkCharacters: 8000,
  disabled: false,
});

const emit = defineEmits<{
  "update:modelValue": [value: string];
  "availability-change": [availability: Availability];
  progress: [state: ProofreaderProgressState];
  proofread: [result: ProofreaderResult];
  error: [error: unknown];
}>();

const {
  availability,
  downloadProgress,
  progressState,
  corrections,
  lastResult,
  isProcessing,
  requestAvailability,
  proofreadWithDetails,
  createProofreadTextSegments,
  dispose,
} = useProofreader({
  expectedInputLanguages: props.expectedInputLanguages ?? [],
  includeCorrectionTypes: props.includeCorrectionTypes,
  includeCorrectionExplanations: props.includeCorrectionExplanations,
  correctionExplanationLanguage: props.correctionExplanationLanguage,
});

const sourceText = ref(props.modelValue);
const errorMessage = ref("");
const expectedLanguagesText = ref(
  (props.expectedInputLanguages ?? []).join(", "),
);
const includeTypes = ref(props.includeCorrectionTypes);
const includeExplanations = ref(props.includeCorrectionExplanations);
const explanationLanguage = ref(props.correctionExplanationLanguage);
const stripHtmlInput = ref(props.stripHtml);
const largeInputMode = ref<ProofreaderLargeInputStrategy>(
  props.largeInputStrategy,
);
const chunkCharacterLimit = ref(props.maxChunkCharacters);

const parsedExpectedInputLanguages = computed(() => {
  return expectedLanguagesText.value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
});

const createOptions = computed<ProofreaderCreate>(() => ({
  expectedInputLanguages: parsedExpectedInputLanguages.value,
  includeCorrectionTypes: includeTypes.value,
  includeCorrectionExplanations: includeExplanations.value,
  correctionExplanationLanguage: includeExplanations.value
    ? explanationLanguage.value
    : undefined,
}));

const expectedLanguagesLabel = computed(() => {
  if (parsedExpectedInputLanguages.value.length === 0) {
    return "Any supported language";
  }

  return parsedExpectedInputLanguages.value
    .map((language) => getProofreaderLanguageName(language))
    .join(", ");
});

const operationalStatusLabel = computed(() => {
  if (downloadProgress.value > 0 && downloadProgress.value < 100) {
    return `${downloadProgress.value}%`;
  }
  if (availability.value === "available") return "Local proofreader ready";
  if (availability.value === "downloadable") return "Proofreader model";
  if (availability.value === "downloading") return "Downloading";
  if (availability.value === "unavailable") return "Unavailable";
  return "Checking";
});

const isBusy = computed(() => props.disabled || isProcessing.value);

const canProofread = computed(() => {
  return (
    !props.disabled &&
    !isProcessing.value &&
    availability.value !== "unavailable" &&
    sourceText.value.trim().length > 0
  );
});

const correctionCountLabel = computed(() => {
  const count = corrections.value.length;
  if (count === 1) return "1 correction";
  return `${count} corrections`;
});

const resultMetaLabel = computed(() => {
  if (!lastResult.value) return "Corrections and final text";
  if (!lastResult.value.hasCorrections) return "No changes suggested";
  if (lastResult.value.chunked)
    return `${lastResult.value.chunks.length} chunks checked`;
  return correctionCountLabel.value;
});

const progressLabel = computed(() => {
  const state = progressState.value;
  if (state.phase === "measuring") return "Preparing input";
  if (state.phase === "chunking") return "Splitting long text";
  if (state.phase === "proofreading") {
    if (state.totalChunks > 1) {
      return `Checking ${state.currentChunk} / ${state.totalChunks}`;
    }
    return "Checking text";
  }
  return "";
});

const progressPercent = computed(() => {
  const state = progressState.value;
  if (state.phase === "measuring") return 18;
  if (state.phase === "chunking") return 35;
  if (state.phase === "proofreading" && state.totalChunks > 0) {
    return Math.max(
      48,
      Math.round((state.processedChunks / state.totalChunks) * 92),
    );
  }
  if (state.phase === "proofreading") return 68;
  return state.phase === "ready" ? 100 : 8;
});

const correctedSegments = computed(() => {
  if (!lastResult.value) return [];
  return createProofreadTextSegments(
    lastResult.value.input,
    lastResult.value.corrections,
  );
});

const getCorrectionTitle = (correction: NormalizedProofreadCorrection) => {
  const parts = [
    `Replace "${correction.original}" with "${correction.correction}"`,
  ];
  if (correction.types.length) parts.push(correction.types.join(", "));
  if (correction.explanation) parts.push(correction.explanation);
  return parts.join("\n");
};

const handleProofread = async () => {
  if (!canProofread.value) return;

  try {
    errorMessage.value = "";

    const result = await proofreadWithDetails(sourceText.value, {
      createOptions: createOptions.value,
      autoCreate: props.autoCreate,
      stripHtml: stripHtmlInput.value,
      largeInputStrategy: largeInputMode.value,
      maxChunkCharacters: chunkCharacterLimit.value,
      onProgress: (state) => emit("progress", state),
    });

    emit("proofread", result);
  } catch (error) {
    errorMessage.value =
      error instanceof Error
        ? error.message
        : "Unable to proofread this input.";
    emit("error", error);
  }
};

const copyCorrectedText = async () => {
  const corrected = lastResult.value?.correctedInput;
  if (!corrected || typeof navigator === "undefined") return;
  await navigator.clipboard?.writeText(corrected);
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
.proofreader {
  width: 100%;
  height: 100%;
  min-height: 0;
  box-sizing: border-box;
  padding: 0.5rem;
  color: var(--color-primary, #fff);
  pointer-events: all;
}

.proofreader__workspace {
  height: 100%;
  min-height: 0;
  display: grid;
  grid-template-columns: minmax(0, 1.02fr) minmax(340px, 0.98fr);
  gap: 0.75rem;
}

.proofreader__pane {
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

.proofreader__toolbar,
.proofreader__toolbar-main,
.proofreader__toolbar-actions,
.proofreader__footer,
.proofreader__meta,
.proofreader__toggle,
.proofreader__correction-main,
.proofreader__correction-meta {
  display: flex;
  align-items: center;
  min-width: 0;
}

.proofreader__toolbar,
.proofreader__footer {
  justify-content: space-between;
  gap: 0.75rem;
  padding: 0.75rem;
  border-bottom: 1px solid rgba(255, 255, 255, 0.09);
}

.proofreader__footer {
  border-top: 1px solid rgba(255, 255, 255, 0.09);
  border-bottom: none;
  background: rgba(5, 7, 12, 0.42);
}

.proofreader__toolbar-main {
  flex-direction: column;
  align-items: flex-start;
  gap: 0.18rem;
}

.proofreader__toolbar-actions {
  justify-content: flex-end;
  gap: 0.5rem;
  flex-shrink: 0;
}

.proofreader__label {
  color: var(--color-primary, #fff);
  font-size: 0.86rem;
  font-weight: 800;
  line-height: 1.15;
}

.proofreader__config,
.proofreader__meta {
  color: var(--color-secondary, rgba(255, 255, 255, 0.62));
  font-size: 0.74rem;
  line-height: 1.3;
}

.proofreader__config {
  max-width: min(48vw, 520px);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.proofreader__status,
.proofreader__ghost-button,
.proofreader__settings summary,
.proofreader__footer button {
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

.proofreader__status {
  gap: 0.38rem;
  border: 1px solid rgba(120, 120, 120, 0.32);
  background: rgba(255, 255, 255, 0.06);
  color: rgba(255, 255, 255, 0.72);
}

.proofreader__status-dot {
  width: 0.44rem;
  height: 0.44rem;
  border-radius: 999px;
  background: currentColor;
  box-shadow: 0 0 0.75rem currentColor;
}

.proofreader__status--available {
  background: rgba(34, 197, 94, 0.15);
  color: rgba(134, 239, 172, 1);
  border-color: rgba(34, 197, 94, 0.3);
}

.proofreader__status--downloadable {
  background: rgba(59, 130, 246, 0.15);
  color: rgba(147, 197, 253, 1);
  border-color: rgba(59, 130, 246, 0.3);
}

.proofreader__status--downloading {
  background: rgba(251, 146, 60, 0.15);
  color: rgba(254, 215, 170, 1);
  border-color: rgba(251, 146, 60, 0.3);
}

.proofreader__status--unavailable {
  background: rgba(239, 68, 68, 0.15);
  color: rgba(252, 165, 165, 1);
  border-color: rgba(239, 68, 68, 0.3);
}

.proofreader__settings {
  position: relative;
  flex-shrink: 0;
}

.proofreader__settings summary,
.proofreader__ghost-button {
  border: 1px solid rgba(255, 255, 255, 0.14);
  background: rgba(255, 255, 255, 0.08);
  color: var(--color-primary, #fff);
  cursor: pointer;
  list-style: none;
}

.proofreader__settings summary::-webkit-details-marker {
  display: none;
}

.proofreader__settings[open] summary {
  background: rgba(147, 197, 253, 0.14);
  border-color: rgba(147, 197, 253, 0.3);
}

.proofreader__settings-panel {
  position: absolute;
  top: calc(100% + 0.45rem);
  right: 0;
  z-index: 5;
  width: min(520px, calc(100vw - 2rem));
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

.proofreader__field,
.proofreader__toggle {
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
  color: var(--color-secondary, rgba(255, 255, 255, 0.64));
  font-size: 0.72rem;
  font-weight: 750;
}

.proofreader__field--wide,
.proofreader__toggles {
  grid-column: 1 / -1;
}

.proofreader__toggles {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 0.55rem;
}

.proofreader__field input,
.proofreader__field select,
.proofreader__editor textarea {
  width: 100%;
  border: 1px solid rgba(120, 120, 120, 0.26);
  border-radius: 0.75rem;
  background: rgba(20, 20, 20, 0.45);
  color: var(--color-primary, #fff);
  font: inherit;
  outline: none;
}

.proofreader__field input,
.proofreader__field select {
  min-height: 2.3rem;
  padding: 0 0.65rem;
}

.proofreader__field input:focus,
.proofreader__field select:focus,
.proofreader__editor textarea:focus {
  border-color: rgba(147, 197, 253, 0.46);
  box-shadow: 0 0 0 3px rgba(147, 197, 253, 0.12);
}

.proofreader__toggle {
  min-height: 2.3rem;
  flex-direction: row;
  align-items: center;
  gap: 0.48rem;
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 0.7rem;
  padding: 0 0.58rem;
  background: rgba(255, 255, 255, 0.05);
}

.proofreader__editor {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
  padding: 0.75rem;
}

.proofreader__editor > textarea {
  flex: 1;
  min-height: 340px;
  resize: none;
  padding: 0.9rem;
  line-height: 1.5;
}

.proofreader__meta {
  flex-wrap: wrap;
  gap: 0.35rem 0.65rem;
  min-width: 0;
}

.proofreader__progress {
  height: 4px;
  overflow: hidden;
  background: rgba(255, 255, 255, 0.12);
}

.proofreader__progress span {
  display: block;
  height: 100%;
  border-radius: inherit;
  background: rgba(147, 197, 253, 0.9);
  transition: width 0.2s ease;
}

.proofreader__error {
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

.proofreader__footer button {
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

.proofreader__footer button:disabled,
.proofreader__editor textarea:disabled,
.proofreader__field input:disabled,
.proofreader__field select:disabled,
.proofreader__toggle input:disabled {
  cursor: not-allowed;
  opacity: 0.58;
}

.proofreader__output {
  flex: 1;
  min-height: 0;
  overflow: auto;
  display: flex;
  flex-direction: column;
  gap: 0.85rem;
  padding: 0.85rem;
  user-select: text;
}

.proofreader__output p {
  margin: 0;
  color: var(--color-secondary, rgba(255, 255, 255, 0.62));
  line-height: 1.5;
}

.proofreader__corrected {
  min-height: 9rem;
  border: 1px solid rgba(147, 197, 253, 0.16);
  border-radius: 0.8rem;
  padding: 0.85rem;
  background: rgba(255, 255, 255, 0.045);
  color: var(--color-primary, #fff);
  line-height: 1.58;
  white-space: pre-wrap;
}

.proofreader__segment--correction {
  border-radius: 0.28rem;
  padding: 0.02rem 0.16rem;
  background: rgba(34, 197, 94, 0.18);
  color: rgba(187, 247, 208, 1);
  box-shadow: inset 0 -1px 0 rgba(34, 197, 94, 0.5);
}

.proofreader__corrections {
  display: flex;
  flex-direction: column;
  gap: 0.65rem;
}

.proofreader__correction {
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 0.7rem;
  padding: 0.7rem;
  background: rgba(255, 255, 255, 0.045);
}

.proofreader__correction-main {
  gap: 0.55rem;
  justify-content: space-between;
}

.proofreader__correction-main span,
.proofreader__correction-main strong {
  min-width: 0;
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.proofreader__correction-main span {
  color: rgba(252, 165, 165, 0.95);
  text-decoration: line-through;
}

.proofreader__correction-main strong {
  color: rgba(134, 239, 172, 1);
  text-align: right;
}

.proofreader__correction-meta {
  flex-wrap: wrap;
  gap: 0.4rem;
  margin-top: 0.42rem;
  color: var(--color-secondary, rgba(255, 255, 255, 0.58));
  font-size: 0.72rem;
}

.proofreader__correction p {
  margin-top: 0.48rem;
  color: var(--color-secondary, rgba(255, 255, 255, 0.7));
  font-size: 0.78rem;
}

@media (max-width: 980px) {
  .proofreader__workspace {
    grid-template-columns: 1fr;
  }

  .proofreader__pane--output {
    min-height: 320px;
  }
}

@media (max-width: 700px) {
  .proofreader {
    padding: 0.35rem;
  }

  .proofreader__toolbar,
  .proofreader__footer {
    align-items: stretch;
    flex-direction: column;
  }

  .proofreader__toolbar-actions {
    justify-content: space-between;
  }

  .proofreader__config {
    max-width: 100%;
  }

  .proofreader__settings {
    position: static;
  }

  .proofreader__settings-panel,
  .proofreader__toggles {
    grid-template-columns: 1fr;
  }

  .proofreader__settings-panel {
    right: auto;
    left: 0.35rem;
    width: calc(100vw - 1.4rem);
  }

  .proofreader__editor > textarea {
    min-height: 260px;
  }
}
</style>
