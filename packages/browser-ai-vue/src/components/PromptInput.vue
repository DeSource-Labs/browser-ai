<template>
  <div class="prompt-input">
    <div v-if="allowAttachments && attachments.length" class="prompt-input__attachments">
      <div v-for="attachment in attachments" :key="attachment.id" class="prompt-input__attachment">
        <img v-if="attachment.type.startsWith('image/')" :src="attachment.url" :alt="attachment.name" />
        <div v-else class="prompt-input__file">
          {{ attachment.name }}
        </div>
        <button type="button" class="prompt-input__remove" @click="removeAttachment(attachment.id)">
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
          <path d="M12 3a3 3 0 0 1 3 3v5a3 3 0 0 1-6 0V6a3 3 0 0 1 3-3Zm-5 8a5 5 0 0 0 10 0h2a7 7 0 0 1-6 6.92V21h-2v-3.08A7 7 0 0 1 5 11h2Z" fill="currentColor" />
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
          <path d="M7.5 6.5A4.5 4.5 0 0 1 12 2h5a1 1 0 0 1 1 1v5.5a4.5 4.5 0 0 1-9 0V6.5Zm4.5 12a6.5 6.5 0 0 0 6.5-6.5V5h-5a2.5 2.5 0 0 0-2.5 2.5V10a6.5 6.5 0 0 0 1 8.5Zm-7 1.5a1 1 0 0 1-1-1v-4a6.5 6.5 0 0 1 6.5-6.5h1a1 1 0 1 1 0 2h-1A4.5 4.5 0 0 0 6 15v4a1 1 0 0 1-1 1Z" fill="currentColor" />
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
import { computed, onBeforeUnmount, ref, watch } from 'vue';

export type PromptAttachment = {
  id: string;
  file: File;
  url: string;
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
  accept: 'image/*',
  maxAttachments: undefined
});

const emit = defineEmits<{
  'update:modelValue': [value: string];
  'update:attachments': [value: PromptAttachment[]];
  send: [];
  voice: [];
}>();

const fileInput = ref<HTMLInputElement | null>(null);

const canSend = computed(() => {
  return props.modelValue.trim().length > 0 || props.attachments.length > 0;
});

const onInput = (event: Event) => {
  const target = event.target as HTMLTextAreaElement;
  emit('update:modelValue', target.value);
};

const onKeydown = (event: KeyboardEvent) => {
  if (!props.sendOnEnter) return;
  if (event.key !== 'Enter' || event.shiftKey || event.metaKey || event.ctrlKey || event.altKey) {
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

  const availableSlots = props.maxAttachments ? Math.max(props.maxAttachments - props.attachments.length, 0) : files.length;
  if (availableSlots === 0) {
    target.value = '';
    return;
  }

  const selectedFiles = files.slice(0, availableSlots);
  const next = selectedFiles.map((file) => ({
    id: typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`,
    file,
    url: URL.createObjectURL(file),
    name: file.name,
    type: file.type
  }));

  emit('update:attachments', [...props.attachments, ...next]);
  target.value = '';
};

const removeAttachment = (id: string) => {
  const toRemove = props.attachments.find(item => item.id === id);
  if (toRemove) {
    URL.revokeObjectURL(toRemove.url);
  }
  emit('update:attachments', props.attachments.filter(item => item.id !== id));
};

watch(() => props.attachments, (next, previous = []) => {
  const nextIds = new Set(next.map((item) => item.id));
  previous.forEach((attachment) => {
    if (!nextIds.has(attachment.id)) {
      URL.revokeObjectURL(attachment.url);
    }
  });
}, { deep: true });

onBeforeUnmount(() => {
  props.attachments.forEach((attachment) => {
    URL.revokeObjectURL(attachment.url);
  });
});
</script>

<style scoped>
.prompt-input {
  flex-shrink: 0;
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  padding: 0.75rem;
  border-radius: 1rem;
  background: rgba(30, 30, 30, 0.5);
  border: 1px solid rgba(120, 120, 120, 0.25);
  backdrop-filter: blur(10px);
  pointer-events: all;
}

.prompt-input__attachments {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
}

.prompt-input__attachment {
  position: relative;
  width: 72px;
  height: 72px;
  border-radius: 0.6rem;
  overflow: hidden;
  background: rgba(0, 0, 0, 0.35);
  border: 1px solid rgba(255, 255, 255, 0.1);
}

.prompt-input__attachment img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}

.prompt-input__file {
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 0.7rem;
  color: var(--color-secondary);
  padding: 0.25rem;
  text-align: center;
}

.prompt-input__remove {
  position: absolute;
  top: 4px;
  right: 4px;
  width: 20px;
  height: 20px;
  border-radius: 50%;
  border: none;
  background: rgba(0, 0, 0, 0.6);
  color: var(--color-primary);
  cursor: pointer;
  display: grid;
  place-items: center;
}

.prompt-input__row {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.prompt-input__icon {
  width: 36px;
  height: 36px;
  border-radius: 0.7rem;
  border: 1px solid rgba(120, 120, 120, 0.35);
  background: rgba(255, 255, 255, 0.05);
  color: var(--color-primary);
  cursor: pointer;
  display: grid;
  place-items: center;
  transition: background 0.2s ease;
}

.prompt-input__icon:hover {
  background: rgba(255, 255, 255, 0.12);
}

.prompt-input__file-input {
  display: none;
}

.prompt-input__field {
  flex: 1;
  resize: none;
  border: none;
  background: transparent;
  color: var(--color-primary);
  font-size: 0.95rem;
  padding: 0.35rem 0.5rem;
}

.prompt-input__field:focus {
  outline: none;
}

.prompt-input__send {
  width: 40px;
  height: 40px;
  border-radius: 0.8rem;
  border: none;
  background: rgba(120, 120, 120, 0.35);
  color: var(--color-primary);
  cursor: pointer;
  display: grid;
  place-items: center;
  transition: background 0.2s ease;
}

.prompt-input__send:hover {
  background: rgba(180, 180, 180, 0.35);
}

.prompt-input__send:disabled,
.prompt-input__icon:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
</style>
