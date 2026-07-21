<template>
  <div class="writing-tool">
    <div class="writing-tool__workspace">
      <section class="writing-tool__pane writing-tool__pane--input" aria-label="Rewriter input">
        <div class="writing-tool__toolbar">
          <div class="writing-tool__toolbar-main">
            <span class="writing-tool__label">Original</span>
            <span class="writing-tool__config">{{ settingsSummary }}</span>
          </div>

          <div class="writing-tool__toolbar-actions">
            <span
              class="writing-tool__status"
              :class="{
                'writing-tool__status--available': availability === 'available',
                'writing-tool__status--downloadable': availability === 'downloadable',
                'writing-tool__status--downloading': availability === 'downloading',
                'writing-tool__status--unavailable': availability === 'unavailable'
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

                <div class="writing-tool__toggles">
                  <label class="writing-tool__toggle">
                    <input v-model="stripHtmlInput" type="checkbox" :disabled="isBusy" />
                    <span>Strip HTML</span>
                  </label>

                  <label class="writing-tool__toggle">
                    <input v-model="showContext" type="checkbox" :disabled="isBusy" />
                    <span>Rewrite guidance</span>
                  </label>

                  <label class="writing-tool__toggle">
                    <input v-model="streamOutput" type="checkbox" :disabled="isBusy" />
                    <span>Stream output</span>
                  </label>
                </div>
              </div>
            </details>
          </div>
        </div>

        <div class="writing-tool__editor">
          <textarea v-model="sourceText" :disabled="disabled || isBusy" :placeholder="placeholder"></textarea>

          <label v-if="showContext" class="writing-tool__context">
            <span>Rewrite guidance</span>
            <textarea
              v-model="rewriteContext"
              :disabled="disabled || isBusy"
              :placeholder="contextPlaceholder"
              rows="3"
            ></textarea>
          </label>
        </div>

        <div v-if="isBusy" class="writing-tool__progress" role="status" aria-live="polite">
          <span :style="{ width: `${progressPercent}%` }"></span>
        </div>

        <p v-if="errorMessage" class="writing-tool__error" role="alert">
          {{ errorMessage }}
        </p>

        <div class="writing-tool__footer">
          <div class="writing-tool__meta">
            <span>{{ inputUsageLabel }} / {{ inputQuotaLabel }} tokens | {{ sourceText.length }} chars</span>
            <span v-if="progressLabel">{{ progressLabel }}</span>
            <span v-if="lastResult?.fitted">Context fitted</span>
            <span v-if="downloadProgress > 0 && downloadProgress < 100"> Downloading {{ downloadProgress }}% </span>
          </div>

          <button type="button" :disabled="!canRewrite" @click="handleRewrite">
            {{ isBusy ? 'Rewriting' : 'Rewrite' }}
          </button>
        </div>
      </section>

      <section class="writing-tool__pane writing-tool__pane--output" aria-live="polite">
        <div class="writing-tool__toolbar">
          <div class="writing-tool__toolbar-main">
            <span class="writing-tool__label">Rewrite</span>
            <span class="writing-tool__config">{{ outputMetaLabel }}</span>
          </div>

          <button v-if="rewrittenText" class="writing-tool__ghost-button" type="button" @click="copyRewrite">
            Copy
          </button>
        </div>

        <div class="writing-tool__output">
          <MarkdownRenderer
            v-if="rewrittenText && renderMarkdown && selectedFormat !== 'plain-text'"
            :content="rewrittenText"
          />
          <pre v-else-if="rewrittenText">{{ rewrittenText }}</pre>
          <p v-else>{{ emptyOutputMessage }}</p>
        </div>
      </section>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import {
  useRewriter,
  type RewriterCreate,
  type RewriterFitStrategy,
  type RewriterProgressState,
  type RewriterResult
} from '../composables/useRewriter';
import { useSyncedString } from '../composables/useSyncedString';
import { copyText, formatAvailability, formatTokenCount } from '../utils/display';
import MarkdownRenderer from './MarkdownRenderer.vue';

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
  renderMarkdown?: boolean;
  disabled?: boolean;
}

const props = withDefaults(defineProps<Props>(), {
  modelValue: '',
  placeholder: 'Paste or write the text you want to rewrite...',
  contextPlaceholder: 'Optional audience, constraints, tone notes, or rewrite rules',
  emptyOutputMessage: 'Rewritten text will appear here.',
  tone: 'as-is',
  format: 'as-is',
  length: 'as-is',
  sharedContext: '',
  context: '',
  outputLanguage: '',
  expectedInputLanguages: undefined,
  expectedContextLanguages: undefined,
  autoInit: true,
  autoCreate: true,
  stripHtml: true,
  fitStrategy: 'truncate-context',
  stream: true,
  renderMarkdown: true,
  disabled: false
});

const emit = defineEmits<{
  'update:modelValue': [value: string];
  'availability-change': [availability: Availability];
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
  dispose
} = useRewriter();

const sourceText = useSyncedString(
  () => props.modelValue,
  (value) => emit('update:modelValue', value)
);
const rewrittenText = ref('');
const errorMessage = ref('');
const rewriteContext = ref(props.context);
const showContext = ref(Boolean(props.context));
const stripHtmlInput = ref(props.stripHtml);
const streamOutput = ref(props.stream);
const selectedTone = ref<RewriterTone>(props.tone);
const selectedFormat = ref<RewriterFormat>(props.format);
const selectedLength = ref<RewriterLength>(props.length);
const selectedFitStrategy = ref<RewriterFitStrategy>(props.fitStrategy);

const toneLabels: Record<RewriterTone, string> = {
  'as-is': 'Keep tone',
  'more-formal': 'More formal',
  'more-casual': 'More casual'
};

const lengthLabels: Record<RewriterLength, string> = {
  'as-is': 'Keep length',
  shorter: 'Shorter',
  longer: 'Longer'
};

const formatLabels: Record<RewriterFormat, string> = {
  'as-is': 'Keep format',
  markdown: 'Markdown',
  'plain-text': 'Plain text'
};

const fitStrategyLabels: Record<RewriterFitStrategy, string> = {
  'truncate-context': 'Fit context',
  error: 'Full context'
};

const createOptions = computed<RewriterCreate>(() => ({
  tone: selectedTone.value,
  format: selectedFormat.value,
  length: selectedLength.value,
  sharedContext: props.sharedContext || undefined,
  outputLanguage: props.outputLanguage || undefined,
  expectedInputLanguages: props.expectedInputLanguages,
  expectedContextLanguages: props.expectedContextLanguages
}));

const coreOptions = computed<RewriterCreateCoreOptions>(() => {
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
    fitStrategyLabels[selectedFitStrategy.value]
  ].join(' / ');
});

const outputMetaLabel = computed(() => {
  if (!rewrittenText.value) return formatLabels[selectedFormat.value];
  return `${rewrittenText.value.length.toLocaleString()} chars`;
});

const isBusy = computed(() => props.disabled || isProcessing.value);

const canRewrite = computed(() => {
  return (
    !props.disabled && !isProcessing.value && availability.value !== 'unavailable' && sourceText.value.trim().length > 0
  );
});

const inputUsageLabel = computed(() => formatTokenCount(inputUsage.value));
const inputQuotaLabel = computed(() => formatTokenCount(inputQuota.value));

const progressLabel = computed(() => {
  const state = progressState.value;
  if (state.phase === 'measuring') return 'Measuring input';
  if (state.phase === 'fitting-context') return 'Fitting context';
  if (state.phase === 'rewriting') return streamOutput.value ? 'Streaming rewrite' : 'Rewriting text';
  return '';
});

const progressPercent = computed(() => {
  const state = progressState.value;
  if (state.phase === 'measuring') return 18;
  if (state.phase === 'fitting-context') return 38;
  if (state.phase === 'rewriting') return 68;
  return state.phase === 'ready' ? 100 : 8;
});

const handleRewrite = async () => {
  if (!canRewrite.value) return;

  try {
    rewrittenText.value = '';
    errorMessage.value = '';

    const options = {
      createOptions: createOptions.value,
      autoCreate: props.autoCreate,
      context: showContext.value ? rewriteContext.value || undefined : undefined,
      stripHtml: stripHtmlInput.value,
      fitStrategy: selectedFitStrategy.value,
      onProgress: (state: RewriterProgressState) => emit('progress', state)
    };

    if (streamOutput.value) {
      await rewriteStreamingToText(sourceText.value, options, (_chunk, accumulated) => {
        rewrittenText.value = accumulated;
      });
      rewrittenText.value = lastResult.value?.text || rewrittenText.value;
      if (lastResult.value) {
        emit('rewrite', lastResult.value);
      }
      return;
    }

    const result = await rewriteWithDetails(sourceText.value, options);
    rewrittenText.value = result.text;
    emit('rewrite', result);
  } catch (error) {
    errorMessage.value = error instanceof Error ? error.message : 'Unable to rewrite this input.';
    emit('error', error);
  }
};

const copyRewrite = async () => {
  await copyText(rewrittenText.value);
};

watch(
  () => props.context,
  (value) => {
    rewriteContext.value = value;
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
