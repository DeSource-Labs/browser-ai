<template>
  <TextTool
    v-model="sourceText"
    :output="translatedText"
    input-label="Source"
    :output-label="targetLanguageLabel"
    :action-label="prepareButtonLabel"
    :busy-action-label="prepareButtonLabel"
    :placeholder="placeholder"
    :empty-output-message="emptyOutputMessage"
    :settings-summary="`${sourceLanguageLabel} to ${targetLanguageLabel}`"
    :input-meta="`${inputUsageLabel} / ${inputQuotaLabel} tokens | ${sourceText.length} chars`"
    :output-meta="outputMetaLabel"
    :availability="availability"
    :download-progress="downloadProgress"
    :status-text="operationalStatusLabel"
    :busy="isProcessing"
    :disabled="disabled"
    :can-run="canPreparePair"
    :show-action="showPrepareButton"
    :progress-percent="progressPercent"
    :error-message="errorMessage"
    :render-markdown="renderMarkdown"
    copyable
    @interrupt="interrupt"
    @run="handlePreparePair"
    @copy="copyTranslation"
  >
    <template #settings>
      <div class="writing-tool__toggles">
        <label class="writing-tool__toggle"
          ><input v-model="stripHtmlInput" type="checkbox" :disabled="isBusy" />Strip HTML</label
        >
        <label class="writing-tool__toggle"
          ><input v-model="chunkLargeInput" type="checkbox" :disabled="isBusy" />Auto chunk long text</label
        >
        <label class="writing-tool__toggle"
          ><input v-model="streamOutput" type="checkbox" :disabled="isBusy" />Stream output</label
        >
        <label class="writing-tool__toggle"
          ><input v-model="autoTranslateInput" type="checkbox" :disabled="isBusy" />Auto translate</label
        >
      </div>
    </template>

    <template #input-before>
      <div class="browser-ai-language-pair">
        <label
          >From<select v-model="selectedSourceLanguage" :disabled="isBusy" @change="handleLanguageSelection">
            <option value="" disabled>Choose source</option>
            <option v-for="language in normalizedLanguageOptions" :key="language.code" :value="language.code">
              {{ language.name }}
            </option>
          </select></label
        >
        <button type="button" :disabled="isBusy || !canSwapLanguages" @click="swapLanguages">Swap</button>
        <label
          >To<select v-model="selectedTargetLanguage" :disabled="isBusy" @change="handleLanguageSelection">
            <option value="" disabled>Choose target</option>
            <option v-for="language in normalizedLanguageOptions" :key="language.code" :value="language.code">
              {{ language.name }}
            </option>
          </select></label
        >
      </div>
    </template>

    <template #meta>
      <span v-if="progressLabel">{{ progressLabel }}</span>
      <span v-if="lastResult?.chunked">Chunked</span>
      <span v-if="lastResult?.bypassed">Same language</span>
      <span v-if="autoTranslateInput && hasLanguagePair">Auto</span>
      <span v-if="!hasLanguagePair">Select languages first</span>
      <span v-if="pendingAutoTranslate">Queued</span>
    </template>
  </TextTool>
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
import { useSyncedString } from '../composables/useSyncedString';
import { copyText, formatTokenCount } from '../utils/display';
import TextTool from './TextTool.vue';

interface Props {
  modelValue?: string;
  placeholder?: string;
  emptyOutputMessage?: string;
  sourceLanguage?: string;
  targetLanguage?: string;
  languageOptions?: TranslatorLanguageOption[];
  autoInit?: boolean;
  autoCreate?: boolean;
  autoTranslate?: boolean;
  debounceMs?: number;
  stripHtml?: boolean;
  chunking?: 'auto' | 'never';
  stream?: boolean;
  renderMarkdown?: boolean;
  disabled?: boolean;
}

const props = withDefaults(defineProps<Props>(), {
  modelValue: '',
  placeholder: 'Paste text to translate locally...',
  emptyOutputMessage: 'Translation will appear here.',
  sourceLanguage: '',
  targetLanguage: '',
  languageOptions: undefined,
  autoInit: true,
  autoCreate: true,
  autoTranslate: true,
  debounceMs: 650,
  stripHtml: true,
  chunking: 'auto',
  stream: true,
  renderMarkdown: true,
  disabled: false
});

const emit = defineEmits<{
  'update:modelValue': [value: string];
  'availability-change': [availability: Availability];
  progress: [state: TranslatorProgressState];
  translate: [result: TranslatorResult];
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
  create,
  interrupt,
  translateWithDetails,
  translateStreamingToText,
  dispose
} = useTranslator({
  sourceLanguage: props.sourceLanguage,
  targetLanguage: props.targetLanguage
});

const sourceText = useSyncedString(
  () => props.modelValue,
  (value) => emit('update:modelValue', value)
);
const translatedText = ref('');
const errorMessage = ref('');
const selectedSourceLanguage = ref(props.sourceLanguage);
const selectedTargetLanguage = ref(props.targetLanguage);
const stripHtmlInput = ref(props.stripHtml);
const streamOutput = ref(props.stream);
const chunkLargeInput = ref(props.chunking === 'auto');
const autoTranslateInput = ref(props.autoTranslate);
const pendingAutoTranslate = ref(false);
const translationVersion = ref(0);
let autoTranslateTimer: ReturnType<typeof setTimeout> | undefined;
let availabilityRequestId = 0;

const normalizedLanguageOptions = computed(() => {
  return props.languageOptions?.length ? props.languageOptions : TRANSLATOR_LANGUAGE_OPTIONS;
});

const sourceLanguageLabel = computed(() =>
  selectedSourceLanguage.value ? getTranslatorLanguageName(selectedSourceLanguage.value) : 'Choose source'
);
const targetLanguageLabel = computed(() =>
  selectedTargetLanguage.value ? getTranslatorLanguageName(selectedTargetLanguage.value) : 'Choose target'
);

const hasLanguagePair = computed(() => {
  return Boolean(selectedSourceLanguage.value && selectedTargetLanguage.value);
});

const canSwapLanguages = computed(() => {
  return Boolean(selectedSourceLanguage.value || selectedTargetLanguage.value);
});

const createOptions = computed<TranslatorCreate>(() => ({
  sourceLanguage: selectedSourceLanguage.value,
  targetLanguage: selectedTargetLanguage.value
}));

const operationalStatusLabel = computed(() => {
  if (!hasLanguagePair.value) return 'Choose languages';
  if (downloadProgress.value > 0 && downloadProgress.value < 100) {
    return `${downloadProgress.value}%`;
  }
  if (availability.value === 'available') return 'Ready';
  if (availability.value === 'downloadable') return 'Download pack';
  if (availability.value === 'downloading') return 'Downloading';
  if (availability.value === 'unavailable') return 'Unavailable';
  return 'Checking';
});

const outputMetaLabel = computed(() => {
  if (!translatedText.value) {
    return hasLanguagePair.value
      ? `${sourceLanguageLabel.value} to ${targetLanguageLabel.value}`
      : 'Select a language pair';
  }
  return `${translatedText.value.length.toLocaleString()} chars`;
});

const isBusy = computed(() => props.disabled || isProcessing.value);

const canTranslate = computed(() => {
  return (
    !props.disabled &&
    !isProcessing.value &&
    hasLanguagePair.value &&
    availability.value !== 'unavailable' &&
    availability.value !== 'downloadable' &&
    availability.value !== 'downloading' &&
    sourceText.value.trim().length > 0
  );
});

const canPreparePair = computed(() => {
  return !props.disabled && !isProcessing.value && hasLanguagePair.value && availability.value !== 'unavailable';
});

const showPrepareButton = computed(() => {
  if (!hasLanguagePair.value) return false;
  if (availability.value === 'downloadable' || availability.value === 'downloading') return true;
  return !autoTranslateInput.value;
});

const prepareButtonLabel = computed(() => {
  if (isProcessing.value && progressState.value.phase === 'creating') return 'Downloading';
  if (availability.value === 'downloadable' || availability.value === 'downloading') return 'Download pack';
  if (autoTranslateInput.value) return 'Prepare';
  return isProcessing.value ? 'Translating' : 'Translate';
});

const inputUsageLabel = computed(() => formatTokenCount(inputUsage.value));
const inputQuotaLabel = computed(() => formatTokenCount(inputQuota.value));

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

const clearAutoTranslateTimer = () => {
  if (autoTranslateTimer) {
    clearTimeout(autoTranslateTimer);
    autoTranslateTimer = undefined;
  }
};

const isAbortError = (error: unknown) => {
  return (
    (error instanceof DOMException && error.name === 'AbortError') ||
    (error instanceof Error && error.name === 'AbortError')
  );
};

const scheduleAutoTranslate = () => {
  clearAutoTranslateTimer();

  if (!autoTranslateInput.value || props.disabled) {
    pendingAutoTranslate.value = false;
    return;
  }

  if (!sourceText.value.trim()) {
    translatedText.value = '';
    errorMessage.value = '';
    pendingAutoTranslate.value = false;
    return;
  }

  if (!hasLanguagePair.value || availability.value !== 'available') {
    pendingAutoTranslate.value = false;
    return;
  }

  if (isProcessing.value) {
    pendingAutoTranslate.value = true;
    return;
  }

  pendingAutoTranslate.value = true;
  autoTranslateTimer = setTimeout(
    () => {
      void handleTranslate();
    },
    Math.max(0, props.debounceMs)
  );
};

const handleTranslate = async () => {
  if (!canTranslate.value) return;

  const requestVersion = translationVersion.value;
  const input = sourceText.value;

  try {
    translatedText.value = '';
    errorMessage.value = '';
    pendingAutoTranslate.value = false;

    const options = {
      createOptions: createOptions.value,
      autoCreate: props.autoCreate,
      stripHtml: stripHtmlInput.value,
      chunking: chunkLargeInput.value ? ('auto' as const) : ('never' as const),
      onProgress: (state: TranslatorProgressState) => emit('progress', state)
    };

    if (streamOutput.value) {
      await translateStreamingToText(input, options, (_chunk, accumulated) => {
        if (requestVersion !== translationVersion.value) return;
        translatedText.value = accumulated;
      });
      if (requestVersion !== translationVersion.value) return;
      translatedText.value = lastResult.value?.translation || translatedText.value;
      if (lastResult.value) {
        emit('translate', lastResult.value);
      }
      return;
    }

    const result = await translateWithDetails(input, options);
    if (requestVersion !== translationVersion.value) return;
    translatedText.value = result.translation;
    emit('translate', result);
  } catch (error) {
    if (requestVersion !== translationVersion.value || isAbortError(error)) {
      return;
    }

    errorMessage.value = error instanceof Error ? error.message : 'Unable to translate this input.';
    emit('error', error);
  }
};

const requestCurrentAvailability = async (options: TranslatorCreate) => {
  const requestId = ++availabilityRequestId;
  const status = await requestAvailability(options);

  if (requestId !== availabilityRequestId && hasLanguagePair.value) {
    return requestCurrentAvailability(createOptions.value);
  }

  return status;
};

const handlePreparePair = async () => {
  if (!canPreparePair.value) return;

  if (availability.value === 'available' && !autoTranslateInput.value) {
    await handleTranslate();
    return;
  }

  try {
    errorMessage.value = '';

    if (availability.value === 'downloadable' || availability.value === 'downloading') {
      await create(createOptions.value);
    } else {
      await requestCurrentAvailability(createOptions.value);
    }

    scheduleAutoTranslate();
  } catch (error) {
    errorMessage.value = error instanceof Error ? error.message : 'Unable to prepare this language pair.';
    emit('error', error);
  }
};

const copyTranslation = async () => {
  await copyText(translatedText.value);
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

const handleLanguageSelection = () => {
  availabilityRequestId += 1;
  translationVersion.value += 1;
  translatedText.value = '';
  errorMessage.value = '';
  pendingAutoTranslate.value = false;
};

watch(sourceText, () => {
  translationVersion.value += 1;
  if (isProcessing.value && ['measuring', 'chunking', 'translating'].includes(progressState.value.phase)) {
    interrupt();
  }
  scheduleAutoTranslate();
});

watch(
  () => props.sourceLanguage,
  (value) => {
    selectedSourceLanguage.value = value;
  }
);

watch(
  () => props.targetLanguage,
  (value) => {
    selectedTargetLanguage.value = value;
  }
);

watch(
  () => props.autoTranslate,
  (value) => {
    autoTranslateInput.value = value;
  }
);

watch(
  availability,
  (value) => {
    if (value) {
      emit('availability-change', value);
    }
    scheduleAutoTranslate();
  },
  { immediate: true }
);

watch(
  createOptions,
  async (options) => {
    handleLanguageSelection();
    if (!props.autoInit || !hasLanguagePair.value) return;
    await requestCurrentAvailability(options);
  },
  { deep: true }
);

watch([stripHtmlInput, chunkLargeInput, autoTranslateInput], () => {
  translationVersion.value += 1;
  scheduleAutoTranslate();
});

watch(isProcessing, (processingNow) => {
  if (!processingNow && pendingAutoTranslate.value) {
    scheduleAutoTranslate();
  }
});

onMounted(async () => {
  if (!props.autoInit || !hasLanguagePair.value) return;
  await requestCurrentAvailability(createOptions.value);
});

onBeforeUnmount(() => {
  clearAutoTranslateTimer();
  dispose();
});
</script>
