<template>
  <div class="prompt-input">
    <div v-if="attachments.length" class="prompt-input__attachments">
      <div v-for="attachment in attachments" :key="attachment.id" class="prompt-input__attachment">
        <img
          v-if="attachment.type.startsWith('image/') && attachment.url"
          :src="attachment.url"
          :alt="attachment.name"
        />
        <div v-else class="prompt-input__file">
          {{ attachment.name }}
        </div>
        <button
          type="button"
          class="prompt-input__remove"
          :aria-label="`Remove ${attachment.name}`"
          @click="removeAttachment(attachment.id)"
        >
          <span aria-hidden="true">&times;</span>
        </button>
      </div>
    </div>

    <div class="prompt-input__row">
      <button
        v-if="allowVoice"
        type="button"
        class="prompt-input__icon"
        :disabled="disabled"
        aria-label="Start voice input"
        @click="handleVoice"
      >
        <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
          <path
            d="M12 3a3 3 0 0 1 3 3v5a3 3 0 0 1-6 0V6a3 3 0 0 1 3-3Zm-5 8a5 5 0 0 0 10 0h2a7 7 0 0 1-6 6.92V21h-2v-3.08A7 7 0 0 1 5 11h2Z"
            fill="currentColor"
          />
        </svg>
      </button>

      <button
        v-if="allowAttachments"
        type="button"
        class="prompt-input__icon"
        :disabled="disabled"
        aria-label="Attach files"
        @click="triggerFile"
      >
        <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
          <path
            d="M7.5 6.5A4.5 4.5 0 0 1 12 2h5a1 1 0 0 1 1 1v5.5a4.5 4.5 0 0 1-9 0V6.5Zm4.5 12a6.5 6.5 0 0 0 6.5-6.5V5h-5a2.5 2.5 0 0 0-2.5 2.5V10a6.5 6.5 0 0 0 1 8.5Zm-7 1.5a1 1 0 0 1-1-1v-4a6.5 6.5 0 0 1 6.5-6.5h1a1 1 0 1 1 0 2h-1A4.5 4.5 0 0 0 6 15v4a1 1 0 0 1-1 1Z"
            fill="currentColor"
          />
        </svg>
      </button>

      <input
        v-if="allowAttachments"
        ref="fileInput"
        class="prompt-input__file-input"
        type="file"
        :accept="accept"
        multiple
        :disabled="disabled"
        @change="handleFiles"
      />

      <textarea
        ref="textareaEl"
        class="prompt-input__field"
        :value="modelValue"
        :placeholder="placeholder"
        :disabled="disabled"
        rows="1"
        @input="onInput"
        @keydown="onKeydown"
      ></textarea>

      <button
        type="button"
        class="prompt-input__send"
        :disabled="disabled || busy || !canSend"
        aria-label="Send prompt"
        @click="emitSend"
      >
        <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
          <path d="M4 12 20 4l-4 16-5-6-7-2Z" fill="currentColor" />
        </svg>
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { PROMPT_FILE_ACCEPT } from '@desource/browser-ai';
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue';

export type PromptAttachment = {
  id: string;
  file?: File;
  url?: string;
  name: string;
  type: string;
};

interface Props {
  modelValue: string;
  attachments: PromptAttachment[];
  placeholder?: string;
  disabled?: boolean;
  busy?: boolean;
  sendOnEnter?: boolean;
  allowAttachments?: boolean;
  allowVoice?: boolean;
  accept?: string;
  maxAttachments?: number;
}

const props = withDefaults(defineProps<Props>(), {
  placeholder: 'Ask the assistant... ',
  disabled: false,
  busy: false,
  sendOnEnter: true,
  allowAttachments: false,
  allowVoice: false,
  accept: PROMPT_FILE_ACCEPT,
  maxAttachments: undefined
});

const emit = defineEmits<{
  'update:modelValue': [value: string];
  'update:attachments': [value: PromptAttachment[]];
  send: [];
  voice: [];
}>();

const fileInput = ref<HTMLInputElement | null>(null);
const textareaEl = ref<HTMLTextAreaElement | null>(null);
const createdUrls = new Set<string>();
let resizeFrame: number | null = null;

const canSend = computed(() => {
  return props.modelValue.trim().length > 0 || props.attachments.length > 0;
});

const onInput = (event: Event) => {
  const target = event.target as HTMLTextAreaElement;
  emit('update:modelValue', target.value);
  scheduleResize();
};

const resizeTextarea = () => {
  resizeFrame = null;
  const element = textareaEl.value;
  if (!element) return;
  element.style.height = 'auto';
  element.style.height = `${Math.min(element.scrollHeight, 160)}px`;
};

const scheduleResize = () => {
  if (typeof window === 'undefined' || resizeFrame !== null) return;
  resizeFrame = window.requestAnimationFrame(resizeTextarea);
};

const onKeydown = (event: KeyboardEvent) => {
  if (!props.sendOnEnter) return;
  if (event.isComposing || event.key !== 'Enter' || event.shiftKey || event.metaKey || event.ctrlKey || event.altKey) {
    return;
  }
  event.preventDefault();
  emitSend();
};

const emitSend = () => {
  if (!canSend.value || props.disabled || props.busy) return;
  emit('send');
};

const handleVoice = () => {
  if (props.disabled) return;
  emit('voice');
};

const triggerFile = () => {
  if (props.disabled) return;
  fileInput.value?.click();
};

const handleFiles = (event: Event) => {
  const target = event.target as HTMLInputElement;
  const files = Array.from(target.files || []);
  if (files.length === 0) return;

  const availableSlots =
    props.maxAttachments == null ? files.length : Math.max(props.maxAttachments - props.attachments.length, 0);
  if (availableSlots === 0) {
    target.value = '';
    return;
  }

  const selectedFiles = files.slice(0, availableSlots);
  const next = selectedFiles.map((file) => {
    const url = URL.createObjectURL(file);
    createdUrls.add(url);
    return {
      id:
        typeof crypto !== 'undefined' && 'randomUUID' in crypto
          ? crypto.randomUUID()
          : `${Date.now()}-${Math.random()}`,
      file,
      url,
      name: file.name,
      type: file.type
    };
  });

  emit('update:attachments', [...props.attachments, ...next]);
  target.value = '';
};

const removeAttachment = (id: string) => {
  emit(
    'update:attachments',
    props.attachments.filter((item) => item.id !== id)
  );
};

watch(
  () => props.attachments,
  (next, previous = []) => {
    const nextIds = new Set(next.map((item) => item.id));
    previous.forEach((attachment) => {
      if (attachment.url && createdUrls.has(attachment.url) && !nextIds.has(attachment.id)) {
        URL.revokeObjectURL(attachment.url);
        createdUrls.delete(attachment.url);
      }
    });
  },
  { deep: true }
);

watch(
  () => props.modelValue,
  () => void nextTick(scheduleResize)
);

onMounted(scheduleResize);

onBeforeUnmount(() => {
  if (resizeFrame !== null) {
    window.cancelAnimationFrame(resizeFrame);
  }
  createdUrls.forEach((url) => URL.revokeObjectURL(url));
  createdUrls.clear();
});
</script>
