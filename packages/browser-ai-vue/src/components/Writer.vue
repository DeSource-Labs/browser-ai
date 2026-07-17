<template>
  <div class="writing-tool">
    <div class="writing-tool__workspace">
      <section
        class="writing-tool__pane writing-tool__pane--input"
        aria-label="Writer task input"
      >
        <div class="writing-tool__toolbar">
          <div class="writing-tool__toolbar-main">
            <span class="writing-tool__label">Task</span>
            <span class="writing-tool__config">{{ settingsSummary }}</span>
          </div>

          <div class="writing-tool__toolbar-actions">
            <span
              class="writing-tool__status"
              :class="{
                'writing-tool__status--available': availability === 'available',
                'writing-tool__status--downloadable':
                  availability === 'downloadable',
                'writing-tool__status--downloading':
                  availability === 'downloading',
                'writing-tool__status--unavailable':
                  availability === 'unavailable',
              }"
            >
              <span class="writing-tool__status-dot"></span>
              {{ operationalStatusLabel }}
            </span>

            <details class="writing-tool__settings">
              <summary>Settings</summary>

              <div class="writing-tool__settings-panel">
                <div class="writing-tool__settings-grid">
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

                <div class="writing-tool__toggles">
                  <label class="writing-tool__toggle">
                    <input
                      v-model="stripHtmlInput"
                      type="checkbox"
                      :disabled="isBusy"
                    />
                    <span>Strip HTML</span>
                  </label>

                  <label class="writing-tool__toggle">
                    <input
                      v-model="showContext"
                      type="checkbox"
                      :disabled="isBusy"
                    />
                    <span>Additional context</span>
                  </label>

                  <label class="writing-tool__toggle">
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

        <div class="writing-tool__editor">
          <textarea
            v-model="sourceText"
            :disabled="disabled || isBusy"
            :placeholder="placeholder"
          ></textarea>

          <label v-if="showContext" class="writing-tool__context">
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
          class="writing-tool__progress"
          role="status"
          aria-live="polite"
        >
          <span :style="{ width: `${progressPercent}%` }"></span>
        </div>

        <p v-if="errorMessage" class="writing-tool__error" role="alert">
          {{ errorMessage }}
        </p>

        <div class="writing-tool__footer">
          <div class="writing-tool__meta">
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

      <section
        class="writing-tool__pane writing-tool__pane--output"
        aria-live="polite"
      >
        <div class="writing-tool__toolbar">
          <div class="writing-tool__toolbar-main">
            <span class="writing-tool__label">Draft</span>
            <span class="writing-tool__config">{{ outputMetaLabel }}</span>
          </div>

          <button
            v-if="draft"
            class="writing-tool__ghost-button"
            type="button"
            @click="copyDraft"
          >
            Copy
          </button>
        </div>

        <div class="writing-tool__output">
          <MarkdownRenderer
            v-if="draft && renderMarkdown && selectedFormat === 'markdown'"
            :content="draft"
          />
          <pre v-else-if="draft">{{ draft }}</pre>
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
import { useSyncedString } from "../composables/useSyncedString";
import {
  copyText,
  formatAvailability,
  formatTokenCount,
} from "../utils/display";
import MarkdownRenderer from "./MarkdownRenderer.vue";

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
  renderMarkdown?: boolean;
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
  renderMarkdown: true,
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

const sourceText = useSyncedString(
  () => props.modelValue,
  (value) => emit("update:modelValue", value),
);
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
  return formatAvailability(availability.value, downloadProgress.value);
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

const inputUsageLabel = computed(() => formatTokenCount(inputUsage.value));
const inputQuotaLabel = computed(() => formatTokenCount(inputQuota.value));

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
  await copyText(draft.value);
};

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
