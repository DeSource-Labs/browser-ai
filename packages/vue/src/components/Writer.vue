<template>
  <WritingAssistant
    kind="writer"
    v-bind="props"
    @update:model-value="$emit('update:modelValue', $event)"
    @availability-change="$emit('availability-change', $event)"
    @progress="$emit('progress', $event as WriterProgressState)"
    @result="$emit('write', $event as WriterResult)"
    @error="$emit('error', $event)"
  />
</template>

<script setup lang="ts">
import type { WriterProgressState, WriterResult } from '../composables/useWriter';
import WritingAssistant from './WritingAssistant.vue';
import { writingAssistantDefaults, type WritingAssistantProps } from './writing-assistant-props';

interface Props extends WritingAssistantProps<WriterTone, WriterFormat, WriterLength> {}

const props = withDefaults(defineProps<Props>(), {
  ...writingAssistantDefaults,
  placeholder: 'Describe what you want to write...',
  contextPlaceholder: 'Optional audience, constraints, facts, examples, or source material',
  emptyOutputMessage: 'Generated draft will appear here.',
  tone: 'neutral',
  format: 'markdown',
  length: 'medium'
});

defineEmits<{
  'update:modelValue': [value: string];
  'availability-change': [availability: Availability];
  progress: [state: WriterProgressState];
  write: [result: WriterResult];
  error: [error: unknown];
}>();
</script>
