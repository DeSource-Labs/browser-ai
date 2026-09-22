<template>
  <div class="writing-tool">
    <div class="writing-tool__workspace">
      <section class="writing-tool__pane writing-tool__pane--input" :aria-label="`${inputLabel} input`">
        <div class="writing-tool__toolbar">
          <div class="writing-tool__toolbar-main">
            <span class="writing-tool__label">{{ inputLabel }}</span>
            <span class="writing-tool__config">{{ settingsSummary }}</span>
          </div>

          <div class="writing-tool__toolbar-actions">
            <span
              class="writing-tool__status"
              :class="availability ? `writing-tool__status--${availability}` : undefined"
            >
              <span class="writing-tool__status-dot"></span>
              {{ statusLabel }}
            </span>

            <details v-if="showSettings" class="writing-tool__settings">
              <summary>Settings</summary>
              <div class="writing-tool__settings-panel">
                <slot name="settings"></slot>
              </div>
            </details>
          </div>
        </div>

        <div class="writing-tool__editor">
          <slot name="input-before"></slot>
          <textarea
            :value="modelValue"
            :disabled="disabled || busy"
            :placeholder="placeholder"
            @input="updateValue"
          ></textarea>
          <label class="writing-tool__ghost-button">
            Add text files
            <input
              hidden
              type="file"
              multiple
              :accept="TEXT_FILE_ACCEPT"
              :disabled="disabled || busy"
              @change="filesChanged"
            />
          </label>
          <slot name="input-after"></slot>
        </div>

        <div v-if="busy" class="writing-tool__progress" role="status" aria-live="polite">
          <span :style="{ width: `${progressPercent}%` }"></span>
        </div>

        <p v-if="displayedError" class="writing-tool__error" role="alert">{{ displayedError }}</p>

        <div class="writing-tool__footer">
          <div class="writing-tool__meta">
            <span>{{ inputMeta }}</span>
            <slot name="meta"></slot>
            <span v-if="downloadProgress > 0 && downloadProgress < 100">Downloading {{ downloadProgress }}%</span>
          </div>

          <button v-if="busy" type="button" @click="$emit('interrupt')">Stop</button>
          <button
            v-if="showAction"
            type="button"
            data-browser-ai-action="run"
            :disabled="!canRun"
            @click="$emit('run')"
          >
            {{ busy ? busyActionLabel : actionLabel }}
          </button>
        </div>
      </section>

      <section class="writing-tool__pane writing-tool__pane--output" aria-live="polite">
        <div class="writing-tool__toolbar">
          <div class="writing-tool__toolbar-main">
            <span class="writing-tool__label">{{ outputLabel }}</span>
            <span class="writing-tool__config">{{ outputMeta }}</span>
          </div>
          <slot name="output-actions">
            <button v-if="copyable && output" class="writing-tool__ghost-button" type="button" @click="$emit('copy')">
              Copy
            </button>
          </slot>
        </div>

        <div class="writing-tool__output">
          <slot name="output">
            <MarkdownRenderer v-if="output && renderMarkdown" :content="output" />
            <pre v-else-if="output">{{ output }}</pre>
            <p v-else>{{ emptyOutputMessage }}</p>
          </slot>
        </div>
      </section>
    </div>
  </div>
</template>

<script setup lang="ts">
import { readTextSource, TEXT_FILE_ACCEPT } from '@desource/browser-ai';
import { computed, onBeforeUnmount, ref } from 'vue';
import { formatAvailability } from '../utils/display';
import MarkdownRenderer from './MarkdownRenderer.vue';

interface Props {
  modelValue: string;
  output: string;
  inputLabel: string;
  outputLabel: string;
  actionLabel: string;
  busyActionLabel: string;
  placeholder: string;
  emptyOutputMessage: string;
  settingsSummary: string;
  inputMeta: string;
  outputMeta: string;
  availability: Availability | null;
  downloadProgress: number;
  busy: boolean;
  disabled: boolean;
  canRun: boolean;
  progressPercent: number;
  errorMessage: string;
  statusText?: string;
  showSettings?: boolean;
  showAction?: boolean;
  renderMarkdown?: boolean;
  copyable?: boolean;
}

const props = withDefaults(defineProps<Props>(), {
  showSettings: true,
  showAction: true,
  statusText: '',
  renderMarkdown: false,
  copyable: false
});

const emit = defineEmits<{
  'update:modelValue': [value: string];
  run: [];
  interrupt: [];
  copy: [];
}>();

const fileError = ref('');
let disposed = false;
let fileRequest = 0;
onBeforeUnmount(() => {
  disposed = true;
  fileRequest += 1;
});
const statusLabel = computed(() => props.statusText || formatAvailability(props.availability, props.downloadProgress));
const displayedError = computed(() => props.errorMessage || fileError.value);

const updateValue = (event: Event) => {
  emit('update:modelValue', (event.currentTarget as HTMLTextAreaElement).value);
};

const filesChanged = async (event: Event) => {
  const input = event.currentTarget as HTMLInputElement;
  if (props.disabled || props.busy) return;
  const request = ++fileRequest;
  try {
    const blocks = await Promise.all(Array.from(input.files ?? []).map((file) => readTextSource(file)));
    if (disposed || request !== fileRequest || props.disabled || props.busy) return;
    emit('update:modelValue', [props.modelValue, ...blocks].filter(Boolean).join('\n\n'));
    fileError.value = '';
  } catch (error) {
    if (!disposed && request === fileRequest)
      fileError.value = error instanceof Error ? error.message : 'Could not read the selected file.';
  } finally {
    input.value = '';
  }
};
</script>
