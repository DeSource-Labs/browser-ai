<template>
  <div class="writer">
    <div class="writer__workspace">
      <section
        class="writer__pane writer__pane--input"
        aria-label="Writer task input"
      >
        <div class="writer__toolbar">
          <div class="writer__toolbar-main">
            <span class="writer__label">Task</span>
            <span class="writer__config">{{ settingsSummary }}</span>
          </div>

          <div class="writer__toolbar-actions">
            <span
              class="writer__status"
              :class="{
                'writer__status--available': availability === 'available',
                'writer__status--downloadable': availability === 'downloadable',
                'writer__status--downloading': availability === 'downloading',
                'writer__status--unavailable': availability === 'unavailable',
              }"
            >
              <span class="writer__status-dot"></span>
              {{ operationalStatusLabel }}
            </span>

            <details class="writer__settings">
              <summary>Settings</summary>

              <div class="writer__settings-panel">
                <div class="writer__settings-grid">
                  <label>
                    Tone
                    <select v-model="selectedTone" :disabled="isBusy">
                      <option value="neutral">Neutral</option>
                      <option value="formal">Formal</option>
                      <option value="casual">Casual</option>
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
                    Context fit
                    <select v-model="selectedFitStrategy" :disabled="isBusy">
                      <option value="truncate-context">Fit context</option>
                      <option value="error">Require full context</option>
                    </select>
                  </label>
                </div>

                <div class="writer__toggles">
                  <label class="writer__toggle">
                    <input
                      v-model="stripHtmlInput"
                      type="checkbox"
                      :disabled="isBusy"
                    />
                    <span>Strip HTML</span>
                  </label>

                  <label class="writer__toggle">
                    <input
                      v-model="showContext"
                      type="checkbox"
                      :disabled="isBusy"
                    />
                    <span>Additional context</span>
                  </label>

                  <label class="writer__toggle">
                    <input
                      v-model="streamOutput"
                      type="checkbox"
                      :disabled="isBusy"
                    />
                    <span>Stream output</span>
                  </label>
                </div>
              </div>
            </details>
          </div>
        </div>

        <div class="writer__editor">
          <textarea
            v-model="sourceText"
            :disabled="disabled || isBusy"
            :placeholder="placeholder"
          ></textarea>

          <label v-if="showContext" class="writer__context">
            <span>Additional context</span>
            <textarea
              v-model="writeContext"
              :disabled="disabled || isBusy"
              :placeholder="contextPlaceholder"
              rows="3"
            ></textarea>
          </label>
        </div>

        <div
          v-if="isBusy"
          class="writer__progress"
          role="status"
          aria-live="polite"
        >
          <span :style="{ width: `${progressPercent}%` }"></span>
        </div>

        <p v-if="errorMessage" class="writer__error" role="alert">
          {{ errorMessage }}
        </p>

        <div class="writer__footer">
          <div class="writer__meta">
            <span
              >{{ inputUsageLabel }} / {{ inputQuotaLabel }} tokens |
              {{ sourceText.length }} chars</span
            >
            <span v-if="progressLabel">{{ progressLabel }}</span>
            <span v-if="lastResult?.fitted">Context fitted</span>
            <span v-if="downloadProgress > 0 && downloadProgress < 100">
              Downloading {{ downloadProgress }}%
            </span>
          </div>

          <button type="button" :disabled="!canWrite" @click="handleWrite">
            {{ isBusy ? "Writing" : "Write" }}
          </button>
        </div>
      </section>

      <section class="writer__pane writer__pane--output" aria-live="polite">
        <div class="writer__toolbar">
          <div class="writer__toolbar-main">
            <span class="writer__label">Draft</span>
            <span class="writer__config">{{ outputMetaLabel }}</span>
          </div>

          <button
            v-if="draft"
            class="writer__ghost-button"
            type="button"
            @click="copyDraft"
          >
            Copy
          </button>
        </div>

        <div class="writer__output">
          <pre v-if="draft">{{ draft }}</pre>
          <p v-else>{{ emptyOutputMessage }}</p>
        </div>
      </section>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from "vue";
import {
  useWriter,
  type WriterCreate,
  type WriterFitStrategy,
  type WriterProgressState,
  type WriterResult,
} from "../composables/useWriter";

interface Props {
  modelValue?: string;
  placeholder?: string;
  contextPlaceholder?: string;
  emptyOutputMessage?: string;
  tone?: WriterTone;
  format?: WriterFormat;
  length?: WriterLength;
  sharedContext?: string;
  context?: string;
  outputLanguage?: string;
  expectedInputLanguages?: string[];
  expectedContextLanguages?: string[];
  autoInit?: boolean;
  autoCreate?: boolean;
  stripHtml?: boolean;
  fitStrategy?: WriterFitStrategy;
  stream?: boolean;
  disabled?: boolean;
}

const props = withDefaults(defineProps<Props>(), {
  modelValue: "",
  placeholder: "Describe what you want to write...",
  contextPlaceholder:
    "Optional audience, constraints, facts, examples, or source material",
  emptyOutputMessage: "Generated draft will appear here.",
  tone: "neutral",
  format: "markdown",
  length: "medium",
  sharedContext: "",
  context: "",
  outputLanguage: "",
  expectedInputLanguages: undefined,
  expectedContextLanguages: undefined,
  autoInit: true,
  autoCreate: true,
  stripHtml: true,
  fitStrategy: "truncate-context",
  stream: true,
  disabled: false,
});

const emit = defineEmits<{
  "update:modelValue": [value: string];
  "availability-change": [availability: Availability];
  progress: [state: WriterProgressState];
  write: [result: WriterResult];
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
  writeWithDetails,
  writeStreamingToText,
  dispose,
} = useWriter();

const sourceText = ref(props.modelValue);
const draft = ref("");
const errorMessage = ref("");
const writeContext = ref(props.context);
const showContext = ref(Boolean(props.context));
const stripHtmlInput = ref(props.stripHtml);
const streamOutput = ref(props.stream);
const selectedTone = ref<WriterTone>(props.tone);
const selectedFormat = ref<WriterFormat>(props.format);
const selectedLength = ref<WriterLength>(props.length);
const selectedFitStrategy = ref<WriterFitStrategy>(props.fitStrategy);

const toneLabels: Record<WriterTone, string> = {
  neutral: "Neutral",
  formal: "Formal",
  casual: "Casual",
};

const lengthLabels: Record<WriterLength, string> = {
  short: "Short",
  medium: "Medium",
  long: "Long",
};

const formatLabels: Record<WriterFormat, string> = {
  markdown: "Markdown",
  "plain-text": "Plain text",
};

const fitStrategyLabels: Record<WriterFitStrategy, string> = {
  "truncate-context": "Fit context",
  error: "Full context",
};

const createOptions = computed<WriterCreate>(() => ({
  tone: selectedTone.value,
  format: selectedFormat.value,
  length: selectedLength.value,
  sharedContext: props.sharedContext || undefined,
  outputLanguage: props.outputLanguage || undefined,
  expectedInputLanguages: props.expectedInputLanguages,
  expectedContextLanguages: props.expectedContextLanguages,
}));

const coreOptions = computed<WriterCreateCoreOptions>(() => {
  const { sharedContext: _sharedContext, ...core } = createOptions.value;
  return core;
});

const operationalStatusLabel = computed(() => {
  if (downloadProgress.value > 0 && downloadProgress.value < 100) {
    return `${downloadProgress.value}%`;
  }
  if (availability.value === "available") return "Local AI ready";
  if (availability.value === "downloadable") return "Model download";
  if (availability.value === "downloading") return "Downloading";
  if (availability.value === "unavailable") return "Unavailable";
  return "Checking";
});

const settingsSummary = computed(() => {
  return [
    toneLabels[selectedTone.value],
    lengthLabels[selectedLength.value],
    formatLabels[selectedFormat.value],
    fitStrategyLabels[selectedFitStrategy.value],
  ].join(" / ");
});

const outputMetaLabel = computed(() => {
  if (!draft.value) return formatLabels[selectedFormat.value];
  return `${draft.value.length.toLocaleString()} chars`;
});

const isBusy = computed(() => props.disabled || isProcessing.value);

const canWrite = computed(() => {
  return (
    !props.disabled &&
    !isProcessing.value &&
    availability.value !== "unavailable" &&
    sourceText.value.trim().length > 0
  );
});

const inputUsageLabel = computed(() => inputUsage.value ?? "-");
const inputQuotaLabel = computed(() => inputQuota.value ?? "-");

const progressLabel = computed(() => {
  const state = progressState.value;
  if (state.phase === "measuring") return "Measuring input";
  if (state.phase === "fitting-context") return "Fitting context";
  if (state.phase === "writing")
    return streamOutput.value ? "Streaming draft" : "Writing draft";
  return "";
});

const progressPercent = computed(() => {
  const state = progressState.value;
  if (state.phase === "measuring") return 18;
  if (state.phase === "fitting-context") return 38;
  if (state.phase === "writing") return 68;
  return state.phase === "ready" ? 100 : 8;
});

const handleWrite = async () => {
  if (!canWrite.value) return;

  try {
    draft.value = "";
    errorMessage.value = "";

    const options = {
      createOptions: createOptions.value,
      autoCreate: props.autoCreate,
      context: showContext.value ? writeContext.value || undefined : undefined,
      stripHtml: stripHtmlInput.value,
      fitStrategy: selectedFitStrategy.value,
      onProgress: (state: WriterProgressState) => emit("progress", state),
    };

    if (streamOutput.value) {
      await writeStreamingToText(
        sourceText.value,
        options,
        (_chunk, accumulated) => {
          draft.value = accumulated;
        },
      );
      draft.value = lastResult.value?.text || draft.value;
      if (lastResult.value) {
        emit("write", lastResult.value);
      }
      return;
    }

    const result = await writeWithDetails(sourceText.value, options);
    draft.value = result.text;
    emit("write", result);
  } catch (error) {
    errorMessage.value =
      error instanceof Error
        ? error.message
        : "Unable to write from this input.";
    emit("error", error);
  }
};

const copyDraft = async () => {
  if (!draft.value || typeof navigator === "undefined") return;
  await navigator.clipboard?.writeText(draft.value);
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
  () => props.context,
  (value) => {
    writeContext.value = value;
    if (value) {
      showContext.value = true;
    }
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
  coreOptions,
  async (options) => {
    if (!props.autoInit) return;
    await requestAvailability(options);
  },
  { deep: true },
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
.writer {
  width: 100%;
  height: 100%;
  min-height: 0;
  box-sizing: border-box;
  padding: 0.5rem;
  color: var(--color-primary, #fff);
  pointer-events: all;
}

.writer__workspace {
  height: 100%;
  min-height: 0;
  display: grid;
  grid-template-columns: minmax(0, 1.05fr) minmax(320px, 0.95fr);
  gap: 0.75rem;
}

.writer__pane {
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

.writer__toolbar,
.writer__toolbar-main,
.writer__toolbar-actions,
.writer__footer,
.writer__meta,
.writer__toggles,
.writer__toggle {
  display: flex;
  align-items: center;
  min-width: 0;
}

.writer__toolbar,
.writer__footer {
  justify-content: space-between;
  gap: 0.75rem;
  padding: 0.75rem;
  border-bottom: 1px solid rgba(255, 255, 255, 0.09);
}

.writer__footer {
  border-top: 1px solid rgba(255, 255, 255, 0.09);
  border-bottom: none;
}

.writer__toolbar-main {
  flex-direction: column;
  align-items: flex-start;
  gap: 0.18rem;
}

.writer__toolbar-actions {
  justify-content: flex-end;
  gap: 0.5rem;
  flex-shrink: 0;
}

.writer__label {
  color: var(--color-primary, #fff);
  font-size: 0.86rem;
  font-weight: 800;
  line-height: 1.15;
}

.writer__config,
.writer__meta {
  color: var(--color-secondary, rgba(255, 255, 255, 0.62));
  font-size: 0.74rem;
  line-height: 1.3;
}

.writer__config {
  max-width: min(48vw, 520px);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.writer__status,
.writer__ghost-button,
.writer__settings summary,
.writer__footer button {
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

.writer__status {
  gap: 0.38rem;
  border: 1px solid rgba(120, 120, 120, 0.32);
  background: rgba(255, 255, 255, 0.06);
  color: rgba(255, 255, 255, 0.72);
}

.writer__status-dot {
  width: 0.44rem;
  height: 0.44rem;
  border-radius: 999px;
  background: currentColor;
  box-shadow: 0 0 0.75rem currentColor;
}

.writer__status--available {
  background: rgba(34, 197, 94, 0.15);
  color: rgba(134, 239, 172, 1);
  border-color: rgba(34, 197, 94, 0.3);
}

.writer__status--downloadable {
  background: rgba(59, 130, 246, 0.15);
  color: rgba(147, 197, 253, 1);
  border-color: rgba(59, 130, 246, 0.3);
}

.writer__status--downloading {
  background: rgba(251, 146, 60, 0.15);
  color: rgba(254, 215, 170, 1);
  border-color: rgba(251, 146, 60, 0.3);
}

.writer__status--unavailable {
  background: rgba(239, 68, 68, 0.15);
  color: rgba(252, 165, 165, 1);
  border-color: rgba(239, 68, 68, 0.3);
}

.writer__settings {
  position: relative;
  flex-shrink: 0;
}

.writer__settings summary,
.writer__ghost-button {
  border: 1px solid rgba(255, 255, 255, 0.14);
  background: rgba(255, 255, 255, 0.08);
  color: var(--color-primary, #fff);
  cursor: pointer;
  list-style: none;
}

.writer__settings summary::-webkit-details-marker {
  display: none;
}

.writer__settings[open] summary {
  background: rgba(147, 197, 253, 0.14);
  border-color: rgba(147, 197, 253, 0.3);
}

.writer__settings-panel {
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

.writer__settings-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 0.7rem;
}

.writer__settings-grid label,
.writer__context,
.writer__toggle {
  color: var(--color-secondary, rgba(255, 255, 255, 0.64));
  font-size: 0.74rem;
  font-weight: 750;
}

.writer__settings-grid label,
.writer__context {
  display: flex;
  flex-direction: column;
  gap: 0.34rem;
}

.writer__settings-grid select,
.writer__editor textarea {
  width: 100%;
  border: 1px solid rgba(120, 120, 120, 0.26);
  border-radius: 0.75rem;
  background: rgba(20, 20, 20, 0.45);
  color: var(--color-primary, #fff);
  font: inherit;
  outline: none;
}

.writer__settings-grid select {
  min-height: 2.25rem;
  padding: 0 0.65rem;
}

.writer__settings-grid select:focus,
.writer__editor textarea:focus {
  border-color: rgba(147, 197, 253, 0.46);
  box-shadow: 0 0 0 3px rgba(147, 197, 253, 0.12);
}

.writer__toggles {
  flex-wrap: wrap;
  gap: 0.55rem;
  margin-top: 0.75rem;
}

.writer__toggle {
  min-height: 2rem;
  flex: 1 1 150px;
  gap: 0.48rem;
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 0.7rem;
  padding: 0 0.58rem;
  background: rgba(255, 255, 255, 0.05);
}

.writer__editor {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
  gap: 0.65rem;
  padding: 0.75rem;
}

.writer__editor > textarea {
  flex: 1;
  min-height: 260px;
  resize: none;
  padding: 0.9rem;
  line-height: 1.5;
}

.writer__context textarea {
  min-height: 5.4rem;
  max-height: 8rem;
  resize: vertical;
  padding: 0.7rem;
  line-height: 1.42;
}

.writer__meta {
  flex-wrap: wrap;
  gap: 0.35rem 0.65rem;
  min-width: 0;
}

.writer__progress {
  height: 4px;
  overflow: hidden;
  background: rgba(255, 255, 255, 0.12);
}

.writer__progress span {
  display: block;
  height: 100%;
  border-radius: inherit;
  background: rgba(147, 197, 253, 0.9);
  transition: width 0.2s ease;
}

.writer__error {
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

.writer__footer button {
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

.writer__footer button:disabled,
.writer__editor textarea:disabled,
.writer__settings-grid select:disabled,
.writer__toggle input:disabled {
  cursor: not-allowed;
  opacity: 0.58;
}

.writer__output {
  flex: 1;
  min-height: 0;
  overflow: auto;
  padding: 0.85rem;
  user-select: text;
}

.writer__output pre,
.writer__output p {
  margin: 0;
  white-space: pre-wrap;
  color: var(--color-primary, #fff);
  font: inherit;
  line-height: 1.5;
}

.writer__output p {
  color: var(--color-secondary, rgba(255, 255, 255, 0.62));
}

@media (max-width: 980px) {
  .writer__workspace {
    grid-template-columns: 1fr;
  }

  .writer__pane--output {
    min-height: 280px;
  }
}

@media (max-width: 700px) {
  .writer {
    padding: 0.35rem;
  }

  .writer__toolbar,
  .writer__footer {
    align-items: stretch;
    flex-direction: column;
  }

  .writer__toolbar-actions {
    justify-content: space-between;
  }

  .writer__config {
    max-width: 100%;
  }

  .writer__settings {
    position: static;
  }

  .writer__settings-panel {
    right: auto;
    left: 0.35rem;
    width: calc(100vw - 1.4rem);
  }

  .writer__settings-grid {
    grid-template-columns: 1fr;
  }

  .writer__editor > textarea {
    min-height: 220px;
  }
}
</style>
