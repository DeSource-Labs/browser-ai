<template>
  <WritingAssistant
    kind="rewriter"
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
    @progress="$emit('progress', $event as RewriterProgressState)"
    @result="$emit('rewrite', $event as RewriterResult)"
    @error="$emit('error', $event)"
  />
</template>

<script setup lang="ts">
import type { RewriterFitStrategy, RewriterProgressState, RewriterResult } from '../composables/useRewriter';
import WritingAssistant from './WritingAssistant.vue';

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

withDefaults(defineProps<Props>(), {
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

defineEmits<{
  'update:modelValue': [value: string];
  'availability-change': [availability: Availability];
  progress: [state: RewriterProgressState];
  rewrite: [result: RewriterResult];
  error: [error: unknown];
}>();
</script>
