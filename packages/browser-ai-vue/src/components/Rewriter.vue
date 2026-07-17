<template>
  <div class="rewriter">
    <div class="rewriter__workspace">
      <section
        class="rewriter__pane rewriter__pane--input"
        aria-label="Rewriter input"
      >
        <div class="rewriter__toolbar">
          <div class="rewriter__toolbar-main">
            <span class="rewriter__label">Original</span>
            <span class="rewriter__config">{{ settingsSummary }}</span>
          </div>

          <div class="rewriter__toolbar-actions">
            <span
              class="rewriter__status"
              :class="{
                'rewriter__status--available': availability === 'available',
                'rewriter__status--downloadable':
                  availability === 'downloadable',
                'rewriter__status--downloading': availability === 'downloading',
                'rewriter__status--unavailable': availability === 'unavailable',
              }"
            >
              <span class="rewriter__status-dot"></span>
              {{ operationalStatusLabel }}
            </span>

            <details class="rewriter__settings">
              <summary>Settings</summary>

              <div class="rewriter__settings-panel">
                <div class="rewriter__settings-grid">
                  <label>
                    Tone
                    <select v-model="selectedTone" :disabled="isBusy">
                      <option value="as-is">Keep tone</option>
                      <option value="more-formal">More formal</option>
                      <option value="more-casual">More casual</option>
                    </select>
                  </label>

                  <label>
                    Length
                    <select v-model="selectedLength" :disabled="isBusy">
                      <option value="as-is">Keep length</option>
                      <option value="shorter">Shorter</option>
                      <option value="longer">Longer</option>
                    </select>
                  </label>

                  <label>
                    Format
                    <select v-model="selectedFormat" :disabled="isBusy">
                      <option value="as-is">Keep format</option>
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

                <div class="rewriter__toggles">
                  <label class="rewriter__toggle">
                    <input
                      v-model="stripHtmlInput"
                      type="checkbox"
                      :disabled="isBusy"
                    />
                    <span>Strip HTML</span>
                  </label>

                  <label class="rewriter__toggle">
                    <input
                      v-model="showContext"
                      type="checkbox"
                      :disabled="isBusy"
                    />
                    <span>Rewrite guidance</span>
                  </label>

                  <label class="rewriter__toggle">
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

        <div class="rewriter__editor">
          <textarea
            v-model="sourceText"
            :disabled="disabled || isBusy"
            :placeholder="placeholder"
          ></textarea>

          <label v-if="showContext" class="rewriter__context">
            <span>Rewrite guidance</span>
            <textarea
              v-model="rewriteContext"
              :disabled="disabled || isBusy"
              :placeholder="contextPlaceholder"
              rows="3"
            ></textarea>
          </label>
        </div>

        <div
          v-if="isBusy"
          class="rewriter__progress"
          role="status"
          aria-live="polite"
        >
          <span :style="{ width: `${progressPercent}%` }"></span>
        </div>

        <p v-if="errorMessage" class="rewriter__error" role="alert">
          {{ errorMessage }}
        </p>

        <div class="rewriter__footer">
          <div class="rewriter__meta">
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

          <button type="button" :disabled="!canRewrite" @click="handleRewrite">
            {{ isBusy ? "Rewriting" : "Rewrite" }}
          </button>
        </div>
      </section>

      <section class="rewriter__pane rewriter__pane--output" aria-live="polite">
        <div class="rewriter__toolbar">
          <div class="rewriter__toolbar-main">
            <span class="rewriter__label">Rewrite</span>
            <span class="rewriter__config">{{ outputMetaLabel }}</span>
          </div>

          <button
            v-if="rewrittenText"
            class="rewriter__ghost-button"
            type="button"
            @click="copyRewrite"
          >
            Copy
          </button>
        </div>

        <div class="rewriter__output">
          <pre v-if="rewrittenText">{{ rewrittenText }}</pre>
          <p v-else>{{ emptyOutputMessage }}</p>
        </div>
      </section>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from "vue";
import {
  useRewriter,
  type RewriterCreate,
  type RewriterFitStrategy,
  type RewriterProgressState,
  type RewriterResult,
} from "../composables/useRewriter";

interface Props {
  modelValue?: string;
  placeholder?: string;
  contextPlaceholder?: string;
  emptyOutputMessage?: string;
  tone?: RewriterTone;
  format?: RewriterFormat;
  length?: RewriterLength;
  sharedContext?: string;
  context?: string;
  outputLanguage?: string;
  expectedInputLanguages?: string[];
  expectedContextLanguages?: string[];
  autoInit?: boolean;
  autoCreate?: boolean;
  stripHtml?: boolean;
  fitStrategy?: RewriterFitStrategy;
  stream?: boolean;
  disabled?: boolean;
}

const props = withDefaults(defineProps<Props>(), {
  modelValue: "",
  placeholder: "Paste or write the text you want to rewrite...",
  contextPlaceholder:
    "Optional audience, constraints, tone notes, or rewrite rules",
  emptyOutputMessage: "Rewritten text will appear here.",
  tone: "as-is",
  format: "as-is",
  length: "as-is",
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
  progress: [state: RewriterProgressState];
  rewrite: [result: RewriterResult];
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
  rewriteWithDetails,
  rewriteStreamingToText,
  dispose,
} = useRewriter();

const sourceText = ref(props.modelValue);
const rewrittenText = ref("");
const errorMessage = ref("");
const rewriteContext = ref(props.context);
const showContext = ref(Boolean(props.context));
const stripHtmlInput = ref(props.stripHtml);
const streamOutput = ref(props.stream);
const selectedTone = ref<RewriterTone>(props.tone);
const selectedFormat = ref<RewriterFormat>(props.format);
const selectedLength = ref<RewriterLength>(props.length);
const selectedFitStrategy = ref<RewriterFitStrategy>(props.fitStrategy);

const toneLabels: Record<RewriterTone, string> = {
  "as-is": "Keep tone",
  "more-formal": "More formal",
  "more-casual": "More casual",
};

const lengthLabels: Record<RewriterLength, string> = {
  "as-is": "Keep length",
  shorter: "Shorter",
  longer: "Longer",
};

const formatLabels: Record<RewriterFormat, string> = {
  "as-is": "Keep format",
  markdown: "Markdown",
  "plain-text": "Plain text",
};

const fitStrategyLabels: Record<RewriterFitStrategy, string> = {
  "truncate-context": "Fit context",
  error: "Full context",
};

const createOptions = computed<RewriterCreate>(() => ({
  tone: selectedTone.value,
  format: selectedFormat.value,
  length: selectedLength.value,
  sharedContext: props.sharedContext || undefined,
  outputLanguage: props.outputLanguage || undefined,
  expectedInputLanguages: props.expectedInputLanguages,
  expectedContextLanguages: props.expectedContextLanguages,
}));

const coreOptions = computed<RewriterCreateCoreOptions>(() => {
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
  if (!rewrittenText.value) return formatLabels[selectedFormat.value];
  return `${rewrittenText.value.length.toLocaleString()} chars`;
});

const isBusy = computed(() => props.disabled || isProcessing.value);

const canRewrite = computed(() => {
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
  if (state.phase === "rewriting")
    return streamOutput.value ? "Streaming rewrite" : "Rewriting text";
  return "";
});

const progressPercent = computed(() => {
  const state = progressState.value;
  if (state.phase === "measuring") return 18;
  if (state.phase === "fitting-context") return 38;
  if (state.phase === "rewriting") return 68;
  return state.phase === "ready" ? 100 : 8;
});

const handleRewrite = async () => {
  if (!canRewrite.value) return;

  try {
    rewrittenText.value = "";
    errorMessage.value = "";

    const options = {
      createOptions: createOptions.value,
      autoCreate: props.autoCreate,
      context: showContext.value
        ? rewriteContext.value || undefined
        : undefined,
      stripHtml: stripHtmlInput.value,
      fitStrategy: selectedFitStrategy.value,
      onProgress: (state: RewriterProgressState) => emit("progress", state),
    };

    if (streamOutput.value) {
      await rewriteStreamingToText(
        sourceText.value,
        options,
        (_chunk, accumulated) => {
          rewrittenText.value = accumulated;
        },
      );
      rewrittenText.value = lastResult.value?.text || rewrittenText.value;
      if (lastResult.value) {
        emit("rewrite", lastResult.value);
      }
      return;
    }

    const result = await rewriteWithDetails(sourceText.value, options);
    rewrittenText.value = result.text;
    emit("rewrite", result);
  } catch (error) {
    errorMessage.value =
      error instanceof Error ? error.message : "Unable to rewrite this input.";
    emit("error", error);
  }
};

const copyRewrite = async () => {
  if (!rewrittenText.value || typeof navigator === "undefined") return;
  await navigator.clipboard?.writeText(rewrittenText.value);
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
    rewriteContext.value = value;
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
.rewriter {
  width: 100%;
  height: 100%;
  min-height: 0;
  box-sizing: border-box;
  padding: 0.5rem;
  color: var(--color-primary, #fff);
  pointer-events: all;
}

.rewriter__workspace {
  height: 100%;
  min-height: 0;
  display: grid;
  grid-template-columns: minmax(0, 1.05fr) minmax(320px, 0.95fr);
  gap: 0.75rem;
}

.rewriter__pane {
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

.rewriter__toolbar,
.rewriter__toolbar-main,
.rewriter__toolbar-actions,
.rewriter__footer,
.rewriter__meta,
.rewriter__toggles,
.rewriter__toggle {
  display: flex;
  align-items: center;
  min-width: 0;
}

.rewriter__toolbar,
.rewriter__footer {
  justify-content: space-between;
  gap: 0.75rem;
  padding: 0.75rem;
  border-bottom: 1px solid rgba(255, 255, 255, 0.09);
}

.rewriter__footer {
  border-top: 1px solid rgba(255, 255, 255, 0.09);
  border-bottom: none;
}

.rewriter__toolbar-main {
  flex-direction: column;
  align-items: flex-start;
  gap: 0.18rem;
}

.rewriter__toolbar-actions {
  justify-content: flex-end;
  gap: 0.5rem;
  flex-shrink: 0;
}

.rewriter__label {
  color: var(--color-primary, #fff);
  font-size: 0.86rem;
  font-weight: 800;
  line-height: 1.15;
}

.rewriter__config,
.rewriter__meta {
  color: var(--color-secondary, rgba(255, 255, 255, 0.62));
  font-size: 0.74rem;
  line-height: 1.3;
}

.rewriter__config {
  max-width: min(48vw, 520px);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.rewriter__status,
.rewriter__ghost-button,
.rewriter__settings summary,
.rewriter__footer button {
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

.rewriter__status {
  gap: 0.38rem;
  border: 1px solid rgba(120, 120, 120, 0.32);
  background: rgba(255, 255, 255, 0.06);
  color: rgba(255, 255, 255, 0.72);
}

.rewriter__status-dot {
  width: 0.44rem;
  height: 0.44rem;
  border-radius: 999px;
  background: currentColor;
  box-shadow: 0 0 0.75rem currentColor;
}

.rewriter__status--available {
  background: rgba(34, 197, 94, 0.15);
  color: rgba(134, 239, 172, 1);
  border-color: rgba(34, 197, 94, 0.3);
}

.rewriter__status--downloadable {
  background: rgba(59, 130, 246, 0.15);
  color: rgba(147, 197, 253, 1);
  border-color: rgba(59, 130, 246, 0.3);
}

.rewriter__status--downloading {
  background: rgba(251, 146, 60, 0.15);
  color: rgba(254, 215, 170, 1);
  border-color: rgba(251, 146, 60, 0.3);
}

.rewriter__status--unavailable {
  background: rgba(239, 68, 68, 0.15);
  color: rgba(252, 165, 165, 1);
  border-color: rgba(239, 68, 68, 0.3);
}

.rewriter__settings {
  position: relative;
  flex-shrink: 0;
}

.rewriter__settings summary,
.rewriter__ghost-button {
  border: 1px solid rgba(255, 255, 255, 0.14);
  background: rgba(255, 255, 255, 0.08);
  color: var(--color-primary, #fff);
  cursor: pointer;
  list-style: none;
}

.rewriter__settings summary::-webkit-details-marker {
  display: none;
}

.rewriter__settings[open] summary {
  background: rgba(147, 197, 253, 0.14);
  border-color: rgba(147, 197, 253, 0.3);
}

.rewriter__settings-panel {
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

.rewriter__settings-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 0.7rem;
}

.rewriter__settings-grid label,
.rewriter__context,
.rewriter__toggle {
  color: var(--color-secondary, rgba(255, 255, 255, 0.64));
  font-size: 0.74rem;
  font-weight: 750;
}

.rewriter__settings-grid label,
.rewriter__context {
  display: flex;
  flex-direction: column;
  gap: 0.34rem;
}

.rewriter__settings-grid select,
.rewriter__editor textarea {
  width: 100%;
  border: 1px solid rgba(120, 120, 120, 0.26);
  border-radius: 0.75rem;
  background: rgba(20, 20, 20, 0.45);
  color: var(--color-primary, #fff);
  font: inherit;
  outline: none;
}

.rewriter__settings-grid select {
  min-height: 2.25rem;
  padding: 0 0.65rem;
}

.rewriter__settings-grid select:focus,
.rewriter__editor textarea:focus {
  border-color: rgba(147, 197, 253, 0.46);
  box-shadow: 0 0 0 3px rgba(147, 197, 253, 0.12);
}

.rewriter__toggles {
  flex-wrap: wrap;
  gap: 0.55rem;
  margin-top: 0.75rem;
}

.rewriter__toggle {
  min-height: 2rem;
  flex: 1 1 150px;
  gap: 0.48rem;
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 0.7rem;
  padding: 0 0.58rem;
  background: rgba(255, 255, 255, 0.05);
}

.rewriter__editor {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
  gap: 0.65rem;
  padding: 0.75rem;
}

.rewriter__editor > textarea {
  flex: 1;
  min-height: 260px;
  resize: none;
  padding: 0.9rem;
  line-height: 1.5;
}

.rewriter__context textarea {
  min-height: 5.4rem;
  max-height: 8rem;
  resize: vertical;
  padding: 0.7rem;
  line-height: 1.42;
}

.rewriter__meta {
  flex-wrap: wrap;
  gap: 0.35rem 0.65rem;
  min-width: 0;
}

.rewriter__progress {
  height: 4px;
  overflow: hidden;
  background: rgba(255, 255, 255, 0.12);
}

.rewriter__progress span {
  display: block;
  height: 100%;
  border-radius: inherit;
  background: rgba(147, 197, 253, 0.9);
  transition: width 0.2s ease;
}

.rewriter__error {
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

.rewriter__footer button {
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

.rewriter__footer button:disabled,
.rewriter__editor textarea:disabled,
.rewriter__settings-grid select:disabled,
.rewriter__toggle input:disabled {
  cursor: not-allowed;
  opacity: 0.58;
}

.rewriter__output {
  flex: 1;
  min-height: 0;
  overflow: auto;
  padding: 0.85rem;
  user-select: text;
}

.rewriter__output pre,
.rewriter__output p {
  margin: 0;
  white-space: pre-wrap;
  color: var(--color-primary, #fff);
  font: inherit;
  line-height: 1.5;
}

.rewriter__output p {
  color: var(--color-secondary, rgba(255, 255, 255, 0.62));
}

@media (max-width: 980px) {
  .rewriter__workspace {
    grid-template-columns: 1fr;
  }

  .rewriter__pane--output {
    min-height: 280px;
  }
}

@media (max-width: 700px) {
  .rewriter {
    padding: 0.35rem;
  }

  .rewriter__toolbar,
  .rewriter__footer {
    align-items: stretch;
    flex-direction: column;
  }

  .rewriter__toolbar-actions {
    justify-content: space-between;
  }

  .rewriter__config {
    max-width: 100%;
  }

  .rewriter__settings {
    position: static;
  }

  .rewriter__settings-panel {
    right: auto;
    left: 0.35rem;
    width: calc(100vw - 1.4rem);
  }

  .rewriter__settings-grid {
    grid-template-columns: 1fr;
  }

  .rewriter__editor > textarea {
    min-height: 220px;
  }
}
</style>
