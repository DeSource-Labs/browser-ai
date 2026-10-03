<template>
  <WritingAssistant
    kind="rewriter"
    v-bind="props"
    @update:model-value="$emit('update:modelValue', $event)"
    @availability-change="$emit('availability-change', $event)"
    @progress="$emit('progress', $event as RewriterProgressState)"
    @result="$emit('rewrite', $event as RewriterResult)"
    @error="$emit('error', $event)"
  />
</template>

<script setup lang="ts">
import type { RewriterProgressState, RewriterResult } from '../composables/useRewriter';
import WritingAssistant from './WritingAssistant.vue';
import { writingAssistantDefaults, type WritingAssistantProps } from './writing-assistant-props';

interface Props extends WritingAssistantProps<RewriterTone, RewriterFormat, RewriterLength> {}

const props = withDefaults(defineProps<Props>(), {
  ...writingAssistantDefaults,
  placeholder: 'Paste or write the text you want to rewrite...',
  contextPlaceholder: 'Optional audience, constraints, tone notes, or rewrite rules',
  emptyOutputMessage: 'Rewritten text will appear here.',
  tone: 'as-is',
  format: 'as-is',
  length: 'as-is'
});

defineEmits<{
  'update:modelValue': [value: string];
  'availability-change': [availability: Availability];
  progress: [state: RewriterProgressState];
  rewrite: [result: RewriterResult];
  error: [error: unknown];
}>();
</script>
