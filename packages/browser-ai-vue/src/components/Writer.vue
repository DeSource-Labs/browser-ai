<template>
  <WritingAssistant
    kind="writer"
    :model-value="modelValue"
    :placeholder="placeholder"
    :context-placeholder="contextPlaceholder"
    :empty-output-message="emptyOutputMessage"
    :tone="tone"
    :format="format"
    :length="length"
    :shared-context="sharedContext"
    :context="context"
    :output-language="outputLanguage"
    :expected-input-languages="expectedInputLanguages"
    :expected-context-languages="expectedContextLanguages"
    :auto-init="autoInit"
    :auto-create="autoCreate"
    :strip-html="stripHtml"
    :fit-strategy="fitStrategy"
    :stream="stream"
    :render-markdown="renderMarkdown"
    :disabled="disabled"
    @update:model-value="$emit('update:modelValue', $event)"
    @availability-change="$emit('availability-change', $event)"
    @progress="$emit('progress', $event as WriterProgressState)"
    @result="$emit('write', $event as WriterResult)"
    @error="$emit('error', $event)"
  />
</template>

<script setup lang="ts">
import type { WriterFitStrategy, WriterProgressState, WriterResult } from '../composables/useWriter';
import WritingAssistant from './WritingAssistant.vue';

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

withDefaults(defineProps<Props>(), {
  modelValue: '',
  placeholder: 'Describe what you want to write...',
  contextPlaceholder: 'Optional audience, constraints, facts, examples, or source material',
  emptyOutputMessage: 'Generated draft will appear here.',
  tone: 'neutral',
  format: 'markdown',
  length: 'medium',
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

defineEmits<{
  'update:modelValue': [value: string];
  'availability-change': [availability: Availability];
  progress: [state: WriterProgressState];
  write: [result: WriterResult];
  error: [error: unknown];
}>();
</script>
