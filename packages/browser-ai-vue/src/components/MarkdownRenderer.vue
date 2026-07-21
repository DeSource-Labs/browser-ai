<template>
  <div class="browser-ai-markdown" v-html="renderedContent"></div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { renderMarkdown } from '../utils/markdown';

interface Props {
  content: string;
}

const props = defineProps<Props>();
const renderedContent = computed(() => renderMarkdown(props.content));
</script>

<style scoped>
.browser-ai-markdown {
  min-width: 0;
  overflow-wrap: anywhere;
  color: inherit;
  font: inherit;
  line-height: 1.58;
}

.browser-ai-markdown :deep(> :first-child) {
  margin-top: 0;
}

.browser-ai-markdown :deep(> :last-child) {
  margin-bottom: 0;
}

.browser-ai-markdown :deep(p),
.browser-ai-markdown :deep(ul),
.browser-ai-markdown :deep(ol),
.browser-ai-markdown :deep(blockquote),
.browser-ai-markdown :deep(pre),
.browser-ai-markdown :deep(table) {
  margin: 0.7em 0;
}

.browser-ai-markdown :deep(h1),
.browser-ai-markdown :deep(h2),
.browser-ai-markdown :deep(h3),
.browser-ai-markdown :deep(h4) {
  margin: 1.1em 0 0.45em;
  color: var(--color-primary, #fff);
  font-weight: 760;
  line-height: 1.22;
  letter-spacing: -0.025em;
}

.browser-ai-markdown :deep(h1) {
  font-size: 1.35em;
}

.browser-ai-markdown :deep(h2) {
  font-size: 1.2em;
}

.browser-ai-markdown :deep(h3),
.browser-ai-markdown :deep(h4) {
  font-size: 1.05em;
}

.browser-ai-markdown :deep(ul),
.browser-ai-markdown :deep(ol) {
  padding-left: 1.35rem;
}

.browser-ai-markdown :deep(li + li) {
  margin-top: 0.28em;
}

.browser-ai-markdown :deep(a) {
  color: #a9c7ff;
  text-decoration: underline;
  text-decoration-color: rgba(169, 199, 255, 0.42);
  text-underline-offset: 0.16em;
}

.browser-ai-markdown :deep(blockquote) {
  padding: 0.15rem 0 0.15rem 0.85rem;
  color: var(--color-secondary, rgba(255, 255, 255, 0.66));
  border-left: 3px solid rgba(167, 139, 250, 0.65);
}

.browser-ai-markdown :deep(code) {
  padding: 0.08em 0.34em;
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 0.35rem;
  background: rgba(0, 0, 0, 0.3);
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  font-size: 0.87em;
}

.browser-ai-markdown :deep(pre) {
  max-width: 100%;
  overflow-x: auto;
  padding: 0.8rem 0.9rem;
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 0.72rem;
  background: rgba(2, 5, 13, 0.74);
  line-height: 1.55;
  scrollbar-width: thin;
}

.browser-ai-markdown :deep(pre code) {
  display: block;
  padding: 0;
  border: 0;
  background: transparent;
  font-size: 0.84em;
  white-space: pre;
  overflow-wrap: normal;
}

.browser-ai-markdown :deep(table) {
  display: block;
  max-width: 100%;
  overflow-x: auto;
  border-spacing: 0;
  border-collapse: collapse;
  font-size: 0.9em;
}

.browser-ai-markdown :deep(th),
.browser-ai-markdown :deep(td) {
  padding: 0.48rem 0.62rem;
  border: 1px solid rgba(255, 255, 255, 0.12);
  text-align: left;
  white-space: nowrap;
}

.browser-ai-markdown :deep(th) {
  background: rgba(255, 255, 255, 0.06);
}

.browser-ai-markdown :deep(hr) {
  margin: 1rem 0;
  border: 0;
  border-top: 1px solid rgba(255, 255, 255, 0.12);
}
</style>
